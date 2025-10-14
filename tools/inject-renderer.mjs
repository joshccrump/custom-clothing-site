// tools/inject-renderer.mjs
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const TARGETS = ["shop.html", path.join("gallery","index.html")];

async function exists(p){ try{ await fs.access(p); return true; } catch { return false; } }

function addScript(html, src){
  if (html.includes(src)) return html;
  const tag = `\n  <script src="${src}"></script>\n`;
  const head = html.indexOf("<head");
  if (head !== -1){
    const close = html.indexOf(">", head);
    if (close !== -1) return html.slice(0, close+1) + tag + html.slice(close+1);
  }
  return tag + html;
}

function ensureGrid(html){
  if (html.includes('data-products') || html.includes('id="catalog-grid"')) return html;
  const marker = '</main>';
  const grid = '\n<div id="catalog-grid" data-products class="row row-cols-1 row-cols-sm-2 row-cols-md-3 g-4"></div>\n';
  if (html.includes(marker)) return html.replace(marker, grid + marker);
  return html.replace('</body>', grid + '</body>');
}

async function updateFile(rel){
  const p = path.join(ROOT, rel);
  if (!await exists(p)) return false;
  let src = await fs.readFile(p, "utf8");
  const orig = src;
  src = addScript(src, "assets/base-path.js");
  src = addScript(src, "assets/render-catalog.js");
  src = ensureGrid(src);
  if (src !== orig){
    await fs.writeFile(p, src, "utf8");
    console.log("✔ Updated", rel);
    return true;
  } else {
    console.log("… No changes needed for", rel);
    return false;
  }
}

(async function(){
  let changed = 0;
  for (const f of TARGETS) {
    const ok = await updateFile(f);
    if (ok) changed++;
  }
  console.log("\nDone. Files updated:", changed);
})().catch(e => { console.error(e); process.exit(1); });