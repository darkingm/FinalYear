import { Request, Response } from 'express';
import Report from '../models/Report.model';
import { generateDailyReport } from '../services/report.service';
import logger from '../utils/logger';

export class ReportController {
  // Get all reports
  static async getReports(req: Request, res: Response) {
    try {
      const { page = 1, limit = 20, type } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      const skip = (pageNum - 1) * limitNum;

      const filter: any = { isPublished: true };
      if (type) filter.reportType = type;

      const [reports, total] = await Promise.all([
        Report.find(filter)
          .select('-content') // Exclude full content from list
          .sort({ reportDate: -1 })
          .skip(skip)
          .limit(limitNum)
          .lean(),
        Report.countDocuments(filter),
      ]);

      res.json({
        success: true,
        data: {
          reports,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error: any) {
      logger.error('Get reports error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch reports',
      });
    }
  }

  // Get report by ID
  static async getReportById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const report = await Report.findById(id);

      if (!report) {
        return res.status(404).json({
          success: false,
          error: 'Report not found',
        });
      }

      // Increment view count
      report.viewCount += 1;
      await report.save();

      res.json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      logger.error('Get report error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch report',
      });
    }
  }

  // Get latest report
  static async getLatestReport(req: Request, res: Response) {
    try {
      const { type = 'DAILY' } = req.query;

      const report = await Report.findOne({
        reportType: type,
        isPublished: true,
      }).sort({ reportDate: -1 });

      if (!report) {
        return res.status(404).json({
          success: false,
          error: 'No report available',
        });
      }

      // Increment view count
      report.viewCount += 1;
      await report.save();

      res.json({
        success: true,
        data: report,
      });
    } catch (error: any) {
      logger.error('Get latest report error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch latest report',
      });
    }
  }

  // Generate report manually (admin only)
  static async generateReport(req: Request, res: Response) {
    try {
      const report = await generateDailyReport();

      if (!report) {
        return res.status(500).json({
          success: false,
          error: 'Failed to generate report',
        });
      }

      res.status(201).json({
        success: true,
        data: report,
        message: 'Report generated successfully',
      });
    } catch (error: any) {
      logger.error('Generate report error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate report',
        details: error.message,
      });
    }
  }
}

