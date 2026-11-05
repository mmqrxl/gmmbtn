// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Renders a Squeek's hill record as an onchain JSON + SVG data URI.
library HillBadge {
    bytes internal constant B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    struct Data {
        uint256 tokenId;
        uint64 points;
        uint32 reigns;
        uint64 roundsHeld;
        uint64 bestReignWork;
        uint256 rank;
        bool isKing;
    }

    function title(uint64 points, bool isKing) internal pure returns (string memory) {
        if (isKing) return "Keeper of the Seed";
        if (points >= 5_000) return "Hill Legend";
        if (points >= 1_000) return "Seed Baron";
        if (points > 0) return "Hill Climber";
        return "Foothill Squeek";
    }

    function uri(Data memory d) internal pure returns (string memory) {
        string memory t = title(d.points, d.isKing);
        bytes memory json = abi.encodePacked(
            '{"name":"Squeek #',
            toString(d.tokenId),
            ' Hill Badge","description":"Squeek of the Hill record for Squeek #',
            toString(d.tokenId),
            ', earned from real hamster work certified by SqueekCore on Sepolia.","attributes":[{"trait_type":"Title","value":"',
            t,
            '"},{"trait_type":"Points","value":',
            toString(d.points),
            '},{"trait_type":"Reigns","value":',
            toString(d.reigns),
            '},{"trait_type":"Rounds held","value":',
            toString(d.roundsHeld),
            '},{"trait_type":"Best reign","value":',
            toString(d.bestReignWork),
            "}]",
            ',"image":"data:image/svg+xml;base64,',
            encode(bytes(_svg(d, t))),
            '"}'
        );
        return string(abi.encodePacked("data:application/json;base64,", encode(json)));
    }

    function _svg(Data memory d, string memory t) private pure returns (string memory) {
        // The hill grows with points; the Seed sits on top only for the current king.
        uint256 h = d.points >= 5_000 ? 120 : 40 + (uint256(d.points) * 80) / 5_000;
        uint256 top = 200 - h;
        return string(
            abi.encodePacked(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320">',
                '<rect width="320" height="320" rx="24" fill="#1A1A20"/>',
                '<path d="M20 200Q160 ',
                toString(top > 40 ? top - 40 : 0),
                ' 300 200Z" fill="#3B6E4A"/>',
                _hamster(top),
                d.isKing ? _seed(top) : bytes(""),
                _text(d, t),
                "</svg>"
            )
        );
    }

    function _hamster(uint256 top) private pure returns (bytes memory) {
        string memory y = toString(top + 8);
        return abi.encodePacked(
            '<g transform="translate(160 ',
            y,
            ')"><ellipse cy="0" rx="22" ry="16" fill="#E8B07A"/><circle cx="-12" cy="-12" r="7" fill="#E8B07A"/>',
            '<circle cx="12" cy="-12" r="7" fill="#E8B07A"/><circle cx="-7" cy="-2" r="2.5" fill="#1A1A20"/>',
            '<circle cx="7" cy="-2" r="2.5" fill="#1A1A20"/></g>'
        );
    }

    function _seed(uint256 top) private pure returns (bytes memory) {
        string memory y = toString(top > 30 ? top - 30 : 0);
        return abi.encodePacked(
            '<g transform="translate(160 ',
            y,
            ')"><ellipse rx="9" ry="13" fill="#F5C451"><animate attributeName="opacity" values="1;.55;1" dur="2s" repeatCount="indefinite"/></ellipse>',
            '<path d="M0-13V13" stroke="#B8892B" stroke-width="1.5"/></g>'
        );
    }

    function _text(Data memory d, string memory t) private pure returns (bytes memory) {
        return abi.encodePacked(
            '<g font-family="monospace" fill="#EDEDED" text-anchor="middle">',
            '<text x="160" y="232" font-size="18" fill="#F5C451">',
            t,
            "</text>",
            '<text x="160" y="256" font-size="13">Squeek #',
            toString(d.tokenId),
            d.rank == 0 ? "" : string(abi.encodePacked("  |  Rank #", toString(d.rank))),
            "</text>",
            '<text x="160" y="278" font-size="13">',
            toString(d.points),
            " pts  |  ",
            toString(d.reigns),
            " reigns</text>",
            '<text x="160" y="298" font-size="11" opacity=".7">',
            toString(d.roundsHeld),
            " rounds held  |  best ",
            toString(d.bestReignWork),
            "</text></g>"
        );
    }

    function toString(uint256 v) internal pure returns (string memory) {
        if (v == 0) return "0";
        uint256 len;
        for (uint256 t = v; t != 0; t /= 10) {
            ++len;
        }
        bytes memory out = new bytes(len);
        while (v != 0) {
            out[--len] = bytes1(uint8(48 + (v % 10)));
            v /= 10;
        }
        return string(out);
    }

    function encode(bytes memory data) internal pure returns (string memory) {
        if (data.length == 0) return "";
        bytes memory out = new bytes(4 * ((data.length + 2) / 3));
        uint256 j;
        for (uint256 i; i < data.length; i += 3) {
            uint256 a = uint8(data[i]);
            uint256 b = i + 1 < data.length ? uint8(data[i + 1]) : 0;
            uint256 c = i + 2 < data.length ? uint8(data[i + 2]) : 0;
            uint256 n = (a << 16) | (b << 8) | c;
            out[j++] = B64[(n >> 18) & 63];
            out[j++] = B64[(n >> 12) & 63];
            out[j++] = i + 1 < data.length ? B64[(n >> 6) & 63] : bytes1("=");
            out[j++] = i + 2 < data.length ? B64[n & 63] : bytes1("=");
        }
        return string(out);
    }
}
