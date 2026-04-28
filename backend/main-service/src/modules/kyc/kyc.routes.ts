import { Router } from 'express';
import multer from 'multer';
import { authenticate, authorize } from '../../middleware/auth.middleware';
import {
    submitKYC,
    uploadKYCDocument,
    getKYCStatus,
    listSubmissions,
    reviewSubmission,
} from './kyc.controller';

const router = Router();

// Multer for KYC document upload (memory storage → Cloudinary)
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB per file
    fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
        }
    },
});

/* ── User routes (authenticated) ─────────────────────────────────────────── */

// Submit KYC with document uploads
router.post(
    '/submit',
    authenticate,
    upload.fields([
        { name: 'document_front', maxCount: 1 },
        { name: 'document_back', maxCount: 1 },
        { name: 'selfie', maxCount: 1 },
    ]),
    submitKYC
);

// Upload a single KYC document (returns Cloudinary URL)
router.post(
    '/upload-document',
    authenticate,
    upload.single('file'),
    uploadKYCDocument
);

// Get own KYC status
router.get('/status', authenticate, getKYCStatus);

/* ── Admin routes ────────────────────────────────────────────────────────── */

// List all submissions (with optional ?status=PENDING filter)
router.get('/submissions', authenticate, authorize('admin'), listSubmissions);

// Approve or reject a submission
router.patch('/submissions/:id/review', authenticate, authorize('admin'), reviewSubmission);

export default router;
