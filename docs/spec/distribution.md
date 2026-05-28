# NStack & NAtlas macOS/Windows 전사 배포 및 보안 우회 온보딩 명세서

본 명세서는 NSoft America의 전사 지식 탐색기 **NAtlas**와 **NStack** E2E 지식 파이프라인을 사내 개발자 및 일반 임직원들이 **Windows**와 **macOS** 양대 운영체제 환경에서 마찰 없이 안전하게 설치하고 운용할 수 있도록 배포 파이프라인 및 보안 정책 우회 절차를 수립합니다.

---

## 1. 개요 (Overview)

NStack 및 NAtlas는 사내 내부 전용 업무 효율화 솔루션으로서, 외부의 공개 배포 채널을 사용하지 않고 사내망을 통해 자체적으로 패키지를 배포합니다.
* **개발자 환경**: 로컬 머신 사양 및 운영체제에 상관없이 일관된 버전의 Node.js, Python 가상환경, 글로벌 SwarmVault CLI, Git hook 정합성 도구를 원클릭으로 정렬해야 하는 과제가 있습니다.
* **임직원 런타임 환경**: 사내 전용 도구의 특성상 수만 달러 상당의 공인 코드 서명(Apple Developer ID / Windows Codesign Certificate)을 생략한 채 배포하므로, 각 OS의 무서명 앱 차단 시스템(Apple Gatekeeper 및 MS SmartScreen)을 우아하게 우회하고 안심하고 실행할 수 있는 정밀 표준 가이드가 필수적입니다.

---

## 2. 개발자 속성 온보딩 가이드 (Developer Onboarding)

개발 환경을 복원하고 빌드를 완료하는 전체 과정이 단 하나의 통합 셋업 스크립트로 자동화되어 제공됩니다.

### 2.1 사전 준비 사항 (Prerequisites)
로컬 터미널에서 다음 3가지 핵심 런타임이 기동 중이어야 합니다:
* **Git** (CLI 환경 기동)
* **Node.js** (v18 이상 및 npm 패키지 매니저)
* **Python** (v3.10 이상)

### 2.2 원클릭 환경 구축 스크립트 실행
프로젝트 루트 폴더로 이동한 후, 로컬 쉘에서 다음 명령어를 수행합니다:

```bash
# macOS 및 Linux 환경
python3 setup_natlas_env.py

# Windows PowerShell 및 CMD 환경
python setup_natlas_env.py
```

> [!NOTE]
> **스크립트가 자동으로 완수하는 주요 작업 목록:**
> 1. **OS-Agnostic 시스템 진단**: `sys.platform`을 통한 양대 OS 유형 판독 및 `pathlib.Path` 기반의 안전한 경로 연산.
> 2. **Node.js 의존성 복원**: Windows의 `npm.cmd` 프로세스 충돌 방지를 위한 쉘 래핑 및 `npm install` 수행.
> 3. **Python 격리 가상환경(.venv) 구축**: `src/python` 산하에 `.venv`를 생성하고, OS별로 적절한 바이너리 경로(Windows의 `Scripts/pip.exe` vs macOS의 `bin/pip`)를 분기하여 `pip install -r requirements.txt` 패키지 복원.
> 4. **SwarmVault CLI Fail-Safe 복구**: 글로벌 권한 차단(`EACCES`) 감지 시, 즉시 프로젝트 로컬 개발 의존성(`npm install -D @swarmvaultai/cli`)으로 자동 복구 설치.
> 5. **Git Hook 바인딩**: `setup_nstack_hooks.py`를 연동하여 pre-commit hook에 지식 무결성 정합성 린터(`verify_nstack_pipeline.py`) 바인딩.

### 2.3 로컬 개발 서버 구동
셋업 완료 후 다음 명령어를 통해 백엔드 FastAPI 사이드카 서버(포트: `18420`)와 Electron 데스크탑 앱을 동시에 구동할 수 있습니다:
```bash
npm run dev
```

---

## 3. 임직원 배포용 데스크탑 앱 패키징 (Desktop App Packaging)

`electron-builder` 설정을 기반으로 임직원에게 직접 배포할 바이너리를 컴파일합니다.

### 3.1 OS별 빌드 스크립트 트리거
개발을 마친 후 각 플랫폼 환경에 맞게 아래 컴파일 빌드를 호출합니다.

```bash
# macOS 배포 패키지 (.dmg 및 .zip 아카이브 생성)
npm run build:mac

# Windows 배포 패키지 (.exe NSIS 설치 유틸리티 생성)
npm run build:win
```

### 3.2 Sidecar 번들링 및 asarUnpack 구조
NAtlas는 핵심 RAG 연산과 FastAPI 구동을 위해 Python 프로세스를 sidecar로 탑재합니다. `electron-builder.yml`에서는 이를 위해 `asarUnpack` 규칙을 준수하여 플랫폼 독립적인 이식성을 획득합니다:
* **asarUnpack 설정**: 
  ```yaml
  asarUnpack:
    - resources/**
  ```
* **동작 원리**: Electron이 가동될 때 `app.asar.unpacked/resources` 디렉토리에 Python sidecar 코드 및 가상환경 라이브러리가 그대로 압축 해제되며, `main/index.ts`에서 이를 감지하여 서브프로세스로 안전하게 spawn합니다.

---

## 4. 양대 OS 보안 정책 우회 실행 가이드 (OS Security Bypass)

코드 서명이 없으므로 설치 및 최초 실행 시 경고 창이 발생합니다. 각 OS별로 다음과 같이 안전하게 우회하여 실행할 수 있습니다.

### 4.1 macOS 환경 (Apple Gatekeeper 및 Quarantine 해제)

macOS에 다운로드된 배포 패키지는 격리 속성(Quarantine Flag)이 지정되어 실행이 전면 차단되거나 깨진 파일로 오인받을 수 있습니다.

#### 방법 A: 터미널 명령어를 통한 전격 해제 (권장)
앱을 `/Applications` (응용 프로그램) 디렉토리로 이동시킨 후 터미널을 열고 다음 명령어를 1회 수행합니다:

```bash
xattr -cr /Applications/NAtlas.app
```
* **설명**: `xattr -cr` 명령어는 다운로드된 바이너리에 강제 바인딩된 격리 태그(`com.apple.quarantine`)를 깨끗하게 소거하여 애플의 코드 서명 검증 관문을 프리패스하도록 해줍니다.

#### 방법 B: 시스템 설정 마우스 클릭 통과
1. 최초 실행 시 `"확인할 수 없는 개발자가 만든 앱이므로 열 수 없습니다"` 팝업이 출력되면 **[확인]**을 누릅니다.
2. macOS **시스템 환경설정 ➔ 개인정보 보호 및 보안** 탭으로 이동합니다.
3. 스크롤을 하단으로 내려 **"안전하지 않은 앱"** 영역에서 `NAtlas.app이(가) 차단되었습니다` 메시지를 확인하고 옆에 있는 **[확인 없이 열기]** 버튼을 클릭합니다.
4. 사용자 인증(Touch ID 또는 비밀번호)을 수행한 뒤 나오는 확인 창에서 **[열기]**를 선택하면 가동됩니다.

---

### 4.2 Windows 환경 (Microsoft SmartScreen 통과)

윈도우 환경에서는 사내 배포 빌드 실행 시 스마트스크린 필터가 미인증 설치 파일로 식별하여 가동을 차단합니다.

#### 실행 허용 절차
1. NAtlas 설치 패키지(`natlas-1.0.0-setup.exe`)를 실행할 때 `"Windows의 PC 보호 - Microsoft Defender SmartScreen에서 인식되지 않는 앱의 시작을 차단했습니다."` 파란색 팝업 알림창이 뜹니다.
2. 팝업 창 본문 내부에 조그맣게 기재된 **[추가 정보]** (More info) 텍스트 링크를 마우스로 클릭합니다.
3. 링크를 클릭하면 하단에 가려져 있던 **[실행]** (Run anyway) 버튼이 활성화됩니다.
4. **[실행]** 버튼을 클릭하면 차단이 전격 해제되고 윈도우 NSIS 데스크탑 바로가기 생성 및 설치 시퀀스가 에러 없이 시작됩니다.

---

## 5. 전사 지식 기여 파이프라인 연동 가이드

환경 설정이 완료된 후 NStack의 E2E 지식 파이프라인에 기여하는 시나리오를 수립합니다.

### 5.1 NAtlas Settings 탭 설정
1. 가동된 NAtlas UI의 좌측 사이드바 하단에서 **Settings** 탭으로 진입합니다.
2. **LLMWiki Root Path** 설정 필드에서 사내 지식 저장소인 `NSoft-LLMWiki` 로컬 레포지토리의 절대 경로를 기입하고 **[Save Settings]**를 클릭합니다.

### 5.2 지식 기여 시나리오 (NStack Workflow)
모든 개발자가 코드를 커밋하고 PR을 발행할 때 다음 단계를 준수해야 정합성 관문을 통과할 수 있습니다:
1. **작업지시서 작성**: 태스크 슬러그 디렉토리 생성 후 `order.md`를 규격 양식에 맞추어 작성하고 승인을 받습니다.
2. **코드 구현 및 테스트**: 코딩 작업을 마치고 로컬 컴파일 성공을 달성합니다.
3. **완료보고서 및 위키 기록**: 해당 폴더에 `report.md` 및 `wiki.md`에 기술 결정 사항과 아키텍처 의사결정을 누락 없이 상세 기술합니다.
4. **로컬 무결성 린터 실행**: 커밋 직전에 자가 검증을 최종 확인합니다:
   ```bash
   python3 verify_nstack_pipeline.py --project natlas --task {task_slug}
   ```
5. **Git 커밋**: pre-commit Hook이 스테이징된 문서의 양식 준수 여부를 자동으로 가로채어 최종 검증하며, 통과 시 원격 레포지토리에 안전하게 지식이 합산(Assetization)됩니다.
