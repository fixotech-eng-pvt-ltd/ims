# Fixotech — install & test on your phone

The whole ecosystem (Smart Calculator, Proforma, Factory Floor, Dispatch, ChatIQ)
is now a **PWA** — an installable app. Pick the option that suits you.

> ⚠️ **Camera needs HTTPS.** getUserMedia (the back-camera photo capture on the
> Factory Floor / Dispatch) only works over **https://** or **localhost** — NOT
> plain `http://192.168.x.x`. So use one of the HTTPS options below.

---

## Option A — Fastest: install as an app (PWA) over a free HTTPS tunnel
Test on the phone in ~3 minutes, camera included. No Android build needed.

1. On the PC, from this folder, serve the app:
   ```bash
   npx serve -l 4599 .
   ```
2. In another terminal, expose it over HTTPS with a tunnel (either works):
   ```bash
   npx cloudflared tunnel --url http://localhost:4599
   # or:  npx localtunnel --port 4599
   ```
   You'll get an `https://….trycloudflare.com` URL.
3. Open that HTTPS URL in **Chrome on your phone**.
4. Chrome menu (⋮) → **Add to Home screen / Install app**. It installs with the
   Fixotech icon and opens full-screen like a native app — camera works.

Any code change you make + redeploy shows up when you reopen the app
(bump `CACHE` in `sw.js` to force phones to pull the newest files).

---

## Option B — A real installable APK (for sideloading / sharing)
Wrap the PWA into an Android `.apk` with Capacitor. Needs **Node + Android Studio**
(Android SDK) on the PC once.

```bash
cd "code product"
npm i -D @capacitor/cli @capacitor/core @capacitor/android
npx cap init Fixotech com.fixotech.ecosystem --web-dir .   # config already provided
npx cap add android
npx cap sync android
npx cap open android         # opens Android Studio
```
In Android Studio: **Build → Build Bundle(s)/APK(s) → Build APK**. The debug APK
lands in `android/app/build/outputs/apk/debug/app-debug.apk` — copy it to the
phone and install (enable "Install unknown apps").

Grant the app **Camera** permission on first photo capture.

*(No-toolchain alternative: deploy the app to any HTTPS host, then paste that URL
into **https://www.pwabuilder.com** → it generates a signed Android package for you.)*

---

## App icon
Icons are generated from your Fixotech logo into
`assets/app-icons/app-192.png`, `app-512.png`, `app-maskable-512.png`
and referenced by `manifest.webmanifest`. Drop a replacement logo there (same
names) and redeploy to change the app icon.

## Backend / offline
- Backend: set the data layer in `db.js` (`fixo_backend_cfg`) to MongoDB/Supabase
  when the cloud is ready; today it runs on local storage.
- Offline: `sw.js` caches the whole app shell, so it opens and works with no
  network; changes made offline stay in local storage and are there when you
  reconnect.
