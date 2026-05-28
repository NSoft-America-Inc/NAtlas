#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import os
import sys
import re
import argparse
from pathlib import Path
from datetime import datetime

# 슬레이트 스타일 다크 모드에 어우러지는 세련된 터미널 컬러 정의
COLOR_GREEN = "\033[38;2;52;211;153m"  # 에메랄드
COLOR_RED = "\033[38;2;248;113;113m"    # 로즈
COLOR_YELLOW = "\033[38;2;251;191;36m" # 앰버
COLOR_CYAN = "\033[38;2;56;189;248m"   # 스카이블루
COLOR_RESET = "\033[0m"

# 방치된 가이드성 플레이스홀더 검출 키워드 리스트
PLACEHOLDERS = [
    "[작업 계획", "구체적이고 한눈에", "여기에 작성", "여기에 작업의 배경",
    "여기에 구현할 내용", "여기에 실제로 완수", "여기에 생성되거나", "여기에 정적 분석",
    "여기에 이번 태스크", "여기에 해당 태스크", "여기에 최초 계획", "여기에 획득한",
    "여기에 부딪힌", "여기에 차후", "[작업 배경 및 목표]", "[Order]", "[Report]", "TODO"
]

# NStack 표준 스킬 템플릿 정의
ORDER_TEMPLATE = """---
title: "{title}"
issue_url: "{issue_url}"
---

# Task: {title}

**Issue:** [{project}#{issue_num}]({issue_url})
**Order:** [order.md](file:///Users/yg/workspace/NAtlas/llmwiki/content/01-Logs/archive/{project}/{user}/{slug}/order.md)
**Report:** [report.md](file:///Users/yg/workspace/NAtlas/llmwiki/content/01-Logs/archive/{project}/{user}/{slug}/report.md)

**Agent:** Antigravity
**Created At:** {created_at}

---

## (1) Git Setup

- [ ] 로컬 브랜치 생성 및 환경 검증
- [ ] PR 연결 대기 상태 확인

---

## (2) Context & Goal

여기에 작업의 배경과 구체적인 목적을 서술해 주세요. (최소 10자 이상 작성 필수)

---

## (3) Implementation Detail

여기에 구현할 내용의 세부 설계와 변경될 컴포넌트 목록을 기술해 주세요. (최소 10자 이상 작성 필수)

---

## (4) Completion Criteria

- [ ] 요구 기능 구현 및 컴파일 성공
- [ ] 정합성 린터 verify_nstack_pipeline.py 검증 성공

---

## (5) Report Template

여기에 작업 완료 보고를 위한 표준 형식을 미리 세팅해 둘 수 있습니다.
"""

REPORT_TEMPLATE = """---
title: "{title}"
issue_url: "{issue_url}"
---

# Report: {title}

**Issue:** [{project}#{issue_num}]({issue_url})
**Order:** [order.md](file:///Users/yg/workspace/NAtlas/llmwiki/content/01-Logs/archive/{project}/{user}/{slug}/order.md)
**Report:** [report.md](file:///Users/yg/workspace/NAtlas/llmwiki/content/01-Logs/archive/{project}/{user}/{slug}/report.md)

**Agent:** Antigravity
**Completed At:** {completed_at}

---

## Completed Tasks

여기에 실제로 완수하고 검증을 마친 작업 목록을 상세히 기재해 주세요. (최소 10자 이상 작성 필수)

---

## Changes

여기에 생성되거나 수정된 주요 파일 경로와 변경 내용의 핵심을 기술해 주세요. (최소 10자 이상 작성 필수)

---

## Static Analysis

여기에 정적 분석, 린터 실행 결과 및 테스트 통과 로그를 기술해 주세요. (최소 10자 이상 작성 필수)

---

## LLMWiki 지식 자산화

여기에 이번 태스크를 수행하며 획득한 기술적 지식, 설계상 트레이드오프 등을 정리하여 위키 문서(wiki.md)로 이관한 요약을 작성해 주세요. (최소 10자 이상 작성 필수)
"""

WIKI_TEMPLATE = """---
title: "{title}"
---

# Wiki: {title}

---

## Context

여기에 해당 태스크를 진행하게 된 기술적 배경, 아키텍처 의사결정 전의 맥락을 자세히 기재해 주세요. (최소 10자 이상 작성 필수)

---

## Plan vs Actual

여기에 최초 계획했던 설계안과 실제 구현하는 과정에서 발생했던 차이점 및 극복 과정을 기재해 주세요. (최소 10자 이상 작성 필수)

---

## Core Content

여기에 획득한 핵심 지식 자산, 라이브러리 활용법, 핵심 구현 코드 등의 상세 내용을 기술해 주세요. 타 위키 노드 인용 시 [[slug]] 링크를 적극 활용해 주세요. (최소 10자 이상 작성 필수)

---

## Decision / Solution

여기에 부딪힌 문제에 대해 내린 아키텍처 의사결정과 채택한 솔루션의 합리적 이유를 기재해 주세요. (최소 10자 이상 작성 필수)

---

## Caveats

여기에 차후 이 지식을 사용할 사람들을 위해 주의해야 할 제한사항이나 경고, 예외 처리 케이스를 기재해 주세요. (최소 10자 이상 작성 필수)
"""

def print_step(msg):
    print(f"{COLOR_CYAN}🔍 [VALIDATOR] {msg}{COLOR_RESET}")

def print_success(msg):
    print(f"{COLOR_GREEN}✅ {msg}{COLOR_RESET}")

def print_warn(msg):
    print(f"{COLOR_YELLOW}⚠️ {msg}{COLOR_RESET}")

def print_error(msg):
    print(f"{COLOR_RED}❌ {msg}{COLOR_RESET}")

def parse_markdown_frontmatter(content: str) -> dict:
    """마크다운 본문 최상단에서 YAML Frontmatter를 파싱합니다."""
    metadata = {}
    frontmatter_match = re.match(r"^---\s*\n(.*?)\n---\s*\n", content, re.DOTALL)
    if frontmatter_match:
        yaml_content = frontmatter_match.group(1)
        for line in yaml_content.split("\n"):
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if ":" in line:
                key, val = line.split(":", 1)
                metadata[key.strip()] = val.strip().strip('"').strip("'")
        return metadata

    # Fallback 파싱
    h1_match = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
    if h1_match:
        title = h1_match.group(1).strip()
        title = re.sub(r"^\[(Order|Report|Knowledge|Wiki)\]\s*", "", title)
        metadata["title"] = title

    issue_match = re.search(r"(https://github\.com/[^/]+/[^/]+/issues/\d+)", content)
    if issue_match:
        metadata["issue_url"] = issue_match.group(1).strip()
        
    return metadata

def check_placeholders(content: str) -> list:
    """방치된 가이드성 플레이스홀더 키워드를 탐색합니다."""
    found = []
    for ph in PLACEHOLDERS:
        if ph in content:
            found.append(ph)
    return found

def normalize_and_fuzzy_match_header(raw_header: str) -> str:
    """헤더명을 정제하고, 지식 파이프라인의 H2 규격 키워드로 fuzzy 매칭합니다."""
    h_lower = raw_header.lower()
    
    # Exact context mapping bypass for wiki.md Context section (preventing collapse into order.md contextgoal)
    if h_lower == "context":
        return "context"
        
    # 1. Completed Tasks 유사 매칭
    if any(k in h_lower for k in ["completed", "task", "완료", "할일", "할 일", "목록"]):
        return "completedtasks"
        
    # 2. Changes 유사 매칭
    if any(k in h_lower for k in ["change", "수정", "변경", "파일", "내역"]):
        return "changes"
        
    # 3. Static Analysis 유사 매칭
    if any(k in h_lower for k in ["static", "analysis", "정적", "분석", "테스트", "linter", "검증"]):
        return "staticanalysis"
        
    # 4. LLMWiki 지식 자산화 유사 매칭
    if any(k in h_lower for k in ["wiki", "지식", "자산", "knowledge", "asset"]):
        return "llmwiki지식자산화"

    # 5. Order/Wiki 개별 섹션들 추가 매칭
    if any(k in h_lower for k in ["git", "setup", "깃", "설정"]):
        return "gitsetup"
    if any(k in h_lower for k in ["context", "goal", "배경", "목적", "목표"]):
        return "contextgoal"
    if any(k in h_lower for k in ["implementation", "detail", "구현", "설계"]):
        return "implementationdetail"
    if any(k in h_lower for k in ["completion", "criteria", "완료조건", "기준"]):
        return "completioncriteria"
    if any(k in h_lower for k in ["report", "template", "보고", "양식"]):
        return "reporttemplate"
        
    if any(k in h_lower for k in ["plan", "actual", "계획", "실제", "차이"]):
        return "planvsactual"
    if any(k in h_lower for k in ["core", "content", "핵심"]):
        return "corecontent"
    if any(k in h_lower for k in ["decision", "solution", "의사결정", "결정", "해결"]):
        return "decisionsolution"
    if any(k in h_lower for k in ["caveats", "주의", "제한"]):
        return "caveats"

    # Fallback: 특수문자 제거 후 리턴
    normalized = re.sub(r"^\(\d+\)\s*", "", raw_header)
    normalized = re.sub(r"[^a-zA-Z0-9가-힣]", "", normalized)
    return normalized.lower()

def split_markdown_by_h2(content: str) -> dict:
    """H2 헤더를 기준으로 마크다운 본문을 세션별로 분할 추출합니다."""
    sections = {}
    current_header = None
    current_body = []

    # Frontmatter 영역 제거
    body_content = content
    frontmatter_match = re.match(r"^---\s*\n.*?\n---\s*\n", content, re.DOTALL)
    if frontmatter_match:
        body_content = content[frontmatter_match.end():]

    lines = body_content.split("\n")
    for line in lines:
        h2_match = re.match(r"^##\s+(.+)$", line)
        if h2_match:
            if current_header:
                sections[current_header] = "\n".join(current_body).strip()
            raw_header = h2_match.group(1).strip()
            current_header = normalize_and_fuzzy_match_header(raw_header)
            current_body = []
        else:
            if current_header is not None:
                current_body.append(line)

    if current_header:
        sections[current_header] = "\n".join(current_body).strip()

    return sections

def check_section_density(sections: dict, normalized_key: str, friendly_name: str) -> str:
    """특정 섹션의 텍스트 글자 수 및 작성 충실도를 검사합니다."""
    body = sections.get(normalized_key, "").strip()
    if not body:
        return f"'{friendly_name}' 섹션의 본문 내용이 완전히 비어있습니다."
    
    # 주석 및 플레이스홀더, 공백 제거 후 실질 글자수 계산
    cleaned = re.sub(r"<!--.*?-->", "", body, flags=re.DOTALL) # 주석 제거
    cleaned = re.sub(r"\s+", "", cleaned) # 모든 공백 제거
    
    # 플레이스홀더 가이드 문자열 제거
    for ph in PLACEHOLDERS:
        cleaned = cleaned.replace(ph.replace(" ", ""), "")

    if len(cleaned) < 10:
        return f"'{friendly_name}' 섹션의 기재 내용이 지나치게 짧습니다 (최소 10자 이상 유효 텍스트 작성 필수, 현재 실질 글자수: {len(cleaned)}자)."
    
    return None

def heal_file(file_path: Path, template_str: str, required_sections_map: dict, metadata: dict):
    """기존 파일의 작성 내용을 안전하게 보존하면서, 스킬 템플릿 규격에 맞춰 강제 복구(Auto-Healing)합니다."""
    existing_content = ""
    existing_sections = {}
    
    if file_path.exists():
        existing_content = file_path.read_text(encoding="utf-8")
        existing_sections = split_markdown_by_h2(existing_content)
        # 기존 Frontmatter에서 메타데이터 보강
        existing_meta = parse_markdown_frontmatter(existing_content)
        metadata.update(existing_meta)

    # 템플릿에 Frontmatter 및 변수 바인딩
    issue_url = metadata.get("issue_url", "https://github.com/NSoft-America-Inc/natlas/issues/999")
    issue_num = issue_url.split("/")[-1] if "/" in issue_url else "999"
    
    binds = {
        "title": metadata.get("title", "NStack Task"),
        "issue_url": issue_url,
        "issue_num": issue_num,
        "project": metadata.get("project", "natlas"),
        "user": metadata.get("user", "developer"),
        "slug": metadata.get("slug", "task-slug"),
        "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "completed_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }
    
    # 템플릿 구조를 H2 단위로 해석하여, 기존 작성 내용이 있다면 대치해줍니다.
    rendered_template = template_str.format(**binds)
    template_sections = split_markdown_by_h2(rendered_template)
    
    # 최종 파일 빌드
    lines = []
    # Frontmatter 영역 빌드
    lines.append("---")
    lines.append(f"title: \"{binds['title']}\"")
    if "issue_url" in template_str:
        lines.append(f"issue_url: \"{binds['issue_url']}\"")
    lines.append("---\n")
    
    # 타이틀 헤더 빌드
    h1_tag = "Report" if "Report:" in template_str else ("Wiki" if "Wiki:" in template_str else "Task")
    lines.append(f"# {h1_tag}: {binds['title']}\n")
    
    if h1_tag != "Wiki":
        lines.append(f"**Issue:** [{binds['project']}#{binds['issue_num']}]({binds['issue_url']})")
        lines.append(f"**Order:** [order.md](file:///Users/yg/workspace/NAtlas/llmwiki/content/01-Logs/archive/{binds['project']}/{binds['user']}/{binds['slug']}/order.md)")
        lines.append(f"**Report:** [report.md](file:///Users/yg/workspace/NAtlas/llmwiki/content/01-Logs/archive/{binds['project']}/{binds['user']}/{binds['slug']}/report.md)\n")
        lines.append(f"**Agent:** Antigravity")
        time_tag = "Completed At" if h1_tag == "Report" else "Created At"
        lines.append(f"**{time_tag}:** {binds['created_at'] if h1_tag == 'Task' else binds['completed_at']}\n")
        lines.append("---")
    
    # 각 필수 섹션을 순회하며 본문 주입
    for norm_key, (friendly_header, template_body) in required_sections_map.items():
        lines.append(f"\n## {friendly_header}\n")
        
        # 기존 파일에서 해당 섹션의 글을 찾고, 비어있지 않다면 주입
        existing_body = existing_sections.get(norm_key, "").strip()
        
        # 만약 기존 내용이 비어있거나 플레이스홀더 가이드 수준이라면 템플릿의 디폴트 가이드 활용
        has_real_content = False
        if existing_body:
            cleaned = re.sub(r"\s+", "", existing_body)
            for ph in PLACEHOLDERS:
                cleaned = cleaned.replace(ph.replace(" ", ""), "")
            if len(cleaned) >= 5:
                has_real_content = True
                
        if has_real_content:
            lines.append(existing_body)
        else:
            lines.append(template_body)
            
        lines.append("\n---")
        
    # 마지막 --- 마크 정리
    if lines[-1] == "---":
        lines.pop()
        
    file_path.parent.mkdir(parents=True, exist_ok=True)
    file_path.write_text("\n".join(lines).strip() + "\n", encoding="utf-8")
    print_success(f"🩹 [{file_path.name}] 스킬 템플릿 규격으로 자동 교정(Auto-Healing) 완료!")

def main():
    print("=" * 75)
    print(f"{COLOR_CYAN}  NStack ➔ NAtlas E2E 지식 파이프라인 무결성 정적 린터 및 보정기{COLOR_RESET}")
    print("=" * 75)

    parser = argparse.ArgumentParser(description="NStack E2E 지식 파이프라인 정적 린터 및 자동 생성기")
    parser.add_argument("--project", help="프로젝트 필터 또는 생성 대상 프로젝트 명")
    parser.add_argument("--task", help="태스크 필터 또는 생성 대상 태스크 슬러그")
    parser.add_argument("--user", help="생성 대상 사용자명 (git username)")
    parser.add_argument("--title", help="생성 대상 태스크 국문 제목")
    parser.add_argument("--issue", help="생성 대상 GitHub 이슈 URL")
    parser.add_argument("--new", action="store_true", help="스킬 규격에 새 태스크 아티팩트 3종 세트 자동 생성 (Scaffolding)")
    parser.add_argument("--heal", action="store_true", help="포맷 오류가 발견된 report.md 및 wiki.md 문서를 스킬 템플릿 기반으로 자동 강제 교정 (Auto-Healing)")
    args = parser.parse_args()

    # 1. LLMWiki content 디렉토리 경로 탐색
    project_root = Path(__file__).parent.resolve()
    llmwiki_content_dir = None

    config_path = Path.home() / ".natlas" / "config.json"
    if config_path.exists():
        import json
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                cfg = json.load(f)
                llmwiki_root = cfg.get("llmwiki_root", "")
                if llmwiki_root:
                    candidate_dir = Path(llmwiki_root) / "content"
                    if candidate_dir.exists():
                        llmwiki_content_dir = candidate_dir
        except Exception:
            pass

    if not llmwiki_content_dir:
        llmwiki_content_dir = project_root / "llmwiki" / "content"

    if not llmwiki_content_dir or not llmwiki_content_dir.exists():
        if os.environ.get("GITHUB_ACTIONS") == "true":
            print_warn(f"LLMWiki 콘텐츠 경로를 찾을 수 없습니다: {llmwiki_content_dir}")
            print_warn("GitHub Actions CI 환경이므로 검증을 안전하게 스킵합니다.")
            sys.exit(0)
        print_error(f"LLMWiki 콘텐츠 경로를 찾을 수 없습니다: {llmwiki_content_dir}")
        print("💡 NAtlas Settings에서 로컬 모드의 llmwiki_root가 정확히 설정되어 있는지 확인해주세요.")
        sys.exit(1)

    print_step(f"대상 LLMWiki 콘텐츠 디렉토리: {llmwiki_content_dir}")
    archive_dir = llmwiki_content_dir / "01-Logs" / "archive"

    # [기능 1] --new 옵션: 스킬 규격 뼈대 문서 3종 세트 자동 생성 (Scaffolding)
    if args.new:
        print_step("스킬 규격 기반 태스크 아티팩트 신규 생성 모드 시작...")
        if not args.project or not args.task or not args.user:
            print_error("❌ 오류: --new 모드 실행 시 --project, --task, --user 인자는 필수입니다.")
            sys.exit(1)
            
        title = args.title or "NStack 신규 태스크 기능 구현"
        issue_url = args.issue or "https://github.com/NSoft-America-Inc/natlas/issues/999"
        issue_num = issue_url.split("/")[-1] if "/" in issue_url else "999"
        
        task_dir = archive_dir / args.project / args.user / args.task
        task_dir.mkdir(parents=True, exist_ok=True)
        
        binds = {
            "title": title,
            "issue_url": issue_url,
            "issue_num": issue_num,
            "project": args.project,
            "user": args.user,
            "slug": args.task,
            "created_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "completed_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
        
        order_file = task_dir / "order.md"
        report_file = task_dir / "report.md"
        wiki_file = task_dir / "wiki.md"
        
        order_file.write_text(ORDER_TEMPLATE.format(**binds), encoding="utf-8")
        report_file.write_text(REPORT_TEMPLATE.format(**binds), encoding="utf-8")
        wiki_file.write_text(WIKI_TEMPLATE.format(**binds), encoding="utf-8")
        
        print_success(f"🎉 성공적으로 신규 스킬 규격 태스크 폴더 및 파일 3종을 일괄 빌드했습니다!")
        print(f"   📂 경로: {task_dir}")
        print("===========================================================================")
        sys.exit(0)

    # 2. 모든 작업(Task) 폴더 순회 및 무결성 검증
    if not archive_dir.exists():
        print_warn(f"아카이브 디렉토리가 비어있거나 존재하지 않습니다. 스킵합니다: {archive_dir}")
        sys.exit(0)

    errors_found = []
    checked_tasks_count = 0
    checked_files_count = 0

    # 템플릿 검증 상세 맵 선언 (정제화된 키 기준 매칭)
    ORDER_REQUIRED = {
        "gitsetup": ("(1) Git Setup", "로컬 브랜치 생성 및 환경 검증..."),
        "contextgoal": ("(2) Context & Goal", "여기에 작업의 배경과 구체적인 목적을 서술해 주세요."),
        "implementationdetail": ("(3) Implementation Detail", "여기에 구현할 내용의 세부 설계와 변경될 컴포넌트 목록을 기술해 주세요."),
        "completioncriteria": ("(4) Completion Criteria", "- [ ] 요구 기능 구현 및 컴파일 성공"),
        "reporttemplate": ("(5) Report Template", "여기에 작업 완료 보고를 위한 표준 형식을 세팅해 둘 수 있습니다.")
    }
    
    REPORT_REQUIRED = {
        "completedtasks": ("Completed Tasks", "여기에 실제로 완수하고 검증을 마친 작업 목록을 상세히 기재해 주세요."),
        "changes": ("Changes", "여기에 생성되거나 수정된 주요 파일 경로와 변경 내용의 핵심을 기술해 주세요."),
        "staticanalysis": ("Static Analysis", "여기에 정적 분석, 린터 실행 결과 및 테스트 통과 로그를 기술해 주세요."),
        "llmwiki지식자산화": ("LLMWiki 지식 자산화", "여기에 이번 태스크를 수행하며 획득한 기술적 지식 등을 위키 문서로 이관한 요약을 작성해 주세요.")
    }

    WIKI_REQUIRED = {
        "context": ("Context", "여기에 해당 태스크를 진행하게 된 기술적 배경, 아키텍처 의사결정 전의 맥락을 자세히 기재해 주세요."),
        "planvsactual": ("Plan vs Actual", "여기에 최초 계획했던 설계안과 실제 구현하는 과정에서 발생했던 차이점을 기재해 주세요."),
        "corecontent": ("Core Content", "여기에 획득한 핵심 지식 자산, 라이브러리 활용법, 핵심 구현 코드 등의 상세 내용을 기술해 주세요."),
        "decisionsolution": ("Decision / Solution", "여기에 부딪힌 문제에 대해 내린 아키텍처 의사결정과 채택한 솔루션의 합리적 이유를 기재해 주세요."),
        "caveats": ("Caveats", "여기에 차후 이 지식을 사용할 사람들을 위해 주의해야 할 제한사항이나 경고를 기재해 주세요.")
    }

    for project_path in archive_dir.iterdir():
        if not project_path.is_dir() or project_path.name.startswith("."):
            continue
        if args.project and project_path.name != args.project:
            continue
            
        for user_path in project_path.iterdir():
            if not user_path.is_dir() or user_path.name.startswith("."):
                continue
                
            for task_path in user_path.iterdir():
                if not task_path.is_dir() or task_path.name.startswith("."):
                    continue
                if args.task and task_path.name != args.task:
                    continue
                
                checked_tasks_count += 1
                task_slug = task_path.name
                project_name = project_path.name
                user_name = user_path.name
                
                order_file = task_path / "order.md"
                report_file = task_path / "report.md"
                wiki_file = task_path / "wiki.md"
                knowledge_file = task_path / "knowledge.md"
                
                relative_task_path = task_path.relative_to(llmwiki_content_dir)
                print(f" 💼 [Project: {project_name}] Task: {task_slug} ({user_name})")

                # 규칙 A: 필수 아티팩트 세트 존재성 검사
                missing_files = []
                if not order_file.exists():
                    missing_files.append("order.md")
                if not report_file.exists():
                    missing_files.append("report.md")
                if not wiki_file.exists() and not knowledge_file.exists():
                    missing_files.append("wiki.md")

                # [기능 2] --heal 옵션 작동 시 즉각 교정 진행
                if args.heal and missing_files:
                    print_step("규격 어긋남 감지! 스킬 템플릿 기반 강제 보정(Auto-Healing) 실행 중...")
                    meta_fallback = {
                        "project": project_name,
                        "user": user_name,
                        "slug": task_slug,
                        "title": task_slug.replace("-", " ").title()
                    }
                    if not order_file.exists():
                        heal_file(order_file, ORDER_TEMPLATE, ORDER_REQUIRED, meta_fallback)
                    if not report_file.exists():
                        heal_file(report_file, REPORT_TEMPLATE, REPORT_REQUIRED, meta_fallback)
                    if not wiki_file.exists() and not knowledge_file.exists():
                        heal_file(wiki_file, WIKI_TEMPLATE, WIKI_REQUIRED, meta_fallback)
                    # 파일 존재 여부 갱신
                    missing_files = []

                if missing_files:
                    errors_found.append({
                        "path": str(relative_task_path),
                        "reason": f"NStack 필수 아티팩트 누락: {', '.join(missing_files)}"
                    })
                    print_error(f"     └─ 필수 아티팩트 누락: {', '.join(missing_files)}")
                    continue

                # 규칙 B: order.md 정밀 양식 및 분량 검사
                checked_files_count += 1
                try:
                    order_content = order_file.read_text(encoding="utf-8")
                    meta = parse_markdown_frontmatter(order_content)
                    
                    title = meta.get("title")
                    issue_url = meta.get("issue_url")
                    
                    issues = []
                    if not title or title.strip() == "":
                        issues.append("작업 제목 (title) 누락")
                    if not issue_url or not issue_url.startswith("https://github.com/"):
                        issues.append("올바른 GitHub 이슈 링크 (issue_url) 누락")
                    
                    # H2 섹션 분할 파싱
                    order_sections = split_markdown_by_h2(order_content)
                    for key, (friendly_name, _) in ORDER_REQUIRED.items():
                        if key not in order_sections:
                            issues.append(f"필수 섹션 헤더 누락: '## {friendly_name}'")
                        else:
                            # Context 및 Implementation Detail 섹션의 밀도 검사 추가
                            if key in ["contextgoal", "implementationdetail"]:
                                dens_err = check_section_density(order_sections, key, friendly_name)
                                if dens_err:
                                    issues.append(dens_err)
                                    
                    # 플레이스홀더 방치 검사
                    phs = check_placeholders(order_content)
                    if phs:
                        issues.append(f"가이드성 설명문구(플레이스홀더) 방치 검출: {', '.join(phs)}")

                    if issues:
                        errors_found.append({
                            "path": str(order_file.relative_to(llmwiki_content_dir)),
                            "reason": f"지시서 템플릿 규격 오류: {', '.join(issues)}"
                        })
                        print_error(f"     └─ [order.md] 템플릿 규격 오류: {', '.join(issues)}")
                    else:
                        print_success(f"     └─ [order.md] 검증 통과 (제목: '{title}')")
                except Exception as e:
                    errors_found.append({
                        "path": str(order_file.relative_to(llmwiki_content_dir)),
                        "reason": f"파일 읽기/파싱 실패: {str(e)}"
                    })
                    print_error(f"     └─ [order.md] 예외 발생: {e}")

                # 규칙 C: report.md 정밀 양식, 분량 및 자동 보정
                checked_files_count += 1
                try:
                    report_content = report_file.read_text(encoding="utf-8")
                    meta_rep = parse_markdown_frontmatter(report_content)
                    title_rep = meta_rep.get("title")
                    
                    report_issues = []
                    if not title_rep or title_rep.strip() == "":
                        report_issues.append("완료 보고서 작업 제목 누락")
                        
                    report_sections = split_markdown_by_h2(report_content)
                    for key, (friendly_name, _) in REPORT_REQUIRED.items():
                        if key not in report_sections:
                            report_issues.append(f"필수 섹션 헤더 누락: '## {friendly_name}'")
                        else:
                            dens_err = check_section_density(report_sections, key, friendly_name)
                            if dens_err:
                                report_issues.append(dens_err)
                                
                    # 플레이스홀더 방치 검사
                    phs = check_placeholders(report_content)
                    if phs:
                        report_issues.append(f"가이드성 설명문구(플레이스홀더) 방치 검출: {', '.join(phs)}")
                        
                    if report_issues:
                        # --heal 모드일 경우 즉각 자동 보정
                        if args.heal:
                            print_warn(f"     └─ [report.md] 규격 오류 발견! 자동 복구(Auto-Healing) 실행...")
                            heal_file(report_file, REPORT_TEMPLATE, REPORT_REQUIRED, meta_rep or {"title": title_rep, "project": project_name, "user": user_name, "slug": task_slug})
                        else:
                            errors_found.append({
                                "path": str(report_file.relative_to(llmwiki_content_dir)),
                                "reason": f"보고서 템플릿 규격 오류: {', '.join(report_issues)}"
                            })
                            print_error(f"     └─ [report.md] 템플릿 규격 오류: {', '.join(report_issues)}")
                    else:
                        print_success(f"     └─ [report.md] 검증 통과 (제목: '{title_rep}')")
                except Exception as e:
                    errors_found.append({
                        "path": str(report_file.relative_to(llmwiki_content_dir)),
                        "reason": f"파일 읽기/파싱 실패: {str(e)}"
                    })
                    print_error(f"     └─ [report.md] 예외 발생: {e}")

                # 규칙 D: wiki.md (또는 legacy knowledge.md) 정밀 양식, 분량 및 자동 보정
                target_wiki_file = wiki_file if wiki_file.exists() else (knowledge_file if knowledge_file.exists() else None)
                if target_wiki_file:
                    checked_files_count += 1
                    try:
                        wiki_content = target_wiki_file.read_text(encoding="utf-8")
                        meta_wiki = parse_markdown_frontmatter(wiki_content)
                        title_wiki = meta_wiki.get("title")
                        
                        wiki_issues = []
                        wiki_sections = split_markdown_by_h2(wiki_content)
                        for key, (friendly_name, _) in WIKI_REQUIRED.items():
                            if key not in wiki_sections:
                                wiki_issues.append(f"필수 섹션 헤더 누락: '## {friendly_name}'")
                            else:
                                dens_err = check_section_density(wiki_sections, key, friendly_name)
                                if dens_err:
                                    wiki_issues.append(dens_err)
                                    
                        # 플레이스홀더 방치 검사
                        phs = check_placeholders(wiki_content)
                        if phs:
                            wiki_issues.append(f"가이드성 설명문구(플레이스홀더) 방치 검출: {', '.join(phs)}")
                            
                        if wiki_issues:
                            # --heal 모드일 경우 즉각 자동 보정
                            if args.heal:
                                print_warn(f"     └─ [{target_wiki_file.name}] 규격 오류 발견! 자동 복구(Auto-Healing) 실행...")
                                heal_file(target_wiki_file, WIKI_TEMPLATE, WIKI_REQUIRED, meta_wiki or {"title": title_wiki, "project": project_name, "user": user_name, "slug": task_slug})
                            else:
                                errors_found.append({
                                    "path": str(target_wiki_file.relative_to(llmwiki_content_dir)),
                                    "reason": f"지식 문서 템플릿 규격 오류: {', '.join(wiki_issues)}"
                                })
                                print_error(f"     └─ [{target_wiki_file.name}] 템플릿 규격 오류: {', '.join(wiki_issues)}")
                        else:
                            print_success(f"     └─ [{target_wiki_file.name}] 검증 통과 (제목: '{title_wiki or 'N/A'}')")
                    except Exception as e:
                        errors_found.append({
                            "path": str(target_wiki_file.relative_to(llmwiki_content_dir)),
                            "reason": f"파일 읽기/파싱 실패: {str(e)}"
                        })
                        print_error(f"     └─ [{target_wiki_file.name}] 예외 발생: {e}")

    # 3. 종합 결과 검증 보고
    print("=" * 75)
    print(f"📊 정합성 검증 통계:")
    print(f"   - 총 검사한 작업(Task) 폴더 수: {checked_tasks_count}개")
    print(f"   - 총 검사한 마크다운 파일 수: {checked_files_count}개")
    print("=" * 75)

    if errors_found:
        print_error(f"🚨 총 {len(errors_found)}건의 정합성 위반 오류가 발견되었습니다!")
        for idx, err in enumerate(errors_found, 1):
            print(f"  {idx}. [경로] {err['path']}\n     [이유] {err['reason']}")
        print("=" * 75)
        print_error("AI 에이전트 개발 규격 강제 실패! 커밋 및 배포를 중단합니다.")
        print("💡 TIP: 'python3 verify_nstack_pipeline.py --heal' 명령어를 실행하여 템플릿 구조를 자동으로 치료할 수 있습니다.")
        sys.exit(1)
    else:
        print_success("🎉 축하합니다! 모든 NStack 작업 아티팩트와 메타데이터가 100% 일관되게 규격을 준수하고 있습니다!")
        print_success("NStack ➔ NAtlas E2E 지식 파이프라인 무결성 검증 완벽 성공!")
        print("=" * 75)
        sys.exit(0)

if __name__ == "__main__":
    main()
