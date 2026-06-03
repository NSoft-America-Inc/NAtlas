#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
import sys
import json
import urllib.request

def select_best_token():
    tokens = []
    # 1. Secrets에 등록된 후보 토큰 수집
    for i in range(1, 6):
        t = os.environ.get(f"GH_TOKEN_{i}", "").strip()
        if t:
            tokens.append(t)
    
    # 2. 기본 GITHUB_TOKEN 수집
    default_token = os.environ.get("GITHUB_TOKEN", "").strip()
    if default_token:
        tokens.append(default_token)
        
    if not tokens:
        print("", end="") # 토큰이 없을 경우 빈 문자열 반환
        return

    best_token = tokens[0]
    max_remaining = -1

    # 3. 각 토큰별 남은 호출 한도(/rate_limit) 조회
    for t in tokens:
        try:
            req = urllib.request.Request("https://api.github.com/rate_limit")
            req.add_header("Authorization", f"token {t}")
            req.add_header("User-Agent", "NAtlas-Build-Rotator")
            with urllib.request.urlopen(req, timeout=3) as res:
                data = json.loads(res.read().decode('utf-8'))
                remaining = data.get("resources", {}).get("core", {}).get("remaining", 0)
                if remaining > max_remaining:
                    max_remaining = remaining
                    best_token = t
        except Exception:
            continue

    print(best_token, end="")

if __name__ == "__main__":
    select_best_token()
