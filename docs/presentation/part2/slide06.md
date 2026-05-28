---
title: "Slide 15: 아티팩트 1 - 작업지시서 order.md의 내부 스펙"
layout: "Order Spec Binder"
part: "PART 2: NStack 설계 사상 및 아티팩트 규격"
---

# Slide 15: 아티팩트 1 - 작업지시서 order.md의 내부 스펙

## 1. 화면 정의 및 레이아웃 (Layout Specification)

- **레이아웃 구조**: AI 에이전트의 개발 태스크 진입 전에 구현 제약 사양을 철벽으로 두르는 **지시서 스펙 바인더 레이아웃 (Order Spec Binder)**.
- **비주얼 및 컴포넌트 구성**:
  - **좌측 비주얼**: VS Code 에디터처럼 구조화된 파일 트리 뷰 위에 `Git Setup`, `Context & Goal`, `Implementation Detail`, `Completion Criteria` 4대 필수 헤더 영역이 쇠사슬 모양의 강력한 락 체인(Lock Chain) 링크로 연결되어 단단히 결합되는 SVG 그래픽.
  - 체인 조인트 부위마다 은은한 에메랄드/푸른색 레이저 네온 글로우 스포트라이트가 회전하는 모션 연출.

## 2. 실질적 본문 내용 (Exact Slide Content)

### ⛓️ AI 에이전트의 탈선을 막는 철저한 사전 계약 명세

코드를 단 한 줄 쓰기 전에, 인간 개발자는 요구사양의 정확한 경계를 획정해야 합니다. **`order.md` (작업지시서)**는 에이전트에게 내리는 사전 행동 약속이자 스펙 바인더로, 린터(`verify_nstack_pipeline.py`)가 커밋 시점에 기계적으로 정합성을 쪼는 **4대 필수 섹션**으로 칼정렬 규정되어 있습니다.

- **## (1) Git Setup [The Guardrail]**:
  - 로컬 브랜치 생성 전략과 원격 upstream 및 origin 연결 상태를 사전 검증하여 소스코드 트리오의 형상 안전성을 최우선 확보합니다.
- **## (2) Context & Goal [The Context]**:
  - 왜 이 리팩토링이나 기능 구현이 필요한지에 대한 비즈니스/엔지니어링 배경을 기술합니다. AI의 의미적 정렬(Alignment)을 유지하는 핵심 뇌세포 역할을 합니다.
- **## (3) Implementation Detail [The Blueprint]**:
  - 수정될 컴포넌트 목록과 세부 아키텍처 아웃라인을 미리 기재하여, 에이전트가 관련 없는 타 영역의 파일을 임의로 난도질하는 참사를 철벽 예방합니다.
- **## (4) Completion Criteria [The Quality Gate]**:
  - 에이전트의 작업 완료 여부를 스스로 판독하고 linter의 pre-commit hook 통과 조건과 교차 검증을 수행하는 단단한 합격 기준을 명시합니다.

## 3. 스피치 노트 (Aside Speaker Notes)

*"NStack 아티팩트의 첫 주자인 `order.md` 작업지시서의 내부 정밀 사양을 보겠습니다. 이 문서는 AI 에이전트에게 건네는 일종의 '스펙 계약서'입니다. 린터가 커밋 시점에 눈에 불을 켜고 검사하는 네 가지 필수 H2 구역을 강제합니다. 환경을 제어하는 `Git Setup`, 목표를 정렬하는 `Context & Goal`, 수정할 파일 목록을 도면으로 설계하는 `Implementation Detail`, 그리고 린터 합격 여부를 다루는 `Completion Criteria`입니다. 코딩 전에 이 네 영역에 단단한 쇠사슬을 채워두기 때문에 에이전트는 감히 탈선할 꿈도 꾸지 못한 채 최고의 무결성 코드를 뽑아내게 됩니다."*
