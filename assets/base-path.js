/* assets/base-path.js */
(function () {
  window.Site = window.Site || {};
  window.Site.basePath = (function () {
    var segs = location.pathname.split('/').filter(Boolean);
    if (segs.length >= 2) return '/' + segs[0] + '/' + segs[1] + '/';
    return '/';
  })();
  window.Site.catalogUrl = function () {
    var origin = location.origin || (location.protocol + '//' + location.host);
    return origin + window.Site.basePath + 'data/products.json';
  };
})();