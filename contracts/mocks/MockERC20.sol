// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockERC20 用于支付
 * @notice 测试用的简单 ERC20 代币，部署者获得全部初始供应
 */
contract MockERC20 is ERC20 {
    constructor() ERC20("TestToken", "TST") {
        _mint(msg.sender, 1000000 * 10 ** decimals());
    }
}