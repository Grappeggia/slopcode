globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"

const frontmatter = {
  title: "トラブルシューティング",
  description: "よくある問題とその解決方法。",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "ログ",
      text: "ログ",
    },
    {
      depth: 2,
      slug: "ストレージ",
      text: "ストレージ",
    },
    {
      depth: 2,
      slug: "デスクトップアプリ",
      text: "デスクトップアプリ",
    },
    {
      depth: 3,
      slug: "クイックチェック",
      text: "クイックチェック",
    },
    {
      depth: 3,
      slug: "プラグインを無効にする",
      text: "プラグインを無効にする",
    },
    {
      depth: 4,
      slug: "グローバル設定の確認",
      text: "グローバル設定の確認",
    },
    {
      depth: 4,
      slug: "プラグインディレクトリの確認",
      text: "プラグインディレクトリの確認",
    },
    {
      depth: 3,
      slug: "キャッシュをクリアする",
      text: "キャッシュをクリアする",
    },
    {
      depth: 3,
      slug: "サーバー接続の問題の修正",
      text: "サーバー接続の問題の修正",
    },
    {
      depth: 4,
      slug: "デスクトップのデフォルトのサーバー-url-をクリアします",
      text: "デスクトップのデフォルトのサーバー URL をクリアします",
    },
    {
      depth: 4,
      slug: "設定から-serverport--serverhostname-を削除します",
      text: "設定から server.port / server.hostname を削除します",
    },
    {
      depth: 4,
      slug: "環境変数を確認する",
      text: "環境変数を確認する",
    },
    {
      depth: 3,
      slug: "linux-wayland--x11-の問題",
      text: "Linux: Wayland / X11 の問題",
    },
    {
      depth: 3,
      slug: "windows-webview2-ランタイム",
      text: "Windows: WebView2 ランタイム",
    },
    {
      depth: 3,
      slug: "windows-一般的なパフォーマンスの問題",
      text: "Windows: 一般的なパフォーマンスの問題",
    },
    {
      depth: 3,
      slug: "通知が表示されない",
      text: "通知が表示されない",
    },
    {
      depth: 3,
      slug: "デスクトップアプリのストレージのリセット-最後の手段",
      text: "デスクトップアプリのストレージのリセット (最後の手段)",
    },
    {
      depth: 2,
      slug: "ヘルプを求める",
      text: "ヘルプを求める",
    },
    {
      depth: 2,
      slug: "よくある問題",
      text: "よくある問題",
    },
    {
      depth: 3,
      slug: "slopcode-が起動しない",
      text: "SlopCode が起動しない",
    },
    {
      depth: 3,
      slug: "認証の問題",
      text: "認証の問題",
    },
    {
      depth: 3,
      slug: "モデルが見つからない",
      text: "モデルが見つからない",
    },
    {
      depth: 3,
      slug: "provideriniterror",
      text: "ProviderInitError",
    },
    {
      depth: 3,
      slug: "ai_apicallerror-とプロバイダーパッケージの問題",
      text: "AI_APICallError とプロバイダーパッケージの問題",
    },
    {
      depth: 3,
      slug: "linux-ではコピーペーストが機能しない",
      text: "Linux ではコピー/ペーストが機能しない",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>SlopCode の問題をデバッグするには、まず、ディスク上に保存されているログとローカルデータを確認します。</p>\n<hr>\n<h2 id="ログ"><a href="#ログ">ログ</a></h2>\n<p>ログファイルは次の場所に書き込まれます。</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.local/share/slopcode/log/</code></li>\n<li><strong>Windows</strong>: <code dir="auto">WIN+R</code> を押して <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode\\log</code> を貼り付けます</li>\n</ul>\n<p>ログファイルにはタイムスタンプ付きの名前が付けられ (例: <code dir="auto">2025-01-09T123456.log</code>)、最新の 10 個のログファイルが保存されます。</p>\n<p><code dir="auto">--log-level</code> コマンドラインオプションを使用してログレベルを設定すると、より詳細なデバッグ情報を取得できます。たとえば、<code dir="auto">slopcode --log-level DEBUG</code>。</p>\n<hr>\n<h2 id="ストレージ"><a href="#ストレージ">ストレージ</a></h2>\n<p>SlopCode は、セッションデータとその他のアプリケーションデータをディスク上の次の場所に保存します。</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.local/share/slopcode/</code></li>\n<li><strong>Windows</strong>: <code dir="auto">WIN+R</code> を押して <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode</code> を貼り付けます</li>\n</ul>\n<p>このディレクトリには次のものが含まれます。</p>\n<ul>\n<li><code dir="auto">auth.json</code> - API キー、OAuth トークンなどの認証データ</li>\n<li><code dir="auto">log/</code> - アプリケーションログ</li>\n<li><code dir="auto">project/</code> - セッションデータやメッセージデータなどのプロジェクト固有のデータ\n<ul>\n<li>プロジェクトが Git リポジトリ内にある場合は、<code dir="auto">./&#x3C;project-slug>/storage/</code> に保存されます</li>\n<li>Git リポジトリではない場合は、<code dir="auto">./global/storage/</code> に保存されます</li>\n</ul>\n</li>\n</ul>\n<hr>\n<h2 id="デスクトップアプリ"><a href="#デスクトップアプリ">デスクトップアプリ</a></h2>\n<p>SlopCode Desktop は、ローカル SlopCode サーバー (<code dir="auto">slopcode-cli</code> サイドカー) をバックグラウンドで実行します。ほとんどの問題は、誤動作しているプラグイン、破損したキャッシュ、または不正なサーバー設定によって発生します。</p>\n<h3 id="クイックチェック"><a href="#クイックチェック">クイックチェック</a></h3>\n<ul>\n<li>アプリを完全に終了して再起動します。</li>\n<li>アプリにエラー画面が表示された場合は、<strong>再起動</strong> をクリックしてエラーの詳細をコピーします。</li>\n<li>macOS のみ: <code dir="auto">SlopCode</code> メニュー -> <strong>Webview をリロード</strong> (UI が空白またはフリーズしている場合に役立ちます)。</li>\n</ul>\n<hr>\n<h3 id="プラグインを無効にする"><a href="#プラグインを無効にする">プラグインを無効にする</a></h3>\n<p>デスクトップアプリが起動時にクラッシュしたり、ハングしたり、異常な動作をしたりする場合は、まずプラグインを無効にしてください。</p>\n<h4 id="グローバル設定の確認"><a href="#グローバル設定の確認">グローバル設定の確認</a></h4>\n<p>グローバル設定ファイルを開き、<code dir="auto">plugin</code> キーを探します。</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.config/slopcode/slopcode.jsonc</code> (または <code dir="auto">~/.config/slopcode/slopcode.json</code>)</li>\n<li><strong>macOS/Linux</strong> (古いインストール): <code dir="auto">~/.local/share/slopcode/slopcode.jsonc</code></li>\n<li><strong>Windows</strong>: <code dir="auto">WIN+R</code> を押して <code dir="auto">%USERPROFILE%\\.config\\slopcode\\slopcode.jsonc</code> を貼り付けます</li>\n</ul>\n<p>プラグインを構成している場合は、キーを削除するか空の配列に設定して、プラグインを一時的に無効にします。</p>\n<div class="expressive-code"><link rel="stylesheet" href="/docs/_astro/ec.4c0k7.css"><script type="module" src="/docs/_astro/ec.0vx5m.js"></script><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="jsonc"><code><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">{</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"$schema"</span><span style="--0:#24292E;--1:#E1E4E8">: </span><span style="--0:#032F62;--1:#9ECBFF">"https://slopcode.dev/config.json"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"plugin"</span><span style="--0:#24292E;--1:#E1E4E8">: [],</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">}</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="{  &#x22;$schema&#x22;: &#x22;https://slopcode.dev/config.json&#x22;,  &#x22;plugin&#x22;: [],}"><div></div></button></div></figure></div>\n<h4 id="プラグインディレクトリの確認"><a href="#プラグインディレクトリの確認">プラグインディレクトリの確認</a></h4>\n<p>SlopCode はディスクからローカルプラグインをロードすることもできます。これらを一時的に邪魔にならない場所に移動し (またはフォルダーの名前を変更し)、デスクトップアプリを再起動します。</p>\n<ul>\n<li><strong>グローバルプラグイン</strong>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.config/slopcode/plugins/</code></li>\n<li><strong>Windows</strong>: <code dir="auto">WIN+R</code> を押して <code dir="auto">%USERPROFILE%\\.config\\slopcode\\plugins</code> を貼り付けます</li>\n</ul>\n</li>\n<li><strong>プロジェクトプラグイン</strong> (プロジェクトごとの構成を使用する場合のみ)\n<ul>\n<li><code dir="auto">&#x3C;your-project>/.slopcode/plugins/</code></li>\n</ul>\n</li>\n</ul>\n<p>アプリが再び動作し始めた場合は、プラグインを 1 つずつ再度有効にして、問題の原因となっているプラ​​グインを特定します。</p>\n<hr>\n<h3 id="キャッシュをクリアする"><a href="#キャッシュをクリアする">キャッシュをクリアする</a></h3>\n<p>プラグインを無効にしても解決しない場合 (またはプラグインのインストールが停止した場合)、SlopCode がキャッシュを再構築できるようにキャッシュをクリアします。</p>\n<ol>\n<li>SlopCode Desktop を完全に終了します。</li>\n<li>キャッシュディレクトリを削除します。</li>\n</ol>\n<ul>\n<li><strong>macOS</strong>: Finder -> <code dir="auto">Cmd+Shift+G</code> -> <code dir="auto">~/.cache/slopcode</code> を貼り付け</li>\n<li><strong>Linux</strong>: <code dir="auto">~/.cache/slopcode</code> を削除します (または <code dir="auto">rm -rf ~/.cache/slopcode</code> を実行します)。</li>\n<li><strong>Windows</strong>: <code dir="auto">WIN+R</code> を押して <code dir="auto">%USERPROFILE%\\.cache\\slopcode</code> を貼り付けます</li>\n</ul>\n<ol start="3">\n<li>SlopCode デスクトップを再起動します。</li>\n</ol>\n<hr>\n<h3 id="サーバー接続の問題の修正"><a href="#サーバー接続の問題の修正">サーバー接続の問題の修正</a></h3>\n<p>SlopCode Desktop は、独自のローカルサーバー (デフォルト) を起動することも、構成したサーバー URL に接続することもできます。</p>\n<p><strong>「接続に失敗しました」</strong> ダイアログが表示された場合 (またはアプリがスプラッシュ画面を通過できない場合)、カスタムサーバー URL を確認してください。</p>\n<h4 id="デスクトップのデフォルトのサーバー-url-をクリアします"><a href="#デスクトップのデフォルトのサーバー-url-をクリアします">デスクトップのデフォルトのサーバー URL をクリアします</a></h4>\n<p>ホーム画面でサーバー名 (ステータスドット付き) をクリックしてサーバーピッカーを開きます。 [<strong>デフォルトサーバー</strong>] セクションで、[<strong>クリア</strong>] をクリックします。</p>\n<h4 id="設定から-serverport--serverhostname-を削除します"><a href="#設定から-serverport--serverhostname-を削除します">設定から <code dir="auto">server.port</code> / <code dir="auto">server.hostname</code> を削除します</a></h4>\n<p><code dir="auto">slopcode.json(c)</code> に <code dir="auto">server</code> セクションが含まれている場合は、それを一時的に削除し、デスクトップアプリを再起動します。</p>\n<h4 id="環境変数を確認する"><a href="#環境変数を確認する">環境変数を確認する</a></h4>\n<p>環境に <code dir="auto">SLOPCODE_PORT</code> が設定されている場合、デスクトップアプリはローカルサーバーにそのポートを使用しようとします。</p>\n<ul>\n<li><code dir="auto">SLOPCODE_PORT</code> の設定を解除して (または空きポートを選択して)、再起動します。</li>\n</ul>\n<hr>\n<h3 id="linux-wayland--x11-の問題"><a href="#linux-wayland--x11-の問題">Linux: Wayland / X11 の問題</a></h3>\n<p>Linux では、一部の Wayland セットアップにより、空白のウィンドウやコンポジターエラーが発生する可能性があります。</p>\n<ul>\n<li>Wayland を使用していて、アプリが空白またはクラッシュしている場合は、<code dir="auto">OC_ALLOW_WAYLAND=1</code> で起動してみてください。</li>\n<li>これにより状況が悪化する場合は、それを削除し、代わりに X11 セッションで起動してみてください。</li>\n</ul>\n<hr>\n<h3 id="windows-webview2-ランタイム"><a href="#windows-webview2-ランタイム">Windows: WebView2 ランタイム</a></h3>\n<p>Windows では、SlopCode Desktop には Microsoft Edge <strong>WebView2 ランタイム</strong>が必要です。アプリが空白のウィンドウで開くか、起動しない場合は、WebView2 をインストールまたは更新して、もう一度試してください。</p>\n<hr>\n<h3 id="windows-一般的なパフォーマンスの問題"><a href="#windows-一般的なパフォーマンスの問題">Windows: 一般的なパフォーマンスの問題</a></h3>\n<p>Windows でパフォーマンスの低下、ファイルアクセスの問題、またはターミナルの問題が発生している場合は、<a href="/docs/windows-wsl">WSL (Windows Subsystem for Linux)</a> を使用してみてください。 WSL は、SlopCode の機能とよりシームレスに連携する Linux 環境を提供します。</p>\n<hr>\n<h3 id="通知が表示されない"><a href="#通知が表示されない">通知が表示されない</a></h3>\n<p>SlopCode Desktop では、次の場合にのみシステム通知が表示されます。</p>\n<ul>\n<li>OS 設定で SlopCode の通知が有効になっており、</li>\n<li>アプリウィンドウにフォーカスがありません。</li>\n</ul>\n<hr>\n<h3 id="デスクトップアプリのストレージのリセット-最後の手段"><a href="#デスクトップアプリのストレージのリセット-最後の手段">デスクトップアプリのストレージのリセット (最後の手段)</a></h3>\n<p>アプリが起動せず、UI 内から設定をクリアできない場合は、デスクトップアプリの保存された状態をリセットします。</p>\n<ol>\n<li>SlopCode デスクトップを終了します。</li>\n<li>これらのファイルを見つけて削除します (これらのファイルは SlopCode デスクトップアプリのデータディレクトリにあります)。</li>\n</ol>\n<ul>\n<li><code dir="auto">slopcode.settings.dat</code> (デスクトップのデフォルトサーバー URL)</li>\n<li><code dir="auto">slopcode.global.dat</code> および <code dir="auto">slopcode.workspace.*.dat</code> (最近のサーバー/プロジェクトなどの UI 状態)</li>\n</ul>\n<p>ディレクトリをすばやく見つけるには:</p>\n<ul>\n<li><strong>macOS</strong>: Finder -> <code dir="auto">Cmd+Shift+G</code> -> <code dir="auto">~/Library/Application Support</code> (その後、上記のファイル名を検索します)</li>\n<li><strong>Linux</strong>: 上記のファイル名を <code dir="auto">~/.local/share</code> で検索します。</li>\n<li><strong>Windows</strong>: <code dir="auto">WIN+R</code> -> <code dir="auto">%APPDATA%</code> を押します (その後、上記のファイル名を検索します)。</li>\n</ul>\n<hr>\n<h2 id="ヘルプを求める"><a href="#ヘルプを求める">ヘルプを求める</a></h2>\n<p>SlopCode で問題が発生している場合:</p>\n<ol>\n<li><strong>GitHub で問題を報告してください</strong></li>\n</ol>\n<p>バグを報告したり、機能をリクエストしたりする最良の方法は、GitHub リポジトリを使用することです。</p>\n<p><a href="http://github.com/teamslop/slopcode/issues"><strong>github.com/teamslop/slopcode/issues</strong></a></p>\n<p>新しい問題を作成する前に、既存の問題を検索して、問題がすでに報告されているかどうかを確認してください。</p>\n<ol start="2">\n<li><strong>Discord への参加</strong></li>\n</ol>\n<p>リアルタイムのヘルプやコミュニティのディスカッションについては、Discord サーバーに参加してください。</p>\n<p><a href="https://slopcode.dev/discord"><strong>slopcode.dev/discord</strong></a></p>\n<hr>\n<h2 id="よくある問題"><a href="#よくある問題">よくある問題</a></h2>\n<p>ここでは、いくつかの一般的な問題とその解決方法を示します。</p>\n<hr>\n<h3 id="slopcode-が起動しない"><a href="#slopcode-が起動しない">SlopCode が起動しない</a></h3>\n<ol>\n<li>ログでエラーメッセージを確認する</li>\n<li><code dir="auto">--print-logs</code> で実行して、ターミナルに出力を確認してください。</li>\n<li><code dir="auto">slopcode upgrade</code> を含む最新バージョンを使用していることを確認してください</li>\n</ol>\n<hr>\n<h3 id="認証の問題"><a href="#認証の問題">認証の問題</a></h3>\n<ol>\n<li>TUI で <code dir="auto">/connect</code> コマンドを使用して再認証を試みます</li>\n<li>API キーが有効であることを確認してください</li>\n<li>ネットワークでプロバイダーの API への接続が許可されていることを確認してください</li>\n</ol>\n<hr>\n<h3 id="モデルが見つからない"><a href="#モデルが見つからない">モデルが見つからない</a></h3>\n<ol>\n<li>プロバイダーで認証されていることを確認してください</li>\n<li>構成内のモデル名が正しいことを確認してください</li>\n<li>一部のモデルでは、特定のアクセスまたはサブスクリプションが必要な場合があります</li>\n</ol>\n<p><code dir="auto">ProviderModelNotFoundError</code> が表示された場合は、間違いがある可能性が高くなります。\nどこかのモデルを参照しています。\nモデルは次のように参照する必要があります: <code dir="auto">&#x3C;providerId>/&#x3C;modelId></code></p>\n<p>例:</p>\n<ul>\n<li><code dir="auto">openai/gpt-4.1</code></li>\n<li><code dir="auto">openrouter/google/gemini-2.5-flash</code></li>\n<li><code dir="auto">slopcode/kimi-k2</code></li>\n</ul>\n<p>どのモデルにアクセスできるかを確認するには、<code dir="auto">slopcode models</code> を実行します。</p>\n<hr>\n<h3 id="provideriniterror"><a href="#provideriniterror">ProviderInitError</a></h3>\n<p>ProviderInitError が発生した場合は、構成が無効または破損している可能性があります。</p>\n<p>これを解決するには:</p>\n<ol>\n<li>\n<p>まず、<a href="/docs/providers">プロバイダーガイド</a> に従って、プロバイダーが正しく設定されていることを確認します。</p>\n</li>\n<li>\n<p>問題が解決しない場合は、保存されている構成をクリアしてみてください。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">rm</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-rf</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">~/.local/share/slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="rm -rf ~/.local/share/slopcode"><div></div></button></div></figure></div>\n<p>Windows では、<code dir="auto">WIN+R</code> を押して、<code dir="auto">%USERPROFILE%\\.local\\share\\slopcode</code> を削除します。</p>\n</li>\n<li>\n<p>TUI の <code dir="auto">/connect</code> コマンドを使用して、プロバイダーで再認証します。</p>\n</li>\n</ol>\n<hr>\n<h3 id="ai_apicallerror-とプロバイダーパッケージの問題"><a href="#ai_apicallerror-とプロバイダーパッケージの問題">AI_APICallError とプロバイダーパッケージの問題</a></h3>\n<p>API 呼び出しエラーが発生した場合は、プロバイダーパッケージが古いことが原因である可能性があります。 SlopCode は、必要に応じてプロバイダーパッケージ (OpenAI、Anthropic、Google など) を動的にインストールし、ローカルにキャッシュします。</p>\n<p>プロバイダーパッケージの問題を解決するには:</p>\n<ol>\n<li>\n<p>プロバイダーパッケージのキャッシュをクリアします。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">rm</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-rf</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">~/.cache/slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="rm -rf ~/.cache/slopcode"><div></div></button></div></figure></div>\n<p>Windows では、<code dir="auto">WIN+R</code> を押して、<code dir="auto">%USERPROFILE%\\.cache\\slopcode</code> を削除します。</p>\n</li>\n<li>\n<p>SlopCode を再起動して最新のプロバイダーパッケージを再インストールします</p>\n</li>\n</ol>\n<p>これにより、SlopCode はプロバイダーパッケージの最新バージョンを強制的にダウンロードすることになり、多くの場合、モデルパラメーターや API の変更に関する互換性の問題が解決されます。</p>\n<hr>\n<h3 id="linux-ではコピーペーストが機能しない"><a href="#linux-ではコピーペーストが機能しない">Linux ではコピー/ペーストが機能しない</a></h3>\n<p>Linux ユーザーがコピー/ペースト機能を動作させるには、次のクリップボードユーティリティのいずれかがインストールされている必要があります。</p>\n<p><strong>X11 システムの場合:</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xclip</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># or</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xsel</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y xclipapt install -y xsel"><div></div></button></div></figure></div>\n<p><strong>Wayland システムの場合:</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">wl-clipboard</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y wl-clipboard"><div></div></button></div></figure></div>\n<p><strong>ヘッドレス環境の場合:</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xvfb</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># and run:</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">Xvfb</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">:99</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-screen</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">0</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">1024x768x24</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">></span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">/dev/null</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">2>&#x26;1</span><span style="--0:#24292E;--1:#E1E4E8"> &#x26;</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">export</span><span style="--0:#24292E;--1:#E1E4E8"> DISPLAY</span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8">:99.0</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y xvfbXvfb :99 -screen 0 1024x768x24 > /dev/null 2>&#x26;1 &#x26;export DISPLAY=:99.0"><div></div></button></div></figure></div>\n<p>SlopCode は、Wayland を使用していて <code dir="auto">wl-clipboard</code> を優先しているかどうかを検出します。そうでない場合は、<code dir="auto">xclip</code> および <code dir="auto">xsel</code> の順序でクリップボードツールを検索しようとします。</p>',
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
const url = "src/content/docs/ja/troubleshooting.mdx"
const file =
  "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/troubleshooting.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId =
  "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/ja/troubleshooting.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
