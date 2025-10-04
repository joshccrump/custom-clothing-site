(function(){
  function computeBase(){
    try{
      var host = location.hostname.toLowerCase();
      var parts = location.pathname.split('/').filter(Boolean);
      if (host.endsWith('github.io') && parts.length){ return '/' + parts[0] + '/'; }
    }catch(e){}
    return '/';
  }
  var BASE = computeBase();
  var defaultLinks = [
    { href: './', text: 'Home' },
    { href: 'gallery/', text: 'Gallery' },
    { href: 'clients/', text: 'Client Portals' },
    { href: 'shop.html', text: 'Shop' },
    { href: 'about.html', text: 'About' },
    { href: 'contact.html', text: 'Contact' }
  ];
  function ensureHeader(){
    var existingHeader = document.querySelector('[data-site-header]') || document.querySelector('header');
    var header, container;
    if (!existingHeader){
      header = document.createElement('header'); header.setAttribute('data-site-header','');
      container = document.createElement('div'); container.className='sitebar'; header.appendChild(container);
      document.body.insertBefore(header, document.body.firstChild);
    } else {
      header = existingHeader;
      if (!header.querySelector('.sitebar')){ container = document.createElement('div'); container.className='sitebar'; header.insertBefore(container, header.firstChild); }
      else { container = header.querySelector('.sitebar'); container.innerHTML=''; }
      header.setAttribute('data-site-header','');
    }
    var me = document.currentScript;
    var brand = (me && me.dataset.brand) || 'Created By Crump';
    var links = defaultLinks;
    try { if (me && me.dataset.links){ var parsed = JSON.parse(me.dataset.links); if (Array.isArray(parsed)&&parsed.length) links = parsed; } } catch(e){}
    var brandLink = document.createElement('a'); brandLink.className='sitebar__brand'; brandLink.href=BASE; brandLink.textContent=brand;
    var nav = document.createElement('nav');
    links.forEach(function(item){
      var a=document.createElement('a'); a.textContent=item.text||'Link';
      var href=(item.href||'').trim();
      if (/^https?:/i.test(href)) a.href=href;
      else if (href.startsWith('./')) a.href=href;
      else if (href.startsWith('/')) a.href=BASE.replace(/\/$/,'')+href;
      else a.href=BASE+href;
      nav.appendChild(a);
    });
    container.appendChild(brandLink); container.appendChild(nav);
    try{
      var path = location.pathname;
      [].forEach.call(nav.querySelectorAll('a'), function(a){
        if (a.pathname === path) a.setAttribute('aria-current','page');
      });
    }catch(e){}
  }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', ensureHeader); else ensureHeader();
})();