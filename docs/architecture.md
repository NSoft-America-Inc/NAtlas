# NAtlas 아키텍처

## 전체 구조

```
┌─────────────────────────────────────────────────────┐
│                  Electron 앱                         │
│                                                     │
│  ┌──────────────────┐      ┌─────────────────────┐  │
│  │  React (renderer) │ HTTP │  Python FastAPI      │  │
│  │  TypeScript       │←───→│  sidecar (18420)     │  │
│  │                   │     │                      │  │
│  │  - Documents      │ IPC  │  - graphify 제어     │  │
│  │  - Update         │←───→│  - 파일시스템 접근   │  │
│  │  - Settings       │ (시스템) │  - SQLite           │  │
│  └──────────────────┘     └─────────────────────┘  │
│           ↕ Electron Main Process                   │
│    (앱 생명주기 / sidecar 관리 / IPC 등록)           │
└─────────────────────────────────────────────────────┘
              ↕
     {PROJECT}/llmwiki/content/   (로컬 파일)
     {PROJECT}/graphify-out/      (graph.json)
```

---

## 레이어별 역할

### Electron Main Process (`src/main/`)

- **`index.ts`**: BrowserWindow 생성, 앱 생명주기 관리
- **`sidecar.ts`**: Python FastAPI 프로세스 spawn/종료/재시작
- **`ipc.ts`**: IPC 핸들러 등록 (파일 다이얼로그, 경로 유효성 확인 등)

### React Renderer (`src/renderer/`)

- FastAPI에 직접 HTTP 요청 (TanStack Query 래핑)
- 시스템 기능만 IPC 경유 (폴더 선택 다이얼로그 등)
- Zustand로 탭 상태 등 UI 상태 관리

### Python FastAPI Sidecar (`src/python/`)

- graphify CLI 실행 및 stdout 스트리밍
- `manifest.json` 파싱으로 인덱싱 상태 계산
- 설정 파일(`~/.natlas/config.json`) 읽기/쓰기
- SQLite 작업이력 관리 (Phase 2)

---

## 통신 방식

### 1. React → FastAPI (HTTP, 주 통신)

```
React → fetch("http://localhost:18420/...") → FastAPI
```

TanStack Query 사용:
```typescript
// src/renderer/lib/api.ts
export const api = {
  getDocuments: () => fetch('http://localhost:18420/documents').then(r => r.json()),
  getStatus:    () => fetch('http://localhost:18420/graphify/status').then(r => r.json()),
}

// 컴포넌트에서
const { data, isLoading } = useQuery({ queryKey: ['documents'], queryFn: api.getDocuments })
```

### 2. React → Electron IPC (시스템 기능만)

```typescript
// renderer (contextBridge 경유)
const result = await window.electron.openFolderDialog()

// main/ipc.ts
ipcMain.handle('open-folder-dialog', async () => {
  const { filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  return filePaths[0] ?? null
})
```

IPC를 사용하는 경우:
- 폴더/파일 선택 다이얼로그
- 네이티브 알림

IPC를 사용하지 않는 경우 (FastAPI로 대체):
- 파일 목록 조회 → `GET /documents`
- 설정 읽기/쓰기 → `GET/PUT /settings`

### 3. SSE 스트리밍 (graphify update 로그)

```typescript
// renderer
const es = new EventSource('http://localhost:18420/graphify/update', { method: 'POST' })
es.onmessage = (e) => {
  const { type, message } = JSON.parse(e.data)
  appendLog(message)
  if (type === 'done' || type === 'error') es.close()
}
```

```python
# FastAPI
@router.post("/graphify/update")
async def update():
    async def stream():
        proc = await asyncio.create_subprocess_exec(
            'graphify', '--update', settings.llmwiki_path,
            stdout=asyncio.subprocess.PIPE
        )
        async for line in proc.stdout:
            yield f'data: {json.dumps({"type": "log", "message": line.decode()})}\n\n'
        yield f'data: {json.dumps({"type": "done"})}\n\n'
    return StreamingResponse(stream(), media_type='text/event-stream')
```

---

## Python Sidecar 생명주기

```
앱 시작
  → sidecar.ts: python3 src/python/main.py --port 18420 spawn
  → 포트 18420 점유 확인 (기존 프로세스 kill 후 재시작)
  → React: FastAPI 준비될 때까지 폴링 (GET /health, 최대 10초)

앱 실행 중
  → Python 크래시 감지 → 자동 재시작 (최대 3회)
  → 3회 초과 시 사용자에게 알림

앱 종료
  → app.on('before-quit') → Python 프로세스 SIGTERM
  → 2초 후 미종료 시 SIGKILL
```

---

## 상태 관리

### TanStack Query (서버 상태)
- Documents 파일 목록 (30초 자동 갱신)
- graphify/settings 상태

### Zustand (UI 상태, `src/renderer/store/ui.ts`)
```typescript
interface UIStore {
  currentTab: 'documents' | 'update' | 'settings'
  setTab: (tab: string) => void
  updateLogs: string[]
  appendLog: (line: string) => void
  clearLogs: () => void
  isUpdating: boolean
  setUpdating: (v: boolean) => void
}
```

---

## 에러 핸들링

| 상황 | 처리 |
|---|---|
| FastAPI 연결 실패 | 전체 앱에 "백엔드 연결 실패" 배너 표시 |
| graphify 미설치 | Settings 탭에서 진단 + 설치 안내 |
| LLMWiki 경로 없음 | Settings 탭에서 경로 재설정 유도 |
| graphify update 실패 | Update 탭 로그에 에러 표시 (빨간색) |
| Python 크래시 | 자동 재시작 시도 + 실패 시 알림 |

---

## 패키징 전략

```
electron-builder
├── Mac: NAtlas.dmg
│   └── Python 런타임 번들 (pyinstaller로 단일 바이너리)
└── Windows: NAtlas-Setup.exe
    └── Python 런타임 번들
```

사용자가 Python을 별도 설치할 필요 없음 (Phase 3에서 구현, Phase 1은 개발자 환경 전제).
