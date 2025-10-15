// assets/js/shop-page.js
import { loadCatalog, formatMoney } from "./catalog.js";

const gridSel = "#catalog-grid";
const statusSel = "#catalog-status";

function setStatus(msg, isError=false) {
  const el = document.querySelector(statusSel);
  if (!el) return;
  el.textContent = msg;
  el.style.color = isError ? "crimson" : "inherit";
}

function productCardHTML(p) {
  const price = formatMoney(p.price, p.currency);
  const img = p.imageUrl || "./images/placeholder.svg";
  return `
    <article class="product-card">
      <a href="product.html?id=${encodeURIComponent(p.id)}" class="card-link">
        <img alt="${p.name}" src="${img}" loading="lazy" />
        <h3>${p.name}</h3>
        ${price ? `<div class="price">${price}</div>` : ``}
      </a>
      ${p.description ? `<p class="desc">${p.description}</p>` : ``}
    </article>
  `;
}

function injectStylesOnce() {
  if (document.getElementById("shop-grid-styles")) return;
  const css = `
    #catalog-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill,minmax(220px,1fr));
      gap: 1rem;
      align-items: start;
    }
    .product-card {
      border: 1px solid #eee;
      border-radius: 12px;
      padding: 12px;
      background: #fff;
      box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }
    .product-card img {
      width: 100%; height: 220px; object-fit: cover; border-radius: 8px;
      background: #f6f6f6;
    }
    .product-card h3 { margin: .6rem 0 .25rem; font-size: 1rem; }
    .product-card .price { font-weight: 600; margin-bottom: .3rem; }
    .product-card .desc { color: #555; font-size: .9rem; }
  `;
  const style = document.createElement("style");
  style.id = "shop-grid-styles";
  style.textContent = css;
  document.head.append(style);
}

async function main() {
  injectStylesOnce();
  setStatus("Loading products…");
  try {
    const items = await loadCatalog();
    const grid = document.querySelector(gridSel);
    if (!grid) {
      setStatus("Could not find catalog grid container.", true);
      return;
    }
    grid.innerHTML = items.map(productCardHTML).join("");
    setStatus(`${items.length} products loaded.`);
  } catch (err) {
    setStatus(err.message, true);
    console.error("[Shop] load error:", err);
  }
}

document.addEventListener("DOMContentLoaded", main);
