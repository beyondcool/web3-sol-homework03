// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;
import "./IPriceOracle.sol";
/**
 * @title PriceOracle
 * @notice Chainlink 价格预言机，用于查询 ETH 和 ERC20 代币兑美元的价格
 * @dev 通过 Chainlink 的 AggregatorV3Interface 获取链上价格数据
 *      价格精度从 Feed 合约的 decimals() 动态读取（USD 计价对通常为 8 位小数）
 */
contract PriceOracle is IPriceOracle {
    struct FeedCfg {
        bool initialized;
        address feedAddress;
        uint8 decimals;
    }
    /// @notice 查询价格时若价格 <= 0 或已过期则回滚
    uint256 public constant STALE_PRICE_TIMEOUT = 1 hours;

    /// @notice ETH 的特殊占位地址
    address public constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

    // /// @notice token 地址 => Chainlink feed 合约地址
    // mapping(address => address) public feeds;

    // /// @notice token 地址 => 代币精度（如 ETH=18, USDC=6）
    // mapping(address => uint8) public tokenDecimals;

    mapping(address => FeedCfg) public feedConfigs;

    /// @notice 设置 Feed 事件
    event FeedSet(address indexed token, address indexed feed, uint8 decimals);

    /// @notice 移除 Feed 事件
    event FeedRemoved(address indexed token);

    /**
     * @notice 设置某个代币的 Chainlink 价格喂价合约
     * @param token 代币合约地址（ETH 用 ETH_ADDRESS）
     * @param feed  Chainlink AggregatorV3Interface 合约地址
     * @param decimal 代币精度（e.g. 18 for ETH, 6 for USDC）
     */
    function setFeed(address token, address feed, uint8 decimal) public {
        require(token != address(0), "PriceOracle: invalid token address");
        require(feed != address(0), "PriceOracle: invalid feed address");
        require(decimal > 0, "PriceOracle: invalid decimals");
        
        feedConfigs[token] = FeedCfg({
            initialized: true,
            feedAddress: feed,
            decimals: decimal
        });

        emit FeedSet(token, feed, decimal);
    }

    /**
     * @notice 移除某个代币的 feed 配置
     * @param token 代币合约地址
     */
    function removeFeed(address token) external {
        require(feedConfigs[token].initialized, "PriceOracle: feed not set");
        delete feedConfigs[token];
        emit FeedRemoved(token);
    }

    /**
     * @notice 批量设置多个 feed
     * @param tokens  代币地址数组
     * @param feeds_  feed 地址数组
     * @param decimals 代币精度数组
     */
    function setFeeds(
        address[] calldata tokens,
        address[] calldata feeds_,
        uint8[] calldata decimals
    ) external {
        require(
            tokens.length == feeds_.length && feeds_.length == decimals.length,
            "PriceOracle: array length mismatch"
        );
        for (uint256 i = 0; i < tokens.length; i++) {
            setFeed(tokens[i], feeds_[i], decimals[i]);
        }
    }

    /**
     * @notice 查询 ETH/USD 价格
     * @return price  ETH/USD 价格，精度由 Feed 合约决定
     * @return decimals 价格精度，从 Feed 合约动态读取（USD 计价对通常为 8）
     */
    function getETHPriceInUSD() external view returns (uint256 price, uint8 decimals) {
        return _getPrice(ETH_ADDRESS);
    }

    /**
     * @notice 查询指定 ERC20 代币/USD 价格
     * @param token ERC20 代币合约地址
     * @return price    代币/USD 价格，精度由 Feed 合约决定
     * @return decimals 价格精度，从 Feed 合约动态读取（USD 计价对通常为 8）
     */
    function getTokenPriceInUSD(address token) external view returns (uint256 price, uint8 decimals) {
        require(token != address(0), "PriceOracle: invalid token address");
        return _getPrice(token);
    }

    /**
     * @notice 将指定数量的代币换算成 USD
     * @param token  代币地址
     * @param amount 代币数量（按照代币自身的精度单位）
     * @return usdAmount 对应的美元数量，8 位小数精度
     *
     * 计算方式：
     *   usdAmount = (amount * feedPrice) / 10**tokenDecimals
     *   其中 feedPrice 是 8 位小数精度
     */
    function convertToUSD(address token, uint256 amount) external view returns (uint256 usdAmount) {
        (uint256 feedPrice, ) = _getPrice(token);
        uint8 decimal = feedConfigs[token].decimals;
        return (amount * feedPrice) / (10 ** uint256(decimal));
    }

    // ---- internal ----

    /**
     * @dev 通过 Chainlink AggregatorV3Interface 获取价格
     */
    function _getPrice(address token) internal view returns (uint256 price, uint8 priceDecimals) {
        address feedAddr = feedConfigs[token].feedAddress;
        require(feedAddr != address(0), "PriceOracle: feed not set for token");

        // 使用 interface 进行 static call
        (bool success, bytes memory data) = feedAddr.staticcall(
            abi.encodeWithSignature("latestRoundData()")
        );
        require(success, "PriceOracle: failed to call latestRoundData");

        // decode: roundId, answer, startedAt, updatedAt, answeredInRound
        (, int256 answer, , uint256 updatedAt, ) = abi.decode(
            data,
            (uint80, int256, uint256, uint256, uint80)
        );

        require(answer > 0, "PriceOracle: invalid price");
        require(
            block.timestamp - updatedAt < STALE_PRICE_TIMEOUT,
            "PriceOracle: stale price"
        );

        price = uint256(answer);

        // 动态读取 feed 合约的 decimals，而非硬编码 8
        (bool decSuccess, bytes memory decData) = feedAddr.staticcall(
            abi.encodeWithSignature("decimals()")
        );
        require(decSuccess, "PriceOracle: failed to call decimals");
        priceDecimals = abi.decode(decData, (uint8));
    }
}