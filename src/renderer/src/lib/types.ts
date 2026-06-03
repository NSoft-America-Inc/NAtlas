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
  title?: string | null                     // 마크다운 파싱 제목
  issue_url?: string | null                 // GitHub 이슈 링크 URL
}


export interface DocumentSlugGroup {
  id: string                                // "group:{project}:{user}:{slug}"
  type: 'group'
  category: string
  project: string
  user: string
  slug: string
  files: DocumentFile[]                     // 그룹 산하 3종 파일 (order, report, knowledge 등)
  modified_at: string | null                // 하위 파일 중 가장 최신의 modified_at
  status: 'indexed' | 'modified' | 'new'    // 우선순위 종합 상태
}

export interface DocumentSingleFile {
  id: string                                // "single:{path}"
  type: 'single'
  file: DocumentFile
}

export type DocumentsListItem = DocumentSlugGroup | DocumentSingleFile


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
  enable_auto_sync: boolean
  last_sync_time: string | null
}

// Settings
export interface Settings {
  source_mode: 'remote' | 'local'
  github_token: string            // Remote 모드 전용
  llmwiki_root: string            // Local 모드 전용
  enable_auto_sync?: boolean
}

// SSE Log
export interface LogLine {
  type: 'log' | 'done' | 'error'
  message: string
}

// SwarmVault Query Result
export interface SwarmVaultQueryResponse {
  answer: string
  savedPath?: string
  savedPageId?: string
  citations?: string[]
  relatedPageIds?: string[]
  relatedSourceIds?: string[]
}

export interface TaskHistoryItem {
  id: number
  query_text: string
  project: string | null
  user_name: string | null
  task_slug: string
  created_at: string
}

export interface BuildLogItem {
  id: number
  action: 'ingest' | 'compile'
  status: 'done' | 'error'
  log_message: string | null
  created_at: string
}

export interface DailyTrendItem {
  date: string
  full_date: string
  queries: number
  builds: number
}

export interface TopCountItem {
  project?: string
  user_name?: string
  count: number
}

export interface DashboardStats {
  total_queries: number
  total_builds: number
  build_success_rate: number
  top_projects: TopCountItem[]
  top_contributors: TopCountItem[]
  daily_trends: DailyTrendItem[]
}


