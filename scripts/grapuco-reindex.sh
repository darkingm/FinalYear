#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)
STATUS_DIR="$REPO_ROOT/.grapuco"
STATUS_FILE="$STATUS_DIR/status.json"
STARTED_AT=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
COMMIT=$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || printf "unknown")

mkdir -p "$STATUS_DIR"

write_status() {
  STATE="$1"
  MESSAGE="$2"
  EXIT_CODE="$3"
  cat > "$STATUS_FILE" <<EOF
{
  "state": "$STATE",
  "message": "$MESSAGE",
  "started_at": "$STARTED_AT",
  "finished_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "commit": "$COMMIT",
  "cwd": "$REPO_ROOT",
  "command": "npx grapuco ingest",
  "exit_code": $EXIT_CODE
}
EOF
}

write_status "running" "Grapuco reindex started" 0

if (cd "$REPO_ROOT" && npx grapuco ingest); then
  write_status "success" "Grapuco reindex completed" 0
else
  write_status "failed" "Grapuco reindex failed" 1
  exit 1
fi
