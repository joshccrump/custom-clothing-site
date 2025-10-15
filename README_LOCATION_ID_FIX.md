# Location ID Fix Pack

This pack lets your build succeed even if the runner doesn't pass `SQUARE_LOCATION_ID`,
by falling back to a committed config file **config/public-square.json** (safe to commit).

> Access token stays in **Secrets**. Location ID is not sensitive and can be public.

## Files
- `scripts/preflight.mjs` — reads `SQUARE_LOCATION_ID` from env; if missing, reads `config/public-square.json`; verifies it exists in the chosen environment.
- `config/public-square.json` — put your Location ID here (e.g., `L116Z8RBA1RJ4`).
- `.github/workflows/verify-secrets.yml` — optional action to run the preflight.

## How to use
1. Edit **config/public-square.json** and set your real Location ID:
   ```json
   { "locationId": "L116Z8RBA1RJ4" }
   ```
2. Ensure **SQUARE_ACCESS_TOKEN** exists in Actions → Secrets.
3. Option A: Keep passing `SQUARE_LOCATION_ID` via Secrets/Vars (preferred).
   Option B: Remove it from the workflow env; `preflight.mjs` will use the config file.
4. Run:
   ```bash
   SQUARE_ENVIRONMENT=production \
   SQUARE_ACCESS_TOKEN='EAAA...' \
   node scripts/preflight.mjs
   ```
5. If OK, proceed with your sync script.

## Notes
- If both env var and config file are present, **env wins**.
- The script verifies the Location ID against `/v2/locations` in the selected env (`production` or `sandbox`).
