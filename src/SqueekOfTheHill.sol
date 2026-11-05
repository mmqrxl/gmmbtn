// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISqueekCore, ISqueekNFT, ISqueekStaking} from "./interfaces/ISqueekchain.sol";
import {HillBadge} from "./HillBadge.sol";

/// @title Squeek of the Hill
/// @notice A holder-only king-of-the-hill game for Squeek NFT holders on Sepolia.
///         There is one Golden Seed. Any Squeek holder can seize it with one of their Squeeks.
///         While a Squeek holds the Seed, every unit of real wheel work the hamster logs is
///         credited to that Squeek as points, read trustlessly from SqueekCore's certified
///         round ledger. A reign starts at the round after the seize, so already-run work can
///         never be claimed. Higher-level Squeeks are shielded for longer; dethroned Squeeks
///         must rest before they can seize again.
contract SqueekOfTheHill {
    /// @notice Rounds a dethroned Squeek must wait before seizing again (6 rounds = 1 hour).
    uint64 public constant REST_ROUNDS = 6;
    uint256 public constant MAX_SQUEEK_ID = 9_999;
    uint256 public constant BOARD_SIZE = 10;

    ISqueekCore public immutable core;
    ISqueekNFT public immutable nft;
    ISqueekStaking public immutable staking;
    uint64 public immutable genesisTimestamp;
    uint64 public immutable roundDuration;

    struct Reign {
        uint256 tokenId;
        address seizer;
        uint8 level; // Squeek level at seize time; sets the shield
        uint64 startRound; // first round this reign earns
        uint64 endRound; // last round this reign earns; 0 while it is the current reign
        uint64 shieldUntilRound; // the Seed can be seized from this round on
        uint64 creditedThrough; // rounds up to here have been credited
        uint64 work; // work credited so far
    }

    struct Squeek {
        uint64 points;
        uint32 reigns;
        uint64 roundsHeld; // rounds across finished reigns
        uint64 bestReignWork;
        uint64 restUntilRound; // cannot seize before this round
    }

    Reign[] internal _reigns;
    mapping(uint256 => Squeek) internal _squeeks;
    uint256[] internal _board;

    event Seized(
        uint256 indexed reignId,
        uint256 indexed tokenId,
        address indexed seizer,
        uint256 fromTokenId,
        uint64 startRound,
        uint64 shieldUntilRound
    );
    event Credited(uint256 indexed reignId, uint256 indexed tokenId, uint64 throughRound, uint64 work);

    error NotSqueekHolder(uint256 tokenId);
    error AlreadyKing(uint256 kingTokenId);
    error Shielded(uint64 untilRound, uint64 currentRound);
    error Resting(uint256 tokenId, uint64 untilRound);
    error NothingToCredit(uint256 reignId, uint64 creditedThrough, uint64 settledThroughRound);
    error UnknownReign(uint256 reignId);
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

    // ------------------------------------------------------------------ play

    /// @notice Take the Golden Seed with `tokenId`. Your reign earns from the next round on.
    function seize(uint256 tokenId) external returns (uint256 reignId) {
        if (!canPlay(msg.sender, tokenId)) revert NotSqueekHolder(tokenId);
        uint64 cur = currentRound();
        Squeek storage s = _squeeks[tokenId];
        if (cur < s.restUntilRound) revert Resting(tokenId, s.restUntilRound);

        uint256 fromTokenId;
        uint256 n = _reigns.length;
        if (n != 0) {
            Reign storage king = _reigns[n - 1];
            fromTokenId = king.tokenId;
            // A wallet can't seize from itself, even with another of its Squeeks.
            if (canPlay(msg.sender, king.tokenId)) revert AlreadyKing(king.tokenId);
            if (cur < king.shieldUntilRound) revert Shielded(king.shieldUntilRound, cur);
            // shieldUntilRound > startRound, so the old reign always keeps at least one round.
            king.endRound = cur;
            Squeek storage old = _squeeks[king.tokenId];
            old.roundsHeld += cur - king.startRound + 1;
            old.restUntilRound = cur + REST_ROUNDS;
        }

        uint8 lvl = _levelOf(tokenId);
        uint64 start = cur + 1;
        reignId = n;
        _reigns.push(
            Reign({
                tokenId: tokenId,
                seizer: msg.sender,
                level: lvl,
                startRound: start,
                endRound: 0,
                shieldUntilRound: start + lvl,
                creditedThrough: cur,
                work: 0
            })
        );
        ++s.reigns;
        emit Seized(reignId, tokenId, msg.sender, fromTokenId, start, start + lvl);
    }

    /// @notice Credit a reign with the work SqueekCore has certified so far. Permissionless;
    ///         points always go to the reigning Squeek. Works on the current reign too.
    function credit(uint256 reignId) public returns (uint64 work) {
        if (reignId >= _reigns.length) revert UnknownReign(reignId);
        Reign storage r = _reigns[reignId];
        uint64 settled = core.state().settledThroughRound;
        uint64 upTo = r.endRound == 0 || r.endRound > settled ? settled : r.endRound;
        if (upTo <= r.creditedThrough) revert NothingToCredit(reignId, r.creditedThrough, settled);

        work = workBetween(r.creditedThrough, upTo);
        r.creditedThrough = upTo;
        r.work += work;

        Squeek storage s = _squeeks[r.tokenId];
        s.points += work;
        if (r.work > s.bestReignWork) s.bestReignWork = r.work;
        if (work != 0) _updateBoard(r.tokenId);
        emit Credited(reignId, r.tokenId, upTo, work);
    }

    /// @notice Credit several reigns, skipping any with nothing new.
    function creditMany(uint256[] calldata reignIds) external {
        for (uint256 i; i < reignIds.length; ++i) {
            if (creditable(reignIds[i])) credit(reignIds[i]);
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

    /// @notice Certified work in rounds (afterRound, throughRound]. Reverts past the frontier.
    function workBetween(uint64 afterRound, uint64 throughRound) public view returns (uint64) {
        uint64 a = core.roundPage(afterRound, afterRound, 0).end.cumulativeWork;
        uint64 b = core.roundPage(throughRound, throughRound, 0).end.cumulativeWork;
        return b - a;
    }

    function creditable(uint256 reignId) public view returns (bool) {
        if (reignId >= _reigns.length) return false;
        Reign storage r = _reigns[reignId];
        uint64 settled = core.state().settledThroughRound;
        uint64 upTo = r.endRound == 0 || r.endRound > settled ? settled : r.endRound;
        return upTo > r.creditedThrough;
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

    function reignCount() external view returns (uint256) {
        return _reigns.length;
    }

    function reign(uint256 reignId) external view returns (Reign memory) {
        if (reignId >= _reigns.length) revert UnknownReign(reignId);
        return _reigns[reignId];
    }

    /// @notice The latest `count` reigns, newest first.
    function recentReigns(uint256 count) external view returns (uint256[] memory ids, Reign[] memory list) {
        uint256 n = _reigns.length;
        if (count > n) count = n;
        ids = new uint256[](count);
        list = new Reign[](count);
        for (uint256 i; i < count; ++i) {
            ids[i] = n - 1 - i;
            list[i] = _reigns[n - 1 - i];
        }
    }

    /// @notice The current king's token, or 0 if nobody has seized yet.
    function kingTokenId() public view returns (uint256) {
        uint256 n = _reigns.length;
        return n == 0 ? 0 : _reigns[n - 1].tokenId;
    }

    function squeek(uint256 tokenId) external view returns (Squeek memory) {
        return _squeeks[tokenId];
    }

    /// @notice Top Squeeks by points, highest first.
    function leaderboard() external view returns (uint256[] memory ids, uint64[] memory points) {
        ids = _board;
        points = new uint64[](ids.length);
        for (uint256 i; i < ids.length; ++i) {
            points[i] = _squeeks[ids[i]].points;
        }
    }

    /// @notice Fully onchain, dynamic badge (JSON + SVG data URI) for a Squeek's hill record.
    function badgeURI(uint256 tokenId) external view returns (string memory) {
        Squeek memory s = _squeeks[tokenId];
        return HillBadge.uri(
            HillBadge.Data({
                tokenId: tokenId,
                points: s.points,
                reigns: s.reigns,
                roundsHeld: s.roundsHeld,
                bestReignWork: s.bestReignWork,
                rank: _rankOf(tokenId),
                isKing: _reigns.length != 0 && kingTokenId() == tokenId
            })
        );
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

    /// @dev Keeps `_board` sorted descending. Points only grow, so a token only moves up.
    function _updateBoard(uint256 tokenId) internal {
        uint64 pts = _squeeks[tokenId].points;
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
            } else if (pts > _squeeks[_board[len - 1]].points) {
                pos = len - 1;
                _board[pos] = tokenId;
            } else {
                return;
            }
        }
        while (pos > 0 && _squeeks[_board[pos - 1]].points < pts) {
            (_board[pos - 1], _board[pos]) = (_board[pos], _board[pos - 1]);
            --pos;
        }
    }
}
