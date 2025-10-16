// scripts/load-env.mjs
// Lightweight .env loader so local scripts mirror deployed secrets.
import { readFileSync } from "node:fs";
import { access } from "node:fs/promises";
import { constants as FS_CONSTANTS } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const CANDIDATES = [".env.local", ".env"]; // allow developers to keep per-machine overrides

/**
 * Minimal parser for KEY=VALUE pairs.
 * Supports surrounding quotes and ignores comments / blank lines.
 */
function parseDotEnv(contents) {
  const vars = new Map();
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    // Support escaped newlines (\n) similar to dotenv.
    value = value.replace(/\\n/g, "\n");
    if (key) vars.set(key, value);
  }
  return vars;
}

async function tryLoad(fileName) {
  const path = resolve(ROOT, fileName);
  try {
    await access(path, FS_CONSTANTS.R_OK);
  } catch {
    return;
  }
  const parsed = parseDotEnv(readFileSync(path, "utf8"));
  for (const [key, value] of parsed) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

await Promise.all(CANDIDATES.map(tryLoad));

// Normalize historical variable names so both legacy and new scripts work.
if (!process.env.SQUARE_ENV && process.env.SQUARE_ENVIRONMENT) {
  process.env.SQUARE_ENV = process.env.SQUARE_ENVIRONMENT;
}
if (!process.env.SQUARE_ENVIRONMENT && process.env.SQUARE_ENV) {
  process.env.SQUARE_ENVIRONMENT = process.env.SQUARE_ENV;
}
