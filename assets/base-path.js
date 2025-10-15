/* assets/base-path.js
   Computes a stable base path for GitHub Pages project sites
   so every page (including /gallery/) fetches the same JSON.
*/
(function () {
  window.Site = window.Site || {};
  if (!window.Site.basePath) {
    var segs = location.pathname.split('/').filter(Boolean);
    window.Site.basePath = (segs.length >= 2) ? ('/' + segs[0] + '/' + segs[1] + '/') : '/';
  }
  if (!window.Site.catalogUrl) {
    window.Site.catalogUrl = function () {
      var origin = location.origin || (location.protocol + '//' + location.host);
      return origin + window.Site.basePath + 'data/products.json';
    };
  }
})();