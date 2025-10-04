/* Consistent Nav Kit — injects a uniform nav into every page */
(function(){
  function basePath() {
    try {
      var host = location.hostname.toLowerCase();
      var parts = location.pathname.split('/').filter(Boolean);
      if (host.endsWith('github.io') && parts.length) return '/' + parts[0] + '/';
    } catch(e){}
    return '/';
  }
  var BASE = basePath();

  var defaultLinks = [
    { href: './',       text: 'Home' },
    { href: 'gallery/', text: 'Gallery' },
    { href: 'clients/', text: 'Client Portals' },
    { href: 'shop.html',text: 'Shop' },
    { href: 'about.html',text: 'About' },
    { href: 'contact.html',text: 'Contact' }
  ];

  function ensureNav() {
    var header = document.querySelector('[data-site-header]') || document.querySelector('header');
    var container;
    if (!header) {
      header = document.createElement('header');
      header.setAttribute('data-site-header','');
      document.body.insertBefore(header, document.body.firstChild);
    } else {
      header.setAttribute('data-site-header','');
      header.innerHTML = '';
    }

    container = document.createElement('div');
    container.className = 'cnk-sitebar';
    header.appendChild(container);

    var me = document.currentScript;
    var brand = (me && me.dataset.brand) || 'Created By Crump';
    var links = defaultLinks;
    try {
      if (me && me.dataset.links) {
        var parsed = JSON.parse(me.dataset.links);
        if (Array.isArray(parsed) && parsed.length) links = parsed;
      }
    } catch(e){}

    var brandLink = document.createElement('a');
    brandLink.className = 'cnk-brand';
    brandLink.href = BASE;
    brandLink.textContent = brand;

    var nav = document.createElement('nav');
    nav.className = 'cnk-nav';

    links.forEach(function(item){
      var a = document.createElement('a');
      a.className = 'cnk-link';
      a.textContent = item.text || 'Link';
      var href = (item.href || '').trim();
      if (/^https?:\/\//i.test(href)) a.href = href;
      else if (href.startsWith('./')) a.href = href;
      else if (href.startsWith('/')) a.href = BASE.replace(/\/$/,'') + href;
      else a.href = BASE + href;
      nav.appendChild(a);
    });

    container.appendChild(brandLink);
    container.appendChild(nav);

    try {
      var here = new URL(location.href);
      var path = here.pathname.replace(/\/+$/,'/');
      Array.prototype.forEach.call(nav.querySelectorAll('a'), function(a){
        var p = a.pathname.replace(/\/+$/,'/');
        if (p === path) a.setAttribute('aria-current', 'page');
      });
    } catch(e){}
  }

  function ensureCSS(){
    var has = Array.prototype.some.call(document.querySelectorAll('link[rel="stylesheet"]'), function(link){
      return /consistent-nav\.css/i.test(link.getAttribute('href') || '');
    });
    if (!has) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'assets/consistent-nav.css';
      document.head.appendChild(link);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ ensureCSS(); ensureNav(); });
  } else {
    ensureCSS(); ensureNav();
  }
})();