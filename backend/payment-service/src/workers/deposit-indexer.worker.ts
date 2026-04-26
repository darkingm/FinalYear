import { ethers } from 'ethers';
import { mainQuery } from '../config/database';
import { publishEvent } from '../config/rabbitmq';
import { getRequiredConfirmationsForChain } from '../modules/crypto-payment/crypto-payment.status';
import { logger } from '../utils/logger';

/**
 * Deposit Indexer Worker
 *
 * Scans whitelisted ERC-20 Transfer events (and optionally native txs) targeting
 * the per-chain platform deposit address. Each detected transfer is matched
 * against an active `wallet_deposit_intents` row to attribute the deposit to a
 * user; otherwise it falls back to matching `from_address` against verified
 * `user_wallets`.
 *
 * Confirmations are tracked using `getRequiredConfirmationsForChain`. When the
 * threshold is reached the deposit row transitions to `confirmed` and a
 * `deposit.confirmed` RabbitMQ event is published.
 *
 * Indexer state (last_indexed_block) is persisted per chain in
 * `deposit_indexer_state` so progress survives restarts.
 *
 * Real-time mode: if `<CHAIN>_WSS_URL` env var is set the indexer subscribes
 * to new blocks via WebSocket; otherwise it polls every 10 seconds.
 */

const ERC20_ABI = [
    'event Transfer(address indexed from, address indexed to, uint256 value)',
];

const NATIVE_ADDRESS = '0x0000000000000000000000000000000000000000';
const POLL_INTERVAL_MS = 10_000;
const BATCH_SIZE = 1000;
const MAX_CATCHUP_BLOCKS_FIRST_RUN = 5_000;

interface ChainConfig {
    chainId: number;
    httpUrls: string[];
    wssUrl?: string | null;
}

function buildChainConfigs(): ChainConfig[] {
    const configs: ChainConfig[] = [
        {
            chainId: 31337,
            httpUrls: [process.env.LOCALHOST_RPC_URL || 'http://127.0.0.1:8545'],
            wssUrl: process.env.LOCALHOST_WSS_URL || null,
        },
        {
            chainId: 84532,
            httpUrls: [process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'],
            wssUrl: process.env.BASE_SEPOLIA_WSS_URL || null,
        },
        {
            chainId: 80002,
            httpUrls: [
                process.env.POLYGON_AMOY_RPC_URL,
                'https://polygon-amoy.drpc.org',
                'https://rpc-amoy.polygon.technology',
            ].filter(Boolean) as string[],
            wssUrl: process.env.POLYGON_AMOY_WSS_URL || null,
        },
        {
            chainId: 97,
            httpUrls: [
                process.env.BSC_TESTNET_RPC_URL,
                'https://data-seed-prebsc-1-s1.binance.org:8545',
                'https://data-seed-prebsc-2-s1.binance.org:8545',
            ].filter(Boolean) as string[],
            wssUrl: process.env.BSC_TESTNET_WSS_URL || null,
        },
        {
            chainId: 421614,
            httpUrls: [process.env.ARB_SEPOLIA_RPC_URL || 'https://sepolia-rollup.arbitrum.io/rpc'],
            wssUrl: process.env.ARB_SEPOLIA_WSS_URL || null,
        },
    ];
    return configs.filter(c => c.httpUrls.length > 0);
}

function buildHttpProvider(urls: string[]): ethers.AbstractProvider {
    if (urls.length === 1) return new ethers.JsonRpcProvider(urls[0]);
    return new ethers.FallbackProvider(urls.map(u => new ethers.JsonRpcProvider(u)));
}

interface TokenRow {
    token_id: number;
    symbol: string;
    token_address: string;
    decimals: number;
    chain_id: number;
}

async function getPlatformDepositAddress(chainId: number): Promise<string | null> {
    const res = await mainQuery(
        `SELECT value FROM platform_config WHERE key = 'deposit_addresses'`
    );
    const map = res.rows[0]?.value || {};
    const addr = map[String(chainId)] || map[chainId];
    return typeof addr === 'string' && addr.startsWith('0x') ? addr.toLowerCase() : null;
}

async function getActiveTokens(chainId: number): Promise<TokenRow[]> {
    const res = await mainQuery(
        `SELECT token_id, symbol, token_address, decimals, chain_id
         FROM token_whitelist
         WHERE chain_id = $1 AND is_active = TRUE`,
        [chainId]
    );
    return res.rows;
}

async function getIndexerState(chainId: number): Promise<number> {
    const res = await mainQuery(
        `SELECT last_indexed_block FROM deposit_indexer_state WHERE chain_id = $1`,
        [chainId]
    );
    return res.rows[0] ? Number(res.rows[0].last_indexed_block) : 0;
}

async function setIndexerState(chainId: number, lastBlock: number) {
    await mainQuery(
        `INSERT INTO deposit_indexer_state (chain_id, last_indexed_block, last_indexed_at, updated_at)
         VALUES ($1, $2, NOW(), NOW())
         ON CONFLICT (chain_id) DO UPDATE
         SET last_indexed_block = EXCLUDED.last_indexed_block,
             last_indexed_at = NOW(),
             updated_at = NOW()`,
        [chainId, lastBlock]
    );
}

interface DepositCandidate {
    chainId: number;
    tokenId: number;
    decimals: number;
    txHash: string;
    blockNumber: number;
    fromAddress: string;
    toAddress: string;
    valueWei: bigint;
}

async function ingestDeposit(d: DepositCandidate): Promise<void> {
    const fromAddr = d.fromAddress.toLowerCase();
    const toAddr = d.toAddress.toLowerCase();
    // Use formatUnits to keep precision; pg numeric column accepts decimal string.
    const amountStr = ethers.formatUnits(d.valueWei, d.decimals);

    // 1. Try to match an active deposit intent
    const intentRes = await mainQuery(
        `SELECT intent_id, user_id FROM wallet_deposit_intents
         WHERE chain_id = $1 AND token_id = $2
           AND LOWER(from_address) = $3
           AND status = 'pending'
           AND expires_at > NOW()
           AND ABS(expected_amount - $4::numeric) <= GREATEST(expected_amount * 0.0001, 0.00000001)
         ORDER BY created_at ASC
         LIMIT 1`,
        [d.chainId, d.tokenId, fromAddr, amountStr]
    );

    let intentId: number | null = null;
    let userId: number | null = null;
    if (intentRes.rows.length) {
        intentId = intentRes.rows[0].intent_id;
        userId = intentRes.rows[0].user_id;
    } else {
        // 2. Fall back to matching from_address ∈ verified user_wallets
        const walletRes = await mainQuery(
            `SELECT user_id FROM user_wallets
             WHERE chain_type = 'evm' AND LOWER(address) = $1 AND is_verified = TRUE
             LIMIT 1`,
            [fromAddr]
        );
        if (walletRes.rows.length) userId = walletRes.rows[0].user_id;
    }

    // 3. Insert (idempotent via UNIQUE (tx_hash, chain_id)).
    //    On conflict update only NULL fields so we do not regress already-classified rows.
    const insert = await mainQuery(
        `INSERT INTO wallet_deposits
            (user_id, intent_id, token_id, chain_id, amount,
             tx_hash, from_address, to_address, block_number, confirmations, status)
         VALUES ($1,$2,$3,$4,$5::numeric,$6,$7,$8,$9,$10,'pending')
         ON CONFLICT (tx_hash, chain_id) DO UPDATE
         SET user_id   = COALESCE(wallet_deposits.user_id,   EXCLUDED.user_id),
             intent_id = COALESCE(wallet_deposits.intent_id, EXCLUDED.intent_id),
             updated_at = NOW()
         RETURNING deposit_id, status, (xmax = 0) AS inserted`,
        [userId, intentId, d.tokenId, d.chainId, amountStr,
            d.txHash, fromAddr, toAddr, d.blockNumber, 0]
    );

    if (!insert.rows.length) return;
    const depositId = insert.rows[0].deposit_id;
    const wasInserted = insert.rows[0].inserted === true;

    // 4. Bind intent → deposit (only if newly attached)
    if (intentId) {
        await mainQuery(
            `UPDATE wallet_deposit_intents
             SET status = 'matched', matched_deposit_id = $1, updated_at = NOW()
             WHERE intent_id = $2 AND status = 'pending'`,
            [depositId, intentId]
        );
    }

    if (wasInserted) {
        try {
            await publishEvent('deposit.detected', {
                deposit_id: depositId,
                user_id: userId,
                intent_id: intentId,
                chain_id: d.chainId,
                token_id: d.tokenId,
                amount: amountStr,
                tx_hash: d.txHash,
                from_address: fromAddr,
                to_address: toAddr,
                block_number: d.blockNumber,
            });
        } catch (err) {
            logger.warn('Failed to publish deposit.detected event', { err: (err as Error).message });
        }

        logger.info('[deposit-indexer] new deposit detected', {
            chain_id: d.chainId, deposit_id: depositId, user_id: userId,
            intent_matched: !!intentId, tx_hash: d.txHash, amount: amountStr,
        });
    }
}

async function refreshConfirmations(chainId: number, currentBlock: number): Promise<void> {
    const required = getRequiredConfirmationsForChain(chainId);
    const pendings = await mainQuery(
        `SELECT deposit_id, block_number, confirmations, status, user_id
         FROM wallet_deposits
         WHERE chain_id = $1 AND status IN ('pending','confirming')
           AND block_number IS NOT NULL`,
        [chainId]
    );

    for (const row of pendings.rows) {
        const blockNum = Number(row.block_number);
        const confs = Math.max(0, currentBlock - blockNum + 1);
        let nextStatus: 'pending' | 'confirming' | 'confirmed' = 'pending';
        if (required === 0 || confs >= required) nextStatus = 'confirmed';
        else if (confs > 0) nextStatus = 'confirming';

        if (nextStatus === row.status && confs === Number(row.confirmations)) continue;

        if (nextStatus === 'confirmed') {
            await mainQuery(
                `UPDATE wallet_deposits
                 SET status = 'confirmed', confirmations = $1, credited_at = NOW(), updated_at = NOW()
                 WHERE deposit_id = $2`,
                [confs, row.deposit_id]
            );
            try {
                await publishEvent('deposit.confirmed', {
                    deposit_id: row.deposit_id,
                    user_id: row.user_id,
                    chain_id: chainId,
                    confirmations: confs,
                });
            } catch (err) {
                logger.warn('Failed to publish deposit.confirmed event', { err: (err as Error).message });
            }
            logger.info('[deposit-indexer] deposit confirmed', {
                deposit_id: row.deposit_id, chain_id: chainId, confirmations: confs,
            });
        } else {
            await mainQuery(
                `UPDATE wallet_deposits
                 SET status = $1, confirmations = $2, updated_at = NOW()
                 WHERE deposit_id = $3`,
                [nextStatus, confs, row.deposit_id]
            );
        }
    }
}

async function indexChainOnce(chainId: number, provider: ethers.AbstractProvider): Promise<void> {
    const platformAddr = await getPlatformDepositAddress(chainId);
    if (!platformAddr) {
        // No deposit address configured — nothing to do for this chain.
        return;
    }

    const tokens = await getActiveTokens(chainId);
    if (tokens.length === 0) return;

    const currentBlock = await provider.getBlockNumber();
    const stored = await getIndexerState(chainId);
    let fromBlock = stored === 0
        ? Math.max(0, currentBlock - MAX_CATCHUP_BLOCKS_FIRST_RUN)
        : stored + 1;

    if (fromBlock > currentBlock) {
        await refreshConfirmations(chainId, currentBlock);
        return;
    }

    const toBlock = Math.min(fromBlock + BATCH_SIZE - 1, currentBlock);

    // 1) ERC-20 Transfer events targeting platformAddr
    const erc20Tokens = tokens.filter(
        t => t.token_address && t.token_address.toLowerCase() !== NATIVE_ADDRESS
    );
    for (const token of erc20Tokens) {
        try {
            const contract = new ethers.Contract(token.token_address, ERC20_ABI, provider);
            // Filter `to = platformAddr`, any from
            const events = await contract.queryFilter(
                contract.filters.Transfer(null, platformAddr),
                fromBlock,
                toBlock
            );
            for (const event of events) {
                const log = event as ethers.EventLog;
                const from = String(log.args[0]);
                const to = String(log.args[1]);
                const value = BigInt(log.args[2]);
                if (value === 0n) continue;
                await ingestDeposit({
                    chainId,
                    tokenId: token.token_id,
                    decimals: token.decimals,
                    txHash: log.transactionHash,
                    blockNumber: log.blockNumber,
                    fromAddress: from,
                    toAddress: to,
                    valueWei: value,
                });
            }
        } catch (err: any) {
            logger.warn(`[deposit-indexer] queryFilter failed for ${token.symbol}@${chainId}: ${err.message}`);
        }
    }

    // 2) Native coin transfers — only when a native token is whitelisted (token_address = 0x0...0).
    const nativeToken = tokens.find(
        t => t.token_address && t.token_address.toLowerCase() === NATIVE_ADDRESS
    );
    if (nativeToken) {
        for (let blockNum = fromBlock; blockNum <= toBlock; blockNum++) {
            try {
                const block = await provider.getBlock(blockNum, true);
                if (!block || !block.transactions) continue;
                for (const txOrHash of block.transactions) {
                    const tx = typeof txOrHash === 'string'
                        ? await provider.getTransaction(txOrHash)
                        : txOrHash as ethers.TransactionResponse;
                    if (!tx || !tx.to) continue;
                    if (tx.to.toLowerCase() !== platformAddr) continue;
                    if (!tx.value || tx.value === 0n) continue;
                    await ingestDeposit({
                        chainId,
                        tokenId: nativeToken.token_id,
                        decimals: nativeToken.decimals,
                        txHash: tx.hash,
                        blockNumber: tx.blockNumber ?? blockNum,
                        fromAddress: tx.from,
                        toAddress: tx.to,
                        valueWei: tx.value,
                    });
                }
            } catch (err: any) {
                logger.warn(`[deposit-indexer] native scan failed at block ${blockNum}@${chainId}: ${err.message}`);
            }
        }
    }

    await setIndexerState(chainId, toBlock);
    await refreshConfirmations(chainId, currentBlock);
}

export class DepositIndexerWorker {
    private intervals = new Map<number, NodeJS.Timeout>();
    private running = new Set<number>();
    private wssProviders = new Map<number, ethers.WebSocketProvider>();
    private httpProviders = new Map<number, ethers.AbstractProvider>();

    start() {
        if (process.env.DEPOSIT_INDEXER_ENABLED === 'false') {
            logger.info('[deposit-indexer] disabled via DEPOSIT_INDEXER_ENABLED=false');
            return;
        }

        const configs = buildChainConfigs();
        logger.info(`[deposit-indexer] starting for ${configs.length} chains`);

        for (const cfg of configs) {
            const httpProvider = buildHttpProvider(cfg.httpUrls);
            this.httpProviders.set(cfg.chainId, httpProvider);

            // Real-time mode: listen on WebSocket if available
            if (cfg.wssUrl) {
                try {
                    const wss = new ethers.WebSocketProvider(cfg.wssUrl);
                    wss.on('block', async () => {
                        // Use httpProvider for queryFilter (more reliable across nodes).
                        await this.runOnce(cfg.chainId, httpProvider);
                    });
                    this.wssProviders.set(cfg.chainId, wss);
                    logger.info(`[deposit-indexer] chain ${cfg.chainId}: WebSocket subscribed (${cfg.wssUrl})`);
                } catch (err: any) {
                    logger.warn(`[deposit-indexer] chain ${cfg.chainId}: WSS init failed, falling back to polling: ${err.message}`);
                }
            }

            // Polling fallback / supplement (also catches up after RPC outages)
            const interval = setInterval(() => this.runOnce(cfg.chainId, httpProvider), POLL_INTERVAL_MS);
            this.intervals.set(cfg.chainId, interval);
            // Initial run
            this.runOnce(cfg.chainId, httpProvider);
        }
    }

    private async runOnce(chainId: number, provider: ethers.AbstractProvider) {
        if (this.running.has(chainId)) return;
        this.running.add(chainId);
        try {
            await indexChainOnce(chainId, provider);
        } catch (err: any) {
            logger.error(`[deposit-indexer] chain ${chainId} indexing error: ${err.message}`);
        } finally {
            this.running.delete(chainId);
        }
    }

    stop() {
        for (const interval of this.intervals.values()) clearInterval(interval);
        this.intervals.clear();
        for (const wss of this.wssProviders.values()) {
            try { wss.destroy(); } catch { /* noop */ }
        }
        this.wssProviders.clear();
        logger.info('[deposit-indexer] stopped');
    }
}
