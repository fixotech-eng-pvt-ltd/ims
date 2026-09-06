const { app, BrowserWindow, shell, session } = require('electron');
const path = require('path');
const fs = require('fs');

// NOTE: hardware acceleration is left ON for smooth, fast rendering. (It was
// previously disabled as a white-screen workaround, which made the UI sluggish;
// the real blank-screen cause was fixed in the app itself, so GPU accel is back.)

let mainWindow;
let reloadTries = 0;

// Force the visible window to repaint. On the machines hit by the compositor
// bug the content is present but not pushed to screen until something nudges
// it (a repaint / resize). We call this a few times right after load.
function forceRepaint() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try { mainWindow.webContents.invalidate(); } catch (e) {}
}

function diagLog(msg) {
  // A durable log next to the user's app data so any future problem is
  // diagnosable instead of invisible. Never throws.
  try {
    const p = path.join(app.getPath('userData'), 'fixotech-diag.log');
    fs.appendFileSync(p, `[${new Date().toISOString()}] ${msg}\n`);
  } catch (e) { /* ignore */ }
}

function showWindow() {
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
    mainWindow.show();
    mainWindow.maximize();
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    title: 'Fixotech Smart Calculator',
    icon: path.join(__dirname, 'assets/app-icons/app-512.png'),
    backgroundColor: '#0f1830', // dark background so a slow first paint is never a white flash
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    autoHideMenuBar: true,
    show: false
  });

  const wc = mainWindow.webContents;

  // --- White-screen guard #2 ----------------------------------------------
  // If the page fails to load, don't sit on a blank window: log it, retry a
  // couple of times, then show the window regardless so the built-in in-page
  // fail-safe (see index.html) can display a readable message.
  wc.on('did-fail-load', (e, code, desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return; // -3 = ERR_ABORTED (navigations we caused)
    diagLog(`did-fail-load ${code} ${desc} ${url}`);
    if (reloadTries++ < 2) setTimeout(() => { if (mainWindow) mainWindow.loadFile('index.html'); }, 400);
    else showWindow();
  });
  wc.on('render-process-gone', (e, details) => {
    diagLog('render-process-gone ' + JSON.stringify(details));
    if (reloadTries++ < 2 && mainWindow) mainWindow.reload(); else showWindow();
  });
  wc.on('unresponsive', () => diagLog('renderer unresponsive'));
  wc.on('console-message', (e, level, message, line, sourceId) => {
    if (level >= 2) diagLog(`console[${level}] ${message} (${sourceId}:${line})`); // warnings + errors
  });

  mainWindow.loadFile('index.html');

  // Open external links (WhatsApp, mailto) in the system browser/mail client
  wc.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  wc.on('will-navigate', (event, url) => {
    if (url.startsWith('mailto:') || url.startsWith('http://') || url.startsWith('https://')) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.once('ready-to-show', showWindow);
  // --- White-screen guard #3: never stay hidden. If ready-to-show never
  // fires (rare renderer stalls), show anyway after a short delay.
  setTimeout(showWindow, 3000);

  // --- White-screen guard #4: once the page is loaded, show it and nudge the
  // compositor a few times so the first frame actually reaches the screen.
  wc.on('did-finish-load', () => {
    showWindow();
    forceRepaint();
    setTimeout(forceRepaint, 200);
    setTimeout(forceRepaint, 700);
    setTimeout(forceRepaint, 1500);
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  // Allow the camera (and mic) so the Factory Floor photo capture works inside
  // the EXE. Electron denies media by default; grant it for our own app.
  try {
    const allow = new Set(['media', 'camera', 'microphone', 'fullscreen', 'clipboard-read', 'clipboard-sanitized-write']);
    session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => cb(allow.has(permission)));
    session.defaultSession.setPermissionCheckHandler((wc, permission) => allow.has(permission));
  } catch (e) { diagLog('permission handler failed: ' + e.message); }
  createWindow();
});
app.on('window-all-closed', () => { app.quit(); });
app.on('activate', () => { if (mainWindow === null) createWindow(); });
