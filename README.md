# NAtlas

NSoft 전사 지식 탐색기 — LLMWiki 문서 상태 확인, SwarmVault 인덱싱 제어, 위키 브라우저, 작업이력 검색을 하나의 데스크탑 앱으로.

## 개요

NAtlas는 [NSoft-LLMWiki](https://github.com/NSoft-America-Inc/NSoft-LLMWiki)와 [SwarmVault](https://github.com/NSoft-America-Inc/NStack)를 기반으로 동작하는 로컬 데스크탑 애플리케이션이다.

개발자가 쌓은 작업이력과 지식 문서를 전 직원이 검색하고 탐색할 수 있도록 한다.

## 주요 기능

| 탭 | 상태 | 기능 |
|---|---|---|
| Documents | ✅ Phase 1 | LLMWiki 문서 목록, 인덱싱 상태, 필터, 마크다운 뷰어 |
| Update | ✅ Phase 1 | SwarmVault ingest + compile 실행, 실시간 로그 스트리밍 |
| Settings | ✅ Phase 1 | Remote(GitHub API) / Local 경로 모드 전환, GitHub Token 관리 |
| Wiki | 🔄 Phase 2 | 독립 위키 리더, 문서 네비게이션 |
| Query | 🔄 Phase 2 | SwarmVault 기반 RAG 지식 질의 인터페이스 |
| History | 🔄 Phase 2 | 작업이력 타임라인, 전직원 검색 |
| Dashboard | 🔄 Phase 2 | 전사 지식 현황 및 인덱싱 통계 시각화 |

## LLMWiki 소스 모드

NAtlas는 두 가지 소스 모드를 지원한다.

| 모드 | 설명 |
|---|---|
| **Remote** | GitHub API로 NSoft-LLMWiki Private 리포지터리를 직접 조회. GitHub Personal Access Token 필요. |
| **Local** | 로컬에 클론된 NSoft-LLMWiki 경로를 직접 읽음. SwarmVault Update 기능 사용 가능. |

## 실행 환경

- macOS

## 기술 스택

- **Electron** — 크로스플랫폼 데스크탑 앱
- **React + TypeScript** — UI (Shadcn/ui + Tailwind CSS)
- **Python FastAPI** — 백엔드 사이드카 (포트 18420)
- **SwarmVault** — 지식 인덱싱 및 RAG 쿼리 엔진
- **SQLite** — 작업이력 로컬 저장 (Phase 2)

## 개발 시작

```bash
# 의존성 설치
npm install

# 개발 모드 실행 (Electron + React + Python sidecar 동시 기동)
npm run dev

# 패키지 빌드 (Mac)
npm run build:mac
```

## 프로젝트 구조

```
NAtlas/
├── src/
│   ├── main/             # Electron main process
│   ├── renderer/         # React 프론트엔드
│   │   └── src/
│   │       ├── pages/    # 탭 컴포넌트 (Documents, Update, Settings ...)
│   │       ├── lib/      # API 클라이언트, 타입 정의
│   │       └── store/    # Zustand 상태 관리
│   └── python/           # FastAPI 사이드카
│       └── routers/      # documents, swarmvault, settings
├── docs/
│   ├── spec/             # Phase별 상세 스펙
│   └── noffice/          # 업무일지
└── tasks/                # 작업 지시서 및 보고서
```

## 관련 프로젝트

- [NStack](https://github.com/NSoft-America-Inc/NStack) — AI 에이전트 협업 워크플로우
- [NSoft-LLMWiki](https://github.com/NSoft-America-Inc/NSoft-LLMWiki) — 지식 문서 저장소
