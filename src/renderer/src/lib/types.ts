// Documents
export interface DocumentFile {
  path: string                              // content/ 기준 상대경로
  status: 'indexed' | 'modified' | 'new'
  modified_at: string                       // ISO 8601
}

export interface DocumentsSummary {
  total: number
  indexed: number
  modified: number
  new: number
}

export interface DocumentsResponse {
  files: DocumentFile[]
  summary: DocumentsSummary
}

// SwarmVault 상태
export interface SwarmVaultStatus {
  python:      { ok: boolean; version: string | null; bin: string | null }
  swarmvault:  { ok: boolean; version: string | null }
  llmwiki:     { ok: boolean; file_count: number; error?: string }
}

// Settings
export interface Settings {
  llmwiki_root: string    // LLMWiki 루트 경로 (swarmvault.config.json 있는 곳)
}

// SSE Log
export interface LogLine {
  type: 'log' | 'done' | 'error'
  message: string
}
