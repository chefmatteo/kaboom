const { app, ipcMain, BrowserWindow } = require('electron');
const path = require('path');

// Tickets live in the OS app-data dir, not next to the code — inside a packaged
// .app the bundle is read-only, and your board shouldn't be wiped by a reinstall.
const DATA_DIR = app.getPath('userData');
ipcMain.on('data-dir', e => { e.returnValue = DATA_DIR; });

// ponytail: nodeIntegration on, no preload/IPC layer. Safe because this window only ever
// loads local files we wrote. Add a preload + contextBridge the day it loads anything remote.
app.whenReady().then(() => {
  const win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 720,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#ebe7e4',
    // sandbox must be off for require() in the renderer; default true breaks our scripts.
    webPreferences: { nodeIntegration: true, contextIsolation: false, sandbox: false },
  });
  win.loadFile(path.join(__dirname, 'index.html'));
});

app.on('window-all-closed', () => app.quit());
