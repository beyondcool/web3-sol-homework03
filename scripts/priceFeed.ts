/**
 * Chainlink 价格查询模块（链下）
 *
 * 独立模块，可用于 hardhat 脚本、测试或后端服务中查询代币兑美元的价格。
 *
 * 使用方式：
 *   ```
 *   const feed = new PriceFeed("sepolia", ethers.provider);
 *   const usd = await feed.getPrice("ETH");
 *   console.log("ETH/USD:", ethers.formatUnits(usd, 8));
 *   ```
 */

import { ethers } from "ethers";
import type { Provider } from "ethers";
import { findFeed, ETH_ADDRESS, type FeedEntry } from "../config/chainlink-feeds.js";

// Chainlink AggregatorV3Interface ABI (只包含最新轮次数据查询)
const AGGREGATOR_ABI = [
  "function latestRoundData() view returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)",
  "function decimals() view returns (uint8)",
];

export class PriceFeed {
  private networkName: string;
  private provider: Provider;

  /**
   * @param networkName 网络名称，例如 "sepolia"、"mainnet"
   * @param provider    ethers Provider 实例
   */
  constructor(networkName: string, provider: Provider) {
    this.networkName = networkName;
    this.provider = provider;
  }

  /**
   * 查询代币兑美元的价格
   * @param tokenAddressOrSymbol 代币地址或符号，例如 "ETH"、"USDC"、"0xA0b869..."
   * @returns 价格（8 位小数精度），例如 2000.12345678 USD 返回 200012345678n
   */
  async getPrice(tokenAddressOrSymbol: string): Promise<bigint> {
    const feed = findFeed(this.networkName, tokenAddressOrSymbol);
    if (!feed) {
      throw new Error(
        `PriceFeed: no feed found for "${tokenAddressOrSymbol}" on "${this.networkName}"`
      );
    }
    return this._readFeed(feed);
  }

  /**
   * 获取 ETH 兑美元的价格
   */
  async getETHPrice(): Promise<bigint> {
    return this.getPrice(ETH_ADDRESS);
  }

  /**
   * 查询多个代币的价格
   */
  async getPrices(
    tokens: string[]
  ): Promise<Map<string, bigint>> {
    const results = new Map<string, bigint>();
    for (const token of tokens) {
      const price = await this.getPrice(token);
      results.set(token, price);
    }
    return results;
  }

  /**
   * 直接将 feed 换算成直观的美元金额（去掉 8 位小数精度）
   * @param tokenAddressOrSymbol 代币地址或符号
   * @returns 美元金额（浮点数），例如 2000.12
   */
  async getPriceInDecimal(tokenAddressOrSymbol: string): Promise<number> {
    const price = await this.getPrice(tokenAddressOrSymbol);
    return Number(ethers.formatUnits(price, 8));
  }

  /**
   * @internal 从 Chainlink feed 合约读取价格
   */
  private async _readFeed(feed: FeedEntry): Promise<bigint> {
    const contract = new ethers.Contract(
      feed.feedAddress,
      AGGREGATOR_ABI,
      this.provider
    );

    const [, answer, , updatedAt] = await contract.latestRoundData();

    // 检查数据是否过于陈旧（超过 1 小时）
    const now = BigInt(Math.floor(Date.now() / 1000));
    if (now - updatedAt > BigInt(3600)) {
      throw new Error(
        `PriceFeed: stale price for ${feed.symbol} (updated at ${updatedAt})`
      );
    }

    if (answer <= 0n) {
      throw new Error(`PriceFeed: invalid price for ${feed.symbol}`);
    }

    return answer;
  }
}