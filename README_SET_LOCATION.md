# Set Location ID bundle

This sets a valid Location ID so preflight stops failing.

## Quick fix
1) Drop **config/public-square.json** into your repo (overwriting the old file). It is pre-filled with:
```json
{ "locationId": "L116Z8RBA1RJ4" }
```
2) Re-run preflight:
```bash
SQUARE_ENVIRONMENT=production SQUARE_ACCESS_TOKEN='EAAA...' node scripts/preflight.mjs
```

## Optional: set by ID or Name later
You can use the helper to update the file from your live locations.

By ID:
```bash
SQUARE_ENVIRONMENT=production \
SQUARE_ACCESS_TOKEN='EAAA...' \
node scripts/set-location.mjs --id L116Z8RBA1RJ4
```

By Name (exact, case-insensitive):
```bash
SQUARE_ENVIRONMENT=production \
SQUARE_ACCESS_TOKEN='EAAA...' \
node scripts/set-location.mjs --name "Downtown Store"
```
