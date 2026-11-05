// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SqueekSeers} from "../src/SqueekSeers.sol";
import {ISqueekCore, ISqueekNFT, ISqueekStaking} from "../src/interfaces/ISqueekchain.sol";

/// @notice Runs against the live Sepolia deployment when SEPOLIA_RPC_URL is set.
contract SqueekSeersForkTest is Test {
    // From https://docs.squeekchain.com/assets/deployments/sepolia.json
    address constant CORE = 0xFD6C166D4B8E2962E65746a13e5a0797CD4dE0c4;
    address constant NFT = 0xC4C7982657f00509548F3a3a41db7FA439a6856B;
    address constant STAKING = 0x50fd1780526C3186A0c037c7622203bC4fb611ca;

    SqueekSeers game;
    bool live;

    function setUp() public {
        string memory rpc = vm.envOr("SEPOLIA_RPC_URL", string(""));
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);
        live = true;
        game = new SqueekSeers(ISqueekCore(CORE), ISqueekNFT(NFT), ISqueekStaking(STAKING));
    }

    function test_fork_resolvesSettledRoundsFromCore() public {
        if (!live) return;
        ISqueekCore.CoreState memory st = ISqueekCore(CORE).state();
        assertGe(game.currentRound(), st.settledThroughRound);

        // Sum of resolved per-round work must equal SqueekCore's cumulative delta.
        uint64 from = st.settledThroughRound > 30 ? st.settledThroughRound - 30 : 1;
        uint256 sum;
        for (uint64 r = from; r <= st.settledThroughRound; ++r) {
            game.resolve(r);
            sum += game.getRound(r).work;
        }
        uint64 base = ISqueekCore(CORE).roundPage(from - 1, from - 1, 0).end.cumulativeWork;
        assertEq(sum, st.cumulativeWork - base);

        vm.expectRevert();
        game.resolve(st.settledThroughRound + 1);
    }

    function test_fork_realHolderCanPlay() public {
        if (!live) return;
        address holder = ISqueekNFT(NFT).ownerOf(1);
        assertTrue(game.canPlay(holder, 1));
        assertFalse(game.canPlay(address(0xBEEF), 1));
        uint256[] memory ids = new uint256[](1);
        ids[0] = 1;
        uint64 next = game.currentRound() + 1;
        vm.prank(holder);
        game.predict(ids, next, 0);
        assertEq(game.getRound(next).total, 1);
    }
}
