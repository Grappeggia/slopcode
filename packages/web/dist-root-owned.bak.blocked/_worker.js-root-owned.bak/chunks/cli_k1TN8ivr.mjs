globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"
import "./Code_sjN3308E.mjs"

const frontmatter = {
  title: "CLI",
  description: "SlopCode CLI 选项和命令。",
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
      slug: "标志",
      text: "标志",
    },
    {
      depth: 2,
      slug: "命令",
      text: "命令",
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
      slug: "标志-1",
      text: "标志",
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
      slug: "标志-2",
      text: "标志",
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
      slug: "标志-3",
      text: "标志",
    },
    {
      depth: 3,
      slug: "run-1",
      text: "run",
    },
    {
      depth: 4,
      slug: "标志-4",
      text: "标志",
    },
    {
      depth: 3,
      slug: "serve",
      text: "serve",
    },
    {
      depth: 4,
      slug: "标志-5",
      text: "标志",
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
      slug: "标志-6",
      text: "标志",
    },
    {
      depth: 3,
      slug: "stats",
      text: "stats",
    },
    {
      depth: 4,
      slug: "标志-7",
      text: "标志",
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
      slug: "标志-8",
      text: "标志",
    },
    {
      depth: 3,
      slug: "acp",
      text: "acp",
    },
    {
      depth: 4,
      slug: "标志-9",
      text: "标志",
    },
    {
      depth: 3,
      slug: "uninstall",
      text: "uninstall",
    },
    {
      depth: 4,
      slug: "标志-10",
      text: "标志",
    },
    {
      depth: 3,
      slug: "upgrade",
      text: "upgrade",
    },
    {
      depth: 4,
      slug: "标志-11",
      text: "标志",
    },
    {
      depth: 2,
      slug: "全局标志",
      text: "全局标志",
    },
    {
      depth: 2,
      slug: "环境变量",
      text: "环境变量",
    },
    {
      depth: 3,
      slug: "实验性功能",
      text: "实验性功能",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>SlopCode CLI 在不带任何参数运行时，默认启动 <a href="/docs/tui">TUI</a>。</p>\n<div class="expressive-code"><link rel="stylesheet" href="/docs/_astro/ec.4c0k7.css"><script type="module" src="/docs/_astro/ec.0vx5m.js"></script><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode"><div></div></button></div></figure></div>\n<p>但它也接受本页面中记录的命令，使您可以通过编程方式与 SlopCode 进行交互。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">run</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">"Explain how closures work in JavaScript"</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode run &#x22;Explain how closures work in JavaScript&#x22;"><div></div></button></div></figure></div>\n<hr>\n<h3 id="tui"><a href="#tui">tui</a></h3>\n<p>启动 SlopCode 终端用户界面。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> [project]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode [project]"><div></div></button></div></figure></div>\n<h4 id="标志"><a href="#标志">标志</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>标志</th><th>简写</th><th>描述</th></tr></thead><tbody><tr><td><code dir="auto">--continue</code></td><td><code dir="auto">-c</code></td><td>继续上一个会话</td></tr><tr><td><code dir="auto">--session</code></td><td><code dir="auto">-s</code></td><td>要继续的会话 ID</td></tr><tr><td><code dir="auto">--fork</code></td><td></td><td>继续时分叉会话（与 <code dir="auto">--continue</code> 或 <code dir="auto">--session</code> 配合使用）</td></tr><tr><td><code dir="auto">--prompt</code></td><td></td><td>要使用的提示词</td></tr><tr><td><code dir="auto">--model</code></td><td><code dir="auto">-m</code></td><td>要使用的模型，格式为 provider/model</td></tr><tr><td><code dir="auto">--agent</code></td><td></td><td>要使用的代理</td></tr><tr><td><code dir="auto">--port</code></td><td></td><td>监听端口</td></tr><tr><td><code dir="auto">--hostname</code></td><td></td><td>监听主机名</td></tr></tbody></table>\n<hr>\n<h2 id="命令"><a href="#命令">命令</a></h2>\n<p>SlopCode CLI 还提供以下命令。</p>\n<hr>\n<h3 id="agent"><a href="#agent">agent</a></h3>\n<p>管理 SlopCode 的代理。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">agent</span><span style="--0:#24292E;--1:#E1E4E8"> [command]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode agent [command]"><div></div></button></div></figure></div>\n<hr>\n<h3 id="attach"><a href="#attach">attach</a></h3>\n<p>将终端连接到已通过 <code dir="auto">serve</code> 或 <code dir="auto">web</code> 命令启动的 SlopCode 后端服务器。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">attach</span><span style="--0:#24292E;--1:#E1E4E8"> [url]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode attach [url]"><div></div></button></div></figure></div>\n<p>这允许将 TUI 与远程 SlopCode 后端配合使用。例如：</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># Start the backend server for web/mobile access</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">web</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--port</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">4096</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--hostname</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">0.0.0.0</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># In another terminal, attach the TUI to the running backend</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">attach</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">http://10.20.30.40:4096</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode web --port 4096 --hostname 0.0.0.0slopcode attach http://10.20.30.40:4096"><div></div></button></div></figure></div>\n<h4 id="标志-1"><a href="#标志-1">标志</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>标志</th><th>简写</th><th>描述</th></tr></thead><tbody><tr><td><code dir="auto">--dir</code></td><td></td><td>启动 TUI 的工作目录</td></tr><tr><td><code dir="auto">--session</code></td><td><code dir="auto">-s</code></td><td>要继续的会话 ID</td></tr></tbody></table>\n<hr>\n<h4 id="create"><a href="#create">create</a></h4>\n<p>使用自定义配置创建新的代理。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">agent</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">create</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode agent create"><div></div></button></div></figure></div>\n<p>此命令将引导您使用自定义系统提示词和工具配置来创建新的代理。</p>\n<hr>\n<h4 id="list"><a href="#list">list</a></h4>\n<p>列出所有可用的代理。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">agent</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">list</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode agent list"><div></div></button></div></figure></div>\n<hr>\n<h3 id="auth"><a href="#auth">auth</a></h3>\n<p>管理提供商的凭据和登录信息的命令。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">auth</span><span style="--0:#24292E;--1:#E1E4E8"> [command]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode auth [command]"><div></div></button></div></figure></div>\n<hr>\n<h4 id="login"><a href="#login">login</a></h4>\n<p>SlopCode 基于 <a href="https://models.dev">Models.dev</a> 的提供商列表运行，因此您可以使用 <code dir="auto">slopcode auth login</code> 为任何想要使用的提供商配置 API 密钥。密钥存储在 <code dir="auto">~/.local/share/slopcode/auth.json</code> 中。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">auth</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">login</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode auth login"><div></div></button></div></figure></div>\n<p>SlopCode 启动时会从凭据文件加载提供商信息，同时也会加载环境变量或项目中 <code dir="auto">.env</code> 文件中定义的密钥。</p>\n<hr>\n<h4 id="list-1"><a href="#list-1">list</a></h4>\n<p>列出凭据文件中存储的所有已认证提供商。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">auth</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">list</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode auth list"><div></div></button></div></figure></div>\n<p>或使用简写版本。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">auth</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">ls</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode auth ls"><div></div></button></div></figure></div>\n<hr>\n<h4 id="logout"><a href="#logout">logout</a></h4>\n<p>从凭据文件中清除提供商信息以完成登出。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">auth</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">logout</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode auth logout"><div></div></button></div></figure></div>\n<hr>\n<h3 id="github"><a href="#github">github</a></h3>\n<p>管理用于仓库自动化的 GitHub 代理。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">github</span><span style="--0:#24292E;--1:#E1E4E8"> [command]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode github [command]"><div></div></button></div></figure></div>\n<hr>\n<h4 id="install"><a href="#install">install</a></h4>\n<p>在您的仓库中安装 GitHub 代理。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">github</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode github install"><div></div></button></div></figure></div>\n<p>此命令会设置必要的 GitHub Actions 工作流并引导您完成配置过程。<a href="/docs/github">了解更多</a>。</p>\n<hr>\n<h4 id="run"><a href="#run">run</a></h4>\n<p>运行 GitHub 代理。通常在 GitHub Actions 中使用。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">github</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">run</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode github run"><div></div></button></div></figure></div>\n<h5 id="标志-2"><a href="#标志-2">标志</a></h5>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>标志</th><th>描述</th></tr></thead><tbody><tr><td><code dir="auto">--event</code></td><td>用于运行代理的 GitHub 模拟事件</td></tr><tr><td><code dir="auto">--token</code></td><td>GitHub 个人访问令牌</td></tr></tbody></table>\n<hr>\n<h3 id="mcp"><a href="#mcp">mcp</a></h3>\n<p>管理 Model Context Protocol 服务器。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">mcp</span><span style="--0:#24292E;--1:#E1E4E8"> [command]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode mcp [command]"><div></div></button></div></figure></div>\n<hr>\n<h4 id="add"><a href="#add">add</a></h4>\n<p>将 MCP 服务器添加到您的配置中。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">mcp</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">add</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode mcp add"><div></div></button></div></figure></div>\n<p>此命令将引导您添加本地或远程 MCP 服务器。</p>\n<hr>\n<h4 id="list-2"><a href="#list-2">list</a></h4>\n<p>列出所有已配置的 MCP 服务器及其连接状态。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">mcp</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">list</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode mcp list"><div></div></button></div></figure></div>\n<p>或使用简写版本。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">mcp</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">ls</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode mcp ls"><div></div></button></div></figure></div>\n<hr>\n<h4 id="auth-1"><a href="#auth-1">auth</a></h4>\n<p>对支持 OAuth 的 MCP 服务器进行认证。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">mcp</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">auth</span><span style="--0:#24292E;--1:#E1E4E8"> [name]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode mcp auth [name]"><div></div></button></div></figure></div>\n<p>如果您不提供服务器名称，系统将提示您从可用的支持 OAuth 的服务器中进行选择。</p>\n<p>您还可以列出支持 OAuth 的服务器及其认证状态。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">mcp</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">auth</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">list</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode mcp auth list"><div></div></button></div></figure></div>\n<p>或使用简写版本。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">mcp</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">auth</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">ls</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode mcp auth ls"><div></div></button></div></figure></div>\n<hr>\n<h4 id="logout-1"><a href="#logout-1">logout</a></h4>\n<p>移除 MCP 服务器的 OAuth 凭据。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">mcp</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">logout</span><span style="--0:#24292E;--1:#E1E4E8"> [name]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode mcp logout [name]"><div></div></button></div></figure></div>\n<hr>\n<h4 id="debug"><a href="#debug">debug</a></h4>\n<p>调试 MCP 服务器的 OAuth 连接问题。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">mcp</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">debug</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">&#x3C;name></span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode mcp debug <name>"><div></div></button></div></figure></div>\n<hr>\n<h3 id="models"><a href="#models">models</a></h3>\n<p>列出已配置提供商的所有可用模型。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">models</span><span style="--0:#24292E;--1:#E1E4E8"> [provider]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode models [provider]"><div></div></button></div></figure></div>\n<p>此命令以 <code dir="auto">provider/model</code> 的格式显示所有已配置提供商中可用的模型。</p>\n<p>这对于确定在<a href="/docs/config/">配置文件</a>中使用的确切模型名称非常有用。</p>\n<p>您可以选择传入提供商 ID 来按提供商筛选模型。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">models</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">anthropic</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode models anthropic"><div></div></button></div></figure></div>\n<h4 id="标志-3"><a href="#标志-3">标志</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>标志</th><th>描述</th></tr></thead><tbody><tr><td><code dir="auto">--refresh</code></td><td>从 models.dev 刷新模型缓存</td></tr><tr><td><code dir="auto">--verbose</code></td><td>使用更详细的模型输出（包含费用等元数据）</td></tr></tbody></table>\n<p>使用 <code dir="auto">--refresh</code> 标志可以更新缓存的模型列表。当提供商新增了模型并且您希望在 SlopCode 中看到它们时，此功能非常有用。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">models</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--refresh</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode models --refresh"><div></div></button></div></figure></div>\n<hr>\n<h3 id="run-1"><a href="#run-1">run</a></h3>\n<p>以非交互模式运行 SlopCode，直接传入提示词。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">run</span><span style="--0:#24292E;--1:#E1E4E8"> [message..]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode run [message..]"><div></div></button></div></figure></div>\n<p>这对于脚本编写、自动化或无需启动完整 TUI 即可快速获取答案的场景非常有用。例如：</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><mark><span style="--0:#5c37a0;--1:#c5acf4">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">run</span></mark><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">Explain</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">the</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">use</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">of</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">context</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">in</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">Go</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode run Explain the use of context in Go"><div></div></button></div></figure></div>\n<p>您还可以连接到正在运行的 <code dir="auto">slopcode serve</code> 实例，以避免每次运行时 MCP 服务器的冷启动时间：</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># Start a headless server in one terminal</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">serve</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># In another terminal, run commands that attach to it</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">run</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--attach</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">http://localhost:4096</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">"Explain async/await in JavaScript"</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode serveslopcode run --attach http://localhost:4096 &#x22;Explain async/await in JavaScript&#x22;"><div></div></button></div></figure></div>\n<h4 id="标志-4"><a href="#标志-4">标志</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>标志</th><th>简写</th><th>描述</th></tr></thead><tbody><tr><td><code dir="auto">--command</code></td><td></td><td>要运行的命令，使用 message 作为参数</td></tr><tr><td><code dir="auto">--continue</code></td><td><code dir="auto">-c</code></td><td>继续上一个会话</td></tr><tr><td><code dir="auto">--session</code></td><td><code dir="auto">-s</code></td><td>要继续的会话 ID</td></tr><tr><td><code dir="auto">--fork</code></td><td></td><td>继续时分叉会话（与 <code dir="auto">--continue</code> 或 <code dir="auto">--session</code> 配合使用）</td></tr><tr><td><code dir="auto">--share</code></td><td></td><td>分享会话</td></tr><tr><td><code dir="auto">--model</code></td><td><code dir="auto">-m</code></td><td>要使用的模型，格式为 provider/model</td></tr><tr><td><code dir="auto">--agent</code></td><td></td><td>要使用的代理</td></tr><tr><td><code dir="auto">--file</code></td><td><code dir="auto">-f</code></td><td>附加到消息的文件</td></tr><tr><td><code dir="auto">--format</code></td><td></td><td>格式：default（格式化输出）或 json（原始 JSON 事件）</td></tr><tr><td><code dir="auto">--title</code></td><td></td><td>会话标题（未提供值时使用截断的提示词）</td></tr><tr><td><code dir="auto">--attach</code></td><td></td><td>连接到正在运行的 slopcode 服务器（例如 <a href="http://localhost:4096%EF%BC%89">http://localhost:4096）</a></td></tr><tr><td><code dir="auto">--port</code></td><td></td><td>本地服务器端口（默认为随机端口）</td></tr></tbody></table>\n<hr>\n<h3 id="serve"><a href="#serve">serve</a></h3>\n<p>启动无界面的 SlopCode 服务器以提供 API 访问。查看<a href="/docs/server">服务器文档</a>了解完整的 HTTP 接口。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">serve</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode serve"><div></div></button></div></figure></div>\n<p>此命令启动一个 HTTP 服务器，提供对 SlopCode 功能的 API 访问，无需 TUI 界面。设置 <code dir="auto">SLOPCODE_SERVER_PASSWORD</code> 可启用 HTTP 基本认证（用户名默认为 <code dir="auto">slopcode</code>）。</p>\n<h4 id="标志-5"><a href="#标志-5">标志</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>标志</th><th>描述</th></tr></thead><tbody><tr><td><code dir="auto">--port</code></td><td>监听端口</td></tr><tr><td><code dir="auto">--hostname</code></td><td>监听主机名</td></tr><tr><td><code dir="auto">--mdns</code></td><td>启用 mDNS 发现</td></tr><tr><td><code dir="auto">--cors</code></td><td>允许 CORS 的额外浏览器来源</td></tr></tbody></table>\n<hr>\n<h3 id="session"><a href="#session">session</a></h3>\n<p>管理 SlopCode 会话。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">session</span><span style="--0:#24292E;--1:#E1E4E8"> [command]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode session [command]"><div></div></button></div></figure></div>\n<hr>\n<h4 id="list-3"><a href="#list-3">list</a></h4>\n<p>列出所有 SlopCode 会话。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">session</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">list</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode session list"><div></div></button></div></figure></div>\n<h5 id="标志-6"><a href="#标志-6">标志</a></h5>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>标志</th><th>简写</th><th>描述</th></tr></thead><tbody><tr><td><code dir="auto">--max-count</code></td><td><code dir="auto">-n</code></td><td>限制为最近 N 个会话</td></tr><tr><td><code dir="auto">--format</code></td><td></td><td>输出格式：table 或 json（默认 table）</td></tr></tbody></table>\n<hr>\n<h3 id="stats"><a href="#stats">stats</a></h3>\n<p>显示 SlopCode 会话的 Token 用量和费用统计信息。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">stats</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode stats"><div></div></button></div></figure></div>\n<h4 id="标志-7"><a href="#标志-7">标志</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>标志</th><th>描述</th></tr></thead><tbody><tr><td><code dir="auto">--days</code></td><td>显示最近 N 天的统计信息（默认为所有时间）</td></tr><tr><td><code dir="auto">--tools</code></td><td>显示的工具数量（默认为全部）</td></tr><tr><td><code dir="auto">--models</code></td><td>显示模型用量明细（默认隐藏）。传入数字可显示前 N 个</td></tr><tr><td><code dir="auto">--project</code></td><td>按项目筛选（默认为所有项目，传入空字符串表示当前项目）</td></tr></tbody></table>\n<hr>\n<h3 id="export"><a href="#export">export</a></h3>\n<p>将会话数据导出为 JSON。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">export</span><span style="--0:#24292E;--1:#E1E4E8"> [sessionID]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode export [sessionID]"><div></div></button></div></figure></div>\n<p>如果您不提供会话 ID，系统将提示您从可用的会话中进行选择。</p>\n<hr>\n<h3 id="import"><a href="#import">import</a></h3>\n<p>从 JSON 文件或 SlopCode 分享链接导入会话数据。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">import</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">&#x3C;file></span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode import <file>"><div></div></button></div></figure></div>\n<p>您可以从本地文件或 SlopCode 分享链接导入。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">import</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">session.json</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">import</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">https://opncd.ai/s/abc123</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode import session.jsonslopcode import https://opncd.ai/s/abc123"><div></div></button></div></figure></div>\n<hr>\n<h3 id="web"><a href="#web">web</a></h3>\n<p>启动带有 Web 界面的无界面 SlopCode 服务器。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">web</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode web"><div></div></button></div></figure></div>\n<p>此命令启动一个 HTTP 服务器并打开浏览器，通过 Web 界面访问 SlopCode。设置 <code dir="auto">SLOPCODE_SERVER_PASSWORD</code> 可启用 HTTP 基本认证（用户名默认为 <code dir="auto">slopcode</code>）。</p>\n<h4 id="标志-8"><a href="#标志-8">标志</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>标志</th><th>描述</th></tr></thead><tbody><tr><td><code dir="auto">--port</code></td><td>监听端口</td></tr><tr><td><code dir="auto">--hostname</code></td><td>监听主机名</td></tr><tr><td><code dir="auto">--mdns</code></td><td>启用 mDNS 发现</td></tr><tr><td><code dir="auto">--cors</code></td><td>允许 CORS 的额外浏览器来源</td></tr></tbody></table>\n<hr>\n<h3 id="acp"><a href="#acp">acp</a></h3>\n<p>启动 ACP（Agent Client Protocol）服务器。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">acp</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode acp"><div></div></button></div></figure></div>\n<p>此命令启动一个通过 stdin/stdout 使用 nd-JSON 进行通信的 ACP 服务器。</p>\n<h4 id="标志-9"><a href="#标志-9">标志</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>标志</th><th>描述</th></tr></thead><tbody><tr><td><code dir="auto">--cwd</code></td><td>工作目录</td></tr><tr><td><code dir="auto">--port</code></td><td>监听端口</td></tr><tr><td><code dir="auto">--hostname</code></td><td>监听主机名</td></tr></tbody></table>\n<hr>\n<h3 id="uninstall"><a href="#uninstall">uninstall</a></h3>\n<p>卸载 SlopCode 并删除所有相关文件。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">uninstall</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode uninstall"><div></div></button></div></figure></div>\n<h4 id="标志-10"><a href="#标志-10">标志</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>标志</th><th>简写</th><th>描述</th></tr></thead><tbody><tr><td><code dir="auto">--keep-config</code></td><td><code dir="auto">-c</code></td><td>保留配置文件</td></tr><tr><td><code dir="auto">--keep-data</code></td><td><code dir="auto">-d</code></td><td>保留会话数据和快照</td></tr><tr><td><code dir="auto">--dry-run</code></td><td></td><td>显示将被删除的内容但不实际删除</td></tr><tr><td><code dir="auto">--force</code></td><td><code dir="auto">-f</code></td><td>跳过确认提示</td></tr></tbody></table>\n<hr>\n<h3 id="upgrade"><a href="#upgrade">upgrade</a></h3>\n<p>将 SlopCode 更新到最新版本或指定版本。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">upgrade</span><span style="--0:#24292E;--1:#E1E4E8"> [target]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode upgrade [target]"><div></div></button></div></figure></div>\n<p>更新到最新版本。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">upgrade</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode upgrade"><div></div></button></div></figure></div>\n<p>更新到指定版本。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">upgrade</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">v0.1.48</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode upgrade v0.1.48"><div></div></button></div></figure></div>\n<h4 id="标志-11"><a href="#标志-11">标志</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>标志</th><th>简写</th><th>描述</th></tr></thead><tbody><tr><td><code dir="auto">--method</code></td><td><code dir="auto">-m</code></td><td>使用的安装方式：curl、npm、pnpm、bun、brew</td></tr></tbody></table>\n<hr>\n<h2 id="全局标志"><a href="#全局标志">全局标志</a></h2>\n<p>SlopCode CLI 接受以下全局标志。</p>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>标志</th><th>简写</th><th>描述</th></tr></thead><tbody><tr><td><code dir="auto">--help</code></td><td><code dir="auto">-h</code></td><td>显示帮助信息</td></tr><tr><td><code dir="auto">--version</code></td><td><code dir="auto">-v</code></td><td>打印版本号</td></tr><tr><td><code dir="auto">--print-logs</code></td><td></td><td>将日志输出到 stderr</td></tr><tr><td><code dir="auto">--log-level</code></td><td></td><td>日志级别（DEBUG、INFO、WARN、ERROR）</td></tr></tbody></table>\n<hr>\n<h2 id="环境变量"><a href="#环境变量">环境变量</a></h2>\n<p>SlopCode 可以通过环境变量进行配置。</p>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>变量</th><th>类型</th><th>描述</th></tr></thead><tbody><tr><td><code dir="auto">SLOPCODE_AUTO_SHARE</code></td><td>boolean</td><td>自动分享会话</td></tr><tr><td><code dir="auto">SLOPCODE_GIT_BASH_PATH</code></td><td>string</td><td>Windows 上 Git Bash 可执行文件的路径</td></tr><tr><td><code dir="auto">SLOPCODE_CONFIG</code></td><td>string</td><td>配置文件路径</td></tr><tr><td><code dir="auto">SLOPCODE_CONFIG_DIR</code></td><td>string</td><td>配置目录路径</td></tr><tr><td><code dir="auto">SLOPCODE_CONFIG_CONTENT</code></td><td>string</td><td>内联 JSON 配置内容</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_AUTOUPDATE</code></td><td>boolean</td><td>禁用自动更新检查</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_PRUNE</code></td><td>boolean</td><td>禁用旧数据清理</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_TERMINAL_TITLE</code></td><td>boolean</td><td>禁用自动终端标题更新</td></tr><tr><td><code dir="auto">SLOPCODE_PERMISSION</code></td><td>string</td><td>内联 JSON 权限配置</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_DEFAULT_PLUGINS</code></td><td>boolean</td><td>禁用默认插件</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_LSP_DOWNLOAD</code></td><td>boolean</td><td>禁用 LSP 服务器自动下载</td></tr><tr><td><code dir="auto">SLOPCODE_ENABLE_EXPERIMENTAL_MODELS</code></td><td>boolean</td><td>启用实验性模型</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_AUTOCOMPACT</code></td><td>boolean</td><td>禁用自动上下文压缩</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_CLAUDE_CODE</code></td><td>boolean</td><td>禁用读取 <code dir="auto">.claude</code>（提示词 + 技能）</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_CLAUDE_CODE_PROMPT</code></td><td>boolean</td><td>禁用读取 <code dir="auto">~/.claude/CLAUDE.md</code></td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_CLAUDE_CODE_SKILLS</code></td><td>boolean</td><td>禁用加载 <code dir="auto">.claude/skills</code></td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_MODELS_FETCH</code></td><td>boolean</td><td>禁用从远程源获取模型</td></tr><tr><td><code dir="auto">SLOPCODE_FAKE_VCS</code></td><td>string</td><td>用于测试目的的模拟 VCS 提供商</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_FILETIME_CHECK</code></td><td>boolean</td><td>禁用文件时间检查优化</td></tr><tr><td><code dir="auto">SLOPCODE_CLIENT</code></td><td>string</td><td>客户端标识符（默认为 <code dir="auto">cli</code>）</td></tr><tr><td><code dir="auto">SLOPCODE_ENABLE_EXA</code></td><td>boolean</td><td>启用 Exa 网络搜索工具</td></tr><tr><td><code dir="auto">SLOPCODE_SERVER_PASSWORD</code></td><td>string</td><td>为 <code dir="auto">serve</code>/<code dir="auto">web</code> 启用基本认证</td></tr><tr><td><code dir="auto">SLOPCODE_SERVER_USERNAME</code></td><td>string</td><td>覆盖基本认证用户名（默认为 <code dir="auto">slopcode</code>）</td></tr><tr><td><code dir="auto">SLOPCODE_MODELS_URL</code></td><td>string</td><td>自定义模型配置获取 URL</td></tr></tbody></table>\n<hr>\n<h3 id="实验性功能"><a href="#实验性功能">实验性功能</a></h3>\n<p>这些环境变量用于启用可能会更改或移除的实验性功能。</p>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>变量</th><th>类型</th><th>描述</th></tr></thead><tbody><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL</code></td><td>boolean</td><td>启用所有实验性功能</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_ICON_DISCOVERY</code></td><td>boolean</td><td>启用图标发现</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT</code></td><td>boolean</td><td>禁用 TUI 中的选中即复制</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS</code></td><td>number</td><td>bash 命令的默认超时时间（毫秒）</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX</code></td><td>number</td><td>LLM 响应的最大输出 Token 数</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_FILEWATCHER</code></td><td>boolean</td><td>启用整个目录的文件监听器</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_OXFMT</code></td><td>boolean</td><td>启用 oxfmt 格式化器</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_LSP_TOOL</code></td><td>boolean</td><td>启用实验性 LSP 工具</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_DISABLE_FILEWATCHER</code></td><td>boolean</td><td>禁用文件监听器</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_EXA</code></td><td>boolean</td><td>启用实验性 Exa 功能</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_LSP_TY</code></td><td>boolean</td><td>启用实验性 LSP 类型检查</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_MARKDOWN</code></td><td>boolean</td><td>启用实验性 Markdown 功能</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_PLAN_MODE</code></td><td>boolean</td><td>启用计划模式</td></tr></tbody></table>',
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
const url = "src/content/docs/zh-cn/cli.mdx"
const file = "/app/packages/web/src/content/docs/zh-cn/cli.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/app/packages/web/src/content/docs/zh-cn/cli.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
