// assets/checkout.js
// Minimal client that renders Square's card, tokenizes, and calls your Vercel API.
// Fill in the placeholders below.

const APPLICATION_ID = "REPLACE_WITH_YOUR_SQUARE_APPLICATION_ID";
const LOCATION_ID = "REPLACE_WITH_YOUR_SQUARE_LOCATION_ID";
// Example: https://custom-clothing-api.vercel.app  (no trailing slash)
const API_BASE = "https://YOUR-VERCEL-PROJECT.vercel.app";

async function initPayments() {
  if (!window.Square) {
    setStatus("Square SDK failed to load.");
    return;
  }
  if (APPLICATION_ID.includes("REPLACE") || LOCATION_ID.includes("REPLACE") || API_BASE.includes("YOUR-VERCEL")) {
    console.warn("Remember to set APPLICATION_ID, LOCATION_ID, and API_BASE.");
  }

  const payments = window.Square.payments(APPLICATION_ID, LOCATION_ID);
  const card = await payments.card();
  await card.attach("#card-container");

  document.getElementById("pay-btn").addEventListener("click", async () => {
    setStatus("Processing…");
    try {
      const tokenResult = await card.tokenize();
      if (tokenResult.status !== "OK") {
        console.error(tokenResult.errors);
        setStatus("Card error. Check details and try again.");
        return;
      }
      const body = {
        sourceId: tokenResult.token,
        amount: 5000,              // $50.00 (amount in cents)
        currency: "USD",
        idempotencyKey: crypto.randomUUID()
      };
      const res = await fetch(`${API_BASE}/api/charge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) {
        console.error("Payment failed", data);
        setStatus(`Payment failed: ${data.message || res.status}`);
      } else {
        console.log("Payment success", data);
        setStatus("Payment succeeded! ✅");
        // TODO: redirect to thank-you, clear cart, etc.
      }
    } catch (e) {
      console.error(e);
      setStatus("Unexpected error while processing payment.");
    }
  });
}

function setStatus(msg) {
  const el = document.getElementById("status");
  if (el) el.textContent = msg;
}

initPayments().catch((e) => {
  console.error(e);
  setStatus("Failed to initialize payments.");
});
