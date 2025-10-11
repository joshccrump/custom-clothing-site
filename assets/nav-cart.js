(function(){
  function addCartFab(){
    if (document.querySelector('.cart-fab')) return;
    const link = document.createElement('a');
    link.className = 'cart-fab';
    link.textContent = '🛒 Cart';
    link.href = window.Site ? window.Site.join('cart.html') : 'cart.html';
    link.style.cssText = 'position:fixed;right:16px;bottom:16px;display:inline-flex;gap:8px;align-items:center;background:#111;color:#fff;border-radius:999px;padding:10px 14px;border:1px solid #111;text-decoration:none;z-index:1000;box-shadow:0 6px 20px rgba(0,0,0,.15)';
    const style = document.createElement('style');
    style.textContent = '@media (min-width:900px){.cart-fab{display:none}}';
    document.head.appendChild(style);
    document.body.appendChild(link);
  }

  function init(){
    if (window.Site) window.Site.rewriteAnchors();
    addCartFab();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
