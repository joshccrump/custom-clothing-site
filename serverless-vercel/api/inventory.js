// serverless-vercel/api/inventory.js
// GET /api/inventory?ids=ID1,ID2 -> { variationId: qty } on-hand counts.
// Rewritten to use Square's REST API (snake_case) via squareFetch.
import { squareFetch, squareEnv } from "./_square.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Use GET" });

  try {
    const ids = (req.query.ids || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (!ids.length) return res.status(400).json({ error: "ids required" });

    const { locationId } = squareEnv();

    const json = await squareFetch("/v2/inventory/batch-retrieve-counts", {
      method: "POST",
      body: { catalog_object_ids: ids, location_ids: [locationId] },
    });

    const qty = {};
    for (const c of json.counts || []) {
      qty[c.catalog_object_id] = Number(c.quantity || 0);
    }

    return res.status(200).json(qty);
  } catch (e) {
    console.error("inventory error", e);
    return res.status(e?.status || 500).json({ error: e?.message || "Unknown error" });
  }
}
