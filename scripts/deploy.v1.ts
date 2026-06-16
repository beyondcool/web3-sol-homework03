import { network } from "hardhat";

async function main() {
    const { ethers } = await network.create();
    const signers = await ethers.getSigners();
    const deployer = signers[0];

    /******************* 部署合约 ********************/

    //【部署合约】MockPriceOracle/PriceOracle/MyNFT
    const priceOracle = await ethers.deployContract("PriceOracle");
    const mockPriceOracle = await ethers.deployContract("MockPriceOracle");
    const myNFT = await ethers.deployContract("MyNFT");

    const AuctionHouseV1Factory = await ethers.getContractFactory("AuctionHouseV1");
    const auctionHouseV1 =  await AuctionHouseV1Factory.deploy();
    await auctionHouseV1.waitForDeployment();

    //【部署合约】UUPS实现合约V1版本：
    const auctionHouseV1Address = await auctionHouseV1.getAddress();
    console.log(`  ✓ 实现合约 V1 地址: ${auctionHouseV1Address}`);
    console.log(`  ✓ 交易哈希: ${auctionHouseV1.deploymentTransaction()!.hash}`);

    

    
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