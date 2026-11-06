// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SqueekDelve} from "../src/SqueekDelve.sol";
import {DelveRules} from "../src/DelveRules.sol";
import {ISqueekCore, ISqueekNFT, ISqueekStaking} from "../src/interfaces/ISqueekchain.sol";

/// @notice Runs against the live Sepolia deployment when SEPOLIA_RPC_URL is set.
contract SqueekDelveForkTest is Test {
    // From https://docs.squeekchain.com/assets/deployments/sepolia.json
    address constant CORE = 0xFD6C166D4B8E2962E65746a13e5a0797CD4dE0c4;
    address constant NFT = 0xC4C7982657f00509548F3a3a41db7FA439a6856B;
    address constant STAKING = 0x50fd1780526C3186A0c037c7622203bC4fb611ca;

    SqueekDelve game;
    DelveRules rules;
    bool live;

    function setUp() public {
        string memory rpc = vm.envOr("SEPOLIA_RPC_URL", string(""));
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);
        live = true;
        rules = new DelveRules();
        game = new SqueekDelve(ISqueekCore(CORE), ISqueekNFT(NFT), ISqueekStaking(STAKING), rules);
    }

    function test_fork_openStartSubmitWithRealSqueek() public {
        if (!live) return;
        game.openExpedition();
        SqueekDelve.Expedition memory ex = game.expedition(0);
        ISqueekCore.CoreState memory st = ISqueekCore(CORE).state();
        assertEq(ex.seedRound, st.settledThroughRound);
        uint64 from = st.settledThroughRound - 6;
        assertEq(ex.work, st.cumulativeWork - ISqueekCore(CORE).roundPage(from, from, 0).end.cumulativeWork);

        address holder = ISqueekNFT(NFT).ownerOf(1);
        uint8 lvl = ISqueekNFT(NFT).level(1);
        vm.prank(holder);
        (uint256 runId, uint32 seed) = game.startRun(1);
        bytes memory tape = hex"01010101020202020303030300000000";
        DelveRules.Result memory expected = rules.simulate(seed, lvl, ex.mood, tape);
        vm.prank(holder);
        DelveRules.Result memory got = game.submitRun(runId, tape);
        assertEq(got.score, expected.score);
        assertEq(game.bestOf(0, 1).level, lvl);

        vm.prank(address(0xBEEF));
        vm.expectRevert(abi.encodeWithSelector(SqueekDelve.NotSqueekHolder.selector, 2));
        game.startRun(2);
    }
}
