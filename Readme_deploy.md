# 1. localhost 本地节点

运行 `npx hardhat node`，启动本地Node。

## 1.1 首次部署

``` shell
$ npx hardhat run scripts/deploy.local.ts --network localhost

  ✓ 部署地址: 0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0, MockPriceOracle

  firstDeploy函数的参数params:  {
  priceOracleAddress: '0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0',
  priceFeedData: []
}


  ========== 🔄 首次部署 (AuctionHouseV1) ==========


  ✓ 部署地址: 0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9, MyNFT
  ✓ 部署地址: 0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9, AuctionHouseV1
  ✓ 部署地址: 0x5FC8d32690cc91D4c39d9d3abcBD16989F875707, UUPSProxy
  ✓ 验证代理合约版本: 1.0

✅ 执行成功
zh@zhpc:~/work/web3-sol-homework03$ 
```

## 1.2 升级到V2

修改`upgradeToV2.ts`中的`PROXY_ADDER`, 值为刚刚部署的`UUPSProxy`合约地址

```shell
zh@zhpc:~/work/web3-sol-homework03$ 
zh@zhpc:~/work/web3-sol-homework03$ npx hardhat run scripts/upgradeToV2.ts --network localhost

PROXY_ADDER:  0x5FC8d32690cc91D4c39d9d3abcBD16989F875707


========== 🔄 升级到 V2 (AuctionHouseV2) ==========


  ✓ 部署地址: 0x0165878A594ca255338adfa4d48449f69242Eb8F, AuctionHouseV2
  ✓ 升级交易哈希: 0x031be40e008ffc823b757ffd7ad110a39f3dca37443eae0a4943368e1a6af1e8
  ✓ 验证代理合约版本: 2.0

✅ 执行成功
zh@zhpc:~/work/web3-sol-homework03$
zh@zhpc:~/work/web3-sol-homework03$
```

## 1.3 重复运行升级到V2，按预期报错

修饰符 `reinitializer(2)` 发挥作用

```shell
zh@zhpc:~/work/web3-sol-homework03$ npx hardhat run scripts/upgradeToV2.ts --network localhost

PROXY_ADDER:  0x5FC8d32690cc91D4c39d9d3abcBD16989F875707


========== 🔄 升级到 V2 (AuctionHouseV2) ==========


  ✓ 部署地址: 0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6, AuctionHouseV2

❌ 执行失败:
ProviderError: VM Exception while processing transaction: reverted with custom error 'InvalidInitialization()'
    at HttpProvider.request (/home/zh/work/web3-sol-homework03/node_modules/hardhat/src/internal/builtin-plugins/network-manager/http-provider.ts:146:21)
    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)
    at async AutomaticGasHandler.getMultipliedGasEstimation (/home/zh/work/web3-sol-homework03/node_modules/hardhat/src/internal/builtin-plugins/network-manager/request-handlers/handlers/gas/multiplied-gas-estimation.ts:29:30)
    at async AutomaticGasHandler.handle (/home/zh/work/web3-sol-homework03/node_modules/hardhat/src/internal/builtin-plugins/network-manager/request-handlers/handlers/gas/automatic-gas-handler.ts:52:16)
    at async Array.onRequest (/home/zh/work/web3-sol-homework03/node_modules/hardhat/src/internal/builtin-plugins/network-manager/hook-handlers/network.ts:72:38)
    at async next (/home/zh/work/web3-sol-homework03/node_modules/hardhat/src/internal/core/hook-manager.ts:207:13)
    at async HookManagerImplementation.runHandlerChain (/home/zh/work/web3-sol-homework03/node_modules/hardhat/src/internal/core/hook-manager.ts:213:12)
    at async HttpProvider.request (/home/zh/work/web3-sol-homework03/node_modules/hardhat/src/internal/builtin-plugins/network-manager/http-provider.ts:137:25)
    at async HardhatEthersProvider.send (/home/zh/work/web3-sol-homework03/node_modules/@nomicfoundation/hardhat-ethers/src/internal/hardhat-ethers-provider/hardhat-ethers-provider.ts:119:12)
    at async HardhatEthersSigner.#sendUncheckedTransaction (/home/zh/work/web3-sol-homework03/node_modules/@nomicfoundation/hardhat-ethers/src/internal/signers/signers.ts:296:12) {
  code: 3,
  data: '0xf92ee8a9'
}
zh@zhpc:~/work/web3-sol-homework03$ 
```

# 2. Sepolia 测试网



# 3. mainnet 主网

