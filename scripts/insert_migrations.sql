INSERT INTO schema_migrations(version,name,filename,applied_by)
VALUES ('002','dispute_system_improvements','002_dispute_system_improvements.sql','manual-ssh')
ON CONFLICT(version) DO NOTHING;
SELECT version, name, applied_by FROM schema_migrations ORDER BY version;
