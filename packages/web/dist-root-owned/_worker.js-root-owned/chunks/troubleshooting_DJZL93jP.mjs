globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"

const frontmatter = {
  title: "문제 해결",
  description: "일반적인 문제와 해결 방법.",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "로깅",
      text: "로깅",
    },
    {
      depth: 2,
      slug: "저장소",
      text: "저장소",
    },
    {
      depth: 2,
      slug: "데스크톱-앱",
      text: "데스크톱 앱",
    },
    {
      depth: 2,
      slug: "빠른-확인",
      text: "빠른 확인",
    },
    {
      depth: 2,
      slug: "플러그인-비활성화",
      text: "플러그인 비활성화",
    },
    {
      depth: 3,
      slug: "전역-설정-확인",
      text: "전역 설정 확인",
    },
    {
      depth: 3,
      slug: "플러그인-디렉터리-확인",
      text: "플러그인 디렉터리 확인",
    },
    {
      depth: 4,
      slug: "캐시-삭제",
      text: "캐시 삭제",
    },
    {
      depth: 2,
      slug: "서버-연결-문제-수정",
      text: "서버 연결 문제 수정",
    },
    {
      depth: 3,
      slug: "데스크톱-기본-서버-url-삭제",
      text: "데스크톱 기본 서버 URL 삭제",
    },
    {
      depth: 4,
      slug: "설정에서-serverportserverhostname-제거",
      text: "설정에서 server.port/server.hostname 제거",
    },
    {
      depth: 3,
      slug: "환경-변수-확인",
      text: "환경 변수 확인",
    },
    {
      depth: 2,
      slug: "linux-wayland--x11-문제",
      text: "Linux: Wayland / X11 문제",
    },
    {
      depth: 2,
      slug: "windows-webview2-런타임",
      text: "Windows: WebView2 런타임",
    },
    {
      depth: 2,
      slug: "windows-일반-성능-문제",
      text: "Windows: 일반 성능 문제",
    },
    {
      depth: 2,
      slug: "알림이-표시되지-않음",
      text: "알림이 표시되지 않음",
    },
    {
      depth: 2,
      slug: "데스크톱-앱-저장소-재설정-최후의-수단",
      text: "데스크톱 앱 저장소 재설정 (최후의 수단)",
    },
    {
      depth: 2,
      slug: "도움-받기",
      text: "도움 받기",
    },
    {
      depth: 2,
      slug: "일반적인-문제",
      text: "일반적인 문제",
    },
    {
      depth: 2,
      slug: "slopcode가-시작되지-않습니다",
      text: "slopcode가 시작되지 않습니다.",
    },
    {
      depth: 3,
      slug: "인증-문제",
      text: "인증 문제",
    },
    {
      depth: 4,
      slug: "모델을-사용할-수-없음",
      text: "모델을 사용할 수 없음",
    },
    {
      depth: 2,
      slug: "provideriniterror",
      text: "ProviderInitError",
    },
    {
      depth: 3,
      slug: "ai_apicallerror-및-공급자-패키지-문제",
      text: "AI_APICallError 및 공급자 패키지 문제",
    },
    {
      depth: 4,
      slug: "linux에서-복사붙여넣기-작동-안-함",
      text: "Linux에서 복사/붙여넣기 작동 안 함",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>slopcode와 문제를 디버그하려면 로그와 로컬 데이터를 확인하여 디스크에 저장합니다.</p>\n<hr>\n<h2 id="로깅"><a href="#로깅">로깅</a></h2>\n<p>로그 파일은 다음과 같습니다:</p>\n<p>-<strong>macOS/리눅스</strong>: <code dir="auto">~/.local/share/slopcode/log/</code></p>\n<ul>\n<li><strong>Windows</strong>: 압박 <code dir="auto">WIN+R</code>와 풀 <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode\\log</code></li>\n</ul>\n<p>로그 파일은 타임스탬프 (예 : <code dir="auto">2025-01-09T123456.log</code>)과 가장 최근 10 로그 파일이 보관됩니다.</p>\n<p>자세한 디버그 정보를 얻기 위해 <code dir="auto">--log-level</code> 명령줄 옵션을 사용하여 로그 레벨을 설정할 수 있습니다. 예를 들면, <code dir="auto">slopcode --log-level DEBUG</code>.</p>\n<hr>\n<h2 id="저장소"><a href="#저장소">저장소</a></h2>\n<p>slopcode 저장 세션 데이터 및 디스크에 다른 응용 데이터:</p>\n<p>-<strong>macOS/리눅스</strong>: <code dir="auto">~/.local/share/slopcode/</code></p>\n<ul>\n<li><strong>Windows</strong>: 압박 <code dir="auto">WIN+R</code>와 풀 <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode</code></li>\n</ul>\n<p>이 디렉토리는 다음과 같습니다:</p>\n<ul>\n<li><code dir="auto">auth.json</code> - API 키, OAuth 토큰과 같은 인증 데이터</li>\n<li><code dir="auto">log/</code> - 응용 프로그램 로그</li>\n<li><code dir="auto">project/</code> - 세션 및 메시지 데이터와 같은 프로젝트별 데이터</li>\n<li>프로젝트가 Git repo 안에 있는 경우에, 그것은 <code dir="auto">./&#x3C;project-slug>/storage/</code>에서 저장됩니다</li>\n<li>Git repo가 아닌 경우 <code dir="auto">./global/storage/</code>에 저장됩니다.</li>\n</ul>\n<hr>\n<h2 id="데스크톱-앱"><a href="#데스크톱-앱">데스크톱 앱</a></h2>\n<p>slopcode 데스크톱은 배경에서 로컬 slopcode 서버 (<code dir="auto">slopcode-cli</code> sidecar)를 실행합니다. 대부분의 문제는 misbehaving 플러그인, 손상된 캐시, 또는 나쁜 서버 설정에 의해 발생합니다.</p>\n<h2 id="빠른-확인"><a href="#빠른-확인">빠른 확인</a></h2>\n<ul>\n<li>완전히 종료하고 앱을 다시 시작.</li>\n<li>앱이 오류 화면을 보여 주면 ** Restart**를 클릭하고 오류 세부 정보를 복사합니다.</li>\n<li>macOS만: <code dir="auto">SlopCode</code> 메뉴 -> **웹뷰 **(UI가 공백/frozen인 경우).</li>\n</ul>\n<hr>\n<h2 id="플러그인-비활성화"><a href="#플러그인-비활성화">플러그인 비활성화</a></h2>\n<p>데스크톱 앱이 출시, 거는, 또는 이상한 것에서 충돌하면 플러그인을 비활성화하여 시작합니다.</p>\n<h3 id="전역-설정-확인"><a href="#전역-설정-확인">전역 설정 확인</a></h3>\n<p>글로벌 설정 파일을 열고 <code dir="auto">plugin</code> 키를 찾습니다.</p>\n<p>-<strong>macOS/리눅스</strong>: <code dir="auto">~/.config/slopcode/slopcode.jsonc</code> (또는 <code dir="auto">~/.config/slopcode/slopcode.json</code>) -<strong>macOS/Linux</strong> (외부 설치): <code dir="auto">~/.local/share/slopcode/slopcode.jsonc</code></p>\n<ul>\n<li><strong>Windows</strong>: 압박 <code dir="auto">WIN+R</code>와 풀 <code dir="auto">%USERPROFILE%\\.config\\slopcode\\slopcode.jsonc</code></li>\n</ul>\n<p>구성 된 플러그인이있는 경우, 일시적으로 키를 제거하거나 빈 배열로 설정하여 비활성화하십시오.</p>\n<div class="expressive-code"><link rel="stylesheet" href="/docs/_astro/ec.4c0k7.css"><script type="module" src="/docs/_astro/ec.0vx5m.js"></script><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="jsonc"><code><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">{</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"$schema"</span><span style="--0:#24292E;--1:#E1E4E8">: </span><span style="--0:#032F62;--1:#9ECBFF">"https://slopcode.dev/config.json"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"plugin"</span><span style="--0:#24292E;--1:#E1E4E8">: [],</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">}</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="{  &#x22;$schema&#x22;: &#x22;https://slopcode.dev/config.json&#x22;,  &#x22;plugin&#x22;: [],}"><div></div></button></div></figure></div>\n<h3 id="플러그인-디렉터리-확인"><a href="#플러그인-디렉터리-확인">플러그인 디렉터리 확인</a></h3>\n<p>slopcode는 디스크에서 로컬 플러그인을로드 할 수 있습니다. Temporarily 이동 이러한 방법 (또는 폴더 이름을 변경) 및 데스크톱 응용 프로그램을 다시 시작:</p>\n<ul>\n<li><strong>글로벌 플러그인</strong> -<strong>macOS/리눅스</strong>: <code dir="auto">~/.config/slopcode/plugins/</code></li>\n<li><strong>Windows</strong>: 압박 <code dir="auto">WIN+R</code>와 풀 <code dir="auto">%USERPROFILE%\\.config\\slopcode\\plugins</code></li>\n<li><strong>프로젝트 플러그인</strong> (프로젝트 설정만 사용)</li>\n<li><code dir="auto">&#x3C;your-project>/.slopcode/plugins/</code></li>\n</ul>\n<p>앱이 다시 일하는 경우, 재 활성화 플러그인은 한 번에 문제가 발생할 수 있습니다.</p>\n<hr>\n<h4 id="캐시-삭제"><a href="#캐시-삭제">캐시 삭제</a></h4>\n<p>플러그인을 비활성화하는 경우 도움이되지 않습니다 (또는 플러그인 설치가 붙어있다), 캐시를 삭제 그래서 slopcode는 그것을 재구성 할 수 있습니다.</p>\n<ol>\n<li>Quit slopcode 데스크톱 완전히.</li>\n<li>캐시 디렉토리 삭제:</li>\n</ol>\n<p>-<strong>macOS</strong>: 찾기 -> <code dir="auto">Cmd+Shift+G</code> -> 붙여넣기 <code dir="auto">~/.cache/slopcode</code></p>\n<ul>\n<li><strong>Linux</strong>: <code dir="auto">~/.cache/slopcode</code> 삭제 (또는 <code dir="auto">rm -rf ~/.cache/slopcode</code> 실행)</li>\n<li><strong>Windows</strong>: 압박 <code dir="auto">WIN+R</code>와 풀 <code dir="auto">%USERPROFILE%\\.cache\\slopcode</code></li>\n</ul>\n<ol start="3">\n<li>Restart slopcode 데스크탑.</li>\n</ol>\n<hr>\n<h2 id="서버-연결-문제-수정"><a href="#서버-연결-문제-수정">서버 연결 문제 수정</a></h2>\n<p>slopcode 데스크톱은 자체 로컬 서버(기본)를 시작하거나 구성된 서버 URL에 연결할 수 있습니다.</p>\n<p><strong>“Connection Failed”</strong> 대화 상자 (또는 앱이 스패시 화면을 지나지 않습니다), 사용자 정의 서버 URL을 확인합니다.</p>\n<h3 id="데스크톱-기본-서버-url-삭제"><a href="#데스크톱-기본-서버-url-삭제">데스크톱 기본 서버 URL 삭제</a></h3>\n<p>Home 화면에서 Server Picker를 열려면 서버 이름(상태 점)을 클릭하십시오. <strong>기본 서버</strong> 섹션에서 <strong>Clear</strong>를 클릭합니다.</p>\n<h4 id="설정에서-serverportserverhostname-제거"><a href="#설정에서-serverportserverhostname-제거">설정에서 server.port/server.hostname 제거</a></h4>\n<p><code dir="auto">slopcode.json(c)</code>가 <code dir="auto">server</code> 섹션을 포함하면 일시적으로 제거하고 데스크톱 앱을 다시 시작합니다.</p>\n<h3 id="환경-변수-확인"><a href="#환경-변수-확인">환경 변수 확인</a></h3>\n<p><code dir="auto">SLOPCODE_PORT</code>가 있는 경우, 데스크탑 앱은 로컬 서버의 포트를 사용하려고 합니다.</p>\n<ul>\n<li><code dir="auto">SLOPCODE_PORT</code> (또는 무료 포트를 선택) 및 재시작.</li>\n</ul>\n<hr>\n<h2 id="linux-wayland--x11-문제"><a href="#linux-wayland--x11-문제">Linux: Wayland / X11 문제</a></h2>\n<p>Linux에서 일부 Wayland 설정은 공백 창이나 compositor 오류를 일으킬 수 있습니다.</p>\n<ul>\n<li>If you’re on Wayland and the app is blank/crashing, <code dir="auto">OC_ALLOW_WAYLAND=1</code>로 출시하려고합니다.</li>\n<li>더 나쁜 것을 만드는 경우, 제거하고 X11 세션에서 실행하려고합니다.</li>\n</ul>\n<hr>\n<h2 id="windows-webview2-런타임"><a href="#windows-webview2-런타임">Windows: WebView2 런타임</a></h2>\n<p>Windows에서 slopcode 데스크톱은 Microsoft Edge ** WebView2 실행 시간 **를 요구합니다. 앱이 공백 창에 열거나 시작하지 않을 경우, install/update WebView2를 설치하고 다시 시도하십시오.</p>\n<hr>\n<h2 id="windows-일반-성능-문제"><a href="#windows-일반-성능-문제">Windows: 일반 성능 문제</a></h2>\n<p>느린 성능, 파일 액세스 문제 또는 Windows의 terminal 문제를 경험하는 경우 <a href="/docs/windows-wsl">WSL (Windows Subsystem for Linux)</a>를 사용하여 시도하십시오. WSL은 slopcode의 기능으로 더 원활하게 작동하는 Linux 환경을 제공합니다.</p>\n<hr>\n<h2 id="알림이-표시되지-않음"><a href="#알림이-표시되지-않음">알림이 표시되지 않음</a></h2>\n<p>slopcode 데스크톱은 시스템 알림을 보여줍니다 :</p>\n<ul>\n<li>OS 설정에서 slopcode에 대한 알림이 활성화되고,</li>\n<li>앱 창이 집중되지 않습니다.</li>\n</ul>\n<hr>\n<h2 id="데스크톱-앱-저장소-재설정-최후의-수단"><a href="#데스크톱-앱-저장소-재설정-최후의-수단">데스크톱 앱 저장소 재설정 (최후의 수단)</a></h2>\n<p>앱이 시작되지 않은 경우 UI 내부에서 설정을 취소할 수 없습니다. 데스크탑 앱의 저장된 상태를 재설정하십시오.</p>\n<ol>\n<li>Quit slopcode 데스크탑.</li>\n<li>이 파일을 찾아 삭제 (slopcode 데스크톱 앱 데이터 디렉토리에서 라이브):</li>\n</ol>\n<ul>\n<li><code dir="auto">slopcode.settings.dat</code> (데스크톱 기본 서버 URL)</li>\n<li><code dir="auto">slopcode.global.dat</code> 및 <code dir="auto">slopcode.workspace.*.dat</code> (최근 서버/프로젝트와 같은 UI 국가)</li>\n</ul>\n<p>빠른 디렉토리를 찾을 수:</p>\n<p>-<strong>macOS</strong>: Finder -> <code dir="auto">Cmd+Shift+G</code> -> <code dir="auto">~/Library/Application Support</code> (위의 파일명 검색)</p>\n<ul>\n<li>**리눅스 **: 위의 파일명에 대한 <code dir="auto">~/.local/share</code>의 밑에 검색</li>\n<li><strong>Windows</strong>: <code dir="auto">WIN+R</code> -> <code dir="auto">%APPDATA%</code>를 눌러 (위의 파일 이름을 검색)</li>\n</ul>\n<hr>\n<h2 id="도움-받기"><a href="#도움-받기">도움 받기</a></h2>\n<p>slopcode와 문제가 발생하면:</p>\n<ol>\n<li>** GitHub의 문제 해결 **</li>\n</ol>\n<p>버그 또는 요청 기능을보고하는 가장 좋은 방법은 GitHub 저장소를 통해 다음과 같습니다.</p>\n<p><a href="http://github.com/teamslop/slopcode/issues"><strong>github.com/teamslop/slopcode/issues</strong></a></p>\n<p>새로운 문제를 만들기 전에, 당신의 문제가 이미보고 된 경우 기존 문제를 검색.</p>\n<ol start="2">\n<li>** 우리의 Discord **</li>\n</ol>\n<p>실시간 도움말 및 커뮤니티 토론을 위해 Discord 서버에 가입하십시오.</p>\n<p><a href="https://slopcode.dev/discord"><strong>slopcode.dev/discord</strong></a></p>\n<hr>\n<h2 id="일반적인-문제"><a href="#일반적인-문제">일반적인 문제</a></h2>\n<p>몇 가지 일반적인 문제와 해결 방법.</p>\n<hr>\n<h2 id="slopcode가-시작되지-않습니다"><a href="#slopcode가-시작되지-않습니다">slopcode가 시작되지 않습니다.</a></h2>\n<ol>\n<li>오류 메시지에 대한 로그 확인</li>\n<li>terminal에 있는 산출을 보기 위하여 <code dir="auto">--print-logs</code>로 달리기를 시도하십시오</li>\n<li>당신은 <code dir="auto">slopcode upgrade</code>를 가진 최신 버전이 있는 것을 지킵니다</li>\n</ol>\n<hr>\n<h3 id="인증-문제"><a href="#인증-문제">인증 문제</a></h3>\n<ol>\n<li>TUI에서 <code dir="auto">/connect</code> 명령으로 다시 입력 시도</li>\n<li>API 키가 유효하다는 것을 확인</li>\n<li>네트워크가 공급자의 API에 연결을 허용</li>\n</ol>\n<hr>\n<h4 id="모델을-사용할-수-없음"><a href="#모델을-사용할-수-없음">모델을 사용할 수 없음</a></h4>\n<ol>\n<li>공급자와 정통한 확인</li>\n<li>config의 모델명을 수정한다.</li>\n<li>몇몇 모형은 특정한 접근 또는 구독을 요구할지도 모릅니다</li>\n</ol>\n<p>만약 당신이 <code dir="auto">ProviderModelNotFoundError</code>에 직면 하는 경우 가장 가능성이 잘못\n모델 어딘가를 나타냅니다.\n모형은 이렇게 참고되어야 합니다: <code dir="auto">&#x3C;providerId>/&#x3C;modelId></code></p>\n<p>예제:</p>\n<ul>\n<li><code dir="auto">openai/gpt-4.1</code></li>\n<li><code dir="auto">openrouter/google/gemini-2.5-flash</code></li>\n<li><code dir="auto">slopcode/kimi-k2</code></li>\n</ul>\n<p>당신이 액세스 할 수있는 모델을 파악하려면, <code dir="auto">slopcode models</code>를 실행</p>\n<hr>\n<h2 id="provideriniterror"><a href="#provideriniterror">ProviderInitError</a></h2>\n<p>ProviderInitError가 발생하면 잘못된 구성이나 손상된 구성이 있습니다.</p>\n<p>해결하기:</p>\n<ol>\n<li>\n<p>첫째로, 당신의 공급자는 <a href="./providers">providers guide</a>를 따르기 위하여 제대로 설치됩니다</p>\n</li>\n<li>\n<p>문제가 발생하면 저장된 구성을 삭제하십시오.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">rm</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-rf</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">~/.local/share/slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="rm -rf ~/.local/share/slopcode"><div></div></button></div></figure></div>\n</li>\n</ol>\n<p>Windows에서, <code dir="auto">WIN+R</code>를 누르고 삭제하십시오: <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode</code></p>\n<ol start="3">\n<li>TUI의 <code dir="auto">/connect</code> 명령을 사용하여 공급자와 재해.</li>\n</ol>\n<hr>\n<h3 id="ai_apicallerror-및-공급자-패키지-문제"><a href="#ai_apicallerror-및-공급자-패키지-문제">AI_APICallError 및 공급자 패키지 문제</a></h3>\n<p>API 호출 오류가 발생하면, 이 공급 업체 패키지로 인해 발생할 수 있습니다. slopcode 동적 설치 공급자 패키지 (OpenAI, Anthropic, Google 등) 필요 하 고 로컬로 캐시.</p>\n<p>공급자 패키지 문제를 해결하려면:</p>\n<ol>\n<li>\n<p>공급자 포장 캐시를 지우십시오:</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">rm</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-rf</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">~/.cache/slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="rm -rf ~/.cache/slopcode"><div></div></button></div></figure></div>\n</li>\n</ol>\n<p>Windows에서, <code dir="auto">WIN+R</code>를 누르고 삭제하십시오: <code dir="auto">%USERPROFILE%\\.cache\\slopcode</code></p>\n<ol start="2">\n<li>최신 공급자 포장을 재설치하는 Restart slopcode</li>\n</ol>\n<p>이것은 종종 모델 매개 변수와 API 변경과 호환성 문제를 해결하는 공급자 패키지의 가장 최근 버전을 다운로드하기 위해 slopcode를 강제합니다.</p>\n<hr>\n<h4 id="linux에서-복사붙여넣기-작동-안-함"><a href="#linux에서-복사붙여넣기-작동-안-함">Linux에서 복사/붙여넣기 작동 안 함</a></h4>\n<p>Linux 사용자는 다음과 같은 클립 보드 유틸리티 중 하나가 복사 / 붙여 넣기 기능에 설치해야합니다.</p>\n<p>** X11 시스템:**</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xclip</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># or</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xsel</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y xclipapt install -y xsel"><div></div></button></div></figure></div>\n<p><strong>웨이랜드 시스템:</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">wl-clipboard</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y wl-clipboard"><div></div></button></div></figure></div>\n<p>** 헤드리스 환경에 대한:**</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xvfb</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># and run:</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">Xvfb</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">:99</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-screen</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">0</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">1024x768x24</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">></span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">/dev/null</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">2>&#x26;1</span><span style="--0:#24292E;--1:#E1E4E8"> &#x26;</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">export</span><span style="--0:#24292E;--1:#E1E4E8"> DISPLAY</span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8">:99.0</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y xvfbXvfb :99 -screen 0 1024x768x24 > /dev/null 2>&#x26;1 &#x26;export DISPLAY=:99.0"><div></div></button></div></figure></div>\n<p>slopcode는 당신이 Wayland를 사용하고 <code dir="auto">wl-clipboard</code>를 선호하는 경우에 검출할 것입니다, 그렇지 않으면의 순서에 있는 클립보드 공구를 찾아낼 것입니다: <code dir="auto">xclip</code>와 <code dir="auto">xsel</code>.</p>',
  })
}
function MDXContent(props = {}) {
  const { wrapper: MDXLayout } = props.components || {}
  return MDXLayout
    ? createVNode(MDXLayout, {
        ...props,
        children: createVNode(_createMdxContent, {
          ...props,
        }),
      })
    : _createMdxContent(props)
}
function _missingMdxReference(id, component) {
  throw new Error(
    "Expected " + "component" + " `" + id + "` to be defined: you likely forgot to import, pass, or provide it.",
  )
}
const url = "src/content/docs/ko/troubleshooting.mdx"
const file = "/app/packages/web/src/content/docs/ko/troubleshooting.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/app/packages/web/src/content/docs/ko/troubleshooting.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
