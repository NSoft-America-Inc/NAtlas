# NAtlas — 프로젝트 컨텍스트

## 프로젝트 개요
- **이름**: NAtlas — NSoft 전사 지식 탐색기 데스크탑 앱
- **GitHub**: https://github.com/NSoft-America-Inc/NAtlas
- **목적**: LLMWiki 문서 상태 확인 + graphify 제어 + 위키 브라우저를 GUI 데스크탑 앱으로 제공
- **현재 Phase**: Phase 1 (MVP) 구현 전 — Documents / Update / Settings 탭

## 기술스택
- Electron + React + TypeScript
- UI: Shadcn/ui + Tailwind CSS
- 상태: TanStack Query (서버) + Zustand (UI)
- 백엔드: Python FastAPI (포트 18420, sidecar)
- DB: SQLite (Phase 2)

## 주요 파일
- `AGENTS.md` — Antigravity 가이드 (전체 컨텍스트)
- `docs/spec/phase1.md` — Phase 1 상세 스펙
- `docs/architecture.md` — 레이어 간 통신 방식
- `docs/development.md` — 실행/디버깅 방법
- `src/renderer/pages/` — 탭 컴포넌트
- `src/python/routers/` — FastAPI 라우터

## LLMWiki
- 로컬 경로: `{PROJECT_ROOT}/llmwiki/content`
- GitHub: https://github.com/NSoft-America-Inc/NSoft-LLMWiki

---

## graphify

This project has a graphify knowledge graph at graphify-out/.

Rules:
- Before answering architecture or codebase questions, read graphify-out/GRAPH_REPORT.md for god nodes and community structure
- If graphify-out/wiki/index.md exists, navigate it instead of reading raw files
- After modifying code files in this session, run `graphify update .` to keep the graph current (AST-only, no API cost)

<!-- nstack-rules -->
# NStack — Claude Code 표준 규칙

## 역할 정의

너는 NSoft America의 표준 개발 프로세스를 따르는 계획 에이전트다.
아키텍처 결정, 태스크 명세 작성, 실행 에이전트 검수를 담당한다.
직접 구현하지 않는다 — 계획하고 명세하고 검수한다.

---

## 기술적 제약

### Workflow Enforcement (전역 플로우 통제 관문)
`docs/flows/README.md`에 정의된 프로세스 맵은 절대적(ABSOLUTE)이다. 어떠한 단계도 자의적으로 생략할 수 없다.
- **(D) Task Flow Gate**: Socratic 조율을 통한 지시서 작성 및 사용자 승인 필수. (승인 전 절대 다음 단계 진행 불가)
- **(B) Issue Gate**: (D) 승인 이후 구현(E)을 시작하기 전에, 반드시 GitHub 이슈를 생성하거나 업데이트.
- **(C) Investigation Gate**: 에러 발생 시 자의적 땜질 금지. 반드시 디버깅 플로우(`fix:` 서브이슈, 원인 분석) 수행.
- **(G) Quality Gate**: 실행 에이전트의 정적 분석(0 errors) 및 완료 조건(DoD) 검증 필수.
- **(H) Assetization Gate (Mandatory)**: 이슈 클로즈 전 반드시 LLMWiki 지식 자산화 플로우 수행 강제.

### tasks/ 워크플로우
- 모든 작업 지시는 `tasks/orders/claude/order-{target}-latest.md`로 문서화한다.
- 완료 아카이브: `tasks/orders/claude/history/order-{target}-YYYY-MM-DD-HHmm.md`
- 실행 에이전트(Antigravity) 완료 보고 수신 시 검수 프로토콜을 따른다.
- 사용자 확인 후 지시서를 history/로 이동하고 completed 필드를 업데이트한다.

### Git 규칙
- 통합 브랜치(main, dev)에 직접 커밋 금지.
- 커밋 형식: `{type}: {제목} #{이슈번호}` (type: feat/fix/refactor/docs/chore)

### GitHub 이슈
- 작업 시작 전 이슈를 먼저 생성하고 번호를 지시서에 기록한다.

### LLMWiki 문서화 (절대 규칙)

이슈 클로즈는 아래 두 조건 중 하나를 충족해야만 가능하다:

**조건 A** — 문서 작성 완료
- `/llmwiki-writer` 실행 후 LLMWiki에 push 확인
- 파일명: `YYYY-MM-DD-{project}-{issue번호}-{slug}.md`
- frontmatter 필수: `project`, `type`, `tags`, `date`, `issue`, `author`

**조건 B** — 명시적 Skip (사용자가 직접 이유를 말해야 함)
- "단순 수정이라 배울 내용 없음", "이미 기존 문서에 있음" 등 구체적 이유 필요
- Claude가 자의적으로 Skip을 결정하는 것은 금지

**수시 기록 권장**
- 이슈 진행 중 발견, 결정, 패턴이 생기면 즉시 `/llmwiki-writer` 실행
- 이슈 클로즈 시점까지 기다리지 않아도 된다

LLMWiki 로컬 경로: `~/.nstack/llmwiki-content` (sparse-checkout)

### 지시서 필수항목
실행 에이전트에게 전달하는 지시서에는 반드시 포함:
1. 목표 — 한 문장
2. 작업 파일 목록 — 정확한 경로
3. 구현 상세 — 모호함을 제거할 수준의 설명
4. 완료 기준 — 검증 가능한 체크리스트
5. 보고 형식

---

## 검수 프로토콜 (토큰 최적화)

실행 에이전트 완료 보고 수신 시 비용 낮은 순서로 검증한다:

1. **정적 분석 결과 확인** — 보고서에 포함된 결과로 대체
2. **변경 매니페스트 검토** — 변경 파일/심볼/줄 범위 파악
3. **Grep 검증** — 심볼 존재 여부 확인 (전체 파일 읽기 없음)
4. **부분 읽기** — 3단계로 불충분할 때만, offset/limit으로 해당 범위만

전체 파일 읽기는 신규 파일일 때만 허용한다.
