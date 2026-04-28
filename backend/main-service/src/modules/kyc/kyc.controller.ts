import { Request, Response, NextFunction } from 'express';
import { query } from '../../config/database';
import { logger } from '../../utils/logger';
import { AppError } from '../../middleware/error-handler';
import { AuthRequest } from '../../middleware/auth.middleware';
import axios from 'axios';

const TOKENIZATION_URL = process.env.TOKENIZATION_SERVICE_URL || 'http://localhost:3003';
const INTERNAL_KEY = process.env.INTERNAL_SERVICE_KEY || '';

/**
 * POST /api/kyc/submit
 * Authenticated user submits KYC documents.
 * Documents are pre-uploaded to Cloudinary; this stores the URLs.
 */
export async function submitKYC(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const userId = req.user!.user_id;
        const {
            full_name,
            date_of_birth,
            document_type,
            document_number,
            wallet_address,
        } = req.body;

        if (!full_name || !date_of_birth || !document_type || !document_number) {
            throw new AppError('Vui lòng điền đầy đủ thông tin KYC', 400);
        }

        // Check for existing active submission (PENDING/REVIEWING/APPROVED)
        const existing = await query(
            `SELECT submission_id, status FROM kyc_submissions
             WHERE user_id = $1 AND status != 'REJECTED'
             ORDER BY created_at DESC LIMIT 1`,
            [userId]
        );

        if (existing.rows.length > 0) {
            const s = existing.rows[0];
            if (s.status === 'APPROVED') {
                throw new AppError('KYC của bạn đã được xác minh', 400);
            }
            if (s.status === 'PENDING' || s.status === 'REVIEWING') {
                throw new AppError('Bạn đã có yêu cầu KYC đang chờ xử lý', 400);
            }
        }

        // Upload document images via multer (files are already in req.files)
        const files = req.files as Express.Multer.File[] | undefined;
        let documentFrontUrl: string | null = null;
        let documentBackUrl: string | null = null;
        let selfieUrl: string | null = null;

        if (files && files.length > 0) {
            const { uploadToCloudinary } = await import('../../config/cloudinary');

            for (const file of files) {
                const url = await uploadToCloudinary(file.buffer, 'kyc-documents');
                if (file.fieldname === 'document_front') documentFrontUrl = url;
                else if (file.fieldname === 'document_back') documentBackUrl = url;
                else if (file.fieldname === 'selfie') selfieUrl = url;
            }
        }

        // Also accept pre-uploaded URLs from body (for flexibility)
        if (!documentFrontUrl && req.body.document_front) documentFrontUrl = req.body.document_front;
        if (!documentBackUrl && req.body.document_back) documentBackUrl = req.body.document_back;
        if (!selfieUrl && req.body.selfie_url) selfieUrl = req.body.selfie_url;

        const result = await query(
            `INSERT INTO kyc_submissions
                (user_id, wallet_address, full_name, date_of_birth, document_type,
                 document_number, document_front, document_back, selfie_url, jurisdiction, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'PENDING')
             RETURNING *`,
            [
                userId,
                wallet_address || null,
                full_name.trim(),
                date_of_birth,
                document_type,
                document_number.trim(),
                documentFrontUrl,
                documentBackUrl,
                selfieUrl,
                'VN',
            ]
        );

        logger.info('KYC submission created', { userId, submissionId: result.rows[0].submission_id });

        res.status(201).json({
            message: 'Yêu cầu KYC đã được gửi thành công',
            submission: result.rows[0],
        });
    } catch (err) {
        next(err);
    }
}

/**
 * POST /api/kyc/upload-document
 * Upload a single KYC document image to Cloudinary.
 * Returns the URL for the frontend to store and send with submit.
 */
export async function uploadKYCDocument(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const file = req.file;
        if (!file) {
            throw new AppError('No file uploaded', 400);
        }

        const { uploadToCloudinary } = await import('../../config/cloudinary');
        const url = await uploadToCloudinary(file.buffer, 'kyc-documents');

        res.json({ url });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/kyc/status
 * Returns the user's current KYC submission status.
 */
export async function getKYCStatus(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const userId = req.user!.user_id;

        const result = await query(
            `SELECT submission_id, status, rejection_reason, full_name, document_type,
                    wallet_address, reviewed_at, created_at, updated_at
             FROM kyc_submissions
             WHERE user_id = $1
             ORDER BY created_at DESC
             LIMIT 1`,
            [userId]
        );

        if (result.rows.length === 0) {
            return res.json({ submission: null, kyc_verified: false });
        }

        const submission = result.rows[0];
        res.json({
            submission,
            kyc_verified: submission.status === 'APPROVED',
        });
    } catch (err) {
        next(err);
    }
}

/**
 * GET /api/kyc/submissions  (admin only)
 * List all KYC submissions, with optional status filter.
 */
export async function listSubmissions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const statusFilter = req.query.status as string | undefined;
        const page = parseInt(req.query.page as string) || 1;
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = (page - 1) * limit;

        let whereClause = '';
        const params: any[] = [limit, offset];

        if (statusFilter && statusFilter !== 'ALL') {
            whereClause = 'WHERE ks.status = $3';
            params.push(statusFilter);
        }

        const result = await query(
            `SELECT ks.*, u.username, u.email, u.role
             FROM kyc_submissions ks
             LEFT JOIN users u ON ks.user_id = u.user_id
             ${whereClause}
             ORDER BY
                CASE ks.status
                    WHEN 'PENDING' THEN 1
                    WHEN 'REVIEWING' THEN 2
                    WHEN 'APPROVED' THEN 3
                    WHEN 'REJECTED' THEN 4
                END,
                ks.created_at DESC
             LIMIT $1 OFFSET $2`,
            params
        );

        const countResult = await query(
            `SELECT COUNT(*) FROM kyc_submissions ks ${whereClause}`,
            statusFilter && statusFilter !== 'ALL' ? [statusFilter] : []
        );

        res.json({
            submissions: result.rows,
            total: parseInt(countResult.rows[0].count),
            page,
            limit,
        });
    } catch (err) {
        next(err);
    }
}

/**
 * PATCH /api/kyc/submissions/:id/review  (admin only)
 * Approve or reject a KYC submission.
 * On approve → auto-grant on-chain KYC + update seller profile if applicable.
 */
export async function reviewSubmission(req: AuthRequest, res: Response, next: NextFunction) {
    try {
        const submissionId = parseInt(req.params.id);
        const adminUserId = req.user!.user_id;
        const { action, rejection_reason } = req.body;

        if (!['APPROVED', 'REJECTED'].includes(action)) {
            throw new AppError('Action must be APPROVED or REJECTED', 400);
        }

        // Fetch submission
        const sub = await query(
            'SELECT * FROM kyc_submissions WHERE submission_id = $1',
            [submissionId]
        );

        if (sub.rows.length === 0) {
            throw new AppError('KYC submission not found', 404);
        }

        const submission = sub.rows[0];

        if (submission.status === 'APPROVED') {
            throw new AppError('Submission already approved', 400);
        }
        if (submission.status === 'REJECTED' && action === 'REJECTED') {
            throw new AppError('Submission already rejected', 400);
        }

        // Update submission status
        await query(
            `UPDATE kyc_submissions
             SET status = $1, rejection_reason = $2, reviewed_by = $3, reviewed_at = NOW(), updated_at = NOW()
             WHERE submission_id = $4`,
            [action, action === 'REJECTED' ? rejection_reason : null, adminUserId, submissionId]
        );

        // On approval: auto-grant on-chain KYC + update seller profile
        if (action === 'APPROVED') {
            // 1. Update seller_profiles.kyc_status if user is a seller
            await query(
                `UPDATE seller_profiles SET kyc_status = 'verified' WHERE user_id = $1`,
                [submission.user_id]
            ).catch(err => logger.warn('Failed to update seller KYC status:', err.message));

            // 2. Auto-grant on-chain KYC via tokenization service
            if (submission.wallet_address) {
                try {
                    await axios.post(
                        `${TOKENIZATION_URL}/api/rwa/kyc/grant`,
                        {
                            wallet_address: submission.wallet_address,
                            user_id: submission.user_id,
                            jurisdiction: submission.jurisdiction || 'VN',
                        },
                        {
                            headers: {
                                'Content-Type': 'application/json',
                                'X-Internal-Service-Key': INTERNAL_KEY,
                            },
                            timeout: 30000,
                        }
                    );
                    logger.info('On-chain KYC granted', {
                        userId: submission.user_id,
                        wallet: submission.wallet_address,
                    });
                } catch (chainErr: any) {
                    logger.error('Failed to grant on-chain KYC (will proceed with DB approval):', {
                        error: chainErr.response?.data || chainErr.message,
                        userId: submission.user_id,
                    });
                    // Don't fail the review — DB status is still approved
                }
            }
        }

        logger.info('KYC submission reviewed', {
            submissionId,
            action,
            adminUserId,
            userId: submission.user_id,
        });

        res.json({
            message: action === 'APPROVED'
                ? 'KYC đã được phê duyệt thành công'
                : 'KYC đã bị từ chối',
            submission_id: submissionId,
            status: action,
        });
    } catch (err) {
        next(err);
    }
}
