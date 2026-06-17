import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

describe("MockPriceOracle", function () {
  let oracle: any;

  before(async function () {
    oracle = await ethers.deployContract("MockPriceOracle");
  });

  describe("常量", function () {
    it("ETH_ADDRESS 应为标准 ETH 占位地址", async function () {
      expect(await oracle.ETH_ADDRESS()).to.equal(ETH_ADDRESS);
    });
  });

  describe("setPrice", function () {
    it("设置代币价格后可通过 mockPrices 查询", async function () {
      const token = "0x0000000000000000000000000000000000000001";
      const price = 1500_00000000n;
      await oracle.setPrice(token, price);
      expect(await oracle.mockPrices(token)).to.equal(price);
    });

    it("可以覆盖已设置的价格", async function () {
      const token = "0x0000000000000000000000000000000000000002";
      await oracle.setPrice(token, 100_00000000n);
      await oracle.setPrice(token, 200_00000000n);
      expect(await oracle.mockPrices(token)).to.equal(200_00000000n);
    });
  });

  describe("setDecimals", function () {
    it("设置代币精度后可通过 tokenDecimals 查询", async function () {
      const token = "0x0000000000000000000000000000000000000003";
      await oracle.setDecimals(token, 6);
      expect(await oracle.tokenDecimals(token)).to.equal(6);
    });

    it("设置 decimals 为 0 应该 revert", async function () {
      const token = "0x0000000000000000000000000000000000000004";
      await expect(
        oracle.setDecimals(token, 0)
      ).to.be.revertedWith("MockPriceOracle: invalid decimals");
    });

    it("可以覆盖已设置的精度", async function () {
      const token = "0x0000000000000000000000000000000000000005";
      await oracle.setDecimals(token, 18);
      await oracle.setDecimals(token, 8);
      expect(await oracle.tokenDecimals(token)).to.equal(8);
    });
  });

  describe("getETHPriceInUSD", function () {
    it("返回 ETH 价格和精度 8", async function () {
      await oracle.setPrice(ETH_ADDRESS, 2500_00000000n);
      await oracle.setDecimals(ETH_ADDRESS, 18);
      const [price, decimals] = await oracle.getETHPriceInUSD();
      expect(price).to.equal(2500_00000000n);
      expect(decimals).to.equal(8);
    });

    it("ETH 价格未设置时应该 revert", async function () {
      const freshOracle = await ethers.deployContract("MockPriceOracle");
      await expect(
        freshOracle.getETHPriceInUSD()
      ).to.be.revertedWith("MockPriceOracle: price not set for token");
    });
  });

  describe("getTokenPriceInUSD", function () {
    it("返回指定代币价格和精度 8", async function () {
      const token = "0x0000000000000000000000000000000000000006";
      await oracle.setPrice(token, 1_00000000n);
      await oracle.setDecimals(token, 6);
      const [price, decimals] = await oracle.getTokenPriceInUSD(token);
      expect(price).to.equal(1_00000000n);
      expect(decimals).to.equal(8);
    });

    it("传入零地址应该 revert", async function () {
      await expect(
        oracle.getTokenPriceInUSD("0x0000000000000000000000000000000000000000")
      ).to.be.revertedWith("MockPriceOracle: invalid token address");
    });

    it("价格未设置时应该 revert", async function () {
      const token = "0x00000000000000000000000000000000000000ff";
      await expect(
        oracle.getTokenPriceInUSD(token)
      ).to.be.revertedWith("MockPriceOracle: price not set for token");
    });
  });

  describe("convertToUSD", function () {
    it("正确换算 ETH 到 USD（18 位精度）", async function () {
      await oracle.setPrice(ETH_ADDRESS, 3000_00000000n);
      await oracle.setDecimals(ETH_ADDRESS, 18);

      const twoETH = ethers.parseEther("2");
      expect(await oracle.convertToUSD(ETH_ADDRESS, twoETH)).to.equal(6000_00000000n);

      const pointOneETH = ethers.parseEther("0.1");
      expect(await oracle.convertToUSD(ETH_ADDRESS, pointOneETH)).to.equal(300_00000000n);
    });

    it("正确换算 ERC20 到 USD（6 位精度，如 USDC）", async function () {
      const usdc = "0x0000000000000000000000000000000000000007";
      await oracle.setPrice(usdc, 1_00000000n);
      await oracle.setDecimals(usdc, 6);

      const amount = ethers.parseUnits("1000", 6);
      expect(await oracle.convertToUSD(usdc, amount)).to.equal(1000_00000000n);
    });

    it("正确换算 ERC20 到 USD（18 位精度）", async function () {
      const token = "0x0000000000000000000000000000000000000008";
      await oracle.setPrice(token, 500_00000000n);
      await oracle.setDecimals(token, 18);

      const amount = ethers.parseEther("10");
      expect(await oracle.convertToUSD(token, amount)).to.equal(5000_00000000n);
    });

    it("价格为 0 时应该 revert", async function () {
      const token = "0x0000000000000000000000000000000000000009";
      await oracle.setPrice(token, 0);
      await oracle.setDecimals(token, 18);
      await expect(
        oracle.convertToUSD(token, 1000)
      ).to.be.revertedWith("MockPriceOracle: price not set for token");
    });

    it("金额为 0 时返回 0 USD", async function () {
      const token = "0x000000000000000000000000000000000000000a";
      await oracle.setPrice(token, 100_00000000n);
      await oracle.setDecimals(token, 18);
      expect(await oracle.convertToUSD(token, 0)).to.equal(0n);
    });
  });
});