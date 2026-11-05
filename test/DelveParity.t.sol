// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SqueekDelve} from "../src/SqueekDelve.sol";
import {DelveEngine} from "../src/DelveEngine.sol";
import {ISqueekCore, ISqueekNFT, ISqueekStaking} from "../src/interfaces/ISqueekchain.sol";

/// @notice Replays runs recorded by the JS engine (tools/parity.mjs) and requires identical results.
contract DelveParityTest is Test {
    SqueekDelve game;
    string json;

    function setUp() public {
        game = new SqueekDelve(ISqueekCore(address(1)), ISqueekNFT(address(2)), ISqueekStaking(address(3)));
        json = vm.readFile("test/fixtures/parity.json");
    }


    function _count(string memory key) internal view returns (uint256 n) {
        while (vm.keyExistsJson(json, string.concat(key, "[", vm.toString(n), "]"))) ++n;
    }

    function test_runsMatchJsEngine() public view {
        uint256 n = _count(".cases");
        assertGt(n, 100);
        for (uint256 i; i < n; ++i) {
            string memory k = string.concat(".cases[", vm.toString(i), "]");
            uint32 seed = uint32(vm.parseJsonUint(json, string.concat(k, ".seed")));
            uint8 level = uint8(vm.parseJsonUint(json, string.concat(k, ".level")));
            uint8 mood = uint8(vm.parseJsonUint(json, string.concat(k, ".mood")));
            bytes memory tape = vm.parseJsonBytes(json, string.concat(k, ".tape"));
            DelveEngine.Result memory r = game.simulate(seed, level, mood, tape);
            assertEq(r.score, vm.parseJsonUint(json, string.concat(k, ".score")), string.concat(k, " score"));
            assertEq(r.floor, vm.parseJsonUint(json, string.concat(k, ".floor")), string.concat(k, " floor"));
            assertEq(r.kills, vm.parseJsonUint(json, string.concat(k, ".kills")), string.concat(k, " kills"));
            assertEq(r.gold, vm.parseJsonUint(json, string.concat(k, ".gold")), string.concat(k, " gold"));
            assertEq(r.hp, vm.parseJsonUint(json, string.concat(k, ".hp")), string.concat(k, " hp"));
            assertEq(r.turns, vm.parseJsonUint(json, string.concat(k, ".turns")), string.concat(k, " turns"));
            assertEq(r.won, vm.parseJsonBool(json, string.concat(k, ".won")), string.concat(k, " won"));
            assertEq(r.dead, vm.parseJsonBool(json, string.concat(k, ".dead")), string.concat(k, " dead"));
        }
    }

    function test_layoutsMatchJsEngine() public view {
        uint256 n = _count(".layouts");
        for (uint256 i; i < n; ++i) {
            string memory k = string.concat(".layouts[", vm.toString(i), "]");
            (uint256 open, int256 sx, int256 sy, int256[] memory enemies, int256[] memory items) = game.floorLayout(
                uint32(vm.parseJsonUint(json, string.concat(k, ".seed"))),
                uint8(vm.parseJsonUint(json, string.concat(k, ".floor"))),
                uint8(vm.parseJsonUint(json, string.concat(k, ".mood")))
            );
            assertEq(open, vm.parseUint(vm.parseJsonString(json, string.concat(k, ".open"))), string.concat(k, " open"));
            assertEq(sx, vm.parseJsonInt(json, string.concat(k, ".sx")));
            assertEq(sy, vm.parseJsonInt(json, string.concat(k, ".sy")));
            assertEq(enemies, vm.parseJsonIntArray(json, string.concat(k, ".enemies")), string.concat(k, " enemies"));
            assertEq(items, vm.parseJsonIntArray(json, string.concat(k, ".items")), string.concat(k, " items"));
        }
    }

    function test_longestRunGas() public {
        // A full 600-action tape must stay far below Sepolia's block gas limit.
        bytes memory tape = new bytes(600);
        for (uint256 i; i < 600; ++i) {
            tape[i] = bytes1(uint8(4)); // wait: every enemy acts every turn
        }
        uint256 g = gasleft();
        game.simulate(123456, 10, 3, tape);
        uint256 used = g - gasleft();
        emit log_named_uint("gas for 600-turn replay", used);
        assertLt(used, 15_000_000);
    }

    function test_tapeTooLongReverts() public {
        vm.expectRevert(abi.encodeWithSelector(DelveEngine.TapeTooLong.selector, 601));
        game.simulate(1, 1, 1, new bytes(601));
    }
}
