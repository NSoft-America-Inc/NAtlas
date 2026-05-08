# Phase 1 — MVP 상세 스펙

## 범위

| 탭 | Phase |
|---|---|
| Documents | ✅ Phase 1 |
| Update | ✅ Phase 1 |
| Settings | ✅ Phase 1 |
| Wiki / Query / History / Dashboard | ⬜ Phase 2+ |

---

## 공통 타입 정의 (`src/renderer/src/lib/types.ts`)

```typescript
// Documents
export interface DocumentFile {
  path: string
  status: 'indexed' | 'modified' | 'new'
  modified_at: string  // ISO 8601
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

// Graphify Status
export interface GraphifyStatus {
  python:   { ok: boolean; version: string; bin: string }
  graphify: { ok: boolean; version: string }
  llmwiki:  { ok: boolean; file_count: number; error?: string }
}

// Settings
export interface Settings {
  llmwiki_path: string
}

// SSE Log
export interface LogLine {
  type: 'log' | 'done' | 'error'
  message: string
}
```

---

## FastAPI 공통 규칙

- Base URL: `http://localhost:18420`
- 성공 응답: HTTP 200 + JSON body
- 에러 응답: `{ "error": "메시지" }` + 4xx/5xx
- SSE: `Content-Type: text/event-stream`, 각 라인 `data: {JSON}\n\n`
- 설정 저장 경로: `~/.natlas/config.json`

---

## Tab 1 — Documents

### UI

```
┌─────────────────────────────────────────────────────────┐
│ 🔍 [검색어 입력...        ] [All ▼]        새로고침 🔄    │
├───────┬──────────────────────────────────┬──────────────┤
│ 상태  │ 경로                             │ 수정일       │
├───────┼──────────────────────────────────┼──────────────┤
│  ✅  │ 01-Logs/tasks/2026-05-01-...md    │ 2시간 전     │
│  🟡  │ 01-Logs/tasks/2026-05-08-...md    │ 방금         │
│  🔴  │ 02-Resources/decisions/...md      │ 1일 전       │
├───────┴──────────────────────────────────┴──────────────┤
│ 총 42개 │ ✅ 40  🟡 1  🔴 1                              │
└─────────────────────────────────────────────────────────┘
```

### API

```
GET /documents

Response 200:
{
  "files": [
    {
      "path": "01-Logs/tasks/2026-05-01-example.md",
      "status": "indexed",        // "indexed" | "modified" | "new"
      "modified_at": "2026-05-08T10:00:00"
    }
  ],
  "summary": { "total": 42, "indexed": 40, "modified": 1, "new": 1 }
}

Response 500:
{ "error": "LLMWiki 경로를 찾을 수 없습니다" }
```

인덱싱 상태 판단 기준:
- `graphify-out/manifest.json` 내 해당 파일 존재 + 해시 일치 → `indexed`
- 존재하지만 해시 불일치 → `modified`
- 없음 → `new`

### 컴포넌트 인터페이스

```typescript
// pages/Documents.tsx
// - GET /documents 30초마다 자동 갱신 (TanStack Query refetchInterval)
// - 검색어: 파일 경로 포함 여부로 클라이언트 필터링
// - 상태 필터: 'all' | 'indexed' | 'modified' | 'new'

// components/StatusBadge.tsx
interface StatusBadgeProps {
  status: 'indexed' | 'modified' | 'new'
}
// indexed → <Badge variant="success">✅ 인덱싱됨</Badge>
// modified → <Badge variant="warning">🟡 수정됨</Badge>
// new      → <Badge variant="destructive">🔴 미인덱싱</Badge>

// components/DocumentTable.tsx
interface DocumentTableProps {
  files: DocumentFile[]
  isLoading: boolean
}
// isLoading 시 Skeleton rows 5개 표시

// (내부) DocumentRow.tsx
interface DocumentRowProps {
  file: DocumentFile
}
```

### TanStack Query 설정

```typescript
// pages/Documents.tsx
const { data, isLoading, isError } = useQuery<DocumentsResponse>({
  queryKey: ['documents'],
  queryFn: api.getDocuments,
  refetchInterval: 30_000,  // 30초 자동 갱신
})
```

### 에러 상태 UI

- `isError` → "LLMWiki 경로를 확인해주세요. Settings에서 경로를 설정하세요." + Settings 탭 이동 버튼
- `files.length === 0` → "content/ 폴더에 파일이 없습니다."

---

## Tab 2 — Update

### UI

```
┌─────────────────────────────────────────────────────────┐
│ LLMWiki 경로                                            │
│ /Users/.../NAtlas/llmwiki/content                       │
│                                              [▶ 업데이트 실행] │
├─────────────────────────────────────────────────────────┤
│ 로그                                        [지우기]    │
│                                                         │
│ > graphify --update content/                            │
│ > Scanning 42 files...                                  │
│ > ✓ Graph updated in 3.2s                               │
│                                                         │
│ [스크롤 영역 - 자동 하단 고정]                            │
├─────────────────────────────────────────────────────────┤
│ 마지막 실행: 2026-05-08 14:32                            │
└─────────────────────────────────────────────────────────┘
```

### API (SSE)

```
POST /graphify/update

Response: text/event-stream
data: {"type": "log",   "message": "Scanning 42 files..."}\n\n
data: {"type": "log",   "message": "Processing: example.md"}\n\n
data: {"type": "done",  "message": "Done in 3.2s"}\n\n
// 또는
data: {"type": "error", "message": "graphify: command not found"}\n\n
```

### SSE 소비 패턴 (TanStack Query 미사용, Fetch Stream 직접)

```typescript
// pages/Update.tsx
const startUpdate = async () => {
  setIsUpdating(true)
  clearLogs()

  const res = await fetch('http://localhost:18420/graphify/update', { method: 'POST' })
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const text = decoder.decode(value)
    for (const line of text.split('\n')) {
      if (!line.startsWith('data: ')) continue
      const log: LogLine = JSON.parse(line.slice(6))
      appendLog(log)
      if (log.type === 'done' || log.type === 'error') {
        setIsUpdating(false)
        return
      }
    }
  }
  setIsUpdating(false)
}
```

### 컴포넌트 인터페이스

```typescript
// components/LogViewer.tsx
interface LogViewerProps {
  logs: LogLine[]
  onClear: () => void
}
// - ScrollArea (Shadcn) 사용
// - 새 로그 추가 시 자동 스크롤 하단 (useEffect + ref.scrollIntoView)
// - type === 'error' → 빨간색 텍스트 (text-destructive)
// - 최대 500줄 (초과 시 앞에서 제거)

// (내부) LogLine.tsx
interface LogLineProps {
  log: LogLine
}
// log.type에 따라 색상 분기:
// 'log'   → text-muted-foreground
// 'done'  → text-green-400
// 'error' → text-destructive
```

### Zustand store 연동

```typescript
// store/ui.ts에서 관리
isUpdating: boolean
logs: LogLine[]
lastRunAt: string | null
setIsUpdating: (v: boolean) => void
appendLog: (log: LogLine) => void
clearLogs: () => void
setLastRunAt: (t: string) => void
```

---

## Tab 3 — Settings

### UI

```
┌─────────────────────────────────────────────────────────┐
│ LLMWiki 경로                                            │
│ [/Users/.../NAtlas/llmwiki/content         ] [찾기]    │
│ ✅ 유효한 경로 (42개 파일)                               │
│                                              [저장]     │
├─────────────────────────────────────────────────────────┤
│ 설치 상태 진단                              [다시 진단]  │
│                                                         │
│ Python     ✅ python3.12 (3.12.3)                       │
│ graphify   ✅ 0.9.1                                     │
│ LLMWiki    ✅ content/ 접근 가능 (42개 파일)             │
└─────────────────────────────────────────────────────────┘
```

### API

```
GET /settings
Response: { "llmwiki_path": "/Users/.../NAtlas/llmwiki/content" }

PUT /settings
Body:     { "llmwiki_path": "..." }
Response: { "ok": true }
// 경로 유효하지 않으면: { "error": "경로가 존재하지 않습니다" } 400

GET /graphify/status
Response:
{
  "python":   { "ok": true,  "version": "3.12.3", "bin": "python3.12" },
  "graphify": { "ok": true,  "version": "0.9.1" },
  "llmwiki":  { "ok": true,  "file_count": 42 }
}
// 항목 실패 예:
  "python":   { "ok": false, "version": null, "bin": null }
  "graphify": { "ok": false, "version": null }
  "llmwiki":  { "ok": false, "file_count": 0, "error": "경로 없음" }
```

### 컴포넌트 인터페이스

```typescript
// components/PathSetting.tsx
interface PathSettingProps {
  value: string
  onChange: (path: string) => void
  onSave: () => void
  isSaving: boolean
  validationMessage?: string   // "✅ 유효한 경로" 또는 에러 메시지
}
// [찾기] 버튼 → window.electron.openFolderDialog() → onChange 호출

// components/DiagnosticPanel.tsx
interface DiagnosticPanelProps {
  status: GraphifyStatus | undefined
  isLoading: boolean
  onRefresh: () => void
}

// (내부) DiagnosticItem.tsx
interface DiagnosticItemProps {
  label: string                   // "Python", "graphify", "LLMWiki"
  ok: boolean
  detail: string                  // "python3.12 (3.12.3)" 또는 에러 메시지
  hint?: string                   // 설치 안내 (ok=false일 때)
}
```

### 에러 힌트 텍스트

| 항목 | ok=false 힌트 |
|---|---|
| Python | `🔴 Python 3.10+ 미설치 — brew install python@3.12` |
| graphify | `🔴 graphify 미설치 — pip install graphifyy` |
| LLMWiki 경로 | `🔴 경로가 존재하지 않습니다 — 위에서 경로를 재설정하세요` |

---

## 공통 UI 규칙

### 레이아웃 (`components/Layout.tsx`)

```typescript
// 사이드바 너비: 200px 고정
// 탭 항목: [아이콘] [텍스트] 형식 (Lucide 아이콘)
//   📄 Documents  → FileText
//   🔄 Update     → RefreshCw
//   ⚙️ Settings   → Settings
// 활성 탭: bg-accent text-accent-foreground
// 다크모드: 기본 적용 (html class="dark")
```

### Zustand store 전체 (`store/ui.ts`)

```typescript
interface UIStore {
  // 탭
  currentTab: 'documents' | 'update' | 'settings'
  setTab: (tab: UIStore['currentTab']) => void

  // Update 탭
  isUpdating: boolean
  logs: LogLine[]
  lastRunAt: string | null
  setIsUpdating: (v: boolean) => void
  appendLog: (log: LogLine) => void
  clearLogs: () => void
  setLastRunAt: (t: string) => void
}
```

### TanStack Query 전역 설정 (`main.tsx`)

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 10_000,
    }
  }
})
```

### api.ts 전체

```typescript
const BASE = 'http://localhost:18420'

export const api = {
  getDocuments:    (): Promise<DocumentsResponse> =>
    fetch(`${BASE}/documents`).then(r => r.json()),

  getGraphifyStatus: (): Promise<GraphifyStatus> =>
    fetch(`${BASE}/graphify/status`).then(r => r.json()),

  getSettings:     (): Promise<Settings> =>
    fetch(`${BASE}/settings`).then(r => r.json()),

  saveSettings:    (body: Settings): Promise<{ ok: boolean }> =>
    fetch(`${BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(r => r.json()),
}
```

---

## 완료 기준 (Phase 1)

- [ ] `npm run dev` 실행 시 Electron 앱 정상 기동
- [ ] Documents 탭 — 파일 목록 + 상태 배지 표시, 30초 자동 갱신
- [ ] Update 탭 — 버튼 클릭 시 SSE 로그 실시간 표시, 완료/에러 처리
- [ ] Settings 탭 — 경로 저장 + 설치 상태 진단 표시
- [ ] 다크모드 기본 적용
- [ ] `npx tsc --noEmit` 에러 0개
- [ ] `npm run build:mac` 성공
