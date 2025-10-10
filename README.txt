Drag-and-drop bundle for GitHub Pages

1) Copy everything to your repo root (overwrite if prompted) and commit to main.
2) Visit: https://joshccrump.github.io/custom-clothing-site/

Includes
- index.html, shop.html, gallery/index.html, clients/index.html
- cart.html → checkout.html (Square Web Payments)
- assets/gallery.js, assets/cart.js, assets/nav-cart.js
- data/products.json (template — replace with real Square IDs/prices)

Important
- Script tags use absolute project paths: /custom-clothing-site/assets/...
- Gallery/Shop read: /custom-clothing-site/data/products.json

Checkout wiring (Vercel)
- In checkout.html set window.SQUARE_APPLICATION_ID, window.SQUARE_LOCATION_ID, window.API_BASE
- In cart.html, meta[name=api-base] should be your deployed Vercel URL (if using live hydration)

If items don't show
- Open /custom-clothing-site/data/products.json in your browser — it must not 404 and must contain an array.
- Confirm gallery/index.html and shop.html include /custom-clothing-site/assets/gallery.js and have <div id="grid"></div>.
