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

// ── All routes go through internal key middleware ────────────────────────────
// The main-service proxy handles public vs authenticated access.
// When accessed directly (dev), all routes require the internal service key.
app.use('/api/rwa/assets', requireInternalKey, assetsRouter);
app.use('/api/rwa/kyc', requireInternalKey, kycRouter);
app.use('/api/rwa/profit', requireInternalKey, profitRouter);
app.use('/api/rwa/portfolio', requireInternalKey, portfolioRouter);
app.use('/api/rwa/holders', requireInternalKey, holdersRouter);
app.use('/api/rwa/governance', requireInternalKey, governanceRouter);
app.use('/api/rwa/buyout', requireInternalKey, buyoutRouter);
app.use('/api/rwa/market', requireInternalKey, marketRouter);

const PORT = parseInt(process.env.PORT || '3003', 10);
app.listen(PORT, () => {
    console.log(`[tokenization-service] Listening on :${PORT}`);
    // Start Transfer event indexer (non-blocking)
    startTransferIndexer();
});

export default app;
