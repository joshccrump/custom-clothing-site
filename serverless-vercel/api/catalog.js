// serverless-vercel/api/catalog.js
// GET /api/catalog?variationId=... -> product + variation + modifier metadata
// Rewritten to use Square's REST API (snake_case) via squareFetch.
import { squareFetch } from "./_square.js";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function moneyToNumber(m) {
  if (!m || typeof m.amount !== "number") return null;
  return m.amount / 100; // Square money amounts are in the smallest currency unit
}

export default async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const variationId = (req.query.variationId || "").trim();
    if (!variationId) return res.status(400).json({ error: "variationId required" });

    // Retrieve the variation and its related objects (parent item, images).
    const vres = await squareFetch(`/v2/catalog/object/${encodeURIComponent(variationId)}`, {
      query: { include_related_objects: true },
    });
    const variation = vres.object;
    const related = [...(vres.related_objects || [])];
    if (!variation) return res.status(404).json({ error: "Variation not found" });

    const relatedMap = new Map();
    for (const obj of related) relatedMap.set(obj.id, obj);

    const itemId = variation?.item_variation_data?.item_id || null;
    if (!itemId) return res.status(404).json({ error: "Parent item not found" });

    let item = relatedMap.get(itemId) || null;
    if (!item) {
      const ires = await squareFetch(`/v2/catalog/object/${encodeURIComponent(itemId)}`, {
        query: { include_related_objects: true },
      });
      item = ires.object;
      for (const obj of ires.related_objects || []) {
        related.push(obj);
        relatedMap.set(obj.id, obj);
      }
    }
    if (!item) return res.status(404).json({ error: "Parent item not found" });

    const resolveImage = (obj) => {
      const ids = obj?.item_data?.image_ids || obj?.image_ids || [];
      if (!Array.isArray(ids)) return null;
      for (const id of ids) {
        const img = relatedMap.get(id);
        if (img?.type === "IMAGE" && img?.image_data?.url) return img.image_data.url;
      }
      return null;
    };

    let thumbnail = resolveImage(item);
    if (!thumbnail) {
      const vImages = variation?.item_variation_data?.image_ids || [];
      for (const id of vImages) {
        const img = relatedMap.get(id);
        if (img?.type === "IMAGE" && img?.image_data?.url) { thumbnail = img.image_data.url; break; }
      }
    }

    const mInfos = item?.item_data?.modifier_list_info || [];
    const listIds = mInfos.map((mi) => mi.modifier_list_id).filter(Boolean);

    let modifierLists = [];
    if (listIds.length) {
      const lres = await squareFetch(`/v2/catalog/batch-retrieve`, {
        method: "POST",
        body: { object_ids: listIds, include_related_objects: true },
      });
      const lists = (lres.objects || []).filter((o) => o.type === "MODIFIER_LIST");
      const relatedMods = lres.related_objects || [];
      const modsByList = new Map();
      for (const mod of relatedMods) {
        const listId = mod?.modifier_data?.modifier_list_id;
        if (mod.type === "MODIFIER" && listId) {
          const arr = modsByList.get(listId) || [];
          arr.push(mod);
          modsByList.set(listId, arr);
        }
      }
      modifierLists = lists.map((list) => ({
        id: list.id,
        name: list.modifier_list_data?.name || "Options",
        selectionType: list.modifier_list_data?.selection_type || "SINGLE",
        minSelected: list.modifier_list_data?.min_selected ?? 0,
        maxSelected: list.modifier_list_data?.max_selected ?? 0,
        options: (modsByList.get(list.id) || []).map((m) => ({
          id: m.id,
          name: m.modifier_data?.name || "Option",
          priceMoney: m.modifier_data?.price_money || null,
        })),
      }));
    }

    const priceMoney = variation?.item_variation_data?.price_money || null;

    res.status(200).json({
      product: {
        id: item.id,
        title: item.item_data?.name || "Item",
        description: item.item_data?.description || "",
        currency: priceMoney?.currency || "USD",
        thumbnail,
      },
      variation: {
        id: variation.id,
        name: variation.item_variation_data?.name || "",
        price: moneyToNumber(priceMoney),
      },
      modifierLists,
    });
  } catch (e) {
    console.error("catalog error", e);
    res.status(e?.status || 500).json({ error: e?.message || "Unknown error" });
  }
}
