(function(){
  function fmt(amount, currency){
    if (amount == null) return "";
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(amount);
    } catch (e) {
      return `$${Number(amount || 0).toFixed(2)}`;
    }
  }

  function firstVariationId(product){
    if (Array.isArray(product?.variations) && product.variations.length) {
      const first = product.variations[0];
      return first.id || first.variation_id || first.variationId || null;
    }
    return product?.default_variation_id || product?.variation_id || product?.variationId || null;
  }

  function buildCard(product){
    const currency = product.currency || product.variations?.[0]?.currency || "USD";
    const hasVariations = Array.isArray(product.variations) && product.variations.length > 0;
    const min = typeof product.price_min === "number" ? product.price_min : null;
    const max = typeof product.price_max === "number" ? product.price_max : null;
    const priceLabel = hasVariations
      ? (min != null && max != null && min !== max
          ? `${fmt(min, currency)} – ${fmt(max, currency)}`
          : fmt(min ?? max, currency))
      : fmt(product.price, currency);

    const article = document.createElement("article");
    article.className = "card";
    const thumb = window.Site?.resolveImage(product.thumbnail);
    const media = thumb ? `<img class="card__img" alt="${product.title || "Product"}" src="${thumb}">` : "";
    article.innerHTML = `
      <div class="card__media">
        ${media}
      </div>
      <div class="card__body">
        <h3 class="title">${product.title || "Untitled"}</h3>
        <p class="subtle">${product.description || ""}</p>
        <div class="price">${priceLabel || ""}</div>
        <div class="card__actions"></div>
      </div>
    `;

    const actions = article.querySelector(".card__actions");
    let selector;
    if (hasVariations) {
      selector = document.createElement("select");
      selector.setAttribute("data-variation-select", "");
      selector.style.marginRight = "8px";
      for (const variation of product.variations) {
        const option = document.createElement("option");
        option.value = variation.id || variation.variation_id;
        const valuePrice = typeof variation.price === "number" ? ` — ${fmt(variation.price, variation.currency || currency)}` : "";
        option.textContent = `${variation.name || "Variation"}${valuePrice}`;
        selector.appendChild(option);
      }
      actions.appendChild(selector);
    }

    const variationId = firstVariationId(product);
    const button = document.createElement("a");
    button.className = "btn btn--buy";
    button.textContent = variationId ? "Buy" : "View";

    function hrefFor(id){
      return window.Site?.join(`cart.html?variationId=${encodeURIComponent(id)}&quantity=1`);
    }

    button.href = variationId ? hrefFor(variationId) : window.Site?.join("product.html");
    if (selector) {
      selector.addEventListener("change", () => {
        button.href = hrefFor(selector.value);
      });
    }

    actions.appendChild(button);
    return article;
  }

  async function render(){
    const grid = document.getElementById("grid");
    if (!grid) return;
    try {
      const products = await window.Site.loadCatalog();
      grid.innerHTML = "";
      for (const product of products) {
        grid.appendChild(buildCard(product));
      }
    } catch (err) {
      grid.innerHTML = `<div class="subtle">Could not load products. ${err?.message || "Missing data/products.json"}</div>`;
      console.error(err);
    }
  }

  document.addEventListener("DOMContentLoaded", render);
})();
