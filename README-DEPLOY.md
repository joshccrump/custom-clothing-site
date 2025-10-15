# Deploying the Serverless API (Vercel)

1) Create a new Vercel project and upload the `serverless-vercel/` folder. In
   the project settings (or a checked-in `vercel.json`), pin your default
   Function runtime to `@vercel/node@3.1.4` so Vercel uses the current Node 20
   builders without raising the legacy "Function Runtimes must have a valid
   version" error. Also set **Project Settings → General → Node.js Version** to
   `20.x`; Vercel defaults to `22.x` for new projects, which will make the build
   fail before the runtime builder is installed.
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
