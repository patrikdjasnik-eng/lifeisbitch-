const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('launcher', {
  check: () => ipcRenderer.invoke('launcher:check'),
  play: () => ipcRenderer.invoke('launcher:play'),
  onStatus: callback => ipcRenderer.on('launcher:status', (_, status) => callback(status))
});
