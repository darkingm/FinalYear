// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ProductNFT
 * @dev ERC721 NFT for physical product authentication
 *      - ERC2981 royalty standard (OpenSea compatible)
 *      - Physical-Digital Link via NFC/QR hash
 *      - Multi-sig minting (2-of-3 admin approval)
 *      - Transferable to buyer on escrow release
 *
 * Each NFT represents ownership of a REAL physical product.
 * Metadata stored on IPFS to ensure immutability.
 */
contract ProductNFT is ERC721, ERC721URIStorage, ERC2981, AccessControl, Pausable, ReentrancyGuard {

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant ADMIN_ROLE   = keccak256("ADMIN_ROLE");

    uint256 private _nextTokenId;

    // Platform default royalty (basis points, e.g. 500 = 5%)
    uint96 public constant DEFAULT_ROYALTY_BPS = 500; // 5%

    struct ProductMetadata {
        uint256 productId;        // DB product ID (off-chain reference)
        bytes32 physicalHash;     // keccak256 of NFC tag UID or QR serial - Physical-Digital Link
        address originalSeller;
        uint256 mintedAt;
        bool nfcVerified;         // true after buyer scans NFC/QR
    }

    // tokenId - metadata
    mapping(uint256 => ProductMetadata) public productMeta;

    // productId - tokenId (one product = one NFT)
    mapping(uint256 => uint256) public productToToken;

    // tokenId - pending transfer (set during escrow, released on delivery confirm)
    mapping(uint256 => address) public pendingBuyer;

    // Multi-sig: productId - approver set. Mint only after 2 approvals.
    mapping(uint256 => mapping(address => bool)) public mintApprovals;
    mapping(uint256 => uint8) public mintApprovalCount;
    mapping(uint256 => bytes) public pendingMintData; // ABI-encoded mint params

    uint8 public constant REQUIRED_APPROVALS = 2;

    // ------ Events ------
    event ProductMinted(uint256 indexed tokenId, uint256 indexed productId, address seller, string tokenURI);
    event NFCVerified(uint256 indexed tokenId, address buyer);
    event PendingTransferSet(uint256 indexed tokenId, address indexed buyer);
    event OwnershipTransferredOnDelivery(uint256 indexed tokenId, address from, address to);
    event MintApproved(uint256 indexed productId, address approver, uint8 count);
    event MintExecuted(uint256 indexed productId, uint256 tokenId);

    constructor(address feeVault) ERC721("Web3Market Product NFT", "W3MPNFT") {
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);

        // Set platform-wide default royalty - fee goes to feeVault
        _setDefaultRoyalty(feeVault, DEFAULT_ROYALTY_BPS);
    }

    // -----------------------------------------
    // MULTI-SIG MINT FLOW
    // -----------------------------------------

    /**
     * @dev Step 1: Admin proposes a mint. Stores encoded params.
     *      Second admin calls approveMint - auto-executes when count >= REQUIRED_APPROVALS.
     */
    function proposeMint(
        uint256 productId,
        string calldata tokenUri,
        bytes32 physicalHash,
        address seller,
        uint96 royaltyBps
    ) external onlyRole(ADMIN_ROLE) {
        require(productToToken[productId] == 0, "Already minted");
        mintApprovals[productId][msg.sender] = true;
        mintApprovalCount[productId] = 1;
        pendingMintData[productId] = abi.encode(productId, tokenUri, physicalHash, seller, royaltyBps);
        emit MintApproved(productId, msg.sender, 1);
    }

    /**
     * @dev Step 2: Second admin approves. If count reaches REQUIRED_APPROVALS, mint is executed.
     */
    function approveMint(uint256 productId) external onlyRole(ADMIN_ROLE) {
        require(!mintApprovals[productId][msg.sender], "Already approved");
        require(pendingMintData[productId].length > 0, "No pending mint");

        mintApprovals[productId][msg.sender] = true;
        mintApprovalCount[productId]++;
        emit MintApproved(productId, msg.sender, mintApprovalCount[productId]);

        if (mintApprovalCount[productId] >= REQUIRED_APPROVALS) {
            _executeMint(productId);
        }
    }

    function _executeMint(uint256 productId) internal {
        (
            uint256 pid,
            string memory tokenUri,
            bytes32 physicalHash,
            address seller,
            uint96 royaltyBps
        ) = abi.decode(pendingMintData[productId], (uint256, string, bytes32, address, uint96));

        uint256 tokenId = ++_nextTokenId;
        _safeMint(address(this), tokenId); // Contract holds NFT until buyer confirms delivery
        _setTokenURI(tokenId, tokenUri);
        if (royaltyBps > 0) {
            _setTokenRoyalty(tokenId, seller, royaltyBps);
        }

        productMeta[tokenId] = ProductMetadata({
            productId: pid,
            physicalHash: physicalHash,
            originalSeller: seller,
            mintedAt: block.timestamp,
            nfcVerified: false
        });
        productToToken[pid] = tokenId;

        // Clean up approval state
        delete pendingMintData[productId];
        delete mintApprovalCount[productId];

        emit ProductMinted(tokenId, pid, seller, tokenUri);
        emit MintExecuted(productId, tokenId);
    }

    // -----------------------------------------
    // DIRECT MINT (single admin / backend wallet - for non-multi-sig flow)
    // -----------------------------------------

    function mintProduct(
        uint256 productId,
        string calldata tokenUri,
        bytes32 physicalHash,
        address seller,
        uint96 royaltyBps
    ) external onlyRole(MINTER_ROLE) whenNotPaused nonReentrant {
        require(productToToken[productId] == 0, "Already minted");

        uint256 tokenId = ++_nextTokenId;
        _safeMint(address(this), tokenId); // held in contract escrow
        _setTokenURI(tokenId, tokenUri);
        if (royaltyBps > 0) {
            _setTokenRoyalty(tokenId, seller, royaltyBps);
        }

        productMeta[tokenId] = ProductMetadata({
            productId: productId,
            physicalHash: physicalHash,
            originalSeller: seller,
            mintedAt: block.timestamp,
            nfcVerified: false
        });
        productToToken[productId] = tokenId;

        emit ProductMinted(tokenId, productId, seller, tokenUri);
    }

    // -----------------------------------------
    // PHYSICAL-DIGITAL LINK - NFC / QR VERIFY
    // -----------------------------------------

    /**
     * @dev Buyer scans NFC tag / QR code on the physical product.
     *      The app hashes the scanned payload and calls this function.
     *      physicalHashInput must match the hash stored at minting.
     *      On success: sets nfcVerified = true and auto-transfers NFT to buyer.
     */
    function verifyAndClaim(
        uint256 tokenId,
        bytes32 physicalHashInput
    ) external nonReentrant {
        ProductMetadata storage meta = productMeta[tokenId];
        require(pendingBuyer[tokenId] == msg.sender, "Not the pending buyer");
        require(!meta.nfcVerified, "Already verified");
        require(meta.physicalHash == physicalHashInput, "Physical hash mismatch - not the authentic product");

        meta.nfcVerified = true;
        address prev = address(this);
        _transfer(prev, msg.sender, tokenId);
        delete pendingBuyer[tokenId];

        emit NFCVerified(tokenId, msg.sender);
        emit OwnershipTransferredOnDelivery(tokenId, prev, msg.sender);
    }

    // -----------------------------------------
    // ESCROW INTEGRATION
    // Called by EscrowCore (or backend) after delivery confirmation
    // -----------------------------------------

    /**
     * @dev Set pending buyer - called when order is placed + escrow funded.
     *      NFT will transfer to this address when buyer calls verifyAndClaim.
     */
    function setPendingBuyer(
        uint256 productId,
        address buyer
    ) external onlyRole(MINTER_ROLE) {
        uint256 tokenId = productToToken[productId];
        require(tokenId != 0, "NFT not minted yet");
        pendingBuyer[tokenId] = buyer;
        emit PendingTransferSet(tokenId, buyer);
    }

    /**
     * @dev Force transfer (no NFC required) - called when product does NOT have NFC tag.
     *      Used for standard products (non-luxury).
     */
    function deliverNFT(
        uint256 productId,
        address buyer
    ) external onlyRole(MINTER_ROLE) nonReentrant {
        uint256 tokenId = productToToken[productId];
        require(tokenId != 0, "NFT not minted");
        require(ownerOf(tokenId) == address(this), "Already delivered");
        _transfer(address(this), buyer, tokenId);
        delete pendingBuyer[tokenId];
        emit OwnershipTransferredOnDelivery(tokenId, address(this), buyer);
    }

    // -----------------------------------------
    // VIEWS
    // -----------------------------------------

    function getTokenByProduct(uint256 productId) external view returns (uint256) {
        return productToToken[productId];
    }

    function totalMinted() external view returns (uint256) {
        return _nextTokenId;
    }

    // -----------------------------------------
    // OVERRIDES (OpenZeppelin v5 requirements)
    // -----------------------------------------

    function tokenURI(uint256 tokenId)
        public view override(ERC721, ERC721URIStorage) returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721, ERC721URIStorage, ERC2981, AccessControl) returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function pause() external onlyRole(ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(ADMIN_ROLE) { _unpause(); }
}
