import { ethers } from 'ethers';
import { query } from '../../config/database';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/error-handler';

// ─── IPFS via Pinata (free tier) ───────────────────────────────────────────
// Fallback to IPFS public gateway if Pinata not configured
const PINATA_JWT = process.env.PINATA_JWT ?? '';
const PINATA_URL = 'https://api.pinata.cloud';

async function pinataUpload(data: object, name: string): Promise<string> {
  if (!PINATA_JWT) {
    // Mock CID for local dev — still valid IPFS-format
    const hash = ethers.keccak256(ethers.toUtf8Bytes(JSON.stringify(data)));
    logger.warn('NFT: Pinata JWT not set, using mock CID');
    return `ipfs://Qm${hash.slice(2, 48)}`;
  }

  const response = await fetch(`${PINATA_URL}/pinning/pinJSONToIPFS`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${PINATA_JWT}`,
    },
    body: JSON.stringify({
      pinataContent: data,
      pinataMetadata: { name },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new AppError(`IPFS upload failed: ${err}`, 502);
  }

  const json = await response.json() as { IpfsHash: string };
  return `ipfs://${json.IpfsHash}`;
}

// ─── On-chain interaction ────────────────────────────────────────────────────
function getProvider() {
  const rpc = process.env.POLYGON_RPC_URL || 'https://polygon.drpc.org';
  return new ethers.JsonRpcProvider(rpc);
}

function getWallet() {
  const pk = process.env.MINTER_PRIVATE_KEY || process.env.PRIVATE_KEY;
  if (!pk) throw new AppError('Minter private key not configured', 500);
  return new ethers.Wallet(pk, getProvider());
}

const PRODUCT_NFT_ABI = [
  'function mintProduct(uint256 productId, string tokenUri, bytes32 physicalHash, address seller, uint96 royaltyBps) external',
  'function setPendingBuyer(uint256 productId, address buyer) external',
  'function deliverNFT(uint256 productId, address buyer) external',
  'function getTokenByProduct(uint256 productId) external view returns (uint256)',
  'function productMeta(uint256 tokenId) external view returns (uint256, bytes32, address, uint256, bool)',
  'function totalMinted() external view returns (uint256)',
];

const CREDIT_SBT_ABI = [
  'function recordCompletedOrder(address wallet, bool onTime, string reason) external',
  'function recordDispute(address wallet, string reason) external',
  'function getScore(address wallet) external view returns (int256)',
  'function getTier(address wallet) external view returns (uint8)',
  'function walletToToken(address) external view returns (uint256)',
  'function scoreOf(uint256) external view returns (int256, uint256, uint256, uint256, uint256, uint8)',
];

function getProductNFTContract(withSigner = false) {
  const address = process.env.PRODUCT_NFT_ADDRESS;
  if (!address) throw new AppError('ProductNFT contract address not configured', 500);
  const provider = withSigner ? getWallet() : getProvider();
  return new ethers.Contract(address, PRODUCT_NFT_ABI, provider);
}

function getCreditSBTContract(withSigner = false) {
  const address = process.env.CREDIT_SBT_ADDRESS;
  if (!address) throw new AppError('CreditScoreSBT contract address not configured', 500);
  const provider = withSigner ? getWallet() : getProvider();
  return new ethers.Contract(address, CREDIT_SBT_ABI, provider);
}

// ─── NFT Service ─────────────────────────────────────────────────────────────

export class NFTService {

  /**
   * Build IPFS metadata and mint ERC721 NFT for an approved product.
   * Called by admin after product approval.
   */
  async mintProductNFT(productId: number, hasNFC = false) {
    // 1. Load product from DB
    const res = await query(`
      SELECT p.*, u.wallet_address as seller_wallet,
             pi.image_url as primary_image
      FROM products p
      JOIN seller_profiles sp ON sp.seller_id = p.seller_id
      JOIN users u ON u.user_id = sp.user_id
      LEFT JOIN product_images pi ON pi.product_id = p.product_id AND pi.is_primary = true
      WHERE p.product_id = $1
    `, [productId]);

    if (!res.rows[0]) throw new AppError('Product not found', 404);

    const product = res.rows[0];
    if (!product.seller_wallet) throw new AppError('Seller has no wallet address', 400);

    // 2. Generate physical hash (NFC/QR)
    //    In production: seller provides NFC tag UID during product submission
    //    For demo: we derive a deterministic hash from product data
    const physicalPayload = `${productId}-${product.name}-${product.created_at}`;
    const physicalHash = ethers.keccak256(ethers.toUtf8Bytes(physicalPayload));

    // 3. Build ERC721 Metadata (OpenSea compatible)
    const metadata = {
      name: product.name,
      description: product.description || `Authentic product certified by Web3Market`,
      image: product.primary_image || 'ipfs://QmPlaceholderImage',
      external_url: `${process.env.FRONTEND_URL}/products/${productId}`,
      attributes: [
        { trait_type: 'Category', value: product.category },
        { trait_type: 'Seller', value: product.seller_name || 'Unknown' },
        { trait_type: 'Base Price USD', value: Number(product.base_price_usd) },
        { trait_type: 'Stock', value: product.stock },
        { trait_type: 'NFC Verified', value: hasNFC ? 'Yes' : 'No' },
        { trait_type: 'Listing Date', value: new Date(product.created_at).toISOString().split('T')[0] },
        { trait_type: 'Physical Hash', value: physicalHash }, // Proof of physical authenticity
      ],
      // Custom fields for Physical-Digital Link
      physical_hash: physicalHash,
      marketplace: 'Web3Market',
      royalty_percent: 5,
    };

    // 4. Upload metadata to IPFS
    logger.info(`NFT: Uploading metadata to IPFS for product ${productId}`);
    const tokenURI = await pinataUpload(metadata, `product-${productId}`);

    // 5. Mint on-chain
    logger.info(`NFT: Minting ProductNFT for product ${productId}, seller: ${product.seller_wallet}`);
    const contract = getProductNFTContract(true);
    const tx = await contract.mintProduct(
      productId,
      tokenURI,
      physicalHash,
      product.seller_wallet,
      500, // 5% royalty
    );
    const receipt = await tx.wait();

    // 6. Save to DB
    await query(`
      INSERT INTO product_nfts (product_id, token_uri, physical_hash, tx_hash, minted_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (product_id) DO UPDATE SET
        token_uri = $2, physical_hash = $3, tx_hash = $4, minted_at = NOW()
    `, [productId, tokenURI, physicalHash, receipt.hash]);

    logger.info(`NFT: Minted! tx=${receipt.hash}`);
    return { tokenURI, physicalHash, txHash: receipt.hash };
  }

  /**
   * After escrow is funded (order placed), set pending buyer so they can claim NFT.
   */
  async setPendingBuyer(productId: number, buyerWallet: string) {
    if (!process.env.PRODUCT_NFT_ADDRESS) return; // NFT not configured, skip silently
    const contract = getProductNFTContract(true);
    const tx = await contract.setPendingBuyer(productId, buyerWallet);
    await tx.wait();
    logger.info(`NFT: pendingBuyer set for product ${productId} -> ${buyerWallet}`);
  }

  /**
   * Deliver NFT after delivery confirmed (for products without NFC).
   * For NFC products: buyer calls verifyAndClaim on-chain from mobile app.
   */
  async deliverNFT(productId: number, buyerWallet: string) {
    if (!process.env.PRODUCT_NFT_ADDRESS) return;
    const contract = getProductNFTContract(true);
    const tx = await contract.deliverNFT(productId, buyerWallet);
    const receipt = await tx.wait();
    logger.info(`NFT: Delivered product ${productId} to ${buyerWallet}, tx=${receipt.hash}`);
    return receipt.hash;
  }

  /**
   * Get NFT info for a product (for frontend display).
   */
  async getNFTInfo(productId: number) {
    const dbRes = await query(
      'SELECT * FROM product_nfts WHERE product_id = $1',
      [productId]
    );
    if (!dbRes.rows[0]) return null;

    const nft = dbRes.rows[0];
    try {
      if (process.env.PRODUCT_NFT_ADDRESS) {
        const contract = getProductNFTContract(false);
        const tokenId = await contract.getTokenByProduct(productId);
        const meta = await contract.productMeta(tokenId);
        return {
          ...nft,
          tokenId: tokenId.toString(),
          nfcVerified: meta[4],
          openSeaUrl: `https://opensea.io/assets/matic/${process.env.PRODUCT_NFT_ADDRESS}/${tokenId}`,
        };
      }
    } catch { }
    return nft;
  }

  // ─── Credit Score ───────────────────────────────────────────────────────────

  /**
   * Called when an order is completed without dispute.
   * Event listener: listens to DeliveryConfirmed on-chain, OR called directly from backend.
   */
  async recordCompletedOrder(buyerWallet: string, onTime: boolean) {
    if (!process.env.CREDIT_SBT_ADDRESS) return;
    try {
      const contract = getCreditSBTContract(true);
      const tx = await contract.recordCompletedOrder(
        buyerWallet, onTime, 'Order completed successfully'
      );
      await tx.wait();
      logger.info(`SBT: credit score updated for ${buyerWallet} (onTime=${onTime})`);
    } catch (e: any) {
      logger.error(`SBT: failed to record completed order: ${e.message}`);
    }
  }

  /**
   * Compute and return credit info for a wallet (for profile display).
   */
  async getCreditInfo(wallet: string) {
    if (!process.env.CREDIT_SBT_ADDRESS) {
      return { score: 0, tier: 'BRONZE', hasSBT: false, tierFee: 2.5, canInstallment: false };
    }
    const TIERS = ['BRONZE', 'SILVER', 'GOLD', 'DIAMOND'];
    const FEES = [2.5, 2.0, 1.5, 1.0];
    try {
      const contract = getCreditSBTContract(false);
      const score = await contract.getScore(wallet);
      const tierIndex = Number(await contract.getTier(wallet));
      const tokenId = await contract.walletToToken(wallet);
      return {
        score: Number(score),
        tier: TIERS[tierIndex] ?? 'BRONZE',
        tierIndex,
        hasSBT: tokenId > 0,
        tierFee: FEES[tierIndex],
        canInstallment: tierIndex >= 2, // GOLD+
        openSeaUrl: tokenId > 0
          ? `https://opensea.io/assets/matic/${process.env.CREDIT_SBT_ADDRESS}/${tokenId}`
          : null,
      };
    } catch (e: any) {
      // Expected on dev/VPS: SBT contract not deployed on mainnet Polygon yet
      // Graceful fallback is returned — no action needed
      logger.warn(`SBT: getCreditInfo unavailable for ${wallet} (contract may not be deployed): ${e.code ?? e.message}`);
      return { score: 0, tier: 'BRONZE', hasSBT: false, tierFee: 2.5, canInstallment: false };
    }
  }
}

export const nftService = new NFTService();
