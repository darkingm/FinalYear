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

const TOKEN_INDEXER_ABI = [
    'event Transfer(address indexed from, address indexed to, uint256 value)',
    'function balanceOf(address account) view returns (uint256)',
    'function totalSupply() view returns (uint256)',
];
const TOKEN_DECIMALS = 10n ** 18n;
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
    const contract = new ethers.Contract(tokenAddress, TOKEN_INDEXER_ABI, provider);
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

            // Skip zero transfers
            if (value === 0n) continue;

            // Mint (from = 0x0) — sync receiver balance from chain
            if (from === ethers.ZeroAddress) {
                await syncHoldingBalance(contract, assetId, to);
            }
            // Burn (to = 0x0) — sync sender balance from chain
            else if (to === ethers.ZeroAddress) {
                await syncHoldingBalance(contract, assetId, from);
            }
            // Transfer — sync both sides from chain.
            // This makes the indexer an idempotent projection instead of an
            // incremental counter, so replay/retry cannot double-count holdings.
            else {
                await syncHoldingBalance(contract, assetId, from);
                await syncHoldingBalance(contract, assetId, to);
            }
        }

        await syncTokensSold(contract, assetId);

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

async function syncHoldingBalance(contract: ethers.Contract, assetId: string, walletAddress: string) {
    const normalizedWallet = walletAddress.toLowerCase();
    const balanceWei = await contract.balanceOf(walletAddress);
    const tokenAmount = Number(balanceWei / TOKEN_DECIMALS); // RWAToken has 18 decimals

    if (tokenAmount <= 0) {
        await query(`
            DELETE FROM investor_holdings
            WHERE asset_id = $1 AND wallet_address = $2
        `, [assetId, normalizedWallet]);
        return;
    }

    // Use (asset_id, wallet_address) as the conflict key and SET exact balance.
    // Keeping avg_cost_usd untouched preserves purchase metadata written by the
    // purchase endpoint while ownership remains chain-derived.
    await query(`
        INSERT INTO investor_holdings (user_id, asset_id, tokens_held, wallet_address, last_updated)
        VALUES (
            (SELECT user_id FROM rwa_kyc WHERE wallet_address = $2),
            $1, $3, $2, NOW()
        )
        ON CONFLICT (asset_id, wallet_address) DO UPDATE SET
            tokens_held = $3,
            user_id = COALESCE(investor_holdings.user_id, EXCLUDED.user_id),
            last_updated = NOW()
    `, [assetId, normalizedWallet, tokenAmount]);
}

async function syncTokensSold(contract: ethers.Contract, assetId: string) {
    const totalSupplyWei = await contract.totalSupply();
    const tokensSold = Number(totalSupplyWei / TOKEN_DECIMALS);

    await query(`
        UPDATE rwa_assets
        SET tokens_sold = $2, updated_at = NOW()
        WHERE asset_id = $1
    `, [assetId, tokensSold]);
}

export async function reconcileAssetHoldings(assetId: string, tokenAddress: string) {
    if (!ethers.isAddress(tokenAddress) || tokenAddress === ethers.ZeroAddress) {
        throw new Error('Invalid token contract address');
    }

    const provider = getProvider();
    const contract = new ethers.Contract(tokenAddress, TOKEN_INDEXER_ABI, provider);
    const currentBlock = await provider.getBlockNumber();
    const wallets = new Set<string>();

    for (let fromBlock = 0; fromBlock <= currentBlock; fromBlock += BATCH_SIZE + 1) {
        const toBlock = Math.min(fromBlock + BATCH_SIZE, currentBlock);
        const events = await contract.queryFilter(contract.filters.Transfer(), fromBlock, toBlock);
        for (const event of events) {
            const log = event as ethers.EventLog;
            const from = (log.args[0] as string).toLowerCase();
            const to = (log.args[1] as string).toLowerCase();
            if (from !== ethers.ZeroAddress.toLowerCase()) wallets.add(from);
            if (to !== ethers.ZeroAddress.toLowerCase()) wallets.add(to);
        }
    }

    const existing = await query(
        `SELECT wallet_address FROM investor_holdings WHERE asset_id = $1`,
        [assetId]
    );
    for (const row of existing.rows) {
        if (row.wallet_address) wallets.add(String(row.wallet_address).toLowerCase());
    }

    for (const wallet of wallets) {
        await syncHoldingBalance(contract, assetId, wallet);
    }
    await syncTokensSold(contract, assetId);

    return {
        wallets_checked: wallets.size,
        current_block: currentBlock,
    };
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
