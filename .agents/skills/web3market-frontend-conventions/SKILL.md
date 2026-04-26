---
name: web3market-frontend-conventions
description: Use when building or editing frontend components, pages, or UI in the Web3Market project — covers Next.js App Router patterns, wagmi v2 hooks, styling conventions, icon rules, coin logos, and common frontend mistakes to avoid.
---

# Web3Market — Frontend Conventions

## Tech Stack

- **Framework:** Next.js 16, App Router (NOT Pages Router)
- **React:** React 19
- **Language:** TypeScript strict
- **Styling:** Tailwind CSS + CSS variables (dark mode default)
- **Web3:** wagmi v2 + viem + RainbowKit
- **Icons:** lucide-react ONLY (no inline SVG, no emoji in cards)
- **Animations:** framer-motion
- **Toasts:** sonner (`toast.success/error/info/loading`)
- **HTTP:** axios via `apiClient` (main-service) and `paymentClient` (payment-service)

## API Clients

```typescript
import { apiClient, paymentClient } from '@/lib/api/client';

// main-service (port 3001)
apiClient.get('/api/orders')
apiClient.post('/api/orders/:id/status', { status: 'COMPLETED' })

// payment-service (port 3002)
paymentClient.post('/api/payments/crypto/session', { ... })
paymentClient.post('/api/payments/crypto/session/:sessionId/quote', { ... })
paymentClient.post('/api/payments/crypto/session/:sessionId/submit', { ... })
paymentClient.get('/api/payments/crypto/status/:orderId')
```

**Never** call `fetch()` directly — always use the pre-configured clients with auth interceptors.

Exception: NextAuth local endpoints (`/api/auth/session`, `signIn`, `signOut`) are owned by Next.js and should use NextAuth helpers or a local same-origin request. Backend endpoints under `/api/auth/register`, `/api/auth/login`, `/api/auth/wallet-login`, `/api/auth/oauth`, `/api/auth/forgot-password`, `/api/auth/reset-password`, and `/api/auth/logout` must reach main-service through `apiClient` or server-side `serverApi`.

## Auth

```typescript
import { useAuth } from '@/lib/hooks/useAuth';
const { isAuthenticated, isLoading, user } = useAuth();

// Protect routes:
useEffect(() => {
  if (!authLoading && !isAuthenticated) router.push('/login');
}, [isAuthenticated, authLoading]);
```

Frontend auth rules:
- Use `signIn()` / `signOut()` for NextAuth provider flows.
- Register, forgot-password, reset-password, and backend logout are main-service endpoints; make sure production nginx does not send them to NextAuth.
- Never put `INTERNAL_SERVICE_KEY` in `NEXT_PUBLIC_*` env vars or browser code. It is server-runtime only for NextAuth server-to-server calls.
- Login CAPTCHA must be submitted to and verified by the server path that receives credentials. Checking `captchaToken` only in the browser is not sufficient.
- Wallet/SIWE login and wallet linking must use the actual connected `chainId` from wagmi, not a hard-coded default when the wallet is already connected.
- SIWE origin must match production canonical origin. If the site serves both apex and `www`, either canonical-redirect `www` or explicitly support both in backend validation.

## wagmi v2 Patterns

```typescript
import { useAccount, useWalletClient, useSwitchChain, useWriteContract, useReadContract } from 'wagmi';
import { parseUnits, formatUnits, type Address } from 'viem';
import { keccak256, toBytes } from 'viem';   // ← CORRECT encoding

// orderId for smart contract calls:
const orderId32 = keccak256(toBytes(order.internal_order_id));
// NOT: keccak256(stringToHex(...)) — different encoding, causes contract failures
```

## Hardhat Checkout UI

- Chain `31337` is the demo Hardhat chain.
- Browser/MetaMask RPC should use `https://kienai.id.vn/rpc/hardhat` in production.
- Local development can set `NEXT_PUBLIC_HARDHAT_RPC_URL=http://127.0.0.1:8545` in `frontend/.env.local`.
- Checkout CTA should say `Tạo hóa đơn trên Hardhat`; avoid showing `VPS` on the primary purchase button.
- Network diagnostics/admin/debug pages may mention VPS infrastructure when useful, but customer-facing purchase CTAs and product/order flows should use clearer labels such as `Hardhat`, `mạng test`, or `chain demo`.

## Clickable UI Contract

Every clickable element must have a real outcome:
- Use `<Link>` only when the target route exists.
- Use a `<button>` only with a real handler, or disable it with a clear Vietnamese explanation.
- Do not leave `href="#"`, fake social links, placeholder support links, cursor-pointer text without navigation, or toast-only "coming soon" actions unless the control is visibly marked as unavailable.
- Seller names in product cards, product detail, checkout, and order detail should link to the public seller storefront when `seller_slug` is available.

## Icon Rules

| Use case | Component |
|---|---|
| All UI icons | `lucide-react` components |
| Crypto coin logos | `<CoinImage symbol="ETH" />` or `getCoinLogo(symbol)` |
| Chain/network icons | Emoji strings in `PAYMENT_NETWORKS` config only, NOT in card UI |

```tsx
// ✅ CORRECT — lucide for UI + CoinImage for crypto
import { Wallet, CheckCircle, ArrowLeft } from 'lucide-react';
import { CoinImage } from '@/components/ui/CoinImage';

<Wallet className="w-5 h-5" />
<CoinImage symbol="ETH" size={24} />

// ❌ WRONG
<svg>...</svg>              // No manual SVG
<img src="/eth-icon.png" /> // No static local coin images
```

**Coin logo CDN:** `assets.coincap.io/assets/icons/{symbol_lowercase}@2x.png`  
Always include `onError` handler to hide broken logos gracefully.

## `force-dynamic` for Auth Pages

Any page that reads auth state or user data must export:
```typescript
export const dynamic = 'force-dynamic';
```
Without this, Next.js may cache the page and serve stale/unauthenticated state.

## Client vs Server Components

- Default: Server Component (no `'use client'`)
- Add `'use client'` when using: hooks, useState, useEffect, wagmi hooks, browser APIs
- Auth-protected interactive pages: always `'use client'` + `force-dynamic`

## Page File Pattern

```typescript
'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/hooks/useAuth';
import { useRouter } from 'next/navigation';

export default function MyPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  // Auth guard
  useEffect(() => {
    if (!authLoading && !isAuthenticated) router.push('/login');
  }, [isAuthenticated, authLoading, router]);

  if (authLoading) return <LoadingSpinner />;
  // ...
}
```

## Color Palette (Tailwind tokens)

| Token | Value | Use |
|---|---|---|
| `bg-background` | Dark navy | Page background |
| `bg-card` | Slightly lighter | Card backgrounds |
| `text-foreground` | White/light | Primary text |
| `text-muted-foreground` | Gray | Secondary text |
| `border-border` | Subtle border | Card outlines |
| `#f0b90b` | BNB Gold | Primary accent, CTAs, highlights |
| `emerald-400/500` | Green | Success states, escrow badges |
| `red-400/500` | Red | Errors, warnings |
| `amber-400/500` | Amber | Warnings, pending states |

**Never** use plain `red`, `blue`, `green` — always use shade numbers (400, 500, etc.) with opacity.

## Toast Conventions

```typescript
import { toast } from 'sonner';

toast.success('Thanh toán thành công!');          // Vietnamese user messages
toast.error(e.response?.data?.message || 'Lỗi'); // Show API error or fallback
toast.loading('Đang xử lý...', { id: 'key' });   // Loading with ID
toast.dismiss('key');                              // Dismiss by ID
toast.info('Thông tin...', { duration: 5000 });   // Auto-dismiss timer
```

## Motion/Animation Conventions

```tsx
import { motion, AnimatePresence } from 'framer-motion';

// Standard card enter animation
<motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>

// Success/confirmation animation
<motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>

// List items with stagger
<motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
  transition={{ delay: index * 0.05 }}>
```

## Common Frontend Mistakes

### 1. Using `<Image>` for external CDN URLs
```tsx
// ❌ Fails — domain not in next.config domain whitelist
<Image src="https://assets.coincap.io/..." />

// ✅ Use plain <img> with onError
<img src={getCoinLogo(symbol)} onError={e => e.currentTarget.style.display='none'} />
```

### 2. Calling `setSubmitting(false)` in `finally` during polling
When a function starts polling after an async action, `finally` runs when the outer try/catch exits — before polling finishes. This unlocks the button prematurely.
```typescript
// ❌ finally runs too early
try { ...start polling... } finally { setSubmitting(false); }

// ✅ Only set false after the action phase completes, before polling
setPayStep('confirming');
setSubmitting(false);   // ← here, not in finally
poll();                  // poll runs independently
```

### 3. Missing `force-dynamic` on auth pages
Causes: stale data, users see other users' data, redirect loops.  
Fix: add `export const dynamic = 'force-dynamic'` at top of file.

### 4. Type error in `useReadContract` args
```typescript
// The args field MUST use conditional — not undefined assignment
args: address && quote ? [address, quote.escrow_contract as Address] : undefined,
query: { enabled: !!address && !!quote }
```

### 5. orderId encoding mismatch (breaks smart contract)
```typescript
// ❌ Wrong
const id32 = keccak256(stringToHex(order.internal_order_id));

// ✅ Correct — matches backend ethers.toUtf8Bytes
const id32 = keccak256(toBytes(order.internal_order_id));
```

## PayStep State Machine (checkout page)

```
idle → signing (MetaMask popup)
     → submitted (TX in mempool, UI unlocks)
     → confirming (polling for blockchain confirmation)
     → done (confirmed, auto-redirect)
     → failed (show error + retry)
```

`setSubmitting(false)` call goes AFTER `setPayStep('submitted')`, NOT in `finally`.

## Useful Utility Locations

| Utility | Path |
|---|---|
| API clients | `frontend/lib/api/client.ts` |
| Auth hook | `frontend/lib/hooks/useAuth.ts` |
| Coin logos | `frontend/lib/utils/coin-logos.ts` |
| Web3 config | `frontend/lib/web3/config.ts` |
| CoinImage component | `frontend/components/ui/CoinImage.tsx` |
| Header | `frontend/components/layout/Header.tsx` |
| Footer | `frontend/components/layout/Footer.tsx` |
