---
description: Tạo và deploy database migration mới
---

## Quy trình tạo DB Migration mới

Mỗi khi cần thay đổi database schema (thêm cột, bảng, index, constraint...), làm theo các bước sau:

### Bước 1: Tạo file migration mới

// turbo
1. Tìm số thứ tự tiếp theo trong `init_database.sql/migrations/`, ví dụ file cuối là `001_...`, tiếp theo là `002`.

2. Tạo file mới theo format: `init_database.sql/migrations/NNN_ten_mo_ta.sql`
   - `NNN` = số thứ tự 3 chữ số (001, 002, 003...)
   - Tên dùng underscore, ngắn gọn (vd: `002_add_user_kyc_fields`)

3. Nội dung file PHẢI:
   - Có comment header với Version, Name, Created, Description
   - Dùng `DO $$ BEGIN ... EXCEPTION WHEN duplicate_column THEN NULL; END $$;` cho ALTER TABLE ADD COLUMN
   - Dùng `CREATE TABLE IF NOT EXISTS` cho bảng mới
   - Dùng `CREATE INDEX IF NOT EXISTS` cho index
   - Kết thúc bằng `SELECT 'Migration NNN applied: name' AS result;`
   - **TUYỆT ĐỐI KHÔNG** dùng DROP TABLE, TRUNCATE, hoặc xóa data

**Template mẫu:**
```sql
-- Migration NNN: <Ten Migration>
-- Version: NNN
-- Name: <ten_migration>
-- Created: YYYY-MM-DD

-- Thêm cột mới
DO $$ BEGIN
  ALTER TABLE <table_name> ADD COLUMN <column_name> <TYPE> <DEFAULT>;
EXCEPTION WHEN duplicate_column THEN NULL; END $$;

-- Thêm bảng mới
CREATE TABLE IF NOT EXISTS <table_name> (
    id BIGSERIAL PRIMARY KEY,
    ...
);

-- Thêm index
CREATE INDEX IF NOT EXISTS idx_<table>_<column> ON <table>(<column>);

SELECT 'Migration NNN applied: <name>' AS result;
```

### Bước 2: Test migration local (optional nhưng nên làm)

// turbo
4. Nếu có PostgreSQL local, chạy thử:
```bash
psql -U postgres -d marketplace_db -f init_database.sql/migrations/NNN_name.sql
```
Nếu dùng Docker local:
```bash
docker exec marketplace-postgres psql -U postgres -d marketplace_db \
  -f /tmp/NNN_name.sql
```

### Bước 3: Deploy lên VPS

5. Commit và push code:
```bash
git add init_database.sql/migrations/NNN_name.sql
git commit -m "migration: add NNN_name"
git push
```

// turbo
6. Build và deploy (chạy từ project root):
```bash
# Build chỉ migrator (nhanh hơn build all)
BUILD_ALL=false bash scripts/deploy.sh

# Hoặc build tất cả nếu có code changes
bash scripts/deploy.sh
```

Script sẽ tự động:
- Build image `marketplace-db-migrator:latest` với migration mới
- Push lên Docker Hub
- SSH vào VPS, pull image mới
- Chạy `db-migrator` container — chỉ apply migration chưa có trong `schema_migrations`
- Khởi động lại `main-api` và `payment-api` sau khi migration xong

### Bước 4: Xác nhận trên VPS

7. Kiểm tra migration đã chạy:
```bash
ssh root@103.20.96.79
docker logs marketplace-db-migrator
# Xem bảng migration history:
docker exec marketplace-postgres psql -U postgres -d marketplace_db \
  -c "SELECT version, name, applied_at FROM schema_migrations ORDER BY version;"
```

---

## Quy tắc đặt tên

| Loại thay đổi | Ví dụ tên |
|---|---|
| Thêm cột | `002_add_user_kyc_fields` |
| Thêm bảng | `003_create_notifications_table` |
| Thêm index | `004_add_orders_status_index` |
| Fix constraint | `005_fix_disputes_unique_constraint` |
| Thêm nhiều thứ | `006_payment_system_improvements` |

## Lưu ý quan trọng

- **Không bao giờ sửa file migration đã được apply** — tạo migration mới thay thế
- **Không rollback** — viết migration forward-only
- Migration chạy theo thứ tự số, do đó đừng nhảy số
- `schema.sql` (file gốc) chỉ dùng cho fresh install — migrations mới KHÔNG cập nhật `schema.sql`
- Để giữ `schema.sql` sync với thực tế, định kỳ dump schema từ VPS: `pg_dump --schema-only`
