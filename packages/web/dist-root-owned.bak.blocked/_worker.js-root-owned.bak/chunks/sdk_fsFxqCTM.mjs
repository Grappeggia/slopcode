globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"
import { c as config } from "./config_UI6PtV27.mjs"

const frontmatter = {
  title: "SDK",
  description: "slopcode 伺服器的型別安全 JS 用戶端。",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "安裝",
      text: "安裝",
    },
    {
      depth: 2,
      slug: "建立用戶端",
      text: "建立用戶端",
    },
    {
      depth: 4,
      slug: "選項",
      text: "選項",
    },
    {
      depth: 2,
      slug: "設定",
      text: "設定",
    },
    {
      depth: 2,
      slug: "僅用戶端模式",
      text: "僅用戶端模式",
    },
    {
      depth: 4,
      slug: "選項-1",
      text: "選項",
    },
    {
      depth: 2,
      slug: "型別",
      text: "型別",
    },
    {
      depth: 2,
      slug: "錯誤處理",
      text: "錯誤處理",
    },
    {
      depth: 2,
      slug: "結構化輸出",
      text: "結構化輸出",
    },
    {
      depth: 3,
      slug: "基本用法",
      text: "基本用法",
    },
    {
      depth: 3,
      slug: "輸出格式型別",
      text: "輸出格式型別",
    },
    {
      depth: 3,
      slug: "json-schema-格式",
      text: "JSON Schema 格式",
    },
    {
      depth: 3,
      slug: "錯誤處理-1",
      text: "錯誤處理",
    },
    {
      depth: 3,
      slug: "最佳實務",
      text: "最佳實務",
    },
    {
      depth: 2,
      slug: "api",
      text: "API",
    },
    {
      depth: 3,
      slug: "global",
      text: "Global",
    },
    {
      depth: 4,
      slug: "範例",
      text: "範例",
    },
    {
      depth: 3,
      slug: "app",
      text: "App",
    },
    {
      depth: 4,
      slug: "範例-1",
      text: "範例",
    },
    {
      depth: 3,
      slug: "project",
      text: "Project",
    },
    {
      depth: 4,
      slug: "範例-2",
      text: "範例",
    },
    {
      depth: 3,
      slug: "path",
      text: "Path",
    },
    {
      depth: 4,
      slug: "範例-3",
      text: "範例",
    },
    {
      depth: 3,
      slug: "config",
      text: "Config",
    },
    {
      depth: 4,
      slug: "範例-4",
      text: "範例",
    },
    {
      depth: 3,
      slug: "sessions",
      text: "Sessions",
    },
    {
      depth: 4,
      slug: "範例-5",
      text: "範例",
    },
    {
      depth: 3,
      slug: "files",
      text: "Files",
    },
    {
      depth: 4,
      slug: "範例-6",
      text: "範例",
    },
    {
      depth: 3,
      slug: "tui",
      text: "TUI",
    },
    {
      depth: 4,
      slug: "範例-7",
      text: "範例",
    },
    {
      depth: 3,
      slug: "auth",
      text: "Auth",
    },
    {
      depth: 4,
      slug: "範例-8",
      text: "範例",
    },
    {
      depth: 3,
      slug: "events",
      text: "Events",
    },
    {
      depth: 4,
      slug: "範例-9",
      text: "範例",
    },
  ]
}
const typesUrl = `${config.github}/blob/dev/packages/sdk/js/src/gen/types.gen.ts`
function _createMdxContent(props) {
  const _components = {
      code: "code",
      p: "p",
      table: "table",
      tbody: "tbody",
      td: "td",
      th: "th",
      thead: "thead",
      tr: "tr",
      ...props.components,
    },
    { Fragment: Fragment$1 } = _components
  if (!Fragment$1) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    children: [
      createVNode(Fragment$1, {
        "set:html":
          '<p>slopcode JS/TS SDK 提供了一個型別安全的用戶端，用於與伺服器進行互動。\n您可以用它來建構整合方案，並以程式化方式控制 slopcode。</p>\n<p><a href="/docs/server">了解更多</a>關於伺服器的運作原理。如需範例，請查看社群建構的<a href="/docs/ecosystem#projects">專案</a>。</p>\n<hr>\n<h2 id="安裝"><a href="#安裝">安裝</a></h2>\n<p>從 npm 安裝 SDK：</p>\n<div class="expressive-code"><link rel="stylesheet" href="/docs/_astro/ec.4c0k7.css"><script type="module" src="/docs/_astro/ec.0vx5m.js"></script><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">npm</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">@slopcode-ai/sdk</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="npm install @slopcode-ai/sdk"><div></div></button></div></figure></div>\n<hr>\n<h2 id="建立用戶端"><a href="#建立用戶端">建立用戶端</a></h2>\n<p>建立一個 slopcode 實例：</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">import</span><span style="--0:#24292E;--1:#E1E4E8"> { createSlopcode } </span><span style="--0:#BF3441;--1:#F97583">from</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">"@slopcode-ai/sdk"</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> { </span><span style="--0:#005CC5;--1:#79B8FF">client</span><span style="--0:#24292E;--1:#E1E4E8"> } </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#6F42C1;--1:#B392F0">createSlopcode</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="import { createSlopcode } from &#x22;@slopcode-ai/sdk&#x22;const { client } = await createSlopcode()"><div></div></button></div></figure></div>\n<p>這會同時啟動伺服器和用戶端。</p>\n<h4 id="選項"><a href="#選項">選項</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>選項</th><th>型別</th><th>描述</th><th>預設值</th></tr></thead><tbody><tr><td><code dir="auto">hostname</code></td><td><code dir="auto">string</code></td><td>伺服器主機名稱</td><td><code dir="auto">127.0.0.1</code></td></tr><tr><td><code dir="auto">port</code></td><td><code dir="auto">number</code></td><td>伺服器連接埠</td><td><code dir="auto">4096</code></td></tr><tr><td><code dir="auto">signal</code></td><td><code dir="auto">AbortSignal</code></td><td>用於取消操作的中止訊號</td><td><code dir="auto">undefined</code></td></tr><tr><td><code dir="auto">timeout</code></td><td><code dir="auto">number</code></td><td>伺服器啟動逾時時間（毫秒）</td><td><code dir="auto">5000</code></td></tr><tr><td><code dir="auto">config</code></td><td><code dir="auto">Config</code></td><td>設定物件</td><td><code dir="auto">{}</code></td></tr></tbody></table>\n<hr>\n<h2 id="設定"><a href="#設定">設定</a></h2>\n<p>您可以傳入一個設定物件來自訂行為。實例仍然會讀取您的 <code dir="auto">slopcode.json</code>，但您可以透過內嵌方式覆寫或新增設定：</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">import</span><span style="--0:#24292E;--1:#E1E4E8"> { createSlopcode } </span><span style="--0:#BF3441;--1:#F97583">from</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">"@slopcode-ai/sdk"</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#6F42C1;--1:#B392F0">createSlopcode</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">hostname: </span><span style="--0:#032F62;--1:#9ECBFF">"127.0.0.1"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">port: </span><span style="--0:#005CC5;--1:#79B8FF">4096</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">config: {</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">model: </span><span style="--0:#032F62;--1:#9ECBFF">"anthropic/claude-3-5-sonnet-20241022"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">},</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">console.</span><span style="--0:#6F42C1;--1:#B392F0">log</span><span style="--0:#24292E;--1:#E1E4E8">(</span><span style="--0:#032F62;--1:#9ECBFF">`Server running at ${</span><span style="--0:#24292E;--1:#E1E4E8">slopcode</span><span style="--0:#032F62;--1:#9ECBFF">.</span><span style="--0:#24292E;--1:#E1E4E8">server</span><span style="--0:#032F62;--1:#9ECBFF">.</span><span style="--0:#24292E;--1:#E1E4E8">url</span><span style="--0:#032F62;--1:#9ECBFF">}`</span><span style="--0:#24292E;--1:#E1E4E8">)</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">slopcode.server.</span><span style="--0:#6F42C1;--1:#B392F0">close</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="import { createSlopcode } from &#x22;@slopcode-ai/sdk&#x22;const slopcode = await createSlopcode({  hostname: &#x22;127.0.0.1&#x22;,  port: 4096,  config: {    model: &#x22;anthropic/claude-3-5-sonnet-20241022&#x22;,  },})console.log(&#x60;Server running at ${slopcode.server.url}&#x60;)slopcode.server.close()"><div></div></button></div></figure></div>\n<h2 id="僅用戶端模式"><a href="#僅用戶端模式">僅用戶端模式</a></h2>\n<p>如果您已經有一個正在執行的 slopcode 實例，可以建立一個用戶端實例來連線：</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">import</span><span style="--0:#24292E;--1:#E1E4E8"> { createSlopcodeClient } </span><span style="--0:#BF3441;--1:#F97583">from</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">"@slopcode-ai/sdk"</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">client</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#6F42C1;--1:#B392F0">createSlopcodeClient</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">baseUrl: </span><span style="--0:#032F62;--1:#9ECBFF">"http://localhost:4096"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="import { createSlopcodeClient } from &#x22;@slopcode-ai/sdk&#x22;const client = createSlopcodeClient({  baseUrl: &#x22;http://localhost:4096&#x22;,})"><div></div></button></div></figure></div>\n<h4 id="選項-1"><a href="#選項-1">選項</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>選項</th><th>型別</th><th>描述</th><th>預設值</th></tr></thead><tbody><tr><td><code dir="auto">baseUrl</code></td><td><code dir="auto">string</code></td><td>伺服器 URL</td><td><code dir="auto">http://localhost:4096</code></td></tr><tr><td><code dir="auto">fetch</code></td><td><code dir="auto">function</code></td><td>自訂 fetch 實作</td><td><code dir="auto">globalThis.fetch</code></td></tr><tr><td><code dir="auto">parseAs</code></td><td><code dir="auto">string</code></td><td>回應解析方式</td><td><code dir="auto">auto</code></td></tr><tr><td><code dir="auto">responseStyle</code></td><td><code dir="auto">string</code></td><td>回傳風格：<code dir="auto">data</code> 或 <code dir="auto">fields</code></td><td><code dir="auto">fields</code></td></tr><tr><td><code dir="auto">throwOnError</code></td><td><code dir="auto">boolean</code></td><td>拋出錯誤而非回傳錯誤</td><td><code dir="auto">false</code></td></tr></tbody></table>\n<hr>\n<h2 id="型別"><a href="#型別">型別</a></h2>\n<p>SDK 包含所有 API 型別的 TypeScript 定義。您可以直接匯入它們：</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="typescript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">import</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">type</span><span style="--0:#24292E;--1:#E1E4E8"> { Session, Message, Part } </span><span style="--0:#BF3441;--1:#F97583">from</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">"@slopcode-ai/sdk"</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="import type { Session, Message, Part } from &#x22;@slopcode-ai/sdk&#x22;"><div></div></button></div></figure></div>\n',
      }),
      createVNode(_components.p, {
        children: [
          "所有型別均根據伺服器的 OpenAPI 規範產生，可在",
          createVNode("a", {
            href: typesUrl,
            "set:html": "型別檔案",
          }),
          "中查看。",
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h2 id="錯誤處理"><a href="#錯誤處理">錯誤處理</a></h2>\n<p>SDK 可能會拋出錯誤，您可以捕捉並處理這些錯誤：</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="typescript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">try</span><span style="--0:#24292E;--1:#E1E4E8"> {</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.session.</span><span style="--0:#6F42C1;--1:#B392F0">get</span><span style="--0:#24292E;--1:#E1E4E8">({ path: { id: </span><span style="--0:#032F62;--1:#9ECBFF">"invalid-id"</span><span style="--0:#24292E;--1:#E1E4E8"> } })</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">} </span><span style="--0:#BF3441;--1:#F97583">catch</span><span style="--0:#24292E;--1:#E1E4E8"> (error) {</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">console.</span><span style="--0:#6F42C1;--1:#B392F0">error</span><span style="--0:#24292E;--1:#E1E4E8">(</span><span style="--0:#032F62;--1:#9ECBFF">"Failed to get session:"</span><span style="--0:#24292E;--1:#E1E4E8">, (error </span><span style="--0:#BF3441;--1:#F97583">as</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#6F42C1;--1:#B392F0">Error</span><span style="--0:#24292E;--1:#E1E4E8">).message)</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">}</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="try {  await client.session.get({ path: { id: &#x22;invalid-id&#x22; } })} catch (error) {  console.error(&#x22;Failed to get session:&#x22;, (error as Error).message)}"><div></div></button></div></figure></div>\n<hr>\n<h2 id="結構化輸出"><a href="#結構化輸出">結構化輸出</a></h2>\n<p>您可以透過指定帶有 JSON Schema 的 <code dir="auto">format</code> 來請求模型回傳結構化的 JSON 輸出。模型會使用 <code dir="auto">StructuredOutput</code> 工具回傳符合您 Schema 的經過驗證的 JSON。</p>\n<h3 id="基本用法"><a href="#基本用法">基本用法</a></h3>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="typescript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">result</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.session.</span><span style="--0:#6F42C1;--1:#B392F0">prompt</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">path: { id: sessionId },</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">body: {</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">parts: [{ type: </span><span style="--0:#032F62;--1:#9ECBFF">"text"</span><span style="--0:#24292E;--1:#E1E4E8">, text: </span><span style="--0:#032F62;--1:#9ECBFF">"Research Anthropic and provide company info"</span><span style="--0:#24292E;--1:#E1E4E8"> }],</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">format: {</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">      </span></span><span style="--0:#24292E;--1:#E1E4E8">type: </span><span style="--0:#032F62;--1:#9ECBFF">"json_schema"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">      </span></span><span style="--0:#24292E;--1:#E1E4E8">schema: {</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">        </span></span><span style="--0:#24292E;--1:#E1E4E8">type: </span><span style="--0:#032F62;--1:#9ECBFF">"object"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">        </span></span><span style="--0:#24292E;--1:#E1E4E8">properties: {</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">          </span></span><span style="--0:#24292E;--1:#E1E4E8">company: { type: </span><span style="--0:#032F62;--1:#9ECBFF">"string"</span><span style="--0:#24292E;--1:#E1E4E8">, description: </span><span style="--0:#032F62;--1:#9ECBFF">"Company name"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">          </span></span><span style="--0:#24292E;--1:#E1E4E8">founded: { type: </span><span style="--0:#032F62;--1:#9ECBFF">"number"</span><span style="--0:#24292E;--1:#E1E4E8">, description: </span><span style="--0:#032F62;--1:#9ECBFF">"Year founded"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">          </span></span><span style="--0:#24292E;--1:#E1E4E8">products: {</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">            </span></span><span style="--0:#24292E;--1:#E1E4E8">type: </span><span style="--0:#032F62;--1:#9ECBFF">"array"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">            </span></span><span style="--0:#24292E;--1:#E1E4E8">items: { type: </span><span style="--0:#032F62;--1:#9ECBFF">"string"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">            </span></span><span style="--0:#24292E;--1:#E1E4E8">description: </span><span style="--0:#032F62;--1:#9ECBFF">"Main products"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">          </span></span><span style="--0:#24292E;--1:#E1E4E8">},</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">        </span></span><span style="--0:#24292E;--1:#E1E4E8">},</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">        </span></span><span style="--0:#24292E;--1:#E1E4E8">required: [</span><span style="--0:#032F62;--1:#9ECBFF">"company"</span><span style="--0:#24292E;--1:#E1E4E8">, </span><span style="--0:#032F62;--1:#9ECBFF">"founded"</span><span style="--0:#24292E;--1:#E1E4E8">],</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">      </span></span><span style="--0:#24292E;--1:#E1E4E8">},</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">},</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">},</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Access the structured output</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">console.</span><span style="--0:#6F42C1;--1:#B392F0">log</span><span style="--0:#24292E;--1:#E1E4E8">(result.data.info.structured_output)</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// { company: "Anthropic", founded: 2021, products: ["Claude", "Claude API"] }</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="const result = await client.session.prompt({  path: { id: sessionId },  body: {    parts: [{ type: &#x22;text&#x22;, text: &#x22;Research Anthropic and provide company info&#x22; }],    format: {      type: &#x22;json_schema&#x22;,      schema: {        type: &#x22;object&#x22;,        properties: {          company: { type: &#x22;string&#x22;, description: &#x22;Company name&#x22; },          founded: { type: &#x22;number&#x22;, description: &#x22;Year founded&#x22; },          products: {            type: &#x22;array&#x22;,            items: { type: &#x22;string&#x22; },            description: &#x22;Main products&#x22;,          },        },        required: [&#x22;company&#x22;, &#x22;founded&#x22;],      },    },  },})// Access the structured outputconsole.log(result.data.info.structured_output)// { company: &#x22;Anthropic&#x22;, founded: 2021, products: [&#x22;Claude&#x22;, &#x22;Claude API&#x22;] }"><div></div></button></div></figure></div>\n<h3 id="輸出格式型別"><a href="#輸出格式型別">輸出格式型別</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>型別</th><th>描述</th></tr></thead><tbody><tr><td><code dir="auto">text</code></td><td>預設值。標準文字回應（無結構化輸出）</td></tr><tr><td><code dir="auto">json_schema</code></td><td>回傳符合所提供 Schema 的經過驗證的 JSON</td></tr></tbody></table>\n<h3 id="json-schema-格式"><a href="#json-schema-格式">JSON Schema 格式</a></h3>\n<p>使用 <code dir="auto">type: \'json_schema\'</code> 時，需提供以下欄位：</p>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>欄位</th><th>型別</th><th>描述</th></tr></thead><tbody><tr><td><code dir="auto">type</code></td><td><code dir="auto">\'json_schema\'</code></td><td>必填。指定 JSON Schema 模式</td></tr><tr><td><code dir="auto">schema</code></td><td><code dir="auto">object</code></td><td>必填。定義輸出結構的 JSON Schema 物件</td></tr><tr><td><code dir="auto">retryCount</code></td><td><code dir="auto">number</code></td><td>選填。驗證重試次數（預設值：2）</td></tr></tbody></table>\n<h3 id="錯誤處理-1"><a href="#錯誤處理-1">錯誤處理</a></h3>\n<p>如果模型在所有重試後仍無法產生有效的結構化輸出，回應中會包含 <code dir="auto">StructuredOutputError</code>：</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="typescript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">if</span><span style="--0:#24292E;--1:#E1E4E8"> (result.data.info.error?.name </span><span style="--0:#BF3441;--1:#F97583">===</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">"StructuredOutputError"</span><span style="--0:#24292E;--1:#E1E4E8">) {</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">console.</span><span style="--0:#6F42C1;--1:#B392F0">error</span><span style="--0:#24292E;--1:#E1E4E8">(</span><span style="--0:#032F62;--1:#9ECBFF">"Failed to produce structured output:"</span><span style="--0:#24292E;--1:#E1E4E8">, result.data.info.error.message)</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">console.</span><span style="--0:#6F42C1;--1:#B392F0">error</span><span style="--0:#24292E;--1:#E1E4E8">(</span><span style="--0:#032F62;--1:#9ECBFF">"Attempts:"</span><span style="--0:#24292E;--1:#E1E4E8">, result.data.info.error.retries)</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">}</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="if (result.data.info.error?.name === &#x22;StructuredOutputError&#x22;) {  console.error(&#x22;Failed to produce structured output:&#x22;, result.data.info.error.message)  console.error(&#x22;Attempts:&#x22;, result.data.info.error.retries)}"><div></div></button></div></figure></div>\n<h3 id="最佳實務"><a href="#最佳實務">最佳實務</a></h3>\n<ol>\n<li><strong>在 Schema 屬性中提供清晰的描述</strong>，幫助模型理解需要擷取的資料</li>\n<li><strong>使用 <code dir="auto">required</code></strong> 指定哪些欄位必須存在</li>\n<li><strong>保持 Schema 簡潔</strong> — 複雜的巢狀 Schema 可能會讓模型更難正確填充</li>\n<li><strong>設定合適的 <code dir="auto">retryCount</code></strong> — 對於複雜 Schema 可增加重試次數，對於簡單 Schema 可減少</li>\n</ol>\n<hr>\n<h2 id="api"><a href="#api">API</a></h2>\n<p>SDK 透過型別安全的用戶端公開所有伺服器 API。</p>\n<hr>\n<h3 id="global"><a href="#global">Global</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>方法</th><th>描述</th><th>回應</th></tr></thead><tbody><tr><td><code dir="auto">global.health()</code></td><td>檢查伺服器健康狀態和版本</td><td><code dir="auto">{ healthy: true, version: string }</code></td></tr></tbody></table>\n<hr>\n<h4 id="範例"><a href="#範例">範例</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">health</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.global.</span><span style="--0:#6F42C1;--1:#B392F0">health</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">console.</span><span style="--0:#6F42C1;--1:#B392F0">log</span><span style="--0:#24292E;--1:#E1E4E8">(health.data.version)</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="const health = await client.global.health()console.log(health.data.version)"><div></div></button></div></figure></div>\n<hr>\n<h3 id="app"><a href="#app">App</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "方法",
                }),
                createVNode(_components.th, {
                  children: "描述",
                }),
                createVNode(_components.th, {
                  children: "回應",
                }),
              ],
            }),
          }),
          createVNode(_components.tbody, {
            children: [
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "app.log()",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "寫入一筆日誌",
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "boolean",
                    }),
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "app.agents()",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "列出所有可用的代理",
                  }),
                  createVNode(_components.td, {
                    children: createVNode("a", {
                      href: typesUrl,
                      "set:html": "<code>Agent[]</code>",
                    }),
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h4 id="範例-1"><a href="#範例-1">範例</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// 寫入一筆日誌</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.app.</span><span style="--0:#6F42C1;--1:#B392F0">log</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">body: {</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">service: </span><span style="--0:#032F62;--1:#9ECBFF">"my-app"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">level: </span><span style="--0:#032F62;--1:#9ECBFF">"info"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">message: </span><span style="--0:#032F62;--1:#9ECBFF">"Operation completed"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">},</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// 列出可用的代理</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">agents</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.app.</span><span style="--0:#6F42C1;--1:#B392F0">agents</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="// 寫入一筆日誌await client.app.log({  body: {    service: &#x22;my-app&#x22;,    level: &#x22;info&#x22;,    message: &#x22;Operation completed&#x22;,  },})// 列出可用的代理const agents = await client.app.agents()"><div></div></button></div></figure></div>\n<hr>\n<h3 id="project"><a href="#project">Project</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "方法",
                }),
                createVNode(_components.th, {
                  children: "描述",
                }),
                createVNode(_components.th, {
                  children: "回應",
                }),
              ],
            }),
          }),
          createVNode(_components.tbody, {
            children: [
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "project.list()",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "列出所有專案",
                  }),
                  createVNode(_components.td, {
                    children: createVNode("a", {
                      href: typesUrl,
                      "set:html": "<code>Project[]</code>",
                    }),
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "project.current()",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "取得當前專案",
                  }),
                  createVNode(_components.td, {
                    children: createVNode("a", {
                      href: typesUrl,
                      "set:html": "<code>Project</code>",
                    }),
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h4 id="範例-2"><a href="#範例-2">範例</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// List all projects</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">projects</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.project.</span><span style="--0:#6F42C1;--1:#B392F0">list</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Get current project</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">currentProject</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.project.</span><span style="--0:#6F42C1;--1:#B392F0">current</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="// List all projectsconst projects = await client.project.list()// Get current projectconst currentProject = await client.project.current()"><div></div></button></div></figure></div>\n<hr>\n<h3 id="path"><a href="#path">Path</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "方法",
                }),
                createVNode(_components.th, {
                  children: "描述",
                }),
                createVNode(_components.th, {
                  children: "回應",
                }),
              ],
            }),
          }),
          createVNode(_components.tbody, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.td, {
                  children: createVNode(_components.code, {
                    dir: "auto",
                    children: "path.get()",
                  }),
                }),
                createVNode(_components.td, {
                  children: "取得當前路徑",
                }),
                createVNode(_components.td, {
                  children: createVNode("a", {
                    href: typesUrl,
                    "set:html": "<code>Path</code>",
                  }),
                }),
              ],
            }),
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h4 id="範例-3"><a href="#範例-3">範例</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// 取得當前路徑資訊</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">pathInfo</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.path.</span><span style="--0:#6F42C1;--1:#B392F0">get</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="// 取得當前路徑資訊const pathInfo = await client.path.get()"><div></div></button></div></figure></div>\n<hr>\n<h3 id="config"><a href="#config">Config</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "方法",
                }),
                createVNode(_components.th, {
                  children: "描述",
                }),
                createVNode(_components.th, {
                  children: "回應",
                }),
              ],
            }),
          }),
          createVNode(_components.tbody, {
            children: [
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "config.get()",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "取得設定資訊",
                  }),
                  createVNode(_components.td, {
                    children: createVNode("a", {
                      href: typesUrl,
                      "set:html": "<code>Config</code>",
                    }),
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "config.providers()",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "列出供應商和預設模型",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ providers: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>Provider[]</code>",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": ", default: { [key: string]: string } }",
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h4 id="範例-4"><a href="#範例-4">範例</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">config</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.config.</span><span style="--0:#6F42C1;--1:#B392F0">get</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> { </span><span style="--0:#005CC5;--1:#79B8FF">providers</span><span style="--0:#24292E;--1:#E1E4E8">, </span><span style="--0:#AE4B07;--1:#FFAB70">default</span><span style="--0:#24292E;--1:#E1E4E8">: </span><span style="--0:#005CC5;--1:#79B8FF">defaults</span><span style="--0:#24292E;--1:#E1E4E8"> } </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.config.</span><span style="--0:#6F42C1;--1:#B392F0">providers</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="const config = await client.config.get()const { providers, default: defaults } = await client.config.providers()"><div></div></button></div></figure></div>\n<hr>\n<h3 id="sessions"><a href="#sessions">Sessions</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "方法",
                }),
                createVNode(_components.th, {
                  children: "描述",
                }),
                createVNode(_components.th, {
                  children: "備註",
                }),
              ],
            }),
          }),
          createVNode(_components.tbody, {
            children: [
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "session.list()",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "列出工作階段",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "回傳 ",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>Session[]</code>",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "session.get({ path })",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "取得工作階段",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "回傳 ",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>Session</code>",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "session.children({ path })",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "列出子工作階段",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "回傳 ",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>Session[]</code>",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "session.create({ body })",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "建立工作階段",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "回傳 ",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>Session</code>",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                "set:html":
                  '<td><code dir="auto">session.delete({ path })</code></td><td>刪除工作階段</td><td>回傳 <code dir="auto">boolean</code></td>',
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "session.update({ path, body })",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "更新工作階段屬性",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "回傳 ",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>Session</code>",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(Fragment$1, {
                "set:html":
                  '<tr><td><code dir="auto">session.init({ path, body })</code></td><td>分析應用程式並建立 <code dir="auto">AGENTS.md</code></td><td>回傳 <code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">session.abort({ path })</code></td><td>中止正在執行的工作階段</td><td>回傳 <code dir="auto">boolean</code></td></tr>',
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "session.share({ path })",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "分享工作階段",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "回傳 ",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>Session</code>",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "session.unshare({ path })",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "取消分享工作階段",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "回傳 ",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>Session</code>",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                "set:html":
                  '<td><code dir="auto">session.summarize({ path, body })</code></td><td>摘要工作階段</td><td>回傳 <code dir="auto">boolean</code></td>',
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "session.messages({ path })",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "列出工作階段中的訊息",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "回傳 ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ info: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>Message</code>",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": ", parts: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>Part[]</code>",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": "}[]",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "session.message({ path })",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "取得訊息詳情",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "回傳 ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ info: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>Message</code>",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": ", parts: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>Part[]</code>",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": "}",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "session.prompt({ path, body })",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "傳送提示訊息",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "body.noReply: true",
                      }),
                      " 回傳 UserMessage（僅注入上下文）。預設回傳帶有 AI 回應的 ",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>AssistantMessage</code>",
                      }),
                      "。支援透過 ",
                      createVNode(Fragment$1, {
                        "set:html":
                          '<code dir="auto">body.outputFormat</code> 使用<a href="#%E7%B5%90%E6%A7%8B%E5%8C%96%E8%BC%B8%E5%87%BA">結構化輸出</a>',
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "session.command({ path, body })",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "向工作階段傳送指令",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "回傳 ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ info: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>AssistantMessage</code>",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": ", parts: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>Part[]</code>",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": "}",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "session.shell({ path, body })",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "執行 shell 指令",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "回傳 ",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>AssistantMessage</code>",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "session.revert({ path, body })",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "還原訊息",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "回傳 ",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>Session</code>",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "session.unrevert({ path })",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "恢復已還原的訊息",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "回傳 ",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>Session</code>",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                "set:html":
                  '<td><code dir="auto">postSessionByIdPermissionsByPermissionId({ path, body })</code></td><td>回覆權限請求</td><td>回傳 <code dir="auto">boolean</code></td>',
              }),
            ],
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h4 id="範例-5"><a href="#範例-5">範例</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Create and manage sessions</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">session</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.session.</span><span style="--0:#6F42C1;--1:#B392F0">create</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">body: { title: </span><span style="--0:#032F62;--1:#9ECBFF">"My session"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">sessions</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.session.</span><span style="--0:#6F42C1;--1:#B392F0">list</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Send a prompt message</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">result</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.session.</span><span style="--0:#6F42C1;--1:#B392F0">prompt</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">path: { id: session.id },</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">body: {</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">model: { providerID: </span><span style="--0:#032F62;--1:#9ECBFF">"anthropic"</span><span style="--0:#24292E;--1:#E1E4E8">, modelID: </span><span style="--0:#032F62;--1:#9ECBFF">"claude-3-5-sonnet-20241022"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">parts: [{ type: </span><span style="--0:#032F62;--1:#9ECBFF">"text"</span><span style="--0:#24292E;--1:#E1E4E8">, text: </span><span style="--0:#032F62;--1:#9ECBFF">"Hello!"</span><span style="--0:#24292E;--1:#E1E4E8"> }],</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">},</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Inject context without triggering AI response (useful for plugins)</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.session.</span><span style="--0:#6F42C1;--1:#B392F0">prompt</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">path: { id: session.id },</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">body: {</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">noReply: </span><span style="--0:#005CC5;--1:#79B8FF">true</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">parts: [{ type: </span><span style="--0:#032F62;--1:#9ECBFF">"text"</span><span style="--0:#24292E;--1:#E1E4E8">, text: </span><span style="--0:#032F62;--1:#9ECBFF">"You are a helpful assistant."</span><span style="--0:#24292E;--1:#E1E4E8"> }],</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">},</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="// Create and manage sessionsconst session = await client.session.create({  body: { title: &#x22;My session&#x22; },})const sessions = await client.session.list()// Send a prompt messageconst result = await client.session.prompt({  path: { id: session.id },  body: {    model: { providerID: &#x22;anthropic&#x22;, modelID: &#x22;claude-3-5-sonnet-20241022&#x22; },    parts: [{ type: &#x22;text&#x22;, text: &#x22;Hello!&#x22; }],  },})// Inject context without triggering AI response (useful for plugins)await client.session.prompt({  path: { id: session.id },  body: {    noReply: true,    parts: [{ type: &#x22;text&#x22;, text: &#x22;You are a helpful assistant.&#x22; }],  },})"><div></div></button></div></figure></div>\n<hr>\n<h3 id="files"><a href="#files">Files</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "方法",
                }),
                createVNode(_components.th, {
                  children: "描述",
                }),
                createVNode(_components.th, {
                  children: "回應",
                }),
              ],
            }),
          }),
          createVNode(_components.tbody, {
            children: [
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "find.text({ query })",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "搜尋檔案中的文字",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "包含 ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "path",
                      }),
                      "、",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "lines",
                      }),
                      "、",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "line_number",
                      }),
                      "、",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "absolute_offset",
                      }),
                      "、",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "submatches",
                      }),
                      " 的比對物件陣列",
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "find.files({ query })",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "按名稱尋找檔案和目錄",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "string[]",
                      }),
                      "（路徑）",
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "find.symbols({ query })",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "尋找工作區符號",
                  }),
                  createVNode(_components.td, {
                    children: createVNode("a", {
                      href: typesUrl,
                      "set:html": "<code>Symbol[]</code>",
                    }),
                  }),
                ],
              }),
              createVNode(_components.tr, {
                "set:html":
                  '<td><code dir="auto">file.read({ query })</code></td><td>讀取檔案</td><td><code dir="auto">{ type: "raw" | "patch", content: string }</code></td>',
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "file.status({ query? })",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "取得已追蹤檔案的狀態",
                  }),
                  createVNode(_components.td, {
                    children: createVNode("a", {
                      href: typesUrl,
                      "set:html": "<code>File[]</code>",
                    }),
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<p><code dir="auto">find.files</code> 支援以下選填的查詢欄位：</p>\n<ul>\n<li><code dir="auto">type</code>：<code dir="auto">"file"</code> 或 <code dir="auto">"directory"</code></li>\n<li><code dir="auto">directory</code>：覆寫搜尋的專案根目錄</li>\n<li><code dir="auto">limit</code>：最大結果數（1–200）</li>\n</ul>\n<hr>\n<h4 id="範例-6"><a href="#範例-6">範例</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// 搜尋和讀取檔案</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">textResults</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.find.</span><span style="--0:#6F42C1;--1:#B392F0">text</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">query: { pattern: </span><span style="--0:#032F62;--1:#9ECBFF">"function.*slopcode"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">files</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.find.</span><span style="--0:#6F42C1;--1:#B392F0">files</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">query: { query: </span><span style="--0:#032F62;--1:#9ECBFF">"*.ts"</span><span style="--0:#24292E;--1:#E1E4E8">, type: </span><span style="--0:#032F62;--1:#9ECBFF">"file"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">directories</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.find.</span><span style="--0:#6F42C1;--1:#B392F0">files</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">query: { query: </span><span style="--0:#032F62;--1:#9ECBFF">"packages"</span><span style="--0:#24292E;--1:#E1E4E8">, type: </span><span style="--0:#032F62;--1:#9ECBFF">"directory"</span><span style="--0:#24292E;--1:#E1E4E8">, limit: </span><span style="--0:#005CC5;--1:#79B8FF">20</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">content</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.file.</span><span style="--0:#6F42C1;--1:#B392F0">read</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">query: { path: </span><span style="--0:#032F62;--1:#9ECBFF">"src/index.ts"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="// 搜尋和讀取檔案const textResults = await client.find.text({  query: { pattern: &#x22;function.*slopcode&#x22; },})const files = await client.find.files({  query: { query: &#x22;*.ts&#x22;, type: &#x22;file&#x22; },})const directories = await client.find.files({  query: { query: &#x22;packages&#x22;, type: &#x22;directory&#x22;, limit: 20 },})const content = await client.file.read({  query: { path: &#x22;src/index.ts&#x22; },})"><div></div></button></div></figure></div>\n<hr>\n<h3 id="tui"><a href="#tui">TUI</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>方法</th><th>描述</th><th>回應</th></tr></thead><tbody><tr><td><code dir="auto">tui.appendPrompt({ body })</code></td><td>向提示詞追加文字</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.openHelp()</code></td><td>開啟說明對話框</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.openSessions()</code></td><td>開啟工作階段選擇器</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.openThemes()</code></td><td>開啟主題選擇器</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.openModels()</code></td><td>開啟模型選擇器</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.submitPrompt()</code></td><td>送出當前提示詞</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.clearPrompt()</code></td><td>清除提示詞</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.executeCommand({ body })</code></td><td>執行指令</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.showToast({ body })</code></td><td>顯示 Toast 通知</td><td><code dir="auto">boolean</code></td></tr></tbody></table>\n<hr>\n<h4 id="範例-7"><a href="#範例-7">範例</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// 控制 TUI 介面</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.tui.</span><span style="--0:#6F42C1;--1:#B392F0">appendPrompt</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">body: { text: </span><span style="--0:#032F62;--1:#9ECBFF">"Add this to prompt"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.tui.</span><span style="--0:#6F42C1;--1:#B392F0">showToast</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">body: { message: </span><span style="--0:#032F62;--1:#9ECBFF">"Task completed"</span><span style="--0:#24292E;--1:#E1E4E8">, variant: </span><span style="--0:#032F62;--1:#9ECBFF">"success"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="// 控制 TUI 介面await client.tui.appendPrompt({  body: { text: &#x22;Add this to prompt&#x22; },})await client.tui.showToast({  body: { message: &#x22;Task completed&#x22;, variant: &#x22;success&#x22; },})"><div></div></button></div></figure></div>\n<hr>\n<h3 id="auth"><a href="#auth">Auth</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>方法</th><th>描述</th><th>回應</th></tr></thead><tbody><tr><td><code dir="auto">auth.set({ ... })</code></td><td>設定驗證憑證</td><td><code dir="auto">boolean</code></td></tr></tbody></table>\n<hr>\n<h4 id="範例-8"><a href="#範例-8">範例</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.auth.</span><span style="--0:#6F42C1;--1:#B392F0">set</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">path: { id: </span><span style="--0:#032F62;--1:#9ECBFF">"anthropic"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">body: { type: </span><span style="--0:#032F62;--1:#9ECBFF">"api"</span><span style="--0:#24292E;--1:#E1E4E8">, key: </span><span style="--0:#032F62;--1:#9ECBFF">"your-api-key"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="await client.auth.set({  path: { id: &#x22;anthropic&#x22; },  body: { type: &#x22;api&#x22;, key: &#x22;your-api-key&#x22; },})"><div></div></button></div></figure></div>\n<hr>\n<h3 id="events"><a href="#events">Events</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>方法</th><th>描述</th><th>回應</th></tr></thead><tbody><tr><td><code dir="auto">event.subscribe()</code></td><td>伺服器傳送的事件串流</td><td>伺服器傳送的事件串流</td></tr></tbody></table>\n<hr>\n<h4 id="範例-9"><a href="#範例-9">範例</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Listen to real-time events</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">events</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.event.</span><span style="--0:#6F42C1;--1:#B392F0">subscribe</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">for</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> (</span><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">event</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">of</span><span style="--0:#24292E;--1:#E1E4E8"> events.stream) {</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">console.</span><span style="--0:#6F42C1;--1:#B392F0">log</span><span style="--0:#24292E;--1:#E1E4E8">(</span><span style="--0:#032F62;--1:#9ECBFF">"Event:"</span><span style="--0:#24292E;--1:#E1E4E8">, event.type, event.properties)</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">}</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="// Listen to real-time eventsconst events = await client.event.subscribe()for await (const event of events.stream) {  console.log(&#x22;Event:&#x22;, event.type, event.properties)}"><div></div></button></div></figure></div>',
      }),
    ],
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

const url = "src/content/docs/zh-tw/sdk.mdx"
const file = "/app/packages/web/src/content/docs/zh-tw/sdk.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/app/packages/web/src/content/docs/zh-tw/sdk.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, typesUrl, url }
