// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";


/**
 * @title EscrowCore
 * @dev Multi-token escrow contract for marketplace transactions
 */
contract EscrowCore is ReentrancyGuard, AccessControl, Pausable {
    using SafeERC20 for IERC20;

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    
    struct Order {
        string orderId;
        address buyer;
        address seller;
        address token;
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
    
    mapping(string => Order) public orders;
    address public feeVault;
    uint256 public platformFeePercent = 250; // 2.5% (basis points)
    uint256 public constant MAX_FEE_PERCENT = 1000; // 10%
    uint256 public constant ORDER_TIMEOUT = 30 days;
    
    event OrderCreated(
        string indexed orderId, 
        address indexed buyer, 
        address indexed seller, 
        address token,
        uint256 amount,
        uint256 fee
    );
    event OrderCompleted(string indexed orderId);
    event OrderRefunded(string indexed orderId);
    event OrderDisputed(string indexed orderId);
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
     * @dev Deposit tokens into escrow
     */
    function deposit(
        string memory orderId,
        address token,
        uint256 amount,
        address seller
    ) external nonReentrant whenNotPaused {
        require(bytes(orderId).length > 0, "Empty order ID");
        require(orders[orderId].buyer == address(0), "Order already exists");
        require(seller != address(0), "Invalid seller");
        require(amount > 0, "Invalid amount");
        
        uint256 fee = (amount * platformFeePercent) / 10000;
        uint256 sellerAmount = amount - fee;
        
        // Transfer tokens to escrow
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        
        // Store order
        orders[orderId] = Order({
            orderId: orderId,
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
     * @dev Release payment to seller (admin only)
     */
    function releasePayment(string memory orderId) 
        external 
        onlyRole(OPERATOR_ROLE) 
        nonReentrant 
    {
        Order storage order = orders[orderId];
        require(order.status == OrderStatus.Paid, "Invalid status");
        require(block.timestamp < order.expiresAt, "Order expired");
        
        // Transfer to seller
        IERC20(order.token).safeTransfer(order.seller, order.amount);
        
        // Transfer fee to platform
        IERC20(order.token).safeTransfer(feeVault, order.fee);
        
        order.status = OrderStatus.Completed;
        emit OrderCompleted(orderId);
    }
    
    /**
     * @dev Refund payment to buyer (admin only)
     */
    function refund(string memory orderId) 
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
        
        // Refund to buyer (including fee)
        IERC20(order.token).safeTransfer(order.buyer, order.amount + order.fee);
        
        order.status = OrderStatus.Refunded;
        emit OrderRefunded(orderId);
    }
    
    /**
     * @dev Mark order as disputed
     */
    function raiseDispute(string memory orderId) external {
        Order storage order = orders[orderId];
        require(
            msg.sender == order.buyer || msg.sender == order.seller,
            "Not authorized"
        );
        require(order.status == OrderStatus.Paid, "Invalid status");
        
        order.status = OrderStatus.Disputed;
        emit OrderDisputed(orderId);
    }
    
    /**
     * @dev Update platform fee (admin only)
     */
    function updatePlatformFee(uint256 newFeePercent) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        require(newFeePercent <= MAX_FEE_PERCENT, "Fee too high");
        platformFeePercent = newFeePercent;
        emit FeeUpdated(newFeePercent);
    }
    
    /**
     * @dev Update fee vault address (admin only)
     */
    function updateFeeVault(address newVault) 
        external 
        onlyRole(ADMIN_ROLE) 
    {
        require(newVault != address(0), "Invalid vault");
        feeVault = newVault;
        emit FeeVaultUpdated(newVault);
    }
    
    /**
     * @dev Pause contract (admin only)
     */
    function pause() external onlyRole(ADMIN_ROLE) {
        _pause();
    }
    
    /**
     * @dev Unpause contract (admin only)
     */
    function unpause() external onlyRole(ADMIN_ROLE) {
        _unpause();
    }
    
    /**
     * @dev Get order details
     */
    function getOrder(string memory orderId) 
        external 
        view 
        returns (Order memory) 
    {
        return orders[orderId];
    }
}
