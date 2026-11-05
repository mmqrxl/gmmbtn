// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISqueekCore, ISqueekNFT, ISqueekStaking} from "./interfaces/ISqueekchain.sol";
import {DelveEngine} from "./DelveEngine.sol";

/// @title Squeek Delve
/// @notice A holder-only pixel roguelike for Squeek NFT holders on Sepolia.
///         Each expedition is a fixed five-floor burrow seeded from SqueekCore's certified ledger;
///         the real work the hamster did in the six certified rounds before it opened sets the
///         burrow's mood. Holders play in the browser, then submit their action tape. The contract
///         rebuilds the burrow and replays every turn, so the score is verified onchain, not trusted.
contract SqueekDelve {
    uint64 public constant EXPEDITION_SECONDS = 2 hours;
    uint64 public constant MOOD_WINDOW_ROUNDS = 6;
    uint8 public constant ATTEMPTS_PER_EXPEDITION = 3;
    uint256 public constant MAX_SQUEEK_ID = 9_999;
    uint256 public constant BOARD_SIZE = 10;

    ISqueekCore public immutable core;
    ISqueekNFT public immutable nft;
    ISqueekStaking public immutable staking;

    struct Expedition {
        uint32 seed;
        uint8 mood;
        uint64 seedRound; // SqueekCore settledThroughRound when opened
        uint64 work; // hamster work in the mood window
        uint64 startsAt;
        uint64 endsAt;
        uint32 runs;
        bool crowned;
    }

    struct Best {
        uint32 score;
        uint8 floor;
        uint16 kills;
        bool won;
        uint8 level;
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
    mapping(uint256 => mapping(uint256 => uint8)) public attemptsUsed;
    mapping(uint256 => mapping(uint256 => Best)) internal _best;
    mapping(uint256 => uint256[]) internal _boards;
    mapping(uint256 => Record) internal _records;

    event ExpeditionOpened(
        uint256 indexed expeditionId, uint32 seed, uint8 mood, uint64 seedRound, uint64 work, uint64 endsAt
    );
    event RunSubmitted(
        uint256 indexed expeditionId,
        uint256 indexed tokenId,
        address indexed player,
        uint8 attempt,
        uint8 level,
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
    error OutOfAttempts(uint256 tokenId);
    error EmptyTape();
    error NotEnded(uint256 expeditionId);
    error AlreadyCrowned(uint256 expeditionId);
    error UnknownExpedition(uint256 expeditionId);

    constructor(ISqueekCore core_, ISqueekNFT nft_, ISqueekStaking staking_) {
        core = core_;
        nft = nft_;
        staking = staking_;
    }

    // ------------------------------------------------------------ expeditions

    /// @notice Open the next expedition once the previous one has ended. Permissionless.
    ///         Crowns the previous expedition's champion if nobody has yet.
    function openExpedition() external returns (uint256 id) {
        id = _expeditions.length;
        if (id != 0) {
            Expedition storage prev = _expeditions[id - 1];
            if (block.timestamp < prev.endsAt) revert ExpeditionRunning(prev.endsAt);
            if (!prev.crowned) _crown(id - 1);
        }

        uint64 settled = core.state().settledThroughRound;
        uint64 from = settled > MOOD_WINDOW_ROUNDS ? settled - MOOD_WINDOW_ROUNDS : 0;
        ISqueekCore.LedgerPosition memory end = core.roundPage(settled, settled, 0).end;
        uint64 work = end.cumulativeWork - core.roundPage(from, from, 0).end.cumulativeWork;

        uint32 seed = uint32(
            uint256(
                keccak256(
                    abi.encode(
                        address(this), id, settled, end.cumulativeWork, end.cumulativeBlockUnits, block.prevrandao
                    )
                )
            )
        );
        uint8 mood = DelveEngine.moodForWork(work);
        uint64 endsAt = uint64(block.timestamp) + EXPEDITION_SECONDS;
        _expeditions.push(
            Expedition({
                seed: seed,
                mood: mood,
                seedRound: settled,
                work: work,
                startsAt: uint64(block.timestamp),
                endsAt: endsAt,
                runs: 0,
                crowned: false
            })
        );
        emit ExpeditionOpened(id, seed, mood, settled, work, endsAt);
    }

    /// @notice Submit a run for the open expedition. The contract replays it to get the score.
    function submitRun(uint256 tokenId, bytes calldata tape) external returns (DelveEngine.Result memory res) {
        uint256 id = _expeditions.length;
        if (id == 0) revert NoOpenExpedition();
        id -= 1;
        Expedition storage ex = _expeditions[id];
        if (block.timestamp >= ex.endsAt) revert NoOpenExpedition();
        if (tape.length == 0) revert EmptyTape();
        if (!canPlay(msg.sender, tokenId)) revert NotSqueekHolder(tokenId);
        uint8 attempt = attemptsUsed[id][tokenId] + 1;
        if (attempt > ATTEMPTS_PER_EXPEDITION) revert OutOfAttempts(tokenId);
        attemptsUsed[id][tokenId] = attempt;

        uint8 lvl = levelOf(tokenId);
        res = DelveEngine.simulate(ex.seed, lvl, ex.mood, tape);
        ++ex.runs;

        Record storage rec = _records[tokenId];
        ++rec.runs;
        if (res.won) ++rec.victories;
        if (res.floor > rec.deepest) rec.deepest = uint8(res.floor);
        uint32 sc = uint32(res.score);
        if (sc > rec.bestScore) rec.bestScore = sc;

        Best storage b = _best[id][tokenId];
        if (attempt == 1 || sc > b.score) {
            rec.totalScore = rec.totalScore - b.score + sc;
            _best[id][tokenId] = Best(sc, uint8(res.floor), uint16(res.kills), res.won, lvl, uint64(block.timestamp));
            _updateBoard(id, tokenId, sc);
        }

        emit RunSubmitted(
            id, tokenId, msg.sender, attempt, lvl, sc, uint8(res.floor), uint16(res.kills), res.won, res.dead, tape
        );
    }

    /// @notice Record the champion of an ended expedition. Permissionless.
    function crown(uint256 id) external {
        if (id >= _expeditions.length) revert UnknownExpedition(id);
        if (block.timestamp < _expeditions[id].endsAt) revert NotEnded(id);
        if (_expeditions[id].crowned) revert AlreadyCrowned(id);
        _crown(id);
    }

    // ----------------------------------------------------------------- views

    /// @notice Replay a tape without submitting it; the UI shows this as the verified score.
    function simulate(uint32 seed, uint8 level, uint8 mood, bytes calldata tape)
        external
        pure
        returns (DelveEngine.Result memory)
    {
        return DelveEngine.simulate(seed, level, mood, tape);
    }

    /// @notice A floor's layout, for tests and tools. `open` has bit y*15+x set for walkable cells.
    function floorLayout(uint32 seed, uint8 floor, uint8 mood)
        external
        pure
        returns (uint256 open, int256 stairsX, int256 stairsY, int256[] memory enemies, int256[] memory items)
    {
        DelveEngine.Floor memory f = DelveEngine.genFloor(seed, floor, mood);
        enemies = new int256[](f.enemies.length * 3);
        for (uint256 i; i < f.enemies.length; ++i) {
            enemies[i * 3] = int256(uint256(f.enemies[i].kind));
            enemies[i * 3 + 1] = f.enemies[i].x;
            enemies[i * 3 + 2] = f.enemies[i].y;
        }
        items = new int256[](f.items.length * 3);
        for (uint256 i; i < f.items.length; ++i) {
            items[i * 3] = int256(uint256(f.items[i].kind));
            items[i * 3 + 1] = f.items[i].x;
            items[i * 3 + 2] = f.items[i].y;
        }
        return (f.open, f.sx, f.sy, enemies, items);
    }

    function expeditionCount() external view returns (uint256) {
        return _expeditions.length;
    }

    function expedition(uint256 id) public view returns (Expedition memory) {
        if (id >= _expeditions.length) revert UnknownExpedition(id);
        return _expeditions[id];
    }

    /// @notice The latest expedition and whether it is still accepting runs.
    function current() external view returns (bool exists, bool open, uint256 id, Expedition memory ex) {
        if (_expeditions.length == 0) return (false, false, 0, ex);
        id = _expeditions.length - 1;
        ex = _expeditions[id];
        return (true, block.timestamp < ex.endsAt, id, ex);
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

    /// @dev Keeps the board sorted by best score, descending. A token's best only grows, so it only
    ///      moves up; on ties the earlier run stays ahead, so copying a public tape never overtakes.
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
