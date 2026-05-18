# NAtlas 프로젝트 킥오프

안녕. 오늘부터 **NAtlas** 프로젝트를 함께 진행할 거야.

## 이 프로젝트가 뭔지

NAtlas는 NSoft America 전사 지식 탐색기 데스크탑 앱이야.
LLMWiki 문서 상태 확인, graphify 제어, 위키 브라우저를 GUI로 제공하는 도구야.
Electron + React + Python FastAPI로 만들고, Mac/Windows 둘 다 지원해.

지금은 Phase 1 (MVP) 을 시작하는 시점이야. 아직 코드는 없어.

---

## 먼저 읽어야 할 문서들

프로젝트 루트에 있는 문서들을 순서대로 읽어줘:

1. `AGENTS.md` — 프로젝트 전체 컨텍스트 (기술스택, 파일구조, 통신 방식, 금지사항)
2. `docs/spec/setup.md` — 프로젝트 초기화 방법 (electron-vite, 의존성, 파일구조)
3. `docs/spec/phase1.md` — Phase 1 상세 스펙 (타입, API, 컴포넌트 인터페이스, SSE 패턴)
4. `docs/architecture.md` — 레이어 간 통신 방식 (IPC, SSE, 생명주기)
5. `.antigravity/rules` — 이 프로젝트의 개발 규칙

---

## 네가 할 일

문서를 다 읽고 나서 `/task` 스킬로 Phase 1 작업지시서를 직접 만들어줘.

작업 범위: `docs/spec/phase1.md`에 정의된 Phase 1 전체
- 프로젝트 초기화 (electron-vite 셋업)
- Python FastAPI sidecar
- Documents 탭
- Update 탭
- Settings 탭

작업지시서 쪼개는 방식은 네가 판단해. 한 번에 다 해도 되고 탭별로 나눠도 돼.
단, 각 지시서는 독립적으로 검증 가능해야 해.

---

## 참고

- GitHub 이슈는 이미 생성되어 있어: https://github.com/NSoft-America-Inc/NAtlas/issues/1
- 커밋 형식: `feat: {내용} #NAtlas-{이슈번호}`
- 완료 기준은 `docs/spec/phase1.md` 하단 체크리스트 참고
