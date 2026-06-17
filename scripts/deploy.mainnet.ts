import {firstDeploy, type PriceFeedEntry} from "./utils/deploy.core.js";
import {network} from "hardhat";



const priceFeedData: PriceFeedEntry[] = [
  {
    symbol: "ETH",
    tokenAddress: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
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
]

async function main() {
    const { ethers } = await network.create();
    const signers = await ethers.getSigners();
    const deployer = signers[0];

    //【部署合约】PriceOracle
    const priceOracle = await ethers.deployContract("PriceOracle");
    console.log(`  ✓ 部署地址: ${ await priceOracle.getAddress()}, PriceOracle`);


    await firstDeploy({
        priceOracleAddress: await priceOracle.getAddress(),
        priceFeedData: priceFeedData
    });
}


main()
    .then(() => {
        console.log("\n✅ 执行成功");
        process.exit(0);
    })
    .catch((error) => {
        console.error("\n❌ 执行失败:");
        console.error(error);
        process.exit(1);
    });



