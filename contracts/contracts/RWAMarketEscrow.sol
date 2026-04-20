// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./ComplianceRegistry.sol";

/**
 * @title RWAMarketEscrow
 * @notice Fixed-price secondary market for RWA tokens.
 *
 * Flow:
 *  1. Seller approves this contract, then calls listTokens() — tokens escrowed
 *  2. Buyer calls buyListing() sending ETH — tokens transferred, ETH sent to seller
 *  3. Seller can cancelListing() to reclaim escrowed tokens
 *
 * KYC is enforced on both seller (listing) and buyer (buying).
 */
contract RWAMarketEscrow is ReentrancyGuard {
    ComplianceRegistry public immutable compliance;

    struct Listing {
        uint256 id;
        address seller;
        address tokenAddress;
        uint256 tokenAmount;
        uint256 pricePerTokenWei;  // ETH per token (18 decimals)
        bool    active;
        uint256 createdAt;
    }

    uint256 public listingCount;
    mapping(uint256 => Listing) public listings;

    event Listed(uint256 indexed listingId, address indexed seller, address token, uint256 amount, uint256 pricePerToken);
    event Sold(uint256 indexed listingId, address indexed buyer, uint256 amount, uint256 totalPriceWei);
    event Cancelled(uint256 indexed listingId);

    constructor(address compliance_) {
        compliance = ComplianceRegistry(compliance_);
    }

    /**
     * @notice Seller lists tokens for sale. Tokens are escrowed in this contract.
     *         Seller must call token.approve(address(this), amount) first.
     */
    function listTokens(
        address tokenAddress,
        uint256 amount,
        uint256 pricePerTokenWei
    ) external returns (uint256) {
        require(compliance.isVerified(msg.sender), "Market: seller not KYC verified");
        require(amount > 0, "Market: zero amount");
        require(pricePerTokenWei > 0, "Market: zero price");

        // Escrow tokens
        IERC20(tokenAddress).transferFrom(msg.sender, address(this), amount);

        listingCount++;
        listings[listingCount] = Listing({
            id: listingCount,
            seller: msg.sender,
            tokenAddress: tokenAddress,
            tokenAmount: amount,
            pricePerTokenWei: pricePerTokenWei,
            active: true,
            createdAt: block.timestamp
        });

        emit Listed(listingCount, msg.sender, tokenAddress, amount, pricePerTokenWei);
        return listingCount;
    }

    /**
     * @notice Buyer purchases a listed token bundle by sending ETH.
     */
    function buyListing(uint256 listingId) external payable nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "Market: listing not active");
        require(compliance.isVerified(msg.sender), "Market: buyer not KYC verified");

        uint256 totalPrice = (listing.tokenAmount * listing.pricePerTokenWei) / 1e18;
        require(msg.value >= totalPrice, "Market: insufficient payment");

        listing.active = false;

        // Transfer tokens from escrow to buyer
        IERC20(listing.tokenAddress).transfer(msg.sender, listing.tokenAmount);

        // Transfer ETH to seller
        (bool sent,) = listing.seller.call{value: totalPrice}("");
        require(sent, "Market: ETH transfer failed");

        // Refund excess ETH
        if (msg.value > totalPrice) {
            (bool refunded,) = msg.sender.call{value: msg.value - totalPrice}("");
            require(refunded, "Market: refund failed");
        }

        emit Sold(listingId, msg.sender, listing.tokenAmount, totalPrice);
    }

    /**
     * @notice Seller cancels a listing and reclaims escrowed tokens.
     */
    function cancelListing(uint256 listingId) external {
        Listing storage listing = listings[listingId];
        require(listing.active, "Market: listing not active");
        require(listing.seller == msg.sender, "Market: not seller");

        listing.active = false;

        // Return escrowed tokens to seller
        IERC20(listing.tokenAddress).transfer(msg.sender, listing.tokenAmount);

        emit Cancelled(listingId);
    }

    /**
     * @notice View active listings for a token.
     */
    function getActiveListing(uint256 listingId) external view returns (Listing memory) {
        return listings[listingId];
    }
}
