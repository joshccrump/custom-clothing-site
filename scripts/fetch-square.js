// Fetch products from Square and write data/products.json (variations, images, inventory, custom attributes)
import { SquareClient, SquareEnvironment } from "square";
import fs from "node:fs/promises";

const ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN;
const ENV = (process.env.SQUARE_ENV || "production").toLowerCase() === "production"
  ? SquareEnvironment.Production : SquareEnvironment.Sandbox;
const LOCATION_ID = process.env.SQUARE_LOCATION_ID || null;

if (!ACCESS_TOKEN) {
  console.error("Missing SQUARE_ACCESS_TOKEN");
  process.exit(1);
}

const client = new SquareClient({ token: ACCESS_TOKEN, environment: ENV });
const { catalogApi, inventoryApi } = client;

const money = m => (m && typeof m.amount === "number") ? m.amount / 100 : null;

async function listAllCatalog(typesCsv) {
  let cursor; const out = [];
  do {
    const { result } = await catalogApi.listCatalog({ types: typesCsv, cursor });
    out.push(...(result.objects ?? []));
    cursor = result.cursor;
  } while (cursor);
  return out;
}

async function batchCounts(variationIds, locationId) {
  const counts = new Map();
  if (!variationIds.length || !locationId) return counts;
  const CHUNK = 100;
  for (let i = 0; i < variationIds.length; i += CHUNK) {
    const slice = variationIds.slice(i, i + CHUNK);
    const { result } = await inventoryApi.batchRetrieveInventoryCounts({
      catalogObjectIds: slice,
      locationIds: [locationId],
    });
    for (const c of (result.counts ?? [])) {
      const k = c.catalogObjectId;
      const qty = Number(c.quantity ?? 0);
      counts.set(k, (counts.get(k) ?? 0) + qty);
    }
  }
  return counts;
}

const getImage = (item, imageMap) =>
  (item?.itemData?.imageIds ?? [])
    .map(id => imageMap.get(id))
    .find(img => img?.imageData?.url)?.imageData?.url ?? null;

const customAttrs = obj => {
  const cav = obj?.customAttributeValues ?? obj?.customAttributes ?? null;
  const out = {};
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

const splitOptions = name =>
  (name || "").split(/[\/,•|>-]/).map(s => s.trim()).filter(Boolean);

(async () => {
  const types = "ITEM,ITEM_VARIATION,IMAGE,CATEGORY";
  const objects = await listAllCatalog(types);
  const imageMap = new Map(), itemMap = new Map(), varMap = new Map(), catMap = new Map();
  for (const o of objects) {
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
      price: money(v.itemVariationData?.priceMoney),
      currency: v.itemVariationData?.priceMoney?.currency ?? "USD",
      stock: Number(counts.get(v.id) ?? 0),
      custom: customAttrs(v)
    }));

    const prices = variations.map(v => v.price).filter(n => typeof n === "number");
    const priceMin = prices.length ? Math.min(...prices) : null;
    const priceMax = prices.length ? Math.max(...prices) : null;
    const sizes = Array.from(new Set(variations.flatMap(v => splitOptions(v.name))));

    const catId = item.itemData?.categoryId;
    const category = catId ? (catMap.get(catId)?.categoryData?.name ?? null) : null;
    const custom = customAttrs(item);

    const product = {
      id: item.id,
      title: item.itemData?.name ?? "Untitled",
      description: item.itemData?.description ?? "",
      thumbnail: getImage(item, imageMap),
      category,
      tags: item.itemData?.availableOnline ? ["online"] : [],
      variations,
      price_min: priceMin,
      price_max: priceMax,
      currency: variations[0]?.currency ?? "USD",
      sizes,
      url: custom.product_url || custom.external_url || null,
      custom,
      status: "active",
      stock: variations.reduce((a, v) => a + (Number.isFinite(v.stock) ? v.stock : 0), 0),
      createdAt: item.createdAt
    };

    if (!product.thumbnail) {
      for (const v of vars) {
        const ids = v?.itemVariationData?.imageIds ?? [];
        for (const id of ids) {
          const img = imageMap.get(id);
          if (img?.imageData?.url) { product.thumbnail = img.imageData.url; break; }
        }
        if (product.thumbnail) break;
      }
    }

    products.push(product);
  }

  await fs.mkdir("data", { recursive: true });
  await fs.writeFile("data/products.json", JSON.stringify(products, null, 2));
  console.log(`Wrote data/products.json (${products.length} items)`);
})();
