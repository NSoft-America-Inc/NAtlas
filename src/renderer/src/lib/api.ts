import { DocumentsResponse, SwarmVaultStatus, Settings } from './types'

const BASE = 'http://localhost:18420'

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

  cloneLLMWiki: (): Promise<Response> =>
    fetch(`${BASE}/swarmvault/clone`, { method: 'POST' }),
}
