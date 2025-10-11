// scripts/fetch-square.mjs
// Fetch all Square Catalog items via REST and write to a JSON file.
// Usage: node scripts/fetch-square.mjs --out data/square-items.json [--types ITEM,ITEM_VARIATION]
// Env required: SQUARE_ACCESS_TOKEN (secret). Optional: SQUARE_ENVIRONMENT=production|sandbox
// Optional: SQUARE_LOCATION_ID (not needed for listing catalog).

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const [k, v] = a.split('=');
      if (v !== undefined) args[k.slice(2)] = v;
      else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        args[k.slice(2)] = argv[++i];
      } else {
        args[k.slice(2)] = true;
      }
    }
  }
  return args;
}

const args = parseArgs(process.argv);
const outPath = args.out || 'data/square-items.json';
const types = args.types || 'ITEM,ITEM_VARIATION,IMAGE,MODIFIER,MODIFIER_LIST,CATEGORY';

const env = (process.env.SQUARE_ENVIRONMENT || 'production').toLowerCase();
const baseUrl = env === 'sandbox' ? 'https://connect.squareupsandbox.com' : 'https://connect.squareup.com';
const token = process.env.SQUARE_ACCESS_TOKEN;

if (!token) {
  console.error('Missing SQUARE_ACCESS_TOKEN env var.');
  process.exit(2);
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function listAllCatalog() {
  let cursor = undefined;
  const objects = [];
  let page = 0;

  while (true) {
    const url = new URL('/v2/catalog/list', baseUrl);
    url.searchParams.set('types', types);
    if (cursor) url.searchParams.set('cursor', cursor);

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
        'Square-Version': '2025-03-19'
      }
    });

    if (res.status === 429) { // rate limited
      const retry = Number(res.headers.get('retry-after') || 2) * 1000;
      console.warn(`Rate limited; retrying after ${retry}ms...`);
      await sleep(retry);
      continue;
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Square API error ${res.status}: ${text}`);
    }

    const data = await res.json();
    if (Array.isArray(data.objects)) {
      objects.push(...data.objects);
    }
    cursor = data.cursor;
    page++;
    if (!cursor) break;
    await sleep(150); // gentle pacing
  }

  return objects;
}

async function main() {
  console.log(`Environment: ${env} • Types: ${types}`);
  const objects = await listAllCatalog();

  // Ensure output directory exists
  await mkdir(dirname(outPath), { recursive: true });

  const payload = {
    fetched_at: new Date().toISOString(),
    environment: env,
    count: objects.length,
    types_requested: types.split(','),
    objects
  };

  await writeFile(outPath, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`Wrote ${objects.length} objects to ${outPath}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
