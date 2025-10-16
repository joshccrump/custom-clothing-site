// scripts/verify-env.mjs
import { readFile } from "node:fs/promises";
const ENV = (process.env.SQUARE_ENVIRONMENT || "production").toLowerCase();
const TOKEN = process.env.SQUARE_ACCESS_TOKEN || "";
const BASE  = ENV === "sandbox" ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";
function mask(s){ if (!s) return "<empty>"; return s.length <= 10 ? "***" : `${s.slice(0,5)}…${s.slice(-4)} (len=${s.length})`; }
async function getLocationId() {
  const envLoc = (process.env.SQUARE_LOCATION_ID || "").trim();
  if (envLoc) return envLoc;
  try { const raw = await readFile(new URL("../config/public-square.json", import.meta.url), "utf8");
        const json = JSON.parse(raw); const loc = (json.locationId || "").trim();
        if (loc) { console.log("ℹ️ Using Location ID from config/public-square.json"); return loc; } } catch {}
  return "";
}
console.log("=== Verify Square Secrets ===");
console.log("ENV:", ENV);
console.log("TOKEN:", mask(TOKEN));
if (!TOKEN) { console.error("❌ Missing SQUARE_ACCESS_TOKEN in runner env."); process.exit(1); }
const LOC = await getLocationId();
console.log("LOCATION_ID:", LOC || "<empty>");
const res = await fetch(`${BASE}/v2/locations`, { headers: { Authorization: `Bearer ${TOKEN}`, "Square-Version": "2025-01-22", "Content-Type": "application/json" } });
const text = await res.text();
let json; try { json = JSON.parse(text); } catch { json = {}; }
if (!res.ok) { console.error("❌ /v2/locations failed:", res.status, text); process.exit(1); }
const ids = (json.locations || []).map(l => l.id);
console.log("Locations returned:", ids.length ? ids.join(", ") : "(none)");
if (!LOC) { console.error("❌ No Location ID set (env or config). Set SQUARE_LOCATION_ID or edit config/public-square.json."); process.exit(1); }
if (!ids.includes(LOC)) { console.error(`❌ Location "${LOC}" not found in ${ENV}. Available:`, ids); process.exit(1); }
console.log("✅ Token valid and Location ID matches the environment.");
