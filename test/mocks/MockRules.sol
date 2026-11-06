// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {DelveRules} from "../../src/DelveRules.sol";

/// @dev Rules stand-in for SqueekDelve unit tests: each tape byte descends one floor and adds its
///      value as seeds; 0xFF kills the delver, 0xFE flees. Real rules are covered by the parity tests.
contract MockRules is DelveRules {
    function advance(uint32, uint8, Progress calldata start, bytes calldata tape)
        external
        pure
        override
        returns (Progress memory p)
    {
        p = start;
        for (uint256 i; i < tape.length; ++i) {
            uint8 b = uint8(tape[i]);
            if (b == 0xFF) {
                p.dead = true;
                break;
            }
            if (b == 0xFE) {
                p.fled = true;
                break;
            }
            ++p.floor;
            p.gold += b;
            if (p.floor % 10 == 1) ++p.bossKills;
            if (p.floor > FLOORS) {
                p.floor = FLOORS;
                p.won = true;
                break;
            }
        }
    }
}
