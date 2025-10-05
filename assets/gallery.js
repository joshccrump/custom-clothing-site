
// Gallery/Shop data loader with robust GitHub Pages base-path detection
async function fetchWithFallback(urls) {
  const tried = new Set();
  for (const u of urls) {
    if (!u || tried.has(u)) continue;
    tried.add(u);
    try {
      const res = await fetch(u, { cache: 'no-store' });
      if (res.ok) return await res.json();
    } catch (_) {}
  }
  throw new Error('products.json not found at: ' + Array.from(tried).join(', '));
}

function computeBasePath() {
  try {
    const host = location.hostname.toLowerCase();
    const parts = location.pathname.split('/').filter(Boolean);
    // e.g. https://username.github.io/custom-clothing-site/...
    if (host.endsWith('github.io') && parts.length) return '/' + parts[0] + '/';
  } catch (_) {}
  return '/';
}

async function loadProducts() {
  const BASE = computeBasePath();
  const candidates = [
    BASE + 'data/products.json',
    // common alternates if file was placed relative
    'data/products.json',
    '../data/products.json',
    '/data/products.json'
  ];
  return await fetchWithFallback(candidates);
}

function fmt(n, c = 'USD') {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: c }).format(n);
  } catch {
    return '$' + Number(n).toFixed(2);
  }
}
function uniq(a) { return [...new Set((a || []).filter(Boolean))]; }
function paginate(list, p, per) {
  const pages = Math.max(1, Math.ceil(list.length / per));
  const P = Math.min(Math.max(1, p), pages);
  return { page: P, pages, items: list.slice((P - 1) * per, (P - 1) * per + per) };
}
function filterProducts(ps, s) {
  const q = (s.q || '').toLowerCase().trim();
  const cat = (s.category || '').toLowerCase();
  const size = (s.size || '').toLowerCase();
  let out = ps.filter(p => {
    if (p.status && p.status.toLowerCase() === 'hidden') return false;
    const text = [p.title, p.description, p.category, ...(p.tags || []), ...(p.sizes || [])]
      .join(' ').toLowerCase();
    const textOk = q ? text.includes(q) : true;
    const catOk = cat ? ((p.category || '').toLowerCase() === cat) : true;
    const sizeOk = size ? ((p.sizes || []).map(s => String(s).toLowerCase()).includes(size)) : true;
    return textOk && catOk && sizeOk;
  });
  if (s.sort === 'price-asc') out.sort((a, b) => (a.price_min ?? a.price ?? 0) - (b.price_min ?? b.price ?? 0));
  else if (s.sort === 'price-desc') out.sort((a, b) => (b.price_max ?? b.price ?? 0) - (a.price_max ?? a.price ?? 0));
  else if (s.sort === 'newest') out.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  return out;
}
function renderGrid(container, items) {
  container.innerHTML = '';
  if (!items.length) { container.innerHTML = '<div class="subtle">No items match your filters.</div>'; return; }
  for (const p of items) {
    const cur = p.currency || 'USD';
    const hasVars = Array.isArray(p.variations) && p.variations.length > 0;
    const priceLine = hasVars
      ? ((p.price_min === p.price_max) ? fmt(p.price_min, cur) : `${fmt(p.price_min, cur)} – ${fmt(p.price_max, cur)}`)
      : (typeof p.price === 'number' ? fmt(p.price, cur) : '');
    const oos = Number(p.stock || 0) === 0;
    const badges = [];
    if (oos) badges.push('<span class="badge out">Out of stock</span>');
    if ((p.tags || []).includes('best-seller')) badges.push('<span class="badge">Best Seller</span>');
    const sizes = (p.sizes || []).slice(0, 6).map(s => `<span class="size">${s}</span>`).join('');
    const actions = p.url ? `<a class='btn btn--buy' target='_blank' rel='noopener' href='${p.url}'>View</a>` : '';
    const el = document.createElement('article');
    el.className = 'card';
    el.innerHTML = `
      <div class='card__media'>
        <img class='card__img' alt='${p.title || 'Product'}' src='${p.thumbnail || '../assets/default-product.svg'}'>
        ${badges.join('')}
      </div>
      <div class='card__body'>
        <h3 class='title'>${p.title || 'Untitled'}</h3>
        <div class='price'>${priceLine}</div>
        ${sizes ? `<div class='sizes'>${sizes}</div>` : ''}
        <div class='card__actions'>${actions}</div>
      </div>`;
    container.appendChild(el);
  }
}

document.addEventListener('DOMContentLoaded', async function () {
  const state = { q: '', category: '', size: '', sort: 'featured', page: 1, per: 12 };
  const grid = document.getElementById('grid');
  const pager = document.getElementById('pager');
  const searchEl = document.getElementById('search');
  const catEl = document.getElementById('category');
  const sizeEl = document.getElementById('size');
  const sortEl = document.getElementById('sort');
  let products = [];
  try {
    products = await loadProducts();
  } catch (e) {
    console.error(e);
    grid.innerHTML = '<div class="subtle">Could not load products. Make sure <code>data/products.json</code> exists where your site is served.</div>';
    return;
  }
  const cats = uniq(products.map(p => p.category));
  catEl.innerHTML = '<option value=\"\">All categories</option>' + cats.map(c => `<option>${c}</option>`).join('');
  const sizes = uniq(products.flatMap(p => p.sizes || []));
  sizeEl.innerHTML = '<option value=\"\">Any size</option>' + sizes.map(v => `<option>${v}</option>`).join('');
  function render() {
    const filtered = filterProducts(products, state);
    const { page, pages, items } = paginate(filtered, state.page, state.per);
    renderGrid(grid, items);
    pager.innerHTML = '';
    const prev = document.createElement('button'); prev.textContent = 'Prev'; prev.disabled = (page <= 1); prev.onclick = () => { state.page = Math.max(1, page - 1); render(); };
    const info = document.createElement('span'); info.style.padding = '8px 6px'; info.className = 'subtle'; info.textContent = `Page ${page} of ${pages}`;
    const next = document.createElement('button'); next.textContent = 'Next'; next.disabled = (page >= pages); next.onclick = () => { state.page = Math.min(pages, page + 1); render(); };
    pager.append(prev, info, next);
  }
  searchEl.oninput = () => { state.q = searchEl.value.trim(); state.page = 1; render(); };
  catEl.onchange = () => { state.category = catEl.value.trim(); state.page = 1; render(); };
  sizeEl.onchange = () => { state.size = sizeEl.value.trim(); state.page = 1; render(); };
  sortEl.onchange = () => { state.sort = sortEl.value.trim(); state.page = 1; render(); };
  render();
});
