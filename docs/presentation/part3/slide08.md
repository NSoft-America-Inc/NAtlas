---
title: "Slide 28: 신규 개발 작업계획서 실물 공개 (실제 화면 띄우기 2)"
layout: "VS Code Editor"
part: "PART 4: 듀얼 라이브 데모 - 개발에서 마이그레이션까지"
---

# Slide 28: 신규 개발 작업계획서 실물 공개 (실제 화면 띄우기 2)

## 1. 화면 정의 및 레이아웃 (Layout Specification)

- **레이아웃 구조**: 에이전트가 코딩 전에 작성하여 제출한 작업계획서(`order.md`)의 실물 데이터와 메타 영역을 낱낱이 훑어보는 **작업계획서 뷰어 레이아웃 (Order Spec Viewer Layout)**.
- **비주얼 및 컴포넌트 구성**:
  - **좌측 비주얼**: 사파이어 네온 코드가 흐르는 마크다운 문서 3D 인포그래픽. 파일의 최상단 YAML Frontmatter 윈도우(`--- title: ... ---`)와 이어서 정렬된 H2 필수 구조 격자(`## (1) Git Setup`, `## (2) Context & Goal`, `## (3) Implementation Detail`, `## (4) Completion Criteria`)가 각각 에메랄드색 타겟 조준선 및 글로우 라벨로 정렬 분석되는 구조의 SVG 구현.
  - 규격 정합성의 패스를 선언하는 **📑 ORDER SPEC VALIDATED (LINTER PASS)** 배지 적용.

## 2. 실질적 본문 내용 (Exact Slide Content)

### 📑 설계의 탈선(Derailment)을 막아 주는 안전한 이정표, order.md 실물

지시를 받은 에이전트가 코딩보다 한 발 앞서 작성해 제출한 실제 **`todo-app/order.md`** 파일의 실물 소스 코드입니다. NStack 정적 린터의 무결성 검증 필터를 `PASS`하고 완벽한 양식 정렬을 맞춘 상태입니다.

- **📄 todo-app/order.md 실물 소스 코드 [Actual Source Code]**:
  ```markdown
  ---
  title: "Todo App 핵심 기능 및 할 일 필터 구현"
  issue_url: "https://github.com/NSoft-America-Inc/todo-app/issues/1"
  ---
  # Task: Implement Todo App Core Features
  
  ## (1) Git Setup
  * Branch: `feature/todo-core-vanilla`
  * Path: `src/todo-vanilla/`
  
  ## (2) Context & Goal
  사용자가 본인의 할 일을 유연하게 추가, 삭제, 토글 상태 관리하고 전체 현황을 대시보드로 요약 집계해 볼 수 있는 모던 경량 Vanilla UI 완성.
  
  ## (3) Implementation Detail
  * `index.html`: semantic grid 레이아웃 구성
  * `app.js`: Todo list Array 메모리 내 저장 및 필터링 집계 처리
  * `style.css`: slate 다크 무드 및 유리 재질 글래스모피즘 CSS 스타일시트 구성
  
  ## (4) Completion Criteria
  * [x] 할 일 추가 시 리스트 즉각 반영 및 입력창 초기화
  * [x] 할 일 개수 집계 요약판 수치 동적 업데이트 보장
  * [x] HTML/CSS 마크다운 린터 통과 및 zero placeholders
  ```

## 3. 스피치 노트 (Aside Speaker Notes)

*"화면에 보시는 마크다운 코드가 바로 에이전트가 코드를 한 줄도 짜기 전에 작성해 낸 `order.md` 작업계획서의 실제 원문입니다. 최상단에는 타이틀과 GitHub 이슈 추적 URL을 담은 YAML Frontmatter 메타데이터가 정교하게 박혀 있고, 이어서 Git Setup, 비즈니스 배경(Context & Goal), 구현 명세(Detail), 그리고 완료 기준(Criteria)까지 H2 섹션별로 빽빽하고 군더더기 없는 수치 데이터들이 기재되어 있습니다. 린터가 모든 주석과 공백을 걷어내고 순수 텍스트를 측정해도 H2당 10자를 가볍게 돌파하는 고밀도 지식 문서입니다. 이 계획서가 튼튼하게 버텨주고 있기에, 에이전트는 한 치의 탈선도 없이 목표한 스펙 그대로 코딩을 완료해 내는 든든한 등대를 얻게 되었습니다."*
