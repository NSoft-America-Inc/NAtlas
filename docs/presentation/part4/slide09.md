---
title: 'Slide 38: 작업 진행 상황 실시간 확인 — Update 탭 로그 뷰어'
layout: 'SSE Stream Pipe'
part: 'PART 5: NAtlas GUI 지식 탐색 및 아키텍처'
---

# Slide 38: 작업 진행 상황 실시간 확인 — Update 탭 로그 뷰어

## 1. 화면 정의 및 레이아웃 (Layout Specification)

- **레이아웃 구조**: 백그라운드 python 프로세스의 표준 로그 출력이 비동기 스트리밍 파이프라인을 타고 React LogViewer UI에 끊김 없이 분출되는 **SSE 로그 스트리밍 레이아웃 (SSE Stream Pipe Layout)**.
- **비주얼 및 컴포넌트 구성**:
  - **좌측 비주얼**: 사파이어 네온과 퍼플 네온 3D 스트림 전송 다이어그램. 좌측 하단의 Python SSE 엔드포인트에서 생성된 보라색 원자 데이터 패킷들이 투명한 유리관 파이프(Stream Pipe)를 타고 고속 펄스 모션 애니메이션으로 솟구쳐, 우측의 React LogViewer 터미널 스크린으로 흩뿌려지며 로그 텍스트 라인들이 스무스하게 위로 밀려 롤링업(Scrolling Up)되는 역동적 SVG 구현.
  - 실시간 비동기 통신을 증명하는 **⚡ SSE ACTIVE (REAL-TIME STREAM)** 배지 적용.

## 2. 실질적 본문 내용 (Exact Slide Content)

### ⚡ 0.1초의 통신 렉(Lag)도 없이, 백엔드의 숨결을 실시간 복사하는 SSE 스트리밍

SwarmVault RAG의 지식 빌드 및 인덱싱 업데이트는 수천 개의 파일을 파싱하는 무거운 작업으로, 완료 시까지 길게는 수십 초가 소요됩니다. NAtlas는 이 빌드 진행률과 백엔드 uvicorn 로그를 "작업 완료 후 한꺼번에 로딩창으로 보여주는" 미개한 방식을 폐기하고, 단방향 실시간 비동기 전송 기술인 **Server-Sent Events(SSE)**를 통해 사용자 화면에 한 줄씩 스무스하게 흩뿌려줍니다.

- **📡 Server-Sent Events (SSE) 비동기 통신 규격 [SSE Spec]**:
  - WebSockets의 불필요한 양방향 오버헤드를 배제하고, HTTP 프로토콜 상에서 서버가 클라이언트로 데이터를 끊임없이 밀어내는 초경량 단방향 푸시 스트림(`text/event-stream`)을 기동합니다.
- **🖥️ React LogViewer 성능 최적화 [LogViewer Optimization]**:
  - **Virtual Scrolling (가상 스크롤)**: 수만 라인의 로그 스트리밍 분출 시 DOM 개수 폭발로 인한 React 렌더링 렉을 차단하기 위해, 브라우저 뷰포트에 보이는 영역의 30개 라인만 동적 메모리 렌더링합니다.
  - **Buffer Throttle (버퍼 조절)**: 초당 수백 줄의 고속 로그가 들어올 때 UI 스레드가 굳는 병목을 차단하기 위해, 50ms 간격으로 버퍼링 집계 후 React state를 일괄 업데이트(Batching)합니다.

## 3. 스피치 노트 (Aside Speaker Notes)

_"이번 슬라이드는 NAtlas GUI 아키텍처 중 비동기 통신의 끝판왕, 바로 'SSE 실시간 로그 스트리밍' 메커니즘입니다. SwarmVault RAG의 인덱스 빌드 업데이트는 수십 초가 걸리는 무거운 로직입니다. 10초 동안 로딩 바만 빙빙 도는 불투명한 화면 대신, NAtlas는 서버의 실시간 숨결을 사용자 터미널 뷰어로 즉시 스트리밍해 줍니다. HTTP 프로토콜 상에서 동작하는 초경량 단방향 비동기 채널인 Server-Sent Events(SSE) 기술을 적용해, 좌측 비주얼처럼 보라색 데이터 패킷이 파이프라인을 타고 쉴 새 없이 솟구쳐 우측 LogViewer 터미널에 스무스하게 흩뿌려집니다. 초당 수백 줄씩 쏟아져 나오는 로그 때문에 화면이 굳는 브라우저 병목을 막고자, 가상 스크롤과 버퍼 스로틀 배칭 기술을 탑재해 렉 없이 부드럽게 글귀들이 롤링업되는 고성능 GUI 뷰어를 완성했습니다."_
