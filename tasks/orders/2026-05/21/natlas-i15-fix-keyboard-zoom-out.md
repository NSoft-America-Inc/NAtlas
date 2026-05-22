---
title: "NAtlas Keyboard Zoom Out Shortcut Fix / NAtlas 키보드 화면 줌아웃 단축키 작동 불량 해결"
issue_url: "https://github.com/NSoft-America-Inc/NAtlas/issues/15"
project: natlas
type: single
issue: https://github.com/NSoft-America-Inc/NAtlas/issues/15
created: 2026-05-21 19:33:00
completed: -
llmwiki: -
---

**Issue:** [NAtlas#15](https://github.com/NSoft-America-Inc/NAtlas/issues/15)
**Order:** [natlas-i15-fix-keyboard-zoom-out.md](tasks/orders/2026-05/21/natlas-i15-fix-keyboard-zoom-out.md)
**Report:** [natlas-i15-fix-keyboard-zoom-out.md](tasks/reports/2026-05/21/natlas-i15-fix-keyboard-zoom-out.md)

# Task: Keyboard Zoom-Out Shortcut Intercept Fix <br> 작업: 키보드 줌아웃(Cmd + -) 단축키 오버라이드 및 오작동 해결

**Agent (담당):** Antigravity
**Created At (생성일시):** 2026-05-21 19:33:00 (Local Time)

---

## (1) Git Setup (Git 작업)

```bash
git checkout main && git pull origin main
git checkout -b fix/15-keyboard-zoom-out
```

---

## (2) Context & Goal (배경 및 목표)

* **배경 (Context)**: 
  NAtlas 데스크탑 앱 내에서 키보드 단축키 `Cmd + +` (또는 `Cmd + =`)를 사용할 때는 화면 비율 확대(Zoom in)가 정상 작동하는 반면, `Cmd + -` 단축키를 눌렀을 때 화면 비율 축소(Zoom out)가 정상 작동하지 않아 사용자 인터페이스의 텍스트가 거대해진 후 축소되지 않는 치명적인 UX 사용성 제한이 발생했습니다.
* **목표 (Goal)**: 
  Electron 메인 프로세스(`src/main/index.ts`)의 `before-input-event` API를 가로채어(Intercept), 플랫폼(macOS/Windows)에 구애받지 않고 `Cmd/Ctrl + -`, `Cmd/Ctrl + +`, 그리고 줌 리셋인 `Cmd/Ctrl + 0` 단축키가 100% 신뢰할 수 있게 오버라이드 작동하도록 코드를 보강합니다.

---

## (3) Implementation Detail (구현 상세)

### (A) Electron 메인 프로세스 단축키 가로채기 보강
* **대상 파일**: [index.ts](file:///Users/yg/workspace/NAtlas/src/main/index.ts)
* **세부 조치**:
  - `createWindow()` 함수 내부에 `mainWindow.webContents.on('before-input-event', (event, input) => { ... })` 이벤트 리스너를 삽입합니다.
  - 사용자가 `keyDown` 시점에 macOS의 `meta` 키 또는 Windows의 `control` 키를 조합한 상태로 `-`, `=`, `+`, `0` 키를 누르는지 정밀 판정합니다.
  - 마이너스(`-`) 판정 시 `event.preventDefault()` 후 `webContents.getZoomLevel()`을 0.5 감쇄하여 줌아웃을 동작시킵니다.
  - 플러스(`+`, `=`) 판정 시 `event.preventDefault()` 후 `getZoomLevel()`을 0.5 가산하여 줌인을 동작시킵니다.
  - 리셋(`0`) 판정 시 `event.preventDefault()` 후 `setZoomLevel(0)`을 수행하여 기본 100% 비율로 환원시킵니다.

---

## (4) Completion Criteria (완료 조건)

- [ ] macOS에서 `Cmd + -` 동작 시 화면 전체 줌아웃(축소)이 올바르게 실행될 것.
- [ ] macOS에서 `Cmd + +` 또는 `Cmd + =` 동작 시 화면 전체 줌인(확대)이 올바르게 실행될 것.
- [ ] macOS에서 `Cmd + 0` 동작 시 화면 줌이 100%(원래 비율)로 강제 복원될 것.
- [ ] 정적 린터 검증기(`verify_nstack_pipeline.py`) 및 `pre-commit` 린트가 무결성 정합성 `Exit 0`으로 통과할 것.
- [ ] `report.md`, `wiki.md` 3종 아티팩트를 LLMWiki 아카이브 및 로컬 `tasks/` 아래 정밀 배치 완료할 것.

---

## (5) Verification Plan (검증 계획)

### 수동 테스트
* Electron 개발 앱을 재시작한 후, 화면 비율을 단축키를 통해 다각도로 제어하여(Zoom in 3회 ➔ Zoom out 3회 ➔ Reset 1회) 렌더러 줌 팩터가 정상 가변되는지 육안으로 확인.
