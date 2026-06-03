import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI & {
      openFolderDialog: () => Promise<string | null>
      openExternal: (url: string) => Promise<void>
      runCoreInstaller: (params: {
        scenario: string
        parentPath?: string
        projectName?: string
      }) => Promise<{ success: boolean; error?: string }>
      onInstallerLog: (callback: (log: string) => void) => void
      offInstallerLog: () => void
    }
    api: unknown
  }
}
