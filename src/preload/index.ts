import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Expose the custom api in addition to standard electron API
const api = {}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', {
      ...electronAPI,
      openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
      openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
      runCoreInstaller: (params: { scenario: string; parentPath?: string; projectName?: string }) =>
        ipcRenderer.invoke('run-core-installer', params),
      onInstallerLog: (callback: (log: string) => void) => {
        ipcRenderer.on('installer-log', (_, log) => callback(log))
      },
      offInstallerLog: () => {
        ipcRenderer.removeAllListeners('installer-log')
      }
    })
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = {
    ...electronAPI,
    openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
    openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
    runCoreInstaller: (params: { scenario: string; parentPath?: string; projectName?: string }) =>
      ipcRenderer.invoke('run-core-installer', params),
    onInstallerLog: (callback: (log: string) => void) => {
      ipcRenderer.on('installer-log', (_, log) => callback(log))
    },
    offInstallerLog: () => {
      ipcRenderer.removeAllListeners('installer-log')
    }
  }
  // @ts-ignore (define in dts)
  window.api = api
}
