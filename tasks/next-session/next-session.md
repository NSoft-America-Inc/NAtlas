# 다음 세션 시작 프롬프트

아래 내용을 새 세션 첫 메시지로 붙여넣기.

---

## 프롬프트

NAtlas Phase 1 MVP 구현을 시작한다.

### 프로젝트 개요

- **저장소**: NSoft-America-Inc/NAtlas
- **기술 스택**: Electron + React + TypeScript + Python FastAPI (electron-vite 기반)
- **작업 방식**: Claude(계획/검수) + Antigravity(구현)
- **GitHub**: https://github.com/NSoft-America-Inc/NAtlas

### 오늘 완료한 작업

| 이슈 | 작업 | 결과 |
|---|---|---|
| #3 | 설계 문서 검토 및 보완 (graphify → SwarmVault 전면 수정) | ✅ 완료 |

> **커밋 필요**: AGENTS.md, CLAUDE.md, docs/spec/setup.md 수정됨 (미커밋 상태)
> ```bash
> cd /Users/yg/workspace/NAtlas
> git add AGENTS.md CLAUDE.md docs/spec/setup.md
> git commit -m "docs: graphify → SwarmVault 전면 수정 #3"
> ```
> 커밋 후 이슈 #3 클로즈.

### 다음 할 작업: #2 + #1 NAtlas Phase 1 구현

**목적**: electron-vite 기반 프로젝트를 초기화하고 Phase 1 MVP (Documents / Update / Settings 3개 탭) 전체를 구현한다.

**작업 내용**:

1. **프로젝트 초기화** (`docs/spec/setup.md` 기준)
   - `npm create @quick-start/electron@latest` → React + TypeScript 선택
   - 의존성 설치: TanStack Query, Zustand, Shadcn/ui, Lucide React, Tailwind
   - Python: `src/python/requirements.txt` (fastapi, uvicorn)

2. **Phase 1 구현** (`docs/spec/phase1.md` + `docs/architecture.md` 기준)
   - `src/renderer/src/lib/types.ts` — 공통 타입
   - `src/renderer/src/lib/api.ts` — FastAPI 호출 함수
   - `src/renderer/src/store/ui.ts` — Zustand store
   - `src/renderer/src/components/Layout.tsx` — 사이드바 + 탭
   - `src/renderer/src/pages/Documents.tsx` + StatusBadge, DocumentTable
   - `src/renderer/src/pages/Update.tsx` + LogViewer (SSE)
   - `src/renderer/src/pages/Settings.tsx` + PathSetting, DiagnosticPanel
   - `src/python/main.py` — FastAPI 앱
   - `src/python/routers/documents.py` — GET /documents (manifests 기반)
   - `src/python/routers/swarmvault.py` — GET /swarmvault/status, POST /swarmvault/update (SSE)
   - `src/python/routers/settings.py` — GET/PUT /settings
   - `src/main/index.ts` — sidecar spawn + IPC
   - `src/preload/index.ts` — contextBridge

**완료 조건** (`docs/spec/phase1.md` 완료 기준):
- [ ] `npm run dev` 실행 시 Electron 앱 정상 기동
- [ ] Documents 탭 — `state/manifests/` 기반 파일 목록 + 상태 배지, 30초 자동 갱신
- [ ] Update 탭 — `swarmvault ingest` + `swarmvault compile` SSE 로그 실시간 표시
- [ ] Settings 탭 — `swarmvault.config.json` 기반 경로 유효성 검사 + 설치 상태 진단
- [ ] 다크모드 기본 적용
- [ ] `npx tsc --noEmit` 에러 0개
- [ ] `npm run build:mac` 성공

### 전체 이슈 로드맵

```
#3 문서 검토/보완 ✅ (커밋 + 클로즈 필요)
  ↓
#2 프로젝트 초기화 ← 다음 세션 (최우선, #1과 묶어서 진행)
  ↓
#1 Phase 1 MVP 구현
```

### 주의 사항

- **미커밋 파일**: AGENTS.md, CLAUDE.md, docs/spec/setup.md — 세션 시작 시 먼저 커밋
- **src/ 폴더 비어있음**: electron-vite 초기화 전 상태. `package.json` 없음. 초기화 먼저 진행.
- **Settings의 llmwiki_root**: NAtlas `llmwiki/` 폴더가 아닌, 사용자가 Settings에서 지정하는 **외부** NSoft-LLMWiki 경로 (예: `/Users/.../NSoft-LLMWiki`)
- **Python sidecar**: `asyncio.create_subprocess_exec` 사용 필수 (`subprocess.run` 금지)
- **인덱싱 상태 판단**: `state/manifests/*.json`의 `repoRelativePath` + `sourceHash` 필드 기준

### 주요 파일 경로

```
/Users/yg/workspace/NAtlas/
├── AGENTS.md                       # Antigravity 전체 컨텍스트 (가장 중요)
├── docs/spec/phase1.md             # 타입/API/컴포넌트 상세 스펙
├── docs/spec/setup.md              # 초기화 커맨드 + 설정 파일
└── docs/architecture.md            # 레이어 간 통신, Python sidecar
```
