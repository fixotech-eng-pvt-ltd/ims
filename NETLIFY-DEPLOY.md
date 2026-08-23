# Deploying Fixotech IMS to Netlify

The app is a static web app, so Netlify can host it at a URL any of your team can
open. This repo is already Netlify-ready.

## What was set up
- **`build-web.mjs`** — assembles the deployable site into **`public/`**, copying
  only the browser files (HTML/CSS/JS/assets/vendor + the `*-seed.js` data). It
  never copies the Electron `main.js`, the `server/` backend, `node_modules`, the
  embedded Mongo data, or the raw `*.xlsx` bill/stock files.
- **`netlify.toml`** — build command (`node build-web.mjs`), publish dir (`public`),
  the `/api/*` → function rewrite, and a no-cache header on `sw.js`.
- **`netlify/functions/api.mjs`** — optional serverless API for **shared, saved
  data** (clients + orders) backed by MongoDB Atlas.

## Option A — Deploy now (fastest, no git)
1. Run `node build-web.mjs` (creates/refreshes the `public/` folder).
2. Go to https://app.netlify.com → **Add new site → Deploy manually**.
3. **Drag the `public` folder** onto the page. Netlify gives you a live URL.

## Option B — Connect the git repo (auto-deploys on every push)
1. Push this repo to GitHub (see the repo's remote).
2. Netlify → **Add new site → Import from Git** → pick the repo.
3. Netlify reads `netlify.toml` automatically (build `node build-web.mjs`,
   publish `public`). Click **Deploy**. Every push then redeploys.

## Data: per-device now, shared later
- **As deployed (no backend):** the site works for everyone, but each person's
  data lives in **their own browser** (localStorage). Good for trying it out and
  for individual use.
- **Shared/saved across users (turn on the backend):**
  1. Create a free **MongoDB Atlas** cluster → a DB user → Network Access
     `0.0.0.0/0` (for testing) → copy the connection string
     (`mongodb+srv://…`).
  2. In Netlify → **Site settings → Environment variables** add
     **`MONGODB_URI`** = that connection string, then redeploy.
  3. Redeploy. On the `*.netlify.app` URL, the app automatically uses the
     same site's API, so clients and order history are shared for everyone who
     opens that URL. No per-person setup is needed. (For a custom domain, enter
     that URL once in **Customer panel → ⚙ settings → backend URL**.)
  - Note: today the shared backend covers **customers + quotes/orders**. Factory
    floor, inventory, dispatch and notification data are still per-device until
    those stores are migrated (planned next).

## ⚠ Privacy — read before sharing the URL
The build includes `customers-seed.js` and `inventory-seed.js`, which contain
**real customer PII** (GST, phone, contact persons) and stock data. A default
Netlify URL is public to anyone who has the link. Before sharing:
- Set the site to **password-protected** (Netlify → Site settings → Access &
  security → Visitors → Password protection), **or**
- Ask me to build a version that omits `customers-seed.js` and loads customer
  data only from the authenticated backend.

## Updating the live site
- Git deploy: just push — Netlify rebuilds.
- Manual deploy: re-run `node build-web.mjs` and drag `public` again.
