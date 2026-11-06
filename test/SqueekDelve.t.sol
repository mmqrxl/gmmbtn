// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SqueekDelve} from "../src/SqueekDelve.sol";
import {DelveRules} from "../src/DelveRules.sol";
import {ISqueekCore, ISqueekNFT, ISqueekStaking} from "../src/interfaces/ISqueekchain.sol";
import {MockCore, MockNFT, MockStaking} from "./mocks/Mocks.sol";

contract SqueekDelveTest is Test {
    MockCore core;
    MockNFT nft;
    MockStaking staking;
    DelveRules rules;
    SqueekDelve game;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");

    // A short scripted walk; whatever it does, the contract's score must equal rules.simulate.
    bytes constant TAPE = hex"0101010102020202030303030000000007070707040404";

    function setUp() public {
        vm.warp(1_000_000);
        vm.roll(100);
        core = new MockCore(1);
        nft = new MockNFT();
        staking = new MockStaking();
        rules = new DelveRules();
        game = new SqueekDelve(
            ISqueekCore(address(core)), ISqueekNFT(address(nft)), ISqueekStaking(address(staking)), rules
        );
        nft.mint(alice, 1, 1);
        nft.mint(alice, 2, 9);
        nft.mint(bob, 3, 1);
        nft.mint(address(staking), 4, 1); // carol's, deposited in staking
        staking.setDepositor(address(nft), 4, carol);
    }

    function _settle(uint64 through, uint64 work) internal {
        while (core.settled() < through) core.settle(core.settled() + 1, work);
    }

    function _start(address who, uint256 tokenId) internal returns (uint256 runId, uint32 seed) {
        vm.roll(block.number + 1);
        vm.prevrandao(bytes32(uint256(keccak256(abi.encode(block.number, tokenId)))));
        vm.prank(who);
        return game.startRun(tokenId);
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
        assertEq(game.expedition(1).mood, 0);
        assertFalse(game.expedition(0).crowned); // still in its submission grace
    }

    function test_everyRunGetsItsOwnSeed() public {
        game.openExpedition();
        (uint256 r0, uint32 s0) = _start(alice, 1);
        (uint256 r1, uint32 s1) = _start(alice, 1);
        (uint256 r2, uint32 s2) = _start(alice, 2);
        assertEq(r0, 0);
        assertEq(r2, 2);
        assertTrue(s0 != s1 && s1 != s2 && s0 != s2);
        assertEq(game.run(r1).seed, s1);
        assertEq(game.run(r2).level, 9);
    }

    function test_submitVerifiesByReplay() public {
        _settle(8, 20);
        game.openExpedition();
        (uint256 runId, uint32 seed) = _start(alice, 2);
        DelveRules.Result memory expected = rules.simulate(seed, 9, game.expedition(0).mood, TAPE);

        vm.prank(alice);
        DelveRules.Result memory got = game.submitRun(runId, TAPE);
        assertEq(got.score, expected.score);
        SqueekDelve.Best memory b = game.bestOf(0, 2);
        assertEq(b.score, expected.score);
        assertEq(b.runId, runId);
        assertEq(b.level, 9);
        assertEq(game.run(runId).score, expected.score);
        assertEq(game.record(2).runs, 1);

        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SqueekDelve.AlreadySubmitted.selector, runId));
        game.submitRun(runId, TAPE);
    }

    function test_holderOnlyAndOwnRuns() public {
        game.openExpedition();
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(SqueekDelve.NotSqueekHolder.selector, 1));
        game.startRun(1);

        (uint256 runId,) = _start(carol, 4); // staked Squeeks play
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SqueekDelve.NotYourRun.selector, runId));
        game.submitRun(runId, TAPE);
        vm.prank(carol);
        game.submitRun(runId, TAPE);
    }

    function test_threeRunsPerSqueek_bestCounts() public {
        game.openExpedition();
        uint256[3] memory ids;
        uint256 hi;
        for (uint256 i; i < 3; ++i) {
            (ids[i],) = _start(alice, 1);
        }
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SqueekDelve.OutOfRuns.selector, 1));
        game.startRun(1);

        vm.startPrank(alice);
        for (uint256 i; i < 3; ++i) {
            uint256 sc = game.submitRun(ids[i], i == 1 ? bytes(hex"05") : TAPE).score;
            if (sc > hi) hi = sc;
        }
        vm.stopPrank();
        assertEq(game.bestOf(0, 1).score, hi);
        assertEq(game.record(1).totalScore, hi);
        assertEq(game.runsStarted(0, 1), 3);
    }

    function test_windows() public {
        vm.prank(alice);
        vm.expectRevert(SqueekDelve.NoOpenExpedition.selector);
        game.startRun(1);

        game.openExpedition();
        SqueekDelve.Expedition memory ex = game.expedition(0);
        (uint256 runId,) = _start(alice, 1);
        vm.warp(ex.endsAt);
        vm.prank(alice);
        vm.expectRevert(SqueekDelve.NoOpenExpedition.selector);
        game.startRun(1);

        vm.prank(alice);
        vm.expectRevert(SqueekDelve.EmptyTape.selector);
        game.submitRun(runId, "");

        vm.warp(ex.endsAt + 30 minutes);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SqueekDelve.SubmissionClosed.selector, runId));
        game.submitRun(runId, TAPE);
    }

    function test_longTapeReverts() public {
        game.openExpedition();
        (uint256 runId,) = _start(alice, 1);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(DelveRules.TapeTooLong.selector, 1001));
        game.submitRun(runId, new bytes(1001));
    }

    function test_boardAndCrown() public {
        game.openExpedition();
        SqueekDelve.Expedition memory ex = game.expedition(0);
        for (uint256 i; i < 12; ++i) {
            address p = address(uint160(0x1000 + i));
            nft.mint(p, 100 + i, uint8(1 + (i % 10)));
            (uint256 runId,) = _start(p, 100 + i);
            vm.prank(p);
            game.submitRun(runId, TAPE);
        }
        (uint256[] memory ids, SqueekDelve.Best[] memory bests) = game.leaderboard(0);
        assertEq(ids.length, 10);
        for (uint256 i = 1; i < 10; ++i) {
            assertGe(bests[i - 1].score, bests[i].score);
        }

        vm.warp(ex.endsAt);
        vm.expectRevert(abi.encodeWithSelector(SqueekDelve.NotEnded.selector, 0));
        game.crown(0);
        vm.warp(ex.endsAt + 30 minutes);
        game.crown(0);
        assertEq(game.record(ids[0]).crowns, 1);
        vm.expectRevert(abi.encodeWithSelector(SqueekDelve.AlreadyCrowned.selector, 0));
        game.crown(0);
    }
}
