globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"
import { c as config } from "./config_UI6PtV27.mjs"

const frontmatter = {
  title: "服务器",
  description: "通过 HTTP 与 slopcode 服务器交互。",
}
function getHeadings() {
  return [
    {
      depth: 3,
      slug: "用法",
      text: "用法",
    },
    {
      depth: 4,
      slug: "选项",
      text: "选项",
    },
    {
      depth: 3,
      slug: "认证",
      text: "认证",
    },
    {
      depth: 3,
      slug: "工作原理",
      text: "工作原理",
    },
    {
      depth: 4,
      slug: "连接到现有服务器",
      text: "连接到现有服务器",
    },
    {
      depth: 2,
      slug: "规范",
      text: "规范",
    },
    {
      depth: 2,
      slug: "api",
      text: "API",
    },
    {
      depth: 3,
      slug: "全局",
      text: "全局",
    },
    {
      depth: 3,
      slug: "项目",
      text: "项目",
    },
    {
      depth: 3,
      slug: "路径和-vcs",
      text: "路径和 VCS",
    },
    {
      depth: 3,
      slug: "实例",
      text: "实例",
    },
    {
      depth: 3,
      slug: "配置",
      text: "配置",
    },
    {
      depth: 3,
      slug: "提供商",
      text: "提供商",
    },
    {
      depth: 3,
      slug: "会话",
      text: "会话",
    },
    {
      depth: 3,
      slug: "消息",
      text: "消息",
    },
    {
      depth: 3,
      slug: "命令",
      text: "命令",
    },
    {
      depth: 3,
      slug: "文件",
      text: "文件",
    },
    {
      depth: 4,
      slug: "findfile-查询参数",
      text: "/find/file 查询参数",
    },
    {
      depth: 3,
      slug: "工具实验性",
      text: "工具（实验性）",
    },
    {
      depth: 3,
      slug: "lsp格式化器和-mcp",
      text: "LSP、格式化器和 MCP",
    },
    {
      depth: 3,
      slug: "代理",
      text: "代理",
    },
    {
      depth: 3,
      slug: "日志",
      text: "日志",
    },
    {
      depth: 3,
      slug: "tui",
      text: "TUI",
    },
    {
      depth: 3,
      slug: "认证-1",
      text: "认证",
    },
    {
      depth: 3,
      slug: "事件",
      text: "事件",
    },
    {
      depth: 3,
      slug: "文档",
      text: "文档",
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
          '<p><code dir="auto">slopcode serve</code> 命令运行一个无界面的 HTTP 服务器，暴露一个 OpenAPI 端点供 slopcode 客户端使用。</p>\n<hr>\n<h3 id="用法"><a href="#用法">用法</a></h3>\n<div class="expressive-code"><link rel="stylesheet" href="/docs/_astro/ec.4c0k7.css"><script type="module" src="/docs/_astro/ec.0vx5m.js"></script><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">serve</span><span style="--0:#24292E;--1:#E1E4E8"> [--port </span><span style="--0:#032F62;--1:#9ECBFF">&#x3C;number>]</span><span style="--0:#24292E;--1:#E1E4E8"> [--hostname </span><span style="--0:#032F62;--1:#9ECBFF">&#x3C;string>]</span><span style="--0:#24292E;--1:#E1E4E8"> [--cors </span><span style="--0:#032F62;--1:#9ECBFF">&#x3C;origin>]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode serve [--port <number>] [--hostname <string>] [--cors <origin>]"><div></div></button></div></figure></div>\n<h4 id="选项"><a href="#选项">选项</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>标志</th><th>描述</th><th>默认值</th></tr></thead><tbody><tr><td><code dir="auto">--port</code></td><td>监听端口</td><td><code dir="auto">4096</code></td></tr><tr><td><code dir="auto">--hostname</code></td><td>监听的主机名</td><td><code dir="auto">127.0.0.1</code></td></tr><tr><td><code dir="auto">--mdns</code></td><td>启用 mDNS 发现</td><td><code dir="auto">false</code></td></tr><tr><td><code dir="auto">--mdns-domain</code></td><td>mDNS 服务的自定义域名</td><td><code dir="auto">slopcode.local</code></td></tr><tr><td><code dir="auto">--cors</code></td><td>额外允许的浏览器来源</td><td><code dir="auto">[]</code></td></tr></tbody></table>\n<p><code dir="auto">--cors</code> 可以多次传递：</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">serve</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--cors</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">http://localhost:5173</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--cors</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">https://app.example.com</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode serve --cors http://localhost:5173 --cors https://app.example.com"><div></div></button></div></figure></div>\n<hr>\n<h3 id="认证"><a href="#认证">认证</a></h3>\n<p>设置 <code dir="auto">SLOPCODE_SERVER_PASSWORD</code> 以使用 HTTP 基本认证保护服务器。用户名默认为 <code dir="auto">slopcode</code>，也可以设置 <code dir="auto">SLOPCODE_SERVER_USERNAME</code> 来覆盖它。这适用于 <code dir="auto">slopcode serve</code> 和 <code dir="auto">slopcode web</code>。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">SLOPCODE_SERVER_PASSWORD</span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#032F62;--1:#9ECBFF">your-password</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">serve</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="SLOPCODE_SERVER_PASSWORD=your-password slopcode serve"><div></div></button></div></figure></div>\n<hr>\n<h3 id="工作原理"><a href="#工作原理">工作原理</a></h3>\n<p>当你运行 <code dir="auto">slopcode</code> 时，它会启动一个 TUI 和一个服务器。TUI 是与服务器通信的客户端。服务器暴露一个 OpenAPI 3.1 规范端点。该端点也用于生成 <a href="/docs/sdk">SDK</a>。</p>\n<aside aria-label="Tip" class="starlight-aside starlight-aside--tip"><p class="starlight-aside__title" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="starlight-aside__icon"><path fill-rule="evenodd" clip-rule="evenodd" d="M1.43909 8.85483L1.44039 8.85354L4.96668 5.33815C5.30653 4.99386 5.7685 4.79662 6.2524 4.78972L6.26553 4.78963L12.9014 4.78962L13.8479 3.84308C16.9187 0.772319 20.0546 0.770617 21.4678 0.975145C21.8617 1.02914 22.2271 1.21053 22.5083 1.4917C22.7894 1.77284 22.9708 2.13821 23.0248 2.53199C23.2294 3.94517 23.2278 7.08119 20.1569 10.1521L19.2107 11.0983V17.7338L19.2106 17.7469C19.2037 18.2308 19.0067 18.6933 18.6624 19.0331L15.1456 22.5608C14.9095 22.7966 14.6137 22.964 14.29 23.0449C13.9663 23.1259 13.6267 23.1174 13.3074 23.0204C12.9881 22.9235 12.7011 22.7417 12.4771 22.4944C12.2533 22.2473 12.1006 21.9441 12.0355 21.6171L11.1783 17.3417L6.65869 12.822L4.34847 12.3589L2.38351 11.965C2.05664 11.8998 1.75272 11.747 1.50564 11.5232C1.25835 11.2992 1.07653 11.0122 0.979561 10.6929C0.882595 10.3736 0.874125 10.034 0.955057 9.7103C1.03599 9.38659 1.20328 9.09092 1.43909 8.85483ZM6.8186 10.8724L2.94619 10.096L6.32006 6.73268H10.9583L6.8186 10.8724ZM15.2219 5.21703C17.681 2.75787 20.0783 2.75376 21.1124 2.8876C21.2462 3.92172 21.2421 6.31895 18.783 8.77812L12.0728 15.4883L8.51172 11.9272L15.2219 5.21703ZM13.9042 21.0538L13.1279 17.1811L17.2676 13.0414V17.68L13.9042 21.0538Z"></path><path d="M9.31827 18.3446C9.45046 17.8529 9.17864 17.3369 8.68945 17.1724C8.56178 17.1294 8.43145 17.1145 8.30512 17.1243C8.10513 17.1398 7.91519 17.2172 7.76181 17.3434C7.62613 17.455 7.51905 17.6048 7.45893 17.7835C6.97634 19.2186 5.77062 19.9878 4.52406 20.4029C4.08525 20.549 3.6605 20.644 3.29471 20.7053C3.35607 20.3395 3.45098 19.9148 3.59711 19.476C4.01221 18.2294 4.78141 17.0237 6.21648 16.5411C6.39528 16.481 6.54504 16.3739 6.65665 16.2382C6.85126 16.0016 6.92988 15.678 6.84417 15.3647C6.83922 15.3466 6.83373 15.3286 6.82767 15.3106C6.74106 15.053 6.55701 14.8557 6.33037 14.7459C6.10949 14.6389 5.84816 14.615 5.59715 14.6994C5.47743 14.7397 5.36103 14.7831 5.24786 14.8294C3.22626 15.6569 2.2347 17.4173 1.75357 18.8621C1.49662 19.6337 1.36993 20.3554 1.30679 20.8818C1.27505 21.1464 1.25893 21.3654 1.25072 21.5213C1.24662 21.5993 1.24448 21.6618 1.24337 21.7066L1.243 21.7226L1.24235 21.7605L1.2422 21.7771L1.24217 21.7827L1.24217 21.7856C1.24217 22.3221 1.67703 22.7579 2.2137 22.7579L2.2155 22.7579L2.22337 22.7578L2.23956 22.7577C2.25293 22.7575 2.27096 22.7572 2.29338 22.7567C2.33821 22.7555 2.40073 22.7534 2.47876 22.7493C2.63466 22.7411 2.85361 22.725 3.11822 22.6932C3.64462 22.6301 4.36636 22.5034 5.13797 22.2464C6.58274 21.7653 8.3431 20.7738 9.17063 18.7522C9.21696 18.639 9.26037 18.5226 9.30064 18.4029C9.30716 18.3835 9.31304 18.364 9.31827 18.3446Z"></path></svg>Tip</p><div class="starlight-aside__content"><p>使用 slopcode 服务器以编程方式与 slopcode 交互。</p></div></aside>\n<p>这种架构让 slopcode 支持多个客户端，并允许你以编程方式与 slopcode 交互。</p>\n<p>你可以运行 <code dir="auto">slopcode serve</code> 来启动一个独立的服务器。如果你已经在运行 slopcode TUI，<code dir="auto">slopcode serve</code> 会启动一个新的服务器。</p>\n<hr>\n<h4 id="连接到现有服务器"><a href="#连接到现有服务器">连接到现有服务器</a></h4>\n<p>当你启动 TUI 时，它会随机分配端口和主机名。你也可以传入 <code dir="auto">--hostname</code> 和 <code dir="auto">--port</code> <a href="/docs/cli">标志</a>，然后用它来连接对应的服务器。</p>\n<p><a href="#tui"><code dir="auto">/tui</code></a> 端点可用于通过服务器驱动 TUI。例如，你可以预填充或运行一个提示词。此方式被 SlopCode <a href="/docs/ide">IDE</a> 插件所使用。</p>\n<hr>\n<h2 id="规范"><a href="#规范">规范</a></h2>\n<p>服务器发布了一个 OpenAPI 3.1 规范，可在以下地址查看：</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="plaintext"><code><div class="ec-line"><div class="code"><span style="--0:#24292e;--1:#e1e4e8">http://&#x3C;hostname>:&#x3C;port>/doc</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="http://<hostname>:<port>/doc"><div></div></button></div></figure></div>\n<p>例如，<code dir="auto">http://localhost:4096/doc</code>。使用该规范可以生成客户端或检查请求和响应类型，也可以在 Swagger 浏览器中查看。</p>\n<hr>\n<h2 id="api"><a href="#api">API</a></h2>\n<p>slopcode 服务器暴露以下 API。</p>\n<hr>\n<h3 id="全局"><a href="#全局">全局</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>方法</th><th>路径</th><th>描述</th><th>响应</th></tr></thead><tbody><tr><td><code dir="auto">GET</code></td><td><code dir="auto">/global/health</code></td><td>获取服务器健康状态和版本</td><td><code dir="auto">{ healthy: true, version: string }</code></td></tr><tr><td><code dir="auto">GET</code></td><td><code dir="auto">/global/event</code></td><td>获取全局事件（SSE 流）</td><td>事件流</td></tr></tbody></table>\n<hr>\n<h3 id="项目"><a href="#项目">项目</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "路径",
                }),
                createVNode(_components.th, {
                  children: "描述",
                }),
                createVNode(_components.th, {
                  children: "响应",
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
                    children: "列出所有项目",
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
                    children: "获取当前项目",
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
          '<hr>\n<h3 id="路径和-vcs"><a href="#路径和-vcs">路径和 VCS</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "路径",
                }),
                createVNode(_components.th, {
                  children: "描述",
                }),
                createVNode(_components.th, {
                  children: "响应",
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
                    children: "获取当前路径",
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
                    children: "获取当前项目的 VCS 信息",
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
          '<hr>\n<h3 id="实例"><a href="#实例">实例</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>方法</th><th>路径</th><th>描述</th><th>响应</th></tr></thead><tbody><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/instance/dispose</code></td><td>销毁当前实例</td><td><code dir="auto">boolean</code></td></tr></tbody></table>\n<hr>\n<h3 id="配置"><a href="#配置">配置</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "路径",
                }),
                createVNode(_components.th, {
                  children: "描述",
                }),
                createVNode(_components.th, {
                  children: "响应",
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
                    children: "获取配置信息",
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
                    children: "更新配置",
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
                    children: "列出提供商和默认模型",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ providers: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "Provider[]",
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
          '<hr>\n<h3 id="提供商"><a href="#提供商">提供商</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "路径",
                }),
                createVNode(_components.th, {
                  children: "描述",
                }),
                createVNode(_components.th, {
                  children: "响应",
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
                    children: "列出所有提供商",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ all: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "Provider[]",
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
                    children: "获取提供商认证方式",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ [providerID: string]: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "ProviderAuthMethod[]",
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
                    children: "使用 OAuth 授权提供商",
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
                  '<td><code dir="auto">POST</code></td><td><code dir="auto">/provider/{id}/oauth/callback</code></td><td>处理提供商的 OAuth 回调</td><td><code dir="auto">boolean</code></td>',
              }),
            ],
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h3 id="会话"><a href="#会话">会话</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "路径",
                }),
                createVNode(_components.th, {
                  children: "描述",
                }),
                createVNode(_components.th, {
                  children: "说明",
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
                    children: "列出所有会话",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "返回 ",
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
                    children: "创建新会话",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "请求体：",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ parentID?, title? }",
                      }),
                      "，返回 ",
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
                      children: "/session/status",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "获取所有会话的状态",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "返回 ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ [sessionID: string]: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "SessionStatus",
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
                    children: "获取会话详情",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "返回 ",
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
                  '<td><code dir="auto">DELETE</code></td><td><code dir="auto">/session/:id</code></td><td>删除会话及其所有数据</td><td>返回 <code dir="auto">boolean</code></td>',
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
                    children: "更新会话属性",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "请求体：",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ title? }",
                      }),
                      "，返回 ",
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
                      children: "/session/:id/children",
                    }),
                  }),
                  createVNode(_components.td, {
                    children: "获取会话的子会话",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "返回 ",
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
                    children: "获取会话的待办事项列表",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "返回 ",
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
                  '<td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/init</code></td><td>分析应用并创建 <code dir="auto">AGENTS.md</code></td><td>请求体：<code dir="auto">{ messageID, providerID, modelID }</code>，返回 <code dir="auto">boolean</code></td>',
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
                    children: "在某条消息处分叉现有会话",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "请求体：",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ messageID? }",
                      }),
                      "，返回 ",
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
                  '<td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/abort</code></td><td>中止正在运行的会话</td><td>返回 <code dir="auto">boolean</code></td>',
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
                    children: "分享会话",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "返回 ",
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
                    children: "取消分享会话",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "返回 ",
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
                    children: "获取本次会话的差异",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "查询参数：",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "messageID?",
                      }),
                      "，返回 ",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>FileDiff[]</code>",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(Fragment$1, {
                "set:html":
                  '<tr><td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/summarize</code></td><td>总结会话</td><td>请求体：<code dir="auto">{ providerID, modelID }</code>，返回 <code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/revert</code></td><td>回退消息</td><td>请求体：<code dir="auto">{ messageID, partID? }</code>，返回 <code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/unrevert</code></td><td>恢复所有已回退的消息</td><td>返回 <code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/permissions/:permissionID</code></td><td>响应权限请求</td><td>请求体：<code dir="auto">{ response, remember? }</code>，返回 <code dir="auto">boolean</code></td></tr>',
              }),
            ],
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h3 id="消息"><a href="#消息">消息</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "路径",
                }),
                createVNode(_components.th, {
                  children: "描述",
                }),
                createVNode(_components.th, {
                  children: "说明",
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
                    children: "列出会话中的消息",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "查询参数：",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "limit?",
                      }),
                      "，返回 ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ info: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "Message",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": ", parts: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "Part[]",
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
                    children: "发送消息并等待响应",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "请求体：",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ messageID?, model?, agent?, noReply?, system?, tools?, parts }",
                      }),
                      "，返回 ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ info: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "Message",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": ", parts: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "Part[]",
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
                    children: "获取消息详情",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "返回 ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ info: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "Message",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": ", parts: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "Part[]",
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
                  '<td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/prompt_async</code></td><td>异步发送消息（不等待响应）</td><td>请求体：与 <code dir="auto">/session/:id/message</code> 相同，返回 <code dir="auto">204 No Content</code></td>',
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
                    children: "执行斜杠命令",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "请求体：",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ messageID?, agent?, model?, command, arguments }",
                      }),
                      "，返回 ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ info: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "Message",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": ", parts: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "Part[]",
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
                    children: "运行 shell 命令",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "请求体：",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ agent, model?, command }",
                      }),
                      "，返回 ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ info: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "Message",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": ", parts: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "Part[]",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": "}",
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
        "set:html": '<hr>\n<h3 id="命令"><a href="#命令">命令</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "路径",
                }),
                createVNode(_components.th, {
                  children: "描述",
                }),
                createVNode(_components.th, {
                  children: "响应",
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
                  children: "列出所有命令",
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
          '<hr>\n<h3 id="文件"><a href="#文件">文件</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "路径",
                }),
                createVNode(_components.th, {
                  children: "描述",
                }),
                createVNode(_components.th, {
                  children: "响应",
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
                    children: "在文件中搜索文本",
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
                      " 的匹配对象数组",
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
                    children: "按名称查找文件和目录",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "string[]",
                      }),
                      "（路径）",
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
                    children: "查找工作区符号",
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
                    children: "列出文件和目录",
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
                    children: "读取文件",
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
                    children: "获取已跟踪文件的状态",
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
          '<h4 id="findfile-查询参数"><a href="#findfile-查询参数"><code dir="auto">/find/file</code> 查询参数</a></h4>\n<ul>\n<li><code dir="auto">query</code>（必需）— 搜索字符串（模糊匹配）</li>\n<li><code dir="auto">type</code>（可选）— 将结果限制为 <code dir="auto">"file"</code> 或 <code dir="auto">"directory"</code></li>\n<li><code dir="auto">directory</code>（可选）— 覆盖搜索的项目根目录</li>\n<li><code dir="auto">limit</code>（可选）— 最大结果数（1–200）</li>\n<li><code dir="auto">dirs</code>（可选）— 旧版标志（<code dir="auto">"false"</code> 仅返回文件）</li>\n</ul>\n<hr>\n<h3 id="工具实验性"><a href="#工具实验性">工具（实验性）</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "路径",
                }),
                createVNode(_components.th, {
                  children: "描述",
                }),
                createVNode(_components.th, {
                  children: "响应",
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
                    children: "列出所有工具 ID",
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
                    children: "列出指定模型的工具及其 JSON Schema",
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
          '<hr>\n<h3 id="lsp格式化器和-mcp"><a href="#lsp格式化器和-mcp">LSP、格式化器和 MCP</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "路径",
                }),
                createVNode(_components.th, {
                  children: "描述",
                }),
                createVNode(_components.th, {
                  children: "响应",
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
                    children: "获取 LSP 服务器状态",
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
                    children: "获取格式化器状态",
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
                    children: "获取 MCP 服务器状态",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ [name: string]: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "MCPStatus",
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
                  '<td><code dir="auto">POST</code></td><td><code dir="auto">/mcp</code></td><td>动态添加 MCP 服务器</td><td>请求体：<code dir="auto">{ name, config }</code>，返回 MCP 状态对象</td>',
              }),
            ],
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html": '<hr>\n<h3 id="代理"><a href="#代理">代理</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "路径",
                }),
                createVNode(_components.th, {
                  children: "描述",
                }),
                createVNode(_components.th, {
                  children: "响应",
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
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h3 id="日志"><a href="#日志">日志</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>方法</th><th>路径</th><th>描述</th><th>响应</th></tr></thead><tbody><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/log</code></td><td>写入日志条目。请求体：<code dir="auto">{ service, level, message, extra? }</code></td><td><code dir="auto">boolean</code></td></tr></tbody></table>\n<hr>\n<h3 id="tui"><a href="#tui">TUI</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>方法</th><th>路径</th><th>描述</th><th>响应</th></tr></thead><tbody><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/append-prompt</code></td><td>向提示词追加文本</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/open-help</code></td><td>打开帮助对话框</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/open-sessions</code></td><td>打开会话选择器</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/open-themes</code></td><td>打开主题选择器</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/open-models</code></td><td>打开模型选择器</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/submit-prompt</code></td><td>提交当前提示词</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/clear-prompt</code></td><td>清除提示词</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/execute-command</code></td><td>执行命令（<code dir="auto">{ command }</code>）</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/show-toast</code></td><td>显示提示消息（<code dir="auto">{ title?, message, variant }</code>）</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">GET</code></td><td><code dir="auto">/tui/control/next</code></td><td>等待下一个控制请求</td><td>控制请求对象</td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/control/response</code></td><td>响应控制请求（<code dir="auto">{ body }</code>）</td><td><code dir="auto">boolean</code></td></tr></tbody></table>\n<hr>\n<h3 id="认证-1"><a href="#认证-1">认证</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>方法</th><th>路径</th><th>描述</th><th>响应</th></tr></thead><tbody><tr><td><code dir="auto">PUT</code></td><td><code dir="auto">/auth/:id</code></td><td>设置认证凭据。请求体必须匹配提供商的数据结构</td><td><code dir="auto">boolean</code></td></tr></tbody></table>\n<hr>\n<h3 id="事件"><a href="#事件">事件</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>方法</th><th>路径</th><th>描述</th><th>响应</th></tr></thead><tbody><tr><td><code dir="auto">GET</code></td><td><code dir="auto">/event</code></td><td>服务器发送事件流。第一个事件是 <code dir="auto">server.connected</code>，之后是总线事件</td><td>服务器发送事件流</td></tr></tbody></table>\n<hr>\n<h3 id="文档"><a href="#文档">文档</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>方法</th><th>路径</th><th>描述</th><th>响应</th></tr></thead><tbody><tr><td><code dir="auto">GET</code></td><td><code dir="auto">/doc</code></td><td>OpenAPI 3.1 规范</td><td>包含 OpenAPI 规范的 HTML 页面</td></tr></tbody></table>',
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

const url = "src/content/docs/zh-cn/server.mdx"
const file = "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/server.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId =
  "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/zh-cn/server.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, typesUrl, url }
