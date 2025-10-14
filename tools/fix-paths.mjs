// tools/fix-paths.mjs
import fs from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();

const matchers = [
  { ex: /src="\/assets\/js\/nav-cart\.js"/g, to: 'src="assets/js/nav-cart.js"' },
  { ex: /src="\/assets\/js\/catalog-empty-state\.js"/g, to: 'src="assets/js/catalog-empty-state.js"' },
  { ex: /href="\/cart\.html"/g, to: 'href="cart.html"' },
  { ex: /href="\/clients\/"/g, to: 'href="clients/"' },
  { ex: /fetch\(['"]\/data\/products\.json['"]\)/g, to: "fetch('data/products.json')" },
];

async function walk(dir, exts) {
  const out = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith(".git")) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...await walk(p, exts));
    else if (exts.includes(path.extname(e.name))) out.push(p);
  }
  return out;
}

function applyAll(text) {
  let changed = 0;
  for (const { ex, to } of matchers) {
    const before = text;
    text = text.replace(ex, to);
    if (text !== before) changed++;
  }
  return { text, changed };
}

async function main() {
  const htmlFiles = await walk(repoRoot, [".html"]);
  const jsFiles = await walk(repoRoot, [".js"]);
  const targets = [...htmlFiles, ...jsFiles];

  let touched = 0;
  for (const file of targets) {
    const src = await fs.readFile(file, "utf8");
    const { text, changed } = applyAll(src);
    if (changed > 0) {
      await fs.writeFile(file, text, "utf8");
      touched++;
      console.log(`✔ Fixed ${changed} patterns in ${path.relative(repoRoot, file)}`);
    }
  }

  if (touched === 0) {
    console.log("No changes needed (already relative).");
  } else {
    console.log(`\nDone. Updated ${touched} files. Commit and push your changes.`);
  }
}

main().catch(err => {
  console.error("fix-paths failed:", err);
  process.exit(1);
});
