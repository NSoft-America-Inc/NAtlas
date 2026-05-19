---
project: natlas
type: single
issue: https://github.com/NSoft-America-Inc/NAtlas/issues/4
created: 2026-05-19
completed: "-"
llmwiki: "-"
---

**Issue:** [NAtlas#4](https://github.com/NSoft-America-Inc/NAtlas/issues/4)
**Order:** [natlas-i4-feat-settings-git-source.md](tasks/orders/2026-05/19/natlas-i4-feat-settings-git-source.md)
**Report:** [natlas-i4-feat-settings-git-source.md](tasks/reports/2026-05/19/natlas-i4-feat-settings-git-source.md)

# 현재 작업: Settings 탭 LLMWiki 소스 모드 (Git repo 기본 / Local 고급)

**담당:** Antigravity
**리뷰:** Claude

---

## Git 작업 (작업 시작 전 필수)

```bash
git checkout main && git pull
git checkout -b feat/4-settings-git-source
```

작업 완료 후:

```bash
git add src/renderer/src/pages/Settings.tsx \
        src/renderer/src/lib/types.ts \
        src/renderer/src/lib/api.ts \
        src/python/routers/settings.py \
        src/python/routers/swarmvault.py
git commit -m "feat: Settings Git repo 기본 소스 모드 추가 #4"
git checkout main && git merge feat/4-settings-git-source
git branch -d feat/4-settings-git-source
```

---

## 수정 파일

| 파일 | 변경 내용 |
|---|---|
| `src/renderer/src/lib/types.ts` | `Settings` 인터페이스에 `source_mode`, `git_repo_url` 추가 |
| `src/renderer/src/lib/api.ts` | `cloneLLMWiki()` API 함수 추가 |
| `src/renderer/src/pages/Settings.tsx` | Git/Local 모드 토글 UI + clone SSE 진행 표시 추가 |
| `src/python/routers/settings.py` | `SettingsSchema` + `load/save` 함수 확장 |
| `src/python/routers/swarmvault.py` | `POST /swarmvault/clone` SSE 엔드포인트 추가 |

---

## 배경

현재 Settings 탭은 로컬 경로만 입력받는다. 실제 사용 흐름에서는 **Git repo URL이 기본**이며,
NAtlas가 `~/.natlas/llmwiki/`에 clone/pull을 자동 관리해야 한다.
로컬 경로 직접 지정은 이미 clone된 환경을 위한 고급 옵션으로 유지한다.

아래 수정 외 모든 기존 코드는 그대로 유지할 것.

---

## Fix 1. `src/renderer/src/lib/types.ts` — Settings 타입 확장

```typescript
// 변경 전
export interface Settings {
  llmwiki_root: string
}

// 변경 후
export interface Settings {
  source_mode: 'git' | 'local'   // 기본값: 'git'
  git_repo_url: string            // Git 모드 전용
  llmwiki_root: string            // Local 모드 전용 (Git 모드엔 자동 설정됨)
}
```

---

## Fix 2. `src/renderer/src/lib/api.ts` — cloneLLMWiki 함수 추가

기존 함수는 **절대 수정하지 말 것**. 아래 함수만 추가한다.

```typescript
// api 객체 마지막에 추가
cloneLLMWiki: (): Promise<Response> =>
  fetch(`${BASE}/swarmvault/clone`, { method: 'POST' }),
```

---

## Fix 3. `src/python/routers/settings.py` — 스키마 + 로직 확장

```python
# 변경 전
class SettingsSchema(BaseModel):
    llmwiki_root: str

def load_settings():
    if not CONFIG_FILE.exists():
        return {"llmwiki_root": ""}
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return {"llmwiki_root": data.get("llmwiki_root", "")}
    except Exception:
        return {"llmwiki_root": ""}

async def put_settings(settings: SettingsSchema):
    root_path = settings.llmwiki_root.strip()
    if not root_path:
        return JSONResponse(status_code=400, content={"error": "LLMWiki 루트 경로를 입력해주세요"})
    config_json_path = os.path.join(root_path, "swarmvault.config.json")
    if not os.path.exists(config_json_path):
        return JSONResponse(status_code=400, content={"error": "swarmvault.config.json을 찾을 수 없습니다"})
    save_settings({"llmwiki_root": root_path})
    return {"ok": True}

# 변경 후
GIT_MANAGED_DIR = Path.home() / ".natlas" / "llmwiki"

class SettingsSchema(BaseModel):
    source_mode: str = "git"      # 'git' | 'local'
    git_repo_url: str = ""
    llmwiki_root: str = ""

def load_settings():
    if not CONFIG_FILE.exists():
        return {"source_mode": "git", "git_repo_url": "", "llmwiki_root": ""}
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return {
                "source_mode": data.get("source_mode", "git"),
                "git_repo_url": data.get("git_repo_url", ""),
                "llmwiki_root": data.get("llmwiki_root", ""),
            }
    except Exception:
        return {"source_mode": "git", "git_repo_url": "", "llmwiki_root": ""}

async def put_settings(settings: SettingsSchema):
    mode = settings.source_mode.strip()

    if mode == "git":
        url = settings.git_repo_url.strip()
        if not url:
            return JSONResponse(status_code=400, content={"error": "Git repo URL을 입력해주세요"})
        if not (url.startswith("https://") or url.startswith("git@")):
            return JSONResponse(status_code=400, content={"error": "올바른 Git URL을 입력해주세요 (https:// 또는 git@)"})
        # 자동 관리 경로로 llmwiki_root 세팅
        save_settings({
            "source_mode": "git",
            "git_repo_url": url,
            "llmwiki_root": str(GIT_MANAGED_DIR),
        })
        return {"ok": True}

    else:  # local
        root_path = settings.llmwiki_root.strip()
        if not root_path:
            return JSONResponse(status_code=400, content={"error": "LLMWiki 루트 경로를 입력해주세요"})
        config_json_path = os.path.join(root_path, "swarmvault.config.json")
        if not os.path.exists(config_json_path):
            return JSONResponse(status_code=400, content={"error": "swarmvault.config.json을 찾을 수 없습니다"})
        save_settings({"source_mode": "local", "git_repo_url": "", "llmwiki_root": root_path})
        return {"ok": True}
```

`save_settings` 함수는 기존 그대로 사용. `GIT_MANAGED_DIR` 상수만 파일 상단에 추가.

---

## Fix 4. `src/python/routers/swarmvault.py` — POST /swarmvault/clone SSE 추가

기존 함수와 엔드포인트는 **절대 수정하지 말 것**. 아래 함수만 추가.

파일 상단 import에 아래 추가:
```python
from routers.settings import GIT_MANAGED_DIR
```

라우터 파일 끝에 아래 엔드포인트 추가:

```python
@router.post("/clone")
async def post_clone():
    """Git repo URL로 LLMWiki를 clone 또는 pull (SSE 스트리밍)."""
    settings = load_settings_data()  # settings.py의 load_settings() 사용
    git_url = settings.get("git_repo_url", "").strip()

    if not git_url:
        return JSONResponse(status_code=400, content={"error": "Git repo URL이 설정되지 않았습니다"})

    async def stream():
        target_dir = GIT_MANAGED_DIR

        if (target_dir / ".git").exists():
            # 이미 clone됨 → git pull
            yield f"data: {json.dumps({'type': 'log', 'message': f'기존 clone 감지: {target_dir}'})}\n\n"
            yield f"data: {json.dumps({'type': 'log', 'message': 'git pull 실행 중...'})}\n\n"
            cmd = ["git", "pull"]
            cwd = str(target_dir)
        else:
            # 최초 clone
            yield f"data: {json.dumps({'type': 'log', 'message': f'Git clone: {git_url}'})}\n\n"
            yield f"data: {json.dumps({'type': 'log', 'message': f'대상 경로: {target_dir}'})}\n\n"
            target_dir.mkdir(parents=True, exist_ok=True)
            cmd = ["git", "clone", git_url, str(target_dir)]
            cwd = str(Path.home())

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=cwd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            # stdout/stderr 스트리밍
            while True:
                stdout_line = await proc.stdout.readline()
                stderr_line = await proc.stderr.readline()
                if not stdout_line and not stderr_line:
                    break
                for line in [stdout_line, stderr_line]:
                    text = line.decode().strip()
                    if text:
                        yield f"data: {json.dumps({'type': 'log', 'message': text})}\n\n"

            await proc.wait()
            if proc.returncode == 0:
                yield f"data: {json.dumps({'type': 'done', 'message': '✅ 완료'})}\n\n"
            else:
                yield f"data: {json.dumps({'type': 'error', 'message': f'git 명령 실패 (exit {proc.returncode})'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")
```

`swarmvault.py` 상단에 이미 `load_settings` import가 없으므로 아래를 import에 추가:
```python
from routers.settings import CONFIG_FILE, GIT_MANAGED_DIR, load_settings as load_settings_data
```

기존 `from routers.settings import CONFIG_FILE` 라인을 위 라인으로 교체.

---

## Fix 5. `src/renderer/src/pages/Settings.tsx` — Git/Local 모드 토글 UI

기존 UI 구조(`<div className="flex-1 flex flex-col ...">`)는 그대로 유지.
`LLMWiki Root 경로` 섹션을 아래로 **교체**한다.

변경 전 (`LLMWiki Root 경로` div 전체):
```tsx
<div className="space-y-2.5">
  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider select-none">
    LLMWiki Root 경로
  </label>
  <div className="flex items-center gap-2">
    <Input ... />
    <Button ... >
      <FolderOpen ... />폴더 선택
    </Button>
  </div>
</div>
```

변경 후:
```tsx
{/* Source Mode 토글 */}
<div className="space-y-2.5">
  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider select-none">
    LLMWiki 소스
  </label>
  <div className="flex gap-2">
    <Button
      variant={sourceMode === 'git' ? 'default' : 'outline'}
      onClick={() => setSourceMode('git')}
      className={`flex-1 text-xs h-9 select-none ${sourceMode === 'git' ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-muted/20 text-muted-foreground'}`}
    >
      Git Repository
    </Button>
    <Button
      variant={sourceMode === 'local' ? 'default' : 'outline'}
      onClick={() => setSourceMode('local')}
      className={`flex-1 text-xs h-9 select-none ${sourceMode === 'local' ? 'bg-indigo-600 hover:bg-indigo-500 text-white' : 'bg-muted/20 text-muted-foreground'}`}
    >
      Local Path
    </Button>
  </div>
</div>

{/* Git 모드 */}
{sourceMode === 'git' && (
  <div className="space-y-2.5">
    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider select-none">
      Git Repo URL
    </label>
    <Input
      type="text"
      value={gitRepoUrl}
      onChange={(e) => setGitRepoUrl(e.target.value)}
      placeholder="https://github.com/org/NSoft-LLMWiki.git"
      disabled={isLoading || saveMutation.isPending || isCloning}
      className="bg-muted/20 border-border focus-visible:ring-indigo-500/50 font-mono text-xs text-slate-200"
    />
    <p className="text-xs text-muted-foreground">
      저장 후 "동기화" 버튼으로 clone/pull을 실행하세요.
    </p>
  </div>
)}

{/* Local 모드 */}
{sourceMode === 'local' && (
  <div className="space-y-2.5">
    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider select-none">
      LLMWiki Root 경로
    </label>
    <div className="flex items-center gap-2">
      <Input
        type="text"
        value={llmwikiRoot}
        onChange={(e) => setLlmwikiRoot(e.target.value)}
        placeholder="/Users/username/workspace/NSoft-LLMWiki"
        disabled={isLoading || saveMutation.isPending}
        className="flex-1 bg-muted/20 border-border focus-visible:ring-indigo-500/50 font-mono text-xs text-slate-200"
      />
      <Button
        variant="outline"
        onClick={handleOpenFolder}
        disabled={isLoading || saveMutation.isPending}
        className="bg-muted/40 hover:bg-muted text-foreground border-border select-none"
      >
        <FolderOpen className="w-4 h-4 mr-1.5 text-indigo-400" />
        폴더 선택
      </Button>
    </div>
  </div>
)}

{/* Clone 진행 로그 (Git 모드 전용) */}
{sourceMode === 'git' && cloneLogs.length > 0 && (
  <div className="rounded-lg bg-black/40 border border-border p-3 space-y-1 max-h-40 overflow-y-auto">
    {cloneLogs.map((log, i) => (
      <p key={i} className={`text-xs font-mono ${log.type === 'error' ? 'text-rose-400' : log.type === 'done' ? 'text-emerald-400' : 'text-slate-400'}`}>
        {'> '}{log.message}
      </p>
    ))}
  </div>
)}
```

### 상태 변수 추가 (컴포넌트 상단 useState 영역)

```tsx
// 기존 유지
const [llmwikiRoot, setLlmwikiRoot] = useState('')
const [saveSuccess, setSaveSuccess] = useState(false)
const [saveError, setSaveError] = useState<string | null>(null)

// 추가
const [sourceMode, setSourceMode] = useState<'git' | 'local'>('git')
const [gitRepoUrl, setGitRepoUrl] = useState('')
const [isCloning, setIsCloning] = useState(false)
const [cloneLogs, setCloneLogs] = useState<Array<{type: string; message: string}>>([])
```

### useEffect 수정 — 로드 시 sourceMode/gitRepoUrl 초기화

```tsx
// 기존
useEffect(() => {
  if (currentSettings) {
    setLlmwikiRoot(currentSettings.llmwiki_root)
    setGlobalSettings(currentSettings)
  }
}, [currentSettings, setGlobalSettings])

// 변경 후
useEffect(() => {
  if (currentSettings) {
    setSourceMode((currentSettings.source_mode ?? 'git') as 'git' | 'local')
    setGitRepoUrl(currentSettings.git_repo_url ?? '')
    setLlmwikiRoot(currentSettings.llmwiki_root)
    setGlobalSettings(currentSettings)
  }
}, [currentSettings, setGlobalSettings])
```

### handleSave 수정

```tsx
// 기존
const handleSave = () => {
  if (!llmwikiRoot.trim()) {
    setSaveError('LLMWiki 루트 경로를 입력해주세요.')
    return
  }
  saveMutation.mutate({ llmwiki_root: llmwikiRoot.trim() })
}

// 변경 후
const handleSave = () => {
  if (sourceMode === 'git') {
    if (!gitRepoUrl.trim()) {
      setSaveError('Git repo URL을 입력해주세요.')
      return
    }
    saveMutation.mutate({ source_mode: 'git', git_repo_url: gitRepoUrl.trim(), llmwiki_root: '' })
  } else {
    if (!llmwikiRoot.trim()) {
      setSaveError('LLMWiki 루트 경로를 입력해주세요.')
      return
    }
    saveMutation.mutate({ source_mode: 'local', git_repo_url: '', llmwiki_root: llmwikiRoot.trim() })
  }
}
```

### 동기화 버튼 + handleClone 추가

액션 버튼 영역(`/* Action buttons */` div) 을 아래로 교체:

```tsx
{/* Action buttons */}
<div className="flex justify-end gap-2 select-none pt-4 border-t border-border/40">
  {sourceMode === 'git' && (
    <Button
      onClick={handleClone}
      disabled={isLoading || saveMutation.isPending || isCloning || !gitRepoUrl.trim()}
      variant="outline"
      className="bg-muted/20 hover:bg-muted text-foreground border-border h-10 px-5 transition-all duration-300"
    >
      {isCloning ? '동기화 중...' : '동기화'}
    </Button>
  )}
  <Button
    onClick={handleSave}
    disabled={isLoading || saveMutation.isPending || isCloning || (sourceMode === 'git' ? !gitRepoUrl.trim() : !llmwikiRoot.trim())}
    className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-muted/40 text-white font-bold h-10 px-5 shadow-sm transition-all duration-300"
  >
    <Save className="w-4 h-4 mr-2" />
    {saveMutation.isPending ? '저장 중...' : '설정 저장'}
  </Button>
</div>
```

### handleClone 함수 추가 (handleSave 아래에 추가)

```tsx
const handleClone = async () => {
  setIsCloning(true)
  setCloneLogs([])
  setSaveError(null)

  const res = await api.cloneLLMWiki()
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const text = decoder.decode(value)
    for (const line of text.split('\n')) {
      if (!line.startsWith('data: ')) continue
      const log = JSON.parse(line.slice(6))
      setCloneLogs(prev => [...prev, log])
      if (log.type === 'done' || log.type === 'error') {
        setIsCloning(false)
        if (log.type === 'done') {
          queryClient.invalidateQueries({ queryKey: ['documents'] })
          queryClient.invalidateQueries({ queryKey: ['swarmvaultStatus'] })
        }
        return
      }
    }
  }
  setIsCloning(false)
}
```

---

## 완료 조건

- [ ] `npx tsc --noEmit` 에러 0개
- [ ] Settings 탭 기본 화면이 Git Repository 모드로 표시됨
- [ ] Git URL 입력 → 설정 저장 → `~/.natlas/config.json`에 `source_mode: "git"`, `git_repo_url` 저장 확인
- [ ] "동기화" 버튼 클릭 시 SSE 로그 표시되며 `~/.natlas/llmwiki/`에 clone 실행
- [ ] Local Path 모드 전환 시 기존 폴더 선택 동작 정상 작동
- [ ] `GET /settings` 응답에 `source_mode`, `git_repo_url` 포함

---

## 완료 보고 (필수 — 파일 미작성 시 검수 불가)

작업 완료 후 아래 경로에 파일을 **반드시** 작성한다.

보고 파일: `tasks/reports/2026-05/19/natlas-i4-feat-settings-git-source.md`

```markdown
# 보고: Settings Git 소스 모드 추가 #4

## 완료된 작업
- [x] 항목 1

## 생성/수정된 파일
| 파일 | 추가/수정 심볼 | 삭제 심볼 | 변경 줄 범위 |
|---|---|---|---|
| path/to/file | symbol | - | L1-10 |

## 정적 분석 결과
[tsc --noEmit 출력 전체]

## 발견된 이슈
없음

## 미완료 항목
없음
```
