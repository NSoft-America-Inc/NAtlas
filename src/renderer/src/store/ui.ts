import { create } from 'zustand'
import { LogLine, Settings } from '../lib/types'

interface UIState {
  activeTab: 'documents' | 'update' | 'settings'
  logs: LogLine[]
  isUpdating: boolean
  settings: Settings | null

  setActiveTab: (tab: 'documents' | 'update' | 'settings') => void
  addLog: (log: LogLine) => void
  clearLogs: () => void
  setIsUpdating: (updating: boolean) => void
  setSettings: (settings: Settings | null) => void
}

export const useUIStore = create<UIState>((set) => ({
  activeTab: 'documents',
  logs: [],
  isUpdating: false,
  settings: null,

  setActiveTab: (tab) => set({ activeTab: tab }),
  addLog: (log) => set((state) => {
    // Limit to maximum 500 log lines to ensure high rendering performance
    const newLogs = [...state.logs, log]
    if (newLogs.length > 500) {
      newLogs.shift()
    }
    return { logs: newLogs }
  }),
  clearLogs: () => set({ logs: [] }),
  setIsUpdating: (updating) => set({ isUpdating: updating }),
  setSettings: (settings) => set({ settings }),
}))
