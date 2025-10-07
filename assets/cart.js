(function(){
  function basePath(){
    try{
      const host=location.hostname.toLowerCase();
      const parts=location.pathname.split('/').filter(Boolean);
      if(host.endsWith('github.io') && parts.length) return '/' + parts[0] + '/';
    }catch(e){}
    return '/';
  }
  async function fetchJSON(u){
    const r = await fetch(u, { cache:'no-store' });
    if (!r.ok) throw new Error('HTTP '+r.status+' '+u);
    return r.json();
  }
  function qs(name){ return new URLSearchParams(location.search).get(name); }
  function fmt(n,c='USD'){ try{ return new Intl.NumberFormat(undefined,{style:'currency',currency:c}).format(n); }catch{ return '$'+Number(n||0).toFixed(2);} }

  // Try to find product + modifiers from static JSON first
  async function findFromStatic(variationId){
    const BASE=basePath();
    const candidates=[
      BASE + 'data/products.json',
      'data/products.json','../data/products.json','/data/products.json',
      BASE + 'web/data/products.json','web/data/products.json','../web/data/products.json','/web/data/products.json'
    ];
    let products=[];
    for(const u of candidates){ try{ products = await fetchJSON(u); break; }catch(_){} }
    if (!products.length) return null;

    for (const p of products){
      if (Array.isArray(p.variations)){
        for (const v of p.variations){
          const id = v.id || v.variation_id;
          if (id === variationId){
            return {
              product: p,
              variation: v,
              modifierLists: p.modifier_lists || p.modifiers || [] // optional if your JSON contains it
            };
          }
        }
      }
    }
    return null;
  }

  async function fetchCatalog(variationId){
    const api = (window.API_BASE||'').trim();
    if (!api){ throw new Error('API_BASE not set: add <meta name=\"api-base\" content=\"https://YOUR-VERCEL-APP.vercel.app\"> to cart.html'); }
    return await fetchJSON(api + '/api/catalog?variationId=' + encodeURIComponent(variationId));
  }

  function renderModifiers(container, lists, onChangePrice){
    container.innerHTML='';
    for (const list of (lists||[])){
      const fs = document.createElement('fieldset');
      const lg = document.createElement('legend');
      lg.textContent = list.name || 'Options';
      fs.appendChild(lg);

      const mods = document.createElement('div'); mods.className='mods';
      const multi = list.selectionType === 'MULTIPLE' || list.maxSelected > 1;
      for (const m of (list.options||[])){
        const id = m.id;
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = multi ? 'checkbox' : 'radio';
        input.name = 'mod_' + (list.id||lg.textContent);
        input.value = id;
        input.dataset.price = String(m.priceMoney?.amount || 0);
        input.dataset.currency = String(m.priceMoney?.currency || 'USD');

        const span = document.createElement('span');
        const priceStr = (m.priceMoney?.amount ? ' + ' + fmt(m.priceMoney.amount/100, m.priceMoney.currency) : '');
        span.textContent = (m.name || 'Option') + priceStr;

        label.appendChild(input);
        label.appendChild(span);
        mods.appendChild(label);
      }
      fs.appendChild(mods);
      container.appendChild(fs);
    }

    container.addEventListener('change', () => {
      const checked = container.querySelectorAll('input:checked');
      let add = 0, curr = 'USD';
      checked.forEach(inp => {
        const amt = Number(inp.dataset.price||'0');
        if (amt) { add += amt; curr = inp.dataset.currency || curr; }
      });
      onChangePrice(add, curr);
    });
  }

  document.addEventListener('DOMContentLoaded', async function(){
    const mount = document.getElementById('cart');
    const BASE = basePath();

    const variationId = qs('variationId');
    const quantity    = Math.max(1, parseInt(qs('quantity')||'1',10));

    if (!variationId){
      mount.innerHTML = '<div class="empty">Your cart is empty. Go to the <a href="'+BASE+'shop.html">Shop</a> to add an item.</div>';
      return;
    }

    let data = await findFromStatic(variationId);
    if (!data){
      try{ data = await fetchCatalog(variationId); } catch(e){
        mount.innerHTML = '<div class="empty">Could not load item details. Set API base in cart.html & ensure your Vercel serverless is deployed.</div>';
        return;
      }
    }

    const p = data.product || {};
    const v = data.variation || {};
    const lists = data.modifierLists || [];

    const title = p.title || p.name || 'Selected Item';
    const currency = p.currency || 'USD';
    const thumbnail = p.thumbnail || (BASE+'images/placeholder.png');
    const vname = v.name || 'Variation';
    const unitPrice = (typeof v.price === 'number') ? v.price : (typeof p.price==='number' ? p.price : 0);
    let modsCents = 0, modsCurr = currency;

    mount.innerHTML = `
      <div class="card">
        <div class="row">
          <img class="thumb" alt="Item" src="${thumbnail}">
          <div class="meta">
            <h2 class="title">${title}</h2>
            <div class="muted">${vname}</div>

            <div id="mod-lists"></div>

            <div class="qty">
              <label>Quantity</label>
              <input id="qty" type="number" min="1" value="${quantity}">
            </div>

            <label class="muted" style="display:block;margin-top:10px">
              Personalization / Note (optional)
              <input id="note" style="display:block;width:100%;padding:10px;margin-top:6px;border:1px solid #e5e7eb;border-radius:8px" placeholder="e.g., Name and number">
            </label>

            <div class="totals">
              <div class="muted">Unit price: <span id="unit">${fmt(unitPrice, currency)}</span></div>
              <div><strong>Subtotal: <span id="subtotal">${fmt(unitPrice*quantity, currency)}</span></strong></div>
            </div>
            <div class="actions">
              <a class="btn btn--ghost" href="${BASE}shop.html">← Continue shopping</a>
              <a class="btn btn--primary" id="pay">Continue to payment</a>
            </div>
          </div>
        </div>
      </div>
    `;

    const modContainer = document.getElementById('mod-lists');
    const qtyEl = document.getElementById('qty');
    const subEl = document.getElementById('subtotal');
    const noteEl = document.getElementById('note');
    const payEl = document.getElementById('pay');

    function updateTotals(){
      const q = Math.max(1, parseInt(qtyEl.value||'1',10));
      const total = (unitPrice*100 + modsCents) * q / 100;
      subEl.textContent = fmt(total, modsCurr || currency);
    }
    renderModifiers(modContainer, lists, (addCents, curr)=>{ modsCents = addCents; modsCurr = curr; updateTotals(); });
    updateTotals();

    function selectedModifierIds(){
      return Array.from(modContainer.querySelectorAll('input:checked')).map(inp=>inp.value);
    }

    payEl.addEventListener('click', () => {
      const q = Math.max(1, parseInt(qtyEl.value||'1',10));
      const mods = selectedModifierIds();
      const n = (noteEl.value||'').trim();
      const url = new URL(BASE + 'checkout.html', location.origin);
      url.searchParams.set('variationId', variationId);
      url.searchParams.set('quantity', String(q));
      if (mods.length) url.searchParams.set('mods', mods.join(','));
      if (n) url.searchParams.set('note', n);
      location.href = url.toString();
    });
  });
})();