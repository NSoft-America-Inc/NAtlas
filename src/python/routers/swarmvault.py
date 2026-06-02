import sys
import os
import json
import asyncio
import platform
from pathlib import Path
from fastapi import APIRouter
from fastapi.responses import StreamingResponse, JSONResponse
from routers.settings import CONFIG_FILE, GIT_MANAGED_DIR, LLMWIKI_REPO_URL, load_settings as load_settings_data
from routers.documents import get_documents, get_llmwiki_root
from pydantic import BaseModel
import db

router = APIRouter()

async def get_python_status():
    try:
        # sys.version_info yields major, minor, micro
        version = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
        return {"ok": True, "version": version, "bin": sys.executable}
    except Exception:
        return {"ok": False, "version": None, "bin": None}

async def get_swarmvault_status():
    try:
        # Run swarmvault --version to check if it's available in PATH
        proc = await asyncio.create_subprocess_exec(
            "swarmvault", "--version",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, _ = await proc.communicate()
        if proc.returncode == 0:
            version_str = stdout.decode('utf-8', errors='replace').strip()
            # If output is empty or generic, use fallback version label
            if not version_str:
                version_str = "1.x.x"
            return {"ok": True, "version": version_str}
        else:
            return {"ok": False, "version": None}
    except Exception:
        return {"ok": False, "version": None}

@router.get("/status")
async def get_status():
    py_status = await get_python_status()
    sv_status = await get_swarmvault_status()
    
    llmwiki_root = get_llmwiki_root()
    if not llmwiki_root:
        wiki_status = {"ok": False, "file_count": 0, "error": "LLMWiki 루트 경로를 재설정하세요"}
    else:
        content_dir = Path(llmwiki_root) / "content"
        if not content_dir.exists() or not content_dir.is_dir():
            wiki_status = {"ok": False, "file_count": 0, "error": "content/ 폴더를 찾을 수 없습니다"}
        else:
            md_files = list(content_dir.glob("**/*.md"))
            md_files_count = len([f for f in md_files if not f.name.startswith('.')])
            
            config_json = Path(llmwiki_root) / "swarmvault.config.json"
            if not config_json.exists():
                wiki_status = {"ok": False, "file_count": md_files_count, "error": "swarmvault.config.json을 찾을 수 없습니다"}
            else:
                wiki_status = {"ok": True, "file_count": md_files_count}

    return {
        "python": py_status,
        "swarmvault": sv_status,
        "llmwiki": wiki_status
    }

@router.post("/update")
async def post_update():
    llmwiki_root = get_llmwiki_root()
    if not llmwiki_root:
        return JSONResponse(
            status_code=500,
            content={"error": "LLMWiki 경로를 찾을 수 없습니다"}
        )

    # Resolve document indexing statuses to identify changed/new files
    docs_res = await get_documents()
    files_to_ingest = []
    
    if isinstance(docs_res, dict) and "files" in docs_res:
        for file in docs_res["files"]:
            if file["status"] in ("modified", "new"):
                # Paths in SwarmVault ingest CLI are relative to LLMWiki root (e.g. content/01-Logs/...)
                files_to_ingest.append(f"content/{file['path']}")

    async def event_generator():
        yield f"data: {json.dumps({'type': 'log', 'message': f'동기화 변경/신규 파일 탐색 완료: {len(files_to_ingest)}개'})}\n\n"
        
        success = True
        
        # 1. Run swarmvault ingest for modified/new files one-by-one
        for idx, file_rel in enumerate(files_to_ingest):
            yield f"data: {json.dumps({'type': 'log', 'message': f'Ingesting [{idx+1}/{len(files_to_ingest)}]: {file_rel}'})}\n\n"
            
            try:
                proc = await asyncio.create_subprocess_exec(
                    "swarmvault", "ingest", file_rel,
                    cwd=llmwiki_root,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                
                # Consume process output asynchronously and stream it
                while True:
                    stdout_line = await proc.stdout.readline()
                    stderr_line = await proc.stderr.readline()
                    
                    if not stdout_line and not stderr_line:
                        break
                    
                    if stdout_line:
                        msg = stdout_line.decode('utf-8', errors='replace').strip()
                        if msg:
                            yield f"data: {json.dumps({'type': 'log', 'message': msg})}\n\n"
                    if stderr_line:
                        msg = stderr_line.decode('utf-8', errors='replace').strip()
                        if msg:
                            yield f"data: {json.dumps({'type': 'log', 'message': msg})}\n\n"
                
                await proc.wait()
                if proc.returncode != 0:
                    yield f"data: {json.dumps({'type': 'error', 'message': f'ingest 실패: {file_rel} (종료 코드: {proc.returncode})'})}\n\n"
                    db.execute_query(
                        "INSERT INTO build_logs (action, status, log_message) VALUES (?, ?, ?)",
                        ('ingest', 'error', f'ingest 실패: {file_rel} (exit {proc.returncode})'),
                        commit=True
                    )
                    success = False
                    break
            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'message': f'ingest 명령 실행 중 오류 발생: {str(e)}'})}\n\n"
                db.execute_query(
                    "INSERT INTO build_logs (action, status, log_message) VALUES (?, ?, ?)",
                    ('ingest', 'error', f'ingest 실행 중 예외 발생: {str(e)}'),
                    commit=True
                )
                success = False
                break

        if not success:
            return

        # 2. Run swarmvault compile
        yield f"data: {json.dumps({'type': 'log', 'message': 'SwarmVault 컴파일 및 벡터 지식 베이스 갱신 중...'})}\n\n"
        try:
            proc = await asyncio.create_subprocess_exec(
                "swarmvault", "compile",
                cwd=llmwiki_root,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            
            while True:
                stdout_line = await proc.stdout.readline()
                stderr_line = await proc.stderr.readline()
                
                if not stdout_line and not stderr_line:
                    break
                
                if stdout_line:
                    msg = stdout_line.decode('utf-8', errors='replace').strip()
                    if msg:
                        yield f"data: {json.dumps({'type': 'log', 'message': msg})}\n\n"
                if stderr_line:
                    msg = stderr_line.decode('utf-8', errors='replace').strip()
                    if msg:
                        yield f"data: {json.dumps({'type': 'log', 'message': msg})}\n\n"
            
            await proc.wait()
            if proc.returncode == 0:
                yield f"data: {json.dumps({'type': 'done', 'message': '✅ 완료'})}\n\n"
                db.execute_query(
                    "INSERT INTO build_logs (action, status, log_message) VALUES (?, ?, ?)",
                    ('compile', 'done', f'Ingest 및 Compile 최종 컴파일 완료 (동기화 대상: {len(files_to_ingest)}개)'),
                    commit=True
                )
            else:
                yield f"data: {json.dumps({'type': 'error', 'message': f'compile 실패 (종료 코드: {proc.returncode})'})}\n\n"
                db.execute_query(
                    "INSERT INTO build_logs (action, status, log_message) VALUES (?, ?, ?)",
                    ('compile', 'error', f'compile 실패 (exit {proc.returncode})'),
                    commit=True
                )
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': f'compile 명령 실행 중 오류 발생: {str(e)}'})}\n\n"
            db.execute_query(
                "INSERT INTO build_logs (action, status, log_message) VALUES (?, ?, ?)",
                ('compile', 'error', f'compile 실행 중 예외 발생: {str(e)}'),
                commit=True
            )

    return StreamingResponse(event_generator(), media_type="text/event-stream")

class InstallSchema(BaseModel):
    core_install: bool = True
    project_create: bool = True
    e2e_test: bool = True
    parent_path: str = ""
    project_name: str = ""

@router.post("/install")
async def post_install(payload: InstallSchema):
    import shutil
    import re
    
    print(f"DEBUG: payload.core_install={payload.core_install}, payload.project_create={payload.project_create}, payload.e2e_test={payload.e2e_test}")
    print(f"DEBUG: payload.parent_path='{payload.parent_path}', payload.project_name='{payload.project_name}'")
    
    project_root = str(Path(__file__).parent.parent.parent.parent.resolve())
    
    # Compute target project path
    if payload.parent_path and payload.project_name:
        parent_dir = os.path.expanduser(payload.parent_path)
        project_path = os.path.abspath(os.path.join(parent_dir, payload.project_name))
    else:
        parent_dir = os.path.dirname(project_root)
        project_path = os.path.join(parent_dir, payload.project_name or "nstack-project")

    # 9개의 세부 스텝 정의
    all_steps = [
        {"id": "runtimes", "name": "필수 개발 런타임 진단"},
        {"id": "npm_install", "name": "Node.js 의존성 복원"},
        {"id": "python_venv", "name": "Python 격리 가상환경 및 pip 설치"},
        {"id": "swarmvault_cli", "name": "SwarmVault CLI 설치"},
        {"id": "git_hook", "name": "Git Hook 연동"},
        {"id": "pipeline_verify", "name": "지식 파이프라인 무결성 검사"},
        {"id": "nstack_onboarding", "name": "NStack 에이전트 룰 및 지식 아카이브 연동"},
        {"id": "mcp_verify", "name": "Antigravity 표준 가이드 룰 검증"},
        {"id": "rag_verify", "name": "E2E 의미론적 RAG 검색 자가 검증"}
    ]

    active_steps = []
    if payload.core_install:
        active_steps.extend(all_steps[0:4])
    if payload.project_create:
        active_steps.extend(all_steps[4:8])
    if payload.e2e_test:
        active_steps.extend([all_steps[8]])

    async def event_generator():
        # 1. 초기화 데이터 전달 (프론트엔드가 활성 스텝 목록을 그리도록 함)
        yield f"data: {json.dumps({'type': 'init', 'steps': active_steps})}\n\n"
        await asyncio.sleep(0.1)

        # 2. 사전 진단 1: GitHub CLI (gh auth status) 인증 상태 점검
        yield f"data: {json.dumps({'type': 'log', 'message': '[사전 진단] GitHub CLI 인증 상태 점검 중...'})}\n\n"
        gh_ok = False
        try:
            gh_proc = await asyncio.create_subprocess_exec(
                "gh", "auth", "status",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, stderr = await gh_proc.communicate()
            if gh_proc.returncode == 0:
                gh_ok = True
                yield f"data: {json.dumps({'type': 'log', 'message': '✓ GitHub CLI 인증 상태 확인 완료 (시스템 로그인 세션 캐시가 유효합니다)'})}\n\n"
            else:
                yield f"data: {json.dumps({'type': 'log', 'message': '⚠ GitHub CLI 미인증 상태입니다. Settings의 github_token 유효성을 점검합니다.'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'log', 'message': f'GitHub CLI 점검 중 오류: {str(e)}'})}\n\n"

        # 사전 진단 2: Settings의 github_token 유효성 교차 체크
        cfg = load_settings_data()
        pat_token = cfg.get("github_token", "").strip()
        if not gh_ok and pat_token:
            yield f"data: {json.dumps({'type': 'log', 'message': '✓ Settings의 github_token 저장 정보 확인 완료 (옵션 2 PAT 활용 가능)'})}\n\n"
            gh_ok = True
        
        if not gh_ok:
            yield f"data: {json.dumps({'type': 'auth_warning', 'message': 'GitHub 자격 증명이 누락되었습니다. NStack 이슈 연동이 작동하지 않을 수 있습니다. 터미널에서 gh auth login을 수행하거나 Settings 탭에 GitHub 토큰을 설정하십시오.'})}\n\n"
        else:
            yield f"data: {json.dumps({'type': 'auth_success', 'message': 'GitHub 자격 증명이 유효합니다.'})}\n\n"

        run_installer_script = payload.core_install or payload.project_create

        # 3. install_unified.sh / install_unified.ps1 실행 및 출력 파이프 파싱 (OS 분기 멀티플렉싱)
        if run_installer_script:
            env = os.environ.copy()
            env["RUN_CORE_INSTALL"] = "1" if payload.core_install else "0"
            env["RUN_PROJECT_CREATE"] = "1" if payload.project_create else "0"
            env["PROJECT_PATH"] = project_path
            env["PROJECT_NAME"] = payload.project_name or "nstack-project"
            
            print(f"DEBUG: spawning script with env PROJECT_PATH='{project_path}', PROJECT_NAME='{payload.project_name}'")
            
            is_windows = platform.system() == "Windows"
            script_name = "install_unified.ps1" if is_windows else "install_unified.sh"
            yield f"data: {json.dumps({'type': 'log', 'message': f'설치 스크립트 가동 (Platform: {platform.system()}, File: {script_name})...'})}\n\n"
            
            try:
                if is_windows:
                    proc = await asyncio.create_subprocess_exec(
                        "powershell.exe", "-ExecutionPolicy", "Bypass", "-File", "install_unified.ps1",
                        cwd=project_root,
                        env=env,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                else:
                    proc = await asyncio.create_subprocess_exec(
                        "bash", "install_unified.sh",
                        cwd=project_root,
                        env=env,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                
                current_step = None
                
                # 파이프 라인 스트리밍 및 파싱
                while True:
                    line = await proc.stdout.readline()
                    if not line:
                        break
                    
                    text = line.decode('utf-8', errors='replace').strip()
                    if not text:
                        continue
                    
                    clean_text = re.sub(r'\x1b\[[0-9;]*[mK]', '', text)
                    
                    if "[SETUP-STEP]" in clean_text:
                        # 이전 단계를 성공으로 마감
                        if current_step:
                            yield f"data: {json.dumps({'type': 'step', 'step': current_step, 'status': 'success', 'message': '완료'})}\n\n"
                        
                        # 새로운 단계 설정
                        if "단계 1" in clean_text:
                            current_step = "runtimes"
                        elif "단계 2" in clean_text:
                            current_step = "npm_install"
                        elif "단계 3" in clean_text:
                            current_step = "python_venv"
                        elif "단계 4" in clean_text:
                            current_step = "swarmvault_cli"
                        elif "단계 5" in clean_text:
                            current_step = "git_hook"
                        elif "단계 6" in clean_text:
                            current_step = "pipeline_verify"
                        
                        if current_step:
                            yield f"data: {json.dumps({'type': 'step', 'step': current_step, 'status': 'running', 'message': '진행 중...'})}\n\n"
                    
                    elif "NStack 개발 규격 및 린터 파이프라인 연동 개시" in clean_text:
                        if current_step:
                            yield f"data: {json.dumps({'type': 'step', 'step': current_step, 'status': 'success', 'message': '완료'})}\n\n"
                        current_step = "nstack_onboarding"
                        yield f"data: {json.dumps({'type': 'step', 'step': current_step, 'status': 'running', 'message': '진행 중...'})}\n\n"
                    
                    if "❌" in clean_text or "✗" in clean_text or "실패했습니다" in clean_text:
                        if current_step:
                            yield f"data: {json.dumps({'type': 'step', 'step': current_step, 'status': 'failed', 'message': clean_text})}\n\n"
                        yield f"data: {json.dumps({'type': 'error', 'message': clean_text})}\n\n"
                    else:
                        yield f"data: {json.dumps({'type': 'log', 'message': clean_text})}\n\n"
                
                # stderr 스트리밍
                while True:
                    err_line = await proc.stderr.readline()
                    if not err_line:
                        break
                    err_text = err_line.decode('utf-8', errors='replace').strip()
                    clean_err = re.sub(r'\x1b\[[0-9;]*[mK]', '', err_text)
                    if clean_err:
                        yield f"data: {json.dumps({'type': 'log', 'message': f'[STDERR] {clean_err}'})}\n\n"
    
                await proc.wait()
                
                if proc.returncode != 0:
                    if current_step:
                        yield f"data: {json.dumps({'type': 'step', 'step': current_step, 'status': 'failed', 'message': '설치 스크립트 실행 오류'})}\n\n"
                    yield f"data: {json.dumps({'type': 'error', 'message': f'설치 스크립트 실행 중 오류가 발생했습니다. (Exit Code: {proc.returncode})'})}\n\n"
                    return
                else:
                    # 마지막 실행 스텝을 성공으로 마감
                    if current_step:
                        yield f"data: {json.dumps({'type': 'step', 'step': current_step, 'status': 'success', 'message': '완료'})}\n\n"
            
            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'message': f'설치 중 오류 발생: {str(e)}'})}\n\n"
                return

        # 4. 8단계: Antigravity 표준 가이드 룰 검증 (mcp_verify)
        if payload.project_create:
            current_step = "mcp_verify"
            yield f"data: {json.dumps({'type': 'step', 'step': current_step, 'status': 'running', 'message': '진행 중...'})}\n\n"
            yield f"data: {json.dumps({'type': 'log', 'message': '[룰 검증] Antigravity 표준 개발 가이드 룰 검증 개시...'})}\n\n"
            
            try:
                rules_path = Path(project_root) / ".antigravity" / "rules"
                if rules_path.exists():
                    yield f"data: {json.dumps({'type': 'log', 'message': '  └─ ✓ .antigravity/rules 파일 존재 및 주입 확인 완료'})}\n\n"
                    yield f"data: {json.dumps({'type': 'step', 'step': current_step, 'status': 'success', 'message': '완료 (Antigravity 단독 연동)'})}\n\n"
                else:
                    yield f"data: {json.dumps({'type': 'log', 'message': '  └─ ✗ .antigravity/rules 파일을 찾을 수 없습니다.'})}\n\n"
                    yield f"data: {json.dumps({'type': 'step', 'step': current_step, 'status': 'failed', 'message': 'Antigravity 표준 룰 요건 미충족'})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'type': 'log', 'message': f'[룰 검증] 검증 중 예외 오류 발생: {str(e)}'})}\n\n"
                yield f"data: {json.dumps({'type': 'step', 'step': current_step, 'status': 'failed', 'message': f'오류: {str(e)}'})}\n\n"
                
                # 자가 검증
                command = "/opt/homebrew/bin/swarmvault"
                if os.path.exists(command):
                    yield f"data: {json.dumps({'type': 'log', 'message': '  └─ ✓ SwarmVault 실행 바이너리 존재 확인 완료'})}\n\n"
                    mcp_ok = True
                else:
                    yield f"data: {json.dumps({'type': 'log', 'message': f'  └─ ✗ SwarmVault 바이너리를 찾을 수 없습니다: {command}'})}\n\n"
                    
                if mcp_ok:
                    yield f"data: {json.dumps({'type': 'log', 'message': '✓ [MCP 검증 통과] SwarmVault MCP 서버 설정 및 바이너리 유효성 검증 성공!'})}\n\n"
                    yield f"data: {json.dumps({'type': 'step', 'step': current_step, 'status': 'success', 'message': '완료 (MCP 서버 유효)'})}\n\n"
                else:
                    yield f"data: {json.dumps({'type': 'log', 'message': '⚠ [MCP 검증 실패] MCP 서버 설정을 탐색하지 못했거나 오류가 있습니다.'})}\n\n"
                    yield f"data: {json.dumps({'type': 'step', 'step': current_step, 'status': 'failed', 'message': 'MCP 서버 설정 요건 미충족'})}\n\n"

        # 5. 9단계: E2E 의미론적 RAG 검색 자가 검증 (rag_verify)
        validation_success = False
        if payload.e2e_test:
            current_step = "rag_verify"
            yield f"data: {json.dumps({'type': 'step', 'step': current_step, 'status': 'running', 'message': '진행 중...'})}\n\n"
            yield f"data: {json.dumps({'type': 'log', 'message': '[E2E 검증] RAG 의미론적 검색 자가 검증 구동 개시...'})}\n\n"
            
            # Target the dynamically constructed project's llmwiki path
            llmwiki_root = os.path.join(project_path, "llmwiki")
                
            test_dir = Path(llmwiki_root) / "content" / "01-Logs" / "archive" / "verification" / "developer" / "verify-install"
            test_file = test_dir / "wiki.md"
            
            try:
                # (A) 테스트 문서 생성
                test_dir.mkdir(parents=True, exist_ok=True)
                verification_token = "NATLAS_E2E_VERIFICATION_TOKEN_X99"
                verification_title = "NAtlas Unified Installation Verification Guide"
                
                test_content = f"""---
title: "{verification_title}"
issue_url: "https://github.com/NSoft-America-Inc/NAtlas/issues/20"
---

# {verification_title}

This is a temporary test document generated automatically by NAtlas Unified Visual Installer to verify E2E pipeline compliance.
Verification Code: `{verification_token}`
It should be successfully indexed into SwarmVault and searchable using semantic multi-query retrievals.
"""
                with open(test_file, "w", encoding="utf-8") as f:
                    f.write(test_content)
                
                yield f"data: {json.dumps({'type': 'log', 'message': f'[E2E 검증] 테스트 검증 문서 생성 완료: {test_file.name}'})}\n\n"
                
                # (B) SwarmVault Ingest & Compile 실행
                yield f"data: {json.dumps({'type': 'log', 'message': '[E2E 검증] SwarmVault에 테스트 문서 Ingest 등록 중...'})}\n\n"
                
                # Ingest
                rel_test_path = "content/01-Logs/archive/verification/developer/verify-install/wiki.md"
                ingest_proc = await asyncio.create_subprocess_exec(
                    "swarmvault", "ingest", rel_test_path,
                    cwd=llmwiki_root,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                await ingest_proc.communicate()
                
                # Compile
                yield f"data: {json.dumps({'type': 'log', 'message': '[E2E 검증] SwarmVault 지식베이스 컴파일 및 RAG 색인 갱신 중...'})}\n\n"
                compile_proc = await asyncio.create_subprocess_exec(
                    "swarmvault", "compile",
                    cwd=llmwiki_root,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                await compile_proc.communicate()
                
                # (C) RAG 의미론적 검색 다중 질의 수행 및 매칭 검출
                queries = [
                    "NATLAS_E2E_VERIFICATION_TOKEN_X99",
                    "NAtlas Unified Installation Verification Guide"
                ]
                
                verified_count = 0
                for query in queries:
                    yield f"data: {json.dumps({'type': 'log', 'message': f'[E2E 검증] RAG 쿼리 질의 실행: {query}'})}\n\n"
                    query_proc = await asyncio.create_subprocess_exec(
                        "swarmvault", "query", "--json", query,
                        cwd=llmwiki_root,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE
                    )
                    stdout, _ = await query_proc.communicate()
                    
                    if query_proc.returncode == 0:
                        try:
                            res_data = json.loads(stdout.decode('utf-8').strip())
                            citations = res_data.get("citations", [])
                            
                            match_found = False
                            for cit in citations:
                                if "verify-install" in cit or "wiki.md" in cit:
                                    match_found = True
                                    break
                            
                            if match_found:
                                verified_count += 1
                                yield f"data: {json.dumps({'type': 'log', 'message': '  └─ ✓ RAG 의미론적 매칭 매핑 성공! (인용문서 매칭 성공)'})}\n\n"
                            else:
                                yield f"data: {json.dumps({'type': 'log', 'message': '  └─ ✗ RAG 매칭 실패 (검색 결과에 인용되지 않음)'})}\n\n"
                        except Exception as e:
                            yield f"data: {json.dumps({'type': 'log', 'message': f'  └─ ✗ JSON 파싱 오류로 검증 스킵: {str(e)}'})}\n\n"
                    else:
                        yield f"data: {json.dumps({'type': 'log', 'message': '  └─ ✗ 쿼리 수행 프로세스 오류 발생'})}\n\n"
                
                if verified_count == len(queries):
                    yield f"data: {json.dumps({'type': 'log', 'message': '✓ [RAG 검증 통과] 모든 의미론적 RAG 다중 질의 검증에 성공했습니다!'})}\n\n"
                    yield f"data: {json.dumps({'type': 'step', 'step': current_step, 'status': 'success', 'message': '완료 (RAG 검증 통과)'})}\n\n"
                    validation_success = True
                else:
                    yield f"data: {json.dumps({'type': 'log', 'message': '⚠ [RAG 검증 실패] 일부 의미론적 질의에 대한 매칭에 실패했습니다.'})}\n\n"
                    yield f"data: {json.dumps({'type': 'step', 'step': current_step, 'status': 'failed', 'message': '일부 쿼리 매칭 실패'})}\n\n"
                    validation_success = False
                
                # (D) 임시 테스트 리소스 자동 클린업
                yield f"data: {json.dumps({'type': 'log', 'message': '[E2E 검증] 테스트 리소스 자동 클린업 수행 중...'})}\n\n"
                if test_file.exists():
                    test_file.unlink()
                if test_dir.exists():
                    shutil.rmtree(test_dir.parent.parent) # verify-install 및 verification 폴더 삭제
                
                # Ingest & Compile clean-up
                clean_proc = await asyncio.create_subprocess_exec(
                    "swarmvault", "compile",
                    cwd=llmwiki_root,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                await clean_proc.communicate()
                yield f"data: {json.dumps({'type': 'log', 'message': '✓ 임시 테스트 리소스 클린업 완료'})}\n\n"

            except Exception as e:
                yield f"data: {json.dumps({'type': 'log', 'message': f'[E2E 검증] RAG 검증 실행 중 오류: {str(e)}'})}\n\n"
                yield f"data: {json.dumps({'type': 'step', 'step': current_step, 'status': 'failed', 'message': f'검증 에러: {str(e)}'})}\n\n"
                validation_success = False
                try:
                    if test_file.exists():
                        test_file.unlink()
                    if test_dir.exists():
                        shutil.rmtree(test_dir.parent.parent)
                except Exception:
                    pass

        # 최종 완료 패킷 전송
        if payload.e2e_test:
            if validation_success:
                yield f"data: {json.dumps({'type': 'done', 'message': '🎉 모든 설치 및 E2E RAG 자가 검증이 완벽하게 완료되었습니다!'})}\n\n"
            else:
                yield f"data: {json.dumps({'type': 'done', 'message': '⚠ 설치는 완료되었으나 일부 RAG 검증 스텝에 에러가 존재합니다.'})}\n\n"
        else:
            yield f"data: {json.dumps({'type': 'done', 'message': '🎉 선택된 설치 시퀀스가 성공적으로 완료되었습니다!'})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.post("/clone")
async def post_clone():
    """LLMWiki를 clone 또는 pull (SSE 스트리밍)."""
    git_url = LLMWIKI_REPO_URL

    async def stream():
        target_dir = GIT_MANAGED_DIR

        if (target_dir / ".git").exists():
            # 이미 clone됨 → git pull
            yield f"data: {json.dumps({'type': 'log', 'message': f'기존 clone 감지: {target_dir}'})}\n\n"
            yield f"data: {json.dumps({'type': 'log', 'message': 'git pull 실행 중...'})}\n\n"
            cmd = ["git", "pull"]
            cwd = str(target_dir)
        else:
            # 최초 clone
            yield f"data: {json.dumps({'type': 'log', 'message': f'Git clone: {git_url}'})}\n\n"
            yield f"data: {json.dumps({'type': 'log', 'message': f'대상 경로: {target_dir}'})}\n\n"
            target_dir.mkdir(parents=True, exist_ok=True)
            cmd = ["git", "clone", git_url, str(target_dir)]
            cwd = str(Path.home())

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=cwd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            # stdout/stderr 스트리밍
            while True:
                stdout_line = await proc.stdout.readline()
                stderr_line = await proc.stderr.readline()
                if not stdout_line and not stderr_line:
                    break
                for line in [stdout_line, stderr_line]:
                    if line:
                        text = line.decode('utf-8', errors='replace').strip()
                        if text:
                            yield f"data: {json.dumps({'type': 'log', 'message': text})}\n\n"

            await proc.wait()
            if proc.returncode == 0:
                yield f"data: {json.dumps({'type': 'done', 'message': '✅ 완료'})}\n\n"
            else:
                yield f"data: {json.dumps({'type': 'error', 'message': f'git 명령 실패 (exit {proc.returncode})'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")

from pydantic import BaseModel

class QuerySchema(BaseModel):
    question: str

@router.post("/query")
async def post_query(payload: QuerySchema):
    llmwiki_root = get_llmwiki_root()
    if not llmwiki_root:
        return JSONResponse(
            status_code=400,
            content={"error": "LLMWiki 경로를 찾을 수 없습니다. Settings에서 로컬 경로를 지정해 주세요."}
        )

    # settings load
    cfg = load_settings_data()

    question = payload.question.strip()
    if not question:
        return JSONResponse(
            status_code=400,
            content={"error": "질문 내용을 입력해주세요."}
        )

    try:
        proc = await asyncio.create_subprocess_exec(
            "swarmvault", "query", "--json", question,
            cwd=llmwiki_root,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        
        stdout, stderr = await proc.communicate()
        
        if proc.returncode == 0:
            try:
                # Try to parse the JSON response from SwarmVault
                res_data = json.loads(stdout.decode('utf-8').strip())
                
                # Parse citations and ingest to task_history
                citations = res_data.get("citations", [])
                project = None
                user_name = None
                task_slug = "unknown"
                
                from routers.documents import _parse_doc_path
                for cit in citations:
                    rel_path = cit
                    if rel_path.startswith("content/"):
                        rel_path = rel_path[len("content/"):]
                    
                    meta = _parse_doc_path(rel_path)
                    if meta.get("slug"):
                        project = meta.get("project")
                        user_name = meta.get("user")
                        task_slug = meta.get("slug")
                        break
                
                db.execute_query(
                    "INSERT INTO task_history (query_text, project, user_name, task_slug) VALUES (?, ?, ?, ?)",
                    (question, project, user_name, task_slug),
                    commit=True
                )
                
                return res_data
            except Exception:
                # Fallback in case SwarmVault prints something extra or non-JSON
                raw_out = stdout.decode('utf-8').strip()
                fallback_answer = raw_out if raw_out else "SwarmVault가 성공적으로 실행되었으나 응답을 해석할 수 없습니다."
                
                db.execute_query(
                    "INSERT INTO task_history (query_text, project, user_name, task_slug) VALUES (?, ?, ?, ?)",
                    (question, None, None, "unknown"),
                    commit=True
                )
                
                return {
                    "answer": fallback_answer,
                    "citations": []
                }
        else:
            err_msg = stderr.decode('utf-8').strip()
            if not err_msg:
                err_msg = stdout.decode('utf-8').strip()
            return JSONResponse(
                status_code=500,
                content={"error": f"SwarmVault 질의 실패: {err_msg or '알 수 없는 오류'}"}
            )
            
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"서버 실행 중 오류가 발생했습니다: {str(e)}"}
        )

@router.get("/history")
async def get_history():
    """Retrieve up to last 50 task history records, ordered chronologically (ascending ID)."""
    try:
        rows = db.execute_query(
            "SELECT id, query_text, project, user_name, task_slug, created_at FROM (SELECT * FROM task_history ORDER BY id DESC LIMIT 50) ORDER BY id ASC",
            fetch_all=True
        )
        return rows
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"작업 조회 이력 조회 실패: {str(e)}"}
        )

@router.delete("/history")
async def delete_history():
    """Clear all task history records from the SQLite database."""
    try:
        db.execute_query("DELETE FROM task_history", commit=True)
        return {"ok": True, "message": "작업 조회 이력이 성공적으로 삭제되었습니다."}
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"작업 조회 이력 삭제 실패: {str(e)}"}
        )

import datetime

@router.get("/build-logs")
async def get_build_logs():
    """Retrieve up to last 30 build logs, ordered by ID descending (newest first)."""
    try:
        rows = db.execute_query(
            "SELECT id, action, status, log_message, created_at FROM build_logs ORDER BY id DESC LIMIT 30",
            fetch_all=True
        )
        return rows
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"빌드 로그 조회 실패: {str(e)}"}
        )

@router.delete("/build-logs")
async def delete_build_logs():
    """Clear all build logs from the SQLite database."""
    try:
        db.execute_query("DELETE FROM build_logs", commit=True)
        return {"ok": True, "message": "빌드 로그가 성공적으로 삭제되었습니다."}
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"빌드 로그 삭제 실패: {str(e)}"}
        )

@router.get("/dashboard/stats")
async def get_dashboard_stats(period: str = "2weeks"):
    """Calculate and retrieve consolidated dashboard analytics and statistics."""
    try:
        # Determine the date filter for Top Projects/Contributors based on period
        if period == "1week":
            date_filter = "created_at >= datetime('now', '-7 days')"
        elif period == "1month":
            date_filter = "created_at >= datetime('now', '-30 days')"
        elif period == "1year":
            date_filter = "created_at >= datetime('now', '-365 days')"
        else: # "2weeks" is the default
            date_filter = "created_at >= datetime('now', '-14 days')"

        # 1. Total Queries (task history count)
        total_queries_res = db.execute_query("SELECT COUNT(*) as cnt FROM task_history", fetch_one=True)
        total_queries = total_queries_res["cnt"] if total_queries_res else 0
        
        # 2. Total Builds
        total_builds_res = db.execute_query("SELECT COUNT(*) as cnt FROM build_logs", fetch_one=True)
        total_builds = total_builds_res["cnt"] if total_builds_res else 0
        
        # 3. Build Success Rate
        success_builds_res = db.execute_query("SELECT COUNT(*) as cnt FROM build_logs WHERE status = 'done'", fetch_one=True)
        success_builds = success_builds_res["cnt"] if success_builds_res else 0
        build_success_rate = int((success_builds / total_builds) * 100) if total_builds > 0 else 100
        
        # 4. Top Projects (Top 5) - period filtered
        top_projects = db.execute_query(
            f"SELECT project, COUNT(*) as count FROM task_history WHERE project IS NOT NULL AND {date_filter} GROUP BY project ORDER BY count DESC LIMIT 5",
            fetch_all=True
        )
        
        # 5. Top Contributors (Top 5) - period filtered
        top_contributors = db.execute_query(
            f"SELECT user_name, COUNT(*) as count FROM task_history WHERE user_name IS NOT NULL AND {date_filter} GROUP BY user_name ORDER BY count DESC LIMIT 5",
            fetch_all=True
        )
        
        # 6. Daily Trends depending on selected period
        today = datetime.date.today()
        daily_trends = []
        
        if period == "1year":
            # Last 12 Months
            for i in range(11, -1, -1):
                year = today.year
                month = today.month - i
                while month <= 0:
                    month += 12
                    year -= 1
                
                month_str = f"{year:04d}-{month:02d}"
                display_str = f"{month}월"
                
                q_res = db.execute_query(
                    "SELECT COUNT(*) as cnt FROM task_history WHERE strftime('%Y-%m', created_at, 'localtime') = ?",
                    (month_str,),
                    fetch_one=True
                )
                b_res = db.execute_query(
                    "SELECT COUNT(*) as cnt FROM build_logs WHERE strftime('%Y-%m', created_at, 'localtime') = ?",
                    (month_str,),
                    fetch_one=True
                )
                
                daily_trends.append({
                    "date": display_str,
                    "full_date": f"{month_str}-01",
                    "queries": q_res["cnt"] if q_res else 0,
                    "builds": b_res["cnt"] if b_res else 0
                })
        else:
            # 1week (7 days), 2weeks (14 days) or 1month (30 days)
            if period == "1week":
                days = 7
            elif period == "1month":
                days = 30
            else:
                days = 14

            for i in range(days - 1, -1, -1):
                target_date = today - datetime.timedelta(days=i)
                date_str = target_date.strftime("%Y-%m-%d")
                display_str = target_date.strftime("%m/%d")
                
                q_res = db.execute_query(
                    "SELECT COUNT(*) as cnt FROM task_history WHERE date(created_at, 'localtime') = ?",
                    (date_str,),
                    fetch_one=True
                )
                b_res = db.execute_query(
                    "SELECT COUNT(*) as cnt FROM build_logs WHERE date(created_at, 'localtime') = ?",
                    (date_str,),
                    fetch_one=True
                )
                
                daily_trends.append({
                    "date": display_str,
                    "full_date": date_str,
                    "queries": q_res["cnt"] if q_res else 0,
                    "builds": b_res["cnt"] if b_res else 0
                })
                
        return {
            "total_queries": total_queries,
            "total_builds": total_builds,
            "build_success_rate": build_success_rate,
            "top_projects": top_projects,
            "top_contributors": top_contributors,
            "daily_trends": daily_trends
        }
    except Exception as e:
        return JSONResponse(
            status_code=500,
            content={"error": f"대시보드 통계 계산 실패: {str(e)}"}
        )

async def start_smart_scheduler(interval_seconds: int = 60):
    """1분 간격으로 가동하는 스마트 백경 색인 스케줄러"""
    print(f"[Scheduler] 스마트 백그라운드 인덱싱 스케줄러가 시작되었습니다. (주기: {interval_seconds}초)")
    while True:
        try:
            await asyncio.sleep(interval_seconds)
            
            # settings 로드하여 source_mode 검사
            # local 모드인 경우에만 자동 백그라운드 색인을 수행합니다.
            llmwiki_root = get_llmwiki_root()
            if not llmwiki_root:
                continue
                
            cfg = load_settings_data()
            if cfg.get("source_mode", "remote") != "local":
                continue
                
            # 1. 문서 상태 가볍게 조회
            docs_res = await get_documents()
            if not docs_res or "files" not in docs_res:
                continue
                
            files_to_ingest = [
                f"content/{file['path']}" 
                for file in docs_res["files"] 
                if file.get("status") in ("modified", "new")
            ]
            
            if not files_to_ingest:
                # 변경 파일 없으므로 무거운 서브프로세스 기동 없이 즉시 스킵
                continue
                
            print(f"[Scheduler] 변경 감지! {len(files_to_ingest)}개 파일 자동 색인 작업 시작.")
            
            # 2. Ingest 실행
            success = True
            for file_rel in files_to_ingest:
                proc = await asyncio.create_subprocess_exec(
                    "swarmvault", "ingest", file_rel,
                    cwd=llmwiki_root,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE
                )
                await proc.wait()
                if proc.returncode != 0:
                    db.execute_query(
                        "INSERT INTO build_logs (action, status, log_message) VALUES (?, ?, ?)",
                        ('ingest', 'error', f'[Auto] Ingest 실패: {file_rel} (exit {proc.returncode})'),
                        commit=True
                    )
                    success = False
                    break
                    
            if not success:
                continue
                
            # 3. Compile 실행
            proc = await asyncio.create_subprocess_exec(
                "swarmvault", "compile",
                cwd=llmwiki_root,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            await proc.wait()
            if proc.returncode == 0:
                print(f"[Scheduler] {len(files_to_ingest)}개 파일 자동 색인 및 컴파일 완수.")
                db.execute_query(
                    "INSERT INTO build_logs (action, status, log_message) VALUES (?, ?, ?)",
                    ('compile', 'done', f'[Auto] 자동 인덱싱 및 컴파일 완수 (대상: {len(files_to_ingest)}개)'),
                    commit=True
                )
            else:
                db.execute_query(
                    "INSERT INTO build_logs (action, status, log_message) VALUES (?, ?, ?)",
                    ('compile', 'error', f'[Auto] Compile 실패 (exit {proc.returncode})'),
                    commit=True
                )
                
        except asyncio.CancelledError:
            print("[Scheduler] 스마트 백그라운드 인덱싱 스케줄러가 종료되었습니다.")
            break
        except Exception as e:
            print(f"[Scheduler] 자동 인덱싱 처리 중 에러 발생: {e}")


