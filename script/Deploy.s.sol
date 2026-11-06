// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SqueekDelve} from "../src/SqueekDelve.sol";
import {DelveRules} from "../src/DelveRules.sol";
import {ISqueekCore, ISqueekNFT, ISqueekStaking} from "../src/interfaces/ISqueekchain.sol";

/// forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL --account <keystore> --broadcast
contract Deploy is Script {
    // From https://docs.squeekchain.com/assets/deployments/sepolia.json
    address constant CORE = 0xfd6C166d4b8e2962e65746A13e5A0797cd4De0C4;
    address constant NFT = 0xc4C7982657F00509548f3A3A41Db7fA439a6856b;
    address constant STAKING = 0x50fD1780526C3186A0C037C7622203bC4fb611CA;

    function run() external returns (SqueekDelve game) {
        require(block.chainid == 11155111, "Sepolia only");
        vm.startBroadcast();
        DelveRules rules = new DelveRules();
        game = new SqueekDelve(ISqueekCore(CORE), ISqueekNFT(NFT), ISqueekStaking(STAKING), rules);
        vm.stopBroadcast();
        console.log("DelveRules deployed at", address(rules));
        console.log("SqueekDelve deployed at", address(game));
    }
}
