// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SqueekOfTheHill} from "../src/SqueekOfTheHill.sol";
import {ISqueekCore, ISqueekNFT, ISqueekStaking} from "../src/interfaces/ISqueekchain.sol";

/// forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --account <keystore> --broadcast
contract Deploy is Script {
    // From https://docs.squeekchain.com/assets/deployments/sepolia.json
    address constant CORE = 0xFD6C166D4B8E2962E65746a13e5a0797CD4dE0c4;
    address constant NFT = 0xC4C7982657f00509548F3a3a41db7FA439a6856B;
    address constant STAKING = 0x50fd1780526C3186A0c037c7622203bC4fb611ca;

    function run() external returns (SqueekOfTheHill game) {
        require(block.chainid == 11155111, "Sepolia only");
        vm.startBroadcast();
        game = new SqueekOfTheHill(ISqueekCore(CORE), ISqueekNFT(NFT), ISqueekStaking(STAKING));
        vm.stopBroadcast();
        console.log("SqueekOfTheHill deployed at", address(game));
    }
}
