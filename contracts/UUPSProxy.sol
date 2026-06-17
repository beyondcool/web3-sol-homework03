// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// 导入并重新导出 OpenZeppelin 的 ERC1967Proxy 合约
// 遵循本项目已有模式：包装合约让 Hardhat 能够编译和部署
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title UUPSProxy
 * @dev 这是 UUPS 模式中使用的代理合约
 */
contract UUPSProxy is ERC1967Proxy {
    constructor(address implementation, bytes memory _data) ERC1967Proxy(implementation, _data) {}
}
