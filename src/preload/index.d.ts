import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI & {
      openFolderDialog: () => Promise<string | null>
      openExternal: (url: string) => Promise<void>
    }
    api: unknown
  }
}
