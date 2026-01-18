# Google 인증 방식 변경 기록 (Auth Migration Log)

## 1. 배경 (Background)
초기 개발 단계에서는 사용자 경험(UX)을 극대화하기 위해 구글의 **One Tap (GSI: Google Identity Services)** 방식을 채택했습니다.
이 방식은 페이지 이동 없이 현재 화면 위에 팝업 레이어를 띄워 즉시 로그인할 수 있는 장점이 있었습니다.

## 2. 발생한 문제점 (Issues Encountered)
다양한 환경에서 테스트를 진행하면서 One Tap, 특히 팝업 방식(Popup Flow)의 치명적인 한계들이 발견되었습니다.

### A. 모바일 및 IP 주소 접속 문제 (Mobile & IP Origin)
- **증상**: 모바일 기기(iOS/Android)에서 내부 IP(예: `192.168.x.x:8000`)로 접속 시 `invalid_client` 또는 `The given origin is not allowed` 에러 발생.
- **원인**: 구글 보안 정책상 `localhost`와 `https` 도메인만 허용하며, **IP 주소 기반의 Origin은 강력하게 차단**됩니다. 데스크톱 브라우저는 개발자 도구 등을 통해 일부 완화될 수 있으나, 모바일 브라우저는 이를 엄격하게 처리합니다.

### B. 시크릿 모드와 서드파티 쿠키 (Private Mode & 3rd-party Cookies)
- **증상**: PC의 시크릿 모드(Incognito)나 보안이 강화된 브라우저(Brave 등)에서 로그인 버튼이 아예 뜨지 않거나, 클릭해도 반응이 없음.
- **원인**: One Tap 방식은 구글 도메인의 쿠키(Third-party Cookie)에 의존하거나, 보이지 않는 iframe을 사용합니다. **시크릿 모드는 서드파티 쿠키를 기본적으로 차단**하므로 이 메커니즘이 동작하지 않습니다.

### C. 인앱 브라우저 (WebView)
- **증상**: 카카오톡, 라인 등의 인앱 브라우저에서 로그인 팝업이 차단되거나 닫히지 않음.
- **원인**: 팝업(window.open) 제어가 제한적입니다.

## 3. 해결 방안: OAuth 2.0 리다이렉트 (Resolution)
위 문제들을 해결하기 위해, 가장 표준적이고 범용적인 **Authorization Code Flow (Server-side Redirect)** 방식으로 전환했습니다.

### 변경된 흐름
1.  **Frontend**: "Google로 계속하기" 버튼 클릭 시 `window.location.href`를 통해 구글 로그인 페이지로 **완전히 이동**시킵니다.
    - 이때 `redirect_uri`는 `window.location.origin + '/auth/google/callback'`으로 동적 설정하여 IP 접속 환경도 지원합니다.
2.  **Google**: 사용자가 구글 페이지에서 로그인하고 승인합니다.
3.  **Redirect**: 구글이 Authorization Code와 함께 다시 우리 서버(`frontend`)로 돌려보냅니다.
4.  **Backend Exchange**: 프론트엔드가 받은 Code를 백엔드 API(`/auth/google/callback`)로 전달합니다.
    - 백엔드는 `httpx`를 사용해 이 Code를 구글 서버와 통신하여 **Access Token**과 **User Info**로 교환합니다.
    - (이 과정에서 `GOOGLE_CLIENT_SECRET`이 필요합니다.)
5.  **Completion**: 백엔드가 자체 JWT 토큰을 발급하여 로그인 처리를 완료합니다.

## 4. 결과 (Result)
- **환경 독립성 확보**: IP 주소, 시크릿 모드, 모바일, 인앱 브라우저 등 **모든 환경에서 동일하고 안정적으로 동작**합니다.
- **보안성**: 표준 OAuth 2.0 프로토콜을 준수하며, `state` 파라미터를 통한 CSRF 방지가 적용되었습니다.
- **UX**: 페이지 이동이 발생하지만, "로그인 실패"라는 최악의 UX를 방지하고 확실한 성공을 보장합니다.
- **게스트 모드 도입**: 사용자가 첫 접속 시 번거로운 로그인 과정 없이 바로 노트를 작성할 수 있도록 자동 게스트 모드 진입 기능을 추가했습니다.

## 5. 게스트 모드 및 진입 유연성
- **로그인 취소**: 로그인 모달에서 'Cancel' 버튼을 누르면 즉시 게스트 모드로 진입하여 작업을 시작할 수 있습니다.

## 6. 게스트 모드 (Guest Mode)
- **진입 방식**: 유효한 토큰이 없거나 시크릿 모드에서 접속 시 자동으로 `guest` 계정으로 설정됩니다.
- **데이터 처리**: 모든 데이터는 로컬 IndexedDB에 저장됩니다. (단, 게스트 모드에서는 서버 동기화가 제한됩니다.)
- **로그인 전환**: 사이드바 상단의 `LOGIN` 버튼을 통해 구글 계정으로 로그인하면, 기존 로컬 데이터가 계정과 연동되어 동기화가 시작됩니다.

## 7. Google Cloud Console 설정 (필수)
Redirect 방식은 보안을 위해 **Callback URI의 정확한 일치**를 요구합니다. Google Console의 [사용자 인증 정보] > [OAuth 2.0 클라이언트 ID] 설정에서 **'승인된 리디렉션 URI'**에 다음 주소들을 반드시 등록해야 합니다.

1.  **로컬 개발**: `http://localhost:8000/auth/google/callback`
2.  **외부 접속 테스트**: `https://{ngrok-domain}.ngrok-free.app/auth/google/callback`
3.  **배포 환경**: `https://{your-domain.com}/auth/google/callback`

*(주의: 끝에 슬래시 `/`가 없어야 하며, `http`와 `https`를 엄격히 구분합니다.)*
