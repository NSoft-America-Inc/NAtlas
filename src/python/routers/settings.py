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
LLMWIKI_REPO_URL = "https://github.com/NSoft-America-Inc/NSoft-LLMWiki.git"
LLMWIKI_REPO = "NSoft-America-Inc/NSoft-LLMWiki"

class SettingsSchema(BaseModel):
    source_mode: str = "remote"   # 'remote' | 'local'
    github_token: str = ""
    llmwiki_root: str = ""

def load_settings():
    defaults = {"source_mode": "remote", "github_token": "", "llmwiki_root": ""}
    if not CONFIG_FILE.exists():
        return defaults
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return {
                "source_mode": data.get("source_mode", "remote"),
                "github_token": data.get("github_token", ""),
                "llmwiki_root": data.get("llmwiki_root", ""),
            }
    except Exception:
        return defaults

def save_settings(settings: dict):
    try:
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(settings, f, ensure_ascii=False, indent=2)
    except Exception:
        pass

@router.get("")
async def get_settings():
    return load_settings()

@router.put("")
async def put_settings(settings: SettingsSchema):
    mode = settings.source_mode.strip()

    if mode == "remote":
        token = settings.github_token.strip()
        if not token:
            return JSONResponse(status_code=400, content={"error": "GitHub Token을 입력해주세요"})
        save_settings({"source_mode": "remote", "github_token": token, "llmwiki_root": ""})
        return {"ok": True}

    else:  # local
        root_path = settings.llmwiki_root.strip()
        if not root_path:
            return JSONResponse(status_code=400, content={"error": "LLMWiki 루트 경로를 입력해주세요"})
        config_json_path = os.path.join(root_path, "swarmvault.config.json")
        if not os.path.exists(config_json_path):
            return JSONResponse(status_code=400, content={"error": "swarmvault.config.json을 찾을 수 없습니다"})
        save_settings({"source_mode": "local", "github_token": "", "llmwiki_root": root_path})
        return {"ok": True}
