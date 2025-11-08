# 🔐 HƯỚNG DẪN CẤU HÌNH OAUTH (GOOGLE & FACEBOOK)

## 📋 TỔNG QUAN

Dự án hỗ trợ đăng nhập bằng:
- ✅ **Google OAuth 2.0**
- ✅ **Facebook OAuth 2.0**

---

## 🔵 GOOGLE OAUTH SETUP

### Bước 1: Tạo Google OAuth Credentials

1. **Truy cập Google Cloud Console:**
   - Vào: https://console.cloud.google.com/
   - Đăng nhập bằng tài khoản Google

2. **Tạo Project mới:**
   - Click "Select a project" → "New Project"
   - Đặt tên: `TokenAsset Platform`
   - Click "Create"

3. **Bật Google+ API:**
   - Vào "APIs & Services" → "Library"
   - Tìm "Google+ API" hoặc "Google Identity"
   - Click "Enable"

4. **Tạo OAuth 2.0 Credentials:**
   - Vào "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "OAuth client ID"
   - Nếu chưa có OAuth consent screen:
     - Click "Configure Consent Screen"
     - Chọn "External" → "Create"
     - Điền thông tin:
       - App name: `TokenAsset Platform`
       - User support email: Email của bạn
       - Developer contact: Email của bạn
     - Click "Save and Continue"
     - Scopes: Click "Save and Continue" (giữ mặc định)
     - Test users: Thêm email test (nếu cần)
     - Click "Save and Continue" → "Back to Dashboard"

5. **Tạo OAuth Client ID:**
   - Application type: **Web application**
   - Name: `TokenAsset Web Client`
   - Authorized JavaScript origins:
     ```
     http://localhost:3000
     http://localhost:5173
     https://yourdomain.com (nếu có)
     ```
   - Authorized redirect URIs:
     ```
     http://localhost:3000/api/v1/auth/google/callback
     https://yourdomain.com/api/v1/auth/google/callback (nếu có)
     ```
   - Click "Create"

6. **Lấy Credentials:**
   - Copy **Client ID** và **Client Secret**
   - Lưu vào file `.env`

---

### Bước 2: Cấu hình trong dự án

1. **Thêm vào file `.env`:**
   ```env
   # Google OAuth
   GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   GOOGLE_CALLBACK_URL=http://localhost:3000/api/v1/auth/google/callback
   ```

2. **Kiểm tra routes:**
   - File: `services/auth-service/src/routes/auth.routes.ts`
   - Đảm bảo có routes:
     ```typescript
     router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
     router.get('/google/callback', 
       passport.authenticate('google', { session: false }),
       (req, res) => {
         // Handle callback
       }
     );
     ```

---

## 🔵 FACEBOOK OAUTH SETUP

### Bước 1: Tạo Facebook App

1. **Truy cập Facebook Developers:**
   - Vào: https://developers.facebook.com/
   - Đăng nhập bằng tài khoản Facebook

2. **Tạo App mới:**
   - Click "My Apps" → "Create App"
   - Chọn "Consumer" → "Next"
   - Đặt tên: `TokenAsset Platform`
   - Điền email liên hệ
   - Click "Create App"

3. **Thêm Facebook Login:**
   - Vào "Add Product" → Tìm "Facebook Login"
   - Click "Set Up"
   - Chọn "Web" → "Next"

4. **Cấu hình Facebook Login:**
   - Vào "Settings" → "Basic"
   - Điền thông tin:
     - App Domains: `localhost` (development)
     - Privacy Policy URL: (nếu có)
     - Terms of Service URL: (nếu có)
   - Vào "Settings" → "Facebook Login" → "Settings"
   - Valid OAuth Redirect URIs:
     ```
     http://localhost:3000/api/v1/auth/facebook/callback
     https://yourdomain.com/api/v1/auth/facebook/callback (nếu có)
     ```
   - Click "Save Changes"

5. **Lấy App ID & App Secret:**
   - Vào "Settings" → "Basic"
   - Copy **App ID** và **App Secret**
   - Lưu vào file `.env`

---

### Bước 2: Cấu hình trong dự án

1. **Thêm vào file `.env`:**
   ```env
   # Facebook OAuth
   FACEBOOK_APP_ID=your-facebook-app-id
   FACEBOOK_APP_SECRET=your-facebook-app-secret
   FACEBOOK_CALLBACK_URL=http://localhost:3000/api/v1/auth/facebook/callback
   ```

2. **Kiểm tra routes:**
   - File: `services/auth-service/src/routes/auth.routes.ts`
   - Đảm bảo có routes:
     ```typescript
     router.get('/facebook', passport.authenticate('facebook', { scope: ['email'] }));
     router.get('/facebook/callback',
       passport.authenticate('facebook', { session: false }),
       (req, res) => {
         // Handle callback
       }
     );
     ```

---

## 🔧 CẤU HÌNH ĐẦY ĐỦ

### File `.env` mẫu:

```env
# Google OAuth
GOOGLE_CLIENT_ID=123456789-abcdefghijklmnop.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-abcdefghijklmnopqrstuvwxyz
GOOGLE_CALLBACK_URL=http://localhost:3000/api/v1/auth/google/callback

# Facebook OAuth
FACEBOOK_APP_ID=1234567890123456
FACEBOOK_APP_SECRET=abcdefghijklmnopqrstuvwxyz123456
FACEBOOK_CALLBACK_URL=http://localhost:3000/api/v1/auth/facebook/callback
```

---

## ✅ KIỂM TRA

### Test Google OAuth:

1. **Khởi động services:**
   ```bash
   docker-compose up -d
   # hoặc
   npm run dev
   ```

2. **Mở browser:**
   ```
   http://localhost:5173
   ```

3. **Click "Login" → "Google"**
   - Sẽ redirect đến Google login
   - Đăng nhập bằng Google account
   - Sẽ redirect về app với token

### Test Facebook OAuth:

1. **Click "Login" → "Facebook"**
   - Sẽ redirect đến Facebook login
   - Đăng nhập bằng Facebook account
   - Sẽ redirect về app với token

---

## ⚠️ LƯU Ý

### Development:
- ✅ Sử dụng `http://localhost:3000` cho callbacks
- ✅ Thêm test users trong Google/Facebook console
- ✅ App ở chế độ "Development" (chưa review)

### Production:
- ⚠️ Cần thay đổi URLs thành domain thật
- ⚠️ Cần submit app để review (Facebook)
- ⚠️ Cần cấu hình HTTPS
- ⚠️ Cần thêm Privacy Policy & Terms of Service

---

## 🐛 XỬ LÝ LỖI

### Lỗi: "redirect_uri_mismatch"
- **Nguyên nhân:** Redirect URI không khớp
- **Giải pháp:** Kiểm tra lại redirect URIs trong Google/Facebook console

### Lỗi: "invalid_client"
- **Nguyên nhân:** Client ID hoặc Secret sai
- **Giải pháp:** Kiểm tra lại trong file `.env`

### Lỗi: "access_denied"
- **Nguyên nhân:** User từ chối permission
- **Giải pháp:** Bình thường, user có thể từ chối

### Lỗi: "App not in development mode"
- **Nguyên nhân:** Facebook app chưa được cấu hình đúng
- **Giải pháp:** Vào Facebook Developers → Settings → Basic → Thêm test users

---

## 📚 TÀI LIỆU THAM KHẢO

- **Google OAuth:** https://developers.google.com/identity/protocols/oauth2
- **Facebook OAuth:** https://developers.facebook.com/docs/facebook-login
- **Passport.js Google:** https://github.com/jaredhanson/passport-google-oauth2
- **Passport.js Facebook:** https://github.com/jaredhanson/passport-facebook

---

## 🎯 NEXT STEPS

Sau khi cấu hình xong:
1. ✅ Test Google OAuth
2. ✅ Test Facebook OAuth
3. ✅ Kiểm tra user được tạo trong database
4. ✅ Kiểm tra tokens được lưu đúng

**GOOD LUCK! 🚀**

