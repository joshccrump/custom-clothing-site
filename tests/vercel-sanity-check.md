# Vercel Deployment Sanity Check

**Run date:** 2025-10-11
**Environment:** Playwright Chromium (headless) hitting https://custom-clothing-site.vercel.app

## Summary
- Home page request at `/` returned a 404 document titled `404: NOT_FOUND`.
- `/shop.html` rendered no product cards and no catalog error banner (page likely short-circuited before fetching data).
- Direct request to `/api/catalog` returned HTTP 404 with the body `The page could not be found`.

## Raw Output
```
home_title: 404: NOT_FOUND
home_has_shop_cta: False
shop_product_card_count: 0
shop_error_banner: False
catalog_status: 404
catalog_json_error: Expecting value: line 1 column 1 (char 0)
catalog_body: The page could not be found
```

## Next Steps
1. Ensure the Vercel project is configured to deploy either the `serverless-vercel`
   directory **or** the new top-level `/api` wrappers introduced in this commit.
2. Redeploy once Square credentials are configured so `/api/catalog` responds with
   live catalog data instead of a 404.
