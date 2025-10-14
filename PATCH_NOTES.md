# GitHub Pages + Square Fixes (Upload Bundle)

## Included
- `tools/fix-paths.mjs` → converts absolute to relative paths for key assets/links; fixes catalog fetch path.
- `scripts/preflight.mjs` → no-SDK auth check.
- `scripts/fetch-square.mjs` → no-SDK catalog export.
- `.github/workflows/square-sync.yml` → CI that runs preflight/export and commits JSON.

## Apply
1) Upload to these paths in your repo:
   - tools/fix-paths.mjs
   - scripts/preflight.mjs
   - scripts/fetch-square.mjs
   - .github/workflows/square-sync.yml
2) Run:
   ```bash
   node tools/fix-paths.mjs
   git add -A
   git commit -m "fix: relative paths + catalog fetch"
   git push
   ```
3) Preflight (local/Codespaces):
   ```bash
   SQUARE_ENVIRONMENT=production SQUARE_ACCESS_TOKEN='EAAA...' node scripts/preflight.mjs
   ```
4) Export catalog:
   ```bash
   SQUARE_ENVIRONMENT=production SQUARE_ACCESS_TOKEN='EAAA...' node scripts/fetch-square.mjs
   git add data/products.json
   git commit -m "chore: add catalog snapshot"
   git push
   ```
5) Verify in browser: `https://<user>.github.io/<repo>/data/products.json`

Set repo Secrets/Variables for CI:
- Secrets: `SQUARE_ACCESS_TOKEN`
- Variables: `SQUARE_ENVIRONMENT=production` (or `sandbox`)
