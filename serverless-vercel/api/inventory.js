// api/inventory.js
import Square from "square";
const { Client, Environment } = Square;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const ids = (req.query.ids || "").split(",").map(s=>s.trim()).filter(Boolean);
  if (!ids.length) return res.status(400).json({ error: "ids required" });

  const client = new Client({
    bearerAuthCredentials: { accessToken: process.env.SQUARE_ACCESS_TOKEN },
    environment: (process.env.SQUARE_ENV || "production").toLowerCase() === "production"
      ? Environment.Production : Environment.Sandbox
  });

  const { result } = await client.inventoryApi.batchRetrieveInventoryCounts({
    catalogObjectIds: ids,
    locationIds: [process.env.SQUARE_LOCATION_ID]
  });
  const qty = {};
  for (const c of (result.counts || [])) qty[c.catalogObjectId] = Number(c.quantity||0);
  res.status(200).json(qty);
}
