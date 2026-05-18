import os
import json
import hashlib
from datetime import datetime
from pathlib import Path
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from routers.settings import CONFIG_FILE

router = APIRouter()

def get_llmwiki_root():
    if not CONFIG_FILE.exists():
        return None
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            path = data.get("llmwiki_root", "")
            return path if path and os.path.exists(path) else None
    except Exception:
        return None

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
    if not manifests_dir.exists() or not manifests_dir.is_dir():
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

@router.get("")
async def get_documents():
    llmwiki_root = get_llmwiki_root()
    if not llmwiki_root:
        return JSONResponse(
            status_code=500,
            content={"error": "LLMWiki 경로를 찾을 수 없습니다"}
        )

    content_dir = Path(llmwiki_root) / "content"
    if not content_dir.exists() or not content_dir.is_dir():
        return JSONResponse(
            status_code=500,
            content={"error": "content/ 폴더를 찾을 수 없습니다"}
        )

    # Load all manifests once
    manifests = load_manifests(llmwiki_root)

    files_list = []
    summary = {
        "total": 0,
        "indexed": 0,
        "modified": 0,
        "new": 0
    }

    # Find all *.md files recursively, ignoring hidden folders and files starting with '.'
    for root, dirs, files in os.walk(content_dir):
        # Modify dirs in-place to skip hidden directories
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        
        for file in files:
            if file.startswith('.') or not file.endswith('.md'):
                continue

            file_path = Path(root) / file
            
            # Get relative path from content/ (e.g. "01-Logs/archive/memo/dev-a/order.md")
            try:
                rel_path = str(file_path.relative_to(content_dir))
            except ValueError:
                continue

            # SwarmVault uses "content/" + rel_path as repoRelativePath
            repo_rel_path = f"content/{rel_path}"

            # Calculate modified time
            try:
                mtime = os.path.getmtime(file_path)
                modified_at = datetime.fromtimestamp(mtime).isoformat()
            except Exception:
                modified_at = datetime.now().isoformat()

            # Resolve index status
            status = 'new'
            md5_val, sha256_val = compute_hashes(file_path)

            # Find matching manifest
            matching_manifest = next((m for m in manifests if m["repoRelativePath"] == repo_rel_path), None)
            
            if matching_manifest:
                source_hash = matching_manifest["sourceHash"]
                # Match against either MD5 or SHA256 hash
                if source_hash in (md5_val, sha256_val):
                    status = 'indexed'
                    summary["indexed"] += 1
                else:
                    status = 'modified'
                    summary["modified"] += 1
            else:
                status = 'new'
                summary["new"] += 1

            files_list.append({
                "path": rel_path,
                "status": status,
                "modified_at": modified_at
            })
            summary["total"] += 1

    # Sort files by modified time descending (newest first)
    files_list.sort(key=lambda x: x["modified_at"], reverse=True)

    return {
        "files": files_list,
        "summary": summary
    }
