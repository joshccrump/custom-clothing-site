// api/checkout.js (Vercel)
import Square from "square";
const { Client, Environment } = Square;
import crypto from "node:crypto";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    const { variationId, quantity = 1, token } = req.body || {};
    if (!variationId || !token) return res.status(400).json({ error: "variationId and token required" });

    const client = new Client({
      bearerAuthCredentials: { accessToken: process.env.SQUARE_ACCESS_TOKEN },
      environment: (process.env.SQUARE_ENV || "production").toLowerCase() === "production"
        ? Environment.Production : Environment.Sandbox
    });

    if (process.env.BACKORDER_OK === "false") {
      const inv = await client.inventoryApi.batchRetrieveInventoryCounts({
        catalogObjectIds: [variationId],
        locationIds: [process.env.SQUARE_LOCATION_ID]
      });
      const qty = Number(inv.result.counts?.[0]?.quantity ?? 0);
      if (qty < Number(quantity)) return res.status(409).json({ error: "Insufficient stock" });
    }

    const orderRes = await client.ordersApi.createOrder({
      order: {
        locationId: process.env.SQUARE_LOCATION_ID,
        lineItems: [{ quantity: String(quantity), catalogObjectId: variationId }]
      },
      idempotencyKey: crypto.randomUUID()
    });
    const orderId = orderRes.result.order.id;
    const totalMoney = orderRes.result.order.netAmounts?.totalMoney;
    if (!totalMoney) return res.status(500).json({ error: "Order total missing." });

    const payRes = await client.paymentsApi.createPayment({
      idempotencyKey: crypto.randomUUID(),
      sourceId: token,
      locationId: process.env.SQUARE_LOCATION_ID,
      orderId,
      amountMoney: totalMoney
    });

    return res.status(200).json({ paymentId: payRes.result.payment.id, orderId });
  } catch (e) {
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
