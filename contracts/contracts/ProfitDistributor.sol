// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./RWAToken.sol";

/**
 * @title ProfitDistributor
 * @notice Automatic dividend distribution for RWA token holders.
 *
 * Algorithm: "Dividend-Per-Share" (same as Synthetix StakingRewards)
 *   - accRewardPerToken: accumulates profit per token over time
 *   - Each holder's pending = balance × (acc - debtAt(holder))
 *   - O(1) per claim regardless of number of holders
 *
 * Usage flow:
 *   1. Asset manager calls depositProfit(amount) monthly with rental income / bond coupon
 *   2. Investors call claimReward() any time to receive accumulated dividends in ETH
 */
contract ProfitDistributor is AccessControl, ReentrancyGuard, Pausable {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    uint256 private constant PRECISION = 1e18;

    RWAToken public immutable token;

    /* ── Reward tracking ────────────────────────────────────────── */
    uint256 public accRewardPerToken;          // accumulated reward per token (× PRECISION)
    mapping(address => uint256) public rewardDebt;   // user's last-seen accRewardPerToken
    mapping(address => uint256) public claimedTotal; // lifetime claimed per user

    /* ── Stats ──────────────────────────────────────────────────── */
    uint256 public totalProfitDeposited;
    uint256 public totalProfitClaimed;

    struct Distribution {
        uint256 amount;
        uint256 timestamp;
        string  periodDescription; // e.g., "Rental income March 2026"
    }
    Distribution[] public distributionHistory;

    /* ── Events ─────────────────────────────────────────────────── */
    event ProfitDeposited(uint256 amount, uint256 accRewardPerToken, string desc);
    event RewardClaimed(address indexed investor, uint256 amount);

    constructor(address token_, address admin, address factory_) {
        token = RWAToken(token_);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
        // Grant factory temp admin so it can grantRole(OPERATOR) to operator wallet
        if (factory_ != address(0)) {
            _grantRole(DEFAULT_ADMIN_ROLE, factory_);
        }
    }

    receive() external payable {}

    /* ── Deposit profit (called by asset manager / operator) ─────── */
    /**
     * @notice Deposit profit to be distributed pro-rata to all token holders.
     * @param desc Human-readable description (e.g., "Q1 2026 rental income")
     */
    function depositProfit(string calldata desc) external payable onlyRole(OPERATOR_ROLE) {
        require(msg.value > 0, "ProfitDistributor: zero deposit");
        uint256 supply = token.totalSupply();
        require(supply > 0, "ProfitDistributor: no tokens issued yet");

        accRewardPerToken += (msg.value * PRECISION) / supply;
        totalProfitDeposited += msg.value;

        distributionHistory.push(Distribution({
            amount:            msg.value,
            timestamp:         block.timestamp,
            periodDescription: desc
        }));

        emit ProfitDeposited(msg.value, accRewardPerToken, desc);
    }

    /* ── Claim reward (called by token holders) ──────────────────── */
    /**
     * @notice Claim accumulated dividends. Callable any time.
     */
    function claimReward() external nonReentrant whenNotPaused {
        uint256 pending = pendingReward(msg.sender);
        require(pending > 0, "ProfitDistributor: nothing to claim");

        rewardDebt[msg.sender] = accRewardPerToken;
        claimedTotal[msg.sender] += pending;
        totalProfitClaimed += pending;

        (bool ok,) = payable(msg.sender).call{value: pending}("");
        require(ok, "ProfitDistributor: ETH transfer failed");

        emit RewardClaimed(msg.sender, pending);
    }

    /* ── View: pending reward ────────────────────────────────────── */
    /**
     * @param investor Address to query
     * @return Claimable ETH in wei
     */
    function pendingReward(address investor) public view returns (uint256) {
        uint256 balance = token.balanceOf(investor);
        if (balance == 0) return 0;
        uint256 unrealized = accRewardPerToken - rewardDebt[investor];
        return (balance * unrealized) / PRECISION;
    }

    /* ── Hook: update debt on token transfer ─────────────────────── */
    /**
     * @notice Called by RWAToken on every transfer to settle debt for both parties.
     *         Must be called before balance changes (pre-transfer hook).
     */
    function settleOnTransfer(address from, address to) external {
        require(msg.sender == address(token), "ProfitDistributor: only token");
        // Settle sender's pending so they don't lose unclaimed rewards
        if (from != address(0) && token.balanceOf(from) > 0) {
            rewardDebt[from] = accRewardPerToken;
        }
        // Initialize receiver's debt so they only earn from this point forward
        if (to != address(0)) {
            rewardDebt[to] = accRewardPerToken;
        }
    }

    /* ── Admin ───────────────────────────────────────────────────── */
    function pause()   external onlyRole(OPERATOR_ROLE) { _pause(); }
    function unpause() external onlyRole(OPERATOR_ROLE) { _unpause(); }

    /// @notice Emergency: withdraw stuck ETH (e.g. from a bad deposit)
    function emergencyWithdraw(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        (bool ok,) = payable(msg.sender).call{value: amount}("");
        require(ok, "ProfitDistributor: withdraw failed");
    }

    /* ── View: history ──────────────────────────────────────────── */
    function distributionCount() external view returns (uint256) {
        return distributionHistory.length;
    }

    function getDistributionHistory(uint256 from_, uint256 to_)
        external view returns (Distribution[] memory)
    {
        require(to_ <= distributionHistory.length, "out of range");
        Distribution[] memory result = new Distribution[](to_ - from_);
        for (uint256 i = from_; i < to_; i++) {
            result[i - from_] = distributionHistory[i];
        }
        return result;
    }
}
