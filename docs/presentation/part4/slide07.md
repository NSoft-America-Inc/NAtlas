---
title: "Slide 36: [PART 5 시작] NAtlas 데스크탑 GUI 지식 탐색 및 아키텍처"
layout: "NAtlas Main App"
part: "PART 5: NAtlas GUI 지식 탐색 및 아키텍처"
---

# Slide 36: [PART 5 시작] NAtlas 데스크탑 GUI 지식 탐색 및 아키텍처

## 1. 화면 정의 및 레이아웃 (Layout Specification)

- **레이아웃 구조**: NAtlas 데스크탑 어플리케이션의 세련된 3단 분할 대시보드 화면 전체를 직관적으로 조망하는 **메인 앱 프레임 레이아웃 (Main App Frame Layout)**.
- **비주얼 및 컴포넌트 구성**:
  - **좌측 비주얼**: 사파이어 네온과 에메랄드 네온 빛이 도는 NAtlas 데스크탑 GUI 전체 와이어프레임. 좌측 1열에는 사이드바 네비게이션 탭(`Documents`, `Update`, `Settings`), 중앙 2열에는 SwarmVault 지식 위키 문서들의 리스트 및 시맨틱 쿼리 검색 필터창, 우측 3열에는 거대한 3D dynamic 지식 노드맵과 real-time LogViewer 패널이 정밀하게 구획된 고해상도 SVG 구현.
  - 앱 기동 상태와 아키텍처의 시작을 알리는 **🖥️ NATLAS MAIN GUI READY** 라벨 점등.

## 2. 실질적 본문 내용 (Exact Slide Content)

### 🖥️ 전사 지식을 한눈에 파악하고 지휘하는 NAtlas 데스크탑 GUI

지금까지 NStack 린터와 SwarmVault RAG의 기계적 무결성 원리를 살펴보았다면, 이제 이 모든 백엔드 지식을 인간 엔지니어의 시각과 유연한 터치로 조율하게 해 주는 최종 실체, **NAtlas 데스크탑 어플리케이션**의 세부 기능과 내부 시스템 아키텍처를 들여다볼 차례입니다. NAtlas는 복잡하고 단조로운 날것의 기술 아카이브를 아름답고 입체적인 3D 그래프 네트워크 대시보드로 격상시켜 시각화합니다.

- **📊 NAtlas Phase 1 MVP 핵심 기능 명세 [Phase 1 MVP Core Features]**:
  - **Documents Tab**: 저장소에 축적된 3종 지식 마일스톤(`order`, `report`, `wiki`) 문서들을 완벽하게 파싱하여 크리스탈 가독성의 다크모드 리더로 렌더링합니다.
  - **Update Tab**: SwarmVault RAG의 실시간 인덱싱 빌드 작업을 탭 한 번으로 기동하고, 백그라운드 uvicorn 로그를 끊김 없는 비동기 스트리밍으로 관찰합니다.
  - **Settings Tab**: 로컬 위키 저장소 경로 및 FastAPI 포트, 벡터 인덱스 파라미터 설정을 손쉽게 제어 및 저장합니다.
- **🛡️ 하이엔드 테크 데스크탑 아키텍처 [High-end Tech Desktop Architecture]**:
  - **Electron + React HMR + TanStack Query**의 고속 비동기 캐싱 구조와 **Python FastAPI Sidecar** 포트 결합을 통해, 데스크탑 OS 자원을 극적으로 활용하는 초고속 응답성을 확보했습니다.

## 3. 스피치 노트 (Aside Speaker Notes)

*"이번 슬라이드는 저희 프레젠테이션의 다섯 번째 대주제인 'PART 5: NAtlas GUI 지식 탐색 및 아키텍처'의 화려한 시작을 알리는 장표입니다. 그동안 백그라운드 터미널에서 작동하던 무결성 지식을 인간 개발자의 시각적 축복으로 격상시키는 NAtlas 데스크탑 앱의 모습을 감상하고 계십니다. 화면 좌측을 보시면 NAtlas의 실제 UI가 와이어프레임 구조로 펼쳐져 있습니다. 좌측 사이드바 탭부터, 중앙의 지식 마일리 리스트, 그리고 우측의 거대한 3D dynamic 지식 네트워크 노드 지도와 실시간 로그뷰어 패널이 유기적으로 구획되어 있죠. Electron 껍데기와 React HMR, TanStack Query 비동기 캐싱, 그리고 Python FastAPI 사이드카의 결합을 통해, 0.01초의 딜레이도 허용하지 않는 극강의 데스크탑 응답성을 달성한 구조입니다. 지금부터 NAtlas 앱 하부에서 톱니바퀴처럼 돌아가는 놀라운 내부 아키텍처 메커니즘을 상세히 소개해 드리겠습니다."*
