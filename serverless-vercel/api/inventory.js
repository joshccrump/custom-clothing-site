// serverless-vercel/api/inventory.js
import { makeClient } from "./_square.js";

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

    if (!ids.length) {
      return res.status(400).json({ error: "ids required" });
    }

    const client = makeClient();

    const { result } = await client.inventoryApi.batchRetrieveInventoryCounts({
      catalogObjectIds: ids,
      locationIds: [process.env.SQUARE_LOCATION_ID],
    });

    const qty = {};
    for (const c of result.counts || []) {
      qty[c.catalogObjectId] = Number(c.quantity || 0);
    }

    return res.status(200).json(qty);
  } catch (e) {
    console.error("inventory error", e);
    return res.status(500).json({ error: e?.message || "Unknown error" });
  }
}
