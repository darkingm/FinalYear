# Live USDT Estimate And Grouped Header Design

## Goal

Refresh two high-visibility navigation and pricing surfaces so they feel more product-grade and easier to scan:

- product pricing should keep the product's token sale amount as the source of truth while showing a live USDT estimate derived from market prices,
- the desktop header should stop rendering every top-level page link in a single horizontal strip and instead group related destinations into a smaller number of structured dropdowns.

This design is intentionally scoped to presentation and interaction. It does not change the checkout contract, product token pricing source of truth, or access-control logic.

## Chosen Direction

Use the existing frontend infrastructure rather than introducing new services or UI libraries.

- Reuse the current `usePriceStore` market data source for token market prices.
- Reuse the current dropdown primitives already used in the header profile menu.
- Keep the product's accepted-token amount unchanged.
- Treat the USDT row as a market-driven estimate that refreshes on a stable cadence.

This keeps the implementation small, consistent with the rest of the repo, and easy to maintain.

## Part 1: Live USDT Estimate

### Pricing contract

- The token amount shown on the product remains the real sale price.
- The USDT row is not a stored sale price.
- The USDT row is a live estimate computed from:
  - selected token amount,
  - selected token symbol,
  - latest market quote for `<TOKEN>USDT`.

Example:

- product is listed at `0.019996 ETH`
- market says `1 ETH = 2,405.33 USDT`
- estimate row becomes approximately `48.10 USDT`

### Refresh behavior

- The market feed can continue polling faster internally if that is already how the app works.
- The displayed estimate on product surfaces should update every `30` seconds.
- A small freshness cue such as `Live 30s` or equivalent muted copy should be shown near the estimate row.
- The UI should avoid noisy micro-jitter. The user should perceive stable snapshots, not constantly moving text.

### Data flow

1. Product surface determines the selected token.
2. Selected token resolves to a Binance-compatible quote symbol such as `ETHUSDT`, `MATICUSDT`, `BNBUSDT`.
3. `usePriceStore` provides current market prices for the active symbols.
4. A local snapshot layer freezes the displayed estimate for `30` seconds before taking the next market snapshot.
5. The component renders:
   - token amount row,
   - estimated USDT row,
   - stock row.

### Fallback rules

- If the token is already `USDT`, the estimate row simply mirrors the product's selected token amount.
- If the market quote cannot be resolved, fallback to the product's `base_price_usd`.
- If both quote and `base_price_usd` are unavailable, show a muted unavailable state rather than fake data.
- Unsupported or custom token symbols must not break rendering.

### Coverage

Apply this behavior to every surface using the shared product pricing component:

- homepage product cards,
- product listing cards,
- featured cards,
- product detail pricing block.

The estimate logic should be centralized so the same token selection always yields the same estimated USDT number across pages.

## Part 2: Grouped Desktop Header

### Navigation direction

Use `3` grouped desktop dropdowns:

- `Mua bán`
- `Tài chính`
- `Tài khoản`

This replaces the current long row of unrelated top-level items.

### Group structure

#### 1. Mua bán

- Trang chủ
- Sản phẩm
- Đơn hàng
- RWA

Purpose:

- product discovery,
- commerce flow,
- order management.

#### 2. Tài chính

- Giao dịch
- On-Chain
- Ví
- Whale Tracker

Purpose:

- market activity,
- on-chain monitoring,
- wallet access.

#### 3. Tài khoản

- Hồ sơ
- AI Credit
- Seller Dashboard
- Admin (only when user is admin)

Purpose:

- personal settings,
- account-scoped tools,
- operator/admin entry points.

### Visual contract

- Each top-level group is a compact trigger with:
  - small icon,
  - label,
  - chevron.
- Only the group currently matching the route should look active.
- Dropdown content should not be a flat raw list.
- Each item should include:
  - icon,
  - title,
  - short one-line description.
- Auth-protected items remain visible even when logged out, but show a small `Login` badge and preserve the current redirect behavior.

### Mobile behavior

- This batch does not redesign the mobile header from scratch.
- Mobile should continue using the hamburger menu.
- However, the mobile menu should reuse the same grouped navigation data so desktop and mobile do not drift apart.

## Error Handling And Edge Cases

### Pricing

- Missing market data must degrade gracefully to `base_price_usd`.
- Missing token symbol must not trigger quote subscription attempts.
- The estimate row must not show `NaN`, `undefined`, or broken symbols.

### Header

- Missing auth state should not hide public routes.
- Admin route should only appear when the user qualifies as admin.
- Current path matching should activate the parent dropdown group even when the user is on a nested route.

## Testing Strategy

### Pricing

- Add or update tests for the shared product pricing component to verify:
  - token selection changes the active token,
  - USDT token mirrors its own amount,
  - market-quote fallback behavior works,
  - the component remains stable when quote data is missing.

### Header

- Add tests for grouped nav rendering when practical:
  - public user sees the three grouped triggers,
  - logged-out user still sees protected destinations with login affordance,
  - admin user sees the admin entry.

### Verification

- `npm test` for focused component tests
- `npx tsc --noEmit`
- `npm run lint`
- `npm run build`

## Out Of Scope

- Replacing the global market data source with a backend service
- Rebuilding mobile navigation design language
- Changing checkout settlement logic
- Changing how accepted token sale amounts are stored in the backend

## Acceptance Criteria

- Product token amount remains the authoritative listed sale amount.
- The USDT row is computed from real market price data for the selected token.
- The displayed estimate updates every `30` seconds, not on every internal price tick.
- Missing quotes fall back safely without breaking UI.
- Desktop header is reduced to `3` grouped dropdown triggers.
- Dropdown groups map to the approved structure: `Mua bán`, `Tài chính`, `Tài khoản`.
- Protected routes still redirect unauthenticated users to login.
- Mobile navigation reuses the same grouped route definition.
