# Product Card Token CTA Design

## Goal

Standardize product presentation across the website so every product card and product detail pricing area communicates the same things clearly:

- the product's real category,
- the available token prices,
- the approximate USDT value,
- a small cart action,
- and a large primary `Mua ngay` action.

This design replaces the current mixed presentation where token badges, pricing rows, and CTA placement vary across pages.

## Chosen Direction

Use the `Inline CTA Bar` direction as the base layout.

Visual intent:

- dark, premium card body similar to the approved reference,
- product image remains the hero area,
- the top-left image badge shows the product's actual category,
- token chips live near the CTA instead of in the image corner,
- CTA is always visible, never hidden behind hover-only controls.

## Card Contract

### 1. Image header

- Keep the product image as the top visual block.
- Remove the top-right `1 token` / token-count badge entirely.
- Keep a single top-left pill for the product category only.
- The pill text must come from the real product category.
- Do not show a fake or hardcoded label such as `Home`.
- If category is missing, hide the badge instead of inventing one.

### 2. Seller and title block

- Keep seller row directly under the image.
- Keep product title and short description below seller.
- Preserve existing seller avatar / rating behavior where already present.

### 3. Token pricing block

- Move token pricing into the lower information area, just above the CTA row.
- Show up to `3` token chips inline.
- Each chip shows:
  - token logo
  - numeric token amount
- Do not show token names in the chip body.
- Do not show verbose labels like `Bitcoin`, `Ethereum`, `USDT`.
- If more than `3` accepted tokens exist, show a final compact `+N` chip.
- The currently selected token chip uses the stronger active styling.
- Clicking a token chip changes the selected token for that card/detail context.

### 4. Approximate conversion row

- Show one compact conversion row under the token chips.
- Use `≈` rather than the current broken/awkward equal-style text.
- Replace plain `USDT` text styling with a USDT logo plus the numeric amount.
- On testnet products, append a muted `(testnet)` note in the same row.

### 5. Stock row

- Keep stock information on the same lower block.
- Align stock on the opposite side of the conversion row when space allows.
- Examples:
  - `300 còn lại`
  - `Còn 4`
  - `Hết hàng`

### 6. CTA row

- CTA row is always visible.
- Left action: small cart icon button.
- Right action: large `Mua ngay` button.
- Cart icon and `Mua ngay` both operate on the currently selected token.
- They default to the current primary token until the user clicks another token chip.

## Behavior Rules

### Product cards

- Product cards do not open a token picker modal.
- Token switching happens directly on-chip.
- Cart icon adds the item using the selected token.
- `Mua ngay` uses the selected token immediately.
- For cards with multiple tokens, the selected token is local to that card instance.

### Product detail page

- Reuse the same token-chip language and CTA hierarchy.
- The detail page can show more space and slightly larger chips, but must keep the same interaction model.
- Selected token on the detail page drives both `Giỏ hàng` and `Mua ngay`.

## Page Coverage

Apply this visual contract consistently to:

- homepage featured product cards,
- general product listing cards,
- related product cards,
- seller/uploaded product cards,
- any other reusable product card variant,
- product detail pricing section.

The goal is that users should not need to relearn the pricing/CTA pattern when moving between pages.

## Data Mapping

- Source token chips from `accepted_tokens`.
- The initial active chip is the primary token if present.
- Fallback order:
  - primary token
  - first available accepted token
- The `+N` chip is display-only and not itself a selected token.
- Approximate USDT row uses `base_price_usd`.

## Visual Notes

- Keep the yellow buy button as the dominant accent.
- Keep the dark card surface and soft border treatment.
- Token chips should feel compact and precise, not like filter pills.
- The pricing block should read as commerce UI first, not as a trading widget.

## Out of Scope

- Mobile redesign beyond preserving a clean stacked layout.
- Changing checkout flow logic beyond using the selected token already supported by current card/detail interactions.
- Reworking product gallery behavior.

## Acceptance Criteria

- Category badge shows the real category and never a hardcoded label.
- No top-right token-count badge remains on product cards.
- Cards show at most `3` token chips plus `+N`.
- Token chips are clickable and update the selected token.
- Approximate conversion row uses `≈` plus USDT logo treatment.
- CTA row is always visible with small cart icon + large `Mua ngay`.
- The same pricing/CTA language is used across all product-card surfaces and the product detail page.
