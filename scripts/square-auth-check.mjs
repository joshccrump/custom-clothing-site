// scripts/square-auth-check.mjs
const TOKEN = process.env.SQUARE_ACCESS_TOKEN || "";
const ENV   = (process.env.SQUARE_ENVIRONMENT || process.env.SQUARE_ENV || "production").toLowerCase();
const LOC   = (process.env.SQUARE_LOCATION_ID || "").trim();

if (!TOKEN) { console.error("❌ Missing SQUARE_ACCESS_TOKEN."); process.exit(1); }

const BASES = { production: "https://connect.squareup.com", sandbox: "https://connect.squareupsandbox.com" };

async function probe(env) {
  const base = BASES[env];
  const res  = await fetch(`${base}/v2/locations`, {
    headers: { Authorization: `Bearer ${TOKEN}`, "Square-Version": "2025-01-22", "Content-Type": "application/json" },
  });
  const text = await res.text();
  let json; try { json = JSON.parse(text); } catch { json = {}; }
  return { env, ok: res.ok, status: res.status, json, text };
}

const listIds = (j) => (j.locations || []).map(l => l.id);

(async () => {
  console.log("=== Square auth check ===");
  console.log("Configured ENV:", ENV);
  const prod = await probe("production");
  const sand = await probe("sandbox");
  console.log("Probe production:", prod.status, prod.ok ? "OK" : "FAIL");
  console.log("Probe sandbox   :", sand.status, sand.ok ? "OK" : "FAIL");
  const worksIn = prod.ok ? "production" : (sand.ok ? "sandbox" : null);
  if (!worksIn) {
    console.error("❌ Token failed in BOTH envs (revoked/typo/whitespace).");
    console.error("   Production error:", prod.text);
    console.error("   Sandbox error   :", sand.text);
    process.exit(1);
  }
  if (worksIn !== ENV) {
    console.error(`❌ Environment mismatch. Token works in "${worksIn}", but SQUARE_ENVIRONMENT="${ENV}".`);
    console.error(`   Fix: set SQUARE_ENVIRONMENT=${worksIn} OR use a ${ENV} token.`);
    process.exit(1);
  }
  if (LOC) {
    const ids = listIds(worksIn === "production" ? prod.json : sand.json);
    if (!ids.includes(LOC)) { console.error(`❌ SQUARE_LOCATION_ID "${LOC}" not found in ${worksIn}. Available:`, ids); process.exit(1); }
  }
  console.log(`✅ Token valid for ${worksIn}${LOC ? ` and location ${LOC}` : ""}.`);
})();