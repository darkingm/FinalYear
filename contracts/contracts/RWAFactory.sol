// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "./RWAToken.sol";
import "./RWATokenV2.sol";
import "./GovernanceRWA.sol";
import "./ProfitDistributor.sol";
import "./ComplianceRegistry.sol";

/**
 * @title RWAFactory
 * @notice Deploy RWAToken + ProfitDistributor pairs for each tokenized asset.
 *         V2: Also deploys GovernanceRWA for assets with governance support.
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

    struct AssetContractsV2 {
        address token;
        address distributor;
        address governance;
        uint256 createdAt;
        bool    active;
    }

    // assetId (UUID as bytes32) → deployed contracts
    mapping(bytes32 => AssetContracts)   public assets;
    mapping(bytes32 => AssetContractsV2) public assetsV2;
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
    event AssetV2Created(
        bytes32 indexed assetId,
        address token,
        address distributor,
        address governance,
        string  name
    );
    event AssetDeactivated(bytes32 indexed assetId);

    constructor(address compliance_, address admin) {
        compliance    = ComplianceRegistry(compliance_);
        platformAdmin = admin;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, admin);
    }

    /**
     * @notice Deploy a new RWAToken + ProfitDistributor (V1, no governance).
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
        require(
            assets[assetId].token == address(0) && assetsV2[assetId].token == address(0),
            "RWAFactory: asset already exists"
        );

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

        // ── 3. Wire token ↔ distributor ─────────────────────────────────
        newToken.setDistributor(distAddr);

        // ── 4. Grant ISSUER+OPERATOR to operator, then renounce factory's admin ─────
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

    /**
     * @notice Deploy RWATokenV2 + ProfitDistributor + GovernanceRWA (V2, with governance).
     * @param quorum_         Quorum % for simple proposals (e.g. 50)
     * @param supermajority_  Required % for asset-sale proposals (e.g. 67)
     * @param votingPeriod_   Voting window in seconds (e.g. 172800 = 48h)
     */
    function createAssetV2(
        string            calldata assetIdStr,
        string            calldata name,
        string            calldata symbol,
        RWATokenV2.AssetType       assetType,
        string            calldata legalDocIPFS,
        uint256                    totalVal,
        uint256                    pricePerToken,
        address                    operator,
        uint256                    quorum_,
        uint256                    supermajority_,
        uint256                    votingPeriod_
    ) external onlyRole(ISSUER_ROLE) returns (address tokenAddr, address distAddr, address govAddr) {
        require(totalVal > 0 && pricePerToken > 0, "RWAFactory: invalid valuation");
        require(pricePerToken <= totalVal, "RWAFactory: price > valuation");

        bytes32 assetId = keccak256(abi.encodePacked(assetIdStr));
        require(assetsV2[assetId].token == address(0) && assets[assetId].token == address(0),
                "RWAFactory: asset already exists");

        // ── 1. Deploy RWATokenV2 ─────────────────────────────────────
        RWATokenV2 newToken = new RWATokenV2(
            name, symbol, assetIdStr, assetType,
            legalDocIPFS, totalVal, pricePerToken,
            address(compliance), platformAdmin,
            address(this)
        );
        tokenAddr = address(newToken);

        // ── 2. Deploy ProfitDistributor ──────────────────────────────
        ProfitDistributor newDist = new ProfitDistributor(tokenAddr, platformAdmin, address(this));
        distAddr = address(newDist);

        // ── 3. Deploy GovernanceRWA ──────────────────────────────────
        GovernanceRWA newGov = new GovernanceRWA(
            tokenAddr,
            platformAdmin,
            quorum_,
            supermajority_,
            votingPeriod_,
            100  // 1% proposal threshold (100 basis points)
        );
        govAddr = address(newGov);

        // ── 4. Wire contracts ────────────────────────────────────────
        newToken.setDistributor(distAddr);

        // ── 5. Grant roles ───────────────────────────────────────────
        bytes32 ADMIN    = newToken.DEFAULT_ADMIN_ROLE();
        bytes32 ISSUER_R = newToken.ISSUER_ROLE();
        bytes32 OPER_R   = newToken.OPERATOR_ROLE();
        bytes32 DIST_OP  = newDist.OPERATOR_ROLE();

        newToken.grantRole(ISSUER_R, operator);
        newToken.grantRole(OPER_R, operator);
        newDist.grantRole(DIST_OP, operator);

        // Renounce factory admin
        newToken.renounceRole(ADMIN, address(this));
        newDist.renounceRole(ADMIN, address(this));

        // ── 6. Record ────────────────────────────────────────────────
        assetsV2[assetId] = AssetContractsV2({
            token:       tokenAddr,
            distributor: distAddr,
            governance:  govAddr,
            createdAt:   block.timestamp,
            active:      true
        });
        allAssetIds.push(assetId);

        emit AssetV2Created(assetId, tokenAddr, distAddr, govAddr, name);
    }

    function deactivateAsset(bytes32 assetId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(
            assets[assetId].token != address(0) || assetsV2[assetId].token != address(0),
            "RWAFactory: asset not found"
        );
        if (assets[assetId].token != address(0)) {
            assets[assetId].active = false;
        }
        if (assetsV2[assetId].token != address(0)) {
            assetsV2[assetId].active = false;
        }
        emit AssetDeactivated(assetId);
    }

    function totalAssets() external view returns (uint256) {
        return allAssetIds.length;
    }
}
