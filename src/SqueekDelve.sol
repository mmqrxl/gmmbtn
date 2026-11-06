// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISqueekCore, ISqueekNFT, ISqueekStaking} from "./interfaces/ISqueekchain.sol";
import {DelveRules} from "./DelveRules.sol";

/// @title Squeek Delve
/// @notice A holder-only pixel roguelike for Squeek NFT holders on Sepolia.
///         Expeditions run for two hours; the real work the hamster did in the six certified
///         SqueekCore rounds before one opens sets its burrow mood. Every ranked run gets its own
///         random burrow: `startRun` draws the seed onchain, the holder plays in the browser, and
///         `submitRun` replays the whole action tape through DelveRules, so the score is verified,
///         never trusted.
contract SqueekDelve {
    uint64 public constant EXPEDITION_SECONDS = 2 hours;
    uint64 public constant SUBMIT_GRACE = 30 minutes;
    uint64 public constant MOOD_WINDOW_ROUNDS = 6;
    uint8 public constant RUNS_PER_EXPEDITION = 3;
    uint256 public constant MAX_SQUEEK_ID = 9_999;
    uint256 public constant BOARD_SIZE = 10;

    ISqueekCore public immutable core;
    ISqueekNFT public immutable nft;
    ISqueekStaking public immutable staking;
    DelveRules public immutable rules;

    struct Expedition {
        bytes32 salt;
        uint8 mood;
        uint64 seedRound; // SqueekCore settledThroughRound when opened
        uint64 work; // hamster work in the mood window
        uint64 startsAt;
        uint64 endsAt; // no new runs after this; submissions until endsAt + SUBMIT_GRACE
        uint32 runs;
        bool crowned;
    }

    struct Run {
        uint256 tokenId;
        address player;
        uint64 expeditionId;
        uint32 seed;
        uint8 level;
        uint64 startedAt;
        bool submitted;
        uint32 score;
    }

    struct Best {
        uint256 runId;
        uint32 score;
        uint8 floor;
        uint16 kills;
        bool won;
        uint8 level;
        uint8 weapon;
        uint8 armor;
        uint8 sling;
        uint64 at;
    }

    struct Record {
        uint32 runs;
        uint32 victories;
        uint32 crowns;
        uint32 bestScore;
        uint64 totalScore; // sum of per-expedition bests
        uint8 deepest;
    }

    Expedition[] internal _expeditions;
    Run[] internal _runs;
    mapping(uint256 => mapping(uint256 => uint8)) public runsStarted;
    mapping(uint256 => mapping(uint256 => Best)) internal _best;
    mapping(uint256 => uint256[]) internal _boards;
    mapping(uint256 => Record) internal _records;

    event ExpeditionOpened(uint256 indexed expeditionId, uint8 mood, uint64 seedRound, uint64 work, uint64 endsAt);
    event RunStarted(
        uint256 indexed runId,
        uint256 indexed expeditionId,
        uint256 indexed tokenId,
        address player,
        uint32 seed,
        uint8 level
    );
    event RunSubmitted(
        uint256 indexed runId,
        uint256 indexed expeditionId,
        uint256 indexed tokenId,
        address player,
        uint32 score,
        uint8 floor,
        uint16 kills,
        bool won,
        bool dead,
        bytes tape
    );
    event Crowned(uint256 indexed expeditionId, uint256 indexed tokenId, uint32 score);

    error ExpeditionRunning(uint64 endsAt);
    error NoOpenExpedition();
    error NotSqueekHolder(uint256 tokenId);
    error OutOfRuns(uint256 tokenId);
    error UnknownRun(uint256 runId);
    error NotYourRun(uint256 runId);
    error AlreadySubmitted(uint256 runId);
    error SubmissionClosed(uint256 runId);
    error EmptyTape();
    error NotEnded(uint256 expeditionId);
    error AlreadyCrowned(uint256 expeditionId);
    error UnknownExpedition(uint256 expeditionId);

    constructor(ISqueekCore core_, ISqueekNFT nft_, ISqueekStaking staking_, DelveRules rules_) {
        core = core_;
        nft = nft_;
        staking = staking_;
        rules = rules_;
    }

    // ------------------------------------------------------------ expeditions

    /// @notice Open the next expedition once the previous one has stopped taking new runs.
    ///         Permissionless. Also crowns the expedition before last, whose grace has passed.
    function openExpedition() external returns (uint256 id) {
        id = _expeditions.length;
        if (id != 0) {
            Expedition storage prev = _expeditions[id - 1];
            if (block.timestamp < prev.endsAt) revert ExpeditionRunning(prev.endsAt);
            if (block.timestamp >= prev.endsAt + SUBMIT_GRACE && !prev.crowned) _crown(id - 1);
        }

        uint64 settled = core.state().settledThroughRound;
        uint64 from = settled > MOOD_WINDOW_ROUNDS ? settled - MOOD_WINDOW_ROUNDS : 0;
        ISqueekCore.LedgerPosition memory end = core.roundPage(settled, settled, 0).end;
        uint64 work = end.cumulativeWork - core.roundPage(from, from, 0).end.cumulativeWork;
        bytes32 salt = keccak256(abi.encode(address(this), id, settled, end.cumulativeWork, end.cumulativeBlockUnits));

        uint8 mood = rules.moodForWork(work);
        uint64 endsAt = uint64(block.timestamp) + EXPEDITION_SECONDS;
        _expeditions.push(
            Expedition({
                salt: salt,
                mood: mood,
                seedRound: settled,
                work: work,
                startsAt: uint64(block.timestamp),
                endsAt: endsAt,
                runs: 0,
                crowned: false
            })
        );
        emit ExpeditionOpened(id, mood, settled, work, endsAt);
    }

    /// @notice Begin a ranked run with one of your Squeeks. Draws a fresh random burrow seed and
    ///         uses one of the Squeek's runs for this expedition, whether or not it is submitted.
    function startRun(uint256 tokenId) external returns (uint256 runId, uint32 seed) {
        uint256 id = _expeditions.length;
        if (id == 0) revert NoOpenExpedition();
        id -= 1;
        Expedition storage ex = _expeditions[id];
        if (block.timestamp >= ex.endsAt) revert NoOpenExpedition();
        if (!canPlay(msg.sender, tokenId)) revert NotSqueekHolder(tokenId);
        uint8 n = runsStarted[id][tokenId];
        if (n >= RUNS_PER_EXPEDITION) revert OutOfRuns(tokenId);
        runsStarted[id][tokenId] = n + 1;

        runId = _runs.length;
        // Testnet-grade randomness: unknown before the block that includes this call.
        seed = uint32(
            uint256(
                keccak256(
                    abi.encode(block.prevrandao, blockhash(block.number - 1), ex.salt, runId, tokenId, msg.sender)
                )
            )
        );
        uint8 lvl = levelOf(tokenId);
        _runs.push(
            Run({
                tokenId: tokenId,
                player: msg.sender,
                expeditionId: uint64(id),
                seed: seed,
                level: lvl,
                startedAt: uint64(block.timestamp),
                submitted: false,
                score: 0
            })
        );
        ++ex.runs;
        ++_records[tokenId].runs;
        emit RunStarted(runId, id, tokenId, msg.sender, seed, lvl);
    }

    /// @notice Submit the action tape for a run you started. The contract replays it to score it.
    function submitRun(uint256 runId, bytes calldata tape) external returns (DelveRules.Result memory res) {
        if (runId >= _runs.length) revert UnknownRun(runId);
        Run storage r = _runs[runId];
        if (r.player != msg.sender) revert NotYourRun(runId);
        if (r.submitted) revert AlreadySubmitted(runId);
        Expedition storage ex = _expeditions[r.expeditionId];
        if (block.timestamp >= ex.endsAt + SUBMIT_GRACE) revert SubmissionClosed(runId);
        if (tape.length == 0) revert EmptyTape();

        res = rules.simulate(r.seed, r.level, ex.mood, tape);
        uint32 sc = uint32(res.score);
        r.submitted = true;
        r.score = sc;

        uint256 tokenId = r.tokenId;
        Record storage rec = _records[tokenId];
        if (res.won) ++rec.victories;
        if (res.floor > rec.deepest) rec.deepest = uint8(res.floor);
        if (sc > rec.bestScore) rec.bestScore = sc;

        uint256 id = r.expeditionId;
        Best storage b = _best[id][tokenId];
        if (b.at == 0 || sc > b.score) {
            rec.totalScore = rec.totalScore - b.score + sc;
            _best[id][tokenId] = Best({
                runId: runId,
                score: sc,
                floor: uint8(res.floor),
                kills: uint16(res.kills),
                won: res.won,
                level: r.level,
                weapon: res.weapon,
                armor: res.armor,
                sling: res.sling,
                at: uint64(block.timestamp)
            });
            _updateBoard(id, tokenId, sc);
        }

        emit RunSubmitted(
            runId, id, tokenId, msg.sender, sc, uint8(res.floor), uint16(res.kills), res.won, res.dead, tape
        );
    }

    /// @notice Record the champion of an expedition whose submission window has closed. Permissionless.
    function crown(uint256 id) external {
        if (id >= _expeditions.length) revert UnknownExpedition(id);
        if (block.timestamp < _expeditions[id].endsAt + SUBMIT_GRACE) revert NotEnded(id);
        if (_expeditions[id].crowned) revert AlreadyCrowned(id);
        _crown(id);
    }

    // ----------------------------------------------------------------- views

    function expeditionCount() external view returns (uint256) {
        return _expeditions.length;
    }

    function expedition(uint256 id) public view returns (Expedition memory) {
        if (id >= _expeditions.length) revert UnknownExpedition(id);
        return _expeditions[id];
    }

    /// @notice The latest expedition and whether it is still accepting new runs.
    function current() external view returns (bool exists, bool open, uint256 id, Expedition memory ex) {
        if (_expeditions.length == 0) return (false, false, 0, ex);
        id = _expeditions.length - 1;
        ex = _expeditions[id];
        return (true, block.timestamp < ex.endsAt, id, ex);
    }

    function runCount() external view returns (uint256) {
        return _runs.length;
    }

    function run(uint256 runId) external view returns (Run memory) {
        if (runId >= _runs.length) revert UnknownRun(runId);
        return _runs[runId];
    }

    function leaderboard(uint256 id) external view returns (uint256[] memory ids, Best[] memory bests) {
        ids = _boards[id];
        bests = new Best[](ids.length);
        for (uint256 i; i < ids.length; ++i) {
            bests[i] = _best[id][ids[i]];
        }
    }

    function bestOf(uint256 id, uint256 tokenId) external view returns (Best memory) {
        return _best[id][tokenId];
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

    function _crown(uint256 id) internal {
        Expedition storage ex = _expeditions[id];
        ex.crowned = true;
        uint256[] storage board = _boards[id];
        if (board.length == 0) return;
        uint256 champ = board[0];
        ++_records[champ].crowns;
        emit Crowned(id, champ, _best[id][champ].score);
    }

    /// @dev Keeps the board sorted by best score, descending; on ties the earlier submission stays ahead.
    function _updateBoard(uint256 id, uint256 tokenId, uint32 sc) internal {
        uint256[] storage board = _boards[id];
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
            } else if (sc > _best[id][board[len - 1]].score) {
                pos = len - 1;
                board[pos] = tokenId;
            } else {
                return;
            }
        }
        while (pos > 0 && _best[id][board[pos - 1]].score < sc) {
            (board[pos - 1], board[pos]) = (board[pos], board[pos - 1]);
            --pos;
        }
    }
}
