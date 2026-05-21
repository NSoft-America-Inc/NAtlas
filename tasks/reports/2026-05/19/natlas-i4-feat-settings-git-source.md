# 보고: Settings Git 소스 모드 추가 #4

## 완료된 작업
- [x] `src/renderer/src/lib/types.ts` 내 `Settings` 인터페이스에 `source_mode` 및 `git_repo_url` 타입 선언 추가
- [x] `src/renderer/src/lib/api.ts` 내 `api.cloneLLMWiki` API 매퍼 함수 추가 (FastAPI `/swarmvault/clone` SSE 엔드포인트 호출용)
- [x] `src/python/routers/settings.py` 내 `SettingsSchema` 및 `load_settings()`, `put_settings()` 수정하여 소스 모드 분기 처리 완료
- [x] `src/python/routers/swarmvault.py` 내 `POST /swarmvault/clone` SSE 스트리밍 라우터 엔드포인트 추가 (git clone/pull 수행 후 실시간 로그 스트리밍)
- [x] `src/renderer/src/pages/Settings.tsx` 내 Git Repository / Local Path 소스 토글 UI 추가, Git URL 입력 창 및 SSE 동기화 로그 뷰어 탑재
- [x] `npx tsc --noEmit`를 활용하여 컴파일 오류 0개 (무오류) 정적 분석 검증 완료
- [x] Git 커밋 완료 (`feat: Settings Git repo 기본 소스 모드 추가 #4`) 및 `feat/4-settings-git-source` 피처 브랜치에서 `main` 브랜치로 최종 병합 완료

## 생성/수정된 파일
| 파일 | 추가/수정 심볼 | 삭제 심볼 | 변경 줄 범위 |
|---|---|---|---|
| `src/renderer/src/lib/types.ts` | `source_mode`, `git_repo_url` 속성 | - | L28-31 |
| `src/renderer/src/lib/api.ts` | `cloneLLMWiki` | - | L45-47 |
| `src/python/routers/settings.py` | `GIT_MANAGED_DIR`, `source_mode`, `git_repo_url` | - | L13, L15-18, L21-31, L48-73 |
| `src/python/routers/swarmvault.py` | `GIT_MANAGED_DIR`, `load_settings_data`, `post_clone` | - | L8, L171-226 |
| `src/renderer/src/pages/Settings.tsx` | `sourceMode`, `gitRepoUrl`, `isCloning`, `cloneLogs`, `handleClone`, `handleSave` 모드별 분기, Git/Local 토글 및 폼 분기 UI, 로그 뷰어 | - | L17-20, L25-26, L39-44, L64-114, L152-243, L247-254 |

## 정적 분석 결과
```bash
$ npx tsc --noEmit
# (오류 없이 깨끗하게 성공하여 출력이 비어 있습니다.)
```

## 발견된 이슈
없음

## 미완료 항목
없음
