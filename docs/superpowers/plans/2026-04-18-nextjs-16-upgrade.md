# Next.js 16 Upgrade Plan

## Context

- Frontend currently runs `next@14.1.0`, `react@18.2.0`, and `eslint-config-next@14.1.0`.
- Local Node.js is `v24.11.1`, which satisfies the Next.js 16 minimum requirement of Node `20.9.0`.
- The frontend has a custom `webpack` configuration in `frontend/next.config.mjs`, so Next.js 16's default Turbopack build cannot be adopted blindly.
- The app still uses `frontend/middleware.ts` and `next lint`, both of which are deprecated in the Next.js 16 upgrade guide.

## Goals

1. Upgrade the frontend to the latest stable Next.js line available now.
2. Keep local development and production builds working without regressing the current custom bundling behavior.
3. Reduce or explain the `npm WARN deprecated` output by distinguishing direct dependency issues from transitive ones.
4. Document the current frontend/backend stack so the runtime architecture is easier to reason about.

## Implementation Steps

### 1. Dependency baseline

- Update `next`, `react`, `react-dom`, `eslint-config-next`, `eslint`, and React type packages in `frontend/package.json`.
- Remove invalid script duplication in `frontend/package.json` and migrate the lint script away from `next lint`.
- Regenerate `frontend/package-lock.json`.

### 2. Next.js 16 compatibility

- Rename `frontend/middleware.ts` to `frontend/proxy.ts`.
- Rename the exported function from `middleware` to `proxy`.
- Preserve the existing matcher/auth logic.
- Update package scripts to opt into webpack explicitly for now via `next dev --webpack` and `next build --webpack`, because the app already depends on custom webpack hooks.

### 3. Tooling cleanup

- Keep the Grapuco wrapper script as the single `reindex` entry in `frontend/package.json`.
- Review ESLint config compatibility after moving away from `next lint`.
- Check whether any Next.js config keys need removal or adjustment after the dependency upgrade.

### 4. Verification

- Install updated frontend dependencies.
- Run `npm run build`.
- Run `npx tsc --noEmit`.
- Run a targeted lint command with the new ESLint CLI.
- Inspect remaining `npm WARN deprecated` items and classify them as:
  - fixed by the upgrade,
  - still present due to transitive dependencies,
  - requiring a separate package ecosystem upgrade later.

## Risks / Watchpoints

- Wallet and Web3 dependencies may keep some deprecated transitive packages until their upstream maintainers release newer versions.
- If a package in the current stack is not React 19 ready, we may need to stay on the latest compatible version rather than forcing every package to newest blindly.
- Next.js 16 changes image and proxy behavior; the existing auth gate and remote image config need build verification, not assumption.
