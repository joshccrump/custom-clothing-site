// serverless-vercel/api/checkout.js
// POST /api/checkout -> creates a Square order and charges the card token.
// Rewritten to use Square's REST API (snake_case) via squareFetch.
import crypto from "node:crypto";
import { squareFetch, squareEnv } from "./_square.js";

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
    const { variationId, quantity = 1, token, modifiers = [], note = "" } = req.body || {};
    if (!variationId || !token) return res.status(400).json({ error: "variationId and token required" });

    const { locationId } = squareEnv();

    // Optional stock check
    if ((process.env.BACKORDER_OK || "true").toLowerCase() !== "true") {
      const inv = await squareFetch("/v2/inventory/batch-retrieve-counts", {
        method: "POST",
        body: { catalog_object_ids: [variationId], location_ids: [locationId] },
      });
      const qty = Number(inv.counts?.[0]?.quantity ?? 0);
      if (qty < Number(quantity)) {
        return res.status(409).json({ error: "Insufficient stock" });
      }
    }

    const order = {
      location_id: locationId,
      line_items: [
        {
          quantity: String(quantity),
          catalog_object_id: variationId,
          modifiers: (modifiers || []).map((m) => ({
            catalog_object_id: m.catalog_object_id || m.catalogObjectId || m.id || m,
          })),
          note: note || undefined,
        },
      ],
      pricing_options: { auto_apply_taxes: true, auto_apply_discounts: true },
      note: note || undefined,
    };

    // Calculate to get total_money
    const calc = await squareFetch("/v2/orders/calculate", { method: "POST", body: { order } });
    const totalMoney = calc.order?.total_money;
    if (!totalMoney) throw new Error("Could not calculate order total.");

    // Create order
    const created = await squareFetch("/v2/orders", {
      method: "POST",
      body: { idempotency_key: crypto.randomUUID(), order },
    });
    const orderId = created.order?.id;
    if (!orderId) throw new Error("Order creation failed.");

    // Take payment
    const pay = await squareFetch("/v2/payments", {
      method: "POST",
      body: {
        idempotency_key: crypto.randomUUID(),
        source_id: token,
        location_id: locationId,
        order_id: orderId,
        amount_money: totalMoney,
      },
    });

    res.status(200).json({
      paymentId: pay.payment?.id,
      orderId,
      status: pay.payment?.status,
    });
  } catch (e) {
    console.error("checkout error", e);
    const msg = e?.body?.errors?.[0]?.detail || e?.message || "Unknown error";
    res.status(e?.status || 500).json({ error: msg });
  }
}
