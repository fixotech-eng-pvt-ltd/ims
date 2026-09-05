# Building the Fixotech Windows app (.exe)

The app is Electron + Supabase. `db.js` ships with the Supabase project URL +
publishable key, so the built `.exe` connects to the cloud automatically.

## Prerequisites
- Node.js (installed) and the project dependencies: `npm install`

## Build
```
npm run build            # single-file portable  -> dist\Fixotech_Smart_Calculator.exe
npm run build-installer  # NSIS installer         -> dist\Fixotech_Setup.exe
```

The packaged app is written to `dist\`. A ready-to-run copy is always produced
at **`dist\win-unpacked\Fixotech Smart Calculator.exe`** (this folder is a full,
working app you can run or zip and share as-is).

## One-time fix if the single-file build errors
electron-builder downloads a Windows code-signing helper whose archive contains
symlinks. Extracting symlinks on Windows needs a privilege that's off by default,
which produces:

> ERROR: Cannot create symbolic link : A required privilege is not held by the client … winCodeSign … .dylib

The app itself still builds to `dist\win-unpacked\`. To also get the single
`.exe`/installer, do **one** of these once, then re-run the build:

1. **Enable Developer Mode** — Settings → Privacy & security → For developers →
   Developer Mode = On. (Simplest.)
2. **Or** run the build from a terminal opened **as Administrator**.

Either grants the symlink privilege and the portable/installer step completes.

## What's included / excluded
`package.json → build.files` bundles the whole browser app (all `*.js`, `*.css`,
`index.html`, `sw.js`, `manifest.webmanifest`, `assets/`, `vendor/`) and excludes
the old backend and build-only files (`server/`, `netlify/`, `supabase/`,
`public/`, `build-web.mjs`, `*.xlsx`, `*.py`). Verified: `auth.js`, `admin.js`,
`sync.js`, `inventory*.js` are inside the packaged `app.asar`; `server/` and the
bill spreadsheets are not.

## Backend
No office server, no Render, no MongoDB. The app talks directly to Supabase
(PostgreSQL + RLS) and keeps a local offline cache that syncs when back online.
