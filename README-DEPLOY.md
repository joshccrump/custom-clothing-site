# Deploying the Serverless API (Vercel)

1) Create a new Vercel project and upload the `serverless-vercel/` folder.
2) Add Environment Variables:
   - SQUARE_ACCESS_TOKEN = your Production access token
   - SQUARE_ENV = production
   - SQUARE_LOCATION_ID = your location id
   - BACKORDER_OK = true   (set to false to block when qty < requested)
3) Deploy. Endpoints:
   - POST https://YOUR-APP.vercel.app/api/checkout
   - GET  https://YOUR-APP.vercel.app/api/inventory?ids=VARIATION_ID,VARIATION_ID2

4) In your GitHub Pages repo, set in `web/checkout.html`:
   - SQUARE_APPLICATION_ID, SQUARE_LOCATION_ID, API_BASE (your Vercel URL)

5) Drag the files from `web/` into your repo (root or `/docs`). Ensure:
   - `checkout.html` + `thank-you.html` sit alongside your index.html
   - Replace `assets/gallery.js` with the provided one.
