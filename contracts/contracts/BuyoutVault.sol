// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BuyoutVault
 * @notice Handles asset buyout with Merkle-claim settlement.
 *
 * Flow:
 *  1. Governance proposal passes (INITIATE_BUYOUT)
 *  2. Buyer calls initiateBuyout() depositing ETH = pricePerToken × totalSupply
 *  3. Operator takes off-chain snapshot of all holder balances
 *  4. Operator submits Merkle root via setMerkleRoot()
 *  5. Holders claim their pro-rata ETH share via claimProceeds()
 *  6. After claim deadline, buyer sweeps unclaimed ETH
 */
contract BuyoutVault is AccessControl, ReentrancyGuard {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    enum BuyoutStatus { NONE, INITIATED, FINALIZED, SETTLED }

    address public tokenAddress;
    address public buyer;
    uint256 public buyoutPricePerToken;  // in wei
    uint256 public totalBuyoutPrice;     // total ETH deposited
    uint256 public totalClaimed;
    bytes32 public merkleRoot;
    uint256 public claimDeadline;
    BuyoutStatus public status;

    uint256 public constant CLAIM_PERIOD = 30 days;

    mapping(address => bool) public hasClaimed;

    event BuyoutInitiated(address indexed buyer, uint256 pricePerToken, uint256 totalPrice);
    event MerkleRootSet(bytes32 root, uint256 deadline);
    event ProceedsClaimed(address indexed holder, uint256 amount);
    event UnclaimedSwept(address indexed buyer, uint256 amount);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
    }

    /**
     * @notice Buyer initiates buyout by depositing full buyout amount.
     * @param token_  The RWAToken address being bought out
     * @param pricePerToken_  Price per token in wei
     * @param expectedTotalTokens  Expected total supply (for validation)
     */
    function initiateBuyout(
        address token_,
        uint256 pricePerToken_,
        uint256 expectedTotalTokens
    ) external payable {
        require(status == BuyoutStatus.NONE, "BuyoutVault: already initiated");
        require(pricePerToken_ > 0, "BuyoutVault: zero price");

        uint256 requiredDeposit = pricePerToken_ * expectedTotalTokens / 1e18;
        require(msg.value >= requiredDeposit, "BuyoutVault: insufficient deposit");

        tokenAddress = token_;
        buyer = msg.sender;
        buyoutPricePerToken = pricePerToken_;
        totalBuyoutPrice = msg.value;
        status = BuyoutStatus.INITIATED;

        emit BuyoutInitiated(msg.sender, pricePerToken_, msg.value);
    }

    /**
     * @notice Operator sets Merkle root after taking off-chain snapshot.
     *         Leaf: keccak256(abi.encodePacked(holderAddress, tokenBalance))
     */
    function setMerkleRoot(bytes32 root) external onlyRole(OPERATOR_ROLE) {
        require(status == BuyoutStatus.INITIATED, "BuyoutVault: not initiated");
        require(root != bytes32(0), "BuyoutVault: empty root");

        merkleRoot = root;
        claimDeadline = block.timestamp + CLAIM_PERIOD;
        status = BuyoutStatus.FINALIZED;

        emit MerkleRootSet(root, claimDeadline);
    }

    /**
     * @notice Holder claims their pro-rata ETH share.
     * @param tokenBalance  Holder's token balance at snapshot
     * @param proof  Merkle proof for (msg.sender, tokenBalance)
     */
    function claimProceeds(
        uint256 tokenBalance,
        bytes32[] calldata proof
    ) external nonReentrant {
        require(status == BuyoutStatus.FINALIZED, "BuyoutVault: not finalized");
        require(block.timestamp <= claimDeadline, "BuyoutVault: claim period expired");
        require(!hasClaimed[msg.sender], "BuyoutVault: already claimed");

        // Verify Merkle proof
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, tokenBalance));
        require(MerkleProof.verify(proof, merkleRoot, leaf), "BuyoutVault: invalid proof");

        hasClaimed[msg.sender] = true;

        // Calculate pro-rata ETH: (tokenBalance / totalSupply) × totalBuyoutPrice
        // Since we don't know totalSupply on-chain here, we use pricePerToken
        uint256 payout = (tokenBalance * buyoutPricePerToken) / 1e18;
        require(payout > 0, "BuyoutVault: zero payout");

        totalClaimed += payout;

        (bool sent,) = msg.sender.call{value: payout}("");
        require(sent, "BuyoutVault: ETH transfer failed");

        emit ProceedsClaimed(msg.sender, payout);
    }

    /**
     * @notice After claim deadline, buyer sweeps unclaimed ETH.
     */
    function sweepUnclaimed() external {
        require(msg.sender == buyer, "BuyoutVault: not buyer");
        require(status == BuyoutStatus.FINALIZED, "BuyoutVault: not finalized");
        require(block.timestamp > claimDeadline, "BuyoutVault: claim period active");

        status = BuyoutStatus.SETTLED;
        uint256 remaining = address(this).balance;

        if (remaining > 0) {
            (bool sent,) = buyer.call{value: remaining}("");
            require(sent, "BuyoutVault: ETH transfer failed");
            emit UnclaimedSwept(buyer, remaining);
        }
    }

    receive() external payable {}
}
