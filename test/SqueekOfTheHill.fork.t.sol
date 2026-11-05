// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SqueekOfTheHill} from "../src/SqueekOfTheHill.sol";
import {ISqueekCore, ISqueekNFT, ISqueekStaking} from "../src/interfaces/ISqueekchain.sol";

/// @notice Runs against the live Sepolia deployment when SEPOLIA_RPC_URL is set.
contract SqueekOfTheHillForkTest is Test {
    // From https://docs.squeekchain.com/assets/deployments/sepolia.json
    address constant CORE = 0xFD6C166D4B8E2962E65746a13e5a0797CD4dE0c4;
    address constant NFT = 0xC4C7982657f00509548F3a3a41db7FA439a6856B;
    address constant STAKING = 0x50fd1780526C3186A0c037c7622203bC4fb611ca;

    SqueekOfTheHill game;
    bool live;

    function setUp() public {
        string memory rpc = vm.envOr("SEPOLIA_RPC_URL", string(""));
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);
        live = true;
        game = new SqueekOfTheHill(ISqueekCore(CORE), ISqueekNFT(NFT), ISqueekStaking(STAKING));
    }

    function test_fork_workBetweenMatchesCore() public {
        if (!live) return;
        ISqueekCore.CoreState memory st = ISqueekCore(CORE).state();
        assertGe(game.currentRound(), st.settledThroughRound);
        assertEq(game.workBetween(0, st.settledThroughRound), st.cumulativeWork);
        vm.expectRevert();
        game.workBetween(0, st.settledThroughRound + 1);
    }

    function test_fork_realHolderSeizes() public {
        if (!live) return;
        address holder = ISqueekNFT(NFT).ownerOf(1);
        vm.prank(holder);
        game.seize(1);
        assertEq(game.kingTokenId(), 1);
        assertEq(game.reign(0).startRound, game.currentRound() + 1);
        assertEq(game.reign(0).shieldUntilRound, game.currentRound() + 1 + ISqueekNFT(NFT).level(1));
        // Nothing certified yet for a reign that starts next round.
        assertFalse(game.creditable(0));

        vm.prank(address(0xBEEF));
        vm.expectRevert(abi.encodeWithSelector(SqueekOfTheHill.NotSqueekHolder.selector, 2));
        game.seize(2);
    }
}
