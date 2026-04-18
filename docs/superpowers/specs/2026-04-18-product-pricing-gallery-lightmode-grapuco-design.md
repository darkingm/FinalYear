# Product Pricing, Gallery, Light Mode, and Grapuco Reindex Design

Status: Approved in chat on 2026-04-18
Target workspace: `C:\Users\Asus\Documents\FYP\worktrees\codex`

## Summary

This design standardizes product pricing and product images around normalized database tables, fixes inconsistent frontend rendering, adds a richer product gallery experience, introduces a desktop-only light-mode background effect across the site, and formalizes the local Grapuco reindex workflow.

The chosen direction is to make `product_accepted_tokens` the single source of truth for token pricing and `product_images` the single source of truth for product gallery data. `metadata` remains optional auxiliary data and is no longer allowed to be the primary source for pricing or gallery rendering.

## Problems to Solve

1. Product pricing is inconsistent across card, detail, and checkout flows because the current code mixes:
   - legacy product token fields
   - `product_accepted_tokens`
   - `metadata.pricing`
   - frontend fallback price derivation
2. Product images can be uploaded but fail to render reliably because pages consume different image shapes and some utilities silently fall back to hardcoded demo galleries.
3. The seller flow does not have one clean model for creating a product with:
   - multiple accepted tokens
   - optional USDT-based auto-conversion
   - manual token amount overrides
   - multiple ordered images
4. The light theme already has a background system, but the requested desktop-only effect is a more deliberate "space warp / black hole / colorful particles" experience and should apply site-wide in light mode while preserving the dark theme.
5. Grapuco reindexing exists in multiple ad hoc places and does not provide a clean, inspectable status for whether the architecture graph matches the current repository state.

## Goals

- Show every accepted token for a product with token amount and token logo.
- Show a secondary estimated USDT value without replacing token-first pricing.
- Support seller input from either:
  - a base USD/USDT reference price, then auto-fill token prices
  - or direct per-token manual entry
- Persist final token amounts explicitly per token.
- Render product galleries consistently with:
  - large primary image
  - thumbnail strip
  - lightbox
  - next/previous navigation
- Keep dark mode unchanged.
- Apply a new animated background effect to desktop light mode across the site.
- Normalize Grapuco reindexing into one official command and one observable status file.
- Keep the implementation maintainable with clear interfaces, entities, services, and mappers instead of OOP-heavy inheritance.

## Non-Goals

- Mobile light-mode animation parity in this phase.
- Redesigning the dark theme background.
- Rewriting unrelated marketplace flows.
- Storing actual image binaries in database JSON columns.

## Chosen Approach

This design adopts the "normalize and migrate" approach:

- Pricing truth lives in `product_accepted_tokens`
- Gallery truth lives in `product_images`
- Legacy token fields and `metadata` pricing/image payloads are migrated into normalized tables
- Frontend reads one normalized DTO for list, detail, seller edit, and checkout

This is preferred over a minimal patch because the current hybrid model already causes drift between pages. It is also preferred over a metadata-first approach because normalized tables are easier to query, validate, migrate, and render consistently.

## Current-State Design Constraints

- Existing products may still use one legacy token field pair on `products`
- Existing product images may exist in `metadata.images`
- The frontend already has:
  - product cards
  - product detail page
  - seller create flows
  - a dark/light background system
- The backend already has:
  - `product_accepted_tokens`
  - `product_images`
  - create/read/update product endpoints

The new design must preserve existing products by migrating them, not by requiring manual recreation.

## Architecture Overview

### 1. Normalized Product Domain

Product data is split into:

- `products`
  - core identity and product-level fields
  - includes the seller-entered `base_price_usd` reference where applicable
- `product_accepted_tokens`
  - one row per accepted token for a product
  - stores the final token amount the seller wants to accept
- `product_images`
  - one row per image
  - stores URL, ordering, and primary-image status

`metadata` remains available for non-critical extensibility, but it must not drive pricing or gallery UI.

### 2. Application-Level Model Boundaries

The implementation should be organized around explicit interfaces and focused services:

- interfaces / entities
  - `ProductAcceptedToken`
  - `ProductGalleryImage`
  - `ProductPricingSummary`
  - `ProductCardView`
  - `ProductDetailView`
  - `ProductEditorState`
- services
  - `productPricingService`
  - `productImageService`
  - `productReadModelService`
  - `grapucoReindexService`
- mappers / presenters
  - map database rows into stable DTOs for frontend use

The goal is not class-heavy inheritance. The goal is clear shapes and isolated responsibilities so pricing, gallery, and background logic can be edited independently.

## Pricing Design

### Seller Authoring Model

The seller flow supports two entry modes:

1. Enter a base `USD/USDT` value and auto-generate token amounts for supported tokens.
2. Edit any token amount manually before saving.

The persisted result is always the final set of token rows in `product_accepted_tokens`.

### Pricing Rules

- Product card, detail, and checkout are token-first.
- The UI must show all accepted tokens for a product as:
  - token logo
  - token amount
- Token symbol text is secondary and should not dominate the layout.
- A secondary `~ USDT` estimate is shown as contextual information.
- Frontend must not invent a fallback token price from USD when accepted token rows are missing.
- If token pricing data is missing for a product, that is treated as a data problem to fix, not a UI opportunity to guess.

### Backend Read Model

List, detail, and checkout endpoints should all expose the same normalized pricing shape. The backend should stop returning different pricing sources for different pages.

At minimum, the shared DTO must include:

- token identifier
- token symbol
- token logo key or logo URL
- token decimals where needed
- accepted token amount
- optional estimated USD value
- display ordering metadata

### Migration of Existing Products

A migration step should:

1. Find products that still rely on legacy token fields.
2. Create corresponding `product_accepted_tokens` rows.
3. Preserve the existing token amount as the initial normalized amount.
4. Ensure there is no duplicate accepted-token row after migration.

After migration, read paths should prefer normalized rows and avoid falling back to legacy token fields except for controlled safety compatibility during rollout.

## Product Image and Gallery Design

### Canonical Image Model

The canonical image source is `product_images`.

Each product image should have:

- image URL
- sort order
- primary-image flag
- stable identifier

The UI must not rely on mixed image shapes between pages.

### Seller Image Flow

Seller create/edit should support:

- uploading multiple images
- previewing selected images
- changing image order
- choosing a primary image

Upload endpoints should return a normalized image payload that the frontend can place directly into form state.

### Product Display Flow

Product detail uses a unified gallery component with:

- one large active image
- clickable thumbnails
- full-screen lightbox
- next/previous navigation
- image count awareness

Product cards use the primary image only.

### Fallback Policy

Hardcoded demo gallery fallbacks must not mask broken production image data. For real product pages:

- if images are missing, show an explicit placeholder state
- do not silently swap in sample gallery assets

This prevents upload/render bugs from hiding behind fallback content.

## Frontend UX Design

### Product Card

Each card should render:

- primary product image
- name / category / core summary
- accepted token strip or stacked pricing block
  - each token row shows logo + amount
- a secondary `~ USDT` estimate line

The pricing layout should feel deliberate and premium, not like a plain text list. Token logos are the primary visual anchor.

### Product Detail

The detail page should render:

- gallery module
- product metadata
- accepted token pricing module
- token selection for payment
- live estimate context where appropriate

The accepted token list on detail should visually match the card language so the user does not feel like they changed to a different pricing system between pages.

### Seller Create / Edit Experience

The form should support:

- entering base USD/USDT reference
- auto-filling accepted token amounts
- editing token amounts individually
- validating zero/negative values
- uploading and ordering multiple images

This flow should use a single editor state model so the create and edit pages do not diverge again.

## Light-Mode Background Design

### Scope

- Applies across the entire website in light mode
- Desktop only
- Dark mode remains unchanged
- Mobile and tablet will use the current lighter fallback path until a later phase

### Behavior

The new light-mode background effect should combine:

1. A bright atmospheric background base
2. A cursor-following "space warp / black hole lens" distortion zone
3. A halo or orbit of colorful particles around the distortion field

The effect should create depth and motion without interfering with readability.

### Runtime Conditions

The effect mounts only when all conditions are true:

- theme is `light`
- viewport matches desktop threshold
- device has fine pointer / mouse
- user is not on reduced-motion preference

Otherwise, the background falls back to a static or minimal animated light scene.

### Integration Boundary

The background remains a site-level visual layer behind page content. It must not require page-specific layout changes. Existing page components should only need minor contrast or surface polish where necessary.

### Visual Tone

The light mode should feel intentional and distinct from the dark mode:

- not flat white
- not purple-biased
- not generic dots-on-white
- high-end sci-fi / cosmic lensing feel

## Grapuco Reindex Standardization

### Problems

Current reindex behavior is fragmented:

- `frontend/package.json` exposes `npm run reindex`
- `.git/hooks/post-commit` runs `npx grapuco ingest` directly

This creates two issues:

1. There is no single official command path.
2. There is no durable status record proving which commit the graph matches.

### Official Reindex Contract

Introduce one official repo-level reindex script under `scripts/` as the canonical entry point.

Responsibilities:

- resolve the repository root reliably
- run Grapuco ingest from the correct location
- handle "tool not installed / unavailable" errors cleanly
- persist status metadata after each attempt

### Status Tracking

The canonical reindex step should write a small machine-readable status file, for example under `.grapuco/`:

- timestamp
- git SHA
- branch
- success or failure
- optional stderr summary

This status allows humans and AI tools to answer:

- Was Grapuco reindexed recently?
- Which commit does the graph correspond to?
- Did the last reindex fail?

### Call Sites

All current entry points should delegate to the same canonical script:

- the manual command the user runs
- the frontend convenience command
- the Git `post-commit` hook

No caller should embed raw `npx grapuco ingest` logic directly anymore.

### Expected Developer Command

The repository should document one official local command, with wrapper aliases if desired. The important part is that all aliases route through the same script.

## Data Flow Design

### Read Flow

1. Backend reads product core row.
2. Backend joins accepted token rows and image rows.
3. Backend maps them into one normalized DTO.
4. Frontend renders that DTO consistently in:
   - cards
   - detail pages
   - checkout
   - seller edit forms

### Write Flow

1. Seller uploads images.
2. Upload API returns normalized image objects.
3. Seller enters base USD/USDT and/or token-specific overrides.
4. Frontend submits one structured payload.
5. Backend upserts:
   - product core fields
   - accepted token rows
   - image rows
6. Read model returns the same normalized structure used elsewhere.

## Error Handling

### Pricing

- Missing token rows after create/update is treated as validation failure.
- Unsupported token identifiers are rejected server-side.
- USD auto-conversion failures should not silently produce zero-value token rows.

### Images

- Upload failures must surface clearly in the form.
- Image persistence errors must not leave the product with inconsistent gallery order.
- Product detail should show a real placeholder if image data is absent instead of demo images.

### Grapuco

- Reindex failures should be visible in status output and status file.
- Hook-triggered failures should not silently create a false impression that the graph is current.

## Testing Strategy

### Backend

- migration test for legacy token rows to normalized accepted-token rows
- create/update tests for token amount persistence
- read-model tests ensuring list/detail/checkout return consistent pricing payloads
- image normalization tests

### Frontend

- product card pricing rendering tests
- product detail gallery interaction tests
- seller form tests for:
  - base USD auto-fill
  - per-token manual override
  - multi-image ordering
- theme tests to ensure:
  - dark mode remains unchanged
  - desktop light mode mounts the new background
  - mobile light mode does not mount the heavy effect

### Integration

- create product with multiple tokens and multiple images
- view product on list and detail pages
- select a token during checkout
- confirm Grapuco reindex script updates status correctly

## Rollout Plan

1. Introduce normalized interfaces, services, and DTO mappers.
2. Implement and test migration for legacy token and image data.
3. Update backend create/update/read flows to use normalized tables.
4. Update seller forms to author normalized pricing and gallery data.
5. Update product card and detail UI.
6. Replace desktop light-mode background behavior.
7. Standardize Grapuco reindex command and status tracking.
8. Remove unsafe UI fallbacks that hide broken data.

## Risks and Mitigations

- Risk: Legacy products render incorrectly after migration.
  - Mitigation: keep compatibility checks during rollout and verify migrated rows before removing old fallbacks.
- Risk: Light-mode animation affects performance.
  - Mitigation: desktop-only gating, reduced-motion gating, and a simpler fallback path.
- Risk: Frontend pages still diverge if they consume separate DTO shapes.
  - Mitigation: enforce one shared product read model for list/detail/checkout.
- Risk: Grapuco status becomes stale if the hook fails.
  - Mitigation: explicit status file with success/failure and commit SHA.

## Decision Notes

- The project will not use metadata JSON as the primary store for pricing or images.
- The project will not store image binaries in JSON.
- The implementation style favors explicit interfaces and service boundaries over inheritance-heavy OOP.

## Implementation Readiness

This design is approved at the product level and ready to be converted into an implementation plan. The next step is to write a task-by-task plan covering:

- database migration
- backend DTO and service refactor
- seller UI refactor
- card/detail/gallery refactor
- desktop light-mode background implementation
- Grapuco reindex standardization
