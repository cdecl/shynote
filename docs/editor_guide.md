
# 에디터 기능 및 단축키 가이드 (Editor Guide)

SHYNOTE는 **CodeMirror 5** 기반의 강력한 마크다운 에디터를 탑재하여, 개발자에게 친숙한 VS Code 스타일의 경험을 웹에서 제공합니다.

## 1. 주요 편집 기능 (Core Features)

### 뷰 모드 (View Modes)
- **Editor Only**: 글쓰기에만 집중할 수 있는 깔끔한 편집 모드.
- **Preview Only**: 마크다운이 렌더링된 결과를 확인하는 미리보기 모드.
- **Split View**: 에디터와 미리보기를 동시에 보며 작업할 수 있는 분할 화면 모드.
  - **탭 인터페이스**: `[Editor]`, `[Preview]`, `[Split View]` 탭을 클릭하여 즉시 모드를 전환할 수 있습니다.

### 검색 및 바꾸기 (Search & Replace)
- **실시간 하이라이트**: 검색어를 입력하는 즉시 본문 내 일치하는 모든 텍스트가 하이라이트됩니다.
- **정규식(Regex) 지원**: `.*` 버튼을 켜면 자바스크립트 정규 표현식을 사용하여 복잡한 검색이 가능합니다.
- **대소문자 구분**: `Aa` 버튼으로 대소문자 구분 여부를 설정할 수 있습니다.
- **이동**: `Enter` / `Shift+Enter`로 다음/이전 검색 결과로 이동합니다.

### 코드 블럭 및 하이라이팅
- **테마별 구문 강조**:
  - **Light Mode**: GitHub 스타일의 밝은 배경과 구문 강조.
  - **Dark Mode**: Nord 테마 기반의 눈이 편안한 색상 조합.
- **가독성 개선**: 다크 모드에서도 코드와 주석이 선명하게 보이도록 색상 대비가 최적화되었습니다.

---

## 2. 키보드 단축키 (Keyboard Shortcuts)

SHYNOTE는 **VS Code**와 유사한 단축키 매핑을 지원하여 학습 곡선 없이 바로 사용할 수 있습니다. (macOS 기준 `Cmd`, Windows 기준 `Ctrl`)

### 기본 편집
| Action | Shortcut (Mac) | Shortcut (Win/Linux) |
|--------|----------------|----------------------|
| **복사 / 붙여넣기** | `Cmd + C / V` | `Ctrl + C / V` |
| **저장 (자동)** | `Cmd + S` | `Ctrl + S` |
| **실행 취소 (Undo)** | `Cmd + Z` | `Ctrl + Z` |
| **다시 실행 (Redo)** | `Shift + Cmd + Z` | `Shift + Ctrl + Z` |

### 라인 조작 (Line Operations)
| Action | Shortcut (Mac) | Shortcut (Win/Linux) |
|--------|----------------|----------------------|
| **줄 삭제** | `Shift + Cmd + K` | `Shift + Ctrl + K` |
| **줄 이동 (위/아래)** | `Alt + ↑ / ↓` | `Alt + ↑ / ↓` |
| **줄 복제 (위/아래)** | `Shift + Alt + ↑ / ↓` | `Shift + Alt + ↑ / ↓` |
| **줄/선택 주석 토글** | `Cmd + /` | `Ctrl + /` |
| **들여쓰기 (Indent)** | `Cmd + ]` | `Ctrl + ]` |
| **내어쓰기 (Outdent)** | `Cmd + [` | `Ctrl + [` |

### 검색 및 다중 커서
| Action | Shortcut (Mac) | Shortcut (Win/Linux) |
|--------|----------------|----------------------|
| **찾기 (Find)** | `Cmd + F` | `Ctrl + F` |
| **바꾸기 (Replace)** | `Cmd + Opt + F` | `Ctrl + Shift + F` |
| **다음 찾기** | `Cmd + G` | `Ctrl + G` |
| **이전 찾기** | `Shift + Cmd + G` | `Shift + Ctrl + G` |
| **다음 일치 항목 선택** (다중 커서) | `Cmd + D` | `Ctrl + D` |

### 마크다운 서식 (Markdown Formatting)
| Action | Shortcut (Mac) | Shortcut (Win/Linux) |
|--------|----------------|----------------------|
| **굵게 (Bold)** | `Cmd + B` | `Ctrl + B` |
| **기울임 (Italic)** | `Cmd + I` | `Ctrl + I` |
| **링크 (Link)** | `Cmd + K` | `Ctrl + K` |

---

## 3. 마크다운 미리보기 테마 (Themes)

미리보기 영역은 GitHub Flavored Markdown (GFM) 스타일을 따르며, 시스템 설정 또는 토글에 따라 자동으로 테마가 변경됩니다.
- **Light**: GitHub Light (흰색 배경, 짙은 회색 텍스트)
- **Dark**: Nord Dark (청회색 배경, 밝은 회색 텍스트)

에디터 영역 또한 위의 테마와 완벽하게 일치하는 색상 스키마를 사용하여, 편집과 미리보기 간의 이질감을 최소화했습니다.
