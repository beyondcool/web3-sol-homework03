// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./dataFeed/IPriceOracle.sol";

// ETH 占位地址（与 PriceOracle.ETH_ADDRESS 保持一致）
address constant ETH_ADDRESS = 0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE;

contract AuctionHouseV1 is  Initializable, OwnableUpgradeable, UUPSUpgradeable, ReentrancyGuard {

    /************ type definition  ***********************/

    enum AuctionState {
        Active,
        Canceled,
        Sold
    }
    
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
        AuctionState state;       // 是否激活
    }

    /************ state variables  ***********************/
    ///@notice NFT合约地址
    address public nftContractAddress;
    
    ///@notice 拍卖ID
    uint public auctionNextId;

    ///@notice 拍卖映射，key为拍卖ID，value为拍卖信息
    mapping(uint => Auction) public auctions;

    ///@notice 价格预言机合约地址
    IPriceOracle public priceOracle;

    /************ events ***********************/

    ///@notice 拍卖上架事件
    event AuctionAdded(uint auctionId, uint tokenId);

    ///@notice 拍卖紧急取消事件
    event AuctionCanceled(uint auctionId);

    ///@notice 拍卖失败事件（流拍）
    event AuctionFailed(uint auctionId);

    ///@notice 拍卖成功事件
    event AuctionSuccess(uint auctionId, address indexed winner, uint256 bidPrice);


    ///@notice 价格预言机更新事件
    event PriceOracleUpdated(address indexed newOracle);

    /************ modifiers ***********************/


    /************ constructor  ***********************/

    /// @notice 禁止【直接调用】当前合约地址的initialize方法，初始化合约
    constructor() {
        _disableInitializers();
    }

    /************ functions  ***********************/

    /// @notice 初始化合约，设置合约的owner为msg.sender
    function initialize(address myNftAddr, IPriceOracle _priceOracle) external initializer {
        __Ownable_init(msg.sender);
        nftContractAddress = myNftAddr;
        priceOracle = _priceOracle;
    }

    /// @notice 设置价格预言机地址
    /// @param oracle 价格预言机合约地址
    function setPriceOracle(address oracle) external onlyOwner {
        require(oracle != address(0), "AuctionHouseV1: invalid oracle address");
        require(oracle.code.length > 0, "AuctionHouseV1: oracle is not a contract");
        priceOracle = IPriceOracle(oracle);
        emit PriceOracleUpdated(oracle);
    }

    /// @notice 升级检查，出现异常会阻断升级
    /// @param newImplementation the new implementation address
    function _authorizeUpgrade(address newImplementation) internal virtual override {
        require(msg.sender == owner(), "AuctionHouseV1: only owner can authorize upgrade");
        require(newImplementation != address(0), "AuctionHouseV1: new implementation address is zero");
        require(newImplementation.code.length > 0, "AuctionHouseV1: new implementation is not a contract");
    }

    /** ******************************* 业务逻辑 ********************************************* */
    
    function AuctionHouseVersion() external pure virtual returns (string memory) {
        return "1.0";
    }

    /// @notice 上架拍卖（卖家需先将tokenId授权给拍卖合约）
    /// @param tokenId the token ID（拍卖品的TokenID）
    /// @param payTokenAddress the pay token address（竞价：除ETH以外，还支持一种ERC20 token代币）
    /// @param startPrice the start price（起拍价）
    /// @param duration the duration （拍卖持续时间，单位：秒数）
    function addAuction(uint tokenId, address payTokenAddress, uint startPrice, uint duration) external {
        require(payTokenAddress != address(0), "AuctionHouseV1: payTokenAddress is zero");
        require(payTokenAddress != ETH_ADDRESS, "AuctionHouseV1: payTokenAddress is ETH_ADDRESS");

        require(IERC721(nftContractAddress).ownerOf(tokenId) == msg.sender, "AuctionHouseV1: token owner is not the caller");

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
            state: AuctionState.Active
        });
        emit AuctionAdded(auctionNextId, tokenId);
        auctionNextId++;
    }

    /// @notice 竞价（支持ETH支付和ERC20代币支付，两种支付均通过 PriceOracle 换算为USD进行比较）
    /// @param auctionId the auction ID
    /// @param bidPrice the bid price（代币数量，按代币自身精度）
    function placeBid(uint auctionId, uint bidPrice) external payable nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(auction.state == AuctionState.Active, "AuctionHouseV1: auction is not active");
        require(block.timestamp < auction.endTime, "AuctionHouseV1: auction is over");
        require(auction.highestBidder != msg.sender, "AuctionHouseV1: already the highest bidder");
        require(auction.seller != msg.sender, "AuctionHouseV1: seller can't bid on his own auction");

        // 确定本次竞价使用的支付币种
        address payToken;
        if (msg.value > 0) {
            // 用 ETH 支付
            require(msg.value == bidPrice, "AuctionHouseV1: msg.value != bidPrice");
            require(bidPrice > 0, "AuctionHouseV1: bidPrice is zero");
            payToken = ETH_ADDRESS;
        } else {
            // 用 ERC20 代币支付
            payToken = auction.payTokenAddress;
            require(payToken != address(0), "AuctionHouseV1: payToken not set");
            require(IERC20(payToken).balanceOf(msg.sender) >= bidPrice, "AuctionHouseV1: insufficient balance");
            require(IERC20(payToken).allowance(msg.sender, address(this)) >= bidPrice, "AuctionHouseV1: insufficient allowance");
        }

        // 通过 PriceOracle 将 bidPrice 换算成 USD，确保新出价 > 当前最高出价（以 USD 计价）
        uint256 bidUSD = priceOracle.convertToUSD(payToken, bidPrice);
        require(bidUSD > 0, "AuctionHouseV1: bid USD value is zero");

        if (auction.highestBidder != address(0)) {
            // 存在历史最高出价 → 需比较 USD 价值
            address highestPayToken = auction.payTokenAddress;
            if (auction.highestBid > 0 && auction.highestBidder != address(0)) {
                // 根据 highestPayToken 和 highestBid 换算历史最高出价的USD价值
                uint256 highestUSD = priceOracle.convertToUSD(highestPayToken, auction.highestBid);
                require(bidUSD > highestUSD, "AuctionHouseV1: bid too low in USD value");
            }
        }

        // --- Effects：先更新状态 ---
        // 保存旧出价者信息用于后续退款
        address previousBidder = auction.highestBidder;
        uint256 previousBid = auction.highestBid;

        // 更新最高出价
        auction.highestBid = bidPrice;
        auction.highestBidUSD = bidUSD;
        auction.highestBidder = msg.sender;

        // --- Interactions：再执行外部调用 ---

        // 退还前一个最高出价者
        if (previousBidder != address(0) && previousBidder != msg.sender) {
            _refundBidder(auction.payTokenAddress, previousBidder, previousBid);
        }

        // 如果是 ERC20 支付，立即将代币转入本合约
        if (msg.value == 0) {
            require(
                IERC20(payToken).transferFrom(msg.sender, address(this), bidPrice),
                "AuctionHouseV1: transferFrom failed"
            );
        }
        // ETH 支付已在 msg.value 中自动转入
    }

    /// @notice 紧急取消拍卖(例如拍卖内容涉嫌法律问题)；如果有人出价，退还竞价款
    /// @param auctionId the auction ID
    function cancelAuction(uint auctionId) external onlyOwner nonReentrant {
        Auction storage auction = auctions[auctionId];
        
        // 标记拍卖已取消
        auction.state = AuctionState.Canceled;
        
        // 有人出价，退还竞价款
        if (auction.highestBidder != address(0)){
            _refundBidder(auction.payTokenAddress, auction.highestBidder, auction.highestBid);
        }

        // 紧急取消事件
        emit AuctionCanceled(auctionId);
    }

    /// @notice 结算拍卖
    /// @param auctionId the auction ID
    function settleAuction(uint auctionId) external nonReentrant {
        Auction storage auction = auctions[auctionId];

        require(block.timestamp >= auction.endTime, "AuctionHouseV1: auction not ended");
        require(auction.state == AuctionState.Active, "AuctionHouseV1: auction is not active");

        if (auction.highestBidder == address(0)){
            // 没有出价，拍卖失败
            emit AuctionFailed(auctionId);
            return;
        }else{
            // 有人出价，拍卖成功
            emit AuctionSuccess(auctionId, auction.highestBidder, auction.highestBid);
            
            uint bidPrice = auction.highestBid;

            require(bidPrice > 0, "AuctionHouseV1: no bid placed");
            require(auction.highestBidder != address(0), "AuctionHouseV1: highest bidder is empty");

            // 标记拍卖已结束
            auction.state = AuctionState.Sold;

            // 转移 NFT 给最高出价者（卖家已通过 setApprovalForAll 授权拍卖合约）
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
                    "AuctionHouseV1: ERC20 transfer to seller failed"
                );
            }

        }

        
    }

    /************ internal functions  ***********************/

    /// @notice 退还前一个最高出价者的资金
    /// @param payToken 支付代币地址
    /// @param bidder 出价者地址
    /// @param amount 退款金额
    function _refundBidder(address payToken, address bidder, uint256 amount) private {
        if (payToken == address(0) || payToken == ETH_ADDRESS) {
            // 退还 ETH
            Address.sendValue(payable(bidder), amount);
            // payable(bidder).transfer(amount);
        } else {
            // 退还 ERC20 代币
            require(
                IERC20(payToken).transfer(bidder, amount),
                "AuctionHouseV1: ERC20 refund failed"
            );
        }
    }
}