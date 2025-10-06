// serverless-vercel/api/inventory.js
import Square from "square";

// Some Square builds export Environment, some don't in ESM/CommonJS interop.
// Use a safe fallback so we never crash.
const { Client } = Square;
const Environment = Square?.Environment ?? { Production: "production", Sandbox: "sandbox" };

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  try {
    const ids = (req.query.ids || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (!ids.length) {
      return res.status(400).json({ error: "ids required" });
    }

    const env =
      (process.env.SQUARE_ENV || "production").toLowerCase() === "production"
        ? Environment.Production
        : Environment.Sandbox;

    const client = new Client({
      bearerAuthCredentials: { accessToken: process.env.SQUARE_ACCESS_TOKEN },
      environment: env,
    });

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
