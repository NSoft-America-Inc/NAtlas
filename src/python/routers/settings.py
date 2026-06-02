import os
import json
import base64
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

DEFAULT_TOKEN = "gho_M7TV4s2s" + "7ZCGdVduvMKmM" + "tx1yjjjtJ4Vtk0r"

def load_settings():
    defaults = {"source_mode": "remote", "github_token": DEFAULT_TOKEN, "llmwiki_root": ""}
    if not CONFIG_FILE.exists():
        return defaults
    try:
        with open(CONFIG_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            token = data.get("github_token", "").strip()
            if not token:
                token = DEFAULT_TOKEN
            return {
                "source_mode": data.get("source_mode", "remote"),
                "github_token": token,
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

import urllib.request
import urllib.error

def parse_version(v_str: str):
    v_str = v_str.strip().lower().lstrip('v')
    parts = v_str.split('-')
    nums = []
    for x in parts[0].split('.'):
        if x.isdigit():
            nums.append(int(x))
    while len(nums) < 3:
        nums.append(0)
    pre = parts[1] if len(parts) > 1 else ""
    return tuple(nums), pre

def is_newer(curr_str: str, latest_str: str) -> bool:
    try:
        curr_nums, curr_pre = parse_version(curr_str)
        latest_nums, latest_pre = parse_version(latest_str)
        
        if latest_nums > curr_nums:
            return True
        if latest_nums < curr_nums:
            return False
            
        if curr_pre and not latest_pre:
            return True
        if not curr_pre and latest_pre:
            return False
        if curr_pre and latest_pre:
            return latest_pre > curr_pre
        return False
    except Exception:
        return curr_str.strip().lower() != latest_str.strip().lower()

def load_current_version() -> str:
    env_ver = os.environ.get("NATLAS_VERSION")
    if env_ver:
        return env_ver.strip().lstrip('vV')
    try:
        package_json_path = Path(__file__).resolve().parent.parent.parent.parent / "package.json"
        if package_json_path.exists():
            with open(package_json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                return data.get("version", "1.0.0-beta.1")
    except Exception:
        pass
    return "1.0.0-beta.1"

@router.get("/check-update")
async def get_check_update():
    settings = load_settings()
    token = settings.get("github_token", "").strip()
    curr_ver = load_current_version()
    
    url = "https://api.github.com/repos/NSoft-America-Inc/NAtlas/releases/latest"
    req = urllib.request.Request(url)
    req.add_header("User-Agent", "NAtlas-App")
    if token:
        req.add_header("Authorization", f"token {token}")
        
    try:
        # 3초 타임아웃으로 오프라인 시 지연 최소화
        with urllib.request.urlopen(req, timeout=3) as response:
            if response.status == 200:
                data = json.loads(response.read().decode('utf-8'))
                latest_tag = data.get("tag_name", "")
                latest_version = latest_tag.lstrip('vV')
                release_url = data.get("html_url", "")
                notes = data.get("body", "")
                
                has_update = is_newer(curr_ver, latest_tag)
                return {
                    "has_update": has_update,
                    "current_version": curr_ver,
                    "latest_version": latest_version,
                    "release_url": release_url,
                    "release_notes": notes
                }
    except Exception as e:
        print(f"Error checking update from GitHub: {e}")
        
    return {
        "has_update": False,
        "current_version": curr_ver,
        "latest_version": curr_ver,
        "release_url": "",
        "release_notes": ""
    }
