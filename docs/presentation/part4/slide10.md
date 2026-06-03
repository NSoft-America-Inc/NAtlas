---
title: 'Slide 39: SQLite task_history 메타데이터 테이블 파싱 및 node 매핑'
layout: 'Metadata DB Mapper'
part: 'PART 5: NAtlas GUI 지식 탐색 및 아키텍처'
---

# Slide 39: SQLite task_history 메타데이터 테이블 파싱 및 node 매핑

## 1. 화면 정의 및 레이아웃 (Layout Specification)

- **레이아웃 구조**: 데이터베이스에 저장된 과거 의사결정 릴레이션 튜플들이 네트워크 그래프에 매핑할 수 있는 메모리 노드로 동적 사상 변환되는 **메타데이터 DB 매퍼 레이아웃 (Metadata DB Mapper Layout)**.
- **비주얼 및 컴포넌트 구성**:
  - **좌측 비주얼**: 황금색과 사파이어 네온 그라디언트 3D 데이터 매핑 다이어그램. 좌측에 웅장한 SQLite DB 3D 실린더 2개가 세워져 있고, 그 내부의 `task_history` 메타데이터 관계 튜플들이 파란색 및 보라색 광원 데이터 칩(Packet)이 되어 뿜어져 나와, 중앙의 **[D3 Node Parser]** 필터를 관통하며 칼정렬 매핑되어, 우측의 둥실둥실 떠오르는 네트워크 엣지 링크 데이터 노드 트리로 실시간 파싱 및 정밀 분기 사상되는 SVG 구현.
  - 관계 데이터 맵핑 동작을 표시하는 **🛡️ SQLITE METADATA MAPPER ACTIVE** 라벨 적용.

## 2. 실질적 본문 내용 (Exact Slide Content)

### 🛢️ 날것의 데이터베이스 관계 튜플을, 지능적으로 파싱해 노드로 연결하는 매퍼

NAtlas GUI가 3D dynamic 지식 지도를 초고속으로 펼쳐낼 수 있는 밑바탕에는 로컬에 장착된 초경량 고성능 **SQLite 데이터베이스 엔진**과 지능형 메타데이터 관계 매퍼(Mapper)가 존재합니다. 지식 문서 내의 작성 일자, 이슈 번호, Git 브랜치 및 이중 대괄호(`[[links]]`) 데이터를 관계형 DB 스키마 튜플로 적재해 두고, 이를 동적으로 읽어 지식 그래프 노드로 파싱 변환합니다.

- **🗄️ SQLite task_history 메타데이터 스키마 [SQLite Relation Schema]**:
  - `task_slug(PK)`, `title`, `issue_url`, `parent_task(FK)`, `status`, `last_committed` 필드로 설계된 릴레이션 튜플을 활용해 작업의 선후 인과 관계를 정교하게 트래킹합니다.
- **⚡ 관계형 튜플의 D3 그래프 노드 사상 [D3 Node Mapping Flow]**:
  - 사이드카 백엔드는 SQLite DB를 스캔하여 레코드 셋을 로드하고, 본문에 심어진 이중 대괄호 관계를 지능적으로 파싱하여 **`nodes: [{id: "todo-app", title: "..."}]`** 및 이들을 이어주는 선후 장력선인 **`links: [{source: "nstack", target: "todo-app"}]`**의 D3-force 호환 JSON 메모리 노드로 0.05초 만에 초고속 변환 사상해냅니다.

## 3. 스피치 노트 (Aside Speaker Notes)

_"이번에 살펴볼 NAtlas GUI 내부 메커니즘은 'SQLite 메타데이터 테이블 파싱 및 노드 매핑' 아키텍처입니다. 우측의 3D dynamic 지식 노드맵이 날마다 살아 숨 쉬며 확장되는 비결이죠. NAtlas는 저장소에 보존된 지식 메타데이터들을 로컬 SQLite 데이터베이스의 `task_history` 릴레이션 테이블에 튜플 형태로 저장해 둡니다. 그리고 사이드카 백엔드가 가동되면, DB 실린더에서 날것의 관계 데이터 칩들을 로드해 0.05초 만에 D3 dynamic 그래프 엔진이 삼킬 수 있는 'nodes'와 'links'의 JSON 메모리 노드로 동적 사상 변환합니다. 문서 본문에 박혀 있는 이중 대괄호 인용 관계까지 파싱해 엣지 연결선 정보로 치환함으로써, DB 튜플이 둥실둥실 떠오르는 인터랙티브 지식 노드 트리로 우아하게 부활하게 만드는 핵심 매퍼 아키텍처입니다."_
