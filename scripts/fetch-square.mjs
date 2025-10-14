// scripts/fetch-square.mjs
import fs from "node:fs/promises";
import path from "node:path";
import { loadSquare } from "./square-sdk-shim.mjs";
import { getSquareEnv } from "./square-env.mjs";

async function main(){
  const outPath = process.env.OUTPUT_PATH || "data/products.json";
  const { envName, accessToken } = getSquareEnv(true);
  const { Client, Environment } = await loadSquare();
  const client = new Client({ accessToken, environment: envName === "production" ? Environment.Production : Environment.Sandbox });

  const { result } = await client.catalogApi.listCatalog(undefined, "ITEM");
  const items = (result?.objects ?? []).map(o => ({
    id: o.id,
    name: o.itemData?.name || "(unnamed)",
    description: o.itemData?.description || "",
    variations: (o.itemData?.variations ?? []).map(v => ({
      id: v.id,
      name: v.itemVariationData?.name || "",
      price: v.itemVariationData?.priceMoney?.amount ?? null,
      currency: v.itemVariationData?.priceMoney?.currency ?? null,
      sku: v.itemVariationData?.sku || null,
    }))
  }));

  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), count: items.length, items }, null, 2));
  console.log(`Wrote ${items.length} items -> ${outPath}`);
}

main().catch(e=>{
  console.error("Fetch failed:", e?.response?.statusCode, e?.response?.body || e);
  process.exit(1);
});
