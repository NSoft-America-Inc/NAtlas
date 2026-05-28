import re
import os

theory_path = "docs/presentation/01_theory_part1.html"
demo_path = "docs/presentation/04_presentation_demo_project.html"

def refactor_section_content(section):
    # 1. 110px Card replace (Golden Tight-Gigantic viewBox: 15 0 130 84, foreignObject y: 67, max-width: 420px)
    pattern_110 = re.compile(
        r'<!--\s*1:1\s*Matching\s*Card\s*(\d+):[^>]*-->\s*'
        r'<div class="glass-panel" style="width:\s*100%;\s*height:\s*110px;[^>]*">\s*'
        r'<div style="display:\s*flex;\s*flex-direction:\s*column;\s*width:\s*45%;\s*text-align:\s*left;">\s*'
        r'<span style="([^"]*)">([^<]*)</span>\s*'
        r'<h4 style="([^"]*)">([^<]*)</h4>\s*'
        r'<span style="font-size:\s*0.6vw;\s*color:\s*#94a3b8;[^"]*">([^<]*)</span>\s*'
        r'</div>\s*'
        r'<div style="width:\s*50%;\s*height:\s*90px;\s*display:\s*flex;\s*align-items:\s*center;\s*justify-content:\s*center;\s*position:\s*relative;">\s*'
        r'<svg width="100%" height="80" viewBox="([^"]*)" style="([^"]*)">([\s\S]*?)</svg>\s*'
        r'</div>\s*'
        r'</div>',
        re.IGNORECASE
    )

    def replace_110(match):
        card_num = int(match.group(1))
        span_style = match.group(2)
        span_text = match.group(3)
        h4_style = match.group(4)
        h4_text = match.group(5)
        desc_text = match.group(6)
        viewbox = match.group(7)
        svg_style = match.group(8)
        svg_body = match.group(9)

        svg_body_clean = re.sub(
            r'<rect\s+x="5"\s+y="5"\s+width="150"\s+height="70"\s+rx="6"\s+fill="none"[^>]*/>\s*',
            '',
            svg_body,
            flags=re.IGNORECASE
        )

        # 주석이나 매칭 텍스트에 Frozen README 키워드가 명시적으로 들어있거나,
        # svg_body 내에 2 YEARS INACTIVE가 명확히 감지되는 경우에만 Frozen README 카드 전용 아름다운 비주얼 디자인으로 전환
        is_frozen_readme = "Frozen README" in match.group(0) or "2 YEARS INACTIVE" in svg_body

        if is_frozen_readme:
            # 2년 전 과거 정보 박제화(Frozen README)의 전달력 극대화 고해상도 그래픽 재설계
            # CSS transform 충돌 버그 방지를 위해 absolute circle cx/cy 좌표 설계 적용 및 folded corner 추가
            svg_body_clean = """
                                    <!-- Frost Ice Outer Bounding Frame -->
                                    <rect x="58" y="12" width="44" height="50" rx="6" fill="rgba(0,240,255,0.04)" stroke="rgba(0,240,255,0.2)" stroke-width="1" stroke-dasharray="2 2"/>
                                    
                                    <!-- Markdown Document Card with Folded Corner (x=62, y=16) -->
                                    <g transform="translate(62, 16)">
                                        <rect x="0" y="0" width="36" height="42" rx="4" fill="rgba(15,23,42,0.9)" stroke="rgba(14,165,233,0.3)" stroke-width="1.5"/>
                                        <path d="M 26,0 L 36,10 L 26,10 Z" fill="rgba(14,165,233,0.4)" stroke="rgba(14,165,233,0.3)" stroke-width="1"/>
                                        <text x="18" y="26" fill="#cbd5e1" font-family="'Outfit', 'Pretendard', sans-serif" font-size="11" font-weight="900" text-anchor="middle">M↓</text>
                                    </g>
                                    
                                    <!-- Frost corner sparkles for clear stagnancy visualization -->
                                    <text x="54" y="20" fill="rgba(0,240,255,0.7)" font-size="6">❄️</text>
                                    <text x="100" y="20" fill="rgba(0,240,255,0.7)" font-size="6">❄️</text>
                                    <text x="54" y="58" fill="rgba(0,240,255,0.7)" font-size="6">❄️</text>
                                    <text x="100" y="58" fill="rgba(0,240,255,0.7)" font-size="6">❄️</text>
                                    
                                    <!-- Ice / Frost Decos replacing raw X lines for visual refinement -->
                                    <path d="M 52,15 L 108,65" stroke="rgba(0,240,255,0.25)" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="6 6"/>
                                    <path d="M 108,15 L 52,65" stroke="rgba(0,240,255,0.25)" stroke-width="1.5" stroke-linecap="round" stroke-dasharray="6 6"/>
                                    
                                    <!-- Frozen Lock Badge on bottom-right corner of document (x=94, y=50) -->
                                    <circle cx="94" cy="50" r="9" fill="var(--accent-rose)" stroke="#ffffff" stroke-width="1" style="animation: pulse 2s infinite;"/>
                                    <text x="94" y="53" fill="#ffffff" font-family="Outfit" font-size="8" font-weight="bold" text-anchor="middle">❄️</text>
            """
        else:
            # 타 카드의 SVG 내장 영문 중복/겹침 텍스트 제거 (order.md LOCKED 제거 등)
            svg_body_clean = re.sub(
                r'<text[^>]*>2 YEARS INACTIVE</text>\s*',
                '',
                svg_body_clean,
                flags=re.IGNORECASE
            )
            svg_body_clean = re.sub(
                r'<text[^>]*>order\.md LOCKED</text>\s*',
                '',
                svg_body_clean,
                flags=re.IGNORECASE
            )

        if card_num % 2 == 1:
            align_self = "flex-start"
            margin_side = "left"
            margin_val = "4%"
        else:
            align_self = "flex-end"
            margin_side = "right"
            margin_val = "4%"

        comment = f"<!-- 1:1 Matching Card {card_num}: Staggered Vertical Unified Layout in SVG -->"

        # Expanded to max-width: 420px for massive visuals + foreignObject tightly coupled at y: 67 to prevent gaps
        return f"""{comment}
                        <div style="width: 100%; max-width: 420px; align-self: {align_self}; margin-{margin_side}: {margin_val}; display: flex; justify-content: center;">
                            <svg width="100%" height="auto" viewBox="15 0 130 84" style="overflow: visible; {svg_style}">
                                <g>
{svg_body_clean}                                </g>
                                <foreignObject x="5" y="67" width="150" height="15">
                                    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: center; justify-content: center; height: 100%; font-family: 'Outfit', 'Pretendard', sans-serif; font-size: 4.4px; font-weight: 700; color: #cbd5e1; line-height: 1.35; text-align: center;">
                                        {desc_text}
                                    </div>
                                </foreignObject>
                            </svg>
                        </div>"""

    section, count_110 = pattern_110.subn(replace_110, section)
    if count_110 > 0:
        print(f"    Replaced {count_110} 110px cards.")

    # 2. 160px Card replace (Golden Tight-Gigantic viewBox: 15 0 130 125, foreignObject y: 108, max-width: 420px)
    pattern_160 = re.compile(
        r'<!--\s*1:1\s*Matching\s*Card\s*(\d+):[^>]*-->\s*'
        r'<div class="glass-panel" style="width:\s*100%;\s*height:\s*160px;[^>]*">\s*'
        r'<div style="display:\s*flex;\s*flex-direction:\s*column;\s*width:\s*45%;\s*text-align:\s*left;">\s*'
        r'<span style="([^"]*)">([^<]*)</span>\s*'
        r'<h4 style="([^"]*)">([^<]*)</h4>\s*'
        r'<span style="font-size:\s*0.6vw;\s*color:\s*#94a3b8;[^"]*">([^<]*)</span>\s*'
        r'<div style="([^"]*)">([^<]*)</div>\s*'
        r'</div>\s*'
        r'<div style="width:\s*50%;\s*height:\s*130px;\s*display:\s*flex;\s*align-items:\s*center;\s*justify-content:\s*center;\s*position:\s*relative;">\s*'
        r'<svg width="100%" height="120" viewBox="([^"]*)" style="([^"]*)">([\s\S]*?)</svg>\s*'
        r'</div>\s*'
        r'</div>',
        re.IGNORECASE
    )

    def replace_160(match):
        card_num = int(match.group(1))
        span_style = match.group(2)
        span_text = match.group(3)
        h4_style = match.group(4)
        h4_text = match.group(5)
        desc_text = match.group(6)
        div_style = match.group(7)
        div_text = match.group(8)
        viewbox = match.group(9)
        svg_style = match.group(10)
        svg_body = match.group(11)

        svg_body_clean = re.sub(
            r'<rect\s+x="5"\s+y="5"\s+width="150"\s+height="110"\s+rx="6"\s+fill="none"[^>]*/>\s*',
            '',
            svg_body,
            flags=re.IGNORECASE
        )

        if card_num % 2 == 1:
            align_self = "flex-start"
            margin_side = "left"
            margin_val = "4%"
        else:
            align_self = "flex-end"
            margin_side = "right"
            margin_val = "4%"

        comment = f"<!-- 1:1 Matching Card {card_num}: Staggered Vertical Unified Layout in SVG (Large) -->"

        # Expanded to max-width: 420px for massive visuals + foreignObject tightly coupled at y: 108 to prevent gaps
        return f"""{comment}
                        <div style="width: 100%; max-width: 420px; align-self: {align_self}; margin-{margin_side}: {margin_val}; display: flex; justify-content: center;">
                            <svg width="100%" height="auto" viewBox="15 0 130 125" style="overflow: visible; {svg_style}">
                                <g>
{svg_body_clean}                                </g>
                                <foreignObject x="5" y="108" width="150" height="15">
                                    <div xmlns="http://www.w3.org/1999/xhtml" style="display: flex; align-items: center; justify-content: center; height: 100%; font-family: 'Outfit', 'Pretendard', sans-serif; font-size: 4.4px; font-weight: 700; color: #cbd5e1; line-height: 1.35; text-align: center;">
                                        {desc_text}
                                    </div>
                                </foreignObject>
                            </svg>
                        </div>"""

    section, count_160 = pattern_160.subn(replace_160, section)
    if count_160 > 0:
        print(f"    Replaced {count_160} 160px cards.")

    # 3. Tweet Box transform removal
    tweet_pattern = re.compile(
        r'<!--\s*Karpathy\s*Tweet\s*Box[^\n]*-->\s*'
        r'<div style="([^"]*?)\s*transform:\s*perspective\(1000px\)\s*rotateY\(12deg\);"',
        re.IGNORECASE
    )
    section, count_tweet = tweet_pattern.subn(
        r'<!-- Karpathy Tweet Box (Scaled slightly) -->\n                        <div style="\1"',
        section
    )
    if count_tweet > 0:
        print(f"    Refactored {count_tweet} Tweet Box transforms.")

    # 4. Modify visual columns in this target section
    section = re.sub(
        r'<div class="col-50" style="height:\s*100%;\s*display:\s*flex;\s*flex-direction:\s*column;\s*justify-content:\s*center;\s*gap:\s*15px;\s*position:\s*relative;">',
        r'<div class="col-55" style="height: 100%; display: flex; flex-direction: column; justify-content: center; gap: 6px; position: relative;">',
        section,
        flags=re.IGNORECASE
    )
    section = re.sub(
        r'<div class="col-45" style="height:\s*100%;\s*display:\s*flex;\s*flex-direction:\s*column;\s*justify-content:\s*center;\s*gap:\s*20px;\s*position:\s*relative;">',
        r'<div class="col-55" style="height: 100%; display: flex; flex-direction: column; justify-content: center; gap: 8px; position: relative;">',
        section,
        flags=re.IGNORECASE
    )
    section = re.sub(
        r'<div class="col-45" style="height:\s*100%;\s*display:\s*flex;\s*flex-direction:\s*column;\s*justify-content:\s*center;\s*gap:\s*15px;\s*position:\s*relative;">',
        r'<div class="col-55" style="height: 100%; display: flex; flex-direction: column; justify-content: center; gap: 6px; position: relative;">',
        section,
        flags=re.IGNORECASE
    )
    section = re.sub(
        r'<div class="col-43" style="height:\s*100%;\s*display:\s*flex;\s*flex-direction:\s*column;\s*justify-content:\s*center;\s*gap:\s*15px;\s*position:\s*relative;">',
        r'<div class="col-55" style="height: 100%; display: flex; flex-direction: column; justify-content: center; gap: 6px; position: relative;">',
        section,
        flags=re.IGNORECASE
    )

    # 5. Modify explanation columns in this target section
    section = re.sub(
        r'<div class="col-50 glass-panel" style="height:\s*100%;\s*display:\s*flex;\s*flex-direction:\s*column;\s*justify-content:\s*center;\s*gap:\s*24px;\s*text-align:\s*center;\s*align-items:\s*center;\s*padding:\s*45px\s*50px;">',
        r'<div class="col-40 glass-panel" style="height: 100%; display: flex; flex-direction: column; justify-content: center; gap: 20px; text-align: center; align-items: center; padding: 30px 30px;">',
        section,
        flags=re.IGNORECASE
    )
    section = re.sub(
        r'<div class="col-55 glass-panel" style="height:\s*100%;\s*display:\s*flex;\s*flex-direction:\s*column;\s*justify-content:\s*center;\s*gap:\s*24px;\s*text-align:\s*center;\s*align-items:\s*center;\s*padding:\s*45px\s*50px;">',
        r'<div class="col-40 glass-panel" style="height: 100%; display: flex; flex-direction: column; justify-content: center; gap: 20px; text-align: center; align-items: center; padding: 30px 30px;">',
        section,
        flags=re.IGNORECASE
    )
    section = re.sub(
        r'<div class="col-57 glass-panel" style="height:\s*100%;\s*display:\s*flex;\s*flex-direction:\s*column;\s*justify-content:\s*center;\s*gap:\s*24px;\s*text-align:\s*center;\s*align-items:\s*center;\s*padding:\s*45px\s*50px;">',
        r'<div class="col-40 glass-panel" style="height: 100%; display: flex; flex-direction: column; justify-content: center; gap: 20px; text-align: center; align-items: center; padding: 30px 30px;">',
        section,
        flags=re.IGNORECASE
    )

    return section

def refactor_file_by_sections(file_path, target_slides):
    print(f"Refactoring {file_path} for slides {target_slides}...")
    with open(file_path, "r", encoding="utf-8") as f:
        content = f.read()

    raw_sections = content.split("</section>")
    processed_sections = []

    for section in raw_sections:
        is_target = False
        for ts in target_slides:
            if re.search(rf'SLIDE\s*{ts}\b', section, re.IGNORECASE):
                is_target = True
                break

        if is_target:
            print(f"  Refactoring target Slide block...")
            section = refactor_section_content(section)

        processed_sections.append(section)

    new_content = "</section>".join(processed_sections)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(new_content)

refactor_file_by_sections(theory_path, ["04", "05", "06", "07"])
refactor_file_by_sections(demo_path, ["03", "07", "11"])
print("Success!")




