import os
import json
import base64
import hashlib
import asyncio
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path
from typing import Optional
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from routers.settings import CONFIG_FILE, LLMWIKI_REPO

router = APIRouter()

GITHUB_API = "https://api.github.com"
LLMWIKI_BRANCH = "main"

# PARA 카테고리 접두사 → 사람이 읽기 좋은 이름
PARA_LABELS = {
    "00-System": "System",
    "01-Logs": "Logs",
    "02-Entities": "Entities",
    "03-Sources": "Sources",
    "02-Resources": "Resources",
    "99-Fixtures": "Fixtures",
}

def _parse_doc_path(rel_path: str) -> dict:
    """rel_path: content/ 기준 상대경로. category/project/user/slug/doc_type 추출."""
    parts = rel_path.split("/")
    top = parts[0] if parts else ""
    category = PARA_LABELS.get(top, top)

    # 01-Logs/archive/{project}/{user}/{slug}/{file}.md
    if top == "01-Logs" and len(parts) >= 3 and parts[1] == "archive":
        filename = parts[5] if len(parts) > 5 else (parts[4] if len(parts) > 4 else None)
        doc_type = filename.replace(".md", "") if filename else None
        # doc_type: order | report | knowledge | (기타 파일명)
        return {
            "category": category,
            "project": parts[2] if len(parts) > 2 else None,
            "user": parts[3] if len(parts) > 3 else None,
            "slug": parts[4] if len(parts) > 4 else None,
            "doc_type": doc_type,
        }
    return {"category": category, "project": None, "user": None, "slug": None, "doc_type": None}

# ── Helpers ──────────────────────────────────────────────────────────────────

def load_config() -> dict:
    if not CONFIG_FILE.exists():
        return {}
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}

def get_llmwiki_root() -> Optional[str]:
    data = load_config()
    path = data.get("llmwiki_root", "")
    return path if path and os.path.exists(path) else None

def get_github_token() -> str:
    return load_config().get("github_token", "")

# ── GitHub API ───────────────────────────────────────────────────────────────

def _gh_get(path: str, token: str) -> dict:
    url = f"{GITHUB_API}{path}"
    req = urllib.request.Request(url)
    req.add_header("Authorization", f"token {token}")
    req.add_header("Accept", "application/vnd.github.v3+json")
    req.add_header("User-Agent", "NAtlas/1.0")
    with urllib.request.urlopen(req, timeout=20) as res:
        return json.loads(res.read().decode())

async def get_remote_documents(token: str) -> dict:
    loop = asyncio.get_event_loop()

    # 1. Fetch full git tree (1 API call)
    tree_data = await loop.run_in_executor(
        None, _gh_get,
        f"/repos/{LLMWIKI_REPO}/git/trees/{LLMWIKI_BRANCH}?recursive=1",
        token
    )
    tree = tree_data.get("tree", [])

    content_files = [
        item for item in tree
        if item["path"].startswith("content/") and item["path"].endswith(".md") and item["type"] == "blob"
    ]
    manifest_blobs = [
        item for item in tree
        if item["path"].startswith("state/manifests/") and item["path"].endswith(".json") and item["type"] == "blob"
    ]

    # 2. Fetch manifests in parallel → build indexed path set
    async def fetch_manifest_paths(sha: str) -> set:
        try:
            blob = await loop.run_in_executor(
                None, _gh_get, f"/repos/{LLMWIKI_REPO}/git/blobs/{sha}", token
            )
            raw = base64.b64decode(blob["content"].replace("\n", "")).decode()
            data = json.loads(raw)
            if "repoRelativePath" in data:
                return {data["repoRelativePath"]}
        except Exception:
            pass
        return set()

    results = await asyncio.gather(*[fetch_manifest_paths(m["sha"]) for m in manifest_blobs])
    indexed_paths = set().union(*results) if results else set()

    # 3. Build files list
    files_list = []
    summary = {"total": 0, "indexed": 0, "modified": 0, "new": 0}

    for item in content_files:
        repo_rel = item["path"]             # "content/01-Logs/..."
        rel_path = repo_rel[len("content/"):]   # "01-Logs/..."
        meta = _parse_doc_path(rel_path)

        if repo_rel in indexed_paths:
            status = "indexed"
            summary["indexed"] += 1
        else:
            status = "new"
            summary["new"] += 1

        files_list.append({
            "path": rel_path,
            "status": status,
            "modified_at": None,
            "category": meta["category"],
            "project": meta["project"],
            "user": meta["user"],
            "slug": meta.get("slug"),
            "doc_type": meta.get("doc_type"),
        })
        summary["total"] += 1

    files_list.sort(key=lambda x: x["path"])
    return {"files": files_list, "summary": summary}

# ── Local filesystem ─────────────────────────────────────────────────────────

def compute_hashes(file_path):
    md5_hash = hashlib.md5()
    sha256_hash = hashlib.sha256()
    try:
        with open(file_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                md5_hash.update(chunk)
                sha256_hash.update(chunk)
        return md5_hash.hexdigest(), sha256_hash.hexdigest()
    except Exception:
        return "", ""

def load_manifests(llmwiki_root):
    manifests = []
    manifests_dir = Path(llmwiki_root) / "state" / "manifests"
    if not manifests_dir.exists():
        return manifests
    for file in manifests_dir.glob("*.json"):
        try:
            with open(file, "r", encoding="utf-8") as f:
                data = json.load(f)
                if "repoRelativePath" in data and "sourceHash" in data:
                    manifests.append({
                        "repoRelativePath": data["repoRelativePath"],
                        "sourceHash": data["sourceHash"]
                    })
        except Exception:
            continue
    return manifests

def get_local_documents(llmwiki_root: str) -> dict:
    content_dir = Path(llmwiki_root) / "content"
    if not content_dir.exists():
        return None

    manifests = load_manifests(llmwiki_root)
    files_list = []
    summary = {"total": 0, "indexed": 0, "modified": 0, "new": 0}

    for root, dirs, files in os.walk(content_dir):
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        for file in files:
            if file.startswith('.') or not file.endswith('.md'):
                continue
            file_path = Path(root) / file
            try:
                rel_path = str(file_path.relative_to(content_dir))
            except ValueError:
                continue

            repo_rel_path = f"content/{rel_path}"
            try:
                mtime = os.path.getmtime(file_path)
                modified_at = datetime.fromtimestamp(mtime).isoformat()
            except Exception:
                modified_at = datetime.now().isoformat()

            md5_val, sha256_val = compute_hashes(file_path)
            matching = next((m for m in manifests if m["repoRelativePath"] == repo_rel_path), None)

            if matching:
                if matching["sourceHash"] in (md5_val, sha256_val):
                    status = "indexed"; summary["indexed"] += 1
                else:
                    status = "modified"; summary["modified"] += 1
            else:
                status = "new"; summary["new"] += 1

            meta = _parse_doc_path(rel_path)
            files_list.append({
                "path": rel_path,
                "status": status,
                "modified_at": modified_at,
                "category": meta["category"],
                "project": meta["project"],
                "user": meta["user"],
                "slug": meta.get("slug"),
                "doc_type": meta.get("doc_type"),
            })
            summary["total"] += 1

    files_list.sort(key=lambda x: x["modified_at"] or "", reverse=True)
    return {"files": files_list, "summary": summary}

# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("/content")
async def get_document_content(path: str):
    """문서 내용 반환 (remote: GitHub API, local: filesystem)"""
    cfg = load_config()
    mode = cfg.get("source_mode", "remote")

    if mode == "remote":
        token = cfg.get("github_token", "")
        if not token:
            return JSONResponse(status_code=500, content={"error": "GitHub Token이 설정되지 않았습니다"})
        full_path = f"content/{path}"
        try:
            loop = asyncio.get_event_loop()
            data = await loop.run_in_executor(
                None, _gh_get,
                f"/repos/{LLMWIKI_REPO}/contents/{full_path}",
                token
            )
            content = base64.b64decode(data["content"].replace("\n", "")).decode("utf-8")
            return {"path": path, "content": content}
        except urllib.error.HTTPError as e:
            return JSONResponse(status_code=e.code, content={"error": f"GitHub API 오류: {e.code} {e.reason}"})
        except Exception as e:
            return JSONResponse(status_code=500, content={"error": str(e)})
    else:
        llmwiki_root = get_llmwiki_root()
        if not llmwiki_root:
            return JSONResponse(status_code=500, content={"error": "LLMWiki 경로를 찾을 수 없습니다"})
        file_path = Path(llmwiki_root) / "content" / path
        if not file_path.exists():
            return JSONResponse(status_code=404, content={"error": "파일을 찾을 수 없습니다"})
        try:
            return {"path": path, "content": file_path.read_text(encoding="utf-8")}
        except Exception as e:
            return JSONResponse(status_code=500, content={"error": str(e)})

@router.get("")
async def get_documents():
    cfg = load_config()
    mode = cfg.get("source_mode", "remote")

    if mode == "remote":
        token = cfg.get("github_token", "")
        if not token:
            return JSONResponse(status_code=500, content={"error": "GitHub Token이 설정되지 않았습니다"})
        try:
            return await get_remote_documents(token)
        except urllib.error.HTTPError as e:
            return JSONResponse(status_code=500, content={"error": f"GitHub API 오류: {e.code} {e.reason}"})
        except Exception as e:
            return JSONResponse(status_code=500, content={"error": str(e)})

    else:  # local
        llmwiki_root = get_llmwiki_root()
        if not llmwiki_root:
            return JSONResponse(status_code=500, content={"error": "LLMWiki 경로를 찾을 수 없습니다"})
        result = get_local_documents(llmwiki_root)
        if result is None:
            return JSONResponse(status_code=500, content={"error": "content/ 폴더를 찾을 수 없습니다"})
        return result
