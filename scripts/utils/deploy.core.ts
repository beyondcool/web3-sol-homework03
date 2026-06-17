import { network } from "hardhat";

export interface PriceFeedEntry {
    symbol: string;
    tokenAddress: string;
    feedAddress: string;
    decimals: number;
}

export interface DeployParams {
    priceOracleAddress: string,
    priceFeedData:PriceFeedEntry[]
}


export async function firstDeploy(params: DeployParams) {
    const { ethers } = await network.create();
    const signers = await ethers.getSigners();
    const deployer = signers[0];

    // 参数：
    console.log("\n  firstDeploy函数的参数params: ", params)

    const priceFeedData = params.priceFeedData;
    // 价格：
    if (priceFeedData.length > 0) {
        const symbols = priceFeedData.map(f => f.symbol);
        const tokens = priceFeedData.map(f => f.tokenAddress);
        const feedAddresses = priceFeedData.map(f => f.feedAddress);
        const decimals = priceFeedData.map(f => f.decimals);
        const priceOracle = await ethers.getContractAt(
            "IPriceOracle",
            params.priceOracleAddress
        );
        await priceOracle.setFeeds(tokens, feedAddresses, decimals);
        console.log(`  ✓ 已配置 ${priceFeedData.length} 个 Chainlink feeds: ${symbols}`);
    }

    /******************* 部署合约 ********************/
    console.log("\n\n  ========== 🔄 首次部署 (AuctionHouseV1) ==========\n\n");

    const myNFT = await ethers.deployContract("MyNFT");
    console.log(`  ✓ 部署地址: ${ await myNFT.getAddress()}, MyNFT`);

    const AuctionHouseV1Factory = await ethers.getContractFactory("AuctionHouseV1");
    const auctionHouseV1 =  await AuctionHouseV1Factory.deploy();
    await auctionHouseV1.waitForDeployment();
    console.log(`  ✓ 部署地址: ${ await auctionHouseV1.getAddress()}, AuctionHouseV1`);

    //【部署合约】UUPS实现合约V1版本：
    const auctionHouseV1Address = await auctionHouseV1.getAddress();

    //【部署合约】UUPS Proxy（ERC1967Proxy），指向实现合约并调用 initialize 初始化
    const initData = auctionHouseV1.interface.encodeFunctionData("initialize", [await myNFT.getAddress(), params.priceOracleAddress]);

    const proxy = await ethers.deployContract("UUPSProxy", [
        auctionHouseV1Address,
        initData
    ]);
    console.log(`  ✓ 部署地址: ${ await proxy.getAddress()}, UUPSProxy`);

    await proxy.waitForDeployment();
    const proxyAddress = await proxy.getAddress();

    // 创建代理合约的交互实例（通过代理地址调用实现合约逻辑）
    const auctionHouseV1Proxy = await ethers.getContractAt(
        "AuctionHouseV1",
        proxyAddress
    );

    console.log(`  ✓ 验证代理合约版本: ${await auctionHouseV1Proxy.AuctionHouseVersion()}`);
    
}
