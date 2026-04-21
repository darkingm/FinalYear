// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title GovernanceRWA interface (minimal — for proposal verification)
 */
interface IGovernanceRWA {
    function verifyPassedProposal(uint256 proposalId, bytes32 expectedHash) external view returns (bool);
}

/**
 * @title BuyoutVault
 * @notice Handles governance-gated asset buyout with Merkle-claim settlement.
 *
 * Security model:
 *   - initiateBuyout() requires OPERATOR_ROLE and a PASSED governance proposal
 *     whose executionHash matches the buyout terms.
 *   - Each proposal can only be consumed ONCE (prevents replay).
 *   - Merkle root for claims is submitted by operator after off-chain snapshot.
 *   - Holders claim pro-rata ETH via Merkle proof.
 *
 * Flow:
 *  1. Governance proposal (INITIATE_BUYOUT) passes with executionHash
 *  2. Operator calls initiateBuyout() referencing the passed proposalId
 *  3. Contract verifies proposal is PASSED and hash matches buyout terms
 *  4. Operator takes off-chain snapshot, submits Merkle root
 *  5. Holders claim their pro-rata ETH share via claimProceeds()
 *  6. After claim deadline, buyer sweeps unclaimed ETH
 */
contract BuyoutVault is AccessControl, ReentrancyGuard {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    enum BuyoutStatus { NONE, INITIATED, FINALIZED, SETTLED }

    /* ── Governance linkage ─────────────────────────────────── */
    IGovernanceRWA public governanceContract;
    uint256 public consumedProposalId;    // the proposal that authorized this buyout

    /* ── Buyout state ──────────────────────────────────────── */
    address public tokenAddress;
    address public buyer;
    uint256 public buyoutPricePerToken;   // in wei
    uint256 public snapshotBlock;         // block used for holder snapshot
    uint256 public approvedTotalSupply;   // total supply at snapshot
    uint256 public totalBuyoutPrice;      // total ETH deposited
    uint256 public totalClaimed;
    bytes32 public merkleRoot;
    uint256 public claimDeadline;
    BuyoutStatus public status;

    uint256 public constant CLAIM_PERIOD = 30 days;

    mapping(address => bool) public hasClaimed;
    mapping(uint256 => bool) public usedProposals;  // prevent proposal replay

    event BuyoutInitiated(address indexed buyer, uint256 proposalId, uint256 pricePerToken, uint256 totalPrice);
    event MerkleRootSet(bytes32 root, uint256 deadline);
    event ProceedsClaimed(address indexed holder, uint256 amount);
    event UnclaimedSwept(address indexed buyer, uint256 amount);

    constructor(address admin, address governance_) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
        governanceContract = IGovernanceRWA(governance_);
    }

    /**
     * @notice Compute the execution hash that must match the governance proposal.
     *         Frontend/operator computes this when creating the proposal, and again
     *         when calling initiateBuyout(). Contract verifies they match.
     */
    function computeExecutionHash(
        address vault_,
        address token_,
        uint256 pricePerToken_,
        uint256 snapshotBlock_,
        uint256 totalSupply_
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(vault_, token_, pricePerToken_, snapshotBlock_, totalSupply_));
    }

    /**
     * @notice Initiate buyout — governance-gated.
     * @param token_             The RWAToken address being bought out
     * @param pricePerToken_     Price per token in wei
     * @param snapshotBlock_     Block number used for holder balance snapshot
     * @param totalSupply_       Total token supply at snapshot
     * @param governanceProposalId  ID of the PASSED governance proposal authorizing this
     */
    function initiateBuyout(
        address token_,
        uint256 pricePerToken_,
        uint256 snapshotBlock_,
        uint256 totalSupply_,
        uint256 governanceProposalId
    ) external payable onlyRole(OPERATOR_ROLE) {
        require(status == BuyoutStatus.NONE, "BuyoutVault: already initiated");
        require(pricePerToken_ > 0, "BuyoutVault: zero price");
        require(totalSupply_ > 0, "BuyoutVault: zero supply");

        // ── Governance verification ──────────────────────────────
        require(!usedProposals[governanceProposalId], "BuyoutVault: proposal already consumed");

        bytes32 expectedHash = computeExecutionHash(
            address(this), token_, pricePerToken_, snapshotBlock_, totalSupply_
        );
        require(
            governanceContract.verifyPassedProposal(governanceProposalId, expectedHash),
            "BuyoutVault: governance proposal not passed or hash mismatch"
        );

        // Mark proposal as consumed — prevents replay
        usedProposals[governanceProposalId] = true;
        consumedProposalId = governanceProposalId;

        // ── Deposit verification ─────────────────────────────────
        uint256 requiredDeposit = pricePerToken_ * totalSupply_ / 1e18;
        require(msg.value >= requiredDeposit, "BuyoutVault: insufficient deposit");

        tokenAddress = token_;
        buyer = msg.sender;
        buyoutPricePerToken = pricePerToken_;
        snapshotBlock = snapshotBlock_;
        approvedTotalSupply = totalSupply_;
        totalBuyoutPrice = msg.value;
        status = BuyoutStatus.INITIATED;

        emit BuyoutInitiated(msg.sender, governanceProposalId, pricePerToken_, msg.value);
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

        // Calculate pro-rata ETH using buyoutPricePerToken
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

    /**
     * @notice Update governance contract address (admin only, for upgrades)
     */
    function setGovernanceContract(address governance_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(governance_ != address(0), "BuyoutVault: zero address");
        governanceContract = IGovernanceRWA(governance_);
    }

    receive() external payable {}
}
