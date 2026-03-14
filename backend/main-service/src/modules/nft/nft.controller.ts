import { Request, Response, NextFunction } from 'express';
import { nftService } from './nft.service';

/**
 * POST /api/nft/mint/:productId  — Admin mints NFT for approved product
 */
export const mintNFT = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const productId = parseInt(req.params.productId);
    const hasNFC = req.body.hasNFC === true;
    const result = await nftService.mintProductNFT(productId, hasNFC);
    res.json({ success: true, data: result });
  } catch (e) { next(e); }
};

/**
 * GET /api/nft/product/:productId  — Get NFT info for a product
 */
export const getNFTInfo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const productId = parseInt(req.params.productId);
    const data = await nftService.getNFTInfo(productId);
    res.json({ success: true, data });
  } catch (e) { next(e); }
};

/**
 * GET /api/nft/credit/:wallet  — Get credit score info for a wallet
 */
export const getCreditInfo = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { wallet } = req.params;
    if (!wallet.match(/^0x[a-fA-F0-9]{40}$/)) {
      return res.status(400).json({ message: 'Invalid wallet address' });
    }
    const data = await nftService.getCreditInfo(wallet);
    res.json({ success: true, data });
  } catch (e) { next(e); }
};

/**
 * POST /api/nft/credit/record-order  — Backend/relayer records completed order
 */
export const recordCompletedOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { wallet, onTime } = req.body;
    await nftService.recordCompletedOrder(wallet, onTime ?? false);
    res.json({ success: true });
  } catch (e) { next(e); }
};
