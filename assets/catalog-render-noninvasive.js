/* assets/catalog-render-noninvasive.js */
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

  function findTarget(){
    return document.querySelector('[data-products]') || document.getElementById('catalog-grid') || null;
  }

  async function run(){
    const into = findTarget();
    if (!into) return; // no change to layout
    const url = (window.Site && typeof window.Site.catalogUrl==='function') ? window.Site.catalogUrl() : 'data/products.json';
    try{
      const res = await fetch(url, { cache:'no-store' });
      const txt = await res.text();
      let json; try{ json = JSON.parse(txt); } catch{ json = {}; }
      const data = normalize(json);
      if (!data.items.length){
        window.__CATALOG_DEBUG__ = { url, status: res.status, data };
        console.warn('[catalog-render-noninvasive] No items in', url);
        return;
      }
      into.innerHTML = data.items.map(function(item){
        let price = '';
        if (item.variations && item.variations.length){
          const v0 = item.variations[0];
          if (typeof v0.price === 'number') price = (v0.price/100).toFixed(2) + ' ' + (v0.currency||'USD');
        }
        return '<div class="product-card">'
             +   '<div class="product-title">'+esc(item.name)+'</div>'
             +   (item.description ? '<div class="product-desc">'+esc(item.description)+'</div>' : '')
             +   (price ? '<div class="product-price">'+esc(price)+'</div>' : '')
             + '</div>';
      }).join('');
      window.__CATALOG_DEBUG__ = { url, status: res.status, data };
      console.log('[catalog-render-noninvasive]', window.__CATALOG_DEBUG__);
    }catch(e){
      window.__CATALOG_DEBUG__ = { url, error: String(e) };
      console.error('[catalog-render-noninvasive] fetch failed', e);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else { run(); }
})();