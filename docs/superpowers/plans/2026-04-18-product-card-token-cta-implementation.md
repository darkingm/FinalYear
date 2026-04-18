# Product Card Token CTA Refresh Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Standardize every product-facing commerce surface so cards and detail views show the real category, selectable multi-token pricing chips, compact `≈` USDT estimate, stock, a small cart action, and a dominant `Mua ngay` CTA.

**Architecture:** Keep `ProductCard` as the shared product surface, move token display rules into reusable pricing helpers, and compose cards/detail/editor preview from the same pricing and action primitives. Preserve the existing cart-store contract so the selected token still flows through `selected_token_id` and `token_symbol` without changing checkout logic.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Framer Motion, Zustand, Jest + Testing Library

---

## File Structure

- Modify: `frontend/lib/products/types.ts`
  - Add a compact chip view model type so UI code stops rebuilding selection and truncation logic inline.
- Modify: `frontend/lib/products/pricing.ts`
  - Normalize accepted-token data into amount-only chip labels, active-token fallback, and `+N` overflow metadata.
- Modify: `frontend/components/product/ProductTokenPricing.tsx`
  - Replace the current stacked token rows with the chosen compact chip rail + estimate/stock row contract.
- Create: `frontend/components/product/ProductQuickActions.tsx`
  - Shared small cart icon + large `Mua ngay` CTA row for cards and product detail.
- Modify: `frontend/components/product/ProductCard.tsx`
  - Remove the top-right token-count badge, keep only the real category badge, track card-local selected token, and route CTA actions through the selected token.
- Modify: `frontend/app/products/[id]/page.tsx`
  - Reuse the same pricing and CTA contract on detail view and remove the token-count pill.
- Modify: `frontend/app/products/page.tsx`
  - Retire the bespoke `NFTProductCard` layout and map tokenized products onto the shared `ProductCard` contract so listing surfaces do not drift.
- Modify: `frontend/components/product/editor/ProductEditorForm.tsx`
  - Make the seller preview match the new card contract so what sellers see before save matches the storefront.
- Modify: `frontend/app/cart/page.tsx`
  - Keep the selected-token summary visually consistent with amount + logo treatment after card selection starts mattering more.
- Modify if spacing/props need adjustment: `frontend/app/page.tsx`, `frontend/components/home/FeaturedProducts.tsx`, `frontend/components/product/RelatedProducts.tsx`
  - These already consume `ProductCard`; they mainly need smoke verification after the shared contract changes.
- Test: `frontend/__tests__/product-pricing.test.ts`
  - Add pure-function coverage for chip truncation and active-token fallback.
- Create: `frontend/__tests__/product-token-pricing.test.tsx`
  - Cover rendering of compact chips, `+N`, estimate row, and click selection.
- Create: `frontend/__tests__/product-card.test.tsx`
  - Cover category badge, selected-token switching, always-visible CTA row, and add-to-cart payload.

## Chunk 1: Shared Token Display Model

### Task 1: Encode the chip-display contract in pricing helpers

**Files:**
- Modify: `frontend/lib/products/types.ts`
- Modify: `frontend/lib/products/pricing.ts`
- Test: `frontend/__tests__/product-pricing.test.ts`

- [ ] **Step 1: Write the failing helper tests**

```ts
import { buildAcceptedTokenChipState } from '@/lib/products/pricing';

it('limits card chips to three visible tokens and reports hidden overflow', () => {
  const state = buildAcceptedTokenChipState(
    [
      { token_id: 1, symbol: 'ETH', price_in_token: '0.019996', is_primary: true },
      { token_id: 2, symbol: 'USDT', price_in_token: '49.99', is_primary: false },
      { token_id: 3, symbol: 'MATIC', price_in_token: '180', is_primary: false },
      { token_id: 4, symbol: 'BNB', price_in_token: '0.14', is_primary: false },
    ],
    { maxVisible: 3 },
  );

  expect(state.visible.map((chip) => chip.amountLabel)).toEqual(['0.019996', '49.99', '180']);
  expect(state.hiddenCount).toBe(1);
  expect(state.activeToken?.symbol).toBe('ETH');
});

it('keeps the selected token active when the user has already chosen one', () => {
  const state = buildAcceptedTokenChipState(tokens, { selectedTokenId: 3, maxVisible: 3 });
  expect(state.activeToken?.token_id).toBe(3);
});
```

- [ ] **Step 2: Run the focused pricing test and confirm it fails**

Run: `npm test -- --runInBand product-pricing.test.ts`

Expected: FAIL because `buildAcceptedTokenChipState` and amount-only chip labels do not exist yet.

- [ ] **Step 3: Implement the chip-state helper**

```ts
export interface ProductTokenChipView extends ProductAcceptedTokenView {
  amountLabel: string;
  isActive: boolean;
}

export function buildAcceptedTokenChipState(
  tokens: ProductAcceptedTokenView[],
  options: { selectedTokenId?: number | null; maxVisible?: number } = {},
) {
  const ordered = normalizeAcceptedTokensForDisplay(tokens);
  const activeToken =
    ordered.find((token) => token.token_id === options.selectedTokenId) ??
    ordered.find((token) => token.is_primary) ??
    ordered[0] ??
    null;

  const chipViews = ordered.map((token) => ({
    ...token,
    amountLabel: formatTokenAmountOnly(token.price_in_token),
    isActive: activeToken ? token.token_id === activeToken.token_id : false,
  }));

  const maxVisible = options.maxVisible ?? chipViews.length;
  return {
    activeToken,
    visible: chipViews.slice(0, maxVisible),
    hiddenCount: Math.max(0, chipViews.length - maxVisible),
    all: chipViews,
  };
}
```

- [ ] **Step 4: Re-run the pricing helper test**

Run: `npm test -- --runInBand product-pricing.test.ts`

Expected: PASS with helper coverage for three-chip truncation and active-token fallback.

- [ ] **Step 5: Commit the utility slice**

```bash
git add frontend/lib/products/types.ts frontend/lib/products/pricing.ts frontend/__tests__/product-pricing.test.ts
git commit -m "feat: add compact token pricing helpers"
```

### Task 2: Refactor `ProductTokenPricing` into the approved chip + estimate surface

**Files:**
- Modify: `frontend/components/product/ProductTokenPricing.tsx`
- Create: `frontend/__tests__/product-token-pricing.test.tsx`

- [ ] **Step 1: Write the failing component tests**

```tsx
it('renders amount-only chips, shows +N overflow, and emits token selection', async () => {
  const onSelect = jest.fn();
  render(
    <ProductTokenPricing
      acceptedTokens={tokens}
      basePriceUsd={49.99}
      selectedTokenId={2}
      onSelect={onSelect}
      variant="card"
      stock={300}
    />,
  );

  expect(screen.getByRole('button', { name: /chon eth 0.019996/i })).toBeInTheDocument();
  expect(screen.queryByText(/\bETH\b/)).not.toBeInTheDocument();
  expect(screen.getByText('+1')).toBeInTheDocument();
  expect(screen.getByText('≈')).toBeInTheDocument();
  expect(screen.getByAltText(/usdt/i)).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /chon usdt 49.99/i }));
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ token_id: 2 }));
});
```

- [ ] **Step 2: Run the component test and confirm it fails**

Run: `npm test -- --runInBand product-token-pricing.test.tsx`

Expected: FAIL because the current component still renders stacked rows with symbol text and no overflow chip.

- [ ] **Step 3: Implement the compact pricing surface**

```tsx
export function ProductTokenPricing(props: ProductTokenPricingProps) {
  const chipState = buildAcceptedTokenChipState(props.acceptedTokens, {
    selectedTokenId: props.selectedTokenId,
    maxVisible: props.variant === 'detail' ? props.acceptedTokens.length : 3,
  });

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-2">
        {chipState.visible.map((token) => (
          <button
            key={token.token_id}
            type="button"
            aria-label={`Chọn ${token.symbol} ${token.amountLabel}`}
            className={token.isActive ? activeChipClasses : idleChipClasses}
            onClick={() => props.onSelect?.(token)}
          >
            <span className="font-black">{token.amountLabel}</span>
            <CoinImage symbol={token.logo_symbol || token.symbol} size={16} className="rounded-full" />
          </button>
        ))}
        {chipState.hiddenCount > 0 && <span className={overflowChipClasses}>+{chipState.hiddenCount}</span>}
      </div>

      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <span aria-hidden="true">≈</span>
          <CoinImage symbol="USDT" size={14} className="rounded-full" />
          <span>{formatUsd(basePriceUsd)}</span>
        </div>
        {typeof props.stock === 'number' ? <StockBadge stock={props.stock} /> : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Re-run the component test**

Run: `npm test -- --runInBand product-token-pricing.test.tsx`

Expected: PASS with compact chips, `+N`, USDT logo estimate row, and selection callback coverage.

- [ ] **Step 5: Commit the shared pricing surface**

```bash
git add frontend/components/product/ProductTokenPricing.tsx frontend/__tests__/product-token-pricing.test.tsx
git commit -m "feat: compact product token pricing display"
```

## Chunk 2: Roll Out the Shared Contract Across Product Cards

### Task 3: Add a shared quick-action row and card-local token selection

**Files:**
- Create: `frontend/components/product/ProductQuickActions.tsx`
- Modify: `frontend/components/product/ProductCard.tsx`
- Test: `frontend/__tests__/product-card.test.tsx`

- [ ] **Step 1: Write the failing card test**

```tsx
jest.mock('@/store/cart-store', () => ({
  useCartStore: (selector: any) =>
    selector({
      addItem: mockAddItem,
    }),
}));

it('uses the selected token for the cart action and only shows the real category badge', async () => {
  render(<ProductCard product={productWithFourTokens} showAddToCart />);

  expect(screen.getByText('Fashion')).toBeInTheDocument();
  expect(screen.queryByText(/4 tokens/i)).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: /chon usdt/i })).toBeInTheDocument();

  await user.click(screen.getByRole('button', { name: /chon usdt/i }));
  await user.click(screen.getByRole('button', { name: /them vao gio hang/i }));

  expect(mockAddItem).toHaveBeenCalledWith(
    expect.objectContaining({
      selected_token_id: 2,
      token_symbol: 'USDT',
    }),
  );
});
```

- [ ] **Step 2: Run the card test and confirm it fails**

Run: `npm test -- --runInBand product-card.test.tsx`

Expected: FAIL because `ProductCard` still hardwires the primary token and still renders the image-corner token badge.

- [ ] **Step 3: Implement the shared CTA row and selected-token state**

```tsx
function ProductQuickActions({
  onAddToCart,
  onBuyNow,
  disabled,
}: {
  onAddToCart?: () => void;
  onBuyNow: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <button type="button" onClick={onAddToCart} className="h-11 w-11 rounded-xl border border-border bg-card">
        <ShoppingCart className="h-4 w-4" />
      </button>
      <button type="button" onClick={onBuyNow} disabled={disabled} className="flex-1 rounded-xl bg-[#f0b90b] px-4 py-3 font-black text-black">
        <Zap className="h-4 w-4" />
        Mua ngay
      </button>
    </div>
  );
}

const [selectedTokenId, setSelectedTokenId] = useState(primaryToken?.token_id ?? null);
const selectedToken =
  acceptedTokens.find((token) => token.token_id === selectedTokenId) ??
  primaryToken;
```

- [ ] **Step 4: Re-run the card test**

Run: `npm test -- --runInBand product-card.test.tsx`

Expected: PASS with the selected token wired into cart payload and no token-count badge left in the image.

- [ ] **Step 5: Commit the card contract**

```bash
git add frontend/components/product/ProductQuickActions.tsx frontend/components/product/ProductCard.tsx frontend/__tests__/product-card.test.tsx
git commit -m "feat: align product cards with token chip cta layout"
```

### Task 4: Remove the bespoke NFT card drift and reuse `ProductCard`

**Files:**
- Modify: `frontend/app/products/page.tsx`
- Smoke-check: `frontend/app/page.tsx`
- Smoke-check: `frontend/components/home/FeaturedProducts.tsx`
- Smoke-check: `frontend/components/product/RelatedProducts.tsx`

- [ ] **Step 1: Replace `NFTProductCard` usage with `ProductCard` mapping**

```tsx
const nftCards: ProductCardData[] = nftProducts.map((product) => ({
  product_id: product.product_id,
  name: product.name,
  description: product.description,
  base_price_usd: product.base_price_usd,
  primary_image: product.primary_image,
  category: product.category,
  rating_avg: product.rating_avg,
  seller_name: product.seller_name,
  seller_user_avatar: product.seller_user_avatar,
  accepted_tokens: product.accepted_tokens,
}));
```

- [ ] **Step 2: Delete the old image-corner chain/NFT badge UI**

Run: edit `frontend/app/products/page.tsx`

Expected: `NFTProductCard` is removed or reduced to a thin wrapper over `ProductCard`; the tokenized tab no longer renders a separate pricing language.

- [ ] **Step 3: Verify that the shared card still fits all listing surfaces**

Run: `npm run build`

Expected: PASS with homepage featured cards, product listing cards, tokenized listing cards, and related product cards all compiling through the shared card surface.

- [ ] **Step 4: Commit the listing rollout**

```bash
git add frontend/app/products/page.tsx frontend/app/page.tsx frontend/components/home/FeaturedProducts.tsx frontend/components/product/RelatedProducts.tsx
git commit -m "refactor: reuse shared product card across listing surfaces"
```

## Chunk 3: Detail Page, Seller Preview, and Regression

### Task 5: Apply the same pricing and CTA hierarchy on the product detail page

**Files:**
- Modify: `frontend/app/products/[id]/page.tsx`
- Reuse: `frontend/components/product/ProductTokenPricing.tsx`
- Reuse: `frontend/components/product/ProductQuickActions.tsx`

- [ ] **Step 1: Replace the token-count pill and verbose selected amount row**

```tsx
<div className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-sm">
  <ProductTokenPricing
    acceptedTokens={product.accepted_tokens}
    basePriceUsd={basePriceUsd}
    selectedTokenId={selectedToken?.token_id ?? null}
    onSelect={setSelectedToken}
    variant="detail"
    stock={product.stock}
  />

  <ProductQuickActions
    onAddToCart={handleAddToCart}
    onBuyNow={handleBuyNow}
    disabled={product.stock === 0}
  />
</div>
```

- [ ] **Step 2: Keep detail-only controls without breaking the shared contract**

Run: edit `frontend/app/products/[id]/page.tsx`

Expected: quantity selector, PayPal fallback button, seller profile, and gallery remain intact; only the commerce surface becomes consistent with the approved card contract.

- [ ] **Step 3: Smoke the detail route in production build**

Run: `npm run build`

Expected: PASS with `/products/[id]` compiling after the shared CTA component and compact pricing layout are wired in.

- [ ] **Step 4: Commit the detail view rollout**

```bash
git add frontend/app/products/[id]/page.tsx
git commit -m "feat: align product detail pricing and cta layout"
```

### Task 6: Match the seller preview and cart summary to the new token language

**Files:**
- Modify: `frontend/components/product/editor/ProductEditorForm.tsx`
- Modify: `frontend/app/cart/page.tsx`

- [ ] **Step 1: Update the seller preview to mirror the storefront card**

```tsx
<ProductTokenPricing
  acceptedTokens={previewTokens}
  basePriceUsd={form.basePriceUsd}
  variant="card"
  stock={form.stock}
/>
<ProductQuickActions onBuyNow={() => {}} onAddToCart={() => {}} disabled />
```

- [ ] **Step 2: Tighten the cart summary chip styling**

```tsx
{item.price_in_token && item.token_symbol && (
  <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-black">
    <span>{formatTokenAmountOnly(item.price_in_token)}</span>
    <CoinImage symbol={item.token_symbol} size={14} className="rounded-full" />
  </span>
)}
```

- [ ] **Step 3: Build-check the preview and cart route**

Run: `npm run build`

Expected: PASS with the editor preview and cart summary using the new amount + logo treatment.

- [ ] **Step 4: Commit the last UI sweep**

```bash
git add frontend/components/product/editor/ProductEditorForm.tsx frontend/app/cart/page.tsx
git commit -m "feat: align preview and cart token visuals"
```

### Task 7: Final regression, manual QA, and clean integration commit

**Files:**
- Verify only: `frontend/**`

- [ ] **Step 1: Run the focused automated suite**

Run: `npm test -- --runInBand product-pricing.test.ts product-token-pricing.test.tsx product-card.test.tsx`

Expected: PASS with helper, chip UI, and card-selection coverage.

- [ ] **Step 2: Run static verification**

Run: `npm run lint`

Expected: PASS with no new errors introduced by the token CTA refresh.

- [ ] **Step 3: Run type-check and production build**

Run: `npx tsc --noEmit`

Expected: PASS

Run: `npm run build`

Expected: PASS and all product-facing routes compile under Next.js 16.

- [ ] **Step 4: Manual smoke checklist**

Run: `npm run dev`

Expected checks:
- Homepage cards show the real category in the top-left badge.
- No product card shows the old top-right token-count badge.
- Cards show at most three token chips plus `+N`.
- Clicking a token chip changes which token the cart icon and `Mua ngay` use.
- Product detail uses the same token-chip and CTA language.
- Seller preview matches the storefront card contract.
- Cart rows show amount + logo for the selected token.

- [ ] **Step 5: Create the clean integration commit**

```bash
git add frontend/components/product/ProductQuickActions.tsx frontend/components/product/ProductTokenPricing.tsx frontend/components/product/ProductCard.tsx frontend/app/products/page.tsx frontend/app/products/[id]/page.tsx frontend/components/product/editor/ProductEditorForm.tsx frontend/app/cart/page.tsx frontend/lib/products/pricing.ts frontend/lib/products/types.ts frontend/__tests__/product-pricing.test.ts frontend/__tests__/product-token-pricing.test.tsx frontend/__tests__/product-card.test.tsx
git commit -m "feat: standardize product token cta surfaces"
```
