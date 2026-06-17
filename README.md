# 基于 NFT 的拍卖行 DApp（AuctionHouse）

## 一、项目概述

本项目是一个基于以太坊的 **NFT 拍卖行** 去中心化应用（DApp），支持卖家上架 NFT 进行拍卖，买家通过 **ETH** 或 **ERC20 代币** 参与竞价。拍卖合约通过 Chainlink 价格预言机将不同币种的出价统一换算为 **USD 价值** 进行比较，确保出价公平。

项目采用 **UUPS 可升级代理模式** 部署，支持合约逻辑的热升级而无需迁移数据。

### 技术栈

| 类别 | 技术 |
|------|------|
| 开发框架 | Hardhat 3 |
| 智能合约语言 | Solidity 0.8.28 |
| 前端交互库 | ethers.js v6 |
| 合约库 | OpenZeppelin Contracts v5.x（含 Upgradeable） |
| 价格预言机 | Chainlink Price Feeds |
| 测试框架 | Mocha + Chai（TypeScript） |
| 编译目标 | TypeScript 6.x / ES2023 / Node 20 |

### 核心特性

- **多币种竞价**：支持 ETH 和任意 ERC20 代币作为支付方式
- **统一 USD 计价比较**：通过 Chainlink 价格预言机将所有出价换算为 USD，确保跨币种出价可比
- **UUPS 可升级代理**：合约逻辑可升级，存储数据保留在代理合约中
- **防重入保护**：竞价和结算函数使用 OpenZeppelin 的 `ReentrancyGuard`
- **紧急取消**：合约 Owner 可取消涉嫌违规的拍卖，并自动退还已出价资金
- **完整的测试覆盖**：68 个 Mocha 测试用例覆盖所有核心功能和边界条件

---

## 二、项目结构

```plaintext
web3-sol-homework03/
│
├── contracts/                          # Solidity 合约源码
│   ├── AuctionHouseV1.sol              # 拍卖行核心合约 V1（UUPS 可升级）
│   ├── AuctionHouseV2.sol              # 拍卖行升级合约 V2（演示升级流程）
│   ├── MyNFT.sol                       # NFT 合约（ERC-721）
│   ├── UUPSProxy.sol                   # UUPS 代理合约（ERC1967Proxy 封装）
│   │
│   ├── dataFeed/                       # 价格预言机模块
│   │   ├── IPriceOracle.sol            # 价格预言机接口
│   │   └── PriceOracle.sol             # Chainlink 价格预言机实现
│   │
│   └── mocks/                          # 本地测试 Mock 合约
│       ├── MockERC20.sol               # 模拟 ERC20 代币（用于测试支付）
│       └── MockPriceOracle.sol         # 模拟价格预言机（无需真实 Chainlink Feed）
│
├── scripts/                            # 部署和升级脚本
│   ├── deploy.local.ts                 # 本地网络部署（使用 MockPriceOracle）
│   ├── deploy.sepolia.ts               # Sepolia 测试网部署
│   ├── deploy.mainnet.ts               # 以太坊主网部署
│   ├── upgradeToV2.ts                  # 升级到 AuctionHouseV2
│   ├── upgradeToV3.ts                  # 升级到 V3（预留模板）
│   └── utils/
│       └── deploy.core.ts              # 部署核心逻辑（共享函数）
│
├── test/                               # TypeScript 集成测试（Mocha）
│   ├── AuctionHouseV1.test.ts          # 拍卖行合约测试（47 个用例）
│   ├── MyNFT.test.ts                   # NFT 合约测试（18 个用例）
│   └── MockPriceOracle.test.ts         # 预言机 Mock 测试（20 个用例）
│
├── config/
│   └── chainlink-feeds.ts              # Chainlink 喂价地址配置（Sepolia / 主网）
│
├── ignition/
│   └── modules/
│       └── Counter.ts                  # Ignition 部署模块（示例模板）
│
├── hardhat.config.ts                   # Hardhat 配置文件
├── package.json                        # 项目依赖
├── tsconfig.json                       # TypeScript 配置
├── Readme_deploy.md                    # 部署记录（操作日志）
├── Readme_test.md                      # 测试记录（操作日志）
└── .gitignore
```

### 合约架构关系

```plaintext
┌──────────────┐     ┌─────────────────────┐     ┌──────────────────┐
│    MyNFT     │     │    UUPSProxy        │     │   PriceOracle    │
│  (ERC-721)   │     │  (ERC1967Proxy)     │     │  (Chainlink)     │
│              │     │                     │     │                  │
│ - mint()     │     │ 指向 AuctionHouse   │     │ + setFeeds()     │
│ - tokenURI() │     │ 的 V1/V2 实现合约   │     │ + convertToUSD() │
│ - owner      │     └─────────┬───────────┘     │ + getETHPrice    │
└──────┬───────┘               │                 └────────┬─────────┘
       │                       │                          │
       │  NFT 铸造              │  delegatecall            │ 价格查询
       │  与转移                │                          │
       ▼                       ▼                          ▼
┌──────────────────────────────────────────────────────────────────┐
│                     AuctionHouseV1 (逻辑合约)                      │
│                                                                   │
│  - addAuction()        上架 NFT 拍卖                              │
│  - placeBid()          ETH / ERC20 竞价，价格换算为 USD 比较      │
│  - settleAuction()     结算拍卖，转移 NFT 和资金                  │
│  - cancelAuction()     紧急取消（仅 Owner），退还出价              │
│  - setPriceOracle()    更新预言机地址（仅 Owner）                  │
│  - _authorizeUpgrade() UUPS 升级鉴权                              │
└──────────────────────────────────────────────────────────────────┘
```

---

## 三、功能说明

### 3.1 MyNFT — NFT 合约

基于 OpenZeppelin 的 `ERC721` + `ERC721URIStorage` + `Ownable`，继承标准 ERC-721 并添加 URI 元数据管理。

| 函数 | 权限 | 说明 |
|------|------|------|
| `mint(address to)` | onlyOwner | 铸造 1 个 NFT 给指定地址，tokenId 自增 |
| `mintWithUri(address to, string uri)` | onlyOwner | 铸造 NFT 并同时设置 URI 元数据 |
| `setTokenURI(uint256 tokenId, string uri)` | onlyOwner | 设置/覆盖已有 NFT 的 URI |
| `currentMaxTokenId()` | 公开 | 返回下一个将要铸造的 tokenId |
| `supportsInterface()` | 公开 | ERC-721 / ERC-721Metadata 接口支持查询 |

> 继承了 `transferFrom`、`safeTransferFrom`、`approve`、`setApprovalForAll` 等标准 ERC-721 方法。

### 3.2 AuctionHouseV1 — 拍卖行核心合约

采用 **UUPS 可升级模式**，继承 `Initializable` + `OwnableUpgradeable` + `UUPSUpgradeable` + `ReentrancyGuard`。

#### 数据结构

```solidity
struct Auction {
    address payTokenAddress;   // 支付代币地址（ERC20）
    address seller;            // 卖家地址
    address nftContract;       // NFT 合约地址
    uint256 tokenId;           // 拍卖品 tokenId
    uint256 startPrice;        // 起拍价（代币数量）
    uint256 highestBid;        // 当前最高出价（代币数量）
    uint256 highestBidUSD;     // 当前最高出价（USD，8 位小数）
    address highestBidder;     // 当前最高出价者
    uint256 endTime;           // 结束时间戳
    AuctionState state;        // Active / Canceled / Sold
}
```

#### 核心功能

**① 拍卖上架 (`addAuction`)**

卖家将 NFT 授权给拍卖合约后，调用此函数上架拍卖：
- `payTokenAddress` 必须是非零的有效 ERC20 合约地址（不能是 `ETH_ADDRESS`）
- 设置起拍价和拍卖持续时间
- 拍卖状态初始为 `Active`

> **设计决策**：`payTokenAddress` 不能设为 `ETH_ADDRESS`，因为 ETH 竞价走 `msg.value`（用户随交易发送），不需要预先指定支付代币。任何拍卖都同时接受 ETH 出价——只有在出价时 `msg.value > 0` 则识别为 ETH 支付。

**② 竞价 (`placeBid`)**

支持两种支付方式，通过 `msg.value` 自动区分：

| 条件 | 支付方式 | 行为 |
|------|----------|------|
| `msg.value > 0` | ETH | 验证 `msg.value == bidPrice`，ETH 随交易转入 |
| `msg.value == 0` | ERC20 | 验证余额和授权，通过 `transferFrom` 转入 |

竞价流程：
1. 验证拍卖状态为 `Active` 且未结束
2. 验证出价者不是当前最高出价者或卖家
3. 将新出价通过预言机换算为 USD 价值
4. 若已有历史最高出价，比较 USD 价值确保高于当前
5. **先更新状态**（最高出价者、金额、USD），**再执行外部调用**（退还原出价者、转入新出价代币）——遵循 Checks-Effects-Interactions 模式

**③ 结算拍卖 (`settleAuction`)**

拍卖结束后任何人都可触发结算：
- **无人出价** → 触发 `AuctionFailed` 事件（流拍）
- **有人出价** → 触发 `AuctionSuccess` 事件：
  1. NFT 从卖家转移给最高出价者
  2. 竞价款（ETH 或 ERC20）转给卖家

**④ 紧急取消 (`cancelAuction`)**

仅 Owner 可调用，用于处理涉嫌违规的拍卖：
- 拍卖状态标记为 `Canceled`
- 若有出价，自动退还给出价者
- 使用 `nonReentrant` 防重入

**⑤ UUPS 升级鉴权 (`_authorizeUpgrade`)**

- 仅 Owner 可触发升级
- 验证新实现地址非零且是合约

**⑥ 价格预言机管理 (`setPriceOracle`)**

- 仅 Owner 可更新
- 验证新地址非零且是合约地址

#### 事件列表

| 事件 | 说明 |
|------|------|
| `AuctionAdded(uint auctionId, uint tokenId)` | 拍卖上架 |
| `AuctionCanceled(uint auctionId)` | 拍卖取消 |
| `AuctionFailed(uint auctionId)` | 拍卖失败（流拍） |
| `AuctionSuccess(uint auctionId, address winner, uint bidPrice)` | 拍卖成功 |
| `PriceOracleUpdated(address newOracle)` | 预言机更新 |

### 3.3 AuctionHouseV2 — 升级合约

继承 `AuctionHouseV1`，演示 UUPS 升级流程：

- 使用 `reinitializer(2)` 修饰符确保 V2 初始化仅执行一次
- 版本号更新为 `"2.0"`
- 重复升级会被 `InvalidInitialization()` 错误阻止（`reinitializer` 保护机制）

### 3.4 PriceOracle — Chainlink 价格预言机

通过 Chainlink `AggregatorV3Interface` 获取链上实时价格，所有价格均以 **8 位小数** 返回。

| 函数 | 说明 |
|------|------|
| `setFeed(token, feed, decimals)` | 配置单个代币的 Chainlink Feed |
| `setFeeds(tokens[], feeds[], decimals[])` | 批量配置 |
| `removeFeed(token)` | 移除 Feed 配置 |
| `getETHPriceInUSD()` | 查询 ETH 价格（8 位小数） |
| `getTokenPriceInUSD(token)` | 查询 ERC20 价格（8 位小数） |
| `convertToUSD(token, amount)` | 将代币数量换算为 USD |

计算方式：`usdAmount = (amount × feedPrice) / 10^tokenDecimals`

内置 **过期价格保护**：若 Chainlink 数据超过 1 小时未更新，查询会 revert。

### 3.5 UUPSProxy — 代理合约

基于 OpenZeppelin `ERC1967Proxy`，构造函数接收实现合约地址和初始化数据（`initialize` 调用的 ABI 编码）。

部署后所有调用通过 `delegatecall` 转发到实现合约，存储数据保存在代理合约中。

### 3.6 Mock 合约（仅供本地测试）

- **MockPriceOracle**：替代真实 Chainlink Feed，可随时通过 `setPrice()` / `setDecimals()` 设置任意价格
- **MockERC20**：测试用 ERC20 代币，部署者获得 100 万枚初始供应

---

## 四、部署步骤

### 4.1 环境要求

- **Node.js** ≥ 20
- **npm** ≥ 9
- 安装依赖：`npm install`

### 4.2 环境变量配置

部署到远程网络需要设置以下环境变量（或使用 `hardhat-keystore`）：

```bash
# Sepolia 测试网
export SEPOLIA_RPC_URL='https://eth-sepolia.g.alchemy.com/v2/你的API_KEY'
export SEPOLIA_PRIVATE_KEY='0x你的私钥'

# 以太坊主网
export MAINNET_RPC_URL='https://eth-mainnet.g.alchemy.com/v2/你的API_KEY'
export MAINNET_PRIVATE_KEY='0x你的私钥'

# 合约验证（所有网络共用）
export ETHERSCAN_API_KEY='你的Etherscan_API_KEY'
```

### 4.3 本地部署

**启动本地节点：**
```bash
npx hardhat node
```

**部署合约（新终端）：**
```bash
npx hardhat run scripts/deploy.local.ts --network localhost
```

部署流程：
1. 部署 `MockPriceOracle`（本地测试无需真实 Chainlink Feed）
2. 部署 `MyNFT`（NFT 合约）
3. 部署 `AuctionHouseV1`（实现合约）
4. 部署 `UUPSProxy`（代理合约，指向 V1 实现并调用 `initialize`）

### 4.4 Sepolia 测试网部署

```bash
npx hardhat run scripts/deploy.sepolia.ts --network sepolia
```

部署流程：
1. 部署 `PriceOracle`（真实 Chainlink 预言机）
2. 配置 ETH 和 LINK 的 Chainlink Feed
3. 部署其余合约（同本地流程）

**验证合约：**
```bash
# 逐个验证
npx hardhat verify --network sepolia <PriceOracle地址>
npx hardhat verify --network sepolia <MyNFT地址>
npx hardhat verify --network sepolia <AuctionHouseV1地址>
npx hardhat verify --network sepolia <UUPSProxy地址> <AuctionHouseV1地址> <initData十六进制>
```

### 4.5 以太坊主网部署

```bash
npx hardhat run scripts/deploy.mainnet.ts --network mainnet
```

主网部署流程与 Sepolia 相同，区别在于：
- 使用 `MAINNET_RPC_URL` 和 `MAINNET_PRIVATE_KEY` 环境变量
- Chainlink Feed 包含 ETH、USDC、LINK、DAI、USDT 五种代币

### 4.6 合约升级（V1 → V2）

1. 修改 `scripts/upgradeToV2.ts` 中的 `PROXY_ADDER` 为已部署的代理地址
2. 运行升级脚本：

```bash
npx hardhat run scripts/upgradeToV2.ts --network localhost
```

升级流程：
1. 部署新的 `AuctionHouseV2` 实现合约
2. 通过代理调用 `upgradeToAndCall(newImpl, initDataV2)`
3. 调用 `initializeV2()` 完成 V2 初始化
4. 验证版本号已更新为 `"2.0"`

> ⚠️ 重复执行升级会被 `reinitializer(2)` 拦截并 revert（`InvalidInitialization`），确保 V2 初始化仅执行一次。

---

## 五、测试

### 运行测试

```bash
# 运行所有 Mocha 测试
npx hardhat test mocha
```

### 测试范围

| 测试文件 | 用例数 | 覆盖内容 |
|----------|--------|----------|
| `AuctionHouseV1.test.ts` | 28 | 版本信息、预言机管理、上架拍卖、ETH/ERC20 竞价、边界条件、取消拍卖、结算拍卖 |
| `MyNFT.test.ts` | 17 | 基本信息、mint、mintWithUri、setTokenURI、ERC-721 继承方法 |
| `MockPriceOracle.test.ts` | 23 | 常量、setPrice、setDecimals、价格查询、USD 换算 |
| **合计** | **68** | |

### 关键测试场景

- ✅ 通过 UUPS Proxy 交互验证代理模式正确工作
- ✅ ETH 竞价：`msg.value` 与 `bidPrice` 一致性校验
- ✅ ERC20 竞价：余额/授权检查、代币转入、退款机制
- ✅ 跨币种 USD 价值比较（新出价必须高于历史最高 USD 价值）
- ✅ 卖家不能对自己的拍卖出价
- ✅ 拍卖结束/取消后不可出价
- ✅ 结算后不可重复结算
- ✅ 紧急取消退还出价者资金
- ✅ 无人出价拍卖流拍

---

## 六、关键设计决策

### 为什么 `payTokenAddress` 不能设为 `ETH_ADDRESS`？

ETH 竞价通过 `msg.value` 随交易发送，无需预先指定支付代币。将 `payTokenAddress` 设为 `ETH_ADDRESS` 会引入歧义。任何拍卖都**天然支持 ETH 和 ERC20 双币竞价**——系统通过 `msg.value > 0` 自动判断支付方式。

### 为什么使用 `reinitializer(2)` 而非 `initializer`？

在 UUPS 升级场景中，V2 也需要初始化新状态。OpenZeppelin 的 `reinitializer(version)` 确保每个版本的初始化函数只执行一次，防止重复初始化攻击。

### Checks-Effects-Interactions 模式

`placeBid` 函数遵循此安全模式：
1. **Checks**：验证所有前置条件
2. **Effects**：先更新 `highestBidder`、`highestBid`、`highestBidUSD` 状态
3. **Interactions**：再执行外部调用（退还原出价者、转入新出价代币）

这防止了重入攻击。

### 价格数据过期保护

`PriceOracle` 内置了 `STALE_PRICE_TIMEOUT = 1 hour`，若 Chainlink 数据超过 1 小时未更新则拒绝返回价格，避免使用过期数据导致计价偏差。