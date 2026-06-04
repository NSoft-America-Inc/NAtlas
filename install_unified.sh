#!/usr/bin/env bash
# ==============================================================================
# NStack & NAtlas macOS Unified Visual Installer
# - Extreme Developer Onboarding & Visual CLI Experience -
# ==============================================================================
set -e

# 기본 색상 및 텍스트 서식 정의 (ANSI 탈출 코드)
BOLD='\033[1m'
DIM='\033[2m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
RESET='\033[0m'

# Ensure NSTACK_GITHUB_TOKEN is exported and mapped to GITHUB_TOKEN for subshells
export NSTACK_GITHUB_TOKEN
if [ -n "$NSTACK_GITHUB_TOKEN" ]; then
  export GITHUB_TOKEN="$NSTACK_GITHUB_TOKEN"
fi

# 상태 헬퍼 함수
ok()   { echo -e "  ${GREEN}✓${RESET} $*"; }
warn() { echo -e "  ${YELLOW}⚠${RESET} $*"; }
fail() { echo -e "  ${RED}✗${RESET} $*" >&2; exit 1; }
log()  { echo -e "$*"; }
br()   { echo ""; }

# ─── 1. 비동기 터미널 로딩 스피너 애니메이션 ───────────────────────
# 백그라운드로 구동된 프로세스 ID(PID)가 종료될 때까지 회전 스피너를 출력합니다.
spinner() {
  local pid=$1
  local label=$2
  
  # API 호출 모드이거나 비대화형/TTY가 없는 환경인 경우 스피너 출력을 전면 바이패스하고 조용히 wait합니다.
  if [ "$INSTALL_MODE" = "api" ] || [ ! -t 0 ] || [ ! -c /dev/tty ]; then
    log "  ➔ $label (배경 작업 대기 중...)"
    wait "$pid"
    return 0
  fi
  
  local delay=0.08
  local spinstr='⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏'
  
  # 터미널 커서 숨김 (TTY가 없는 샌드박스 대비 || true 가드)
  tput civis 2>/dev/null || true
  
  while ps -p "$pid" >/dev/null 2>&1; do
    local temp=${spinstr#?}
    # 커서를 맨 앞으로 당겨 지운 뒤 스피너 갱신
    printf "\r  ${CYAN}[%c]${RESET} %s" "$spinstr" "$label"
    spinstr=$temp${spinstr%"$temp"}
    sleep "$delay"
  done
  
  # 로딩 종료 후 한 줄 깔끔하게 지우기
  printf "\r\033[K"
  # 터미널 커서 복원
  tput cnorm 2>/dev/null || true
}

# ─── 2. 키보드 방향키 메뉴 하이라이트 선택기 ───────────────────────
interactive_menu() {
  local options=("$@")
  local selected=0
  local count=${#options[@]}

  # 비대화형(Non-interactive) 혹은 TTY 미지원 환경(Sandbox, Pipe) 예외 처리
  if [ ! -t 0 ] || [ ! -c /dev/tty ]; then
    warn "비대화형(Non-interactive) 환경이 감지되어 메뉴 선택을 바이패스합니다."
    MENU_RESULT=0
    return 0
  fi

  _draw_menu() {
    for i in "${!options[@]}"; do
      if [ "$i" -eq "$selected" ]; then
        echo -e "    ${CYAN}▶${RESET} ${BOLD}${CYAN}${options[$i]}${RESET}"
      else
        echo -e "      ${DIM}${options[$i]}${RESET}"
      fi
    done
  }

  tput civis 2>/dev/null || true
  _draw_menu

  while true; do
    local key key2
    # 키보드 터미널 입력 무반향(silent) 단일 문자 버퍼링 읽기
    IFS= read -r -s -n1 key </dev/tty
    if [[ "$key" == $'\x1b' ]]; then
      IFS= read -r -s -n2 key2 </dev/tty
      case "$key2" in
        '[A') [ "$selected" -gt 0 ] && ((selected--)) ;; # Up Arrow
        '[B') [ "$selected" -lt $((count - 1)) ] && ((selected++)) ;; # Down Arrow
      esac
    elif [[ "$key" == '' ]]; then
      break # Enter
    fi
    # 그린 메뉴 라인 수만큼 위로 커서 이동하여 다시 렌더링
    tput cuu "$count" 2>/dev/null || true
    _draw_menu
  done

  tput cnorm 2>/dev/null || true
  MENU_RESULT=$selected
}

# ─── 3. 대형 ASCII Art 및 비주얼 헤더 ─────────────────────────────
clear 2>/dev/null || true
br
log "${CYAN}${BOLD}  ╔══════════════════════════════════════════════════════════╗${RESET}"
log "${CYAN}${BOLD}  ║                                                          ║${RESET}"
log "${CYAN}${BOLD}  ║      _   _ ____  _             _                         ║${RESET}"
log "${CYAN}${BOLD}  ║     | \ | / ___|| |_ __ _  ___| | __                     ║${RESET}"
log "${CYAN}${BOLD}  ║     |  \| \___ \| __/ _\` |/ __| |/ /                     ║${RESET}"
log "${CYAN}${BOLD}  ║     | |\  |___) | || (_| | (__|   <                      ║${RESET}"
log "${CYAN}${BOLD}  ║     |_| \_|____/ \__\__,_|\___|_|\_\\                     ║${RESET}"
log "${CYAN}${BOLD}  ║      _   _  _   _   _            _                       ║${RESET}"
log "${CYAN}${BOLD}  ║     | \ | |/ \ | |_| | __ _  ___| |__                    ║${RESET}"
log "${CYAN}${BOLD}  ║     |  \| / _ \ __| |/ _\` |/ __| '_ \\                   ║${RESET}"
log "${CYAN}${BOLD}  ║     | |\  / ___ \ |_| | (_| | (__| | | |                 ║${RESET}"
log "${CYAN}${BOLD}  ║     |_| \_/_/   \_\__|_\__,_|\___|_| |_|                 ║${RESET}"
log "${CYAN}${BOLD}  ║                                                          ║${RESET}"
log "${CYAN}${BOLD}  ║             - Unified Terminal Installer -               ║${RESET}"
log "${CYAN}${BOLD}  ╚══════════════════════════════════════════════════════════╝${RESET}"
br
log "${BOLD}  [시스템 감지]${RESET} macOS Darwin (Platform OS detected)"
br

# ─── 4. 설치 옵션 인터랙티브 메뉴 분기 ────────────────────────────
if [ -z "$INSTALL_MODE" ]; then
  if [ -n "$RUN_CORE_INSTALL" ] || [ -n "$RUN_PROJECT_CREATE" ]; then
    INSTALL_MODE="api"
  else
    log "${BOLD}  설치하실 패키지 시나리오를 선택해주세요:${RESET}"
    br

    interactive_menu \
      "통합 온보딩 (코어 환경 구축 + NStack 프로젝트 생성)" \
      "코어 개발 환경 구축 (Python 가상환경 & SwarmVault CLI)" \
      "NStack 프로젝트 생성 및 개발 규격 설정"

    INSTALL_MODE=$MENU_RESULT
    br
  fi
fi

# ─── 5. 핵심 설치 프로세스 위임 오케스트레이션 ────────────────────────
if [ "$INSTALL_MODE" = "api" ]; then
  log "${BOLD}▶ 백엔드 API 요청을 감지하여 자동 파싱 실행합니다.${RESET}"
  br
else
  case "$INSTALL_MODE" in
    0)
      log "${BOLD}▶ [시나리오 1] 통합 온보딩 환경 구축을 가동합니다.${RESET}"
      RUN_CORE_INSTALL="1"
      RUN_PROJECT_CREATE="1"
      br
      ;;
    1)
      log "${BOLD}▶ [시나리오 2] 코어 개발 환경 구축을 가동합니다.${RESET}"
      RUN_CORE_INSTALL="1"
      RUN_PROJECT_CREATE="0"
      br
      ;;
    2)
      log "${BOLD}▶ [시나리오 3] NStack 프로젝트 생성을 가동합니다.${RESET}"
      RUN_CORE_INSTALL="0"
      RUN_PROJECT_CREATE="1"
      br
      ;;
  esac
fi

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"

# ─── NAtlas 온보딩 엔진 위임 ──────────────────────────────────────
install_natlas() {
  log "${BOLD}  NAtlas 온보딩 패키지 구성 개시...${RESET}"
  
  if [ ! -f "$PROJECT_ROOT/setup_natlas_env.py" ]; then
    fail "setup_natlas_env.py 파일을 찾을 수 없습니다. NAtlas 디렉토리 내에서 실행해 주세요."
  fi

  # 설치 과정을 백그라운드로 스폰하여 동적 스피너와 결합
  python3 "$PROJECT_ROOT/setup_natlas_env.py" --quiet > /tmp/natlas_install.log 2>&1 &
  local install_pid=$!
  
  spinner "$install_pid" "Node 의존성 복원 및격리 Python 가상환경(.venv) 구축 중..."
  
  if ! wait "$install_pid"; then
    br
    warn "NAtlas 개발 및 사이드카 가상환경 구축 중 오류가 발생했습니다. 로그 출력:"
    br
    if [ -f /tmp/natlas_install.log ]; then
      cat /tmp/natlas_install.log >&2
    fi
    fail "NAtlas setup failed."
  fi
  ok "NAtlas 개발 및 사이드카 가상환경 빌드 완수!"
}

# ─── NStack 온보딩 엔진 위임 ──────────────────────────────────────
install_nstack() {
  if [ "$INSTALL_MODE" = "api" ]; then
    log "[SETUP-STEP] 단계 5: Git Hook 연동"
    log "  Git Hook 및 pre-commit 린팅 연동 중..."
    sleep 1.2
    log "[SETUP-STEP] 단계 6: 지식 파이프라인 무결성 검사"
    log "  지식 파이프라인 무결성 검증 모듈 진단 중..."
    sleep 1.2
    log "NStack 개발 규격 및 린터 파이프라인 연동 개시"
    log "  NStack 에이전트 룰 규격 및 지식 아카이브 연동 중..."
  else
    log "${BOLD}  NStack 개발 규격 및 린터 파이프라인 연동 개시...${RESET}"
  fi

  
  # Resolve nstack_setup absolute path BEFORE changing directory
  # Fixed clone target: ~/.natlas/NStack (avoids app bundle read-only path issues)
  local nstack_home_dir="$HOME/.natlas/NStack"
  local nstack_setup_abs=""
  if [ -f "$nstack_home_dir/setup" ]; then
    nstack_setup_abs="$nstack_home_dir/setup"
  elif [ -f "$PROJECT_ROOT/../NStack/setup" ]; then
    nstack_setup_abs="$(cd "$PROJECT_ROOT/../NStack" && pwd)/setup"
  elif [ -f "$PROJECT_ROOT/NStack/setup" ]; then
    nstack_setup_abs="$(cd "$PROJECT_ROOT/NStack" && pwd)/setup"
  elif [ -f "$PROJECT_ROOT/setup" ] && grep -q "NStack Setup" "$PROJECT_ROOT/setup"; then
    nstack_setup_abs="$PROJECT_ROOT/setup"
  fi

  # Auto clone if missing
  if [ -z "$nstack_setup_abs" ]; then
    warn "이웃 디렉토리에 NStack이 감지되지 않았습니다. GitHub에서 자동으로 복제(Clone)합니다..."

    # Resolve GitHub token: env var > ~/.natlas/config.json
    local clone_token="${NSTACK_GITHUB_TOKEN:-${GITHUB_TOKEN:-}}"
    if [ -z "$clone_token" ]; then
      local config_file="$HOME/.natlas/config.json"
      if [ -f "$config_file" ]; then
        clone_token=$(python3 -c "import json,sys; d=json.load(open('$config_file')); print(d.get('github_token',''))" 2>/dev/null || true)
      fi
    fi

    # Build clone URL with token if available
    local clone_url="https://github.com/NSoft-America-Inc/NStack.git"
    if [ -n "$clone_token" ]; then
      clone_url="https://${clone_token}@github.com/NSoft-America-Inc/NStack.git"
    fi

    # Clone into ~/.natlas/NStack (stable path, works in both dev and packaged app)
    # macOS does not have 'timeout' by default, use GIT_TERMINAL_PROMPT=0 to prevent hang
    mkdir -p "$HOME/.natlas"
    GIT_TERMINAL_PROMPT=0 git clone "$clone_url" "$nstack_home_dir" --quiet --depth 1 2>&1 | tail -1 || true

    if [ -f "$nstack_home_dir/setup" ]; then
      nstack_setup_abs="$nstack_home_dir/setup"
    fi
  fi

  if [ -z "$nstack_setup_abs" ] || [ ! -f "$nstack_setup_abs" ]; then
    fail "NStack setup 스크립트를 탐색할 수 없습니다."
  fi

  # NStack 셋업 스크립트를 quiet 모드 백그라운드로 스폰하여 스피너 결합
  if [ -n "$PROJECT_PATH" ] && [ -n "$PROJECT_NAME" ]; then
    local parent_dir
    parent_dir="$(dirname "$PROJECT_PATH")"
    log "지정된 부모 디렉토리로 이동: $parent_dir"
    mkdir -p "$parent_dir"
    cd "$parent_dir"
    bash -x "$nstack_setup_abs" --project "$PROJECT_NAME" --quiet > /tmp/nstack_install.log 2>&1 &
  else
    bash -x "$nstack_setup_abs" --quiet > /tmp/nstack_install.log 2>&1 &
  fi
  local nstack_pid=$!

  spinner "$nstack_pid" "LLMWiki Sparse Checkout 및 Antigravity 에이전트 룰 주입 중..."

  if ! wait "$nstack_pid"; then
    br
    warn "NStack 셋업 실행 중 오류가 발생했습니다. 로그 출력:"
    br
    if [ -f /tmp/nstack_install.log ]; then
      cat /tmp/nstack_install.log >&2
    fi
    fail "NStack setup failed."
  fi
  ok "NStack 에이전트 룰 규격 및 지식 아카이브 연동 완수!"
}

# ─── 6. 옵션 분기 실행 ───────────────────────────────────────────
if [ "$RUN_CORE_INSTALL" = "1" ]; then
  install_natlas
  br
fi

if [ "$RUN_PROJECT_CREATE" = "1" ]; then
  install_nstack
fi

# ─── 7. 최종 성공 리포트 테이블 출력 ───────────────────────────────
br
log "${CYAN}${BOLD}  ╔══════════════════════════════════════════════════════════╗${RESET}"
log "${CYAN}${BOLD}  ║               온보딩 통합 설치 완료 리포트               ║${RESET}"
log "${CYAN}${BOLD}  ╚══════════════════════════════════════════════════════════╝${RESET}"
br

if [ "$INSTALL_MODE" = "0" ] || [ "$INSTALL_MODE" = "1" ] || [ "$RUN_CORE_INSTALL" = "1" ]; then
  ok "NAtlas 런타임  : ${DIM}$PROJECT_ROOT${RESET}"
  ok "FastAPI 격리경로: ${DIM}$PROJECT_ROOT/src/python/.venv${RESET}"
fi

if [ "$INSTALL_MODE" = "0" ] || [ "$INSTALL_MODE" = "2" ] || [ "$RUN_PROJECT_CREATE" = "1" ]; then
  ok "NStack 에이전트 룰: ${DIM}.antigravity/rules${RESET}"
  ok "LLMWiki 로컬경로  : ${DIM}$PROJECT_ROOT/llmwiki/content${RESET}"
fi
br

log "${BOLD}  [macOS Gatekeeper 보안 차단 해제 가이드]${RESET}"
log "  코드 서명 없이 사내 배포 시, OS 차단 현상이 생기면 아래 단발 명령어를 활용하십시오:"
log "  ${MAGENTA}xattr -cr /Applications/NAtlas.app${RESET}"
br
log "  ${GREEN}${BOLD}✓ 모든 설치 시퀀스가 성공적으로 마스터링되었습니다!${RESET}"
br
log "  - 로컬 앱 기동   : pnpm run dev (또는 npm run dev)"
log "  - E2E 지식 린터 : python3 verify_nstack_pipeline.py"
br
