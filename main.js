// Electron main process: one big transparent, click-through window that covers
// the screen (minus the taskbar). The nisse lives inside it. Clicks only get
// caught when the mouse is actually over the nisse or one of his menus.
const { app, BrowserWindow, screen, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

let win = null;
let tray = null;

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
    setTimeout(async () => {
      const img = await win.webContents.capturePage();
      fs.writeFileSync(path.join(__dirname, 'snapshot.png'), img.toPNG());
      console.log('[dev] snapshot saved');
    }, 5000);
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
function setStartWithWindows(on) {
  app.setLoginItemSettings({ ...loginItem(), openAtLogin: on, name: 'Nisse' });
}
// switched on the first time he runs; after that the tray checkbox decides
function firstRunAutostart() {
  const flag = path.join(app.getPath('userData'), 'autostart-set');
  if (fs.existsSync(flag) || process.argv.includes('--dev')) return;
  setStartWithWindows(true);
  fs.writeFileSync(flag, new Date().toISOString());
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
      { label: 'Start with Windows', type: 'checkbox', checked: startsWithWindows(), click: (item) => setStartWithWindows(item.checked) },
      { label: 'Reload', click: () => win && win.reload() },
      { label: 'Quit', click: () => app.quit() },
    ])
  );
  tray.on('click', () => send('wardrobe'));
}

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
  firstRunAutostart();
  buildTray();
});
app.on('second-instance', () => send('come'));
app.on('window-all-closed', () => app.quit());
