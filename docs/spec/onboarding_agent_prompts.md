# AI Agent Master Prompts for Specific Location Installation & Testing

본 문서는 사내 AI 에이전트인 **Antigravity**가 임직원의 로컬 머신(Windows / macOS)에서 특정 커스텀 디렉토리를 지정받아 NStack 및 NAtlas 환경을 **클린 복제 ➔ 자동 빌드 ➔ 격리 바인딩 확인 ➔ 임시 런타임 헬스체크 검증**까지 단 한번의 명령어로 스스로 완수할 수 있도록 설계된 에이전트 지시용 마스터 프롬프트 가이드입니다.

---

## 1. Windows용 에이전트 한방 설치 및 테스트 마스터 프롬프트

윈도우 환경에 진입한 `antigravity` 에이전트에게 아래 프롬프트 박스 안의 텍스트를 그대로 입력하거나 참조하여 작업을 수행하도록 명령하십시오.

```text
[Role: Onboarding & Robustness Validator (Windows OS)]

당신은 Windows 환경의 특정 물리 경로상에 NStack/NAtlas 클린 개발 환경을 이식하고 빌드 무결성을 검증하는 자동화 에이전트입니다.
사용자가 지정한 대상 설치 절대경로(예: C:\NAtlas-Test-Specific-Install\)에 대해 아래 명시된 4단계 실증 시퀀스를 단 한 번의 중단 없이 순차 수행하고 증적 로그를 보고해 주세요.

---

### Phase 1: Windows 클린 이식 환경 준비
1. 대상 디렉토리(예: C:\NAtlas-Test-Specific-Install\)가 존재하지 않는다면 신규 생성하십시오.
2. 현재 NAtlas 원본 디렉토리에서 heavy 모듈을 엄격히 격리 배제하고 핵심 코드만 복제하기 위해 `robocopy` 명령어를 다음과 같이 조립하여 기동하십시오:
   cmd /c "robocopy . "C:\NAtlas-Test-Specific-Install" /E /XD .git node_modules .venv out /XF package-lock.json"
   (참고: robocopy의 에러 코드가 1~3인 경우 성공적으로 파일이 복제된 것이므로 예외 오류로 판단하여 중단하지 마십시오.)

### Phase 2: OS-Agnostic 원클릭 통합 설치 기동
1. 작업 디렉토리 컨텍스트를 복제된 C:\NAtlas-Test-Specific-Install로 전환하십시오 (이후 명령어는 반드시 이 경로에서 구동되어야 합니다).
2. 윈도우 cmd/powershell 프로세스 스폰 호환성이 극대화된 통합 스크립트를 기동하십시오:
   cmd /c "python setup_natlas_env.py"
3. 출력되는 로그를 실시간 캡처하여 Node 의존성 복원 및 Python 가상환경(.venv)이 정상 완수되는지 확인하십시오.

### Phase 3: 가상환경 및 Git Hook 이식 격리성 검증
1. 복제된 폴더 내부의 파이썬 가상환경 pip 절대 경로가 원본을 침범하지 않고 격리 경로에 안착했는지 다음 명령어로 검증하십시오:
   cmd /c "src\python\.venv\Scripts\pip.exe --version"
   (출력 결과에 'C:\NAtlas-Test-Specific-Install\src\python\.venv'가 포함되어 있는지 대조하십시오.)
2. 생성된 `.git/hooks/pre-commit` 파일이 절대경로 하드코딩 없이 상대 호출 구조로 통제되고 있는지 내용을 검사해 명시하십시오.

### Phase 4: 임시 런타임 헬스체크 및 린터 완결 검사
1. 가상환경 내 사이드카 FastAPI 엔진이 새로운 격리 경로에서 충돌 없이 로컬 기동되는지 검증하기 위해 uvicorn을 백그라운드로 임시 스폰하십시오:
   cmd /c "src\python\.venv\Scripts\python.exe -m uvicorn src.python.main:app --port 18420 --host 127.0.0.1"
2. 잠시 대기(약 2초) 후 curl 혹은 powershell invoke를 통해 FastAPI의 헬스 엔드포인트를 호출하여 녹색 신호를 확인하십시오:
   cmd /c "curl -s http://localhost:18420/health"
3. 검증이 완료되면 해당 백그라운드 uvicorn 프로세스를 완전히 안전하게 kill하십시오:
   cmd /c "taskkill /IM python.exe /F"
4. 마지막으로 NStack E2E 지식 린터를 구동하여 아티팩트의 무결성 통과 여부를 검증하고 최종 결과를 사용자에게 표 형식으로 보고하십시오:
   cmd /c "python verify_nstack_pipeline.py --project natlas --task natlas-i24-test-install-specific-location"
```

---

## 2. macOS용 에이전트 한방 설치 및 테스트 마스터 프롬프트

macOS 환경에 진입한 `antigravity` 에이전트에게 아래 프롬프트 박스 안의 텍스트를 제공하여 실행하도록 명령하십시오.

```text
[Role: Onboarding & Robustness Validator (macOS/Darwin OS)]

당신은 macOS 환경의 특정 로컬 디렉토리 경로에 NStack/NAtlas 개발자 온보딩 스택을 클린 이식하고, 경로 동적 바인딩 및 런타임 유효성을 실증하는 에이전트입니다.
사용자가 지정한 대상 설치 절대경로(예: /Users/yg/workspace/NAtlas-Test-Specific-Install/)에 대해 아래 4단계 시퀀스를 에러 없이 수행하고 증적을 완결 서술해 주세요.

---

### Phase 1: macOS 클린 이식 환경 준비
1. 대상 디렉토리 `/Users/yg/workspace/NAtlas-Test-Specific-Install/`가 존재하지 않는다면 신규 생성하십시오.
2. 현재 프로젝트 경로에서 `.git`, `node_modules`, `.venv` 등 중량 의존성을 배제하고 rsync 복제를 수행하십시오:
   rsync -av --exclude='.git' --exclude='node_modules' --exclude='.venv' --exclude='out' --exclude='package-lock.json' ./ /Users/yg/workspace/NAtlas-Test-Specific-Install/

### Phase 2: 통합 셋업 스크립트 실행
1. 작업 디렉토리 컨텍스트를 복제된 `/Users/yg/workspace/NAtlas-Test-Specific-Install/`로 전환하십시오 (이후 명령어는 반드시 이 경로에서 기동되어야 합니다).
2. 통합 설치 및 자가 진단 스크립트를 기동하십시오:
   python3 setup_natlas_env.py
3. 6단계의 셋업 프로세스가 에러 0건으로 완수되는지 터미널 출력을 검사하십시오.

### Phase 3: 격리 이식성 및 경로 동적 바인딩 진단
1. 새로운 로컬 디렉토리 내에 독립 빌드된 pip 바이너리가 격리 환경을 정상 가리키는지 확인하십시오:
   ./src/python/.venv/bin/pip --version
   (출력 경로가 '/Users/yg/workspace/NAtlas-Test-Specific-Install/src/python/.venv/'를 내포하는지 대조하십시오.)
2. `.git/hooks/pre-commit` 파일이 절대경로 하드코딩 없이 이식된 터미널의 리포지토리 컨텍스트를 동적 상대 참조하는지 확인하십시오.

### Phase 4: 임시 런타임 헬스체크 및 린터 검증
1. 새로운 가상환경 내에서 FastAPI 사이드카 서버가 구동 가능한지 uvicorn을 백그라운드로 임시 스폰하십시오:
   ./src/python/.venv/bin/python3 -m uvicorn src.python.main:app --port 18420 --host 127.0.0.1 &
2. 잠시 대기(약 2초) 후 curl을 통해 FastAPI 헬스체크 엔드포인트를 질의하여 JSON 응답을 얻으십시오:
   curl -s http://localhost:18420/health
3. 검사 완료 후 백그라운드 uvicorn 프로세스를 완전히 중단하십시오:
   kill $(pgrep -f "uvicorn src.python.main:app")
4. 마지막으로 NStack E2E 지식 파이프라인 린팅 도구를 실행하여 마크다운 문서군 전체가 100% 녹색 배지를 받는지 입증하십시오:
   python3 verify_nstack_pipeline.py --project natlas --task natlas-i24-test-install-specific-location
```

---

## 3. 에이전트 온보딩 테스트 완료 기준 (Definition of Done)

Antigravity 에이전트는 위 프롬프트를 수행한 후, 사용자에게 반드시 아래 **4대 핵심 증적**을 서면으로 입증하여 완료를 선언해야 합니다.

| 검증 단계 | 검증 대상 | 확인 사항 | 확인 방법 / 로그 형식 |
| :--- | :--- | :--- | :--- |
| **Phase 1** | 복제 격리성 | `node_modules` 및 `.venv` 배제 | 복제 직후 대상 폴더 디렉토리 리스트 출력 검사 |
| **Phase 2** | 빌드 강건성 | 셋업 완료 메시지 | `setup_natlas_env.py` 구동 최종 빌드 성공 시그널 획득 |
| **Phase 3** | 경로 캡슐화 | virtualenv 격리 무결성 | `pip --version` 기동 시 테스트 대상 절대경로 노출 |
| **Phase 4** | 런타임 헬스 | FastAPI 런타임 + NStack 린팅 | `/health` API 정상 및 린터 최종 통과(Green Badge) |

> [!CAUTION]
> **주의사항 (포트 충돌 경고)**: 
> 실증 가동(Phase 4) 중에 uvicorn 백그라운드 프로세스가 기동될 때, 만약 로컬 머신에서 구 원본 디렉토리의 NAtlas 앱이 띄워져 있다면 포트 `18420` 점유 충돌이 발생해 스폰에 실패합니다. 반드시 기존에 떠 있는 NAtlas 앱이나 uvicorn sidecar 인스턴스를 완전히 안전하게 강제 종료(taskkill / kill)한 상태에서 독립적인 실증 검증을 수행하도록 지시하십시오.
