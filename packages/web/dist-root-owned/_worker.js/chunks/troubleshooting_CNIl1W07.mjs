globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"

const frontmatter = {
  title: "故障排除",
  description: "常见问题及其解决方法。",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "日志",
      text: "日志",
    },
    {
      depth: 2,
      slug: "存储",
      text: "存储",
    },
    {
      depth: 2,
      slug: "桌面应用",
      text: "桌面应用",
    },
    {
      depth: 3,
      slug: "快速检查",
      text: "快速检查",
    },
    {
      depth: 3,
      slug: "禁用插件",
      text: "禁用插件",
    },
    {
      depth: 4,
      slug: "检查全局配置",
      text: "检查全局配置",
    },
    {
      depth: 4,
      slug: "检查插件目录",
      text: "检查插件目录",
    },
    {
      depth: 3,
      slug: "清除缓存",
      text: "清除缓存",
    },
    {
      depth: 3,
      slug: "修复服务器连接问题",
      text: "修复服务器连接问题",
    },
    {
      depth: 4,
      slug: "清除桌面默认服务器-url",
      text: "清除桌面默认服务器 URL",
    },
    {
      depth: 4,
      slug: "从配置中移除-serverport--serverhostname",
      text: "从配置中移除 server.port / server.hostname",
    },
    {
      depth: 4,
      slug: "检查环境变量",
      text: "检查环境变量",
    },
    {
      depth: 3,
      slug: "linux-wayland--x11-问题",
      text: "Linux: Wayland / X11 问题",
    },
    {
      depth: 3,
      slug: "windows-webview2-运行时",
      text: "Windows: WebView2 运行时",
    },
    {
      depth: 3,
      slug: "windows-常见性能问题",
      text: "Windows: 常见性能问题",
    },
    {
      depth: 3,
      slug: "通知不显示",
      text: "通知不显示",
    },
    {
      depth: 3,
      slug: "重置桌面应用存储最后手段",
      text: "重置桌面应用存储（最后手段）",
    },
    {
      depth: 2,
      slug: "获取帮助",
      text: "获取帮助",
    },
    {
      depth: 2,
      slug: "常见问题",
      text: "常见问题",
    },
    {
      depth: 3,
      slug: "slopcode-无法启动",
      text: "SlopCode 无法启动",
    },
    {
      depth: 3,
      slug: "身份验证问题",
      text: "身份验证问题",
    },
    {
      depth: 3,
      slug: "模型不可用",
      text: "模型不可用",
    },
    {
      depth: 3,
      slug: "provideriniterror",
      text: "ProviderInitError",
    },
    {
      depth: 3,
      slug: "ai_apicallerror-和提供商包问题",
      text: "AI_APICallError 和提供商包问题",
    },
    {
      depth: 3,
      slug: "在-linux-上复制粘贴不可用",
      text: "在 Linux 上复制/粘贴不可用",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>要调试 SlopCode 的问题，请先检查其存储在磁盘上的日志和本地数据。</p>\n<hr>\n<h2 id="日志"><a href="#日志">日志</a></h2>\n<p>日志文件写入位置：</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.local/share/slopcode/log/</code></li>\n<li><strong>Windows</strong>: 按 <code dir="auto">WIN+R</code> 并粘贴 <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode\\log</code></li>\n</ul>\n<p>日志文件以时间戳命名（例如 <code dir="auto">2025-01-09T123456.log</code>），并保留最近的 10 个日志文件。</p>\n<p>你可以通过 <code dir="auto">--log-level</code> 命令行选项设置日志级别以获取更详细的调试信息。例如：<code dir="auto">slopcode --log-level DEBUG</code>。</p>\n<hr>\n<h2 id="存储"><a href="#存储">存储</a></h2>\n<p>SlopCode 将会话数据和其他应用数据存储在磁盘上：</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.local/share/slopcode/</code></li>\n<li><strong>Windows</strong>: 按 <code dir="auto">WIN+R</code> 并粘贴 <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode</code></li>\n</ul>\n<p>该目录包含：</p>\n<ul>\n<li><code dir="auto">auth.json</code> - 身份验证数据，如 API 密钥、OAuth Token</li>\n<li><code dir="auto">log/</code> - 应用日志</li>\n<li><code dir="auto">project/</code> - 项目特定数据，如会话和消息数据\n<ul>\n<li>如果项目位于 Git 仓库中，则存储在 <code dir="auto">./&#x3C;project-slug>/storage/</code></li>\n<li>如果不是 Git 仓库，则存储在 <code dir="auto">./global/storage/</code></li>\n</ul>\n</li>\n</ul>\n<hr>\n<h2 id="桌面应用"><a href="#桌面应用">桌面应用</a></h2>\n<p>SlopCode Desktop 会在后台运行一个本地 SlopCode 服务器（即 <code dir="auto">slopcode-cli</code> 附属进程）。大多数问题是由插件异常、缓存损坏或错误的服务器设置引起的。</p>\n<h3 id="快速检查"><a href="#快速检查">快速检查</a></h3>\n<ul>\n<li>完全退出并重新启动应用。</li>\n<li>如果应用显示错误页面，请点击<strong>重新启动</strong>并复制错误详情。</li>\n<li>仅限 macOS：<code dir="auto">SlopCode</code> 菜单 -> <strong>Reload Webview</strong>（当 UI 空白或冻结时有效）。</li>\n</ul>\n<hr>\n<h3 id="禁用插件"><a href="#禁用插件">禁用插件</a></h3>\n<p>如果桌面应用在启动时崩溃、卡住或行为异常，请先禁用插件。</p>\n<h4 id="检查全局配置"><a href="#检查全局配置">检查全局配置</a></h4>\n<p>打开你的全局配置文件，查找 <code dir="auto">plugin</code> 键。</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.config/slopcode/slopcode.jsonc</code>（或 <code dir="auto">~/.config/slopcode/slopcode.json</code>）</li>\n<li><strong>macOS/Linux</strong>（旧版安装）: <code dir="auto">~/.local/share/slopcode/slopcode.jsonc</code></li>\n<li><strong>Windows</strong>: 按 <code dir="auto">WIN+R</code> 并粘贴 <code dir="auto">%USERPROFILE%\\.config\\slopcode\\slopcode.jsonc</code></li>\n</ul>\n<p>如果你配置了插件，请通过移除该键或将其设置为空数组来临时禁用它们：</p>\n<div class="expressive-code"><link rel="stylesheet" href="/docs/_astro/ec.4c0k7.css"><script type="module" src="/docs/_astro/ec.0vx5m.js"></script><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="jsonc"><code><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">{</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"$schema"</span><span style="--0:#24292E;--1:#E1E4E8">: </span><span style="--0:#032F62;--1:#9ECBFF">"https://slopcode.dev/config.json"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"plugin"</span><span style="--0:#24292E;--1:#E1E4E8">: [],</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">}</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="{  &#x22;$schema&#x22;: &#x22;https://slopcode.dev/config.json&#x22;,  &#x22;plugin&#x22;: [],}"><div></div></button></div></figure></div>\n<h4 id="检查插件目录"><a href="#检查插件目录">检查插件目录</a></h4>\n<p>SlopCode 还可以从磁盘加载本地插件。临时将这些插件移走（或重命名文件夹），然后重新启动桌面应用：</p>\n<ul>\n<li><strong>全局插件</strong>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.config/slopcode/plugins/</code></li>\n<li><strong>Windows</strong>: 按 <code dir="auto">WIN+R</code> 并粘贴 <code dir="auto">%USERPROFILE%\\.config\\slopcode\\plugins</code></li>\n</ul>\n</li>\n<li><strong>项目插件</strong>（仅当你使用了项目级配置时）\n<ul>\n<li><code dir="auto">&#x3C;your-project>/.slopcode/plugins/</code></li>\n</ul>\n</li>\n</ul>\n<p>如果应用恢复正常，请逐个重新启用插件，找出导致问题的那个。</p>\n<hr>\n<h3 id="清除缓存"><a href="#清除缓存">清除缓存</a></h3>\n<p>如果禁用插件没有帮助（或插件安装卡住了），请清除缓存以便 SlopCode 重新构建。</p>\n<ol>\n<li>完全退出 SlopCode Desktop。</li>\n<li>删除缓存目录：</li>\n</ol>\n<ul>\n<li><strong>macOS</strong>: Finder -> <code dir="auto">Cmd+Shift+G</code> -> 粘贴 <code dir="auto">~/.cache/slopcode</code></li>\n<li><strong>Linux</strong>: 删除 <code dir="auto">~/.cache/slopcode</code>（或运行 <code dir="auto">rm -rf ~/.cache/slopcode</code>）</li>\n<li><strong>Windows</strong>: 按 <code dir="auto">WIN+R</code> 并粘贴 <code dir="auto">%USERPROFILE%\\.cache\\slopcode</code></li>\n</ul>\n<ol start="3">\n<li>重新启动 SlopCode Desktop。</li>\n</ol>\n<hr>\n<h3 id="修复服务器连接问题"><a href="#修复服务器连接问题">修复服务器连接问题</a></h3>\n<p>SlopCode Desktop 可以启动自己的本地服务器（默认行为），也可以连接到你配置的服务器 URL。</p>\n<p>如果你看到**“Connection Failed”**对话框（或应用始终停留在启动画面），请检查自定义服务器 URL。</p>\n<h4 id="清除桌面默认服务器-url"><a href="#清除桌面默认服务器-url">清除桌面默认服务器 URL</a></h4>\n<p>在主页面上，点击服务器名称（带有状态指示点）以打开服务器选择器。在<strong>默认服务器</strong>部分，点击<strong>清除</strong>。</p>\n<h4 id="从配置中移除-serverport--serverhostname"><a href="#从配置中移除-serverport--serverhostname">从配置中移除 <code dir="auto">server.port</code> / <code dir="auto">server.hostname</code></a></h4>\n<p>如果你的 <code dir="auto">slopcode.json(c)</code> 包含 <code dir="auto">server</code> 部分，请临时移除该部分并重新启动桌面应用。</p>\n<h4 id="检查环境变量"><a href="#检查环境变量">检查环境变量</a></h4>\n<p>如果你在环境中设置了 <code dir="auto">SLOPCODE_PORT</code>，桌面应用将尝试使用该端口作为本地服务器端口。</p>\n<ul>\n<li>取消设置 <code dir="auto">SLOPCODE_PORT</code>（或选择一个空闲端口）并重新启动。</li>\n</ul>\n<hr>\n<h3 id="linux-wayland--x11-问题"><a href="#linux-wayland--x11-问题">Linux: Wayland / X11 问题</a></h3>\n<p>在 Linux 上，某些 Wayland 设置可能会导致窗口空白或合成器错误。</p>\n<ul>\n<li>如果你使用 Wayland 且应用出现空白或崩溃，请尝试使用 <code dir="auto">OC_ALLOW_WAYLAND=1</code> 启动。</li>\n<li>如果情况变得更糟，请移除该设置并尝试在 X11 会话下启动。</li>\n</ul>\n<hr>\n<h3 id="windows-webview2-运行时"><a href="#windows-webview2-运行时">Windows: WebView2 运行时</a></h3>\n<p>在 Windows 上，SlopCode Desktop 需要 Microsoft Edge <strong>WebView2 Runtime</strong>。如果应用打开后是空白窗口或无法启动，请安装或更新 WebView2 后重试。</p>\n<hr>\n<h3 id="windows-常见性能问题"><a href="#windows-常见性能问题">Windows: 常见性能问题</a></h3>\n<p>如果你在 Windows 上遇到性能缓慢、文件访问问题或终端问题，请尝试使用 <a href="/docs/windows-wsl">WSL (Windows Subsystem for Linux)</a>。WSL 提供了一个 Linux 环境，能更好地与 SlopCode 的功能兼容。</p>\n<hr>\n<h3 id="通知不显示"><a href="#通知不显示">通知不显示</a></h3>\n<p>SlopCode Desktop 仅在以下情况下显示系统通知：</p>\n<ul>\n<li>在操作系统设置中已为 SlopCode 启用通知，且</li>\n<li>应用窗口未处于焦点状态。</li>\n</ul>\n<hr>\n<h3 id="重置桌面应用存储最后手段"><a href="#重置桌面应用存储最后手段">重置桌面应用存储（最后手段）</a></h3>\n<p>如果应用无法启动且你无法从 UI 内部清除设置，请重置桌面应用的保存状态。</p>\n<ol>\n<li>退出 SlopCode Desktop。</li>\n<li>找到并删除以下文件（它们位于 SlopCode Desktop 应用数据目录中）：</li>\n</ol>\n<ul>\n<li><code dir="auto">slopcode.settings.dat</code>（桌面默认服务器 URL）</li>\n<li><code dir="auto">slopcode.global.dat</code> 和 <code dir="auto">slopcode.workspace.*.dat</code>（UI 状态，如最近的服务器/项目）</li>\n</ul>\n<p>快速找到该目录：</p>\n<ul>\n<li><strong>macOS</strong>: Finder -> <code dir="auto">Cmd+Shift+G</code> -> <code dir="auto">~/Library/Application Support</code>（然后搜索上述文件名）</li>\n<li><strong>Linux</strong>: 在 <code dir="auto">~/.local/share</code> 下搜索上述文件名</li>\n<li><strong>Windows</strong>: 按 <code dir="auto">WIN+R</code> -> <code dir="auto">%APPDATA%</code>（然后搜索上述文件名）</li>\n</ul>\n<hr>\n<h2 id="获取帮助"><a href="#获取帮助">获取帮助</a></h2>\n<p>如果你遇到 SlopCode 的问题：</p>\n<ol>\n<li>\n<p><strong>在 GitHub 上报告问题</strong></p>\n<p>报告 Bug 或请求功能的最佳方式是通过我们的 GitHub 仓库：</p>\n<p><a href="http://github.com/teamslop/slopcode/issues"><strong>github.com/teamslop/slopcode/issues</strong></a></p>\n<p>在创建新 Issue 之前，请先搜索已有的 Issue，看看你的问题是否已被报告。</p>\n</li>\n<li>\n<p><strong>加入我们的 Discord</strong></p>\n<p>如需实时帮助和社区讨论，请加入我们的 Discord 服务器：</p>\n<p><a href="https://slopcode.dev/discord"><strong>slopcode.dev/discord</strong></a></p>\n</li>\n</ol>\n<hr>\n<h2 id="常见问题"><a href="#常见问题">常见问题</a></h2>\n<p>以下是一些常见问题及其解决方法。</p>\n<hr>\n<h3 id="slopcode-无法启动"><a href="#slopcode-无法启动">SlopCode 无法启动</a></h3>\n<ol>\n<li>检查日志中的错误消息</li>\n<li>尝试使用 <code dir="auto">--print-logs</code> 运行以在终端中查看输出</li>\n<li>使用 <code dir="auto">slopcode upgrade</code> 确保你使用的是最新版本</li>\n</ol>\n<hr>\n<h3 id="身份验证问题"><a href="#身份验证问题">身份验证问题</a></h3>\n<ol>\n<li>尝试在 TUI 中使用 <code dir="auto">/connect</code> 命令重新进行身份验证</li>\n<li>检查你的 API 密钥是否有效</li>\n<li>确保你的网络允许连接到提供商的 API</li>\n</ol>\n<hr>\n<h3 id="模型不可用"><a href="#模型不可用">模型不可用</a></h3>\n<ol>\n<li>检查你是否已通过提供商的身份验证</li>\n<li>验证配置中的模型名称是否正确</li>\n<li>某些模型可能需要特定的访问权限或订阅</li>\n</ol>\n<p>如果你遇到 <code dir="auto">ProviderModelNotFoundError</code>，很可能是在某处错误地引用了模型。\n模型应按如下方式引用：<code dir="auto">&#x3C;providerId>/&#x3C;modelId></code></p>\n<p>示例：</p>\n<ul>\n<li><code dir="auto">openai/gpt-4.1</code></li>\n<li><code dir="auto">openrouter/google/gemini-2.5-flash</code></li>\n<li><code dir="auto">slopcode/kimi-k2</code></li>\n</ul>\n<p>要查看你有权访问哪些模型，请运行 <code dir="auto">slopcode models</code></p>\n<hr>\n<h3 id="provideriniterror"><a href="#provideriniterror">ProviderInitError</a></h3>\n<p>如果你遇到 ProviderInitError，很可能是配置无效或已损坏。</p>\n<p>要解决此问题：</p>\n<ol>\n<li>\n<p>首先，按照<a href="/docs/providers">提供商指南</a>验证你的提供商是否已正确设置</p>\n</li>\n<li>\n<p>如果问题仍然存在，请尝试清除已存储的配置：</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">rm</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-rf</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">~/.local/share/slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="rm -rf ~/.local/share/slopcode"><div></div></button></div></figure></div>\n<p>在 Windows 上，按 <code dir="auto">WIN+R</code> 并删除：<code dir="auto">%USERPROFILE%\\.local\\share\\slopcode</code></p>\n</li>\n<li>\n<p>在 TUI 中使用 <code dir="auto">/connect</code> 命令重新与提供商进行身份验证。</p>\n</li>\n</ol>\n<hr>\n<h3 id="ai_apicallerror-和提供商包问题"><a href="#ai_apicallerror-和提供商包问题">AI_APICallError 和提供商包问题</a></h3>\n<p>如果你遇到 API 调用错误，可能是由于提供商包过期导致的。SlopCode 会根据需要动态安装提供商包（OpenAI、Anthropic、Google 等）并将它们缓存到本地。</p>\n<p>要解决提供商包问题：</p>\n<ol>\n<li>\n<p>清除提供商包缓存：</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">rm</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-rf</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">~/.cache/slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="rm -rf ~/.cache/slopcode"><div></div></button></div></figure></div>\n<p>在 Windows 上，按 <code dir="auto">WIN+R</code> 并删除：<code dir="auto">%USERPROFILE%\\.cache\\slopcode</code></p>\n</li>\n<li>\n<p>重新启动 SlopCode 以重新安装最新的提供商包</p>\n</li>\n</ol>\n<p>这将强制 SlopCode 下载最新版本的提供商包，通常可以解决模型参数和 API 变更带来的兼容性问题。</p>\n<hr>\n<h3 id="在-linux-上复制粘贴不可用"><a href="#在-linux-上复制粘贴不可用">在 Linux 上复制/粘贴不可用</a></h3>\n<p>Linux 用户需要安装以下剪贴板工具之一，复制/粘贴功能才能正常工作：</p>\n<p><strong>对于 X11 系统：</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xclip</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># or</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xsel</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y xclipapt install -y xsel"><div></div></button></div></figure></div>\n<p><strong>对于 Wayland 系统：</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">wl-clipboard</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y wl-clipboard"><div></div></button></div></figure></div>\n<p><strong>对于无头环境：</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xvfb</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># and run:</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">Xvfb</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">:99</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-screen</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">0</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">1024x768x24</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">></span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">/dev/null</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">2>&#x26;1</span><span style="--0:#24292E;--1:#E1E4E8"> &#x26;</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">export</span><span style="--0:#24292E;--1:#E1E4E8"> DISPLAY</span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8">:99.0</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y xvfbXvfb :99 -screen 0 1024x768x24 > /dev/null 2>&#x26;1 &#x26;export DISPLAY=:99.0"><div></div></button></div></figure></div>\n<p>SlopCode 会检测你是否正在使用 Wayland 并优先使用 <code dir="auto">wl-clipboard</code>，否则将按以下顺序尝试查找剪贴板工具：<code dir="auto">xclip</code> 和 <code dir="auto">xsel</code>。</p>',
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
const url = "src/content/docs/zh-cn/troubleshooting.mdx"
const file =
  "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/troubleshooting.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId =
  "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/troubleshooting.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
