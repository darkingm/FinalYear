# Project Rules

- Use the current worktree only. Do not edit sibling worktrees or the baseline repo unless the user explicitly asks.
- Put one-off artifacts in `.scratch/` only. If a file is created just to inspect data, test a query, or debug once, delete it before finishing the task unless the user asks to keep it.
- Never leave behind temp artifacts such as `tmp_*`, copied logs, exported query results, or ad-hoc SQL in source folders. Promote them into a real `docs/`, `scripts/`, or migration file only when they are genuinely part of the project.
- For crypto checkout flows, never trigger a second escrow release when the buyer already confirmed delivery on-chain.
- For crypto checkout flows, never fall back to the escrow contract address when a seller payout wallet is missing. Fail fast and ask for a valid seller wallet instead.
- For batch crypto payments, every order sharing the same transaction hash must still get its own payment row and status update.
- Deployment source of truth is always the local workspace at `C:\Users\Asus\Documents\FYP\FYP` unless the user explicitly says otherwise. Do not assume GitHub, VPS git state, or any remote branch is newer than local.
- For VPS deploys, do not run `git pull`, `git reset`, `git checkout --`, branch switching, or any destructive cleanup on the VPS unless the user explicitly requests it for that command. Copy/build from the local workspace, backup overwritten VPS files first, then verify with logs, health checks, and affected flows.
- If local and VPS differ, treat local as canonical and explain the sync/deploy steps. Never tell the user to update GitHub just to deploy their own single-developer project.
- The VPS is a low-resource production host (2 CPU cores). Never run Docker image builds, `npm run build`, `next build`, TypeScript project builds, Hardhat compile/test, or other CPU-heavy jobs on the VPS unless the user explicitly authorizes that exact command. Build/test locally or via GitHub Actions/Docker Hub, then let the VPS only pull images, run lightweight migrations, set env, restart containers, and read logs/health checks.
- For UI work, never ship text or important content that blends into the surface or background. Every new or edited screen must keep readable contrast in both light mode and dark mode, using semantic theme tokens instead of hard-coded light-on-light or dark-on-dark text where possible.
- Before touching deploy, auth, checkout, wallet, RWA, seller, or frontend navigation, read the relevant `.agents/skills/web3market-*` files first. They are the project-specific source of truth for future agents.
- Never expose `INTERNAL_SERVICE_KEY` or any backend service secret as a `NEXT_PUBLIC_*` variable. It may exist in the Next.js server runtime for server-to-server NextAuth calls, but it must never be sent to browser code.
- Production browser/MetaMask RPC for Hardhat must use the HTTPS proxy `https://kienai.id.vn/rpc/hardhat`. Direct `http://103.20.96.79:8545` is only an infrastructure/debug endpoint and can cause mixed-content/CORS failures from the HTTPS site.
- Do not route all `/api/auth/*` to Next.js. NextAuth owns only `/api/auth/session`, `/api/auth/csrf`, `/api/auth/signin`, `/api/auth/signout`, `/api/auth/callback/*`, `/api/auth/providers`, `/api/auth/error`, and `/api/auth/_log`. Backend auth endpoints such as `/api/auth/register`, `/api/auth/login`, `/api/auth/wallet-login`, `/api/auth/oauth`, `/api/auth/forgot-password`, `/api/auth/reset-password`, and `/api/auth/logout` must reach main-service unless the code namespace is intentionally changed.
- User-facing UI must not contain dead links, placeholder buttons, or clickable text with no real route/handler. If a feature is not implemented, disable the control visibly and explain why. Avoid showing `VPS` in primary customer-facing CTA labels; use `Hardhat`, `test chain`, or a clearer Vietnamese label instead.
- Wallet/SIWE flows must use the currently connected chain ID and canonical frontend origin. Do not hard-code chain `31337` for signatures if MetaMask is connected to a different supported chain.

## Bug And Security Rules

- Always find and fix the root cause. Do not apply temporary symptom-only patches just to silence an error.
- When a test fails, identify the exact failing assertion, the underlying execution path, and the broken logic before making changes.
- Never change a test just to make it pass. Only update tests when the test or spec is proven wrong or has intentionally changed, and ask the user before doing that.
- After each fix, review related flows for regressions instead of stopping at a narrow local patch.
- Every debugging update must clearly state the symptom, root cause, impact scope, fix, verification steps, and any residual risk.
- When reviewing the codebase, especially smart contracts, proactively check access control, reentrancy, input validation, invalid state transitions, missing critical events, arithmetic or rounding errors, overflow or underflow assumptions, oracle or price manipulation risk, front-running, denial-of-service or gas griefing risk, emergency pause or recovery paths, and upgradeability or initialization issues.
- If the codebase is missing logic, validation, UI-visible information, or complete security handling, raise it with the user and propose follow-up improvements instead of silently leaving it behind.
- Base every conclusion on evidence from logs, code paths, tests, or traces. Label anything unconfirmed as a hypothesis until it is proven.
- If a fix removes one symptom but the bug still appears suspicious or partially unresolved, keep tracing the root cause instead of closing the task early.
