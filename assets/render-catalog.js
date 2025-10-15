/* assets/render-catalog.js
   Self-contained renderer for Shop & Gallery.
   - Fetches from window.Site.catalogUrl() (falls back to 'data/products.json')
   - Supports array payloads, { items: [...] } payloads, and raw Square { objects: [...] }
   - Renders cards with optional images, price ranges, and description HTML
*/
(function(){
  const HTML_REGEX = /<\/?[a-z][^>]*>/i;

  function money(amount, currency){
    if (typeof amount !== 'number' || !Number.isFinite(amount)) return '';
    try {
      return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(amount);
    } catch (err) {
      const unit = currency || 'USD';
      return unit + ' ' + amount.toFixed(2);
    }
  }

  function moneyFromSquare(moneyLike){
    if (!moneyLike) return null;
    const raw = typeof moneyLike.amount === 'number' ? moneyLike.amount : Number(moneyLike.amount);
    if (!Number.isFinite(raw)) return null;
    const scale = typeof moneyLike.decimalPlaces === 'number' ? Math.pow(10, moneyLike.decimalPlaces) : 100;
    return raw / scale;
  }

  function fromSquare(objects){
    const items = [];
    const imageMap = new Map();

    (objects || []).forEach((obj) => {
      if (!obj) return;
      if (obj.type === 'IMAGE' && obj.imageData?.url) {
        imageMap.set(obj.id, obj.imageData.url);
      }
    });

    (objects || []).forEach((obj) => {
      if (!obj || obj.type !== 'ITEM' || !obj.itemData) return;
      const data = obj.itemData;
      const variations = [];
      for (const variation of data.variations || []) {
        const vd = variation?.itemVariationData || {};
        const price = moneyFromSquare(vd.priceMoney);
        variations.push({
          id: variation.id,
          name: vd.name || variation.name || '',
          price,
          currency: vd.priceMoney?.currency || variation.currency || data.currency || 'USD',
          sku: vd.sku || variation.sku || null
        });
      }
      const variationPrices = variations.map((v) => v.price).filter((n) => typeof n === 'number' && Number.isFinite(n));
      if (!variationPrices.length) return;

      const imageId = Array.isArray(data.imageIds) ? data.imageIds[0] : null;
      const thumbnail = imageId ? imageMap.get(imageId) || null : null;

      items.push({
        id: obj.id,
        title: data.name || '(unnamed)',
        description: data.descriptionHtml || data.description || '',
        description_html: data.descriptionHtml || null,
        thumbnail,
        currency: variations.find((v) => v.currency)?.currency || 'USD',
        price_min: Math.min.apply(null, variationPrices),
        price_max: Math.max.apply(null, variationPrices),
        variations
      });
    });

    return items;
  }

  function toArray(value){
    if (Array.isArray(value)) return value;
    return [];
  }

  function firstString(...values){
    for (const value of values){
      if (typeof value === 'string' && value.trim()) return value;
    }
    return '';
  }

  function normalizeVariation(variation, fallbackCurrency){
    if (!variation || typeof variation !== 'object') return null;
    const data = variation.itemVariationData || variation;
    const price =
      moneyFromSquare(data.priceMoney) ??
      moneyFromSquare(variation.priceMoney) ??
      (typeof variation.price_cents === 'number' ? variation.price_cents / 100 : null) ??
      (typeof data.price_cents === 'number' ? data.price_cents / 100 : null) ??
      (typeof variation.price === 'number' ? variation.price : null) ??
      (typeof data.price === 'number' ? data.price : null);

    const currency =
      data.priceMoney?.currency ||
      variation.priceMoney?.currency ||
      variation.currency ||
      data.currency ||
      fallbackCurrency ||
      'USD';

    return {
      id: variation.id || data.id || null,
      name: variation.name || data.name || 'Variation',
      price,
      currency
    };
  }

  function extractVariations(item){
    const direct = toArray(item.variations).map((variation) => normalizeVariation(variation, item.currency));
    const embedded = toArray(item.itemData?.variations).map((variation) => normalizeVariation(variation, item.currency));
    const all = direct.concat(embedded).filter(Boolean);
    return all;
  }

  function normalizeItem(raw){
    if (!raw || typeof raw !== 'object') return null;

    const name = firstString(raw.title, raw.name, raw.itemData?.name, '(unnamed)');
    const variations = extractVariations(raw);

    let priceMin = typeof raw.price_min === 'number' ? raw.price_min : null;
    let priceMax = typeof raw.price_max === 'number' ? raw.price_max : null;
    const variationPrices = variations
      .map((v) => (typeof v.price === 'number' && Number.isFinite(v.price) ? v.price : null))
      .filter((v) => v != null);
    if (!variationPrices.length && typeof raw.price === 'number') {
      variationPrices.push(raw.price);
    }
    if (variationPrices.length) {
      if (priceMin == null) priceMin = Math.min.apply(null, variationPrices);
      if (priceMax == null) priceMax = Math.max.apply(null, variationPrices);
    }

    const currency = raw.currency || variations.find((v) => v.currency)?.currency || 'USD';
    const descriptionSource = firstString(raw.description_html, raw.descriptionHtml, raw.description);
    const descriptionHtml = raw.description_html || raw.descriptionHtml || (HTML_REGEX.test(descriptionSource) ? descriptionSource : '');
    const descriptionText = descriptionHtml ? '' : descriptionSource;

    return {
      id: raw.id || null,
      name,
      descriptionHtml: descriptionHtml || null,
      description: descriptionText || '',
      thumbnail: raw.thumbnail || raw.image || raw.imageUrl || raw.image_url || null,
      url: raw.url || raw.product_url || raw.link || null,
      priceMin: priceMin,
      priceMax: priceMax,
      currency,
      variations
    };
  }

  function normalize(json){
    let rawItems = [];
    if (json && Array.isArray(json.objects)) {
      rawItems = fromSquare(json.objects);
    } else if (json && Array.isArray(json.items)) {
      rawItems = json.items;
    } else if (Array.isArray(json)) {
      rawItems = json;
    }

    const items = rawItems.map(normalizeItem).filter(Boolean);
    return { items, count: items.length };
  }

  function ensureContainer(){
    let el = document.querySelector('[data-products]') || document.getElementById('catalog-grid');
    if (el) return el;
    const host = document.querySelector('main, .container, body');
    el = document.createElement('div');
    el.id = 'catalog-grid';
    el.setAttribute('data-products','');
    el.className = 'row row-cols-1 row-cols-sm-2 row-cols-md-3 g-4';
    host.appendChild(el);
    return el;
  }

  function renderPrice(item){
    const { priceMin, priceMax, currency } = item;
    if (typeof priceMin === 'number' && typeof priceMax === 'number') {
      if (priceMin === priceMax) return money(priceMin, currency);
      return money(priceMin, currency) + ' – ' + money(priceMax, currency);
    }
    if (typeof priceMin === 'number') return money(priceMin, currency);
    if (typeof priceMax === 'number') return money(priceMax, currency);
    return '';
  }

  function createCard(item){
    const col = document.createElement('div');
    col.className = 'col';

    const card = document.createElement('div');
    card.className = 'card h-100';
    col.appendChild(card);

    if (item.thumbnail) {
      const img = document.createElement('img');
      img.className = 'card-img-top';
      img.loading = 'lazy';
      img.alt = item.name || 'Product';
      img.src = item.thumbnail;
      card.appendChild(img);
    }

    const body = document.createElement('div');
    body.className = 'card-body';
    card.appendChild(body);

    const heading = document.createElement('h5');
    heading.className = 'card-title';
    if (item.url) {
      const link = document.createElement('a');
      link.href = item.url;
      link.textContent = item.name;
      link.rel = 'noopener';
      link.target = item.url.startsWith('http') ? '_blank' : '_self';
      heading.appendChild(link);
    } else {
      heading.textContent = item.name;
    }
    body.appendChild(heading);

    if (item.descriptionHtml || item.description) {
      const desc = document.createElement('div');
      desc.className = 'small text-muted';
      if (item.descriptionHtml) {
        desc.innerHTML = item.descriptionHtml;
      } else {
        desc.textContent = item.description;
      }
      body.appendChild(desc);
    }

    const priceLabel = renderPrice(item);
    if (priceLabel) {
      const price = document.createElement('div');
      price.className = 'fw-semibold';
      price.textContent = priceLabel;
      body.appendChild(price);
    }

    return col;
  }

  async function run(){
    const url = (window.Site && typeof window.Site.catalogUrl==='function') ? window.Site.catalogUrl() : 'data/products.json';
    const into = ensureContainer();
    try{
      const res = await fetch(url, { cache:'no-store' });
      const txt = await res.text();
      let json; try{ json = JSON.parse(txt); } catch{ json = {}; }
      const data = normalize(json);
      if (!data.items.length){
        into.innerHTML = '<div class="alert alert-warning">No products found in <code>'+url+'</code>.</div>';
      } else {
        into.innerHTML = '';
        const frag = document.createDocumentFragment();
        data.items.forEach((item) => frag.appendChild(createCard(item)));
        into.appendChild(frag);
      }
      // quick debug handle (check in DevTools Console)
      window.__CATALOG_DEBUG__ = { url, status: res.status, data };
      console.log('[render-catalog]', window.__CATALOG_DEBUG__);
    }catch(e){
      into.innerHTML = '<div class="alert alert-danger">Failed to load products: '+(e && e.message ? e.message : e)+'</div>';
      console.error(e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else { run(); }
})();
