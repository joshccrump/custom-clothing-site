// Gallery & Shop renderer with Buy buttons → checkout.html
(function(){
  function basePath() {
    try {
      const host = location.hostname.toLowerCase();
      const parts = location.pathname.split('/').filter(Boolean);
      if (host.endsWith('github.io') && parts.length) return '/' + parts[0] + '/';
    } catch (_) {}
    return '/';
  }
  async function fetchJSON(url) {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + url);
    return await res.json();
  }
  async function loadProducts() {
    const BASE = basePath();
    const candidates = [
      BASE + 'data/products.json',
      'data/products.json',
      '../data/products.json'
    ];
    for (const u of candidates) {
      try { return await fetchJSON(u); } catch (_) {}
    }
    throw new Error('Could not find data/products.json. Place it at repo root /data/products.json');
  }
  function fmt(n, c='USD'){
    try { return new Intl.NumberFormat(undefined,{style:'currency',currency:c}).format(n); }
    catch { return '$'+Number(n||0).toFixed(2); }
  }
  function firstVariationId(p){
    if (Array.isArray(p.variations) && p.variations.length) return p.variations[0].id || p.variations[0].variation_id;
    return p.default_variation_id || p.square_variation_id || p.variation_id || p.variationId || null;
  }
  function renderGrid(el, items){
    el.innerHTML='';
    const BASE = basePath();
    for (const p of items) {
      const cur=p.currency||'USD';
      const hasVars=Array.isArray(p.variations)&&p.variations.length>0;
      const priceLine = hasVars
        ? ((p.price_min===p.price_max)?fmt(p.price_min,cur):`${fmt(p.price_min,cur)} – ${fmt(p.price_max,cur)}`)
        : (typeof p.price==='number'?fmt(p.price,cur):'');

      const card=document.createElement('article'); card.className='card';
      card.innerHTML = `
        <div class='card__media'>
          <img class='card__img' alt='${p.title||'Product'}' src='${p.thumbnail||BASE+'images/placeholder.png'}'>
        </div>
        <div class='card__body'>
          <h3 class='title'>${p.title||'Untitled'}</h3>
          <div class='price'>${priceLine}</div>
          <div class='card__actions'></div>
        </div>`;

      const actions = card.querySelector('.card__actions');
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
      const buy=document.createElement('a'); buy.className='btn btn--buy'; buy.textContent= vid ? 'Buy' : 'View';
      function hrefFor(id){ return `${BASE}checkout.html?variationId=${encodeURIComponent(id)}&quantity=1`; }
      buy.href = vid ? hrefFor(vid) : (BASE + 'product.html');
      if (select) select.addEventListener('change',()=>{ buy.href = hrefFor(select.value); });
      actions.appendChild(buy);
      el.appendChild(card);
    }
  }
  function uniq(a){ return [...new Set((a||[]).filter(Boolean))]; }
  function filterSort(ps, state){
    const q=(state.q||'').toLowerCase().trim();
    let out = ps.filter(p => q ? (p.title||'').toLowerCase().includes(q) : true);
    if (state.sort==='price-asc') out.sort((a,b)=>(a.price_min??a.price??0)-(b.price_min??b.price??0));
    else if (state.sort==='price-desc') out.sort((a,b)=>(b.price_max??b.price??0)-(a.price_max??a.price??0));
    else if (state.sort==='newest') out.sort((a,b)=>new Date(b.createdAt||0)-new Date(a.createdAt||0));
    return out;
  }
  document.addEventListener('DOMContentLoaded', async function(){
    const grid=document.getElementById('grid');
    const pager=document.getElementById('pager');
    const searchEl=document.getElementById('search');
    const catEl=document.getElementById('category');
    const sizeEl=document.getElementById('size');
    const sortEl=document.getElementById('sort');
    let products=[];
    try { products = await loadProducts(); }
    catch(e){ grid.innerHTML = '<div class="subtle">'+e.message+'</div>'; return; }
    // Fill filters (optional)
    const cats=uniq(products.map(p=>p.category));
    if (catEl) catEl.innerHTML='<option value="">All categories</option>'+cats.map(c=>`<option>${c}</option>`).join('');
    const sizes=uniq(products.flatMap(p=>p.sizes||[]));
    if (sizeEl) sizeEl.innerHTML='<option value="">Any size</option>'+sizes.map(v=>`<option>${v}</option>`).join('');
    const state={{q:'', sort:'featured'}};
    function render(){ renderGrid(grid, filterSort(products, state)); }
    if (searchEl) searchEl.oninput=()=>{state.q=searchEl.value; render();}
    if (sortEl) sortEl.onchange=()=>{state.sort=sortEl.value; render();}
    render();
  });
})();