# NAtlas — Antigravity Agent Guide

## 프로젝트 개요

NAtlas는 NSoft America 전사 지식 탐색기 데스크탑 앱이다.
LLMWiki 문서 상태 확인, SwarmVault 제어, 위키 브라우저를 하나의 GUI로 제공한다.

- **대상**: NSoft America 전 직원
- **플랫폼**: macOS (.dmg) / Windows (.exe)
- **GitHub**: https://github.com/NSoft-America-Inc/NAtlas
- **현재 Phase**: Phase 1 (MVP) — Documents / Update / Settings 탭

---

## 기술 스택

| 레이어 | 기술 | 비고 |
|---|---|---|
| 앱 껍데기 | Electron + **electron-vite** | 빌드 도구 |
| UI | React + TypeScript | |
| UI 라이브러리 | **Shadcn/ui** + Tailwind CSS | `npx shadcn add {component}` |
| 아이콘 | Lucide React | |
| 서버 상태 | **TanStack Query** | FastAPI 호출 캐싱/로딩/에러 |
| UI 상태 | **Zustand** | 탭, 로그, 업데이트 상태 |
| 백엔드 | Python **FastAPI** | 포트 18420, sidecar |
| DB | SQLite | Phase 2 |
| 패키징 | electron-builder | |

---

## 파일 구조 (electron-vite 기준)

```
NAtlas/
├── src/
│   ├── main/                        # Electron main process
│   │   └── index.ts                 # BrowserWindow 생성, sidecar spawn, IPC 핸들러
│   │
│   ├── preload/                     # contextBridge
│   │   └── index.ts                 # window.electron API 노출
│   │
│   └── renderer/                    # React 앱
│       ├── index.html
│       └── src/
│           ├── main.tsx             # React 진입점 + QueryClient
│           ├── App.tsx              # 탭 라우팅 + Layout
│           ├── env.d.ts             # window.electron 타입 선언
│           ├── store/
│           │   └── ui.ts            # Zustand store
│           ├── pages/
│           │   ├── Documents.tsx
│           │   ├── Update.tsx
│           │   └── Settings.tsx
│           ├── components/
│           │   ├── ui/              # Shadcn/ui (npx shadcn add로만 추가)
│           │   ├── Layout.tsx       # 사이드바 + 탭 레이아웃
│           │   ├── StatusBadge.tsx  # ✅ 🟡 🔴 배지
│           │   └── LogViewer.tsx    # SSE 로그 스트리밍 뷰어
│           └── lib/
│               ├── api.ts           # FastAPI 호출 함수 전체
│               ├── types.ts         # 공통 타입 정의
│               └── utils.ts         # cn() Shadcn 유틸
│
├── src/python/
│   ├── main.py                      # FastAPI 앱 (포트 18420)
│   ├── routers/
│   │   ├── documents.py             # GET /documents
│   │   ├── swarmvault.py            # GET /swarmvault/status, POST /swarmvault/update
│   │   └── settings.py             # GET/PUT /settings
│   └── requirements.txt            # fastapi, uvicorn
│
├── docs/
│   ├── architecture.md
│   ├── development.md
│   └── spec/
│       ├── setup.md                 # 프로젝트 초기화 스펙
│       └── phase1.md                # Phase 1 상세 스펙 (타입/API/컴포넌트)
│
├── electron.vite.config.ts
├── electron-builder.yml
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## 레이어 간 통신

### 1. React → FastAPI (주 통신, TanStack Query)
```typescript
// GET 요청 — useQuery
const { data, isLoading } = useQuery({
  queryKey: ['documents'],
  queryFn: api.getDocuments,
  refetchInterval: 30_000
})

// PUT 요청 — useMutation
const { mutate } = useMutation({ mutationFn: api.saveSettings })
```

### 2. SwarmVault update — SSE (Fetch Stream 직접, TanStack Query 미사용)
```typescript
const res = await fetch('http://localhost:18420/swarmvault/update', { method: 'POST' })
const reader = res.body!.getReader()
// → 자세한 패턴: docs/spec/phase1.md Update 탭 참고
```

### 3. 시스템 기능 — Electron IPC (preload.ts 경유)
```typescript
// renderer
const path = await window.electron.openFolderDialog()

// IPC 채널명 (main/index.ts ↔ preload/index.ts 일치 필수)
'open-folder-dialog'
```

---

## Python Sidecar

- Electron 앱 시작 → `src/python/main.py` spawn (포트 18420)
- 포트 충돌 시 기존 프로세스 kill 후 재시작
- React 시작 전 `/health` 폴링 (최대 10초)
- Python 크래시 → 자동 재시작 (최대 3회)
- 앱 종료 → `app.on('before-quit')` → Python SIGTERM

---

## 개발 실행

```bash
npm install
cd src/python && pip install -r requirements.txt && cd ../..
npm run dev    # electron-vite dev → Electron + React HMR + Python uvicorn
```

Python 단독 실행 (디버깅):
```bash
cd src/python && python3 main.py --port 18420
# → http://localhost:18420/docs (Swagger UI)
```

---

## 타입/API/컴포넌트 상세

→ `docs/spec/phase1.md` 참고 (모든 타입 인터페이스, API 스펙, SSE 패턴 포함)

---

## 금지 사항

- Shadcn/ui 컴포넌트 직접 작성 금지 → `npx shadcn add {component}` 사용
- `src/main/` 수정 시 Electron 재시작 필요 (핫리로드 없음) — 보고서 명시
- FastAPI에서 `subprocess.run()` 사용 금지 → `asyncio.create_subprocess_exec` 사용
- IPC 채널명은 `preload/index.ts`와 `main/index.ts`에서 반드시 일치
- SQLite 직접 접근 금지 → `db.py` 경유 (Phase 2)
- 포트 18420 외 사용 금지

---

## LLMWiki

- 로컬 경로: `$(git rev-parse --show-toplevel)/llmwiki/content`
- GitHub: https://github.com/NSoft-America-Inc/NSoft-LLMWiki

---

## 🤖 AI Agent 전용 지침: NStack ➔ NAtlas E2E 지식 파이프라인 강제화

NStack을 통해 AI Agent로 개발을 수행할 때, 지식의 파편화를 막고 NAtlas에서 시각적 일관성을 완벽히 유지하기 위해 다음 규칙을 철저히 준수해야 한다.

### 1. NStack 작업 아티팩트 3종 세트 강제화
모든 개발 작업(Task)은 `01-Logs/archive/{project}/{user}/{task_slug}` 디렉토리 아래에 **반드시** 세 개의 문서가 한 쌍으로 구성되어야 한다.
1. **작업지시서 (`order.md`)**: 작업 계획 및 세부 목표 기술.
2. **완료보고서 (`report.md`)**: 실제 변경 및 구현사항, 테스트 결과 기술.
3. **위키 문서 (`wiki.md`)**: 해당 태스크에서 획득 및 정제한 전사적 지식 자산 기술.

### 2. 필수 YAML Frontmatter 규격
`order.md` 및 `report.md`는 NAtlas가 고속으로 파싱하여 화면 및 지식 네트워크 그래프를 그릴 수 있도록 파일 가장 첫 부분에 **반드시** 아래 Frontmatter를 포함해야 한다.
```yaml
---
title: "작업에 대한 구체적이고 한눈에 이해되는 국문 제목"
issue_url: "https://github.com/NSoft-America-Inc/.../issues/{이슈번호}"
---
```

### 3. 무결성 정합성 린터 자가 검증 의무화
AI 에이전트는 작업을 마친 후 혹은 PR을 올리기 전에, 루트에 구성된 **`verify_nstack_pipeline.py`** 무결성 검증기 스크립트를 반드시 실행하여 어떠한 위반 사례도 없음을 스스로 확인해야 한다.
```bash
python3 verify_nstack_pipeline.py
```
- 본 검증기에서 에러가 발생한 채로 작업을 마무리하거나 코드를 제출하는 것은 **절대 용납되지 않는다 (UNACCEPTABLE)**.

### 4. [[wiki]] 링크의 일관성 유지
- 생성되는 지식 wiki 문서 내에서 타 프로젝트나 태스크를 인용할 때는 `[[slug]]` 대괄호 이중 링크 패턴을 필수적으로 활용한다.
- NAtlas 브라우저는 이 링크들을 파싱하여 네트워크 그래프 간 자성 인력 척력 선으로 시각화하므로, 지식 흐름 간 연계를 세밀하게 구축한다.
