import sys
import os
import json
import asyncio
from pathlib import Path
from fastapi import APIRouter
from fastapi.responses import StreamingResponse, JSONResponse
from routers.settings import CONFIG_FILE, GIT_MANAGED_DIR, LLMWIKI_REPO_URL, load_settings as load_settings_data
from routers.documents import get_documents, get_llmwiki_root
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
async def get_dashboard_stats():
    """Calculate and retrieve consolidated dashboard analytics and statistics."""
    try:
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
        
        # 4. Top Projects (Top 5)
        top_projects = db.execute_query(
            "SELECT project, COUNT(*) as count FROM task_history WHERE project IS NOT NULL GROUP BY project ORDER BY count DESC LIMIT 5",
            fetch_all=True
        )
        
        # 5. Top Contributors (Top 5)
        top_contributors = db.execute_query(
            "SELECT user_name, COUNT(*) as count FROM task_history WHERE user_name IS NOT NULL GROUP BY user_name ORDER BY count DESC LIMIT 5",
            fetch_all=True
        )
        
        # 6. Daily Trends (Last 7 Days)
        today = datetime.date.today()
        daily_trends = []
        for i in range(6, -1, -1):
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

