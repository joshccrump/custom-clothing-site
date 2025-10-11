// scripts/square-preflight.mjs
// Node 20+ | ESM | Dependency-free Square auth/location preflight.
// Exits 0 on success, non-zero on failure, with clear messages.

import process from "node:process";

const ACCESS_TOKEN = (process.env.SQUARE_ACCESS_TOKEN || "").trim();
const LOCATION_ID  = (process.env.SQUARE_LOCATION_ID || "").trim();
// Accept either name; default to production
const RAW_ENV      = (process.env.SQUARE_ENV || process.env.SQUARE_ENVIRONMENT || "production").toLowerCase();

const BASE =
  RAW_ENV === "sandbox"
    ? "https://connect.squareupsandbox.com"
    : "https://connect.squareup.com";

function maskToken(tok) {
  if (!tok) return "";
  const clean = tok.replace(/\s+/g, "");
  const head = clean.slice(0, 6);
  const tail = clean.slice(-4);
  return `${head}…${tail} (len=${clean.length})`;
}

function fail(msg, extra = "") {
  console.error(`❌ ${msg}`);
  if (extra) console.error(extra);
  process.exit(1);
}

function ok(msg) {
  console.log(`✅ ${msg}`);
}

async function getJson(url, token) {
  const res = await fetch(url, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

async function main() {
  console.log("=== Square Preflight ===");
  console.log(`Environment : ${RAW_ENV} → ${BASE}`);
  console.log(`Token       : ${maskToken(ACCESS_TOKEN)}`);
  console.log(`Location ID : ${LOCATION_ID || "(not set)"}`);

  if (!ACCESS_TOKEN) fail("SQUARE_ACCESS_TOKEN is missing. Add it as a GitHub Actions Secret (no quotes).");
  if (!LOCATION_ID)  fail("SQUARE_LOCATION_ID is missing. Add it as a GitHub Actions Secret (no quotes).");

  // 1) Verify the token against /v2/locations
  const { res, body } = await getJson(`${BASE}/v2/locations`, ACCESS_TOKEN);

  if (res.status === 401) {
    fail(
      "Unauthorized (401) from /v2/locations. The access token is invalid for this environment.",
      [
        "- If SQUARE_ENVIRONMENT=production, use a Production access token (from your app's Production credentials).",
        "- If SQUARE_ENVIRONMENT=sandbox, use a Sandbox token and set the environment to sandbox.",
        "- Ensure no quotes or trailing spaces were pasted into the secret.",
        "- Rotate the token in the Square Developer Dashboard if unsure."
      ].join("\n")
    );
  }

  if (!res.ok) {
    fail(
      `Unexpected response from /v2/locations: HTTP ${res.status}`,
      JSON.stringify(body, null, 2)
    );
  }

  const locations =
    Array.isArray(body?.locations) ? body.locations :
    Array.isArray(body?.data) ? body.data :
    [];

  if (locations.length === 0) {
    console.warn("⚠️  Token is valid but no locations were returned for this account.");
  } else {
    const ids = new Set(
      locations.map(l => l?.id || l?.location?.id).filter(Boolean)
    );

    if (!ids.has(LOCATION_ID)) {
      fail(
        "SQUARE_LOCATION_ID does not belong to the account tied to this token/environment.",
        `Locations available to this token: ${[...ids].join(", ") || "(none)"}`
      );
    }
  }

  ok("Token and Location ID are valid for this environment.");
  process.exit(0);
}

main().catch((err) => {
  fail("Preflight crashed unexpectedly.", String(err?.stack || err));
});
