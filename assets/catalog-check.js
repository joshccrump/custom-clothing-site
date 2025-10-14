/* assets/catalog-check.js
   Adds a tiny banner and logs detailed info about the catalog fetch.
   Include AFTER base-path.js on pages that render products (shop, gallery).
*/
(function () {
  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text) e.textContent = text;
    return e;
  }
  function banner() {
    var b = el('div', { id: 'catalog-debug', style: 'position:fixed;bottom:12px;left:12px;background:#111;color:#fff;padding:8px 10px;border-radius:8px;font:12px/1.3 system-ui;z-index:99999;opacity:.9' });
    b.appendChild(el('strong', null, 'Catalog Debug: '));
    b.appendChild(el('span', { id: 'catalog-debug-text' }, 'Starting…'));
    document.body.appendChild(b);
    return b.querySelector('#catalog-debug-text');
  }
  var out = banner();
  var url = (window.Site && window.Site.catalogUrl) ? window.Site.catalogUrl() : 'data/products.json';
  out.textContent = 'Fetching ' + url;

  fetch(url, { cache: 'no-store' }).then(function (res) {
    out.textContent = 'HTTP ' + res.status + ' → ' + url;
    return res.text().then(function (txt) {
      try {
        var data = JSON.parse(txt);
        var count = (data && Array.isArray(data.items)) ? data.items.length : 0;
        console.log('[catalog-check] Parsed JSON:', data);
        out.textContent += ' | items=' + count;
        if (!Array.isArray(data.items)) {
          out.textContent += ' | unexpected JSON shape (missing items[])';
        }
      } catch (e) {
        console.error('[catalog-check] JSON parse error:', e);
        out.textContent += ' | JSON parse error';
      }
    });
  }).catch(function (err) {
    console.error('[catalog-check] Fetch error:', err);
    out.textContent = 'Fetch failed: ' + (err && err.message ? err.message : String(err));
  });
})();