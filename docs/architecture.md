# NAtlas 아키텍처

## 전체 구조

```
┌─────────────────────────────────────────────┐
│              Electron (앱 껍데기)             │
│        macOS: .dmg / Windows: .exe          │
│                                             │
│  ┌─────────────────┐  ┌──────────────────┐  │
│  │  React (UI)     │  │  Python FastAPI  │  │
│  │  TypeScript     │↔│  (sidecar)       │  │
│  │                 │  │                  │  │
│  │  - Dashboard    │  │  - graphify 제어 │  │
│  │  - Documents    │  │  - git 조작      │  │
│  │  - Wiki         │  │  - 파일시스템    │  │
│  │  - Update       │  │  - SQLite        │  │
│  │  - Query        │  │                  │  │
│  │  - History      │  └──────────────────┘  │
│  │  - Settings     │                        │
│  └─────────────────┘                        │
└─────────────────────────────────────────────┘
         ↕                      ↕
   LLMWiki (로컬)          graphify-out/
   content/                graph.json
```

## 레이어별 역할

### Electron Main Process (`src/main/`)
- 앱 생명주기 관리
- Python sidecar 프로세스 시작/종료
- 파일시스템 접근 (IPC)
- 자동 업데이트

### React Renderer (`src/renderer/`)
- 모든 UI 컴포넌트
- Electron IPC를 통해 main process와 통신
- FastAPI REST API를 통해 Python sidecar와 통신

### Python FastAPI Sidecar (`src/python/`)
- graphify 설치 확인 및 실행
- git 조작 (pull, add, commit, push)
- 파일 상태 확인 (manifest 비교)
- SQLite 작업이력 관리
- graphify query 실행

## 데이터 흐름

### 문서 상태 확인
```
React → FastAPI → manifest.json 읽기
                → content/ 파일 목록 비교
                → 상태 반환 (indexed / new / modified)
```

### graphify 업데이트
```
React [Update 버튼] → FastAPI → graphify --update content/ 실행
                              → stdout 스트리밍 → React 실시간 로그
                              → manifest 갱신
```

### 작업이력 검색
```
React [검색어] → FastAPI → SQLite FTS 검색
                         → 지시서/보고서 파일 파싱
                         → 결과 반환
```

## 패키징 전략

```
electron-builder
├── Mac: NAtlas.dmg (Python 런타임 번들)
└── Windows: NAtlas-Setup.exe (Python 런타임 번들)
```

사용자는 Python을 별도 설치할 필요 없음. Python 런타임을 앱에 내장.
