import {firstDeploy} from "./utils/deploy.core.js";
import {network} from "hardhat";


async function main() {
    const { ethers } = await network.create();
    const signers = await ethers.getSigners();
    const deployer = signers[0];

    //【部署合约】MockPriceOracle
    const mockPriceOracle = await ethers.deployContract("MockPriceOracle");
    console.log(`  ✓ 部署地址: ${ await mockPriceOracle.getAddress()}, MockPriceOracle`);

    await firstDeploy({
        priceOracleAddress: await mockPriceOracle.getAddress(),
        priceFeedData:[]
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



