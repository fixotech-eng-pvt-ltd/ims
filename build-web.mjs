// Assembles the static web build for Netlify into ./public
// Copies ONLY the browser app files — never the Electron main, the backend
// server, node_modules, the embedded Mongo data, or the raw bill/stock
// spreadsheets (which contain customer PII).
import { readdirSync, statSync, mkdirSync, rmSync, cpSync, copyFileSync } from 'node:fs';
import { join, extname } from 'node:path';

const OUT = 'public';
const ALLOW_EXT = new Set(['.html', '.css', '.js', '.webmanifest']);
const BLACKLIST = new Set(['main.js', 'build-web.mjs', 'capacitor.config.json', 'package.json', 'package-lock.json', 'textgvhi.html']);
const DIRS = ['assets', 'vendor'];

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

let n = 0;
for (const name of readdirSync('.')) {
  if (BLACKLIST.has(name) || name.startsWith('.')) continue;
  let st; try { st = statSync(name); } catch { continue; }
  if (st.isDirectory()) continue;
  if (ALLOW_EXT.has(extname(name))) { copyFileSync(name, join(OUT, name)); n++; }
}
for (const d of DIRS) { try { cpSync(d, join(OUT, d), { recursive: true }); n++; } catch {} }

console.log(`[build-web] wrote ./${OUT} (${n} entries)`);
