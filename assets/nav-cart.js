(function(){
  const BASE="/custom-clothing-site/";
  function addFab(){ if(document.querySelector('.cart-fab')) return; const a=document.createElement('a'); a.className='cart-fab'; a.href=BASE+'cart.html'; a.textContent='🛒 Cart';
    a.style.cssText='position:fixed;right:16px;bottom:16px;display:inline-flex;gap:8px;align-items:center;background:#111;color:#fff;border-radius:999px;padding:10px 14px;border:1px solid #111;text-decoration:none;z-index:1000;box-shadow:0 6px 20px rgba(0,0,0,.15)';
    const s=document.createElement('style'); s.textContent='@media (min-width:900px){.cart-fab{display:none}}'; document.head.appendChild(s);
    document.body.appendChild(a);
  }
  document.addEventListener('DOMContentLoaded', addFab);
})();