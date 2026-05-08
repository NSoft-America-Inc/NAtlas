# NAtlas 개발 가이드

## 개발 환경 요구사항

- Node.js 18+
- Python 3.10+
- npm
- graphify (`pip install graphifyy`)

## 초기 설정

```bash
git clone https://github.com/NSoft-America-Inc/NAtlas.git
cd NAtlas

# Node 의존성
npm install

# Python 의존성
cd src/python && pip install -r requirements.txt && cd ../..

# Shadcn/ui 초기화 (최초 1회)
npx shadcn init
```

## 개발 모드 실행

```bash
npm run dev
```

내부 실행 순서:
1. Python FastAPI sidecar 시작 (포트 18420)
2. React dev server 시작 (포트 3000)
3. Electron 앱 실행

## 프로세스별 디버깅

### Python FastAPI 단독 실행
```bash
cd src/python
python3 main.py --port 18420
# http://localhost:18420/docs 에서 Swagger UI 확인
```

### React 단독 실행 (Electron 없이)
```bash
npm run dev:renderer
# http://localhost:3000
```

### Electron 로그 확인
- macOS: `~/Library/Logs/NAtlas/main.log`
- DevTools: Electron 창에서 `Cmd+Option+I`

### Python 로그 확인
- stdout 출력 (터미널에서 직접 확인)
- `npm run dev` 실행 시 Electron 콘솔에 함께 출력됨

## 핫리로드 범위

| 변경 파일 | 핫리로드 |
|---|---|
| `src/renderer/**` | ✅ 자동 (Vite HMR) |
| `src/python/**` | ✅ 자동 (uvicorn --reload) |
| `src/main/**` | ❌ Electron 재시작 필요 (`rs` 입력) |

## 환경변수

| 변수 | 기본값 | 설명 |
|---|---|---|
| `NATLAS_PORT` | `18420` | FastAPI 포트 |
| `NATLAS_DEV` | `1` (dev모드) | 개발 모드 플래그 |
| `NATLAS_LLMWIKI` | `~/.natlas/config.json`에서 읽음 | LLMWiki 경로 오버라이드 |

## Shadcn/ui 컴포넌트 추가

```bash
# 컴포넌트 추가
npx shadcn add button
npx shadcn add table
npx shadcn add input
# → src/renderer/components/ui/ 에 자동 생성
```

직접 작성하지 말 것.

## 정적 분석

```bash
# TypeScript 타입 검사
npx tsc --noEmit

# Python 린트
cd src/python && python3 -m py_compile main.py
```

## 빌드

```bash
# macOS
npm run build:mac   # → dist/NAtlas.dmg

# Windows (Windows 환경 또는 크로스 빌드)
npm run build:win   # → dist/NAtlas-Setup.exe
```

## 프로젝트 구조

```
NAtlas/
├── src/
│   ├── main/                 # Electron main process
│   │   ├── index.ts          # 앱 진입점
│   │   ├── sidecar.ts        # Python 프로세스 관리
│   │   └── ipc.ts            # IPC 핸들러
│   │
│   ├── renderer/             # React 프론트엔드
│   │   ├── main.tsx          # React 진입점
│   │   ├── App.tsx           # 탭 라우팅
│   │   ├── store/
│   │   │   └── ui.ts         # Zustand UI 상태
│   │   ├── pages/
│   │   │   ├── Documents.tsx
│   │   │   ├── Update.tsx
│   │   │   └── Settings.tsx
│   │   ├── components/
│   │   │   ├── ui/           # Shadcn/ui (자동 생성)
│   │   │   ├── Layout.tsx
│   │   │   ├── StatusBadge.tsx
│   │   │   └── LogViewer.tsx
│   │   └── lib/
│   │       ├── api.ts        # FastAPI 호출 함수
│   │       └── utils.ts      # Shadcn/ui 유틸
│   │
│   └── python/               # FastAPI sidecar
│       ├── main.py
│       ├── routers/
│       │   ├── documents.py
│       │   ├── graphify.py
│       │   └── settings.py
│       ├── db.py
│       └── requirements.txt
│
├── docs/
│   ├── architecture.md
│   ├── development.md        # (이 파일)
│   ├── spec/
│   │   └── phase1.md
│   └── user-guide.md
│
├── assets/
├── package.json
├── tsconfig.json
├── tailwind.config.ts
├── electron-builder.yml
└── README.md
```

## API 엔드포인트 (FastAPI)

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/health` | 헬스체크 |
| GET | `/documents` | 파일 목록 + 인덱싱 상태 |
| GET | `/graphify/status` | graphify 설치 상태 |
| POST | `/graphify/update` | graphify --update 실행 (SSE 스트리밍) |
| GET | `/settings` | 설정값 조회 |
| PUT | `/settings` | 설정값 저장 |

## Phase 계획

### Phase 1 — MVP (현재)
- Electron + React 기본 구조
- Python FastAPI sidecar 연동
- Documents 탭
- Update 탭
- Settings 탭

### Phase 2
- Wiki 탭 (마크다운 렌더러)
- Query 탭 (graphify query)
- History 탭 + SQLite
- Dashboard 탭

### Phase 3
- Python 런타임 번들 내장 (pyinstaller)
- Mac/Windows 자동 빌드 (GitHub Actions)
- Electron auto-updater
