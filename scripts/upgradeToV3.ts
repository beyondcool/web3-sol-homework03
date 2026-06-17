import {firstDeploy, type PriceFeedEntry} from "./utils/deploy.core.js";
import {network} from "hardhat";

const PROXY_ADDER = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";

async function main() {
    const { ethers } = await network.create();
    const signers = await ethers.getSigners();
    const deployer = signers[0];
    
    /**
     * 
     *  将来有了 AuctionHouseV3 合约后再写~~
     * 
     */

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

