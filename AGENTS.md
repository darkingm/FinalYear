# Project Rules

- Use the current worktree only. Do not edit sibling worktrees or the baseline repo unless the user explicitly asks.
- Put one-off artifacts in `.scratch/` only. If a file is created just to inspect data, test a query, or debug once, delete it before finishing the task unless the user asks to keep it.
- Never leave behind temp artifacts such as `tmp_*`, copied logs, exported query results, or ad-hoc SQL in source folders. Promote them into a real `docs/`, `scripts/`, or migration file only when they are genuinely part of the project.
- For crypto checkout flows, never trigger a second escrow release when the buyer already confirmed delivery on-chain.
- For crypto checkout flows, never fall back to the escrow contract address when a seller payout wallet is missing. Fail fast and ask for a valid seller wallet instead.
- For batch crypto payments, every order sharing the same transaction hash must still get its own payment row and status update.
- Prefer the GitHub Actions deploy path. If a manual local deploy is necessary, make sure the worktree is clean, know the current commit SHA, and use `/health` for service checks.
- For UI work, never ship text or important content that blends into the surface or background. Every new or edited screen must keep readable contrast in both light mode and dark mode, using semantic theme tokens instead of hard-coded light-on-light or dark-on-dark text where possible.
