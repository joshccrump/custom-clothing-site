// scripts/fetch-square.mjs
import fs from "node:fs/promises";
import path from "node:path";

const ENV = (process.env.SQUARE_ENVIRONMENT || "sandbox").toLowerCase();
const TOKEN = process.env.SQUARE_ACCESS_TOKEN?.trim();
const OUTPUT_PATH = process.env.OUTPUT_PATH || "data/products.json";

if (!TOKEN) {
  console.error("❌ Missing SQUARE_ACCESS_TOKEN");
  process.exit(1);
}

const BASE =
  ENV === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: "application/json",
  "Square-Version": "2025-09-18",
};

async function listCatalogItems() {
  const out = [];
  let cursor = undefined;

  do {
    const url = new URL(`${BASE}/v2/catalog/list`);
    url.searchParams.set("types", "ITEM");
    if (cursor) url.searchParams.set("cursor", cursor);

    const res = await fetch(url, { headers });
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }

    if (!res.ok) {
      console.error(`❌ Catalog list failed: ${res.status}`);
      console.error(body);
      process.exit(1);
    }

    const objs = body.objects || [];
    for (const o of objs) {
      out.push({
        id: o.id,
        type: o.type,
        name: o.itemData?.name || "(unnamed)",
        description: o.itemData?.description || "",
        variations: (o.itemData?.variations ?? []).map((v) => ({
          id: v.id,
          name: v.itemVariationData?.name || "",
          price: v.itemVariationData?.priceMoney?.amount ?? null,
          currency: v.itemVariationData?.priceMoney?.currency ?? null,
          sku: v.itemVariationData?.sku || null,
        })),
      });
    }
    cursor = body.cursor;
  } while (cursor);

  return out;
}

async function main() {
  console.log("=== Square catalog sync (no-SDK) ===");
  console.log("Environment:", ENV);

  const items = await listCatalogItems();

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(
    OUTPUT_PATH,
    JSON.stringify(
      { generatedAt: new Date().toISOString(), count: items.length, items },
      null,
      2
    )
  );
  console.log(`✅ Wrote ${items.length} items -> ${OUTPUT_PATH}`);
}

main().catch((e) => {
  console.error("Fetch failed:", e);
  process.exit(1);
});
