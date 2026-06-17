import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("MyNFT", function () {
  let nft: any;
  let owner: any;
  let user1: any;
  let user2: any;

  before(async function () {
    const signers = await ethers.getSigners();
    owner = signers[0];
    user1 = signers[1];
    user2 = signers[2];

    nft = await ethers.deployContract("MyNFT");
    await nft.waitForDeployment();
  });

  describe("基本信息", function () {
    it("name 应为 'My NFT'", async function () {
      expect(await nft.name()).to.equal("My NFT");
    });

    it("symbol 应为 'MNFT'", async function () {
      expect(await nft.symbol()).to.equal("MNFT");
    });

    it("owner 应为部署者 (Account #0)", async function () {
      expect(await nft.owner()).to.equal(owner.address);
    });
  });

  describe("mint", function () {
    it("owner 可以为指定地址铸造 NFT", async function () {
      const tokenIdBefore = await nft.currentMaxTokenId();
      await nft.connect(owner).mint(user1.address);
      const tokenIdAfter = await nft.currentMaxTokenId();
      expect(tokenIdAfter).to.equal(tokenIdBefore + 1n);
      expect(await nft.ownerOf(tokenIdBefore)).to.equal(user1.address);
    });

    it("非 owner 调用 mint 应该 revert", async function () {
      await expect(
        nft.connect(user1).mint(user1.address)
      ).to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");
    });

    it("tokenId 从 0 开始递增", async function () {
      const currentId = await nft.currentMaxTokenId();
      await nft.connect(owner).mint(user2.address);
      expect(await nft.ownerOf(currentId)).to.equal(user2.address);
    });
  });

  describe("mintWithUri", function () {
    it("owner 可以铸造 NFT 并设置 URI", async function () {
      const tokenIdBefore = await nft.currentMaxTokenId();
      const uri = "ipfs://QmTestUri123";
      await nft.connect(owner).mintWithUri(user1.address, uri);

      expect(await nft.ownerOf(tokenIdBefore)).to.equal(user1.address);
      expect(await nft.tokenURI(tokenIdBefore)).to.equal(uri);
    });

    it("非 owner 调用 mintWithUri 应该 revert", async function () {
      await expect(
        nft.connect(user1).mintWithUri(user1.address, "ipfs://test")
      ).to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");
    });
  });

  describe("setTokenURI", function () {
    it("owner 可以设置已有 tokenId 的 URI", async function () {
      const tokenIdBefore = await nft.currentMaxTokenId();
      await nft.connect(owner).mint(user1.address);

      await nft.connect(owner).setTokenURI(tokenIdBefore, "ipfs://UpdatedUri");
      expect(await nft.tokenURI(tokenIdBefore)).to.equal("ipfs://UpdatedUri");
    });

    it("setTokenURI 可以多次覆盖 URI", async function () {
      const tokenIdBefore = await nft.currentMaxTokenId();
      await nft.connect(owner).mint(user1.address);

      await nft.connect(owner).setTokenURI(tokenIdBefore, "ipfs://First");
      await nft.connect(owner).setTokenURI(tokenIdBefore, "ipfs://Second");
      expect(await nft.tokenURI(tokenIdBefore)).to.equal("ipfs://Second");
    });

    it("非 owner 调用 setTokenURI 应该 revert", async function () {
      const tokenIdBefore = await nft.currentMaxTokenId();
      await nft.connect(owner).mint(user1.address);

      await expect(
        nft.connect(user1).setTokenURI(tokenIdBefore, "ipfs://hack")
      ).to.be.revertedWithCustomError(nft, "OwnableUnauthorizedAccount");
    });
  });

  describe("currentMaxTokenId", function () {
    it("返回下一个将要铸造的 tokenId", async function () {
      const nextId = await nft.currentMaxTokenId();
      await nft.connect(owner).mint(user1.address);
      expect(await nft.currentMaxTokenId()).to.equal(nextId + 1n);
    });
  });

  describe("继承的 ERC721 方法", function () {
    let tokenId: bigint;

    before(async function () {
      tokenId = await nft.currentMaxTokenId();
      await nft.connect(owner).mint(owner.address);
    });

    it("ownerOf 返回正确持有者", async function () {
      expect(await nft.ownerOf(tokenId)).to.equal(owner.address);
    });

    it("balanceOf 返回正确数量", async function () {
      const balance = await nft.balanceOf(owner.address);
      expect(balance).to.be.at.least(1n);
    });

    it("approve + getApproved 正常工作", async function () {
      await nft.connect(owner).approve(user1.address, tokenId);
      expect(await nft.getApproved(tokenId)).to.equal(user1.address);
    });

    it("transferFrom 可以转移 NFT", async function () {
      const newTokenId = await nft.currentMaxTokenId();
      await nft.connect(owner).mint(owner.address);

      await nft.connect(owner).transferFrom(owner.address, user2.address, newTokenId);
      expect(await nft.ownerOf(newTokenId)).to.equal(user2.address);
    });

    it("safeTransferFrom (无 data) 可以转移 NFT", async function () {
      const newTokenId = await nft.currentMaxTokenId();
      await nft.connect(owner).mint(owner.address);

      await nft.connect(owner)["safeTransferFrom(address,address,uint256)"](
        owner.address,
        user1.address,
        newTokenId
      );
      expect(await nft.ownerOf(newTokenId)).to.equal(user1.address);
    });

    it("setApprovalForAll + isApprovedForAll 正常工作", async function () {
      const signers = await ethers.getSigners();
      const alice = signers[11];
      const bob = signers[12];

      expect(await nft.isApprovedForAll(alice.address, bob.address)).to.equal(false);
      await nft.connect(alice).setApprovalForAll(bob.address, true);
      expect(await nft.isApprovedForAll(alice.address, bob.address)).to.equal(true);

      await nft.connect(alice).setApprovalForAll(bob.address, false);
      expect(await nft.isApprovedForAll(alice.address, bob.address)).to.equal(false);
    });

    it("supportsInterface 返回正确的接口支持", async function () {
      expect(await nft.supportsInterface("0x80ac58cd")).to.equal(true);
      expect(await nft.supportsInterface("0x5b5e139f")).to.equal(true);
    });
  });
});