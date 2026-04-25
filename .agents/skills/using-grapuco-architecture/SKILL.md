---
name: using-grapuco-architecture
description: Use when starting complex tasks, bug fixing, or before modifying core logic in a project that has Grapuco indexing or MCP configured.
---

# Using Grapuco Architecture

Grapuco builds an architecture index by parsing the repository locally and uploading code metadata, not full source code. In an AI client, the indexed graph is queried through a remote MCP server. Use it when available, but never block a bugfix just because the current session does not expose Grapuco tools.

## Availability Gate

Before relying on Grapuco:

1. Check whether Grapuco MCP tools are exposed in the current agent session.
2. Check `.grapuco/status.json` if the project has it.
3. If the MCP tools are missing, failed, or stale, continue with local code search and file reads as the source of truth.
4. If the user asks to refresh the graph, run the project wrapper (`scripts/grapuco-reindex.ps1` on Windows or `scripts/grapuco-reindex.sh` on Unix) instead of embedding raw CLI commands.

Do not claim Grapuco analysis was used unless an actual Grapuco MCP tool or successful local reindex evidence was available.

## 📌 When to Use Grapuco
1. **Refactoring:** Before modifying any Shared Service, Model, or Controller.
2. **Adding Features:** When an existing feature (e.g., `createOrder`) needs extension, use Grapuco to trace all the layers (Router → Controller → Service → DB).
3. **Debugging:** When an error occurs, search for the symbol to see its callers and data flow paths.

## How Grapuco Is Expected To Work

- CLI setup: install/run `@bitsness/grapuco-cli`, then run `grapuco ingest` from the repo root.
- MCP setup: configure the AI client with the Grapuco remote MCP endpoint and API key.
- MCP tools may appear with client-specific names. Look for equivalents of repository listing, code search, semantic search, dependencies, data flows, impact analysis, and staleness checks.

## Key Grapuco Tools & How to Use Them

### 1. Identify the Repository
Always start by verifying the `repositoryId` if you don't have it memorized.
- **Tool:** `list_repositories` or the client-specific Grapuco equivalent
- **Expected Output:** Returns a JSON list of indexed repositories. (e.g., `8fde37fe-e3e8-4111-8471-bbafc7579162` for `Web3Market_Source`).

### 2. Search for Entry Points (Functions/Classes)
Instead of running heavy `grep_search` across directories, use Grapuco to pinpoint symbols instantly.
- **Tool:** `search_code` or the client-specific Grapuco equivalent
- **Params:** `query` (e.g., `"createOrder"`), `repositoryId`
- **Result:** Provides a list of exact file paths, line numbers, and concise summaries of the functions across the entire monorepo!

### 3. Analyze Impact & Dependencies
Before deleting or significantly altering a file/function, check who depends on it.
- **Tool:** `get_dependencies` or the client-specific Grapuco equivalent
- **Params:** `nodeId` (obtained from `search_code` results, e.g., `"Function:backend/main-service/src/modules/orders/orders.controller.ts:createOrder"`)
- **Result:** Shows all places that CALL this function or IMPORT it.

- **Tool:** `get_impact_analysis` or the client-specific Grapuco equivalent
- **Params:** `filePath`
- **Result:** Lists all modules affected if you change this file.

### 4. Understand End-to-End Flows
If you are extending an API route (like Checkout or Payment), see how data moves.
- **Tool:** `get_data_flows` or the client-specific Grapuco equivalent
- **Params:** `httpPath` (e.g., `"/api/orders"`)
- **Result:** Shows the trace from the HTTP entry point down to the Database queries.

## ⚠️ Important Rules for AI
- **DO NOT rely solely on grep** for searching complex function usages. Use `search_code` to get precise contextual locations.
- **DO NOT assume the map is 100% real-time:** If the user just edited files heavily and hasn't re-indexed, the Grapuco map might be slightly out of sync. Always use `view_file` on the resulting paths to confirm the current code before making edits.
- Use `semantic_search` if the user describes a feature but you don't know the exact function name (e.g., `"how does user login work?"`).
