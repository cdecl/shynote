# Local-first 동기화 분석 및 의사결정 (Sync Analysis & Decisions)

## 1. LocalStorage 대체 사용에 대한 복잡도 검토

**질문: IndexedDB가 지원되지 않는 환경에서 LocalStorage를 대체 저장소로 사용해야 하는가?**

### 분석 내용 (Analysis)
- **용량 제한 (Capacity Limit)**: LocalStorage는 **5MB**로 엄격히 제한됩니다. (약 250만 글자).
  - *시나리오*: 노트 500개(평균 2KB) = 1MB. 아직 안전함.
  - *위험요소*: 사용자가 Base64 이미지를 붙여넣거나 노트가 수천 개로 늘어나면 조용히 저장 실패하거나 크래시가 발생할 수 있습니다.
- **성능 문제 (Blocking I/O)**: LocalStorage는 **동기식(Synchronous)**입니다. 대용량 JSON을 읽고 쓸 때 메인 스레드를 차단하여 타이핑 중 "멈칫"하는 UI 프리징을 유발합니다. (IndexedDB는 비동기식).
- **트랜잭션 부재 (No Transactions)**: 트랜잭션을 지원하지 않아, 쓰기 도중 브라우저가 종료되면 데이터가 손상될 수 있습니다.
- **구현 복잡도**:
  - **어댑터 패턴(Adapter Pattern)** 구현 필요 (예: `StorageAdapter` 인터페이스).
  - Key-Value 저장소 위에 "가상 객체 저장소(Virtual Object Store)" 로직을 직접 구현해야 함 (인덱스 관리 등).
  - **예상 오버헤드**: <1%의 사용자를 위해 코드 복잡도가 30% 증가함.

### 레거시/예외 시나리오
- **구형 프라이빗 브라우징**: 일부 구형 브라우저의 시크릿 모드는 IDB를 비활성화했으나, 최신 브라우저는 휘발성(Ephemeral) IDB를 지원합니다.
- **기업/제한된 환경**: 매우 드문 케이스입니다.

### 권장 사항 (Recommendation)
**LocalStorage에 전체 동기화 로직을 구현하지 않을 것을 권장합니다.**
- **전략**: IndexedDB가 없으면 **"온라인 전용 모드 (Online Only Mode)"**로 폴백(Fallback)합니다.
- **정당성**: 극소수의 미지원 환경을 위해 성능 저하와 복잡도를 감수하고 LocalStorage 엔진을 유지보수하는 것은 비효율적입니다.

---

## 2. 주요 결정 사항 및 최종 전략 (Key Decisions & Final Strategy)

### A. 라이브러리 선정 (Library Selection)
- **결정**: **`idb`** (1KB, 표준).
- **이유**: 가볍고 표준화된 라이브러리 (Vue/React 생태계 표준).

### B. 동기화 트리거 전략 (Sync Trigger Strategy)
- **로컬 저장 (Local Save)**: **1초 디바운스 (Debounced 1s)** - 타이핑 퍼포먼스 최적화.
- **서버 동기화 (Server Sync)**: **5초 주기 (Periodic 5s)** - 백그라운드 수행.
- **흐름**: 사용자 입력 -> [1초] -> IndexedDB 저장(Dirty) -> [5초] -> 서버 API 전송.

### C. 미지원 환경 대응 (Fallback Strategy)
- **IndexedDB 미지원 시**: **온라인 전용 모드 (Online Only Mode)**.
- **로직**: `window.indexedDB`가 `undefined`인 경우 로컬 저장을 건너뛰고 즉시 API를 호출합니다.

---

## 3. 구현 로드맵 (Phase 1)

1. **초기 설정**: `idb` 라이브러리를 사용하여 `local_db.js` 초기화.
2. **스키마 설계**: `notes` (볼트) 및 `pending_logs` (대기열) 스토어 생성.
3. **리포지토리 패턴**: `app.js`에서 직접 `fetch`하는 대신 `LocalDB`를 경유하도록 리팩토링.
