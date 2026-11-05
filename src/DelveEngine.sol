// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title DelveEngine
/// @notice Onchain twin of web/engine.js: a deterministic, integer-only roguelike. Given a seed,
///         the delver's level, the burrow mood and a tape of actions, it rebuilds every floor and
///         replays every turn. Any rule change must be made in both files (parity fixture tests it).
library DelveEngine {
    uint256 internal constant W = 15;
    uint256 internal constant H = 11;
    uint256 internal constant FLOORS = 5;
    uint256 internal constant MAX_TAPE = 600;
    uint256 internal constant MAX_ENEMIES = 8;
    uint256 internal constant MAX_ITEMS = 6;
    int256 internal constant START_X = 7;
    int256 internal constant START_Y = 5;
    uint256 internal constant CARVE_TARGET = 72;
    uint256 internal constant CARVE_CAP = 3000;
    uint256 internal constant PLACE_TRIES = 100;

    uint8 internal constant SNOOZE = 0;
    uint8 internal constant JOG = 2;
    uint8 internal constant ZOOMIES = 3;
    uint8 internal constant FLEE = 5;
    uint8 internal constant SEED = 0;

    struct Enemy {
        uint8 kind;
        int256 x;
        int256 y;
        int256 hp;
        bool alive;
    }

    struct Item {
        uint8 kind;
        int256 x;
        int256 y;
        bool taken;
    }

    struct Floor {
        uint256 open; // bit y*W+x set = walkable
        int256 sx; // stairs
        int256 sy;
        Enemy[] enemies;
        Item[] items;
    }

    struct Run {
        uint32 seed;
        uint8 mood;
        int256 hp;
        int256 maxHp;
        int256 atk;
        uint256 floor;
        int256 px;
        int256 py;
        uint256 gold;
        uint256 kills;
        uint256 killScore;
        uint256 turn;
        bool dead;
        bool won;
        bool fled;
        Floor f;
    }

    struct Result {
        uint256 score;
        uint256 floor;
        uint256 kills;
        uint256 gold;
        uint256 hp;
        uint256 turns;
        bool won;
        bool dead;
    }

    error TapeTooLong(uint256 length);

    // ------------------------------------------------------------------ rules

    function enemyStats(uint8 kind) internal pure returns (int256 hp, int256 atk, int256 sight, uint256 value) {
        if (kind == 0) return (2, 1, 4, 3); // beetle
        if (kind == 1) return (3, 2, 5, 5); // snake
        return (6, 3, 6, 12); // cat
    }

    function moodForWork(uint256 work) internal pure returns (uint8) {
        if (work >= 300) return 3;
        if (work >= 100) return 2;
        if (work >= 1) return 1;
        return 0;
    }

    function seedValue(uint256 floor, uint8 mood) internal pure returns (uint256 v) {
        v = 3 + floor;
        if (mood == JOG) v += 2;
        if (mood == ZOOMIES) v *= 2;
    }

    function next(uint32 x) private pure returns (uint32) {
        unchecked {
            x ^= x << 13;
            x ^= x >> 17;
            x ^= x << 5;
        }
        return x;
    }

    function _abs(int256 v) private pure returns (int256) {
        return v < 0 ? -v : v;
    }

    function _dist(int256 ax, int256 ay, int256 bx, int256 by) private pure returns (int256) {
        return _abs(ax - bx) + _abs(ay - by);
    }

    function _sign(int256 v) private pure returns (int256) {
        return v > 0 ? int256(1) : v < 0 ? int256(-1) : int256(0);
    }

    function isOpen(uint256 open, int256 x, int256 y) internal pure returns (bool) {
        if (x < 0 || y < 0 || x >= int256(W) || y >= int256(H)) return false;
        return (open >> (uint256(y) * W + uint256(x))) & 1 == 1;
    }

    // -------------------------------------------------------------- generation

    struct Gen {
        uint32 rng;
        uint256 nEnemies;
        uint256 nItems;
    }

    function genFloor(uint32 seed, uint256 floor, uint8 mood) internal pure returns (Floor memory f) {
        Gen memory g;
        g.rng = seed ^ uint32(uint256(floor) * 0x9E3779B9);
        if (g.rng == 0) g.rng = 1;

        int256 x = START_X;
        int256 y = START_Y;
        uint256 open = uint256(1) << (uint256(y) * W + uint256(x));
        uint256 count = 1;
        for (uint256 i; i < CARVE_CAP && count < CARVE_TARGET; ++i) {
            g.rng = next(g.rng);
            uint256 d = g.rng % 4;
            int256 nx = x + (d == 1 ? int256(1) : d == 3 ? int256(-1) : int256(0));
            int256 ny = y + (d == 0 ? int256(-1) : d == 2 ? int256(1) : int256(0));
            if (nx < 1 || nx > int256(W) - 2 || ny < 1 || ny > int256(H) - 2) continue;
            x = nx;
            y = ny;
            uint256 bit = uint256(1) << (uint256(y) * W + uint256(x));
            if (open & bit == 0) {
                open |= bit;
                ++count;
            }
        }
        f.open = open;

        f.sx = START_X;
        f.sy = START_Y;
        int256 best;
        for (int256 cy = 1; cy <= int256(H) - 2; ++cy) {
            for (int256 cx = 1; cx <= int256(W) - 2; ++cx) {
                int256 dd = _dist(cx, cy, START_X, START_Y);
                if (isOpen(open, cx, cy) && dd > best) {
                    best = dd;
                    f.sx = cx;
                    f.sy = cy;
                }
            }
        }

        f.enemies = new Enemy[](MAX_ENEMIES);
        f.items = new Item[](MAX_ITEMS);

        uint256 want = 1 + floor + (mood == ZOOMIES ? 1 : 0);
        if (want > MAX_ENEMIES) want = MAX_ENEMIES;
        uint256 range = floor >= 4 ? 3 : floor >= 2 ? 2 : 1;
        for (uint256 k; k < want; ++k) {
            g.rng = next(g.rng);
            uint8 kind = uint8(g.rng % range);
            if (floor == FLOORS && k == 0) kind = 2;
            (bool ok, int256 px, int256 py) = _place(f, g, 3);
            if (ok) {
                (int256 hp,,,) = enemyStats(kind);
                f.enemies[g.nEnemies++] = Enemy(kind, px, py, hp, true);
            }
        }
        g.rng = next(g.rng);
        uint256 nSeeds = 3 + (g.rng % 3);
        for (uint256 k; k < nSeeds; ++k) {
            (bool ok, int256 px, int256 py) = _place(f, g, 1);
            if (ok) f.items[g.nItems++] = Item(SEED, px, py, false);
        }
        (bool okc, int256 cxx, int256 cyy) = _place(f, g, 1);
        if (okc) f.items[g.nItems++] = Item(1, cxx, cyy, false);

        Enemy[] memory es = f.enemies;
        Item[] memory its = f.items;
        uint256 ne = g.nEnemies;
        uint256 ni = g.nItems;
        assembly {
            mstore(es, ne)
            mstore(its, ni)
        }
    }

    function _place(Floor memory f, Gen memory g, int256 minDist) private pure returns (bool, int256, int256) {
        for (uint256 t; t < PLACE_TRIES; ++t) {
            g.rng = next(g.rng);
            int256 cx = 1 + int256(uint256(g.rng % (W - 2)));
            g.rng = next(g.rng);
            int256 cy = 1 + int256(uint256(g.rng % (H - 2)));
            if (
                isOpen(f.open, cx, cy) && !_taken(f, g, cx, cy) && _dist(cx, cy, START_X, START_Y) >= minDist
            ) return (true, cx, cy);
        }
        return (false, 0, 0);
    }

    function _taken(Floor memory f, Gen memory g, int256 cx, int256 cy) private pure returns (bool) {
        if ((cx == START_X && cy == START_Y) || (cx == f.sx && cy == f.sy)) return true;
        for (uint256 i; i < g.nEnemies; ++i) {
            if (f.enemies[i].x == cx && f.enemies[i].y == cy) return true;
        }
        for (uint256 i; i < g.nItems; ++i) {
            if (f.items[i].x == cx && f.items[i].y == cy) return true;
        }
        return false;
    }

    // ------------------------------------------------------------------- play

    function simulate(uint32 seed, uint8 level, uint8 mood, bytes calldata tape)
        internal
        pure
        returns (Result memory res)
    {
        if (tape.length > MAX_TAPE) revert TapeTooLong(tape.length);
        Run memory r;
        r.seed = seed;
        r.mood = mood;
        uint256 lvl = level < 1 ? 1 : level > 10 ? 10 : level;
        r.maxHp = int256(6 + 2 * lvl);
        r.hp = r.maxHp;
        r.atk = int256(1 + lvl / 3);
        r.floor = 1;
        r.px = START_X;
        r.py = START_Y;
        r.f = genFloor(seed, 1, mood);

        for (uint256 i; i < tape.length; ++i) {
            if (r.dead || r.won || r.fled) break;
            _step(r, uint8(tape[i]));
        }

        uint256 gold = r.dead ? r.gold / 2 : r.gold;
        res.score = gold + r.killScore + 20 * (r.floor - 1) + (r.won ? 100 + 5 * uint256(r.hp) : 0);
        res.floor = r.floor;
        res.kills = r.kills;
        res.gold = r.gold;
        res.hp = uint256(r.hp);
        res.turns = r.turn;
        res.won = r.won;
        res.dead = r.dead;
    }

    function _enemyAt(Floor memory f, int256 x, int256 y) private pure returns (bool, uint256) {
        for (uint256 i; i < f.enemies.length; ++i) {
            Enemy memory e = f.enemies[i];
            if (e.alive && e.x == x && e.y == y) return (true, i);
        }
        return (false, 0);
    }

    function _step(Run memory r, uint8 action) private pure {
        ++r.turn;
        if (action == FLEE) {
            r.fled = true;
            return;
        }
        if (action <= 3) {
            int256 tx = r.px + (action == 1 ? int256(1) : action == 3 ? int256(-1) : int256(0));
            int256 ty = r.py + (action == 0 ? int256(-1) : action == 2 ? int256(1) : int256(0));
            if (isOpen(r.f.open, tx, ty)) {
                (bool hit, uint256 ei) = _enemyAt(r.f, tx, ty);
                if (hit) {
                    Enemy memory e = r.f.enemies[ei];
                    e.hp -= r.atk;
                    if (e.hp <= 0) {
                        e.alive = false;
                        ++r.kills;
                        (,,, uint256 value) = enemyStats(e.kind);
                        r.killScore += value;
                    }
                } else {
                    r.px = tx;
                    r.py = ty;
                    _pickup(r, tx, ty);
                    if (tx == r.f.sx && ty == r.f.sy) {
                        if (r.floor == FLOORS) {
                            r.won = true;
                            return;
                        }
                        ++r.floor;
                        r.f = genFloor(r.seed, r.floor, r.mood);
                        r.px = START_X;
                        r.py = START_Y;
                        return;
                    }
                }
            }
        }
        if (r.mood == SNOOZE && r.turn % 2 == 1) return;
        _enemiesAct(r);
    }

    function _pickup(Run memory r, int256 x, int256 y) private pure {
        for (uint256 i; i < r.f.items.length; ++i) {
            Item memory it = r.f.items[i];
            if (!it.taken && it.x == x && it.y == y) {
                it.taken = true;
                if (it.kind == SEED) {
                    r.gold += seedValue(r.floor, r.mood);
                } else {
                    r.hp = r.hp + 4 > r.maxHp ? r.maxHp : r.hp + 4;
                }
                return;
            }
        }
    }

    function _enemiesAct(Run memory r) private pure {
        for (uint256 i; i < r.f.enemies.length; ++i) {
            Enemy memory e = r.f.enemies[i];
            if (!e.alive) continue;
            (, int256 atk, int256 sight,) = enemyStats(e.kind);
            int256 d = _dist(e.x, e.y, r.px, r.py);
            if (d == 1) {
                r.hp -= atk;
                if (r.hp <= 0) {
                    r.hp = 0;
                    r.dead = true;
                    return;
                }
            } else if (d <= sight) {
                int256 dx = r.px - e.x;
                int256 dy = r.py - e.y;
                int256 sx = _sign(dx);
                int256 sy = _sign(dy);
                bool horizontalFirst = _abs(dx) >= _abs(dy);
                if (!_tryMove(r, e, horizontalFirst ? sx : int256(0), horizontalFirst ? int256(0) : sy)) {
                    _tryMove(r, e, horizontalFirst ? int256(0) : sx, horizontalFirst ? sy : int256(0));
                }
            }
        }
    }

    function _tryMove(Run memory r, Enemy memory e, int256 mx, int256 my) private pure returns (bool) {
        if (mx == 0 && my == 0) return false;
        int256 nx = e.x + mx;
        int256 ny = e.y + my;
        if (!isOpen(r.f.open, nx, ny) || (nx == r.px && ny == r.py)) return false;
        (bool blocked,) = _enemyAt(r.f, nx, ny);
        if (blocked) return false;
        e.x = nx;
        e.y = ny;
        return true;
    }
}
