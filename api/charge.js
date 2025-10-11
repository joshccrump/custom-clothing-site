// api/charge.js
// Vercel serverless function to create a payment via Square Payments API using a token from Web Payments SDK.
// Env vars required (Project Settings → Environment Variables):
// - SQUARE_ACCESS_TOKEN (Sandbox or Production)
// - SQUARE_ENVIRONMENT (sandbox | production)
// - SQUARE_LOCATION_ID
// - ALLOWED_ORIGIN (e.g., https://joshccrump.github.io)

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    // CORS preflight
    const allowed = process.env.ALLOWED_ORIGIN || "";
    res.setHeader("Access-Control-Allow-Origin", allowed);
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const allowed = process.env.ALLOWED_ORIGIN || "";
  res.setHeader("Access-Control-Allow-Origin", allowed);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

  try {
    const { sourceId, amount, currency, idempotencyKey } = req.body || {};
    if (!sourceId || !amount || !currency || !idempotencyKey) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const accessToken = process.env.SQUARE_ACCESS_TOKEN;
    const locationId  = process.env.SQUARE_LOCATION_ID;
    const env         = (process.env.SQUARE_ENVIRONMENT || "sandbox").toLowerCase();
    const baseUrl     = env === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";

    const paymentBody = {
      idempotency_key: idempotencyKey,
      source_id: sourceId,
      amount_money: { amount: Number(amount), currency: String(currency) },
      location_id: locationId,
      autocomplete: true
    };

    const sqRes = await fetch(`${baseUrl}/v2/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
        "Square-Version": "2025-03-19"
      },
      body: JSON.stringify(paymentBody)
    });

    const json = await sqRes.json();
    if (!sqRes.ok) {
      console.error("Square error", json);
      return res.status(sqRes.status).json({ message: json?.errors?.[0]?.detail || "Square payment failed", raw: json });
    }

    return res.status(200).json({ ok: true, payment: json.payment });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Server error" });
  }
}
