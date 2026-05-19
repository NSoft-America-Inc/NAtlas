// Documents
export interface DocumentFile {
  path: string                              // content/ 기준 상대경로
  status: 'indexed' | 'modified' | 'new'
  modified_at: string | null               // ISO 8601 (remote는 null)
  category: string                          // Logs | System | Resources | ...
  project: string | null                    // 01-Logs 전용
  user: string | null                       // 01-Logs 전용
  slug: string | null                       // 01-Logs/archive 전용 (이슈 slug)
  doc_type: string | null                   // order | report | knowledge
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
  source_mode: 'remote' | 'local'
  github_token: string            // Remote 모드 전용
  llmwiki_root: string            // Local 모드 전용
}

// SSE Log
export interface LogLine {
  type: 'log' | 'done' | 'error'
  message: string
}
