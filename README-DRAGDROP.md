# Drag & Drop Update

This bundle includes:
- Theme bundle (crump preset on)
- Site-wide navigation on **every page**
- Multi-client portals (`/clients/`, passcode optional)
- Gallery (`/gallery/`) + quick view
- Restored **About**, **Contact**, **Shop** pages

## How to deploy
1. Download the ZIP and unzip.
2. In your GitHub repo:
   - If Pages source is **root**: upload everything to the repo root.
   - If Pages source is **/docs**: upload everything **inside** a `docs/` folder.
   - Keep your existing `CNAME` if you use a custom domain.
3. Commit the changes.

## Customize
- `data/clients.json` — add your clients. For passcode: set `passcodeHash` to a SHA-256 of your passcode.
- `data/products.json` — add items, images, sizes, and your Square/checkout links.
- `contact.html` — change the mailto address to your real inbox.
- Navigation brand text: edit the `data-brand` on `<script src="assets/site-nav.js">`.

