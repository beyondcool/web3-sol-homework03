// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

interface IPriceOracle {
    function convertToUSD(address token, uint256 amount) external view returns (uint256 usdAmount);
}