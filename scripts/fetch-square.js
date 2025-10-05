// scripts/fetch-square.js
// Node 18+ (ESM). Run via: npm run sync:square
// Env: SQUARE_ACCESS_TOKEN (required), SQUARE_ENV=production|sandbox
//      SQUARE_LOCATION_ID or SQUARE_LOCATION_IDS="LOC1,LOC2"
//      OUTPUT_DIR=docs/data (optional), OUTPUT_FILE=products.json (optional)

import fs from "node:fs/promises";
import path from "node:path";

// --- Env ---
const ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN;
if (!ACCESS_TOKEN) {
  console.error("❌ Missing SQUARE_ACCESS_TOKEN");
  process.exit(1);
}
const ENV_RAW = (process.env.SQUARE_ENV || "production").toLowerCase();
const OUTPUT_DIR = process.env.OUTPUT_DIR || "data";
const OUTPUT_FILE = process.env.OUTPUT_FILE || "products.json";
const LOCATION_IDS = (() => {
  const multi = (process.env.SQUARE_LOCATION_IDS || "").trim();
  if (multi) return multi.split(",").map(s => s.trim()).filter(Boolean);
  const single = (process.env.SQUARE_LOCATION_ID || "").trim();
  return single ? [single] : [];
})();

// --- Load Square SDK safely for BOTH new and legacy shapes ---
const SqMod = await import("square").catch(e => {
  console.error("❌ Unable to import 'square' package. Did you run `npm i square`?", e?.message || e);
  process.exit(1);
});

// helper to pick the first defined export
const pick = (...candidates) => candidates.find(Boolean);

// handles both ESM named exports and CJS default export
const M = SqMod.default && typeof SqMod.default === "object" ? { ...SqMod, ...SqMod.default } : SqMod;

// New SDK (v40+) exports
const SquareClient = pick(M.SquareClient);
const SquareEnvironment = pick(M.SquareEnvironment);

// Legacy SDK exports
const Client = pick(M.Client, M.default?.Client);
const Environment = pick(M.Environment, M.default?.Environment);

// Build client for either SDK
let client;
let envEnum;
if (SquareClient && SquareEnvironment) {
  envEnum = ENV_RAW === "production" ? SquareEnvironment.Production : SquareEnvironment.Sandbox;
  client = new SquareClient({ token: ACCESS_TOKEN, environment: envEnum });
} else if (Client && Environment) {
  envEnum = ENV_RAW === "production" ? Environment.Production : Environment.Sandbox;
  client = new Client({
    bearerAuthCredentials: { accessToken: ACCESS_TOKEN },
    environment: envEnum
  });
} else {
  console.error("❌ Could not resolve Square SDK exports (SquareClient/Client). Check your 'square' version.");
  process.exit(1);
}

// --- Helpers ---
const moneyToNumber = (m) => (m && m.amount != null) ? Number(m.amount) / 100 : null;

async function listAllCatalog(typesCsv) {
  let cursor, out = [];
  // New SDK path: client.catalog.list({ types, cursor })
  const useNew = !!client.catalog?.list;
  do {
    if (useNew) {
      const page = await client.catalog.list({ types: typesCsv, cursor });
      out.push(...(page.data ?? page.result ?? page.objects ?? []));
      cursor = page.cursor ?? page.result?.cursor;
    } else {
      // Legacy path: client.catalogApi.listCatalog({ types, cursor })
      const page = await client.catalogApi.listCatalog({ types: typesCsv, cursor });
      out.push(...(page.result.objects ?? []));
      cursor = page.result.cursor;
    }
  } while (cursor);
  return out;
}

async function batchCounts(variationIds, locationIds) {
  const counts = new Map();
  if (!variationIds.length || !locationIds.length) return counts;

  const CHUNK = 100;
  const useNew = !!client.inventory?.counts?.batchRetrieve;

  for (let i = 0; i < variationIds.length; i += CHUNK) {
    const slice = variationIds.slice(i, i + CHUNK);
    let res;
    if (useNew) {
      // New SDK: client.inventory.counts.batchRetrieve({ catalogObjectIds, locationIds })
      res = await client.inventory.counts.batchRetrieve({
        catalogObjectIds: slice,
        locationIds
      });
      for (const c of (res.counts ?? res.result?.counts ?? [])) {
        const id = c.catalogObjectId;
        const qty = Number(c.quantity ?? 0);
        counts.set(id, (counts.get(id) ?? 0) + qty);
      }
    } else {
      // Legacy: client.inventoryApi.batchRetrieveInventoryCounts(...)
      res = await client.inventoryApi.batchRetrieveInventoryCounts({
        catalogObjectIds: slice,
        locationIds
      });
      for (const c of (res.result.counts ?? [])) {
        const id = c.catalogObjectId;
        const qty = Number(c.quantity ?? 0);
        counts.set(id, (counts.get(id) ?? 0) + qty);
      }
    }
  }
  return counts;
}

const extractCustomAttributes = (obj) => {
  const out = {};
  const cav = obj?.customAttributeValues ?? obj?.customAttributes ?? null;
  if (cav && typeof cav === "object") {
    for (const [k, v] of Object.entries(cav)) {
      if (v && typeof v === "object" && "value" in v) out[k] = v.value;
      else if (v && typeof v === "object" && "stringValue" in v)
        out[k] = v.stringValue ?? v.numberValue ?? v.booleanValue ?? v.selectionUidValues ?? null;
      else out[k] = v;
    }
  }
  return out;
};

const deriveOptionsFromName = (name) =>
  (name || "").split(/[\/,•|>-]/).map(s => s.trim()).filter(Boolean);

function getMainImageUrl(item, imageMap) {
  const ids = item?.itemData?.imageIds ?? [];
  for (const id of ids) {
    const img = imageMap.get(id);
    if (img?.imageData?.url) return img.imageData.url;
  }
  return null;
}

// --- Main ---
(async () => {
  console.log("🔎 Fetching Square catalog…");
  const types = "ITEM,ITEM_VARIATION,IMAGE,CATEGORY";
  const all = await listAllCatalog(types);

  const imageMap = new Map();
  const itemMap  = new Map();
  const varMap   = new Map();
  const catMap   = new Map();

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
      custom: extractCustomAttributes(v)
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
      createdAt: item.createdAt
    };

    // fallback thumbnail from any variation image
    if (!prod.thumbnail) {
      for (const v of variationsRaw) {
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

  // Write output
  const outDir = path.resolve(process.cwd(), OUTPUT_DIR);
  await fs.mkdir(outDir, { recursive: true });
  const outFile = path.join(outDir, OUTPUT_FILE);
  await fs.writeFile(outFile, JSON.stringify(products, null, 2));
  console.log(`✅ Wrote ${outFile} (${products.length} items)`);
})().catch(err => {
  console.error("❌ Sync failed:", err?.message || err);
  process.exit(1);
});
