// assets/js/catalog.js
function getBasePath() {
  const parts = window.location.pathname.split("/").filter(Boolean);
  if (parts.length > 0 && parts[0] !== "assets" && parts[0] !== "data") {
    return `/${parts[0]}`;
  }
  return "";
}
export const BASE_PATH = getBasePath();
export const DATA_URL = `${BASE_PATH}/data/products.json`;
export async function loadCatalog() {
  let res;
  try { res = await fetch(DATA_URL, { cache: "no-store" }); }
  catch (err) { throw new Error(`Network error while fetching ${DATA_URL}: ${err.message}`); }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Failed to fetch ${DATA_URL} (${res.status}). ${text || ""}`);
  }
  let json;
  try { json = await res.json(); }
  catch (err) { throw new Error(`Could not parse JSON from ${DATA_URL}: ${err.message}`); }
  const items = Array.isArray(json) ? json : (Array.isArray(json.items) ? json.items : []);
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error(`Catalog contained 0 items at ${DATA_URL}.`);
  }
  const normalized = items.map((it) => {
    const firstVar = Array.isArray(it.variations) && it.variations.length ? it.variations[0] : null;
    const price = firstVar && typeof firstVar.price === "number" ? firstVar.price : null;
    const currency = firstVar && firstVar.currency ? firstVar.currency : "USD";
    return {
      id: it.id || crypto.randomUUID(),
      name: it.name || "(unnamed)",
      description: it.description || "",
      imageUrl: it.imageUrl || "",
      price,
      currency,
      variations: Array.isArray(it.variations) ? it.variations : [],
      _raw: it,
    };
  });
  return normalized;
}
export function formatMoney(cents, currency = "USD") {
  if (typeof cents !== "number") return "";
  try { return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100); }
  catch { return `$${(cents / 100).toFixed(2)}`; }
}
