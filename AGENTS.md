# NAtlas — Antigravity Agent Guide

## 프로젝트 개요 / Project Overview

NAtlas는 NSoft America 전사 지식 탐색기다.
LLMWiki 문서 상태 확인, Graphify 제어, 위키 브라우저, 작업이력 검색을 하나의 데스크탑 앱으로 제공한다.

기존에 Claude/Antigravity 스킬로 처리하던 반복적·기계적 작업(graphify update, 문서 상태 확인 등)을
사람이 직접 GUI로 제어할 수 있게 한다.

**대상 사용자**: NSoft America 전 직원 (개발자 → 전사 확장 예정)
**플랫폼**: macOS (.dmg) / Windows (.exe)

---

## 기술 스택 / Tech Stack

| 레이어 | 기술 | 선택 이유 |
|---|---|---|
| 앱 껍데기 | Electron | 크로스플랫폼 데스크탑 (Mac/Windows) |
| UI | React + TypeScript | 컴포넌트 기반 UI |
| UI 라이브러리 | Shadcn/ui + Tailwind CSS | 고품질 디자인, 소스 복사 방식으로 번들 최적화 |
| 아이콘 | Lucide React | Shadcn/ui 기본 아이콘 셋 |
| 서버 상태 | TanStack Query | FastAPI 호출 캐싱·로딩·에러 자동 처리 |
| UI 상태 | Zustand | 탭·모달·선택 항목 등 경량 전역 상태 |
| 백엔드 | Python FastAPI | graphify, git, 파일시스템 제어 |
| DB | SQLite | 작업이력 로컬 저장 |
| 패키징 | electron-builder | Mac .dmg / Windows .exe |

---

## 파일 구조 / File Structure (Phase 1 기준)

```
NAtlas/
├── src/
│   ├── main/                      # Electron main process
│   │   ├── index.ts               # 앱 진입점, BrowserWindow 생성
│   │   ├── sidecar.ts             # Python FastAPI 프로세스 시작/종료
│   │   └── ipc.ts                 # IPC 핸들러 등록
│   │
│   ├── renderer/                  # React 프론트엔드
│   │   ├── main.tsx               # React 진입점
│   │   ├── App.tsx                # 탭 라우팅
│   │   ├── store/
│   │   │   └── ui.ts              # Zustand UI 상태 (현재 탭, 사이드바 등)
│   │   ├── pages/
│   │   │   ├── Documents.tsx      # 파일 목록 + 인덱싱 상태
│   │   │   ├── Update.tsx         # graphify --update 실행 + 실시간 로그
│   │   │   └── Settings.tsx       # LLMWiki 경로, 설치 상태 진단
│   │   ├── components/
│   │   │   ├── ui/                # Shadcn/ui 컴포넌트 (자동 생성)
│   │   │   ├── Layout.tsx         # 사이드바 + 탭 레이아웃
│   │   │   ├── StatusBadge.tsx    # ✅ 🔴 🟡 상태 배지
│   │   │   └── LogViewer.tsx      # 실시간 로그 스트리밍 뷰어
│   │   └── lib/
│   │       ├── api.ts             # FastAPI 호출 함수 모음
│   │       └── utils.ts           # Shadcn/ui 유틸
│   │
│   └── python/                    # FastAPI sidecar
│       ├── main.py                # FastAPI 앱 진입점 (포트 18420)
│       ├── routers/
│       │   ├── documents.py       # GET /documents
│       │   ├── graphify.py        # GET /graphify/status, POST /graphify/update (SSE)
│       │   └── settings.py        # GET/PUT /settings
│       ├── db.py                  # SQLite 연결
│       └── requirements.txt
│
├── docs/
│   ├── architecture.md
│   ├── development.md
│   ├── spec/
│   │   └── phase1.md              # Phase 1 상세 스펙
│   └── user-guide.md
│
├── assets/
│   ├── icon.icns                  # Mac 아이콘
│   └── icon.ico                   # Windows 아이콘
│
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── electron-builder.yml
└── README.md
```

---

## 레이어 간 통신 / Communication

### React → FastAPI (직접 HTTP)
```
React (renderer) → fetch("http://localhost:18420/...") → FastAPI
```
TanStack Query로 래핑:
```typescript
const { data } = useQuery({ queryKey: ['documents'], queryFn: () => api.getDocuments() })
```

### Electron IPC (파일시스템·시스템 접근만)
React가 직접 할 수 없는 작업만 IPC 사용:
```typescript
// renderer
window.electron.openFolderDialog()

// main/ipc.ts
ipcMain.handle('open-folder-dialog', async () => {
  return dialog.showOpenDialog({ properties: ['openDirectory'] })
})
```

### SSE 스트리밍 (graphify update 실시간 로그)
```
React [EventSource] → FastAPI /graphify/update (POST → SSE stream)
```

---

## Python Sidecar 생명주기

- Electron 앱 시작 시 `sidecar.ts`가 Python 프로세스 spawn
- 포트 18420 고정 (충돌 시 이전 프로세스 kill 후 재시작)
- 앱 종료 시 Python 프로세스 함께 종료
- Python 크래시 시 자동 재시작 (최대 3회)

---

## 현재 상태 / Current Status

| Phase | 상태 | 내용 |
|---|---|---|
| Phase 1 — MVP | 🔴 구현 전 | Documents, Update, Settings 탭 |
| Phase 2 | ⬜ 미시작 | Wiki, Query, History 탭 |
| Phase 3 | ⬜ 미시작 | 자동 빌드, auto-updater |

**지금 해야 할 것**: Phase 1 MVP 구현 (`/task` 스킬로 시작)

---

## 개발 모드 실행

```bash
cd /Users/yg/workspace/NAtlas
npm install
cd src/python && pip install -r requirements.txt && cd ../..
npm run dev
# → Python FastAPI (18420) + React (3000) + Electron 동시 시작
```

---

## 금지 사항 / Don'ts

- `src/main/` 파일을 수정하면 반드시 Electron 재시작 필요 (핫리로드 없음)
- Shadcn/ui 컴포넌트를 `src/renderer/components/ui/` 외부에 직접 작성 금지 → `npx shadcn add {component}` 사용
- FastAPI 라우터에서 직접 subprocess 실행 금지 → `asyncio.create_subprocess_exec` 사용
- SQLite 직접 접근 금지 → `db.py` 통해서만 접근
- 포트 18420 외 포트 사용 금지

---

## LLMWiki

로컬 경로: `$(git rev-parse --show-toplevel)/llmwiki/content`
GitHub: https://github.com/NSoft-America-Inc/NSoft-LLMWiki
