// scripts/fetch-square.mjs
// Node 20+ | ESM | Compatible with Square SDK v40+ (legacy & new client/method names)

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Square's package may be CJS or ESM; normalize it:
import squareMod from "square";
const mod = squareMod?.default ?? squareMod;

// Resolve client class across versions
const Client =
  mod?.Client ||           // legacy
  mod?.SquareClient ||     // new
  squareMod?.Client ||
  squareMod?.SquareClient;

// Resolve environment enum across versions
const EnvEnum =
  mod?.Environment ||
  mod?.SquareEnvironment ||
  mod?.environments ||
  squareMod?.Environment ||
  squareMod?.SquareEnvironment ||
  squareMod?.environments;

if (!Client || !EnvEnum) {
  console.error("Square SDK exports not found. Is 'square' installed?");
  console.error("Available keys:", Object.keys(mod || {}));
  process.exit(1);
}

// ---- Env
const ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN;
const LOCATION_ID  = process.env.SQUARE_LOCATION_ID || "";
const RAW_ENV      = (process.env.SQUARE_ENV || process.env.SQUARE_ENVIRONMENT || "production").toLowerCase();

if (!ACCESS_TOKEN || !LOCATION_ID) {
  console.error("Missing SQUARE_ACCESS_TOKEN or SQUARE_LOCATION_ID env vars.");
  process.exit(1);
}

// Map env to the proper enum key regardless of casing/name
const environment =
  RAW_ENV === "sandbox"
    ? (EnvEnum.Sandbox ?? EnvEnum.SANDBOX ?? EnvEnum.sandbox ?? "sandbox")
    : (EnvEnum.Production ?? EnvEnum.PRODUCTION ?? EnvEnum.production ?? "production");

// Build client (works for legacy/new)
const client = new Client({ accessToken: ACCESS_TOKEN, environment });

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const OUT_FILE   = path.resolve(__dirname, "..", process.env.OUTPUT_PATH || "data/products.json");

// ---- Helpers
const moneyToNumber = (m) => (m && typeof m.amount === "number" ? m.amount / 100 : null);

// Try multiple API surfaces/method names to fetch catalog objects across SDK versions
async function* iterCatalogObjects(types = ["ITEM", "ITEM_VARIATION", "IMAGE"]) {
  const typesCsv = types.join(",");

  // 1) NEW SDK pager style: client.catalog.list({ types })
  if (client.catalog?.list) {
    const pager = await client.catalog.list({ types: typesCsv });
    if (pager && pager[Symbol.asyncIterator]) {
      for await (const obj of pager) yield obj;
      return;
    }
    // page-by-page fallback if pager-style not iterable
    if (pager?.data) {
      let page = pager;
      while (page) {
        for (const obj of page.data) yield obj;
        page = page.hasNextPage ? await page.getNextPage() : null;
      }
      return;
    }
  }

  // 2) NEW-ish naming variant: client.catalogs?.list(...)
  if (client.catalogs?.list) {
    const pager = await client.catalogs.list({ types: typesCsv });
    if (pager && pager[Symbol.asyncIterator]) {
      for await (const obj of pager) yield obj;
      return;
    }
    if (pager?.data) {
      let page = pager;
      while (page) {
        for (const obj of page.data) yield obj;
        page = page.hasNextPage ? await page.getNextPage() : null;
      }
      return;
    }
  }

  // 3) LEGACY SDK: client.catalogApi.listCatalog({ cursor, types })
  if (client.catalogApi?.listCatalog || client.catalogApi?.list) {
    let cursor;
    // Prefer listCatalog if present; otherwise list
    const call = client.catalogApi.listCatalog
      ? (c) => client.catalogApi.listCatalog({ cursor: c, types: typesCsv })
      : (c) => client.catalogApi.list({ cursor: c, types: typesCsv });

    do {
      const resp = await call(cursor);
      const res = resp?.result ?? resp; // some builds return { result: {...} }
      const objs = res?.objects || [];
      for (const o of objs) yield o;
      cursor = res?.cursor || null;
    } while (cursor);
    return;
  }

  throw new Error("Could not find a compatible Catalog list method on the Square SDK client.");
}

const indexById = (arr) => new Map(arr.map((o) => [o.id, o]));

function buildProducts(objects) {
  const byId = indexById(objects);
  const items = objects.filter((o) => o.type === "ITEM");

  return items.map((item) => {
    const d = item.itemData || {};
    const imageIds = new Set([...(d.imageIds || [])]);

    const variations = (d.variations || [])
      .map((v) => {
        const vd = v.itemVariationData || {};
        if (vd.imageIds) vd.imageIds.forEach((id) => imageIds.add(id));
        return {
          id: v.id,
          name: vd.name || "Default",
          sku: vd.sku || null,
          price: moneyToNumber(vd.priceMoney),
          inventory: null
        };
      })
      .sort((a, b) => String(a.name).localeCompare(String(b.name)));

    const images = [...imageIds]
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((img) => img.imageData?.url)
      .filter(Boolean);

    const modifiers = (d.modifierListInfo || []).map((m) => ({
      id: m.modifierListId,
      enabled: m.enabled ?? true
    }));

    const priceFrom = variations.reduce(
      (min, v) => (v.price != null && v.price < min ? v.price : min),
      Infinity
    );

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
  const all = [];
  for await (const obj of iterCatalogObjects()) all.push(obj);

  const products = buildProducts(all);

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(
    OUT_FILE,
    JSON.stringify(
      { locationId: LOCATION_ID, env: RAW_ENV, products },
      null,
      2
    )
  );
  console.log(
    `Wrote ${products.length} products → ${path.relative(process.cwd(), OUT_FILE)}`
  );
}

main().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
