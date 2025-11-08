# ⚡ HƯỚNG DẪN NHANH - KHỞI ĐỘNG & TEST

## 🚀 KHỞI ĐỘNG NHANH (3 BƯỚC)

### Bước 1: Chuẩn bị
```bash
cd C:\Users\kien\Documents\FYP

# Copy file env
copy env.example .env
```

### Bước 2: Khởi động (CHỌN 1 TRONG 2 CÁCH)

#### CÁCH 1: Docker (KHUYẾN NGHỊ - DỄ NHẤT)
```bash
docker-compose up -d
```

#### CÁCH 2: Chạy thủ công (11 cửa sổ)
- Double click file: **`start-all.bat`**
- Chờ tất cả services khởi động (~30 giây)

### Bước 3: Kiểm tra Health
- Double click file: **`check-health.bat`**
- Xem tất cả services đã OK chưa

---

## ✅ KIỂM TRA NHANH

### 1. Kiểm tra Services (30 giây)
```bash
# Hoặc dùng browser mở các link sau:
http://localhost:3000/health  # API Gateway
http://localhost:3001/health  # Auth Service
http://localhost:3002/health  # User Service
http://localhost:3003/health  # Product Service
http://localhost:3004/health  # Coin Market
http://localhost:3005/health  # Order Service
http://localhost:3006/health  # Payment Service
http://localhost:3007/health  # Blockchain Service
http://localhost:3008/health  # Chat Service
http://localhost:3009/health  # Social Service
http://localhost:3010/health  # AI Analysis Service
```

**Tất cả phải trả về:** `{"status":"OK"}`

### 2. Kiểm tra Frontend (10 giây)
```bash
# Mở browser:
http://localhost:5173
```

**Phải thấy:** Homepage với Top 10 coins và sản phẩm

---

## 🧪 TEST NHANH CÁC CHỨC NĂNG

### Test 1: Đăng ký User (2 phút)
```bash
# PowerShell hoặc Git Bash
curl -X POST http://localhost:3000/api/v1/auth/register `
  -H "Content-Type: application/json" `
  -d '{
    \"username\": \"testuser\",
    \"email\": \"test@example.com\",
    \"password\": \"Test123!@#\",
    \"fullName\": \"Test User\"
  }'
```

**Kết quả:** Nhận được response với message "OTP sent"

### Test 2: Lấy Top 10 Coins (30 giây)
```bash
curl http://localhost:3000/api/v1/coins/top
```

**Kết quả:** Danh sách 10 coins với giá real-time

### Test 3: Lấy Products (30 giây)
```bash
curl http://localhost:3000/api/v1/products
```

**Kết quả:** Danh sách products (hoặc array rỗng nếu chưa có data)

### Test 4: Market Analysis (30 giây)
```bash
curl http://localhost:3000/api/v1/analysis
```

**Kết quả:** AI analysis data cho các coins

---

## 🌐 TEST QUA BROWSER (DỄ NHẤT)

1. **Mở:** http://localhost:5173
2. **Click "Login/Register"**
3. **Nhập:**
   - Email: test@example.com
   - Password: Test123!@#
4. **Xem Top 10 Coins** hiển thị
5. **Xem Products** hiển thị
6. **Click vào 1 product** để xem chi tiết
7. **Thử "Add to Cart"**

---

## 🔧 XỬ LÝ LỖI

### Lỗi: Port already in use
```bash
# Tìm process
netstat -ano | findstr :3000

# Kill process (thay <PID>)
taskkill /PID <PID> /F
```

### Lỗi: Cannot connect to database
```bash
# Restart Docker containers
docker-compose restart postgres mongodb redis

# Hoặc khởi động lại tất cả
docker-compose down
docker-compose up -d
```

### Lỗi: Module not found
```bash
# Vào thư mục service bị lỗi
cd services/SERVICE_NAME

# Cài lại
npm install
```

---

## 📝 TEST BẰNG FILE api-tests.http

1. **Cài VS Code extension:** "REST Client"
2. **Mở file:** `api-tests.http`
3. **Click "Send Request"** bên trên mỗi API
4. **Xem kết quả** ngay trong VS Code

---

## ✅ CHECKLIST HOÀN CHỈNH

- [ ] Tất cả 11 services health check OK
- [ ] Frontend mở được (localhost:5173)
- [ ] Top 10 coins hiển thị
- [ ] Products hiển thị
- [ ] Đăng ký user thành công
- [ ] Login thành công
- [ ] Add to cart thành công
- [ ] Cart hiển thị đúng
- [ ] Checkout form hiển thị
- [ ] Profile page mở được

**Nếu tất cả OK = DỰ ÁN CHẠY HOÀN HẢO! 🎊**

---

## 📞 HỖ TRỢ

### Xem Logs chi tiết

**Docker:**
```bash
docker-compose logs -f SERVICE_NAME
```

**Manual:**
- Xem console của từng terminal window
- Tìm dòng có "error" hoặc "failed"

### Databases

**PostgreSQL:**
```bash
psql -U postgres
# Password: 1

\l  # List databases
\c auth_db  # Connect
\dt  # List tables
```

**MongoDB:**
```bash
mongosh

show dbs  # List databases
use product_db  # Use database
show collections  # List collections
```

---

## 🎯 NEXT STEPS

Sau khi tất cả chạy OK:
1. Tạo admin user để test Admin Dashboard
2. Tạo seller để test Seller features
3. Test blockchain tokenization
4. Test chat/support features
5. Test social posts

**Chi tiết:** Xem file **`TEST_GUIDE.md`**

---

**GỌN NHẸ, NHANH CHÓNG, DỄ TEST!** ⚡


