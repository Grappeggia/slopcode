globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"
import "./Code_Dx6xRpqw.mjs"

const frontmatter = {
  title: "CLI",
  description: "SlopCode CLI 選項和指令。",
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
      slug: "旗標",
      text: "旗標",
    },
    {
      depth: 2,
      slug: "指令",
      text: "指令",
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
      slug: "旗標-1",
      text: "旗標",
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
      slug: "旗標-2",
      text: "旗標",
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
      slug: "旗標-3",
      text: "旗標",
    },
    {
      depth: 3,
      slug: "run-1",
      text: "run",
    },
    {
      depth: 4,
      slug: "旗標-4",
      text: "旗標",
    },
    {
      depth: 3,
      slug: "serve",
      text: "serve",
    },
    {
      depth: 4,
      slug: "旗標-5",
      text: "旗標",
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
      slug: "旗標-6",
      text: "旗標",
    },
    {
      depth: 3,
      slug: "stats",
      text: "stats",
    },
    {
      depth: 4,
      slug: "旗標-7",
      text: "旗標",
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
      slug: "旗標-8",
      text: "旗標",
    },
    {
      depth: 3,
      slug: "acp",
      text: "acp",
    },
    {
      depth: 4,
      slug: "旗標-9",
      text: "旗標",
    },
    {
      depth: 3,
      slug: "uninstall",
      text: "uninstall",
    },
    {
      depth: 4,
      slug: "旗標-10",
      text: "旗標",
    },
    {
      depth: 3,
      slug: "upgrade",
      text: "upgrade",
    },
    {
      depth: 4,
      slug: "旗標-11",
      text: "旗標",
    },
    {
      depth: 2,
      slug: "全域旗標",
      text: "全域旗標",
    },
    {
      depth: 2,
      slug: "環境變數",
      text: "環境變數",
    },
    {
      depth: 3,
      slug: "實驗性功能",
      text: "實驗性功能",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>SlopCode CLI 在不帶任何參數執行時，預設啟動 <a href="/docs/tui">TUI</a>。</p>\n<div class="expressive-code"><link rel="stylesheet" href="/docs/_astro/ec.4c0k7.css"><script type="module" src="/docs/_astro/ec.0vx5m.js"></script><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode"><div></div></button></div></figure></div>\n<p>但它也接受本頁面中記錄的指令，使您可以透過程式方式與 SlopCode 進行互動。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">run</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">"Explain how closures work in JavaScript"</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode run &#x22;Explain how closures work in JavaScript&#x22;"><div></div></button></div></figure></div>\n<hr>\n<h3 id="tui"><a href="#tui">tui</a></h3>\n<p>啟動 SlopCode 終端機使用者介面。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> [project]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode [project]"><div></div></button></div></figure></div>\n<h4 id="旗標"><a href="#旗標">旗標</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>旗標</th><th>簡寫</th><th>說明</th></tr></thead><tbody><tr><td><code dir="auto">--continue</code></td><td><code dir="auto">-c</code></td><td>繼續上一個工作階段</td></tr><tr><td><code dir="auto">--session</code></td><td><code dir="auto">-s</code></td><td>要繼續的工作階段 ID</td></tr><tr><td><code dir="auto">--fork</code></td><td></td><td>繼續時分岔工作階段（與 <code dir="auto">--continue</code> 或 <code dir="auto">--session</code> 搭配使用）</td></tr><tr><td><code dir="auto">--prompt</code></td><td></td><td>要使用的提示詞</td></tr><tr><td><code dir="auto">--model</code></td><td><code dir="auto">-m</code></td><td>要使用的模型，格式為 provider/model</td></tr><tr><td><code dir="auto">--agent</code></td><td></td><td>要使用的代理</td></tr><tr><td><code dir="auto">--port</code></td><td></td><td>監聽連接埠</td></tr><tr><td><code dir="auto">--hostname</code></td><td></td><td>監聽主機名稱</td></tr></tbody></table>\n<hr>\n<h2 id="指令"><a href="#指令">指令</a></h2>\n<p>SlopCode CLI 還提供以下指令。</p>\n<hr>\n<h3 id="agent"><a href="#agent">agent</a></h3>\n<p>管理 SlopCode 的代理。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">agent</span><span style="--0:#24292E;--1:#E1E4E8"> [command]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode agent [command]"><div></div></button></div></figure></div>\n<hr>\n<h3 id="attach"><a href="#attach">attach</a></h3>\n<p>將終端機連接到已透過 <code dir="auto">serve</code> 或 <code dir="auto">web</code> 指令啟動的 SlopCode 後端伺服器。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">attach</span><span style="--0:#24292E;--1:#E1E4E8"> [url]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode attach [url]"><div></div></button></div></figure></div>\n<p>這允許將 TUI 與遠端 SlopCode 後端搭配使用。例如：</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># Start the backend server for web/mobile access</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">web</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--port</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">4096</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--hostname</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">0.0.0.0</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># In another terminal, attach the TUI to the running backend</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">attach</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">http://10.20.30.40:4096</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode web --port 4096 --hostname 0.0.0.0slopcode attach http://10.20.30.40:4096"><div></div></button></div></figure></div>\n<h4 id="旗標-1"><a href="#旗標-1">旗標</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>旗標</th><th>簡寫</th><th>說明</th></tr></thead><tbody><tr><td><code dir="auto">--dir</code></td><td></td><td>啟動 TUI 的工作目錄</td></tr><tr><td><code dir="auto">--session</code></td><td><code dir="auto">-s</code></td><td>要繼續的工作階段 ID</td></tr></tbody></table>\n<hr>\n<h4 id="create"><a href="#create">create</a></h4>\n<p>使用自訂設定建立新的代理。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">agent</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">create</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode agent create"><div></div></button></div></figure></div>\n<p>此指令將引導您使用自訂系統提示詞和工具設定來建立新的代理。</p>\n<hr>\n<h4 id="list"><a href="#list">list</a></h4>\n<p>列出所有可用的代理。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">agent</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">list</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode agent list"><div></div></button></div></figure></div>\n<hr>\n<h3 id="auth"><a href="#auth">auth</a></h3>\n<p>管理供應商的憑證和登入資訊的指令。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">auth</span><span style="--0:#24292E;--1:#E1E4E8"> [command]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode auth [command]"><div></div></button></div></figure></div>\n<hr>\n<h4 id="login"><a href="#login">login</a></h4>\n<p>SlopCode 基於 <a href="https://models.dev">Models.dev</a> 的供應商列表運作，因此您可以使用 <code dir="auto">slopcode auth login</code> 為任何想要使用的供應商設定 API 金鑰。金鑰儲存在 <code dir="auto">~/.local/share/slopcode/auth.json</code> 中。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">auth</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">login</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode auth login"><div></div></button></div></figure></div>\n<p>SlopCode 啟動時會從憑證檔案載入供應商資訊，同時也會載入環境變數或專案中 <code dir="auto">.env</code> 檔案中定義的金鑰。</p>\n<hr>\n<h4 id="list-1"><a href="#list-1">list</a></h4>\n<p>列出憑證檔案中儲存的所有已認證供應商。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">auth</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">list</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode auth list"><div></div></button></div></figure></div>\n<p>或使用簡寫版本。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">auth</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">ls</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode auth ls"><div></div></button></div></figure></div>\n<hr>\n<h4 id="logout"><a href="#logout">logout</a></h4>\n<p>從憑證檔案中清除供應商資訊以完成登出。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">auth</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">logout</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode auth logout"><div></div></button></div></figure></div>\n<hr>\n<h3 id="github"><a href="#github">github</a></h3>\n<p>管理用於儲存庫自動化的 GitHub 代理。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">github</span><span style="--0:#24292E;--1:#E1E4E8"> [command]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode github [command]"><div></div></button></div></figure></div>\n<hr>\n<h4 id="install"><a href="#install">install</a></h4>\n<p>在您的儲存庫中安裝 GitHub 代理。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">github</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode github install"><div></div></button></div></figure></div>\n<p>此指令會設定必要的 GitHub Actions 工作流程並引導您完成設定過程。<a href="/docs/github">了解更多</a>。</p>\n<hr>\n<h4 id="run"><a href="#run">run</a></h4>\n<p>執行 GitHub 代理。通常在 GitHub Actions 中使用。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">github</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">run</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode github run"><div></div></button></div></figure></div>\n<h5 id="旗標-2"><a href="#旗標-2">旗標</a></h5>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>旗標</th><th>說明</th></tr></thead><tbody><tr><td><code dir="auto">--event</code></td><td>用於執行代理的 GitHub 模擬事件</td></tr><tr><td><code dir="auto">--token</code></td><td>GitHub 個人存取權杖</td></tr></tbody></table>\n<hr>\n<h3 id="mcp"><a href="#mcp">mcp</a></h3>\n<p>管理 Model Context Protocol 伺服器。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">mcp</span><span style="--0:#24292E;--1:#E1E4E8"> [command]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode mcp [command]"><div></div></button></div></figure></div>\n<hr>\n<h4 id="add"><a href="#add">add</a></h4>\n<p>將 MCP 伺服器新增到您的設定中。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">mcp</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">add</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode mcp add"><div></div></button></div></figure></div>\n<p>此指令將引導您新增本地或遠端 MCP 伺服器。</p>\n<hr>\n<h4 id="list-2"><a href="#list-2">list</a></h4>\n<p>列出所有已設定的 MCP 伺服器及其連線狀態。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">mcp</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">list</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode mcp list"><div></div></button></div></figure></div>\n<p>或使用簡寫版本。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">mcp</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">ls</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode mcp ls"><div></div></button></div></figure></div>\n<hr>\n<h4 id="auth-1"><a href="#auth-1">auth</a></h4>\n<p>對支援 OAuth 的 MCP 伺服器進行認證。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">mcp</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">auth</span><span style="--0:#24292E;--1:#E1E4E8"> [name]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode mcp auth [name]"><div></div></button></div></figure></div>\n<p>如果您不提供伺服器名稱，系統將提示您從可用的支援 OAuth 的伺服器中進行選擇。</p>\n<p>您還可以列出支援 OAuth 的伺服器及其認證狀態。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">mcp</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">auth</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">list</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode mcp auth list"><div></div></button></div></figure></div>\n<p>或使用簡寫版本。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">mcp</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">auth</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">ls</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode mcp auth ls"><div></div></button></div></figure></div>\n<hr>\n<h4 id="logout-1"><a href="#logout-1">logout</a></h4>\n<p>移除 MCP 伺服器的 OAuth 憑證。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">mcp</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">logout</span><span style="--0:#24292E;--1:#E1E4E8"> [name]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode mcp logout [name]"><div></div></button></div></figure></div>\n<hr>\n<h4 id="debug"><a href="#debug">debug</a></h4>\n<p>偵錯 MCP 伺服器的 OAuth 連線問題。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">mcp</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">debug</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">&#x3C;name></span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode mcp debug <name>"><div></div></button></div></figure></div>\n<hr>\n<h3 id="models"><a href="#models">models</a></h3>\n<p>列出已設定供應商的所有可用模型。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">models</span><span style="--0:#24292E;--1:#E1E4E8"> [provider]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode models [provider]"><div></div></button></div></figure></div>\n<p>此指令以 <code dir="auto">provider/model</code> 的格式顯示所有已設定供應商中可用的模型。</p>\n<p>這對於確定在<a href="/docs/config/">設定檔</a>中使用的確切模型名稱非常有用。</p>\n<p>您可以選擇傳入供應商 ID 來按供應商篩選模型。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">models</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">anthropic</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode models anthropic"><div></div></button></div></figure></div>\n<h4 id="旗標-3"><a href="#旗標-3">旗標</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>旗標</th><th>說明</th></tr></thead><tbody><tr><td><code dir="auto">--refresh</code></td><td>從 models.dev 重新整理模型快取</td></tr><tr><td><code dir="auto">--verbose</code></td><td>使用更詳細的模型輸出（包含費用等中繼資料）</td></tr></tbody></table>\n<p>使用 <code dir="auto">--refresh</code> 旗標可以更新快取的模型列表。當供應商新增了模型並且您希望在 SlopCode 中看到它們時，此功能非常有用。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">models</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--refresh</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode models --refresh"><div></div></button></div></figure></div>\n<hr>\n<h3 id="run-1"><a href="#run-1">run</a></h3>\n<p>以非互動模式執行 SlopCode，直接傳入提示詞。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">run</span><span style="--0:#24292E;--1:#E1E4E8"> [message..]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode run [message..]"><div></div></button></div></figure></div>\n<p>這對於指令碼編寫、自動化或無需啟動完整 TUI 即可快速取得答案的情境非常有用。例如：</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><mark><span style="--0:#5c37a0;--1:#c5acf4">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">run</span></mark><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">Explain</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">the</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">use</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">of</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">context</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">in</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">Go</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode run Explain the use of context in Go"><div></div></button></div></figure></div>\n<p>您還可以連接到正在執行的 <code dir="auto">slopcode serve</code> 實例，以避免每次執行時 MCP 伺服器的冷啟動時間：</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># Start a headless server in one terminal</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">serve</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># In another terminal, run commands that attach to it</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">run</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--attach</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">http://localhost:4096</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">"Explain async/await in JavaScript"</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode serveslopcode run --attach http://localhost:4096 &#x22;Explain async/await in JavaScript&#x22;"><div></div></button></div></figure></div>\n<h4 id="旗標-4"><a href="#旗標-4">旗標</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>旗標</th><th>簡寫</th><th>說明</th></tr></thead><tbody><tr><td><code dir="auto">--command</code></td><td></td><td>要執行的指令，使用 message 作為參數</td></tr><tr><td><code dir="auto">--continue</code></td><td><code dir="auto">-c</code></td><td>繼續上一個工作階段</td></tr><tr><td><code dir="auto">--session</code></td><td><code dir="auto">-s</code></td><td>要繼續的工作階段 ID</td></tr><tr><td><code dir="auto">--fork</code></td><td></td><td>繼續時分岔工作階段（與 <code dir="auto">--continue</code> 或 <code dir="auto">--session</code> 搭配使用）</td></tr><tr><td><code dir="auto">--share</code></td><td></td><td>分享工作階段</td></tr><tr><td><code dir="auto">--model</code></td><td><code dir="auto">-m</code></td><td>要使用的模型，格式為 provider/model</td></tr><tr><td><code dir="auto">--agent</code></td><td></td><td>要使用的代理</td></tr><tr><td><code dir="auto">--file</code></td><td><code dir="auto">-f</code></td><td>附加到訊息的檔案</td></tr><tr><td><code dir="auto">--format</code></td><td></td><td>格式：default（格式化輸出）或 json（原始 JSON 事件）</td></tr><tr><td><code dir="auto">--title</code></td><td></td><td>工作階段標題（未提供值時使用截斷的提示詞）</td></tr><tr><td><code dir="auto">--attach</code></td><td></td><td>連接到正在執行的 slopcode 伺服器（例如 <a href="http://localhost:4096%EF%BC%89">http://localhost:4096）</a></td></tr><tr><td><code dir="auto">--port</code></td><td></td><td>本地伺服器連接埠（預設為隨機連接埠）</td></tr></tbody></table>\n<hr>\n<h3 id="serve"><a href="#serve">serve</a></h3>\n<p>啟動無介面的 SlopCode 伺服器以提供 API 存取。查看<a href="/docs/server">伺服器文件</a>了解完整的 HTTP 介面。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">serve</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode serve"><div></div></button></div></figure></div>\n<p>此指令啟動一個 HTTP 伺服器，提供對 SlopCode 功能的 API 存取，無需 TUI 介面。設定 <code dir="auto">SLOPCODE_SERVER_PASSWORD</code> 可啟用 HTTP 基本認證（使用者名稱預設為 <code dir="auto">slopcode</code>）。</p>\n<h4 id="旗標-5"><a href="#旗標-5">旗標</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>旗標</th><th>說明</th></tr></thead><tbody><tr><td><code dir="auto">--port</code></td><td>監聽連接埠</td></tr><tr><td><code dir="auto">--hostname</code></td><td>監聽主機名稱</td></tr><tr><td><code dir="auto">--mdns</code></td><td>啟用 mDNS 探索</td></tr><tr><td><code dir="auto">--cors</code></td><td>允許 CORS 的額外瀏覽器來源</td></tr></tbody></table>\n<hr>\n<h3 id="session"><a href="#session">session</a></h3>\n<p>管理 SlopCode 工作階段。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">session</span><span style="--0:#24292E;--1:#E1E4E8"> [command]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode session [command]"><div></div></button></div></figure></div>\n<hr>\n<h4 id="list-3"><a href="#list-3">list</a></h4>\n<p>列出所有 SlopCode 工作階段。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">session</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">list</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode session list"><div></div></button></div></figure></div>\n<h5 id="旗標-6"><a href="#旗標-6">旗標</a></h5>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>旗標</th><th>簡寫</th><th>說明</th></tr></thead><tbody><tr><td><code dir="auto">--max-count</code></td><td><code dir="auto">-n</code></td><td>限制為最近 N 個工作階段</td></tr><tr><td><code dir="auto">--format</code></td><td></td><td>輸出格式：table 或 json（預設 table）</td></tr></tbody></table>\n<hr>\n<h3 id="stats"><a href="#stats">stats</a></h3>\n<p>顯示 SlopCode 工作階段的 Token 用量和費用統計資訊。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">stats</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode stats"><div></div></button></div></figure></div>\n<h4 id="旗標-7"><a href="#旗標-7">旗標</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>旗標</th><th>說明</th></tr></thead><tbody><tr><td><code dir="auto">--days</code></td><td>顯示最近 N 天的統計資訊（預設為所有時間）</td></tr><tr><td><code dir="auto">--tools</code></td><td>顯示的工具數量（預設為全部）</td></tr><tr><td><code dir="auto">--models</code></td><td>顯示模型用量明細（預設隱藏）。傳入數字可顯示前 N 個</td></tr><tr><td><code dir="auto">--project</code></td><td>按專案篩選（預設為所有專案，傳入空字串表示當前專案）</td></tr></tbody></table>\n<hr>\n<h3 id="export"><a href="#export">export</a></h3>\n<p>將工作階段資料匯出為 JSON。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">export</span><span style="--0:#24292E;--1:#E1E4E8"> [sessionID]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode export [sessionID]"><div></div></button></div></figure></div>\n<p>如果您不提供工作階段 ID，系統將提示您從可用的工作階段中進行選擇。</p>\n<hr>\n<h3 id="import"><a href="#import">import</a></h3>\n<p>從 JSON 檔案或 SlopCode 分享連結匯入工作階段資料。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">import</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">&#x3C;file></span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode import <file>"><div></div></button></div></figure></div>\n<p>您可以從本地檔案或 SlopCode 分享連結匯入。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">import</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">session.json</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">import</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">https://opncd.ai/s/abc123</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode import session.jsonslopcode import https://opncd.ai/s/abc123"><div></div></button></div></figure></div>\n<hr>\n<h3 id="web"><a href="#web">web</a></h3>\n<p>啟動帶有 Web 介面的無介面 SlopCode 伺服器。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">web</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode web"><div></div></button></div></figure></div>\n<p>此指令啟動一個 HTTP 伺服器並開啟瀏覽器，透過 Web 介面存取 SlopCode。設定 <code dir="auto">SLOPCODE_SERVER_PASSWORD</code> 可啟用 HTTP 基本認證（使用者名稱預設為 <code dir="auto">slopcode</code>）。</p>\n<h4 id="旗標-8"><a href="#旗標-8">旗標</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>旗標</th><th>說明</th></tr></thead><tbody><tr><td><code dir="auto">--port</code></td><td>監聽連接埠</td></tr><tr><td><code dir="auto">--hostname</code></td><td>監聽主機名稱</td></tr><tr><td><code dir="auto">--mdns</code></td><td>啟用 mDNS 探索</td></tr><tr><td><code dir="auto">--cors</code></td><td>允許 CORS 的額外瀏覽器來源</td></tr></tbody></table>\n<hr>\n<h3 id="acp"><a href="#acp">acp</a></h3>\n<p>啟動 ACP（Agent Client Protocol）伺服器。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">acp</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode acp"><div></div></button></div></figure></div>\n<p>此指令啟動一個透過 stdin/stdout 使用 nd-JSON 進行通訊的 ACP 伺服器。</p>\n<h4 id="旗標-9"><a href="#旗標-9">旗標</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>旗標</th><th>說明</th></tr></thead><tbody><tr><td><code dir="auto">--cwd</code></td><td>工作目錄</td></tr><tr><td><code dir="auto">--port</code></td><td>監聽連接埠</td></tr><tr><td><code dir="auto">--hostname</code></td><td>監聽主機名稱</td></tr></tbody></table>\n<hr>\n<h3 id="uninstall"><a href="#uninstall">uninstall</a></h3>\n<p>解除安裝 SlopCode 並刪除所有相關檔案。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">uninstall</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode uninstall"><div></div></button></div></figure></div>\n<h4 id="旗標-10"><a href="#旗標-10">旗標</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>旗標</th><th>簡寫</th><th>說明</th></tr></thead><tbody><tr><td><code dir="auto">--keep-config</code></td><td><code dir="auto">-c</code></td><td>保留設定檔</td></tr><tr><td><code dir="auto">--keep-data</code></td><td><code dir="auto">-d</code></td><td>保留工作階段資料和快照</td></tr><tr><td><code dir="auto">--dry-run</code></td><td></td><td>顯示將被刪除的內容但不實際刪除</td></tr><tr><td><code dir="auto">--force</code></td><td><code dir="auto">-f</code></td><td>跳過確認提示</td></tr></tbody></table>\n<hr>\n<h3 id="upgrade"><a href="#upgrade">upgrade</a></h3>\n<p>將 SlopCode 更新到最新版本或指定版本。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">upgrade</span><span style="--0:#24292E;--1:#E1E4E8"> [target]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode upgrade [target]"><div></div></button></div></figure></div>\n<p>更新到最新版本。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">upgrade</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode upgrade"><div></div></button></div></figure></div>\n<p>更新到指定版本。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">upgrade</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">v0.1.48</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode upgrade v0.1.48"><div></div></button></div></figure></div>\n<h4 id="旗標-11"><a href="#旗標-11">旗標</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>旗標</th><th>簡寫</th><th>說明</th></tr></thead><tbody><tr><td><code dir="auto">--method</code></td><td><code dir="auto">-m</code></td><td>使用的安裝方式：curl、npm、pnpm、bun、brew</td></tr></tbody></table>\n<hr>\n<h2 id="全域旗標"><a href="#全域旗標">全域旗標</a></h2>\n<p>SlopCode CLI 接受以下全域旗標。</p>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>旗標</th><th>簡寫</th><th>說明</th></tr></thead><tbody><tr><td><code dir="auto">--help</code></td><td><code dir="auto">-h</code></td><td>顯示說明資訊</td></tr><tr><td><code dir="auto">--version</code></td><td><code dir="auto">-v</code></td><td>印出版本號</td></tr><tr><td><code dir="auto">--print-logs</code></td><td></td><td>將日誌輸出到 stderr</td></tr><tr><td><code dir="auto">--log-level</code></td><td></td><td>日誌等級（DEBUG、INFO、WARN、ERROR）</td></tr></tbody></table>\n<hr>\n<h2 id="環境變數"><a href="#環境變數">環境變數</a></h2>\n<p>SlopCode 可以透過環境變數進行設定。</p>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>變數</th><th>類型</th><th>說明</th></tr></thead><tbody><tr><td><code dir="auto">SLOPCODE_AUTO_SHARE</code></td><td>boolean</td><td>自動分享工作階段</td></tr><tr><td><code dir="auto">SLOPCODE_GIT_BASH_PATH</code></td><td>string</td><td>Windows 上 Git Bash 可執行檔的路徑</td></tr><tr><td><code dir="auto">SLOPCODE_CONFIG</code></td><td>string</td><td>設定檔路徑</td></tr><tr><td><code dir="auto">SLOPCODE_CONFIG_DIR</code></td><td>string</td><td>設定目錄路徑</td></tr><tr><td><code dir="auto">SLOPCODE_CONFIG_CONTENT</code></td><td>string</td><td>內嵌 JSON 設定內容</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_AUTOUPDATE</code></td><td>boolean</td><td>停用自動更新檢查</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_PRUNE</code></td><td>boolean</td><td>停用舊資料清理</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_TERMINAL_TITLE</code></td><td>boolean</td><td>停用自動終端機標題更新</td></tr><tr><td><code dir="auto">SLOPCODE_PERMISSION</code></td><td>string</td><td>內嵌 JSON 權限設定</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_DEFAULT_PLUGINS</code></td><td>boolean</td><td>停用預設外掛程式</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_LSP_DOWNLOAD</code></td><td>boolean</td><td>停用 LSP 伺服器自動下載</td></tr><tr><td><code dir="auto">SLOPCODE_ENABLE_EXPERIMENTAL_MODELS</code></td><td>boolean</td><td>啟用實驗性模型</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_AUTOCOMPACT</code></td><td>boolean</td><td>停用自動上下文壓縮</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_CLAUDE_CODE</code></td><td>boolean</td><td>停用讀取 <code dir="auto">.claude</code>（提示詞 + 技能）</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_CLAUDE_CODE_PROMPT</code></td><td>boolean</td><td>停用讀取 <code dir="auto">~/.claude/CLAUDE.md</code></td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_CLAUDE_CODE_SKILLS</code></td><td>boolean</td><td>停用載入 <code dir="auto">.claude/skills</code></td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_MODELS_FETCH</code></td><td>boolean</td><td>停用從遠端來源擷取模型</td></tr><tr><td><code dir="auto">SLOPCODE_FAKE_VCS</code></td><td>string</td><td>用於測試目的的模擬 VCS 供應商</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_FILETIME_CHECK</code></td><td>boolean</td><td>停用檔案時間檢查最佳化</td></tr><tr><td><code dir="auto">SLOPCODE_CLIENT</code></td><td>string</td><td>用戶端識別碼（預設為 <code dir="auto">cli</code>）</td></tr><tr><td><code dir="auto">SLOPCODE_ENABLE_EXA</code></td><td>boolean</td><td>啟用 Exa 網路搜尋工具</td></tr><tr><td><code dir="auto">SLOPCODE_SERVER_PASSWORD</code></td><td>string</td><td>為 <code dir="auto">serve</code>/<code dir="auto">web</code> 啟用基本認證</td></tr><tr><td><code dir="auto">SLOPCODE_SERVER_USERNAME</code></td><td>string</td><td>覆寫基本認證使用者名稱（預設為 <code dir="auto">slopcode</code>）</td></tr><tr><td><code dir="auto">SLOPCODE_MODELS_URL</code></td><td>string</td><td>自訂模型設定擷取 URL</td></tr></tbody></table>\n<hr>\n<h3 id="實驗性功能"><a href="#實驗性功能">實驗性功能</a></h3>\n<p>這些環境變數用於啟用可能會變更或移除的實驗性功能。</p>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>變數</th><th>類型</th><th>說明</th></tr></thead><tbody><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL</code></td><td>boolean</td><td>啟用所有實驗性功能</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_ICON_DISCOVERY</code></td><td>boolean</td><td>啟用圖示探索</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT</code></td><td>boolean</td><td>停用 TUI 中的選取即複製</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS</code></td><td>number</td><td>bash 指令的預設逾時時間（毫秒）</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX</code></td><td>number</td><td>LLM 回應的最大輸出 Token 數</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_FILEWATCHER</code></td><td>boolean</td><td>啟用整個目錄的檔案監看器</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_OXFMT</code></td><td>boolean</td><td>啟用 oxfmt 格式化器</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_LSP_TOOL</code></td><td>boolean</td><td>啟用實驗性 LSP 工具</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_DISABLE_FILEWATCHER</code></td><td>boolean</td><td>停用檔案監看器</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_EXA</code></td><td>boolean</td><td>啟用實驗性 Exa 功能</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_LSP_TY</code></td><td>boolean</td><td>啟用實驗性 LSP 類型檢查</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_MARKDOWN</code></td><td>boolean</td><td>啟用實驗性 Markdown 功能</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_PLAN_MODE</code></td><td>boolean</td><td>啟用計畫模式</td></tr></tbody></table>',
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
const url = "src/content/docs/zh-tw/cli.mdx"
const file = "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/cli.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-tw/cli.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
