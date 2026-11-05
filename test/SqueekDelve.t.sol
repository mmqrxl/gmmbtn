// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SqueekDelve} from "../src/SqueekDelve.sol";
import {DelveEngine} from "../src/DelveEngine.sol";
import {ISqueekCore, ISqueekNFT, ISqueekStaking} from "../src/interfaces/ISqueekchain.sol";
import {MockCore, MockNFT, MockStaking} from "./mocks/Mocks.sol";

contract SqueekDelveTest is Test {
    MockCore core;
    MockNFT nft;
    MockStaking staking;
    SqueekDelve game;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");

    function setUp() public {
        vm.warp(1_000_000);
        core = new MockCore(1);
        nft = new MockNFT();
        staking = new MockStaking();
        game = new SqueekDelve(ISqueekCore(address(core)), ISqueekNFT(address(nft)), ISqueekStaking(address(staking)));
        nft.mint(alice, 1, 1);
        nft.mint(alice, 2, 9);
        nft.mint(bob, 3, 1);
        nft.mint(address(staking), 4, 1); // carol's, deposited in staking
        staking.setDepositor(address(nft), 4, carol);
    }

    function _settle(uint64 through, uint64 work) internal {
        while (core.settled() < through) core.settle(core.settled() + 1, work);
    }

    function _tape(uint8 a, uint256 n) internal pure returns (bytes memory t) {
        t = new bytes(n);
        for (uint256 i; i < n; ++i) {
            t[i] = bytes1(a);
        }
    }

    function test_openSetsMoodFromRecentWork() public {
        _settle(10, 0);
        _settle(16, 60); // last 6 rounds: 360 work => Zoomies
        game.openExpedition();
        SqueekDelve.Expedition memory ex = game.expedition(0);
        assertEq(ex.seedRound, 16);
        assertEq(ex.work, 360);
        assertEq(ex.mood, 3);
        assertEq(ex.endsAt, block.timestamp + 2 hours);

        vm.expectRevert(abi.encodeWithSelector(SqueekDelve.ExpeditionRunning.selector, ex.endsAt));
        game.openExpedition();

        vm.warp(ex.endsAt);
        _settle(30, 0); // hamster slept
        game.openExpedition();
        SqueekDelve.Expedition memory ex2 = game.expedition(1);
        assertEq(ex2.mood, 0);
        assertTrue(ex2.seed != ex.seed);
        assertTrue(game.expedition(0).crowned);
    }

    function test_openBeforeAnySettlement() public {
        game.openExpedition();
        assertEq(game.expedition(0).work, 0);
        assertEq(game.expedition(0).mood, 0);
    }

    function test_submitVerifiesByReplay() public {
        _settle(8, 20);
        game.openExpedition();
        SqueekDelve.Expedition memory ex = game.expedition(0);
        bytes memory tape = hex"0101020203030000";
        DelveEngine.Result memory expected = game.simulate(ex.seed, 9, ex.mood, tape);

        vm.prank(alice);
        DelveEngine.Result memory got = game.submitRun(2, tape);
        assertEq(got.score, expected.score);
        SqueekDelve.Best memory b = game.bestOf(0, 2);
        assertEq(b.score, expected.score);
        assertEq(b.level, 9);
        assertEq(game.record(2).runs, 1);
    }

    function test_holderOnly() public {
        game.openExpedition();
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(SqueekDelve.NotSqueekHolder.selector, 1));
        game.submitRun(1, hex"04");
        vm.prank(carol);
        game.submitRun(4, hex"04"); // staked Squeeks play
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SqueekDelve.NotSqueekHolder.selector, 4));
        game.submitRun(4, hex"04");
    }

    function test_threeAttemptsKeepBest() public {
        game.openExpedition();
        SqueekDelve.Expedition memory ex = game.expedition(0);
        // Find two tapes with different scores by walking in each direction.
        bytes[4] memory tapes = [_tape(0, 12), _tape(1, 12), _tape(2, 12), _tape(3, 12)];
        uint256 hi;
        uint256 hiScore;
        for (uint256 i; i < 4; ++i) {
            uint256 sc = game.simulate(ex.seed, 1, ex.mood, tapes[i]).score;
            if (sc >= hiScore) (hi, hiScore) = (i, sc);
        }
        vm.startPrank(alice);
        game.submitRun(1, tapes[hi]);
        game.submitRun(1, hex"05"); // flee at once: score 0
        assertEq(game.bestOf(0, 1).score, hiScore);
        game.submitRun(1, hex"05");
        vm.expectRevert(abi.encodeWithSelector(SqueekDelve.OutOfAttempts.selector, 1));
        game.submitRun(1, hex"05");
        vm.stopPrank();
        assertEq(game.attemptsUsed(0, 1), 3);
        assertEq(game.record(1).runs, 3);
        assertEq(game.record(1).totalScore, hiScore);
    }

    function test_closedAfterEnd() public {
        game.openExpedition();
        vm.warp(block.timestamp + 2 hours);
        vm.prank(alice);
        vm.expectRevert(SqueekDelve.NoOpenExpedition.selector);
        game.submitRun(1, hex"04");
    }

    function test_noExpeditionYet() public {
        vm.prank(alice);
        vm.expectRevert(SqueekDelve.NoOpenExpedition.selector);
        game.submitRun(1, hex"04");
    }

    function test_emptyAndLongTapes() public {
        game.openExpedition();
        vm.startPrank(alice);
        vm.expectRevert(SqueekDelve.EmptyTape.selector);
        game.submitRun(1, "");
        vm.expectRevert(abi.encodeWithSelector(DelveEngine.TapeTooLong.selector, 601));
        game.submitRun(1, new bytes(601));
        vm.stopPrank();
    }

    function test_boardOrderTiesAndCrown() public {
        game.openExpedition();
        SqueekDelve.Expedition memory ex = game.expedition(0);
        bytes memory tape = _bestShortTape(ex);
        uint256 sc = game.simulate(ex.seed, 1, ex.mood, tape).score;
        assertGt(sc, 0);

        vm.prank(bob);
        game.submitRun(3, tape); // first with this score
        vm.prank(alice);
        game.submitRun(1, tape); // same level, same tape: ties never overtake
        vm.prank(carol);
        game.submitRun(4, hex"05");

        (uint256[] memory ids, SqueekDelve.Best[] memory bests) = game.leaderboard(0);
        assertEq(ids.length, 3);
        assertEq(ids[0], 3);
        assertEq(ids[1], 1);
        assertEq(ids[2], 4);
        assertEq(bests[0].score, sc);

        vm.expectRevert(abi.encodeWithSelector(SqueekDelve.NotEnded.selector, 0));
        game.crown(0);
        vm.warp(ex.endsAt);
        game.crown(0);
        assertEq(game.record(3).crowns, 1);
        vm.expectRevert(abi.encodeWithSelector(SqueekDelve.AlreadyCrowned.selector, 0));
        game.crown(0);
    }

    function test_boardCapsAtTen() public {
        game.openExpedition();
        SqueekDelve.Expedition memory ex = game.expedition(0);
        bytes memory tape = _bestShortTape(ex);
        for (uint256 i; i < 12; ++i) {
            address p = address(uint160(0x1000 + i));
            nft.mint(p, 100 + i, uint8(1 + (i % 10)));
            vm.prank(p);
            game.submitRun(100 + i, tape);
        }
        (uint256[] memory ids, SqueekDelve.Best[] memory bests) = game.leaderboard(0);
        assertEq(ids.length, 10);
        for (uint256 i = 1; i < 10; ++i) {
            assertGe(bests[i - 1].score, bests[i].score);
        }
    }

    /// Picks the best-scoring 20-step straight walk so tests don't depend on a specific layout.
    function _bestShortTape(SqueekDelve.Expedition memory ex) internal view returns (bytes memory best) {
        uint256 hiScore;
        for (uint8 d; d < 4; ++d) {
            for (uint8 e; e < 4; ++e) {
                bytes memory t = new bytes(20);
                for (uint256 i; i < 20; ++i) {
                    t[i] = bytes1(i < 10 ? d : e);
                }
                uint256 sc = game.simulate(ex.seed, 1, ex.mood, t).score;
                if (sc > hiScore || best.length == 0) (best, hiScore) = (t, sc);
            }
        }
    }
}
