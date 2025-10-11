
# Square → Static Site Sync (Catalog, Variations, Custom Attributes)

This bundle sets up a secure sync from your **Square catalog** to your static site’s `data/products.json`. It preserves **variations**, **inventory**, **images**, and **custom attributes**.

### Files
- `scripts/fetch-square.js` — Node script that pulls your Square catalog and writes `data/products.json`.
- `.github/workflows/square-sync.yml` — GitHub Action that runs on a schedule or on-demand.
- `assets/gallery.js` — Drop-in frontend update (price ranges + size chips).
- `package.json` — Declares the `square` SDK and a `sync:square` script.

### Setup
1. **Square Developer app**
   - Copy your **Production access token** (or Sandbox if testing).

2. **GitHub → Settings → Secrets and variables → Actions**
   - `SQUARE_ACCESS_TOKEN` — your token
   - `SQUARE_ENV` — `production` or `sandbox` (default `production`)
   - `SQUARE_LOCATION_ID` — location to sum inventory from (optional but recommended)

3. **Commit the bundle** (root of repo).

4. **Run**: GitHub → Actions → **Sync Square Catalog** → **Run workflow**.

5. **Verify**: `/gallery/` and `shop.html` show price ranges and sizes derived from variations.

### Offline smoke test

If you want to confirm the sync pipeline without calling the live Square API, use the bundled mock catalog:

```bash
npm run sync:square:mock
```

This reads `tests/fixtures/mock-square-catalog.json`, exercises the full parser, and writes `data/products.mock.json` so you can inspect the generated structure without overwriting your live catalog export.

### Product URLs
Square’s Catalog API doesn’t expose Square Online product page URLs. Add a **catalog custom attribute** on the ITEM named `product_url` (or `external_url`) and paste the link; the script passes it through as `url`.

### References
- Catalog API overview and object model.  
- Custom Attributes for catalog items.  
- Inventory batch counts for multiple variations.
