// api/_square.js  (shared Square REST helper — no SDK dependency)
//
// FIX (2026-07): the previous version imported { Client, Environment } from
// the "square" SDK. Square SDK v43 renamed those to SquareClient/SquareEnvironment
// with a different API, so every function crashed on import
// (SyntaxError: Named export 'Client' not found). Rewritten to call Square's
// REST API directly via fetch(), matching scripts/fetch-square.mjs. This removes
// the SDK dependency entirely and is immune to future SDK version changes.

const ENV = (process.env.SQUARE_ENVIRONMENT || process.env.SQUARE_ENV || "production").toLowerCase();
const BASE = ENV === "sandbox" ? "https://connect.squareupsandbox.com" : "https://connect.squareup.com";
const SQUARE_VERSION = "2025-01-22";

export function squareEnv() {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN || process.env.SQUARE_TOKEN;
  const locationId = process.env.SQUARE_LOCATION_ID || process.env.SQUARE_LOCATION;
  if (!accessToken) throw new Error("SQUARE_ACCESS_TOKEN not set");
  if (!locationId) throw new Error("SQUARE_LOCATION_ID not set");
  return { accessToken, locationId, base: BASE, env: ENV };
}

// Generic Square REST call. Returns parsed JSON (snake_case, as Square sends it).
// Throws an Error with a readable message + .status on non-2xx responses.
export async function squareFetch(path, { method = "GET", query = {}, body } = {}) {
  const accessToken = process.env.SQUARE_ACCESS_TOKEN || process.env.SQUARE_TOKEN;
  if (!accessToken) throw new Error("SQUARE_ACCESS_TOKEN not set");

  const url = new URL(path, BASE);
  for (const [k, v] of Object.entries(query)) if (v != null) url.searchParams.set(k, v);

  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Square-Version": SQUARE_VERSION,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : {}; } catch { json = { _raw: text }; }

  if (!res.ok) {
    const detail = json?.errors?.[0]?.detail || json?.message || text || `Square HTTP ${res.status}`;
    const err = new Error(detail);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}
