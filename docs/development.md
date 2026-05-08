# NAtlas 개발 가이드

## 개발 환경 요구사항

- Node.js 18+
- Python 3.11+
- npm 또는 yarn

## 초기 설정

```bash
# 레포 클론
git clone https://github.com/NSoft-America-Inc/NAtlas.git
cd NAtlas

# Node 의존성 설치
npm install

# Python 의존성 설치
cd src/python
pip install -r requirements.txt
cd ../..
```

## 개발 모드 실행

```bash
# 전체 실행 (Electron + React + Python 동시)
npm run dev
```

내부적으로:
1. Python FastAPI sidecar 시작 (포트 18420)
2. React dev server 시작 (포트 3000)
3. Electron 앱 실행

## 빌드

```bash
# macOS
npm run build:mac   # → dist/NAtlas.dmg

# Windows (Mac에서 크로스 빌드 or Windows에서)
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
│   │   ├── App.tsx
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx
│   │   │   ├── Documents.tsx
│   │   │   ├── Wiki.tsx
│   │   │   ├── Update.tsx
│   │   │   ├── Query.tsx
│   │   │   ├── History.tsx
│   │   │   └── Settings.tsx
│   │   └── components/
│   │
│   └── python/               # FastAPI sidecar
│       ├── main.py           # FastAPI 앱 진입점
│       ├── routers/
│       │   ├── documents.py  # 파일 상태 API
│       │   ├── graphify.py   # graphify 제어 API
│       │   ├── query.py      # query API
│       │   ├── history.py    # 작업이력 API
│       │   └── settings.py   # 설정 API
│       ├── db.py             # SQLite 연결
│       └── requirements.txt
│
├── docs/
│   ├── architecture.md
│   ├── development.md        # (이 파일)
│   └── user-guide.md
│
├── assets/
│   ├── icon.icns             # Mac 아이콘
│   └── icon.ico              # Windows 아이콘
│
├── package.json
├── electron-builder.yml
└── README.md
```

## API 엔드포인트 (FastAPI)

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/documents` | 파일 목록 + 인덱싱 상태 |
| GET | `/graphify/status` | graphify 설치 상태 |
| POST | `/graphify/update` | graphify --update 실행 (SSE 스트리밍) |
| POST | `/graphify/query` | graphify query 실행 |
| GET | `/history` | 작업이력 목록 |
| GET | `/history/search` | 작업이력 검색 |
| GET | `/settings` | 설정값 조회 |
| PUT | `/settings` | 설정값 저장 |

## Phase 계획

### Phase 1 — MVP
- Electron + React 기본 구조 셋업
- Python FastAPI sidecar 연동
- Documents 탭
- Update 탭
- Settings 탭

### Phase 2
- Wiki 탭 (마크다운 렌더러)
- Query 탭
- History 탭 + SQLite

### Phase 3
- Windows/Mac 패키지 자동 빌드 (GitHub Actions)
- Electron auto-updater
