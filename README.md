
# Custom Clothing Starter Site (Static Bundle)

This bundle gives you a clean, modern starter you can **upload anywhere** (Netlify, Vercel, GitHub Pages, Hugging Face Spaces Static) **or** paste into **Squarespace/Shopify** with minimal work.

## Files
- `index.html` — Homepage (hero, featured, how it works, portfolio, newsletter callout)
- `shop.html` — Simple shop grid
- `product.html` — Product template with personalization fields + size chart modal
- `portal.html` — Client portal demo with a simple password gate (`sample123` – replace this)
- `assets/style.css` — Minimal, dark, modern styling
- `assets/main.js` — Tabs, size chart modal, simple portal password
- `content/copy.md` — All core copy blocks ready to paste into your platform

## Quick Start (Static Hosting)
1. Upload the folder to Netlify (drag & drop) or Vercel.
2. Or create a **Hugging Face Space (Static)** and set:
   - Build command: *(none)*
   - App file: `index.html`

## Shopify
- Use this bundle as a **visual reference**. Recreate sections in your theme customizer.
- Add personalization using an app (e.g., **Infinite Options**, **Product Personalizer**, or **Uploadery**).
- Client portals: use an access control app (e.g., **Locksmith**) to lock collections/pages.

## Squarespace
- Create pages to mirror: Home, Shop, Product template, Client Portal, About, Contact.
- Use **Password Protected** page for each **Client Portal**.
- Add personalization fields via **Form Block** on the product page.
- Paste copy from `content/copy.md`. Use **Code Block** if you want to embed any custom HTML snippets.

## WooCommerce
- Use the **Product Add-Ons** plugin (or similar) for name/number/fonts/uploads.
- Use the **Square** plugin if you want Square for online + POS.
- Client portals via **membership/restriction** plugins.

## Customize
- Replace placeholder images in `/images`.
- Update colors in `assets/style.css`.
- Replace demo password in `portal.html` and implement real authentication on your platform.

## Notes
This is a static demo. Carts/checkout are not wired; connect your platform’s native checkout.
