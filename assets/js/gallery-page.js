// assets/js/gallery-page.js
import { loadCatalog } from "./catalog.js";

const gridSel = "#gallery-grid";
const statusSel = "#gallery-status";

function setStatus(msg, isError=false) {
  const el = document.querySelector(statusSel);
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? "crimson" : "inherit";
}

function tileHTML(p) {
  const img = p.imageUrl || "../images/placeholder.svg";
  return `
    <figure class="gallery-tile">
      <img alt="${p.name}" src="${img}" loading="lazy" />
      <figcaption>${p.name}</figcaption>
    </figure>
  `;
}

function injectStylesOnce() {
  if (document.getElementById("gallery-grid-styles")) return;
  const css = `
    #gallery-grid {
      column-count: 3;
      column-gap: 1rem;
    }
    @media (max-width: 900px){ #gallery-grid { column-count: 2; } }
    @media (max-width: 600px){ #gallery-grid { column-count: 1; } }
    .gallery-tile { break-inside: avoid; display: block; margin: 0 0 1rem; }
    .gallery-tile img { width: 100%; height: auto; border-radius: 8px; background: #f6f6f6; }
    .gallery-tile figcaption { padding: .35rem .15rem; color: #444; font-size: .9rem; }
  `;
  const style = document.createElement("style");
  style.id = "gallery-grid-styles";
  style.textContent = css;
  document.head.append(style);
}

async function main() {
  injectStylesOnce();
  setStatus("Loading gallery…");
  try {
    const items = await loadCatalog();
    const grid = document.querySelector(gridSel);
    if (!grid) {
      setStatus("Could not find gallery grid container.", true);
      return;
    }
    grid.innerHTML = items.map(tileHTML).join("");
    setStatus(`${items.length} items loaded.`);
  } catch (err) {
    setStatus(err.message, true);
    console.error("[Gallery] load error:", err);
  }
}

document.addEventListener("DOMContentLoaded", main);
