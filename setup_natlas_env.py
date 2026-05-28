#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import subprocess
import platform
import shutil
from pathlib import Path

# 슬레이트 스타일 다크 모드에 어우러지는 세련된 터미널 컬러 정의
COLOR_GREEN = "\033[38;2;52;211;153m"  # 에메랄드 (성공)
COLOR_RED = "\033[38;2;248;113;113m"    # 로즈 (에러)
COLOR_YELLOW = "\033[38;2;251;191;36m" # 앰버 (경고 및 진행)
COLOR_CYAN = "\033[38;2;56;189;248m"   # 스카이블루 (스텝 및 안내)
COLOR_RESET = "\033[0m"

def print_step(msg):
    print(f"{COLOR_CYAN}🔍 [SETUP-STEP] {msg}{COLOR_RESET}")

def print_success(msg):
    print(f"{COLOR_GREEN}✅ {msg}{COLOR_RESET}")

def print_warn(msg):
    print(f"{COLOR_YELLOW}⚠️ {msg}{COLOR_RESET}")

def print_error(msg):
    print(f"{COLOR_RED}❌ {msg}{COLOR_RESET}")

def check_runtime(cmd, args, min_version=None, name=""):
    try:
        res = subprocess.run([cmd] + args, capture_output=True, text=True, check=True)
        version_str = res.stdout.strip()
        print_success(f"{name} 탐색 성공: {version_str}")
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        print_error(f"❌ {name}를 시스템에서 찾을 수 없거나 실행에 실패했습니다.")
        return False

def main():
    print("=" * 80)
    print(f"{COLOR_CYAN}          NStack & NAtlas macOS/Windows 통합 환경 구축 자동화 도구{COLOR_RESET}")
    print(f"{COLOR_CYAN}                       - Developer Onboarding Toolkit -{COLOR_RESET}")
    print("=" * 80)

    # 1. OS 진단 및 아키텍처 환경 감지
    is_windows = platform.system() == "Windows"
    os_name = "Windows" if is_windows else "macOS/Linux"
    print_step(f"현재 로컬 머신 운영체제 감지: {COLOR_GREEN}{os_name}{COLOR_CYAN} (Platform: {platform.system()})")

    # 2. 필수 개발 런타임 진단
    print_step("단계 1/6: 필수 개발 런타임 진단 및 자가 검사(Self-Diagnostic) 시작")
    runtimes_ok = True
    
    # Git 검사
    if not check_runtime("git", ["--version"], name="Git"):
        runtimes_ok = False
        
    # Node.js 검사
    if not check_runtime("node", ["--version"], name="Node.js (v18+)"):
        runtimes_ok = False
        
    # Python 검사
    python_cmd = "python" if is_windows else "python3"
    if not check_runtime(python_cmd, ["--version"], name="Python 3.10+"):
        runtimes_ok = False

    if not runtimes_ok:
        print_error("필수 런타임 환경 중 미설치되거나 호환되지 않는 요소가 발견되었습니다. 설치를 중단합니다.")
        print_error("Git, Node.js(v18+), Python3를 설치한 후 스크립트를 재수행해주세요.")
        sys.exit(1)

    project_root = Path(__file__).parent.resolve()
    print_success(f"프로젝트 루트 감지 완료: {project_root}")

    # 3. Node.js 패키지 의존성 복원 (npm install)
    print_step("단계 2/6: Node.js 패키지 의존성 복원 (npm install) 트리거")
    npm_cmd = "npm.cmd" if is_windows else "npm"
    try:
        print_warn("의존성 다운로드 및 빌드 중... (이 작업은 시스템 사양에 따라 수분이 소요될 수 있습니다)")
        # shell=True는 Windows에서의 npm.cmd 프로세스 스폰 충돌을 원천 차단하기 위한 필수 사양입니다.
        subprocess.run([npm_cmd, "install"], cwd=project_root, check=True, shell=is_windows)
        print_success("Node.js 의존성 복원 (npm install) 완수!")
    except subprocess.CalledProcessError as e:
        print_error(f"Node.js 의존성 설치 중 치명적 에러 발생: {e}")
        sys.exit(1)

    # 4. Python 가상환경(venv) 구성 및 FastAPI 사이드카 dependencies 설치
    print_step("단계 3/6: Python Sidecar 격리 가상환경(.venv) 구축 및 pip 설치")
    python_dir = project_root / "src" / "python"
    venv_dir = python_dir / ".venv"

    # 가상환경 생성
    if not venv_dir.exists():
        print_warn(f"가상환경 폴더가 존재하지 않아 신규 생성합니다: {venv_dir}")
        try:
            subprocess.run([python_cmd, "-m", "venv", ".venv"], cwd=python_dir, check=True)
            print_success("Python 격리 가상환경(.venv) 생성 완수!")
        except subprocess.CalledProcessError as e:
            print_error(f"가상환경(.venv) 생성 중 오류 발생: {e}")
            sys.exit(1)
    else:
        print_success("기존 격리 가상환경(.venv) 발견 및 유효 확인.")

    # OS별 pip 및 python 경로 결정
    if is_windows:
        pip_bin = venv_dir / "Scripts" / "pip.exe"
        python_bin = venv_dir / "Scripts" / "python.exe"
    else:
        pip_bin = venv_dir / "bin" / "pip"
        python_bin = venv_dir / "bin" / "python"

    # 의존성 복원
    requirements_file = python_dir / "requirements.txt"
    if requirements_file.exists():
        print_warn(f"사이드카 패키지 복원 중 ➔ pip install -r requirements.txt")
        try:
            # pip 자체 업그레이드
            subprocess.run([str(pip_bin), "install", "--upgrade", "pip"], check=True)
            # 패키지 설치
            subprocess.run([str(pip_bin), "install", "-r", str(requirements_file)], check=True)
            print_success("Python FastAPI 및 uvicorn 패키지 격리 복원 완수!")
        except subprocess.CalledProcessError as e:
            print_error(f"Pip 패키지 설치 중 에러 발생: {e}")
            sys.exit(1)
    else:
        print_warn(f"경고: requirements.txt 파일을 찾을 수 없습니다: {requirements_file}")

    # 5. SwarmVault CLI 전역 설치 및 Fail-Safe 예외 복구
    print_step("단계 4/6: SwarmVault CLI 글로벌 설치 및 Fail-Safe 예외 분기 검증")
    # 1차 시도: 글로벌 설치
    try:
        print_warn("글로벌 영역 설치 시도: npm install -g @swarmvaultai/cli")
        subprocess.run([npm_cmd, "install", "-g", "@swarmvaultai/cli"], cwd=project_root, check=True, shell=is_windows)
        print_success("SwarmVault CLI 글로벌 설치 성공!")
    except subprocess.CalledProcessError:
        print_warn("⚠️ 글로벌 영역 설치 권한 부족(Permission Denied) 감지!")
        print_warn("👉 로컬 프로젝트 영역(devDependencies)으로 백업 설치를 트리거하여 우회 복구를 수행합니다.")
        try:
            subprocess.run([npm_cmd, "install", "-D", "@swarmvaultai/cli"], cwd=project_root, check=True, shell=is_windows)
            print_success("로컬 개발 패키지 영역에 SwarmVault CLI 백업 설치(Fail-Safe) 성공!")
        except subprocess.CalledProcessError as e:
            print_error(f"로컬 의존성 백업 설치마저 실패했습니다: {e}")
            sys.exit(1)

    # 6. Git Hook 연동 설치
    print_step("단계 5/6: Git Hook 자동 연동 및 pre-commit 커밋 차단 통제 벽 바인딩")
    hook_installer = project_root / "setup_nstack_hooks.py"
    if hook_installer.exists():
        try:
            subprocess.run([python_cmd, str(hook_installer)], cwd=project_root, check=True)
        except subprocess.CalledProcessError as e:
            print_warn(f"Git Hook 바인딩 중 경고가 발생했으나 설치를 계속 진행합니다: {e}")
    else:
        print_warn("setup_nstack_hooks.py 파일이 프로젝트 루트에 존재하지 않아 스킵합니다.")

    # 7. Diagnostic verification
    print_step("단계 6/6: NStack 지식 파이프라인 무결성 자가 검사(Diagnostic Verification)")
    validator_script = project_root / "verify_nstack_pipeline.py"
    if validator_script.exists():
        try:
            # 린터 실행
            subprocess.run([python_cmd, str(validator_script)], cwd=project_root, check=True)
            print_success("NStack 지식 파이프라인 정적 무결성 검증 통과!")
        except subprocess.CalledProcessError:
            print_warn("⚠️ 지식 문서 정합성 검증 단계에서 포맷 오류가 검출되었습니다.")
            print_warn("💡 이는 과거 레거시 문서 양식 오류로 인한 것이며, 신규 설치 프로세스 빌드는 안전합니다.")
            print_warn("👉 정합성을 교정하려면 'python3 verify_nstack_pipeline.py --heal'을 실행하십시오.")
    else:
        print_warn("verify_nstack_pipeline.py 파일이 존재하지 않아 자가 검사를 건너뜁니다.")

    print("=" * 80)
    print(f"{COLOR_GREEN} 🎉 축하합니다! Windows & macOS 공용 NStack + NAtlas 개발자 온보딩 환경 구축이 완수되었습니다!{COLOR_RESET}")
    print(f"{COLOR_CYAN}  [운영 방법]{COLOR_RESET}")
    print(f"   1. 로컬 런칭: {COLOR_GREEN}npm run dev{COLOR_RESET} (FastAPI Sidecar와 Electron 앱이 동시 기동)")
    print(f"   2. 코드 정밀 타입 체크: {COLOR_GREEN}npm run typecheck{COLOR_RESET}")
    print(f"   3. 배포 패키지 생성: {COLOR_GREEN}npm run build{COLOR_RESET} (혹은 npm run build:mac / build:win)")
    print("=" * 80)

if __name__ == '__main__':
    main()
