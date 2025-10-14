// tools/inject-catalog-url.mjs
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const FILES = [];
async function walk(dir) {
  const ents = await fs.readdir(dir, { withFileTypes: true });
  for (const e of ents) {
    if (e.name.startsWith(".git")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walk(p);
    else if (p.endsWith(".html") || p.endsWith(".js")) FILES.push(p);
  }
}
function ensureBasePathTag(html) {
  const tag = '<script src="assets/base-path.js"></script>';
  if (html.includes('assets/base-path.js')) return { text: html, changed: false };
  const headIdx = html.indexOf("<head");
  if (headIdx !== -1) {
    const closeHead = html.indexOf(">", headIdx);
    if (closeHead !== -1) {
      const before = html.slice(0, closeHead + 1);
      const after = html.slice(closeHead + 1);
      return { text: before + "\n  " + tag + "\n" + after, changed: true };
    }
  }
  return { text: tag + "\n" + html, changed: true };
}
function replaceFetches(text) {
  const re1 = /fetch\(['"]data\/products\.json['"]\)/g;
  const re2 = /fetch\(['"]\.\.\/data\/products\.json['"]\)/g;
  const re3 = /fetch\(['"]\/?[\w\-]*\/data\/products\.json['"]\)/g;
  let changed = false;
  const next = text
    .replace(re1, "fetch(window.Site.catalogUrl())")
    .replace(re2, "fetch(window.Site.catalogUrl())")
    .replace(re3, "fetch(window.Site.catalogUrl())");
  if (next !== text) changed = true;
  return { text: next, changed };
}
async function run() {
  await walk(ROOT);
  let touched = 0;
  for (const f of FILES) {
    const src = await fs.readFile(f, "utf8");
    let out = src, c = 0;
    if (f.endsWith(".html")) {
      const r = ensureBasePathTag(out);
      out = r.text; if (r.changed) c++;
    }
    const r2 = replaceFetches(out);
    out = r2.text; if (r2.changed) c++;
    if (c > 0) {
      await fs.writeFile(f, out, "utf8");
      console.log("✔ Updated", path.relative(ROOT, f), `(${c} change${c>1?"s":""})`);
      touched++;
    }
  }
  if (!touched) console.log("No changes were necessary (already configured).");
  else console.log(`\nDone. Updated ${touched} files. Commit & push your changes.`);
}
run().catch(e => { console.error(e); process.exit(1); });