// scripts/preflight.mjs
const ENV = (process.env.SQUARE_ENVIRONMENT || "production").toLowerCase();
const TOKEN = process.env.SQUARE_ACCESS_TOKEN || "";
const LOC   = process.env.SQUARE_LOCATION_ID || "";

function red(s){ return `\x1b[31m${s}\x1b[0m`; }
function green(s){ return `\x1b[32m${s}\x1b[0m`; }

console.log("=== Square preflight ===");
console.log("Environment:", ENV);
console.log("Access token:", TOKEN ? `${TOKEN.slice(0,5)}…${TOKEN.slice(-4)} (len=${TOKEN.length})` : red("MISSING"));
console.log("Location ID:", LOC ? LOC : "(not provided)");

if (!TOKEN) {
  console.error(red("Missing SQUARE_ACCESS_TOKEN. Set it before running."));
  process.exit(1);
}
console.log(green("Preflight OK. You can run: node scripts/fetch-square.mjs"));
