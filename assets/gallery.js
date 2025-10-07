(function(){
  function basePath() {
    try {
      const host = location.hostname.toLowerCase();
      const parts = location.pathname.split('/').filter(Boolean);
      if (host.endsWith('github.io') && parts.length) return '/' + parts[0] + '/';
    } catch (_) {}
    return '/';
  }
  async function fetchJSON(u){
    const r = await fetch(u, { cache:'no-store' });
    if (!r.ok) throw new Error('HTTP '+r.status+' '+u);
    return r.json();
  }
  async function loadProducts() {
    const BASE = basePath();
    const candidates = [
      BASE + 'data/products.json',
      'data/products.json','../data/products.json','/data/products.json',
      BASE + 'web/data/products.json','web/data/products.json','../web/data/products.json','/web/data/products.json'
    ];
    for (const u of candidates) {
      try { return await fetchJSON(u); } catch (e) {}
    }
    throw new Error('Could not find products.json');
  }
  function fmt(n, c='USD'){ try { return new Intl.NumberFormat(undefined,{style:'currency',currency:c}).format(n); } catch { return '$'+Number(n||0).toFixed(2); } }
  function firstVariationId(p){
    if (Array.isArray(p.variations) && p.variations.length) return p.variations[0].id || p.variations[0].variation_id;
    return p.default_variation_id || p.variation_id || p.variationId || p.square_variation_id || null;
  }
  function renderGrid(container, items) {
    container.innerHTML='';
    if (!items.length) { container.innerHTML='<div class="subtle">No items match your filters.</div>'; return; }
    const BASE = basePath();
    for (const p of items) {
      const cur=p.currency||'USD', hasVars=Array.isArray(p.variations)&&p.variations.length>0;
      const priceLine = hasVars
        ? ((p.price_min===p.price_max)?fmt(p.price_min,cur):`${fmt(p.price_min,cur)} – ${fmt(p.price_max,cur)}`)
        : (typeof p.price==='number'?fmt(p.price,cur):'');

      const el=document.createElement('article'); el.className='card';
      el.innerHTML=`
        <div class='card__media'>
          <img class='card__img' alt='${p.title||'Product'}' src='${p.thumbnail||BASE+'images/placeholder.png'}'>
        </div>
        <div class='card__body'>
          <h3 class='title'>${p.title||'Untitled'}</h3>
          <div class='price'>${priceLine}</div>
          <div class='card__actions'></div>
        </div>`;

      const actions = el.querySelector('.card__actions');
      let select;
      if (hasVars) {
        select=document.createElement('select'); select.setAttribute('data-variation-select',''); select.style.marginRight='8px';
        for (const v of p.variations) {
          const opt=document.createElement('option');
          opt.value=v.id || v.variation_id;
          const price = (typeof v.price==='number')?` — ${fmt(v.price,cur)}`:'';
          opt.textContent=(v.name||'Variation')+price;
          select.appendChild(opt);
        }
        actions.appendChild(select);
      }
      const vid = firstVariationId(p);
      const btn=document.createElement('a'); btn.className='btn btn--buy'; btn.textContent= vid ? 'Buy' : 'View';
      function hrefFor(id){ return `${BASE}cart.html?variationId=${encodeURIComponent(id)}&quantity=1`; }
      btn.href = vid ? hrefFor(vid) : (BASE + 'product.html');
      if (select) select.addEventListener('change',()=>{ btn.href = hrefFor(select.value); });
      actions.appendChild(btn);

      container.appendChild(el);
    }
  }
  function uniq(a){ return [...new Set((a||[]).filter(Boolean))]; }
  function paginate(list, p, per){ const pages=Math.max(1,Math.ceil(list.length/per)); const P=Math.min(Math.max(1,p),pages); return {page:P,pages,items:list.slice((P-1)*per,(P-1)*per+per)};}
  function filterProducts(ps, s) {
    const q=(s.q||'').toLowerCase().trim(), cat=(s.category||'').toLowerCase(), size=(s.size||'').toLowerCase();
    let out=ps.filter(p=>{
      if (p.status && p.status.toLowerCase()==='hidden') return false;
      const text=[p.title,p.description,p.category,...(p.tags||[]),...(p.sizes||[])].join(' ').toLowerCase();
      const textOk=q?text.includes(q):true, catOk=cat?((p.category||'').toLowerCase()===cat):true, sizeOk=size?((p.sizes||[]).map(s=>String(s).toLowerCase()).includes(size)):true;
      return textOk && catOk && sizeOk;
    });
    return out;
  }
  document.addEventListener('DOMContentLoaded', async function(){
    const s={};
    const grid=document.getElementById('grid');
    let ps=[];
    try { ps = await loadProducts(); }
    catch(e){ grid.innerHTML='<div class="subtle">Could not load products. Check data/products.json path.</div>'; console.error(e); return; }
    renderGrid(grid, ps);
  });
})();