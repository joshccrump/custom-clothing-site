// scripts/fetch-square.js
// Node 18+ (ESM). Run via: npm run sync:square
// Env: SQUARE_ACCESS_TOKEN (required), SQUARE_ENV=production|sandbox
//      SQUARE_LOCATION_ID or SQUARE_LOCATION_IDS="LOC1,LOC2"
//      OUTPUT_DIR=docs/data (optional), OUTPUT_FILE=products.json (optional)

import { Client, Environment } from "square";
import fs from "node:fs/promises";
import path from "node:path";

const ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN;
if (!ACCESS_TOKEN) {
  console.error("❌ Missing SQUARE_ACCESS_TOKEN");
  process.exit(1);
}

const ENV =
  (process.env.SQUARE_ENV || "production").toLowerCase() === "production"
    ? Environment.Production
    : Environment.Sandbox;

const LOCATION_IDS = (() => {
  const multi = (process.env.SQUARE_LOCATION_IDS || "").trim();
  if (multi) return multi.split(",").map(s => s.trim()).filter(Boolean);
  const single = (process.env.SQUARE_LOCATION_ID || "").trim();
  return single ? [single] : [];
})();

const OUTPUT_DIR = process.env.OUTPUT_DIR || "data";
const OUTPUT_FILE = process.env.OUTPUT_FILE || "products.json";

const client = new Client({ accessToken: ACCESS_TOKEN, environment: ENV });
const { catalogApi, inventoryApi } = client;

/** Money → number (USD-style; most currencies use 2 decimals) */
function moneyToNumber(m) {
  if (!m || m.amount == null) return null;
  return Number(m.amount) / 100;
}

/** Pull all catalog objects of given types */
async function listAllCatalog(typesCsv) {
  let cursor;
  const objects = [];
  do {
    const { result } = await catalogApi.listCatalog({ types: typesCsv, cursor });
    objects.push(...(result.objects ?? []));
    cursor = result.cursor;
  } while (cursor);
  return objects;
}

/** Batch inventory counts for many variation IDs (sum across locations if provided) */
async function batchCounts(variationIds, locationIds) {
  const counts = new Map();
  if (!variationIds.length || !locationIds.length) return counts;

  const CHUNK = 100;
  for (let i = 0; i < variationIds.length; i += CHUNK) {
    const slice = variationIds.slice(i, i + CHUNK);
    const { result } = await inventoryApi.batchRetrieveInventoryCounts({
      catalogObjectIds: slice,
      locationIds,
      // states: ["IN_STOCK"], // uncomment if you only want in-stock
    });
    for (const c of result.counts ?? []) {
      const id = c.catalogObjectId;
      const qty = Number(c.quantity ?? 0);
      counts.set(id, (counts.get(id) ?? 0) + qty);
    }
  }
  return counts;
}

function extractCustomAttributes(obj) {
  const out = {};
  const cav = obj?.customAttributeValues ?? obj?.customAttributes ?? null;
  if (cav && typeof cav === "object") {
    for (const [key, val] of Object.entries(cav)) {
      if (val && typeof val === "object" && "value" in val) out[key] = val.value;
      else if (val && typeof val === "object" && "stringValue" in val)
        out[key] =
          val.stringValue ?? val.numberValue ?? val.booleanValue ?? val.selectionUidValues ?? null;
      else out[key] = val;
    }
  }
  return out;
}

function deriveOptionsFromName(name) {
  if (!name) return [];
  return name.split(/[\/,•|>-]/).map(s => s.trim()).filter(Boolean);
}

function getMainImageUrl(item, imageMap) {
  const ids = item?.itemData?.imageIds ?? [];
  for (const id of ids) {
    const img = imageMap.get(id);
    if (img?.imageData?.url) return img.imageData.url;
  }
  return null;
}

(async () => {
  console.log("🔎 Fetching Square catalog…");
  const types = "ITEM,ITEM_VARIATION,IMAGE,CATEGORY";
  const all = await listAllCatalog(types);

  const imageMap = new Map();
  const itemMap = new Map();
  const varMap = new Map();
  const catMap = new Map();

  for (const o of all) {
    if (o.type === "IMAGE") imageMap.set(o.id, o);
    else if (o.type === "ITEM") itemMap.set(o.id, o);
    else if (o.type === "ITEM_VARIATION") varMap.set(o.id, o);
    else if (o.type === "CATEGORY") catMap.set(o.id, o);
  }

  const variationIds = Array.from(varMap.keys());
  const counts = await batchCounts(variationIds, LOCATION_IDS);

  const products = [];

  for (const item of itemMap.values()) {
    const vIds = item?.itemData?.variations?.map(v => v.id).filter(Boolean) ?? [];
    const variationsRaw = vIds.map(id => varMap.get(id)).filter(Boolean);

    const variations = variationsRaw.map(v => ({
      id: v.id,
      name: v.itemVariationData?.name ?? "",
      sku: v.itemVariationData?.sku ?? "",
      price: moneyToNumber(v.itemVariationData?.priceMoney),
      currency: v.itemVariationData?.priceMoney?.currency ?? "USD",
      stock: Number(counts.get(v.id) ?? 0),
      custom: extractCustomAttributes(v),
    }));

    const prices = variations.map(v => v.price).filter(n => typeof n === "number");
    const priceMin = prices.length ? Math.min(...prices) : null;
    const priceMax = prices.length ? Math.max(...prices) : null;

    const sizes = Array.from(new Set(variations.flatMap(v => deriveOptionsFromName(v.name))));

    const categoryId = item.itemData?.categoryId;
    const category = categoryId ? (catMap.get(categoryId)?.categoryData?.name ?? null) : null;

    const custom = extractCustomAttributes(item);
    const productUrl = custom.product_url || custom.external_url || null;

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
      sizes,
      url: productUrl,
      custom,
      status: "active",
      stock: variations.reduce((a, v) => a + (Number.isFinite(v.stock) ? v.stock : 0), 0),
      createdAt: item.createdAt,
    };

    // Fallback thumbnail from any variation image
    if (!prod.thumbnail) {
      for (const v of variationsRaw) {
        const vImgIds = v?.itemVariationData?.imageIds ?? [];
        for (const id of vImgIds) {
          const img = imageMap.get(id);
          if (img?.imageData?.url) {
            prod.thumbnail = img.imageData.url;
            break;
          }
        }
        if (prod.thumbnail) break;
      }
    }

    products.push(prod);
  }

  // Write products.json
  const outDir = path.resolve(process.cwd(), OUTPUT_DIR);
  await fs.mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, OUTPUT_FILE);
  await fs.writeFile(outFile, JSON.stringify(products, null, 2));
  console.log(`✅ Wrote ${outFile} (${products.length} items)`);
})().catch(err => {
  console.error("❌ Sync failed:", err?.message || err);
  process.exit(1);
});
