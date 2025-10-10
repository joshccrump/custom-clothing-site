diff --git a/scripts/fetch-square.js b/scripts/fetch-square.js
index c11ae5531a94a220543325dd8293785fcbefbb91..9f33722ce43969b1754cedfd500f394f98a0b8ff 100644
--- a/scripts/fetch-square.js
+++ b/scripts/fetch-square.js
@@ -42,65 +42,69 @@ const SquareEnvironment = pick(M.SquareEnvironment);
 // Legacy SDK exports
 const Client = pick(M.Client, M.default?.Client);
 const Environment = pick(M.Environment, M.default?.Environment);
 
 // Build client for either SDK
 let client;
 let envEnum;
 if (SquareClient && SquareEnvironment) {
   envEnum = ENV_RAW === "production" ? SquareEnvironment.Production : SquareEnvironment.Sandbox;
   client = new SquareClient({ token: ACCESS_TOKEN, environment: envEnum });
 } else if (Client && Environment) {
   envEnum = ENV_RAW === "production" ? Environment.Production : Environment.Sandbox;
   client = new Client({
     bearerAuthCredentials: { accessToken: ACCESS_TOKEN },
     environment: envEnum
   });
 } else {
   console.error("❌ Could not resolve Square SDK exports (SquareClient/Client). Check your 'square' version.");
   process.exit(1);
 }
 
 // --- Helpers ---
 const moneyToNumber = (m) => (m && m.amount != null) ? Number(m.amount) / 100 : null;
 
 async function listAllCatalog(typesCsv) {
-  let cursor, out = [];
-  // New SDK path: client.catalog.list({ types, cursor })
-  const useNew = !!client.catalog?.list;
-  do {
-    if (useNew) {
-      const page = await client.catalog.list({ types: typesCsv, cursor });
-      out.push(...(page.data ?? page.result ?? page.objects ?? []));
-      cursor = page.cursor ?? page.result?.cursor;
-    } else {
-      // Legacy path: client.catalogApi.listCatalog({ types, cursor })
+  const out = [];
+  const useNew = typeof client.catalog?.list === "function";
+
+  if (useNew) {
+    let page = await client.catalog.list({ types: typesCsv });
+    out.push(...(page?.data ?? []));
+    while (page?.hasNextPage()) {
+      page = await page.getNextPage();
+      out.push(...(page?.data ?? []));
+    }
+  } else {
+    let cursor;
+    do {
       const page = await client.catalogApi.listCatalog({ types: typesCsv, cursor });
       out.push(...(page.result.objects ?? []));
       cursor = page.result.cursor;
-    }
-  } while (cursor);
+    } while (cursor);
+  }
+
   return out;
 }
 
 async function batchCounts(variationIds, locationIds) {
   const counts = new Map();
   if (!variationIds.length || !locationIds.length) return counts;
 
   const CHUNK = 100;
   const useNew = !!client.inventory?.counts?.batchRetrieve;
 
   for (let i = 0; i < variationIds.length; i += CHUNK) {
     const slice = variationIds.slice(i, i + CHUNK);
     let res;
     if (useNew) {
       // New SDK: client.inventory.counts.batchRetrieve({ catalogObjectIds, locationIds })
       res = await client.inventory.counts.batchRetrieve({
         catalogObjectIds: slice,
         locationIds
       });
       for (const c of (res.counts ?? res.result?.counts ?? [])) {
         const id = c.catalogObjectId;
         const qty = Number(c.quantity ?? 0);
         counts.set(id, (counts.get(id) ?? 0) + qty);
       }
     } else {
diff --git a/scripts/fetch-square.js b/scripts/fetch-square.js
index c11ae5531a94a220543325dd8293785fcbefbb91..9f33722ce43969b1754cedfd500f394f98a0b8ff 100644
--- a/scripts/fetch-square.js
+++ b/scripts/fetch-square.js
@@ -143,93 +147,116 @@ function getMainImageUrl(item, imageMap) {
     if (img?.imageData?.url) return img.imageData.url;
   }
   return null;
 }
 
 // --- Main ---
 (async () => {
   console.log("🔎 Fetching Square catalog…");
   const types = "ITEM,ITEM_VARIATION,IMAGE,CATEGORY";
   const all = await listAllCatalog(types);
 
   const imageMap = new Map();
   const itemMap  = new Map();
   const varMap   = new Map();
   const catMap   = new Map();
 
   for (const o of all) {
     if (o.type === "IMAGE") imageMap.set(o.id, o);
     else if (o.type === "ITEM") itemMap.set(o.id, o);
     else if (o.type === "ITEM_VARIATION") varMap.set(o.id, o);
     else if (o.type === "CATEGORY") catMap.set(o.id, o);
   }
 
   const variationIds = Array.from(varMap.keys());
   const counts = await batchCounts(variationIds, LOCATION_IDS);
+  const hasCounts = counts.size > 0;
 
   const products = [];
   for (const item of itemMap.values()) {
-    const vIds = item?.itemData?.variations?.map(v => v.id).filter(Boolean) ?? [];
-    const variationsRaw = vIds.map(id => varMap.get(id)).filter(Boolean);
-
-    const variations = variationsRaw.map(v => ({
-      id: v.id,
-      name: v.itemVariationData?.name ?? "",
-      sku: v.itemVariationData?.sku ?? "",
-      price: moneyToNumber(v.itemVariationData?.priceMoney),
-      currency: v.itemVariationData?.priceMoney?.currency ?? "USD",
-      stock: Number(counts.get(v.id) ?? 0),
-      custom: extractCustomAttributes(v)
-    }));
+    const variationsRaw = (item?.itemData?.variations ?? [])
+      .map(v => {
+        const id = v?.id;
+        if (!id) return null;
+        return varMap.get(id) || v;
+      })
+      .filter(Boolean);
+
+    const variations = variationsRaw.map(v => {
+      const data = v.itemVariationData ?? v.item_variation_data ?? {};
+      const priceMoney = data.priceMoney ?? data.price_money ?? null;
+      const price = moneyToNumber(priceMoney);
+      const currency = priceMoney?.currency ?? data.priceMoney?.currency ?? "USD";
+      const stock = hasCounts
+        ? (counts.has(v.id) ? Number(counts.get(v.id) ?? 0) : null)
+        : null;
+
+      return {
+        id: v.id,
+        name: data.name ?? v.itemVariationData?.name ?? "",
+        sku: data.sku ?? v.itemVariationData?.sku ?? "",
+        price,
+        currency,
+        stock,
+        custom: extractCustomAttributes(v)
+      };
+    });
 
     const prices = variations.map(v => v.price).filter(n => typeof n === "number");
     const priceMin = prices.length ? Math.min(...prices) : null;
     const priceMax = prices.length ? Math.max(...prices) : null;
     const sizes = Array.from(new Set(variations.flatMap(v => deriveOptionsFromName(v.name))));
 
     const categoryId = item.itemData?.categoryId;
     const category = categoryId ? (catMap.get(categoryId)?.categoryData?.name ?? null) : null;
 
     const custom = extractCustomAttributes(item);
     const productUrl = custom.product_url || custom.external_url || null;
 
+    const knownStocks = variations
+      .map(v => (Number.isFinite(v.stock) ? Number(v.stock) : null))
+      .filter(v => v != null);
+
     const prod = {
       id: item.id,
       title: item.itemData?.name ?? "Untitled",
       description: item.itemData?.description ?? "",
       thumbnail: getMainImageUrl(item, imageMap),
       category,
       tags: item.itemData?.availableOnline ? ["online"] : [],
       variations,
       price_min: priceMin,
       price_max: priceMax,
+      price: variations.length === 1 ? variations[0]?.price ?? null : null,
       currency: variations[0]?.currency ?? "USD",
       sizes,
       url: productUrl,
       custom,
       status: "active",
-      stock: variations.reduce((a, v) => a + (Number.isFinite(v.stock) ? v.stock : 0), 0),
+      stock: hasCounts
+        ? (knownStocks.length ? knownStocks.reduce((a, v) => a + v, 0) : null)
+        : null,
       createdAt: item.createdAt
     };
 
     // fallback thumbnail from any variation image
     if (!prod.thumbnail) {
       for (const v of variationsRaw) {
         const ids = v?.itemVariationData?.imageIds ?? [];
         for (const id of ids) {
           const img = imageMap.get(id);
           if (img?.imageData?.url) { prod.thumbnail = img.imageData.url; break; }
         }
         if (prod.thumbnail) break;
       }
     }
 
     products.push(prod);
   }
 
   // Write output
   const outDir = path.resolve(process.cwd(), OUTPUT_DIR);
   await fs.mkdir(outDir, { recursive: true });
   const outFile = path.join(outDir, OUTPUT_FILE);
   await fs.writeFile(outFile, JSON.stringify(products, null, 2));
   console.log(`✅ Wrote ${outFile} (${products.length} items)`);
 })().catch(err => {
