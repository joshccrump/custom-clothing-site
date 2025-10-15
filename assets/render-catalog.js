/* assets/render-catalog.js
   Self-contained renderer for Shop & Gallery.
   - Fetches from window.Site.catalogUrl() (falls back to 'data/products.json')
   - Supports either { items: [...] } or Square raw { objects: [...] } shapes
   - Renders Bootstrap cards into #catalog-grid or [data-products]
*/
(function(){
  function money(cents, currency){
    if (typeof cents !== 'number') return '';
    return (currency || 'USD') + ' ' + (cents/100).toFixed(2);
  }
  function esc(s){ return String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

  function fromSquare(objects){
    const items = [];
    (objects||[]).forEach(o=>{
      if(!o || o.type!=='ITEM' || !o.itemData) return;
      items.push({
        id:o.id,
        name:o.itemData.name || '(unnamed)',
        description:o.itemData.description || '',
        variations:(o.itemData.variations||[]).map(v=>{
          const d=v.itemVariationData||{}, m=d.priceMoney||{};
          return { id:v.id, name:d.name||'', price: (typeof m.amount==='number'? m.amount:null), currency:m.currency||'USD', sku:d.sku||null };
        })
      });
    });
    return { items, count: items.length };
  }

  function normalize(json){
    if (json && Array.isArray(json.items)) return { items: json.items, count: json.items.length };
    if (json && Array.isArray(json.objects)) return fromSquare(json.objects);
    return { items: [], count: 0 };
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

  function cardHTML(item){
    let price = '';
    if (item.variations && item.variations.length){
      const v0 = item.variations[0];
      if (typeof v0.price === 'number') price = money(v0.price, v0.currency);
    }
    const desc = item.description ? '<p class="small text-muted">'+esc(item.description)+'</p>' : '';
    return '<div class="col"><div class="card h-100"><div class="card-body">'
      + '<h5 class="card-title">'+esc(item.name)+'</h5>'
      + desc
      + (price ? '<div class="fw-semibold">'+price+'</div>' : '')
      + '</div></div></div>';
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
        into.innerHTML = data.items.map(cardHTML).join('');
      }
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