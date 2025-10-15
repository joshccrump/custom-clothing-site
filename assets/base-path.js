/* assets/base-path.js (minimal)
   Works on GitHub Pages project sites so every page fetches:
   https://joshccrump.github.io/custom-clothing-site/data/products.json
*/
(function () {
  window.Site = window.Site || {};
  if (!window.Site.basePath) {
    var segs = location.pathname.split('/').filter(Boolean);
    // For project sites, pathname looks like /<username>/<repo>/...
    window.Site.basePath = (segs.length >= 2) ? ('/' + segs[0] + '/' + segs[1] + '/') : '/';
  }
  if (!window.Site.catalogUrl) {
    window.Site.catalogUrl = function () {
      var origin = location.origin || (location.protocol + '//' + location.host);
      return origin + window.Site.basePath + 'data/products.json';
    };
  }
})();
