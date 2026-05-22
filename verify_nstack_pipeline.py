#!/usr/bin/env python3
import os
import sys
import re
from pathlib import Path

# 슬레이트 스타일 다크 모드에 어우러지는 세련된 터미널 컬러 정의
COLOR_GREEN = "\033[38;2;52;211;153m"  # 에메랄드
COLOR_RED = "\033[38;2;248;113;113m"    # 로즈
COLOR_YELLOW = "\033[38;2;251;191;36m" # 앰버
COLOR_CYAN = "\033[38;2;56;189;248m"   # 스카이블루
COLOR_RESET = "\033[0m"

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
    
    # 1. YAML Frontmatter 매칭 시도
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

    # 2. Frontmatter가 없을 경우 본문 내부의 특정 주석 또는 Markdown Heading 파싱 시도 (Fallback)
    # H1 제목 파싱
    h1_match = re.search(r"^#\s+(.+)$", content, re.MULTILINE)
    if h1_match:
        # # [Order] 제목 형태 등에서 타이틀 정리
        title = h1_match.group(1).strip()
        title = re.sub(r"^\[(Order|Report|Knowledge|Wiki)\]\s*", "", title)
        metadata["title"] = title

    # GitHub 이슈 URL 파싱
    issue_match = re.search(r"(https://github\.com/[^/]+/[^/]+/issues/\d+)", content)
    if issue_match:
        metadata["issue_url"] = issue_match.group(1).strip()
        
    return metadata

def main():
    print("=" * 75)
    print(f"{COLOR_CYAN}  NStack ➔ NAtlas E2E 지식 파이프라인 무결성 정적 린터 검증기{COLOR_RESET}")
    print("=" * 75)

    import argparse
    parser = argparse.ArgumentParser(description="NStack integrity linter")
    parser.add_argument("--project", help="Filter check by project name")
    parser.add_argument("--task", help="Filter check by task slug")
    args = parser.parse_args()

    # 1. LLMWiki content 디렉토리 경로 탐색
    project_root = Path(__file__).parent.resolve()
    llmwiki_content_dir = None

    # config.json 로드 시도
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
        print_error(f"LLMWiki 콘텐츠 경로를 찾을 수 없습니다: {llmwiki_content_dir}")
        print("💡 NAtlas Settings에서 로컬 모드의 llmwiki_root가 정확히 설정되어 있는지 확인해주세요.")
        sys.exit(1)

    print_step(f"대상 LLMWiki 콘텐츠 디렉토리: {llmwiki_content_dir}")
    
    archive_dir = llmwiki_content_dir / "01-Logs" / "archive"
    if not archive_dir.exists():
        print_warn(f"아카이브 디렉토리가 비어있거나 존재하지 않습니다. 스킵합니다: {archive_dir}")
        sys.exit(0)

    # 2. 모든 작업(Task) 폴더 순회 및 무결성 검증
    # 구조: archive/{project}/{user}/{slug}/
    errors_found = []
    checked_tasks_count = 0
    checked_files_count = 0

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

                # 규칙 A: 3종 파일 존재성 검증 (order.md / report.md는 반드시 세트 존재)
                missing_files = []
                if not order_file.exists():
                    missing_files.append("order.md")
                if not report_file.exists():
                    missing_files.append("report.md")
                # wiki.md (또는 legacy knowledge.md) 존재성 검증
                if not wiki_file.exists() and not knowledge_file.exists():
                    print_warn(f"     └─ 🧠 지식 자산화 문서(wiki.md)가 아직 생성되지 않았습니다.")

                if missing_files:
                    errors_found.append({
                        "path": str(relative_task_path),
                        "reason": f"NStack 필수 아티팩트 누락: {', '.join(missing_files)}"
                    })
                    print_error(f"     └─ 필수 아티팩트 누락: {', '.join(missing_files)}")
                    continue

                # 규칙 B: order.md 내 Frontmatter 또는 본문 정합성 검증 (title, issue_url)
                checked_files_count += 2
                try:
                    order_content = order_file.read_text(encoding="utf-8")
                    meta = parse_markdown_frontmatter(order_content)
                    
                    title = meta.get("title")
                    issue_url = meta.get("issue_url")
                    
                    issues = []
                    if not title or title.strip() == "":
                        issues.append("작업 제목 (title)")
                    if not issue_url or not issue_url.startswith("https://github.com/"):
                        issues.append("올바른 GitHub 이슈 링크 (issue_url)")
                        
                    if issues:
                        errors_found.append({
                            "path": str(order_file.relative_to(llmwiki_content_dir)),
                            "reason": f"필수 메타데이터 누락/오류: {', '.join(issues)}"
                        })
                        print_error(f"     └─ [order.md] 메타데이터 오류: {', '.join(issues)}")
                    else:
                        print_success(f"     └─ [order.md] 검증 통과 (제목: '{title}' | 🔗 이슈: {issue_url.split('/')[-1]})")
                except Exception as e:
                    errors_found.append({
                        "path": str(order_file.relative_to(llmwiki_content_dir)),
                        "reason": f"파일 읽기/파싱 실패: {str(e)}"
                    })
                    print_error(f"     └─ [order.md] 예외 발생: {e}")

                # 규칙 C: report.md도 동일하게 검증 시도 (선택적)
                try:
                    report_content = report_file.read_text(encoding="utf-8")
                    meta_rep = parse_markdown_frontmatter(report_content)
                    title_rep = meta_rep.get("title")
                    
                    if not title_rep:
                        print_warn(f"     └─ [report.md] 완료 보고서 작업 제목이 본문 또는 Frontmatter에 누락되었습니다.")
                except Exception:
                    pass

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
        sys.exit(1)
    else:
        print_success("🎉 축하합니다! 모든 NStack 작업 아티팩트와 메타데이터가 100% 일관되게 규격을 준수하고 있습니다!")
        print_success("NStack ➔ NAtlas E2E 지식 파이프라인 무결성 검증 완벽 성공!")
        print("=" * 75)
        sys.exit(0)

if __name__ == "__main__":
    main()
