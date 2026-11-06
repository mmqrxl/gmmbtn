// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {DelveRules} from "../src/DelveRules.sol";

/// @notice Replays runs recorded by the JS engine (tools/parity.mjs) and requires identical results.
contract DelveParityTest is Test {
    DelveRules rules;
    string json;

    function setUp() public {
        rules = new DelveRules();
        json = vm.readFile("test/fixtures/parity.json");
    }

    function _count(string memory key) internal view returns (uint256 n) {
        while (vm.keyExistsJson(json, string.concat(key, "[", vm.toString(n), "]"))) ++n;
    }

    function _u(string memory k, string memory f) internal view returns (uint256) {
        return vm.parseJsonUint(json, string.concat(k, f));
    }

    function test_runsMatchJsEngine() public view {
        uint256 n = _count(".cases");
        assertGt(n, 150);
        for (uint256 i; i < n; ++i) {
            string memory k = string.concat(".cases[", vm.toString(i), "]");
            DelveRules.Result memory r = rules.simulate(
                uint32(_u(k, ".seed")),
                uint8(_u(k, ".level")),
                uint8(_u(k, ".mood")),
                vm.parseJsonBytes(json, string.concat(k, ".tape"))
            );
            assertEq(r.score, _u(k, ".score"), string.concat(k, " score"));
            assertEq(r.floor, _u(k, ".floor"), string.concat(k, " floor"));
            assertEq(r.kills, _u(k, ".kills"), string.concat(k, " kills"));
            assertEq(r.gold, _u(k, ".gold"), string.concat(k, " gold"));
            assertEq(r.hp, _u(k, ".hp"), string.concat(k, " hp"));
            assertEq(r.turns, _u(k, ".turns"), string.concat(k, " turns"));
            assertEq(r.weapon, _u(k, ".weapon"), string.concat(k, " weapon"));
            assertEq(r.armor, _u(k, ".armor"), string.concat(k, " armor"));
            assertEq(r.sling, _u(k, ".sling"), string.concat(k, " sling"));
            assertEq(r.won, vm.parseJsonBool(json, string.concat(k, ".won")), string.concat(k, " won"));
            assertEq(r.dead, vm.parseJsonBool(json, string.concat(k, ".dead")), string.concat(k, " dead"));
        }
    }

    function test_layoutsMatchJsEngine() public view {
        uint256 n = _count(".layouts");
        for (uint256 i; i < n; ++i) {
            string memory k = string.concat(".layouts[", vm.toString(i), "]");
            (uint256 open, uint256 style, int256[4] memory pos, int256[] memory enemies, int256[] memory items) =
                rules.floorLayout(uint32(_u(k, ".seed")), uint8(_u(k, ".floor")), uint8(_u(k, ".mood")));
            assertEq(open, vm.parseUint(vm.parseJsonString(json, string.concat(k, ".open"))), string.concat(k, " open"));
            assertEq(style, _u(k, ".style"), string.concat(k, " style"));
            int256[] memory want = vm.parseJsonIntArray(json, string.concat(k, ".pos"));
            for (uint256 j; j < 4; ++j) {
                assertEq(pos[j], want[j], string.concat(k, " pos"));
            }
            assertEq(enemies, vm.parseJsonIntArray(json, string.concat(k, ".enemies")), string.concat(k, " enemies"));
            assertEq(items, vm.parseJsonIntArray(json, string.concat(k, ".items")), string.concat(k, " items"));
        }
    }

    function test_worstCaseReplayGas() public {
        // 1000 waits on a zoomies burrow: every enemy acts every turn for the whole tape.
        bytes memory tape = new bytes(1000);
        for (uint256 i; i < 1000; ++i) {
            tape[i] = bytes1(uint8(4));
        }
        uint256 g = gasleft();
        rules.simulate(123456, 10, 3, tape);
        uint256 used = g - gasleft();
        emit log_named_uint("gas for 1000-turn replay", used);
        assertLt(used, 16_000_000);
    }

    function test_tapeTooLongReverts() public {
        vm.expectRevert(abi.encodeWithSelector(DelveRules.TapeTooLong.selector, 1001));
        rules.simulate(1, 1, 1, new bytes(1001));
    }
}
