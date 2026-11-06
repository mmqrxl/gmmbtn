// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISqueekCore, ISqueekNFT, ISqueekStaking} from "./interfaces/ISqueekchain.sol";
import {DelveRules} from "./DelveRules.sol";

/// @title Squeek Delve
/// @notice A holder-only pixel roguelike for Squeek NFT holders on Sepolia: 200 floors that grow
///         bigger, deadlier and richer the deeper you go. `startRun` draws the run's burrow seed
///         onchain and reads the real hamster's mood from SqueekCore's last six certified rounds.
///         Holders play in the browser and checkpoint their progress with `advance`, which replays
///         every move of the new floors through DelveRules, so every score is verified, never trusted.
contract SqueekDelve {
    uint64 public constant SEASON_SECONDS = 1 days;
    uint64 public constant RUN_TTL = 2 days;
    uint64 public constant MOOD_WINDOW_ROUNDS = 6;
    uint8 public constant RUNS_PER_SEASON = 3;
    uint256 public constant MAX_SQUEEK_ID = 9_999;
    uint256 public constant BOARD_SIZE = 10;
    uint256 internal constant ALL_TIME = type(uint256).max;

    ISqueekCore public immutable core;
    ISqueekNFT public immutable nft;
    ISqueekStaking public immutable staking;
    DelveRules public immutable rules;
    uint64 public immutable genesis;

    /// @dev Checkpoint as stored: the same fields as DelveRules.Progress, packed.
    struct Packed {
        uint16 floor;
        int32 hp;
        int32 maxHp;
        int32 atk;
        int32 def;
        uint8 weapon;
        uint8 armor;
        uint8 sling;
        uint32 pebbles;
        uint16 crit;
        uint32 luck;
        uint32 goldPct;
        int32 leech;
        int32 regen;
        uint16 dodge;
        uint16 vision;
        uint32 xp;
        uint16 lvl;
        uint64 gold;
        uint32 kills;
        uint64 killScore;
        uint16 bossKills;
        uint32 turn;
        uint32 rng;
        bool dead;
        bool fled;
        bool won;
    }

    struct Run {
        uint256 tokenId;
        address player;
        uint32 season;
        uint32 seed;
        uint8 level;
        uint8 mood;
        uint32 work; // hamster work in the mood window
        uint64 startedAt;
        uint64 startBlock;
        uint64 updatedAt;
        uint32 score;
        Packed progress;
    }

    struct Best {
        uint256 runId;
        uint32 score;
        uint16 floor;
        uint8 level;
        uint8 weapon;
        uint8 armor;
        uint8 sling;
        bool won;
        uint64 when;
    }

    struct Record {
        uint32 runs;
        uint32 victories;
        uint32 crowns;
        uint32 bestScore;
        uint16 deepest;
        uint32 bossKills;
    }

    Run[] internal _runs;
    mapping(uint256 => mapping(uint256 => uint8)) public runsStarted; // season => tokenId => count
    mapping(uint256 => mapping(uint256 => Best)) internal _best; // season (or ALL_TIME) => tokenId
    mapping(uint256 => uint256[]) internal _boards;
    mapping(uint256 => bool) public crowned;
    mapping(uint256 => Record) internal _records;

    event RunStarted(
        uint256 indexed runId,
        uint256 indexed season,
        uint256 indexed tokenId,
        address player,
        uint32 seed,
        uint8 level,
        uint8 mood,
        uint32 work
    );
    event Advanced(
        uint256 indexed runId,
        uint256 indexed tokenId,
        address indexed player,
        uint16 fromFloor,
        uint16 toFloor,
        uint32 score,
        bool dead,
        bool fled,
        bool won,
        bytes tape
    );
    event Crowned(uint256 indexed season, uint256 indexed tokenId, uint32 score);

    error NotSqueekHolder(uint256 tokenId);
    error OutOfRuns(uint256 tokenId);
    error UnknownRun(uint256 runId);
    error NotYourRun(uint256 runId);
    error RunOver(uint256 runId);
    error RunExpired(uint256 runId);
    error EmptyTape();
    error SeasonNotSettled(uint256 season);
    error AlreadyCrowned(uint256 season);

    constructor(ISqueekCore core_, ISqueekNFT nft_, ISqueekStaking staking_, DelveRules rules_) {
        core = core_;
        nft = nft_;
        staking = staking_;
        rules = rules_;
        genesis = uint64(block.timestamp);
    }

    // ------------------------------------------------------------------- play

    /// @notice Begin a run with one of your Squeeks: a fresh random burrow, with the mood the real
    ///         hamster is in right now. Each Squeek can start 3 runs per daily season.
    function startRun(uint256 tokenId) external returns (uint256 runId, uint32 seed) {
        if (!canPlay(msg.sender, tokenId)) revert NotSqueekHolder(tokenId);
        uint256 season = currentSeason();
        uint8 n = runsStarted[season][tokenId];
        if (n >= RUNS_PER_SEASON) revert OutOfRuns(tokenId);
        runsStarted[season][tokenId] = n + 1;

        (uint8 mood, uint64 work,) = hamsterMood();
        runId = _runs.length;
        // Testnet-grade randomness: unknown before the block that includes this call.
        seed = uint32(
            uint256(keccak256(abi.encode(block.prevrandao, blockhash(block.number - 1), runId, tokenId, msg.sender)))
        );
        uint8 lvl = levelOf(tokenId);
        Run storage r = _runs.push();
        r.tokenId = tokenId;
        r.player = msg.sender;
        r.season = uint32(season);
        r.seed = seed;
        r.level = lvl;
        r.mood = mood;
        r.work = uint32(work);
        r.startedAt = uint64(block.timestamp);
        r.startBlock = uint64(block.number);
        r.updatedAt = uint64(block.timestamp);
        _store(r, rules.init(lvl, seed));
        ++_records[tokenId].runs;
        emit RunStarted(runId, season, tokenId, msg.sender, seed, lvl, mood, uint32(work));
    }

    /// @notice Checkpoint a run: replays `tape` (one or more whole floors, or the end of the run)
    ///         onchain from the last checkpoint and records the new progress and score.
    function advance(uint256 runId, bytes calldata tape) external returns (DelveRules.Progress memory p) {
        if (runId >= _runs.length) revert UnknownRun(runId);
        Run storage r = _runs[runId];
        if (r.player != msg.sender) revert NotYourRun(runId);
        if (r.progress.dead || r.progress.fled || r.progress.won) revert RunOver(runId);
        if (block.timestamp >= r.startedAt + RUN_TTL) revert RunExpired(runId);
        if (tape.length == 0) revert EmptyTape();

        uint16 fromFloor = r.progress.floor;
        uint16 bossBefore = r.progress.bossKills;
        p = rules.advance(r.seed, r.mood, _load(r.progress), tape);
        _store(r, p);
        uint32 sc = uint32(rules.score(p));
        r.score = sc;
        r.updatedAt = uint64(block.timestamp);

        uint256 tokenId = r.tokenId;
        Record storage rec = _records[tokenId];
        if (p.won) ++rec.victories;
        if (p.floor > rec.deepest) rec.deepest = uint16(p.floor);
        if (sc > rec.bestScore) rec.bestScore = sc;
        rec.bossKills += uint32(p.bossKills - bossBefore);

        Best memory b = Best({
            runId: runId,
            score: sc,
            floor: uint16(p.floor),
            level: r.level,
            weapon: uint8(p.weapon),
            armor: uint8(p.armor),
            sling: uint8(p.sling),
            won: p.won,
            when: uint64(block.timestamp)
        });
        _submitBest(r.season, tokenId, b);
        _submitBest(ALL_TIME, tokenId, b);

        emit Advanced(runId, tokenId, msg.sender, fromFloor, uint16(p.floor), sc, p.dead, p.fled, p.won, tape);
    }

    /// @notice Record the champion of a season once all its runs have expired. Permissionless.
    function crown(uint256 season) external {
        if (block.timestamp < seasonEndsAt(season) + RUN_TTL) revert SeasonNotSettled(season);
        if (crowned[season]) revert AlreadyCrowned(season);
        crowned[season] = true;
        uint256[] storage board = _boards[season];
        if (board.length == 0) return;
        uint256 champ = board[0];
        ++_records[champ].crowns;
        emit Crowned(season, champ, _best[season][champ].score);
    }

    // ----------------------------------------------------------------- views

    function currentSeason() public view returns (uint256) {
        return (block.timestamp - genesis) / SEASON_SECONDS;
    }

    function seasonEndsAt(uint256 season) public view returns (uint256) {
        return genesis + (season + 1) * SEASON_SECONDS;
    }

    /// @notice The mood a run started now would get, from the last six certified SqueekCore rounds.
    function hamsterMood() public view returns (uint8 mood, uint64 work, uint64 settledThroughRound) {
        settledThroughRound = core.state().settledThroughRound;
        uint64 from = settledThroughRound > MOOD_WINDOW_ROUNDS ? settledThroughRound - MOOD_WINDOW_ROUNDS : 0;
        work = core.roundPage(settledThroughRound, settledThroughRound, 0).end.cumulativeWork
            - core.roundPage(from, from, 0).end.cumulativeWork;
        mood = rules.moodForWork(work);
    }

    function runCount() external view returns (uint256) {
        return _runs.length;
    }

    function run(uint256 runId) external view returns (Run memory) {
        if (runId >= _runs.length) revert UnknownRun(runId);
        return _runs[runId];
    }

    function progressOf(uint256 runId) external view returns (DelveRules.Progress memory) {
        if (runId >= _runs.length) revert UnknownRun(runId);
        return _load(_runs[runId].progress);
    }

    function leaderboard(uint256 season) external view returns (uint256[] memory ids, Best[] memory bests) {
        return _board(season);
    }

    function allTimeBoard() external view returns (uint256[] memory ids, Best[] memory bests) {
        return _board(ALL_TIME);
    }

    function bestOf(uint256 season, uint256 tokenId) external view returns (Best memory) {
        return _best[season][tokenId];
    }

    function record(uint256 tokenId) external view returns (Record memory) {
        return _records[tokenId];
    }

    function levelOf(uint256 tokenId) public view returns (uint8) {
        try nft.level(tokenId) returns (uint8 l) {
            return l == 0 ? 1 : l;
        } catch {
            return 1;
        }
    }

    /// @notice True if `player` holds `tokenId` in their wallet or has it deposited in SqueekStaking.
    function canPlay(address player, uint256 tokenId) public view returns (bool) {
        if (player == address(0) || tokenId == 0 || tokenId > MAX_SQUEEK_ID) return false;
        address owner;
        try nft.ownerOf(tokenId) returns (address o) {
            owner = o;
        } catch {
            return false;
        }
        if (owner == player) return true;
        if (owner != address(staking)) return false;
        try staking.depositor(address(nft), tokenId) returns (address d) {
            return d == player;
        } catch {
            return false;
        }
    }

    // -------------------------------------------------------------- internal

    function _board(uint256 key) internal view returns (uint256[] memory ids, Best[] memory bests) {
        ids = _boards[key];
        bests = new Best[](ids.length);
        for (uint256 i; i < ids.length; ++i) {
            bests[i] = _best[key][ids[i]];
        }
    }

    /// @dev Keeps each board sorted by best score, descending; ties keep the earlier entry ahead.
    function _submitBest(uint256 key, uint256 tokenId, Best memory b) internal {
        Best storage cur = _best[key][tokenId];
        if (cur.when != 0 && b.score <= cur.score) return;
        _best[key][tokenId] = b;
        uint256[] storage board = _boards[key];
        uint256 len = board.length;
        uint256 pos = len;
        for (uint256 i; i < len; ++i) {
            if (board[i] == tokenId) {
                pos = i;
                break;
            }
        }
        if (pos == len) {
            if (len < BOARD_SIZE) {
                board.push(tokenId);
            } else if (b.score > _best[key][board[len - 1]].score) {
                pos = len - 1;
                board[pos] = tokenId;
            } else {
                return;
            }
        }
        while (pos > 0 && _best[key][board[pos - 1]].score < b.score) {
            (board[pos - 1], board[pos]) = (board[pos], board[pos - 1]);
            --pos;
        }
    }

    function _store(Run storage r, DelveRules.Progress memory p) internal {
        Packed storage s = r.progress;
        s.floor = uint16(p.floor);
        s.hp = int32(p.hp);
        s.maxHp = int32(p.maxHp);
        s.atk = int32(p.atk);
        s.def = int32(p.def);
        s.weapon = uint8(p.weapon);
        s.armor = uint8(p.armor);
        s.sling = uint8(p.sling);
        s.pebbles = uint32(p.pebbles);
        s.crit = uint16(p.crit);
        s.luck = uint32(p.luck);
        s.goldPct = uint32(p.goldPct);
        s.leech = int32(p.leech);
        s.regen = int32(p.regen);
        s.dodge = uint16(p.dodge);
        s.vision = uint16(p.vision);
        s.xp = uint32(p.xp);
        s.lvl = uint16(p.lvl);
        s.gold = uint64(p.gold);
        s.kills = uint32(p.kills);
        s.killScore = uint64(p.killScore);
        s.bossKills = uint16(p.bossKills);
        s.turn = uint32(p.turn);
        s.rng = p.rng;
        s.dead = p.dead;
        s.fled = p.fled;
        s.won = p.won;
    }

    function _load(Packed storage s) internal view returns (DelveRules.Progress memory p) {
        p.floor = s.floor;
        p.hp = s.hp;
        p.maxHp = s.maxHp;
        p.atk = s.atk;
        p.def = s.def;
        p.weapon = s.weapon;
        p.armor = s.armor;
        p.sling = s.sling;
        p.pebbles = s.pebbles;
        p.crit = s.crit;
        p.luck = s.luck;
        p.goldPct = s.goldPct;
        p.leech = s.leech;
        p.regen = s.regen;
        p.dodge = s.dodge;
        p.vision = s.vision;
        p.xp = s.xp;
        p.lvl = s.lvl;
        p.gold = s.gold;
        p.kills = s.kills;
        p.killScore = s.killScore;
        p.bossKills = s.bossKills;
        p.turn = s.turn;
        p.rng = s.rng;
        p.dead = s.dead;
        p.fled = s.fled;
        p.won = s.won;
    }
}
