(function(){
  function getPreferred(){
    var params = new URLSearchParams(location.search);
    var t = params.get('theme');
    if (t){ try { localStorage.setItem('site_theme', t); } catch(e){} return t; }
    try { return localStorage.getItem('site_theme') || null; } catch(e){}
    var el = document.currentScript || document.querySelector('script[src*="theme-loader.js"]');
    return el && el.dataset.theme ? el.dataset.theme : null;
  }
  function loadPreset(name){
    if (!name) return;
    var href = 'assets/themes/presets/' + name + '.css';
    var link = document.createElement('link'); link.rel = 'stylesheet'; link.href = href; document.head.appendChild(link);
  }
  var theme = getPreferred(); loadPreset(theme||'crump');
})();