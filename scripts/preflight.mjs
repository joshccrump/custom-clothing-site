// scripts/preflight.mjs (STRICT + fallback)
import { readFile } from "node:fs/promises";
const ENV   = (process.env.SQUARE_ENVIRONMENT || "production").toLowerCase();
const TOKEN = process.env.SQUARE_ACCESS_TOKEN || "";
function red(s){ return `\x1b[31m${s}\x1b[0m`; }
function green(s){ return `\x1b[32m${s}\x1b[0m`; }
function gray(s){ return `\x1b[90m${s}\x1b[0m`; }
const BASE = ENV === "sandbox" ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";
async function readLocationId() {
  const envLoc = (process.env.SQUARE_LOCATION_ID || "").trim();
  if (envLoc) return envLoc;
  try { const raw = await readFile(new URL("../config/public-square.json", import.meta.url), "utf8");
        const json = JSON.parse(raw); const loc = (json.locationId || "").trim();
        if (loc) { console.log(gray("No env location. Using config/public-square.json …")); return loc; } } catch {}
  return "";
}
async function verifyLocation(id) {
  const res = await fetch(`${BASE}/v2/locations`, { headers: { Authorization: `Bearer ${TOKEN}`, "Square-Version": "2025-01-22", "Content-Type": "application/json" } });
  const txt = await res.text();
  if (!res.ok) { console.error(red(`Locations check failed ${res.status}`)); console.error(txt); process.exit(1); }
  let json; try { json = JSON.parse(txt); } catch { json = {}; }
  const ids = (json.locations || []).map(l => l.id);
  if (!ids.includes(id)) { console.error(red(`SQUARE_LOCATION_ID "${id}" not found in ${ENV}.`)); console.error("Available:", ids); process.exit(1); }
}
console.log("=== Square preflight (strict + fallback) ===");
console.log("Environment:", ENV);
console.log("Access token:", TOKEN ? `${TOKEN.slice(0,5)}…${TOKEN.slice(-4)} (len=${TOKEN.length})` : red("MISSING"));
if (!TOKEN) { console.error(red("Missing SQUARE_ACCESS_TOKEN.")); process.exit(1); }
const LOC = await readLocationId();
console.log("Location ID:", LOC || red("MISSING"));
if (!LOC) { console.error(red("Set SQUARE_LOCATION_ID (env) or edit config/public-square.json.")); process.exit(1); }
await verifyLocation(LOC);
console.log(green(`Preflight OK for location ${LOC} in ${ENV}.`));
