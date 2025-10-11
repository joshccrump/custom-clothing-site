// scripts/fetch-square.mjs
// Node 20+ / pure ESM. Pulls Square Catalog → writes data/products.json

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client, Environment } from "square";

// --- Config from env ---
const ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN;
const LOCATION_ID  = process.env.SQUARE_LOCATION_ID;
const ENV          = (process.env.SQUARE_ENV || "production").toLowerCase();

if (!ACCESS_TOKEN || !LOCATION_ID) {
  console.error("Missing SQUARE_ACCESS_TOKEN or SQUARE_LOCATION_ID env vars.");
  process.exit(1);
}

const envMap = { production: Environment.Production, sandbox: Environment.Sandbox };
const client = new Client({
  accessToken: ACCESS_TOKEN,
  environment: envMap[ENV] ?? Environment.Production,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const OUT_FILE   = path.resolve(__dirname, "..", "data", "products.json");

function moneyToNumber(m) {
  if (!m) return null;
  // Square returns in the smallest unit (cents). Be safe across locales.
  return typeof m.amount === "number" ? m.amount / 100 : null;
}

async function fetchAllCatalog(types = ["ITEM", "ITEM_VARIATION", "IMAGE"]) {
  const out = [];
  let cursor;
  do {
    const resp = await client.catalogApi.listCatalog({ cursor, types: types.join(",") });
    if (resp.result?.objects) out.push(...resp.result.objects);
    cursor = resp.result?.cursor;
  } while (cursor);
  return out;
}

function indexById(objects) {
  const map = new Map();
  for (const o of objects) map.set(o.id, o);
  return map;
}

function buildProducts(objects) {
  const byId = indexById(objects);
  const items = objects.filter((o) => o.type === "ITEM");

  const products = items.map((item) => {
    const data = item.itemData || {};
    // Images: Square links via imageIds on item and variations
    const imageIds = new Set([...(data.imageIds || [])]);

    const variations = (data.variations || [])
      .map((v) => {
        const vd = v.itemVariationData || {};
        if (vd.imageIds) vd.imageIds.forEach((id) => imageIds.add(id));
        return {
          id: v.id,
          name: vd.name || "Default",
          sku: vd.sku || null,
          price: moneyToNumber(vd.priceMoney),
          // You can extend inventory/availability via your Inventory API route later
          inventory: null,
        };
      })
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));

    // Resolve image URLs (Square stores IMAGE objects with URLs in imageData.url)
    const images = [...imageIds]
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((img) => img.imageData?.url)
      .filter(Boolean);

    // Modifiers / options: optional — keep structure light for the static site
    const modifiers = (data.modifierListInfo || []).map((m) => ({
      id: m.modifierListId,
      enabled: m.enabled ?? true,
    }));

    return {
      id: item.id,
      name: data.name,
      description: data.descriptionPlaintext || data.description || "",
      category: data.categoryId || null,
      images,
      variations,
      modifiers,
      // Primary price = lowest variation price (handy for grids)
      priceFrom: variations.reduce((min, v) => (v.price != null && v.price < min ? v.price : min), Infinity),
      // Link back to Square Online if you want to deep-link (optional):
      squareUrl: null,
      updatedAt: item.updatedAt,
    };
  });

  // Clean up Infinity for products that had no priced variations
  for (const p of products) {
    if (!isFinite(p.priceFrom)) p.priceFrom = null;
  }
  return products;
}

async function main() {
  console.log("Fetching Square catalog…");
  const objects = await fetchAllCatalog();
  const products = buildProducts(objects);

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  const json = JSON.stringify({ locationId: LOCATION_ID, env: ENV, products }, null, 2);
  await fs.writeFile(OUT_FILE, json);
  console.log(`Wrote ${products.length} products → ${path.relative(process.cwd(), OUT_FILE)}`);
}

main().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
