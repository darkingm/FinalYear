// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title CreditScoreSBT
 * @dev Soulbound Token (SBT) implementing ERC-5192 -- non-transferable.
 *      Represents a user's on-chain credit/reputation score from marketplace activity.
 *
 * Tier System:
 *   0-99    => BRONZE  (default, just registered)
 *   100-299 => SILVER  (can access installment payments / reduced fees)
 *   300-599 => GOLD    (priority listing, max fee discounts)
 *   600+    => DIAMOND (VIP -- top tier privileges)
 *
 * Score Calculation (off-chain by backend AI module, committed on-chain):
 *   +15 per completed order (no dispute)
 *   +5  per on-time payment (< 1hr after placement)
 *   -30 per dispute raised against user
 *   -50 per fraud detection flag
 *   +3  per 5-star review given
 *
 * Credit privileges (enforced in EscrowCore):
 *   SILVER: platform fee 2.0% (default 2.5%)
 *   GOLD:   platform fee 1.5%, can buy on installment
 *   DIAMOND: platform fee 1.0%, priority seller queue, undercollateralized loans (future)
 */
contract CreditScoreSBT is ERC721, ERC721URIStorage, AccessControl {

    // ERC-5192: Minimal Soulbound Token interface
    bytes4 private constant ERC5192_INTERFACE_ID = 0xb45a3c0e;
    event Locked(uint256 tokenId);
    event Unlocked(uint256 tokenId); // SBT: emitted only for admin forced unlock

    bytes32 public constant UPDATER_ROLE = keccak256("UPDATER_ROLE");
    bytes32 public constant ADMIN_ROLE   = keccak256("ADMIN_ROLE");

    uint256 private _nextTokenId;

    enum Tier { BRONZE, SILVER, GOLD, DIAMOND }

    struct ScoreRecord {
        int256 score;           // Can go negative (fraud penalty)
        uint256 completedOrders;
        uint256 disputes;
        uint256 fraudFlags;
        uint256 lastUpdated;
        Tier tier;
    }

    // wallet - tokenId
    mapping(address => uint256) public walletToToken;

    // tokenId - score data
    mapping(uint256 => ScoreRecord) public scoreOf;

    // -- Tier thresholds --
    int256 public constant SILVER_THRESHOLD  = 100;
    int256 public constant GOLD_THRESHOLD    = 300;
    int256 public constant DIAMOND_THRESHOLD = 600;

    // -- Score deltas --
    int256 public constant SCORE_COMPLETED_ORDER = 15;
    int256 public constant SCORE_ONTIME_PAYMENT  = 5;
    int256 public constant SCORE_DISPUTE_PENALTY = -30;
    int256 public constant SCORE_FRAUD_PENALTY   = -50;
    int256 public constant SCORE_5STAR_REVIEW    = 3;

    // -- Platform fee bps per tier (for EscrowCore to query) --
    uint256 public constant FEE_BRONZE  = 250; // 2.5%
    uint256 public constant FEE_SILVER  = 200; // 2.0%
    uint256 public constant FEE_GOLD    = 150; // 1.5%
    uint256 public constant FEE_DIAMOND = 100; // 1.0%

    // -- Events --
    event SBTMinted(address indexed wallet, uint256 tokenId);
    event ScoreUpdated(address indexed wallet, int256 newScore, Tier newTier, string reason);
    event TierUpgraded(address indexed wallet, Tier oldTier, Tier newTier);
    event TierDowngraded(address indexed wallet, Tier oldTier, Tier newTier);

    constructor() ERC721("Web3Market Credit Score", "W3MCREDIT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(UPDATER_ROLE, msg.sender);
    }

    // -----------------------------------------
    // MINT - one SBT per wallet, auto-minted on first interaction
    // -----------------------------------------

    function mintSBT(address wallet) external onlyRole(UPDATER_ROLE) returns (uint256) {
        require(walletToToken[wallet] == 0, "SBT already exists");
        uint256 tokenId = ++_nextTokenId;
        _safeMint(wallet, tokenId);
        walletToToken[wallet] = tokenId;
        scoreOf[tokenId] = ScoreRecord({
            score: 0,
            completedOrders: 0,
            disputes: 0,
            fraudFlags: 0,
            lastUpdated: block.timestamp,
            tier: Tier.BRONZE
        });

        emit SBTMinted(wallet, tokenId);
        emit Locked(tokenId); // ERC-5192: immediately soulbound
        return tokenId;
    }

    // -----------------------------------------
    // SCORE UPDATE -- called by backend after each order completion
    // ---------------------------------------------------------

    /**
     * @dev Record a completed order. Grants +SCORE_COMPLETED_ORDER points.
     *      If payment was on-time, grants extra +SCORE_ONTIME_PAYMENT.
     */
    function recordCompletedOrder(
        address wallet,
        bool onTime,
        string calldata reason
    ) external onlyRole(UPDATER_ROLE) {
        uint256 tokenId = _ensureSBT(wallet);
        ScoreRecord storage rec = scoreOf[tokenId];

        int256 delta = SCORE_COMPLETED_ORDER + (onTime ? SCORE_ONTIME_PAYMENT : int256(0));
        rec.score += delta;
        rec.completedOrders++;
        rec.lastUpdated = block.timestamp;

        _updateTierAndURI(wallet, tokenId, rec, reason);
    }

    /**
     * @dev Record a dispute raised against this wallet. Penalises score.
     */
    function recordDispute(address wallet, string calldata reason) external onlyRole(UPDATER_ROLE) {
        uint256 tokenId = _ensureSBT(wallet);
        ScoreRecord storage rec = scoreOf[tokenId];
        rec.score += SCORE_DISPUTE_PENALTY;
        rec.disputes++;
        rec.lastUpdated = block.timestamp;
        _updateTierAndURI(wallet, tokenId, rec, reason);
    }

    /**
     * @dev Admin flags fraud. Major score penalty.
     */
    function recordFraudFlag(address wallet, string calldata reason) external onlyRole(ADMIN_ROLE) {
        uint256 tokenId = _ensureSBT(wallet);
        ScoreRecord storage rec = scoreOf[tokenId];
        rec.score += SCORE_FRAUD_PENALTY;
        rec.fraudFlags++;
        rec.lastUpdated = block.timestamp;
        _updateTierAndURI(wallet, tokenId, rec, reason);
    }

    /**
     * @dev Backend bulk update with a pre-computed score delta + new IPFS metadata URI.
     *      The backend AI module runs full scoring and calls this with final result.
     */
    function updateScore(
        address wallet,
        int256 scoreDelta,
        string calldata newTokenUri,
        string calldata reason
    ) external onlyRole(UPDATER_ROLE) {
        uint256 tokenId = _ensureSBT(wallet);
        ScoreRecord storage rec = scoreOf[tokenId];
        rec.score += scoreDelta;
        rec.lastUpdated = block.timestamp;
        _setTokenURI(tokenId, newTokenUri);
        _updateTierAndURI(wallet, tokenId, rec, reason);
    }

    // -----------------------------------------
    // INTERNAL HELPERS
    // -----------------------------------------

    function _ensureSBT(address wallet) internal returns (uint256) {
        if (walletToToken[wallet] == 0) {
            return _mintInternal(wallet);
        }
        return walletToToken[wallet];
    }

    function _mintInternal(address wallet) internal returns (uint256) {
        uint256 tokenId = ++_nextTokenId;
        _safeMint(wallet, tokenId);
        walletToToken[wallet] = tokenId;
        scoreOf[tokenId] = ScoreRecord({
            score: 0, completedOrders: 0, disputes: 0, fraudFlags: 0,
            lastUpdated: block.timestamp, tier: Tier.BRONZE
        });
        emit SBTMinted(wallet, tokenId);
        emit Locked(tokenId);
        return tokenId;
    }

    function _updateTierAndURI(
        address wallet,
        uint256 tokenId,
        ScoreRecord storage rec,
        string memory reason
    ) internal {
        Tier newTier = _computeTier(rec.score);
        if (newTier != rec.tier) {
            Tier old = rec.tier;
            rec.tier = newTier;
            if (uint8(newTier) > uint8(old)) emit TierUpgraded(wallet, old, newTier);
            else emit TierDowngraded(wallet, old, newTier);
        }
        emit ScoreUpdated(wallet, rec.score, rec.tier, reason);
    }

    function _computeTier(int256 score) internal pure returns (Tier) {
        if (score >= DIAMOND_THRESHOLD) return Tier.DIAMOND;
        if (score >= GOLD_THRESHOLD)    return Tier.GOLD;
        if (score >= SILVER_THRESHOLD)  return Tier.SILVER;
        return Tier.BRONZE;
    }

    // -----------------------------------------
    // PRIVILEGE QUERIES - used by EscrowCore
    // -----------------------------------------

    function getPlatformFee(address wallet) external view returns (uint256) {
        uint256 tokenId = walletToToken[wallet];
        if (tokenId == 0) return FEE_BRONZE;
        Tier tier = scoreOf[tokenId].tier;
        if (tier == Tier.DIAMOND) return FEE_DIAMOND;
        if (tier == Tier.GOLD)    return FEE_GOLD;
        if (tier == Tier.SILVER)  return FEE_SILVER;
        return FEE_BRONZE;
    }

    function getTier(address wallet) external view returns (Tier) {
        uint256 tokenId = walletToToken[wallet];
        if (tokenId == 0) return Tier.BRONZE;
        return scoreOf[tokenId].tier;
    }

    function getScore(address wallet) external view returns (int256) {
        uint256 tokenId = walletToToken[wallet];
        if (tokenId == 0) return 0;
        return scoreOf[tokenId].score;
    }

    function canInstallment(address wallet) external view returns (bool) {
        uint256 tokenId = walletToToken[wallet];
        if (tokenId == 0) return false;
        return uint8(scoreOf[tokenId].tier) >= uint8(Tier.GOLD);
    }

    function canPriorityList(address wallet) external view returns (bool) {
        uint256 tokenId = walletToToken[wallet];
        if (tokenId == 0) return false;
        return uint8(scoreOf[tokenId].tier) >= uint8(Tier.GOLD);
    }

    // -----------------------------------------
    // SOULBOUND - DISABLE TRANSFERS (ERC-5192)
    // -----------------------------------------

    function locked(uint256 /*tokenId*/) external pure returns (bool) {
        return true; // always locked
    }

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = _ownerOf(tokenId);
        // Allow minting (from == 0) and admin-initiated burn (to == 0), block transfers
        require(
            from == address(0) || to == address(0) || hasRole(ADMIN_ROLE, auth),
            "SBT: non-transferable"
        );
        return super._update(to, tokenId, auth);
    }

    // -----------------------------------------
    // OVERRIDES
    // -----------------------------------------

    function tokenURI(uint256 tokenId)
        public view override(ERC721, ERC721URIStorage) returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, ERC721URIStorage, AccessControl) returns (bool)
    {
        return interfaceId == ERC5192_INTERFACE_ID || super.supportsInterface(interfaceId);
    }
}
