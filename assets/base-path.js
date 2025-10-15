/* assets/base-path.js
   Derives the repo root from the script URL so every page – whether it lives
   at /shop.html, /gallery/, or a deeper client portal – can fetch the shared
   catalog json from /data/products.json without accidentally including the
   current page segment in the path.
*/
(function () {
  window.Site = window.Site || {};

  function detectBasePath() {
    var script = document.currentScript;
    if (!script) {
      var scripts = document.getElementsByTagName('script');
      for (var i = scripts.length - 1; i >= 0; i--) {
        var tag = scripts[i];
        if (tag && tag.src && tag.src.indexOf('base-path.js') !== -1) {
          script = tag;
          break;
        }
      }
    }

    if (script && script.src) {
      try {
        var url = new URL(script.src, location.href);
        var path = url.pathname.replace(/\/+assets\/base-path\.js(?:[^/]*)?$/, '/');
        return path.endsWith('/') ? path : (path + '/');
      } catch (_) {
        // fall through to location-based heuristic
      }
    }

    // Fallback: trim the last segment when we're on a file path such as
    // /custom-clothing-site/shop.html or /custom-clothing-site/gallery/.
    var pathname = location.pathname || '/';
    if (!pathname.endsWith('/')) {
      pathname = pathname.replace(/\/[^/]*$/, '/');
    }
    // Ensure we return at least '/'
    return pathname || '/';
  }

  if (!window.Site.basePath) {
    window.Site.basePath = detectBasePath();
  }

  if (!window.Site.catalogUrl) {
    window.Site.catalogUrl = function () {
      var origin = location.origin || (location.protocol + '//' + location.host);
      return origin.replace(/\/$/, '') + window.Site.basePath + 'data/products.json';
    };
  }
})();
