// scripts/set-location.mjs
// Usage examples:
//   node scripts/set-location.mjs --id L116Z8RBA1RJ4
//   node scripts/set-location.mjs --name "Downtown Store" --env production
//
// If --id is provided, it validates against /v2/locations and writes config/public-square.json.
// If --name is provided, it searches case-insensitively among returned locations and writes the match.

import { writeFile, readFile } from "node:fs/promises";
const ENV   = (process.env.SQUARE_ENVIRONMENT || getArg("--env") || "production").toLowerCase();
const TOKEN = process.env.SQUARE_ACCESS_TOKEN || getArg("--token") || "";
const BASE  = ENV === "sandbox" ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";

function getArg(flag){
  const i = process.argv.indexOf(flag);
  if (i >= 0 && process.argv[i+1]) return process.argv[i+1];
  return "";
}
function fail(msg, extra){ console.error(`❌ ${msg}`); if (extra) console.error(extra); process.exit(1); }

if (!TOKEN) fail("Missing SQUARE_ACCESS_TOKEN (env or --token).");

const wantId   = getArg("--id").trim();
const wantName = getArg("--name").trim().toLowerCase();

if (!wantId && !wantName) fail("Provide --id <LOCATION_ID> or --name <LOCATION_NAME>.");

const res = await fetch(`${BASE}/v2/locations`, {
  headers: { Authorization: `Bearer ${TOKEN}`, "Square-Version": "2025-01-22", "Content-Type": "application/json" },
});
const txt = await res.text();
if (!res.ok) fail(`/v2/locations ${res.status}`, txt);

let json; try{ json = JSON.parse(txt); } catch { json = {}; }
const locs = json.locations || [];
if (!locs.length) fail("No locations returned by the API.");

let chosen = null;
if (wantId){
  chosen = locs.find(l => (l.id || "").trim() === wantId);
  if (!chosen) fail(`Location ID "${wantId}" not found in ${ENV}.`, locs.map(l=>l.id).join(", "));
} else {
  chosen = locs.find(l => (l.name || "").toLowerCase() === wantName);
  if (!chosen) fail(`Location name "${wantName}" not found in ${ENV}.`, locs.map(l=>`${l.id}:${l.name}`).join(", "));
}

await writeFile(new URL("../config/public-square.json", import.meta.url), JSON.stringify({ locationId: chosen.id }, null, 2), "utf8");
console.log(`✅ Wrote config/public-square.json with locationId=${chosen.id} (${chosen.name||""})`);
