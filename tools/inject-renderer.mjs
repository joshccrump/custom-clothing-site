// tools/inject-renderer.mjs
// Injects base-path + render-catalog into shop.html and gallery/index.html (if they exist),
// and ensures a [data-products] container is present.
// Usage: node tools/inject-renderer.mjs
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const TARGETS = ["shop.html", path.join("gallery","index.html")];

async function fileExists(p){ try { await fs.access(p); return true; } catch { return false; } }

function addScriptTag(html, src){
  if (html.includes(src)) return html;
  const tag = `\n  <script src="${src}"></script>\n`;
  const headIdx = html.indexOf("<head");
  if (headIdx !== -1){
    const close = html.indexOf(">", headIdx);
    if (close !== -1) return html.slice(0, close+1) + tag + html.slice(close+1);
  }
  return tag + html;
}

function ensureProductsContainer(html){
  if (html.includes('data-products') || html.includes('id="catalog-grid"')) return html;
  const marker = '</main>';
  const card = '\n<div id="catalog-grid" data-products class="row row-cols-1 row-cols-sm-2 row-cols-md-3 g-4"></div>\n';
  if (html.includes(marker)){
    return html.replace(marker, card + marker);
  }
  // fallback: before </body>
  return html.replace('</body>', card + '</body>');
}

async function processFile(rel){
  const p = path.join(ROOT, rel);
  if (!(await fileExists(p))) return false;
  let src = await fs.readFile(p, "utf8");
  const orig = src;
  src = addScriptTag(src, "assets/base-path.js");
  src = addScriptTag(src, "assets/render-catalog.js");
  src = ensureProductsContainer(src);
  if (src !== orig){
    await fs.writeFile(p, src, "utf8");
    console.log("✔ Updated", rel);
    return true;
  }
  console.log("… No changes needed for", rel);
  return false;
}

(async function(){
  let changed = 0;
  for (const f of TARGETS){
    const ok = await processFile(f);
    if (ok) changed++;
  }
  console.log("\nDone. Files updated:", changed);
})().catch(e=>{ console.error(e); process.exit(1); });
