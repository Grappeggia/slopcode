globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"
import { c as config } from "./config_UI6PtV27.mjs"

const frontmatter = {
  title: "サーバー",
  description: "HTTP 経由で SlopCode サーバーと通信します。",
}
function getHeadings() {
  return [
    {
      depth: 3,
      slug: "使用法",
      text: "使用法",
    },
    {
      depth: 4,
      slug: "オプション",
      text: "オプション",
    },
    {
      depth: 3,
      slug: "認証",
      text: "認証",
    },
    {
      depth: 3,
      slug: "仕組み",
      text: "仕組み",
    },
    {
      depth: 4,
      slug: "既存のサーバーに接続する",
      text: "既存のサーバーに接続する",
    },
    {
      depth: 2,
      slug: "仕様",
      text: "仕様",
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
      depth: 3,
      slug: "project",
      text: "Project",
    },
    {
      depth: 3,
      slug: "path-and-vcs",
      text: "Path and VCS",
    },
    {
      depth: 3,
      slug: "instance",
      text: "Instance",
    },
    {
      depth: 3,
      slug: "config",
      text: "Config",
    },
    {
      depth: 3,
      slug: "プロバイダー",
      text: "プロバイダー",
    },
    {
      depth: 3,
      slug: "session",
      text: "Session",
    },
    {
      depth: 3,
      slug: "message",
      text: "Message",
    },
    {
      depth: 3,
      slug: "command",
      text: "Command",
    },
    {
      depth: 3,
      slug: "file",
      text: "File",
    },
    {
      depth: 4,
      slug: "findfile-クエリパラメータ",
      text: "/find/file クエリパラメータ",
    },
    {
      depth: 3,
      slug: "tool-experimental",
      text: "Tool (Experimental)",
    },
    {
      depth: 3,
      slug: "lsp-formatter-mcp",
      text: "LSP, Formatter, MCP",
    },
    {
      depth: 3,
      slug: "agent",
      text: "Agent",
    },
    {
      depth: 3,
      slug: "logging",
      text: "Logging",
    },
    {
      depth: 3,
      slug: "tui",
      text: "TUI",
    },
    {
      depth: 3,
      slug: "auth",
      text: "Auth",
    },
    {
      depth: 3,
      slug: "event",
      text: "Event",
    },
    {
      depth: 3,
      slug: "documentation",
      text: "Documentation",
    },
  ]
}
const typesUrl = `${config.github}/blob/dev/packages/sdk/js/src/gen/types.gen.ts`
function _createMdxContent(props) {
  const _components = {
      code: "code",
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
          '<p><code dir="auto">slopcode serve</code> コマンドは、SlopCode クライアントが使用できる OpenAPI エンドポイントを公開するヘッドレス HTTP サーバーを実行します。</p>\n<hr>\n<h3 id="使用法"><a href="#使用法">使用法</a></h3>\n<div class="expressive-code"><link rel="stylesheet" href="/docs/_astro/ec.4c0k7.css"><script type="module" src="/docs/_astro/ec.0vx5m.js"></script><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">serve</span><span style="--0:#24292E;--1:#E1E4E8"> [--port </span><span style="--0:#032F62;--1:#9ECBFF">&#x3C;number>]</span><span style="--0:#24292E;--1:#E1E4E8"> [--hostname </span><span style="--0:#032F62;--1:#9ECBFF">&#x3C;string>]</span><span style="--0:#24292E;--1:#E1E4E8"> [--cors </span><span style="--0:#032F62;--1:#9ECBFF">&#x3C;origin>]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode serve [--port <number>] [--hostname <string>] [--cors <origin>]"><div></div></button></div></figure></div>\n<h4 id="オプション"><a href="#オプション">オプション</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>フラグ</th><th>説明</th><th>デフォルト</th></tr></thead><tbody><tr><td><code dir="auto">--port</code></td><td>リッスンするポート</td><td><code dir="auto">4096</code></td></tr><tr><td><code dir="auto">--hostname</code></td><td>リッスンするホスト名</td><td><code dir="auto">127.0.0.1</code></td></tr><tr><td><code dir="auto">--mdns</code></td><td>mDNS 検出を有効にする</td><td><code dir="auto">false</code></td></tr><tr><td><code dir="auto">--mdns-domain</code></td><td>mDNS サービスのカスタムドメイン名</td><td><code dir="auto">slopcode.local</code></td></tr><tr><td><code dir="auto">--cors</code></td><td>許可する追加のブラウザーオリジン</td><td><code dir="auto">[]</code></td></tr></tbody></table>\n<p><code dir="auto">--cors</code> は複数回渡すことができます。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">serve</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--cors</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">http://localhost:5173</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--cors</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">https://app.example.com</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode serve --cors http://localhost:5173 --cors https://app.example.com"><div></div></button></div></figure></div>\n<hr>\n<h3 id="認証"><a href="#認証">認証</a></h3>\n<p>HTTP 基本認証でサーバーを保護するには、<code dir="auto">SLOPCODE_SERVER_PASSWORD</code> を設定します。ユーザー名はデフォルトで <code dir="auto">slopcode</code> になるか、<code dir="auto">SLOPCODE_SERVER_USERNAME</code> を設定してオーバーライドします。これは、<code dir="auto">slopcode serve</code> と <code dir="auto">slopcode web</code> の両方に当てはまります。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">SLOPCODE_SERVER_PASSWORD</span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#032F62;--1:#9ECBFF">your-password</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">serve</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="SLOPCODE_SERVER_PASSWORD=your-password slopcode serve"><div></div></button></div></figure></div>\n<hr>\n<h3 id="仕組み"><a href="#仕組み">仕組み</a></h3>\n<p><code dir="auto">slopcode</code> を実行すると、TUI とサーバーが起動します。 TUI はサーバーと通信するクライアントです。サーバーは OpenAPI 3.1 仕様のエンドポイントを公開します。このエンドポイントは、<a href="/docs/sdk">SDK</a> を使用してアクセスできます。</p>\n<aside aria-label="Tip" class="starlight-aside starlight-aside--tip"><p class="starlight-aside__title" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="starlight-aside__icon"><path fill-rule="evenodd" clip-rule="evenodd" d="M1.43909 8.85483L1.44039 8.85354L4.96668 5.33815C5.30653 4.99386 5.7685 4.79662 6.2524 4.78972L6.26553 4.78963L12.9014 4.78962L13.8479 3.84308C16.9187 0.772319 20.0546 0.770617 21.4678 0.975145C21.8617 1.02914 22.2271 1.21053 22.5083 1.4917C22.7894 1.77284 22.9708 2.13821 23.0248 2.53199C23.2294 3.94517 23.2278 7.08119 20.1569 10.1521L19.2107 11.0983V17.7338L19.2106 17.7469C19.2037 18.2308 19.0067 18.6933 18.6624 19.0331L15.1456 22.5608C14.9095 22.7966 14.6137 22.964 14.29 23.0449C13.9663 23.1259 13.6267 23.1174 13.3074 23.0204C12.9881 22.9235 12.7011 22.7417 12.4771 22.4944C12.2533 22.2473 12.1006 21.9441 12.0355 21.6171L11.1783 17.3417L6.65869 12.822L4.34847 12.3589L2.38351 11.965C2.05664 11.8998 1.75272 11.747 1.50564 11.5232C1.25835 11.2992 1.07653 11.0122 0.979561 10.6929C0.882595 10.3736 0.874125 10.034 0.955057 9.7103C1.03599 9.38659 1.20328 9.09092 1.43909 8.85483ZM6.8186 10.8724L2.94619 10.096L6.32006 6.73268H10.9583L6.8186 10.8724ZM15.2219 5.21703C17.681 2.75787 20.0783 2.75376 21.1124 2.8876C21.2462 3.92172 21.2421 6.31895 18.783 8.77812L12.0728 15.4883L8.51172 11.9272L15.2219 5.21703ZM13.9042 21.0538L13.1279 17.1811L17.2676 13.0414V17.68L13.9042 21.0538Z"></path><path d="M9.31827 18.3446C9.45046 17.8529 9.17864 17.3369 8.68945 17.1724C8.56178 17.1294 8.43145 17.1145 8.30512 17.1243C8.10513 17.1398 7.91519 17.2172 7.76181 17.3434C7.62613 17.455 7.51905 17.6048 7.45893 17.7835C6.97634 19.2186 5.77062 19.9878 4.52406 20.4029C4.08525 20.549 3.6605 20.644 3.29471 20.7053C3.35607 20.3395 3.45098 19.9148 3.59711 19.476C4.01221 18.2294 4.78141 17.0237 6.21648 16.5411C6.39528 16.481 6.54504 16.3739 6.65665 16.2382C6.85126 16.0016 6.92988 15.678 6.84417 15.3647C6.83922 15.3466 6.83373 15.3286 6.82767 15.3106C6.74106 15.053 6.55701 14.8557 6.33037 14.7459C6.10949 14.6389 5.84816 14.615 5.59715 14.6994C5.47743 14.7397 5.36103 14.7831 5.24786 14.8294C3.22626 15.6569 2.2347 17.4173 1.75357 18.8621C1.49662 19.6337 1.36993 20.3554 1.30679 20.8818C1.27505 21.1464 1.25893 21.3654 1.25072 21.5213C1.24662 21.5993 1.24448 21.6618 1.24337 21.7066L1.243 21.7226L1.24235 21.7605L1.2422 21.7771L1.24217 21.7827L1.24217 21.7856C1.24217 22.3221 1.67703 22.7579 2.2137 22.7579L2.2155 22.7579L2.22337 22.7578L2.23956 22.7577C2.25293 22.7575 2.27096 22.7572 2.29338 22.7567C2.33821 22.7555 2.40073 22.7534 2.47876 22.7493C2.63466 22.7411 2.85361 22.725 3.11822 22.6932C3.64462 22.6301 4.36636 22.5034 5.13797 22.2464C6.58274 21.7653 8.3431 20.7738 9.17063 18.7522C9.21696 18.639 9.26037 18.5226 9.30064 18.4029C9.30716 18.3835 9.31304 18.364 9.31827 18.3446Z"></path></svg>Tip</p><div class="starlight-aside__content"><p>SlopCode サーバーを使用して、プログラムで SlopCode と対話します。</p></div></aside>\n<p><code dir="auto">slopcode serve</code> を実行してスタンドアロンサーバーを起動できます。すでに SlopCode TUI を実行している場合でも、<code dir="auto">slopcode serve</code> は新しいサーバーを起動します。</p>\n<hr>\n<h4 id="既存のサーバーに接続する"><a href="#既存のサーバーに接続する">既存のサーバーに接続する</a></h4>\n<p>TUI を起動すると、ポートとホスト名がランダムに割り当てられます。代わりに、<code dir="auto">--hostname</code> と <code dir="auto">--port</code> <a href="/docs/cli">フラグ</a> を使用して固定できます。次に、これを使用してサーバーに接続します。</p>\n<p><a href="#tui"><code dir="auto">/tui</code></a> エンドポイントは、サーバー経由で TUI を駆動するために使用できます。たとえば、プロンプトを事前入力したり、実行したりできます。この設定は、SlopCode <a href="/docs/ide">IDE</a> プラグインによって使用されます。</p>\n<hr>\n<h2 id="仕様"><a href="#仕様">仕様</a></h2>\n<p>サーバーは、次の場所で閲覧できる OpenAPI 3.1 仕様を公開しています。</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="plaintext"><code><div class="ec-line"><div class="code"><span style="--0:#24292e;--1:#e1e4e8">http://&#x3C;hostname>:&#x3C;port>/doc</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="http://<hostname>:<port>/doc"><div></div></button></div></figure></div>\n<p>たとえば、<code dir="auto">http://localhost:4096/doc</code>。この仕様を使用して、クライアントを生成したり、要求と応答のタイプを検査したりできます。または、Swagger エクスプローラーで表示します。</p>\n<hr>\n<h2 id="api"><a href="#api">API</a></h2>\n<p>SlopCode サーバーは次の API を公開します。</p>\n<hr>\n<h3 id="global"><a href="#global">Global</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>メソッド</th><th>パス</th><th>説明</th><th>レスポンス</th></tr></thead><tbody><tr><td><code dir="auto">GET</code></td><td><code dir="auto">/global/health</code></td><td>サーバーの健全性とバージョンを取得する</td><td><code dir="auto">{ healthy: true, version: string }</code></td></tr><tr><td><code dir="auto">GET</code></td><td><code dir="auto">/global/event</code></td><td>グローバルイベントの取得 (SSE ストリーム)</td><td>イベントストリーム</td></tr></tbody></table>\n<hr>\n<h3 id="project"><a href="#project">Project</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "パス",
                }),
                createVNode(_components.th, {
                  children: "説明",
                }),
                createVNode(_components.th, {
                  children: "レスポンス",
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
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/project",
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
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/project/current",
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
          '<hr>\n<h3 id="path-and-vcs"><a href="#path-and-vcs">Path and VCS</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "パス",
                }),
                createVNode(_components.th, {
                  children: "説明",
                }),
                createVNode(_components.th, {
                  children: "レスポンス",
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
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/path",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "現在のパスを取得する",
                  }),
                  createVNode(_components.td, {
                    children: createVNode("a", {
                      href: typesUrl,
                      "set:html": "<code>Path</code>",
                    }),
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/vcs",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "現在のプロジェクトの VCS 情報を取得する",
                  }),
                  createVNode(_components.td, {
                    children: createVNode("a", {
                      href: typesUrl,
                      "set:html": "<code>VcsInfo</code>",
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
          '<hr>\n<h3 id="instance"><a href="#instance">Instance</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>メソッド</th><th>パス</th><th>説明</th><th>レスポンス</th></tr></thead><tbody><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/instance/dispose</code></td><td>現在のインスタンスを破棄する</td><td>void</td></tr></tbody></table>\n<hr>\n<h3 id="config"><a href="#config">Config</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "パス",
                }),
                createVNode(_components.th, {
                  children: "説明",
                }),
                createVNode(_components.th, {
                  children: "レスポンス",
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
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/config",
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
                      children: "PATCH",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/config",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "設定を更新する",
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
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/config/providers",
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
          '<hr>\n<h3 id="プロバイダー"><a href="#プロバイダー">プロバイダー</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "パス",
                }),
                createVNode(_components.th, {
                  children: "説明",
                }),
                createVNode(_components.th, {
                  children: "レスポンス",
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
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/provider",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "すべてのプロバイダーをリストする",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ all: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>Provider[]</code>",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": ", default: {...}, connected: string[] }",
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
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/provider/auth",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "プロバイダーの認証方法を取得する",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ [providerID: string]: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>ProviderAuthMethod[]</code>",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": " }",
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
                      children: "POST",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/provider/{id}/oauth/authorize",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "OAuth を使用してプロバイダーを認証する",
                  }),
                  createVNode(_components.td, {
                    children: createVNode("a", {
                      href: typesUrl,
                      "set:html": "<code>ProviderAuthAuthorization</code>",
                    }),
                  }),
                ],
              }),
              createVNode(_components.tr, {
                "set:html":
                  '<td><code dir="auto">POST</code></td><td><code dir="auto">/provider/{id}/oauth/callback</code></td><td>プロバイダーの OAuth コールバックを処理する</td><td>void</td>',
              }),
            ],
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h3 id="session"><a href="#session">Session</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "パス",
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
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/session",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "すべてのセッションをリストする",
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
                      children: "POST",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/session",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "新しいセッションを作成する",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "本文: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ parentID?, title? }",
                      }),
                      "、",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>Session</code>",
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
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/session/status",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "すべてのセッションのセッションステータスを取得する",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "戻り値 ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ [sessionID: string]: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>SessionStatus</code>",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": " }",
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
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/session/:id",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "セッションの詳細を取得する",
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
                  '<td><code dir="auto">DELETE</code></td><td><code dir="auto">/session/:id</code></td><td>セッションとそのすべてのデータを削除する</td><td>戻り値 <code dir="auto">boolean</code></td>',
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "PATCH",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/session/:id",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "セッションのプロパティを更新する",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "本文: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ title? }",
                      }),
                      "、",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>Session</code>",
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
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/session/:id/children",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "セッションの子セッションを取得する",
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
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/session/:id/todo",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "セッションの ToDo リストを取得する",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "戻り値 ",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>Todo[]</code>",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                "set:html":
                  '<td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/init</code></td><td>アプリを分析して <code dir="auto">AGENTS.md</code> を作成する</td><td>本文: <code dir="auto">{ messageID, providerID, modelID }</code>、<code dir="auto">boolean</code> を返します。</td>',
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "POST",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/session/:id/fork",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "メッセージで既存のセッションをフォークする",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "本文: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ messageID? }",
                      }),
                      "、",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>Session</code>",
                      }),
                      " を返します。",
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                "set:html":
                  '<td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/abort</code></td><td>実行中のセッションを中止する</td><td>戻り値 <code dir="auto">boolean</code></td>',
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "POST",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/session/:id/share",
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
                      children: "DELETE",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/session/:id/share",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "セッションの共有を解除する",
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
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/session/:id/diff",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "このセッションの差分を取得する",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "クエリ: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "messageID?",
                      }),
                      "、",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>FileDiff[]</code>",
                      }),
                      " を返します。",
                    ],
                  }),
                ],
              }),
              createVNode(Fragment$1, {
                "set:html":
                  '<tr><td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/summarize</code></td><td>セッションを要約する</td><td>本文: <code dir="auto">{ providerID, modelID }</code>、<code dir="auto">boolean</code> を返します。</td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/revert</code></td><td>メッセージを元に戻す</td><td>本文: <code dir="auto">{ messageID, partID? }</code>、<code dir="auto">boolean</code> を返します。</td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/unrevert</code></td><td>元に戻したすべてのメッセージを復元する</td><td>戻り値 <code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/permissions/:permissionID</code></td><td>許可リクエストに応答する</td><td>本文: <code dir="auto">{ response, remember? }</code>、<code dir="auto">boolean</code> を返します。</td></tr>',
              }),
            ],
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h3 id="message"><a href="#message">Message</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "パス",
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
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/session/:id/message",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "セッション内のメッセージをリストする",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "クエリ: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "limit?",
                      }),
                      "、",
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
                      createVNode(Fragment$1, {
                        "set:html": '<code dir="auto">}[]</code> を返します。',
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
                      children: "POST",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/session/:id/message",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "メッセージを送信して応答を待ちます",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "本文: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ messageID?, model?, agent?, noReply?, system?, tools?, parts }",
                      }),
                      "、",
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
                      createVNode(Fragment$1, {
                        "set:html": '<code dir="auto">}</code> を返します',
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
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/session/:id/message/:messageID",
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
                "set:html":
                  '<td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/prompt_async</code></td><td>メッセージを非同期に送信する (待機なし)</td><td>body: <code dir="auto">/session/:id/message</code> と同じ、<code dir="auto">204 No Content</code> を返します。</td>',
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "POST",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/session/:id/command",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "スラッシュコマンドを実行します",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "本文: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ messageID?, agent?, model?, command, arguments }",
                      }),
                      "、",
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
                      createVNode(Fragment$1, {
                        "set:html": '<code dir="auto">}</code> を返します',
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
                      children: "POST",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/session/:id/shell",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "シェルコマンドを実行する",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "本文: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ agent, model?, command }",
                      }),
                      "、",
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
                      createVNode(Fragment$1, {
                        "set:html": '<code dir="auto">}</code> を返します',
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
        "set:html": '<hr>\n<h3 id="command"><a href="#command">Command</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "パス",
                }),
                createVNode(_components.th, {
                  children: "説明",
                }),
                createVNode(_components.th, {
                  children: "レスポンス",
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
                    children: "GET",
                  }),
                }),
                createVNode(_components.td, {
                  children: createVNode(_components.code, {
                    dir: "auto",
                    children: "/command",
                  }),
                }),
                createVNode(_components.td, {
                  children: "すべてのコマンドをリストする",
                }),
                createVNode(_components.td, {
                  children: createVNode("a", {
                    href: typesUrl,
                    "set:html": "<code>Command[]</code>",
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
          '<hr>\n<h3 id="file"><a href="#file">File</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "パス",
                }),
                createVNode(_components.th, {
                  children: "説明",
                }),
                createVNode(_components.th, {
                  children: "レスポンス",
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
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/find?pattern=<pat>",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "ファイル内のテキストを検索",
                  }),
                  createVNode(_components.td, {
                    children: [
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
                      " と一致するオブジェクトの配列",
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/find/file?query=<q>",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "ファイルとディレクトリを名前で検索する",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "string[]",
                      }),
                      " (パス)",
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/find/symbol?query=<q>",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "ワークスペースのシンボルを検索する",
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
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/file?path=<path>",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "ファイルとディレクトリをリストする",
                  }),
                  createVNode(_components.td, {
                    children: createVNode("a", {
                      href: typesUrl,
                      "set:html": "<code>FileNode[]</code>",
                    }),
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/file/content?path=<p>",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "ファイルを読む",
                  }),
                  createVNode(_components.td, {
                    children: createVNode("a", {
                      href: typesUrl,
                      "set:html": "<code>FileContent</code>",
                    }),
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/file/status",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "追跡されたファイルのステータスを取得する",
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
          '<h4 id="findfile-クエリパラメータ"><a href="#findfile-クエリパラメータ"><code dir="auto">/find/file</code> クエリパラメータ</a></h4>\n<ul>\n<li><code dir="auto">query</code> (必須) — 検索文字列 (あいまい一致)</li>\n<li><code dir="auto">type</code> (オプション) — 結果を <code dir="auto">"file"</code> または <code dir="auto">"directory"</code> に制限します</li>\n<li><code dir="auto">directory</code> (オプション) — 検索用のプロジェクトルートをオーバーライドします。</li>\n<li><code dir="auto">limit</code> (オプション) — 最大結果 (1 ～ 200)</li>\n<li><code dir="auto">dirs</code> (オプション) — 従来のフラグ (<code dir="auto">"false"</code> はファイルのみを返します)</li>\n</ul>\n<hr>\n<h3 id="tool-experimental"><a href="#tool-experimental">Tool (Experimental)</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "パス",
                }),
                createVNode(_components.th, {
                  children: "説明",
                }),
                createVNode(_components.th, {
                  children: "レスポンス",
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
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/experimental/tool/ids",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "すべてのツール ID をリストする",
                  }),
                  createVNode(_components.td, {
                    children: createVNode("a", {
                      href: typesUrl,
                      "set:html": "<code>ToolIDs</code>",
                    }),
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/experimental/tool?provider=<p>&model=<m>",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "モデルの JSON スキーマを含むツールをリストする",
                  }),
                  createVNode(_components.td, {
                    children: createVNode("a", {
                      href: typesUrl,
                      "set:html": "<code>ToolList</code>",
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
          '<hr>\n<h3 id="lsp-formatter-mcp"><a href="#lsp-formatter-mcp">LSP, Formatter, MCP</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "パス",
                }),
                createVNode(_components.th, {
                  children: "説明",
                }),
                createVNode(_components.th, {
                  children: "レスポンス",
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
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/lsp",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "LSP サーバーのステータスを取得",
                  }),
                  createVNode(_components.td, {
                    children: createVNode("a", {
                      href: typesUrl,
                      "set:html": "<code>LSPStatus[]</code>",
                    }),
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/formatter",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "フォーマッタのステータスを取得する",
                  }),
                  createVNode(_components.td, {
                    children: createVNode("a", {
                      href: typesUrl,
                      "set:html": "<code>FormatterStatus[]</code>",
                    }),
                  }),
                ],
              }),
              createVNode(_components.tr, {
                children: [
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "GET",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: createVNode(_components.code, {
                      dir: "auto",
                      children: "/mcp",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "MCP サーバーのステータスを取得する",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ [name: string]: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>MCPStatus</code>",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": " }",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                "set:html":
                  '<td><code dir="auto">POST</code></td><td><code dir="auto">/mcp</code></td><td>MCP サーバーを動的に追加する</td><td>本文: <code dir="auto">{ name, config }</code>、MCP ステータスオブジェクトを返します。</td>',
              }),
            ],
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html": '<hr>\n<h3 id="agent"><a href="#agent">Agent</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "パス",
                }),
                createVNode(_components.th, {
                  children: "説明",
                }),
                createVNode(_components.th, {
                  children: "レスポンス",
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
                    children: "GET",
                  }),
                }),
                createVNode(_components.td, {
                  children: createVNode(_components.code, {
                    dir: "auto",
                    children: "/agent",
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
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h3 id="logging"><a href="#logging">Logging</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>メソッド</th><th>パス</th><th>説明</th><th>レスポンス</th></tr></thead><tbody><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/log</code></td><td>ログエントリを書き込みます。本体:<code dir="auto">{ service, level, message, extra? }</code></td><td>void</td></tr></tbody></table>\n<hr>\n<h3 id="tui"><a href="#tui">TUI</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>メソッド</th><th>パス</th><th>説明</th><th>レスポンス</th></tr></thead><tbody><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/append-prompt</code></td><td>プロンプトにテキストを追加します</td><td>void</td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/open-help</code></td><td>ヘルプダイアログを開く</td><td>void</td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/open-sessions</code></td><td>セッションセレクターを開く</td><td>void</td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/open-themes</code></td><td>テーマセレクターを開く</td><td>void</td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/open-models</code></td><td>モデルセレクターを開く</td><td>void</td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/submit-prompt</code></td><td>現在のプロンプトを送信します</td><td>void</td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/clear-prompt</code></td><td>プロンプトをクリア</td><td>void</td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/execute-command</code></td><td>コマンドを実行する (<code dir="auto">{ command }</code>)</td><td>void</td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/show-toast</code></td><td>トーストを表示 (<code dir="auto">{ title?, message, variant }</code>)</td><td>void</td></tr><tr><td><code dir="auto">GET</code></td><td><code dir="auto">/tui/control/next</code></td><td>次の制御リクエストを待ちます</td><td>制御リクエストオブジェクト</td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/control/response</code></td><td>制御リクエストに応答する (<code dir="auto">{ body }</code>)</td><td>void</td></tr></tbody></table>\n<hr>\n<h3 id="auth"><a href="#auth">Auth</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>メソッド</th><th>パス</th><th>説明</th><th>レスポンス</th></tr></thead><tbody><tr><td><code dir="auto">PUT</code></td><td><code dir="auto">/auth/:id</code></td><td>認証資格情報を設定します。本文はプロバイダーのスキーマと一致する必要があります</td><td>void</td></tr></tbody></table>\n<hr>\n<h3 id="event"><a href="#event">Event</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>メソッド</th><th>パス</th><th>説明</th><th>レスポンス</th></tr></thead><tbody><tr><td><code dir="auto">GET</code></td><td><code dir="auto">/event</code></td><td>サーバー送信イベントストリーム。最初のイベントは <code dir="auto">server.connected</code>、次にバスイベント</td><td>サーバー送信イベントストリーム</td></tr></tbody></table>\n<hr>\n<h3 id="documentation"><a href="#documentation">Documentation</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>メソッド</th><th>パス</th><th>説明</th><th>レスポンス</th></tr></thead><tbody><tr><td><code dir="auto">GET</code></td><td><code dir="auto">/doc</code></td><td>OpenAPI 3.1 仕様</td><td>OpenAPI 仕様を備えた HTML ページ</td></tr></tbody></table>',
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

const url = "src/content/docs/ja/server.mdx"
const file = "/app/packages/web/src/content/docs/ja/server.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/app/packages/web/src/content/docs/ja/server.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, typesUrl, url }
