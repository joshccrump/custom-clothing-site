(function(){
  function detectBase(){
    const { hostname, pathname } = window.location;
    if (pathname.startsWith("/custom-clothing-site/")) return "/custom-clothing-site/";
    if (hostname.endsWith("github.io")) {
      const parts = pathname.split("/").filter(Boolean);
      if (parts.length) return `/${parts[0]}/`;
    }
    return "/";
  }
  const BASE = detectBase();
  function resolveImage(src){
    if (!src) return BASE+'images/ph1.svg';
    if (/^https?:/i.test(src)) return src;
    if (src.startsWith('/')) return src;
    return BASE + src.replace(/^\/+/, '');
  }
  async function fetchJSON(u){
    const r = await fetch(u, { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP '+r.status+' '+u);
    return r.json();
  }
  async function loadProducts(){
    const tries = [
      BASE+'data/products.json','data/products.json','../data/products.json','/data/products.json',
      BASE+'web/data/products.json','web/data/products.json','../web/data/products.json','/web/data/products.json',
      '/custom-clothing-site/data/products.json'
    ];
    for (const u of tries){ try { return await fetchJSON(u); } catch (_) {} }
    throw new Error('Could not find products.json');
  }
  function firstVarId(p){
    if (Array.isArray(p.variations)&&p.variations.length) return p.variations[0].id||p.variations[0].variation_id;
    return p.default_variation_id||p.variation_id||p.variationId||p.square_variation_id||null;
  }
  function fmt(n,c='USD'){
    try{ return new Intl.NumberFormat(undefined,{style:'currency',currency:c}).format(n);}catch{ return '$'+Number(n||0).toFixed(2);} 
  }
  function renderGrid(el, items){
    el.innerHTML='';
    for(const p of items){
      const cur=p.currency||'USD';
      const vars=Array.isArray(p.variations)?p.variations.filter(v=>v&&v.id):[];
      const hasVars=vars.length>0;
      const price=hasVars?((p.price_min===p.price_max)?fmt(p.price_min,cur):`${fmt(p.price_min,cur)} – ${fmt(p.price_max,cur)}`):(typeof p.price==='number'?fmt(p.price,cur):'');
      const card=document.createElement('article'); card.className='card';
      const thumb=resolveImage(p.thumbnail);
      card.innerHTML=`<div class='card__media'><img class='card__img' alt='${p.title||'Product'}' src='${thumb}'></div>
      <div class='card__body'><h3 class='title'>${p.title||'Untitled'}</h3><div class='price'>${price}</div><div class='card__actions'></div></div>`;
      const actions=card.querySelector('.card__actions'); let select;
      if(hasVars){
        select=document.createElement('select'); select.setAttribute('data-variation-select',''); select.style.marginRight='8px';
        for(const v of vars){
          const o=document.createElement('option'); o.value=v.id||v.variation_id; const vp=(typeof v.price==='number')?` — ${fmt(v.price,cur)}`:'';
          o.textContent=(v.name||'Variation')+vp; select.appendChild(o);
        }
        actions.appendChild(select);
      }
      const vid=firstVarId(p); const btn=document.createElement('a'); btn.className='btn btn--buy'; btn.textContent=vid?'Buy':'View';
      function hrefFor(id){ return `${BASE}cart.html?variationId=${encodeURIComponent(id)}&quantity=1`; }
      btn.href = vid ? hrefFor(vid) : (p.url || BASE + 'product.html');
      if(select) select.addEventListener('change',()=>{ btn.href=hrefFor(select.value);});
      actions.appendChild(btn); el.appendChild(card);
    }
  }
  document.addEventListener('DOMContentLoaded', async function(){
    const grid=document.getElementById('grid'); let ps=[];
    try{ ps=await loadProducts(); }catch(e){ grid.innerHTML='<div class="subtle">Could not load products. Check data/products.json path.</div>'; return; }
    renderGrid(grid, ps);
  });
})();
