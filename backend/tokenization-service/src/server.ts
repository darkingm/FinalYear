import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { assetsRouter } from './modules/assets/assets.routes';
import { kycRouter } from './modules/kyc/kyc.routes';
import { profitRouter } from './modules/profit/profit.routes';
import { portfolioRouter } from './modules/portfolio/portfolio.routes';
import { requireInternalKey } from './middleware/internal-auth';
import { startTransferIndexer } from './indexer/transfer-indexer';
import { holdersRouter } from './modules/holders/holders.routes';
import { governanceRouter } from './modules/governance/governance.routes';
import { buyoutRouter } from './modules/buyout/buyout.routes';
import { marketRouter } from './modules/market/market.routes';

dotenv.config();

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());
app.use(morgan('dev'));

// Health
app.get('/health', (_, res) => res.json({ ok: true, service: 'tokenization-service' }));

// ── Public read routes (no auth) ─────────────────────────────────────────────
app.get('/api/rwa/assets', assetsRouter);
app.get('/api/rwa/assets/:id', assetsRouter);
app.get('/api/rwa/kyc/status/:wallet', kycRouter);
app.get('/api/rwa/portfolio/:userId', portfolioRouter);
app.get('/api/rwa/portfolio/:assetId/pending/:walletAddress', portfolioRouter);
app.get('/api/rwa/profit/:assetId/history', profitRouter);
app.get('/api/rwa/profit/:assetId/stats', profitRouter);
app.use('/api/rwa/holders', holdersRouter);
app.use('/api/rwa/governance', governanceRouter); // GET routes are public
app.use('/api/rwa/buyout', buyoutRouter);
app.use('/api/rwa/market', marketRouter);

// ── Mutating routes (require internal service key) ───────────────────────────
// All POST/PATCH/DELETE go through main-service proxy with X-Internal-Service-Key
app.use('/api/rwa/assets', requireInternalKey, assetsRouter);
app.use('/api/rwa/kyc', requireInternalKey, kycRouter);
app.use('/api/rwa/profit', requireInternalKey, profitRouter);
app.use('/api/rwa/portfolio', requireInternalKey, portfolioRouter);
app.use('/api/rwa/governance', requireInternalKey, governanceRouter); // POST routes need internal key
app.use('/api/rwa/buyout', requireInternalKey, buyoutRouter);
app.use('/api/rwa/market', requireInternalKey, marketRouter);

const PORT = parseInt(process.env.PORT || '3003', 10);
app.listen(PORT, () => {
    console.log(`[tokenization-service] Listening on :${PORT}`);
    // Start Transfer event indexer (non-blocking)
    startTransferIndexer();
});

export default app;
