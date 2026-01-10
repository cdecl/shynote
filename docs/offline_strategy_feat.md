# Offline & Sync Strategy

Shynote는 **Local-First** 원칙을 따르는 오프라인 우선 애플리케이션입니다.
네트워크 연결이 없어도 완벽하게 동작하며, 연결 시 자동으로 데이터를 동기화합니다.

## 1. 아키텍처 및 데이터 흐름
데이터는 3단계 계층을 통해 관리됩니다.

```mermaid
graph TD
    User[사용자 입력] -->|Typing...| Memory[메모리 (Vue State)]
    Memory -->|Save (1초 Debounce)| IDB[로컬 DB (IndexedDB)]
    IDB -->|Push (Background)| Server[원격 서버 (PostgreSQL)]
    Server -->|Pull (On Connection)| IDB
    IDB -->|Load (On Start)| Memory
```

1.  **메모리 (Memory)**: 가장 빠른 반응성. 사용자 입력을 즉시 반영.
2.  **로컬 DB (IndexedDB)**: 신뢰할 수 있는 "내 기기 저장소". 인터넷 유무와 관계없이 항시 저장.
3.  **원격 서버 (Remote Server)**: 기기 간 동기화를 위한 중앙 저장소.

---

## 2. 동기화 메커니즘 (Smart Sync)

### Push (업로드)
*   **Trigger**:
    *   로컬 저장 완료 시 `dirty` 플래그 및 로그(`pending_logs`) 생성.
    *   **5초 주기**로 실행되는 백그라운드 워커(`syncWorker`)가 로그 확인.
*   **Offline Action**: 네트워크가 끊기면 워커가 즉시 **일시 정지(Pause)**되어 리소스를 절약합니다.
*   **Online Action**: 네트워크 연결 시 워커가 **재개(Resume)**되어 밀린 데이터를 전송합니다.

### Pull (다운로드)
*   **Trigger**:
    *   **앱 실행 시**: 즉시 실행.
    *   **Online 복구 시 (`window.online`)**: 오프라인에서 온라인으로 전환되는 순간 즉시 실행.
*   **Action**: 서버의 최신 변경 사항을 가져와 로컬 DB와 병합(Merge)합니다.

---

## 3. 상태 메시지 및 UI (Terminology)

### 1. 네트워크 상태 (좌측)
- **`Online`**: 인터넷 연결됨
- **`Offline`**: 인터넷 끊김

### 2. 로드/동기화 상태 (중앙 - 데이터 가져오기)
- **`Load Complete`**: 앱 실행 즉시 로컬 데이터 표시
- **`Syncing...`**: 초기 서버 데이터 확인 중
- **`Pull Complete`**: 서버와 동기화 완료 (내용 일치)
- **`Pulling...`**: 온라인 전환 시 최신 데이터 다운로드 중

### 3. 저장/전송 상태 (우측 - 데이터 내보내기)
- **`Typing...`**: 글자 입력 중
- **`Saving...`**: 입력 멈춤 1초 후 로컬 저장
- **`Save Complete`**: 로컬 저장 완료 (안전하게 보관됨)
- **`Pushing...`**: 서버로 전송 시작
- **`Push Complete`**: 전송 완료
- **`Save Complete`**: 모든 작업 완료 후 대기 상태 ("Ready")
- **`Error saving`**: 저장 실패

### 유휴 상태 (Idle State)
작업이 완료된 후 상태 메시지는 "Ready"(`Locally Saved`)로 돌아가지 않고, **마지막 성공 상태(`Push Complete` 또는 `Pull Complete`)를 유지**하여 사용자가 최종 결과를 확인할 수 있도록 합니다.

---

## 4. 오프라인 UX
*   **스플래시 화면**: 앱 로딩 중에도 현재 `Online/Offline` 상태와 `Loading...` 단계를 표시하여 멈춤 현상으로 오해하는 것을 방지합니다.
*   **클릭 방지**: 오프라인 상태에서도 삭제 등의 중요 작업 시 팝업이 뜨며, 배경 클릭으로 취소(Click-outside Cancel)가 가능합니다.
