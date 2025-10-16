// scripts/catalog-dryrun.mjs
// Dry-run Square Catalog fetch with filters (no file writes).
// Node 18+ (global fetch).
// Env controls (all optional):
//   SQUARE_ENVIRONMENT=production|sandbox
//   SQUARE_ACCESS_TOKEN=EAAA...
//   SQUARE_LOCATION_ID=L... (recommended for presence/inventory)
//   FILTER_ONLY_PRESENT_AT_LOCATION=true|false
//   FILTER_ONLY_WITH_PRICE=true|false
//   FILTER_ONLY_IN_STOCK=true|false
//   FILTER_ONLY_WITH_IMAGE=true|false
//   FILTER_CATEGORY_ALLOWLIST="Hats,Shirts"    (comma-separated names)
//   FILTER_CATEGORY_BLOCKLIST="Gift Card"      (comma-separated names)
//   FILTER_CUSTOM_ATTR_KEY="channel" + FILTER_CUSTOM_ATTR_VALUE="online" (match on item custom attrs)

const ENV  = (process.env.SQUARE_ENVIRONMENT || "production").toLowerCase();
const BASE = ENV === "sandbox" ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";
const TOKEN = process.env.SQUARE_ACCESS_TOKEN || "";
const LOC   = (process.env.SQUARE_LOCATION_ID || "").trim();

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
function info(msg){ console.log(`ℹ️  ${msg}`); }

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
    const d = it.itemData || {};
    const url = d.imageIds?.length ? img.get(d.imageIds[0])?.imageData?.url : null;
    it._imageUrl = url || null;
  }
}

function categoryName(catId, catById) {
  const c = catById.get(catId);
  return c?.categoryData?.name || null;
}

function itemCategoryName(item, catById) {
  const d = item.itemData || {};
  return categoryName(d.categoryId, catById);
}

function passesFilters(item, variations, catById, inventoryCounts) {
  const d = item.itemData || {};
  const catName = itemCategoryName(item, catById);

  if (OPT.categoryAllowlist.length && (!catName || !OPT.categoryAllowlist.includes(catName))) return false;
  if (OPT.categoryBlocklist.length && (catName && OPT.categoryBlocklist.includes(catName))) return false;

  if (OPT.onlyPresentAtLocation && LOC) {
    const present = d.presentAtAllLocations || (d.presentAtLocationIds || []).includes(LOC);
    if (!present) return false;
  }

  if (OPT.onlyWithImage && !item._imageUrl) return false;

  let pricedVars = variations.filter(v => {
    const pm = v.itemVariationData?.priceMoney;
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

  // Custom attribute filter on the ITEM (not variation)
  if (OPT.customAttrKey) {
    const ca = (d.customAttributeValues || {});
    const val = ca[OPT.customAttrKey]?.stringValue || ca[OPT.customAttrKey]?.numberValue || ca[OPT.customAttrKey]?.selectionUidValues?.[0] || "";
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

(async function main(){
  console.log("=== Catalog Dry Run (env filters) ===");
  console.log("ENV:", ENV);
  console.log("LOC:", LOC || "(none)");

  const all = await fetchAllCatalog();
  const items = all.filter(o => o.type === "ITEM");
  const vars  = all.filter(o => o.type === "ITEM_VARIATION");
  const imgs  = all.filter(o => o.type === "IMAGE");
  const cats  = all.filter(o => o.type === "CATEGORY");
  const catById = indexById(cats);

  attachImages(items, imgs);

  // group variations by item
  const itemIdForVar = new Map();
  for (const it of items) {
    const d = it.itemData || {};
    for (const v of d.variations || []) itemIdForVar.set(v.id, it.id);
  }
  const varsByItem = new Map();
  for (const v of vars) {
    const vd = v.itemVariationData || {};
    const parent = vd.itemId || itemIdForVar.get(v.id);
    if (!parent) continue;
    if (!varsByItem.has(parent)) varsByItem.set(parent, []);
    varsByItem.get(parent).push(v);
  }

  const invCounts = await fetchInventoryCounts(LOC, vars.map(v => v.id));

  const passing = [];
  for (const it of items) {
    const vlist = varsByItem.get(it.id) || [];
    if (passesFilters(it, vlist, catById, invCounts)) {
      passing.push(it);
    }
  }

  console.log(`Total ITEM objects: ${items.length}`);
  console.log(`Passing filters: ${passing.length}`);
  console.log("Filters:", OPT);

  console.log("\nSample (up to 10):");
  for (const it of passing.slice(0,10)) {
    const d = it.itemData || {};
    const cat = d.categoryId ? (catById.get(d.categoryId)?.categoryData?.name || "") : "";
    console.log(`- ${d.name || "(unnamed)"}  [${cat}]  image=${Boolean(it._imageUrl)}`);
  }

  ok("Dry run finished.");
})().catch(e=>fail("Unexpected error", e));
