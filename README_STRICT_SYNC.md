# Upload bundle — Strict Square Sync

Copy these into your repo:
- scripts/preflight.mjs
- scripts/fetch-square.mjs
- .github/workflows/sync-square-strict.yml (optional)
- PACKAGE_SCRIPTS_ADD.json (merge into package.json)

Configure in GitHub → Settings → Secrets and variables → Actions
- Secrets: SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID
- Variables: SQUARE_ENVIRONMENT=production (or sandbox)

Run locally:
  export SQUARE_ENVIRONMENT=production
  export SQUARE_ACCESS_TOKEN='EAAA...'
  export SQUARE_LOCATION_ID='L...'
  npm run preflight:square
  npm run sync:square
