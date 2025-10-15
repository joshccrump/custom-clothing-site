# fetch-square.mjs with Location fallback

This version reads SQUARE_LOCATION_ID from env; if missing, it falls back to config/public-square.json.
It fails if the ID is still missing/invalid or if the catalog has 0 items.

## Install
Replace your existing file with:
- scripts/fetch-square.mjs

## Run
SQUARE_ENVIRONMENT=production \
SQUARE_ACCESS_TOKEN='EAAA...' \
# SQUARE_LOCATION_ID can be omitted if you use config/public-square.json
OUTPUT_PATH=data/products.json \
node scripts/fetch-square.mjs
