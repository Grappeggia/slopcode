globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"

const frontmatter = {
  title: "疑難排解",
  description: "常見問題及其解決方法。",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "日誌",
      text: "日誌",
    },
    {
      depth: 2,
      slug: "儲存",
      text: "儲存",
    },
    {
      depth: 2,
      slug: "桌面應用程式",
      text: "桌面應用程式",
    },
    {
      depth: 3,
      slug: "快速檢查",
      text: "快速檢查",
    },
    {
      depth: 3,
      slug: "停用外掛",
      text: "停用外掛",
    },
    {
      depth: 4,
      slug: "檢查全域設定",
      text: "檢查全域設定",
    },
    {
      depth: 4,
      slug: "檢查外掛目錄",
      text: "檢查外掛目錄",
    },
    {
      depth: 3,
      slug: "清除快取",
      text: "清除快取",
    },
    {
      depth: 3,
      slug: "修復伺服器連線問題",
      text: "修復伺服器連線問題",
    },
    {
      depth: 4,
      slug: "清除桌面預設伺服器-url",
      text: "清除桌面預設伺服器 URL",
    },
    {
      depth: 4,
      slug: "從設定中移除-serverport--serverhostname",
      text: "從設定中移除 server.port / server.hostname",
    },
    {
      depth: 4,
      slug: "檢查環境變數",
      text: "檢查環境變數",
    },
    {
      depth: 3,
      slug: "linux-wayland--x11-問題",
      text: "Linux: Wayland / X11 問題",
    },
    {
      depth: 3,
      slug: "windows-webview2-執行階段",
      text: "Windows: WebView2 執行階段",
    },
    {
      depth: 3,
      slug: "windows-常見效能問題",
      text: "Windows: 常見效能問題",
    },
    {
      depth: 3,
      slug: "通知不顯示",
      text: "通知不顯示",
    },
    {
      depth: 3,
      slug: "重設桌面應用程式儲存最後手段",
      text: "重設桌面應用程式儲存（最後手段）",
    },
    {
      depth: 2,
      slug: "取得幫助",
      text: "取得幫助",
    },
    {
      depth: 2,
      slug: "常見問題",
      text: "常見問題",
    },
    {
      depth: 3,
      slug: "slopcode-無法啟動",
      text: "SlopCode 無法啟動",
    },
    {
      depth: 3,
      slug: "身分驗證問題",
      text: "身分驗證問題",
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
      slug: "ai_apicallerror-和供應商套件問題",
      text: "AI_APICallError 和供應商套件問題",
    },
    {
      depth: 3,
      slug: "在-linux-上複製貼上不可用",
      text: "在 Linux 上複製/貼上不可用",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>要偵錯 SlopCode 的問題，請先檢查其儲存在磁碟上的日誌和本地資料。</p>\n<hr>\n<h2 id="日誌"><a href="#日誌">日誌</a></h2>\n<p>日誌檔案寫入位置：</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.local/share/slopcode/log/</code></li>\n<li><strong>Windows</strong>: 按 <code dir="auto">WIN+R</code> 並貼上 <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode\\log</code></li>\n</ul>\n<p>日誌檔案以時間戳記命名（例如 <code dir="auto">2025-01-09T123456.log</code>），並保留最近的 10 個日誌檔案。</p>\n<p>你可以透過 <code dir="auto">--log-level</code> 命令列選項設定日誌等級以取得更詳細的偵錯資訊。例如：<code dir="auto">slopcode --log-level DEBUG</code>。</p>\n<hr>\n<h2 id="儲存"><a href="#儲存">儲存</a></h2>\n<p>SlopCode 將工作階段資料和其他應用程式資料儲存在磁碟上：</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.local/share/slopcode/</code></li>\n<li><strong>Windows</strong>: 按 <code dir="auto">WIN+R</code> 並貼上 <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode</code></li>\n</ul>\n<p>該目錄包含：</p>\n<ul>\n<li><code dir="auto">auth.json</code> - 身分驗證資料，如 API 金鑰、OAuth Token</li>\n<li><code dir="auto">log/</code> - 應用程式日誌</li>\n<li><code dir="auto">project/</code> - 專案特定資料，如工作階段和訊息資料\n<ul>\n<li>如果專案位於 Git 儲存庫中，則儲存在 <code dir="auto">./&#x3C;project-slug>/storage/</code></li>\n<li>如果不是 Git 儲存庫，則儲存在 <code dir="auto">./global/storage/</code></li>\n</ul>\n</li>\n</ul>\n<hr>\n<h2 id="桌面應用程式"><a href="#桌面應用程式">桌面應用程式</a></h2>\n<p>SlopCode Desktop 會在背景執行一個本地 SlopCode 伺服器（即 <code dir="auto">slopcode-cli</code> 附屬程序）。大多數問題是由外掛異常、快取損壞或錯誤的伺服器設定引起的。</p>\n<h3 id="快速檢查"><a href="#快速檢查">快速檢查</a></h3>\n<ul>\n<li>完全退出並重新啟動應用程式。</li>\n<li>如果應用程式顯示錯誤頁面，請點擊<strong>重新啟動</strong>並複製錯誤詳情。</li>\n<li>僅限 macOS：<code dir="auto">SlopCode</code> 選單 -> <strong>Reload Webview</strong>（當 UI 空白或凍結時有效）。</li>\n</ul>\n<hr>\n<h3 id="停用外掛"><a href="#停用外掛">停用外掛</a></h3>\n<p>如果桌面應用程式在啟動時當機、卡住或行為異常，請先停用外掛。</p>\n<h4 id="檢查全域設定"><a href="#檢查全域設定">檢查全域設定</a></h4>\n<p>開啟你的全域設定檔，查找 <code dir="auto">plugin</code> 鍵。</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.config/slopcode/slopcode.jsonc</code>（或 <code dir="auto">~/.config/slopcode/slopcode.json</code>）</li>\n<li><strong>macOS/Linux</strong>（舊版安裝）: <code dir="auto">~/.local/share/slopcode/slopcode.jsonc</code></li>\n<li><strong>Windows</strong>: 按 <code dir="auto">WIN+R</code> 並貼上 <code dir="auto">%USERPROFILE%\\.config\\slopcode\\slopcode.jsonc</code></li>\n</ul>\n<p>如果你設定了外掛，請透過移除該鍵或將其設定為空陣列來暫時停用它們：</p>\n<div class="expressive-code"><link rel="stylesheet" href="/docs/_astro/ec.4c0k7.css"><script type="module" src="/docs/_astro/ec.0vx5m.js"></script><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="jsonc"><code><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">{</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"$schema"</span><span style="--0:#24292E;--1:#E1E4E8">: </span><span style="--0:#032F62;--1:#9ECBFF">"https://slopcode.dev/config.json"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"plugin"</span><span style="--0:#24292E;--1:#E1E4E8">: [],</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">}</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="{  &#x22;$schema&#x22;: &#x22;https://slopcode.dev/config.json&#x22;,  &#x22;plugin&#x22;: [],}"><div></div></button></div></figure></div>\n<h4 id="檢查外掛目錄"><a href="#檢查外掛目錄">檢查外掛目錄</a></h4>\n<p>SlopCode 還可以從磁碟載入本地外掛。暫時將這些外掛移走（或重新命名資料夾），然後重新啟動桌面應用程式：</p>\n<ul>\n<li><strong>全域外掛</strong>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.config/slopcode/plugins/</code></li>\n<li><strong>Windows</strong>: 按 <code dir="auto">WIN+R</code> 並貼上 <code dir="auto">%USERPROFILE%\\.config\\slopcode\\plugins</code></li>\n</ul>\n</li>\n<li><strong>專案外掛</strong>（僅當你使用了專案級設定時）\n<ul>\n<li><code dir="auto">&#x3C;your-project>/.slopcode/plugins/</code></li>\n</ul>\n</li>\n</ul>\n<p>如果應用程式恢復正常，請逐個重新啟用外掛，找出導致問題的那個。</p>\n<hr>\n<h3 id="清除快取"><a href="#清除快取">清除快取</a></h3>\n<p>如果停用外掛沒有幫助（或外掛安裝卡住了），請清除快取以便 SlopCode 重新建置。</p>\n<ol>\n<li>完全退出 SlopCode Desktop。</li>\n<li>刪除快取目錄：</li>\n</ol>\n<ul>\n<li><strong>macOS</strong>: Finder -> <code dir="auto">Cmd+Shift+G</code> -> 貼上 <code dir="auto">~/.cache/slopcode</code></li>\n<li><strong>Linux</strong>: 刪除 <code dir="auto">~/.cache/slopcode</code>（或執行 <code dir="auto">rm -rf ~/.cache/slopcode</code>）</li>\n<li><strong>Windows</strong>: 按 <code dir="auto">WIN+R</code> 並貼上 <code dir="auto">%USERPROFILE%\\.cache\\slopcode</code></li>\n</ul>\n<ol start="3">\n<li>重新啟動 SlopCode Desktop。</li>\n</ol>\n<hr>\n<h3 id="修復伺服器連線問題"><a href="#修復伺服器連線問題">修復伺服器連線問題</a></h3>\n<p>SlopCode Desktop 可以啟動自己的本地伺服器（預設行為），也可以連線到你設定的伺服器 URL。</p>\n<p>如果你看到**「Connection Failed」**對話框（或應用程式始終停留在啟動畫面），請檢查自訂伺服器 URL。</p>\n<h4 id="清除桌面預設伺服器-url"><a href="#清除桌面預設伺服器-url">清除桌面預設伺服器 URL</a></h4>\n<p>在主頁面上，點擊伺服器名稱（帶有狀態指示點）以開啟伺服器選擇器。在<strong>預設伺服器</strong>部分，點擊<strong>清除</strong>。</p>\n<h4 id="從設定中移除-serverport--serverhostname"><a href="#從設定中移除-serverport--serverhostname">從設定中移除 <code dir="auto">server.port</code> / <code dir="auto">server.hostname</code></a></h4>\n<p>如果你的 <code dir="auto">slopcode.json(c)</code> 包含 <code dir="auto">server</code> 部分，請暫時移除該部分並重新啟動桌面應用程式。</p>\n<h4 id="檢查環境變數"><a href="#檢查環境變數">檢查環境變數</a></h4>\n<p>如果你在環境中設定了 <code dir="auto">SLOPCODE_PORT</code>，桌面應用程式將嘗試使用該連接埠作為本地伺服器連接埠。</p>\n<ul>\n<li>取消設定 <code dir="auto">SLOPCODE_PORT</code>（或選擇一個空閒連接埠）並重新啟動。</li>\n</ul>\n<hr>\n<h3 id="linux-wayland--x11-問題"><a href="#linux-wayland--x11-問題">Linux: Wayland / X11 問題</a></h3>\n<p>在 Linux 上，某些 Wayland 設定可能會導致視窗空白或合成器錯誤。</p>\n<ul>\n<li>如果你使用 Wayland 且應用程式出現空白或當機，請嘗試使用 <code dir="auto">OC_ALLOW_WAYLAND=1</code> 啟動。</li>\n<li>如果情況變得更糟，請移除該設定並嘗試在 X11 工作階段下啟動。</li>\n</ul>\n<hr>\n<h3 id="windows-webview2-執行階段"><a href="#windows-webview2-執行階段">Windows: WebView2 執行階段</a></h3>\n<p>在 Windows 上，SlopCode Desktop 需要 Microsoft Edge <strong>WebView2 Runtime</strong>。如果應用程式開啟後是空白視窗或無法啟動，請安裝或更新 WebView2 後重試。</p>\n<hr>\n<h3 id="windows-常見效能問題"><a href="#windows-常見效能問題">Windows: 常見效能問題</a></h3>\n<p>如果你在 Windows 上遇到效能緩慢、檔案存取問題或終端機問題，請嘗試使用 <a href="/docs/windows-wsl">WSL (Windows Subsystem for Linux)</a>。WSL 提供了一個 Linux 環境，能更好地與 SlopCode 的功能相容。</p>\n<hr>\n<h3 id="通知不顯示"><a href="#通知不顯示">通知不顯示</a></h3>\n<p>SlopCode Desktop 僅在以下情況下顯示系統通知：</p>\n<ul>\n<li>在作業系統設定中已為 SlopCode 啟用通知，且</li>\n<li>應用程式視窗未處於焦點狀態。</li>\n</ul>\n<hr>\n<h3 id="重設桌面應用程式儲存最後手段"><a href="#重設桌面應用程式儲存最後手段">重設桌面應用程式儲存（最後手段）</a></h3>\n<p>如果應用程式無法啟動且你無法從 UI 內部清除設定，請重設桌面應用程式的儲存狀態。</p>\n<ol>\n<li>退出 SlopCode Desktop。</li>\n<li>找到並刪除以下檔案（它們位於 SlopCode Desktop 應用程式資料目錄中）：</li>\n</ol>\n<ul>\n<li><code dir="auto">slopcode.settings.dat</code>（桌面預設伺服器 URL）</li>\n<li><code dir="auto">slopcode.global.dat</code> 和 <code dir="auto">slopcode.workspace.*.dat</code>（UI 狀態，如最近的伺服器/專案）</li>\n</ul>\n<p>快速找到該目錄：</p>\n<ul>\n<li><strong>macOS</strong>: Finder -> <code dir="auto">Cmd+Shift+G</code> -> <code dir="auto">~/Library/Application Support</code>（然後搜尋上述檔案名稱）</li>\n<li><strong>Linux</strong>: 在 <code dir="auto">~/.local/share</code> 下搜尋上述檔案名稱</li>\n<li><strong>Windows</strong>: 按 <code dir="auto">WIN+R</code> -> <code dir="auto">%APPDATA%</code>（然後搜尋上述檔案名稱）</li>\n</ul>\n<hr>\n<h2 id="取得幫助"><a href="#取得幫助">取得幫助</a></h2>\n<p>如果你遇到 SlopCode 的問題：</p>\n<ol>\n<li>\n<p><strong>在 GitHub 上回報問題</strong></p>\n<p>回報 Bug 或請求功能的最佳方式是透過我們的 GitHub 儲存庫：</p>\n<p><a href="http://github.com/teamslop/slopcode/issues"><strong>github.com/teamslop/slopcode/issues</strong></a></p>\n<p>在建立新 Issue 之前，請先搜尋已有的 Issue，看看你的問題是否已被回報。</p>\n</li>\n<li>\n<p><strong>加入我們的 Discord</strong></p>\n<p>如需即時幫助和社群討論，請加入我們的 Discord 伺服器：</p>\n<p><a href="https://slopcode.dev/discord"><strong>slopcode.dev/discord</strong></a></p>\n</li>\n</ol>\n<hr>\n<h2 id="常見問題"><a href="#常見問題">常見問題</a></h2>\n<p>以下是一些常見問題及其解決方法。</p>\n<hr>\n<h3 id="slopcode-無法啟動"><a href="#slopcode-無法啟動">SlopCode 無法啟動</a></h3>\n<ol>\n<li>檢查日誌中的錯誤訊息</li>\n<li>嘗試使用 <code dir="auto">--print-logs</code> 執行以在終端機中查看輸出</li>\n<li>使用 <code dir="auto">slopcode upgrade</code> 確保你使用的是最新版本</li>\n</ol>\n<hr>\n<h3 id="身分驗證問題"><a href="#身分驗證問題">身分驗證問題</a></h3>\n<ol>\n<li>嘗試在 TUI 中使用 <code dir="auto">/connect</code> 指令重新進行身分驗證</li>\n<li>檢查你的 API 金鑰是否有效</li>\n<li>確保你的網路允許連線到供應商的 API</li>\n</ol>\n<hr>\n<h3 id="模型不可用"><a href="#模型不可用">模型不可用</a></h3>\n<ol>\n<li>檢查你是否已通過供應商的身分驗證</li>\n<li>驗證設定中的模型名稱是否正確</li>\n<li>某些模型可能需要特定的存取權限或訂閱</li>\n</ol>\n<p>如果你遇到 <code dir="auto">ProviderModelNotFoundError</code>，很可能是在某處錯誤地參考了模型。\n模型應按如下方式參考：<code dir="auto">&#x3C;providerId>/&#x3C;modelId></code></p>\n<p>範例：</p>\n<ul>\n<li><code dir="auto">openai/gpt-4.1</code></li>\n<li><code dir="auto">openrouter/google/gemini-2.5-flash</code></li>\n<li><code dir="auto">slopcode/kimi-k2</code></li>\n</ul>\n<p>要查看你有權存取哪些模型，請執行 <code dir="auto">slopcode models</code></p>\n<hr>\n<h3 id="provideriniterror"><a href="#provideriniterror">ProviderInitError</a></h3>\n<p>如果你遇到 ProviderInitError，很可能是設定無效或已損壞。</p>\n<p>要解決此問題：</p>\n<ol>\n<li>\n<p>首先，按照<a href="/docs/providers">供應商指南</a>驗證你的供應商是否已正確設定</p>\n</li>\n<li>\n<p>如果問題仍然存在，請嘗試清除已儲存的設定：</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">rm</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-rf</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">~/.local/share/slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="rm -rf ~/.local/share/slopcode"><div></div></button></div></figure></div>\n<p>在 Windows 上，按 <code dir="auto">WIN+R</code> 並刪除：<code dir="auto">%USERPROFILE%\\.local\\share\\slopcode</code></p>\n</li>\n<li>\n<p>在 TUI 中使用 <code dir="auto">/connect</code> 指令重新與供應商進行身分驗證。</p>\n</li>\n</ol>\n<hr>\n<h3 id="ai_apicallerror-和供應商套件問題"><a href="#ai_apicallerror-和供應商套件問題">AI_APICallError 和供應商套件問題</a></h3>\n<p>如果你遇到 API 呼叫錯誤，可能是由於供應商套件過期導致的。SlopCode 會根據需要動態安裝供應商套件（OpenAI、Anthropic、Google 等）並將它們快取到本地。</p>\n<p>要解決供應商套件問題：</p>\n<ol>\n<li>\n<p>清除供應商套件快取：</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">rm</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-rf</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">~/.cache/slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="rm -rf ~/.cache/slopcode"><div></div></button></div></figure></div>\n<p>在 Windows 上，按 <code dir="auto">WIN+R</code> 並刪除：<code dir="auto">%USERPROFILE%\\.cache\\slopcode</code></p>\n</li>\n<li>\n<p>重新啟動 SlopCode 以重新安裝最新的供應商套件</p>\n</li>\n</ol>\n<p>這將強制 SlopCode 下載最新版本的供應商套件，通常可以解決模型參數和 API 變更帶來的相容性問題。</p>\n<hr>\n<h3 id="在-linux-上複製貼上不可用"><a href="#在-linux-上複製貼上不可用">在 Linux 上複製/貼上不可用</a></h3>\n<p>Linux 使用者需要安裝以下剪貼簿工具之一，複製/貼上功能才能正常運作：</p>\n<p><strong>對於 X11 系統：</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xclip</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># or</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xsel</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y xclipapt install -y xsel"><div></div></button></div></figure></div>\n<p><strong>對於 Wayland 系統：</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">wl-clipboard</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y wl-clipboard"><div></div></button></div></figure></div>\n<p><strong>對於無頭環境：</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xvfb</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># and run:</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">Xvfb</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">:99</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-screen</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">0</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">1024x768x24</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">></span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">/dev/null</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">2>&#x26;1</span><span style="--0:#24292E;--1:#E1E4E8"> &#x26;</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">export</span><span style="--0:#24292E;--1:#E1E4E8"> DISPLAY</span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8">:99.0</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y xvfbXvfb :99 -screen 0 1024x768x24 > /dev/null 2>&#x26;1 &#x26;export DISPLAY=:99.0"><div></div></button></div></figure></div>\n<p>SlopCode 會偵測你是否正在使用 Wayland 並優先使用 <code dir="auto">wl-clipboard</code>，否則將按以下順序嘗試查找剪貼簿工具：<code dir="auto">xclip</code> 和 <code dir="auto">xsel</code>。</p>',
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
const url = "src/content/docs/zh-tw/troubleshooting.mdx"
const file = "/app/packages/web/src/content/docs/zh-tw/troubleshooting.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/app/packages/web/src/content/docs/zh-tw/troubleshooting.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
