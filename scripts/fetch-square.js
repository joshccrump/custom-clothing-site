#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import './load-env.mjs';

const ENV_NAME = (process.env.SQUARE_ENV || process.env.SQUARE_ENVIRONMENT || 'production').toLowerCase();
const ACCESS_TOKEN = (process.env.SQUARE_ACCESS_TOKEN || '').trim();
const LOCATION_ID = (process.env.SQUARE_LOCATION_ID || 'L116Z8RBA1RJ4').trim() || null;
const OUTPUT_PATH = path.resolve(process.cwd(), process.env.OUTPUT_PATH || 'data/products.json');
const SQUARE_VERSION = process.env.SQUARE_VERSION || '2024-06-12';
const MOCK_PATH = resolveMockPath();

if (!MOCK_PATH && ACCESS_TOKEN.length < 32) {
  console.error('❌ Missing SQUARE_ACCESS_TOKEN (set env or pass --mock <path>)');
  process.exit(1);
}

const BASE =
  ENV_NAME === 'sandbox'
    ? 'https://connect.squareupsandbox.com'
    : 'https://connect.squareup.com';

const COMMON_HEADERS = {
  Accept: 'application/json',
  'Square-Version': SQUARE_VERSION,
  ...(MOCK_PATH ? {} : { Authorization: `Bearer ${ACCESS_TOKEN}` }),
};

async function readJson(filePath) {
  const absolute = path.resolve(process.cwd(), filePath);
  const raw = await fs.readFile(absolute, 'utf8');
  return JSON.parse(raw);
}

function resolveMockPath() {
  const argv = process.argv.slice(2);
  const mockIndex = argv.findIndex((arg) => arg === '--mock');
  if (mockIndex >= 0) {
    const candidate = argv[mockIndex + 1];
    if (!candidate) {
      console.error('❌ --mock flag requires a path argument');
      process.exit(1);
    }
    return candidate;
  }
  if (process.env.SQUARE_MOCK_CATALOG) {
    return process.env.SQUARE_MOCK_CATALOG;
  }
  return null;
}

async function listCatalogObjects() {
  if (MOCK_PATH) {
    console.log(`⚙️  Using mock catalog: ${MOCK_PATH}`);
    const payload = await readJson(MOCK_PATH);
    if (Array.isArray(payload.objects)) return payload.objects;
    if (Array.isArray(payload)) return payload;
    throw new Error('Mock catalog must be an array or contain an "objects" array.');
  }

  const out = [];
  let cursor;
  const types = 'ITEM,IMAGE,MODIFIER_LIST,ITEM_OPTION,CATEGORY';

  do {
    const url = new URL(`${BASE}/v2/catalog/list`);
    url.searchParams.set('types', types);
    if (cursor) url.searchParams.set('cursor', cursor);

    const res = await fetch(url, { headers: COMMON_HEADERS });
    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch (err) {
      console.error('Catalog list response was not JSON:', text);
      throw err;
    }

    if (!res.ok) {
      const message = body?.errors?.map((e) => e.detail || e.code).join(', ') || res.statusText;
      throw new Error(`Catalog list failed (${res.status}): ${message}`);
    }

    if (Array.isArray(body.objects)) {
      out.push(...body.objects);
    }
    cursor = body.cursor;
  } while (cursor);

  return out;
}

function moneyToDecimal(m) {
  if (!m) return null;
  const amount = typeof m.amount === 'number' ? m.amount : Number.parseInt(m.amount ?? '', 10);
  if (!Number.isFinite(amount)) return null;
  const scale = typeof m.decimalPlaces === 'number' ? 10 ** m.decimalPlaces : 100;
  return amount / scale;
}

function collectOptionMaps(objects) {
  const optionsById = new Map();
  const optionValuesById = new Map();

  for (const obj of objects) {
    if (obj.type !== 'ITEM_OPTION') continue;
    const data = obj.itemOptionData || {};
    optionsById.set(obj.id, { id: obj.id, name: data.name || 'Option' });
    for (const value of data.values || []) {
      optionValuesById.set(value.id, {
        id: value.id,
        optionId: obj.id,
        name: value.name || 'Value',
      });
    }
  }

  return { optionsById, optionValuesById };
}

function collectImageMap(objects) {
  const map = new Map();
  for (const obj of objects) {
    if (obj.type !== 'IMAGE') continue;
    map.set(obj.id, obj.imageData?.url || null);
  }
  return map;
}

function collectModifierLists(objects) {
  const map = new Map();
  for (const obj of objects) {
    if (obj.type !== 'MODIFIER_LIST') continue;
    const data = obj.modifierListData || {};
    const modifiers = [];
    for (const modifier of data.modifiers || []) {
      const md = modifier.modifierData || {};
      modifiers.push({
        id: modifier.id,
        name: md.name || 'Option',
        price: moneyToDecimal(md.priceMoney),
        currency: md.priceMoney?.currency || null,
      });
    }
    map.set(obj.id, {
      id: obj.id,
      name: data.name || 'Options',
      selectionType: data.selectionType || 'SINGLE',
      minSelected: data.minimumSelectedModifiers ?? null,
      maxSelected: data.maximumSelectedModifiers ?? null,
      options: modifiers,
    });
  }
  return map;
}

function collectCategories(objects) {
  const map = new Map();
  for (const obj of objects) {
    if (obj.type !== 'CATEGORY') continue;
    map.set(obj.id, obj.categoryData?.name || null);
  }
  return map;
}

function extractCustomUrl(itemData) {
  const values = itemData?.customAttributeValues;
  if (!values || typeof values !== 'object') return null;
  const preferredKeys = ['product_url', 'external_url', 'url', 'link'];
  for (const key of Object.keys(values)) {
    const entry = values[key];
    const label = (entry?.name || key || '').toLowerCase();
    if (!entry) continue;
    const value = entry.stringValue || entry.customAttributeValue?.stringValue || entry.value || null;
    if (typeof value !== 'string') continue;
    const normalized = value.trim();
    if (!/^https?:/i.test(normalized)) continue;
    if (preferredKeys.includes(label) || preferredKeys.includes(key.toLowerCase())) {
      return normalized;
    }
  }
  // Fall back to first https value
  for (const key of Object.keys(values)) {
    const entry = values[key];
    const value = entry?.stringValue || entry?.value || null;
    if (typeof value === 'string' && /^https?:/i.test(value.trim())) {
      return value.trim();
    }
  }
  return null;
}

function dedupe(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function buildItems(objects, inventoryByVariation) {
  const images = collectImageMap(objects);
  const modifierLists = collectModifierLists(objects);
  const categories = collectCategories(objects);
  const { optionsById, optionValuesById } = collectOptionMaps(objects);

  const items = [];
  for (const obj of objects) {
    if (obj.type !== 'ITEM') continue;
    const data = obj.itemData || {};
    if (data.isArchived) continue;

    const variations = [];
    let priceMin = null;
    let priceMax = null;
    let currency = null;
    const sizeLabels = new Set();

    for (const variation of data.variations || []) {
      const vd = variation.itemVariationData || {};
      const price = moneyToDecimal(vd.priceMoney);
      const variationCurrency = vd.priceMoney?.currency || null;
      if (typeof price === 'number') {
        priceMin = priceMin == null ? price : Math.min(priceMin, price);
        priceMax = priceMax == null ? price : Math.max(priceMax, price);
      }
      if (!currency && variationCurrency) {
        currency = variationCurrency;
      }

      const optionValueEntries = [];
      for (const ref of vd.itemOptionValues || []) {
        const valueEntry = optionValuesById.get(ref.itemOptionValueId);
        if (!valueEntry) continue;
        const optionEntry = optionsById.get(valueEntry.optionId);
        optionValueEntries.push({
          option: optionEntry?.name || null,
          value: valueEntry.name || null,
        });
        const optionName = optionEntry?.name?.toLowerCase() || '';
        if (optionName.includes('size') || optionName.includes('length')) {
          sizeLabels.add(valueEntry.name);
        }
      }

      const stock = inventoryByVariation.get(variation.id) ?? null;

      variations.push({
        id: variation.id,
        name: vd.name || 'Variation',
        sku: vd.sku || null,
        price,
        currency: variationCurrency || currency || null,
        stock,
        optionValues: optionValueEntries.length ? optionValueEntries : undefined,
      });
    }

    if (!variations.length) continue;

    const thumbnailId = Array.isArray(data.imageIds) ? data.imageIds[0] : null;
    const thumbnail = thumbnailId ? images.get(thumbnailId) || null : null;
    const description = data.descriptionHtml || data.description || '';
    const url = extractCustomUrl(data);
    const category = data.categoryId ? categories.get(data.categoryId) || null : null;
    const stockTotal = variations
      .map((v) => (typeof v.stock === 'number' ? v.stock : null))
      .filter((n) => n != null)
      .reduce((sum, n) => sum + n, 0);

    items.push({
      id: obj.id,
      title: data.name || 'Untitled',
      description,
      thumbnail,
      currency: currency || variations.find((v) => v.currency)?.currency || 'USD',
      price_min: priceMin,
      price_max: priceMax,
      variations: variations.map(({ optionValues, ...rest }) => ({ ...rest })),
      modifier_lists: (data.modifierListInfo || [])
        .map((info) => modifierLists.get(info.modifierListId))
        .filter(Boolean),
      sizes: dedupe(Array.from(sizeLabels)),
      category,
      tags: Array.isArray(data.tags) ? data.tags : [],
      stock: Number.isFinite(stockTotal) ? stockTotal : null,
      url,
    });
  }

  return items;
}

async function fetchInventory(variationIds) {
  if (!variationIds.length || !LOCATION_ID || MOCK_PATH) {
    return new Map();
  }

  const results = new Map();
  const chunkSize = 90;
  const headers = { ...COMMON_HEADERS, 'Content-Type': 'application/json' };

  for (let i = 0; i < variationIds.length; i += chunkSize) {
    const chunk = variationIds.slice(i, i + chunkSize);
    const res = await fetch(`${BASE}/v2/inventory/batch-retrieve-counts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        catalogObjectIds: chunk,
        locationIds: [LOCATION_ID],
        states: ['IN_STOCK', 'RESERVED']
      }),
    });

    const text = await res.text();
    let body;
    try {
      body = JSON.parse(text);
    } catch (err) {
      console.error('Inventory response was not JSON:', text);
      throw err;
    }

    if (!res.ok) {
      const message = body?.errors?.map((e) => e.detail || e.code).join(', ') || res.statusText;
      throw new Error(`Inventory fetch failed (${res.status}): ${message}`);
    }

    for (const count of body.counts || []) {
      if (!count || !count.catalogObjectId) continue;
      const qty = typeof count.quantity === 'string' ? Number.parseFloat(count.quantity) : count.quantity;
      if (!Number.isFinite(qty)) continue;
      const current = results.get(count.catalogObjectId) || 0;
      results.set(count.catalogObjectId, current + qty);
    }
  }

  return results;
}

async function main() {
  console.log('=== Square catalog sync ===');
  console.log('Environment:', MOCK_PATH ? '(mock)' : ENV_NAME);
  if (!MOCK_PATH) {
    console.log('Location ID:', LOCATION_ID || '(not provided)');
  }

  const objects = await listCatalogObjects();
  const variationIds = objects
    .filter((obj) => obj.type === 'ITEM')
    .flatMap((obj) => (obj.itemData?.variations || []).map((variation) => variation.id))
    .filter(Boolean);

  let inventoryByVariation = new Map();
  try {
    inventoryByVariation = await fetchInventory(variationIds);
  } catch (err) {
    console.warn('⚠️  Inventory lookup failed; continuing without stock counts.');
    console.warn(err.message || err);
  }

  const items = buildItems(objects, inventoryByVariation);

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(items, null, 2));

  console.log(`✅ Wrote ${items.length} items → ${OUTPUT_PATH}`);
}

main().catch((err) => {
  console.error('❌ Sync failed:', err.message || err);
  process.exit(1);
});
