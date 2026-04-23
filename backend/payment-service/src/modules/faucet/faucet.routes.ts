import { Router, Request, Response } from 'express';
import { ethers } from 'ethers';
import { authenticate } from '../../middleware/auth.middleware';
import { logger } from '../../utils/logger';

const router = Router();

/**
 * POST /api/faucet/hardhat
 * Sends 10 ETH test tokens from Hardhat account #0 to the requesting wallet.
 * Only works on chain 31337 (Hardhat VPS). Rate-limited by balance check.
 * 
 * This is a TESTNET ONLY feature — disabled if TESTNET_MODE=false.
 */
router.post('/hardhat', authenticate, async (req: Request, res: Response) => {
    try {
        // Guard: only allowed in testnet mode
        const isTestnet = process.env.TESTNET_MODE !== 'false';
        if (!isTestnet) {
            return res.status(403).json({ success: false, message: 'Faucet is only available on testnet' });
        }

        const recipientWallet: string | undefined = (req as any).user?.wallet_address || req.body.wallet;
        if (!recipientWallet || !/^0x[0-9a-fA-F]{40}$/.test(recipientWallet)) {
            return res.status(400).json({ success: false, message: 'Invalid wallet address. Please connect your MetaMask wallet first.' });
        }

        const privateKey = process.env.ADMIN_PRIVATE_KEY || process.env.BLOCKCHAIN_PRIVATE_KEY || process.env.PRIVATE_KEY || process.env.MINTER_PRIVATE_KEY;
        if (!privateKey) {
            return res.status(500).json({ success: false, message: 'Faucet not configured on server' });
        }

        const rpcUrl = process.env.LOCALHOST_RPC_URL || 'http://103.20.96.79:8545';
        const provider = new ethers.JsonRpcProvider(rpcUrl);

        // Runtime guard: verify the RPC is actually Hardhat (chain 31337)
        // This prevents accidental fund drain if env misconfigures RPC to a real network
        const network = await provider.getNetwork();
        if (Number(network.chainId) !== 31337) {
            logger.warn('Faucet rejected: RPC chain is not Hardhat', { chainId: Number(network.chainId), rpcUrl });
            return res.status(403).json({
                success: false,
                message: `Faucet only works on Hardhat (chain 31337). Connected RPC reports chain ${network.chainId}.`,
            });
        }

        const faucetWallet = new ethers.Wallet(privateKey, provider);

        // Check faucet wallet balance
        const faucetBalance = await provider.getBalance(faucetWallet.address);
        const faucetEth = Number(ethers.formatEther(faucetBalance));
        if (faucetEth < 11) {
            return res.status(503).json({
                success: false,
                message: `Faucet balance too low (${faucetEth.toFixed(2)} ETH). Contact admin to refill.`,
            });
        }

        // Check recipient current balance
        const recipientBalance = await provider.getBalance(recipientWallet);
        const recipientEth = Number(ethers.formatEther(recipientBalance));
        if (recipientEth >= 10.0) {
            return res.status(429).json({
                success: false,
                message: `Wallet already has ${recipientEth.toFixed(4)} ETH on Hardhat chain. No refill needed.`,
            });
        }

        // Send 10 ETH
        const amountToSend = ethers.parseEther('10.0');
        const tx = await faucetWallet.sendTransaction({
            to: recipientWallet,
            value: amountToSend,
        });
        await tx.wait(1);

        logger.info('Faucet sent ETH', {
            recipient: recipientWallet,
            amount: '10.0 ETH',
            tx_hash: tx.hash,
            chain: 31337,
        });

        return res.json({
            success: true,
            message: 'Sent 10 ETH test to your wallet!',
            tx_hash: tx.hash,
            amount: '10.0 ETH',
            recipient: recipientWallet,
            note: 'These tokens only work on Hardhat VPS testnet (chain 31337).',
        });
    } catch (error: any) {
        logger.error('Faucet error:', error);
        return res.status(500).json({
            success: false,
            message: error.message || 'Faucet request failed',
        });
    }
});

/**
 * GET /api/faucet/balance
 * Returns faucet wallet ETH balance (for display purposes)
 */
router.get('/balance', async (_req: Request, res: Response) => {
    try {
        const isTestnet = process.env.TESTNET_MODE !== 'false';
        if (!isTestnet) {
            return res.json({ success: true, balance: null, available: false });
        }

        const privateKey = process.env.ADMIN_PRIVATE_KEY || process.env.BLOCKCHAIN_PRIVATE_KEY || process.env.PRIVATE_KEY || process.env.MINTER_PRIVATE_KEY;
        if (!privateKey) return res.json({ success: true, balance: null, available: false });

        const rpcUrl = process.env.LOCALHOST_RPC_URL || 'http://103.20.96.79:8545';
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const faucetWallet = new ethers.Wallet(privateKey, provider);
        const balance = await provider.getBalance(faucetWallet.address);

        return res.json({
            success: true,
            balance: parseFloat(ethers.formatEther(balance)).toFixed(4),
            available: Number(ethers.formatEther(balance)) >= 1.1,
            chain: 31337,
        });
    } catch {
        return res.json({ success: true, balance: null, available: false });
    }
});

export default router;
