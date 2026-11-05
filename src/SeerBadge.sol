// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Renders a Squeek's seer badge as an onchain JSON + SVG data URI.
library SeerBadge {
    bytes internal constant B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    function title(uint256 points) internal pure returns (string memory) {
        if (points >= 10_000) return "Hamster Prophet";
        if (points >= 2_500) return "Wheel Whisperer";
        if (points >= 500) return "Whisker Reader";
        if (points > 0) return "Seedling Seer";
        return "Wheel Watcher";
    }

    function uri(uint256 tokenId, uint64 points, uint32 wins, uint32 played, uint32 bestStreak, uint256 rank)
        internal
        pure
        returns (string memory)
    {
        string memory t = title(points);
        string memory svg = _svg(tokenId, points, wins, played, bestStreak, rank, t);
        bytes memory json = abi.encodePacked(
            '{"name":"Squeek #',
            toString(tokenId),
            ' Seer Badge","description":"Hamster-mood prediction record for Squeek #',
            toString(tokenId),
            ', settled from SqueekCore on Sepolia.","attributes":[{"trait_type":"Title","value":"',
            t,
            '"},{"trait_type":"Points","value":',
            toString(points),
            '},{"trait_type":"Wins","value":',
            toString(wins),
            '},{"trait_type":"Played","value":',
            toString(played),
            '},{"trait_type":"Best streak","value":',
            toString(bestStreak),
            '}],"image":"data:image/svg+xml;base64,',
            encode(bytes(svg)),
            '"}'
        );
        return string(abi.encodePacked("data:application/json;base64,", encode(json)));
    }

    function _svg(
        uint256 tokenId,
        uint64 points,
        uint32 wins,
        uint32 played,
        uint32 bestStreak,
        uint256 rank,
        string memory t
    ) private pure returns (string memory) {
        // The wheel's speed scales with the seer's accuracy.
        uint256 acc = played == 0 ? 0 : (uint256(wins) * 100) / played;
        uint256 spin = 12 - (acc / 10);
        return string(
            abi.encodePacked(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320">',
                '<rect width="320" height="320" rx="24" fill="#1A1A20"/>',
                '<g transform="translate(160 130)"><g><animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="',
                toString(spin),
                's" repeatCount="indefinite"/>',
                '<circle r="70" fill="none" stroke="#F5C451" stroke-width="6"/>',
                '<path d="M-70 0H70M0-70V70M-49-49L49 49M-49 49L49-49" stroke="#F5C451" stroke-width="2" opacity=".5"/></g>',
                '<ellipse cy="30" rx="26" ry="20" fill="#E8B07A"/><circle cx="-14" cy="14" r="8" fill="#E8B07A"/><circle cx="14" cy="14" r="8" fill="#E8B07A"/>',
                '<circle cx="-8" cy="28" r="3" fill="#1A1A20"/><circle cx="8" cy="28" r="3" fill="#1A1A20"/></g>',
                _text(tokenId, points, wins, played, bestStreak, rank, acc, t),
                "</svg>"
            )
        );
    }

    function _text(
        uint256 tokenId,
        uint64 points,
        uint32 wins,
        uint32 played,
        uint32 bestStreak,
        uint256 rank,
        uint256 acc,
        string memory t
    ) private pure returns (bytes memory) {
        return abi.encodePacked(
            '<g font-family="monospace" fill="#EDEDED" text-anchor="middle">',
            '<text x="160" y="232" font-size="18" fill="#F5C451">',
            t,
            "</text>",
            '<text x="160" y="256" font-size="13">Squeek #',
            toString(tokenId),
            rank == 0 ? "" : string(abi.encodePacked("  |  Rank #", toString(rank))),
            "</text>",
            '<text x="160" y="278" font-size="13">',
            toString(points),
            " pts  |  ",
            toString(wins),
            "/",
            toString(played),
            " (",
            toString(acc),
            "%)</text>",
            '<text x="160" y="298" font-size="11" opacity=".7">best streak ',
            toString(bestStreak),
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
