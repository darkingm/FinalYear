// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title ComplianceRegistry
 * @notice On-chain KYC whitelist for RWA token holders.
 *         Only KYC-verified addresses may receive/hold RWA tokens.
 */
contract ComplianceRegistry is AccessControl {
    bytes32 public constant KYC_OPERATOR_ROLE = keccak256("KYC_OPERATOR_ROLE");

    struct InvestorInfo {
        bool    verified;
        string  jurisdiction; // ISO country code, e.g. "VN", "SG"
        uint256 verifiedAt;
        uint256 expiresAt;    // 0 = no expiry
    }

    mapping(address => InvestorInfo) private _investors;

    event KYCGranted(address indexed investor, string jurisdiction, uint256 expiresAt);
    event KYCRevoked(address indexed investor);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(KYC_OPERATOR_ROLE, admin);
    }

    /// @notice Verify an investor (called by backend after off-chain KYC passes)
    function setKYCStatus(
        address investor,
        bool    verified,
        string calldata jurisdiction,
        uint256 expiresAt
    ) external onlyRole(KYC_OPERATOR_ROLE) {
        if (verified) {
            _investors[investor] = InvestorInfo({
                verified:     true,
                jurisdiction: jurisdiction,
                verifiedAt:   block.timestamp,
                expiresAt:    expiresAt
            });
            emit KYCGranted(investor, jurisdiction, expiresAt);
        } else {
            delete _investors[investor];
            emit KYCRevoked(investor);
        }
    }

    /// @notice Batch-verify multiple investors in one tx (gas-efficient onboarding)
    function batchSetKYC(
        address[] calldata investors,
        string  calldata jurisdiction
    ) external onlyRole(KYC_OPERATOR_ROLE) {
        for (uint256 i = 0; i < investors.length; i++) {
            _investors[investors[i]] = InvestorInfo({
                verified:     true,
                jurisdiction: jurisdiction,
                verifiedAt:   block.timestamp,
                expiresAt:    0
            });
            emit KYCGranted(investors[i], jurisdiction, 0);
        }
    }

    /// @notice Returns true if address is KYC-verified and not expired
    function isVerified(address investor) external view returns (bool) {
        InvestorInfo storage info = _investors[investor];
        if (!info.verified) return false;
        if (info.expiresAt != 0 && block.timestamp > info.expiresAt) return false;
        return true;
    }

    function getInvestorInfo(address investor) external view returns (InvestorInfo memory) {
        return _investors[investor];
    }
}
