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
