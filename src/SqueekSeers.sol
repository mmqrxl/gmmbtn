// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISqueekCore, ISqueekNFT, ISqueekStaking} from "./interfaces/ISqueekchain.sol";
import {SeerBadge} from "./SeerBadge.sol";

/// @title Squeek Seers
/// @notice A holder-only prediction league for Squeek NFT holders on Sepolia.
///         Every Squeek is a "seer" that calls the hamster's mood for an upcoming 10-minute
///         round. Outcomes are read trustlessly from SqueekCore's certified round ledger, so
///         no oracle, server or admin decides who wins. Points live on the tokenId, not the
///         wallet: a Squeek's reputation travels with it.
contract SqueekSeers {
    // Moods, by the work units the hamster logs in the round.
    uint8 public constant SNOOZE = 0; //   0 work: asleep
    uint8 public constant POTTER = 1; //   1-99 work: a few laps
    uint8 public constant JOG = 2; //      100-299 work: proper running
    uint8 public constant ZOOMIES = 3; //  300+ work: full sprint
    uint8 public constant MOOD_COUNT = 4;

    uint64 public constant POTTER_MIN = 1;
    uint64 public constant JOG_MIN = 100;
    uint64 public constant ZOOMIES_MIN = 300;

    uint256 public constant BASE_POINTS = 100;
    /// @notice How far ahead a round can be called (144 rounds = 24 hours).
    uint64 public constant MAX_LEAD_ROUNDS = 144;
    uint256 public constant MAX_SQUEEK_ID = 9_999;
    uint256 public constant MAX_BATCH = 50;
    uint256 public constant BOARD_SIZE = 10;

    ISqueekCore public immutable core;
    ISqueekNFT public immutable nft;
    ISqueekStaking public immutable staking;
    uint64 public immutable genesisTimestamp;
    uint64 public immutable roundDuration;

    struct Round {
        uint32[4] counts; // calls per mood
        uint32 total;
        bool resolved;
        uint8 outcome;
        uint64 work;
    }

    struct Pick {
        uint8 moodPlusOne; // 0 = no call
        uint8 level; // Squeek level when the call was made
        bool scored;
    }

    struct Seer {
        uint64 points;
        uint32 played;
        uint32 wins;
        uint32 streak; // consecutive wins in scoring order
        uint32 bestStreak;
        uint64 lastRound;
        uint32 bestMultiplierX100;
    }

    mapping(uint64 => Round) internal _rounds;
    mapping(uint64 => mapping(uint256 => Pick)) internal _picks;
    mapping(uint256 => Seer) internal _seers;
    uint256[] internal _board;

    event Called(uint64 indexed round, uint256 indexed tokenId, address indexed player, uint8 mood, uint8 level);
    event RoundResolved(uint64 indexed round, uint64 work, uint8 outcome, uint32 total, uint32 winners);
    event Scored(uint64 indexed round, uint256 indexed tokenId, bool won, uint256 points, uint32 multiplierX100);

    error InvalidMood();
    error RoundLocked(uint64 round, uint64 currentRound);
    error RoundTooFar(uint64 round, uint64 maxRound);
    error NotSqueekHolder(uint256 tokenId);
    error InvalidBatch();
    error RoundNotSettled(uint64 round, uint64 settledThroughRound);
    error AlreadyResolved(uint64 round);
    error InvalidRound();

    constructor(ISqueekCore core_, ISqueekNFT nft_, ISqueekStaking staking_) {
        core = core_;
        nft = nft_;
        staking = staking_;
        ISqueekCore.CoreConfiguration memory cfg = core_.configuration();
        if (cfg.roundDuration == 0 || cfg.genesisTimestamp == 0) revert InvalidRound();
        genesisTimestamp = cfg.genesisTimestamp;
        roundDuration = cfg.roundDuration;
    }

    // ---------------------------------------------------------------- calls

    /// @notice Call the hamster's mood for `round` with one or more of your Squeeks.
    ///         Calls can be changed until the round starts. Deposited (staked) Squeeks play too.
    function predict(uint256[] calldata tokenIds, uint64 round, uint8 mood) external {
        if (mood >= MOOD_COUNT) revert InvalidMood();
        if (tokenIds.length == 0 || tokenIds.length > MAX_BATCH) revert InvalidBatch();
        uint64 current = currentRound();
        // The round must not have started yet, so nobody can see any of its work.
        if (round <= current) revert RoundLocked(round, current);
        if (round > current + MAX_LEAD_ROUNDS) revert RoundTooFar(round, current + MAX_LEAD_ROUNDS);

        Round storage r = _rounds[round];
        for (uint256 i; i < tokenIds.length; ++i) {
            uint256 id = tokenIds[i];
            if (!canPlay(msg.sender, id)) revert NotSqueekHolder(id);
            Pick storage p = _picks[round][id];
            if (p.moodPlusOne != 0) {
                --r.counts[p.moodPlusOne - 1];
            } else {
                ++r.total;
            }
            ++r.counts[mood];
            uint8 lvl = _levelOf(id);
            p.moodPlusOne = mood + 1;
            p.level = lvl;
            emit Called(round, id, msg.sender, mood, lvl);
        }
    }

    // ------------------------------------------------------------ settlement

    /// @notice Settle `round` from SqueekCore once the Reporter has certified it. Permissionless.
    function resolve(uint64 round) public {
        Round storage r = _rounds[round];
        if (r.resolved) revert AlreadyResolved(round);
        if (round == 0) revert InvalidRound();
        uint64 settled = core.state().settledThroughRound;
        if (round > settled) revert RoundNotSettled(round, settled);

        // Point reads: position after round-1 and after round. Round 0 is the launch position.
        uint64 before = core.roundPage(round - 1, round - 1, 0).end.cumulativeWork;
        uint64 afterRound = core.roundPage(round, round, 0).end.cumulativeWork;
        uint64 work = afterRound - before;

        uint8 outcome = moodForWork(work);
        r.resolved = true;
        r.outcome = outcome;
        r.work = work;
        emit RoundResolved(round, work, outcome, r.total, r.counts[outcome]);
    }

    /// @notice Score Squeeks' calls for a settled round. Anyone may score anyone; points go to the
    ///         Squeek. Resolves the round first if needed.
    function score(uint64 round, uint256[] calldata tokenIds) external {
        if (tokenIds.length == 0 || tokenIds.length > MAX_BATCH) revert InvalidBatch();
        Round storage r = _rounds[round];
        if (!r.resolved) resolve(round);

        uint32 winners = r.counts[r.outcome];
        uint32 multiplierX100 = winners == 0 ? 0 : uint32((uint256(r.total) * 100) / winners);

        for (uint256 i; i < tokenIds.length; ++i) {
            uint256 id = tokenIds[i];
            Pick storage p = _picks[round][id];
            if (p.moodPlusOne == 0 || p.scored) continue;
            p.scored = true;

            Seer storage s = _seers[id];
            ++s.played;
            if (round > s.lastRound) s.lastRound = round;

            bool won = p.moodPlusOne - 1 == r.outcome;
            uint256 pts;
            if (won) {
                pts = (BASE_POINTS * multiplierX100 * p.level) / 100;
                s.points += uint64(pts);
                ++s.wins;
                ++s.streak;
                if (s.streak > s.bestStreak) s.bestStreak = s.streak;
                if (multiplierX100 > s.bestMultiplierX100) s.bestMultiplierX100 = multiplierX100;
                _updateBoard(id);
            } else {
                s.streak = 0;
            }
            emit Scored(round, id, won, pts, won ? multiplierX100 : 0);
        }
    }

    // ----------------------------------------------------------------- views

    function currentRound() public view returns (uint64) {
        if (block.timestamp < genesisTimestamp) return 0;
        return uint64((block.timestamp - genesisTimestamp) / roundDuration) + 1;
    }

    function roundStart(uint64 round) public view returns (uint64) {
        if (round == 0) revert InvalidRound();
        return genesisTimestamp + (round - 1) * roundDuration;
    }

    function moodForWork(uint64 work) public pure returns (uint8) {
        if (work >= ZOOMIES_MIN) return ZOOMIES;
        if (work >= JOG_MIN) return JOG;
        if (work >= POTTER_MIN) return POTTER;
        return SNOOZE;
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

    function getRound(uint64 round) external view returns (Round memory) {
        return _rounds[round];
    }

    function getPicks(uint64 round, uint256[] calldata tokenIds) external view returns (Pick[] memory picks) {
        picks = new Pick[](tokenIds.length);
        for (uint256 i; i < tokenIds.length; ++i) {
            picks[i] = _picks[round][tokenIds[i]];
        }
    }

    function seer(uint256 tokenId) external view returns (Seer memory) {
        return _seers[tokenId];
    }

    /// @notice Top seers by points, highest first.
    function leaderboard() external view returns (uint256[] memory ids, uint64[] memory points) {
        ids = _board;
        points = new uint64[](ids.length);
        for (uint256 i; i < ids.length; ++i) {
            points[i] = _seers[ids[i]].points;
        }
    }

    /// @notice Fully onchain, dynamic seer badge (JSON + SVG data URI) for a Squeek.
    function badgeURI(uint256 tokenId) external view returns (string memory) {
        Seer memory s = _seers[tokenId];
        return SeerBadge.uri(tokenId, s.points, s.wins, s.played, s.bestStreak, _rankOf(tokenId));
    }

    // -------------------------------------------------------------- internal

    function _levelOf(uint256 tokenId) internal view returns (uint8) {
        try nft.level(tokenId) returns (uint8 l) {
            return l == 0 ? 1 : l;
        } catch {
            return 1;
        }
    }

    function _rankOf(uint256 tokenId) internal view returns (uint256) {
        for (uint256 i; i < _board.length; ++i) {
            if (_board[i] == tokenId) return i + 1;
        }
        return 0;
    }

    /// @dev Keeps `_board` sorted descending. Points only ever grow, so a token only moves up.
    function _updateBoard(uint256 tokenId) internal {
        uint64 pts = _seers[tokenId].points;
        uint256 len = _board.length;
        uint256 pos = len;
        for (uint256 i; i < len; ++i) {
            if (_board[i] == tokenId) {
                pos = i;
                break;
            }
        }
        if (pos == len) {
            if (len < BOARD_SIZE) {
                _board.push(tokenId);
            } else if (pts > _seers[_board[len - 1]].points) {
                pos = len - 1;
                _board[pos] = tokenId;
            } else {
                return;
            }
        }
        while (pos > 0 && _seers[_board[pos - 1]].points < pts) {
            (_board[pos - 1], _board[pos]) = (_board[pos], _board[pos - 1]);
            --pos;
        }
    }
}
