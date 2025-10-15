// scripts/fetch-square.mjs (STRICT)
const ENV = (process.env.SQUARE_ENVIRONMENT || "production").toLowerCase();
const BASE = ENV === "sandbox" ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";
const TOKEN = process.env.SQUARE_ACCESS_TOKEN || "";
const LOCATION_ID = (process.env.SQUARE_LOCATION_ID || "").trim();
const OUT = process.env.OUTPUT_PATH || "data/products.json";

import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

function fail(msg, extra){ console.error(`❌ ${msg}`); if (extra) console.error(extra); process.exit(1); }
function ok(msg){ console.log(`✅ ${msg}`); }

if (!TOKEN) fail("Missing SQUARE_ACCESS_TOKEN.");
if (!LOCATION_ID) fail("Missing SQUARE_LOCATION_ID — strict mode refuses to write without it.");

async function verifyAuthAndLocation(){
  const res = await fetch(`${BASE}/v2/locations`, {
    headers:{ Authorization:`Bearer ${TOKEN}`, "Square-Version":"2025-01-22", "Content-Type":"application/json" },
  });
  const txt=await res.text();
  if (!res.ok) fail(`Auth/locations failed ${res.status}`, txt);
  let json; try{ json=JSON.parse(txt); }catch{ json={}; }
  const ids=(json.locations||[]).map(l=>l.id);
  if (!ids.includes(LOCATION_ID)) fail(`SQUARE_LOCATION_ID "${LOCATION_ID}" not found in ${ENV}. Available: ${ids.join(", ")}`);
}

async function sqGET(path, params={}){
  const url = new URL(path, BASE);
  for (const [k,v] of Object.entries(params)) if (v!=null) url.searchParams.set(k, v);
  const res = await fetch(url, { headers:{ Authorization:`Bearer ${TOKEN}`, "Square-Version":"2025-01-22", "Content-Type":"application/json" } });
  const txt=await res.text();
  if (!res.ok) fail(`${path} ${res.status}`, txt);
  try{ return JSON.parse(txt); }catch{ return {}; }
}

function indexById(objs){ const m=new Map(); for (const o of objs||[]) if (o&&o.id) m.set(o.id,o); return m; }

async function fetchAllCatalog(){
  const objects=[]; let cursor=null;
  do{
    const json=await sqGET("/v2/catalog/list", { types:"ITEM,ITEM_VARIATION,IMAGE", cursor });
    if (Array.isArray(json.objects)) objects.push(...json.objects);
    cursor=json.cursor||null;
  } while(cursor);
  return objects;
}

function mapToSiteItems(allObjects){
  const images=allObjects.filter(o=>o.type==="IMAGE");
  const items =allObjects.filter(o=>o.type==="ITEM");
  const vars  =allObjects.filter(o=>o.type==="ITEM_VARIATION");
  const imgById=indexById(images);

  const itemIdForVar=new Map();
  for (const it of items){ const d=it.itemData||{}; for (const v of d.variations||[]) itemIdForVar.set(v.id, it.id); }

  const varsByItem=new Map();
  for (const v of vars){
    const vd=v.itemVariationData||{}; const parent=vd.itemId || itemIdForVar.get(v.id);
    if (!parent) continue; if (!varsByItem.has(parent)) varsByItem.set(parent, []); varsByItem.get(parent).push(v);
  }

  const result=[];
  for (const it of items){
    const d=it.itemData||{}; const vlist=varsByItem.get(it.id)||[];
    const mappedVariations=vlist.map(v=>{ const vd=v.itemVariationData||{}; const pm=vd.priceMoney||{};
      return { id:v.id, name:vd.name||"", price: typeof pm.amount==="number"? pm.amount:null, currency: pm.currency||"USD", sku: vd.sku||null }; });
    const imageUrl = d.imageIds?.length ? imgById.get(d.imageIds[0])?.imageData?.url : null;
    result.push({ id:it.id, type:"ITEM", name:d.name||"(unnamed)", description:d.description||"", variations:mappedVariations, imageUrl });
  }
  return result;
}

async function fetchInventoryCounts(locId, variationIds){
  if (!variationIds.length) return {};
  const chunkSize=200, counts={};
  for (let i=0;i<variationIds.length;i+=chunkSize){
    const slice=variationIds.slice(i,i+chunkSize);
    const res=await fetch(new URL("/v2/inventory/batch-retrieve-counts", BASE), {
      method:"POST",
      headers:{ Authorization:`Bearer ${TOKEN}`, "Square-Version":"2025-01-22", "Content-Type":"application/json" },
      body: JSON.stringify({ catalog_object_ids: slice, location_ids: [locId] })
    });
    const txt=await res.text();
    if (!res.ok) fail("/v2/inventory/batch-retrieve-counts failed", txt);
    const json=JSON.parse(txt);
    for (const c of json.counts||[]) counts[c.catalog_object_id]=Number(c.quantity||"0");
  }
  return counts;
}

async function writeJson(path, json){ await mkdir(dirname(path), { recursive:true }); await writeFile(path, JSON.stringify(json, null, 2), "utf8"); }

(async function main(){
  console.log("=== Square catalog sync (strict) ===");
  console.log("Environment:", ENV);
  console.log("Location ID:", LOCATION_ID);

  await verifyAuthAndLocation();

  const allObjects=await fetchAllCatalog();
  const items=mapToSiteItems(allObjects);
  if (!items.length) fail("Catalog contained 0 items — aborting (will NOT write placeholder).");

  const varIds=items.flatMap(it=>it.variations||[]).map(v=>v.id).filter(Boolean);
  const counts=await fetchInventoryCounts(LOCATION_ID, varIds);
  for (const it of items) for (const v of it.variations||[]) v.quantity = Number.isFinite(counts[v.id]) ? counts[v.id] : null;

  const payload={ generatedAt:new Date().toISOString(), count: items.length, items };
  await writeJson(OUT, payload);
  ok(`Wrote ${items.length} items → ${OUT}`);
})().catch(e=>fail("Unexpected error", e));
