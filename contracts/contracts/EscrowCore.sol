// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

// Interface for DEX Swap (e.g., Uniswap V2 / PancakeSwap Router)
interface ISwapRouter {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
}

/**
 * @title EscrowCore
 * @dev Multi-token escrow contract with Native coin and DEX Swap support
 * Optimized with bytes32 orderIds.
 */
contract EscrowCore is ReentrancyGuard, AccessControl, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    struct Order {
        address buyer;
        address seller;
        address token; // address(0) means native coin (ETH/MATIC/BNB)
        uint256 amount;
        uint256 fee;
        OrderStatus status;
        uint256 createdAt;
        uint256 expiresAt;
    }
    
    enum OrderStatus { 
        Pending, 
        Paid, 
        Completed, 
        Refunded, 
        Disputed,
        Expired
    }
    
    mapping(bytes32 => Order) public orders;
    address public feeVault;
    uint256 public platformFeePercent = 250; // 2.5% (basis points)
    uint256 public constant MAX_FEE_PERCENT = 1000; // 10%
    uint256 public constant ORDER_TIMEOUT = 30 days;
    
    event OrderCreated(
        bytes32 indexed orderId, 
        address indexed buyer, 
        address indexed seller, 
        address token,
        uint256 amount,
        uint256 fee
    );
    event OrderCompleted(bytes32 indexed orderId);
    event OrderRefunded(bytes32 indexed orderId);
    event OrderDisputed(bytes32 indexed orderId);
    event OrderExpired(bytes32 indexed orderId);
    event FeeUpdated(uint256 newFee);
    event FeeVaultUpdated(address newVault);
    
    constructor(address _feeVault) {
        require(_feeVault != address(0), "Invalid fee vault");
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        feeVault = _feeVault;
    }
    
    /**
     * @dev Deposit ERC20 tokens into escrow
     */
    function deposit(
        bytes32 orderId,
        address token,
        uint256 amount,
        address seller
    ) external nonReentrant whenNotPaused {
        require(orderId != bytes32(0), "Empty order ID");
        require(orders[orderId].buyer == address(0), "Order exists");
        require(seller != address(0), "Invalid seller");
        require(amount > 0, "Invalid amount");
        require(token != address(0), "Use depositNative for ETH/MATIC");
        
        uint256 fee = (amount * platformFeePercent) / 10000;
        uint256 sellerAmount = amount - fee;
        
        // Transfer tokens to escrow
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        orders[orderId] = Order({
            buyer: msg.sender,
            seller: seller,
            token: token,
            amount: sellerAmount,
            fee: fee,
            status: OrderStatus.Paid,
            createdAt: block.timestamp,
            expiresAt: block.timestamp + ORDER_TIMEOUT
        });
        
        emit OrderCreated(orderId, msg.sender, seller, token, sellerAmount, fee);
    }

    /**
     * @dev Deposit Native coins (ETH/MATIC/BNB) into escrow
     */
    function depositNative(
        bytes32 orderId,
        address seller
    ) external payable nonReentrant whenNotPaused {
        require(orderId != bytes32(0), "Empty order ID");
        require(orders[orderId].buyer == address(0), "Order exists");
        require(seller != address(0), "Invalid seller");
        require(msg.value > 0, "Invalid value");
        
        uint256 fee = (msg.value * platformFeePercent) / 10000;
        uint256 sellerAmount = msg.value - fee;
        
        orders[orderId] = Order({
            buyer: msg.sender,
            seller: seller,
            token: address(0), // Marker for native token
            amount: sellerAmount,
            fee: fee,
            status: OrderStatus.Paid,
            createdAt: block.timestamp,
            expiresAt: block.timestamp + ORDER_TIMEOUT
        });
        
        emit OrderCreated(orderId, msg.sender, seller, address(0), sellerAmount, fee);
    }

    /**
     * @dev Deposit by swapping an input token to the required token natively
     */
    function depositWithSwap(
        bytes32 orderId,
        address inputToken,
        address requiredToken,
        uint256 amountIn,
        uint256 minAmountOut,
        address seller,
        address routerAddress
    ) external nonReentrant whenNotPaused {
        require(orderId != bytes32(0), "Empty order ID");
        require(orders[orderId].buyer == address(0), "Order exists");
        require(inputToken != address(0) && requiredToken != address(0), "ERC20 only");
        
        // Transfer inputToken to this contract
        IERC20(inputToken).safeTransferFrom(msg.sender, address(this), amountIn);
        
        // Approve router
        IERC20(inputToken).safeIncreaseAllowance(routerAddress, amountIn);
        
        // Setup path for DEX swap
        address[] memory path = new address[](2);
        path[0] = inputToken;
        path[1] = requiredToken;
        
        // Execute swap
        uint[] memory amounts = ISwapRouter(routerAddress).swapExactTokensForTokens(
            amountIn,
            minAmountOut,
            path,
            address(this),
            block.timestamp
        );
        
        uint256 receivedAmount = amounts[1];
        uint256 fee = (receivedAmount * platformFeePercent) / 10000;
        uint256 sellerAmount = receivedAmount - fee;
        
        // Store order as if they deposited the requiredToken directly
        orders[orderId] = Order({
            buyer: msg.sender,
            seller: seller,
            token: requiredToken,
            amount: sellerAmount,
            fee: fee,
            status: OrderStatus.Paid,
            createdAt: block.timestamp,
            expiresAt: block.timestamp + ORDER_TIMEOUT
        });
        
        emit OrderCreated(orderId, msg.sender, seller, requiredToken, sellerAmount, fee);
    }
    
    /**
     * @dev Release payment to seller (admin only)
     */
    function releasePayment(bytes32 orderId) 
        external 
        onlyRole(OPERATOR_ROLE) 
        nonReentrant 
    {
        Order storage order = orders[orderId];
        require(order.status == OrderStatus.Paid, "Invalid status");
        require(block.timestamp < order.expiresAt, "Order expired");
        
        order.status = OrderStatus.Completed;

        if (order.token == address(0)) {
            // Transfer Native
            (bool ok1, ) = order.seller.call{value: order.amount}("");
            require(ok1, "Seller transfer failed");
            (bool ok2, ) = feeVault.call{value: order.fee}("");
            require(ok2, "Fee transfer failed");
        } else {
            // Transfer ERC20
            IERC20(order.token).safeTransfer(order.seller, order.amount);
            IERC20(order.token).safeTransfer(feeVault, order.fee);
        }
        
        emit OrderCompleted(orderId);
    }
    
    /**
     * @dev Refund payment to buyer (admin only)
     */
    function refund(bytes32 orderId) 
        external 
        onlyRole(OPERATOR_ROLE) 
        nonReentrant 
    {
        Order storage order = orders[orderId];
        require(
            order.status == OrderStatus.Paid || 
            order.status == OrderStatus.Disputed, 
            "Invalid status"
        );
        
        order.status = OrderStatus.Refunded;
        uint256 totalRefund = order.amount + order.fee;

        if (order.token == address(0)) {
            (bool ok, ) = order.buyer.call{value: totalRefund}("");
            require(ok, "Refund transfer failed");
        } else {
            IERC20(order.token).safeTransfer(order.buyer, totalRefund);
        }
        
        emit OrderRefunded(orderId);
    }

    /**
     * @dev Auto-refund when order expires (anyone can call)
     */
    function refundExpired(bytes32 orderId) external nonReentrant {
        Order storage order = orders[orderId];
        require(order.status == OrderStatus.Paid, "Invalid status");
        require(block.timestamp >= order.expiresAt, "Not expired yet");

        order.status = OrderStatus.Expired;
        uint256 totalRefund = order.amount + order.fee;

        if (order.token == address(0)) {
            (bool ok, ) = order.buyer.call{value: totalRefund}("");
            require(ok, "Refund transfer failed");
        } else {
            IERC20(order.token).safeTransfer(order.buyer, totalRefund);
        }
        
        emit OrderExpired(orderId);
    }
    
    /**
     * @dev Mark order as disputed
     */
    function raiseDispute(bytes32 orderId) external {
        Order storage order = orders[orderId];
        require(
            msg.sender == order.buyer || msg.sender == order.seller,
            "Not authorized"
        );
        require(order.status == OrderStatus.Paid, "Invalid status");
        
        order.status = OrderStatus.Disputed;
        emit OrderDisputed(orderId);
    }
    
    // Admin functions...
    function updatePlatformFee(uint256 newFeePercent) external onlyRole(ADMIN_ROLE) {
        require(newFeePercent <= MAX_FEE_PERCENT, "Fee too high");
        platformFeePercent = newFeePercent;
        emit FeeUpdated(newFeePercent);
    }
    
    function updateFeeVault(address newVault) external onlyRole(ADMIN_ROLE) {
        require(newVault != address(0), "Invalid vault");
        feeVault = newVault;
        emit FeeVaultUpdated(newVault);
    }
    
    function pause() external onlyRole(ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(ADMIN_ROLE) { _unpause(); }
    
    function getOrder(bytes32 orderId) external view returns (Order memory) {
        return orders[orderId];
    }
}
