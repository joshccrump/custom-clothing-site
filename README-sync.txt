Square Sync Bundle

Adds:
- .github/workflows/sync-square.yml (commits data/products.json on a schedule or manual run)
- scripts/fetch-square.js (pulls Square catalog)
- data/products.json (empty array to remove sample item)

Setup:
1) GitHub → Settings → Secrets and variables → Actions → add secrets:
   - SQUARE_ACCESS_TOKEN  (Production or Sandbox token)
   - SQUARE_ENV           (production or sandbox)
2) Commit these files to main.
3) Run the workflow manually once (Actions → Sync Square Catalog → Run).
4) Refresh: https://joshccrump.github.io/custom-clothing-site/data/products.json

Notes:
- This workflow does NOT deploy Pages; it only commits JSON.
- Gallery/Shop should read from /custom-clothing-site/data/products.json
