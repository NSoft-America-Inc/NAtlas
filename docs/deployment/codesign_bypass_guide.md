# NAtlas 데스크탑 앱 사내 배포 코드서명 예외 처리 가이드 <br> NAtlas Deployment: Code Signing Bypass Guide

NAtlas 데스크탑 지식 탐색기 앱을 사내 인트라넷망을 통해 배포할 때, OS(macOS, Windows) 보안 아키텍처에 의해 비인가 개발자 앱으로 분류되어 차단되는 경고(Gatekeeper, Defender SmartScreen)를 극복하기 위한 공식 기술 우회 가이드라인 및 IT 관리자용 중앙 배포 정책 매뉴얼입니다.

---

## 🍎 1. macOS Gatekeeper 격리(Quarantine) 우회 가이드

macOS는 Apple의 공식 공인 인증서 서명 및 공증(Notarization)을 거치지 않은 `.dmg` 또는 `.app` 파일의 기동을 차단합니다. 아래의 두 가지 수준에 맞추어 우회를 적용합니다.

### ① 일반 사용자용: GUI 임시 실행 허용
1. `Finder`에서 설치된 `NAtlas.app`(혹은 다운로드한 설치 파일)을 찾습니다.
2. 앱 아이콘을 **단순 더블 클릭하지 말고**, `Control(⌃)` 키를 누른 상태에서 앱을 클릭하여 단축 메뉴를 엽니다.
3. 메뉴에서 **[열기]**를 클릭합니다.
4. "개발자를 확인할 수 없습니다" 경고 팝업이 나타나면, 기존과 다르게 팝업 하단에 활성화된 **[열기]** 버튼을 눌러 앱을 임시로 실행시킵니다.
5. 이후에는 매번 경고창이 나타나지 않고 더블 클릭으로 상시 기동이 가능합니다.

### ② 개발자 및 파워 유저용: Quarantined 격리 속성 강제 해제 (터미널)
macOS가 다운로드한 파일에 부여하는 `com.apple.quarantine` 격리 태그를 터미널 명령어를 통해 제거하여, 완벽한 정상 앱처럼 작동시키는 방식입니다.
1. `터미널.app`을 실행합니다.
2. 아래의 명령어를 입력하여 앱의 격리 태그를 완전히 제거합니다.
   ```bash
   xattr -cr /Applications/NAtlas.app
   ```
3. 태그 제거 즉시 Gatekeeper 검증을 무사 통과하여 정상 실행됩니다.

### ③ Apple Silicon (M1/M2/M3) 환경의 아키텍처 예외 처리
애플 실리콘 칩셋 환경에서는 코드서명이 깨지거나 없는 바이너리의 강제 격리 해제 시 기동 즉시 앱이 비정상 종료(Crash)되는 경우가 발생할 수 있습니다. 이 경우, 임시 ad-hoc(Self-signed) 서명을 로컬에서 즉석 갱신해야 합니다.
1. 터미널을 열고 다음 명령을 실행하여 ad-hoc 재서명을 적용합니다.
   ```bash
   codesign --force --deep --sign - /Applications/NAtlas.app
   ```
2. 서명이 갱신되면 정상적으로 앱이 로드됩니다.

---

## 🌐 2. Windows Defender SmartScreen 및 사설 CA 일괄 배포

Windows는 알 수 없는 게시자(Publisher)가 작성한 신규 `.exe` 파일을 다운로드 및 설치할 때 SmartScreen 파란색 보호 경고창을 표시합니다.

### ① 일반 사용자용: GUI SmartScreen 우회 실행
1. NAtlas 설치 프로그램(`NAtlas Setup.exe`)을 실행할 때 파란색 SmartScreen 안내 창이 뜨면 당황하지 마십시오.
2. 본문 텍스트 내에 작게 표시된 **[추가 정보]** 링크를 클릭합니다.
3. 링크를 클릭하면 창 우측 하단에 숨겨진 **[실행]** 버튼이 나타납니다.
4. **[실행]** 버튼을 눌러 설치를 끝마칩니다.

### ② IT 인프라 부서용: GPO(그룹 정책) 기반 사설 CA 인증서 일괄 배포 정책
임직원들의 개별적인 수동 우회 번거로움을 원천 제거하기 위해, 사내 Windows AD(Active Directory) 도메인 컨트롤러 및 그룹 정책을 활용해 **사내 사설 CA(자체 서명) 루트 인증서(.cer)를 전사 임직원 PC에 배포하는 방식**입니다.

1. **자체 서명 루트 인증서 파일 준비**:
   사내 빌드 머신에서 NAtlas 릴리스 패키징 시 사용한 자체 서명 코드서명용 루트 CA 인증서 파일(`NSoftRootCA.cer`)을 준비합니다.
2. **그룹 정책 관리 콘솔(GPMC) 진입**:
   도메인 컨트롤러 서버에서 `gpmc.msc`를 실행합니다.
3. **새 GPO 생성 및 편집**:
   * "NAtlas 코드서명 인증서 배포"라는 이름의 새로운 그룹 정책 객체(GPO)를 생성하고 [편집]을 누릅니다.
4. **인증서 주입 정책 경로 구성**:
   * 그룹 정책 관리 편집기에서 다음의 경로로 이동합니다.
     > `컴퓨터 구성(Computer Configuration)` ➜ `정책(Policies)` ➜ `Windows 설정(Windows Settings)` ➜ `보안 설정(Security Settings)` ➜ `공개 키 정책(Public Key Policies)` ➜ `신뢰할 수 있는 루트 인증 기관(Trusted Root Certification Authorities)`
5. **인증서 가져오기(Import)**:
   * 마우스 우클릭 후 **[가져오기]**를 클릭합니다.
   * 미리 준비해 둔 `NSoftRootCA.cer` 파일을 지정하여 등록을 완료합니다.
6. **전사 배포 동기화 강제 적용**:
   * GPO가 전사 OU(조직 구성 단위) 내 임직원 PC에 적용되는 즉시, 모든 직원 PC의 윈도우 OS가 NAtlas 바이너리를 **"안전하고 신뢰할 수 있는 게시자"로 취급**하여 SmartScreen 파란색 차단 경고가 영구적으로 사라집니다.

---

> [!NOTE]
> **보안 권고 사양 (Security Notice)**
> 사설 자체 서명 인증서와 GPO 배포 방식은 반드시 **사내 폐쇄망 및 AD 도메인 내부에서만 승인 및 운영**해야 합니다. 외부 유출 시 악의적인 바이너리가 사내망 내에서 인증된 것처럼 위장 기동될 수 있으므로, 인증서 개인키(.pfx) 관리에 철저한 보안 통제를 적용하십시오.
