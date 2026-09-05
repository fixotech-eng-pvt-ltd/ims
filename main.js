const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const fs = require('fs');

// --- White-screen guard #1 ------------------------------------------------
// On many Windows machines/GPUs an Electron window paints as a blank page
// (white, or just the background colour) because the GPU compositor never
// pushes the first frame to the visible surface — even though the page has
// rendered. Disabling hardware acceleration AND GPU compositing is the
// reliable, well-known cure and costs nothing for a forms/PDF business app.
// This is the #1 cause of "works on one PC, blank on another".
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('disable-gpu-compositing');

let mainWindow;
let reloadTries = 0;

// Force the visible window to repaint. On the machines hit by the compositor
// bug the content is present but not pushed to screen until something nudges
// it (a repaint / resize). We call this a few times right after load.
function forceRepaint() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try { mainWindow.webContents.invalidate(); } catch (e) {}
  try {
    // A 1px resize nudge reliably kicks the compositor. Works whether the
    // window is normal or maximized (we briefly unmaximize+remaximize).
    const wasMax = mainWindow.isMaximized();
    if (wasMax) { mainWindow.unmaximize(); mainWindow.maximize(); }
    else { const b = mainWindow.getBounds(); mainWindow.setBounds({ x: b.x, y: b.y, width: b.width, height: b.height - 1 }); mainWindow.setBounds(b); }
    mainWindow.webContents.invalidate();
  } catch (e) {}
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

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { app.quit(); });
app.on('activate', () => { if (mainWindow === null) createWindow(); });
