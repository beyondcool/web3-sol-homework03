// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./PriceOracle.sol";

// ETH 占位地址（与 PriceOracle.ETH_ADDRESS 保持一致）
address constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

contract AuctionHouse is  Initializable, OwnableUpgradeable, UUPSUpgradeable {

    /************ type definition  ***********************/

    
    /**
     * @dev 拍卖结构体
     */
    struct Auction {
        address payTokenAddress;  // 支付的ERC20 token代币合约地址（竞价：除ETH以外，还支持一种ERC20 token代币）
        address seller;           // 卖家账户地址
        address nftContract;      // NFT合约地址 (拍卖品的)
        uint256 tokenId;          // NFT的TokenID (拍卖品的)
        uint256 startPrice;       // 起拍价
        uint256 highestBid;       // 当前最高出价（代币数量，按代币自身精度）
        uint256 highestBidUSD;    // 当前最高出价（美元数量，8位小数精度）
        address highestBidder;    // 当前最高出价者账户地址
        uint256 endTime;          // 拍卖结束时间
        bool active;              // 是否激活
    }

    /************ state variables  ***********************/
    ///@notice NFT合约地址
    address public nftContractAddress;
    
    ///@notice 拍卖ID
    uint public auctionNextId;

    ///@notice 拍卖映射，key为拍卖ID，value为拍卖信息
    mapping(uint => Auction) public auctions;

    ///@notice 价格预言机合约地址
    PriceOracle public priceOracle;

    /************ events ***********************/

    ///@notice 拍卖上架事件
    event AuctionAdded(uint auctionId, uint tokenId);

    ///@notice 价格预言机更新事件
    event PriceOracleUpdated(address indexed newOracle);

    /************ modifiers ***********************/

    ///@notice 限制只有 owner 可以调用的 modifier
    modifier onlyOwnerOverride() {
        require(owner() == msg.sender, "AuctionHouse: caller is not the owner");
        _;
    }

    /************ constructor  ***********************/

    /// @notice 禁止【直接调用】当前合约地址的initialize方法，初始化合约
    constructor() {
        _disableInitializers();
    }

    /************ functions  ***********************/

    /// @notice 初始化合约，设置合约的owner为msg.sender
    function initialize(address myNftAddr) external initializer {
        __Ownable_init(msg.sender);
        nftContractAddress = myNftAddr;
    }

    /// @notice 设置价格预言机地址
    /// @param oracle 价格预言机合约地址
    function setPriceOracle(address oracle) external onlyOwner {
        require(oracle != address(0), "AuctionHouse: invalid oracle address");
        require(oracle.code.length > 0, "AuctionHouse: oracle is not a contract");
        priceOracle = PriceOracle(oracle);
        emit PriceOracleUpdated(oracle);
    }

    /// @notice 升级检查，出现异常会阻断升级
    /// @param newImplementation the new implementation address
    function _authorizeUpgrade(address newImplementation) internal virtual override {
        require(msg.sender == owner(), "AuctionHouse: only owner can authorize upgrade");
        require(newImplementation != address(0), "AuctionHouse: new implementation address is zero");
        require(newImplementation.code.length > 0, "AuctionHouse: new implementation is not a contract");
    }

    /** ******************************* 业务逻辑 ********************************************* */

    /// @notice 上架拍卖
    /// @param tokenId the token ID（拍卖品的TokenID）
    /// @param payTokenAddress the pay token address（竞价：除ETH以外，还支持一种ERC20 token代币）
    /// @param startPrice the start price（起拍价）
    /// @param duration the duration （拍卖持续时间，单位：秒数）
    function addAuction(uint tokenId, address payTokenAddress, uint startPrice, uint duration) external {
        require(IERC721(nftContractAddress).ownerOf(tokenId) == msg.sender, "AuctionHouse: token owner is not the caller");

        auctions[auctionNextId] = Auction({
            payTokenAddress: payTokenAddress,
            seller: msg.sender,
            nftContract: nftContractAddress,
            tokenId: tokenId,
            startPrice: startPrice,
            highestBid: 0,
            highestBidUSD: 0,
            highestBidder: address(0),
            endTime: block.timestamp + duration,
            active: true
        });
        auctionNextId++;
        emit AuctionAdded(auctionNextId, tokenId);
    }

    /// @notice 竞价（支持ETH支付和ERC20代币支付，两种支付均通过 PriceOracle 换算为USD进行比较）
    /// @param auctionId the auction ID
    /// @param bidPrice the bid price（代币数量，按代币自身精度）
    function placeBid(uint auctionId, uint bidPrice) external payable {
        Auction storage auction = auctions[auctionId];
        require(auction.active, "AuctionHouse: auction is not active");
        require(block.timestamp < auction.endTime, "AuctionHouse: auction is over");
        require(auction.highestBidder != msg.sender, "AuctionHouse: already the highest bidder");

        // 确定本次竞价使用的支付币种
        address payToken;
        if (msg.value > 0) {
            // 用 ETH 支付
            require(msg.value == bidPrice, "AuctionHouse: msg.value != bidPrice");
            require(bidPrice > 0, "AuctionHouse: bidPrice is zero");
            payToken = ETH_ADDRESS;
        } else {
            // 用 ERC20 代币支付
            payToken = auction.payTokenAddress;
            require(payToken != address(0), "AuctionHouse: payToken not set");
            require(IERC20(payToken).balanceOf(msg.sender) >= bidPrice, "AuctionHouse: insufficient balance");
            require(IERC20(payToken).allowance(msg.sender, address(this)) >= bidPrice, "AuctionHouse: insufficient allowance");
        }

        // 通过 PriceOracle 将 bidPrice 换算成 USD，确保新出价 > 当前最高出价（以 USD 计价）
        uint256 bidUSD = priceOracle.convertToUSD(payToken, bidPrice);
        require(bidUSD > 0, "AuctionHouse: bid USD value is zero");

        if (auction.highestBidder != address(0)) {
            // 存在历史最高出价 → 需比较 USD 价值
            address highestPayToken = auction.payTokenAddress;
            if (auction.highestBid > 0 && auction.highestBidder != address(0)) {
                // 若最高出价是 ETH（payTokenAddress 为 ETH_ADDRESS 或 auction 的 payTokenAddress 指向 ETH）
                // 但实际上 Auction 的 payTokenAddress 存的是 ERC20 地址，ETH 竞价时需特殊处理：
                // 这里通过 priceOracle 将历史最高出价也换算成 USD
                uint256 highestUSD = priceOracle.convertToUSD(highestPayToken, auction.highestBid);
                require(bidUSD > highestUSD, "AuctionHouse: bid too low in USD value");
            }
        }

        // 退还前一个最高出价者（仅当之前有人出价且不是同一人时）
        if (auction.highestBidder != address(0) && auction.highestBidder != msg.sender) {
            _refundBidder(auction);
        }

        // 更新最高出价
        auction.highestBid = bidPrice;
        auction.highestBidUSD = bidUSD;
        auction.highestBidder = msg.sender;

        // 如果是 ERC20 支付，立即将代币转入本合约
        if (msg.value == 0) {
            require(
                IERC20(payToken).transferFrom(msg.sender, address(this), bidPrice),
                "AuctionHouse: transferFrom failed"
            );
        }
        // ETH 支付已在 msg.value 中自动转入
    }

    /// @notice 结算拍卖
    /// @param auctionId the auction ID
    function settleAuction(uint auctionId) external {
        Auction storage auction = auctions[auctionId];
        require(auction.active, "AuctionHouse: auction is not active");
        uint bidPrice = auction.highestBid;
        require(bidPrice > 0, "AuctionHouse: no bid placed");
        require(block.timestamp >= auction.endTime, "AuctionHouse: auction not ended");
        require(auction.highestBidder != address(0), "AuctionHouse: highest bidder is empty");
        require(auction.highestBidder != auction.seller, "AuctionHouse: highest bidder is the seller");

        // 标记拍卖已结束
        auction.active = false;

        // 转移 NFT 给最高出价者
        IERC721(nftContractAddress).safeTransferFrom(auction.seller, auction.highestBidder, auction.tokenId);

        // 将竞价款转给卖家
        address payToken = auction.payTokenAddress;
        if (payToken == address(0) || payToken == ETH_ADDRESS) {
            // ETH 支付 - 直接将合约中的 ETH 转给卖家
            Address.sendValue(payable(auction.seller), bidPrice);
        } else {
            // ERC20 支付 - 将之前转入的代币转给卖家
            require(
                IERC20(payToken).transfer(auction.seller, bidPrice),
                "AuctionHouse: ERC20 transfer to seller failed"
            );
        }
    }

    /************ internal functions  ***********************/

    /// @notice 退还前一个最高出价者的资金
    /// @param auction 拍卖存储引用
    function _refundBidder(Auction storage auction) private {
        address payToken = auction.payTokenAddress;
        uint256 previousBid = auction.highestBid;

        if (payToken == address(0) || payToken == ETH_ADDRESS) {
            // 退还 ETH
            payable(auction.highestBidder).transfer(previousBid);
        } else {
            // 退还 ERC20 代币
            require(
                IERC20(payToken).transfer(auction.highestBidder, previousBid),
                "AuctionHouse: ERC20 refund failed"
            );
        }
    }
}