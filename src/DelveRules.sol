// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DelveTables as T} from "./DelveTables.sol";

/// @title DelveRules
/// @notice Onchain twin of web/engine.js: a deterministic, integer-only roguelike with 200 floors.
///         A run is verified floor by floor: `advance` takes the checkpoint saved at a floor
///         boundary, rebuilds that floor from the run seed, replays the action tape (combat, loot
///         rolls, crits, monster AI) and returns the next checkpoint. A tape must end at a floor
///         boundary (just descended) or at the end of the run. Any rule change must be made in both
///         files; tools/parity.mjs + test/DelveParity.t.sol check they agree.
contract DelveRules {
    uint256 public constant FLOORS = 200;
    uint256 public constant MAX_TAPE = 6000;
    uint256 internal constant MAX_ENEMIES = 40;
    uint256 internal constant MAX_ITEMS = 48;
    uint256 internal constant CAVEIN_TURNS = 300;
    uint256 internal constant PLACE_TRIES = 100;
    uint256 internal constant CARVE_CAP = 12000;
    uint256 internal constant REGULAR_KINDS = 17;
    uint256 internal constant EMPEROR = 22;
    int256 internal constant RANGE = 4;

    uint8 internal constant SNOOZE = 0;
    uint8 internal constant JOG = 2;
    uint8 internal constant ZOOMIES = 3;
    uint8 internal constant WAIT = 4;
    uint8 internal constant FLEE = 5;
    uint8 internal constant FIRE_UP = 6;
    uint8 internal constant FIRE_LEFT = 9;

    uint256 internal constant SEED = 0;
    uint256 internal constant CHEESE = 1;
    uint256 internal constant CHEST = 2;
    uint256 internal constant BOSS_CHEST = 3;

    uint256 internal constant FAST = 1;
    uint256 internal constant SLOW = 2;
    uint256 internal constant RANGED = 3;
    uint256 internal constant BOMB = 4;
    uint256 internal constant REGEN = 5;

    uint256 internal constant PIERCE = 1;
    uint256 internal constant CLEAVE = 2;
    uint256 internal constant LEECH = 3;
    uint256 internal constant CRIT = 4;

    uint256 internal constant CAVE = 0;
    uint256 internal constant ROOMS = 1;
    uint256 internal constant MIXED = 2;

    /// @notice Everything about a run that survives a floor boundary (same fields as engine.js).
    struct Progress {
        uint256 floor;
        int256 hp;
        int256 maxHp;
        int256 atk;
        int256 def;
        uint256 weapon;
        uint256 armor;
        uint256 sling;
        uint256 pebbles;
        uint256 crit;
        uint256 luck;
        uint256 goldPct;
        int256 leech;
        int256 regen;
        uint256 dodge;
        uint256 vision;
        uint256 xp;
        uint256 lvl;
        uint256 gold;
        uint256 kills;
        uint256 killScore;
        uint256 bossKills;
        uint256 turn;
        uint32 rng;
        bool dead;
        bool fled;
        bool won;
    }

    struct Enemy {
        uint256 kind;
        uint256 beh;
        int256 x;
        int256 y;
        int256 hp;
        int256 maxHp;
        int256 atk;
        int256 sight;
        bool alive;
    }

    struct Item {
        uint256 kind;
        int256 x;
        int256 y;
        bool taken;
    }

    struct Floor {
        int256 w;
        int256 h;
        uint256 style;
        bool boss;
        uint256[] open; // bit y*w+x set = walkable
        bytes enemyOcc; // enemy index + 1 per cell
        bytes itemOcc; // item index + 1 per cell
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
        Progress p;
        uint32 seed;
        uint8 mood;
        int256 px;
        int256 py;
        uint256 floorTurn;
        bool boundary;
        Floor f;
    }

    error TapeTooLong(uint256 length);
    error RunAlreadyOver();
    error NotAtFloorBoundary(uint256 floor, uint256 actionsReplayed);

    // ------------------------------------------------------------------ public

    /// @notice The checkpoint a fresh run starts from.
    function init(uint8 level, uint32 seed) public pure returns (Progress memory p) {
        uint256 l = level < 1 ? 1 : level > 10 ? 10 : level;
        p.floor = 1;
        p.maxHp = int256(10 + 2 * l);
        p.hp = p.maxHp;
        p.atk = int256(1 + l / 3);
        p.pebbles = 5;
        p.crit = 5;
        p.lvl = 1;
        p.rng = seed ^ 0x85EBCA6B;
        if (p.rng == 0) p.rng = 1;
    }

    /// @notice Replays `tape` from checkpoint `start` and returns the next checkpoint.
    function advance(uint32 seed, uint8 mood, Progress calldata start, bytes calldata tape)
        external
        pure
        returns (Progress memory)
    {
        if (tape.length > MAX_TAPE) revert TapeTooLong(tape.length);
        if (start.dead || start.fled || start.won) revert RunAlreadyOver();
        Run memory r;
        r.p = start;
        r.seed = seed;
        r.mood = mood;
        r.boundary = true;
        _enterFloor(r);
        uint256 i;
        for (; i < tape.length; ++i) {
            if (_over(r.p)) break;
            _step(r, uint8(tape[i]));
        }
        if (!r.boundary) revert NotAtFloorBoundary(r.p.floor, i);
        return r.p;
    }

    function score(Progress memory p) public pure returns (uint256) {
        return p.gold + p.killScore + 50 * (p.floor - 1) + (p.won ? 5000 + 10 * uint256(p.hp) : 0);
    }

    function moodForWork(uint256 work) public pure returns (uint8) {
        if (work >= 300) return 3;
        if (work >= 100) return 2;
        if (work >= 1) return 1;
        return 0;
    }

    /// @notice A floor's layout, for tests and tools. `open` words hold bit y*w+x per walkable cell.
    function floorLayout(uint32 seed, uint16 floor, uint8 mood)
        external
        pure
        returns (
            uint256[] memory open,
            uint256 style,
            int256[6] memory geo, // w, h, startX, startY, stairsX, stairsY
            int256[] memory enemies,
            int256[] memory items
        )
    {
        Floor memory f = _genFloor(seed, floor, mood);
        enemies = new int256[](f.nEnemies * 5);
        for (uint256 i; i < f.nEnemies; ++i) {
            Enemy memory e = f.enemies[i];
            (enemies[i * 5], enemies[i * 5 + 1], enemies[i * 5 + 2]) = (int256(e.kind), e.x, e.y);
            (enemies[i * 5 + 3], enemies[i * 5 + 4]) = (e.hp, e.atk);
        }
        items = new int256[](f.nItems * 3);
        for (uint256 i; i < f.nItems; ++i) {
            (items[i * 3], items[i * 3 + 1], items[i * 3 + 2]) = (int256(f.items[i].kind), f.items[i].x, f.items[i].y);
        }
        return (f.open, f.style, [f.w, f.h, f.startX, f.startY, f.sx, f.sy], enemies, items);
    }

    // ----------------------------------------------------------------- helpers

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

    function _min(int256 a, int256 b) private pure returns (int256) {
        return a < b ? a : b;
    }

    function _over(Progress memory p) private pure returns (bool) {
        return p.dead || p.won || p.fled;
    }

    function _dims(uint256 floor) private pure returns (int256 w, int256 h) {
        uint256 gw = (floor - 1) / 5;
        uint256 gh = (floor - 1) / 7;
        w = int256(17 + 2 * (gw < 15 ? gw : 15));
        h = int256(13 + 2 * (gh < 11 ? gh : 11));
    }

    function _inside(Floor memory f, int256 x, int256 y) private pure returns (bool) {
        return x >= 0 && y >= 0 && x < f.w && y < f.h;
    }

    function _isOpen(Floor memory f, int256 x, int256 y) private pure returns (bool) {
        if (!_inside(f, x, y)) return false;
        uint256 idx = uint256(y * f.w + x);
        return (f.open[idx >> 8] >> (idx & 255)) & 1 == 1;
    }

    function _enemyAt(Floor memory f, int256 x, int256 y) private pure returns (bool, uint256) {
        if (!_inside(f, x, y)) return (false, 0);
        uint8 v = uint8(f.enemyOcc[uint256(y * f.w + x)]);
        return v == 0 ? (false, 0) : (true, uint256(v) - 1);
    }

    function _setEnemyOcc(Floor memory f, int256 x, int256 y, uint256 v) private pure {
        f.enemyOcc[uint256(y * f.w + x)] = bytes1(uint8(v));
    }

    // -------------------------------------------------------------- generation

    function _next(Floor memory f) private pure returns (uint32) {
        f.rng = _xs(f.rng);
        return f.rng;
    }

    function _carve(Floor memory f, int256 x, int256 y) private pure {
        uint256 idx = uint256(y * f.w + x);
        uint256 bit = uint256(1) << (idx & 255);
        if (f.open[idx >> 8] & bit == 0) {
            f.open[idx >> 8] |= bit;
            ++f.count;
        }
    }

    function _walk(Floor memory f, int256 x, int256 y, uint256 target) private pure {
        for (uint256 i; i < CARVE_CAP && f.count < target; ++i) {
            uint256 d = _next(f) % 4;
            int256 nx = x + _dx(d);
            int256 ny = y + _dy(d);
            if (nx < 1 || nx > f.w - 2 || ny < 1 || ny > f.h - 2) continue;
            x = nx;
            y = ny;
            _carve(f, x, y);
        }
    }

    function _rooms(Floor memory f) private pure {
        uint256 area = uint256(f.w * f.h);
        uint256 nRooms = (f.style == ROOMS ? 4 + (_next(f) % 3) : 3 + (_next(f) % 2)) + area / 250;
        uint256 rwSpan = 3 + uint256(f.w - 17) / 8;
        uint256 rhSpan = 2 + uint256(f.h - 13) / 8;
        int256 px;
        int256 py;
        for (uint256 k; k < nRooms; ++k) {
            int256 rw = int256(3 + (_next(f) % rwSpan));
            int256 rh = int256(3 + (_next(f) % rhSpan));
            int256 rx = 1 + int256(_next(f) % uint256(f.w - 1 - rw));
            int256 ry = 1 + int256(_next(f) % uint256(f.h - 1 - rh));
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
        if (f.style == MIXED) _walk(f, px, py, f.count + 25 + area / 40);
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
        (f.w, f.h) = _dims(floor);
        uint256 cells = uint256(f.w * f.h);
        f.open = new uint256[]((cells + 255) / 256);
        f.enemyOcc = new bytes(cells);
        f.itemOcc = new bytes(cells);

        f.boss = floor % 10 == 0;
        f.style = f.boss ? ROOMS : _next(f) % 3;
        if (f.style == CAVE) {
            f.startX = 2 + int256(_next(f) % uint256(f.w - 4));
            f.startY = 2 + int256(_next(f) % uint256(f.h - 4));
            _carve(f, f.startX, f.startY);
            _walk(f, f.startX, f.startY, (uint256(f.w - 2) * uint256(f.h - 2) * 40) / 100);
        } else {
            _rooms(f);
        }

        f.sx = f.startX;
        f.sy = f.startY;
        int256 best;
        for (int256 cy = 1; cy <= f.h - 2; ++cy) {
            for (int256 cx = 1; cx <= f.w - 2; ++cx) {
                int256 dd = _dist(cx, cy, f.startX, f.startY);
                if (dd > best && _isOpen(f, cx, cy)) {
                    best = dd;
                    f.sx = cx;
                    f.sy = cy;
                }
            }
        }

        f.enemies = new Enemy[](MAX_ENEMIES);
        f.items = new Item[](MAX_ITEMS);
        _spawnEnemies(f, floor, mood, cells);
        _addItems(f, SEED, 3 + cells / 90 + (_next(f) % 3), 1);
        _addItems(f, CHEESE, 1 + (floor / 20 < 3 ? floor / 20 : 3) + (floor >= 3 ? _next(f) % 2 : 0), 1);
        _addItems(f, CHEST, 1 + cells / 250 + (_next(f) % 2) + (mood == JOG ? 1 : 0), 2);
    }

    function _spawnEnemies(Floor memory f, uint256 floor, uint8 mood, uint256 cells) private pure {
        uint256 eligible;
        while (eligible < REGULAR_KINDS) {
            (,,,,, uint256 minFloor,) = T.monster(eligible);
            if (minFloor > floor) break;
            ++eligible;
        }
        uint256 window = eligible < 6 ? eligible : 6;
        uint256 n = 2 + floor / 4 + cells / 110 + (mood == ZOOMIES ? 1 : 0);
        if (n > MAX_ENEMIES) n = MAX_ENEMIES;
        for (uint256 k; k < n; ++k) {
            uint32 r = _next(f);
            uint256 kind;
            bool ok;
            int256 x;
            int256 y;
            if (f.boss && k == 0) {
                kind = floor == FLOORS ? EMPEROR : 17 + ((floor / 10 - 1) % 5);
                (ok, x, y) = _place(f, 6);
                if (!ok) (ok, x, y) = _place(f, 3);
            } else {
                kind = eligible - 1 - (r % window);
                (ok, x, y) = _place(f, 3);
            }
            if (!ok) continue;
            (uint256 beh, int256 hp, int256 atk, int256 sight,,,) = T.monster(kind);
            hp = (hp * int256(100 + 12 * (floor - 1))) / 100;
            if (hp < 1) hp = 1;
            atk += int256((floor - 1) / 4);
            f.enemies[f.nEnemies++] = Enemy(kind, beh, x, y, hp, hp, atk, sight, true);
            _setEnemyOcc(f, x, y, f.nEnemies);
        }
    }

    function _addItems(Floor memory f, uint256 kind, uint256 n, int256 minDist) private pure {
        for (uint256 k; k < n; ++k) {
            (bool ok, int256 x, int256 y) = _place(f, minDist);
            if (!ok) continue;
            f.items[f.nItems++] = Item(kind, x, y, false);
            f.itemOcc[uint256(y * f.w + x)] = bytes1(uint8(f.nItems));
        }
    }

    function _place(Floor memory f, int256 minDist) private pure returns (bool, int256, int256) {
        for (uint256 t; t < PLACE_TRIES; ++t) {
            int256 cx = 1 + int256(_next(f) % uint256(f.w - 2));
            int256 cy = 1 + int256(_next(f) % uint256(f.h - 2));
            if (_isOpen(f, cx, cy) && _free(f, cx, cy) && _dist(cx, cy, f.startX, f.startY) >= minDist) {
                return (true, cx, cy);
            }
        }
        return (false, 0, 0);
    }

    function _free(Floor memory f, int256 cx, int256 cy) private pure returns (bool) {
        if ((cx == f.startX && cy == f.startY) || (cx == f.sx && cy == f.sy)) return false;
        uint256 idx = uint256(cy * f.w + cx);
        return f.enemyOcc[idx] == 0 && f.itemOcc[idx] == 0;
    }

    // -------------------------------------------------------------------- play

    function _enterFloor(Run memory r) private pure {
        r.f = _genFloor(r.seed, r.p.floor, r.mood);
        r.px = r.f.startX;
        r.py = r.f.startY;
        r.floorTurn = 0;
    }

    function _roll(Run memory r) private pure returns (uint32) {
        r.p.rng = _xs(r.p.rng);
        return r.p.rng;
    }

    function _bossAlive(Run memory r) private pure returns (bool) {
        return r.f.boss && r.f.nEnemies > 0 && r.f.enemies[0].kind >= REGULAR_KINDS && r.f.enemies[0].alive;
    }

    function _step(Run memory r, uint8 action) private pure {
        Progress memory p = r.p;
        r.boundary = false;
        ++p.turn;
        ++r.floorTurn;
        if (action == FLEE) {
            p.fled = true;
            r.boundary = true;
            return;
        }
        if (action <= 3) {
            if (_moveOrAttack(r, action)) return;
        } else if (action >= FIRE_UP && action <= FIRE_LEFT) {
            _fire(r, action - FIRE_UP);
        }

        if (r.floorTurn > CAVEIN_TURNS) {
            p.hp -= int256(1 + (r.floorTurn - CAVEIN_TURNS - 1) / 10);
            if (p.hp <= 0) {
                p.hp = 0;
                p.dead = true;
                r.boundary = true;
                return;
            }
        }
        if (r.mood == SNOOZE && p.turn % 2 == 1) return;
        _enemiesAct(r);
        if (p.dead) r.boundary = true;
    }

    /// @return ended true when the turn ends without monsters acting (descended or won).
    function _moveOrAttack(Run memory r, uint256 d) private pure returns (bool ended) {
        Progress memory p = r.p;
        int256 tgtX = r.px + _dx(d);
        int256 tgtY = r.py + _dy(d);
        if (!_isOpen(r.f, tgtX, tgtY)) return false;
        (bool found, uint256 ei) = _enemyAt(r.f, tgtX, tgtY);
        if (found) {
            _melee(r, d, tgtX, tgtY, ei);
            return false;
        }
        r.px = tgtX;
        r.py = tgtY;
        _pickup(r, tgtX, tgtY);
        if (tgtX != r.f.sx || tgtY != r.f.sy) return false;
        if (_bossAlive(r)) return false;
        if (p.floor == FLOORS) {
            p.won = true;
            r.boundary = true;
            return true;
        }
        p.hp = _min(p.maxHp, p.hp + p.maxHp / 4 + p.regen);
        ++p.floor;
        _enterFloor(r);
        r.boundary = true;
        return true;
    }

    function _melee(Run memory r, uint256 d, int256 tgtX, int256 tgtY, uint256 ei) private pure {
        Progress memory p = r.p;
        (int256 wAtk, uint256 special) = T.weapon(p.weapon);
        int256 dmg = p.atk + wAtk;
        if (_roll(r) % 100 < p.crit + (special == CRIT ? 10 : 0)) dmg *= 2;
        _hit(r, ei, dmg);
        if (special == PIERCE) {
            (bool found, uint256 bj) = _enemyAt(r.f, tgtX + _dx(d), tgtY + _dy(d));
            if (found) _hit(r, bj, dmg);
        } else if (special == CLEAVE) {
            uint256 side = (d + 1) % 4;
            (bool fa, uint256 aj) = _enemyAt(r.f, tgtX + _dx(side), tgtY + _dy(side));
            if (fa) _hit(r, aj, dmg);
            (bool fb, uint256 bj) = _enemyAt(r.f, tgtX - _dx(side), tgtY - _dy(side));
            if (fb) _hit(r, bj, dmg);
        }
        int256 heal = p.leech + (special == LEECH ? int256(2) : int256(0));
        if (heal > 0 && p.hp < p.maxHp) p.hp = _min(p.maxHp, p.hp + heal);
    }

    function _fire(Run memory r, uint256 d) private pure {
        Progress memory p = r.p;
        if (p.pebbles == 0) return;
        --p.pebbles;
        (int256 dmg, int256 range) = T.sling(p.sling);
        for (int256 k = 1; k <= range; ++k) {
            int256 x = r.px + _dx(d) * k;
            int256 y = r.py + _dy(d) * k;
            if (!_isOpen(r.f, x, y)) return;
            (bool found, uint256 ei) = _enemyAt(r.f, x, y);
            if (found) {
                _hit(r, ei, dmg + p.atk / 3);
                return;
            }
        }
    }

    function _hit(Run memory r, uint256 i, int256 dmg) private pure {
        Enemy memory e = r.f.enemies[i];
        e.hp -= dmg;
        if (e.hp > 0) return;
        Progress memory p = r.p;
        e.alive = false;
        _setEnemyOcc(r.f, e.x, e.y, 0);
        ++p.kills;
        (,,,, uint256 value,, uint256 drop) = T.monster(e.kind);
        value = (value * (10 + p.floor)) / 10;
        p.killScore += value;
        if (e.kind >= REGULAR_KINDS) ++p.bossKills;
        _gainXp(p, value);
        if (e.kind >= REGULAR_KINDS) {
            _drop(r, BOSS_CHEST, e.x, e.y);
            return;
        }
        if (_roll(r) % 100 < drop) _drop(r, _roll(r) % 2 == 0 ? CHEST : CHEESE, e.x, e.y);
    }

    function _gainXp(Progress memory p, uint256 v) private pure {
        p.xp += v;
        while (p.xp >= 5 + 5 * p.lvl * p.lvl) {
            p.xp -= 5 + 5 * p.lvl * p.lvl;
            ++p.lvl;
            p.maxHp += 3;
            p.hp += 3;
            if (p.lvl % 2 == 0) ++p.atk;
        }
    }

    function _drop(Run memory r, uint256 kind, int256 x, int256 y) private pure {
        Floor memory f = r.f;
        uint256 idx = uint256(y * f.w + x);
        if (f.nItems >= MAX_ITEMS || f.itemOcc[idx] != 0) return;
        f.items[f.nItems++] = Item(kind, x, y, false);
        f.itemOcc[idx] = bytes1(uint8(f.nItems));
    }

    function _pickup(Run memory r, int256 x, int256 y) private pure {
        Floor memory f = r.f;
        uint256 idx = uint256(y * f.w + x);
        uint8 v = uint8(f.itemOcc[idx]);
        if (v == 0) return;
        Item memory it = f.items[v - 1];
        it.taken = true;
        f.itemOcc[idx] = 0;
        Progress memory p = r.p;
        if (it.kind == SEED) {
            uint256 g = 3 + p.floor;
            if (r.mood == JOG) g += 2;
            if (r.mood == ZOOMIES) g *= 2;
            p.gold += (g * (100 + p.goldPct)) / 100 + p.luck;
        } else if (it.kind == CHEESE) {
            p.hp = _min(p.maxHp, p.hp + 5 + p.maxHp / 5);
        } else {
            uint256 bonus = it.kind == BOSS_CHEST ? 2 : 0;
            _openChest(r, bonus);
            if (it.kind == BOSS_CHEST) _openChest(r, bonus);
        }
    }

    function _gear(Run memory r, uint256 current, uint256 cap, uint256 div, uint256 bonus)
        private
        pure
        returns (uint256)
    {
        uint256 maxT = 1 + r.p.floor / div + bonus;
        if (maxT > cap) maxT = cap;
        uint256 minT = maxT > 4 ? maxT - 3 : 1;
        uint256 t = minT + (_roll(r) % (maxT - minT + 1));
        if (t > current) return t;
        r.p.gold += 4 * t;
        return current;
    }

    function _openChest(Run memory r, uint256 bonus) private pure {
        Progress memory p = r.p;
        uint32 c = _roll(r) % 100;
        if (c < 20) {
            p.weapon = _gear(r, p.weapon, 15, 8, bonus);
        } else if (c < 38) {
            p.armor = _gear(r, p.armor, 11, 10, bonus);
        } else if (c < 48) {
            p.sling = _gear(r, p.sling, 7, 14, bonus);
        } else {
            uint32 b = _roll(r) % 12;
            uint256 fl = p.floor;
            if (b == 0) {
                p.pebbles += 4 + fl / 10;
            } else if (b == 1) {
                int256 v = int256(3 + fl / 10);
                p.maxHp += v;
                p.hp += v;
            } else if (b == 2) {
                p.crit = p.crit + 5 > 60 ? 60 : p.crit + 5;
            } else if (b == 3) {
                p.luck += 1 + fl / 25;
            } else if (b == 4) {
                p.hp = p.maxHp;
            } else if (b == 5) {
                p.atk += int256(1 + fl / 40);
            } else if (b == 6) {
                ++p.def;
            } else if (b == 7) {
                ++p.vision;
                p.pebbles += 2;
            } else if (b == 8) {
                p.regen += 2;
            } else if (b == 9) {
                ++p.leech;
            } else if (b == 10) {
                p.goldPct += 20;
            } else {
                p.dodge = p.dodge + 5 > 40 ? 40 : p.dodge + 5;
            }
        }
    }

    function _hurt(Run memory r, int256 raw) private pure {
        Progress memory p = r.p;
        if (p.dodge > 0 && _roll(r) % 100 < p.dodge) return;
        int256 dmg = raw - (p.def + T.armorDef(p.armor));
        if (dmg < 1) dmg = 1;
        p.hp -= dmg;
        if (p.hp <= 0) {
            p.hp = 0;
            p.dead = true;
        }
    }

    function _enemiesAct(Run memory r) private pure {
        Progress memory p = r.p;
        Floor memory f = r.f;
        bool odd = p.turn % 2 == 1;
        for (uint256 i; i < f.nEnemies; ++i) {
            Enemy memory e = f.enemies[i];
            if (!e.alive) continue;
            if (e.beh == SLOW && odd) continue;
            if (e.beh == REGEN && e.hp < e.maxHp) e.hp = _min(e.maxHp, e.hp + 1 + e.maxHp / 20);
            uint256 res = _enemyAct(r, i);
            if (p.dead) return;
            if (!e.alive) continue;
            if (e.beh == FAST && res != 2) {
                int256 d = _dist(e.x, e.y, r.px, r.py);
                if (d > 1 && d <= e.sight) _stepToward(r, i);
            }
            if (e.kind >= REGULAR_KINDS && e.hp * 3 < e.maxHp) {
                _enemyAct(r, i);
                if (p.dead) return;
            }
        }
    }

    /// @return 2 for an attack, 1 for a move, 0 otherwise.
    function _enemyAct(Run memory r, uint256 i) private pure returns (uint256) {
        Enemy memory e = r.f.enemies[i];
        int256 d = _dist(e.x, e.y, r.px, r.py);
        if (d == 1) {
            if (e.beh == BOMB) {
                e.alive = false;
                _setEnemyOcc(r.f, e.x, e.y, 0);
                _hurt(r, e.atk * 2);
            } else {
                _hurt(r, e.atk);
            }
            return 2;
        }
        if (e.beh == RANGED && _clearShot(r, e, d)) {
            _hurt(r, e.atk);
            return 2;
        }
        if (d <= e.sight) return _stepToward(r, i) ? 1 : 0;
        return 0;
    }

    function _clearShot(Run memory r, Enemy memory e, int256 d) private pure returns (bool) {
        if (e.x != r.px && e.y != r.py) return false;
        if (d > RANGE) return false;
        int256 sx = _sign(r.px - e.x);
        int256 sy = _sign(r.py - e.y);
        for (int256 k = 1; k < d; ++k) {
            int256 x = e.x + sx * k;
            int256 y = e.y + sy * k;
            if (!_isOpen(r.f, x, y)) return false;
            (bool found,) = _enemyAt(r.f, x, y);
            if (found) return false;
        }
        return true;
    }

    function _stepToward(Run memory r, uint256 i) private pure returns (bool) {
        Enemy memory e = r.f.enemies[i];
        int256 dx = r.px - e.x;
        int256 dy = r.py - e.y;
        int256 sx = _sign(dx);
        int256 sy = _sign(dy);
        bool hFirst = _abs(dx) >= _abs(dy);
        if (_tryMove(r, e, i, hFirst ? sx : int256(0), hFirst ? int256(0) : sy)) return true;
        return _tryMove(r, e, i, hFirst ? int256(0) : sx, hFirst ? sy : int256(0));
    }

    function _tryMove(Run memory r, Enemy memory e, uint256 i, int256 mx, int256 my) private pure returns (bool) {
        if (mx == 0 && my == 0) return false;
        int256 nx = e.x + mx;
        int256 ny = e.y + my;
        if (!_isOpen(r.f, nx, ny) || (nx == r.px && ny == r.py)) return false;
        (bool blocked,) = _enemyAt(r.f, nx, ny);
        if (blocked) return false;
        _setEnemyOcc(r.f, e.x, e.y, 0);
        e.x = nx;
        e.y = ny;
        _setEnemyOcc(r.f, nx, ny, i + 1);
        return true;
    }
}
