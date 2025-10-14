// scripts/preflight.mjs
import { loadSquare } from "./square-sdk-shim.mjs";
import { getSquareEnv } from "./square-env.mjs";

const redact = (t) => !t ? "<empty>" : t.slice(0,6) + "…" + t.slice(-4) + ` (len=${t.length})`;

async function run(){
  console.log("=== Square preflight ===");
  const { envName, accessToken, locationId, appId } = getSquareEnv(true);
  console.log("Environment:", envName);
  console.log("Access token:", redact(accessToken));
  if (appId) console.log("Application ID:", appId);
  if (locationId) console.log("Location ID:", locationId);

  const { Client, Environment } = await loadSquare();
  const client = new Client({ accessToken, environment: envName === "production" ? Environment.Production : Environment.Sandbox });

  try {
    const { result } = await client.locationsApi.listLocations();
    console.log("✅ Auth OK. Location IDs:", (result.locations||[]).map(l=>l.id).join(", ")||"(none)");
  } catch(e){
    console.error("❌ Locations failed:", e?.response?.statusCode, e?.response?.body || e);
    process.exit(1);
  }

  try {
    const { result } = await client.catalogApi.listCatalog(undefined, "ITEM");
    console.log("✅ Catalog reachable. Items:", (result.objects||[]).length);
  } catch(e){
    console.warn("⚠️ Catalog check failed:", e?.response?.statusCode, e?.response?.body || e);
  }
}

run().catch(e=>{ console.error(e); process.exit(1); });
