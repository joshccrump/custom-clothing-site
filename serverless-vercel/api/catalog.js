import { makeClient } from "./_square.js";

function cors(res){
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function moneyToNumber(m){
  if (!m || typeof m.amount !== "number") return null;
  const scale = typeof m.decimalPlaces === "number" ? Math.pow(10, m.decimalPlaces) : 100;
  return m.amount / scale;
}

export default async function handler(req, res){
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  try{
    const variationId = (req.query.variationId || "").trim();
    if (!variationId) return res.status(400).json({ error: "variationId required" });

    const client = makeClient();

    const { result: vres } = await client.catalogApi.retrieveCatalogObject(variationId, true);
    const variation = vres.object;
    const related = [...(vres.relatedObjects || [])];

    if (!variation) return res.status(404).json({ error: "Variation not found" });

    const relatedMap = new Map();
    for (const obj of related) relatedMap.set(obj.id, obj);

    const itemId = variation?.itemVariationData?.itemId || variation?.itemId || null;
    if (!itemId) return res.status(404).json({ error: "Parent item not found" });

    let item = relatedMap.get(itemId) || null;
    if (!item){
      const { result: ires } = await client.catalogApi.retrieveCatalogObject(itemId, true);
      item = ires.object;
      for (const obj of ires.relatedObjects || []){
        related.push(obj);
        relatedMap.set(obj.id, obj);
      }
    }

    if (!item) return res.status(404).json({ error: "Parent item not found" });

    const resolveImage = (obj) => {
      const ids = obj?.itemData?.imageIds || obj?.imageIds || [];
      if (!Array.isArray(ids)) return null;
      for (const id of ids){
        const img = relatedMap.get(id);
        if (img?.type === "IMAGE" && img?.imageData?.url) return img.imageData.url;
      }
      return null;
    };

    let thumbnail = resolveImage(item);
    if (!thumbnail){
      const vImages = variation?.itemVariationData?.imageIds || [];
      for (const id of vImages){
        const img = relatedMap.get(id);
        if (img?.type === "IMAGE" && img?.imageData?.url){
          thumbnail = img.imageData.url;
          break;
        }
      }
    }

    const mInfos = item?.itemData?.modifierListInfo || [];
    const listIds = mInfos.map(mi => mi.modifierListId).filter(Boolean);

    let modifierLists = [];
    if (listIds.length){
      const { result: lres } = await client.catalogApi.batchRetrieveCatalogObjects({ objectIds: listIds, includeRelatedObjects:true });
      const lists = (lres.objects || []).filter(o => o.type === "MODIFIER_LIST");
      const relatedMods = lres.relatedObjects || [];
      const modsByList = new Map();
      for (const mod of relatedMods){
        const listId = mod?.modifierData?.modifierListId;
        if (mod.type === "MODIFIER" && listId){
          const arr = modsByList.get(listId) || [];
          arr.push(mod);
          modsByList.set(listId, arr);
        }
      }
      modifierLists = lists.map(list => ({
        id: list.id,
        name: list.modifierListData?.name || "Options",
        selectionType: list.modifierListData?.selectionType || "SINGLE",
        minSelected: list.modifierListData?.minSelected ?? 0,
        maxSelected: list.modifierListData?.maxSelected ?? 0,
        options: (modsByList.get(list.id) || []).map(m => ({
          id: m.id,
          name: m.modifierData?.name || "Option",
          priceMoney: m.modifierData?.priceMoney || null
        }))
      }));
    }

    const priceMoney = variation?.itemVariationData?.priceMoney || null;
    const variationPrice = moneyToNumber(priceMoney);

    res.status(200).json({
      product: {
        id: item.id,
        title: item.itemData?.name || "Item",
        description: item.itemData?.description || "",
        currency: priceMoney?.currency || "USD",
        thumbnail
      },
      variation: {
        id: variation.id,
        name: variation.itemVariationData?.name || "",
        price: variationPrice
      },
      modifierLists
    });
  }catch(e){
    console.error("catalog error", e);
    res.status(500).json({ error: e?.message || "Unknown error" });
  }
}
