const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('smetaAPI', {
  saveProject: async (project) => {
    return await ipcRenderer.invoke('save-project-to-disk', project);
  },
  loadProject: async () => {
    return await ipcRenderer.invoke('load-project-from-disk');
  },
  captureRegion: async (rect, filename) => {
    return await ipcRenderer.invoke('capture-page-region', { rect, filename });
  },
  printToPDF: async (defaultPath) => {
    return await ipcRenderer.invoke('print-to-pdf', { defaultPath });
  }
});
