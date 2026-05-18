# NAtlas 아키텍처

## 전체 구조

```
┌────────────────────────────────────────────────────────────┐
│                      Electron 앱                            │
│                                                            │
│  ┌─────────────────┐  contextBridge  ┌──────────────────┐ │
│  │ React (renderer) │←──────────────→│ Electron Main    │ │
│  │  port 3000(dev)  │      IPC       │  (main/index.ts) │ │
│  │                  │                │                  │ │
│  │  TanStack Query  │   HTTP/SSE     │  sidecar.ts:     │ │
│  │  Zustand         │←─────────────→│  Python spawn    │ │
│  └─────────────────┘  localhost:18420└──────────────────┘ │
│                                             ↕              │
│                                    ┌──────────────────┐   │
│                                    │ Python FastAPI   │   │
│                                    │  (port 18420)    │   │
│                                    │  SwarmVault 제어  │   │
│                                    │  파일시스템      │   │
│                                    └──────────────────┘   │
└────────────────────────────────────────────────────────────┘
              ↕
  {LLMWIKI_ROOT}/content/                  (문서 아카이브)
  {LLMWIKI_ROOT}/state/graph.json          (컴파일된 그래프)
  {LLMWIKI_ROOT}/state/manifests/*.json    (소스별 메타데이터)
  {LLMWIKI_ROOT}/raw/sources/              (SwarmVault 인제스트 원본)
  {LLMWIKI_ROOT}/swarmvault.config.json    (SwarmVault 설정)
```

### LLMWiki 디렉토리 구조

```
{LLMWIKI_ROOT}/                         ← Settings에서 설정하는 경로
├── swarmvault.config.json
├── content/
│   └── 01-Logs/
│       └── archive/
│           └── {project}/
│               └── {git_username}/
│                   └── {slug}/
│                       ├── order.md    (작업지시서)
│                       └── report.md   (완료보고서)
├── raw/
│   └── sources/                        (swarmvault ingest 결과)
└── state/
    ├── graph.json                       (swarmvault compile 결과)
    ├── compile-state.json
    └── manifests/
        └── {source-id}.json            (소스별 메타: repoRelativePath, hash 등)
```

---

## 빌드 도구: electron-vite

3개 Vite 번들러가 독립적으로 동작:

| 번들 대상 | 진입점 | 설명 |
|---|---|---|
| main | `src/main/index.ts` | Node.js 환경, externalizeDeps |
| preload | `src/preload/index.ts` | contextBridge API 정의 |
| renderer | `src/renderer/src/main.tsx` | React 앱, HMR 지원 |

개발 시: `electron-vite dev` → 3개 동시 실행
프로덕션: `electron-vite build` → `dist/` 에 각 번들 생성 → electron-builder 패키징

---

## preload.ts — contextBridge

renderer(React)는 보안상 Node.js API에 직접 접근 불가.
`preload/index.ts`가 `contextBridge.exposeInMainWorld`로 허용된 API만 노출.

```
renderer                  preload                     main
window.electron   →   contextBridge.expose   →   ipcMain.handle
.openFolderDialog()   'open-folder-dialog'      dialog.showOpenDialog()
```

```typescript
// preload/index.ts
contextBridge.exposeInMainWorld('electron', {
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
})

// main/index.ts
ipcMain.handle('open-folder-dialog', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  return canceled ? null : filePaths[0]
})

// renderer (env.d.ts에 타입 선언)
const path = await window.electron.openFolderDialog()
```

**IPC 채널 목록** (preload ↔ main 반드시 일치):

| 채널명 | 방향 | 설명 |
|---|---|---|
| `open-folder-dialog` | renderer → main | 폴더 선택 다이얼로그 |

---

## 통신 방식 상세

### 1. React → FastAPI (HTTP, 주 통신)

TanStack Query로 래핑. 직접 fetch 사용:

```typescript
// lib/api.ts
const BASE = 'http://localhost:18420'
export const api = {
  getDocuments:        () => fetch(`${BASE}/documents`).then(r => r.json()),
  getSwarmVaultStatus: () => fetch(`${BASE}/swarmvault/status`).then(r => r.json()),
  getSettings:         () => fetch(`${BASE}/settings`).then(r => r.json()),
  saveSettings:        (body) => fetch(`${BASE}/settings`, { method: 'PUT', ... }).then(r => r.json()),
}
```

### 2. SSE 스트리밍 (SwarmVault update)

TanStack Query는 SSE를 지원하지 않음 → Fetch Stream API 직접 사용:

```typescript
const res = await fetch('http://localhost:18420/swarmvault/update', { method: 'POST' })
const reader = res.body!.getReader()
const decoder = new TextDecoder()

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  const text = decoder.decode(value)
  for (const line of text.split('\n')) {
    if (!line.startsWith('data: ')) continue
    const log = JSON.parse(line.slice(6))  // { type, message }
    appendLog(log)
    if (log.type === 'done' || log.type === 'error') { setIsUpdating(false); return }
  }
}
```

FastAPI SSE — ingest 변경 파일 → compile 순서로 실행:
```python
async def stream(llmwiki_root: str):
    # 1. 변경/신규 파일 ingest (파일 1개씩)
    new_or_modified = get_new_or_modified_files(llmwiki_root)
    for f in new_or_modified:
        proc = await asyncio.create_subprocess_exec(
            'swarmvault', 'ingest', f,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
            cwd=llmwiki_root
        )
        async for line in proc.stdout:
            yield f'data: {json.dumps({"type": "log", "message": line.decode().rstrip()})}\n\n'

    # 2. compile
    proc = await asyncio.create_subprocess_exec(
        'swarmvault', 'compile',
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
        cwd=llmwiki_root
    )
    async for line in proc.stdout:
        yield f'data: {json.dumps({"type": "log", "message": line.decode().rstrip()})}\n\n'

    yield f'data: {json.dumps({"type": "done", "message": "완료"})}\n\n'

return StreamingResponse(stream(settings.llmwiki_root), media_type='text/event-stream')
```

### 3. IPC (시스템 기능만)

폴더 선택 다이얼로그처럼 Electron API가 필요한 경우만 IPC 사용.
나머지는 모두 FastAPI 직접 호출.

---

## Python Sidecar 생명주기

```
앱 시작
  └── sidecar.ts: spawn("python3", ["src/python/main.py", "--port", "18420"])
       └── GET /health 폴링 (500ms 간격, 최대 10초)
            ├── 성공 → React 렌더링 시작
            └── 10초 초과 → 사용자 알림 + 앱 종료

실행 중
  └── Python 프로세스 크래시 감지
       └── 재시작 (최대 3회)
            └── 3회 초과 → dialog.showErrorBox("백엔드 시작 실패")

앱 종료
  └── app.on('before-quit')
       └── Python 프로세스 SIGTERM
            └── 2초 대기 후 미종료 시 SIGKILL
```

---

## 상태 관리

### TanStack Query (서버 상태)

| queryKey | 갱신 주기 | 용도 |
|---|---|---|
| `['documents']` | 30초 자동 | Documents 탭 파일 목록 |
| `['swarmvault-status']` | 버튼 클릭 시 수동 | Settings 진단 |
| `['settings']` | stale 10초 | 설정값 |

### Zustand (UI 상태, `store/ui.ts`)

```typescript
interface UIStore {
  currentTab: 'documents' | 'update' | 'settings'
  setTab: (tab: UIStore['currentTab']) => void

  // Update 탭 전용
  isUpdating: boolean
  logs: LogLine[]
  lastRunAt: string | null
  setIsUpdating: (v: boolean) => void
  appendLog: (log: LogLine) => void
  clearLogs: () => void
  setLastRunAt: (t: string) => void
}
```

---

## 인덱싱 상태 판단 로직

Documents 탭의 `indexed` / `modified` / `new` 상태는 `state/manifests/` 기반으로 판단:

```python
import json, hashlib
from pathlib import Path

def get_file_status(llmwiki_root: str, rel_path: str) -> str:
    """
    rel_path: content/ 기준 상대경로
    예: "01-Logs/archive/memo/dev-a/memo-i1/order.md"
    """
    manifests_dir = Path(llmwiki_root) / "state" / "manifests"
    file_path = Path(llmwiki_root) / "content" / rel_path

    # 현재 파일 해시
    current_hash = hashlib.sha256(file_path.read_bytes()).hexdigest()

    # manifests에서 해당 파일 찾기 (repoRelativePath 기준)
    for manifest_file in manifests_dir.glob("*.json"):
        manifest = json.loads(manifest_file.read_text())
        if manifest.get("repoRelativePath", "").endswith(rel_path):
            stored_hash = manifest.get("sourceHash") or manifest.get("hash", "")
            return "indexed" if current_hash == stored_hash else "modified"

    return "new"
```

---

## 에러 핸들링 전략

| 상황 | 처리 방식 |
|---|---|
| FastAPI 연결 불가 (앱 시작 시) | 헬스체크 실패 → 앱 종료 + 에러 다이얼로그 |
| FastAPI 연결 불가 (실행 중) | TanStack Query isError → 배너 표시 |
| SwarmVault 미설치 | `/swarmvault/status` → ok: false → Settings에서 힌트 표시 |
| LLMWiki 경로 없음 | `/documents` → 500 → Documents 탭 에러 + Settings 이동 버튼 |
| swarmvault update 실패 | SSE `type: error` → 로그 빨간색 + 버튼 재활성화 |
| Python 크래시 | 자동 재시작 3회 → 실패 시 에러 다이얼로그 |

---

## 패키징 (Phase 3)

```
electron-builder
├── Mac: NAtlas.dmg   (Python pyinstaller 번들 내장)
└── Win: NAtlas-Setup.exe  (동일)
```

Phase 1-2는 개발자 환경(Python + Node.js 설치됨) 전제. Phase 3에서 번들 내장.
