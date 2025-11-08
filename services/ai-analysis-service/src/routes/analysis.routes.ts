import express from 'express';
import { AnalysisController } from '../controllers/analysis.controller';

const router = express.Router();

// Public routes
router.get('/', AnalysisController.getAllAnalyses);
router.get('/summary', AnalysisController.getMarketSummary);
router.get('/trending', AnalysisController.getTrendingAnalyses);
router.get('/:coinId', AnalysisController.getCoinAnalysis);

// Admin routes (require admin role, checked by API Gateway)
router.post('/admin/update', AnalysisController.triggerUpdate);

export default router;

