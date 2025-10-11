// scripts/fetch-square.mjs
// Node 20+ | ESM | Square SDK v40+ compatible (CJS/ESM, old/new names)
// Adds a preflight that validates token/env and Location ID to avoid 401 confusion.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Square may export as CJS default or ESM named—normalize:
import squareMod from "square";
const mod = squareMod?.default ?? squareMod;

// Client class across SDK versions
const Client =
  mod?.Client ??
  mod?.SquareClient ??
  squareMod?.Client ??
  squareMod?.SquareClient;

// Environment enum / map across versions
const EnvEnum =
  mod?.Environment ??
  mod?.SquareEnvironment ??
  mod?.environments ??
  squareMod?.Environment ??
  squareMod?.SquareEnvironment ??
  squareMod?.environments;

if (!Client || !EnvEnum) {
  console.error("Square SDK exports not found. Is 'square' installed?");
  console.error("Available keys on module:", Object.keys(mod || {}));
  process.exit(1);
}

// -------- Config --------
const ACCESS_TOKEN = (process.env.SQUARE_ACCESS_TOKEN || "").trim();
const LOCATION_ID  = (process.env.SQUARE_LOCATION_ID || "").trim();
// Accept either SQUARE_ENV or SQUARE_ENVIRONMENT
const RAW_ENV      = (process.env.SQUARE_ENV || process.env.SQUARE_ENVIRONMENT || "production").toLowerCase();

if (!ACCESS_TOKEN) {
  console.error("Missing SQUARE_ACCESS_TOKEN. Add it as a GitHub Actions Secret.");
  process.exit(1);
}
if (!LOCATION_ID) {
  console.error("Missing SQUARE_LOCATION_ID. Add it as a GitHub Actions Secret.");
  process.exit(1);
}

const environment =
  RAW_ENV === "sandbox"
    ? (EnvEnum.Sandbox ?? EnvEnum.SANDBOX ?? EnvEnum.sandbox ?? "sandbox")
    : (EnvEnum.Production ?? EnvEnum.PRODUCTION ?? EnvEnum.production ?? "production");

const client = new Client({ accessToken: ACCESS_TOKEN, environment });

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const OUT_FILE   = path.resolve(__dirname, "..", process.env.OUTPUT_PATH || "data/products.json");

// -------- Helpers --------
const moneyToNumber = (m) => (m && typeof m.amount === "number" ? m.amount / 100 : null);

function maskToken(tok) {
  if (!tok) return "";
  const clean = tok.replace(/\s+/g, "");
  const head = clean.slice(0, 6);
  const tail = clean.slice(-4);
  return `${head}…${tail} (len=${clean.length})`;
}

// Preflight: verify auth + location
async function preflight() {
  console.log("=== Square preflight ===");
  console.log(`Env: ${RAW_ENV} → ${String(environment)}`);
  console.log(`Token: ${maskToken(ACCESS_TOKEN)}`);
  console.log(`Location ID: ${LOCATION_ID}`);

  // 1) List locations to validate token/env; also ensures token has permissions.
  try {
    const res = await (client.locations?.list
      ? client.locations.list()
      : client.locationsApi?.listLocations
      ? client.locationsApi.listLocations()
      : Promise.reject(new Error("No locations API method found on client")));

    const result = res?.result ?? res; // handle various return shapes
    const locations =
      result?.locations ??
      result?.data ??
      (Array.isArray(result) ? result : []);

    if (!Array.isArray(locations) || locations.length === 0) {
      console.warn("Preflight: token valid, but no locations returned.");
    } else {
      const ids = new Set(
        locations.map((loc) => loc.id || loc.location?.id).filter(Boolean)
      );
      if (!ids.has(LOCATION_ID)) {
        console.error(
          "Preflight FAILED: LOCATION_ID not found for this token/environment."
        );
        console.error(
          "Tip: Ensure SQUARE_LOCATION_ID belongs to the SAME account and SAME environment (sandbox vs production) as SQUARE_ACCESS_TOKEN."
        );
        console.error("Locations seen:", [...ids].join(", ") || "(none)");
        process.exit(1);
      }
    }
  } catch (e) {
    // Friendly messages for 401s
    const status = e?.statusCode || e?.rawResponse?.status;
    if (status === 401) {
      console.error("Preflight FAILED: 401 Unauthorized from Square.");
      console.error(
        [
          "- If RAW_ENV=production, you must use a **Production** access token (starts with 'EAAA...' typically).",
          "- If RAW_ENV=sandbox, use a **Sandbox** access token (starts with 'EAAA' as well, but created under Sandbox).",
          "- Confirm the token hasn’t been revoked/expired and has Catalog/Items read scope.",
          "- Verify there are no extra quotes or spaces in your GitHub Secret.",
        ].join("\n")
      );
    } else {
      console.error("Preflight FAILED:", e);
    }
    process.exit(1);
  }

  console.log("Preflight OK: token and Location ID look valid.");
}

// Iterator that works across SDK versions to list catalog objects
async function* iterCatalogObjects(types = ["ITEM", "ITEM_VARIATION", "IMAGE"]) {
  const typesCsv = types.join(",");

  // New-style: client.catalog.list / client.catalogs.list
  if (client.catalog?.list || client.catalogs?.list) {
    const listFn = client.catalog?.list ?? client.catalogs?.list;
    // Try async-iterable pager
    const pager = await listFn({ types: typesCsv });
    if (pager?.[Symbol.asyncIterator]) {
      for await (const obj of pager) yield obj;
      return;
    }
    // Page-by-page fallback
    if (pager?.data) {
      let page = pager;
      while (page) {
        for (const obj of page.data) yield obj;
        page = page.hasNextPage ? await page.getNextPage() : null;
      }
      return;
    }
  }

  // Legacy: client.catalogApi.listCatalog / .list
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

  throw new Error("No compatible catalog list method found on Square client.");
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
          inventory: null,
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
      enabled: m.enabled ?? true,
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
      updatedAt: item.updatedAt,
    };
  });
}

async function main() {
  await preflight();

  console.log("Fetching Square catalog…");
  const all = [];
  for await (const obj of iterCatalogObjects()) all.push(obj);

  const products = buildProducts(all);

  await fs.mkdir(path.dirname(OUT_FILE), { recursive: true });
  await fs.writeFile(
    OUT_FILE,
    JSON.stringify({ locationId: LOCATION_ID, env: RAW_ENV, products }, null, 2)
  );
  console.log(`Wrote ${products.length} products → ${path.relative(process.cwd(), OUT_FILE)}`);
}

main().catch((err) => {
  console.error("Sync failed:", err);
  process.exit(1);
});
