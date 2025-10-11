# GitHub Pages Feature Test – Custom Clothing Site

## Overview
Browser automation checks were executed locally against a static preview served from this repository (`python3 -m http.server 4173`) on 2025-10-11 UTC. The run validates that the updated assets, sample catalog data, and Square wiring now function end-to-end before republishing to GitHub Pages.

## Results
| Feature | Status | Notes |
| --- | --- | --- |
| Home navigation | ✅ Pass | Top navigation renders all expected links and the hero copy loads. (Links still use the GitHub Pages base path; update after deploy if you need universal relative links.) |
| Shop catalog | ✅ Pass | Two sample products from `data/products.json` render with correct pricing, thumbnails, and Buy buttons that deep-link to `cart.html`. |
| Cart flow | ✅ Pass | Loading `cart.html?variationId=SAMPLE-HOODIE-M` hydrates the static data, renders modifier options, and recalculates totals as quantities change. |
| Checkout page | ⚠️ Manual credentials required | UI loads with live Square Web Payments SDK configuration. Completing a payment still requires valid Square credentials in the browser session. |
| Product detail UI | ✅ Pass | Tabs and the size-chart modal behave as expected. |
| Client portal gate | ✅ Pass | Demo password (`sample123`) still unlocks the portal content while incorrect passwords show the warning message. |
| Gallery catalog | ✅ Pass | Mirrors the shop and displays the sample catalog entries. |
| Contact form | ✅ Pass | Contact page renders the configured form. |

## Next Steps for Production
* Push the updated `data/products.json` to `main` so GitHub Pages serves the new catalog data. The Playwright run above confirms the JSON renders correctly once published.
* After GitHub Pages finishes rebuilding, re-run the automation against the live URL to ensure the CDN is serving the latest JSON (`https://joshccrump.github.io/custom-clothing-site/data/products.json`).
* For checkout, ensure the browser loads the correct Square application ID and that the Vercel project has `SQUARE_ACCESS_TOKEN`, `SQUARE_LOCATION_ID`, and `SQUARE_ENV` configured before attempting a live charge.
