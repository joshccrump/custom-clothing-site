# Auth + sync fix

Upload these files to your repo:
- scripts/square-auth-check.mjs   (new)
- scripts/fetch-square.mjs        (patched to verify auth first)

Add to package.json (merge with your existing):
{
  "scripts": {
    "auth:check": "node scripts/square-auth-check.mjs",
    "preflight:square": "node scripts/preflight.mjs",
    "sync:square": "node scripts/fetch-square.mjs"
  }
}

Run (same env as your workflow):
SQUARE_ENVIRONMENT=production SQUARE_ACCESS_TOKEN='EAAA...' SQUARE_LOCATION_ID='L...' npm run auth:check
Then:
SQUARE_ENVIRONMENT=production SQUARE_ACCESS_TOKEN='EAAA...' SQUARE_LOCATION_ID='L...' OUTPUT_PATH=data/products.json npm run sync:square
