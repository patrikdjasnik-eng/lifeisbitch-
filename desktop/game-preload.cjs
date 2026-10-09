const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('playerRegistry', {
  register: profile => ipcRenderer.invoke('players:register', profile)
});

contextBridge.exposeInMainWorld('gameAccounts', { request: (action, payload) => ipcRenderer.invoke('accounts:request', action, payload) });
