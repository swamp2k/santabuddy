const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  setClickable: (on) => ipcRenderer.send('set-clickable', !!on),
  setName: (name) => ipcRenderer.send('set-name', name),
  quit: () => ipcRenderer.send('quit'),
  listTricks: () => ipcRenderer.invoke('list-tricks'),
  readJSON: (name) => ipcRenderer.invoke('read-json', name),
  onCommand: (fn) => ipcRenderer.on('command', (_e, cmd) => fn(cmd)),
});
