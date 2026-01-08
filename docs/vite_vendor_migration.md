# Vite Vendor Bundle Migration Guide

**Date**: 2026-01-08  
**Version**: v0.5.2 (Vendor Bundle Introduced)

## 1. 개요 (Overview)
기존의 CDN 기반 라이브러리 로딩 방식에서 **Vite를 이용한 로컬 벤더 번들링 방식**으로 전환했습니다.
이는 외부 네트워크 의존성을 제거하여 **완벽한 오프라인 지원**을 보장하고, 브라우저가 수많은 개별 스크립트 대신 최적화된 소수의 번들 파일만 로드하도록 하여 **초기 로딩 속도를 개선**하기 위함입니다.

---

## 2. 주요 변경 사항 (Key Changes)

### 2.1 빌드 시스템 도입 (Build System)
- **도구**: `Vite` (Library Mode)
- **설정 파일**: `vite.config.js`
- **목적**: `src/vendor.js`를 진입점으로 하여 모든 외부 라이브러리(Vue, CodeMirror 등)를 `static/dist/vendor.js`로 번들링합니다.

### 2.2 의존성 관리 (Dependency Management)
- **`package.json`**: 모든 외부 라이브러리를 NPM 패키지로 관리합니다.
- **`src/vendor.js`**: `app.js`에서 사용하는 라이브러리들을 모아서 re-export 합니다.
- **`src/codemirror-deps.js`**: 복잡한 CodeMirror 모듈들을 별도로 관리합니다.

### 2.3 소스 코드 변경 (Source Code)
- **`static/app.js`**:
  - 기존: `import { ... } from 'https://esm.sh/...'` (CDN)
  - 변경: `import { ... } from './dist/vendor.js'` (Local Bundle)
- **`static/index.html`**:
  - CDN `<script>` 태그들을 모두 제거했습니다.
- **`static/sw.js` (Service Worker)**:
  - CDN URL 대신 로컬 번들 파일(`static/dist/...`)을 캐싱하도록 업데이트했습니다.

---

## 3. 개발 및 배포 가이드 (Developer Guide)

### 3.1 평소 개발 (Daily Development)
- **빌드 불필요**: `app.js`, `style.css`, `index.html` 수정 시에는 빌드가 필요 없습니다.
- 그냥 브라우저 새로고침만 하면 됩니다. (Vite 개발 서버가 아닌, 기존 방식 그대로 사용)

### 3.2 라이브러리 추가/변경 시 (Dependency Changes)
`package.json`에 새로운 라이브러리를 추가하거나 `src/vendor.js`를 수정했을 때만 빌드가 필요합니다.

```bash
# 1. 의존성 설치
npm install [package-name]

# 2. 벤더 번들링 (static/dist/ 파일 생성)
npm run build
```

### 3.3 Git 커밋 (Git Commit)
`static/dist` 폴더는 `.gitignore` 예외 처리되어 있으며, **반드시 Git에 포함되어야 합니다.**
서버 배포 시 별도의 빌드 과정 없이 이 파일들을 서빙하기 위함입니다.

```bash
git add static/dist
git commit -m "Update vendor bundles"
```

---

## 4. 트러블슈팅 (Troubleshooting)

### 빈 화면이 나오는 경우 (Blank Screen)
- **원인**: Vue가 기본적으로 'Runtime-Only' 빌드를 사용하는데, `index.html`에 작성된 템플릿을 컴파일하지 못해서 발생합니다.
- **해결**: `vite.config.js`에 `vue` alias를 설정하여 'Runtime + Compiler' 빌드를 사용하도록 했습니다.
  ```javascript
  resolve: {
      alias: {
          vue: 'vue/dist/vue.esm-bundler.js',
      },
  },
  ```
