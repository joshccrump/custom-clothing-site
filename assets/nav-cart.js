// assets/nav-cart.js
(function(){
  function basePath(){
    try{
      const host=location.hostname.toLowerCase();
      const parts=location.pathname.split('/').filter(Boolean);
      if (host.endsWith('github.io') && parts.length) return '/' + parts[0] + '/';
    }catch(e){}
    return '/';
  }
  const BASE = basePath();

  function ensureStyles(){
    if (document.getElementById('site-nav-styles')) return;
    const css = `
      .site-nav{display:flex;gap:18px;align-items:center;padding:14px 18px;border-bottom:1px solid #e5e7eb;background:#fff;position:sticky;top:0;z-index:1000}
      .site-nav a{color:#111;text-decoration:none;padding:8px 10px;border-radius:10px;border:1px solid transparent;font-weight:600}
      .site-nav a:hover{background:#111;color:#fff}
      .site-nav .spacer{flex:1}
      .cart-fab{position:fixed;right:16px;bottom:16px;display:inline-flex;gap:8px;align-items:center;background:#111;color:#fff;border-radius:999px;padding:10px 14px;border:1px solid #111;text-decoration:none;z-index:1000;box-shadow:0 6px 20px rgba(0,0,0,.15)}
      @media (min-width: 900px){ .cart-fab{display:none} }
    `;
    const style = document.createElement('style');
    style.id = 'site-nav-styles';
    style.textContent = css;
    document.head.appendChild(style);
  }

  function linkFor(rel){
    const a = document.createElement('a');
    a.setAttribute('data-href', rel);
    a.href = BASE + rel;
    a.textContent = (rel === '' ? 'Home' :
                     rel === 'shop.html' ? 'Shop' :
                     rel === 'gallery/' ? 'Gallery' :
                     rel === 'clients/' ? 'Client Portals' :
                     rel === 'about.html' ? 'About' :
                     rel === 'contact.html' ? 'Contact' :
                     rel === 'cart.html' ? 'Cart' : rel);
    return a;
  }

  function makeNav(){
    const nav = document.createElement('nav');
    nav.className = 'site-nav';
    nav.setAttribute('data-site-nav','');

    nav.appendChild(linkFor(''));
    nav.appendChild(linkFor('shop.html'));
    nav.appendChild(linkFor('gallery/'));
    nav.appendChild(linkFor('clients/'));
    const spacer = document.createElement('div'); spacer.className='spacer';
    nav.appendChild(spacer);
    nav.appendChild(linkFor('about.html'));
    nav.appendChild(linkFor('contact.html'));
    nav.appendChild(linkFor('cart.html'));

    return nav;
  }

  function findExistingNav(){
    return document.querySelector('.site-nav,[data-site-nav],header nav,nav.navbar,nav[role="navigation"]');
  }

  function ensureCartLink(container){
    const hasCart = Array.from(container.querySelectorAll('a')).some(a => /cart\.html(\?|$)/.test(a.getAttribute('href')||'') || /cart/i.test(a.textContent||''));
    if (hasCart) return;

    const cart = linkFor('cart.html');
    const spacer = container.querySelector('.spacer');
    if (spacer && spacer.parentElement === container){
      container.appendChild(cart);
    } else {
      container.appendChild(cart);
    }
  }

  function addFab(){
    if (document.querySelector('.cart-fab')) return;
    const fab = document.createElement('a');
    fab.className = 'cart-fab';
    fab.href = BASE + 'cart.html';
    fab.innerHTML = '🛒 Cart';
    document.body.appendChild(fab);
  }

  function wireBaseHrefs(scope){
    scope.querySelectorAll('a[data-href]').forEach(a => {
      const rel=a.getAttribute('data-href')||'';
      a.href = BASE + rel;
    });
  }

  document.addEventListener('DOMContentLoaded', function(){
    ensureStyles();

    let nav = findExistingNav();
    if (nav){
      nav.classList.add('site-nav');
      nav.setAttribute('data-site-nav','');
      ensureCartLink(nav);
      wireBaseHrefs(nav);
    } else {
      nav = makeNav();
      document.body.insertAdjacentElement('afterbegin', nav);
      wireBaseHrefs(nav);
    }

    addFab();
  });
})();