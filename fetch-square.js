// Fetch products from Square and emit data/products.json for the static site.
import { SquareClient, SquareEnvironment } from "square";
import fs from "node:fs/promises";
import path from "node:path";

const ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN;
if (!ACCESS_TOKEN) { console.error("Missing SQUARE_ACCESS_TOKEN"); process.exit(1); }
const ENV = (process.env.SQUARE_ENV || "production").toLowerCase() === "production"
  ? SquareEnvironment.Production : SquareEnvironment.Sandbox;
const LOCATION_ID = process.env.SQUARE_LOCATION_ID || null;

const client = new SquareClient({ token: ACCESS_TOKEN, environment: ENV });
const catalogApi = client.catalogApi;
const inventoryApi = client.inventoryApi;

async function listAllCatalog(typesCsv) {
  let cursor = undefined; const objects = [];
  do {
    const res = await catalogApi.listCatalog({ types: typesCsv, cursor });
    objects.push(...(res.result.objects ?? []));
    cursor = res.result.cursor;
  } while (cursor);
  return objects;
}
function moneyToNumber(m) { if (!m) return null; const amt = Number(m.amount ?? 0); const denom = Math.pow(10, m.decimalPlaces ?? 2); return amt/denom; }
function getMainImageUrl(item, imageMap) {
  const ids = item?.itemData?.imageIds ?? [];
  for (const id of ids) { const img = imageMap.get(id); if (img?.imageData?.url) return img.imageData.url; }
  return null;
}
async function batchCounts(variationIds, locationId) {
  if (!variationIds.length || !locationId) return new Map();
  const counts = new Map();
  const chunk = 100;
  for (let i=0; i<variationIds.length; i+=chunk) {
    const slice = variationIds.slice(i, i+chunk);
    const res = await inventoryApi.batchRetrieveInventoryCounts({ catalogObjectIds: slice, locationIds: [locationId] });
    for (const c of (res.result.counts ?? [])) {
      const k = c.catalogObjectId; const qty = Number(c.quantity ?? 0); const prev = counts.get(k) ?? 0; counts.set(k, prev + qty);
    }
  }
  return counts;
}
function extractCustom(obj) {
  const out = {}; const cav = obj?.customAttributeValues ?? obj?.customAttributes ?? null;
  if (cav && typeof cav === "object") {
    for (const [k,v] of Object.entries(cav)) {
      if (v && typeof v === "object" && "value" in v) out[k] = v.value;
      else if (v && typeof v === "object" && "stringValue" in v) out[k] = v.stringValue ?? v.numberValue ?? v.booleanValue ?? v.selectionUidValues ?? null;
      else out[k] = v;
    }
  }
  return out;
}
function deriveOptionsFromName(name) { if (!name) return []; return name.split(/[\/,•|>-]/).map(s=>s.trim()).filter(Boolean); }

async function main() {
  const types = "ITEM,ITEM_VARIATION,IMAGE,CATEGORY";
  const all = await listAllCatalog(types);
  const imageMap = new Map(); const itemMap = new Map(); const varMap = new Map(); const catMap = new Map();
  for (const o of all) {
    if (o.type === "IMAGE") imageMap.set(o.id, o);
    else if (o.type === "ITEM") itemMap.set(o.id, o);
    else if (o.type === "ITEM_VARIATION") varMap.set(o.id, o);
    else if (o.type === "CATEGORY") catMap.set(o.id, o);
  }
  const variationIds = Array.from(varMap.keys());
  const counts = await batchCounts(variationIds, LOCATION_ID);

  const products = [];
  for (const item of itemMap.values()) {
    const vIds = item?.itemData?.variations?.map(v => v.id).filter(Boolean) ?? [];
    const vars = vIds.map(id => varMap.get(id)).filter(Boolean);
    const variations = vars.map(v => ({
      id: v.id,
      name: v.itemVariationData?.name ?? "",
      sku: v.itemVariationData?.sku ?? "",
      price: moneyToNumber(v.itemVariationData?.priceMoney),
      currency: v.itemVariationData?.priceMoney?.currency ?? "USD",
      stock: Number(counts.get(v.id) ?? 0),
      custom: extractCustom(v)
    }));
    const prices = variations.map(v => v.price).filter(n => typeof n === "number");
    const priceMin = prices.length ? Math.min(...prices) : null;
    const priceMax = prices.length ? Math.max(...prices) : null;
    const sizeTokens = new Set(); for (const v of variations) deriveOptionsFromName(v.name).forEach(t => sizeTokens.add(t));
    const categoryId = item.itemData?.categoryId; const category = categoryId ? (catMap.get(categoryId)?.categoryData?.name ?? null) : null;
    const custom = extractCustom(item);
    const prod = {
      id: item.id,
      title: item.itemData?.name ?? "Untitled",
      description: item.itemData?.description ?? "",
      thumbnail: getMainImageUrl(item, imageMap),
      category,
      tags: item.itemData?.availableOnline ? ["online"] : [],
      variations,
      price_min: priceMin,
      price_max: priceMax,
      currency: variations[0]?.currency ?? "USD",
      sizes: Array.from(sizeTokens),
      url: custom.product_url || custom.external_url || null,
      custom,
      status: "active",
      stock: variations.reduce((a,v)=>a+(Number.isFinite(v.stock)?v.stock:0),0),
      createdAt: item.createdAt
    };
    // Fallback: pick a variation image if item has none
    if (!prod.thumbnail) {
      for (const v of vars) {
        const ids = v?.itemVariationData?.imageIds ?? [];
        for (const id of ids) {
          const img = imageMap.get(id);
          if (img?.imageData?.url) { prod.thumbnail = img.imageData.url; break; }
        }
        if (prod.thumbnail) break;
      }
    }
    products.push(prod);
  }
  await (await import("node:fs/promises")).mkdir("data", { recursive: true });
  await (await import("node:fs/promises")).writeFile("data/products.json", JSON.stringify(products, null, 2));
  console.log(`Wrote data/products.json (${products.length} items)`);
}
main().catch(e=>{console.error(e);process.exit(1)});
