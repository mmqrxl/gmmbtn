// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SqueekSeers} from "../src/SqueekSeers.sol";
import {ISqueekCore, ISqueekNFT, ISqueekStaking} from "../src/interfaces/ISqueekchain.sol";
import {MockCore, MockNFT, MockStaking} from "./mocks/Mocks.sol";

contract SqueekSeersTest is Test {
    MockCore core;
    MockNFT nft;
    MockStaking staking;
    SqueekSeers game;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    uint64 constant GENESIS = 1_000_000;

    function setUp() public {
        vm.warp(GENESIS + 10); // round 1
        core = new MockCore(GENESIS);
        nft = new MockNFT();
        staking = new MockStaking();
        game = new SqueekSeers(ISqueekCore(address(core)), ISqueekNFT(address(nft)), ISqueekStaking(address(staking)));
        nft.mint(alice, 1, 1);
        nft.mint(alice, 2, 3);
        nft.mint(bob, 3, 1);
        nft.mint(address(staking), 4, 2); // carol's, deposited in staking
        staking.setDepositor(address(nft), 4, carol);
    }

    function _ids(uint256 a) internal pure returns (uint256[] memory r) {
        r = new uint256[](1);
        r[0] = a;
    }

    function _ids(uint256 a, uint256 b) internal pure returns (uint256[] memory r) {
        r = new uint256[](2);
        r[0] = a;
        r[1] = b;
    }

    function _settleThrough(uint64 round, uint64 work) internal {
        while (core.settled() + 1 < round) core.settle(core.settled() + 1, 0);
        core.settle(round, work);
    }

    function test_roundMath() public view {
        assertEq(game.currentRound(), 1);
        assertEq(game.roundStart(2), GENESIS + 600);
        assertEq(game.moodForWork(0), 0);
        assertEq(game.moodForWork(99), 1);
        assertEq(game.moodForWork(100), 2);
        assertEq(game.moodForWork(299), 2);
        assertEq(game.moodForWork(300), 3);
    }

    function test_holderOnly() public {
        assertTrue(game.canPlay(alice, 1));
        assertTrue(game.canPlay(carol, 4)); // staked Squeeks play
        assertFalse(game.canPlay(bob, 1));
        assertFalse(game.canPlay(alice, 4));
        assertFalse(game.canPlay(alice, 999)); // nonexistent

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(SqueekSeers.NotSqueekHolder.selector, 1));
        game.predict(_ids(1), 2, 0);
    }

    function test_cannotCallStartedOrFarRounds() public {
        vm.startPrank(alice);
        vm.expectRevert(abi.encodeWithSelector(SqueekSeers.RoundLocked.selector, 1, 1));
        game.predict(_ids(1), 1, 0);
        vm.expectRevert(abi.encodeWithSelector(SqueekSeers.RoundTooFar.selector, 146, 145));
        game.predict(_ids(1), 146, 0);
        vm.expectRevert(SqueekSeers.InvalidMood.selector);
        game.predict(_ids(1), 2, 4);
        game.predict(_ids(1), 145, 0);
        vm.stopPrank();
    }

    function test_changeCallBeforeLock() public {
        vm.startPrank(alice);
        game.predict(_ids(1), 3, 0);
        game.predict(_ids(1), 3, 3);
        vm.stopPrank();
        SqueekSeers.Round memory r = game.getRound(3);
        assertEq(r.total, 1);
        assertEq(r.counts[0], 0);
        assertEq(r.counts[3], 1);
    }

    function test_fullRound_contrarianWinsMore() public {
        vm.prank(alice);
        game.predict(_ids(1, 2), 2, 3); // ZOOMIES, levels 1 and 3
        vm.prank(bob);
        game.predict(_ids(3), 2, 0); // SNOOZE
        vm.prank(carol);
        game.predict(_ids(4), 2, 0); // SNOOZE

        vm.warp(GENESIS + 600 * 2 + 1); // round 3: round 2 is closed
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SqueekSeers.RoundLocked.selector, 2, 3));
        game.predict(_ids(1), 2, 0);

        vm.expectRevert(abi.encodeWithSelector(SqueekSeers.RoundNotSettled.selector, 2, 0));
        game.resolve(2);

        _settleThrough(2, 420); // the hamster sprinted
        uint256[] memory all = new uint256[](4);
        (all[0], all[1], all[2], all[3]) = (1, 2, 3, 4);
        game.score(2, all);

        SqueekSeers.Round memory r = game.getRound(2);
        assertTrue(r.resolved);
        assertEq(r.work, 420);
        assertEq(r.outcome, 3);

        // 4 calls, 2 winners: x2.00. Level multiplies.
        assertEq(game.seer(1).points, 200);
        assertEq(game.seer(2).points, 600);
        assertEq(game.seer(3).points, 0);
        assertEq(game.seer(3).played, 1);
        assertEq(game.seer(2).bestMultiplierX100, 200);

        (uint256[] memory ids, uint64[] memory pts) = game.leaderboard();
        assertEq(ids.length, 2);
        assertEq(ids[0], 2);
        assertEq(pts[0], 600);
        assertEq(ids[1], 1);

        // Scoring twice does nothing.
        game.score(2, all);
        assertEq(game.seer(2).points, 600);
        vm.expectRevert(abi.encodeWithSelector(SqueekSeers.AlreadyResolved.selector, 2));
        game.resolve(2);
    }

    function test_levelLockedAtCallTime_and_transferKeepsPoints() public {
        vm.prank(alice);
        game.predict(_ids(2), 2, 1);
        nft.transfer(2, bob); // sold after calling
        vm.warp(GENESIS + 600 * 2);
        _settleThrough(2, 5);
        game.score(2, _ids(2));
        assertEq(game.seer(2).points, 300); // sole caller x1, level 3
    }

    function test_burnedSqueekStillScores() public {
        vm.prank(alice);
        game.predict(_ids(1), 2, 0);
        nft.burn(1); // merged away
        vm.warp(GENESIS + 600 * 2);
        _settleThrough(2, 0);
        game.score(2, _ids(1));
        assertEq(game.seer(1).points, 100);
    }

    function test_streaks() public {
        for (uint64 round = 2; round <= 4; ++round) {
            vm.warp(GENESIS + 600 * (round - 2) + 1);
            vm.prank(alice);
            game.predict(_ids(1), round, round == 4 ? 3 : 0);
        }
        vm.warp(GENESIS + 600 * 5);
        _settleThrough(4, 0);
        for (uint64 round = 2; round <= 4; ++round) {
            game.score(round, _ids(1));
        }
        SqueekSeers.Seer memory s = game.seer(1);
        assertEq(s.wins, 2);
        assertEq(s.played, 3);
        assertEq(s.bestStreak, 2);
        assertEq(s.streak, 0);
    }

    function test_leaderboardCapsAndSorts() public {
        for (uint256 id = 10; id < 22; ++id) {
            nft.mint(alice, id, uint8(id - 9));
        }
        uint256[] memory ids = new uint256[](12);
        for (uint256 i; i < 12; ++i) {
            ids[i] = 10 + i;
        }
        vm.prank(alice);
        game.predict(ids, 2, 0);
        vm.warp(GENESIS + 600 * 2);
        _settleThrough(2, 0);
        game.score(2, ids);
        (uint256[] memory board, uint64[] memory pts) = game.leaderboard();
        assertEq(board.length, 10);
        assertEq(board[0], 21);
        assertEq(board[9], 12);
        for (uint256 i = 1; i < 10; ++i) {
            assertGe(pts[i - 1], pts[i]);
        }
    }

    function test_badge() public {
        vm.prank(alice);
        game.predict(_ids(2), 2, 0);
        vm.warp(GENESIS + 600 * 2);
        _settleThrough(2, 0);
        game.score(2, _ids(2));
        string memory uri = game.badgeURI(2);
        assertEq(bytes(uri).length > 100, true);
        assertEq(_startsWith(uri, "data:application/json;base64,"), true);
    }

    function _startsWith(string memory s, string memory p) internal pure returns (bool) {
        bytes memory a = bytes(s);
        bytes memory b = bytes(p);
        if (a.length < b.length) return false;
        for (uint256 i; i < b.length; ++i) {
            if (a[i] != b[i]) return false;
        }
        return true;
    }
}
