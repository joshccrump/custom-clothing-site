# Build real data/products.json from Square (upload-only)

Upload these files to the same paths in your repo:
- scripts/build-products-json.mjs
- .github/workflows/build-products.yml

Then in GitHub:
1) Settings → Secrets and variables → Actions
   - Secrets: add SQUARE_ACCESS_TOKEN (Production token, starts with EAAA...)
   - Variables (optional): add SQUARE_ENVIRONMENT=production
2) Actions → Build products.json → Run workflow

The workflow fetches your live Square catalog and commits data/products.json (no placeholders).