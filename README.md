# custom-clothing-api (Vercel)

Serverless backend for Square payments.

## Environment Variables (Vercel → Project → Settings → Environment Variables)
- `SQUARE_ACCESS_TOKEN` — use **Sandbox** token for testing, **Production** token for live
- `SQUARE_ENVIRONMENT` — `sandbox` or `production`
- `SQUARE_LOCATION_ID` — your Square Location ID
- `ALLOWED_ORIGIN` — `https://joshccrump.github.io` (or your custom domain)

## Endpoint
- `POST /api/charge` with JSON:
```json
{
  "sourceId": "TOKEN_FROM_WEB_PAYMENTS_SDK",
  "amount": 5000,
  "currency": "USD",
  "idempotencyKey": "uuid"
}
```

## Notes
- Update `Square-Version` header over time to the latest stable.
- Keep your Access Token on the server only (never ship to the browser).
