import express from 'express';
import { ReportController } from '../controllers/report.controller';

const router = express.Router();

// Public routes
router.get('/', ReportController.getReports);
router.get('/latest', ReportController.getLatestReport);
router.get('/:id', ReportController.getReportById);

// Admin routes (require admin role, checked by API Gateway)
router.post('/admin/generate', ReportController.generateReport);

export default router;

