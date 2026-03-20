// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./ComplianceRegistry.sol";

/**
 * @title RWAToken
 * @notice ERC-20 Security Token representing fractional ownership of a real-world asset.
 *
 *  - Minting: only ISSUER_ROLE (RWAFactory)
 *  - Transfers: enforce KYC whitelist via ComplianceRegistry
 *  - Pausing: operator can freeze transfers in emergency
 *  - Metadata: asset type, legal doc IPFS hash, total USD valuation
 */
contract RWAToken is ERC20, AccessControl, Pausable {
    bytes32 public constant ISSUER_ROLE   = keccak256("ISSUER_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    enum AssetType { REAL_ESTATE, BOND, EQUITY, COMMODITY }

    /* ── Immutable asset metadata ─────────────────────────────── */
    string  public assetId;            // UUID (matches DB primary key)
    AssetType public assetType;
    string  public legalDocIPFS;       // IPFS CID of legal package
    uint256 public totalValuationUSD;  // USD × 1e6 (6 decimals)
    uint256 public pricePerTokenUSD;   // USD × 1e6 — fixed at issuance

    ComplianceRegistry public immutable compliance;

    /* ── Events ────────────────────────────────────────────────── */
    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);
    event ValuationUpdated(uint256 oldVal, uint256 newVal);
    event LegalDocUpdated(string oldCID, string newCID);

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
        address            factory_   // RWAFactory address — gets temp admin to grantRole
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

        // Grant admin to factory so it can grantRole(ISSUER/OPERATOR) to operator
        // Factory will renounce this after setup
        if (factory_ != address(0)) {
            _grantRole(DEFAULT_ADMIN_ROLE, factory_);
        }
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
        // Allow mint (from == 0) and burn (to == 0) freely
        if (from != address(0) && to != address(0)) {
            require(compliance.isVerified(to), "RWAToken: recipient not KYC verified");
        }
        super._update(from, to, amount);
    }

    /* ── Admin ─────────────────────────────────────────────────── */
    function pause()   external onlyRole(OPERATOR_ROLE) { _pause(); }
    function unpause() external onlyRole(OPERATOR_ROLE) { _unpause(); }

    function updateValuation(uint256 newValUSD) external onlyRole(OPERATOR_ROLE) {
        emit ValuationUpdated(totalValuationUSD, newValUSD);
        totalValuationUSD = newValUSD;
    }

    function updateLegalDoc(string calldata newCID) external onlyRole(OPERATOR_ROLE) {
        emit LegalDocUpdated(legalDocIPFS, newCID);
        legalDocIPFS = newCID;
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
}
