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
    bool live;

    function setUp() public {
        string memory rpc = vm.envOr("SEPOLIA_RPC_URL", string(""));
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);
        live = true;
        game = new SqueekDelve(ISqueekCore(CORE), ISqueekNFT(NFT), ISqueekStaking(STAKING), new DelveRules());
    }

    function test_fork_startAndCheckpointWithRealSqueek() public {
        if (!live) return;
        (uint8 mood, uint64 work, uint64 settled) = game.hamsterMood();
        ISqueekCore.CoreState memory st = ISqueekCore(CORE).state();
        assertEq(settled, st.settledThroughRound);
        uint64 from = settled - 6;
        assertEq(work, st.cumulativeWork - ISqueekCore(CORE).roundPage(from, from, 0).end.cumulativeWork);

        address holder = ISqueekNFT(NFT).ownerOf(1);
        vm.prank(holder);
        (uint256 runId,) = game.startRun(1);
        SqueekDelve.Run memory r = game.run(runId);
        assertEq(r.mood, mood);
        assertEq(r.level, ISqueekNFT(NFT).level(1));

        vm.prank(holder);
        DelveRules.Progress memory p = game.advance(runId, hex"040405"); // wait twice, then flee
        assertTrue(p.fled);
        assertEq(game.record(1).runs, 1);

        vm.prank(address(0xBEEF));
        vm.expectRevert(abi.encodeWithSelector(SqueekDelve.NotSqueekHolder.selector, 2));
        game.startRun(2);
    }
}
