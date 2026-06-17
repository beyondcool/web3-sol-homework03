// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

interface IPriceOracle {

    function setFeeds(
        address[] calldata tokens,
        address[] calldata feeds_,
        uint8[] calldata decimals
    ) external;

    function removeFeed(address token) external;

    function convertToUSD(address token, uint256 amount) external view returns (uint256 usdAmount);
}