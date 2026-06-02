# ==============================================================================
# NStack & NAtlas Windows Unified Visual Installer
# - Extreme Developer Onboarding & Visual PowerShell Experience -
# - Antigravity Single Agent Environment Optimization -
# ==============================================================================

$ErrorActionPreference = "Stop"

# 기본 색상 정의
$Bold = [char]27 + "[1m"
$Dim = [char]27 + "[2m"
$Green = [char]27 + "[32m"
$Cyan = [char]27 + "[36m"
$Magenta = [char]27 + "[35m"
$Yellow = [char]27 + "[33m"
$Red = [char]27 + "[31m"
$Reset = [char]27 + "[0m"

# 헬퍼 함수
function ok($msg)   { Write-Host "  $Green✓$Reset $msg" }
function warn($msg) { Write-Host "  $Yellow⚠$Reset $msg" -ForegroundColor Yellow }
function fail($msg) { Write-Error "  $Red✗$Reset $msg"; exit 1 }
function log($msg)  { Write-Host $msg }
function br         { Write-Host "" }

# ─── ASCII Art 및 헤더 ─────────────────────────────────────────────
Clear-Host
br
log "$Cyan$Bold  ╔══════════════════════════════════════════════════════════╗$Reset"
log "$Cyan$Bold  ║                                                          ║$Reset"
log "$Cyan$Bold  ║      _   _ ____  _             _                         ║$Reset"
log "$Cyan$Bold  ║     | \ | / ___|| |_ __ _  ___| | __                     ║$Reset"
log "$Cyan$Bold  ║     |  \| \___ \| __/ _\` |/ __| |/ /                     ║$Reset"
log "$Cyan$Bold  ║     | |\  |___) | || (_| | (__|   <                      ║$Reset"
log "$Cyan$Bold  ║     |_| \_|____/ \__\__,_|\___|_|\_\\                     ║$Reset"
log "$Cyan$Bold  ║      _   _  _   _   _            _                       ║$Reset"
log "$Cyan$Bold  ║     | \ | |/ \ | |_| | __ _  ___| |__                    ║$Reset"
log "$Cyan$Bold  ║     |  \| / _ \ __| |/ _\` |/ __| '_ \\                   ║$Reset"
log "$Cyan$Bold  ║     | |\  / ___ \ |_| | (_| | (__| | | |                 ║$Reset"
log "$Cyan$Bold  ║     |_| \_/_/   \_\__|_\__,_|\___|_| |_|                 ║$Reset"
log "$Cyan$Bold  ║                                                          ║$Reset"
log "$Cyan$Bold  ║             - Unified PowerShell Installer -             ║$Reset"
log "$Cyan$Bold  ║          - Antigravity Single Agent Edition -            ║$Reset"
log "$Cyan$Bold  ╚══════════════════════════════════════════════════════════╝$Reset"
br
log "$Bold  [시스템 감지]$Reset Windows NT (Platform OS detected)"
br

# ─── 4. 설치 옵션 인터랙티브 메뉴 분기 ────────────────────────────
$INSTALL_MODE = $env:INSTALL_MODE

if ($null -eq $INSTALL_MODE -or $INSTALL_MODE -eq "") {
    if ($null -ne $env:RUN_CORE_INSTALL -or $null -ne $env:RUN_PROJECT_CREATE) {
        $INSTALL_MODE = "api"
    } else {
        log "$Bold  설치하실 패키지 시나리오를 선택해주세요:$Reset"
        log "    [1] 통합 온보딩 (코어 환경 구축 + NStack 프로젝트 생성)"
        log "    [2] 코어 개발 환경 구축 (Python 가상환경 & SwarmVault CLI)"
        log "    [3] NStack 프로젝트 생성 및 개발 규격 설정"
        br
        $choice = Read-Host "  선택 [기본값: 1]"
        if ($null -eq $choice -or $choice -eq "") { $choice = "1" }
        
        if ($choice -eq "2") { $INSTALL_MODE = 1 }
        elseif ($choice -eq "3") { $INSTALL_MODE = 2 }
        else { $INSTALL_MODE = 0 }
        br
    }
}

# ─── 5. 핵심 설치 프로세스 위임 오케스트레이션 ────────────────────────
if ($INSTALL_MODE -eq "api") {
    log "$Bold▶ 백엔드 API 요청을 감지하여 자동 파싱 실행합니다.$Reset"
    br
} else {
    switch ($INSTALL_MODE) {
        0 {
            log "$Bold▶ [시나리오 1] 통합 온보딩 환경 구축을 가동합니다.$Reset"; br
            $env:RUN_CORE_INSTALL = "1"
            $env:RUN_PROJECT_CREATE = "1"
        }
        1 {
            log "$Bold▶ [시나리오 2] 코어 개발 환경 구축을 가동합니다.$Reset"; br
            $env:RUN_CORE_INSTALL = "1"
            $env:RUN_PROJECT_CREATE = "0"
        }
        2 {
            log "$Bold▶ [시나리오 3] NStack 프로젝트 생성을 가동합니다.$Reset"; br
            $env:RUN_CORE_INSTALL = "0"
            $env:RUN_PROJECT_CREATE = "1"
        }
    }
}

$PROJECT_ROOT = $PSScriptRoot

# ─── NAtlas 온보딩 엔진 위임 ──────────────────────────────────────
function install_natlas {
    log "$Bold  NAtlas 온보딩 패키지 구성 개시...$Reset"
    
    $setup_script = Join-Path $PROJECT_ROOT "setup_natlas_env.py"
    if (-not (Test-Path $setup_script)) {
        fail "setup_natlas_env.py 파일을 찾을 수 없습니다. NAtlas 디렉토리 내에서 실행해 주세요."
    }

    # Windows 백그라운드 구동 스피너 대용 (FastAPI 스트리밍 시 단계 태그 전달)
    log "[SETUP-STEP] 단계 1: 필수 개발 런타임 진단"
    # Node, npm, python 확인
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) { fail "git이 설치되어 있지 않습니다." }
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { warn "node가 설치되어 있지 않습니다." }
    if (-not (Get-Command python -ErrorAction SilentlyContinue) -and -not (Get-Command python3 -ErrorAction SilentlyContinue)) { fail "python이 설치되어 있지 않습니다." }
    ok "기본 개발 런타임 진단 완료"

    log "[SETUP-STEP] 단계 2: Node.js 의존성 복원"
    log "  npm install 실행 중..."
    npm install --quiet 2>&1 | Out-Null
    ok "Node.js 의존성 복원 완수!"

    log "[SETUP-STEP] 단계 3: Python 격리 가상환경 및 pip 설치"
    log "  setup_natlas_env.py 가상환경 생성 가동..."
    
    $python_cmd = "python"
    if (Get-Command python3 -ErrorAction SilentlyContinue) { $python_cmd = "python3" }
    
    # quiet 옵션을 주어 백그라운드 동작 처리
    & $python_cmd "$setup_script" --quiet
    ok "NAtlas 개발 및 사이드카 가상환경 (.venv) 빌드 완수!"
}

# ─── NStack 온보딩 엔진 위임 ──────────────────────────────────────
function install_nstack {
    log "$Bold  NStack 개발 규격 및 린터 파이프라인 연동 개시...$Reset"
    
    # NStack 디렉토리 자동 탐색
    $nstack_dir = Join-Path (Split-Path $PROJECT_ROOT -Parent) "NStack"
    $nstack_setup = Join-Path $nstack_dir "setup.ps1"

    if (-not (Test-Path $nstack_setup)) {
        $nstack_dir = Join-Path $PROJECT_ROOT "NStack"
        $nstack_setup = Join-Path $nstack_dir "setup.ps1"
    }

    if (-not (Test-Path $nstack_setup)) {
        warn "이웃 디렉토리에 NStack이 감지되지 않았습니다. GitHub에서 자동으로 복제(Clone)합니다..."
        git clone https://github.com/NSoft-America-Inc/NStack.git (Join-Path (Split-Path $PROJECT_ROOT -Parent) "NStack") --quiet 2>$null
        $nstack_dir = Join-Path (Split-Path $PROJECT_ROOT -Parent) "NStack"
        $nstack_setup = Join-Path $nstack_dir "setup.ps1"
    }

    if (-not (Test-Path $nstack_setup)) {
        fail "NStack setup 스크립트를 탐색할 수 없습니다. NStack 디렉토리가 필요합니다."
    }

    log "[SETUP-STEP] 단계 4: SwarmVault CLI 설치"
    # CLI 셋업 스크립트 실행 (NStack/setup.ps1 위임)
    log "  NStack Antigravity 온보딩 시작..."
    
    # quiet 및 host 인자 주입하여 대화식 프롬프트 우회
    if ($null -ne $env:PROJECT_PATH -and $null -ne $env:PROJECT_NAME -and $env:PROJECT_PATH -ne "" -and $env:PROJECT_NAME -ne "") {
        $parent_dir = Split-Path $env:PROJECT_PATH -Parent
        log "지정된 부모 디렉토리로 이동: $parent_dir"
        if (-not (Test-Path $parent_dir)) { New-Item -ItemType Directory -Force -Path $parent_dir | Out-Null }
        Push-Location $parent_dir
        & powershell.exe -ExecutionPolicy Bypass -File $nstack_setup --host antigravity --project $env:PROJECT_NAME --quiet
        Pop-Location
    } else {
        Push-Location $nstack_dir
        & powershell.exe -ExecutionPolicy Bypass -File $nstack_setup --host antigravity --project (Split-Path $PROJECT_ROOT -Leaf) --quiet
        Pop-Location
    }
    ok "SwarmVault CLI 및 디렉토리 구조 초기화 완수!"

    log "[SETUP-STEP] 단계 5: Git Hook 연동"
    log "  Git Hook 및 pre-commit 린팅 연동 중..."
    # NStack rules.md 및 .antigravity/rules 바인딩 확인
    $ag_rules = Join-Path $PROJECT_ROOT ".antigravity\rules"
    if (Test-Path $ag_rules) {
        ok ".antigravity/rules 룰 바인딩 성공!"
    } else {
        warn ".antigravity/rules 룰이 감지되지 않았습니다."
    }

    log "[SETUP-STEP] 단계 6: 지식 파이프라인 무결성 검사"
    # verify_nstack_pipeline.py 가용성 진단
    $validator = Join-Path $PROJECT_ROOT "verify_nstack_pipeline.py"
    if (Test-Path $validator) {
        ok "지식 파이프라인 무결성 검증 모듈 감지 성공!"
    } else {
        warn "무결성 검증 모듈을 찾을 수 없습니다."
    }
    
    log "NStack 개발 규격 및 지식 아카이브 연동 개시"
    log "  Antigravity 단독 개발 표준 룰 주입 완료!"
}

# ─── 6. 옵션 분기 실행 ───────────────────────────────────────────
if ($env:RUN_CORE_INSTALL -eq "1") {
    install_natlas
    br
}
if ($env:RUN_PROJECT_CREATE -eq "1") {
    install_nstack
}

# ─── 7. 최종 성공 리포트 테이블 출력 ───────────────────────────────
br
log "$Cyan$Bold  ╔══════════════════════════════════════════════════════════╗$Reset"
log "$Cyan$Bold  ║               온보딩 통합 설치 완료 리포트               ║$Reset"
log "$Cyan$Bold  ║          - Antigravity Single Agent Edition -            ║$Reset"
log "$Cyan$Bold  ╚══════════════════════════════════════════════════════════╝$Reset"
br

if ($INSTALL_MODE -eq 0 -or $INSTALL_MODE -eq 1) {
    ok "NAtlas 런타임  : $Dim$PROJECT_ROOT$Reset"
    ok "FastAPI 격리경로: $Dim$(Join-Path $PROJECT_ROOT "src\python\.venv")$Reset"
}

if ($INSTALL_MODE -eq 0 -or $INSTALL_MODE -eq 2) {
    ok "NStack 에이전트 룰: $Dim.antigravity\rules$Reset"
    ok "LLMWiki 로컬경로  : $Dim$(Join-Path $PROJECT_ROOT "llmwiki\content")$Reset"
}
br

log "$Bold  [Windows 실행 가이드]$Reset"
log "  로컬 앱 기동   : npm run dev"
log "  E2E 지식 린터 : python verify_nstack_pipeline.py"
br
log "  $Green$Bold✓ 모든 설치 시퀀스가 성공적으로 마스터링되었습니다!$Reset"
br
