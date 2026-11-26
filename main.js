// Electron main process: one big transparent, click-through window that covers
// the screen (minus the taskbar). The nisse lives inside it. Clicks only get
// caught when the mouse is actually over the nisse or one of his menus.
const { app, BrowserWindow, screen, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

let win = null;
let tray = null;

// testing: NISSE_USERDATA=some-folder keeps a test run's settings away from the real nisse
if (process.env.NISSE_USERDATA) app.setPath('userData', process.env.NISSE_USERDATA);

if (!app.requestSingleInstanceLock()) {
  app.quit();
}

function fitToScreen() {
  if (!win) return;
  const wa = screen.getPrimaryDisplay().workArea;
  win.setBounds({ x: wa.x, y: wa.y, width: wa.width, height: wa.height });
}

function createWindow() {
  const wa = screen.getPrimaryDisplay().workArea;
  win = new BrowserWindow({
    x: wa.x,
    y: wa.y,
    width: wa.width,
    height: wa.height,
    transparent: true,
    frame: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  win.setAlwaysOnTop(true, 'screen-saver');
  win.setIgnoreMouseEvents(true, { forward: true });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // `npm run dev`: print the page's console to the terminal, and save a
  // snapshot of the window to snapshot.png after a few seconds.
  if (process.argv.includes('--dev')) {
    const log = path.join(__dirname, 'dev.log');
    fs.writeFileSync(log, '');
    win.webContents.on('console-message', (e) => {
      console.log('[page]', e.message);
      const where = e.level === 'error' ? ` (${path.basename(e.sourceId || '')}:${e.lineNumber})` : '';
      fs.appendFileSync(log, `[${e.level}] ${e.message}${where}
`);
    });
    win.webContents.on('preload-error', (_e, p, err) => console.log('[preload error]', p, err));
    // --snap=3000,6500 takes snapshot-3000.png etc. (default: one at 5 s)
    const snapArg = process.argv.find((a) => a.startsWith('--snap='));
    const times = snapArg ? snapArg.slice(7).split(',').map(Number) : [5000];
    for (const t of times) {
      setTimeout(async () => {
        const img = await win.webContents.capturePage();
        const name = snapArg ? `snapshot-${t}.png` : 'snapshot.png';
        fs.writeFileSync(path.join(__dirname, name), img.toPNG());
        console.log('[dev] saved', name);
      }, t);
    }
  }

  // if the page ever crashes or hangs, bring him back instead of leaving an invisible window
  win.webContents.on('render-process-gone', (_e, d) => {
    console.error('[main] renderer gone:', d.reason);
    if (d.reason !== 'clean-exit') setTimeout(() => win && win.reload(), 1000);
  });
  win.on('unresponsive', () => win && win.reload());

  screen.on('display-metrics-changed', fitToScreen);
  screen.on('display-added', fitToScreen);
  screen.on('display-removed', fitToScreen);
}

function send(command) {
  if (win) win.webContents.send('command', command);
}

// Start with Windows. electron.exe needs this folder as its argument, otherwise
// it would open the plain Electron demo window at login.
const loginItem = () => ({ path: process.execPath, args: [app.getAppPath()] });
const startsWithWindows = () => app.getLoginItemSettings(loginItem()).openAtLogin;
// The choice is saved in userData ('on'/'off', default on). Every start
// re-registers the current folder, so moving the project doesn't break it.
const prefFile = () => path.join(app.getPath('userData'), 'autostart');
function setStartWithWindows(on) {
  app.setLoginItemSettings({ ...loginItem(), openAtLogin: on, name: 'Nisse' });
  fs.writeFileSync(prefFile(), on ? 'on' : 'off');
}
function syncAutostart() {
  if (process.argv.includes('--dev')) return;
  // installed by pcwatch: a scheduled task starts him at login, so no Run key of our own
  if (managed) {
    if (startsWithWindows()) app.setLoginItemSettings({ ...loginItem(), openAtLogin: false });
    return;
  }
  let pref = 'on';
  try { pref = fs.readFileSync(prefFile(), 'utf8').trim(); } catch {}
  setStartWithWindows(pref !== 'off');
}

function buildTray() {
  const icon = nativeImage.createFromPath(path.join(__dirname, 'renderer', 'art', 'tray.png'));
  if (tray) {
    tray.setImage(icon);
    return;
  }
  tray = new Tray(icon);
  tray.setToolTip('Nisse');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Wardrobe…', click: () => send('wardrobe') },
      { label: 'Come here!', click: () => send('come') },
      {
        label: 'Tricks',
        submenu: [
          { label: 'Wave', click: () => send('do:wave') },
          { label: 'Jump', click: () => send('do:jump') },
          { label: 'Backflip', click: () => send('do:backflip') },
          { label: 'Dance', click: () => send('do:dance') },
          { label: 'Sleep', click: () => send('do:sleep') },
        ],
      },
      { type: 'separator' },
      ...(managed ? [] : [{ label: 'Start with Windows', type: 'checkbox', checked: startsWithWindows(), click: (item) => setStartWithWindows(item.checked) }]),
      { label: 'Reload', click: () => win && win.reload() },
      { label: 'Quit', click: () => app.quit() },
    ])
  );
  tray.on('click', () => send('wardrobe'));
}

// ---------- pcwatch ----------
// When pcwatch installs him it writes C:\ProgramData\Nisse\buddy.json
// ({ worker_url, token }). He then checks in about once a minute: reports what
// he's wearing/doing, gets his settings and any lines queued on the dashboard.
// No config file = he just runs on his own, as before. (NISSE_CONFIG=path to test.)
function readManaged() {
  const file = process.env.NISSE_CONFIG || path.join(process.env.ProgramData || 'C:\\ProgramData', 'Nisse', 'buddy.json');
  try {
    const c = JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
    return typeof c.worker_url === 'string' && /^https?:\/\//.test(c.worker_url) && typeof c.token === 'string' ? c : null;
  } catch {
    return null;
  }
}
const managed = readManaged();
let remoteStatus = null;
let remoteAcks = [];
let remoteTimer = null;

async function syncRemote() {
  clearTimeout(remoteTimer);
  if (!managed) return;
  let next = 60;
  const acks = remoteAcks.slice();
  try {
    const res = await fetch(managed.worker_url.replace(/\/$/, '') + '/api/buddy/sync', {
      method: 'POST',
      headers: { Authorization: `Bearer ${managed.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ version: app.getVersion(), status: remoteStatus, ack: acks }),
      signal: AbortSignal.timeout(20000),
    });
    if (res.ok) {
      const data = await res.json();
      remoteAcks = remoteAcks.filter((id) => !acks.includes(id));
      if (win) win.webContents.send('remote', { settings: data.settings, messages: data.messages || [] });
      next = Math.min(600, Math.max(20, Number(data.poll_seconds) || 60));
    } else {
      next = res.status === 401 ? 900 : 120; // removed on the dashboard, or server trouble
    }
  } catch {
    next = 120; // offline: he carries on as a normal nisse
  }
  remoteTimer = setTimeout(syncRemote, next * 1000);
}
ipcMain.on('remote-status', (_e, status) => { remoteStatus = status && typeof status === 'object' ? status : null; });
ipcMain.on('remote-said', (_e, id) => { if (typeof id === 'string' && !remoteAcks.includes(id)) remoteAcks.push(id); });

ipcMain.on('set-clickable', (_e, on) => {
  if (win) win.setIgnoreMouseEvents(!on, { forward: true });
});
ipcMain.on('set-name', (_e, name) => tray && tray.setToolTip(name));
ipcMain.on('quit', () => app.quit());
ipcMain.handle('read-json', (_e, name) => {
  // only plain .json files inside renderer/
  if (!/^[\w-]+(\/[\w-]+)*\.json$/.test(name)) return null;
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'renderer', name), 'utf8'));
  } catch (err) {
    console.error('read-json', name, err.message);
    return null;
  }
});
ipcMain.handle('list-tricks', () => {
  const dir = path.join(__dirname, 'renderer', 'tricks');
  try {
    return fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort();
  } catch {
    return [];
  }
});

app.whenReady().then(() => {
  createWindow();
  syncAutostart();
  buildTray();
  if (managed) win.webContents.once('did-finish-load', () => setTimeout(syncRemote, 8000));
});
app.on('second-instance', () => send('come'));
app.on('window-all-closed', () => app.quit());
