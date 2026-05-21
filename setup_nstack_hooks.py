#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import stat

def setup_git_hooks():
    print("===========================================================================")
    print("  NStack ➔ NAtlas E2E Git Hook 자동 설치 도구")
    print("===========================================================================")
    
    # 1. .git 디렉토리 존재 파악
    git_dir = os.path.join(os.getcwd(), '.git')
    if not os.path.exists(git_dir):
        print("⚠️ [WARNING] 현재 경로에 .git 디렉토리가 존재하지 않습니다.")
        print("💡 로컬 git 저장소가 아니므로 Hook 바인딩을 건너뜁니다. (Fail-Safe)")
        print("===========================================================================")
        return True

    hooks_dir = os.path.join(git_dir, 'hooks')
    os.makedirs(hooks_dir, exist_ok=True)
    
    pre_commit_path = os.path.join(hooks_dir, 'pre-commit')
    
    # 2. Hook 스크립트 본문 정의
    hook_content = """#!/bin/sh
# NStack ➔ NAtlas E2E 지식 파이프라인 무결성 Git pre-commit Hook

echo "🔍 [NStack Hook] E2E 지식 파이프라인 무결성을 정밀 검사하고 있습니다..."

# Python3 기동 여부 체크
if command -v python3 >/dev/null 2>&1; then
  python3 verify_nstack_pipeline.py
  EXIT_CODE=$?
  if [ $EXIT_CODE -ne 0 ]; then
    echo "==========================================================================="
    echo "❌ [NStack Hook Error] E2E 지식 파이프라인 검증에 실패했습니다!"
    echo "👉 3종 문서 세트(order, report, wiki) 누락 또는 Frontmatter 오류를 수정해야 합니다."
    echo "💡 규칙 상세 내용 및 오류 분석은 위 콘솔 로그를 확인해 주세요."
    echo "==========================================================================="
    exit $EXIT_CODE
  fi
else
  echo "⚠️ [NStack Hook Warning] 로컬 시스템에 python3 명령어가 존재하지 않아 검증을 통과시킵니다."
fi

exit 0
"""

    try:
        # 3. pre-commit 훅 파일 생성
        with open(pre_commit_path, 'w', encoding='utf-8') as f:
            f.write(hook_content)
        
        # 4. 실행 권한 부여 (chmod +x)
        if os.name != 'nt':  # Windows가 아닐 경우 실행 권한 부여
            st = os.stat(pre_commit_path)
            os.chmod(pre_commit_path, st.st_mode | stat.S_IEXEC)
            
        print("✅ [SUCCESS] NStack E2E 무결성 Git 'pre-commit' Hook 자동 바인딩 성공!")
        print(f"📂 경로: {pre_commit_path}")
        print("💡 이제 'git commit'을 수행할 때마다 지식 정합성을 자동으로 검증합니다.")
        print("===========================================================================")
        return True
        
    except Exception as e:
        print(f"❌ [ERROR] Hook 파일을 작성하는 데 실패했습니다: {e}")
        print("===========================================================================")
        return False

if __name__ == '__main__':
    success = setup_git_hooks()
    sys.exit(0 if success else 1)
