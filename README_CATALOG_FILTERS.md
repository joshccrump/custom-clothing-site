# Catalog filters + Terminal test

You’re seeing “Wrote 47 items” because the sync pulls *all* ITEM objects in your Square catalog by default
(items can include variants, archived items that still exist, or items not meant for online).

This pack adds:
- **scripts/catalog-dryrun.mjs** — fetch + filter preview (no file writes)
- **scripts/fetch-square.mjs** — filtered writer (refuses to write if nothing passes)
- **scripts/test-square-catalog.sh** — terminal test via cURL/jq

## Filters (set via env)
- `FILTER_ONLY_PRESENT_AT_LOCATION=true` — require the item to be present at the selected location
- `FILTER_ONLY_WITH_PRICE=true`         — require at least one variation with a price
- `FILTER_ONLY_IN_STOCK=true`           — require > 0 inventory for that location
- `FILTER_ONLY_WITH_IMAGE=true`         — require an image
- `FILTER_CATEGORY_ALLOWLIST="Hats,Shirts"` — only these category names
- `FILTER_CATEGORY_BLOCKLIST="Gift Card"`   — exclude categories
- `FILTER_CUSTOM_ATTR_KEY="channel"` + `FILTER_CUSTOM_ATTR_VALUE="online"` — match item custom attribute

> Tip: start with `ONLY_WITH_PRICE=true` and (if you use inventory) `ONLY_IN_STOCK=true` to reduce noise.

## Try a dry run (no file writes)
```bash
export SQUARE_ENVIRONMENT=production
export SQUARE_ACCESS_TOKEN='EAAA...'
export SQUARE_LOCATION_ID='L...'
export FILTER_ONLY_WITH_PRICE=true
export FILTER_ONLY_IN_STOCK=true
node scripts/catalog-dryrun.mjs
```

## Write filtered products.json
```bash
export SQUARE_ENVIRONMENT=production
export SQUARE_ACCESS_TOKEN='EAAA...'
export SQUARE_LOCATION_ID='L...'
export OUTPUT_PATH=data/products.json
export FILTER_ONLY_WITH_PRICE=true
export FILTER_ONLY_IN_STOCK=true
node scripts/fetch-square.mjs
```

## Terminal test (raw API)
```bash
chmod +x scripts/test-square-catalog.sh

SQUARE_ENVIRONMENT=production \
SQUARE_ACCESS_TOKEN='EAAA...' \
./scripts/test-square-catalog.sh
```

The output shows your locations and a quick summary of catalog items directly from Square.
