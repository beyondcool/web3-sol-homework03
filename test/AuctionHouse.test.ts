import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("PriceOracle 本地测试", function () {
  it("MockPriceOracle 可独立查询 ETH 和 ERC20 价格", async function () {
    const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
    const USDC_ADDR = "0x0000000000000000000000000000000000000001";

    const oracle = await ethers.deployContract("MockPriceOracle");

    // 设置 ETH 价格 $2000（8 位小数精度）
    await oracle.setPrice(ETH_ADDRESS, 2000_00000000n);
    await oracle.setDecimals(ETH_ADDRESS, 18);

    // 设置 USDC 价格 $1
    await oracle.setPrice(USDC_ADDR, 1_00000000n);
    await oracle.setDecimals(USDC_ADDR, 6);

    // 查询 ETH/USD
    const [ethPrice] = await oracle.getETHPriceInUSD();
    expect(ethPrice).to.equal(2000_00000000n);

    // 查询 USDC/USD
    const [usdcPrice] = await oracle.getTokenPriceInUSD(USDC_ADDR);
    expect(usdcPrice).to.equal(1_00000000n);

    // 换算：1 ETH = 2000 USD
    const oneETH = ethers.parseEther("1");
    expect(await oracle.convertToUSD(ETH_ADDRESS, oneETH)).to.equal(2000_00000000n);

    // 换算：1000 USDC = 1000 USD
    const oneThousandUSDC = ethers.parseUnits("1000", 6);
    expect(await oracle.convertToUSD(USDC_ADDR, oneThousandUSDC)).to.equal(1000_00000000n);
  });

  it("MockPriceOracle 可模拟不同价格场景", async function () {
    const ETH_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

    const oracle = await ethers.deployContract("MockPriceOracle");
    await oracle.setPrice(ETH_ADDRESS, 1500_00000000n); // ETH=$1500
    await oracle.setDecimals(ETH_ADDRESS, 18);

    // 0.5 ETH = $750 USD
    const halfETH = ethers.parseEther("0.5");
    const usd = await oracle.convertToUSD(ETH_ADDRESS, halfETH);
    expect(usd).to.equal(750_00000000n); // 0.5 * 1500 = 750
  });
});