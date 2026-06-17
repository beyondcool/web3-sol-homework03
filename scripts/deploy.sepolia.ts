import {firstDeploy, type PriceFeedEntry} from "./utils/deploy.core.js";
import {network} from "hardhat";



const priceFeedData: PriceFeedEntry[] = [{
    symbol: "ETH",
    tokenAddress: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
    feedAddress: "0x694AA1769357215DE4FAC081bf1f309aDC325306",
    decimals: 18,
  },
  {
    symbol: "LINK",
    tokenAddress: "0x779877A7B0D9E8603169DdbD7836e478b4624789",
    feedAddress: "0xc59E3633BAAC79493d908e63626716e204A45EdF",
    decimals: 18,
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



