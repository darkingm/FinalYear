// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./RWAToken.sol";
import "./ProfitDistributor.sol";
import "./ComplianceRegistry.sol";

/**
 * @title RWAFactory
 * @notice Deploy RWAToken + ProfitDistributor pairs for each tokenized asset.
 *
 * One call to createAsset() deploys both contracts, grants proper roles, and
 * emits an event the backend indexes to track all assets on-chain.
 */
contract RWAFactory is AccessControl {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    ComplianceRegistry public immutable compliance;
    address            public immutable platformAdmin;

    struct AssetContracts {
        address token;
        address distributor;
        uint256 createdAt;
        bool    active;
    }

    // assetId (UUID as bytes32) → deployed contracts
    mapping(bytes32 => AssetContracts) public assets;
    bytes32[] public allAssetIds;

    event AssetCreated(
        bytes32 indexed assetId,
        address indexed token,
        address indexed distributor,
        string          name,
        RWAToken.AssetType assetType,
        uint256         totalValuationUSD,
        uint256         pricePerTokenUSD
    );
    event AssetDeactivated(bytes32 indexed assetId);

    constructor(address compliance_, address admin) {
        compliance    = ComplianceRegistry(compliance_);
        platformAdmin = admin;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, admin);
    }

    /**
     * @notice Deploy a new RWAToken + ProfitDistributor for a real-world asset.
     * @param assetIdStr     UUID string from backend DB (e.g. "550e8400-e29b-41d4-a716-...")
     * @param name           Token name (e.g. "Q1 HCM Tower - Apt 2101")
     * @param symbol         Token symbol (e.g. "HCMT-2101")
     * @param assetType      Enum: 0=REAL_ESTATE, 1=BOND, 2=EQUITY, 3=COMMODITY
     * @param legalDocIPFS   IPFS CID of legal package
     * @param totalVal       Total asset valuation in USD × 1e6
     * @param pricePerToken  Price per token in USD × 1e6
     * @param operator       Backend wallet that can mint and deposit profits
     */
    function createAsset(
        string           calldata assetIdStr,
        string           calldata name,
        string           calldata symbol,
        RWAToken.AssetType        assetType,
        string           calldata legalDocIPFS,
        uint256                   totalVal,
        uint256                   pricePerToken,
        address                   operator
    ) external onlyRole(ISSUER_ROLE) returns (address tokenAddr, address distAddr) {
        require(totalVal > 0 && pricePerToken > 0, "RWAFactory: invalid valuation");
        require(pricePerToken <= totalVal, "RWAFactory: price > valuation");

        bytes32 assetId = keccak256(abi.encodePacked(assetIdStr));
        require(assets[assetId].token == address(0), "RWAFactory: asset already exists");

        /* ── 1. Deploy RWAToken ──────────────────────────────────────*/
        RWAToken newToken = new RWAToken(
            name, symbol, assetIdStr, assetType,
            legalDocIPFS, totalVal, pricePerToken,
            address(compliance), platformAdmin,
            address(this)  // factory gets temp DEFAULT_ADMIN_ROLE
        );
        tokenAddr = address(newToken);

        // ── 2. Deploy ProfitDistributor ─────────────────────────────
        ProfitDistributor newDist = new ProfitDistributor(tokenAddr, platformAdmin, address(this));
        distAddr = address(newDist);

        // ── 3. Grant ISSUER+OPERATOR to operator, then renounce factory's admin ─────
        bytes32 ISSUER   = newToken.ISSUER_ROLE();
        bytes32 OPERATOR = newToken.OPERATOR_ROLE();
        bytes32 DIST_OP  = newDist.OPERATOR_ROLE();
        bytes32 ADMIN    = newToken.DEFAULT_ADMIN_ROLE();

        newToken.grantRole(ISSUER, operator);
        newToken.grantRole(OPERATOR, operator);
        newDist.grantRole(DIST_OP, operator);

        // Renounce factory's temporary DEFAULT_ADMIN_ROLE from both contracts
        newToken.renounceRole(ADMIN, address(this));
        newDist.renounceRole(ADMIN, address(this));

        // ── 4. Record ─────────────────────────────────────────────────
        assets[assetId] = AssetContracts({
            token:       tokenAddr,
            distributor: distAddr,
            createdAt:   block.timestamp,
            active:      true
        });
        allAssetIds.push(assetId);

        emit AssetCreated(assetId, tokenAddr, distAddr, name, assetType, totalVal, pricePerToken);
    }

    function deactivateAsset(bytes32 assetId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        assets[assetId].active = false;
        emit AssetDeactivated(assetId);
    }

    function totalAssets() external view returns (uint256) {
        return allAssetIds.length;
    }
}
