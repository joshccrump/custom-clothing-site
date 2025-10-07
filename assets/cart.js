// assets/cart.js
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
  async function loadProducts(){
    const BASE=basePath();
    const candidates=[
      BASE + 'data/products.json',
      'data/products.json',
      '../data/products.json',
      '/data/products.json',
      BASE + 'web/data/products.json',
      'web/data/products.json',
      '../web/data/products.json',
      '/web/data/products.json'
    ];
    for(const u of candidates){
      try{ return await fetchJSON(u); }catch(_){}
    }
    return []; // still render with raw ids
  }
  function fmt(n,c='USD'){ try{ return new Intl.NumberFormat(undefined,{style:'currency',currency:c}).format(n); }catch{ return '$'+Number(n||0).toFixed(2);} }
  function findByVariation(products, vid){
    for(const p of products){
      const vs = Array.isArray(p.variations) ? p.variations : [];
      for(const v of vs){
        const id = v.id || v.variation_id;
        if(id===vid) return { product:p, variation:v };
      }
    }
    return null;
  }
  function qs(name){ return new URLSearchParams(location.search).get(name); }

  document.addEventListener('DOMContentLoaded', async function(){
    const mount = document.getElementById('cart');
    const BASE = basePath();

    const variationId = qs('variationId');
    const quantity    = Math.max(1, parseInt(qs('quantity')||'1',10));

    if (!variationId){
      mount.innerHTML = '<div class="empty">Your cart is empty. Go to the <a href="'+BASE+'shop.html">Shop</a> to add an item.</div>';
      return;
    }

    const products = await loadProducts();
    const found = findByVariation(products, variationId);

    const title = found?.product?.title || 'Selected Item';
    const currency = found?.product?.currency || 'USD';
    const thumbnail = found?.product?.thumbnail || (BASE+'images/placeholder.png');
    const vname = found?.variation?.name || 'Variation';
    const vprice = typeof found?.variation?.price === 'number' ? found.variation.price : (found?.product?.price || 0);
    const subtotal = vprice * quantity;

    mount.innerHTML = `
      <div class="card">
        <div class="row">
          <img class="thumb" alt="Item" src="${thumbnail}">
          <div class="meta">
            <h2 class="title">${title}</h2>
            <div class="muted">${vname}</div>
            <div class="qty">
              <label>Quantity</label>
              <input id="qty" type="number" min="1" value="${quantity}">
            </div>
            <div class="totals">
              <div class="muted">Unit price: ${fmt(vprice, currency)}</div>
              <div><strong>Subtotal: <span id="subtotal">${fmt(subtotal, currency)}</span></strong></div>
            </div>
            <div class="actions">
              <a class="btn btn--ghost" href="${BASE}shop.html">← Continue shopping</a>
              <a class="btn btn--primary" id="pay">Continue to payment</a>
            </div>
          </div>
        </div>
      </div>
    `;

    const qtyEl = document.getElementById('qty');
    const subEl = document.getElementById('subtotal');
    const payEl = document.getElementById('pay');

    function updateSubtotal(){
      const q = Math.max(1, parseInt(qtyEl.value||'1',10));
      subEl.textContent = fmt(vprice * q, currency);
      const href = `${BASE}checkout.html?variationId=${encodeURIComponent(variationId)}&quantity=${q}`;
      payEl.setAttribute('href', href);
    }
    qtyEl.addEventListener('input', updateSubtotal);
    updateSubtotal();
  });
})();