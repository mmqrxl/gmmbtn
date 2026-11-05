// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SqueekOfTheHill} from "../src/SqueekOfTheHill.sol";
import {ISqueekCore, ISqueekNFT, ISqueekStaking} from "../src/interfaces/ISqueekchain.sol";
import {MockCore, MockNFT, MockStaking} from "./mocks/Mocks.sol";

contract SqueekOfTheHillTest is Test {
    MockCore core;
    MockNFT nft;
    MockStaking staking;
    SqueekOfTheHill game;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address carol = makeAddr("carol");
    uint64 constant GENESIS = 1_000_000;

    function setUp() public {
        _goRound(1);
        core = new MockCore(GENESIS);
        nft = new MockNFT();
        staking = new MockStaking();
        game =
            new SqueekOfTheHill(ISqueekCore(address(core)), ISqueekNFT(address(nft)), ISqueekStaking(address(staking)));
        nft.mint(alice, 1, 1);
        nft.mint(alice, 2, 3);
        nft.mint(bob, 3, 1);
        nft.mint(address(staking), 4, 2); // carol's, deposited in staking
        staking.setDepositor(address(nft), 4, carol);
    }

    function _goRound(uint64 r) internal {
        vm.warp(GENESIS + (r - 1) * 600 + 1);
    }

    /// Settle rounds up to `through`, giving `work` to each round in (from, through].
    function _settle(uint64 through, uint64 work) internal {
        while (core.settled() < through) core.settle(core.settled() + 1, work);
    }

    function test_firstSeize() public {
        vm.prank(alice);
        uint256 id = game.seize(1);
        assertEq(id, 0);
        SqueekOfTheHill.Reign memory r = game.reign(0);
        assertEq(r.tokenId, 1);
        assertEq(r.startRound, 2); // earns from the next round
        assertEq(r.shieldUntilRound, 3); // level 1
        assertEq(r.endRound, 0);
        assertEq(game.kingTokenId(), 1);
    }

    function test_holderOnly() public {
        assertTrue(game.canPlay(carol, 4)); // staked Squeeks play
        assertFalse(game.canPlay(alice, 4));
        assertFalse(game.canPlay(alice, 999));
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(SqueekOfTheHill.NotSqueekHolder.selector, 1));
        game.seize(1);
    }

    function test_shieldScalesWithLevel() public {
        vm.prank(alice);
        game.seize(2); // level 3: start 2, shield until 5
        _goRound(4);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(SqueekOfTheHill.Shielded.selector, 5, 4));
        game.seize(3);
        _goRound(5);
        vm.prank(bob);
        game.seize(3);
        SqueekOfTheHill.Reign memory old = game.reign(0);
        assertEq(old.endRound, 5);
        assertEq(game.squeek(2).roundsHeld, 4); // rounds 2..5
        assertEq(game.reign(1).startRound, 6);
    }

    function test_cannotSeizeFromYourself() public {
        vm.prank(alice);
        game.seize(1);
        _goRound(5);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SqueekOfTheHill.AlreadyKing.selector, 1));
        game.seize(2);
    }

    function test_dethronedSqueekRests() public {
        vm.prank(alice);
        game.seize(1);
        _goRound(3);
        vm.prank(bob);
        game.seize(3); // alice's #1 rests until round 9
        _goRound(5); // past bob's shield
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SqueekOfTheHill.Resting.selector, 1, 9));
        game.seize(1);
        vm.prank(alice);
        game.seize(2); // a different Squeek can still climb
        assertEq(game.kingTokenId(), 2);
    }

    function test_creditsOnlyRealWorkInReign() public {
        _settle(1, 999); // work before the reign never counts
        vm.prank(alice);
        game.seize(1); // reign starts round 2
        _goRound(3);
        vm.prank(bob);
        game.seize(3); // alice's reign: rounds 2..3; bob's from 4

        _settle(2, 40);
        assertEq(game.credit(0), 40); // round 2 only, round 3 not certified yet
        vm.expectRevert(abi.encodeWithSelector(SqueekOfTheHill.NothingToCredit.selector, 0, 2, 2));
        game.credit(0);

        _settle(6, 100); // rounds 3..6 at 100 each
        assertEq(game.credit(0), 100); // round 3, then the reign ended
        assertEq(game.credit(1), 300); // bob: rounds 4..6, still reigning
        _settle(7, 7);
        assertEq(game.credit(1), 7);

        assertEq(game.squeek(1).points, 140);
        assertEq(game.squeek(3).points, 307);
        assertEq(game.reign(1).work, 307);
        assertEq(game.squeek(3).bestReignWork, 307);

        (uint256[] memory ids, uint64[] memory pts) = game.leaderboard();
        assertEq(ids.length, 2);
        assertEq(ids[0], 3);
        assertEq(pts[0], 307);
        assertEq(ids[1], 1);
    }

    function test_creditBeforeSettlementReverts() public {
        vm.prank(alice);
        game.seize(1);
        assertFalse(game.creditable(0));
        vm.expectRevert(abi.encodeWithSelector(SqueekOfTheHill.NothingToCredit.selector, 0, 1, 0));
        game.credit(0);
        vm.expectRevert(abi.encodeWithSelector(SqueekOfTheHill.UnknownReign.selector, 5));
        game.credit(5);
    }

    function test_creditManySkipsEmpty() public {
        vm.prank(alice);
        game.seize(1);
        _goRound(3);
        vm.prank(carol);
        game.seize(4);
        _settle(3, 10);
        uint256[] memory ids = new uint256[](3);
        (ids[0], ids[1], ids[2]) = (0, 1, 7);
        game.creditMany(ids);
        assertEq(game.squeek(1).points, 20);
        assertEq(game.squeek(4).points, 0); // carol's reign starts at round 4
    }

    function test_pointsStayWithSqueekAfterTransfer() public {
        vm.prank(alice);
        game.seize(1);
        nft.transfer(1, bob);
        _settle(3, 5);
        game.credit(0);
        assertEq(game.squeek(1).points, 10);
        // Bob now controls the king, so he can't seize from it either.
        _goRound(5);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(SqueekOfTheHill.AlreadyKing.selector, 1));
        game.seize(3);
    }

    function test_recentReignsAndBadge() public {
        vm.prank(alice);
        game.seize(1);
        _goRound(3);
        vm.prank(bob);
        game.seize(3);
        (uint256[] memory ids, SqueekOfTheHill.Reign[] memory list) = game.recentReigns(5);
        assertEq(ids.length, 2);
        assertEq(ids[0], 1);
        assertEq(list[0].tokenId, 3);
        assertEq(list[1].endRound, 3);
        string memory uri = game.badgeURI(3);
        assertGt(bytes(uri).length, 100);
    }

    function test_leaderboardCapsAndSorts() public {
        // 12 Squeeks reign one after another; reign i earns (i+1) rounds of work at 10 each.
        uint64 round = 1;
        for (uint256 i; i < 12; ++i) {
            address p = address(uint160(0x1000 + i));
            nft.mint(p, 100 + i, 1);
            _goRound(round);
            vm.prank(p);
            game.seize(100 + i);
            round += 2;
        }
        _settle(round, 10);
        for (uint256 i; i < 12; ++i) {
            game.credit(i);
        }
        (uint256[] memory ids, uint64[] memory pts) = game.leaderboard();
        assertEq(ids.length, 10);
        for (uint256 i = 1; i < 10; ++i) {
            assertGe(pts[i - 1], pts[i]);
        }
    }
}
