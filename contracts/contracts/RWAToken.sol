// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./ComplianceRegistry.sol";

interface IProfitDistributor {
    function settleOnTransfer(address from, address to) external;
}

/**
 * @title RWAToken
 * @notice ERC-20 Security Token representing fractional ownership of a real-world asset.
 *
 *  - Minting:    only ISSUER_ROLE
 *  - Transfers:  enforce KYC whitelist on BOTH sender AND recipient
 *  - Pausing:    OPERATOR_ROLE can freeze all transfers in emergency
 *  - Dividends:  hooks into ProfitDistributor.settleOnTransfer() on every balance change
 *  - Investor cap: prevents exceeding max holder count (Reg CF / Reg D compliance)
 *  - NAV Oracle: operator proposes valuation, 48h timelock before execution
 */
contract RWAToken is ERC20, AccessControl, Pausable {
    bytes32 public constant ISSUER_ROLE   = keccak256("ISSUER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    enum AssetType { REAL_ESTATE, BOND, EQUITY, COMMODITY }

    /* ── Immutable asset metadata ─────────────────────────────── */
    string    public assetId;           // UUID (matches DB primary key)
    AssetType public assetType;
    string    public legalDocIPFS;      // IPFS CID of legal package
    uint256   public totalValuationUSD; // USD × 1e6 (6 decimals)
    uint256   public pricePerTokenUSD;  // USD × 1e6 — fixed at issuance

    ComplianceRegistry  public immutable compliance;
    IProfitDistributor  public distributor; // set after deploy via setDistributor()

    /* ── Investor cap (Reg CF / Reg D compliance) ─────────────── */
    uint256 public maxInvestors = 100;
    uint256 public currentInvestorCount;
    mapping(address => bool) private _isHolder;

    /* ── NAV Oracle — timelocked valuation update ─────────────── */
    uint256 public pendingValuationUSD;
    uint256 public valuationUpdateAvailableAt; // 0 = no pending update
    uint256 public constant VALUATION_TIMELOCK = 48 hours;

    /* ── Events ────────────────────────────────────────────────── */
    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);
    event ValuationProposed(uint256 newVal, uint256 executeAfter);
    event ValuationExecuted(uint256 oldVal, uint256 newVal);
    event LegalDocUpdated(string oldCID, string newCID);
    event DistributorSet(address distributor);
    event MaxInvestorsUpdated(uint256 oldMax, uint256 newMax);
    event InvestorCapReached(uint256 cap);

    constructor(
        string      memory name_,
        string      memory symbol_,
        string      memory assetId_,
        AssetType          assetType_,
        string      memory legalDocIPFS_,
        uint256            totalValuationUSD_,
        uint256            pricePerTokenUSD_,
        address            compliance_,
        address            admin,
        address            factory_   // RWAFactory — gets temp admin to grantRole then renounces
    ) ERC20(name_, symbol_) {
        assetId           = assetId_;
        assetType         = assetType_;
        legalDocIPFS      = legalDocIPFS_;
        totalValuationUSD = totalValuationUSD_;
        pricePerTokenUSD  = pricePerTokenUSD_;
        compliance        = ComplianceRegistry(compliance_);

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE,        admin);
        _grantRole(OPERATOR_ROLE,      admin);

        if (factory_ != address(0)) {
            _grantRole(DEFAULT_ADMIN_ROLE, factory_);
        }
    }

    /* ── Distributor link ────────────────────────────────────────── */
    /// @notice Link ProfitDistributor — called by RWAFactory after deploying both contracts.
    function setDistributor(address distributor_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(distributor_ != address(0), "RWAToken: zero address");
        distributor = IProfitDistributor(distributor_);
        emit DistributorSet(distributor_);
    }

    /* ── Mint / Burn ────────────────────────────────────────────── */
    function mint(address to, uint256 amount) external onlyRole(ISSUER_ROLE) whenNotPaused {
        require(compliance.isVerified(to), "RWAToken: recipient not KYC verified");
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    function burn(address from, uint256 amount) external onlyRole(OPERATOR_ROLE) {
        _burn(from, amount);
        emit TokensBurned(from, amount);
    }

    /* ── Transfer restrictions ──────────────────────────────────── */
    function _update(address from, address to, uint256 amount) internal override whenNotPaused {
        // ── 1. Settle reward debt BEFORE balance changes ─────────
        //    This ensures DPS accounting is correct on transfer/mint/burn.
        if (address(distributor) != address(0)) {
            try distributor.settleOnTransfer(from, to) {} catch {}
        }

        // ── 2. KYC enforcement — check BOTH from AND to ──────────
        if (from != address(0) && to != address(0)) {
            // Sender must still be KYC-verified to send (handles revocations)
            require(compliance.isVerified(from), "RWAToken: sender not KYC verified");
            require(compliance.isVerified(to),   "RWAToken: recipient not KYC verified");
        } else if (to != address(0) && from == address(0)) {
            // Mint: only check recipient
            require(compliance.isVerified(to), "RWAToken: recipient not KYC verified");
        }

        // ── 3. Investor cap — track unique holders ────────────────
        if (to != address(0) && !_isHolder[to] && balanceOf(to) == 0 && amount > 0) {
            require(currentInvestorCount < maxInvestors, "RWAToken: investor cap reached");
            currentInvestorCount++;
            _isHolder[to] = true;
        }

        super._update(from, to, amount);

        // Decrease holder count when balance drops to 0
        if (from != address(0) && balanceOf(from) == 0 && _isHolder[from]) {
            _isHolder[from] = false;
            if (currentInvestorCount > 0) currentInvestorCount--;
        }
    }

    /* ── Emergency Stop ─────────────────────────────────────────── */
    function pause()   external onlyRole(OPERATOR_ROLE) { _pause(); }
    function unpause() external onlyRole(OPERATOR_ROLE) { _unpause(); }

    /* ── NAV Oracle — timelocked valuation update ────────────────── */
    /**
     * @notice Propose a new asset valuation. Effective after 48h timelock.
     *         Off-chain: this should be accompanied by a signed appraisal report (IPFS).
     */
    function proposeValuation(uint256 newValUSD) external onlyRole(OPERATOR_ROLE) {
        require(newValUSD > 0, "RWAToken: zero valuation");
        pendingValuationUSD = newValUSD;
        valuationUpdateAvailableAt = block.timestamp + VALUATION_TIMELOCK;
        emit ValuationProposed(newValUSD, valuationUpdateAvailableAt);
    }

    /**
     * @notice Execute the pending valuation update after the timelock expires.
     *         Anyone can call this — execution is permissionless once timelock expires.
     */
    function executeValuation() external {
        require(valuationUpdateAvailableAt > 0,          "RWAToken: no pending valuation");
        require(block.timestamp >= valuationUpdateAvailableAt, "RWAToken: timelock not expired");
        uint256 old = totalValuationUSD;
        totalValuationUSD = pendingValuationUSD;
        valuationUpdateAvailableAt = 0;
        emit ValuationExecuted(old, totalValuationUSD);
    }

    /// @notice Cancel a pending valuation (e.g., wrong value submitted)
    function cancelValuation() external onlyRole(OPERATOR_ROLE) {
        valuationUpdateAvailableAt = 0;
        pendingValuationUSD = 0;
    }

    /* ── Admin ─────────────────────────────────────────────────── */
    function updateLegalDoc(string calldata newCID) external onlyRole(OPERATOR_ROLE) {
        emit LegalDocUpdated(legalDocIPFS, newCID);
        legalDocIPFS = newCID;
    }

    function setMaxInvestors(uint256 newMax) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newMax >= currentInvestorCount, "RWAToken: below current count");
        emit MaxInvestorsUpdated(maxInvestors, newMax);
        maxInvestors = newMax;
    }

    /* ── View ────────────────────────────────────────────────────── */
    /// @notice Total tokens that should be issued = totalValuation / pricePerToken
    function maxSupply() external view returns (uint256) {
        if (pricePerTokenUSD == 0) return 0;
        return totalValuationUSD / pricePerTokenUSD;
    }

    /// @notice Tokens remaining to be sold
    function tokensAvailable() external view returns (uint256) {
        uint256 max = this.maxSupply();
        uint256 ts = totalSupply();
        return max > ts ? max - ts : 0;
    }

    /// @notice true if a pending valuation is in the timelock window
    function hasPendingValuation() external view returns (bool) {
        return valuationUpdateAvailableAt > 0;
    }
}
