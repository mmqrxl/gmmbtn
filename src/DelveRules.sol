// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title DelveRules
/// @notice Onchain twin of web/engine.js: a deterministic, integer-only roguelike. Given a run seed,
///         the delver's level, the burrow mood and a tape of actions, it rebuilds every floor and
///         replays every turn, including loot rolls and crits. Any rule change must be made in both
///         files; tools/parity.mjs + test/DelveParity.t.sol check they agree.
contract DelveRules {
    int256 internal constant W = 17;
    int256 internal constant H = 13;
    uint256 internal constant FLOORS = 6;
    uint256 public constant MAX_TAPE = 1000;
    uint256 internal constant MAX_ENEMIES = 10;
    uint256 internal constant MAX_ITEMS = 16;
    uint256 internal constant CAVE_TARGET = 85;
    uint256 internal constant MIXED_EXTRA = 25;
    uint256 internal constant CARVE_CAP = 4000;
    uint256 internal constant PLACE_TRIES = 100;

    uint8 internal constant SNOOZE = 0;
    uint8 internal constant JOG = 2;
    uint8 internal constant ZOOMIES = 3;
    uint8 internal constant FLEE = 5;
    uint8 internal constant FIRE_UP = 6;
    uint8 internal constant FIRE_LEFT = 9;
    uint8 internal constant SEED = 0;
    uint8 internal constant CHEESE = 1;
    uint8 internal constant CHEST = 2;
    uint8 internal constant RAT = 2;
    uint8 internal constant MOLE = 3;
    uint8 internal constant CAT = 4;
    uint256 internal constant CAVE = 0;
    uint256 internal constant ROOMS = 1;
    uint256 internal constant MIXED = 2;

    struct Enemy {
        uint8 kind;
        int256 x;
        int256 y;
        int256 hp;
        int256 atk;
        bool alive;
    }

    struct Item {
        uint8 kind;
        int256 x;
        int256 y;
        bool taken;
    }

    struct Floor {
        uint256 style;
        uint256 open; // bit y*W+x set = walkable
        uint256 count;
        int256 startX;
        int256 startY;
        int256 sx; // stairs
        int256 sy;
        Enemy[] enemies;
        uint256 nEnemies;
        Item[] items;
        uint256 nItems;
        uint32 rng;
    }

    struct Run {
        uint32 seed;
        uint32 rng;
        uint8 mood;
        int256 hp;
        int256 maxHp;
        int256 baseAtk;
        uint256 weapon;
        uint256 armor;
        uint256 sling;
        uint256 pebbles;
        uint256 crit;
        uint256 luck;
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
        uint8 weapon;
        uint8 armor;
        uint8 sling;
    }

    error TapeTooLong(uint256 length);

    // ------------------------------------------------------------------ tables

    function _enemy(uint8 kind)
        private
        pure
        returns (int256 hp, int256 atk, int256 sight, uint256 value, uint256 drop)
    {
        if (kind == 0) return (2, 1, 4, 3, 10); // beetle
        if (kind == 1) return (4, 2, 5, 6, 15); // snake
        if (kind == 2) return (2, 1, 6, 5, 15); // rat
        if (kind == 3) return (7, 2, 3, 10, 35); // mole
        return (14, 3, 8, 30, 0); // cat
    }

    function _weapon(uint256 t) private pure returns (int256 atk, bool pierce) {
        if (t == 0) return (1, false);
        if (t == 1) return (2, false);
        if (t == 2) return (2, true);
        if (t == 3) return (3, false);
        return (4, true);
    }

    function _sling(uint256 t) private pure returns (int256 dmg, int256 range) {
        if (t == 0) return (1, 4);
        if (t == 1) return (2, 5);
        return (3, 6);
    }

    function _poolKind(uint256 floor, uint32 r) private pure returns (uint8) {
        if (floor == 1) return r % 3 == 2 ? RAT : 0;
        if (floor == 2) return uint8(r % 3);
        if (floor <= 4) return uint8(r % 4);
        if (floor == 5) {
            uint32 m = r % 4;
            return m == 0 ? 1 : m == 1 ? 2 : 3;
        }
        return uint8(1 + (r % 3));
    }

    function moodForWork(uint256 work) public pure returns (uint8) {
        if (work >= 300) return 3;
        if (work >= 100) return 2;
        if (work >= 1) return 1;
        return 0;
    }

    function _seedValue(uint256 floor, uint8 mood) private pure returns (uint256 v) {
        v = 3 + floor;
        if (mood == JOG) v += 2;
        if (mood == ZOOMIES) v *= 2;
    }

    function _xs(uint32 x) private pure returns (uint32) {
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

    function _sign(int256 v) private pure returns (int256) {
        return v > 0 ? int256(1) : v < 0 ? int256(-1) : int256(0);
    }

    function _dist(int256 ax, int256 ay, int256 bx, int256 by) private pure returns (int256) {
        return _abs(ax - bx) + _abs(ay - by);
    }

    function _dx(uint256 d) private pure returns (int256) {
        return d == 1 ? int256(1) : d == 3 ? int256(-1) : int256(0);
    }

    function _dy(uint256 d) private pure returns (int256) {
        return d == 0 ? int256(-1) : d == 2 ? int256(1) : int256(0);
    }

    function _isOpen(uint256 open, int256 x, int256 y) private pure returns (bool) {
        if (x < 0 || y < 0 || x >= W || y >= H) return false;
        return (open >> uint256(y * W + x)) & 1 == 1;
    }

    // -------------------------------------------------------------- generation

    function _next(Floor memory f) private pure returns (uint32) {
        f.rng = _xs(f.rng);
        return f.rng;
    }

    function _carve(Floor memory f, int256 x, int256 y) private pure {
        uint256 bit = uint256(1) << uint256(y * W + x);
        if (f.open & bit == 0) {
            f.open |= bit;
            ++f.count;
        }
    }

    function _walk(Floor memory f, int256 x, int256 y, uint256 target) private pure {
        for (uint256 i; i < CARVE_CAP && f.count < target; ++i) {
            uint256 d = _next(f) % 4;
            int256 nx = x + _dx(d);
            int256 ny = y + _dy(d);
            if (nx < 1 || nx > W - 2 || ny < 1 || ny > H - 2) continue;
            x = nx;
            y = ny;
            _carve(f, x, y);
        }
    }

    function _rooms(Floor memory f) private pure {
        uint256 nRooms = f.style == ROOMS ? 4 + (_next(f) % 3) : 3 + (_next(f) % 2);
        int256 px;
        int256 py;
        for (uint256 k; k < nRooms; ++k) {
            int256 rw = int256(uint256(3 + (_next(f) % 3)));
            int256 rh = int256(uint256(3 + (_next(f) % 2)));
            int256 rx = 1 + int256(uint256(_next(f) % uint256(W - 1 - rw)));
            int256 ry = 1 + int256(uint256(_next(f) % uint256(H - 1 - rh)));
            for (int256 y = ry; y < ry + rh; ++y) {
                for (int256 x = rx; x < rx + rw; ++x) {
                    _carve(f, x, y);
                }
            }
            int256 cx = rx + rw / 2;
            int256 cy = ry + rh / 2;
            if (k == 0) {
                f.startX = cx;
                f.startY = cy;
            } else {
                _corridor(f, px, py, cx, cy, _next(f) % 2 == 0);
            }
            px = cx;
            py = cy;
        }
        if (f.style == MIXED) _walk(f, px, py, f.count + MIXED_EXTRA);
    }

    function _corridor(Floor memory f, int256 x, int256 y, int256 cx, int256 cy, bool hFirst) private pure {
        if (hFirst) {
            while (x != cx) {
                x += _sign(cx - x);
                _carve(f, x, y);
            }
            while (y != cy) {
                y += _sign(cy - y);
                _carve(f, x, y);
            }
        } else {
            while (y != cy) {
                y += _sign(cy - y);
                _carve(f, x, y);
            }
            while (x != cx) {
                x += _sign(cx - x);
                _carve(f, x, y);
            }
        }
    }

    function _genFloor(uint32 seed, uint256 floor, uint8 mood) private pure returns (Floor memory f) {
        unchecked {
            f.rng = seed ^ uint32(floor * 0x9E3779B9);
        }
        if (f.rng == 0) f.rng = 1;

        f.style = floor == FLOORS ? ROOMS : _next(f) % 3;
        if (f.style == CAVE) {
            f.startX = 2 + int256(uint256(_next(f) % uint256(W - 4)));
            f.startY = 2 + int256(uint256(_next(f) % uint256(H - 4)));
            _carve(f, f.startX, f.startY);
            _walk(f, f.startX, f.startY, CAVE_TARGET);
        } else {
            _rooms(f);
        }

        f.sx = f.startX;
        f.sy = f.startY;
        int256 best;
        for (int256 cy = 1; cy <= H - 2; ++cy) {
            for (int256 cx = 1; cx <= W - 2; ++cx) {
                int256 dd = _dist(cx, cy, f.startX, f.startY);
                if (_isOpen(f.open, cx, cy) && dd > best) {
                    best = dd;
                    f.sx = cx;
                    f.sy = cy;
                }
            }
        }

        f.enemies = new Enemy[](MAX_ENEMIES);
        f.items = new Item[](MAX_ITEMS);
        uint256 want = 2 + floor + (mood == ZOOMIES ? 1 : 0);
        if (want > MAX_ENEMIES) want = MAX_ENEMIES;
        for (uint256 k; k < want; ++k) {
            uint32 r = _next(f);
            uint8 kind = floor == FLOORS && k == 0 ? CAT : _poolKind(floor, r);
            (bool ok, int256 x, int256 y) = _place(f, 3);
            if (ok) {
                (int256 hp, int256 atk,,,) = _enemy(kind);
                if (kind != CAT) {
                    hp += int256((floor - 1) / 2);
                    atk += int256((floor - 1) / 3);
                }
                f.enemies[f.nEnemies++] = Enemy(kind, x, y, hp, atk, true);
            }
        }
        _addItems(f, SEED, 3 + (_next(f) % 3), 1);
        _addItems(f, CHEESE, 1 + (floor >= 3 ? _next(f) % 2 : 0), 1);
        _addItems(f, CHEST, 1 + (_next(f) % 2) + (mood == JOG ? 1 : 0), 2);
    }

    function _addItems(Floor memory f, uint8 kind, uint256 n, int256 minDist) private pure {
        for (uint256 k; k < n; ++k) {
            (bool ok, int256 x, int256 y) = _place(f, minDist);
            if (ok) f.items[f.nItems++] = Item(kind, x, y, false);
        }
    }

    function _place(Floor memory f, int256 minDist) private pure returns (bool, int256, int256) {
        for (uint256 t; t < PLACE_TRIES; ++t) {
            int256 cx = 1 + int256(uint256(_next(f) % uint256(W - 2)));
            int256 cy = 1 + int256(uint256(_next(f) % uint256(H - 2)));
            if (_isOpen(f.open, cx, cy) && !_taken(f, cx, cy) && _dist(cx, cy, f.startX, f.startY) >= minDist) {
                return (true, cx, cy);
            }
        }
        return (false, 0, 0);
    }

    function _taken(Floor memory f, int256 cx, int256 cy) private pure returns (bool) {
        if ((cx == f.startX && cy == f.startY) || (cx == f.sx && cy == f.sy)) return true;
        for (uint256 i; i < f.nEnemies; ++i) {
            if (f.enemies[i].x == cx && f.enemies[i].y == cy) return true;
        }
        for (uint256 i; i < f.nItems; ++i) {
            if (f.items[i].x == cx && f.items[i].y == cy) return true;
        }
        return false;
    }

    // -------------------------------------------------------------------- play

    function simulate(uint32 seed, uint8 level, uint8 mood, bytes calldata tape)
        external
        pure
        returns (Result memory res)
    {
        if (tape.length > MAX_TAPE) revert TapeTooLong(tape.length);
        Run memory r;
        r.seed = seed;
        r.mood = mood;
        uint256 lvl = level < 1 ? 1 : level > 10 ? 10 : level;
        r.maxHp = int256(10 + 2 * lvl);
        r.hp = r.maxHp;
        r.baseAtk = int256(1 + lvl / 3);
        r.pebbles = 5;
        r.crit = 5;
        r.rng = seed ^ 0x85EBCA6B;
        if (r.rng == 0) r.rng = 1;
        _enterFloor(r, 1);

        for (uint256 i; i < tape.length; ++i) {
            if (r.dead || r.won || r.fled) break;
            _step(r, uint8(tape[i]));
        }

        uint256 gold = r.dead ? r.gold / 2 : r.gold;
        res.score = gold + r.killScore + 25 * (r.floor - 1) + (r.won ? 150 + 5 * uint256(r.hp) : 0);
        res.floor = r.floor;
        res.kills = r.kills;
        res.gold = r.gold;
        res.hp = uint256(r.hp);
        res.turns = r.turn;
        res.won = r.won;
        res.dead = r.dead;
        res.weapon = uint8(r.weapon);
        res.armor = uint8(r.armor);
        res.sling = uint8(r.sling);
    }

    /// @notice A floor's layout, for tests and tools. `open` has bit y*17+x set for walkable cells.
    function floorLayout(uint32 seed, uint8 floor, uint8 mood)
        external
        pure
        returns (
            uint256 open,
            uint256 style,
            int256[4] memory startAndStairs,
            int256[] memory enemies,
            int256[] memory items
        )
    {
        Floor memory f = _genFloor(seed, floor, mood);
        enemies = new int256[](f.nEnemies * 5);
        for (uint256 i; i < f.nEnemies; ++i) {
            Enemy memory e = f.enemies[i];
            (enemies[i * 5], enemies[i * 5 + 1], enemies[i * 5 + 2]) = (int256(uint256(e.kind)), e.x, e.y);
            (enemies[i * 5 + 3], enemies[i * 5 + 4]) = (e.hp, e.atk);
        }
        items = new int256[](f.nItems * 3);
        for (uint256 i; i < f.nItems; ++i) {
            (items[i * 3], items[i * 3 + 1], items[i * 3 + 2]) = (int256(uint256(f.items[i].kind)), f.items[i].x, f.items[i].y);
        }
        return (f.open, f.style, [f.startX, f.startY, f.sx, f.sy], enemies, items);
    }

    function _enterFloor(Run memory r, uint256 floor) private pure {
        r.floor = floor;
        r.f = _genFloor(r.seed, floor, r.mood);
        r.px = r.f.startX;
        r.py = r.f.startY;
    }

    function _roll(Run memory r) private pure returns (uint32) {
        r.rng = _xs(r.rng);
        return r.rng;
    }

    function _enemyAt(Floor memory f, int256 x, int256 y) private pure returns (bool, uint256) {
        for (uint256 i; i < f.nEnemies; ++i) {
            Enemy memory e = f.enemies[i];
            if (e.alive && e.x == x && e.y == y) return (true, i);
        }
        return (false, 0);
    }

    function _bossAlive(Run memory r) private pure returns (bool) {
        if (r.floor != FLOORS) return false;
        for (uint256 i; i < r.f.nEnemies; ++i) {
            if (r.f.enemies[i].kind == CAT && r.f.enemies[i].alive) return true;
        }
        return false;
    }

    function _step(Run memory r, uint8 action) private pure {
        ++r.turn;
        if (action == FLEE) {
            r.fled = true;
            return;
        }
        if (action <= 3) {
            if (_moveOrAttack(r, action)) return;
        } else if (action >= FIRE_UP && action <= FIRE_LEFT) {
            _fire(r, action - FIRE_UP);
        }
        if (r.mood == SNOOZE && r.turn % 2 == 1) return;
        _enemiesAct(r);
    }

    /// @return ended true when the turn ends without enemies acting (descended or won).
    function _moveOrAttack(Run memory r, uint256 d) private pure returns (bool ended) {
        int256 tx = r.px + _dx(d);
        int256 ty = r.py + _dy(d);
        if (!_isOpen(r.f.open, tx, ty)) return false;
        (bool hitE, uint256 ei) = _enemyAt(r.f, tx, ty);
        if (hitE) {
            (int256 wAtk, bool pierce) = _weapon(r.weapon);
            int256 dmg = r.baseAtk + wAtk;
            if (_roll(r) % 100 < r.crit) dmg *= 2;
            _hit(r, ei, dmg);
            if (pierce) {
                int256 bx = tx + _dx(d);
                int256 by = ty + _dy(d);
                if (_isOpen(r.f.open, bx, by)) {
                    (bool hitB, uint256 bj) = _enemyAt(r.f, bx, by);
                    if (hitB) _hit(r, bj, dmg);
                }
            }
            return false;
        }
        r.px = tx;
        r.py = ty;
        _pickup(r, tx, ty);
        if (tx != r.f.sx || ty != r.f.sy) return false;
        if (r.floor == FLOORS) {
            if (_bossAlive(r)) return false;
            r.won = true;
            return true;
        }
        int256 heal = r.maxHp / 4;
        r.hp = r.hp + heal > r.maxHp ? r.maxHp : r.hp + heal;
        _enterFloor(r, r.floor + 1);
        return true;
    }

    function _fire(Run memory r, uint256 d) private pure {
        if (r.pebbles == 0) return;
        --r.pebbles;
        (int256 dmg, int256 range) = _sling(r.sling);
        for (int256 k = 1; k <= range; ++k) {
            int256 x = r.px + _dx(d) * k;
            int256 y = r.py + _dy(d) * k;
            if (!_isOpen(r.f.open, x, y)) return;
            (bool found, uint256 ei) = _enemyAt(r.f, x, y);
            if (found) {
                _hit(r, ei, dmg);
                return;
            }
        }
    }

    function _hit(Run memory r, uint256 i, int256 dmg) private pure {
        Enemy memory e = r.f.enemies[i];
        e.hp -= dmg;
        if (e.hp > 0) return;
        e.alive = false;
        ++r.kills;
        (,,, uint256 value, uint256 drop) = _enemy(e.kind);
        r.killScore += value;
        uint32 roll = _roll(r);
        if (roll % 100 < drop && r.f.nItems < MAX_ITEMS && !_itemAt(r.f, e.x, e.y)) {
            uint8 kind = _roll(r) % 2 == 0 ? CHEST : CHEESE;
            r.f.items[r.f.nItems++] = Item(kind, e.x, e.y, false);
        }
    }

    function _itemAt(Floor memory f, int256 x, int256 y) private pure returns (bool) {
        for (uint256 i; i < f.nItems; ++i) {
            if (!f.items[i].taken && f.items[i].x == x && f.items[i].y == y) return true;
        }
        return false;
    }

    function _pickup(Run memory r, int256 x, int256 y) private pure {
        for (uint256 i; i < r.f.nItems; ++i) {
            Item memory it = r.f.items[i];
            if (it.taken || it.x != x || it.y != y) continue;
            it.taken = true;
            if (it.kind == SEED) {
                r.gold += _seedValue(r.floor, r.mood) + r.luck;
            } else if (it.kind == CHEESE) {
                r.hp = r.hp + 5 > r.maxHp ? r.maxHp : r.hp + 5;
            } else {
                _openChest(r);
            }
            return;
        }
    }

    function _openChest(Run memory r) private pure {
        uint32 cat = _roll(r) % 10;
        if (cat <= 1) {
            r.weapon = _gear(r, r.weapon, 4, 2);
        } else if (cat <= 3) {
            r.armor = _gear(r, r.armor, 3, 3);
        } else if (cat == 4) {
            r.sling = _gear(r, r.sling, 2, 3);
        } else if (cat == 5) {
            r.pebbles += 4;
        } else if (cat == 6) {
            r.maxHp += 3;
            r.hp += 3;
        } else if (cat == 7) {
            r.crit = r.crit + 10 > 50 ? 50 : r.crit + 10;
        } else if (cat == 8) {
            ++r.luck;
        } else {
            r.hp = r.maxHp;
        }
    }

    /// @dev Rolls a gear tier; equips it if better, otherwise salvages it for seeds.
    function _gear(Run memory r, uint256 current, uint256 maxTier, uint256 spread) private pure returns (uint256) {
        uint256 t = 1 + (_roll(r) % (1 + r.floor / spread));
        if (t > maxTier) t = maxTier;
        if (t > current) return t;
        r.gold += 4 * t;
        return current;
    }

    function _enemiesAct(Run memory r) private pure {
        uint256 def = r.armor;
        for (uint256 i; i < r.f.nEnemies; ++i) {
            Enemy memory e = r.f.enemies[i];
            if (!e.alive) continue;
            if (e.kind == MOLE && r.turn % 2 == 1) continue;
            int256 d = _dist(e.x, e.y, r.px, r.py);
            if (d == 1) {
                int256 dmg = e.atk - int256(def);
                if (dmg < 1) dmg = 1;
                r.hp -= dmg;
                if (r.hp <= 0) {
                    r.hp = 0;
                    r.dead = true;
                    return;
                }
            } else {
                (,, int256 sight,,) = _enemy(e.kind);
                if (d <= sight) {
                    _stepToward(r, e);
                    if (e.kind == RAT && _dist(e.x, e.y, r.px, r.py) > 1) _stepToward(r, e);
                }
            }
        }
    }

    function _stepToward(Run memory r, Enemy memory e) private pure {
        int256 dx = r.px - e.x;
        int256 dy = r.py - e.y;
        int256 sx = _sign(dx);
        int256 sy = _sign(dy);
        bool hFirst = _abs(dx) >= _abs(dy);
        if (!_tryMove(r, e, hFirst ? sx : int256(0), hFirst ? int256(0) : sy)) {
            _tryMove(r, e, hFirst ? int256(0) : sx, hFirst ? sy : int256(0));
        }
    }

    function _tryMove(Run memory r, Enemy memory e, int256 mx, int256 my) private pure returns (bool) {
        if (mx == 0 && my == 0) return false;
        int256 nx = e.x + mx;
        int256 ny = e.y + my;
        if (!_isOpen(r.f.open, nx, ny) || (nx == r.px && ny == r.py)) return false;
        (bool blocked,) = _enemyAt(r.f, nx, ny);
        if (blocked) return false;
        e.x = nx;
        e.y = ny;
        return true;
    }
}
