#!/usr/bin/env bash
# ============================================================
# dockerhub-cleanup.sh
# Xóa các Docker image cũ trên DockerHub, chỉ giữ N image mới nhất
# Usage: bash scripts/dockerhub-cleanup.sh [KEEP_COUNT]
# Example: bash scripts/dockerhub-cleanup.sh 3
# ============================================================
set -euo pipefail

DOCKERHUB_USER="${DOCKERHUB_USERNAME:-darkingm}"
KEEP="${1:-3}"   # Số image muốn giữ lại (mặc định 3)

REPOS=("web3market-frontend" "web3market-backend")

# ── Login (dùng DOCKERHUB_PASSWORD hoặc DOCKERHUB_TOKEN từ env) ──
HUB_PASS="${DOCKERHUB_TOKEN:-${DOCKERHUB_PASSWORD:-}}"
if [[ -z "$HUB_PASS" ]]; then
  echo "❌ Cần set DOCKERHUB_TOKEN hoặc DOCKERHUB_PASSWORD"
  exit 1
fi

echo "🔐 Đăng nhập DockerHub..."
TOKEN=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$DOCKERHUB_USER\",\"password\":\"$HUB_PASS\"}" \
  "https://hub.docker.com/v2/users/login/" | jq -r .token)

if [[ -z "$TOKEN" || "$TOKEN" == "null" ]]; then
  echo "❌ Đăng nhập thất bại"
  exit 1
fi
echo "✅ Đăng nhập thành công"

for REPO in "${REPOS[@]}"; do
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📦 Repository: $DOCKERHUB_USER/$REPO"

  # Lấy tất cả tags, sắp xếp theo thời gian (mới nhất trước)
  TAGS_JSON=$(curl -s \
    -H "Authorization: JWT $TOKEN" \
    "https://hub.docker.com/v2/repositories/$DOCKERHUB_USER/$REPO/tags/?page_size=100")

  TOTAL=$(echo "$TAGS_JSON" | jq '.count // 0')
  echo "   Tổng số tags: $TOTAL"

  if [[ "$TOTAL" -le "$KEEP" ]]; then
    echo "   ✅ Chỉ có $TOTAL tags, không cần xóa (giữ $KEEP)"
    continue
  fi

  # Lấy tags cần xóa (bỏ qua $KEEP tags mới nhất)
  TAGS_TO_DELETE=$(echo "$TAGS_JSON" | jq -r \
    "[.results | sort_by(.last_updated) | reverse | .[$KEEP:][].name] | .[]")

  if [[ -z "$TAGS_TO_DELETE" ]]; then
    echo "   ✅ Không có tag nào để xóa"
    continue
  fi

  echo "   🗑️  Sẽ xóa $(echo "$TAGS_TO_DELETE" | wc -l | tr -d ' ') tags cũ:"
  echo "$TAGS_TO_DELETE" | while read -r TAG; do
    echo "      - $TAG"
  done

  # Xóa từng tag
  echo "$TAGS_TO_DELETE" | while read -r TAG; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
      -X DELETE \
      -H "Authorization: JWT $TOKEN" \
      "https://hub.docker.com/v2/repositories/$DOCKERHUB_USER/$REPO/tags/$TAG/")

    if [[ "$HTTP_CODE" == "204" ]]; then
      echo "   ✅ Đã xóa: $TAG"
    else
      echo "   ⚠️  Lỗi xóa $TAG (HTTP $HTTP_CODE)"
    fi
  done

  echo "   📊 Hoàn thành — còn lại $KEEP tags"
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Cleanup xong! Xem tại: https://hub.docker.com/u/$DOCKERHUB_USER"
