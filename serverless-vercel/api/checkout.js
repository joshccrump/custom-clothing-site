import crypto from "node:crypto";
import { makeClient } from "./_square.js";

function cors(res){
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res){
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try{
    const { variationId, quantity = 1, token, modifiers = [], note = "" } = req.body || {};
    if (!variationId || !token) return res.status(400).json({ error: "variationId and token required" });

    const client = makeClient();
    const locationId = process.env.SQUARE_LOCATION_ID;
    if (!locationId) throw new Error("SQUARE_LOCATION_ID not set");

    // Optional stock check
    if ((process.env.BACKORDER_OK || "true").toLowerCase() !== "true") {
      const inv = await client.inventoryApi.batchRetrieveInventoryCounts({
        catalogObjectIds: [variationId],
        locationIds: [locationId],
      });
      const qty = Number(inv.result.counts?.[0]?.quantity ?? 0);
      if (qty < Number(quantity)) {
        return res.status(409).json({ error: "Insufficient stock" });
      }
    }

    const line = {
      quantity: String(quantity),
      catalogObjectId: variationId,
      modifiers: (modifiers || []).map(m => ({
        catalogObjectId: m.catalogObjectId || m.id || m
      })),
      note: note || undefined,
    };

    const orderDraft = {
      locationId,
      lineItems: [line],
      pricingOptions: { autoApplyTaxes: true, autoApplyDiscounts: true },
      note: note || undefined,
    };

    // Calculate to get totalMoney
    const calc = await client.ordersApi.calculateOrder({ order: orderDraft });
    const totalMoney = calc.result.order?.totalMoney;
    if (!totalMoney) throw new Error("Could not calculate order total.");

    // Create order
    const created = await client.ordersApi.createOrder({
      idempotencyKey: crypto.randomUUID(),
      order: orderDraft
    });
    const orderId = created.result.order?.id;
    if (!orderId) throw new Error("Order creation failed.");

    // Take payment
    const pay = await client.paymentsApi.createPayment({
      idempotencyKey: crypto.randomUUID(),
      sourceId: token,
      locationId,
      orderId,
      amountMoney: totalMoney
    });

    res.status(200).json({
      paymentId: pay.result.payment?.id,
      orderId,
      status: pay.result.payment?.status
    });
  }catch(e){
    console.error("checkout error", e);
    const msg = e?.errors?.[0]?.detail || e?.message || "Unknown error";
    res.status(500).json({ error: msg });
  }
}