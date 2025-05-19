// preload.js
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  sendGestureAction: (action) => ipcRenderer.send('gesture-action', action),
  showRecordingDialog: () => ipcRenderer.invoke('show-recording-dialog')
});