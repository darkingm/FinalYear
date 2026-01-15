# TokenAsset Mobile App

React Native mobile e-commerce application with cryptocurrency payment integration.

## Setup

1. Install dependencies:
```bash
npm install
```

2. For iOS:
```bash
cd ios && pod install && cd ..
```

3. Configure environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Run the app:
```bash
# iOS
npm run ios

# Android
npm run android
```

## Project Structure

- `src/api/` - API client and endpoints
- `src/navigation/` - Navigation configuration
- `src/screens/` - Screen components
- `src/components/` - Reusable components
- `src/store/` - Redux store and slices
- `src/hooks/` - Custom hooks
- `src/theme/` - Theme configuration
- `src/constants/` - App constants

## Features

- Authentication (Login, Register, OTP)
- Product browsing and search
- Shopping cart
- Checkout with multiple payment methods
- Order management
- Wallet with deposit/withdraw
- P2P trading
- Real-time chat
- Real-time coin prices


