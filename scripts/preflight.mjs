// scripts/preflight.mjs
const ENV = (process.env.SQUARE_ENVIRONMENT || "sandbox").toLowerCase();
const TOKEN = process.env.SQUARE_ACCESS_TOKEN?.trim();

if (!TOKEN) {
  console.error("❌ Missing SQUARE_ACCESS_TOKEN");
  process.exit(1);
}

const BASE =
  ENV === "production"
    ? "https://connect.squareup.com"
    : "https://connect.squareupsandbox.com";

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: "application/json",
  "Square-Version": "2025-09-18",
};

function redact(t) {
  return t ? `${t.slice(0, 6)}…${t.slice(-4)} (len=${t.length})` : "<empty>";
}

async function main() {
  console.log("=== Square preflight (no-SDK) ===");
  console.log("Environment:", ENV);
  console.log("Access token:", redact(TOKEN));

  const res = await fetch(`${BASE}/v2/locations`, { headers });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }

  if (res.ok) {
    const ids = (body.locations || []).map(l => l.id);
    console.log("✅ Auth OK. Locations:", ids.join(", ") || "(none)");
    return;
  }

  console.error(`❌ Locations failed: ${res.status}`);
  console.error(body);
  process.exit(1);
}

main().catch((e) => {
  console.error("Preflight threw:", e);
  process.exit(1);
});
