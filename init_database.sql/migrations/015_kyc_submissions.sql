-- Migration: KYC Submissions table
-- Stores user-submitted KYC documents for admin review

CREATE TABLE IF NOT EXISTS kyc_submissions (
    submission_id   SERIAL PRIMARY KEY,
    user_id         INT NOT NULL REFERENCES users(user_id),
    wallet_address  VARCHAR(42),
    full_name       VARCHAR(200) NOT NULL,
    date_of_birth   DATE NOT NULL,
    document_type   VARCHAR(20) NOT NULL
                        CHECK (document_type IN ('CCCD','PASSPORT','DRIVER_LICENSE')),
    document_number VARCHAR(50) NOT NULL,
    document_front  TEXT,           -- Cloudinary URL
    document_back   TEXT,           -- Cloudinary URL
    selfie_url      TEXT,           -- Cloudinary URL
    jurisdiction    VARCHAR(10)     DEFAULT 'VN',
    status          VARCHAR(20)     NOT NULL DEFAULT 'PENDING'
                        CHECK (status IN ('PENDING','REVIEWING','APPROVED','REJECTED')),
    rejection_reason TEXT,
    reviewed_by     INT,            -- admin user_id who reviewed
    reviewed_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Only one active (non-rejected) submission per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_kyc_submissions_active_user
    ON kyc_submissions(user_id) WHERE status != 'REJECTED';

CREATE INDEX IF NOT EXISTS idx_kyc_submissions_status ON kyc_submissions(status);
CREATE INDEX IF NOT EXISTS idx_kyc_submissions_user   ON kyc_submissions(user_id);
