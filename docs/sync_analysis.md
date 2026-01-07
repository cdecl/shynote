# 동기화 아키텍처 및 충돌 분석 (Sync Architecture & Conflict Analysis)

## 1. 개요 (Overview)
SHYNOTE는 **Local-First** 동기화 전략을 사용합니다.
- **주 데이터 소스**: IndexedDB (클라이언트)
- **보조 데이터 소스**: Server (PostgreSQL)
- **일관성 모델**: 낙관적 잠금(Optimistic Locking)을 통한 최종 일관성(Eventual Consistency)

---

## 2. 데이터 흐름 (Data Flow)

### A. 쓰기 (WRITE - Typing / Edit)
1.  **메모리 (Memory)**: 사용자가 에디터에서 입력 -> `notes.value` (Reactive State) 즉시 갱신.
2.  **로컬 저장 (Local Persistence)**: `saveNoteDebounced` 함수가 **IndexedDB**에 저장 (`status: 'dirty'`).
3.  **푸시 (Push - Background Sync)**:
    -   `syncWorker`가 5초마다 실행됨.
    -   'dirty' 상태의 노트를 탐색.
    -   서버로 `PUT /api/notes` 요청 전송 (현재 `version` 포함).
    -   **성공**: LocalDB 업데이트 (`status: 'synced'`, `version++`).
    -   **충돌 (409)**: **충돌 해결 프로세스(Conflict Resolution Flow)** 트리거.

### B. 읽기 (READ - Load / Sync Now)
1.  **풀 (Pull - `fetchNotes`)**:
    -   서버에서 최신 노트 목록을 가져옴.
    -   **LocalDB 동기화**:
        -   서버에서 삭제된 노트는 로컬에서도 삭제.
        -   서버 버전이 더 높으면 로컬 노트 업데이트.
        -   **충돌 확인**: 로컬이 'dirty' 상태이고, 서버 내용과 다른 경우 -> **충돌 감지(Conflict Detected)**.

---

## 3. 낙관적 잠금 (Optimistic Locking - Version Control)

데이터 유실(Last Write Wins 문제)을 방지하기 위해 `version` (Integer) 컬럼을 사용합니다.

### 로직 (Logic)
1.  **클라이언트**: 편집 시, 편집의 기준이 된 `base_version` (예: v1)을 기억함.
2.  **푸시 (Push)**: `{ content: "...", version: 1 }` 정보를 서버로 전송.
3.  **서버**:
    -   검사: `if (current_note.version == request.version)`
    -   **일치**: 내용 업데이트, `version`을 2로 증가. 200 OK 반환.
    -   **불일치**: (누군가 이미 v2로 업데이트함). **409 Conflict** 반환.

---

## 4. 충돌 시나리오 (Conflict Scenarios)

### 시나리오 1: 오프라인 수정 충돌 ("Lost Update" 방지)
*   **사용자 A**: 오프라인 상태에서 노트 X(v1) 수정. 로컬 상태는 'dirty'.
*   **사용자 B**: 온라인 상태에서 노트 X 수정 (v1 -> v2).
*   **사용자 A (온라인 전환)**:
    1.  `syncWorker`가 푸시(v1) 시도.
    2.  서버는 현재 v2와 요청 v1이 다르므로 거절.
    3.  **409 Conflict** 반환.
    4.  클라이언트는 푸시 중단.
    5.  `fetchNotes(true)` (Pull) 트리거.
    6.  `fetchNotes`가 v2 데이터 다운로드.
    7.  **충돌 감지**: 로컬(Dirty) vs 서버(v2).
    8.  **조치**:
        -   활성화된 노트인 경우: 즉시 **병합 화면(Merge View)** 표시.
        -   비활성 노트인 경우: **충돌 맵(Conflict Map)**에 추가 & 리스트에 빨간 아이콘 표시.

### 시나리오 2: 동시 온라인 수정
*   **사용자 A & B**: 노트 Y(v5)를 동시에 열어서 편집.
*   **사용자 A**: 먼저 저장 -> 서버 v6.
*   **사용자 B**: 잠시 후 저장 시도 (v5 기준) -> 서버 거절 (409).
*   **사용자 B**: 충돌 UI 표시 -> A의 변경 사항을 병합해야 함.

---

## 5. 해결 전략 (Merge View)
사용자에게 2분할(또는 3분할) 화면을 제공:
-   **왼쪽**: 로컬 버전 (내 수정사항)
-   **오른쪽**: 서버 버전 (들어오는 변경사항)
-   **동작**:
    -   **Local 선택**: 서버 내용을 덮어씀 (Force Push v6 -> v7).
    -   **Server 선택**: 내 수정사항 버림 (v6로 되돌림).
    -   **수동 병합**: 내용을 직접 수정하고 저장.
