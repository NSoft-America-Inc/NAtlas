# NAtlas

NSoft 전사 지식 탐색기 — LLMWiki 문서 상태 확인, graphify 제어, 위키 브라우저, 작업이력 검색을 하나의 데스크탑 앱으로.

## 개요

NAtlas는 [NSoft-LLMWiki](https://github.com/NSoft-America-Inc/NSoft-LLMWiki)와 [Graphify](https://github.com/safishamsi/graphifyy)를 기반으로 동작하는 로컬 데스크탑 애플리케이션이다.

개발자가 쌓은 작업이력과 지식 문서를 전 직원이 검색하고 탐색할 수 있도록 한다.

## 주요 기능

| 탭 | 기능 |
|---|---|
| Dashboard | 그래프 통계, 미인덱싱 파일 수, graphify 상태 |
| Documents | content/ 파일 목록 + 인덱싱 상태 (✅ / 🔴 / 🟡) |
| Wiki | 마크다운 뷰어, 파일 탐색 |
| Update | graphify --update 실행 + 실시간 로그 |
| Query | graphify query 검색창 + 결과 |
| History | 작업지시서/보고서 타임라인, 전직원 검색 |
| Settings | LLMWiki 경로, Python/graphify 설치 상태 |

## 실행 환경

- macOS (.dmg)
- Windows (.exe)

## 기술 스택

- **Electron** — 크로스플랫폼 데스크탑 앱 껍데기
- **React + TypeScript** — UI
- **Python FastAPI** — 백엔드 사이드카 (graphify, git, 파일시스템)
- **SQLite** — 작업이력 로컬 저장

## 개발 시작

```bash
# 의존성 설치
npm install

# 개발 모드 실행
npm run dev

# 패키지 빌드 (Mac)
npm run build:mac

# 패키지 빌드 (Windows)
npm run build:win
```

## 프로젝트 구조

```
NAtlas/
├── src/
│   ├── main/         # Electron main process
│   ├── renderer/     # React 프론트엔드
│   └── python/       # FastAPI 사이드카
├── docs/             # 문서
└── assets/           # 아이콘, 이미지
```

## 관련 프로젝트

- [NStack](https://github.com/NSoft-America-Inc/NStack) — AI 에이전트 협업 워크플로우
- [NSoft-LLMWiki](https://github.com/NSoft-America-Inc/NSoft-LLMWiki) — 지식 문서 저장소
