// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockPriceOracle
 * @notice 本地测试用的模拟价格预言机，无需 Chainlink 真实 Feed 即可返回预设价格
 * @dev 测试时部署此合约替代 PriceOracle，可随时通过 setPrice/setDecimals 设置任意价格
 *      仅 owner 可修改价格/精度，避免被任意账户操纵
 */
contract MockPriceOracle is Ownable {
    /// @notice 构造函数，将部署者设为 owner（OZ 5.x Ownable 需显式传 initialOwner）
    constructor() Ownable(msg.sender) {}

    /// @notice ETH 的占位地址（与 PriceOracle 保持一致）
    address public constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    /// @notice token => 预设价格（8 位小数精度，与 Chainlink 一致）
    mapping(address => uint256) public mockPrices;

    /// @notice token => 代币精度（如 ETH=18, USDC=6）
    mapping(address => uint8) public tokenDecimals;

    /// @notice 设置某个代币的模拟价格
    function setPrice(address token, uint256 price) external onlyOwner {
        mockPrices[token] = price;
    }

    /// @notice 设置某个代币的精度
    function setDecimals(address token, uint8 decimal) external onlyOwner {
        require(decimal > 0, "MockPriceOracle: invalid decimals");
        tokenDecimals[token] = decimal;
    }

    /**
     * @notice 模拟 getETHPriceInUSD
     */
    function getETHPriceInUSD() external view returns (uint256 price, uint8 decimals) {
        price = _getPrice(ETH_ADDRESS);
        decimals = 8;
    }

    /**
     * @notice 模拟 getTokenPriceInUSD
     */
    function getTokenPriceInUSD(address token) external view returns (uint256 price, uint8 decimals) {
        require(token != address(0), "MockPriceOracle: invalid token address");
        price = _getPrice(token);
        decimals = 8;
    }

    /**
     * @notice 模拟 convertToUSD
     */
    function convertToUSD(address token, uint256 amount) external view returns (uint256 usdAmount) {
        uint256 feedPrice = _getPrice(token);
        uint8 decimal = tokenDecimals[token];
        return (amount * feedPrice) / (10 ** uint256(decimal));
    }

    function _getPrice(address token) internal view returns (uint256) {
        uint256 p = mockPrices[token];
        require(p > 0, "MockPriceOracle: price not set for token");
        return p;
    }
}