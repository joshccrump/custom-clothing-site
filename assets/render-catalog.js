/* assets/render-catalog.js
   Drop-in renderer for Shop + Gallery pages.
   - Fetches from window.Site.catalogUrl() (falls back to 'data/products.json' if missing)
   - Accepts two shapes:
       A) { items: [ { id, name, description, variations:[{price,currency,name,sku}], ... } ] }
       B) Square raw: { objects: [ { type:'ITEM', itemData:{ name, description, variations:[{ itemVariationData:{ priceMoney, name, sku } }] } } ] }
   - Renders into any element with [data-products], defaulting to #catalog-grid if present.
*/
(function(){
  function $(sel){ return document.querySelector(sel); }
  function $all(sel){ return Array.prototype.slice.call(document.querySelectorAll(sel)); }
  function money(cents, currency){
    if (typeof cents !== 'number') return '';
    var v = (cents/100).toFixed(2);
    return (currency || 'USD') + ' ' + v;
  }
  function mapFromSquare(objects){
    var items = [];
    (objects||[]).forEach(function(o){
      if (o && o.type === 'ITEM' && o.itemData){
        var mapped = {
          id: o.id,
          name: o.itemData.name || '(unnamed)',
          description: o.itemData.description || '',
          variations: (o.itemData.variations||[]).map(function(v){
            var d = v.itemVariationData || {};
            var m = d.priceMoney || {};
            return { id: v.id, name: d.name||'', price: typeof m.amount==='number'? m.amount : null, currency: m.currency||'USD', sku: d.sku||null };
          })
        };
        items.push(mapped);
      }
    });
    return { items: items, count: items.length };
  }
  function normalize(json){
    if (json && Array.isArray(json.items)) {
      return { items: json.items, count: json.items.length };
    }
    if (json && Array.isArray(json.objects)) {
      return mapFromSquare(json.objects);
    }
    // Unknown shape → return empty
    return { items: [], count: 0 };
  }
  function cardHTML(item){
    var price = '';
    if (item.variations && item.variations.length){
      var v0 = item.variations[0];
      if (typeof v0.price === 'number') price = money(v0.price, v0.currency);
    }
    var desc = item.description ? ('<p class="small text-muted">'+escapeHTML(item.description)+'</p>') : '';
    return (
      '<div class="col">'+
        '<div class="card h-100">'+
          '<div class="card-body">'+
            '<h5 class="card-title">'+escapeHTML(item.name)+'</h5>'+
             desc +
            (price ? '<div class="fw-semibold">'+price+'</div>' : '')+
          '</div>'+
        '</div>'+
      '</div>'
    );
  }
  function escapeHTML(s){ return String(s).replace(/[&<>"]/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]); }); }

  function ensureContainer(){
    // Prefer explicit data-products container
    var el = document.querySelector('[data-products]');
    if (el) return el;
    // Fallback to #catalog-grid if exists
    el = document.getElementById('catalog-grid');
    if (el) return el;
    // Create a simple container in main content
    var host = document.querySelector('main, .container, body');
    var div = document.createElement('div');
    div.id = 'catalog-grid';
    div.setAttribute('data-products','');
    div.className = 'row row-cols-1 row-cols-sm-2 row-cols-md-3 g-4';
    host.appendChild(div);
    return div;
  }

  function render(data){
    var into = ensureContainer();
    if (!data.items || !data.items.length){
      into.innerHTML = '<div class="alert alert-warning">No products found in <code>data/products.json</code>.</div>';
      return;
    }
    into.innerHTML = data.items.map(cardHTML).join('');
  }

  function fetchUrl(){
    try {
      if (window.Site && typeof window.Site.catalogUrl === 'function') return window.Site.catalogUrl();
    } catch(e){}
    return 'data/products.json';
  }

  // Kick off
  (async function(){
    var url = fetchUrl();
    try {
      var res = await fetch(url, { cache: 'no-store' });
      var txt = await res.text();
      var json; try { json = JSON.parse(txt); } catch(e){ json = {}; }
      var data = normalize(json);
      render(data);
      // Expose for debugging
      window.__CATALOG_DEBUG__ = { url, status: res.status, data };
      console.log('[render-catalog] url=', url, 'status=', res.status, data);
    } catch (e){
      console.error('[render-catalog] fetch failed', e);
      ensureContainer().innerHTML = '<div class="alert alert-danger">Failed to load products: '+(e.message||e)+'</div>';
    }
  })();
})();