// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SqueekDelve} from "../src/SqueekDelve.sol";
import {DelveRules} from "../src/DelveRules.sol";
import {ISqueekCore, ISqueekNFT, ISqueekStaking} from "../src/interfaces/ISqueekchain.sol";
import {MockCore, MockNFT, MockStaking, MockRenderer} from "./mocks/Mocks.sol";
import {MockRules} from "./mocks/MockRules.sol";
import {ProgressJson} from "./ProgressJson.sol";

contract SqueekDelveTest is Test {
    MockCore core;
    MockNFT nft;
    MockStaking staking;
    SqueekDelve game; // with MockRules: each tape byte = one floor + that many seeds
    SqueekDelve real; // with the real rules

    address alice = address(0xA11CE);
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");

    function setUp() public {
        vm.warp(1_000_000);
        vm.roll(100);
        core = new MockCore(1);
        nft = new MockNFT();
        staking = new MockStaking();
        game = new SqueekDelve(
            ISqueekCore(address(core)), ISqueekNFT(address(nft)), ISqueekStaking(address(staking)), new MockRules()
        );
        real = new SqueekDelve(
            ISqueekCore(address(core)), ISqueekNFT(address(nft)), ISqueekStaking(address(staking)), new DelveRules()
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

    function _start(SqueekDelve g, address who, uint256 tokenId) internal returns (uint256 runId, uint32 seed) {
        vm.roll(block.number + 1);
        vm.prevrandao(bytes32(uint256(keccak256(abi.encode(block.number, tokenId)))));
        vm.prank(who);
        return g.startRun(tokenId);
    }

    function test_startReadsTheHamstersMood() public {
        _settle(10, 0);
        _settle(16, 60); // last 6 rounds: 360 work => Zoomies
        (uint256 runId,) = _start(game, alice, 2);
        SqueekDelve.Run memory r = game.run(runId);
        assertEq(r.mood, 3);
        assertEq(r.work, 360);
        assertEq(r.level, 9);
        assertEq(r.progress.floor, 1);
        assertEq(r.progress.maxHp, 37); // 10 + 3 * level 9
        assertEq(r.progress.atk, 5); // 1 + level 9 / 2
        assertEq(r.rarity, 0); // unrevealed mock collection: no trait bonuses
        _settle(30, 0); // hamster slept
        (uint256 run2,) = _start(game, alice, 2);
        assertEq(game.run(run2).mood, 0);
    }

    function test_higherLevelStartsStronger() public {
        nft.mint(alice, 50, 2);
        (DelveRules.Progress memory l1,,,) = game.delverStats(1);
        (DelveRules.Progress memory l2,,,) = game.delverStats(50);
        assertGt(l2.maxHp, l1.maxHp);
        assertGt(l2.crit, l1.crit);
    }

    /// Real traitWords: Squeek #2 (a pair of Clovers) and a Legendary four-of-a-kind Squeek.
    function test_traitsGiveEachSqueekItsOwnStats() public {
        string memory json = vm.readFile("test/fixtures/genes.json");
        MockRenderer renderer = new MockRenderer();
        nft.reveal(address(renderer));
        uint256 legendary;
        for (uint256 i; legendary == 0; ++i) {
            string memory k = string.concat(".genes[", vm.toString(i), "]");
            if (vm.parseJsonUint(json, string.concat(k, ".tier")) == 4) {
                legendary = vm.parseUint(vm.parseJsonString(json, string.concat(k, ".word")));
            }
        }
        renderer.setWord(1, 0x0000000000000000000000e57ad73659bbf925010005000c000c0903010b0b01); // Squeek #2's traits
        renderer.setWord(3, legendary);
        nft.mint(bob, 3, 1);

        (DelveRules.Progress memory a, uint8 ra, uint8 ha, uint256 wa) = game.delverStats(1);
        (DelveRules.Progress memory b, uint8 rb,,) = game.delverStats(3);
        assertEq(wa, 0x0000000000000000000000e57ad73659bbf925010005000c000c0903010b0b01);
        assertEq(ra, 1); // Uncommon: one pair
        assertEq(ha, 1);
        assertEq(rb, 4); // Legendary
        assertEq(a.maxHp, 25); // 13 base + 12 from traits
        assertEq(a.crit, 25); // 6 base + 19 from traits
        assertEq(a.luck, 4);
        assertGt(b.maxHp + b.atk * 5 + int256(b.crit + b.dodge), a.maxHp + a.atk * 5 + int256(a.crit + a.dodge));

        (uint256 runId,) = _start(game, alice, 1);
        SqueekDelve.Run memory r = game.run(runId);
        assertEq(r.rarity, 1);
        assertEq(r.progress.maxHp, 25);
        assertEq(r.progress.hp, 25);
    }

    function test_everyRunGetsItsOwnSeed() public {
        (, uint32 s0) = _start(game, alice, 1);
        (, uint32 s1) = _start(game, alice, 1);
        (, uint32 s2) = _start(game, alice, 2);
        assertTrue(s0 != s1 && s1 != s2 && s0 != s2);
    }

    function test_holderOnlyAndOwnRuns() public {
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(SqueekDelve.NotSqueekHolder.selector, 1));
        game.startRun(1);
        (uint256 runId,) = _start(game, carol, 4); // staked Squeeks play
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SqueekDelve.NotYourRun.selector, runId));
        game.advance(runId, hex"01");
        vm.prank(carol);
        game.advance(runId, hex"01");
    }

    function test_threeRunsPerSeason() public {
        for (uint256 i; i < 3; ++i) {
            _start(game, alice, 1);
        }
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SqueekDelve.OutOfRuns.selector, 1));
        game.startRun(1);
        vm.warp(block.timestamp + 1 days); // next season
        _start(game, alice, 1);
        assertEq(game.runsStarted(1, 1), 1);
    }

    function test_checkpointsAccumulate() public {
        (uint256 runId,) = _start(game, alice, 1);
        vm.startPrank(alice);
        game.advance(runId, hex"0a0a0a"); // floors 1->4, 30 seeds
        DelveRules.Progress memory p = game.advance(runId, hex"14"); // floor 5, +20 seeds
        vm.stopPrank();
        assertEq(p.floor, 5);
        assertEq(p.gold, 50);
        SqueekDelve.Run memory r = game.run(runId);
        assertEq(r.score, 50 + 50 * 4); // seeds + 50 per floor descended
        assertEq(game.progressOf(runId).floor, 5);
        assertEq(game.record(1).deepest, 5);
        assertEq(game.bestOf(0, 1).score, r.score);
    }

    function test_overAndExpired() public {
        (uint256 runId,) = _start(game, alice, 1);
        vm.startPrank(alice);
        vm.expectRevert(SqueekDelve.EmptyTape.selector);
        game.advance(runId, "");
        game.advance(runId, hex"05ff"); // one floor, then dies
        vm.expectRevert(abi.encodeWithSelector(SqueekDelve.RunOver.selector, runId));
        game.advance(runId, hex"01");
        vm.stopPrank();

        (uint256 run2,) = _start(game, alice, 1);
        vm.warp(block.timestamp + 2 days);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SqueekDelve.RunExpired.selector, run2));
        game.advance(run2, hex"01");
    }

    function test_victoryAndRecords() public {
        (uint256 runId,) = _start(game, alice, 2);
        bytes memory tape = new bytes(200);
        for (uint256 i; i < 200; ++i) {
            tape[i] = bytes1(uint8(1));
        }
        vm.prank(alice);
        DelveRules.Progress memory p = game.advance(runId, tape);
        assertTrue(p.won);
        SqueekDelve.Record memory rec = game.record(2);
        assertEq(rec.victories, 1);
        assertEq(rec.deepest, 200);
        assertEq(rec.bossKills, 20);
    }

    function test_boardsSortCapAndKeepBestPerSqueek() public {
        for (uint256 i; i < 12; ++i) {
            address p = address(uint160(0x1000 + i));
            nft.mint(p, 100 + i, 1);
            (uint256 runId,) = _start(game, p, 100 + i);
            vm.prank(p);
            game.advance(runId, abi.encodePacked(uint8(10 + i)));
        }
        (uint256[] memory ids, SqueekDelve.Best[] memory bests) = game.leaderboard(0);
        assertEq(ids.length, 10);
        assertEq(ids[0], 111);
        for (uint256 i = 1; i < 10; ++i) {
            assertGe(bests[i - 1].score, bests[i].score);
        }
        (uint256[] memory all,) = game.allTimeBoard();
        assertEq(all[0], 111);

        // A worse second run doesn't replace a Squeek's best.
        (uint256 again,) = _start(game, address(0x1000 + 11), 111);
        vm.prank(address(0x1000 + 11));
        game.advance(again, hex"fe");
        assertEq(game.bestOf(0, 111).score, bests[0].score);
    }

    function test_crownAfterSeasonSettles() public {
        (uint256 runId,) = _start(game, alice, 1);
        vm.prank(alice);
        game.advance(runId, hex"30");
        vm.expectRevert(abi.encodeWithSelector(SqueekDelve.SeasonNotSettled.selector, 0));
        game.crown(0);
        vm.warp(game.seasonEndsAt(0) + 2 days);
        game.crown(0);
        assertEq(game.record(1).crowns, 1);
        vm.expectRevert(abi.encodeWithSelector(SqueekDelve.AlreadyCrowned.selector, 0));
        game.crown(0);
    }

    /// Real rules, real tapes: the run recorded by tools/parity.mjs for this exact seed is
    /// checkpointed through SqueekDelve in the same chunks the game client would send.
    function test_integrationWithRealRules() public {
        string memory json = vm.readFile("test/fixtures/parity.json");
        _settle(6, 5); // 30 work in the window: a Potter burrow, as recorded
        vm.roll(500);
        vm.prevrandao(bytes32(uint256(0xbeef)));
        vm.setBlockhash(499, bytes32(uint256(0xcafe)));
        vm.prank(alice);
        (uint256 runId, uint32 seed) = real.startRun(2);
        assertEq(seed, vm.parseJsonUint(json, ".integration.seed"), "seed derivation");

        bytes[] memory chunks = vm.parseJsonBytesArray(json, ".integration.chunks");
        DelveRules.Progress memory p;
        for (uint256 c; c < chunks.length; ++c) {
            vm.prank(alice);
            p = real.advance(runId, chunks[c]);
        }
        DelveRules.Progress memory want = ProgressJson.read(json, ".integration.final");
        assertEq(abi.encode(p), abi.encode(want), "final progress");
        assertEq(real.run(runId).score, vm.parseJsonUint(json, ".integration.score"));
        assertEq(abi.encode(real.progressOf(runId)), abi.encode(want), "stored progress");
    }
}
