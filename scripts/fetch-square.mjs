// scripts/fetch-square.mjs
// Node 20+ | ESM | Square SDK v40–v43+ compatible (CJS/ESM, old/new class & method names)
// Adds preflight auth + location checks to avoid opaque 401s.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Normalize the Square SDK module (CJS default or ESM)
import sq from "square";
const mod = sq?.default ?? sq;

// Resolve client constructor across versions
const Client =
  mod?.Client || mod?.SquareClient || sq?.Client || sq?.SquareClient;

// Resolve environment enum across versions
const EnvEnum =
  mod?.Environment ||
  mod?.SquareEnvironment ||
  mod?.environments ||
  sq?.Environment ||
  sq?.SquareEnvironment ||
  sq?.environments;

if (!Client || !EnvEnum) {
  console.error("Square SDK not found or unsupported shape. Check that 'square' is installed.");
  console.error("Available keys:", Object.keys(mod || {}));
  process.exit(1);
}

// ---- Read env
const ACCESS_TOKEN = (process.env.SQUARE_ACCESS_TOKEN || "").trim();
const LOCATION_ID  = (process.env.SQUARE_LOCATION_ID || "").trim();
const RAW_ENV      = (process.env.SQUARE_ENV || process.env.SQUARE_ENVIRONMENT || "production").toLowerCase();
const OUT_PATH     = process.env.OUTPUT_PATH || "data/products.json";

// Basic env validation
if (!ACCESS_TOKEN) {
  console.error("Missing SQUARE_ACCESS_TOKEN (GitHub Actions secret).");
  console.error("Tips: set repo Settings → Secrets and variables → Actions → New repository secret.");
  console.error("Note: secrets do NOT pass to workflows from forked PRs.");
  process.exit(1);
}
if (!LOCATION_ID) {
  console.error("Missing SQUARE_LOCATION_ID (GitHub Actions secret).");
  console.error("Get it from Square Dashboard → Locations. Use the ID, not the name.");
  process.exit(1);
}

// Map environment (handles old/new enum names)
const environment =
  RAW_ENV === "sandbox"
    ? (EnvEnum.Sandbox ?? EnvEnum.SANDBOX ?? EnvEnum.sandbox ?? "sandbox")
    : (EnvEnum.Production ?? EnvEnum.PRODUCTION ?? EnvEnum.production ?? "production");

// Init client
const client = new Client({ accessToken: ACCESS_TOKEN, environment });

// ---- Helpers that adapt to multiple SDK shapes

async function* iterLocations() {
  // Newer style
  if (client.locations?.list) {
    const pager = await client.locations.list();
    if (pager && pager[Symbol.asyncIterator]) {
      for await (const loc of pager) yield loc;
      return;
    }
    if (pager?.data) {
      let page = pager;
      while (page) {
        for (const l of page.data) yield l;
        page = page.hasNextPage ? await page.getNextPage() : null;
      }
      return;
    }
  }
  // Legacy style
  if (client.locationsApi?.listLocations) {
    const resp = await client.locationsApi.listLocations();
    const res = resp?.result ?? resp;
    const arr = res?.locations || [];
    for (const l of arr) yield l;
    return;
  }
  throw new Error("Could not find a compatible Locations list method on the Square SDK client.");
}

async function* iterCatalogObjects(types = ["ITEM", "ITEM_VARIATION", "IMAGE"]) {
  const typesCsv = types.join(",");

  // Newer catalog surface
  if (client.catalog?.list) {
    const pager = await client.catalog.list({ types: typesCsv });
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
  // Variant naming
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
  // Legacy API
  if (client.catalogApi?.listCatalog || client.catalogApi?.list) {
    let cursor;
    const call = client.catalogApi.listCatalog
      ? (c) => client.catalogApi.listCatalog({ cursor: c, types: typesCsv })
      : (c) => client.catalogApi.list({ cursor: c, types: typesCsv });

    do {
      const resp = await call(cursor);
      const res = resp?.result ?? resp;
      const objs = res?.objects || [];
      for (const o of objs) yield o;
      cursor = res?.cursor || null;
    } while (cursor);
    return;
  }

  throw new Error("Could not find a compatible Catalog list method on the Square SDK client.");
}

const moneyToNumber = (m) => (m && typeof m.amount === "number" ? m.amount / 100 : null);
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

// ---- Preflight auth + location validation
async function preflight() {
  try {
    const locs = [];
    for await (const l of iterLocations()) locs.push(l);

    if (!locs.length) {
      console.error("Auth OK but no locations returned for this token.");
      console.error("Check that the token belongs to a Square account with active locations.");
      process.exit(1);
    }

    const ids = new Set(locs.map((l) => l.id));
    if (!ids.has(LOCATION_ID)) {
      console.error("Auth OK but SQUARE_LOCATION_ID does not match any accessible location.");
      console.error("Provided LOCATION_ID:", LOCATION_ID);
      console.error("Accessible IDs:", [...ids].join(", "));
      console.error("Fix: set the correct SQUARE_LOCATION_ID (Dashboard → Locations → copy ID).");
      process.exit(1);
    }
  } catch (err) {
    const status = err?.statusCode || err?.rawResponse?.status;
    if (status === 401) {
      console.error("Authentication failed (401). Common fixes:");
      console.error("• Token/env mismatch: Use a sandbox token with SQUARE_ENVIRONMENT=sandbox, or a production token with SQUARE_ENVIRONMENT=production.");
      console.error("• Secret missing in this workflow: ensure SQUARE_ACCESS_TOKEN is set as a repo secret (not only an org secret blocked by policy).");
      console.error("• Secrets don’t pass to forked PRs: run the workflow from a branch in this repo or use workflow_dispatch.");
      console.error("• Revoked/expired token: create a new access token in Square Developer Dashboard and update the secret.");
      process.exit(1);
    }
    throw err; // unknown failure — let main() surface it
  }
}

async function main() {
  console.log(`Environment: ${RAW_ENV} | Location: ${LOCATION_ID}`);
  await preflight();

  console.log("Fetching Square catalog…");
  const all = [];
  for await (const obj of iterCatalogObjects()) all.push(obj);

  const products = buildProducts(all);

  const __filename = fileURLToPath(import.meta.url);
  const __dirname  = path.dirname(__filename);
  const OUT_FILE   = path.resolve(__dirname, "..", OUT_PATH);

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(OUT_FILE, JSON.stringify({ locationId: LOCATION_ID, env: RAW_ENV, products }, null, 2));
  console.log(`Wrote ${products.length} products → ${path.relative(process.cwd(), OUT_FILE)}`);
}

main().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
