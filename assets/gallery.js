diff --git a/assets/gallery.js b/assets/gallery.js
index 778fa00bfb3c4fba09739f08a9399deee00d1913..17b14d6cac456724d60581707647aa9ed3f94c43 100644
--- a/assets/gallery.js
+++ b/assets/gallery.js
@@ -1 +1,245 @@
-(function(){console.log('gallery.js loaded')})();
+// Gallery/Shop script that loads Square-synced products from data/products.json
+async function fetchWithFallback(urls) {
+  const tried = new Set();
+  for (const url of urls) {
+    if (!url || tried.has(url)) continue;
+    tried.add(url);
+    try {
+      const res = await fetch(url, { cache: 'no-store' });
+      if (res.ok) return await res.json();
+    } catch (err) {
+      console.warn('Failed to load', url, err);
+    }
+  }
+  throw new Error('products.json not found at: ' + Array.from(tried).join(', '));
+}
+
+function computeBasePath() {
+  try {
+    const host = location.hostname.toLowerCase();
+    const parts = location.pathname.split('/').filter(Boolean);
+    if (host.endsWith('github.io') && parts.length) {
+      return '/' + parts[0] + '/';
+    }
+  } catch (_) {}
+  return '/';
+}
+
+async function loadProducts() {
+  const BASE = computeBasePath();
+  const candidates = [
+    BASE + 'data/products.json',
+    'data/products.json',
+    '../data/products.json',
+    '/data/products.json'
+  ];
+  return await fetchWithFallback(candidates);
+}
+
+function fmt(n, currency = 'USD') {
+  try {
+    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(n);
+  } catch {
+    return '$' + Number(n).toFixed(2);
+  }
+}
+
+function uniq(values) {
+  return [...new Set((values || []).filter(Boolean))];
+}
+
+function paginate(list, page, perPage) {
+  const pages = Math.max(1, Math.ceil(list.length / perPage));
+  const safePage = Math.min(Math.max(1, page), pages);
+  return {
+    page: safePage,
+    pages,
+    items: list.slice((safePage - 1) * perPage, (safePage - 1) * perPage + perPage)
+  };
+}
+
+function filterProducts(products, state) {
+  const query = (state.q || '').toLowerCase().trim();
+  const category = (state.category || '').toLowerCase();
+  const size = (state.size || '').toLowerCase();
+  let out = products.filter(product => {
+    if (product.status && product.status.toLowerCase() === 'hidden') return false;
+    const haystack = [
+      product.title,
+      product.description,
+      product.category,
+      ...(product.tags || []),
+      ...(product.sizes || [])
+    ].join(' ').toLowerCase();
+    const matchesQuery = query ? haystack.includes(query) : true;
+    const matchesCategory = category ? ((product.category || '').toLowerCase() === category) : true;
+    const matchesSize = size ? ((product.sizes || []).map(v => String(v).toLowerCase()).includes(size)) : true;
+    return matchesQuery && matchesCategory && matchesSize;
+  });
+  if (state.sort === 'price-asc') {
+    out.sort((a, b) => (a.price_min ?? a.price ?? 0) - (b.price_min ?? b.price ?? 0));
+  } else if (state.sort === 'price-desc') {
+    out.sort((a, b) => (b.price_max ?? b.price ?? 0) - (a.price_max ?? a.price ?? 0));
+  } else if (state.sort === 'newest') {
+    out.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
+  }
+  return out;
+}
+
+function baseCheckout() {
+  const host = location.hostname.toLowerCase();
+  const parts = location.pathname.split('/').filter(Boolean);
+  if (host.endsWith('github.io') && parts.length) {
+    return '/' + parts[0] + '/';
+  }
+  return '/';
+}
+
+function renderGrid(container, items) {
+  container.innerHTML = '';
+  if (!items.length) {
+    container.innerHTML = '<div class="subtle">No items match your filters.</div>';
+    return;
+  }
+  const BASE = baseCheckout();
+  for (const product of items) {
+    const currency = product.currency || 'USD';
+    const variations = Array.isArray(product.variations)
+      ? product.variations.filter(v => v && v.id)
+      : [];
+    const hasVariations = variations.length > 0;
+    const priceLine = hasVariations
+      ? ((product.price_min === product.price_max)
+        ? fmt(product.price_min, currency)
+        : `${fmt(product.price_min, currency)} – ${fmt(product.price_max, currency)}`)
+      : (typeof product.price === 'number' ? fmt(product.price, currency) : '');
+    const outOfStock = typeof product.stock === 'number' ? Number(product.stock) === 0 : false;
+    const badges = [];
+    if (outOfStock) badges.push('<span class="badge out">Out of stock</span>');
+    if ((product.tags || []).includes('best-seller')) badges.push('<span class="badge">Best Seller</span>');
+    const sizes = (product.sizes || []).slice(0, 6).map(size => `<span class="size">${size}</span>`).join('');
+    const article = document.createElement('article');
+    article.className = 'card';
+    article.innerHTML = `
+      <div class='card__media'>
+        <img class='card__img' alt='${product.title || 'Product'}' src='${product.thumbnail || '../assets/default-product.svg'}'>
+        ${badges.join('')}
+      </div>
+      <div class='card__body'>
+        <h3 class='title'>${product.title || 'Untitled'}</h3>
+        <div class='price'>${priceLine}</div>
+        ${sizes ? `<div class='sizes'>${sizes}</div>` : ''}
+        <div class='card__actions'></div>
+      </div>`;
+    const actions = article.querySelector('.card__actions');
+    let select;
+    if (hasVariations) {
+      select = document.createElement('select');
+      select.setAttribute('data-variation-select', '');
+      select.style.marginRight = '8px';
+      for (const variation of variations) {
+        const option = document.createElement('option');
+        option.value = variation.id;
+        const price = (typeof variation.price === 'number') ? ` — ${fmt(variation.price, currency)}` : '';
+        option.textContent = (variation.name || 'Variation') + price;
+        select.appendChild(option);
+      }
+      actions.appendChild(select);
+    }
+    const buy = document.createElement('a');
+    buy.className = 'btn btn--buy';
+    buy.textContent = 'Buy';
+    function hrefFor(id) {
+      return `${BASE}checkout.html?variationId=${encodeURIComponent(id)}&quantity=1`;
+    }
+    if (variations[0]?.id) {
+      buy.href = hrefFor(variations[0].id);
+      if (select) {
+        select.addEventListener('change', () => {
+          buy.href = hrefFor(select.value);
+        });
+      }
+    } else if (product.url) {
+      buy.href = product.url;
+      buy.target = '_blank';
+      buy.rel = 'noopener';
+      buy.textContent = 'View';
+    } else {
+      buy.href = '#';
+      buy.setAttribute('aria-disabled', 'true');
+      buy.classList.add('is-disabled');
+      buy.style.pointerEvents = 'none';
+      buy.style.opacity = '0.6';
+    }
+    actions.appendChild(buy);
+    container.appendChild(article);
+  }
+}
+
+document.addEventListener('DOMContentLoaded', async function () {
+  const state = { q: '', category: '', size: '', sort: 'featured', page: 1, per: 12 };
+  const grid = document.getElementById('grid');
+  const pager = document.getElementById('pager');
+  const searchEl = document.getElementById('search');
+  const categoryEl = document.getElementById('category');
+  const sizeEl = document.getElementById('size');
+  const sortEl = document.getElementById('sort');
+  let products = [];
+  try {
+    products = await loadProducts();
+  } catch (err) {
+    grid.innerHTML = '<div class="subtle">Could not load products. Check data/products.json path.</div>';
+    console.error(err);
+    return;
+  }
+  const categories = uniq(products.map(product => product.category));
+  categoryEl.innerHTML = '<option value="">All categories</option>' + categories.map(category => `<option>${category}</option>`).join('');
+  const sizes = uniq(products.flatMap(product => product.sizes || []));
+  sizeEl.innerHTML = '<option value="">Any size</option>' + sizes.map(size => `<option>${size}</option>`).join('');
+  function render() {
+    const filtered = filterProducts(products, state);
+    const { page, pages, items } = paginate(filtered, state.page, state.per);
+    renderGrid(grid, items);
+    pager.innerHTML = '';
+    const prev = document.createElement('button');
+    prev.textContent = 'Prev';
+    prev.disabled = page <= 1;
+    prev.onclick = () => {
+      state.page = Math.max(1, page - 1);
+      render();
+    };
+    const info = document.createElement('span');
+    info.style.padding = '8px 6px';
+    info.className = 'subtle';
+    info.textContent = `Page ${page} of ${pages}`;
+    const next = document.createElement('button');
+    next.textContent = 'Next';
+    next.disabled = page >= pages;
+    next.onclick = () => {
+      state.page = Math.min(pages, page + 1);
+      render();
+    };
+    pager.append(prev, info, next);
+  }
+  searchEl.oninput = () => {
+    state.q = searchEl.value.trim();
+    state.page = 1;
+    render();
+  };
+  categoryEl.onchange = () => {
+    state.category = categoryEl.value.trim();
+    state.page = 1;
+    render();
+  };
+  sizeEl.onchange = () => {
+    state.size = sizeEl.value.trim();
+    state.page = 1;
+    render();
+  };
+  sortEl.onchange = () => {
+    state.sort = sortEl.value.trim();
+    state.page = 1;
+    render();
+  };
+  render();
+});
