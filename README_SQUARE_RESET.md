# Square Connection Reset — Quick Guide

1) Revoke old token in Square Dev Dashboard; create a new **Production** token if you sell live (starts with EAAA…).
2) In GitHub → Settings → Secrets and variables → Actions
   - Secrets: `SQUARE_ACCESS_TOKEN` (new token)
   - (Optional) Secrets: `SQUARE_LOCATION_ID` (e.g., L116Z8RBA1RJ4)
   - Variables: `SQUARE_ENVIRONMENT=production` (or sandbox)
3) Either set `SQUARE_LOCATION_ID` secret **or** edit `config/public-square.json` to:
   ```json
   { "locationId": "L116Z8RBA1RJ4" }
   ```
4) Run **Actions → Verify Square (Reset)**. It should confirm your token and location.
5) Run **Actions → Sync Square (Reset)**. It will generate `data/products.json` (no placeholders).
6) Hard refresh your site pages to load the updated catalog.
