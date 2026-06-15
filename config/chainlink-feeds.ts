/**
 * Chainlink 价格喂价合约地址配置
 *
 * 每条数据的格式： [代币符号, 代币地址(or ETH), 喂价合约地址, 代币精度]
 * - ETH 使用特殊地址 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE
 * - 普通 ERC20 使用其合约地址
 *
 * 参考文档：https://docs.chain.link/data-feeds/price-feeds/addresses
 */

import type { AddressLike } from "ethers";

export interface FeedEntry {
  symbol: string;
  tokenAddress: string;
  feedAddress: string;
  decimals: number; // token decimals
}

export const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

/**
 * Sepolia 测试网 Chainlink Feed 地址
 */
export const SEPOLIA_FEEDS: FeedEntry[] = [
  {
    symbol: "ETH",
    tokenAddress: ETH_ADDRESS,
    feedAddress: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
    decimals: 18,
  },
  {
    symbol: "LINK",
    tokenAddress: "0x779877A7B0D9E8603169DdbD7836e478b4624789",
    feedAddress: "0xc59E3633BAAC79493d908e63626716e204A45EdF",
    decimals: 18,
  },
];

/**
 * Ethereum 主网 Chainlink Feed 地址
 */
export const MAINNET_FEEDS: FeedEntry[] = [
  {
    symbol: "ETH",
    tokenAddress: ETH_ADDRESS,
    feedAddress: "0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419",
    decimals: 18,
  },
  {
    symbol: "USDC",
    tokenAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    feedAddress: "0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6",
    decimals: 6,
  },
  {
    symbol: "LINK",
    tokenAddress: "0x514910771AF9Ca656af840dff83E8264EcF986CA",
    feedAddress: "0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c",
    decimals: 18,
  },
  {
    symbol: "DAI",
    tokenAddress: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
    feedAddress: "0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9",
    decimals: 18,
  },
  {
    symbol: "USDT",
    tokenAddress: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    feedAddress: "0x3E7d1eAB13ad0104d2750B8863b489D65364e32D",
    decimals: 6,
  },
];

/**
 * 根据网络名称获取 Feed 列表
 */
export function getFeedsByNetwork(networkName: string): FeedEntry[] {
  switch (networkName) {
    case "sepolia":
      return SEPOLIA_FEEDS;
    case "mainnet":
    case "hardhat": // fork 场景
      return MAINNET_FEEDS;
    default:
      return [];
  }
}

/**
 * 根据网络名和代币符号/地址查找 Feed
 */
export function findFeed(
  networkName: string,
  tokenAddressOrSymbol: string
): FeedEntry | undefined {
  const feeds = getFeedsByNetwork(networkName);
  const lower = tokenAddressOrSymbol.toLowerCase();
  return feeds.find(
    (f) =>
      f.symbol.toLowerCase() === lower ||
      f.tokenAddress.toLowerCase() === lower
  );
}