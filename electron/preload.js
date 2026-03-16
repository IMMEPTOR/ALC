const { contextBridge } = require('electron');

// Безопасно экспонируем минимальный API в renderer
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
});
