// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";

/**
 * @title GovernanceRWA
 * @notice On-chain governance for RWA assets. Token holders create proposals
 *         and vote using snapshot-based voting power (ERC20Votes).
 *
 * Proposal types & thresholds:
 *   - GENERAL / UPDATE_VALUATION / DISTRIBUTE_PROFIT: 50% simple majority
 *   - SELL_ASSET / INITIATE_BUYOUT / REPLACE_OPERATOR: 67% supermajority
 *
 * Flow: createProposal → castVote (during voting period) → executeProposal
 *
 * Actionable proposals (INITIATE_BUYOUT, SELL_ASSET) carry an executionHash
 * that downstream contracts (BuyoutVault) verify before accepting deposits.
 */
contract GovernanceRWA is AccessControl {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    ERC20Votes public immutable token;

    enum ProposalType {
        GENERAL,
        UPDATE_VALUATION,
        DISTRIBUTE_PROFIT,
        SELL_ASSET,
        INITIATE_BUYOUT,
        REPLACE_OPERATOR
    }

    enum ProposalStatus { ACTIVE, PASSED, REJECTED, EXECUTED, CANCELLED }

    struct Proposal {
        uint256        id;
        address        proposer;
        ProposalType   proposalType;
        string         description;
        string         ipfsDoc;         // IPFS CID for detailed proposal doc
        bytes32        executionHash;   // hash of structured execution params (for actionable proposals)
        uint256        snapshotBlock;   // block at which voting power is measured
        uint256        forVotes;        // total votes FOR (in token units)
        uint256        againstVotes;    // total votes AGAINST
        uint256        deadline;        // timestamp after which voting ends
        ProposalStatus status;
        bool           executed;
    }

    /* ── Config (per deployment, set at construction) ──────────── */
    uint256 public quorumPercent;         // e.g. 50
    uint256 public supermajorityPercent;  // e.g. 67
    uint256 public votingPeriod;          // seconds (default 48h)
    uint256 public proposalThresholdBps;  // min token % to propose (basis points, 100 = 1%)

    /* ── State ────────────────────────────────────────────────── */
    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;
    mapping(uint256 => mapping(address => bool)) public hasVoted;

    /* ── Events ───────────────────────────────────────────────── */
    event ProposalCreated(uint256 indexed id, address indexed proposer, ProposalType pType, string description, bytes32 executionHash, uint256 deadline);
    event VoteCast(uint256 indexed proposalId, address indexed voter, bool support, uint256 weight);
    event ProposalExecuted(uint256 indexed id);
    event ProposalCancelled(uint256 indexed id);

    constructor(
        address token_,
        address admin,
        uint256 quorum_,           // e.g. 50
        uint256 supermajority_,    // e.g. 67
        uint256 votingPeriod_,     // e.g. 172800 (48h)
        uint256 thresholdBps_      // e.g. 100 (1%)
    ) {
        token = ERC20Votes(token_);
        quorumPercent = quorum_;
        supermajorityPercent = supermajority_;
        votingPeriod = votingPeriod_;
        proposalThresholdBps = thresholdBps_;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
    }

    /**
     * @notice Create a proposal. Actionable proposals (INITIATE_BUYOUT, SELL_ASSET)
     *         MUST include an executionHash = keccak256(abi.encodePacked(
     *             vaultAddress, tokenAddress, pricePerToken, snapshotBlock, totalSupply
     *         )).
     *         Non-actionable proposals pass bytes32(0).
     */
    function createProposal(
        ProposalType pType,
        string calldata description,
        string calldata ipfsDoc,
        bytes32 executionHash
    ) external returns (uint256) {
        return _createProposal(msg.sender, pType, description, ipfsDoc, executionHash);
    }

    /**
     * @notice Backward-compatible overload without executionHash (for non-actionable proposals)
     */
    function createProposal(
        ProposalType pType,
        string calldata description,
        string calldata ipfsDoc
    ) external returns (uint256) {
        require(!_isActionableType(pType), "Gov: actionable proposal requires executionHash");
        return _createProposal(msg.sender, pType, description, ipfsDoc, bytes32(0));
    }

    /**
     * @dev Internal implementation — preserves the real caller as proposer.
     *      Previously the 3-param overload used `this.createProposal(...)` which
     *      made msg.sender = address(this), breaking the proposer identity.
     */
    function _createProposal(
        address proposer,
        ProposalType pType,
        string calldata description,
        string calldata ipfsDoc,
        bytes32 executionHash
    ) internal returns (uint256) {
        uint256 supply = token.totalSupply();
        require(supply > 0, "Gov: no tokens issued");

        // Check proposer has enough voting power
        uint256 voterBalance = token.balanceOf(proposer);
        uint256 threshold = (supply * proposalThresholdBps) / 10000;
        require(voterBalance >= threshold, "Gov: below proposal threshold");

        // Actionable proposals must carry execution params hash
        if (_isActionableType(pType)) {
            require(executionHash != bytes32(0), "Gov: actionable proposal requires executionHash");
        }

        proposalCount++;
        uint256 id = proposalCount;

        proposals[id] = Proposal({
            id:            id,
            proposer:      proposer,
            proposalType:  pType,
            description:   description,
            ipfsDoc:       ipfsDoc,
            executionHash: executionHash,
            snapshotBlock: block.number - 1,
            forVotes:      0,
            againstVotes:  0,
            deadline:      block.timestamp + votingPeriod,
            status:        ProposalStatus.ACTIVE,
            executed:      false
        });

        emit ProposalCreated(id, proposer, pType, description, executionHash, block.timestamp + votingPeriod);
        return id;
    }

    /* ── Cast Vote ────────────────────────────────────────────── */
    function castVote(uint256 proposalId, bool support) external {
        Proposal storage p = proposals[proposalId];
        require(p.id > 0, "Gov: proposal not found");
        require(p.status == ProposalStatus.ACTIVE, "Gov: not active");
        require(block.timestamp <= p.deadline, "Gov: voting ended");
        require(!hasVoted[proposalId][msg.sender], "Gov: already voted");

        // Get voting power from snapshot block
        uint256 weight = token.getPastVotes(msg.sender, p.snapshotBlock);
        require(weight > 0, "Gov: no voting power at snapshot");

        hasVoted[proposalId][msg.sender] = true;

        if (support) {
            p.forVotes += weight;
        } else {
            p.againstVotes += weight;
        }

        emit VoteCast(proposalId, msg.sender, support, weight);
    }

    /* ── Execute Proposal ─────────────────────────────────────── */
    function executeProposal(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        require(p.id > 0, "Gov: proposal not found");
        require(p.status == ProposalStatus.ACTIVE, "Gov: not active");
        require(block.timestamp > p.deadline, "Gov: voting not ended");

        // Determine required threshold
        uint256 requiredPercent = _isSupermajorityType(p.proposalType)
            ? supermajorityPercent
            : quorumPercent;

        uint256 totalVotes = p.forVotes + p.againstVotes;
        uint256 supply = token.getPastTotalSupply(p.snapshotBlock);

        // Check quorum: total votes must be >= quorumPercent of supply
        bool quorumMet = totalVotes * 100 >= supply * quorumPercent;

        // Check majority: forVotes must be >= requiredPercent of total votes
        bool majorityMet = totalVotes > 0 && p.forVotes * 100 >= totalVotes * requiredPercent;

        if (quorumMet && majorityMet) {
            p.status = ProposalStatus.PASSED;
            p.executed = true;
            emit ProposalExecuted(proposalId);
        } else {
            p.status = ProposalStatus.REJECTED;
        }
    }

    /* ── Cancel (proposer or admin) ───────────────────────────── */
    function cancelProposal(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        require(p.status == ProposalStatus.ACTIVE, "Gov: not active");
        require(
            msg.sender == p.proposer || hasRole(OPERATOR_ROLE, msg.sender),
            "Gov: not proposer or operator"
        );
        p.status = ProposalStatus.CANCELLED;
        emit ProposalCancelled(proposalId);
    }

    /* ── View helpers ─────────────────────────────────────────── */
    function getProposal(uint256 id) external view returns (Proposal memory) {
        return proposals[id];
    }

    function getVotingPower(address voter, uint256 proposalId) external view returns (uint256) {
        Proposal storage p = proposals[proposalId];
        if (p.id == 0) return 0;
        return token.getPastVotes(voter, p.snapshotBlock);
    }

    /**
     * @notice Verify that a proposal with the given ID is PASSED and its
     *         executionHash matches the expected hash. Used by BuyoutVault
     *         to gate buyout initiation to governance-approved terms.
     */
    function verifyPassedProposal(
        uint256 proposalId,
        bytes32 expectedHash
    ) external view returns (bool) {
        Proposal storage p = proposals[proposalId];
        return p.id > 0
            && p.status == ProposalStatus.PASSED
            && p.executionHash == expectedHash;
    }

    function _isSupermajorityType(ProposalType t) internal pure returns (bool) {
        return t == ProposalType.SELL_ASSET
            || t == ProposalType.INITIATE_BUYOUT
            || t == ProposalType.REPLACE_OPERATOR;
    }

    function _isActionableType(ProposalType t) internal pure returns (bool) {
        return t == ProposalType.SELL_ASSET
            || t == ProposalType.INITIATE_BUYOUT;
    }
}
