(function(){
  function createLink(href, text){ var a=document.createElement('a'); a.href=href; a.textContent=text; a.setAttribute('data-autoinjected','1'); a.style.marginRight='12px'; return a; }
  function hasLink(nav, pred){ return [...nav.querySelectorAll('a')].some(a=> pred((a.getAttribute('href')||'').toLowerCase(), (a.textContent||'').toLowerCase())); }
  function ensureLinks(nav){
    if (!hasLink(nav,(h,t)=> t.includes('client portals') || h.includes('clients/'))) nav.appendChild(createLink('clients/','Client Portals'));
    if (!hasLink(nav,(h,t)=> t.includes('gallery') || t.includes('shop') || h.includes('gallery/'))) nav.appendChild(createLink('gallery/','Gallery'));
  }
  function pickNav(){ return document.querySelector('[data-site-nav]') || document.querySelector('header nav') || document.querySelector('nav'); }
  function init(){ var nav = pickNav(); if(!nav){ var header=document.querySelector('header')||document.body; nav=document.createElement('nav'); nav.setAttribute('data-site-nav',''); nav.style.display='block'; nav.style.padding='8px 12px'; header.insertBefore(nav, header.firstChild); } ensureLinks(nav); }
  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', init); else init();
})();