// scripts/build-products-json.mjs
import "./load-env.mjs";

const OUT = process.env.OUTPUT_PATH || "data/products.json";
const ENV = (process.env.SQUARE_ENVIRONMENT || "production").toLowerCase();
const BASE = ENV === "sandbox"
  ? "https://connect.squareupsandbox.com"
  : "https://connect.squareup.com";

const TOKEN = process.env.SQUARE_ACCESS_TOKEN;
if (!TOKEN) {
  console.error("Missing SQUARE_ACCESS_TOKEN.");
  process.exit(1);
}

import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

async function fetchAllCatalog() {
  const objects = [];
  let cursor = null;
  do {
    const url = new URL("/v2/catalog/list", BASE);
    url.searchParams.set("types", "ITEM,ITEM_VARIATION,IMAGE");
    if (cursor) url.searchParams.set("cursor", cursor);

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
        "Square-Version": "2025-01-22",
      },
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Square /catalog/list ${res.status}: ${text}`);
    }
    const json = await res.json();
    if (Array.isArray(json.objects)) objects.push(...json.objects);
    cursor = json.cursor || null;
  } while (cursor);
  return objects;
}

function indexById(objs) {
  const map = new Map();
  for (const o of objs || []) if (o && o.id) map.set(o.id, o);
  return map;
}

function mapToSiteItems(allObjects) {
  const images = allObjects.filter((o) => o.type === "IMAGE");
  const items  = allObjects.filter((o) => o.type === "ITEM");
  const vars   = allObjects.filter((o) => o.type === "ITEM_VARIATION");

  const imgById = indexById(images);
  const varsByItem = new Map();
  for (const v of vars) {
    const itemId = v.itemVariationData?.itemId;
    if (!itemId) continue;
    if (!varsByItem.has(itemId)) varsByItem.set(itemId, []);
    varsByItem.get(itemId).push(v);
  }

  const result = [];
  for (const it of items) {
    const d = it.itemData || {};
    const vlist = varsByItem.get(it.id) || [];

    const mappedVariations = vlist.map((v) => {
      const vd = v.itemVariationData || {};
      const pm = vd.priceMoney || {};
      return {
        id: v.id,
        name: vd.name || "",
        price: typeof pm.amount === "number" ? pm.amount : null,
        currency: pm.currency || "USD",
        sku: vd.sku || null,
      };
    });

    const imageUrl = d.imageIds?.length ? imgById.get(d.imageIds[0])?.imageData?.url : null;

    result.push({
      id: it.id,
      type: "ITEM",
      name: d.name || "(unnamed)",
      description: d.description || "",
      variations: mappedVariations,
      imageUrl,
    });
  }
  return result;
}

(async function main() {
  const objects = await fetchAllCatalog();
  const items = mapToSiteItems(objects);
  const payload = {
    generatedAt: new Date().toISOString(),
    count: items.length,
    items,
  };
  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote ${items.length} items to ${OUT}`);
})().catch((e) => {
  console.error("Build failed:", e);
  process.exit(1);
});