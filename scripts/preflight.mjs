// scripts/preflight.mjs (STRICT)
const ENV = (process.env.SQUARE_ENVIRONMENT || "production").toLowerCase();
const TOKEN = process.env.SQUARE_ACCESS_TOKEN || "";
const LOC   = (process.env.SQUARE_LOCATION_ID || "").trim();

function red(s){ return `\x1b[31m${s}\x1b[0m`; }
function green(s){ return `\x1b[32m${s}\x1b[0m`; }

const BASE = ENV === "sandbox"
  ? "https://connect.squareupsandbox.com"
  : "https://connect.squareup.com";

async function verifyLocation() {
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
  if (!ids.includes(LOC)) {
    console.error(red(`SQUARE_LOCATION_ID "${LOC}" not found in ${ENV}.`));
    console.error("Available:", ids);
    process.exit(1);
  }
}

console.log("=== Square preflight (strict) ===");
console.log("Environment:", ENV);
console.log("Access token:", TOKEN ? `${TOKEN.slice(0,5)}…${TOKEN.slice(-4)} (len=${TOKEN.length})` : red("MISSING"));
console.log("Location ID:", LOC || red("MISSING"));

if (!TOKEN) { console.error(red("Missing SQUARE_ACCESS_TOKEN.")); process.exit(1); }
if (!LOC) { console.error(red("Missing SQUARE_LOCATION_ID. Set it before running.")); process.exit(1); }

await verifyLocation();
console.log(green(`Preflight OK for location ${LOC} in ${ENV}.`));
console.log(green("You can run: node scripts/fetch-square.mjs"));
