---
name: using-grapuco-architecture
description: Use when starting complex tasks, bug fixing, or before modifying core logic. Explains how to leverage Grapuco MCP tools to analyze code structure, find correct files, and avoid breaking dependencies.
---

# 🗺️ Using Grapuco Architecture MCP

Whenever you need to make changes to complex features, add new functionalities to existing flows, or modify files that might have unknown dependencies, you **MUST** use the Grapuco MCP tools to understand the architecture first. This prevents breaking things and saves significant token context by extracting only what's necessary.

## 📌 When to Use Grapuco
1. **Refactoring:** Before modifying any Shared Service, Model, or Controller.
2. **Adding Features:** When an existing feature (e.g., `createOrder`) needs extension, use Grapuco to trace all the layers (Router → Controller → Service → DB).
3. **Debugging:** When an error occurs, search for the symbol to see its callers and data flow paths.

## 🛠️ Key Grapuco Tools & How to Use Them

### 1. Identify the Repository
Always start by verifying the `repositoryId` if you don't have it memorized.
- **Tool:** `mcp_grapuco_list_repositories`
- **Expected Output:** Returns a JSON list of indexed repositories. (e.g., `8fde37fe-e3e8-4111-8471-bbafc7579162` for `Web3Market_Source`).

### 2. Search for Entry Points (Functions/Classes)
Instead of running heavy `grep_search` across directories, use Grapuco to pinpoint symbols instantly.
- **Tool:** `mcp_grapuco_search_code`
- **Params:** `query` (e.g., `"createOrder"`), `repositoryId`
- **Result:** Provides a list of exact file paths, line numbers, and concise summaries of the functions across the entire monorepo!

### 3. Analyze Impact & Dependencies
Before deleting or significantly altering a file/function, check who depends on it.
- **Tool:** `mcp_grapuco_get_dependencies`
- **Params:** `nodeId` (obtained from `search_code` results, e.g., `"Function:backend/main-service/src/modules/orders/orders.controller.ts:createOrder"`)
- **Result:** Shows all places that CALL this function or IMPORT it.

- **Tool:** `mcp_grapuco_get_impact_analysis`
- **Params:** `filePath`
- **Result:** Lists all modules affected if you change this file.

### 4. Understand End-to-End Flows
If you are extending an API route (like Checkout or Payment), see how data moves.
- **Tool:** `mcp_grapuco_get_data_flows`
- **Params:** `httpPath` (e.g., `"/api/orders"`)
- **Result:** Shows the trace from the HTTP entry point down to the Database queries.

## ⚠️ Important Rules for AI
- **DO NOT rely solely on grep** for searching complex function usages. Use `search_code` to get precise contextual locations.
- **DO NOT assume the map is 100% real-time:** If the user just edited files heavily and hasn't re-indexed, the Grapuco map might be slightly out of sync. Always use `view_file` on the resulting paths to confirm the current code before making edits.
- Use `mcp_grapuco_semantic_search` if the user describes a feature but you don't know the exact function name (e.g., `"how does user login work?"`).
