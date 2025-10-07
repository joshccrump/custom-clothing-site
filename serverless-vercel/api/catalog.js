import Square from "square";
const { Client } = Square;
const Environment = Square?.Environment ?? { Production: "production", Sandbox: "sandbox" };

function cors(res){
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

export default async function handler(req, res){
  cors(res);
  if (req.method === "OPTIONS") return res.status(200).end();
  try{
    const variationId = (req.query.variationId || "").trim();
    if (!variationId) return res.status(400).json({ error: "variationId required" });

    const env = (process.env.SQUARE_ENV || "production").toLowerCase() === "production"
      ? Environment.Production : Environment.Sandbox;

    const client = new Client({
      bearerAuthCredentials: { accessToken: process.env.SQUARE_ACCESS_TOKEN },
      environment: env,
    });

    // 1) Retrieve the variation including related objects
    const { result: vres } = await client.catalogApi.retrieveCatalogObject(variationId, true);
    const variation = vres.object;
    const related = vres.relatedObjects || [];

    // 2) Determine parent item id
    const itemId = variation?.itemVariationData?.itemId || variation?.itemId || null;
    if (!itemId) return res.status(404).json({ error: "Parent item not found" });

    // 3) Find the ITEM in related; if missing, fetch
    let item = related.find(o => o.type === "ITEM" && o.id === itemId);
    if (!item){
      const { result: ires } = await client.catalogApi.retrieveCatalogObject(itemId, true);
      item = ires.object;
      related.push(...(ires.relatedObjects || []));
    }

    // 4) Gather modifier list ids
    const mInfos = item?.itemData?.modifierListInfo || [];
    const listIds = mInfos.map(mi => mi.modifierListId).filter(Boolean);

    let modifierLists = [];
    if (listIds.length){
      // Batch retrieve lists
      const { result: lres } = await client.catalogApi.batchRetrieveCatalogObjects({ objectIds: listIds, includeRelatedObjects: true });
      const lists = lres.objects || [];
      for (const list of lists){
        const options = (lres.relatedObjects || []).filter(o => o.type === "MODIFIER" && o.modifierData?.modifierListId === list.id);
        modifierLists.push({
          id: list.id,
          name: list.modifierListData?.name || "Options",
          selectionType: (list.modifierListData?.selectionType || "SINGLE"),
          minSelected: list.modifierListData?.minSelected ?? 0,
          maxSelected: list.modifierListData?.maxSelected ?? 0,
          options: options.map(m => ({
            id: m.id,
            name: m.modifierData?.name || "Option",
            priceMoney: m.modifierData?.priceMoney || null
          }))
        });
      }
    }

    // 5) Shape response
    res.status(200).json({
      product: {
        id: item.id,
        title: item.itemData?.name || "Item",
        currency: item.itemData?.variations?.[0]?.itemVariationData?.priceMoney?.currency || "USD",
        thumbnail: item.itemData?.imageIds?.[0] ? ("") : null, // image fetch omitted
      },
      variation: {
        id: variation.id,
        name: variation.itemVariationData?.name || "",
        price: (variation.itemVariationData?.priceMoney?.amount ?? 0)/100
      },
      modifierLists
    });
  }catch(e){
    console.error("catalog error", e);
    res.status(500).json({ error: e?.message || "Unknown error" });
  }
}