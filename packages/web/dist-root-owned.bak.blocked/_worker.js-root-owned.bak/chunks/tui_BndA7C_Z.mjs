globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"
import { $ as $$Tabs, a as $$TabItem } from "./Code_sjN3308E.mjs"

const frontmatter = {
  title: "TUI",
  description: "使用 SlopCode 終端機使用者介面。",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "檔案參考",
      text: "檔案參考",
    },
    {
      depth: 2,
      slug: "bash-指令",
      text: "Bash 指令",
    },
    {
      depth: 2,
      slug: "指令",
      text: "指令",
    },
    {
      depth: 3,
      slug: "connect",
      text: "connect",
    },
    {
      depth: 3,
      slug: "compact",
      text: "compact",
    },
    {
      depth: 3,
      slug: "editor",
      text: "editor",
    },
    {
      depth: 3,
      slug: "exit",
      text: "exit",
    },
    {
      depth: 3,
      slug: "export",
      text: "export",
    },
    {
      depth: 3,
      slug: "help",
      text: "help",
    },
    {
      depth: 3,
      slug: "history",
      text: "history",
    },
    {
      depth: 3,
      slug: "init",
      text: "init",
    },
    {
      depth: 3,
      slug: "models",
      text: "models",
    },
    {
      depth: 3,
      slug: "new",
      text: "new",
    },
    {
      depth: 3,
      slug: "redo",
      text: "redo",
    },
    {
      depth: 3,
      slug: "sessions",
      text: "sessions",
    },
    {
      depth: 3,
      slug: "share",
      text: "share",
    },
    {
      depth: 3,
      slug: "themes",
      text: "themes",
    },
    {
      depth: 3,
      slug: "thinking",
      text: "thinking",
    },
    {
      depth: 3,
      slug: "undo",
      text: "undo",
    },
    {
      depth: 3,
      slug: "unshare",
      text: "unshare",
    },
    {
      depth: 2,
      slug: "history-mode",
      text: "History mode",
    },
    {
      depth: 2,
      slug: "編輯器設定",
      text: "編輯器設定",
    },
    {
      depth: 2,
      slug: "設定",
      text: "設定",
    },
    {
      depth: 3,
      slug: "選項",
      text: "選項",
    },
    {
      depth: 2,
      slug: "自訂",
      text: "自訂",
    },
    {
      depth: 4,
      slug: "使用者名稱顯示",
      text: "使用者名稱顯示",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment: Fragment$1 } = props.components || {}
  if (!Fragment$1) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    children: [
      createVNode(Fragment$1, {
        "set:html":
          '<p>SlopCode 提供了一個互動式終端機介面（TUI），用於配合 LLM 處理您的專案。</p>\n<p>執行 SlopCode 即可啟動當前目錄的 TUI。</p>\n<div class="expressive-code"><link rel="stylesheet" href="/docs/_astro/ec.4c0k7.css"><script type="module" src="/docs/_astro/ec.0vx5m.js"></script><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode"><div></div></button></div></figure></div>\n<p>或者您可以為指定的工作目錄啟動它。</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">/path/to/project</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode /path/to/project"><div></div></button></div></figure></div>\n<p>進入 TUI 後，您可以輸入訊息進行提示。</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="text"><code><div class="ec-line"><div class="code"><span style="--0:#24292e;--1:#e1e4e8">Give me a quick summary of the codebase.</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="Give me a quick summary of the codebase."><div></div></button></div></figure></div>\n<hr>\n<h2 id="檔案參考"><a href="#檔案參考">檔案參考</a></h2>\n<p>您可以使用 <code dir="auto">@</code> 在訊息中參考檔案。這會在當前工作目錄中進行模糊檔案搜尋。</p>\n<aside aria-label="Tip" class="starlight-aside starlight-aside--tip"><p class="starlight-aside__title" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="starlight-aside__icon"><path fill-rule="evenodd" clip-rule="evenodd" d="M1.43909 8.85483L1.44039 8.85354L4.96668 5.33815C5.30653 4.99386 5.7685 4.79662 6.2524 4.78972L6.26553 4.78963L12.9014 4.78962L13.8479 3.84308C16.9187 0.772319 20.0546 0.770617 21.4678 0.975145C21.8617 1.02914 22.2271 1.21053 22.5083 1.4917C22.7894 1.77284 22.9708 2.13821 23.0248 2.53199C23.2294 3.94517 23.2278 7.08119 20.1569 10.1521L19.2107 11.0983V17.7338L19.2106 17.7469C19.2037 18.2308 19.0067 18.6933 18.6624 19.0331L15.1456 22.5608C14.9095 22.7966 14.6137 22.964 14.29 23.0449C13.9663 23.1259 13.6267 23.1174 13.3074 23.0204C12.9881 22.9235 12.7011 22.7417 12.4771 22.4944C12.2533 22.2473 12.1006 21.9441 12.0355 21.6171L11.1783 17.3417L6.65869 12.822L4.34847 12.3589L2.38351 11.965C2.05664 11.8998 1.75272 11.747 1.50564 11.5232C1.25835 11.2992 1.07653 11.0122 0.979561 10.6929C0.882595 10.3736 0.874125 10.034 0.955057 9.7103C1.03599 9.38659 1.20328 9.09092 1.43909 8.85483ZM6.8186 10.8724L2.94619 10.096L6.32006 6.73268H10.9583L6.8186 10.8724ZM15.2219 5.21703C17.681 2.75787 20.0783 2.75376 21.1124 2.8876C21.2462 3.92172 21.2421 6.31895 18.783 8.77812L12.0728 15.4883L8.51172 11.9272L15.2219 5.21703ZM13.9042 21.0538L13.1279 17.1811L17.2676 13.0414V17.68L13.9042 21.0538Z"></path><path d="M9.31827 18.3446C9.45046 17.8529 9.17864 17.3369 8.68945 17.1724C8.56178 17.1294 8.43145 17.1145 8.30512 17.1243C8.10513 17.1398 7.91519 17.2172 7.76181 17.3434C7.62613 17.455 7.51905 17.6048 7.45893 17.7835C6.97634 19.2186 5.77062 19.9878 4.52406 20.4029C4.08525 20.549 3.6605 20.644 3.29471 20.7053C3.35607 20.3395 3.45098 19.9148 3.59711 19.476C4.01221 18.2294 4.78141 17.0237 6.21648 16.5411C6.39528 16.481 6.54504 16.3739 6.65665 16.2382C6.85126 16.0016 6.92988 15.678 6.84417 15.3647C6.83922 15.3466 6.83373 15.3286 6.82767 15.3106C6.74106 15.053 6.55701 14.8557 6.33037 14.7459C6.10949 14.6389 5.84816 14.615 5.59715 14.6994C5.47743 14.7397 5.36103 14.7831 5.24786 14.8294C3.22626 15.6569 2.2347 17.4173 1.75357 18.8621C1.49662 19.6337 1.36993 20.3554 1.30679 20.8818C1.27505 21.1464 1.25893 21.3654 1.25072 21.5213C1.24662 21.5993 1.24448 21.6618 1.24337 21.7066L1.243 21.7226L1.24235 21.7605L1.2422 21.7771L1.24217 21.7827L1.24217 21.7856C1.24217 22.3221 1.67703 22.7579 2.2137 22.7579L2.2155 22.7579L2.22337 22.7578L2.23956 22.7577C2.25293 22.7575 2.27096 22.7572 2.29338 22.7567C2.33821 22.7555 2.40073 22.7534 2.47876 22.7493C2.63466 22.7411 2.85361 22.725 3.11822 22.6932C3.64462 22.6301 4.36636 22.5034 5.13797 22.2464C6.58274 21.7653 8.3431 20.7738 9.17063 18.7522C9.21696 18.639 9.26037 18.5226 9.30064 18.4029C9.30716 18.3835 9.31304 18.364 9.31827 18.3446Z"></path></svg>Tip</p><div class="starlight-aside__content"><p>您還可以使用 <code dir="auto">@</code> 來參考訊息中的檔案。</p></div></aside>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="text"><code><div class="ec-line"><div class="code"><span style="--0:#24292e;--1:#e1e4e8">How is auth handled in </span><mark><span style="--0:#24292e;--1:#e1e4e8">@packages/functions/src/api/index.ts</span></mark><span style="--0:#24292e;--1:#e1e4e8">?</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="How is auth handled in @packages/functions/src/api/index.ts?"><div></div></button></div></figure></div>\n<p>檔案的內容會自動新增到對話中。</p>\n<hr>\n<h2 id="bash-指令"><a href="#bash-指令">Bash 指令</a></h2>\n<p>以 <code dir="auto">!</code> 開頭的訊息會作為 shell 指令執行。</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">!</span><span style="--0:#6F42C1;--1:#B392F0">ls</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-la</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="!ls -la"><div></div></button></div></figure></div>\n<p>指令的輸出會作為工具結果新增到對話中。</p>\n<hr>\n<h2 id="指令"><a href="#指令">指令</a></h2>\n<p>使用 SlopCode TUI 時，您可以輸入 <code dir="auto">/</code> 後跟指令名稱來快速執行操作。例如：</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">/help</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="/help"><div></div></button></div></figure></div>\n<p>大多數指令還支援以 <code dir="auto">ctrl+x</code> 作為前導鍵的快速鍵，其中 <code dir="auto">ctrl+x</code> 是預設前導鍵。<a href="/docs/keybinds">了解更多</a>。</p>\n<p>以下是所有可用的斜線指令：</p>\n<hr>\n<h3 id="connect"><a href="#connect">connect</a></h3>\n<p>將供應商新增到 SlopCode。允許您從可用的供應商中選擇並新增其 API 金鑰。</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">/connect</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="/connect"><div></div></button></div></figure></div>\n<hr>\n<h3 id="compact"><a href="#compact">compact</a></h3>\n<p>壓縮當前工作階段。<em>別名</em>：<code dir="auto">/summarize</code></p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">/compact</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="/compact"><div></div></button></div></figure></div>\n<p><strong>快速鍵：</strong> <code dir="auto">ctrl+x c</code></p>\n<hr>\n<h3 id="editor"><a href="#editor">editor</a></h3>\n<p>開啟外部編輯器來撰寫訊息。使用 <code dir="auto">EDITOR</code> 環境變數中設定的編輯器。<a href="#editor-setup">了解更多</a>。</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">/editor</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="/editor"><div></div></button></div></figure></div>\n<p><strong>快速鍵：</strong> <code dir="auto">ctrl+x e</code></p>\n<hr>\n<h3 id="exit"><a href="#exit">exit</a></h3>\n<p>退出 SlopCode。<em>別名</em>：<code dir="auto">/quit</code>、<code dir="auto">/q</code></p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">/exit</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="/exit"><div></div></button></div></figure></div>\n<p><strong>快速鍵：</strong> <code dir="auto">ctrl+x q</code></p>\n<hr>\n<h3 id="export"><a href="#export">export</a></h3>\n<p>將當前對話匯出為 Markdown 並在預設編輯器中開啟。使用 <code dir="auto">EDITOR</code> 環境變數中設定的編輯器。<a href="#editor-setup">了解更多</a>。</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">/export</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="/export"><div></div></button></div></figure></div>\n<p><strong>快速鍵：</strong> <code dir="auto">ctrl+x x</code></p>\n<hr>\n<h3 id="help"><a href="#help">help</a></h3>\n<p>顯示說明對話框。</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">/help</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="/help"><div></div></button></div></figure></div>\n<p><strong>快速鍵：</strong> <code dir="auto">ctrl+x h</code></p>\n<hr>\n<h3 id="history"><a href="#history">history</a></h3>\n<p>Toggle history mode for session navigation.</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">/history</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="/history"><div></div></button></div></figure></div>\n<p><strong>快速鍵：</strong> <code dir="auto">history_mode_toggle</code> defaults to <code dir="auto">ctrl+h,ctrl+j</code></p>\n<hr>\n<h3 id="init"><a href="#init">init</a></h3>\n<p>建立或更新 <code dir="auto">AGENTS.md</code> 檔案。<a href="/docs/rules">了解更多</a>。</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">/init</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="/init"><div></div></button></div></figure></div>\n<p><strong>快速鍵：</strong> <code dir="auto">ctrl+x i</code></p>\n<hr>\n<h3 id="models"><a href="#models">models</a></h3>\n<p>列出可用模型。</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">/models</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="/models"><div></div></button></div></figure></div>\n<p><strong>快速鍵：</strong> <code dir="auto">ctrl+x m</code></p>\n<hr>\n<h3 id="new"><a href="#new">new</a></h3>\n<p>開始新的工作階段。<em>別名</em>：<code dir="auto">/clear</code></p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">/new</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="/new"><div></div></button></div></figure></div>\n<p><strong>快速鍵：</strong> <code dir="auto">ctrl+x n</code></p>\n<hr>\n<h3 id="redo"><a href="#redo">redo</a></h3>\n<p>重做之前復原的訊息。僅在使用 <code dir="auto">/undo</code> 後可用。</p>\n<aside aria-label="Tip" class="starlight-aside starlight-aside--tip"><p class="starlight-aside__title" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="starlight-aside__icon"><path fill-rule="evenodd" clip-rule="evenodd" d="M1.43909 8.85483L1.44039 8.85354L4.96668 5.33815C5.30653 4.99386 5.7685 4.79662 6.2524 4.78972L6.26553 4.78963L12.9014 4.78962L13.8479 3.84308C16.9187 0.772319 20.0546 0.770617 21.4678 0.975145C21.8617 1.02914 22.2271 1.21053 22.5083 1.4917C22.7894 1.77284 22.9708 2.13821 23.0248 2.53199C23.2294 3.94517 23.2278 7.08119 20.1569 10.1521L19.2107 11.0983V17.7338L19.2106 17.7469C19.2037 18.2308 19.0067 18.6933 18.6624 19.0331L15.1456 22.5608C14.9095 22.7966 14.6137 22.964 14.29 23.0449C13.9663 23.1259 13.6267 23.1174 13.3074 23.0204C12.9881 22.9235 12.7011 22.7417 12.4771 22.4944C12.2533 22.2473 12.1006 21.9441 12.0355 21.6171L11.1783 17.3417L6.65869 12.822L4.34847 12.3589L2.38351 11.965C2.05664 11.8998 1.75272 11.747 1.50564 11.5232C1.25835 11.2992 1.07653 11.0122 0.979561 10.6929C0.882595 10.3736 0.874125 10.034 0.955057 9.7103C1.03599 9.38659 1.20328 9.09092 1.43909 8.85483ZM6.8186 10.8724L2.94619 10.096L6.32006 6.73268H10.9583L6.8186 10.8724ZM15.2219 5.21703C17.681 2.75787 20.0783 2.75376 21.1124 2.8876C21.2462 3.92172 21.2421 6.31895 18.783 8.77812L12.0728 15.4883L8.51172 11.9272L15.2219 5.21703ZM13.9042 21.0538L13.1279 17.1811L17.2676 13.0414V17.68L13.9042 21.0538Z"></path><path d="M9.31827 18.3446C9.45046 17.8529 9.17864 17.3369 8.68945 17.1724C8.56178 17.1294 8.43145 17.1145 8.30512 17.1243C8.10513 17.1398 7.91519 17.2172 7.76181 17.3434C7.62613 17.455 7.51905 17.6048 7.45893 17.7835C6.97634 19.2186 5.77062 19.9878 4.52406 20.4029C4.08525 20.549 3.6605 20.644 3.29471 20.7053C3.35607 20.3395 3.45098 19.9148 3.59711 19.476C4.01221 18.2294 4.78141 17.0237 6.21648 16.5411C6.39528 16.481 6.54504 16.3739 6.65665 16.2382C6.85126 16.0016 6.92988 15.678 6.84417 15.3647C6.83922 15.3466 6.83373 15.3286 6.82767 15.3106C6.74106 15.053 6.55701 14.8557 6.33037 14.7459C6.10949 14.6389 5.84816 14.615 5.59715 14.6994C5.47743 14.7397 5.36103 14.7831 5.24786 14.8294C3.22626 15.6569 2.2347 17.4173 1.75357 18.8621C1.49662 19.6337 1.36993 20.3554 1.30679 20.8818C1.27505 21.1464 1.25893 21.3654 1.25072 21.5213C1.24662 21.5993 1.24448 21.6618 1.24337 21.7066L1.243 21.7226L1.24235 21.7605L1.2422 21.7771L1.24217 21.7827L1.24217 21.7856C1.24217 22.3221 1.67703 22.7579 2.2137 22.7579L2.2155 22.7579L2.22337 22.7578L2.23956 22.7577C2.25293 22.7575 2.27096 22.7572 2.29338 22.7567C2.33821 22.7555 2.40073 22.7534 2.47876 22.7493C2.63466 22.7411 2.85361 22.725 3.11822 22.6932C3.64462 22.6301 4.36636 22.5034 5.13797 22.2464C6.58274 21.7653 8.3431 20.7738 9.17063 18.7522C9.21696 18.639 9.26037 18.5226 9.30064 18.4029C9.30716 18.3835 9.31304 18.364 9.31827 18.3446Z"></path></svg>Tip</p><div class="starlight-aside__content"><p>所有檔案變更也會被恢復。</p></div></aside>\n<p>在內部，這使用 Git 來管理檔案變更。因此您的專案<strong>需要是一個 Git 儲存庫</strong>。</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">/redo</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="/redo"><div></div></button></div></figure></div>\n<p><strong>快速鍵：</strong> <code dir="auto">ctrl+x r</code></p>\n<hr>\n<h3 id="sessions"><a href="#sessions">sessions</a></h3>\n<p>列出工作階段並在工作階段之間切換。<em>別名</em>：<code dir="auto">/resume</code>、<code dir="auto">/continue</code></p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">/sessions</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="/sessions"><div></div></button></div></figure></div>\n<p><strong>快速鍵：</strong> <code dir="auto">ctrl+x l</code></p>\n<hr>\n<h3 id="share"><a href="#share">share</a></h3>\n<p>分享當前工作階段。<a href="/docs/share">了解更多</a>。</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">/share</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="/share"><div></div></button></div></figure></div>\n<p><strong>快速鍵：</strong> <code dir="auto">ctrl+x s</code></p>\n<hr>\n<h3 id="themes"><a href="#themes">themes</a></h3>\n<p>列出可用主題。</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">/themes</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="/themes"><div></div></button></div></figure></div>\n<p><strong>快速鍵：</strong> <code dir="auto">ctrl+x t</code></p>\n<hr>\n<h3 id="thinking"><a href="#thinking">thinking</a></h3>\n<p>切換對話中思考/推理區塊的可見性。啟用後，您可以看到支援擴充思考的模型的推理過程。</p>\n<aside aria-label="Note" class="starlight-aside starlight-aside--note"><p class="starlight-aside__title" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="starlight-aside__icon"><path d="M12 11C11.7348 11 11.4804 11.1054 11.2929 11.2929C11.1054 11.4804 11 11.7348 11 12V16C11 16.2652 11.1054 16.5196 11.2929 16.7071C11.4804 16.8946 11.7348 17 12 17C12.2652 17 12.5196 16.8946 12.7071 16.7071C12.8946 16.5196 13 16.2652 13 16V12C13 11.7348 12.8946 11.4804 12.7071 11.2929C12.5196 11.1054 12.2652 11 12 11ZM12.38 7.08C12.1365 6.97998 11.8635 6.97998 11.62 7.08C11.4973 7.12759 11.3851 7.19896 11.29 7.29C11.2017 7.3872 11.1306 7.49882 11.08 7.62C11.024 7.73868 10.9966 7.86882 11 8C10.9992 8.13161 11.0245 8.26207 11.0742 8.38391C11.124 8.50574 11.1973 8.61656 11.29 8.71C11.3872 8.79833 11.4988 8.86936 11.62 8.92C11.7715 8.98224 11.936 9.00632 12.099 8.99011C12.2619 8.97391 12.4184 8.91792 12.5547 8.82707C12.691 8.73622 12.8029 8.61328 12.8805 8.46907C12.9582 8.32486 12.9992 8.16378 13 8C12.9963 7.73523 12.8927 7.48163 12.71 7.29C12.6149 7.19896 12.5028 7.12759 12.38 7.08ZM12 2C10.0222 2 8.08879 2.58649 6.4443 3.6853C4.79981 4.78412 3.51809 6.3459 2.76121 8.17317C2.00433 10.0004 1.8063 12.0111 2.19215 13.9509C2.578 15.8907 3.53041 17.6725 4.92894 19.0711C6.32746 20.4696 8.10929 21.422 10.0491 21.8079C11.9889 22.1937 13.9996 21.9957 15.8268 21.2388C17.6541 20.4819 19.2159 19.2002 20.3147 17.5557C21.4135 15.9112 22 13.9778 22 12C22 10.6868 21.7413 9.38642 21.2388 8.17317C20.7363 6.95991 19.9997 5.85752 19.0711 4.92893C18.1425 4.00035 17.0401 3.26375 15.8268 2.7612C14.6136 2.25866 13.3132 2 12 2ZM12 20C10.4178 20 8.87104 19.5308 7.55544 18.6518C6.23985 17.7727 5.21447 16.5233 4.60897 15.0615C4.00347 13.5997 3.84504 11.9911 4.15372 10.4393C4.4624 8.88743 5.22433 7.46197 6.34315 6.34315C7.46197 5.22433 8.88743 4.4624 10.4393 4.15372C11.9911 3.84504 13.5997 4.00346 15.0615 4.60896C16.5233 5.21447 17.7727 6.23984 18.6518 7.55544C19.5308 8.87103 20 10.4177 20 12C20 14.1217 19.1572 16.1566 17.6569 17.6569C16.1566 19.1571 14.1217 20 12 20Z"></path></svg>Note</p><div class="starlight-aside__content"><p>此指令僅控制思考區塊是否<strong>顯示</strong> — 它不會啟用或停用模型的推理能力。要切換實際的推理能力，請使用 <code dir="auto">ctrl+t</code> 循環切換模型變體。</p></div></aside>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">/thinking</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="/thinking"><div></div></button></div></figure></div>\n<hr>\n<h3 id="undo"><a href="#undo">undo</a></h3>\n<p>復原對話中的最後一條訊息。移除最近的使用者訊息、所有後續回應以及所有檔案變更。</p>\n<aside aria-label="Tip" class="starlight-aside starlight-aside--tip"><p class="starlight-aside__title" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="starlight-aside__icon"><path fill-rule="evenodd" clip-rule="evenodd" d="M1.43909 8.85483L1.44039 8.85354L4.96668 5.33815C5.30653 4.99386 5.7685 4.79662 6.2524 4.78972L6.26553 4.78963L12.9014 4.78962L13.8479 3.84308C16.9187 0.772319 20.0546 0.770617 21.4678 0.975145C21.8617 1.02914 22.2271 1.21053 22.5083 1.4917C22.7894 1.77284 22.9708 2.13821 23.0248 2.53199C23.2294 3.94517 23.2278 7.08119 20.1569 10.1521L19.2107 11.0983V17.7338L19.2106 17.7469C19.2037 18.2308 19.0067 18.6933 18.6624 19.0331L15.1456 22.5608C14.9095 22.7966 14.6137 22.964 14.29 23.0449C13.9663 23.1259 13.6267 23.1174 13.3074 23.0204C12.9881 22.9235 12.7011 22.7417 12.4771 22.4944C12.2533 22.2473 12.1006 21.9441 12.0355 21.6171L11.1783 17.3417L6.65869 12.822L4.34847 12.3589L2.38351 11.965C2.05664 11.8998 1.75272 11.747 1.50564 11.5232C1.25835 11.2992 1.07653 11.0122 0.979561 10.6929C0.882595 10.3736 0.874125 10.034 0.955057 9.7103C1.03599 9.38659 1.20328 9.09092 1.43909 8.85483ZM6.8186 10.8724L2.94619 10.096L6.32006 6.73268H10.9583L6.8186 10.8724ZM15.2219 5.21703C17.681 2.75787 20.0783 2.75376 21.1124 2.8876C21.2462 3.92172 21.2421 6.31895 18.783 8.77812L12.0728 15.4883L8.51172 11.9272L15.2219 5.21703ZM13.9042 21.0538L13.1279 17.1811L17.2676 13.0414V17.68L13.9042 21.0538Z"></path><path d="M9.31827 18.3446C9.45046 17.8529 9.17864 17.3369 8.68945 17.1724C8.56178 17.1294 8.43145 17.1145 8.30512 17.1243C8.10513 17.1398 7.91519 17.2172 7.76181 17.3434C7.62613 17.455 7.51905 17.6048 7.45893 17.7835C6.97634 19.2186 5.77062 19.9878 4.52406 20.4029C4.08525 20.549 3.6605 20.644 3.29471 20.7053C3.35607 20.3395 3.45098 19.9148 3.59711 19.476C4.01221 18.2294 4.78141 17.0237 6.21648 16.5411C6.39528 16.481 6.54504 16.3739 6.65665 16.2382C6.85126 16.0016 6.92988 15.678 6.84417 15.3647C6.83922 15.3466 6.83373 15.3286 6.82767 15.3106C6.74106 15.053 6.55701 14.8557 6.33037 14.7459C6.10949 14.6389 5.84816 14.615 5.59715 14.6994C5.47743 14.7397 5.36103 14.7831 5.24786 14.8294C3.22626 15.6569 2.2347 17.4173 1.75357 18.8621C1.49662 19.6337 1.36993 20.3554 1.30679 20.8818C1.27505 21.1464 1.25893 21.3654 1.25072 21.5213C1.24662 21.5993 1.24448 21.6618 1.24337 21.7066L1.243 21.7226L1.24235 21.7605L1.2422 21.7771L1.24217 21.7827L1.24217 21.7856C1.24217 22.3221 1.67703 22.7579 2.2137 22.7579L2.2155 22.7579L2.22337 22.7578L2.23956 22.7577C2.25293 22.7575 2.27096 22.7572 2.29338 22.7567C2.33821 22.7555 2.40073 22.7534 2.47876 22.7493C2.63466 22.7411 2.85361 22.725 3.11822 22.6932C3.64462 22.6301 4.36636 22.5034 5.13797 22.2464C6.58274 21.7653 8.3431 20.7738 9.17063 18.7522C9.21696 18.639 9.26037 18.5226 9.30064 18.4029C9.30716 18.3835 9.31304 18.364 9.31827 18.3446Z"></path></svg>Tip</p><div class="starlight-aside__content"><p>所做的任何檔案變更也會被還原。</p></div></aside>\n<p>在內部，這使用 Git 來管理檔案變更。因此您的專案<strong>需要是一個 Git 儲存庫</strong>。</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">/undo</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="/undo"><div></div></button></div></figure></div>\n<p><strong>快速鍵：</strong> <code dir="auto">ctrl+x u</code></p>\n<hr>\n<h3 id="unshare"><a href="#unshare">unshare</a></h3>\n<p>取消分享當前工作階段。<a href="/docs/share#un-sharing">了解更多</a>。</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">/unshare</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="/unshare"><div></div></button></div></figure></div>\n<hr>\n<h2 id="history-mode"><a href="#history-mode">History mode</a></h2>\n<p>Use history mode when you want to navigate existing session messages and traces without moving your hands to the mouse.</p>\n<p>While history mode is active, <code dir="auto">up</code> and <code dir="auto">down</code> move between prompts, <code dir="auto">left</code> and <code dir="auto">right</code> move between traces, and <code dir="auto">space</code> runs the context action.</p>\n<p>Pressing <code dir="auto">space</code> expands or collapses tool output, and opens a child task session when the selected item supports it.</p>\n<p>Use <code dir="auto">history_mode_toggle</code> (defaults to <code dir="auto">ctrl+h,ctrl+j</code>) to exit history mode and return to normal edit mode.</p>\n<p>Unlike normal prompt input history (<code dir="auto">history_previous</code> and <code dir="auto">history_next</code>), history mode navigates rendered session content instead of cycling through text in the input box.</p>\n<hr>\n<h2 id="編輯器設定"><a href="#編輯器設定">編輯器設定</a></h2>\n<p><code dir="auto">/editor</code> 和 <code dir="auto">/export</code> 指令都使用 <code dir="auto">EDITOR</code> 環境變數中指定的編輯器。</p>\n',
      }),
      createVNode($$Tabs, {
        children: [
          createVNode($$TabItem, {
            label: "Linux/macOS",
            "set:html":
              '<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># Example for nano or vim</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">export</span><span style="--0:#24292E;--1:#E1E4E8"> EDITOR</span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8">nano</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">export</span><span style="--0:#24292E;--1:#E1E4E8"> EDITOR</span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8">vim</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># For GUI editors, VS Code, Cursor, VSCodium, Windsurf, Zed, etc.</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># include --wait</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">export</span><span style="--0:#24292E;--1:#E1E4E8"> EDITOR</span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#032F62;--1:#9ECBFF">"code --wait"</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="export EDITOR=nanoexport EDITOR=vimexport EDITOR=&#x22;code --wait&#x22;"><div></div></button></div></figure></div><p>要使其永久生效，請將其新增到您的 shell 設定檔中；\n<code dir="auto">~/.bashrc</code>、<code dir="auto">~/.zshrc</code> 等。</p>',
          }),
          createVNode($$TabItem, {
            label: "Windows (CMD)",
            "set:html":
              '<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#005CC5;--1:#79B8FF">set</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">EDITOR=notepad</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># For GUI editors, VS Code, Cursor, VSCodium, Windsurf, Zed, etc.</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># include --wait</span></div></div><div class="ec-line"><div class="code"><span style="--0:#005CC5;--1:#79B8FF">set</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">EDITOR=code</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--wait</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="set EDITOR=notepadset EDITOR=code --wait"><div></div></button></div></figure></div><p>要使其永久生效，請使用<strong>系統內容</strong> > <strong>環境變數</strong>。</p>',
          }),
          createVNode($$TabItem, {
            label: "Windows (PowerShell)",
            "set:html":
              '<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="powershell"><code><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">$</span><span style="--0:#005CC5;--1:#79B8FF">env:</span><span style="--0:#24292E;--1:#E1E4E8">EDITOR </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">"notepad"</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># For GUI editors, VS Code, Cursor, VSCodium, Windsurf, Zed, etc.</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># include --wait</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">$</span><span style="--0:#005CC5;--1:#79B8FF">env:</span><span style="--0:#24292E;--1:#E1E4E8">EDITOR </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">"code --wait"</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="$env:EDITOR = &#x22;notepad&#x22;$env:EDITOR = &#x22;code --wait&#x22;"><div></div></button></div></figure></div><p>要使其永久生效，請將其新增到您的 PowerShell 設定檔中。</p>',
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<p>常用的編輯器選項包括：</p>\n<ul>\n<li><code dir="auto">code</code> - Visual Studio Code</li>\n<li><code dir="auto">cursor</code> - Cursor</li>\n<li><code dir="auto">windsurf</code> - Windsurf</li>\n<li><code dir="auto">nvim</code> - Neovim 編輯器</li>\n<li><code dir="auto">vim</code> - Vim 編輯器</li>\n<li><code dir="auto">nano</code> - Nano 編輯器</li>\n<li><code dir="auto">notepad</code> - Notepad（Windows 記事本）</li>\n<li><code dir="auto">subl</code> - Sublime Text</li>\n</ul>\n<aside aria-label="Note" class="starlight-aside starlight-aside--note"><p class="starlight-aside__title" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="starlight-aside__icon"><path d="M12 11C11.7348 11 11.4804 11.1054 11.2929 11.2929C11.1054 11.4804 11 11.7348 11 12V16C11 16.2652 11.1054 16.5196 11.2929 16.7071C11.4804 16.8946 11.7348 17 12 17C12.2652 17 12.5196 16.8946 12.7071 16.7071C12.8946 16.5196 13 16.2652 13 16V12C13 11.7348 12.8946 11.4804 12.7071 11.2929C12.5196 11.1054 12.2652 11 12 11ZM12.38 7.08C12.1365 6.97998 11.8635 6.97998 11.62 7.08C11.4973 7.12759 11.3851 7.19896 11.29 7.29C11.2017 7.3872 11.1306 7.49882 11.08 7.62C11.024 7.73868 10.9966 7.86882 11 8C10.9992 8.13161 11.0245 8.26207 11.0742 8.38391C11.124 8.50574 11.1973 8.61656 11.29 8.71C11.3872 8.79833 11.4988 8.86936 11.62 8.92C11.7715 8.98224 11.936 9.00632 12.099 8.99011C12.2619 8.97391 12.4184 8.91792 12.5547 8.82707C12.691 8.73622 12.8029 8.61328 12.8805 8.46907C12.9582 8.32486 12.9992 8.16378 13 8C12.9963 7.73523 12.8927 7.48163 12.71 7.29C12.6149 7.19896 12.5028 7.12759 12.38 7.08ZM12 2C10.0222 2 8.08879 2.58649 6.4443 3.6853C4.79981 4.78412 3.51809 6.3459 2.76121 8.17317C2.00433 10.0004 1.8063 12.0111 2.19215 13.9509C2.578 15.8907 3.53041 17.6725 4.92894 19.0711C6.32746 20.4696 8.10929 21.422 10.0491 21.8079C11.9889 22.1937 13.9996 21.9957 15.8268 21.2388C17.6541 20.4819 19.2159 19.2002 20.3147 17.5557C21.4135 15.9112 22 13.9778 22 12C22 10.6868 21.7413 9.38642 21.2388 8.17317C20.7363 6.95991 19.9997 5.85752 19.0711 4.92893C18.1425 4.00035 17.0401 3.26375 15.8268 2.7612C14.6136 2.25866 13.3132 2 12 2ZM12 20C10.4178 20 8.87104 19.5308 7.55544 18.6518C6.23985 17.7727 5.21447 16.5233 4.60897 15.0615C4.00347 13.5997 3.84504 11.9911 4.15372 10.4393C4.4624 8.88743 5.22433 7.46197 6.34315 6.34315C7.46197 5.22433 8.88743 4.4624 10.4393 4.15372C11.9911 3.84504 13.5997 4.00346 15.0615 4.60896C16.5233 5.21447 17.7727 6.23984 18.6518 7.55544C19.5308 8.87103 20 10.4177 20 12C20 14.1217 19.1572 16.1566 17.6569 17.6569C16.1566 19.1571 14.1217 20 12 20Z"></path></svg>Note</p><div class="starlight-aside__content"><p>某些編輯器（如 VS Code）需要以 <code dir="auto">--wait</code> 旗標啟動。</p></div></aside>\n<p>某些編輯器需要命令列參數才能以阻塞模式執行。<code dir="auto">--wait</code> 旗標使編輯器程序阻塞直到關閉。</p>\n<hr>\n<h2 id="設定"><a href="#設定">設定</a></h2>\n<p>您可以透過 SlopCode 設定檔自訂 TUI 行為。</p>\n<div class="expressive-code"><figure class="frame has-title not-content"><figcaption class="header"><span class="title">slopcode.json</span></figcaption><pre data-language="json"><code><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">{</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"$schema"</span><span style="--0:#24292E;--1:#E1E4E8">: </span><span style="--0:#032F62;--1:#9ECBFF">"https://slopcode.dev/config.json"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"tui"</span><span style="--0:#24292E;--1:#E1E4E8">: {</span></div></div><div class="ec-line"><div class="code"><span class="indent">    </span><span style="--0:#005CC5;--1:#79B8FF">"scroll_speed"</span><span style="--0:#24292E;--1:#E1E4E8">: </span><span style="--0:#005CC5;--1:#79B8FF">3</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent">    </span><span style="--0:#005CC5;--1:#79B8FF">"scroll_acceleration"</span><span style="--0:#24292E;--1:#E1E4E8">: {</span></div></div><div class="ec-line"><div class="code"><span class="indent">      </span><span style="--0:#005CC5;--1:#79B8FF">"enabled"</span><span style="--0:#24292E;--1:#E1E4E8">: </span><span style="--0:#005CC5;--1:#79B8FF">true</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">}</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">}</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">}</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="{  &#x22;$schema&#x22;: &#x22;https://slopcode.dev/config.json&#x22;,  &#x22;tui&#x22;: {    &#x22;scroll_speed&#x22;: 3,    &#x22;scroll_acceleration&#x22;: {      &#x22;enabled&#x22;: true    }  }}"><div></div></button></div></figure></div>\n<h3 id="選項"><a href="#選項">選項</a></h3>\n<ul>\n<li><code dir="auto">scroll_acceleration</code> - 啟用 macOS 風格的捲動加速，實現平滑、自然的捲動體驗。啟用後，快速捲動時速度會增加，慢速移動時保持精確。<strong>此設定優先於 <code dir="auto">scroll_speed</code>，啟用時會覆蓋它。</strong></li>\n<li><code dir="auto">scroll_speed</code> - 控制使用捲動指令時 TUI 的捲動速度（最小值：<code dir="auto">1</code>）。預設為 <code dir="auto">3</code>。<strong>注意：如果 <code dir="auto">scroll_acceleration.enabled</code> 設定為 <code dir="auto">true</code>，則此設定會被忽略。</strong></li>\n</ul>\n<hr>\n<h2 id="自訂"><a href="#自訂">自訂</a></h2>\n<p>您可以使用指令面板（<code dir="auto">ctrl+x h</code> 或 <code dir="auto">/help</code>）自訂 TUI 檢視的各個方面。這些設定在重新啟動後仍會保留。</p>\n<hr>\n<h4 id="使用者名稱顯示"><a href="#使用者名稱顯示">使用者名稱顯示</a></h4>\n<p>切換您的使用者名稱是否顯示在聊天訊息中。透過以下方式存取：</p>\n<ul>\n<li>指令面板：搜尋「username」或「hide username」</li>\n<li>該設定會自動儲存，並在各個 TUI 工作階段中保持記憶</li>\n</ul>',
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

const url = "src/content/docs/zh-tw/tui.mdx"
const file = "/app/packages/web/src/content/docs/zh-tw/tui.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/app/packages/web/src/content/docs/zh-tw/tui.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
