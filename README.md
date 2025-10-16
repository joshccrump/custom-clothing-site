# Custom Clothing Site – Square + GitHub Pages

This repository hosts the static storefront that lives at
<https://joshccrump.github.io/custom-clothing-site/> and the serverless API
handlers that run on Vercel. The site reads product information from
`data/products.json`, renders a catalog/grid, and forwards checkout requests to
a Vercel function that charges the card through Square.

The repo also contains scripts and workflow notes for syncing your live Square
catalog into the static JSON file so the GitHub Pages build always reflects your
current inventory.

> **Node.js version:** Vercel now defaults new projects to Node 22, but the
> pinned serverless runtime requires Node 20. Use Node `20.x` locally (via
> `nvm use 20` or similar) and set the Vercel project’s “General → Node.js
> Version” to `20.x` to avoid build failures.

## Key Pieces

| File / Directory | Purpose |
| --- | --- |
| `data/products.json` | Snapshot of your Square catalog that powers the shop, gallery, and cart views. |
| `scripts/fetch-square.js` | Node script that pulls items, variations, modifiers, and prices from Square (using ESM imports) and rewrites `data/products.json`. |
| `scripts/fetch-square.cjs` | CommonJS shim so older workflows that run `fetch-square.cjs` keep working. |
| `serverless-vercel/api/*.js` | Vercel API routes (`/api/catalog`, `/api/inventory`, `/api/checkout`) that share the Square client helper in `_square.js`. |
| `assets/site-utils.js` | Small helper exposed as `window.Site` that normalizes base URLs, resolves image paths, and loads the generated catalog JSON. |
| `assets/*.js` | Client-side scripts for the shop grid, cart, checkout navigation, and client portals. They call into `window.Site` so links work on both GitHub Pages and root hosting. |

## Square Catalog Sync

1. Install dependencies once:
   ```bash
   npm install
   ```
2. Provide your Square credentials (use Production values for the live site).
   Either export them in your shell *or* drop them into `.env.local` using
   the `.env.example` template in the repo root:
   ```bash
   export SQUARE_ACCESS_TOKEN="sq0atp-..."
   export SQUARE_LOCATION_ID="L123456789"
   export SQUARE_ENVIRONMENT="production"   # or sandbox
   ```
3. Run the sync script:
   ```bash
   npm run sync:square
   ```
   On success you will see `Wrote X items → data/products.json`. Commit the
   updated JSON and redeploy GitHub Pages. The script now pulls images,
   modifier lists, item options (for size labels), and optional inventory
   counts when `SQUARE_LOCATION_ID` is set, so the static catalog mirrors what
   Square reports for each variation.

Need an offline smoke test? Use the bundled fixture to exercise the pipeline
without hitting the live API:

```bash
npm run sync:square:mock
```

This writes the transformed mock data to `data/products.json` so you can verify
the shape before pointing the workflow at your live credentials.

If you still need to run the CommonJS entry point for legacy workflows, invoke
`scripts/fetch-square.cjs`; it simply `import()`s the ESM version.

## Checkout API (Vercel)

Deploy the `serverless-vercel` folder to your Vercel project so that the
following endpoints are available under your project domain:

- `GET  /api/catalog?variationId=...` – fetches variation + modifier metadata
- `GET  /api/inventory?ids=ID1,ID2` – retrieves on-hand counts for variations
- `POST /api/checkout` – creates an order and charge using the Square Payments API

These handlers all call the shared `makeClient()` helper in `_square.js`, which
validates `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, and `SQUARE_ENVIRONMENT`. Missing
credentials now produce a clear 500 response instead of throwing `require`
errors in the Node 20 runtime.

## Front-end Configuration

The static pages expect a few values to be set before deploying:

- `checkout.html` – populate `window.SQUARE_APPLICATION_ID`,
  `window.SQUARE_LOCATION_ID`, and `window.API_BASE` with the Square Web Payments
  SDK application ID, your location ID, and the deployed Vercel base URL.
- `cart.html` – update the `<meta name="api-base">` tag so the cart can call your
  deployed `/api/catalog` endpoint. The JavaScript uses `window.Site` to keep
  links working across GitHub Pages, local previews, and custom domains.

All client scripts rely on `window.Site` to detect whether they are served from
`https://*.github.io/<repo>/`, a local preview, or the site root and adjust
internal links accordingly.

## Local Smoke Test

1. Start a static server from the repo root:
   ```bash
   python3 -m http.server 4173
   ```
2. Open <http://127.0.0.1:4173/shop.html>. You should see the sample products
   from `data/products.json`. The “Buy” buttons deep-link into `cart.html` with a
   `variationId` query string.
3. Visit `cart.html?variationId=SAMPLE-HOODIE-M`. The cart page will render the
   hoodie sample data and allow you to select modifiers before continuing to
   checkout. Without Square credentials in the browser the live payment step will
   fail, but the UI should render and price totals should update as you toggle
   modifiers.

## Testing in this Repo

- `node --check scripts/fetch-square.js` – verifies the ESM sync script parses.
- `node --check serverless-vercel/api/checkout.js` – sanity-checks the checkout handler.
- `browser_container.run_playwright_script` – used in CI here to crawl the live
  GitHub Pages deployment and confirm the catalog renders.

## Git Remotes & Deployments

This workspace already has the `origin` remote pointing to
`https://github.com/joshccrump/custom-clothing-site.git`. Authenticate with a
PAT or SSH key before running `git push` from this environment (see
`README-DEPLOY.md` for credential steps). Once pushed, GitHub Pages picks up
changes to the `main` branch automatically.
