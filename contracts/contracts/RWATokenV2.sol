// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/Nonces.sol";
import "./ComplianceRegistry.sol";

interface IProfitDistributorV2 {
    function settleOnTransfer(address from, address to) external;
}

/**
 * @title RWATokenV2
 * @notice ERC-20 Security Token with ERC20Votes for governance support.
 *         Backward-compatible with ProfitDistributor.
 *
 *  - Minting:    only ISSUER_ROLE, enforces supply cap
 *  - Transfers:  enforce KYC whitelist on BOTH sender AND recipient
 *  - Pausing:    OPERATOR_ROLE can freeze all transfers in emergency
 *  - Dividends:  hooks into ProfitDistributor.settleOnTransfer()
 *  - Governance: ERC20Votes + ERC20Permit for snapshot-based voting
 *  - Investor cap: prevents exceeding max holder count
 *  - NAV Oracle: operator proposes valuation, 48h timelock
 */
contract RWATokenV2 is ERC20, ERC20Permit, ERC20Votes, AccessControl, Pausable {
    bytes32 public constant ISSUER_ROLE   = keccak256("ISSUER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    enum AssetType { REAL_ESTATE, BOND, EQUITY, COMMODITY }

    /* ── Immutable asset metadata ─────────────────────────────── */
    string    public assetId;
    AssetType public assetType;
    string    public legalDocIPFS;
    uint256   public totalValuationUSD;
    uint256   public pricePerTokenUSD;

    ComplianceRegistry  public immutable compliance;
    IProfitDistributorV2 public distributor;

    /* ── Investor cap ─────────────────────────────────────────── */
    uint256 public maxInvestors = 100;
    uint256 public currentInvestorCount;
    mapping(address => bool) private _isHolder;

    /* ── NAV Oracle ───────────────────────────────────────────── */
    uint256 public pendingValuationUSD;
    uint256 public valuationUpdateAvailableAt;
    uint256 public constant VALUATION_TIMELOCK = 48 hours;

    /* ── Events ───────────────────────────────────────────────── */
    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);
    event ValuationProposed(uint256 newVal, uint256 executeAfter);
    event ValuationExecuted(uint256 oldVal, uint256 newVal);
    event LegalDocUpdated(string oldCID, string newCID);
    event DistributorSet(address distributor);
    event MaxInvestorsUpdated(uint256 oldMax, uint256 newMax);

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
        address            factory_
    ) ERC20(name_, symbol_) ERC20Permit(name_) {
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

    /* ── Distributor link ──────────────────────────────────────── */
    function setDistributor(address distributor_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(distributor_ != address(0), "RWATokenV2: zero address");
        distributor = IProfitDistributorV2(distributor_);
        emit DistributorSet(distributor_);
    }

    /* ── Mint / Burn ──────────────────────────────────────────── */
    function mint(address to, uint256 amount) external onlyRole(ISSUER_ROLE) whenNotPaused {
        require(compliance.isVerified(to), "RWATokenV2: recipient not KYC verified");
        require(
            pricePerTokenUSD > 0 && totalSupply() + amount <= this.maxSupply(),
            "RWATokenV2: would exceed max supply"
        );
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    function burn(address from, uint256 amount) external onlyRole(OPERATOR_ROLE) {
        _burn(from, amount);
        emit TokensBurned(from, amount);
    }

    /* ── Transfer restrictions ────────────────────────────────── */
    function _update(address from, address to, uint256 amount) internal override(ERC20, ERC20Votes) whenNotPaused {
        // 1. Settle reward debt BEFORE balance changes
        if (address(distributor) != address(0)) {
            try distributor.settleOnTransfer(from, to) {} catch {}
        }

        // 2. KYC enforcement
        if (from != address(0) && to != address(0)) {
            require(compliance.isVerified(from), "RWATokenV2: sender not KYC verified");
            require(compliance.isVerified(to),   "RWATokenV2: recipient not KYC verified");
        } else if (to != address(0) && from == address(0)) {
            require(compliance.isVerified(to), "RWATokenV2: recipient not KYC verified");
        }

        // 3. Investor cap
        if (to != address(0) && !_isHolder[to] && balanceOf(to) == 0 && amount > 0) {
            require(currentInvestorCount < maxInvestors, "RWATokenV2: investor cap reached");
            currentInvestorCount++;
            _isHolder[to] = true;
        }

        super._update(from, to, amount);

        if (from != address(0) && balanceOf(from) == 0 && _isHolder[from]) {
            _isHolder[from] = false;
            if (currentInvestorCount > 0) currentInvestorCount--;
        }

        // Make governance usable for demo/default holders. If a wallet has not
        // explicitly delegated yet, delegate its votes to itself after receiving
        // tokens. Users can still override this later with delegate().
        if (to != address(0) && amount > 0 && delegates(to) == address(0)) {
            _delegate(to, to);
        }
    }

    /* ── ERC20Votes overrides ─────────────────────────────────── */
    function nonces(address owner) public view override(ERC20Permit, Nonces) returns (uint256) {
        return super.nonces(owner);
    }

    /* ── Emergency Stop ───────────────────────────────────────── */
    function pause()   external onlyRole(OPERATOR_ROLE) { _pause(); }
    function unpause() external onlyRole(OPERATOR_ROLE) { _unpause(); }

    /* ── NAV Oracle ───────────────────────────────────────────── */
    function proposeValuation(uint256 newValUSD) external onlyRole(OPERATOR_ROLE) {
        require(newValUSD > 0, "RWATokenV2: zero valuation");
        pendingValuationUSD = newValUSD;
        valuationUpdateAvailableAt = block.timestamp + VALUATION_TIMELOCK;
        emit ValuationProposed(newValUSD, valuationUpdateAvailableAt);
    }

    function executeValuation() external {
        require(valuationUpdateAvailableAt > 0,              "RWATokenV2: no pending valuation");
        require(block.timestamp >= valuationUpdateAvailableAt, "RWATokenV2: timelock not expired");
        uint256 old = totalValuationUSD;
        totalValuationUSD = pendingValuationUSD;
        valuationUpdateAvailableAt = 0;
        emit ValuationExecuted(old, totalValuationUSD);
    }

    function cancelValuation() external onlyRole(OPERATOR_ROLE) {
        valuationUpdateAvailableAt = 0;
        pendingValuationUSD = 0;
    }

    /* ── Admin ────────────────────────────────────────────────── */
    function updateLegalDoc(string calldata newCID) external onlyRole(OPERATOR_ROLE) {
        emit LegalDocUpdated(legalDocIPFS, newCID);
        legalDocIPFS = newCID;
    }

    function setMaxInvestors(uint256 newMax) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newMax >= currentInvestorCount, "RWATokenV2: below current count");
        emit MaxInvestorsUpdated(maxInvestors, newMax);
        maxInvestors = newMax;
    }

    /* ── View ─────────────────────────────────────────────────── */
    function maxSupply() external view returns (uint256) {
        if (pricePerTokenUSD == 0) return 0;
        return (totalValuationUSD * 10 ** decimals()) / pricePerTokenUSD;
    }

    function tokensAvailable() external view returns (uint256) {
        uint256 max = this.maxSupply();
        uint256 ts = totalSupply();
        return max > ts ? max - ts : 0;
    }

    function hasPendingValuation() external view returns (bool) {
        return valuationUpdateAvailableAt > 0;
    }
}
