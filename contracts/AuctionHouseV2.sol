// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;
import "./AuctionHouseV1.sol";

contract AuctionHouseV2 is AuctionHouseV1 {
    
    /// @notice 禁止【直接调用】当前合约地址的initialize方法，初始化合约
    constructor() {
        _disableInitializers();
    }

    /************ functions  ***********************/

    /// @notice 初始化合约，设置合约的owner为msg.sender
    function initialize() external reinitializer(2) {
    }

    function AuctionHouseVersion() external pure virtual override returns (string memory) {
        return "2.0";
    }
}