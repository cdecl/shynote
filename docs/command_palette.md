# Command Palette (파레트 메뉴)

SHYNOTE의 키보드 중심 명령 실행 인터페이스입니다.

## 개요

`Cmd+P` (Mac) / `Ctrl+P` (Windows)를 눌러 활성화하며, 
빠른 탐색과 명령 실행을 위한 통합 인터페이스를 제공합니다.

## 사용법

1. `Cmd+P` 입력 → 팔레트 메뉴가 화면 중앙에 나타남
2. 키보드 방향키(↑/↓)로 항목 선택
3. `Enter`로 실행 또는 계속 타이핑하여 검색
4. `Esc`로 닫기

## 명령어 목록

### 기본 명령어 (Always Available)
| 명령어 | 아이콘 | 설명 | 단축키 |
|--------|--------|------|--------|
| Go to Note... | search | 파일 검색 및 이동 | Cmd+P |
| Go to Folder... | folder_open | 폴더 탐색 | - |
| Create New Note | add_circle | 새 노트 생성 | Cmd+Shift+N |
| Switch View Mode | view_agenda | Split/Edit/Preview 전환 | - |
| Toggle Dark Mode | dark_mode | 다크 모드 전환 | - |
| Zoom In | zoom_in | 글자 크기 확대 | - |
| Zoom Out | zoom_out | 글자 크기 축소 | - |
| Sync Now | sync | 강제 동기화 (Pull Only) | - |
| Clear Local Cache | delete_sweep | 캐시 및 데이터 초기화 | - |
| Reload App | refresh | 앱 새로고침 | - |

### 에디터 모드 전용 (편집 중일 때만)
| 명령어 | 아이콘 | 설명 | 단축키 |
|--------|--------|------|--------|
| Rename Note | edit | 제목 수정 | F2 |
| Move Note | drive_file_move | 폴더 이동 | - |
| Delete Note | delete | 파일 삭제 | Cmd+Backspace |
| Show File Info | info | 글자수, 수정일 등 상세 정보 | - |

## 모드별 동작

### Commands 모드
- 기본 모드
- 명령어 검색/실행

### Notes 모드
- `Go to Note...` 선택 시 전환
- 저장된 노트 목록 표시
- 검색어로 필터링

### Folders 모드
- `Go to Folder...` 선택 시 전환
- 폴더 탐색 및 이동

### Move Destination 모드
- `Move Note` 선택 시 전환
- 이동할 폴더 선택

## 파일 위치

| 파일 | 역할 |
|------|------|
| `static/index.html` | UI (lines 928-1008) |
| `static/app.js` | 로직 (lines 4131-4330) |
| `static/style.css` | 애니메이션 |

## 기술 구현

- **프레임워크**: Vue 3 Composition API
- **스타일**: Tailwind CSS
- **상태관리**: Vue `ref` / `computed`
- **애니메이션**: `fadeInUp` keyframes

## 코드 참고

### 주요 상태 변수
```javascript
const showCommandPalette = ref(false)  // 표시 여부
const paletteMode = ref('commands')   // 현재 모드
const paletteQuery = ref('')           // 검색어
const paletteIndex = ref(0)            // 선택된 인덱스
```

### 모드 전환
- `commands` → 기본 명령어 목록
- `notes` → 노트 검색 (`Go to Note...`)
- `folders` → 폴더 탐색 (`Go to Folder...`)
- `move-dest` → 노트 이동 대상 선택 (`Move Note`)

### 이벤트 핸들러
- `openCommandPalette()` → 팔레트 열기
- `closeCommandPalette()` → 팔레트 닫기
- `setPaletteMode(mode)` → 모드 전환
- `handlePaletteKeydown(e)` → 키보드 이벤트 처리 (↑/↓/Enter/Esc)