import { ethers } from 'ethers';
import { query } from '../db';

/**
 * Transfer Event Indexer
 *
 * Polls ERC20 Transfer events from RWAToken contracts and rebuilds
 * investor_holdings as a read-model projection of on-chain state.
 *
 * This ensures DB ownership data stays in sync with actual chain state,
 * including wallet-to-wallet transfers not initiated through the purchase API.
 */

const TRANSFER_EVENT_ABI = ['event Transfer(address indexed from, address indexed to, uint256 value)'];
const POLL_INTERVAL_MS = 15_000; // 15 seconds
const BATCH_SIZE = 1000; // max blocks per poll

function getProvider() {
    const rpcUrl = process.env.LOCALHOST_RPC_URL || process.env.VPS_RPC_URL || 'http://hardhat-node:8545';
    return new ethers.JsonRpcProvider(rpcUrl);
}

/**
 * Index Transfer events for a single asset.
 * Updates investor_holdings based on actual on-chain balance changes.
 */
async function indexAsset(
    provider: ethers.JsonRpcProvider,
    assetId: string,
    tokenAddress: string,
    fromBlock: number,
    currentBlock: number
): Promise<number> {
    const contract = new ethers.Contract(tokenAddress, TRANSFER_EVENT_ABI, provider);
    const toBlock = Math.min(fromBlock + BATCH_SIZE, currentBlock);

    if (fromBlock >= toBlock) return fromBlock;

    try {
        const events = await contract.queryFilter(
            contract.filters.Transfer(),
            fromBlock,
            toBlock
        );

        for (const event of events) {
            const log = event as ethers.EventLog;
            const from = log.args[0] as string;
            const to = log.args[1] as string;
            const value = log.args[2] as bigint;
            const tokenAmount = Number(value / 10n ** 18n); // RWAToken has 18 decimals

            // Skip zero transfers
            if (tokenAmount === 0) continue;

            // Mint (from = 0x0) — increase 'to' holdings
            if (from === ethers.ZeroAddress) {
                await upsertHolding(assetId, to, tokenAmount);
            }
            // Burn (to = 0x0) — decrease 'from' holdings
            else if (to === ethers.ZeroAddress) {
                await decreaseHolding(assetId, from, tokenAmount);
            }
            // Transfer — decrease 'from', increase 'to'
            else {
                await decreaseHolding(assetId, from, tokenAmount);
                await upsertHolding(assetId, to, tokenAmount);
            }
        }

        // Update indexer state
        await query(
            `INSERT INTO indexer_state (asset_id, last_indexed_block, last_indexed_at)
             VALUES ($1, $2, NOW())
             ON CONFLICT (asset_id) DO UPDATE SET
                last_indexed_block = $2, last_indexed_at = NOW()`,
            [assetId, toBlock]
        );

        if (events.length > 0) {
            console.log(`[indexer] ${assetId.substring(0, 8)}...: indexed ${events.length} transfers (blocks ${fromBlock}-${toBlock})`);
        }

        return toBlock;
    } catch (err: any) {
        console.error(`[indexer] Error indexing ${assetId}: ${err.message}`);
        return fromBlock; // retry from same block next time
    }
}

async function upsertHolding(assetId: string, walletAddress: string, tokenAmount: number) {
    // Use (asset_id, wallet_address) as the conflict key — prevents merging
    // multiple unlinked wallets into user_id=0 per asset.
    await query(`
        INSERT INTO investor_holdings (user_id, asset_id, tokens_held, wallet_address, last_updated)
        VALUES (
            (SELECT user_id FROM rwa_kyc WHERE wallet_address = $2),
            $1, $3, $2, NOW()
        )
        ON CONFLICT (asset_id, wallet_address) DO UPDATE SET
            tokens_held = investor_holdings.tokens_held + $3,
            last_updated = NOW()
    `, [assetId, walletAddress.toLowerCase(), tokenAmount]);
}

async function decreaseHolding(assetId: string, walletAddress: string, tokenAmount: number) {
    // Decrease, and remove if balance drops to zero
    await query(`
        UPDATE investor_holdings
        SET tokens_held = GREATEST(tokens_held - $3, 0), last_updated = NOW()
        WHERE asset_id = $1 AND wallet_address = $2
    `, [assetId, walletAddress.toLowerCase(), tokenAmount]);

    // Clean up zero-balance rows
    await query(`
        DELETE FROM investor_holdings
        WHERE asset_id = $1 AND wallet_address = $2 AND tokens_held <= 0
    `, [assetId, walletAddress.toLowerCase()]);
}

/**
 * Main polling loop — runs for all active assets.
 */
async function pollOnce() {
    try {
        const provider = getProvider();
        const currentBlock = await provider.getBlockNumber();

        // Get all active assets with token contracts
        const assets = await query(`
            SELECT a.asset_id, a.token_contract_address,
                   COALESCE(s.last_indexed_block, 0) AS last_indexed_block
            FROM rwa_assets a
            LEFT JOIN indexer_state s USING (asset_id)
            WHERE a.status = 'ACTIVE'
              AND a.token_contract_address IS NOT NULL
              AND a.token_contract_address != '0x0000000000000000000000000000000000000000'
        `);

        for (const asset of assets.rows) {
            await indexAsset(
                provider,
                asset.asset_id,
                asset.token_contract_address,
                asset.last_indexed_block + 1,
                currentBlock
            );
        }
    } catch (err: any) {
        console.error('[indexer] Poll error:', err.message);
    }
}

/**
 * Start the indexer — call this from server.ts on boot.
 */
export function startTransferIndexer() {
    console.log(`[indexer] Starting Transfer event indexer (interval: ${POLL_INTERVAL_MS}ms)`);

    // Initial poll
    pollOnce();

    // Recurring poll
    setInterval(pollOnce, POLL_INTERVAL_MS);
}
