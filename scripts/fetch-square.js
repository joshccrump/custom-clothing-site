// scripts/fetch-square.js
import fs from "fs";
import path from "path";
import SquareSdk from "square";

const { Client, Environment: SquareEnvironment } = SquareSdk || {};
const Environment = SquareEnvironment || { Production: "production", Sandbox: "sandbox" };

function resolveMockPath(token) {
  if (process.env.SQUARE_MOCK_CATALOG && process.env.SQUARE_MOCK_CATALOG.trim()) {
    return process.env.SQUARE_MOCK_CATALOG.trim();
  }
  if (typeof token === "string" && token.startsWith("mock:")) {
    return token.slice("mock:".length);
  }
  return null;
}

function loadMockCatalog(mockPath) {
  const resolvedPath = path.isAbsolute(mockPath) ? mockPath : path.resolve(process.cwd(), mockPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Mock catalog not found at ${resolvedPath}`);
  }
  const raw = fs.readFileSync(resolvedPath, "utf8");
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Unable to parse mock catalog JSON (${resolvedPath}): ${err?.message || err}`);
  }
  const objects = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.objects)
      ? parsed.objects
      : null;
  if (!objects) {
    throw new Error("Mock catalog must be an array or an object with an 'objects' array");
  }
  return { objects, resolvedPath };
}

function createMockClient(mockPath) {
  const { objects, resolvedPath } = loadMockCatalog(mockPath);
  let served = false;

  function filterByTypes(requestedTypes) {
    if (!requestedTypes) return objects;
    const typeSet = new Set(
      requestedTypes
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    );
    if (!typeSet.size) return objects;
    return objects.filter((o) => typeSet.has(o.type));
  }

  return {
    catalogApi: {
      async listCatalog(cursor, types) {
        if (served && !cursor) {
          return { result: { objects: [], cursor: undefined } };
        }
        served = true;
        const filtered = filterByTypes(types);
        console.log(`[mock] Serving ${filtered.length} catalog objects from ${resolvedPath}`);
        return { result: { objects: filtered, cursor: undefined } };
      }
    }
  };
}

function resolveEnvironment() {
  const envName = (process.env.SQUARE_ENV || process.env.SQUARE_ENVIRONMENT || "production").toLowerCase();
  return envName === "production" ? Environment.Production : Environment.Sandbox;
}

function makeClient() {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  const mockPath = resolveMockPath(token);
  if (mockPath) {
    return createMockClient(mockPath);
  }
  if (!token) throw new Error("SQUARE_ACCESS_TOKEN not set");
  const environment = resolveEnvironment();
  return new Client({
    bearerAuthCredentials: { accessToken: token },
    environment
  });
}

function resolveOutputPath(argv = process.argv.slice(2)) {
  let out = process.env.OUTPUT_PATH;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--out" || arg === "-o") {
      if (i + 1 >= argv.length) {
        throw new Error("--out requires a path argument");
      }
      out = argv[i + 1];
      i += 1;
    } else if (arg.startsWith("--out=")) {
      out = arg.slice("--out=".length);
    }
  }

  const fallback = path.join("data", "products.json");
  const resolved = out && out.trim().length ? out.trim() : fallback;
  return path.isAbsolute(resolved) ? resolved : path.resolve(process.cwd(), resolved);
}

function moneyToNumber(m) {
  if (!m || typeof m.amount !== "number") return null;
  const scale = typeof m.decimalPlaces === "number" ? Math.pow(10, m.decimalPlaces) : 100;
  return m.amount / scale;
}

(async () => {
  const client = makeClient();
  let cursor = undefined;
  const types = "ITEM,MODIFIER_LIST,IMAGE,ITEM_OPTION,CATEGORY";
  const images = new Map();
  const modLists = new Map();
  const categories = new Map();
  const items = [];

  do {
    const resp = await client.catalogApi.listCatalog(cursor, types);
    cursor = resp?.result?.cursor;
    const objects = resp?.result?.objects || [];

    for (const o of objects) {
      switch (o.type) {
        case "IMAGE":
          images.set(o.id, o);
          break;
        case "MODIFIER_LIST":
          modLists.set(o.id, o);
          break;
        case "ITEM":
          items.push(o);
          break;
        case "CATEGORY":
          categories.set(o.id, o);
          break;
        default:
          break;
      }
    }
  } while (cursor);

  const out = [];
  for (const it of items) {
    const data = it.itemData;
    if (!data) continue;
    if (data.isArchived) continue;

    let thumbnail = null;
    if (Array.isArray(data.imageIds) && data.imageIds.length) {
      const img = images.get(data.imageIds[0]);
      thumbnail = img?.imageData?.url || null;
    }

    const variations = [];
    let priceMin = null;
    let priceMax = null;
    if (Array.isArray(data.variations)) {
      for (const v of data.variations) {
        const vd = v.itemVariationData || {};
        const price = moneyToNumber(vd.priceMoney);
        if (typeof price === "number") {
          priceMin = priceMin == null ? price : Math.min(priceMin, price);
          priceMax = priceMax == null ? price : Math.max(priceMax, price);
        }
        variations.push({
          id: v.id,
          name: vd.name || "Variation",
          price: typeof price === "number" ? price : null,
          currency: vd.priceMoney?.currency || "USD",
        });
      }
    }

    const modifier_lists = [];
    if (Array.isArray(data.modifierListInfo)) {
      for (const info of data.modifierListInfo) {
        const ml = modLists.get(info.modifierListId);
        if (!ml) continue;
        const mld = ml.modifierListData || {};
        const options = [];
        for (const m of (mld.modifiers || [])) {
          const md = m.modifierData || {};
          options.push({
            id: m.id,
            name: md.name || "Option",
            priceMoney: md.priceMoney || null
          });
        }
        modifier_lists.push({
          id: ml.id,
          name: mld.name || "Options",
          selectionType: mld.selectionType || "SINGLE",
          options
        });
      }
    }

    const description = data.descriptionHtml || data.description || "";
    const categoryId = data.categoryId;
    const categoryName = categoryId ? categories.get(categoryId)?.categoryData?.name : undefined;

    out.push({
      id: it.id,
      title: data.name || "Untitled",
      description,
      thumbnail,
      currency: variations[0]?.currency || "USD",
      variations,
      price_min: priceMin,
      price_max: priceMax,
      modifier_lists,
      category: categoryName || null
    });
  }

  const outPath = resolveOutputPath();
  const outDir = path.dirname(outPath);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`Wrote ${out.length} items → ${outPath}`);
})().catch((e) => {
  console.error("Sync failed:", e?.message || e);
  process.exit(1);
});
