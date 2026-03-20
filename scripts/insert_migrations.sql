INSERT INTO schema_migrations(version,name,filename,applied_by)
VALUES ('001','payment_system_fixes','001_payment_system_fixes.sql','manual-ssh'),
       ('002','dispute_system_improvements','002_dispute_system_improvements.sql','manual-ssh')
ON CONFLICT(version) DO NOTHING;
SELECT version, name, applied_by, applied_at::timestamp(0) FROM schema_migrations ORDER BY version;
