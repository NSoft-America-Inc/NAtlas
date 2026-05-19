import sys
import os
import json
import asyncio
from pathlib import Path
from fastapi import APIRouter
from fastapi.responses import StreamingResponse, JSONResponse
from routers.settings import CONFIG_FILE, GIT_MANAGED_DIR, load_settings as load_settings_data
from routers.documents import get_documents, get_llmwiki_root

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
            version_str = stdout.decode().strip()
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
                        msg = stdout_line.decode().strip()
                        if msg:
                            yield f"data: {json.dumps({'type': 'log', 'message': msg})}\n\n"
                    if stderr_line:
                        msg = stderr_line.decode().strip()
                        if msg:
                            yield f"data: {json.dumps({'type': 'log', 'message': msg})}\n\n"
                
                await proc.wait()
                if proc.returncode != 0:
                    yield f"data: {json.dumps({'type': 'error', 'message': f'ingest 실패: {file_rel} (종료 코드: {proc.returncode})'})}\n\n"
                    success = False
                    break
            except Exception as e:
                yield f"data: {json.dumps({'type': 'error', 'message': f'ingest 명령 실행 중 오류 발생: {str(e)}'})}\n\n"
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
                    msg = stdout_line.decode().strip()
                    if msg:
                        yield f"data: {json.dumps({'type': 'log', 'message': msg})}\n\n"
                if stderr_line:
                    msg = stderr_line.decode().strip()
                    if msg:
                        yield f"data: {json.dumps({'type': 'log', 'message': msg})}\n\n"
            
            await proc.wait()
            if proc.returncode == 0:
                yield f"data: {json.dumps({'type': 'done', 'message': '✅ 완료'})}\n\n"
            else:
                yield f"data: {json.dumps({'type': 'error', 'message': f'compile 실패 (종료 코드: {proc.returncode})'})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': f'compile 명령 실행 중 오류 발생: {str(e)}'})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.post("/clone")
async def post_clone():
    """Git repo URL로 LLMWiki를 clone 또는 pull (SSE 스트리밍)."""
    settings = load_settings_data()  # settings.py의 load_settings() 사용
    git_url = settings.get("git_repo_url", "").strip()

    if not git_url:
        return JSONResponse(status_code=400, content={"error": "Git repo URL이 설정되지 않았습니다"})

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
                    text = line.decode().strip()
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
