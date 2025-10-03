(function(){
  function computeBase(){
    try {
      var host = location.hostname.toLowerCase();
      var parts = location.pathname.split('/').filter(Boolean);
      if (host.endsWith('github.io')) {
        var repo = parts.length ? parts[0] : '';
        return repo ? ('/' + repo + '/') : '/';
      }
    } catch(e){}
    return '/';
  }
  function shouldRewriteToClients(a){
    var txt = (a.textContent || '').trim().toLowerCase();
    var href = (a.getAttribute('href') || '').trim().toLowerCase();
    return txt.includes('client portals') || href.endsWith('portal.html') || href === 'clients/' || href === '/clients/';
  }
  function shouldRewriteToGallery(a){
    var txt = (a.textContent || '').trim().toLowerCase();
    var href = (a.getAttribute('href') || '').trim().toLowerCase();
    return txt.includes('gallery') || txt.includes('shop') || href === 'gallery/' || href === '/gallery/' || href.endsWith('shop.html');
  }
  function rewrite(){
    var base = computeBase();
    document.querySelectorAll('a').forEach(function(a){
      if (a.dataset.autobaseDone === '1') return;
      if (shouldRewriteToClients(a)) { a.setAttribute('href', base + 'clients/'); a.dataset.autobaseDone='1'; return; }
      if (shouldRewriteToGallery(a)) { a.setAttribute('href', base + 'gallery/'); a.dataset.autobaseDone='1'; return; }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', rewrite); else rewrite();
})();