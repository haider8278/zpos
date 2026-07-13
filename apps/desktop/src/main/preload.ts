import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  // API methods will be added in future phases
  version: process.versions.electron,
});
