---
title: 'Slide 44: Update 탭 — 버튼 하나로 AI 지식 갱신'
layout: 'TanStack Mutation Flow'
part: 'PART 5: NAtlas GUI 지식 탐색 및 아키텍처'
---

# Slide 44: Update 탭 — 버튼 하나로 AI 지식 갱신

## 1. 화면 정의 및 레이아웃 (Layout Specification)

- **레이아웃 구조**: 사용자가 단 한 번의 마우스 클릭으로 SwarmVault 지식 엔진 전체를 재인덱싱하고 RAG 구조를 dynamic 갱신하도록 트리거하는 **TanStack Mutation Trigger Layout**.
- **비주얼 및 컴포넌트 구성**:
  - **좌측 비주얼**: RAG 인덱스 재생성을 요청하는 POST API 동작 프로세스 SVG. 화면의 'REBUILD SWARMVAULT INDEX' 보라색 버튼을 탭 하는 순간, **useMutation** 트리거 신호가 전송 파이프라인을 타고 백엔드로 뻗어 나가며(`POST /swarmvault/update`), SwarmVault 데이터베이스 큐브가 에메랄드색 레이저 스캔을 받아 dynamic 분해되었다가 최신 마크다운 지식 결합 구조로 100% 재건축되는 고정밀 기계공학적 인터랙션 모션 시각화.
  - 비동기 뮤테이션 연동이 완벽하게 가동됨을 표시한 **⚡ MUTATION OPERATION RUNNING** 네온 배지 탑재.

## 2. 실질적 본문 내용 (Exact Slide Content)

### ⚡ useMutation 비동기 트랜잭션과 SwarmVault RAG Rebuilding 파이프라인의 전격 구동

NAtlas GUI는 읽기 중심의 useQuery 구조에서 더 나아가, 백엔드 데이터에 동적 부하를 가하는 CUD(Create, Update, Delete) 작업을 안전하게 격리 실행하기 위해 **TanStack Query useMutation 비동기 파이프라인**을 관제탑으로 기동합니다.

- **🎯 useMutation 기반의 POST 리퀘스트 제어 [TanStack useMutation]**:
  - **비동기 격리 실행 (Mutate Pipeline)**: 사용자가 'Update' 탭에서 RAG 인덱스 업데이트 버튼을 탭하는 순간, useMutation 훅이 발동하여 `POST http://localhost:18420/swarmvault/update` API를 트리거합니다.
  - **Mutate 상태 제어 (isLoading, error, onSuccess)**: 비동기 통신이 날아가는 동안 React UI는 dynamic 로딩 바 스피너를 회전시키며 중복 클릭 방지 차단 상태(`isPending: true`)를 인가하고, 에러나 성공 여부를 가시적으로 캐치해 화면에 빽빽한 로그 터미널로 실시간 피딩합니다.
- **🚀 SwarmVault RAG 시맨틱 지식 인덱스 재생성 [SwarmVault RAG Rebuild]**:
  - **지식 자산 스캔 및 임베딩 재연산**: API 호출을 받은 FastAPI sidecar는 즉시 SwarmVault 핵심 모듈을 깨워, 로컬 llmwiki 내의 모든 `slide_X.md` 및 `wiki.md` 문서들의 델타 변경점을 고속 정적 분석합니다.
  - **3D 물리 노드 실시간 갱신 마운트**: 재인덱싱이 끝나는 즉시 useMutation의 `onSuccess()` 콜백이 발동하여 `queryClient.invalidateQueries({ queryKey: ['documents'] })` 메서드를 강제 기동합니다. 이로 인해 UI 전체의 문서 쿼리가 dynamic 새로고침(Refetch)되며, D3 물리 노드 맵 위에 따끈따끈한 신규 노드가 자석 장력에 이끌려 퉁실 생성되는 쾌적한 피드백 루프를 완료합니다.

## 3. 스피치 노트 (Aside Speaker Notes)

_"이번 장표는 NAtlas GUI가 지식 데이터의 동적 변경을 안전하고 확실하게 트리거하는 설계, 바로 'useMutation 기반 RAG 인덱스 재생성 POST 파이프라인'입니다. 사용자가 로컬에 신규 마크다운 위키나 작업 완료 보고서를 추가한 뒤, '이 최신 지식을 AI 에이전트의 RAG 컨텍스트 브레인에 탑재하고 싶다'고 느낄 때 'Update' 탭으로 들어옵니다. 그곳의 재생성 버튼을 탭하면, TanStack Query의 useMutation 훅이 즉시 백엔드 18420 포트로 'POST /swarmvault/update' 요청을 비동기 타격합니다. 화면 좌측처럼 버튼이 돌아가며 로딩 처리를 해 중복 클릭을 완벽하게 차단하고, 백그라운드에서는 SwarmVault 엔진이 기동하여 로컬 위키 폴더 전체를 레이저 스캔하듯 초고속 파싱해 RAG 벡터 인덱스를 재정비합니다. 그리고 인덱싱이 끝나는 찰나, useMutation의 onSuccess 콜백이 번개처럼 발동하여 documents 쿼리를 강제 만료 처리합니다. 이 신호에 따라 클라이언트의 D3 물리 캔버스는 즉시 최신 지식 데이터를 리로드하여 새로 생성된 지식 노드가 자석 고무줄에 묶인 채 캔버스 중심에 둥실 안착하는 실시간 UI 리플로우의 감동을 선사합니다."_
