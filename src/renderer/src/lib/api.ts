import { DocumentsResponse, SwarmVaultStatus, Settings, SwarmVaultQueryResponse, TaskHistoryItem, BuildLogItem, DashboardStats } from './types'


const BASE = 'http://127.0.0.1:18420'

export const api = {
  getDocuments: (): Promise<DocumentsResponse> =>
    fetch(`${BASE}/documents`).then(async r => {
      if (!r.ok) {
        const errorData = await r.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch documents')
      }
      return r.json()
    }),

  getSwarmVaultStatus: (): Promise<SwarmVaultStatus> =>
    fetch(`${BASE}/swarmvault/status`).then(async r => {
      if (!r.ok) {
        const errorData = await r.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch SwarmVault status')
      }
      return r.json()
    }),

  getSettings: (): Promise<Settings> =>
    fetch(`${BASE}/settings`).then(async r => {
      if (!r.ok) {
        const errorData = await r.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch settings')
      }
      return r.json()
    }),

  saveSettings: (body: Settings): Promise<{ ok: boolean }> =>
    fetch(`${BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(async r => {
      if (!r.ok) {
        const errorData = await r.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to save settings')
      }
      return r.json()
    }),

  getDocumentContent: (path: string): Promise<{ path: string; content: string }> =>
    fetch(`${BASE}/documents/content?path=${encodeURIComponent(path)}`).then(async r => {
      if (!r.ok) {
        const errorData = await r.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to fetch document')
      }
      return r.json()
    }),

  querySwarmVault: (question: string): Promise<SwarmVaultQueryResponse> =>
    fetch(`${BASE}/swarmvault/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    }).then(async r => {
      if (!r.ok) {
        const errorData = await r.json().catch(() => ({}))
        throw new Error(errorData.error || 'SwarmVault 질의 실행 중 오류가 발생했습니다.')
      }
      return r.json()
    }),

  getTaskHistory: (): Promise<TaskHistoryItem[]> =>
    fetch(`${BASE}/swarmvault/history`).then(async r => {
      if (!r.ok) {
        const errorData = await r.json().catch(() => ({}))
        throw new Error(errorData.error || '작업 조회 이력을 불러오는 중 오류가 발생했습니다.')
      }
      return r.json()
    }),

  clearTaskHistory: (): Promise<{ ok: boolean; message: string }> =>
    fetch(`${BASE}/swarmvault/history`, {
      method: 'DELETE'
    }).then(async r => {
      if (!r.ok) {
        const errorData = await r.json().catch(() => ({}))
        throw new Error(errorData.error || '작업 조회 이력을 삭제하는 중 오류가 발생했습니다.')
      }
      return r.json()
    }),

  getBuildLogs: (): Promise<BuildLogItem[]> =>
    fetch(`${BASE}/swarmvault/build-logs`).then(async r => {
      if (!r.ok) {
        const errorData = await r.json().catch(() => ({}))
        throw new Error(errorData.error || '동기화 이력을 불러오는 중 오류가 발생했습니다.')
      }
      return r.json()
    }),

  clearBuildLogs: (): Promise<{ ok: boolean; message: string }> =>
    fetch(`${BASE}/swarmvault/build-logs`, {
      method: 'DELETE'
    }).then(async r => {
      if (!r.ok) {
        const errorData = await r.json().catch(() => ({}))
        throw new Error(errorData.error || '동기화 이력을 삭제하는 중 오류가 발생했습니다.')
      }
      return r.json()
    }),

  getDashboardStats: (period: string = '2weeks'): Promise<DashboardStats> =>
    fetch(`${BASE}/swarmvault/dashboard/stats?period=${period}`).then(async r => {
      if (!r.ok) {
        const errorData = await r.json().catch(() => ({}))
        throw new Error(errorData.error || '대시보드 통계를 불러오는 중 오류가 발생했습니다.')
      }
      return r.json()
    }),

  checkUpdate: (): Promise<{
    has_update: boolean
    current_version: string
    latest_version: string
    release_url: string
    release_notes: string
  }> =>
    fetch(`${BASE}/settings/check-update`).then(async r => {
      if (!r.ok) {
        throw new Error('업데이트 정보를 확인하는 중 오류가 발생했습니다.')
      }
      return r.json()
    }),

  checkFolder: (path: string): Promise<{ exists: boolean; path: string }> =>
    fetch(`${BASE}/swarmvault/check-folder?path=${encodeURIComponent(path)}`).then(async r => {
      if (!r.ok) {
        const errorData = await r.json().catch(() => ({}))
        throw new Error(errorData.error || '폴더 존재 여부를 확인하는 중 오류가 발생했습니다.')
      }
      return r.json()
    }),
}


