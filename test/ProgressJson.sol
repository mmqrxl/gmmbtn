// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Vm} from "forge-std/Vm.sol";
import {DelveRules} from "../src/DelveRules.sol";

/// @dev Reads a DelveRules.Progress written by tools/parity.mjs (numbers as decimal strings).
library ProgressJson {
    Vm private constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));

    function _u(string memory json, string memory k, string memory f) private pure returns (uint256) {
        return vm.parseUint(vm.parseJsonString(json, string.concat(k, ".", f)));
    }

    function _i(string memory json, string memory k, string memory f) private pure returns (int256) {
        return vm.parseInt(vm.parseJsonString(json, string.concat(k, ".", f)));
    }

    function _b(string memory json, string memory k, string memory f) private pure returns (bool) {
        return vm.parseJsonBool(json, string.concat(k, ".", f));
    }

    function read(string memory json, string memory k) internal pure returns (DelveRules.Progress memory p) {
        p.floor = _u(json, k, "floor");
        p.hp = _i(json, k, "hp");
        p.maxHp = _i(json, k, "maxHp");
        p.atk = _i(json, k, "atk");
        p.def = _i(json, k, "def");
        p.weapon = _u(json, k, "weapon");
        p.armor = _u(json, k, "armor");
        p.sling = _u(json, k, "sling");
        p.pebbles = _u(json, k, "pebbles");
        p.crit = _u(json, k, "crit");
        p.luck = _u(json, k, "luck");
        p.goldPct = _u(json, k, "goldPct");
        p.leech = _i(json, k, "leech");
        p.regen = _i(json, k, "regen");
        p.dodge = _u(json, k, "dodge");
        p.vision = _u(json, k, "vision");
        p.xp = _u(json, k, "xp");
        p.lvl = _u(json, k, "lvl");
        p.gold = _u(json, k, "gold");
        p.kills = _u(json, k, "kills");
        p.killScore = _u(json, k, "killScore");
        p.bossKills = _u(json, k, "bossKills");
        p.turn = _u(json, k, "turn");
        p.rng = uint32(_u(json, k, "rng"));
        p.dead = _b(json, k, "dead");
        p.fled = _b(json, k, "fled");
        p.won = _b(json, k, "won");
    }
}
