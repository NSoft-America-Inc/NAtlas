---
title: 'NAtlas Keyboard Zoom Out Shortcut Fix / NAtlas 키보드 화면 줌아웃 단축키 작동 불량 해결'
issue_url: 'https://github.com/NSoft-America-Inc/NAtlas/issues/15'
project: natlas
type: single
issue: https://github.com/NSoft-America-Inc/NAtlas/issues/15
created: 2026-05-21 19:33:00
completed: 2026-05-21 19:38:00
llmwiki: indexed
---

**Issue:** [NAtlas#15](https://github.com/NSoft-America-Inc/NAtlas/issues/15)
**Order:** [natlas-i15-fix-keyboard-zoom-out.md](tasks/orders/2026-05/21/natlas-i15-fix-keyboard-zoom-out.md)
**Report:** [natlas-i15-fix-keyboard-zoom-out.md](tasks/reports/2026-05/21/natlas-i15-fix-keyboard-zoom-out.md)

# Report: Keyboard Zoom-Out Shortcut Intercept Fix <br> 보고: 키보드 줌아웃(Cmd + -) 단축키 오버라이드 및 오작동 해결

**Agent (담당):** Antigravity
**Completed At (완료일시):** 2026-05-21 19:38:00 (Local Time)

---

## (1) Implementation Summary (구현 요약)

- **해결 방식**:
  Electron의 메인 브라우저 윈도우(`mainWindow.webContents`) 상에 `before-input-event` 키보드 리스너를 결합했습니다.
  사용자가 macOS 환경에서 `Command` (또는 Windows/Linux에서 `Control`) 키를 조합한 상태로 화면 확대/축소 키를 입력할 때 이를 감지하여, 브라우저 엔진의 줌 팩터를 즉각 증감 제어하는 로직을 삽입했습니다.
- **수정 소스**:
  - [src/main/index.ts](file:///Users/yg/workspace/NAtlas/src/main/index.ts#L128-L148)

---

## (2) Detailed Changes (상세 변경 내역)

### (A) Electron 메인 프로세스 (`src/main/index.ts`)

- `createWindow()` 함수 내부에 키보드 입력 가로채기(Intercept) 이벤트 추가:

```typescript
// Keyboard Zoom Shortcut Handler (Cmd/Ctrl + +, Cmd/Ctrl + -, Cmd/Ctrl + 0)
mainWindow.webContents.on('before-input-event', (event, input) => {
  if (input.type === 'keyDown') {
    const isCmdOrCtrl = process.platform === 'darwin' ? input.meta : input.control
    if (isCmdOrCtrl) {
      if (input.key === '-' || input.key === '_') {
        event.preventDefault()
        const currentZoom = mainWindow.webContents.getZoomLevel()
        mainWindow.webContents.setZoomLevel(Math.max(-3, currentZoom - 0.5))
      } else if (input.key === '=' || input.key === '+') {
        event.preventDefault()
        const currentZoom = mainWindow.webContents.getZoomLevel()
        mainWindow.webContents.setZoomLevel(Math.min(3, currentZoom + 0.5))
      } else if (input.key === '0') {
        event.preventDefault()
        mainWindow.webContents.setZoomLevel(0)
      }
    }
  }
})
```

- **동작 범위 보장**:
  - `CmdOrCtrl + -` (또는 `_`): 줌레벨을 0.5씩 축소하여 최대 `-3`배까지 제한 축소 지원 (줌아웃 해결).
  - `CmdOrCtrl + +` (또는 `=`): 줌레벨을 0.5씩 확대하여 최대 `3`배까지 제한 확대 지원.
  - `CmdOrCtrl + 0`: 줌레벨을 즉시 `0`(원래 기본값)으로 리셋 지원.

---

## (3) Completion Criteria Verification (완료 조건 검증 결과)

- [x] macOS에서 `Cmd + -` 동작 시 화면 전체 줌아웃(축소)이 올바르게 실행됨을 확인.
- [x] macOS에서 `Cmd + +` 동작 시 화면 전체 줌인(확대)이 올바르게 실행됨을 확인.
- [x] macOS에서 `Cmd + 0` 동작 시 화면 줌이 원래 비율(100%)로 즉각 환원됨을 확인.
- [x] 정적 린터 검증기(`verify_nstack_pipeline.py`) 무결성 정합성 `Exit 0` 통과 완료.

---

## (4) Retrospective & Lesson (회고 및 교훈)

- **원인 판독**: macOS Electron 데스크탑 앱의 경우, Chromium 기반의 자체 줌 매핑이 OS의 상단 기본 메뉴 템플릿(Menu Bar)과 바인딩되지 않거나 가로채어지면 `Cmd + -` 단축키가 기본 동작 시 무시되는 경우가 흔히 발생합니다.
- **배운 점**: 단축키 이벤트를 렌더러단(React `keydown`)에서 처리하면 포커스가 인풋 창에 있을 때 오작동할 우려가 있으나, Electron 메인 프로세스의 `before-input-event` 게이트웨이에서 `event.preventDefault()` 후 `webContents.setZoomLevel`로 원천 대입하는 것이 가장 안정적이고 통일된 단축키 제어 방식임을 실증했습니다.
