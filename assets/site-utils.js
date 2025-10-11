(function(){
  function computeBase(){
    try {
      const { hostname, pathname } = window.location;
      const lowered = hostname.toLowerCase();
      const segments = pathname.split("/").filter(Boolean);
      if (pathname.startsWith("/custom-clothing-site/")) return "/custom-clothing-site/";
      if (lowered.endsWith("github.io") && segments.length) {
        return `/${segments[0]}/`;
      }
      if (segments.length >= 2) {
        // Handles nested hosting like /foo/bar/index.html → /foo/bar/
        return `/${segments.slice(0, segments.length - 1).join("/")}/`;
      }
      if (segments.length === 1 && pathname.endsWith("/")) {
        return `/${segments[0]}/`;
      }
    } catch (e) {
      console.warn("Failed to detect base path", e);
    }
    return "/";
  }

  const BASE = computeBase();
  function normalizeBase(base){
    if (!base) return null;
    const trimmed = String(base).trim();
    if (!trimmed) return null;
    return trimmed.replace(/\/+$/, "");
  }

  let apiBaseCache;
  function detectApiBase(){
    if (apiBaseCache !== undefined) return apiBaseCache;
    const meta = document.querySelector('meta[name="api-base"]');
    if (meta?.content){
      const normalized = normalizeBase(meta.content);
      if (normalized){
        apiBaseCache = normalized;
        return apiBaseCache;
      }
    }
    if (typeof window.API_BASE === "string" && window.API_BASE.trim()){
      const normalized = normalizeBase(window.API_BASE);
      if (normalized){
        apiBaseCache = normalized;
        return apiBaseCache;
      }
    }
    apiBaseCache = null;
    return apiBaseCache;
  }

  function setApiBase(base){
    apiBaseCache = normalizeBase(base);
    return apiBaseCache;
  }
  const NAV_MAP = {
    home: "",
    shop: "shop.html",
    gallery: "gallery/",
    clients: "clients/",
    about: "about.html",
    contact: "contact.html",
    cart: "cart.html",
    checkout: "checkout.html",
    thankyou: "thank-you.html",
    portal: "portal.html"
  };

  function join(path){
    if (!path) return BASE;
    if (/^https?:/i.test(path)) return path;
    if (path.startsWith("/")) return path;
    return BASE + path.replace(/^\/+/, "");
  }

  function joinApi(path){
    if (/^https?:/i.test(path)) return path;
    const base = detectApiBase();
    if (!base){
      return path;
    }
    const suffix = path.startsWith("/") ? path : `/${path}`;
    return `${base}${suffix}`;
  }

  function apiFetch(path, init){
    const url = joinApi(path);
    if (!/^https?:/i.test(path) && !detectApiBase()){
      throw new Error("API base is not configured. Provide window.API_BASE or <meta name=api-base>.");
    }
    return fetch(url, init);
  }

  function resolveImage(src){
    if (!src) return join("images/ph1.svg");
    if (/^https?:/i.test(src)) return src;
    if (src.startsWith("/")) return src;
    return join(src);
  }

  async function fetchJSON(url){
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json();
  }

  let catalogPromise;
  async function loadCatalog(){
    if (!catalogPromise){
      const candidates = [
        join("data/products.json"),
        "data/products.json",
        "../data/products.json",
        "/data/products.json",
        join("web/data/products.json"),
        "web/data/products.json",
        "../web/data/products.json",
        "/web/data/products.json"
      ];
      catalogPromise = (async () => {
        for (const href of candidates){
          try {
            const data = await fetchJSON(href);
            if (Array.isArray(data)) return data;
          } catch (err) {
            continue;
          }
        }
        throw new Error("Could not locate data/products.json");
      })();
    }
    return catalogPromise;
  }

  function rewriteAnchors(root=document){
    const anchors = root.querySelectorAll('[data-nav]');
    anchors.forEach((a) => {
      const key = (a.dataset.nav || "").toLowerCase();
      const target = NAV_MAP[key];
      a.href = join(target || "");
    });
    root.querySelectorAll('[data-nav-link]').forEach((a) => {
      const key = (a.dataset.navLink || "").toLowerCase();
      const target = NAV_MAP[key];
      if (target != null) a.href = join(target);
    });
  }

  function onReady(fn){
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", fn, { once: true });
    else fn();
  }

  onReady(() => rewriteAnchors());

  window.Site = {
    base: BASE,
    join,
    resolveImage,
    loadCatalog,
    rewriteAnchors,
    apiBase: () => detectApiBase(),
    setApiBase,
    joinApi,
    apiFetch
  };
})();
