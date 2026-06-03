---
title: 'Slide 37: NAtlas 시작 구조 — 자동 실행과 충돌 방지'
layout: 'Sidecar Handshake'
part: 'PART 5: NAtlas GUI 지식 탐색 및 아키텍처'
---

# Slide 37: NAtlas 시작 구조 — 자동 실행과 충돌 방지

## 1. 화면 정의 및 레이아웃 (Layout Specification)

- **레이아웃 구조**: Electron Main 프로세스가 Python Sidecar 프로세스를 가동하고 포트 충돌을 자동 치유하여 Handshake를 성사시키는 **프로세스 샌드박스 레이아웃 (Process Handshake Layout)**.
- **비주얼 및 컴포넌트 구성**:
  - **좌측 비주얼**: 사파이어 네온과 황금색 네온 3D 프로세스 결합 다이어그램. 좌측의 Electron Main 노드(사파이어)에서 우측의 Python FastAPI Sidecar 노드(amber)로 spawn 신호선이 뻗어 나가는 도중, 이미 기점유되어 충돌을 뿜던 좀비 Uvicorn 노드가 적색 번개 타격 신호와 함께 **`SIGKILL`** 처리되며 파괴되고, 깨끗하게 복구된 **`Port 18420`** 통로를 통해 **`Health OK (Handshake)`** 에메랄드색 신호가 활성화되는 입체 SVG 구현.
  - 사이드카 구동 안전핀의 작동을 표시하는 **🛡️ API SIDECAR SECURED (3 RETRIES)** 라벨 점등.

## 2. 실질적 본문 내용 (Exact Slide Content)

### ⚓ 포트 충돌 좀비 프로세스를 SIGKILL하고, 스스로 일어서는 강인한 사이드카

데포지토리 지식을 고속 파싱하는 NAtlas는 OS 친화적인 고성능 Python FastAPI 엔진을 내장하고 있습니다. Electron 데스크탑 앱이 더블 클릭되어 런칭되는 그 0.1초 사이에, Electron Main process는 백그라운드에서 **`src/python/main.py`** 프로세스를 **`spawn`**으로 심고 상호 간의 통신(IPC) 악수를 시도합니다. 이 결합 과정을 완전무결하게 보호하는 자동 생명주기 제어 아키텍처를 가동합니다.

- **🚫 포트 18420 충돌 자동 제어 [Port Conflict Auto-Heal]**:
  - 로컬 환경에서 이전의 비정상 종료 등으로 인해 uvicorn이 18420 포트를 여전히 물고 있는 "Port Conflict" 좀비 상태가 종종 발생합니다.
  - Electron Main은 기동 즉시 로컬 18420 포트를 선제 스캔하여, 기점유 중인 좀비 PID(Uvicorn 프로세스 ID)를 지능적으로 색출한 뒤 **`SIGKILL`** 명령을 날려 강제 kill 후 포트를 무결하게 탈환합니다.
- **⚡ API Health Check 헬스 폴링 및 크래시 복구 [Handshake Lifecycle]**:
  - React 렌더링 시작 직전, Electron Preload 영역에서 **`/health`** API를 최대 10초간 고속 폴링하여 완벽한 Handshake 상태를 검증합니다.
  - 작동 중 Python 사이드카가 예기치 못한 크래시로 사망 시, 시스템은 이를 실시간 감지하여 최대 3회까지 백그라운드에서 **자동 재생 spawn**하여 서비스가 먹통이 되는 현상을 철저히 예방합니다.

## 3. 스피치 노트 (Aside Speaker Notes)

_"데스크탑 앱을 다루다 보면 가장 빈번하고 뼈아프게 마주하는 에러가 있습니다. 바로 '포트 충돌'입니다. 이전 실행 때 프로세스가 제대로 안 꺼져 좀비 uvicorn이 18420 포트를 물고 있으면, 다음 기동 시 앱이 하얗게 굳어버리고 에러를 뿜죠. NAtlas는 이 문제를 프로세스 레벨에서 완치했습니다. Electron이 런칭되는 0.1초의 짧은 순간에 로컬 포트 상태를 즉시 탐색합니다. 만약 포트 충돌이 감지되면 Uvicorn 좀비 프로세스의 PID를 칼같이 솎아내어 OS단에서 `SIGKILL`로 목을 베어 포트를 강제 확보합니다. 그리고 우측 다이어그램처럼 에메랄드색 `Handshake OK`를 성사시키며 python 사이드카를 안전하게 부팅합니다. 구동 중 크래시가 나더라도 3회 자동 재기동하는 안전핀까지 완비되어, 어떠한 환경에서도 튼튼하게 자가 구동하는 극강의 회복 탄력성을 지니고 있습니다."_
