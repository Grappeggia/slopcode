globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"
import "./Code_sjN3308E.mjs"

const frontmatter = {
  title: "CLI",
  description: "slopcode CLI 옵션과 명령어.",
}
function getHeadings() {
  return [
    {
      depth: 3,
      slug: "tui",
      text: "tui",
    },
    {
      depth: 4,
      slug: "플래그",
      text: "플래그",
    },
    {
      depth: 2,
      slug: "명령어",
      text: "명령어",
    },
    {
      depth: 3,
      slug: "agent",
      text: "agent",
    },
    {
      depth: 3,
      slug: "attach",
      text: "attach",
    },
    {
      depth: 4,
      slug: "플래그-1",
      text: "플래그",
    },
    {
      depth: 4,
      slug: "create",
      text: "create",
    },
    {
      depth: 4,
      slug: "list",
      text: "list",
    },
    {
      depth: 3,
      slug: "auth",
      text: "auth",
    },
    {
      depth: 4,
      slug: "login",
      text: "login",
    },
    {
      depth: 4,
      slug: "list-1",
      text: "list",
    },
    {
      depth: 4,
      slug: "logout",
      text: "logout",
    },
    {
      depth: 3,
      slug: "github",
      text: "github",
    },
    {
      depth: 4,
      slug: "install",
      text: "install",
    },
    {
      depth: 4,
      slug: "run",
      text: "run",
    },
    {
      depth: 5,
      slug: "플래그-2",
      text: "플래그",
    },
    {
      depth: 3,
      slug: "mcp",
      text: "mcp",
    },
    {
      depth: 4,
      slug: "add",
      text: "add",
    },
    {
      depth: 4,
      slug: "list-2",
      text: "list",
    },
    {
      depth: 4,
      slug: "auth-1",
      text: "auth",
    },
    {
      depth: 4,
      slug: "logout-1",
      text: "logout",
    },
    {
      depth: 4,
      slug: "debug",
      text: "debug",
    },
    {
      depth: 3,
      slug: "models",
      text: "models",
    },
    {
      depth: 4,
      slug: "플래그-3",
      text: "플래그",
    },
    {
      depth: 3,
      slug: "run-1",
      text: "run",
    },
    {
      depth: 4,
      slug: "플래그-4",
      text: "플래그",
    },
    {
      depth: 3,
      slug: "serve",
      text: "serve",
    },
    {
      depth: 4,
      slug: "플래그-5",
      text: "플래그",
    },
    {
      depth: 3,
      slug: "session",
      text: "session",
    },
    {
      depth: 4,
      slug: "list-3",
      text: "list",
    },
    {
      depth: 5,
      slug: "플래그-6",
      text: "플래그",
    },
    {
      depth: 3,
      slug: "stats",
      text: "stats",
    },
    {
      depth: 4,
      slug: "플래그-7",
      text: "플래그",
    },
    {
      depth: 3,
      slug: "export",
      text: "export",
    },
    {
      depth: 3,
      slug: "import",
      text: "import",
    },
    {
      depth: 3,
      slug: "web",
      text: "web",
    },
    {
      depth: 4,
      slug: "플래그-8",
      text: "플래그",
    },
    {
      depth: 3,
      slug: "acp",
      text: "acp",
    },
    {
      depth: 4,
      slug: "플래그-9",
      text: "플래그",
    },
    {
      depth: 3,
      slug: "uninstall",
      text: "uninstall",
    },
    {
      depth: 4,
      slug: "플래그-10",
      text: "플래그",
    },
    {
      depth: 3,
      slug: "upgrade",
      text: "upgrade",
    },
    {
      depth: 4,
      slug: "플래그-11",
      text: "플래그",
    },
    {
      depth: 2,
      slug: "전역-플래그",
      text: "전역 플래그",
    },
    {
      depth: 2,
      slug: "환경-변수",
      text: "환경 변수",
    },
    {
      depth: 3,
      slug: "실험적-기능",
      text: "실험적 기능",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>slopcode CLI는 인수 없이 실행하면 기본적으로 <a href="/docs/tui">TUI</a>를 시작합니다.</p>\n<div class="expressive-code"><link rel="stylesheet" href="/docs/_astro/ec.4c0k7.css"><script type="module" src="/docs/_astro/ec.0vx5m.js"></script><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode"><div></div></button></div></figure></div>\n<p>이 페이지에 나온 것처럼 명령을 함께 전달할 수도 있습니다. 이를 통해 slopcode를 프로그래밍 방식으로 사용할 수 있습니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">run</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">"Explain how closures work in JavaScript"</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode run &#x22;Explain how closures work in JavaScript&#x22;"><div></div></button></div></figure></div>\n<hr>\n<h3 id="tui"><a href="#tui">tui</a></h3>\n<p>SlopCode 터미널 사용자 인터페이스를 시작합니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> [project]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode [project]"><div></div></button></div></figure></div>\n<h4 id="플래그"><a href="#플래그">플래그</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>플래그</th><th>축약</th><th>설명</th></tr></thead><tbody><tr><td><code dir="auto">--continue</code></td><td><code dir="auto">-c</code></td><td>마지막 세션 이어서 실행</td></tr><tr><td><code dir="auto">--session</code></td><td><code dir="auto">-s</code></td><td>이어서 실행할 세션 ID</td></tr><tr><td><code dir="auto">--fork</code></td><td></td><td>세션을 이어갈 때 포크 생성 (<code dir="auto">--continue</code> 또는 <code dir="auto">--session</code>과 함께 사용)</td></tr><tr><td><code dir="auto">--prompt</code></td><td></td><td>사용할 프롬프트</td></tr><tr><td><code dir="auto">--model</code></td><td><code dir="auto">-m</code></td><td>사용할 모델 (<code dir="auto">provider/model</code> 형식)</td></tr><tr><td><code dir="auto">--agent</code></td><td></td><td>사용할 에이전트</td></tr><tr><td><code dir="auto">--port</code></td><td></td><td>수신 포트</td></tr><tr><td><code dir="auto">--hostname</code></td><td></td><td>수신 호스트명</td></tr></tbody></table>\n<hr>\n<h2 id="명령어"><a href="#명령어">명령어</a></h2>\n<p>slopcode CLI는 아래 명령들도 제공합니다.</p>\n<hr>\n<h3 id="agent"><a href="#agent">agent</a></h3>\n<p>slopcode용 에이전트를 관리합니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">agent</span><span style="--0:#24292E;--1:#E1E4E8"> [command]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode agent [command]"><div></div></button></div></figure></div>\n<hr>\n<h3 id="attach"><a href="#attach">attach</a></h3>\n<p><code dir="auto">serve</code> 또는 <code dir="auto">web</code> 명령으로 이미 실행 중인 slopcode 백엔드 서버에 터미널을 연결합니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">attach</span><span style="--0:#24292E;--1:#E1E4E8"> [url]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode attach [url]"><div></div></button></div></figure></div>\n<p>원격 slopcode 백엔드와 TUI를 연결해 사용할 수 있습니다. 예:</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># Start the backend server for web/mobile access</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">web</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--port</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">4096</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--hostname</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">0.0.0.0</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># In another terminal, attach the TUI to the running backend</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">attach</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">http://10.20.30.40:4096</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode web --port 4096 --hostname 0.0.0.0slopcode attach http://10.20.30.40:4096"><div></div></button></div></figure></div>\n<h4 id="플래그-1"><a href="#플래그-1">플래그</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>플래그</th><th>축약</th><th>설명</th></tr></thead><tbody><tr><td><code dir="auto">--dir</code></td><td></td><td>TUI를 시작할 작업 디렉터리</td></tr><tr><td><code dir="auto">--session</code></td><td><code dir="auto">-s</code></td><td>이어서 실행할 세션 ID</td></tr></tbody></table>\n<hr>\n<h4 id="create"><a href="#create">create</a></h4>\n<p>커스텀 설정으로 새 에이전트를 만듭니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">agent</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">create</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode agent create"><div></div></button></div></figure></div>\n<p>이 명령은 커스텀 시스템 프롬프트와 도구 설정을 사용해 새 에이전트를 만드는 과정을 안내합니다.</p>\n<hr>\n<h4 id="list"><a href="#list">list</a></h4>\n<p>사용 가능한 모든 에이전트를 표시합니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">agent</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">list</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode agent list"><div></div></button></div></figure></div>\n<hr>\n<h3 id="auth"><a href="#auth">auth</a></h3>\n<p>provider 인증 정보와 로그인을 관리합니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">auth</span><span style="--0:#24292E;--1:#E1E4E8"> [command]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode auth [command]"><div></div></button></div></figure></div>\n<hr>\n<h4 id="login"><a href="#login">login</a></h4>\n<p>SlopCode는 <a href="https://models.dev">Models.dev</a>의 provider 목록을 기반으로 동작하므로, <code dir="auto">slopcode auth login</code>으로 원하는 provider의 API 키를 설정할 수 있습니다. 인증 정보는 <code dir="auto">~/.local/share/slopcode/auth.json</code>에 저장됩니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">auth</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">login</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode auth login"><div></div></button></div></figure></div>\n<p>SlopCode 시작 시 인증 파일에서 provider 정보를 불러오며, 시스템 환경 변수나 프로젝트의 <code dir="auto">.env</code>에 정의된 키도 함께 로드합니다.</p>\n<hr>\n<h4 id="list-1"><a href="#list-1">list</a></h4>\n<p>인증 파일에 저장된 provider 목록을 표시합니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">auth</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">list</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode auth list"><div></div></button></div></figure></div>\n<p>축약형도 사용할 수 있습니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">auth</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">ls</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode auth ls"><div></div></button></div></figure></div>\n<hr>\n<h4 id="logout"><a href="#logout">logout</a></h4>\n<p>인증 파일에서 provider 정보를 제거해 로그아웃합니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">auth</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">logout</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode auth logout"><div></div></button></div></figure></div>\n<hr>\n<h3 id="github"><a href="#github">github</a></h3>\n<p>저장소 자동화를 위한 GitHub 에이전트를 관리합니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">github</span><span style="--0:#24292E;--1:#E1E4E8"> [command]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode github [command]"><div></div></button></div></figure></div>\n<hr>\n<h4 id="install"><a href="#install">install</a></h4>\n<p>저장소에 GitHub 에이전트를 설치합니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">github</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode github install"><div></div></button></div></figure></div>\n<p>필요한 GitHub Actions 워크플로를 설정하고 구성 과정을 안내합니다. <a href="/docs/github">더 알아보기</a>.</p>\n<hr>\n<h4 id="run"><a href="#run">run</a></h4>\n<p>GitHub 에이전트를 실행합니다. 보통 GitHub Actions에서 사용합니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">github</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">run</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode github run"><div></div></button></div></figure></div>\n<h5 id="플래그-2"><a href="#플래그-2">플래그</a></h5>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>플래그</th><th>설명</th></tr></thead><tbody><tr><td><code dir="auto">--event</code></td><td>실행할 GitHub 모의 이벤트</td></tr><tr><td><code dir="auto">--token</code></td><td>GitHub 개인 액세스 토큰</td></tr></tbody></table>\n<hr>\n<h3 id="mcp"><a href="#mcp">mcp</a></h3>\n<p>Model Context Protocol 서버를 관리합니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">mcp</span><span style="--0:#24292E;--1:#E1E4E8"> [command]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode mcp [command]"><div></div></button></div></figure></div>\n<hr>\n<h4 id="add"><a href="#add">add</a></h4>\n<p>구성에 MCP 서버를 추가합니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">mcp</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">add</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode mcp add"><div></div></button></div></figure></div>\n<p>이 명령은 로컬 또는 원격 MCP 서버를 추가하는 과정을 안내합니다.</p>\n<hr>\n<h4 id="list-2"><a href="#list-2">list</a></h4>\n<p>구성된 MCP 서버와 연결 상태를 표시합니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">mcp</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">list</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode mcp list"><div></div></button></div></figure></div>\n<p>축약형도 사용할 수 있습니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">mcp</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">ls</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode mcp ls"><div></div></button></div></figure></div>\n<hr>\n<h4 id="auth-1"><a href="#auth-1">auth</a></h4>\n<p>OAuth를 지원하는 MCP 서버를 인증합니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">mcp</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">auth</span><span style="--0:#24292E;--1:#E1E4E8"> [name]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode mcp auth [name]"><div></div></button></div></figure></div>\n<p>서버 이름을 입력하지 않으면 OAuth 지원 서버 목록에서 선택하라는 안내가 표시됩니다.</p>\n<p>OAuth 지원 서버와 인증 상태를 목록으로 볼 수도 있습니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">mcp</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">auth</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">list</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode mcp auth list"><div></div></button></div></figure></div>\n<p>축약형도 사용할 수 있습니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">mcp</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">auth</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">ls</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode mcp auth ls"><div></div></button></div></figure></div>\n<hr>\n<h4 id="logout-1"><a href="#logout-1">logout</a></h4>\n<p>MCP 서버의 OAuth 인증 정보를 제거합니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">mcp</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">logout</span><span style="--0:#24292E;--1:#E1E4E8"> [name]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode mcp logout [name]"><div></div></button></div></figure></div>\n<hr>\n<h4 id="debug"><a href="#debug">debug</a></h4>\n<p>MCP 서버의 OAuth 연결 문제를 디버그합니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">mcp</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">debug</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">&#x3C;name></span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode mcp debug <name>"><div></div></button></div></figure></div>\n<hr>\n<h3 id="models"><a href="#models">models</a></h3>\n<p>구성된 provider에서 사용 가능한 모델 목록을 표시합니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">models</span><span style="--0:#24292E;--1:#E1E4E8"> [provider]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode models [provider]"><div></div></button></div></figure></div>\n<p>이 명령은 구성된 provider 전체에서 사용 가능한 모델을 <code dir="auto">provider/model</code> 형식으로 출력합니다.</p>\n<p><a href="/docs/config/">config</a>에 지정할 정확한 모델명을 확인할 때 유용합니다.</p>\n<p>특정 provider ID를 넘겨 해당 provider의 모델만 필터링할 수도 있습니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">models</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">anthropic</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode models anthropic"><div></div></button></div></figure></div>\n<h4 id="플래그-3"><a href="#플래그-3">플래그</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>플래그</th><th>설명</th></tr></thead><tbody><tr><td><code dir="auto">--refresh</code></td><td>models.dev에서 모델 캐시 새로고침</td></tr><tr><td><code dir="auto">--verbose</code></td><td>더 자세한 모델 출력 사용(비용 등 메타데이터 포함)</td></tr></tbody></table>\n<p><code dir="auto">--refresh</code> 플래그를 사용하면 캐시된 모델 목록을 갱신할 수 있습니다. provider에 새 모델이 추가된 뒤 SlopCode에서 바로 확인하고 싶을 때 유용합니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">models</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--refresh</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode models --refresh"><div></div></button></div></figure></div>\n<hr>\n<h3 id="run-1"><a href="#run-1">run</a></h3>\n<p>프롬프트를 직접 전달해 비대화형 모드로 slopcode를 실행합니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">run</span><span style="--0:#24292E;--1:#E1E4E8"> [message..]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode run [message..]"><div></div></button></div></figure></div>\n<p>스크립트, 자동화, 또는 전체 TUI를 띄우지 않고 빠른 응답이 필요할 때 유용합니다. 예:</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><mark><span style="--0:#5c37a0;--1:#c5acf4">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">run</span></mark><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">Explain</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">the</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">use</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">of</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">context</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">in</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">Go</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode run Explain the use of context in Go"><div></div></button></div></figure></div>\n<p>매번 MCP 서버 콜드 부트가 발생하지 않도록, 실행 중인 <code dir="auto">slopcode serve</code> 인스턴스에 붙어서 실행할 수도 있습니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># Start a headless server in one terminal</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">serve</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># In another terminal, run commands that attach to it</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">run</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--attach</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">http://localhost:4096</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">"Explain async/await in JavaScript"</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode serveslopcode run --attach http://localhost:4096 &#x22;Explain async/await in JavaScript&#x22;"><div></div></button></div></figure></div>\n<h4 id="플래그-4"><a href="#플래그-4">플래그</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>플래그</th><th>축약</th><th>설명</th></tr></thead><tbody><tr><td><code dir="auto">--command</code></td><td></td><td>실행할 명령(인수는 message로 전달)</td></tr><tr><td><code dir="auto">--continue</code></td><td><code dir="auto">-c</code></td><td>마지막 세션 이어서 실행</td></tr><tr><td><code dir="auto">--session</code></td><td><code dir="auto">-s</code></td><td>이어서 실행할 세션 ID</td></tr><tr><td><code dir="auto">--fork</code></td><td></td><td>세션을 이어갈 때 포크 생성 (<code dir="auto">--continue</code> 또는 <code dir="auto">--session</code>과 함께 사용)</td></tr><tr><td><code dir="auto">--share</code></td><td></td><td>세션 공유</td></tr><tr><td><code dir="auto">--model</code></td><td><code dir="auto">-m</code></td><td>사용할 모델 (<code dir="auto">provider/model</code> 형식)</td></tr><tr><td><code dir="auto">--agent</code></td><td></td><td>사용할 에이전트</td></tr><tr><td><code dir="auto">--file</code></td><td><code dir="auto">-f</code></td><td>메시지에 첨부할 파일</td></tr><tr><td><code dir="auto">--format</code></td><td></td><td>출력 형식: default(포맷됨) 또는 json(원시 JSON 이벤트)</td></tr><tr><td><code dir="auto">--title</code></td><td></td><td>세션 제목(값이 없으면 프롬프트를 잘라 자동 생성)</td></tr><tr><td><code dir="auto">--attach</code></td><td></td><td>실행 중인 slopcode 서버에 연결(예: <a href="http://localhost:4096">http://localhost:4096</a>)</td></tr><tr><td><code dir="auto">--port</code></td><td></td><td>로컬 서버 포트(기본값: 랜덤 포트)</td></tr></tbody></table>\n<hr>\n<h3 id="serve"><a href="#serve">serve</a></h3>\n<p>API 접근용 headless SlopCode 서버를 시작합니다. 전체 HTTP 인터페이스는 <a href="/docs/server">server docs</a>를 참고하세요.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">serve</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode serve"><div></div></button></div></figure></div>\n<p>이 명령은 TUI 없이 slopcode 기능에 접근할 수 있는 HTTP 서버를 시작합니다. <code dir="auto">SLOPCODE_SERVER_PASSWORD</code>를 설정하면 HTTP basic auth가 활성화됩니다(기본 사용자명: <code dir="auto">slopcode</code>).</p>\n<h4 id="플래그-5"><a href="#플래그-5">플래그</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>플래그</th><th>설명</th></tr></thead><tbody><tr><td><code dir="auto">--port</code></td><td>수신 포트</td></tr><tr><td><code dir="auto">--hostname</code></td><td>수신 호스트명</td></tr><tr><td><code dir="auto">--mdns</code></td><td>mDNS 검색 활성화</td></tr><tr><td><code dir="auto">--cors</code></td><td>허용할 추가 브라우저 origin(CORS)</td></tr></tbody></table>\n<hr>\n<h3 id="session"><a href="#session">session</a></h3>\n<p>SlopCode 세션을 관리합니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">session</span><span style="--0:#24292E;--1:#E1E4E8"> [command]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode session [command]"><div></div></button></div></figure></div>\n<hr>\n<h4 id="list-3"><a href="#list-3">list</a></h4>\n<p>SlopCode 세션 목록을 표시합니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">session</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">list</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode session list"><div></div></button></div></figure></div>\n<h5 id="플래그-6"><a href="#플래그-6">플래그</a></h5>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>플래그</th><th>축약</th><th>설명</th></tr></thead><tbody><tr><td><code dir="auto">--max-count</code></td><td><code dir="auto">-n</code></td><td>최근 N개 세션만 표시</td></tr><tr><td><code dir="auto">--format</code></td><td></td><td>출력 형식: table 또는 json(기본 table)</td></tr></tbody></table>\n<hr>\n<h3 id="stats"><a href="#stats">stats</a></h3>\n<p>SlopCode 세션의 토큰 사용량과 비용 통계를 표시합니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">stats</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode stats"><div></div></button></div></figure></div>\n<h4 id="플래그-7"><a href="#플래그-7">플래그</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>플래그</th><th>설명</th></tr></thead><tbody><tr><td><code dir="auto">--days</code></td><td>최근 N일 통계 표시(기본값: 전체 기간)</td></tr><tr><td><code dir="auto">--tools</code></td><td>표시할 도구 개수(기본값: 전체)</td></tr><tr><td><code dir="auto">--models</code></td><td>모델 사용량 상세 표시(기본 숨김). 숫자를 주면 상위 N개 표시</td></tr><tr><td><code dir="auto">--project</code></td><td>프로젝트 필터(기본: 전체 프로젝트, 빈 문자열: 현재 프로젝트)</td></tr></tbody></table>\n<hr>\n<h3 id="export"><a href="#export">export</a></h3>\n<p>세션 데이터를 JSON으로 내보냅니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">export</span><span style="--0:#24292E;--1:#E1E4E8"> [sessionID]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode export [sessionID]"><div></div></button></div></figure></div>\n<p>세션 ID를 지정하지 않으면 사용 가능한 세션에서 선택하라는 안내가 표시됩니다.</p>\n<hr>\n<h3 id="import"><a href="#import">import</a></h3>\n<p>JSON 파일 또는 SlopCode 공유 URL에서 세션 데이터를 가져옵니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">import</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">&#x3C;file></span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode import <file>"><div></div></button></div></figure></div>\n<p>로컬 파일이나 SlopCode 공유 URL에서 가져올 수 있습니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">import</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">session.json</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">import</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">https://opncd.ai/s/abc123</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode import session.jsonslopcode import https://opncd.ai/s/abc123"><div></div></button></div></figure></div>\n<hr>\n<h3 id="web"><a href="#web">web</a></h3>\n<p>웹 인터페이스를 포함한 headless SlopCode 서버를 시작합니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">web</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode web"><div></div></button></div></figure></div>\n<p>이 명령은 HTTP 서버를 시작하고 웹 브라우저를 열어 웹 인터페이스로 SlopCode에 접속합니다. <code dir="auto">SLOPCODE_SERVER_PASSWORD</code>를 설정하면 HTTP basic auth가 활성화됩니다(기본 사용자명: <code dir="auto">slopcode</code>).</p>\n<h4 id="플래그-8"><a href="#플래그-8">플래그</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>플래그</th><th>설명</th></tr></thead><tbody><tr><td><code dir="auto">--port</code></td><td>수신 포트</td></tr><tr><td><code dir="auto">--hostname</code></td><td>수신 호스트명</td></tr><tr><td><code dir="auto">--mdns</code></td><td>mDNS 검색 활성화</td></tr><tr><td><code dir="auto">--cors</code></td><td>허용할 추가 브라우저 origin(CORS)</td></tr></tbody></table>\n<hr>\n<h3 id="acp"><a href="#acp">acp</a></h3>\n<p>ACP(Agent Client Protocol) 서버를 시작합니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">acp</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode acp"><div></div></button></div></figure></div>\n<p>이 명령은 nd-JSON 형식으로 stdin/stdout을 통해 통신하는 ACP 서버를 시작합니다.</p>\n<h4 id="플래그-9"><a href="#플래그-9">플래그</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>플래그</th><th>설명</th></tr></thead><tbody><tr><td><code dir="auto">--cwd</code></td><td>작업 디렉터리</td></tr><tr><td><code dir="auto">--port</code></td><td>수신 포트</td></tr><tr><td><code dir="auto">--hostname</code></td><td>수신 호스트명</td></tr></tbody></table>\n<hr>\n<h3 id="uninstall"><a href="#uninstall">uninstall</a></h3>\n<p>SlopCode를 제거하고 관련 파일을 삭제합니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">uninstall</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode uninstall"><div></div></button></div></figure></div>\n<h4 id="플래그-10"><a href="#플래그-10">플래그</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>플래그</th><th>축약</th><th>설명</th></tr></thead><tbody><tr><td><code dir="auto">--keep-config</code></td><td><code dir="auto">-c</code></td><td>설정 파일 유지</td></tr><tr><td><code dir="auto">--keep-data</code></td><td><code dir="auto">-d</code></td><td>세션 데이터와 스냅샷 유지</td></tr><tr><td><code dir="auto">--dry-run</code></td><td></td><td>실제 삭제 없이 삭제 대상만 표시</td></tr><tr><td><code dir="auto">--force</code></td><td><code dir="auto">-f</code></td><td>확인 프롬프트 건너뛰기</td></tr></tbody></table>\n<hr>\n<h3 id="upgrade"><a href="#upgrade">upgrade</a></h3>\n<p>slopcode를 최신 버전 또는 특정 버전으로 업데이트합니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">upgrade</span><span style="--0:#24292E;--1:#E1E4E8"> [target]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode upgrade [target]"><div></div></button></div></figure></div>\n<p>최신 버전으로 업그레이드:</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">upgrade</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode upgrade"><div></div></button></div></figure></div>\n<p>특정 버전으로 업그레이드:</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">upgrade</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">v0.1.48</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode upgrade v0.1.48"><div></div></button></div></figure></div>\n<h4 id="플래그-11"><a href="#플래그-11">플래그</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>플래그</th><th>축약</th><th>설명</th></tr></thead><tbody><tr><td><code dir="auto">--method</code></td><td><code dir="auto">-m</code></td><td>설치 방식 지정: curl, npm, pnpm, bun, brew</td></tr></tbody></table>\n<hr>\n<h2 id="전역-플래그"><a href="#전역-플래그">전역 플래그</a></h2>\n<p>slopcode CLI는 아래 전역 플래그를 지원합니다.</p>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>플래그</th><th>축약</th><th>설명</th></tr></thead><tbody><tr><td><code dir="auto">--help</code></td><td><code dir="auto">-h</code></td><td>도움말 표시</td></tr><tr><td><code dir="auto">--version</code></td><td><code dir="auto">-v</code></td><td>버전 출력</td></tr><tr><td><code dir="auto">--print-logs</code></td><td></td><td>로그를 stderr로 출력</td></tr><tr><td><code dir="auto">--log-level</code></td><td></td><td>로그 레벨(DEBUG, INFO, WARN, ERROR)</td></tr></tbody></table>\n<hr>\n<h2 id="환경-변수"><a href="#환경-변수">환경 변수</a></h2>\n<p>SlopCode는 환경 변수로도 구성할 수 있습니다.</p>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>변수</th><th>타입</th><th>설명</th></tr></thead><tbody><tr><td><code dir="auto">SLOPCODE_AUTO_SHARE</code></td><td>boolean</td><td>세션 자동 공유</td></tr><tr><td><code dir="auto">SLOPCODE_GIT_BASH_PATH</code></td><td>string</td><td>Windows에서 Git Bash 실행 파일 경로</td></tr><tr><td><code dir="auto">SLOPCODE_CONFIG</code></td><td>string</td><td>설정 파일 경로</td></tr><tr><td><code dir="auto">SLOPCODE_CONFIG_DIR</code></td><td>string</td><td>설정 디렉터리 경로</td></tr><tr><td><code dir="auto">SLOPCODE_CONFIG_CONTENT</code></td><td>string</td><td>인라인 JSON 설정 내용</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_AUTOUPDATE</code></td><td>boolean</td><td>자동 업데이트 확인 비활성화</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_PRUNE</code></td><td>boolean</td><td>오래된 데이터 정리(prune) 비활성화</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_TERMINAL_TITLE</code></td><td>boolean</td><td>터미널 제목 자동 업데이트 비활성화</td></tr><tr><td><code dir="auto">SLOPCODE_PERMISSION</code></td><td>string</td><td>인라인 JSON 권한 설정</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_DEFAULT_PLUGINS</code></td><td>boolean</td><td>기본 플러그인 비활성화</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_LSP_DOWNLOAD</code></td><td>boolean</td><td>LSP 서버 자동 다운로드 비활성화</td></tr><tr><td><code dir="auto">SLOPCODE_ENABLE_EXPERIMENTAL_MODELS</code></td><td>boolean</td><td>실험적 모델 활성화</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_AUTOCOMPACT</code></td><td>boolean</td><td>자동 컨텍스트 컴팩션 비활성화</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_CLAUDE_CODE</code></td><td>boolean</td><td><code dir="auto">.claude</code>(프롬프트 + 스킬) 읽기 비활성화</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_CLAUDE_CODE_PROMPT</code></td><td>boolean</td><td><code dir="auto">~/.claude/CLAUDE.md</code> 읽기 비활성화</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_CLAUDE_CODE_SKILLS</code></td><td>boolean</td><td><code dir="auto">.claude/skills</code> 로드 비활성화</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_MODELS_FETCH</code></td><td>boolean</td><td>원격 소스에서 모델 목록 가져오기 비활성화</td></tr><tr><td><code dir="auto">SLOPCODE_FAKE_VCS</code></td><td>string</td><td>테스트용 가짜 VCS provider</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_FILETIME_CHECK</code></td><td>boolean</td><td>최적화를 위한 파일 시간 검사 비활성화</td></tr><tr><td><code dir="auto">SLOPCODE_CLIENT</code></td><td>string</td><td>클라이언트 식별자(기본값: <code dir="auto">cli</code>)</td></tr><tr><td><code dir="auto">SLOPCODE_ENABLE_EXA</code></td><td>boolean</td><td>Exa 웹 검색 도구 활성화</td></tr><tr><td><code dir="auto">SLOPCODE_SERVER_PASSWORD</code></td><td>string</td><td><code dir="auto">serve</code>/<code dir="auto">web</code> 기본 인증 활성화</td></tr><tr><td><code dir="auto">SLOPCODE_SERVER_USERNAME</code></td><td>string</td><td>기본 인증 사용자명 오버라이드(기본 <code dir="auto">slopcode</code>)</td></tr><tr><td><code dir="auto">SLOPCODE_MODELS_URL</code></td><td>string</td><td>모델 설정을 가져올 사용자 지정 URL</td></tr></tbody></table>\n<hr>\n<h3 id="실험적-기능"><a href="#실험적-기능">실험적 기능</a></h3>\n<p>아래 환경 변수는 변경되거나 제거될 수 있는 실험 기능을 활성화합니다.</p>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>변수</th><th>타입</th><th>설명</th></tr></thead><tbody><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL</code></td><td>boolean</td><td>모든 실험 기능 활성화</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_ICON_DISCOVERY</code></td><td>boolean</td><td>아이콘 탐색 활성화</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT</code></td><td>boolean</td><td>TUI에서 선택 시 복사 비활성화</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS</code></td><td>number</td><td>bash 명령 기본 타임아웃(ms)</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX</code></td><td>number</td><td>LLM 응답 최대 출력 토큰 수</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_FILEWATCHER</code></td><td>boolean</td><td>전체 디렉터리 파일 감시 활성화</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_OXFMT</code></td><td>boolean</td><td>oxfmt 포매터 활성화</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_LSP_TOOL</code></td><td>boolean</td><td>실험적 LSP 도구 활성화</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_DISABLE_FILEWATCHER</code></td><td>boolean</td><td>파일 감시 비활성화</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_EXA</code></td><td>boolean</td><td>실험적 Exa 기능 활성화</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_LSP_TY</code></td><td>boolean</td><td>실험적 LSP 타입 검사 활성화</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_MARKDOWN</code></td><td>boolean</td><td>실험적 Markdown 기능 활성화</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_PLAN_MODE</code></td><td>boolean</td><td>Plan mode 활성화</td></tr></tbody></table>',
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
const url = "src/content/docs/ko/cli.mdx"
const file = "/app/packages/web/src/content/docs/ko/cli.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/app/packages/web/src/content/docs/ko/cli.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
