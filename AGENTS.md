# Project Rules

- Use the current worktree only. Do not edit sibling worktrees or the baseline repo unless the user explicitly asks.
- Put one-off artifacts in `.scratch/` only. If a file is created just to inspect data, test a query, or debug once, delete it before finishing the task unless the user asks to keep it.
- Never leave behind temp artifacts such as `tmp_*`, copied logs, exported query results, or ad-hoc SQL in source folders. Promote them into a real `docs/`, `scripts/`, or migration file only when they are genuinely part of the project.
- For crypto checkout flows, never trigger a second escrow release when the buyer already confirmed delivery on-chain.
- For crypto checkout flows, never fall back to the escrow contract address when a seller payout wallet is missing. Fail fast and ask for a valid seller wallet instead.
- For batch crypto payments, every order sharing the same transaction hash must still get its own payment row and status update.
- Prefer the GitHub Actions deploy path. If a manual local deploy is necessary, make sure the worktree is clean, know the current commit SHA, and use `/health` for service checks.
- For UI work, never ship text or important content that blends into the surface or background. Every new or edited screen must keep readable contrast in both light mode and dark mode, using semantic theme tokens instead of hard-coded light-on-light or dark-on-dark text where possible.

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
