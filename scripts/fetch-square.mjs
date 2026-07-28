// scripts/fetch-square.mjs
// Filtered writer: honors env filters (see catalog-dryrun.mjs header for all options).
// Refuses to write if nothing passes filters.
// Node 18+ required.
//
// FIX (2026-07): Square's REST API returns snake_case fields (item_data,
// price_money, image_ids, ...). This script previously read camelCase
// (itemData, priceMoney, imageIds), so every item exported empty
// ("(unnamed)", no price, no variations). Field access corrected to snake_case.

import { readFile } from "node:fs/promises";
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

const ENV  = (process.env.SQUARE_ENVIRONMENT || "production").toLowerCase();
const BASE = ENV === "sandbox" ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";
const TOKEN = process.env.SQUARE_ACCESS_TOKEN || "";
const LOC   = (process.env.SQUARE_LOCATION_ID || "").trim();
const OUT   = process.env.OUTPUT_PATH || "data/products.json";

const OPT = {
  onlyPresentAtLocation: /^true$/i.test(process.env.FILTER_ONLY_PRESENT_AT_LOCATION || ""),
  onlyWithPrice:         /^true$/i.test(process.env.FILTER_ONLY_WITH_PRICE || ""),
  onlyInStock:           /^true$/i.test(process.env.FILTER_ONLY_IN_STOCK || ""),
  onlyWithImage:         /^true$/i.test(process.env.FILTER_ONLY_WITH_IMAGE || ""),
  categoryAllowlist:     (process.env.FILTER_CATEGORY_ALLOWLIST || "").split(",").map(s=>s.trim()).filter(Boolean),
  categoryBlocklist:     (process.env.FILTER_CATEGORY_BLOCKLIST || "").split(",").map(s=>s.trim()).filter(Boolean),
  customAttrKey:         (process.env.FILTER_CUSTOM_ATTR_KEY || "").trim(),
  customAttrValue:       (process.env.FILTER_CUSTOM_ATTR_VALUE || "").trim(),
};

function fail(msg, extra){ console.error(`❌ ${msg}`); if (extra) console.error(extra); process.exit(1); }
function ok(msg){ console.log(`✅ ${msg}`); }

if (!TOKEN) fail("Missing SQUARE_ACCESS_TOKEN.");

async function sqGET(path, params = {}) {
  const url = new URL(path, BASE);
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Square-Version": "2025-01-22",
      "Content-Type": "application/json",
    },
  });
  const txt = await res.text();
  if (!res.ok) fail(`${path} ${res.status}`, txt);
  try { return JSON.parse(txt); } catch { return {}; }
}

function indexById(list) {
  const m = new Map();
  for (const o of list || []) if (o && o.id) m.set(o.id, o);
  return m;
}

async function fetchAllCatalog() {
  const objects = [];
  let cursor = null;
  do {
    const json = await sqGET("/v2/catalog/list", { types: "ITEM,ITEM_VARIATION,IMAGE,CATEGORY", cursor });
    if (Array.isArray(json.objects)) objects.push(...json.objects);
    cursor = json.cursor || null;
  } while (cursor);
  return objects;
}

function attachImages(items, images) {
  const img = indexById(images);
  for (const it of items) {
    const d = it.item_data || {};
    const url = d.image_ids?.length ? img.get(d.image_ids[0])?.image_data?.url : null;
    it._imageUrl = url || null;
  }
}

function categoryName(catId, catById) {
  const c = catById.get(catId);
  return c?.category_data?.name || null;
}

function itemCategoryName(item, catById) {
  const d = item.item_data || {};
  // Square is migrating from item_data.category_id to item_data.categories[].
  const catId = d.category_id || d.categories?.[0]?.id || null;
  return catId ? categoryName(catId, catById) : null;
}

function passesFilters(item, variations, catById, inventoryCounts) {
  const d = item.item_data || {};
  const catName = itemCategoryName(item, catById);

  if (OPT.categoryAllowlist.length && (!catName || !OPT.categoryAllowlist.includes(catName))) return false;
  if (OPT.categoryBlocklist.length && (catName && OPT.categoryBlocklist.includes(catName))) return false;

  if (OPT.onlyPresentAtLocation && LOC) {
    const present = d.present_at_all_locations || (d.present_at_location_ids || []).includes(LOC);
    if (!present) return false;
  }

  if (OPT.onlyWithImage && !item._imageUrl) return false;

  let pricedVars = variations.filter(v => {
    const pm = v.item_variation_data?.price_money;
    return pm && typeof pm.amount === "number";
  });
  if (OPT.onlyWithPrice && pricedVars.length === 0) return false;

  if (OPT.onlyInStock && LOC) {
    const anyInStock = pricedVars.some(v => {
      const qty = Number(inventoryCounts[v.id] ?? 0);
      return qty > 0;
    });
    if (!anyInStock) return false;
  }

  if (OPT.customAttrKey) {
    const ca = (d.custom_attribute_values || {});
    const val = ca[OPT.customAttrKey]?.string_value || ca[OPT.customAttrKey]?.number_value || ca[OPT.customAttrKey]?.selection_uid_values?.[0] || "";
    if (OPT.customAttrValue && String(val).toLowerCase() !== OPT.customAttrValue.toLowerCase()) return false;
    if (!OPT.customAttrValue && (val === "" || val == null)) return false;
  }

  return true;
}

async function fetchInventoryCounts(locId, variationIds) {
  if (!variationIds.length || !locId) return {};
  const ids = [...new Set(variationIds)];
  const chunk = 200, out = {};
  for (let i = 0; i < ids.length; i += chunk) {
    const slice = ids.slice(i, i + chunk);
    const res = await fetch(new URL("/v2/inventory/batch-retrieve-counts", BASE), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Square-Version": "2025-01-22",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ catalog_object_ids: slice, location_ids: [locId] }),
    });
    const txt = await res.text();
    if (!res.ok) fail("/v2/inventory/batch-retrieve-counts failed", txt);
    const json = JSON.parse(txt);
    for (const c of json.counts || []) out[c.catalog_object_id] = Number(c.quantity || "0");
  }
  return out;
}

function toSiteItem(item, variations) {
  const d = item.item_data || {};
  const firstVar = variations.find(v => typeof v.item_variation_data?.price_money?.amount === "number") || variations[0];
  const price = firstVar?.item_variation_data?.price_money?.amount ?? null;
  const currency = firstVar?.item_variation_data?.price_money?.currency ?? "USD";
  return {
    id: item.id,
    type: "ITEM",
    name: d.name || "(unnamed)",
    description: d.description || "",
    imageUrl: item._imageUrl || null,
    variations: variations.map(v => {
      const vd = v.item_variation_data || {};
      const pm = vd.price_money || {};
      const amount = typeof pm.amount === "number" ? pm.amount : null;
      return {
        id: v.id,
        name: vd.name || "",
        // Square amounts are in MINOR units (cents). priceMoney matches Square's
        // native shape; the storefront's moneyFromSquare() divides amount by 100.
        // Without this the display renders 100x too high (e.g. $15.00 -> $1,500.00).
        priceMoney: amount != null ? { amount, currency: pm.currency || "USD" } : null,
        price: amount,            // raw Square amount in minor units (cents)
        currency: pm.currency || "USD",
        sku: vd.sku || null,
      };
    }),
    priceMoney: price != null ? { amount: price, currency } : null,
    price,                        // raw Square amount in minor units (cents)
    currency,
  };
}

(async function main(){
  console.log("=== Filtered Catalog Sync ===");
  console.log("ENV:", ENV);
  console.log("LOC:", LOC || "(none)");
  console.log("Filters:", OPT);

  // Load catalog
  const all = await fetchAllCatalog();
  const items = all.filter(o => o.type === "ITEM");
  const vars  = all.filter(o => o.type === "ITEM_VARIATION");
  const imgs  = all.filter(o => o.type === "IMAGE");
  const cats  = all.filter(o => o.type === "CATEGORY");
  const catById = indexById(cats);

  // group variations by item & attach images
  const itemIdForVar = new Map();
  for (const it of items) {
    const d = it.item_data || {};
    for (const v of d.variations || []) itemIdForVar.set(v.id, it.id);
  }
  const varsByItem = new Map();
  for (const v of vars) {
    const vd = v.item_variation_data || {};
    const parent = vd.item_id || itemIdForVar.get(v.id);
    if (!parent) continue;
    if (!varsByItem.has(parent)) varsByItem.set(parent, []);
    varsByItem.get(parent).push(v);
  }
  attachImages(items, imgs);

  const invCounts = await fetchInventoryCounts(LOC, vars.map(v => v.id));

  // Apply filters
  const passing = [];
  for (const it of items) {
    const vlist = varsByItem.get(it.id) || [];
    if (passesFilters(it, vlist, catById, invCounts)) {
      passing.push(toSiteItem(it, vlist));
    }
  }

  if (!passing.length) fail("No items passed filters. Nothing written.");

  // Write
  await (async () => {
    await mkdir(dirname(OUT), { recursive: true });
    await writeFile(OUT, JSON.stringify({ generatedAt: new Date().toISOString(), count: passing.length, items: passing }, null, 2), "utf8");
  })();

  ok(`Wrote ${passing.length} filtered items → ${OUT}`);
})().catch(e=>fail("Unexpected error", e));
