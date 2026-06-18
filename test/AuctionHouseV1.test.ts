import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

describe("AuctionHouseV1 (通过 UUPS Proxy 交互)", function () {
  let auction: any;        // AuctionHouseV1 实例（通过 Proxy）
  let oracle: any;         // MockPriceOracle 实例
  let nft: any;            // MyNFT 实例
  let erc20: any;          // MockERC20 代币
  let proxy: any;          // UUPSProxy 实例
  let owner: any;
  let seller: any;
  let bidder1: any;
  let bidder2: any;
  let proxyAddress: string;

  before(async function () {
    const signers = await ethers.getSigners();
    owner = signers[0];
    seller = signers[1];
    bidder1 = signers[2];
    bidder2 = signers[3];

    // 1. 部署 MockPriceOracle
    oracle = await ethers.deployContract("MockPriceOracle");
    await oracle.waitForDeployment();
    const oracleAddr = await oracle.getAddress();

    // 2. 部署 MockERC20
    erc20 = await ethers.deployContract("MockERC20");
    await erc20.waitForDeployment();
    const erc20Addr = await erc20.getAddress();

    // 3. 部署 MyNFT
    nft = await ethers.deployContract("MyNFT");
    await nft.waitForDeployment();
    const nftAddr = await nft.getAddress();

    // 4. 部署 AuctionHouseV1 实现
    const auctionFactory = await ethers.getContractFactory("AuctionHouseV1");
    const auctionImpl = await auctionFactory.deploy();
    await auctionImpl.waitForDeployment();
    const implAddr = await auctionImpl.getAddress();

    // 5. 部署 UUPSProxy 并调用 initialize
    const initData = auctionImpl.interface.encodeFunctionData("initialize", [nftAddr, oracleAddr]);
    proxy = await ethers.deployContract("UUPSProxy", [implAddr, initData]);
    await proxy.waitForDeployment();
    proxyAddress = await proxy.getAddress();

    // 6. 通过 proxy 访问 auction
    auction = await ethers.getContractAt("AuctionHouseV1", proxyAddress);

    // 7. 设置价格预言机：ETH = $2000, ERC20 = $10
    await oracle.setPrice(ETH_ADDRESS, 2000_00000000n);
    await oracle.setDecimals(ETH_ADDRESS, 18);
    await oracle.setPrice(erc20Addr, 10_00000000n);
    await oracle.setDecimals(erc20Addr, 18);

    // 8. 给 bidder1 和 bidder2 分发 ERC20 代币
    const mintAmount = ethers.parseEther("100000");
    await erc20.transfer(bidder1.address, mintAmount);
    await erc20.transfer(bidder2.address, mintAmount);
  });

  // ====== 辅助函数 ======
  async function mintAndApprove(to: any): Promise<bigint> {
    const id = await nft.currentMaxTokenId();
    await nft.connect(owner).mint(to.address);
    await nft.connect(to).setApprovalForAll(proxyAddress, true);
    return id;
  }

  async function createAuction(
    sellerAccount: any,
    payTokenAddress: string,
    startPrice: bigint,
    duration: number
  ): Promise<bigint> {
    const tokenId = await mintAndApprove(sellerAccount);
    const tx = await auction.connect(sellerAccount).addAuction(tokenId, payTokenAddress, startPrice, duration);
    const receipt = await tx.wait();
    let auctionId: bigint = 0n;
    for (const log of receipt.logs) {
      try {
        const parsed = auction.interface.parseLog(log);
        if (parsed && parsed.name === "AuctionAdded") {
          auctionId = parsed.args.auctionId;
          break;
        }
      } catch {}
    }
    return auctionId;
  }

  // ====== 测试开始 ======

  describe("版本 & 基本信息", function () {
    it("AuctionHouseVersion 返回 '1.0'", async function () {
      expect(await auction.AuctionHouseVersion()).to.equal("1.0");
    });

    it("nftContractAddress 返回 MyNFT 地址", async function () {
      expect(await auction.nftContractAddress()).to.equal(await nft.getAddress());
    });

    it("priceOracle 返回 MockPriceOracle 地址", async function () {
      expect(await auction.priceOracle()).to.equal(await oracle.getAddress());
    });

    it("owner 应为部署者 (Account #0)", async function () {
      expect(await auction.owner()).to.equal(owner.address);
    });

    it("auctionNextId 初始为 0", async function () {
      expect(await auction.auctionNextId()).to.equal(0n);
    });
  });

  describe("setPriceOracle", function () {
    it("owner 可以更新 priceOracle", async function () {
      const newOracle = await ethers.deployContract("MockPriceOracle");
      const newOracleAddr = await newOracle.getAddress();

      await expect(auction.connect(owner).setPriceOracle(newOracleAddr))
        .to.emit(auction, "PriceOracleUpdated")
        .withArgs(newOracleAddr);

      expect(await auction.priceOracle()).to.equal(newOracleAddr);

      // 恢复原来的 oracle
      await auction.connect(owner).setPriceOracle(await oracle.getAddress());
    });

    it("不能设置为零地址", async function () {
      await expect(
        auction.connect(owner).setPriceOracle("0x0000000000000000000000000000000000000000")
      ).to.be.revertedWith("AuctionHouseV1: invalid oracle address");
    });

    it("不能设置为非合约地址", async function () {
      await expect(
        auction.connect(owner).setPriceOracle(bidder1.address)
      ).to.be.revertedWith("AuctionHouseV1: oracle is not a contract");
    });

    it("非 owner 调用应该 revert", async function () {
      await expect(
        auction.connect(seller).setPriceOracle(await oracle.getAddress())
      ).to.be.revertedWithCustomError(auction, "OwnableUnauthorizedAccount");
    });
  });

  describe("addAuction", function () {
    it("成功上架拍卖（ERC20 支付）", async function () {
      const erc20Addr = await erc20.getAddress();
      const tokenId = await mintAndApprove(seller);
      const startPrice = ethers.parseUnits("100", 8);

      const tx = await auction.connect(seller).addAuction(tokenId, erc20Addr, startPrice, 3600);
      await expect(tx).to.emit(auction, "AuctionAdded");

      const receipt = await tx.wait();
      let newAuctionId: bigint = 0n;
      for (const log of receipt.logs) {
        try {
          const parsed = auction.interface.parseLog(log);
          if (parsed && parsed.name === "AuctionAdded") {
            newAuctionId = parsed.args.auctionId;
            break;
          }
        } catch {}
      }

      const a = await auction.auctions(newAuctionId);
      expect(a.payTokenAddress).to.equal(erc20Addr);
      expect(a.seller).to.equal(seller.address);
      expect(a.nftContract).to.equal(await nft.getAddress());
      expect(a.tokenId).to.equal(tokenId);
      expect(a.startPrice).to.equal(startPrice);
      expect(a.highestBid).to.equal(0n);
      expect(a.highestBidder).to.equal("0x0000000000000000000000000000000000000000");
      expect(a.state).to.equal(0n); // Active = 0
    });

    it("payTokenAddress 为零地址应该 revert", async function () {
      const tokenId = await mintAndApprove(seller);
      await expect(
        auction.connect(seller).addAuction(tokenId, "0x0000000000000000000000000000000000000000", 100, 3600)
      ).to.be.revertedWith("AuctionHouseV1: payTokenAddress is zero");
    });

    it("payTokenAddress 为 ETH_ADDRESS 应该 revert", async function () {
      const tokenId = await mintAndApprove(seller);
      await expect(
        auction.connect(seller).addAuction(tokenId, ETH_ADDRESS, 100, 3600)
      ).to.be.revertedWith("AuctionHouseV1: payTokenAddress is ETH_ADDRESS");
    });

    it("非 token 持有者上架应该 revert", async function () {
      const tokenId = await mintAndApprove(seller);
      await expect(
        auction.connect(bidder1).addAuction(tokenId, await erc20.getAddress(), 100, 3600)
      ).to.be.revertedWith("AuctionHouseV1: token owner is not the caller");
    });
  });

  describe("placeBid - ETH 竞价（单次出价）", function () {
    let auctionId: bigint;

    before(async function () {
      const erc20Addr = await erc20.getAddress();
      auctionId = await createAuction(seller, erc20Addr, ethers.parseUnits("100", 8), 3600);
    });

    it("ETH 竞价成功", async function () {
      const bidPrice = ethers.parseEther("1");
      await auction.connect(bidder1).placeBid(auctionId, bidPrice, { value: bidPrice });

      const a = await auction.auctions(auctionId);
      expect(a.highestBidder).to.equal(bidder1.address);
      expect(a.highestBid).to.equal(bidPrice);
      expect(a.highestBidByEth).to.equal(true);
      expect(a.state).to.equal(0n);
    });

    it("msg.value != bidPrice 应该 revert", async function () {
      const erc20Addr = await erc20.getAddress();
      const id2 = await createAuction(seller, erc20Addr, ethers.parseUnits("100", 8), 3600);

      const bidPrice = ethers.parseEther("2");
      await expect(
        auction.connect(bidder2).placeBid(id2, bidPrice, { value: ethers.parseEther("1") })
      ).to.be.revertedWith("AuctionHouseV1: msg.value != bidPrice");
    });

    it("bidPrice 为 0 且 msg.value 为 0 时被 bid USD value should gt startPrice 拦截", async function () {
      const erc20Addr = await erc20.getAddress();
      const id2 = await createAuction(seller, erc20Addr, ethers.parseUnits("100", 8), 3600);

      await expect(
        auction.connect(bidder2).placeBid(id2, 0n, { value: 0n })
      ).to.be.revertedWith("AuctionHouseV1: bid USD value should gt startPrice");
    });

    it("已是最高出价者不能再出价", async function () {
      const bidPrice = ethers.parseEther("5");
      await expect(
        auction.connect(bidder1).placeBid(auctionId, bidPrice, { value: bidPrice })
      ).to.be.revertedWith("AuctionHouseV1: already the highest bidder");
    });
  });

  describe("placeBid - ERC20 竞价（完整流程）", function () {
    let auctionId: bigint;

    before(async function () {
      const erc20Addr = await erc20.getAddress();
      auctionId = await createAuction(seller, erc20Addr, ethers.parseUnits("100", 8), 3600);
    });

    it("ERC20 竞价成功（代币被转入合约）", async function () {
      const bidPrice = ethers.parseEther("200");
      await erc20.connect(bidder1).approve(proxyAddress, bidPrice);

      const contractBalanceBefore = await erc20.balanceOf(proxyAddress);
      await auction.connect(bidder1).placeBid(auctionId, bidPrice);
      const contractBalanceAfter = await erc20.balanceOf(proxyAddress);

      expect(contractBalanceAfter - contractBalanceBefore).to.equal(bidPrice);

      const a = await auction.auctions(auctionId);
      expect(a.highestBidder).to.equal(bidder1.address);
      expect(a.highestBid).to.equal(bidPrice);
      expect(a.highestBidByEth).to.equal(false);
    });

    it("余额不足应该 revert", async function () {
      const bidPrice = ethers.parseEther("99999999");
      await erc20.connect(bidder2).approve(proxyAddress, bidPrice);

      await expect(
        auction.connect(bidder2).placeBid(auctionId, bidPrice)
      ).to.be.revertedWith("AuctionHouseV1: insufficient balance");
    });

    it("授权不足应该 revert", async function () {
      const bidPrice = ethers.parseEther("500");
      await erc20.connect(bidder2).approve(proxyAddress, 0n);

      await expect(
        auction.connect(bidder2).placeBid(auctionId, bidPrice)
      ).to.be.revertedWith("AuctionHouseV1: insufficient allowance");
    });

    it("更高 ERC20 出价成功后，前一个出价者获得退款", async function () {
      const bidPrice = ethers.parseEther("500");
      await erc20.connect(bidder2).approve(proxyAddress, bidPrice);

      const balanceBefore = await erc20.balanceOf(bidder1.address);
      await auction.connect(bidder2).placeBid(auctionId, bidPrice);
      const balanceAfter = await erc20.balanceOf(bidder1.address);

      expect(balanceAfter - balanceBefore).to.equal(ethers.parseEther("200"));

      const a = await auction.auctions(auctionId);
      expect(a.highestBidder).to.equal(bidder2.address);
    });

    it("出价低于当前最高 USD 价值应该 revert（ERC20）", async function () {
      const bidPrice = ethers.parseEther("100");
      await erc20.connect(bidder1).approve(proxyAddress, bidPrice);

      await expect(
        auction.connect(bidder1).placeBid(auctionId, bidPrice)
      ).to.be.revertedWith("AuctionHouseV1: bid too low in USD value");
    });
  });

  describe("placeBid - 边界条件", function () {
    it("拍卖已结束后不能出价", async function () {
      const erc20Addr = await erc20.getAddress();
      const auctionId = await createAuction(seller, erc20Addr, ethers.parseUnits("100", 8), 1);

      // 等待拍卖结束
      await new Promise(resolve => setTimeout(resolve, 2000));

      const bidPrice = ethers.parseEther("1");
      await expect(
        auction.connect(bidder1).placeBid(auctionId, bidPrice, { value: bidPrice })
      ).to.be.revertedWith("AuctionHouseV1: auction is over");
    });

    it("卖家不能对自己的拍卖出价", async function () {
      const erc20Addr = await erc20.getAddress();
      const auctionId = await createAuction(seller, erc20Addr, ethers.parseUnits("100", 8), 3600);

      const bidPrice = ethers.parseEther("1");
      await expect(
        auction.connect(seller).placeBid(auctionId, bidPrice, { value: bidPrice })
      ).to.be.revertedWith("AuctionHouseV1: seller can't bid on his own auction");
    });

    it("已取消的拍卖不能出价", async function () {
      const erc20Addr = await erc20.getAddress();
      const auctionId = await createAuction(seller, erc20Addr, ethers.parseUnits("100", 8), 3600);

      await auction.connect(owner).cancelAuction(auctionId);

      const bidPrice = ethers.parseEther("1");
      await expect(
        auction.connect(bidder1).placeBid(auctionId, bidPrice, { value: bidPrice })
      ).to.be.revertedWith("AuctionHouseV1: auction is not active");
    });
  });

  describe("cancelAuction", function () {
    it("owner 可以取消拍卖（无出价）", async function () {
      const erc20Addr = await erc20.getAddress();
      const auctionId = await createAuction(seller, erc20Addr, ethers.parseUnits("100", 8), 3600);

      await expect(auction.connect(owner).cancelAuction(auctionId))
        .to.emit(auction, "AuctionCanceled")
        .withArgs(auctionId);

      const a = await auction.auctions(auctionId);
      expect(a.state).to.equal(1n); // Canceled = 1
    });

    it("owner 取消拍卖（有 ERC20 出价时退款）", async function () {
      const erc20Addr = await erc20.getAddress();
      const auctionId = await createAuction(seller, erc20Addr, ethers.parseUnits("100", 8), 3600);

      const bidPrice = ethers.parseEther("100");
      await erc20.connect(bidder1).approve(proxyAddress, bidPrice);
      await auction.connect(bidder1).placeBid(auctionId, bidPrice);

      const balanceBefore = await erc20.balanceOf(bidder1.address);
      await auction.connect(owner).cancelAuction(auctionId);
      const balanceAfter = await erc20.balanceOf(bidder1.address);

      expect(balanceAfter - balanceBefore).to.equal(bidPrice);

      const a = await auction.auctions(auctionId);
      expect(a.state).to.equal(1n);
    });

    it("非 owner 调用 cancelAuction 应该 revert", async function () {
      const erc20Addr = await erc20.getAddress();
      const auctionId = await createAuction(seller, erc20Addr, ethers.parseUnits("100", 8), 3600);

      await expect(
        auction.connect(seller).cancelAuction(auctionId)
      ).to.be.revertedWithCustomError(auction, "OwnableUnauthorizedAccount");
    });
  });

  describe("settleAuction", function () {
    it("无人出价时拍卖失败（emit AuctionFailed）", async function () {
      const erc20Addr = await erc20.getAddress();
      const auctionId = await createAuction(seller, erc20Addr, ethers.parseUnits("100", 8), 2);

      await new Promise(resolve => setTimeout(resolve, 3000));

      await expect(auction.settleAuction(auctionId))
        .to.emit(auction, "AuctionFailed")
        .withArgs(auctionId);
    });

    it("拍卖未结束不能结算", async function () {
      const erc20Addr = await erc20.getAddress();
      const auctionId = await createAuction(seller, erc20Addr, ethers.parseUnits("100", 8), 3600);

      await expect(
        auction.settleAuction(auctionId)
      ).to.be.revertedWith("AuctionHouseV1: auction not ended");
    });

    it("已取消的拍卖不能结算", async function () {
      const erc20Addr = await erc20.getAddress();
      const auctionId = await createAuction(seller, erc20Addr, ethers.parseUnits("100", 8), 2);
      await new Promise(resolve => setTimeout(resolve, 3000));
      await auction.connect(owner).cancelAuction(auctionId);

      await expect(
        auction.settleAuction(auctionId)
      ).to.be.revertedWith("AuctionHouseV1: auction is not active");
    });

    it("有人出价时拍卖成功（ERC20支付）：NFT 转移给最高出价者，代币转给卖家", async function () {
      this.timeout(15000);

      const erc20Addr = await erc20.getAddress();
      const auctionId = await createAuction(seller, erc20Addr, ethers.parseUnits("100", 8), 5);

      const auctionData = await auction.auctions(auctionId);
      const tokenId = auctionData.tokenId;

      const bidPrice = ethers.parseEther("300");
      await erc20.connect(bidder1).approve(proxyAddress, bidPrice);
      await auction.connect(bidder1).placeBid(auctionId, bidPrice);

      await new Promise(resolve => setTimeout(resolve, 6000));

      const sellerBalanceBefore = await erc20.balanceOf(seller.address);
      await expect(auction.settleAuction(auctionId))
        .to.emit(auction, "AuctionSuccess")
        .withArgs(auctionId, bidder1.address, bidPrice);
      const sellerBalanceAfter = await erc20.balanceOf(seller.address);

      expect(await nft.ownerOf(tokenId)).to.equal(bidder1.address);
      expect(sellerBalanceAfter - sellerBalanceBefore).to.equal(bidPrice);

      const a = await auction.auctions(auctionId);
      expect(a.state).to.equal(2n); // Finished = 2
    });

    it("已结算的拍卖不能再次结算", async function () {
      this.timeout(15000);

      const erc20Addr = await erc20.getAddress();
      const auctionId = await createAuction(seller, erc20Addr, ethers.parseUnits("100", 8), 5);

      const bidPrice = ethers.parseEther("100");
      await erc20.connect(bidder1).approve(proxyAddress, bidPrice);
      await auction.connect(bidder1).placeBid(auctionId, bidPrice);

      await new Promise(resolve => setTimeout(resolve, 6000));

      await auction.settleAuction(auctionId);

      await expect(
        auction.settleAuction(auctionId)
      ).to.be.revertedWith("AuctionHouseV1: auction is not active");
    });
  });
});