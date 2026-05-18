import os
import json
from pathlib import Path
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

router = APIRouter()

CONFIG_DIR = Path.home() / ".natlas"
CONFIG_FILE = CONFIG_DIR / "config.json"

class SettingsSchema(BaseModel):
    llmwiki_root: str

def load_settings():
    if not CONFIG_FILE.exists():
        return {"llmwiki_root": ""}
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return {"llmwiki_root": data.get("llmwiki_root", "")}
    except Exception:
        return {"llmwiki_root": ""}

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
    root_path = settings.llmwiki_root.strip()
    if not root_path:
        return JSONResponse(
            status_code=400,
            content={"error": "LLMWiki 루트 경로를 입력해주세요"}
        )

    # Validate that swarmvault.config.json exists inside the directory
    config_json_path = os.path.join(root_path, "swarmvault.config.json")
    if not os.path.exists(config_json_path):
        return JSONResponse(
            status_code=400,
            content={"error": "swarmvault.config.json을 찾을 수 없습니다"}
        )
    
    save_settings({"llmwiki_root": root_path})
    return {"ok": True}
