#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const input = process.argv[2] || 'data/products.json';
const absPath = path.resolve(process.cwd(), input);

function toItems(payload) {
  if (!payload) return [];
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.objects)) return payload.objects;
  if (Array.isArray(payload)) return payload;
  return [];
}

function getName(item) {
  if (!item || typeof item !== 'object') return '';
  return (
    item.title ||
    item.name ||
    (item.itemData && item.itemData.name) ||
    ''
  ).trim();
}

function getVariations(item) {
  if (!item || typeof item !== 'object') return [];
  if (Array.isArray(item.variations)) return item.variations;
  if (Array.isArray(item.itemData?.variations)) return item.itemData.variations;
  return [];
}

function placeholderReason(name) {
  if (!name) return 'missing name';
  const lower = name.toLowerCase();
  if (lower === '(unnamed)' || lower === 'untitled') return 'placeholder name';
  if (/^product\s+\d+$/i.test(name)) return 'placeholder name';
  return null;
}

function variationQuality(variation) {
  if (!variation || typeof variation !== 'object') return false;
  if (typeof variation.price === 'number') return true;
  if (typeof variation.priceMoney?.amount === 'number') return true;
  if (typeof variation.itemVariationData?.priceMoney?.amount === 'number') return true;
  return false;
}

async function main() {
  let raw;
  try {
    raw = await fs.readFile(absPath, 'utf8');
  } catch (err) {
    console.error(`Unable to read ${absPath}:`, err.message || err);
    process.exitCode = 1;
    return;
  }

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (err) {
    console.error(`File ${absPath} is not valid JSON:`, err.message || err);
    process.exitCode = 1;
    return;
  }

  const items = toItems(payload);
  const total = items.length;

  const flagged = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const name = getName(item);
    const variations = getVariations(item);
    const nameIssue = placeholderReason(name);
    const hasRealVariation = variations.some(variationQuality);

    const problems = [];
    if (nameIssue) problems.push(nameIssue);
    if (!variations.length) problems.push('no variations');
    if (variations.length && !hasRealVariation) problems.push('variations missing prices');

    if (problems.length) {
      flagged.push({
        index: i,
        id: item.id || item?.itemData?.id || null,
        name,
        problems,
      });
    }
  }

  const shape = Array.isArray(payload?.objects)
    ? 'square-catalog-objects'
    : Array.isArray(payload?.items)
      ? 'site-catalog-items'
      : Array.isArray(payload)
        ? 'array'
        : typeof payload;

  console.log(JSON.stringify({
    file: absPath,
    shape,
    total,
    flagged: flagged.length,
    sample: items.slice(0, 5).map((item) => ({
      id: item.id || item?.itemData?.id || null,
      name: getName(item),
      variations: getVariations(item).length,
    })),
    problems: flagged.slice(0, 20),
  }, null, 2));

  if (flagged.length) {
    console.error(`\n${flagged.length}/${total || 1} products look like placeholders or missing pricing.`);
    process.exitCode = 2;
  }
}

main();
