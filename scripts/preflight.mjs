// scripts/preflight.mjs (Location ID fallback support)
// Reads SQUARE_LOCATION_ID from env; if missing, falls back to config/public-square.json.
// Fails if still missing or if the ID doesn't exist in the selected environment.

import { readFile } from "node:fs/promises";

const ENV   = (process.env.SQUARE_ENVIRONMENT || "production").toLowerCase();
const TOKEN = process.env.SQUARE_ACCESS_TOKEN || "";
let   LOC   = (process.env.SQUARE_LOCATION_ID || "").trim();

function red(s){ return `\x1b[31m${s}\x1b[0m`; }
function green(s){ return `\x1b[32m${s}\x1b[0m`; }
function gray(s){ return `\x1b[90m${s}\x1b[0m`; }

const BASE = ENV === "sandbox"
  ? "https://connect.squareupsandbox.com"
  : "https://connect.squareup.com";

async function readFallbackConfig() {
  try {
    const raw = await readFile(new URL("../config/public-square.json", import.meta.url), "utf8");
    const json = JSON.parse(raw);
    if (json && typeof json.locationId === "string" && json.locationId.trim()) {
      return json.locationId.trim();
    }
  } catch {}
  return "";
}

async function verifyLocation(id) {
  const res = await fetch(`${BASE}/v2/locations`, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Square-Version": "2025-01-22",
      "Content-Type": "application/json",
    },
  });
  const txt = await res.text();
  if (!res.ok) {
    console.error(red(`Locations check failed ${res.status}`));
    console.error(txt);
    process.exit(1);
  }
  let json; try { json = JSON.parse(txt); } catch { json = {}; }
  const ids = (json.locations || []).map(l => l.id);
  if (!ids.includes(id)) {
    console.error(red(`SQUARE_LOCATION_ID "${id}" not found in ${ENV}.`));
    console.error("Available:", ids);
    process.exit(1);
  }
}

console.log("=== Square preflight (with Location fallback) ===");
console.log("Environment:", ENV);
console.log("Access token:", TOKEN ? `${TOKEN.slice(0,5)}…${TOKEN.slice(-4)} (len=${TOKEN.length})` : red("MISSING"));

if (!TOKEN) {
  console.error(red("Missing SQUARE_ACCESS_TOKEN."));
  process.exit(1);
}

// Try env first; then config fallback
if (!LOC) {
  console.log(gray("No SQUARE_LOCATION_ID in env. Trying config/public-square.json …"));
  LOC = await readFallbackConfig();
}

console.log("Location ID:", LOC || red("MISSING"));

if (!LOC) {
  console.error(red("Missing Location ID. Set SQUARE_LOCATION_ID (Actions Secret/Variable) OR edit config/public-square.json."));
  process.exit(1);
}

// Verify that LOC exists in the selected environment
await verifyLocation(LOC);

console.log(green(`Preflight OK for location ${LOC} in ${ENV}.`));
console.log(green("You can run: node scripts/fetch-square.mjs"));
