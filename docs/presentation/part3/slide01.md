---
title: "Slide 21: 훅 자동화 - setup_nstack_hooks.py 및 package.json 연동"
layout: "Git Hook Chain"
part: "PART 3: NStack Linter & Healer 동작 원리 및 듀얼 트랙 흐름"
---

# Slide 21: 훅 자동화 - setup_nstack_hooks.py 및 package.json 연동

## 1. 화면 정의 및 레이아웃 (Layout Specification)

- **레이아웃 구조**: 개발자의 수동 셋업 오버헤드를 제로화하고 패키지 생명주기와 Git 형상 관리를 동기화하는 **Git 훅 체인 레이아웃 (Git Hook Chain Layout)**.
- **비주얼 및 컴포넌트 구성**:
  - **좌측 비주얼**: `package.json`의 `"postinstall"` 생명주기 블록과 `.git/hooks/pre-commit` 트리거가 골드 및 사파이어 네온 기어 톱니바퀴로 서로 맞물려 돌아가며, 개발자가 `git commit`을 날릴 때 `verify_nstack_pipeline.py`로 신호가 전달되어 초록색의 안전 체크 마크가 점등되는 동적 메커니즘 SVG 구현.
  - 훅 설치 완료 및 동작 성공 표시인 **⚓ HOOK SECURED & BOUND (postinstall)** 라벨 탑재.

## 2. 실질적 본문 내용 (Exact Slide Content)

### ⚙️ 개발자가 인지하지 못하는 사이, 시스템에 깊숙이 이식되는 무결성 파수꾼

전사 수준에서 지식의 무결성을 통제하기 위해 개발자 개개인에게 "매번 커밋 전에 수동으로 검증 스크립트를 실행해 달라"고 요청하는 것은 실효성이 매우 낮습니다. 규칙은 개발자의 선의나 수동 체크에 의존해서는 안 되며, 개발 흐름 자체에 완전하게 녹아들어 무의식적으로 강제되어야 합니다. NStack은 이를 패키지 설치 시점에 자동으로 시스템에 심는 **이중 훅 결합 아키텍처**를 완비하였습니다.

- **📦 생명주기 자동 결합 [npm postinstall hook]**:
  - `package.json`의 script 블록에 `"postinstall": "python3 setup_nstack_hooks.py"`를 영구 등록하였습니다.
  - 이에 따라 개발자가 최초 레포지토리 클론 후 `npm install`을 호출하는 즉시, 백그라운드에서 셋업 스크립트가 기동됩니다.
- **🛡️ setup_nstack_hooks.py 자동화 메커니즘**:
  - OS(macOS, Linux, Windows 등)를 지능적으로 감지하고, Git의 내부 트리거 영역인 `.git/hooks/` 폴더 내부에 `pre-commit` 실행 파일을 원자적으로 복사합니다.
  - 실행을 막는 OS 권한 충돌 문제를 피하기 위해, Unix 계열 환경에서는 **`chmod +x`** 권한 부여까지 한 번에 완료합니다.
  - 커밋 시점에 린터의 무결성 통과 여부를 검증하고, 만일 위반 시 커밋 자체를 즉각 중단시켜 오류가 코드베이스에 섞이는 것을 차단합니다.

## 3. 스피치 노트 (Aside Speaker Notes)

*"우리가 아무리 '지식을 성실하게 적어 달라'고 요청해도, 현업 엔지니어들이 바쁘게 코딩하다 보면 까먹고 마크다운 파일만 대충 빈 껍데기로 커밋하기 마련입니다. 규칙은 사람의 기억력이나 선의에 의존하면 반드시 구멍이 납니다. 그래서 NStack은 개발자가 레포지토리를 클론하고 `npm install`을 날리는 시점에 로컬 Git pre-commit 훅이 무조건 백그라운드에서 100% 자동 설치되도록 패키지 생명주기에 결합시켰습니다. `setup_nstack_hooks.py`는 윈도우와 맥, 리눅스 OS를 자동 식별하여 `.git/hooks` 폴더 안에 실행 권한을 완비한 훅 스크립트를 심어 놓습니다. 이제 개발자는 평소처럼 `git commit`을 날리기만 하면 됩니다. 린터가 커밋 0.1초 전에 뒷덜미를 낚아채어 오작동과 플레이스홀더 누락을 자동 정밀 검사합니다. 통과하지 못하면 아예 커밋 자체가 샌드박스에서 거부되어 형상 관리 서버에 발도 못 붙이게 철벽 통제됩니다."*
