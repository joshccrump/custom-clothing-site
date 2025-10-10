(function(){
  const BASE="/custom-clothing-site/";
  async function fetchJSON(u){ const r=await fetch(u,{cache:'no-store'}); if(!r.ok) throw new Error('HTTP '+r.status+' '+u); return r.json(); }
  function qs(n){ return new URLSearchParams(location.search).get(n); }
  function fmt(n,c='USD'){ try{ return new Intl.NumberFormat(undefined,{style:'currency',currency:c}).format(n);}catch{ return '$'+Number(n||0).toFixed(2);} }

  async function findFromStatic(variationId){
    const tries=[BASE+'data/products.json','data/products.json','../data/products.json','/data/products.json',BASE+'web/data/products.json','web/data/products.json','../web/data/products.json','/web/data/products.json'];
    let products=[]; for(const u of tries){ try{ products=await fetchJSON(u); break; }catch(_){} }
    if(!Array.isArray(products)||!products.length) return null;
    for(const p of products){
      if(Array.isArray(p.variations)){ for(const v of p.variations){ const id=v.id||v.variation_id; if(id===variationId) return {product:p,variation:v,modifierLists:p.modifier_lists||p.modifiers||[]}; } }
    }
    return null;
  }
  async function fetchCatalog(variationId){
    const api=document.querySelector('meta[name=api-base]')?.content?.trim()||''; if(!api) throw new Error('API_BASE missing');
    return await fetchJSON(api+'/api/catalog?variationId='+encodeURIComponent(variationId));
  }
  function renderModifiers(container, lists, onChange){
    container.innerHTML='';
    for(const list of(lists||[])){
      const fs=document.createElement('fieldset'); const lg=document.createElement('legend'); lg.textContent=list.name||'Options'; fs.appendChild(lg);
      const box=document.createElement('div'); box.className='mods';
      const multi=list.selectionType==='MULTIPLE'||(list.maxSelected||0)>1;
      for(const m of(list.options||[])){
        const lbl=document.createElement('label'); const inp=document.createElement('input'); inp.type=multi?'checkbox':'radio'; inp.name='mod_'+(list.id||lg.textContent); inp.value=m.id;
        inp.dataset.price = String(m.priceMoney?.amount||0); inp.dataset.currency = m.priceMoney?.currency||'USD';
        const span=document.createElement('span'); span.textContent=(m.name||'Option') + (m.priceMoney?.amount?(' + '+ (m.priceMoney.amount/100).toLocaleString(undefined,{style:'currency',currency:m.priceMoney.currency})):''); 
        lbl.appendChild(inp); lbl.appendChild(span); box.appendChild(lbl);
      }
      fs.appendChild(box); container.appendChild(fs);
    }
    container.addEventListener('change',()=>{
      const checked=container.querySelectorAll('input:checked'); let add=0,curr='USD'; checked.forEach(inp=>{const a=Number(inp.dataset.price||'0'); if(a){ add+=a; curr=inp.dataset.currency||curr; }});
      onChange(add,curr);
    });
  }

  document.addEventListener('DOMContentLoaded', async function(){
    const mount=document.getElementById('cart');
    const variationId=qs('variationId'); const qty=Math.max(1,parseInt(qs('quantity')||'1',10));
    if(!variationId){ mount.innerHTML='<div class="subtle">Your cart is empty. Visit the <a href="'+BASE+'shop.html">Shop</a>.</div>'; return; }

    let data=await findFromStatic(variationId);
    if(!data){ try{ data=await fetchCatalog(variationId); }catch(e){ mount.innerHTML='<div class="subtle">Could not load item details. Set your API base in cart.html and deploy /api/catalog.</div>'; return; } }

    const p=data.product||{}, v=data.variation||{}, lists=data.modifierLists||[];
    const title=p.title||p.name||'Selected Item', currency=p.currency||'USD', thumb=p.thumbnail||(BASE+'images/placeholder.png');
    const vname=v.name||'Variation', unitPrice=typeof v.price==='number'?v.price:(typeof p.price==='number'?p.price:0);
    let modsCents=0, curr=currency;

    mount.innerHTML=`
      <div class="card" style="padding:16px">
        <div class="row">
          <img class="thumb" alt="Item" src="${thumb}">
          <div class="meta">
            <h2 class="title">${title}</h2>
            <div class="subtle">${vname}</div>
            <div id="mod-lists"></div>
            <div class="qty" style="margin-top:10px"><label>Quantity</label> <input id="qty" type="number" min="1" value="${qty}"></div>
            <div class="totals"><div class="subtle">Unit price: <span id="unit">${fmt(unitPrice,currency)}</span></div><div><strong>Subtotal: <span id="subtotal">${fmt(unitPrice*qty,currency)}</span></strong></div></div>
            <div style="margin-top:12px"><a class="btn" href="${BASE}shop.html">← Continue shopping</a> <a class="btn btn--buy" id="pay">Continue to payment</a></div>
          </div>
        </div>
      </div>`;

    const modBox=document.getElementById('mod-lists'), qtyEl=document.getElementById('qty'), subEl=document.getElementById('subtotal'), payEl=document.getElementById('pay');

    function updateTotals(){ const q=Math.max(1,parseInt(qtyEl.value||'1',10)); const total=(unitPrice*100+modsCents)*q/100; subEl.textContent=fmt(total,curr||currency); }
    function selectedMods(){ return Array.from(modBox.querySelectorAll('input:checked')).map(i=>i.value); }

    renderModifiers(modBox,lists,(add,c)=>{ modsCents=add; curr=c; updateTotals(); }); updateTotals();

    payEl.addEventListener('click',()=>{
      const q=Math.max(1,parseInt(qtyEl.value||'1',10)); const mods=selectedMods();
      const url=new URL(BASE+'checkout.html',location.origin); url.searchParams.set('variationId',variationId); url.searchParams.set('quantity',String(q));
      if(mods.length) url.searchParams.set('mods',mods.join(',')); location.href=url.toString();
    });
  });
})();