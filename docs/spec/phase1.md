# Phase 1 — MVP 상세 스펙

## 범위

| 탭 | 구현 여부 |
|---|---|
| Documents | ✅ Phase 1 |
| Update | ✅ Phase 1 |
| Settings | ✅ Phase 1 |
| Wiki | ⬜ Phase 2 |
| Query | ⬜ Phase 2 |
| History | ⬜ Phase 2 |
| Dashboard | ⬜ Phase 2 |

---

## 레이아웃

```
┌──────────────────────────────────────────────┐
│  NAtlas                            [─][□][×] │
├────────────┬─────────────────────────────────┤
│            │                                 │
│  📄 Documents  │        메인 컨텐츠 영역          │
│  🔄 Update     │                                 │
│  ⚙️ Settings   │                                 │
│            │                                 │
└────────────┴─────────────────────────────────┘
```

- 좌측: 사이드바 (탭 네비게이션, 고정 너비 200px)
- 우측: 탭별 컨텐츠 영역
- 다크모드 기본 적용 (Tailwind `dark` class)

---

## Tab 1 — Documents

### 목적
`{PROJECT}/llmwiki/content/` 파일 목록과 Graphify 인덱싱 상태를 표시한다.

### UI 구성

```
[Documents]

검색: [________________] [필터 ▼]

┌──────────────────────────────────────────────────────┐
│ 상태 │ 파일 경로                        │ 마지막 수정  │
├──────┼──────────────────────────────────┼────────────┤
│  ✅  │ 01-Logs/tasks/2026-05-01-...md   │ 2시간 전    │
│  🟡  │ 01-Logs/tasks/2026-05-08-...md   │ 방금        │
│  🔴  │ 02-Resources/decisions/...md     │ 1일 전      │
└──────┴──────────────────────────────────┴────────────┘

총 42개 파일 | ✅ 40 인덱싱됨 | 🟡 1 수정됨 | 🔴 1 미인덱싱
```

### 인덱싱 상태 정의

| 상태 | 의미 | 판단 기준 |
|---|---|---|
| ✅ 인덱싱됨 | graphify graph에 포함됨 | `manifest.json`에 존재 + 해시 일치 |
| 🟡 수정됨 | 인덱싱 후 파일이 변경됨 | `manifest.json`에 존재 + 해시 불일치 |
| 🔴 미인덱싱 | graph에 없음 | `manifest.json`에 없음 |

### API

```
GET /documents
Response:
{
  "files": [
    {
      "path": "01-Logs/tasks/2026-05-01-example.md",
      "status": "indexed" | "modified" | "new",
      "modified_at": "2026-05-08T10:00:00"
    }
  ],
  "summary": { "total": 42, "indexed": 40, "modified": 1, "new": 1 }
}
```

### 컴포넌트 트리

```
Documents.tsx
├── SearchBar.tsx          (검색 입력)
├── FilterDropdown.tsx     (상태 필터)
├── DocumentTable.tsx      (파일 목록 테이블)
│   └── DocumentRow.tsx    (파일 행 + StatusBadge)
└── SummaryBar.tsx         (하단 통계)
```

---

## Tab 2 — Update

### 목적
`graphify --update {llmwiki}/content` 명령을 실행하고 실시간 로그를 표시한다.

### UI 구성

```
[Update]

LLMWiki 경로: /Users/.../NAtlas/llmwiki/content    [업데이트 실행]

─────────────────────────────────────────────────────

[실행 중...]

> graphify --update content/
> Scanning 42 files...
> Processing: 01-Logs/tasks/2026-05-08-example.md
> ✓ Graph updated: 1 new, 0 modified
> Done in 3.2s

─────────────────────────────────────────────────────

마지막 실행: 2026-05-08 14:32:10  [로그 지우기]
```

### 상태 정의

| 상태 | UI |
|---|---|
| 대기 | "업데이트 실행" 버튼 활성 |
| 실행 중 | 버튼 비활성 + 스피너 + 실시간 로그 스트리밍 |
| 완료 | 버튼 재활성 + 완료 메시지 |
| 오류 | 버튼 재활성 + 빨간 에러 메시지 |

### API

```
POST /graphify/update
Response: SSE stream
data: {"type": "log", "message": "Scanning 42 files..."}
data: {"type": "log", "message": "Processing: example.md"}
data: {"type": "done", "message": "Done in 3.2s"}
data: {"type": "error", "message": "graphify not found"}
```

### 컴포넌트 트리

```
Update.tsx
├── PathDisplay.tsx        (현재 LLMWiki 경로 표시)
├── RunButton.tsx          (실행 버튼 + 로딩 상태)
└── LogViewer.tsx          (SSE 스트리밍 로그 뷰어)
    └── LogLine.tsx        (한 줄 로그 + 색상 처리)
```

---

## Tab 3 — Settings

### 목적
LLMWiki 경로를 설정하고 Python/graphify 설치 상태를 진단한다.

### UI 구성

```
[Settings]

## LLMWiki 경로

경로: [/Users/.../NAtlas/llmwiki/content        ] [찾기]
      ✅ 유효한 경로입니다 (42개 파일)

[저장]

─────────────────────────────────────────────────────

## 설치 상태 진단

Python        ✅ python3.12 (3.12.3)
graphify      ✅ graphify 0.9.1
LLMWiki       ✅ content/ 접근 가능 (42개 파일)

[다시 진단]
```

### 에러 상태

| 항목 | 에러 시 표시 |
|---|---|
| Python | 🔴 Python 3.10+ 미설치 — brew install python@3.12 |
| graphify | 🔴 graphify 미설치 — pip install graphifyy |
| LLMWiki 경로 | 🔴 경로가 존재하지 않습니다 |
| content/ 없음 | 🟡 content/ 폴더가 없습니다 |

### API

```
GET /settings
Response:
{
  "llmwiki_path": "/Users/.../NAtlas/llmwiki/content"
}

PUT /settings
Body: { "llmwiki_path": "..." }
Response: { "ok": true }

GET /graphify/status
Response:
{
  "python": { "ok": true, "version": "3.12.3", "bin": "python3.12" },
  "graphify": { "ok": true, "version": "0.9.1" },
  "llmwiki": { "ok": true, "file_count": 42 }
}
```

### 컴포넌트 트리

```
Settings.tsx
├── PathSetting.tsx        (경로 입력 + 폴더 선택 다이얼로그)
└── DiagnosticPanel.tsx    (설치 상태 진단)
    └── DiagnosticItem.tsx (항목별 상태 + 에러 메시지)
```

---

## 공통 컴포넌트

### StatusBadge
```typescript
type Status = 'indexed' | 'modified' | 'new'
// indexed → ✅, modified → 🟡, new → 🔴
```

### LogViewer
- SSE EventSource 연결
- 자동 스크롤 (하단 고정)
- 최대 1000줄 (초과 시 상단 제거)
- `type: error` 라인은 빨간색

---

## FastAPI 공통 규칙

- 모든 응답: `Content-Type: application/json`
- 에러 응답: `{ "error": "메시지" }` + 적절한 HTTP 상태코드
- SSE: `Content-Type: text/event-stream`
- 설정 저장 경로: `~/.natlas/config.json`

---

## 완료 기준 (Phase 1)

- [ ] Documents 탭 — 파일 목록 + 인덱싱 상태 표시
- [ ] Update 탭 — graphify --update 실행 + SSE 실시간 로그
- [ ] Settings 탭 — LLMWiki 경로 설정 + 설치 상태 진단
- [ ] 다크모드 기본 적용
- [ ] macOS 빌드 성공 (`npm run build:mac`)
