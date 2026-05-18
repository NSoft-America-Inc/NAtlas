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
│  ✅  │ 01-Logs/archive/memo/dev-a/...    │ 2시간 전     │
│  🟡  │ 01-Logs/archive/nstack/dev-b/...  │ 방금         │
│  🔴  │ 01-Logs/archive/timer/dev-a/...   │ 1일 전       │
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
      "path": "01-Logs/archive/memo/developer-a/memo-i1/order.md",
      "status": "indexed",        // "indexed" | "modified" | "new"
      "modified_at": "2026-05-08T10:00:00"
    }
  ],
  "summary": { "total": 42, "indexed": 40, "modified": 1, "new": 1 }
}

Response 500:
{ "error": "LLMWiki 경로를 찾을 수 없습니다" }
```

**인덱싱 상태 판단 기준** (`state/manifests/*.json` 기반):
- `state/manifests/` 에서 `repoRelativePath`가 해당 파일과 일치하는 manifest 검색
  - manifest 있음 + 해시 일치 → `indexed`
  - manifest 있음 + 해시 불일치 → `modified`
  - manifest 없음 → `new`

manifest JSON 구조 참고:
```json
{
  "sourceId": "feat-3d3cc488",
  "repoRelativePath": "content/01-Logs/archive/memo/developer-a/memo-i2-feat-delete/order.md",
  "sourceHash": "abc123..."
}
```

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
  refetchInterval: 30_000,
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
│ LLMWiki 루트                                            │
│ /Users/.../NSoft-LLMWiki                                │
│                                        [▶ 업데이트 실행] │
├─────────────────────────────────────────────────────────┤
│ 로그                                        [지우기]    │
│                                                         │
│ > Ingesting: 01-Logs/archive/memo/dev-a/order.md        │
│ > feat-3d3cc488                                         │
│ > Compiled 52 source(s), 303 page(s). Changed: 4.       │
│ > ✅ 완료                                               │
│                                                         │
│ [스크롤 영역 - 자동 하단 고정]                            │
├─────────────────────────────────────────────────────────┤
│ 마지막 실행: 2026-05-18 14:32                            │
└─────────────────────────────────────────────────────────┘
```

### API (SSE)

```
POST /swarmvault/update

Response: text/event-stream
data: {"type": "log",   "message": "Ingesting: 01-Logs/archive/..."}\n\n
data: {"type": "log",   "message": "feat-3d3cc488"}\n\n
data: {"type": "log",   "message": "Compiled 52 source(s)..."}\n\n
data: {"type": "done",  "message": "완료"}\n\n
// 또는
data: {"type": "error", "message": "swarmvault: command not found"}\n\n
```

실행 순서: 변경/신규 파일 `swarmvault ingest` (1개씩) → `swarmvault compile`
모든 명령은 `llmwiki_root` 디렉토리에서 실행 (`cwd=llmwiki_root`).

### SSE 소비 패턴 (TanStack Query 미사용, Fetch Stream 직접)

```typescript
// pages/Update.tsx
const startUpdate = async () => {
  setIsUpdating(true)
  clearLogs()

  const res = await fetch('http://localhost:18420/swarmvault/update', { method: 'POST' })
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
// - 새 로그 추가 시 자동 스크롤 하단
// - type === 'error' → text-destructive
// - 최대 500줄

// (내부) LogLine.tsx
// 'log'   → text-muted-foreground
// 'done'  → text-green-400
// 'error' → text-destructive
```

---

## Tab 3 — Settings

### UI

```
┌─────────────────────────────────────────────────────────┐
│ LLMWiki 루트 경로                                       │
│ [/Users/.../NSoft-LLMWiki              ] [찾기]         │
│ ✅ 유효한 경로 (swarmvault.config.json 확인됨)           │
│                                              [저장]     │
├─────────────────────────────────────────────────────────┤
│ 설치 상태 진단                              [다시 진단]  │
│                                                         │
│ Python       ✅ python3.12 (3.12.3)                     │
│ SwarmVault   ✅ @swarmvaultai/cli 1.x.x                 │
│ LLMWiki      ✅ content/ 접근 가능 (42개 파일)           │
└─────────────────────────────────────────────────────────┘
```

### API

```
GET /settings
Response: { "llmwiki_root": "/Users/.../NSoft-LLMWiki" }

PUT /settings
Body:     { "llmwiki_root": "..." }
Response: { "ok": true }
// 유효성 검사: swarmvault.config.json 존재 여부 확인
// 없으면: { "error": "swarmvault.config.json을 찾을 수 없습니다" } 400

GET /swarmvault/status
Response:
{
  "python":     { "ok": true,  "version": "3.12.3", "bin": "python3.12" },
  "swarmvault": { "ok": true,  "version": "1.x.x" },
  "llmwiki":    { "ok": true,  "file_count": 42 }
}
// 실패 예:
  "python":     { "ok": false, "version": null, "bin": null }
  "swarmvault": { "ok": false, "version": null }
  "llmwiki":    { "ok": false, "file_count": 0, "error": "경로 없음" }
```

**경로 유효성 검사**: `{llmwiki_root}/swarmvault.config.json` 존재 여부로 판단.

### 컴포넌트 인터페이스

```typescript
// components/PathSetting.tsx
interface PathSettingProps {
  value: string
  onChange: (path: string) => void
  onSave: () => void
  isSaving: boolean
  validationMessage?: string
}
// [찾기] 버튼 → window.electron.openFolderDialog() → onChange 호출

// components/DiagnosticPanel.tsx
interface DiagnosticPanelProps {
  status: SwarmVaultStatus | undefined
  isLoading: boolean
  onRefresh: () => void
}

// (내부) DiagnosticItem.tsx
interface DiagnosticItemProps {
  label: string
  ok: boolean
  detail: string
  hint?: string
}
```

### 에러 힌트 텍스트

| 항목 | ok=false 힌트 |
|---|---|
| Python | `🔴 Python 3.10+ 미설치 — brew install python@3.12` |
| SwarmVault | `🔴 SwarmVault 미설치 — npm install -g @swarmvaultai/cli` |
| LLMWiki 경로 | `🔴 swarmvault.config.json 없음 — LLMWiki 루트 경로를 재설정하세요` |

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

### api.ts 전체

```typescript
const BASE = 'http://localhost:18420'

export const api = {
  getDocuments: (): Promise<DocumentsResponse> =>
    fetch(`${BASE}/documents`).then(r => r.json()),

  getSwarmVaultStatus: (): Promise<SwarmVaultStatus> =>
    fetch(`${BASE}/swarmvault/status`).then(r => r.json()),

  getSettings: (): Promise<Settings> =>
    fetch(`${BASE}/settings`).then(r => r.json()),

  saveSettings: (body: Settings): Promise<{ ok: boolean }> =>
    fetch(`${BASE}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }).then(r => r.json()),
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

---

## 완료 기준 (Phase 1)

- [ ] `npm run dev` 실행 시 Electron 앱 정상 기동
- [ ] Documents 탭 — `state/manifests/` 기반 파일 목록 + 상태 배지, 30초 자동 갱신
- [ ] Update 탭 — `swarmvault ingest` + `swarmvault compile` SSE 로그 실시간 표시
- [ ] Settings 탭 — `swarmvault.config.json` 기반 경로 유효성 검사 + 설치 상태 진단
- [ ] 다크모드 기본 적용
- [ ] `npx tsc --noEmit` 에러 0개
- [ ] `npm run build:mac` 성공
