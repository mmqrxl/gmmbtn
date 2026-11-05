// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ISqueekCore} from "../../src/interfaces/ISqueekchain.sol";

contract MockCore {
    uint64 public genesis;
    uint64 public settled;
    mapping(uint64 => uint64) public cumWork; // cumulative work after each round

    constructor(uint64 genesis_) {
        genesis = genesis_;
    }

    function settle(uint64 round, uint64 work) external {
        require(round == settled + 1, "order");
        cumWork[round] = cumWork[round - 1] + work;
        settled = round;
    }

    function state() external view returns (ISqueekCore.CoreState memory s) {
        s.settledThroughRound = settled;
        s.cumulativeWork = cumWork[settled];
    }

    function configuration() external view returns (ISqueekCore.CoreConfiguration memory c) {
        c.genesisTimestamp = genesis;
        c.roundDuration = 600;
        c.blockUnitsPerBlock = 1e9;
    }

    function roundPage(uint64 afterRound, uint64 throughRound, uint256)
        external
        view
        returns (ISqueekCore.RoundPage memory p)
    {
        require(afterRound <= throughRound && throughRound <= settled, "InvalidRoundPageBounds");
        p.certifiedThroughRound = throughRound;
        p.start.cumulativeWork = cumWork[afterRound];
        p.end.cumulativeWork = cumWork[throughRound];
    }
}

contract MockNFT {
    mapping(uint256 => address) public owners;
    mapping(uint256 => uint8) public levels;

    function mint(address to, uint256 id, uint8 lvl) external {
        owners[id] = to;
        levels[id] = lvl;
    }

    function transfer(uint256 id, address to) external {
        owners[id] = to;
    }

    function burn(uint256 id) external {
        delete owners[id];
    }

    function ownerOf(uint256 id) external view returns (address o) {
        o = owners[id];
        require(o != address(0), "ERC721NonexistentToken");
    }

    function level(uint256 id) external view returns (uint8) {
        require(owners[id] != address(0), "ERC721NonexistentToken");
        return levels[id];
    }
}

contract MockStaking {
    mapping(address => mapping(uint256 => address)) public depositor;

    function setDepositor(address collection, uint256 id, address who) external {
        depositor[collection][id] = who;
    }
}
