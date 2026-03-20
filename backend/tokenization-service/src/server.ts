import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { assetsRouter } from './modules/assets/assets.routes';
import { kycRouter } from './modules/kyc/kyc.routes';
import { profitRouter } from './modules/profit/profit.routes';
import { portfolioRouter } from './modules/portfolio/portfolio.routes';

dotenv.config();

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());
app.use(morgan('dev'));

// Health
app.get('/health', (_, res) => res.json({ ok: true, service: 'tokenization-service' }));

// Routes
app.use('/api/rwa/assets', assetsRouter);
app.use('/api/rwa/kyc', kycRouter);
app.use('/api/rwa/profit', profitRouter);
app.use('/api/rwa/portfolio', portfolioRouter);

const PORT = parseInt(process.env.PORT || '3003', 10);
app.listen(PORT, () => console.log(`[tokenization-service] Listening on :${PORT}`));

export default app;
