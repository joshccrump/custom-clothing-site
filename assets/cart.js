(function(){
  function qs(name){
    return new URLSearchParams(window.location.search).get(name);
  }

  function fmt(amount, currency){
    try {
      return new Intl.NumberFormat(undefined, { style: "currency", currency: currency || "USD" }).format(amount);
    } catch (err) {
      return `$${Number(amount || 0).toFixed(2)}`;
    }
  }

  async function lookupStatic(variationId){
    try {
      const catalog = await window.Site.loadCatalog();
      for (const product of catalog){
        if (!Array.isArray(product.variations)) continue;
        for (const variation of product.variations){
          const id = variation.id || variation.variation_id || variation.variationId;
          if (id === variationId){
            return {
              product,
              variation,
              modifierLists: product.modifier_lists || product.modifiers || []
            };
          }
        }
      }
    } catch (err) {
      console.warn("Static lookup failed", err);
    }
    return null;
  }

  async function fetchCatalogDetails(variationId){
    const path = `/api/catalog?variationId=${encodeURIComponent(variationId)}`;
    const fetcher = window.Site?.apiFetch;
    if (typeof fetcher === "function"){
      const response = await fetcher(path, { cache: "no-store" });
      if (!response.ok) throw new Error(`API ${response.status}`);
      return response.json();
    }

    const metaBase = document.querySelector('meta[name="api-base"]')?.content?.trim() || window.API_BASE;
    if (!metaBase) throw new Error("Missing API base configuration");
    const base = metaBase.replace(/\/+$/, "");
    const response = await fetch(`${base}${path}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`API ${response.status}`);
    return response.json();
  }

  function renderModifierLists(container, lists, onChange){
    container.innerHTML = "";
    for (const list of lists || []){
      const fieldset = document.createElement("fieldset");
      const legend = document.createElement("legend");
      legend.textContent = list.name || "Options";
      fieldset.appendChild(legend);

      const box = document.createElement("div");
      box.className = "mods";
      const multi = list.selectionType === "MULTIPLE" || Number(list.maxSelected || 0) > 1;
      for (const modifier of list.options || []){
        const label = document.createElement("label");
        const input = document.createElement("input");
        input.type = multi ? "checkbox" : "radio";
        input.name = `mod_${list.id || legend.textContent}`;
        input.value = modifier.id;
        const priceMoney = modifier.priceMoney || {};
        input.dataset.price = String(priceMoney.amount || 0);
        input.dataset.currency = priceMoney.currency || "USD";
        const priceLabel = priceMoney.amount ? ` + ${fmt(priceMoney.amount / 100, priceMoney.currency)}` : "";
        const span = document.createElement("span");
        span.textContent = `${modifier.name || "Option"}${priceLabel}`;
        label.appendChild(input);
        label.appendChild(span);
        box.appendChild(label);
      }
      fieldset.appendChild(box);
      container.appendChild(fieldset);
    }

    container.addEventListener("change", () => {
      const checked = container.querySelectorAll("input:checked");
      let total = 0;
      let currency = "USD";
      checked.forEach((node) => {
        const amount = Number(node.dataset.price || "0");
        if (amount){
          total += amount;
          currency = node.dataset.currency || currency;
        }
      });
      onChange(total, currency);
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const mount = document.getElementById("cart");
    if (!mount) return;

    const variationId = qs("variationId");
    const quantity = Math.max(1, parseInt(qs("quantity") || "1", 10));
    if (!variationId){
      mount.innerHTML = `<div class="subtle">Your cart is empty. Visit the <a data-nav-link="shop">Shop</a>.</div>`;
      window.Site?.rewriteAnchors(mount);
      return;
    }

    let details = await lookupStatic(variationId);
    if (!details){
      try {
        details = await fetchCatalogDetails(variationId);
      } catch (err) {
        console.error(err);
        mount.innerHTML = `<div class="subtle">Could not load item details. Ensure your API base points to the deployed Vercel project.</div>`;
        return;
      }
    }

    const product = details.product || {};
    const variation = details.variation || {};
    const lists = details.modifierLists || [];
    const currency = product.currency || variation.currency || "USD";
    const unitPrice = typeof variation.price === "number"
      ? variation.price
      : (typeof product.price === "number" ? product.price : 0);

    mount.innerHTML = `
      <div class="card" style="padding:16px">
        <div class="row">
          <img class="thumb" alt="Item" src="${window.Site?.resolveImage(product.thumbnail)}">
          <div class="meta">
            <h2 class="title">${product.title || product.name || "Selected Item"}</h2>
            <div class="subtle">${variation.name || "Variation"}</div>
            <div id="mod-lists"></div>
            <div class="qty" style="margin-top:10px"><label>Quantity</label> <input id="qty" type="number" min="1" value="${quantity}"></div>
            <div class="totals"><div class="subtle">Unit price: <span id="unit">${fmt(unitPrice, currency)}</span></div><div><strong>Subtotal: <span id="subtotal">${fmt(unitPrice * quantity, currency)}</span></strong></div></div>
            <div style="margin-top:12px"><a class="btn" data-nav-link="shop">← Continue shopping</a> <a class="btn btn--buy" id="pay">Continue to payment</a></div>
          </div>
        </div>
      </div>
    `;

    window.Site?.rewriteAnchors(mount);

    const modifiersBox = document.getElementById("mod-lists");
    const quantityInput = document.getElementById("qty");
    const subtotalNode = document.getElementById("subtotal");
    const payButton = document.getElementById("pay");

    let modifierCents = 0;
    let modifierCurrency = currency;

    function updateSubtotal(){
      const q = Math.max(1, parseInt(quantityInput.value || "1", 10));
      const subtotal = (unitPrice * 100 + modifierCents) * q / 100;
      subtotalNode.textContent = fmt(subtotal, modifierCurrency || currency);
    }

    function selectedModifiers(){
      return Array.from(modifiersBox.querySelectorAll("input:checked")).map((node) => node.value);
    }

    renderModifierLists(modifiersBox, lists, (addedCents, curr) => {
      modifierCents = addedCents;
      modifierCurrency = curr || currency;
      updateSubtotal();
    });

    updateSubtotal();

    payButton.addEventListener("click", () => {
      const q = Math.max(1, parseInt(quantityInput.value || "1", 10));
      const mods = selectedModifiers();
      const url = new URL(window.Site?.join("checkout.html"), window.location.origin);
      url.searchParams.set("variationId", variationId);
      url.searchParams.set("quantity", String(q));
      if (mods.length) url.searchParams.set("mods", mods.join(","));
      window.location.href = url.toString();
    });
  });
})();
