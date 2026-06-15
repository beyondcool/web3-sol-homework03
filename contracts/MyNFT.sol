// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";

/**
 * @title MyNFT contract
 * @author zhouhe
 * @notice 实现NFT的铸造、转移、设置URI等操作
 */
contract MyNFT is  Ownable, ERC721, ERC721URIStorage {

    /// @notice 已铸造的NFT数量
    uint256 public totalSupply;    


    constructor() Ownable(msg.sender) ERC721("My NFT", "MNFT"){

    }

    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC721, ERC721URIStorage) returns (bool) {
        return super.supportsInterface(interfaceId);
    }

    /// @notice 获取NFT的URI
    /// @param tokenId the token ID
    function tokenURI(uint256 tokenId) public view virtual override(ERC721, ERC721URIStorage) returns (string memory) { 
        return super.tokenURI(tokenId);
    }

    /// @notice 铸造NFT
    /// @param to the recipient of the token
    function mint(address to) external onlyOwner() {
        uint tokenId = totalSupply++;
        _mint(to, tokenId);
    }

    /// @notice 铸造NFT并设置URI
    /// @param to the recipient of the token
    /// @param uri the token URI
    function mintWithUri(address to, string memory uri) external onlyOwner() {
        uint tokenId = totalSupply++;
        _mint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    /// @notice 设置NFT的URI
    /// @param tokenId the token ID
    /// @param uri the token URI
    /// @dev 只有NFT的者才能设置URI
    function setTokenURI(uint256 tokenId, string memory uri) external {
        require(ownerOf(tokenId) == msg.sender, "NFTAuction: token owner is not the caller");
        _setTokenURI(tokenId, uri);
    }

/*  继承的方法，可以用于转移NFT的所有权等操作：

    transferFrom(address from, address to, uint256 tokenId)

    safeTransferFrom(address from, address to, uint256 tokenId)

    safeTransferFrom(address from, address to, uint256 tokenId, bytes data)

    approve(address to, uint256 tokenId)

    setApprovalForAll(address operator, bool approved)

    getApproved(uint256 tokenId)、isApprovedForAll(address owner, address operator)
*/
}