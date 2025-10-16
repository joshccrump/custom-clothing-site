#!/usr/bin/env bash
# scripts/test-square-catalog.sh
# Minimal terminal test for product pull using cURL + jq.
# Requires: bash, curl, jq
#
# Usage:
#   SQUARE_ENVIRONMENT=production \
#   SQUARE_ACCESS_TOKEN='EAAA...' \
#   ./scripts/test-square-catalog.sh
#
# Optional:
#   SQUARE_LOCATION_ID='L...' (to check presence/inventory)

set -euo pipefail

ENV="${SQUARE_ENVIRONMENT:-production}"
BASE="https://connect.squareup.com"
if [[ "$ENV" == "sandbox" ]]; then
  BASE="https://connect.squareupsandbox.com"
fi

if [[ -z "${SQUARE_ACCESS_TOKEN:-}" ]]; then
  echo "Missing SQUARE_ACCESS_TOKEN" >&2
  exit 1
fi

echo "=== /v2/locations ==="
curl -sS "$BASE/v2/locations" \
  -H "Authorization: Bearer ${SQUARE_ACCESS_TOKEN}" \
  -H "Square-Version: 2025-01-22" \
| jq '{count: (.locations|length), ids: [.locations[].id], names: [.locations[].name]}'

echo
echo "=== /v2/catalog/list (ITEM, VARIATION, IMAGE, CATEGORY) ==="
curl -sS "$BASE/v2/catalog/list?types=ITEM,ITEM_VARIATION,IMAGE,CATEGORY" \
  -H "Authorization: Bearer ${SQUARE_ACCESS_TOKEN}" \
  -H "Square-Version: 2025-01-22" \
| jq '{
    itemCount: ([.objects[]? | select(.type=="ITEM")] | length),
    sampleItems: ([.objects[]? | select(.type=="ITEM")][0:5] | map(.itemData.name))
  }'
