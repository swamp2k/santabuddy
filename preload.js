const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  setClickable: (on) => ipcRenderer.send('set-clickable', !!on),
  setName: (name) => ipcRenderer.send('set-name', name),
  quit: () => ipcRenderer.send('quit'),
  listTricks: () => ipcRenderer.invoke('list-tricks'),
  readJSON: (name) => ipcRenderer.invoke('read-json', name),
  onCommand: (fn) => ipcRenderer.on('command', (_e, cmd) => fn(cmd)),
  onRemote: (fn) => ipcRenderer.on('remote', (_e, data) => fn(data)),
  remoteStatus: (status) => ipcRenderer.send('remote-status', status),
  remoteSaid: (id) => ipcRenderer.send('remote-said', id),
});
