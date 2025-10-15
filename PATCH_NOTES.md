# Products Render Fix (upload-ready)

This adds a renderer that fetches your catalog JSON correctly on a GitHub Pages *project site* and renders it on both **Shop** and **Gallery** pages.

## Files to upload (exact paths)
- `assets/base-path.js`
- `assets/render-catalog.js`

## Edit two pages

### A) shop.html
Add these two tags **before `</body>`** (or anywhere after the `<head>`):
```html
<script src="assets/base-path.js"></script>
<script src="assets/render-catalog.js"></script>
```

Ensure there’s a container (add if missing):
```html
<div id="catalog-grid" class="row row-cols-1 row-cols-sm-2 row-cols-md-3 g-4" data-products></div>
```

### B) gallery/index.html
If the file is inside `/gallery/`, use the same *relative* script paths and add (if missing) a grid container:
```html
<script src="../assets/base-path.js"></script>
<script src="../assets/render-catalog.js"></script>

<div id="catalog-grid" class="row row-cols-1 row-cols-sm-2 row-cols-md-3 g-4" data-products></div>
```
> If you prefer not to change relative paths, you can place both `<script>` tags in the `<head>` of your layout and keep the paths as `assets/...`—that also works.

## Verify
1) Visit your Shop and Gallery pages.
2) Open DevTools → Console and run: `window.__CATALOG_DEBUG__`
   You should see `{ url: '.../custom-clothing-site/data/products.json', status: 200, data: { items: [...], count: N } }`
3) You should see product cards rendered. If `items` is empty but your JSON has `objects`, the script maps the Square shape automatically.

