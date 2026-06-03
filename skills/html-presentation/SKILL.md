---
name: 'html-presentation'
description: '주어진 마크다운 파일(예: slide_*.md)을 기반으로, 화려한 비주얼 상호작용과 고품격 타이포그래피 표준을 100% 만족하는 Reveal.js 기반의 프리미엄 HTML 발표자료를 구축하는 특화 스킬'
---

# Skill: html-presentation (마크다운 기반 프리미엄 HTML 발표자료 컴파일러 및 설계 표준)

이 스킬은 구조화된 지식 마크다운 문서들(예: `slide_1.md` ~ `slide_N.md`)을 읽어내어, 전사 보고 및 고위직 브리핑에 적합한 **네온 글래스모피즘 테마 기반의 Reveal.js 모듈러 웹 프레젠테이션(`docs/presentation/presentation_*.html`)을 수작업/정밀 코딩 방식으로 안전하게 빌드하고 설계**하기 위해 수립된 Antigravity 전용 스킬입니다.

---

## 🛑 극적 프레젠테이션 설계 5대 수립 규칙 (Mandatory Design Standards)

이 스킬을 사용하는 모든 에이전트와 개발자는 다음의 5가지 디자인 표준 가이드라인을 **단 1픽셀, 단 한 단어의 오차도 없이 100% 엄격하게 준수**해야 합니다. 이 중 하나라도 위반한 프레젠테이션은 실패로 간주됩니다.

### 1. 마크다운 기호 완전 소거 및 웹 하이라이팅 (Zero Raw Markdown Symbols)

- **금지 사항**: 텍스트 내부에 `**굵은 텍스트**`나 백틱(`` ` ``) 등 raw 마크다운 문법 기호가 HTML 화면에 그대로 노출되어 렌더링되는 현상을 철저히 금지합니다.
- **해결 지침**:
  - 모든 굵은 강조 텍스트는 `<strong style="color: var(--accent-color);">텍스트</strong>` 와 같이 변경하여 웹 표준 하이라이팅으로 개편합니다.
  - 액센트 컬러는 Reveal.js 슬레이트 테마 변수(`var(--accent-indigo)`, `var(--accent-emerald)`, `var(--accent-rose)`, `var(--accent-amber)`, `var(--accent-blue)`)를 활용하여 각 카드와 슬라이드 테마에 알맞게 매핑합니다.
  - 마크다운 backtick 기호는 완전 제거하고 HTML `<code>` 태그로 정합 이식합니다.

### 2. 단어 쪼개짐 개행 금지 및 균등 가운데 정렬 (Even Multi-line Wrapping & Centering)

- **금지 사항**: 문장 끝에서 단어가 기계적으로 잘려 `구` 와 `현합니다.`와 같이 한 글자만 다음 줄로 넘어가 가독성을 파괴하는 시각적 결함을 원천 금지합니다.
- **해결 지침**:
  - 모든 텍스트 단락과 핵심 요약문은 문장의 좌우 대칭성과 길이를 정교하게 고려하여 **균등한 단어 단위로 수동 개행(`<br>`)**을 적용합니다.
  - 본문 요약 카드와 텍스트 패널 내의 항목들은 **가운데 정렬(`text-align: center;`)** 및 Flex Center 구도를 적용하여 시각적 안정성과 카드 중심 대칭을 극대화합니다.
  - 문장 줄 바꿈 시, 긴 첫 줄과 극단적으로 짧은 두 번째 줄의 비대칭을 피하고 상하단 줄의 너비가 균등하게 나뉘도록 디자인합니다.
  - **슬라이드 최상단 대제목(`<h2>` 태그)**은 일부 슬라이드만 좌측 정렬되고 다른 슬라이드는 가운데 정렬되는 **정합성 파손을 원천 차단**하기 위해, **예외 없이 100% 화면 정중앙 배치(`align-self: center; text-align: center; width: 100%;`)**를 준수해야 합니다. 마진 여백 또한 아래 컴포넌트들과의 비대칭 및 밀착을 방지하도록 균형감 있게 보정합니다.

### 3. 좌우 요소 물리적 겹침 및 가림 절대 방지 (Zero Visual Overlap & Spatial Isolation)

- **금지 사항**:
  - 우측의 텍스트 설명 패널이 좌측 영역을 침범하거나, 반대로 **좌측의 3D/동적 시각화 요소 및 absolute 플로팅 카드(예: Slack/Jira/Memo 부유 카드 등)가 우측 글래스 패널 내부로 돌출되어 글자와 겹쳐지는 레이아웃 파손 현상**을 전면 금지합니다.
  - SVG 내부에 원래 하드코딩되어 있던 영문 텍스트 뱃지(예: `2 YEARS INACTIVE` 등)가 존재할 경우, 하단에 긴밀히 밀착된 국문 설명 `<foreignObject>` 노드와 물리적 좌표 충돌을 일으키며 겹쳐 보이는 시각 노이즈 현상을 전면 금지합니다.
- **해결 지침**:
  - 좌측 비주얼 컨테이너 내의 모든 `position: absolute;` 플로팅 노드들은 **부모의 우측 경계선을 침범하는 음수 오프셋 설정을 원천 금지**하며, 최소 `right: 0%` 이상을 유지하여 좌측 컬럼 영역 내부(Visual Sandbox)에 물리적으로 완전히 가두어야 합니다.
  - **다단 컬럼 스왑 표준 (col-55 / col-40 Swapping)**: 화면 2열 분할 시, 그림 렌더링 영역의 물리 가로 면적을 추가 개척하기 위해 가로 폭 비율을 **좌측 비주얼 `col-55`, 우측 설명글 `col-40`**으로 분배하고, 컬럼 간 간격을 **`gap: 20px` 내외**로 긴밀하게 튜닝합니다.
  - **여백 크롭형 상단 이미지 극대화 & 하단 텍스트 통합 (Vertical Crop SVG)**:
    - 뷰박스 좌우의 빈 마진 40px을 도려낸 **`viewBox="15 0 130 84"`** (Slide 05와 같은 장신 카드는 **`viewBox="15 0 130 125"`**) 압축 포맷을 적용하여 드로잉 해상도를 4배 이상 극대화시킵니다.
    - 카드의 최대 가로 너비 한계를 **`max-width: 420px`**로 대폭 상향 스케일업합니다.
    - 텍스트와 그래픽 간의 유격을 완전히 억제하여 이미지와 바짝 결합되어 보이도록 하되, 겹침을 방지하기 위해 `<foreignObject>`의 시작 수직 좌표를 **`y = 67`** (장신 카드는 **`y = 108`**)로 배치하여 **초밀착 황금 밸런스(Golden Tight-Gigantic Offset)**를 구현합니다.
    - **비대칭 지그재그 4% 오프셋 (4% Asymmetric Staggered Cross Layout)**: 홀수 카드는 `align-self: flex-start; margin-left: 4%;`, 짝수 카드는 `align-self: flex-end; margin-right: 4%;`를 적용하여 정중앙의 균형을 유지하면서도 단조로움을 파괴하는 세련된 비대칭 리듬을 실현합니다.
    - **세로 오버플로우 방어 gap 제어**: 카드 3개 적재 시 Reveal.js 하단 푸터를 침범하지 않도록 비주얼 컨테이너 내부 `gap`을 **`6px` ~ `8px`** 수준으로 조밀하게 잠급니다.
  - **CSS Animation vs SVG transform 오버라이드 충돌 극복 (절대좌표 뱃지 설계)**:
    - SVG 내의 `g` 태그에 CSS `animation: scale-pulse` 등을 동시에 설정하면 SVG의 `transform="translate(x, y)"`가 덮어써져 뱃지가 `(0, 0)` 등 엉뚱한 위치로 공중 분할 이탈하는 치명적 렌더링 버그가 있습니다.
    - 이를 방지하기 위해 펄스/스케일 뱃지 등은 `transform` 속성 대신 **절대 좌표 `cx`, `cy` 속성을 직접 명시(예: `cx="94" cy="50"`)**하여 문서 우측 하단 등에 확고하게 부착시킵니다.
  - **고가독 사실적 드로잉 (Folded Corner 기법)**:
    - 단순 사각형 대신 우측 상단 모퉁이를 비스듬히 접은 사실적 마크다운 문서 디자인(`path d="M 26,0 L 36,10 L 26,10 Z"`)과 사방의 성에 데코(❄️)를 조합하여 '얼어붙어 박제된 레거시 지식의 위기' 등을 극도로 직관성 있게 시각화합니다.
  - SVG 드로잉 영역 내부에서 겹쳐 보일 수 있는 모든 불필요한 하드코딩 영문 텍스트(예: `2 YEARS INACTIVE`, `order.md LOCKED`)는 리팩토링 정규식 필터 등을 통해 흔적 없이 안전하게 소거합니다.

### 4. 텍스트 밀집 차단 및 여백 확보 (Whitespace Preservation)

- **금지 사항**: 슬라이드 내부에 마크다운의 길고 복잡한 단락을 요약 없이 통째로 쏟아부어 여백이 전혀 없고 숨 막히며 정신없는 데이터 밀집 상태를 유발하는 것을 금지합니다.
- **해결 지침**:
  - 아키텍처 의사결정과 라이브러리 선정 근거 등 핵심 팩트는 온전히 보존하되, 문장을 정제하여 빽빽하지 않은 세련된 비즈니스 단문으로 요약 구성합니다.
  - 문단 및 요약 리스트 아이템 사이에는 반드시 `gap: 12px ~ 16px` 수준의 충분한 빈 공간(White Space)을 **전체 카드 볼륨의 30% 이상** 확보하여 청중의 시각적 휴식을 보장합니다.

### 5. 전문 톤앤매너 엄수 (Engineering Professionalism)

- **금지 사항**: "눈물의 리버스 엔지니어링", "슬랙 검색 구걸 루프", "Fee Explosion 번개"와 같이 기형적이고 과장되며 가짜 같이 유치해 보이는 인위적인 예시를 텍스트에 사용하는 것을 전면 금지합니다.
- **해결 지침**:
  - 엔지니어들과 의사결정권자들의 깊은 신뢰와 공감을 자아낼 수 있도록 고도로 정제된 **IT 비즈니스 및 소프트웨어 아키텍처 정식 표준 용어**들만 엄선하여 적용합니다.
  - _예시 개편안_:
    - "슬랙 검색 구걸 루프" ➔ **"히스토리 탐색 비용 증가 및 커뮤니케이션 단절"**
    - "의사결정 독점 98%" ➔ **"특정 개발자 의존성 및 업무 병목 편중"**
    - "눈물의 리버스 엔지니어링 야근" ➔ **"소스코드 직접 분석으로 인한 리소스 낭비"**

### 6. 직관적 비주얼 메타포 정의 및 의미 전달 표준 (Semantic Visual Metaphors & Meaning Delivery)

- **금지 사항**:
  - 의미를 알 수 없는 단순 추상 기하학 도형, 무분별하게 복잡한 화살표, 맥락이 없는 사각형 평면 상자 리스트의 단순 방치를 철저히 금지합니다.
  - 슬라이드를 처음 마주하는 청중이 그래픽이 뜻하는 바를 즉각적으로 유추할 수 없는 불분명한 디자인 형태를 금지합니다.
- **비주얼 메타포 설계 지침**:
  - **레거시 및 정보 박제화 (Frozen Knowledge)**: 2년 전 과거 README 문서 등 비활성 지식을 시각화할 때는 단순 평면 상자가 아닌, **우측 상단 모퉁이가 접힌 사실적 마크다운 문서 오브젝트(Folded Corner 기법 - `M 26,0 L 36,10 L 26,10 Z`)**와 사방의 **눈꽃 성에 데코(❄️)**, 그리고 적색 경고의 **물리적 잠금장치 자물쇠(Lock 펄스 뱃지)**를 정밀 정합하여 '얼어붙어 박제된 지식의 위기 상태'를 시각적으로 직접 체감할 수 있게 묘사합니다.
  - **SPOF 인적 장애 및 의존성 (Human Bottleneck)**: 히스토리 단절 및 특정 개발자 의존성 병목을 표현할 때는, 서버 노드와 터미널 콘솔 위로 질문/메모 느낌표 뱃지가 **기형적으로 쏠려 과적합되는 광선 결합 병목망**을 형상화합니다.
  - **자동 검증 및 치유 (Linter & Healer)**: 린터의 엄격한 규격 통제와 Healer 복구 기전을 연출할 때는 **방패(Shield) 형태의 네온 아웃라인, 경고 뱃지, 그리고 자동 수혈 회생 패킷 광선**과 같은 능동적이고 상호작용적인 비주얼 피드백을 적용합니다.
  - **RAG 지식 증강 및 인덱싱 (Ingestion Loop)**: 지식의 시맨틱 인덱싱과 RAG 수혈 기전은 **실시간 회로망 펄스, 구체 구도를 감싸고 공전하는 위성 궤도선, 압축 캡슐** 등을 통해 지식의 흐름을 해설합니다.
- 모든 비주얼 그래픽은 단순한 미적 데코레이션을 넘어, **IT 아키텍처적 인과 관계와 조직의 페인 포인트(Pain Point)를 1초 만에 납득시키는 구체적이고 직관적인 메타포**에 기반해야 합니다.

---

## 🛠️ 리소스 구성 (Resource Template)

스킬을 기동할 때, 아래의 프리미엄 글로벌 네온 글래스모피즘 스타일과 최상위 Z-Index 햅틱 내비게이션 바가 내장된 기본 HTML 스켈레톤 구조를 기본 리소스로 활용하십시오.

### 1. 글로벌 네온 글래스모피즘 CSS 핵심 변수 및 유틸리티

```css
:root {
  --background-color: #030408;
  --accent-blue: #0ea5e9;
  --accent-indigo: #6366f1;
  --accent-purple: #a855f7;
  --accent-emerald: #10b981;
  --accent-rose: #f43f5e;
  --accent-amber: #f59e0b;
  --text-main: #f8fafc;
  --text-muted: #94a3b8;
  --glass-bg: rgba(9, 12, 22, 0.6);
  --glass-border: rgba(255, 255, 255, 0.05);
}

/* Neumorphic & Glassmorphic Custom Scrollbar for Text Containers */
.text-scroll-panel::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.text-scroll-panel::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.02);
  border-radius: 10px;
}
.text-scroll-panel::-webkit-scrollbar-thumb {
  background: rgba(99, 102, 241, 0.35);
  border-radius: 10px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}
.text-scroll-panel::-webkit-scrollbar-thumb:hover {
  background: rgba(99, 102, 241, 0.6);
}

/* Glassmorphism Panel style */
.glass-panel {
  background: var(--glass-bg);
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  border: 1.5px solid var(--glass-border);
  border-radius: 20px;
  padding: 30px;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7);
  box-sizing: border-box;
}
```

### 2. 최상위 Z-Index 글로벌 햅틱 내비게이션 바

```html
<div class="neon-nav-bar">
  <button class="neon-nav-btn neon-nav-btn-prev" onclick="Reveal.prev()">◀ PREV</button>
  <div class="neon-nav-indicator" id="globalSlideIndex">01 / 54</div>
  <button class="neon-nav-btn neon-nav-btn-next" onclick="Reveal.next()">NEXT ▶</button>
</div>
```

---

## 📋 스킬 실행 라이프사이클 (Execution Lifecycle)

1. **마크다운 슬라이드 읽기 및 전처리**:
   - `slide_*.md` 파일 목록을 스캔하고, 각 파일의 Frontmatter(layout, title, part)와 `## 2. 실질적 본문 내용` 원문을 전독(Read)합니다.
2. **5대 프레젠테이션 규칙에 따른 텍스트 정제**:
   - 마크다운 굵기(`**`) 등의 기호를 정밀 필터링하여 인라인 하이라이팅 HTML 태그로 치환합니다.
   - 단어가 쪼개지지 않도록 문맥 단위 균등 수동 개행(`<br>`)을 삽입하고, 가운데 정렬 속성을 설계합니다.
   - 과장되거나 유치한 어조를 학술적/엔지니어링 표준 비즈니스 어조로 수정 요약합니다.
3. **2열 다변화 및 시각 영역 격리 빌드**:
   - 좌우 45:55 분할 컨테이너 클래스를 설계하여, 좌측 시각화 요소와 우측 글래스 텍스트 영역의 물리 공간을 격리합니다.
4. **글로벌 내비게이션 바 통합 및 동적 바인딩**:
   - 최상위 햅틱 내비게이션 바를 병합하고, Reveal.js 라이프사이클 이벤트를 바인딩하여 동적 인덱스 갱신을 주입합니다.
5. **무결성 린터 검증**:
   - `verify_nstack_pipeline.py` 스크립트를 기동하여 전체 파이프라인 정합성에 위반이 없음을 검증 통과시킵니다.

---

## 🎭 4열 프레젠테이션 모듈러 아키텍처 표준 (4-Track Modular Presentation Architecture)

발표의 흐름과 발표자의 유기적인 시연 동선을 위해 프레젠테이션은 단일 거대 파일이 아닌, **역할에 따라 철저히 물리적으로 격리된 4개의 독립된 모듈러 HTML 발표자료**로 이원화 및 격리 구축되어야 합니다.

### 1. 설명용 메인 이론 슬라이드 (`presentation_theory.html`)

- **목적**: AI 고속 코딩의 양날의 검, 사내 기술 부채 진단, 소스코드 역공학의 한계와 토큰 절감 실증 벤치마크, NStack의 규격 및 Linter/Healer의 동작 기전(Fuzzy Header Matching 등), 인간/기계 듀얼 트랙 흐름도 설명.
- **포함 파트**: PART 1, PART 2, PART 3 (총 28개 슬라이드)
- **비주얼 명세**: 개념적 이해를 돕기 위한 3D SVG Chaos Canvas, 흐름도, 벤치마크 표, 듀얼 트랙 모션 그래픽 탑재.

### 2. 프로젝트 실전 라이브 데모 슬라이드 (`presentation_demo_project.html`)

- **목적**: 바닐라 JS Todo App 코딩 ➔ React/Zustand 마이그레이션 ➔ Linter 차단 및 Healer 자동 복구를 터미널과 에디터 시뮬레이션을 통해 직접 입증하는 시연 가이드.
- **포함 파트**: PART 4 (총 11개 슬라이드)
- **비주얼 명세**: 시연 화면의 높은 가독성을 위해 **일반 대비 1.2배 큰 폰트 및 카드 크기**를 적용하고, 터미널 및 VS Code 시뮬레이터 카드 UI를 극대화하여 코딩 과정을 입체적으로 지원.

### 3. NAtlas GUI 탐색 데모 슬라이드 (`presentation_demo_natlas.html`)

- **목적**: NAtlas 데스크탑 메인 프로세스-FastAPI 사이드카 생명주기 공조 아키텍처와 SSE 실시간 색인 로깅 UX를 설명하고, **PART 4 시연 중 발생한 실물 아티팩트 문서들(Vanilla JS, React 마이그레이션)을 NAtlas에 실제로 컴파일 이식하여 3D 지식 지도 상에서 유기적으로 노드가 자성 결합하는 실시간 GUI 탐색 시연**.
- **포함 파트**: PART 5, PART 6 (총 11개 슬라이드)
- **비주얼 명세**: React 탭 변경, Resizable Panels 동작 반응형 Canvas, D3-force 물리 인터랙션 3D 모션을 아름다운 네온 글로우 모션으로 연출.

### 4. 전사적 비전 및 미래 로드맵 슬라이드 (`presentation_vision.html`)

- **목적**: 전사 지식 파이프라인 도입 성과 대시보드 브리핑, Phase 1 개발 완료 보고 및 Phase 2 & 3 미래 로드맵 제시, 최종 전사 비전 마무리를 담당하는 피날레 슬라이드.
- **포함 파트**: PART 7 (총 6개 슬라이드 규모로 확장 보강)
- **비주얼 명세**: 화려한 대시보드 글로벌 입체 메트릭스, 연도별 입체 타임라인, NSoft America 전사 로고가 네온 빔 라이트로 회전하는 프리미엄 연출.
