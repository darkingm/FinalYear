# 🔐 OAuth Setup Guide - Google & Facebook Login

## 📋 Overview

Hướng dẫn chi tiết cách setup Google và Facebook OAuth để có thể đăng nhập/đăng ký bằng tài khoản Google hoặc Facebook.

---

## 🔵 Google OAuth Setup

### Bước 1: Tạo Google Cloud Project

1. Truy cập **Google Cloud Console**: https://console.cloud.google.com/

2. Click **"Select a project"** → **"NEW PROJECT"**
   - Project name: `Crypto Marketplace`
   - Click **"CREATE"**

3. Chờ project được tạo (~5 giây)

### Bước 2: Enable Google+ API

1. Trong project vừa tạo, vào **"APIs & Services"** → **"Library"**

2. Search: `Google+ API` hoặc `Google Identity`

3. Click **"Google+ API"** → **"ENABLE"**

### Bước 3: Configure OAuth Consent Screen

1. Vào **"APIs & Services"** → **"OAuth consent screen"**

2. Chọn **"External"** → Click **"CREATE"**

3. **App information:**
   - App name: `Crypto Marketplace`
   - User support email: `your-email@gmail.com`
   - App logo: (optional, có thể skip)

4. **App domain:**
   - Application home page: `http://localhost:3000`
   - Application privacy policy: `http://localhost:3000/privacy`
   - Application terms of service: `http://localhost:3000/terms`

5. **Developer contact information:**
   - Email: `your-email@gmail.com`

6. Click **"SAVE AND CONTINUE"**

7. **Scopes:** Click **"ADD OR REMOVE SCOPES"**
   - Chọn:
     - `userinfo.email`
     - `userinfo.profile`
     - `openid`
   - Click **"UPDATE"** → **"SAVE AND CONTINUE"**

8. **Test users:** (nếu app ở chế độ Testing)
   - Click **"ADD USERS"**
   - Thêm email của bạn và team members
   - Click **"SAVE AND CONTINUE"**

9. Click **"BACK TO DASHBOARD"**

### Bước 4: Create OAuth 2.0 Credentials

1. Vào **"APIs & Services"** → **"Credentials"**

2. Click **"CREATE CREDENTIALS"** → **"OAuth client ID"**

3. **Application type:** `Web application`

4. **Name:** `Crypto Marketplace Web Client`

5. **Authorized JavaScript origins:**
   - Add: `http://localhost:3000`
   - Add: `https://yourdomain.com` (production, sau này)

6. **Authorized redirect URIs:**
   - Add: `http://localhost:3000/api/auth/callback/google`
   - Add: `https://yourdomain.com/api/auth/callback/google` (production)

7. Click **"CREATE"**

8. **Copy credentials:**
   ```
   Client ID: xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
   Client Secret: GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

### Bước 5: Update .env File

Mở `frontend/.env.local` và paste:

```env
GOOGLE_CLIENT_ID=xxxxxxxxxxxx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 🔷 Facebook OAuth Setup

### Bước 1: Tạo Facebook App

1. Truy cập **Facebook Developers**: https://developers.facebook.com/

2. Click **"My Apps"** → **"Create App"**

3. **Use case:** Chọn **"Consumer"** → Click **"Next"**

4. **App Details:**
   - App name: `Crypto Marketplace`
   - App contact email: `your-email@gmail.com`
   - Click **"Create app"**

5. Nhập password Facebook của bạn để confirm

### Bước 2: Add Facebook Login Product

1. Trong Dashboard của app, tìm **"Facebook Login"**

2. Click **"Set Up"** under Facebook Login

3. Choose platform: **"Web"**

4. **Site URL:** `http://localhost:3000`

5. Click **"Save"** → **"Continue"**

### Bước 3: Configure Facebook Login Settings

1. Trong left sidebar, click **"Facebook Login"** → **"Settings"**

2. **Valid OAuth Redirect URIs:**
   - Add: `http://localhost:3000/api/auth/callback/facebook`
   - Add: `https://yourdomain.com/api/auth/callback/facebook` (production)

3. **Other settings:**
   - Login with the JavaScript SDK: **Yes**
   - Use Strict Mode for Redirect URIs: **Yes**

4. Click **"Save Changes"**

### Bước 4: Get App ID and Secret

1. Trong left sidebar, click **"Settings"** → **"Basic"**

2. **Copy credentials:**
   ```
   App ID: 1234567890123456
   App Secret: Click "Show" → Copy secret
   ```

3. **Add platform:**
   - Scroll down → Click **"Add Platform"**
   - Choose **"Website"**
   - Site URL: `http://localhost:3000`
   - Click **"Save Changes"**

### Bước 5: Configure App Domain

1. Vẫn trong **"Settings"** → **"Basic"**

2. **App Domains:**
   - Add: `localhost`
   - Add: `yourdomain.com` (production)

3. **Privacy Policy URL:** `http://localhost:3000/privacy`

4. Click **"Save Changes"**

### Bước 6: Make App Live (Optional)

**Note:** Trong chế độ Development, chỉ admins/developers/testers có thể login.

Để public:
1. Top right corner → Switch từ **"In development"** sang **"Live"**
2. Complete App Review (cần privacy policy, terms of service, etc.)

### Bước 7: Update .env File

Mở `frontend/.env.local` và paste:

```env
FACEBOOK_CLIENT_ID=1234567890123456
FACEBOOK_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 🧪 Testing OAuth Login

### Test Google Login

1. Start frontend:
   ```powershell
   cd frontend
   npm run dev
   ```

2. Mở browser: http://localhost:3000/login

3. Click **"Sign in with Google"**

4. Chọn Google account

5. Accept permissions

6. Redirect về homepage → Đã login!

### Test Facebook Login

1. Trong cùng trang http://localhost:3000/login

2. Click **"Sign in with Facebook"**

3. Login Facebook account (nếu chưa login)

4. Accept permissions

5. Redirect về homepage → Đã login!

### Verify User in Database

```sql
-- Check users table
SELECT user_id, email, username, google_id, facebook_id, wallet_address 
FROM users 
ORDER BY created_at DESC 
LIMIT 5;
```

Bạn sẽ thấy:
- `google_id` được fill nếu login bằng Google
- `facebook_id` được fill nếu login bằng Facebook
- `email` từ OAuth provider

---

## 🔧 Troubleshooting

### Google OAuth Errors

#### Error: "redirect_uri_mismatch"

**Solution:**
```
1. Check Authorized redirect URIs in Google Console
2. Must exactly match: http://localhost:3000/api/auth/callback/google
3. No trailing slash
4. Protocol must be http (not https) for localhost
```

#### Error: "Access blocked: This app's request is invalid"

**Solution:**
```
1. Go to OAuth consent screen
2. Add your email to Test users
3. Or publish app (if ready)
```

#### Error: "invalid_client"

**Solution:**
```
1. Check GOOGLE_CLIENT_ID và GOOGLE_CLIENT_SECRET in .env.local
2. Make sure no spaces or extra characters
3. Restart Next.js dev server
```

### Facebook OAuth Errors

#### Error: "URL Blocked: This redirect failed because the redirect URI is not whitelisted"

**Solution:**
```
1. Go to Facebook Login Settings
2. Add http://localhost:3000/api/auth/callback/facebook to Valid OAuth Redirect URIs
3. Save Changes
4. Wait 1-2 minutes for changes to propagate
```

#### Error: "App Not Set Up: This app is still in development mode"

**Solution:**
```
1. Add your Facebook account as App Admin/Developer/Tester
2. Go to Roles → Roles
3. Add email/Facebook ID
```

#### Error: "invalid_client"

**Solution:**
```
1. Check FACEBOOK_CLIENT_ID and FACEBOOK_CLIENT_SECRET
2. Make sure App Secret is correct (click "Show" to reveal)
3. Restart Next.js server
```

---

## 📝 Complete .env.local Example

```env
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-super-secret-key-generate-with-openssl

# Google OAuth
GOOGLE_CLIENT_ID=123456789012-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Facebook OAuth
FACEBOOK_CLIENT_ID=1234567890123456
FACEBOOK_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 🚀 Next Steps After OAuth Setup

1. **Test Registration Flow:**
   - Register với email/password
   - Login với Google → Link tự động nếu email trùng
   - Login với Facebook → Link tự động nếu email trùng

2. **Update User Profile:**
   - Avatar từ Google/Facebook tự động sync
   - Username có thể edit sau

3. **Add More OAuth Providers (Optional):**
   - GitHub
   - Twitter
   - Discord
   - etc.

---

## 📚 Documentation Links

- **Google OAuth**: https://developers.google.com/identity/protocols/oauth2
- **Facebook Login**: https://developers.facebook.com/docs/facebook-login/web
- **NextAuth.js**: https://next-auth.js.org/providers/google

---

## 🔒 Security Best Practices

1. **Never commit .env files:**
   ```gitignore
   .env
   .env.local
   .env*.local
   ```

2. **Use environment-specific secrets:**
   - Development: `http://localhost:3000`
   - Production: `https://yourdomain.com`

3. **Rotate secrets regularly:**
   - Generate new Client Secrets mỗi 3-6 tháng

4. **Limit OAuth scopes:**
   - Chỉ request permissions cần thiết
   - Email + Profile là đủ

5. **Monitor OAuth usage:**
   - Check Google Cloud Console → APIs & Services → Dashboard
   - Check Facebook App Dashboard → Analytics

---

## 📞 Support

Nếu gặp vấn đề:
1. Check console logs (F12)
2. Check backend logs
3. Verify .env values
4. Clear browser cache
5. Try incognito mode

---

Good luck! 🎉
