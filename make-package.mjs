// Assembles ONE self-contained folder (Fixotech-Package/) with everything the
// office needs on a pen drive: the runnable Windows app, the image library, all
// data + spreadsheets, the Supabase backend SQL, and the full source code.
// Every install talks to the SAME Supabase project, so all computers share one
// database automatically. Run:  node make-package.mjs
import { rmSync, mkdirSync, cpSync, copyFileSync, existsSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const OUT = 'Fixotech-Package';
const cp = (src, dst) => { try { if (existsSync(src)) cpSync(src, dst, { recursive: true }); } catch (e) { console.warn('skip', src, e.message); } };

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

// 1) The runnable Windows app (double-click the .exe inside)
if (existsSync('dist/win-unpacked')) cp('dist/win-unpacked', join(OUT, '1-App (run the .exe inside)'));

// 2) Image library — pick any image if one is missing in the app
const IMG = join(OUT, '2-Image-Library');
cp('assets/products', join(IMG, 'Product-Images'));
cp('assets/landing', join(IMG, 'Office-and-Factory'));
cp('assets/app-icons', join(IMG, 'App-Icons-and-Logo'));
if (existsSync('assets/watermark-f.png')) { mkdirSync(join(IMG, 'Branding'), { recursive: true }); copyFileSync('assets/watermark-f.png', join(IMG, 'Branding', 'watermark-f.png')); }

// 3) Data — spreadsheets + the generated seed data
const DATA = join(OUT, '3-Data');
mkdirSync(join(DATA, 'Spreadsheets'), { recursive: true });
readdirSync('.').filter(f => extname(f).toLowerCase() === '.xlsx').forEach(f => copyFileSync(f, join(DATA, 'Spreadsheets', f)));
mkdirSync(join(DATA, 'Generated-Seed-Data'), { recursive: true });
['customers-seed.js', 'inventory-seed.js'].forEach(f => { if (existsSync(f)) copyFileSync(f, join(DATA, 'Generated-Seed-Data', f)); });

// 4) Backend (Supabase) — schema + setup
cp('supabase', join(OUT, '4-Backend-Supabase'));

// 5) Full source code (for developers / rebuilding the app)
const SRC = join(OUT, '5-Source-Code');
mkdirSync(SRC, { recursive: true });
const SKIP = new Set(['node_modules', 'dist', OUT, '.git', '.claude', 'Fixotech-Package', 'public']);
for (const name of readdirSync('.')) {
  if (SKIP.has(name) || name.startsWith('.')) continue;
  let st; try { st = statSync(name); } catch { continue; }
  if (name.toLowerCase().endsWith('.xlsx')) continue;   // spreadsheets already in 3-Data
  cp(name, join(SRC, name));
}

// Top-level guide
writeFileSync(join(OUT, 'README.txt'),
`FIXOTECH IMS — MASTER PACKAGE
=============================

Everything is in this one folder. Copy the whole folder to a pen drive, then to
each office computer.

WHAT'S INSIDE
  1-App .............. The Windows app. Open the folder and double-click
                       "Fixotech Smart Calculator.exe". That's it.
  2-Image-Library .... All product images, office/factory photos, logo & icons.
                       Use these if an image is ever missing in the app.
  3-Data ............. The source bill/stock spreadsheets + the generated
                       customer & inventory seed data.
  4-Backend-Supabase . The database setup (SQL) — already applied to the live
                       Supabase project. See its SETUP file.
  5-Source-Code ...... The full application source (for developers / rebuilding).

HOW THE SHARED DATABASE WORKS  (important)
  The app is pre-connected to your Supabase cloud database. EVERY computer that
  runs this app — and every phone that opens the web version — automatically
  uses the SAME database. So the moment you install it on another computer, it is
  already interconnected: customers, orders, indents, inventory, dispatch and
  notifications are shared live, and it keeps working offline and re-syncs when
  the internet returns.

  Nothing extra to configure per computer. Just copy the 1-App folder and run it.

PHONES (engineers in the factory)
  See INSTALL-AND-PHONE.txt in this folder.
`);

writeFileSync(join(OUT, 'INSTALL-AND-PHONE.txt'),
`INSTALL ON OFFICE COMPUTERS
===========================
1. Copy this whole folder (or just "1-App") onto the computer.
2. Open "1-App" and double-click "Fixotech Smart Calculator.exe".
3. Log in. Done — it already shares the same cloud database as every other
   computer. No per-computer setup.

(If Windows SmartScreen warns because the app isn't code-signed, click
 "More info" -> "Run anyway". To create a single-file .exe / installer instead
 of the folder, see 5-Source-Code/BUILD-WINDOWS.md.)

USE ON ENGINEERS' PHONES
========================
The app also runs in a phone browser and shares the SAME database.
1. Host the web version once (free): drag the generated "public" folder onto
   https://app.netlify.com  (Deploy manually). You get a link like
   https://fixotech.netlify.app  — see 5-Source-Code/NETLIFY-DEPLOY.md.
   (To make "public", run:  node build-web.mjs  in 5-Source-Code.)
2. On each engineer's phone, open that link in Chrome and choose
   "Add to Home screen" — it installs like an app.
3. They log in with the shared login and see the same live data as the office.

Because everything (computers + phones) points at the same Supabase project,
they are all interconnected on one database.
`);

console.log('Built ./' + OUT);
