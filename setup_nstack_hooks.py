#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import sys
import stat

# Windows CP1252/CP949 환경 대비 UTF-8 인코딩 강제 적용
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

def setup_git_hooks():
    print("===========================================================================")
    print("  NStack -> NAtlas E2E Git Hook 자동 설치 도구")
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
# NStack -> NAtlas E2E 지식 파이프라인 무결성 Git pre-commit Hook

# Python3 기동 여부 체크
if command -v python3 >/dev/null 2>&1; then
  echo "📦 [NStack Hook] 현재 커밋 대상(Staged)인 변경 마크다운 태스크들을 분석 중입니다..."
  
  # git diff --cached 를 통해 현재 스테이징된 문서 중 01-Logs/archive/ 경로에 속한 파일들의 고유 태스크 슬러그를 추려냅니다.
  # (llmwiki/content/ 및 환경에 맞춤 대응)
  STAGED_TASKS=$(git diff --cached --name-only | grep -E '01-Logs/archive/[^/]+/[^/]+/[^/]+/' | sed -E 's|.*01-Logs/archive/||' | cut -d'/' -f1,2,3 | sort -u)
  
  if [ -z "$STAGED_TASKS" ]; then
    echo "✅ [NStack Hook] 이번 커밋에는 검증 대상인 NStack 아티팩트(order/report/wiki) 변경사항이 없습니다. 지식 린팅 스킵."
    exit 0
  fi
  
  echo "$STAGED_TASKS" | while read -r task_info; do
    if [ -n "$task_info" ]; then
      PROJECT_NAME=$(echo "$task_info" | cut -d'/' -f1)
      USER_NAME=$(echo "$task_info" | cut -d'/' -f2)
      TASK_SLUG=$(echo "$task_info" | cut -d'/' -f3)
      
      echo "🔍 [NStack Hook] 태스크 정밀 검사 가동 -> [Project: $PROJECT_NAME] Task: $TASK_SLUG ($USER_NAME)"
      python3 verify_nstack_pipeline.py --project "$PROJECT_NAME" --task "$TASK_SLUG"
      EXIT_CODE=$?
      if [ $EXIT_CODE -ne 0 ]; then
        echo "==========================================================================="
        echo "❌ [NStack Hook Error] '$TASK_SLUG' 태스크의 지식 정합성 검증에 실패했습니다!"
        echo "👉 'python3 verify_nstack_pipeline.py --project $PROJECT_NAME --task $TASK_SLUG --heal' 명령어로 자동 복구(Auto-Healing)할 수 있습니다."
        echo "==========================================================================="
        exit $EXIT_CODE
      fi
    fi
  done
  EXIT_CODE_LOOP=$?
  if [ $EXIT_CODE_LOOP -ne 0 ]; then
    exit $EXIT_CODE_LOOP
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
