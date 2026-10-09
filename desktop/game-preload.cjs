const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('playerRegistry', {
  register: profile => ipcRenderer.invoke('players:register', profile)
});
