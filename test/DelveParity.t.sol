// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {DelveRules} from "../src/DelveRules.sol";
import {ProgressJson} from "./ProgressJson.sol";

/// @notice Replays runs recorded by the JS engine (tools/parity.mjs) checkpoint by checkpoint and
///         requires identical results.
contract DelveParityTest is Test {
    DelveRules rules;

    function setUp() public {
        rules = new DelveRules();
    }

    /// @dev Every cheatcode call copies the whole fixture into fresh memory, so loops rewind the
    ///      free-memory pointer after each case; otherwise memory grows past the EVM limit.
    function _mark() internal pure returns (uint256 m) {
        assembly {
            m := mload(0x40)
        }
    }

    function _rewind(uint256 m) internal pure {
        assembly {
            mstore(0x40, m)
        }
    }

    function _count(string memory json, string memory key) internal pure returns (uint256 n) {
        while (vm.keyExistsJson(json, string.concat(key, "[", vm.toString(n), "]"))) ++n;
    }

    function _replay(string memory json, string memory k)
        internal
        view
        returns (DelveRules.Progress memory p, uint256 maxGas)
    {
        uint32 seed = uint32(vm.parseJsonUint(json, string.concat(k, ".seed")));
        uint8 mood = uint8(vm.parseJsonUint(json, string.concat(k, ".mood")));
        uint8 level = uint8(vm.parseJsonUint(json, string.concat(k, ".level")));
        if (vm.keyExistsJson(json, string.concat(k, ".start.floor"))) {
            p = ProgressJson.read(json, string.concat(k, ".start"));
        } else {
            (p,,) = rules.start(level, seed, vm.parseJsonUint(json, string.concat(k, ".word")));
        }
        bytes[] memory chunks = vm.parseJsonBytesArray(json, string.concat(k, ".chunks"));
        for (uint256 c; c < chunks.length; ++c) {
            uint256 g = gasleft();
            p = rules.advance(seed, mood, p, chunks[c]);
            uint256 used = g - gasleft();
            if (used > maxGas) maxGas = used;
        }
    }

    function test_runsMatchJsEngine() public {
        string memory json = vm.readFile("test/fixtures/parity.json");
        uint256 n = _count(json, ".cases");
        assertGt(n, 50);
        uint256 worst;
        for (uint256 i; i < n; ++i) {
            uint256 m = _mark();
            string memory k = string.concat(".cases[", vm.toString(i), "]");
            (DelveRules.Progress memory p, uint256 g) = _replay(json, k);
            DelveRules.Progress memory want = ProgressJson.read(json, string.concat(k, ".final"));
            assertEq(abi.encode(p), abi.encode(want), string.concat(k, " progress"));
            assertEq(rules.score(p), vm.parseJsonUint(json, string.concat(k, ".score")), string.concat(k, " score"));
            if (g > worst) worst = g;
            _rewind(m);
        }
        emit log_named_uint("heaviest advance() in fixtures (gas)", worst);
    }

    /// Starting stats from real Squeek traits (every Epic and Legendary plus a sample).
    function test_genesMatchJsEngine() public view {
        string memory json = vm.readFile("test/fixtures/genes.json");
        uint256 n = _count(json, ".genes");
        assertGt(n, 500);
        for (uint256 i; i < n; ++i) {
            uint256 m = _mark();
            string memory k = string.concat(".genes[", vm.toString(i), "]");
            uint256 word = vm.parseUint(vm.parseJsonString(json, string.concat(k, ".word")));
            (int256[11] memory b, uint8 tier, uint8 hand) = rules.genes(word);
            int256[] memory want = vm.parseJsonIntArray(json, string.concat(k, ".bonus"));
            for (uint256 j; j < 11; ++j) {
                assertEq(b[j], want[j], string.concat(k, " bonus"));
            }
            assertEq(tier, vm.parseJsonUint(json, string.concat(k, ".tier")), string.concat(k, " tier"));
            assertEq(hand, vm.parseJsonUint(json, string.concat(k, ".hand")), string.concat(k, " hand"));
            (DelveRules.Progress memory p,,) = rules.start(
                uint8(vm.parseJsonUint(json, string.concat(k, ".level"))),
                uint32(vm.parseJsonUint(json, string.concat(k, ".seed"))),
                word
            );
            assertEq(
                abi.encode(p),
                abi.encode(ProgressJson.read(json, string.concat(k, ".start"))),
                string.concat(k, " start")
            );
            _rewind(m);
        }
    }

    function test_layoutsMatchJsEngine() public view {
        string memory json = vm.readFile("test/fixtures/parity.json");
        uint256 n = _count(json, ".layouts");
        for (uint256 i; i < n; ++i) {
            uint256 m = _mark();
            string memory k = string.concat(".layouts[", vm.toString(i), "]");
            (
                uint256[] memory open,
                uint256 style,
                int256[6] memory geo,
                int256[] memory enemies,
                int256[] memory items,
                bytes memory traps
            ) = rules.floorLayout(
                uint32(vm.parseJsonUint(json, string.concat(k, ".seed"))),
                uint16(vm.parseJsonUint(json, string.concat(k, ".floor"))),
                uint8(vm.parseJsonUint(json, string.concat(k, ".mood")))
            );
            string[] memory words = vm.parseJsonStringArray(json, string.concat(k, ".open"));
            assertEq(open.length, words.length, string.concat(k, " words"));
            for (uint256 w; w < words.length; ++w) {
                assertEq(open[w], vm.parseUint(words[w]), string.concat(k, " open"));
            }
            assertEq(style, vm.parseJsonUint(json, string.concat(k, ".style")), string.concat(k, " style"));
            int256[] memory want = vm.parseJsonIntArray(json, string.concat(k, ".geo"));
            for (uint256 j; j < 6; ++j) {
                assertEq(geo[j], want[j], string.concat(k, " geo"));
            }
            assertEq(enemies, vm.parseJsonIntArray(json, string.concat(k, ".enemies")), string.concat(k, " enemies"));
            assertEq(items, vm.parseJsonIntArray(json, string.concat(k, ".items")), string.concat(k, " items"));
            assertEq(traps, vm.parseJsonBytes(json, string.concat(k, ".traps")), string.concat(k, " traps"));
            _rewind(m);
        }
    }

    function test_mustEndAtFloorBoundary() public {
        DelveRules.Progress memory p = rules.init(1, 42);
        vm.expectRevert(abi.encodeWithSelector(DelveRules.NotAtFloorBoundary.selector, 1, 3));
        rules.advance(42, 1, p, hex"040404");
        DelveRules.Progress memory q = rules.advance(42, 1, p, hex"040405"); // fleeing ends cleanly
        assertTrue(q.fled);
        vm.expectRevert(DelveRules.RunAlreadyOver.selector);
        rules.advance(42, 1, q, hex"04");
        vm.expectRevert(abi.encodeWithSelector(DelveRules.TapeTooLong.selector, 6001));
        rules.advance(42, 1, p, new bytes(6001));
    }

    /// Worst case for one floor: the biggest map with the most monsters, waiting until the cave-in
    /// kills the delver, so every monster acts on every turn.
    function test_worstCaseFloorGas() public {
        DelveRules.Progress memory p = rules.init(10, 7);
        p.floor = 179;
        p.maxHp = 2000;
        p.hp = 2000;
        p.def = 200;
        bytes memory tape = new bytes(1600);
        for (uint256 i; i < tape.length; ++i) {
            tape[i] = bytes1(uint8(4));
        }
        uint256 g = gasleft();
        DelveRules.Progress memory q = rules.advance(7, 3, p, tape);
        uint256 used = g - gasleft();
        emit log_named_uint("worst-case single floor (gas)", used);
        emit log_named_uint("turns until the cave-in won", q.turn);
        assertTrue(q.dead);
    }
}
