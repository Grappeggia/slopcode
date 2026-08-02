globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"
import { c as config } from "./config_UI6PtV27.mjs"

const frontmatter = {
  title: "SDK",
  description: "SlopCode サーバー用の型安全な JS クライアント。",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "インストール",
      text: "インストール",
    },
    {
      depth: 2,
      slug: "クライアントの作成",
      text: "クライアントの作成",
    },
    {
      depth: 4,
      slug: "オプション",
      text: "オプション",
    },
    {
      depth: 2,
      slug: "設定",
      text: "設定",
    },
    {
      depth: 2,
      slug: "クライアントのみ",
      text: "クライアントのみ",
    },
    {
      depth: 4,
      slug: "オプション-1",
      text: "オプション",
    },
    {
      depth: 2,
      slug: "型定義",
      text: "型定義",
    },
    {
      depth: 2,
      slug: "エラー",
      text: "エラー",
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
      slug: "例",
      text: "例",
    },
    {
      depth: 3,
      slug: "app",
      text: "App",
    },
    {
      depth: 4,
      slug: "例-1",
      text: "例",
    },
    {
      depth: 3,
      slug: "project",
      text: "Project",
    },
    {
      depth: 4,
      slug: "例-2",
      text: "例",
    },
    {
      depth: 3,
      slug: "path",
      text: "Path",
    },
    {
      depth: 4,
      slug: "例-3",
      text: "例",
    },
    {
      depth: 3,
      slug: "config",
      text: "Config",
    },
    {
      depth: 4,
      slug: "例-4",
      text: "例",
    },
    {
      depth: 3,
      slug: "sessions",
      text: "Sessions",
    },
    {
      depth: 4,
      slug: "例-5",
      text: "例",
    },
    {
      depth: 3,
      slug: "files",
      text: "Files",
    },
    {
      depth: 4,
      slug: "例-6",
      text: "例",
    },
    {
      depth: 3,
      slug: "tui",
      text: "TUI",
    },
    {
      depth: 4,
      slug: "例-7",
      text: "例",
    },
    {
      depth: 3,
      slug: "auth",
      text: "Auth",
    },
    {
      depth: 4,
      slug: "例-8",
      text: "例",
    },
    {
      depth: 3,
      slug: "events",
      text: "Events",
    },
    {
      depth: 4,
      slug: "例-9",
      text: "例",
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
          '<p>SlopCode JS/TS SDK は、サーバーと対話するための型安全なクライアントを提供します。\nこれを使用して、統合を構築し、SlopCode をプログラムで制御します。</p>\n<p><a href="/docs/server">サーバーの仕組みについての詳細</a> をご覧ください。たとえば、コミュニティによって構築された <a href="/docs/ecosystem#projects">projects</a> をチェックしてください。</p>\n<hr>\n<h2 id="インストール"><a href="#インストール">インストール</a></h2>\n<p>npm から SDK をインストールします。</p>\n<div class="expressive-code"><link rel="stylesheet" href="/docs/_astro/ec.4c0k7.css"><script type="module" src="/docs/_astro/ec.0vx5m.js"></script><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">npm</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">@slopcode-ai/sdk</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="npm install @slopcode-ai/sdk"><div></div></button></div></figure></div>\n<hr>\n<h2 id="クライアントの作成"><a href="#クライアントの作成">クライアントの作成</a></h2>\n<p>SlopCode のインスタンスを作成します。</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">import</span><span style="--0:#24292E;--1:#E1E4E8"> { createSlopcode } </span><span style="--0:#BF3441;--1:#F97583">from</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">"@slopcode-ai/sdk"</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> { </span><span style="--0:#005CC5;--1:#79B8FF">client</span><span style="--0:#24292E;--1:#E1E4E8"> } </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#6F42C1;--1:#B392F0">createSlopcode</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="import { createSlopcode } from &#x22;@slopcode-ai/sdk&#x22;const { client } = await createSlopcode()"><div></div></button></div></figure></div>\n<p>これにより、サーバーとクライアントの両方が起動します</p>\n<h4 id="オプション"><a href="#オプション">オプション</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>オプション</th><th>タイプ</th><th>説明</th><th>デフォルト</th></tr></thead><tbody><tr><td><code dir="auto">hostname</code></td><td><code dir="auto">string</code></td><td>サーバーのホスト名</td><td><code dir="auto">127.0.0.1</code></td></tr><tr><td><code dir="auto">port</code></td><td><code dir="auto">number</code></td><td>サーバーポート</td><td><code dir="auto">4096</code></td></tr><tr><td><code dir="auto">signal</code></td><td><code dir="auto">AbortSignal</code></td><td>キャンセルのためのアボート信号</td><td><code dir="auto">undefined</code></td></tr><tr><td><code dir="auto">timeout</code></td><td><code dir="auto">number</code></td><td>サーバー起動のタイムアウト (ミリ秒)</td><td><code dir="auto">5000</code></td></tr><tr><td><code dir="auto">config</code></td><td><code dir="auto">Config</code></td><td>設定オブジェクト</td><td><code dir="auto">{}</code></td></tr></tbody></table>\n<hr>\n<h2 id="設定"><a href="#設定">設定</a></h2>\n<p>設定オブジェクトを渡して動作をカスタマイズできます。インスタンスは引き続き <code dir="auto">slopcode.json</code> を取得しますが、設定をインラインでオーバーライドまたは追加することができます。</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">import</span><span style="--0:#24292E;--1:#E1E4E8"> { createSlopcode } </span><span style="--0:#BF3441;--1:#F97583">from</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">"@slopcode-ai/sdk"</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#6F42C1;--1:#B392F0">createSlopcode</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">hostname: </span><span style="--0:#032F62;--1:#9ECBFF">"127.0.0.1"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">port: </span><span style="--0:#005CC5;--1:#79B8FF">4096</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">config: {</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">model: </span><span style="--0:#032F62;--1:#9ECBFF">"anthropic/claude-3-5-sonnet-20241022"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">},</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">console.</span><span style="--0:#6F42C1;--1:#B392F0">log</span><span style="--0:#24292E;--1:#E1E4E8">(</span><span style="--0:#032F62;--1:#9ECBFF">`Server running at ${</span><span style="--0:#24292E;--1:#E1E4E8">slopcode</span><span style="--0:#032F62;--1:#9ECBFF">.</span><span style="--0:#24292E;--1:#E1E4E8">server</span><span style="--0:#032F62;--1:#9ECBFF">.</span><span style="--0:#24292E;--1:#E1E4E8">url</span><span style="--0:#032F62;--1:#9ECBFF">}`</span><span style="--0:#24292E;--1:#E1E4E8">)</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">slopcode.server.</span><span style="--0:#6F42C1;--1:#B392F0">close</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="import { createSlopcode } from &#x22;@slopcode-ai/sdk&#x22;const slopcode = await createSlopcode({  hostname: &#x22;127.0.0.1&#x22;,  port: 4096,  config: {    model: &#x22;anthropic/claude-3-5-sonnet-20241022&#x22;,  },})console.log(&#x60;Server running at ${slopcode.server.url}&#x60;)slopcode.server.close()"><div></div></button></div></figure></div>\n<h2 id="クライアントのみ"><a href="#クライアントのみ">クライアントのみ</a></h2>\n<p>すでに実行中の SlopCode のインスタンスがある場合は、それに接続するためのクライアントインスタンスを作成できます。</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">import</span><span style="--0:#24292E;--1:#E1E4E8"> { createSlopcodeClient } </span><span style="--0:#BF3441;--1:#F97583">from</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">"@slopcode-ai/sdk"</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">client</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#6F42C1;--1:#B392F0">createSlopcodeClient</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">baseUrl: </span><span style="--0:#032F62;--1:#9ECBFF">"http://localhost:4096"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="import { createSlopcodeClient } from &#x22;@slopcode-ai/sdk&#x22;const client = createSlopcodeClient({  baseUrl: &#x22;http://localhost:4096&#x22;,})"><div></div></button></div></figure></div>\n<h4 id="オプション-1"><a href="#オプション-1">オプション</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>オプション</th><th>タイプ</th><th>説明</th><th>デフォルト</th></tr></thead><tbody><tr><td><code dir="auto">baseUrl</code></td><td><code dir="auto">string</code></td><td>サーバーの URL</td><td><code dir="auto">http://localhost:4096</code></td></tr><tr><td><code dir="auto">fetch</code></td><td><code dir="auto">function</code></td><td>カスタムフェッチの実装</td><td><code dir="auto">globalThis.fetch</code></td></tr><tr><td><code dir="auto">parseAs</code></td><td><code dir="auto">string</code></td><td>応答解析方法</td><td><code dir="auto">auto</code></td></tr><tr><td><code dir="auto">responseStyle</code></td><td><code dir="auto">string</code></td><td>戻り値のスタイル: <code dir="auto">data</code> または <code dir="auto">fields</code></td><td><code dir="auto">fields</code></td></tr><tr><td><code dir="auto">throwOnError</code></td><td><code dir="auto">boolean</code></td><td>返す代わりにエラーをスローする</td><td><code dir="auto">false</code></td></tr></tbody></table>\n<hr>\n<h2 id="型定義"><a href="#型定義">型定義</a></h2>\n<p>SDK には、すべての API タイプの TypeScript 定義が含まれています。それらを直接インポートします。</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="typescript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">import</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">type</span><span style="--0:#24292E;--1:#E1E4E8"> { Session, Message, Part } </span><span style="--0:#BF3441;--1:#F97583">from</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">"@slopcode-ai/sdk"</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="import type { Session, Message, Part } from &#x22;@slopcode-ai/sdk&#x22;"><div></div></button></div></figure></div>\n',
      }),
      createVNode(_components.p, {
        children: [
          "すべてのタイプはサーバーの OpenAPI 仕様から生成され、",
          createVNode("a", {
            href: typesUrl,
            "set:html": "タイプファイル",
          }),
          " で使用できます。",
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h2 id="エラー"><a href="#エラー">エラー</a></h2>\n<p>SDK は、キャッチして処理できるエラーをスローできます。</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="typescript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">try</span><span style="--0:#24292E;--1:#E1E4E8"> {</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.session.</span><span style="--0:#6F42C1;--1:#B392F0">get</span><span style="--0:#24292E;--1:#E1E4E8">({ path: { id: </span><span style="--0:#032F62;--1:#9ECBFF">"invalid-id"</span><span style="--0:#24292E;--1:#E1E4E8"> } })</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">} </span><span style="--0:#BF3441;--1:#F97583">catch</span><span style="--0:#24292E;--1:#E1E4E8"> (error) {</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">console.</span><span style="--0:#6F42C1;--1:#B392F0">error</span><span style="--0:#24292E;--1:#E1E4E8">(</span><span style="--0:#032F62;--1:#9ECBFF">"Failed to get session:"</span><span style="--0:#24292E;--1:#E1E4E8">, (error </span><span style="--0:#BF3441;--1:#F97583">as</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#6F42C1;--1:#B392F0">Error</span><span style="--0:#24292E;--1:#E1E4E8">).message)</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">}</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="try {  await client.session.get({ path: { id: &#x22;invalid-id&#x22; } })} catch (error) {  console.error(&#x22;Failed to get session:&#x22;, (error as Error).message)}"><div></div></button></div></figure></div>\n<hr>\n<h2 id="api"><a href="#api">API</a></h2>\n<p>SDK は、型安全なクライアントを通じてすべてのサーバー API を公開します。</p>\n<hr>\n<h3 id="global"><a href="#global">Global</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>メソッド</th><th>説明</th><th>戻り値</th></tr></thead><tbody><tr><td><code dir="auto">global.health()</code></td><td>サーバーの健全性とバージョンを確認する</td><td><code dir="auto">{ healthy: true, version: string }</code></td></tr></tbody></table>\n<hr>\n<h4 id="例"><a href="#例">例</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">health</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.global.</span><span style="--0:#6F42C1;--1:#B392F0">health</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">console.</span><span style="--0:#6F42C1;--1:#B392F0">log</span><span style="--0:#24292E;--1:#E1E4E8">(health.data.version)</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="const health = await client.global.health()console.log(health.data.version)"><div></div></button></div></figure></div>\n<hr>\n<h3 id="app"><a href="#app">App</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "メソッド",
                }),
                createVNode(_components.th, {
                  children: "説明",
                }),
                createVNode(_components.th, {
                  children: "戻り値",
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
                    children: "ログエントリを書き込む",
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
                    children: "利用可能なすべてのエージェントをリストする",
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
          '<hr>\n<h4 id="例-1"><a href="#例-1">例</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Write a log entry</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.app.</span><span style="--0:#6F42C1;--1:#B392F0">log</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">body: {</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">service: </span><span style="--0:#032F62;--1:#9ECBFF">"my-app"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">level: </span><span style="--0:#032F62;--1:#9ECBFF">"info"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">message: </span><span style="--0:#032F62;--1:#9ECBFF">"Operation completed"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">},</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// List available agents</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">agents</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.app.</span><span style="--0:#6F42C1;--1:#B392F0">agents</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="// Write a log entryawait client.app.log({  body: {    service: &#x22;my-app&#x22;,    level: &#x22;info&#x22;,    message: &#x22;Operation completed&#x22;,  },})// List available agentsconst agents = await client.app.agents()"><div></div></button></div></figure></div>\n<hr>\n<h3 id="project"><a href="#project">Project</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "メソッド",
                }),
                createVNode(_components.th, {
                  children: "説明",
                }),
                createVNode(_components.th, {
                  children: "戻り値",
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
                    children: "すべてのプロジェクトをリストする",
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
                    children: "現在のプロジェクトを取得",
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
          '<hr>\n<h4 id="例-2"><a href="#例-2">例</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// List all projects</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">projects</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.project.</span><span style="--0:#6F42C1;--1:#B392F0">list</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Get current project</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">currentProject</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.project.</span><span style="--0:#6F42C1;--1:#B392F0">current</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="// List all projectsconst projects = await client.project.list()// Get current projectconst currentProject = await client.project.current()"><div></div></button></div></figure></div>\n<hr>\n<h3 id="path"><a href="#path">Path</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "メソッド",
                }),
                createVNode(_components.th, {
                  children: "説明",
                }),
                createVNode(_components.th, {
                  children: "戻り値",
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
                  children: "現在のパスを取得",
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
          '<hr>\n<h4 id="例-3"><a href="#例-3">例</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Get current path information</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">pathInfo</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.path.</span><span style="--0:#6F42C1;--1:#B392F0">get</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="// Get current path informationconst pathInfo = await client.path.get()"><div></div></button></div></figure></div>\n<hr>\n<h3 id="config"><a href="#config">Config</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "メソッド",
                }),
                createVNode(_components.th, {
                  children: "説明",
                }),
                createVNode(_components.th, {
                  children: "戻り値",
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
                    children: "設定情報を取得する",
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
                    children: "プロバイダーとデフォルトのモデルをリストする",
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
          '<hr>\n<h4 id="例-4"><a href="#例-4">例</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">config</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.config.</span><span style="--0:#6F42C1;--1:#B392F0">get</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> { </span><span style="--0:#005CC5;--1:#79B8FF">providers</span><span style="--0:#24292E;--1:#E1E4E8">, </span><span style="--0:#AE4B07;--1:#FFAB70">default</span><span style="--0:#24292E;--1:#E1E4E8">: </span><span style="--0:#005CC5;--1:#79B8FF">defaults</span><span style="--0:#24292E;--1:#E1E4E8"> } </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.config.</span><span style="--0:#6F42C1;--1:#B392F0">providers</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="const config = await client.config.get()const { providers, default: defaults } = await client.config.providers()"><div></div></button></div></figure></div>\n<hr>\n<h3 id="sessions"><a href="#sessions">Sessions</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "メソッド",
                }),
                createVNode(_components.th, {
                  children: "説明",
                }),
                createVNode(_components.th, {
                  children: "詳細",
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
                    children: "セッションをリストする",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "戻り値 ",
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
                    children: "セッションを取得",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "戻り値 ",
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
                    children: "子セッションをリストする",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "戻り値 ",
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
                    children: "セッションの作成",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "戻り値 ",
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
                  '<td><code dir="auto">session.delete({ path })</code></td><td>セッションを削除</td><td>戻り値 <code dir="auto">boolean</code></td>',
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
                    children: "セッションのプロパティを更新する",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "戻り値 ",
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
                  '<tr><td><code dir="auto">session.init({ path, body })</code></td><td>アプリを分析して <code dir="auto">AGENTS.md</code> を作成する</td><td>戻り値 <code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">session.abort({ path })</code></td><td>実行中のセッションを中止する</td><td>戻り値 <code dir="auto">boolean</code></td></tr>',
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
                    children: "セッションを共有する",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "戻り値 ",
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
                    children: "セッションの共有を解除",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "戻り値 ",
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
                  '<td><code dir="auto">session.summarize({ path, body })</code></td><td>セッションを要約する</td><td>戻り値 <code dir="auto">boolean</code></td>',
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
                    children: "セッション内のメッセージをリストする",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "戻り値 ",
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
                    children: "メッセージの詳細を取得する",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "戻り値 ",
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
                    children: "プロンプトメッセージを送信する",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "body.noReply: true",
                      }),
                      " は UserMessage (コンテキストのみ) を返します。デフォルトでは、AI 応答を含む ",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>AssistantMessage</code>",
                      }),
                      " を返します。",
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
                    children: "コマンドをセッションに送信",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "戻り値 ",
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
                    children: "シェルコマンドを実行する",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "戻り値 ",
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
                    children: "メッセージを元に戻す",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "戻り値 ",
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
                    children: "元に戻したメッセージを復元する",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "戻り値 ",
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
                  '<td><code dir="auto">postSessionByIdPermissionsByPermissionId({ path, body })</code></td><td>許可リクエストに応答する</td><td>戻り値 <code dir="auto">boolean</code></td>',
              }),
            ],
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h4 id="例-5"><a href="#例-5">例</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Create and manage sessions</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">session</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.session.</span><span style="--0:#6F42C1;--1:#B392F0">create</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">body: { title: </span><span style="--0:#032F62;--1:#9ECBFF">"My session"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">sessions</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.session.</span><span style="--0:#6F42C1;--1:#B392F0">list</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Send a prompt message</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">result</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.session.</span><span style="--0:#6F42C1;--1:#B392F0">prompt</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">path: { id: session.id },</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">body: {</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">model: { providerID: </span><span style="--0:#032F62;--1:#9ECBFF">"anthropic"</span><span style="--0:#24292E;--1:#E1E4E8">, modelID: </span><span style="--0:#032F62;--1:#9ECBFF">"claude-3-5-sonnet-20241022"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">parts: [{ type: </span><span style="--0:#032F62;--1:#9ECBFF">"text"</span><span style="--0:#24292E;--1:#E1E4E8">, text: </span><span style="--0:#032F62;--1:#9ECBFF">"Hello!"</span><span style="--0:#24292E;--1:#E1E4E8"> }],</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">},</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Inject context without triggering AI response (useful for plugins)</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.session.</span><span style="--0:#6F42C1;--1:#B392F0">prompt</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">path: { id: session.id },</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">body: {</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">noReply: </span><span style="--0:#005CC5;--1:#79B8FF">true</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">parts: [{ type: </span><span style="--0:#032F62;--1:#9ECBFF">"text"</span><span style="--0:#24292E;--1:#E1E4E8">, text: </span><span style="--0:#032F62;--1:#9ECBFF">"You are a helpful assistant."</span><span style="--0:#24292E;--1:#E1E4E8"> }],</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">},</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="// Create and manage sessionsconst session = await client.session.create({  body: { title: &#x22;My session&#x22; },})const sessions = await client.session.list()// Send a prompt messageconst result = await client.session.prompt({  path: { id: session.id },  body: {    model: { providerID: &#x22;anthropic&#x22;, modelID: &#x22;claude-3-5-sonnet-20241022&#x22; },    parts: [{ type: &#x22;text&#x22;, text: &#x22;Hello!&#x22; }],  },})// Inject context without triggering AI response (useful for plugins)await client.session.prompt({  path: { id: session.id },  body: {    noReply: true,    parts: [{ type: &#x22;text&#x22;, text: &#x22;You are a helpful assistant.&#x22; }],  },})"><div></div></button></div></figure></div>\n<hr>\n<h3 id="files"><a href="#files">Files</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "メソッド",
                }),
                createVNode(_components.th, {
                  children: "説明",
                }),
                createVNode(_components.th, {
                  children: "戻り値",
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
                    children: "Search for text in files",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "Array of match objects with ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "path",
                      }),
                      ", ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "lines",
                      }),
                      ", ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "line_number",
                      }),
                      ", ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "absolute_offset",
                      }),
                      ", ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "submatches",
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
                      children: "find.files({ query })",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "Find files and directories by name",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "string[]",
                      }),
                      " (paths)",
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
                    children: "Find workspace symbols",
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
                  '<td><code dir="auto">file.read({ query })</code></td><td>Read a file</td><td><code dir="auto">{ type: "raw" | "patch", content: string }</code></td>',
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
                    children: "Get status for tracked files",
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
          '<p><code dir="auto">find.files</code> は、いくつかのオプションのクエリフィールドをサポートしています。</p>\n<ul>\n<li><code dir="auto">type</code>: <code dir="auto">"file"</code> または <code dir="auto">"directory"</code></li>\n<li><code dir="auto">directory</code>: 検索用のプロジェクトルートをオーバーライドします。</li>\n<li><code dir="auto">limit</code>: 最大結果 (1 ～ 200)</li>\n</ul>\n<hr>\n<h4 id="例-6"><a href="#例-6">例</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Search and read files</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">textResults</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.find.</span><span style="--0:#6F42C1;--1:#B392F0">text</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">query: { pattern: </span><span style="--0:#032F62;--1:#9ECBFF">"function.*slopcode"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">files</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.find.</span><span style="--0:#6F42C1;--1:#B392F0">files</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">query: { query: </span><span style="--0:#032F62;--1:#9ECBFF">"*.ts"</span><span style="--0:#24292E;--1:#E1E4E8">, type: </span><span style="--0:#032F62;--1:#9ECBFF">"file"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">directories</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.find.</span><span style="--0:#6F42C1;--1:#B392F0">files</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">query: { query: </span><span style="--0:#032F62;--1:#9ECBFF">"packages"</span><span style="--0:#24292E;--1:#E1E4E8">, type: </span><span style="--0:#032F62;--1:#9ECBFF">"directory"</span><span style="--0:#24292E;--1:#E1E4E8">, limit: </span><span style="--0:#005CC5;--1:#79B8FF">20</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">content</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.file.</span><span style="--0:#6F42C1;--1:#B392F0">read</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">query: { path: </span><span style="--0:#032F62;--1:#9ECBFF">"src/index.ts"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="// Search and read filesconst textResults = await client.find.text({  query: { pattern: &#x22;function.*slopcode&#x22; },})const files = await client.find.files({  query: { query: &#x22;*.ts&#x22;, type: &#x22;file&#x22; },})const directories = await client.find.files({  query: { query: &#x22;packages&#x22;, type: &#x22;directory&#x22;, limit: 20 },})const content = await client.file.read({  query: { path: &#x22;src/index.ts&#x22; },})"><div></div></button></div></figure></div>\n<hr>\n<h3 id="tui"><a href="#tui">TUI</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>メソッド</th><th>説明</th><th>戻り値</th></tr></thead><tbody><tr><td><code dir="auto">tui.appendPrompt({ body })</code></td><td>プロンプトにテキストを追加します</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.openHelp()</code></td><td>ヘルプダイアログを開く</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.openSessions()</code></td><td>セッションセレクターを開く</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.openThemes()</code></td><td>テーマセレクターを開く</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.openModels()</code></td><td>モデルセレクターを開く</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.submitPrompt()</code></td><td>現在のプロンプトを送信します</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.clearPrompt()</code></td><td>プロンプトをクリア</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.executeCommand({ body })</code></td><td>コマンドを実行する</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.showToast({ body })</code></td><td>トースト通知を表示</td><td><code dir="auto">boolean</code></td></tr></tbody></table>\n<hr>\n<h4 id="例-7"><a href="#例-7">例</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Control TUI interface</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.tui.</span><span style="--0:#6F42C1;--1:#B392F0">appendPrompt</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">body: { text: </span><span style="--0:#032F62;--1:#9ECBFF">"Add this to prompt"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.tui.</span><span style="--0:#6F42C1;--1:#B392F0">showToast</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">body: { message: </span><span style="--0:#032F62;--1:#9ECBFF">"Task completed"</span><span style="--0:#24292E;--1:#E1E4E8">, variant: </span><span style="--0:#032F62;--1:#9ECBFF">"success"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="// Control TUI interfaceawait client.tui.appendPrompt({  body: { text: &#x22;Add this to prompt&#x22; },})await client.tui.showToast({  body: { message: &#x22;Task completed&#x22;, variant: &#x22;success&#x22; },})"><div></div></button></div></figure></div>\n<hr>\n<h3 id="auth"><a href="#auth">Auth</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>メソッド</th><th>説明</th><th>戻り値</th></tr></thead><tbody><tr><td><code dir="auto">auth.set({ ... })</code></td><td>認証資格情報を設定する</td><td><code dir="auto">boolean</code></td></tr></tbody></table>\n<hr>\n<h4 id="例-8"><a href="#例-8">例</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.auth.</span><span style="--0:#6F42C1;--1:#B392F0">set</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">path: { id: </span><span style="--0:#032F62;--1:#9ECBFF">"anthropic"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">body: { type: </span><span style="--0:#032F62;--1:#9ECBFF">"api"</span><span style="--0:#24292E;--1:#E1E4E8">, key: </span><span style="--0:#032F62;--1:#9ECBFF">"your-api-key"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="await client.auth.set({  path: { id: &#x22;anthropic&#x22; },  body: { type: &#x22;api&#x22;, key: &#x22;your-api-key&#x22; },})"><div></div></button></div></figure></div>\n<hr>\n<h3 id="events"><a href="#events">Events</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>メソッド</th><th>説明</th><th>戻り値</th></tr></thead><tbody><tr><td><code dir="auto">event.subscribe()</code></td><td>サーバー送信イベントストリーム</td><td>サーバー送信イベントストリーム</td></tr></tbody></table>\n<hr>\n<h4 id="例-9"><a href="#例-9">例</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Listen to real-time events</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">events</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.event.</span><span style="--0:#6F42C1;--1:#B392F0">subscribe</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">for</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> (</span><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">event</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">of</span><span style="--0:#24292E;--1:#E1E4E8"> events.stream) {</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">console.</span><span style="--0:#6F42C1;--1:#B392F0">log</span><span style="--0:#24292E;--1:#E1E4E8">(</span><span style="--0:#032F62;--1:#9ECBFF">"Event:"</span><span style="--0:#24292E;--1:#E1E4E8">, event.type, event.properties)</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">}</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="// Listen to real-time eventsconst events = await client.event.subscribe()for await (const event of events.stream) {  console.log(&#x22;Event:&#x22;, event.type, event.properties)}"><div></div></button></div></figure></div>',
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

const url = "src/content/docs/ja/sdk.mdx"
const file = "/app/packages/web/src/content/docs/ja/sdk.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/app/packages/web/src/content/docs/ja/sdk.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, typesUrl, url }
