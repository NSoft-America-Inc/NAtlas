import os
import json
from pathlib import Path
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

router = APIRouter()

CONFIG_DIR = Path.home() / ".natlas"
CONFIG_FILE = CONFIG_DIR / "config.json"

GIT_MANAGED_DIR = Path.home() / ".natlas" / "llmwiki"

class SettingsSchema(BaseModel):
    source_mode: str = "git"      # 'git' | 'local'
    git_repo_url: str = ""
    llmwiki_root: str = ""

def load_settings():
    if not CONFIG_FILE.exists():
        return {"source_mode": "git", "git_repo_url": "", "llmwiki_root": ""}
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return {
                "source_mode": data.get("source_mode", "git"),
                "git_repo_url": data.get("git_repo_url", ""),
                "llmwiki_root": data.get("llmwiki_root", ""),
            }
    except Exception:
        return {"source_mode": "git", "git_repo_url": "", "llmwiki_root": ""}

def save_settings(settings):
    try:
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(settings, f, ensure_ascii=False, indent=2)
    except Exception as e:
        pass

@router.get("")
async def get_settings():
    return load_settings()

@router.put("")
async def put_settings(settings: SettingsSchema):
    mode = settings.source_mode.strip()

    if mode == "git":
        url = settings.git_repo_url.strip()
        if not url:
            return JSONResponse(status_code=400, content={"error": "Git repo URL을 입력해주세요"})
        if not (url.startswith("https://") or url.startswith("git@")):
            return JSONResponse(status_code=400, content={"error": "올바른 Git URL을 입력해주세요 (https:// 또는 git@)"})
        # 자동 관리 경로로 llmwiki_root 세팅
        save_settings({
            "source_mode": "git",
            "git_repo_url": url,
            "llmwiki_root": str(GIT_MANAGED_DIR),
        })
        return {"ok": True}

    else:  # local
        root_path = settings.llmwiki_root.strip()
        if not root_path:
            return JSONResponse(status_code=400, content={"error": "LLMWiki 루트 경로를 입력해주세요"})
        config_json_path = os.path.join(root_path, "swarmvault.config.json")
        if not os.path.exists(config_json_path):
            return JSONResponse(status_code=400, content={"error": "swarmvault.config.json을 찾을 수 없습니다"})
        save_settings({"source_mode": "local", "git_repo_url": "", "llmwiki_root": root_path})
        return {"ok": True}
