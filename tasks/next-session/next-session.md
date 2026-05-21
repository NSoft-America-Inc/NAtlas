# 다음 세션 시작 프롬프트

아래 내용을 새 세션 첫 메시지로 붙여넣기.

---

## 프롬프트

NAtlas 작업을 이어서 진행한다.

### 프로젝트 개요

- **저장소**: NSoft-America-Inc/NAtlas
- **기술 스택**: Electron + React + TypeScript + Python FastAPI (포트 18420, sidecar)
- **UI**: Shadcn/ui + Tailwind CSS v4
- **상태**: TanStack Query (서버) + Zustand (UI)
- **작업 방식**: Claude(계획/검수) + Antigravity(구현)
- **실행**: `npm run dev` (NAtlas/ 루트에서)

### 이전 세션에서 완료한 작업

| 이슈 | 작업 | 결과 |
|---|---|---|
| #4 | Settings 탭 Remote(GitHub Token)/Local 모드 전환 | ✅ 완료 (close 필요) |
| #5 | Documents 탭 필터/마크다운 뷰어/slug+doc_type 뱃지 | ✅ 완료 (close 필요) |
| LLMWiki#17 | NSoft-LLMWiki SwarmVault 연동 폴더 구조 재편 | ✅ 완료 |

### 먼저 처리할 것: #4, #5 이슈 close

#4, #5 모두 구현 완료·push까지 됐으나 GitHub에서 open 상태.
완료 코멘트 작성 후 close 처리한다.

### 다음 할 작업: Update 탭 구현 (Phase 1 마지막 탭)

**목적**: SwarmVault `ingest` + `compile`을 GUI에서 실행하고 실시간 로그를 스트리밍으로 표시한다.

**API**: `POST /swarmvault/update` → SSE 스트리밍
- 실행 순서: 변경/신규 파일 `swarmvault ingest` (1개씩) → `swarmvault compile`
- `cwd = llmwiki_root` (Settings에서 설정한 경로)
- 이미 `src/python/routers/swarmvault.py`에 관련 라우터 일부 존재

**UI** (`src/renderer/src/pages/Update.tsx`):
```
┌──────────────────────────────────────────────────────┐
│ LLMWiki 루트 경로 표시                               │
│                              [▶ 업데이트 실행]        │
├──────────────────────────────────────────────────────┤
│ 로그                                     [지우기]    │
│ > Ingesting: 01-Logs/archive/nstack/...              │
│ > Compiled 52 source(s)...                           │
│ > ✅ 완료                                            │
│ [자동 하단 고정 스크롤]                               │
├──────────────────────────────────────────────────────┤
│ 마지막 실행: 2026-05-19 21:xx                        │
└──────────────────────────────────────────────────────┘
```

**SSE 소비 패턴**: TanStack Query 미사용, Fetch Stream 직접 사용
```typescript
const res = await fetch('http://localhost:18420/swarmvault/update', { method: 'POST' })
const reader = res.body!.getReader()
// line.startsWith('data: ') → JSON.parse(line.slice(6))
```

**작업 파일**:
- `src/renderer/src/pages/Update.tsx` (신규)
- `src/python/routers/swarmvault.py` (POST /swarmvault/update 엔드포인트)
- `src/renderer/src/lib/types.ts` (LogLine 타입 확인)

**완료 조건**:
- [ ] Update 탭에서 버튼 클릭 시 SSE 로그 실시간 표시
- [ ] `swarmvault ingest` → `compile` 순서 실행
- [ ] 완료/에러 시 상태 표시
- [ ] Local 모드에서만 활성화 (Remote 모드는 비활성 + 안내 메시지)
- [ ] `npx tsc --noEmit` 0 errors

### 전체 이슈 로드맵

```
#1 MVP 전체 ← 상위 이슈
  ├── #2 프로젝트 초기화 ✅
  ├── #3 문서 정비 ✅
  ├── #4 Settings 탭 ✅ (close 필요)
  ├── #5 Documents 탭 ✅ (close 필요)
  └── #6 Update 탭 ← 다음 세션 (신규 이슈 생성 후 착수)
```

### 주의 사항

- `swarmvault.py`에 기존 clone 관련 코드가 있음. update 엔드포인트 추가 시 충돌 주의.
- Remote 모드에서는 Update 탭을 비활성화해야 함 (swarmvault는 로컬 경로 필요).
- Settings에서 저장된 `source_mode`와 `llmwiki_root`는 `~/.natlas/config.json`에 저장됨.

### 주요 파일 경로

```
src/renderer/src/pages/Update.tsx          ← 신규 작성
src/python/routers/swarmvault.py           ← update 엔드포인트 추가
src/renderer/src/lib/types.ts              ← LogLine 타입 확인
src/renderer/src/store/ui.ts               ← 탭 상태 관리
docs/spec/phase1.md                        ← Update 탭 상세 스펙 참조
```
