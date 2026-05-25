globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"
import "./Code_sjN3308E.mjs"

const frontmatter = {
  title: "CLI",
  description: "SlopCode CLI のオプションとコマンド。",
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
      slug: "フラグ",
      text: "フラグ",
    },
    {
      depth: 2,
      slug: "コマンド",
      text: "コマンド",
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
      slug: "フラグ-1",
      text: "フラグ",
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
      slug: "フラグ-2",
      text: "フラグ",
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
      slug: "フラグ-3",
      text: "フラグ",
    },
    {
      depth: 3,
      slug: "run-1",
      text: "run",
    },
    {
      depth: 4,
      slug: "フラグ-4",
      text: "フラグ",
    },
    {
      depth: 3,
      slug: "serve",
      text: "serve",
    },
    {
      depth: 4,
      slug: "フラグ-5",
      text: "フラグ",
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
      slug: "フラグ-6",
      text: "フラグ",
    },
    {
      depth: 3,
      slug: "stats",
      text: "stats",
    },
    {
      depth: 4,
      slug: "フラグ-7",
      text: "フラグ",
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
      slug: "フラグ-8",
      text: "フラグ",
    },
    {
      depth: 3,
      slug: "acp",
      text: "acp",
    },
    {
      depth: 4,
      slug: "フラグ-9",
      text: "フラグ",
    },
    {
      depth: 3,
      slug: "uninstall",
      text: "uninstall",
    },
    {
      depth: 4,
      slug: "フラグ-10",
      text: "フラグ",
    },
    {
      depth: 3,
      slug: "upgrade",
      text: "upgrade",
    },
    {
      depth: 4,
      slug: "フラグ-11",
      text: "フラグ",
    },
    {
      depth: 2,
      slug: "グローバルフラグ",
      text: "グローバルフラグ",
    },
    {
      depth: 2,
      slug: "環境変数",
      text: "環境変数",
    },
    {
      depth: 3,
      slug: "実験的",
      text: "実験的",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>SlopCode CLI は、引数なしで実行すると、デフォルトで <a href="/docs/tui">TUI</a> を開始します。</p>\n<div class="expressive-code"><link rel="stylesheet" href="/docs/_astro/ec.4c0k7.css"><script type="module" src="/docs/_astro/ec.0vx5m.js"></script><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode"><div></div></button></div></figure></div>\n<p>ただし、このページに記載されているようにコマンドも受け入れます。これにより、SlopCode をプログラム的に操作できるようになります。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">run</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">"Explain how closures work in JavaScript"</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode run &#x22;Explain how closures work in JavaScript&#x22;"><div></div></button></div></figure></div>\n<hr>\n<h3 id="tui"><a href="#tui">tui</a></h3>\n<p>SlopCode ターミナルユーザーインターフェイスを開始します。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> [project]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode [project]"><div></div></button></div></figure></div>\n<h4 id="フラグ"><a href="#フラグ">フラグ</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>フラグ</th><th>ショート</th><th>説明</th></tr></thead><tbody><tr><td><code dir="auto">--continue</code></td><td><code dir="auto">-c</code></td><td>最後のセッションを続行</td></tr><tr><td><code dir="auto">--session</code></td><td></td><td>続行時にセッションをフォーク (<code dir="auto">-s</code> または <code dir="auto">--fork</code> と併用)</td></tr><tr><td><code dir="auto">--continue</code></td><td><code dir="auto">--session</code></td><td>続行するセッション ID</td></tr><tr><td><code dir="auto">--prompt</code></td><td></td><td>使用のプロンプト</td></tr><tr><td><code dir="auto">--model</code></td><td><code dir="auto">-m</code></td><td>プロバイダー/モデルの形式で使用するモデル</td></tr><tr><td><code dir="auto">--agent</code></td><td></td><td>使用するエージェント</td></tr><tr><td><code dir="auto">--port</code></td><td></td><td>リッスンするポート</td></tr><tr><td><code dir="auto">--hostname</code></td><td></td><td>リッスンするホスト名</td></tr></tbody></table>\n<hr>\n<h2 id="コマンド"><a href="#コマンド">コマンド</a></h2>\n<p>SlopCode CLI には次のコマンドもあります。</p>\n<hr>\n<h3 id="agent"><a href="#agent">agent</a></h3>\n<p>SlopCode のエージェントを管理します。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">agent</span><span style="--0:#24292E;--1:#E1E4E8"> [command]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode agent [command]"><div></div></button></div></figure></div>\n<hr>\n<h3 id="attach"><a href="#attach">attach</a></h3>\n<p><code dir="auto">serve</code> または <code dir="auto">web</code> コマンドを使用して起動された、すでに実行中の SlopCode バックエンドサーバーにターミナルを接続します。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">attach</span><span style="--0:#24292E;--1:#E1E4E8"> [url]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode attach [url]"><div></div></button></div></figure></div>\n<p>これにより、リモート SlopCode バックエンドで TUI を使用できるようになります。例えば：</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># Start the backend server for web/mobile access</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">web</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--port</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">4096</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--hostname</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">0.0.0.0</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># In another terminal, attach the TUI to the running backend</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">attach</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">http://10.20.30.40:4096</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode web --port 4096 --hostname 0.0.0.0slopcode attach http://10.20.30.40:4096"><div></div></button></div></figure></div>\n<h4 id="フラグ-1"><a href="#フラグ-1">フラグ</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>フラグ</th><th>ショート</th><th>説明</th></tr></thead><tbody><tr><td><code dir="auto">--dir</code></td><td></td><td>TUI を開始する作業ディレクトリ</td></tr><tr><td><code dir="auto">--session</code></td><td><code dir="auto">-s</code></td><td>続行するセッション ID</td></tr></tbody></table>\n<hr>\n<h4 id="create"><a href="#create">create</a></h4>\n<p>カスタム構成で新しいエージェントを作成します。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">agent</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">create</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode agent create"><div></div></button></div></figure></div>\n<p>このコマンドは、カスタムシステムプロンプトとツール構成を使用して新しいエージェントを作成する手順を示します。</p>\n<hr>\n<h4 id="list"><a href="#list">list</a></h4>\n<p>利用可能なエージェントをすべてリストします。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">agent</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">list</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode agent list"><div></div></button></div></figure></div>\n<hr>\n<h3 id="auth"><a href="#auth">auth</a></h3>\n<p>プロバイダーの資格情報とログインを管理するコマンド。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">auth</span><span style="--0:#24292E;--1:#E1E4E8"> [command]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode auth [command]"><div></div></button></div></figure></div>\n<hr>\n<h4 id="login"><a href="#login">login</a></h4>\n<p>SlopCode は <a href="https://models.dev">Models.dev</a> のプロバイダーリストを利用しているため、<code dir="auto">slopcode auth login</code> を使用して、使用したいプロバイダーの API キーを構成できます。これは <code dir="auto">~/.local/share/slopcode/auth.json</code> に保存されます。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">auth</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">login</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode auth login"><div></div></button></div></figure></div>\n<p>SlopCode が起動すると、認証情報ファイルからプロバイダーがロードされます。また、環境またはプロジェクト内の <code dir="auto">.env</code> ファイルで定義されたキーがあるかどうかも確認します。</p>\n<hr>\n<h4 id="list-1"><a href="#list-1">list</a></h4>\n<p>認証情報ファイルに保存されているすべての認証されたプロバイダーをリストします。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">auth</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">list</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode auth list"><div></div></button></div></figure></div>\n<p>またはショートバージョン。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">auth</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">ls</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode auth ls"><div></div></button></div></figure></div>\n<hr>\n<h4 id="logout"><a href="#logout">logout</a></h4>\n<p>資格情報ファイルからプロバイダーをクリアすることで、プロバイダーからログアウトします。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">auth</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">logout</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode auth logout"><div></div></button></div></figure></div>\n<hr>\n<h3 id="github"><a href="#github">github</a></h3>\n<p>リポジトリ自動化のための GitHub エージェントを管理します。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">github</span><span style="--0:#24292E;--1:#E1E4E8"> [command]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode github [command]"><div></div></button></div></figure></div>\n<hr>\n<h4 id="install"><a href="#install">install</a></h4>\n<p>GitHub エージェントをリポジトリにインストールします。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">github</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode github install"><div></div></button></div></figure></div>\n<p>これにより、必要な GitHub Actions ワークフローが設定され、構成プロセスがガイドされます。 <a href="/docs/github">詳細はこちら</a>。</p>\n<hr>\n<h4 id="run"><a href="#run">run</a></h4>\n<p>GitHub エージェントを実行します。これは通常、GitHub Actions で使用されます。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">github</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">run</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode github run"><div></div></button></div></figure></div>\n<h5 id="フラグ-2"><a href="#フラグ-2">フラグ</a></h5>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>フラグ</th><th>説明</th></tr></thead><tbody><tr><td><code dir="auto">--event</code></td><td>エージェントを実行するための GitHub モック イベント</td></tr><tr><td><code dir="auto">--token</code></td><td>GitHub 個人アクセストークン</td></tr></tbody></table>\n<hr>\n<h3 id="mcp"><a href="#mcp">mcp</a></h3>\n<p>モデルコンテキストプロトコルサーバーを管理します。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">mcp</span><span style="--0:#24292E;--1:#E1E4E8"> [command]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode mcp [command]"><div></div></button></div></figure></div>\n<hr>\n<h4 id="add"><a href="#add">add</a></h4>\n<p>MCP サーバーを構成に追加します。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">mcp</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">add</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode mcp add"><div></div></button></div></figure></div>\n<p>このコマンドは、ローカルまたはリモートの MCP サーバーを追加する手順を示します。</p>\n<hr>\n<h4 id="list-2"><a href="#list-2">list</a></h4>\n<p>構成されているすべての MCP サーバーとその接続ステータスをリストします。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">mcp</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">list</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode mcp list"><div></div></button></div></figure></div>\n<p>または、短いバージョンを使用してください。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">mcp</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">ls</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode mcp ls"><div></div></button></div></figure></div>\n<hr>\n<h4 id="auth-1"><a href="#auth-1">auth</a></h4>\n<p>OAuth 対応の MCP サーバーで認証します。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">mcp</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">auth</span><span style="--0:#24292E;--1:#E1E4E8"> [name]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode mcp auth [name]"><div></div></button></div></figure></div>\n<p>サーバー名を指定しない場合は、利用可能な OAuth 対応サーバーから選択するように求められます。</p>\n<p>OAuth 対応サーバーとその認証ステータスを一覧表示することもできます。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">mcp</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">auth</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">list</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode mcp auth list"><div></div></button></div></figure></div>\n<p>または、短いバージョンを使用してください。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">mcp</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">auth</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">ls</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode mcp auth ls"><div></div></button></div></figure></div>\n<hr>\n<h4 id="logout-1"><a href="#logout-1">logout</a></h4>\n<p>MCP サーバーの OAuth 資格情報を削除します。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">mcp</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">logout</span><span style="--0:#24292E;--1:#E1E4E8"> [name]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode mcp logout [name]"><div></div></button></div></figure></div>\n<hr>\n<h4 id="debug"><a href="#debug">debug</a></h4>\n<p>MCP サーバーの OAuth 接続の問題をデバッグします。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">mcp</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">debug</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">&#x3C;name></span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode mcp debug <name>"><div></div></button></div></figure></div>\n<hr>\n<h3 id="models"><a href="#models">models</a></h3>\n<p>構成されたプロバイダーから利用可能なすべてのモデルをリストします。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">models</span><span style="--0:#24292E;--1:#E1E4E8"> [provider]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode models [provider]"><div></div></button></div></figure></div>\n<p>このコマンドは、構成されたプロバイダー全体で利用可能なすべてのモデルを <code dir="auto">provider/model</code> の形式で表示します。</p>\n<p>これは、<a href="/docs/config/">設定</a> で使用する正確なモデル名を把握するのに役立ちます。</p>\n<p>オプションでプロバイダー ID を渡して、そのプロバイダーによってモデルをフィルターできます。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">models</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">anthropic</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode models anthropic"><div></div></button></div></figure></div>\n<h4 id="フラグ-3"><a href="#フラグ-3">フラグ</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>フラグ</th><th>説明</th></tr></thead><tbody><tr><td><code dir="auto">--refresh</code></td><td>models.dev からモデルキャッシュを更新します。</td></tr><tr><td><code dir="auto">--verbose</code></td><td>より詳細なモデル出力を使用します (コストなどのメタデータを含む)</td></tr></tbody></table>\n<p><code dir="auto">--refresh</code> フラグを使用して、キャッシュされたモデルリストを更新します。これは、新しいモデルがプロバイダーに追加され、それを SlopCode で確認したい場合に便利です。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">models</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--refresh</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode models --refresh"><div></div></button></div></figure></div>\n<hr>\n<h3 id="run-1"><a href="#run-1">run</a></h3>\n<p>プロンプトを直接渡して、非対話モードで slopcode を実行します。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">run</span><span style="--0:#24292E;--1:#E1E4E8"> [message..]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode run [message..]"><div></div></button></div></figure></div>\n<p>これは、スクリプト作成、自動化、または完全な TUI を起動せずに迅速な回答が必要な場合に便利です。例えば。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><mark><span style="--0:#5c37a0;--1:#c5acf4">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">run</span></mark><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">Explain</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">the</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">use</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">of</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">context</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">in</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">Go</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode run Explain the use of context in Go"><div></div></button></div></figure></div>\n<p>実行中の <code dir="auto">slopcode serve</code> インスタンスにアタッチして、実行ごとの MCP サーバーのコールドブート時間を回避することもできます。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># Start a headless server in one terminal</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">serve</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># In another terminal, run commands that attach to it</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">run</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--attach</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">http://localhost:4096</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">"Explain async/await in JavaScript"</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode serveslopcode run --attach http://localhost:4096 &#x22;Explain async/await in JavaScript&#x22;"><div></div></button></div></figure></div>\n<h4 id="フラグ-4"><a href="#フラグ-4">フラグ</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>フラグ</th><th>ショート</th><th>説明</th></tr></thead><tbody><tr><td><code dir="auto">--command</code></td><td></td><td>実行するコマンド。引数には message を使用します。</td></tr><tr><td><code dir="auto">--continue</code></td><td><code dir="auto">-c</code></td><td>最後のセッションを続行</td></tr><tr><td><code dir="auto">--session</code></td><td></td><td>続行時にセッションをフォーク (<code dir="auto">-s</code> または <code dir="auto">--fork</code> と併用)</td></tr><tr><td><code dir="auto">--continue</code></td><td><code dir="auto">--session</code></td><td>続行するセッション ID</td></tr><tr><td><code dir="auto">--share</code></td><td></td><td>セッションを共有する</td></tr><tr><td><code dir="auto">--model</code></td><td><code dir="auto">-m</code></td><td>プロバイダー/モデルの形式で使用するモデル</td></tr><tr><td><code dir="auto">--agent</code></td><td></td><td>使用するエージェント</td></tr><tr><td><code dir="auto">--file</code></td><td><code dir="auto">-f</code></td><td>メッセージに添付するファイル</td></tr><tr><td><code dir="auto">--format</code></td><td></td><td>形式: デフォルト (フォーマット済み) または json (生の JSON イベント)</td></tr><tr><td><code dir="auto">--title</code></td><td></td><td>セッションのタイトル (値が指定されていない場合は、切り詰められたプロンプトが使用されます)</td></tr><tr><td><code dir="auto">--attach</code></td><td></td><td>実行中の slopcode サーバー (<a href="http://localhost:4096">http://localhost:4096</a> など) に接続します。</td></tr><tr><td><code dir="auto">--port</code></td><td></td><td>ローカルサーバーのポート (デフォルトはランダムポート)</td></tr></tbody></table>\n<hr>\n<h3 id="serve"><a href="#serve">serve</a></h3>\n<p>API アクセスのためにヘッドレス SlopCode サーバーを起動します。完全な HTTP インターフェイスについては、<a href="/docs/server">サーバーのドキュメント</a> を確認してください。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">serve</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode serve"><div></div></button></div></figure></div>\n<p>これにより、TUI インターフェイスを使用せずに slopcode 機能への API アクセスを提供する HTTP サーバーが起動します。 <code dir="auto">SLOPCODE_SERVER_PASSWORD</code> を設定して HTTP 基本認証を有効にします (ユーザー名のデフォルトは <code dir="auto">slopcode</code>)。</p>\n<h4 id="フラグ-5"><a href="#フラグ-5">フラグ</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>フラグ</th><th>説明</th></tr></thead><tbody><tr><td><code dir="auto">--port</code></td><td>リッスンするポート</td></tr><tr><td><code dir="auto">--hostname</code></td><td>リッスンするホスト名</td></tr><tr><td><code dir="auto">--mdns</code></td><td>mDNS 検出を有効にする</td></tr><tr><td><code dir="auto">--cors</code></td><td>CORS を許可する追加のブラウザーオリジン</td></tr></tbody></table>\n<hr>\n<h3 id="session"><a href="#session">session</a></h3>\n<p>SlopCode セッションを管理します。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">session</span><span style="--0:#24292E;--1:#E1E4E8"> [command]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode session [command]"><div></div></button></div></figure></div>\n<hr>\n<h4 id="list-3"><a href="#list-3">list</a></h4>\n<p>すべての SlopCode セッションをリストします。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">session</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">list</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode session list"><div></div></button></div></figure></div>\n<h5 id="フラグ-6"><a href="#フラグ-6">フラグ</a></h5>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>フラグ</th><th>ショート</th><th>説明</th></tr></thead><tbody><tr><td><code dir="auto">--max-count</code></td><td><code dir="auto">-n</code></td><td>最新のセッションを N 個に制限</td></tr><tr><td><code dir="auto">--format</code></td><td></td><td>出力形式: テーブルまたは json (テーブル)</td></tr></tbody></table>\n<hr>\n<h3 id="stats"><a href="#stats">stats</a></h3>\n<p>SlopCode セッションのトークンの使用状況とコストの統計を表示します。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">stats</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode stats"><div></div></button></div></figure></div>\n<h4 id="フラグ-7"><a href="#フラグ-7">フラグ</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>フラグ</th><th>説明</th></tr></thead><tbody><tr><td><code dir="auto">--days</code></td><td>過去 N 日間の統計を表示 (全期間)</td></tr><tr><td><code dir="auto">--tools</code></td><td>表示するツールの数 (すべて)</td></tr><tr><td><code dir="auto">--models</code></td><td>モデルの使用状況の内訳を表示 (デフォルトでは非表示)。上位 N 件を表示するには数値を渡します</td></tr><tr><td><code dir="auto">--project</code></td><td>プロジェクトでフィルタリング (全プロジェクト、空文字列: 現在のプロジェクト)</td></tr></tbody></table>\n<hr>\n<h3 id="export"><a href="#export">export</a></h3>\n<p>セッションデータを JSON としてエクスポートします。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">export</span><span style="--0:#24292E;--1:#E1E4E8"> [sessionID]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode export [sessionID]"><div></div></button></div></figure></div>\n<p>セッション ID を指定しない場合は、利用可能なセッションから選択するように求められます。</p>\n<hr>\n<h3 id="import"><a href="#import">import</a></h3>\n<p>JSON ファイルまたは SlopCode 共有 URL からセッションデータをインポートします。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">import</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">&#x3C;file></span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode import <file>"><div></div></button></div></figure></div>\n<p>ローカルファイルまたは SlopCode 共有 URL からインポートできます。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">import</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">session.json</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">import</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">https://opncd.ai/s/abc123</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode import session.jsonslopcode import https://opncd.ai/s/abc123"><div></div></button></div></figure></div>\n<hr>\n<h3 id="web"><a href="#web">web</a></h3>\n<p>Web インターフェイスを使用してヘッドレス SlopCode サーバーを起動します。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">web</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode web"><div></div></button></div></figure></div>\n<p>これにより、HTTP サーバーが起動し、Web ブラウザが開き、Web インターフェイスを通じて SlopCode にアクセスします。 <code dir="auto">SLOPCODE_SERVER_PASSWORD</code> を設定して HTTP 基本認証を有効にします (ユーザー名のデフォルトは <code dir="auto">slopcode</code>)。</p>\n<h4 id="フラグ-8"><a href="#フラグ-8">フラグ</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>フラグ</th><th>説明</th></tr></thead><tbody><tr><td><code dir="auto">--port</code></td><td>リッスンするポート</td></tr><tr><td><code dir="auto">--hostname</code></td><td>リッスンするホスト名</td></tr><tr><td><code dir="auto">--mdns</code></td><td>mDNS 検出を有効にする</td></tr><tr><td><code dir="auto">--cors</code></td><td>CORS を許可する追加のブラウザーオリジン</td></tr></tbody></table>\n<hr>\n<h3 id="acp"><a href="#acp">acp</a></h3>\n<p>ACP (エージェントクライアントプロトコル) サーバーを起動します。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">acp</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode acp"><div></div></button></div></figure></div>\n<p>このコマンドは、nd-JSON を使用して stdin/stdout 経由で通信する ACP サーバーを起動します。</p>\n<h4 id="フラグ-9"><a href="#フラグ-9">フラグ</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>フラグ</th><th>説明</th></tr></thead><tbody><tr><td><code dir="auto">--cwd</code></td><td>作業ディレクトリ</td></tr><tr><td><code dir="auto">--port</code></td><td>リッスンするポート</td></tr><tr><td><code dir="auto">--hostname</code></td><td>リッスンするホスト名</td></tr></tbody></table>\n<hr>\n<h3 id="uninstall"><a href="#uninstall">uninstall</a></h3>\n<p>SlopCode をアンインストールし、関連ファイルをすべて削除します。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">uninstall</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode uninstall"><div></div></button></div></figure></div>\n<h4 id="フラグ-10"><a href="#フラグ-10">フラグ</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>フラグ</th><th>ショート</th><th>説明</th></tr></thead><tbody><tr><td><code dir="auto">--keep-config</code></td><td><code dir="auto">-c</code></td><td>構成ファイルを保持する</td></tr><tr><td><code dir="auto">--keep-data</code></td><td><code dir="auto">-d</code></td><td>セッションデータとスナップショットを保持する</td></tr><tr><td><code dir="auto">--dry-run</code></td><td></td><td>削除せずに削除される内容を表示する</td></tr><tr><td><code dir="auto">--force</code></td><td><code dir="auto">-f</code></td><td>確認プロンプトをスキップする</td></tr></tbody></table>\n<hr>\n<h3 id="upgrade"><a href="#upgrade">upgrade</a></h3>\n<p>slopcode を最新バージョンまたは特定のバージョンに更新します。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">upgrade</span><span style="--0:#24292E;--1:#E1E4E8"> [target]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode upgrade [target]"><div></div></button></div></figure></div>\n<p>最新バージョンにアップグレードするには。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">upgrade</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode upgrade"><div></div></button></div></figure></div>\n<p>特定のバージョンにアップグレードするには。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">upgrade</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">v0.1.48</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode upgrade v0.1.48"><div></div></button></div></figure></div>\n<h4 id="フラグ-11"><a href="#フラグ-11">フラグ</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>フラグ</th><th>ショート</th><th>説明</th></tr></thead><tbody><tr><td><code dir="auto">--method</code></td><td><code dir="auto">-m</code></td><td>使用されたインストール方法。curl, npm, pnpm, bun, brew</td></tr></tbody></table>\n<hr>\n<h2 id="グローバルフラグ"><a href="#グローバルフラグ">グローバルフラグ</a></h2>\n<p>slopcode CLI は次のグローバルフラグを受け取ります。</p>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>フラグ</th><th>ショート</th><th>説明</th></tr></thead><tbody><tr><td><code dir="auto">--help</code></td><td><code dir="auto">-h</code></td><td>ヘルプを表示</td></tr><tr><td><code dir="auto">--version</code></td><td><code dir="auto">-v</code></td><td>バージョン番号を出力</td></tr><tr><td><code dir="auto">--print-logs</code></td><td></td><td>ログを標準エラー出力に出力</td></tr><tr><td><code dir="auto">--log-level</code></td><td></td><td>ログレベル (DEBUG、INFO、WARN、ERROR)</td></tr></tbody></table>\n<hr>\n<h2 id="環境変数"><a href="#環境変数">環境変数</a></h2>\n<p>SlopCode は環境変数を使用して構成できます。</p>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>変数</th><th>タイプ</th><th>説明</th></tr></thead><tbody><tr><td><code dir="auto">SLOPCODE_AUTO_SHARE</code></td><td>ブール値</td><td>セッションを自動的に共有する</td></tr><tr><td><code dir="auto">SLOPCODE_GIT_BASH_PATH</code></td><td>文字列</td><td>Windows 上で実行可能な Git Bash へのパス</td></tr><tr><td><code dir="auto">SLOPCODE_CONFIG</code></td><td>文字列</td><td>構成ファイルへのパス</td></tr><tr><td><code dir="auto">SLOPCODE_CONFIG_DIR</code></td><td>文字列</td><td>config ディレクトリへのパス</td></tr><tr><td><code dir="auto">SLOPCODE_CONFIG_CONTENT</code></td><td>文字列</td><td>インライン JSON 構成コンテンツ</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_AUTOUPDATE</code></td><td>ブール値</td><td>自動更新チェックを無効にする</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_PRUNE</code></td><td>ブール値</td><td>古いデータのプルーニングを無効にする</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_TERMINAL_TITLE</code></td><td>ブール値</td><td>ターミナルタイトルの自動更新を無効にする</td></tr><tr><td><code dir="auto">SLOPCODE_PERMISSION</code></td><td>文字列</td><td>インライン化された json 権限設定</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_DEFAULT_PLUGINS</code></td><td>ブール値</td><td>デフォルトのプラグインを無効にする</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_LSP_DOWNLOAD</code></td><td>ブール値</td><td>LSP サーバーの自動ダウンロードを無効にする</td></tr><tr><td><code dir="auto">SLOPCODE_ENABLE_EXPERIMENTAL_MODELS</code></td><td>ブール値</td><td>実験モデルを有効にする</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_AUTOCOMPACT</code></td><td>ブール値</td><td>自動コンテキスト圧縮を無効にする</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_CLAUDE_CODE</code></td><td>ブール値</td><td><code dir="auto">.claude</code> からの読み取りを無効にする (プロンプト + スキル)</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_CLAUDE_CODE_PROMPT</code></td><td>ブール値</td><td><code dir="auto">~/.claude/CLAUDE.md</code> の読み取りを無効にする</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_CLAUDE_CODE_SKILLS</code></td><td>ブール値</td><td><code dir="auto">.claude/skills</code> のロードを無効にする</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_MODELS_FETCH</code></td><td>ブール値</td><td>リモートソースからのモデルの取得を無効にする</td></tr><tr><td><code dir="auto">SLOPCODE_FAKE_VCS</code></td><td>文字列</td><td>テスト目的の偽の VCS プロバイダー</td></tr><tr><td><code dir="auto">SLOPCODE_DISABLE_FILETIME_CHECK</code></td><td>ブール値</td><td>最適化のためにファイル時間チェックを無効にする</td></tr><tr><td><code dir="auto">SLOPCODE_CLIENT</code></td><td>文字列</td><td>クライアント識別子 (デフォルトは <code dir="auto">cli</code>)</td></tr><tr><td><code dir="auto">SLOPCODE_ENABLE_EXA</code></td><td>ブール値</td><td>Exa Web 検索ツールを有効にする</td></tr><tr><td><code dir="auto">SLOPCODE_SERVER_PASSWORD</code></td><td>文字列</td><td><code dir="auto">serve</code>/<code dir="auto">web</code> の基本認証を有効にする</td></tr><tr><td><code dir="auto">SLOPCODE_SERVER_USERNAME</code></td><td>文字列</td><td>基本認証ユーザー名 (デフォルト <code dir="auto">slopcode</code>) をオーバーライドします。</td></tr><tr><td><code dir="auto">SLOPCODE_MODELS_URL</code></td><td>文字列</td><td>モデル設定を取得するためのカスタム URL</td></tr></tbody></table>\n<hr>\n<h3 id="実験的"><a href="#実験的">実験的</a></h3>\n<p>これらの環境変数により、変更または削除される可能性のある実験的な機能が有効になります。</p>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>変数</th><th>タイプ</th><th>説明</th></tr></thead><tbody><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL</code></td><td>ブール値</td><td>すべての実験的機能を有効にする</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_ICON_DISCOVERY</code></td><td>ブール値</td><td>アイコン検出を有効にする</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_DISABLE_COPY_ON_SELECT</code></td><td>ブール値</td><td>TUI で選択時のコピーを無効にする</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_BASH_DEFAULT_TIMEOUT_MS</code></td><td>数値</td><td>bash コマンドのデフォルトのタイムアウト (ミリ秒)</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_OUTPUT_TOKEN_MAX</code></td><td>数値</td><td>LLM 応答の最大出力トークン</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_FILEWATCHER</code></td><td>ブール値</td><td>ディレクトリ全体のファイル監視を有効にする</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_OXFMT</code></td><td>ブール値</td><td>oxfmt フォーマッタを有効にする</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_LSP_TOOL</code></td><td>ブール値</td><td>実験的な LSP ツールを有効にする</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_DISABLE_FILEWATCHER</code></td><td>ブール値</td><td>ファイルウォッチャーを無効にする</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_EXA</code></td><td>ブール値</td><td>実験的な Exa 機能を有効にする</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_LSP_TY</code></td><td>ブール値</td><td>実験的な LSP タイプチェックを有効にする</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_MARKDOWN</code></td><td>ブール値</td><td>試験的な Markdown 機能を有効にする</td></tr><tr><td><code dir="auto">SLOPCODE_EXPERIMENTAL_PLAN_MODE</code></td><td>ブール値</td><td>プランモードを有効にする</td></tr></tbody></table>',
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
const url = "src/content/docs/ja/cli.mdx"
const file = "/app/packages/web/src/content/docs/ja/cli.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/app/packages/web/src/content/docs/ja/cli.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
