import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth.middleware';
import { WalletsService } from './wallets.service';

const walletsService = new WalletsService();

export async function getWallets(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const wallets = await walletsService.getUserWallets(req.user!.user_id);
        res.json({ success: true, data: wallets });
    } catch (err) { next(err); }
}

export async function addWallet(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const wallet = await walletsService.addWallet(req.user!.user_id, req.body);
        res.status(201).json({ success: true, data: wallet });
    } catch (err) { next(err); }
}

export async function removeWallet(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        await walletsService.removeWallet(req.user!.user_id, parseInt(req.params.id));
        res.json({ success: true, message: 'Wallet removed' });
    } catch (err) { next(err); }
}

export async function setPrimary(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        await walletsService.setPrimary(req.user!.user_id, parseInt(req.params.id));
        res.json({ success: true, message: 'Primary wallet updated' });
    } catch (err) { next(err); }
}

export async function updateWalletLabel(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const label = typeof req.body?.label === 'string' ? req.body.label.slice(0, 100) : null;
        const wallet = await walletsService.updateLabel(
            req.user!.user_id,
            parseInt(req.params.id),
            label,
        );
        res.json({ success: true, data: wallet });
    } catch (err) { next(err); }
}

export async function setSellerPayout(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const result = await walletsService.setSellerPayout(
            req.user!.user_id,
            parseInt(req.params.id),
        );
        res.json({ success: true, data: result });
    } catch (err) { next(err); }
}

export async function createDepositIntent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const { chain_id, token_id, amount, from_address, ttl_minutes } = req.body || {};
        if (!chain_id || !token_id || amount === undefined || !from_address) {
            return res.status(400).json({ success: false, message: 'chain_id, token_id, amount, from_address are required' });
        }
        const intent = await walletsService.createDepositIntent(req.user!.user_id, {
            chain_id: Number(chain_id),
            token_id: Number(token_id),
            amount,
            from_address,
            ttl_minutes,
        });
        res.status(201).json({ success: true, data: intent });
    } catch (err) { next(err); }
}

export async function listDepositIntents(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const intents = await walletsService.listDepositIntents(req.user!.user_id);
        res.json({ success: true, data: intents });
    } catch (err) { next(err); }
}

export async function cancelDepositIntent(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const intent = await walletsService.cancelDepositIntent(
            req.user!.user_id,
            parseInt(req.params.id),
        );
        res.json({ success: true, data: intent });
    } catch (err) { next(err); }
}

export async function getDepositHistory(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const deposits = await walletsService.getDepositHistory(req.user!.user_id, req.query.status as string);
        res.json({ success: true, data: deposits });
    } catch (err) { next(err); }
}

export async function getDepositAddresses(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const addresses = await walletsService.getDepositAddresses();
        res.json({ success: true, data: addresses });
    } catch (err) { next(err); }
}

export async function getSupportedChains(_req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const chains = await walletsService.getSupportedChains();
        res.json({ success: true, data: chains });
    } catch (err) { next(err); }
}

export async function getChainTokens(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const tokens = await walletsService.getChainTokens(parseInt(req.params.chainId));
        res.json({ success: true, data: tokens });
    } catch (err) { next(err); }
}
