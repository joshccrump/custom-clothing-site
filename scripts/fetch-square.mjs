// scripts/fetch-square.mjs
// Node 20+ | ESM | Works with Square SDK v40+ (CJS/ESM) and both naming schemes

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Import default (CJS) or ESM and normalize exports
import squareMod from "square";

// Resolve possible export names across SDK versions:
// - v40+ used { Client, Environment }
// - newer docs/tools often use { SquareClient, SquareEnvironment }
const mod = squareMod?.default ?? squareMod;

const Client =
  mod?.Client ??
  mod?.SquareClient ??
  squareMod?.Client ??
  squareMod?.SquareClient;

const EnvEnum =
  mod?.Environment ??
  mod?.SquareEnvironment ??
  mod?.environments ?? // some builds expose this
  squareMod?.Environment ??
  squareMod?.SquareEnvironment ??
  squareMod?.environments;

if (!Client || !EnvEnum) {
  console.error(
    "Square SDK exports not found. Ensure `square` is installed and up to date."
  );
  console.error("Detected keys:", Object.keys(mod || {}));
  process.exit(1);
}

// --- Config from env ---
const ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN;
const LOCATION_ID  = process.env.SQUARE_LOCATION_ID || "";
const RAW_ENV      =
  (process.env.SQUARE_ENV || process.env.SQUARE_ENVIRONMENT || "production")
    .toLowerCase();

if (!ACCESS_TOKEN || !LOCATION_ID) {
  console.error("Missing SQUARE_ACCESS_TOKEN or SQUARE_LOCATION_ID env vars.");
  process.exit(1);
}

// Map our string ('production'|'sandbox') to the enum, handling both shapes
const envValue =
  RAW_ENV === "sandbox"
    ? (EnvEnum.Sandbox ?? EnvEnum.SANDBOX ?? EnvEnum.sandbox ?? "sandbox")
    : (EnvEnum.Production ?? EnvEnum.PRODUCTION ?? EnvEnum.production ?? "production");

// Build Square client (works for both legacy/new constructors)
const client = new Client({
  accessToken: ACCESS_TOKEN,
  environment: envValue,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const OUT_FILE   = path.resolve(__dirname, "..", process.env.OUTPUT_PATH || "data/products.json");

function moneyToNumber(m) {
  return m && typeof m.amount === "number" ? m.amount / 100 : null;
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

const indexById = (objs) => new Map(objs.map(o => [o.id, o]));

function buildProducts(objects) {
  const byId = indexById(objects);
  const items = objects.filter(o => o.type === "ITEM");

  return items.map(item => {
    const d = item.itemData || {};
    const imageIds = new Set([...(d.imageIds || [])]);

    const variations = (d.variations || []).map(v => {
      const vd = v.itemVariationData || {};
      if (vd.imageIds) vd.imageIds.forEach(id => imageIds.add(id));
      return {
        id: v.id,
        name: vd.name || "Default",
        sku: vd.sku || null,
        price: moneyToNumber(vd.priceMoney),
        inventory: null
      };
    }).sort((a,b) => String(a.name).localeCompare(String(b.name)));

    const images = [...imageIds]
      .map(id => byId.get(id))
      .filter(Boolean)
      .map(img => img.imageData?.url)
      .filter(Boolean);

    const modifiers = (d.modifierListInfo || []).map(m => ({
      id: m.modifierListId,
      enabled: m.enabled ?? true
    }));

    const priceFrom = variations.reduce((min, v) => (v.price != null && v.price < min ? v.price : min), Infinity);

    return {
      id: item.id,
      name: d.name,
      description: d.descriptionPlaintext || d.description || "",
      category: d.categoryId || null,
      images,
      variations,
      modifiers,
      priceFrom: Number.isFinite(priceFrom) ? priceFrom : null,
      squareUrl: null,
      updatedAt: item.updatedAt
    };
  });
}

async function main() {
  console.log("Fetching Square catalog…");
  const objects = await fetchAllCatalog();
  const products = buildProducts(objects);

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  const payload = { locationId: LOCATION_ID, env: RAW_ENV, products };
  await fs.writeFile(OUT_FILE, JSON.stringify(payload, null, 2));
  console.log(`Wrote ${products.length} products → ${path.relative(process.cwd(), OUT_FILE)}`);
}

main().catch(err => {
  console.error("Sync failed:", err);
  process.exit(1);
});
