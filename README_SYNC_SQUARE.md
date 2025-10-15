# Square sync fix — upload-only bundle

Upload these files to your repo:

- `scripts/fetch-square.mjs`
- `scripts/preflight.mjs`
- `.github/workflows/sync-square.yml`

## Configure (one-time)
Repo → **Settings → Secrets and variables → Actions**
- **Secrets**:
  - `SQUARE_ACCESS_TOKEN` (Production token, begins with `EAAA…`)
  - `SQUARE_LOCATION_ID`  (your Square location, e.g. `LXXXXXXXXXXXX`)
- **Variables** (optional): `SQUARE_ENVIRONMENT=production`

## Run (GitHub UI)
Actions → **Sync Square → data/products.json** → Run workflow

This will:
1) Preflight (prints env; fails if token missing),
2) Fetch Catalog (ITEM, ITEM_VARIATION, IMAGE),
3) Add inventory by location if you set `SQUARE_LOCATION_ID`,
4) Write `data/products.json` (no placeholders), commit, and push.
