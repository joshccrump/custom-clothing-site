// scripts/fetch-square.js
import fs from "fs";
import path from "path";
import { Client, Environment as SquareEnvironment } from "square";

const Environment = SquareEnvironment || { Production: "production", Sandbox: "sandbox" };

function makeClient() {
  const envName = (process.env.SQUARE_ENV || "production").toLowerCase();
  const environment = envName === "production" ? Environment.Production : Environment.Sandbox;
  const token = process.env.SQUARE_ACCESS_TOKEN;
  if (!token) throw new Error("SQUARE_ACCESS_TOKEN not set");
  return new Client({
    bearerAuthCredentials: { accessToken: token },
    environment
  });
}

function moneyToNumber(m) {
  if (!m || typeof m.amount !== "number") return null;
  const scale = typeof m.decimalPlaces === "number" ? Math.pow(10, m.decimalPlaces) : 100;
  return m.amount / scale;
}

(async () => {
  const client = makeClient();
  let cursor = undefined;
  const types = "ITEM,MODIFIER_LIST,IMAGE,ITEM_OPTION,CATEGORY";
  const images = new Map();
  const modLists = new Map();
  const categories = new Map();
  const items = [];

  do {
    const resp = await client.catalogApi.listCatalog(cursor, types);
    cursor = resp?.result?.cursor;
    const objects = resp?.result?.objects || [];

    for (const o of objects) {
      switch (o.type) {
        case "IMAGE":
          images.set(o.id, o);
          break;
        case "MODIFIER_LIST":
          modLists.set(o.id, o);
          break;
        case "ITEM":
          items.push(o);
          break;
        case "CATEGORY":
          categories.set(o.id, o);
          break;
        default:
          break;
      }
    }
  } while (cursor);

  const out = [];
  for (const it of items) {
    const data = it.itemData;
    if (!data) continue;
    if (data.isArchived) continue;

    let thumbnail = null;
    if (Array.isArray(data.imageIds) && data.imageIds.length) {
      const img = images.get(data.imageIds[0]);
      thumbnail = img?.imageData?.url || null;
    }

    const variations = [];
    let priceMin = null;
    let priceMax = null;
    if (Array.isArray(data.variations)) {
      for (const v of data.variations) {
        const vd = v.itemVariationData || {};
        const price = moneyToNumber(vd.priceMoney);
        if (typeof price === "number") {
          priceMin = priceMin == null ? price : Math.min(priceMin, price);
          priceMax = priceMax == null ? price : Math.max(priceMax, price);
        }
        variations.push({
          id: v.id,
          name: vd.name || "Variation",
          price: typeof price === "number" ? price : null,
          currency: vd.priceMoney?.currency || "USD",
        });
      }
    }

    const modifier_lists = [];
    if (Array.isArray(data.modifierListInfo)) {
      for (const info of data.modifierListInfo) {
        const ml = modLists.get(info.modifierListId);
        if (!ml) continue;
        const mld = ml.modifierListData || {};
        const options = [];
        for (const m of (mld.modifiers || [])) {
          const md = m.modifierData || {};
          options.push({
            id: m.id,
            name: md.name || "Option",
            priceMoney: md.priceMoney || null
          });
        }
        modifier_lists.push({
          id: ml.id,
          name: mld.name || "Options",
          selectionType: mld.selectionType || "SINGLE",
          options
        });
      }
    }

    const description = data.descriptionHtml || data.description || "";
    const categoryId = data.categoryId;
    const categoryName = categoryId ? categories.get(categoryId)?.categoryData?.name : undefined;

    out.push({
      id: it.id,
      title: data.name || "Untitled",
      description,
      thumbnail,
      currency: variations[0]?.currency || "USD",
      variations,
      price_min: priceMin,
      price_max: priceMax,
      modifier_lists,
      category: categoryName || null
    });
  }

  const outDir = path.join(process.cwd(), "data");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "products.json");
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`Wrote ${out.length} items → ${outPath}`);
})().catch((e) => {
  console.error("Sync failed:", e?.message || e);
  process.exit(1);
});
