# 기능 명세 - 보수적 충돌 관리 (Feature Spec - Safe-Fail Conflict Management)

## 개요 (Overview)
**Safe-Fail Conflict Management**는 서버에서 데이터가 삭제된 경우에도 로컬 데이터를 자동으로 삭제하지 않고, 충돌(Conflict) 상태로 처리하여 사용자의 최종 확인을 거치도록 하는 데이터 보호 전략입니다. 이는 네트워크 오류로 인한 대규모 데이터 소실(Empty List)이나 의도치 않은 삭제 동기화를 100% 방지합니다.

## 핵심 정책 (Core Policy)
> [!IMPORTANT]
> **Strict Safety Policy**:
> `fetchNotes` 동기화 로직은 **로컬에는 존재하지만 서버 응답 목록에 없는 노트**를 발견할 경우, 해당 노트를 삭제하지 않고 **무조건 충돌(Conflict)**로 등록합니다.
> 이는 `dirty` 상태와 무관하게 적용됩니다.

## 구현 상세 (Implementation Details)

### 1. 충돌 감지 로직 (`static/app.js`)
- **위치**: `fetchNotes` 함수 내 삭제 처리 루프.
- **동작**:
    - `!serverIds.has(ln.id)` 조건이 참이면:
    - 가상의 **Deleted Server Note** 객체를 생성합니다.
        - `is_deleted: true`
        - `content: ''` (빈 내용)
    - 이를 `conflictMap`에 등록하여 충돌 상태로 전환합니다.

### 2. 충돌 해결 UI (`MergeView`)
- **View**: CodeMirror의 `MergeView`를 사용하여 좌측(로컬)과 우측(서버)을 비교합니다.
- **표시**: 서버 측(우측) 패널은 **빈 문서**로 표시되어 삭제됨을 시각적으로 나타냅니다.
- **Banner**: 상단 배너에 **"Right: Deleted on Server"** 메시지를 출력하여 상황을 명확히 알립니다.

### 3. 해결 액션 (Resolution Actions)
사용자는 다음 두 가지 옵션 중 하나를 선택해야 합니다:

| 옵션 | 버튼 텍스트 | 동작 설명 | 결과 |
| :--- | :--- | :--- | :--- |
| **Restore** | **Restore (Keep Mine)** | 로컬 데이터를 유지하고 서버 데이터(삭제됨)를 무시합니다. | 로컬 노트가 `dirty` 상태가 되어, 다음 동기화 시 서버로 다시 Push됩니다. (삭제 취소/복구) |
| **Delete** | **Accept Deletion** | 서버의 삭제 상태를 수용합니다. | 로컬 노트가 영구적으로 삭제됩니다. |

## 검증 및 효과 (Verification)
- **Zero Data Loss**: 서버가 빈 목록을 반환하는 치명적 오류 상황에서도 로컬 데이터는 모두 '충돌'로 보호되어 유지됩니다.
- **Overwrite Safety**: 수정 중인(`dirty`) 문서는 `saveNotesBulk`에서 보호되며, 수정하지 않은(`synced`) 문서는 서버 데이터로 덮어쓰여(Overwrite) 최신 상태를 유지합니다. **삭제**만이 유일하게 충돌로 처리되어 '안전한 실패(Safe-Fail)'를 보장합니다.
