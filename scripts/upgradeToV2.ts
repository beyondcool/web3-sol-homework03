import {firstDeploy, type PriceFeedEntry} from "./utils/deploy.core.js";
import {network} from "hardhat";

const PROXY_ADDER = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9";

async function main() {
    const { ethers } = await network.create();
    const signers = await ethers.getSigners();
    const deployer = signers[0];
    
    console.log("PROXY_ADDER: ", PROXY_ADDER);
    console.log("\n\n========== 🔄 升级到 V2 (AuctionHouseV2) ==========\n\n");

    // 第一步：部署 V2 实现合约
    const AuctionHouseV2Factory = await ethers.getContractFactory("AuctionHouseV2");
    const auctionHouseV2 = await AuctionHouseV2Factory.deploy();
    await auctionHouseV2.waitForDeployment();
    console.log(`  ✓ 部署地址: ${ await auctionHouseV2.getAddress()}, AuctionHouseV2`);

    const auctionHouseV2Address = await auctionHouseV2.getAddress();


    const initDataV2 = AuctionHouseV2Factory.interface.encodeFunctionData("initializeV2", []);

    // 用 V1 的 ABI 通过代理调用 upgradeToAndCall（因为升级函数定义在 V1 的 UUPSUpgradeable 中）
    const v1Proxy = await ethers.getContractAt("AuctionHouseV1", PROXY_ADDER);
    const tx = await v1Proxy.upgradeToAndCall(auctionHouseV2Address, initDataV2);
    await tx.wait();

    console.log(`  ✓ 升级交易哈希: ${tx.hash}`);

    // 升级完成后，通过 V2 的 ABI 调用 V2 新增的函数
    const v2Proxy = AuctionHouseV2Factory.attach(PROXY_ADDER);
    console.log(`  ✓ 验证代理合约版本: ${await v2Proxy.AuctionHouseVersion()}`);

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

