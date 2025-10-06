// serverless-vercel/api/checkout.js
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
    if (!variationId || !token) {
      return res.status(400).json({ error: "variationId and token required" });
    }

    const client = new Client({
      bearerAuthCredentials: { accessToken: process.env.SQUARE_ACCESS_TOKEN },
      environment: (process.env.SQUARE_ENV || "production").toLowerCase() === "production"
        ? Environment.Production
        : Environment.Sandbox,
    });

    // Optional: block orders when out of stock unless BACKORDER_OK=true
    if ((process.env.BACKORDER_OK || "true").toLowerCase() !== "true") {
      const inv = await client.inventoryApi.batchRetrieveInventoryCounts({
        catalogObjectIds: [variationId],
        locationIds: [process.env.SQUARE_LOCATION_ID],
      });
      const qty = Number(inv.result.counts?.[0]?.quantity ?? 0);
      if (qty < Number(quantity)) {
        return res.status(409).json({ error: "Insufficient stock" });
      }
    }

    // Draft the order once
    const orderDraft = {
      locationId: process.env.SQUARE_LOCATION_ID,
      lineItems: [{ quantity: String(quantity), catalogObjectId: variationId }],
      pricingOptions: { autoApplyTaxes: true, autoApplyDiscounts: true },
    };

    // 1) Calculate total so we have amountMoney
    const calc = await client.ordersApi.calculateOrder({ order: orderDraft });
    const totalMoney = calc.result.order?.totalMoney;
    if (!totalMoney) throw new Error("Could not calculate order total.");

    // 2) Create the actual order to attach to the payment
    const created = await client.ordersApi.createOrder({
      order: orderDraft,
      idempotencyKey: crypto.randomUUID(),
    });
    const orderId = created.result.order?.id;
    if (!orderId) throw new Error("Order creation failed.");

    // 3) Take payment
    const pay = await client.paymentsApi.createPayment({
      idempotencyKey: crypto.randomUUID(),
      sourceId: token, // token from Web Payments SDK (client)
      locationId: process.env.SQUARE_LOCATION_ID,
      orderId,
      amountMoney: totalMoney,
    });

    return res.status(200).json({
      paymentId: pay.result.payment?.id,
      orderId,
      status: pay.result.payment?.status,
    });
  } catch (e) {
    // This shows up in Vercel → Project → Deployments → View Functions → Logs
    console.error("Checkout error", e);
    const msg = e?.errors?.[0]?.detail || e?.message || "Unknown error";
    return res.status(500).json({ error: msg });
  }
}
