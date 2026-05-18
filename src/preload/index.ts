import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Expose the custom api in addition to standard electron API
const api = {}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', {
      ...electronAPI,
      openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog')
    })
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = {
    ...electronAPI,
    openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog')
  }
  // @ts-ignore (define in dts)
  window.api = api
}
