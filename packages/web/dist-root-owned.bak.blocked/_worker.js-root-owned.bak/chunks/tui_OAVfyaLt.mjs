globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"
import { $ as $$Tabs, a as $$TabItem } from "./Code_sjN3308E.mjs"

const frontmatter = {
  title: "TUI",
  description: "SlopCode 터미널 사용자 인터페이스 사용.",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "파일-참조",
      text: "파일 참조",
    },
    {
      depth: 2,
      slug: "bash-명령",
      text: "Bash 명령",
    },
    {
      depth: 2,
      slug: "명령",
      text: "명령",
    },
    {
      depth: 3,
      slug: "history",
      text: "history",
    },
    {
      depth: 3,
      slug: "connect",
      text: "/connect",
    },
    {
      depth: 3,
      slug: "compact",
      text: "/compact",
    },
    {
      depth: 3,
      slug: "editor",
      text: "/editor",
    },
    {
      depth: 3,
      slug: "exit",
      text: "/exit",
    },
    {
      depth: 3,
      slug: "export",
      text: "/export",
    },
    {
      depth: 3,
      slug: "help",
      text: "/help",
    },
    {
      depth: 6,
      slug: "init",
      text: "/init",
    },
    {
      depth: 2,
      slug: "models",
      text: "/models",
    },
    {
      depth: 2,
      slug: "new",
      text: "/new",
    },
    {
      depth: 5,
      slug: "redo",
      text: "/redo",
    },
    {
      depth: 2,
      slug: "sessions",
      text: "/sessions",
    },
    {
      depth: 2,
      slug: "공유",
      text: "공유",
    },
    {
      depth: 3,
      slug: "themes",
      text: "themes",
    },
    {
      depth: 3,
      slug: "thinking",
      text: "/thinking",
    },
    {
      depth: 5,
      slug: "undo",
      text: "/undo",
    },
    {
      depth: 4,
      slug: "unshare",
      text: "/unshare",
    },
    {
      depth: 2,
      slug: "history-mode",
      text: "History mode",
    },
    {
      depth: 2,
      slug: "편집기-설정",
      text: "편집기 설정",
    },
    {
      depth: 2,
      slug: "구성",
      text: "구성",
    },
    {
      depth: 3,
      slug: "옵션",
      text: "옵션",
    },
    {
      depth: 2,
      slug: "사용자-정의",
      text: "사용자 정의",
    },
    {
      depth: 4,
      slug: "사용자-이름-표시",
      text: "사용자 이름 표시",
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
          '<p>slopcode는 LLM과 함께 프로젝트를 위해 대화형 terminal 인터페이스 또는 TUI를 제공합니다.</p>\n<p>slopcode는 현재 디렉토리에 TUI를 시작합니다.</p>\n<div class="expressive-code"><link rel="stylesheet" href="/docs/_astro/ec.4c0k7.css"><script type="module" src="/docs/_astro/ec.0vx5m.js"></script><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode"><div></div></button></div></figure></div>\n<p>또는 특정 작업 디렉토리에 대해 시작할 수 있습니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">/path/to/project</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode /path/to/project"><div></div></button></div></figure></div>\n<p>TUI에 있다면 메시지가 표시됩니다.</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="text"><code><div class="ec-line"><div class="code"><span style="--0:#24292e;--1:#e1e4e8">Give me a quick summary of the codebase.</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="Give me a quick summary of the codebase."><div></div></button></div></figure></div>\n<hr>\n<h2 id="파일-참조"><a href="#파일-참조">파일 참조</a></h2>\n<p><code dir="auto">@</code>를 사용하여 메시지에 파일을 참조 할 수 있습니다. 이것은 현재 작업 디렉토리에서 fuzzy 파일 검색입니다.</p>\n<aside aria-label="Tip" class="starlight-aside starlight-aside--tip"><p class="starlight-aside__title" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="starlight-aside__icon"><path fill-rule="evenodd" clip-rule="evenodd" d="M1.43909 8.85483L1.44039 8.85354L4.96668 5.33815C5.30653 4.99386 5.7685 4.79662 6.2524 4.78972L6.26553 4.78963L12.9014 4.78962L13.8479 3.84308C16.9187 0.772319 20.0546 0.770617 21.4678 0.975145C21.8617 1.02914 22.2271 1.21053 22.5083 1.4917C22.7894 1.77284 22.9708 2.13821 23.0248 2.53199C23.2294 3.94517 23.2278 7.08119 20.1569 10.1521L19.2107 11.0983V17.7338L19.2106 17.7469C19.2037 18.2308 19.0067 18.6933 18.6624 19.0331L15.1456 22.5608C14.9095 22.7966 14.6137 22.964 14.29 23.0449C13.9663 23.1259 13.6267 23.1174 13.3074 23.0204C12.9881 22.9235 12.7011 22.7417 12.4771 22.4944C12.2533 22.2473 12.1006 21.9441 12.0355 21.6171L11.1783 17.3417L6.65869 12.822L4.34847 12.3589L2.38351 11.965C2.05664 11.8998 1.75272 11.747 1.50564 11.5232C1.25835 11.2992 1.07653 11.0122 0.979561 10.6929C0.882595 10.3736 0.874125 10.034 0.955057 9.7103C1.03599 9.38659 1.20328 9.09092 1.43909 8.85483ZM6.8186 10.8724L2.94619 10.096L6.32006 6.73268H10.9583L6.8186 10.8724ZM15.2219 5.21703C17.681 2.75787 20.0783 2.75376 21.1124 2.8876C21.2462 3.92172 21.2421 6.31895 18.783 8.77812L12.0728 15.4883L8.51172 11.9272L15.2219 5.21703ZM13.9042 21.0538L13.1279 17.1811L17.2676 13.0414V17.68L13.9042 21.0538Z"></path><path d="M9.31827 18.3446C9.45046 17.8529 9.17864 17.3369 8.68945 17.1724C8.56178 17.1294 8.43145 17.1145 8.30512 17.1243C8.10513 17.1398 7.91519 17.2172 7.76181 17.3434C7.62613 17.455 7.51905 17.6048 7.45893 17.7835C6.97634 19.2186 5.77062 19.9878 4.52406 20.4029C4.08525 20.549 3.6605 20.644 3.29471 20.7053C3.35607 20.3395 3.45098 19.9148 3.59711 19.476C4.01221 18.2294 4.78141 17.0237 6.21648 16.5411C6.39528 16.481 6.54504 16.3739 6.65665 16.2382C6.85126 16.0016 6.92988 15.678 6.84417 15.3647C6.83922 15.3466 6.83373 15.3286 6.82767 15.3106C6.74106 15.053 6.55701 14.8557 6.33037 14.7459C6.10949 14.6389 5.84816 14.615 5.59715 14.6994C5.47743 14.7397 5.36103 14.7831 5.24786 14.8294C3.22626 15.6569 2.2347 17.4173 1.75357 18.8621C1.49662 19.6337 1.36993 20.3554 1.30679 20.8818C1.27505 21.1464 1.25893 21.3654 1.25072 21.5213C1.24662 21.5993 1.24448 21.6618 1.24337 21.7066L1.243 21.7226L1.24235 21.7605L1.2422 21.7771L1.24217 21.7827L1.24217 21.7856C1.24217 22.3221 1.67703 22.7579 2.2137 22.7579L2.2155 22.7579L2.22337 22.7578L2.23956 22.7577C2.25293 22.7575 2.27096 22.7572 2.29338 22.7567C2.33821 22.7555 2.40073 22.7534 2.47876 22.7493C2.63466 22.7411 2.85361 22.725 3.11822 22.6932C3.64462 22.6301 4.36636 22.5034 5.13797 22.2464C6.58274 21.7653 8.3431 20.7738 9.17063 18.7522C9.21696 18.639 9.26037 18.5226 9.30064 18.4029C9.30716 18.3835 9.31304 18.364 9.31827 18.3446Z"></path></svg>Tip</p><div class="starlight-aside__content"><p><code dir="auto">@</code>를 사용하여 메시지의 참조 파일을 사용할 수 있습니다.</p></div></aside>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="text"><code><div class="ec-line"><div class="code"><span style="--0:#24292e;--1:#e1e4e8">How is auth handled in </span><mark><span style="--0:#24292e;--1:#e1e4e8">@packages/functions/src/api/index.ts</span></mark><span style="--0:#24292e;--1:#e1e4e8">?</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="How is auth handled in @packages/functions/src/api/index.ts?"><div></div></button></div></figure></div>\n<p>파일의 내용이 자동으로 대화에 추가됩니다.</p>\n<hr>\n<h2 id="bash-명령"><a href="#bash-명령">Bash 명령</a></h2>\n<p><code dir="auto">!</code>를 사용하여 shell 명령을 실행합니다.</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">!</span><span style="--0:#6F42C1;--1:#B392F0">ls</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-la</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="!ls -la"><div></div></button></div></figure></div>\n<p>명령의 출력은 도구 결과로 대화에 추가됩니다.</p>\n<hr>\n<h2 id="명령"><a href="#명령">명령</a></h2>\n<p>slopcode TUI를 사용할 때, <code dir="auto">/</code>를 입력하여 명령 이름을 따라 작업을 신속하게 실행할 수 있습니다. 예를 들면:</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">/help</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="/help"><div></div></button></div></figure></div>\n<p>대부분의 명령은 <code dir="auto">ctrl+x</code>를 <code dir="auto">ctrl+x</code>가 기본 리더 키입니다. <a href="/docs/keybinds">더 알아보기</a>.</p>\n<p>여기에 모든 가능한 슬래시 명령이 있습니다.</p>\n<hr>\n<h3 id="history"><a href="#history">history</a></h3>\n<p>Toggle history mode for session navigation.</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">/history</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="/history"><div></div></button></div></figure></div>\n<p>** Keybind:** <code dir="auto">history_mode_toggle</code> defaults to <code dir="auto">ctrl+h,ctrl+j</code></p>\n<hr>\n<h3 id="connect"><a href="#connect">/connect</a></h3>\n<p>slopcode에 대한 공급자를 추가합니다. 사용 가능한 공급자에서 선택하고 API 키를 추가 할 수 있습니다.</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">/connect</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="/connect"><div></div></button></div></figure></div>\n<hr>\n<h3 id="compact"><a href="#compact">/compact</a></h3>\n<p>현재 세션을 압축합니다. 앨리스 : <code dir="auto">/summarize</code></p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">/compact</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="/compact"><div></div></button></div></figure></div>\n<p>** Keybind:** <code dir="auto">ctrl+x c</code></p>\n<hr>\n<h3 id="editor"><a href="#editor">/editor</a></h3>\n<p>메시지를 작성하기 위한 외부 편집기를 엽니다. <code dir="auto">EDITOR</code> 환경에서 설정된 편집기를 사용합니다. <a href="#editor-setup">더 알아보기</a>.</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">/editor</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="/editor"><div></div></button></div></figure></div>\n<p>** Keybind:** <code dir="auto">ctrl+x e</code></p>\n<hr>\n<h3 id="exit"><a href="#exit">/exit</a></h3>\n<p>slopcode를 종료합니다. Aliases : <code dir="auto">/quit</code>, <code dir="auto">/q</code></p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">/exit</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="/exit"><div></div></button></div></figure></div>\n<p>** Keybind:** <code dir="auto">ctrl+x q</code></p>\n<hr>\n<h3 id="export"><a href="#export">/export</a></h3>\n<p>Markdown에 대한 현재 대화를 내보내고 기본 편집기에서 열립니다. <code dir="auto">EDITOR</code> 환경에서 설정된 편집기를 사용합니다. <a href="#editor-setup">더 알아보기</a>.</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">/export</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="/export"><div></div></button></div></figure></div>\n<p>** Keybind:** <code dir="auto">ctrl+x x</code></p>\n<hr>\n<h3 id="help"><a href="#help">/help</a></h3>\n<p>도움말 대화 상자를 표시합니다.</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">/help</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="/help"><div></div></button></div></figure></div>\n<p>** Keybind:** <code dir="auto">ctrl+x h</code></p>\n<hr>\n<h6 id="init"><a href="#init">/init</a></h6>\n<p><code dir="auto">AGENTS.md</code> 파일을 만들거나 업데이트하십시오. <a href="/docs/rules">더 알아보기</a>.</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">/init</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="/init"><div></div></button></div></figure></div>\n<p>** Keybind:** <code dir="auto">ctrl+x i</code></p>\n<hr>\n<h2 id="models"><a href="#models">/models</a></h2>\n<p>사용 가능한 모델 목록.</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">/models</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="/models"><div></div></button></div></figure></div>\n<p>** Keybind:** <code dir="auto">ctrl+x m</code></p>\n<hr>\n<h2 id="new"><a href="#new">/new</a></h2>\n<p>새로운 세션을 시작합니다. 앨리스 : <code dir="auto">/clear</code></p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">/new</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="/new"><div></div></button></div></figure></div>\n<p>** Keybind:** <code dir="auto">ctrl+x n</code></p>\n<hr>\n<h5 id="redo"><a href="#redo">/redo</a></h5>\n<p>이전 undone 메시지 Redo. <code dir="auto">/undo</code>를 사용하는 후에만 유효한.</p>\n<aside aria-label="Tip" class="starlight-aside starlight-aside--tip"><p class="starlight-aside__title" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="starlight-aside__icon"><path fill-rule="evenodd" clip-rule="evenodd" d="M1.43909 8.85483L1.44039 8.85354L4.96668 5.33815C5.30653 4.99386 5.7685 4.79662 6.2524 4.78972L6.26553 4.78963L12.9014 4.78962L13.8479 3.84308C16.9187 0.772319 20.0546 0.770617 21.4678 0.975145C21.8617 1.02914 22.2271 1.21053 22.5083 1.4917C22.7894 1.77284 22.9708 2.13821 23.0248 2.53199C23.2294 3.94517 23.2278 7.08119 20.1569 10.1521L19.2107 11.0983V17.7338L19.2106 17.7469C19.2037 18.2308 19.0067 18.6933 18.6624 19.0331L15.1456 22.5608C14.9095 22.7966 14.6137 22.964 14.29 23.0449C13.9663 23.1259 13.6267 23.1174 13.3074 23.0204C12.9881 22.9235 12.7011 22.7417 12.4771 22.4944C12.2533 22.2473 12.1006 21.9441 12.0355 21.6171L11.1783 17.3417L6.65869 12.822L4.34847 12.3589L2.38351 11.965C2.05664 11.8998 1.75272 11.747 1.50564 11.5232C1.25835 11.2992 1.07653 11.0122 0.979561 10.6929C0.882595 10.3736 0.874125 10.034 0.955057 9.7103C1.03599 9.38659 1.20328 9.09092 1.43909 8.85483ZM6.8186 10.8724L2.94619 10.096L6.32006 6.73268H10.9583L6.8186 10.8724ZM15.2219 5.21703C17.681 2.75787 20.0783 2.75376 21.1124 2.8876C21.2462 3.92172 21.2421 6.31895 18.783 8.77812L12.0728 15.4883L8.51172 11.9272L15.2219 5.21703ZM13.9042 21.0538L13.1279 17.1811L17.2676 13.0414V17.68L13.9042 21.0538Z"></path><path d="M9.31827 18.3446C9.45046 17.8529 9.17864 17.3369 8.68945 17.1724C8.56178 17.1294 8.43145 17.1145 8.30512 17.1243C8.10513 17.1398 7.91519 17.2172 7.76181 17.3434C7.62613 17.455 7.51905 17.6048 7.45893 17.7835C6.97634 19.2186 5.77062 19.9878 4.52406 20.4029C4.08525 20.549 3.6605 20.644 3.29471 20.7053C3.35607 20.3395 3.45098 19.9148 3.59711 19.476C4.01221 18.2294 4.78141 17.0237 6.21648 16.5411C6.39528 16.481 6.54504 16.3739 6.65665 16.2382C6.85126 16.0016 6.92988 15.678 6.84417 15.3647C6.83922 15.3466 6.83373 15.3286 6.82767 15.3106C6.74106 15.053 6.55701 14.8557 6.33037 14.7459C6.10949 14.6389 5.84816 14.615 5.59715 14.6994C5.47743 14.7397 5.36103 14.7831 5.24786 14.8294C3.22626 15.6569 2.2347 17.4173 1.75357 18.8621C1.49662 19.6337 1.36993 20.3554 1.30679 20.8818C1.27505 21.1464 1.25893 21.3654 1.25072 21.5213C1.24662 21.5993 1.24448 21.6618 1.24337 21.7066L1.243 21.7226L1.24235 21.7605L1.2422 21.7771L1.24217 21.7827L1.24217 21.7856C1.24217 22.3221 1.67703 22.7579 2.2137 22.7579L2.2155 22.7579L2.22337 22.7578L2.23956 22.7577C2.25293 22.7575 2.27096 22.7572 2.29338 22.7567C2.33821 22.7555 2.40073 22.7534 2.47876 22.7493C2.63466 22.7411 2.85361 22.725 3.11822 22.6932C3.64462 22.6301 4.36636 22.5034 5.13797 22.2464C6.58274 21.7653 8.3431 20.7738 9.17063 18.7522C9.21696 18.639 9.26037 18.5226 9.30064 18.4029C9.30716 18.3835 9.31304 18.364 9.31827 18.3446Z"></path></svg>Tip</p><div class="starlight-aside__content"><p>모든 파일 변경도 복원됩니다.</p></div></aside>\n<p>내부적으로 Git을 사용하여 파일 변경을 관리합니다. 그래서 프로젝트 **\nGit 저장소**입니다.</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">/redo</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="/redo"><div></div></button></div></figure></div>\n<p>** Keybind:** <code dir="auto">ctrl+x r</code></p>\n<hr>\n<h2 id="sessions"><a href="#sessions">/sessions</a></h2>\n<p>세션 간 목록 및 전환. Aliases : <code dir="auto">/resume</code>, <code dir="auto">/continue</code></p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">/sessions</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="/sessions"><div></div></button></div></figure></div>\n<p>** Keybind:** <code dir="auto">ctrl+x l</code></p>\n<hr>\n<h2 id="공유"><a href="#공유">공유</a></h2>\n<p>현재 세션 공유. <a href="/docs/share">더 알아보기</a>.</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">/share</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="/share"><div></div></button></div></figure></div>\n<p>** Keybind:** <code dir="auto">ctrl+x s</code></p>\n<hr>\n<h3 id="themes"><a href="#themes">themes</a></h3>\n<p>사용할 수 있는 테마 목록.</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">/themes</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="/themes"><div></div></button></div></figure></div>\n<p>** Keybind:** <code dir="auto">ctrl+x t</code></p>\n<hr>\n<h3 id="thinking"><a href="#thinking">/thinking</a></h3>\n<p>대화의 사고/거주 블록의 가시성을 토합니다. 사용할 때, 확장 된 생각을 지원하는 모델의 이유 프로세스를 볼 수 있습니다.</p>\n<aside aria-label="Note" class="starlight-aside starlight-aside--note"><p class="starlight-aside__title" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="starlight-aside__icon"><path d="M12 11C11.7348 11 11.4804 11.1054 11.2929 11.2929C11.1054 11.4804 11 11.7348 11 12V16C11 16.2652 11.1054 16.5196 11.2929 16.7071C11.4804 16.8946 11.7348 17 12 17C12.2652 17 12.5196 16.8946 12.7071 16.7071C12.8946 16.5196 13 16.2652 13 16V12C13 11.7348 12.8946 11.4804 12.7071 11.2929C12.5196 11.1054 12.2652 11 12 11ZM12.38 7.08C12.1365 6.97998 11.8635 6.97998 11.62 7.08C11.4973 7.12759 11.3851 7.19896 11.29 7.29C11.2017 7.3872 11.1306 7.49882 11.08 7.62C11.024 7.73868 10.9966 7.86882 11 8C10.9992 8.13161 11.0245 8.26207 11.0742 8.38391C11.124 8.50574 11.1973 8.61656 11.29 8.71C11.3872 8.79833 11.4988 8.86936 11.62 8.92C11.7715 8.98224 11.936 9.00632 12.099 8.99011C12.2619 8.97391 12.4184 8.91792 12.5547 8.82707C12.691 8.73622 12.8029 8.61328 12.8805 8.46907C12.9582 8.32486 12.9992 8.16378 13 8C12.9963 7.73523 12.8927 7.48163 12.71 7.29C12.6149 7.19896 12.5028 7.12759 12.38 7.08ZM12 2C10.0222 2 8.08879 2.58649 6.4443 3.6853C4.79981 4.78412 3.51809 6.3459 2.76121 8.17317C2.00433 10.0004 1.8063 12.0111 2.19215 13.9509C2.578 15.8907 3.53041 17.6725 4.92894 19.0711C6.32746 20.4696 8.10929 21.422 10.0491 21.8079C11.9889 22.1937 13.9996 21.9957 15.8268 21.2388C17.6541 20.4819 19.2159 19.2002 20.3147 17.5557C21.4135 15.9112 22 13.9778 22 12C22 10.6868 21.7413 9.38642 21.2388 8.17317C20.7363 6.95991 19.9997 5.85752 19.0711 4.92893C18.1425 4.00035 17.0401 3.26375 15.8268 2.7612C14.6136 2.25866 13.3132 2 12 2ZM12 20C10.4178 20 8.87104 19.5308 7.55544 18.6518C6.23985 17.7727 5.21447 16.5233 4.60897 15.0615C4.00347 13.5997 3.84504 11.9911 4.15372 10.4393C4.4624 8.88743 5.22433 7.46197 6.34315 6.34315C7.46197 5.22433 8.88743 4.4624 10.4393 4.15372C11.9911 3.84504 13.5997 4.00346 15.0615 4.60896C16.5233 5.21447 17.7727 6.23984 18.6518 7.55544C19.5308 8.87103 20 10.4177 20 12C20 14.1217 19.1572 16.1566 17.6569 17.6569C16.1566 19.1571 14.1217 20 12 20Z"></path></svg>Note</p><div class="starlight-aside__content"><p>이 명령은 생각 블록이 ** 표시되었는지 여부 만 제어 ** - 모델의 소싱 기능을 활성화하거나 비활성화하지 않습니다. toggle 실제적인 reasoning 기능에, 모형 변종을 통해서 주기 위하여 <code dir="auto">ctrl+t</code>를 이용합니다.</p></div></aside>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">/thinking</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="/thinking"><div></div></button></div></figure></div>\n<hr>\n<h5 id="undo"><a href="#undo">/undo</a></h5>\n<p>대화에서 마지막 메시지. 가장 최근의 사용자 메시지, 모든 후속 응답 및 모든 파일 변경 제거.</p>\n<aside aria-label="Tip" class="starlight-aside starlight-aside--tip"><p class="starlight-aside__title" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="starlight-aside__icon"><path fill-rule="evenodd" clip-rule="evenodd" d="M1.43909 8.85483L1.44039 8.85354L4.96668 5.33815C5.30653 4.99386 5.7685 4.79662 6.2524 4.78972L6.26553 4.78963L12.9014 4.78962L13.8479 3.84308C16.9187 0.772319 20.0546 0.770617 21.4678 0.975145C21.8617 1.02914 22.2271 1.21053 22.5083 1.4917C22.7894 1.77284 22.9708 2.13821 23.0248 2.53199C23.2294 3.94517 23.2278 7.08119 20.1569 10.1521L19.2107 11.0983V17.7338L19.2106 17.7469C19.2037 18.2308 19.0067 18.6933 18.6624 19.0331L15.1456 22.5608C14.9095 22.7966 14.6137 22.964 14.29 23.0449C13.9663 23.1259 13.6267 23.1174 13.3074 23.0204C12.9881 22.9235 12.7011 22.7417 12.4771 22.4944C12.2533 22.2473 12.1006 21.9441 12.0355 21.6171L11.1783 17.3417L6.65869 12.822L4.34847 12.3589L2.38351 11.965C2.05664 11.8998 1.75272 11.747 1.50564 11.5232C1.25835 11.2992 1.07653 11.0122 0.979561 10.6929C0.882595 10.3736 0.874125 10.034 0.955057 9.7103C1.03599 9.38659 1.20328 9.09092 1.43909 8.85483ZM6.8186 10.8724L2.94619 10.096L6.32006 6.73268H10.9583L6.8186 10.8724ZM15.2219 5.21703C17.681 2.75787 20.0783 2.75376 21.1124 2.8876C21.2462 3.92172 21.2421 6.31895 18.783 8.77812L12.0728 15.4883L8.51172 11.9272L15.2219 5.21703ZM13.9042 21.0538L13.1279 17.1811L17.2676 13.0414V17.68L13.9042 21.0538Z"></path><path d="M9.31827 18.3446C9.45046 17.8529 9.17864 17.3369 8.68945 17.1724C8.56178 17.1294 8.43145 17.1145 8.30512 17.1243C8.10513 17.1398 7.91519 17.2172 7.76181 17.3434C7.62613 17.455 7.51905 17.6048 7.45893 17.7835C6.97634 19.2186 5.77062 19.9878 4.52406 20.4029C4.08525 20.549 3.6605 20.644 3.29471 20.7053C3.35607 20.3395 3.45098 19.9148 3.59711 19.476C4.01221 18.2294 4.78141 17.0237 6.21648 16.5411C6.39528 16.481 6.54504 16.3739 6.65665 16.2382C6.85126 16.0016 6.92988 15.678 6.84417 15.3647C6.83922 15.3466 6.83373 15.3286 6.82767 15.3106C6.74106 15.053 6.55701 14.8557 6.33037 14.7459C6.10949 14.6389 5.84816 14.615 5.59715 14.6994C5.47743 14.7397 5.36103 14.7831 5.24786 14.8294C3.22626 15.6569 2.2347 17.4173 1.75357 18.8621C1.49662 19.6337 1.36993 20.3554 1.30679 20.8818C1.27505 21.1464 1.25893 21.3654 1.25072 21.5213C1.24662 21.5993 1.24448 21.6618 1.24337 21.7066L1.243 21.7226L1.24235 21.7605L1.2422 21.7771L1.24217 21.7827L1.24217 21.7856C1.24217 22.3221 1.67703 22.7579 2.2137 22.7579L2.2155 22.7579L2.22337 22.7578L2.23956 22.7577C2.25293 22.7575 2.27096 22.7572 2.29338 22.7567C2.33821 22.7555 2.40073 22.7534 2.47876 22.7493C2.63466 22.7411 2.85361 22.725 3.11822 22.6932C3.64462 22.6301 4.36636 22.5034 5.13797 22.2464C6.58274 21.7653 8.3431 20.7738 9.17063 18.7522C9.21696 18.639 9.26037 18.5226 9.30064 18.4029C9.30716 18.3835 9.31304 18.364 9.31827 18.3446Z"></path></svg>Tip</p><div class="starlight-aside__content"><p>어떤 파일 변경도 복제됩니다.</p></div></aside>\n<p>내부적으로 Git을 사용하여 파일 변경을 관리합니다. 그래서 프로젝트 **\nGit 저장소**입니다.</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">/undo</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="/undo"><div></div></button></div></figure></div>\n<p>** Keybind:** <code dir="auto">ctrl+x u</code></p>\n<hr>\n<h4 id="unshare"><a href="#unshare">/unshare</a></h4>\n<p>Unshare 현재 세션. <a href="/docs/share#un-sharing">더 알아보기</a>.</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">/unshare</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="/unshare"><div></div></button></div></figure></div>\n<hr>\n<h2 id="history-mode"><a href="#history-mode">History mode</a></h2>\n<p>Use history mode when you want to navigate existing session messages and traces without moving your hands to the mouse.</p>\n<p>While history mode is active, <code dir="auto">up</code> and <code dir="auto">down</code> move between prompts, <code dir="auto">left</code> and <code dir="auto">right</code> move between traces, and <code dir="auto">space</code> runs the context action.</p>\n<p>Pressing <code dir="auto">space</code> expands or collapses tool output, and opens a child task session when the selected item supports it.</p>\n<p>Use <code dir="auto">history_mode_toggle</code> (defaults to <code dir="auto">ctrl+h,ctrl+j</code>) to exit history mode and return to normal edit mode.</p>\n<p>Unlike normal prompt input history (<code dir="auto">history_previous</code> and <code dir="auto">history_next</code>), history mode navigates rendered session content instead of cycling through text in the input box.</p>\n<hr>\n<h2 id="편집기-설정"><a href="#편집기-설정">편집기 설정</a></h2>\n<p><code dir="auto">/editor</code>와 <code dir="auto">/export</code> 명령 모두는 <code dir="auto">EDITOR</code> 환경변수에서 지정된 편집기를 사용합니다.</p>\n',
      }),
      createVNode($$Tabs, {
        children: [
          createVNode($$TabItem, {
            label: "Linux/macOS",
            "set:html":
              '<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># Example for nano or vim</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">export</span><span style="--0:#24292E;--1:#E1E4E8"> EDITOR</span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8">nano</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">export</span><span style="--0:#24292E;--1:#E1E4E8"> EDITOR</span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8">vim</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># For GUI editors, VS Code, Cursor, VSCodium, Windsurf, Zed, etc.</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># include --wait</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">export</span><span style="--0:#24292E;--1:#E1E4E8"> EDITOR</span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#032F62;--1:#9ECBFF">"code --wait"</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="export EDITOR=nanoexport EDITOR=vimexport EDITOR=&#x22;code --wait&#x22;"><div></div></button></div></figure></div><p>영원한 만들기 위하여, 당신의 shell 프로파일에 이것을 추가하십시오;\n<code dir="auto">~/.bashrc</code>, <code dir="auto">~/.zshrc</code>, 등.</p>',
          }),
          createVNode($$TabItem, {
            label: "Windows (CMD)",
            "set:html":
              '<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#005CC5;--1:#79B8FF">set</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">EDITOR=notepad</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># For GUI editors, VS Code, Cursor, VSCodium, Windsurf, Zed, etc.</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># include --wait</span></div></div><div class="ec-line"><div class="code"><span style="--0:#005CC5;--1:#79B8FF">set</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">EDITOR=code</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--wait</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="set EDITOR=notepadset EDITOR=code --wait"><div></div></button></div></figure></div><p>영구적으로, use <strong>System Properties</strong> > ** 환경\n변수**.</p>',
          }),
          createVNode($$TabItem, {
            label: "Windows (PowerShell)",
            "set:html":
              '<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="powershell"><code><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">$</span><span style="--0:#005CC5;--1:#79B8FF">env:</span><span style="--0:#24292E;--1:#E1E4E8">EDITOR </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">"notepad"</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># For GUI editors, VS Code, Cursor, VSCodium, Windsurf, Zed, etc.</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># include --wait</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">$</span><span style="--0:#005CC5;--1:#79B8FF">env:</span><span style="--0:#24292E;--1:#E1E4E8">EDITOR </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">"code --wait"</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="$env:EDITOR = &#x22;notepad&#x22;$env:EDITOR = &#x22;code --wait&#x22;"><div></div></button></div></figure></div><p>영구적으로 만들려면 PowerShell 프로파일에 추가하십시오.</p>',
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<p>인기있는 편집기 옵션은 다음과 같습니다 :</p>\n<ul>\n<li><code dir="auto">code</code> - Visual Studio 코드</li>\n<li><code dir="auto">cursor</code> - 커서</li>\n<li><code dir="auto">windsurf</code> - 윈드 서핑</li>\n<li><code dir="auto">nvim</code> - Neovim 편집기</li>\n<li><code dir="auto">vim</code> - Vim 편집기</li>\n<li><code dir="auto">nano</code> - 나노 편집기</li>\n<li><code dir="auto">notepad</code> - 윈도우 노트패드</li>\n<li><code dir="auto">subl</code> - 승화 텍스트</li>\n</ul>\n<aside aria-label="Note" class="starlight-aside starlight-aside--note"><p class="starlight-aside__title" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="starlight-aside__icon"><path d="M12 11C11.7348 11 11.4804 11.1054 11.2929 11.2929C11.1054 11.4804 11 11.7348 11 12V16C11 16.2652 11.1054 16.5196 11.2929 16.7071C11.4804 16.8946 11.7348 17 12 17C12.2652 17 12.5196 16.8946 12.7071 16.7071C12.8946 16.5196 13 16.2652 13 16V12C13 11.7348 12.8946 11.4804 12.7071 11.2929C12.5196 11.1054 12.2652 11 12 11ZM12.38 7.08C12.1365 6.97998 11.8635 6.97998 11.62 7.08C11.4973 7.12759 11.3851 7.19896 11.29 7.29C11.2017 7.3872 11.1306 7.49882 11.08 7.62C11.024 7.73868 10.9966 7.86882 11 8C10.9992 8.13161 11.0245 8.26207 11.0742 8.38391C11.124 8.50574 11.1973 8.61656 11.29 8.71C11.3872 8.79833 11.4988 8.86936 11.62 8.92C11.7715 8.98224 11.936 9.00632 12.099 8.99011C12.2619 8.97391 12.4184 8.91792 12.5547 8.82707C12.691 8.73622 12.8029 8.61328 12.8805 8.46907C12.9582 8.32486 12.9992 8.16378 13 8C12.9963 7.73523 12.8927 7.48163 12.71 7.29C12.6149 7.19896 12.5028 7.12759 12.38 7.08ZM12 2C10.0222 2 8.08879 2.58649 6.4443 3.6853C4.79981 4.78412 3.51809 6.3459 2.76121 8.17317C2.00433 10.0004 1.8063 12.0111 2.19215 13.9509C2.578 15.8907 3.53041 17.6725 4.92894 19.0711C6.32746 20.4696 8.10929 21.422 10.0491 21.8079C11.9889 22.1937 13.9996 21.9957 15.8268 21.2388C17.6541 20.4819 19.2159 19.2002 20.3147 17.5557C21.4135 15.9112 22 13.9778 22 12C22 10.6868 21.7413 9.38642 21.2388 8.17317C20.7363 6.95991 19.9997 5.85752 19.0711 4.92893C18.1425 4.00035 17.0401 3.26375 15.8268 2.7612C14.6136 2.25866 13.3132 2 12 2ZM12 20C10.4178 20 8.87104 19.5308 7.55544 18.6518C6.23985 17.7727 5.21447 16.5233 4.60897 15.0615C4.00347 13.5997 3.84504 11.9911 4.15372 10.4393C4.4624 8.88743 5.22433 7.46197 6.34315 6.34315C7.46197 5.22433 8.88743 4.4624 10.4393 4.15372C11.9911 3.84504 13.5997 4.00346 15.0615 4.60896C16.5233 5.21447 17.7727 6.23984 18.6518 7.55544C19.5308 8.87103 20 10.4177 20 12C20 14.1217 19.1572 16.1566 17.6569 17.6569C16.1566 19.1571 14.1217 20 12 20Z"></path></svg>Note</p><div class="starlight-aside__content"><p>VS Code와 같은 일부 편집기는 <code dir="auto">--wait</code> 플래그와 함께 시작해야합니다.</p></div></aside>\n<p>일부 편집기는 명령줄 인수가 차단 모드에서 실행되어야 합니다. <code dir="auto">--wait</code> 플래그는 닫힐 때까지 편집기 프로세스 블록을 만듭니다.</p>\n<hr>\n<h2 id="구성"><a href="#구성">구성</a></h2>\n<p>slopcode config 파일을 통해 TUI 동작을 사용자 정의할 수 있습니다.</p>\n<div class="expressive-code"><figure class="frame has-title not-content"><figcaption class="header"><span class="title">slopcode.json</span></figcaption><pre data-language="json"><code><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">{</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"$schema"</span><span style="--0:#24292E;--1:#E1E4E8">: </span><span style="--0:#032F62;--1:#9ECBFF">"https://slopcode.dev/config.json"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"tui"</span><span style="--0:#24292E;--1:#E1E4E8">: {</span></div></div><div class="ec-line"><div class="code"><span class="indent">    </span><span style="--0:#005CC5;--1:#79B8FF">"scroll_speed"</span><span style="--0:#24292E;--1:#E1E4E8">: </span><span style="--0:#005CC5;--1:#79B8FF">3</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent">    </span><span style="--0:#005CC5;--1:#79B8FF">"scroll_acceleration"</span><span style="--0:#24292E;--1:#E1E4E8">: {</span></div></div><div class="ec-line"><div class="code"><span class="indent">      </span><span style="--0:#005CC5;--1:#79B8FF">"enabled"</span><span style="--0:#24292E;--1:#E1E4E8">: </span><span style="--0:#005CC5;--1:#79B8FF">true</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">}</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">}</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">}</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="{  &#x22;$schema&#x22;: &#x22;https://slopcode.dev/config.json&#x22;,  &#x22;tui&#x22;: {    &#x22;scroll_speed&#x22;: 3,    &#x22;scroll_acceleration&#x22;: {      &#x22;enabled&#x22;: true    }  }}"><div></div></button></div></figure></div>\n<h3 id="옵션"><a href="#옵션">옵션</a></h3>\n<ul>\n<li><code dir="auto">scroll_acceleration</code> - 부드러운 자연 스크롤을위한 macOS 스타일 스크롤 가속 가능. 사용할 때, 스크롤 속도는 빠른 스크롤 제스처로 증가하고 느린 움직임을 위해 정확한 유지. **이 설정은 <code dir="auto">scroll_speed</code>를 통해 우선 순위를 부여하고 활성화 할 때. **</li>\n<li><code dir="auto">scroll_speed</code> - 스크롤 명령 (최소 : <code dir="auto">1</code>)을 사용하여 TUI 스크롤을 빠르게 제어합니다. 기본 <code dir="auto">3</code>. ** 참고: <code dir="auto">scroll_acceleration.enabled</code>가 <code dir="auto">true</code>로 설정되면 무시됩니다.**</li>\n</ul>\n<hr>\n<h2 id="사용자-정의"><a href="#사용자-정의">사용자 정의</a></h2>\n<p>명령 팔레트 (<code dir="auto">ctrl+x h</code> 또는 <code dir="auto">/help</code>)를 사용하여 TUI보기의 다양한 측면을 사용자 정의 할 수 있습니다. 재시작에 따른 설정 persist.</p>\n<hr>\n<h4 id="사용자-이름-표시"><a href="#사용자-이름-표시">사용자 이름 표시</a></h4>\n<p>사용자 이름이 채팅 메시지에 나타나는지 여부를 수정합니다. 이것을 통해 접근:</p>\n<ul>\n<li>명령 팔레트 : “username” 또는 “hide 사용자” 검색</li>\n<li>자동 설정은 TUI 세션을 통해 기억됩니다.</li>\n</ul>',
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

const url = "src/content/docs/ko/tui.mdx"
const file = "/app/packages/web/src/content/docs/ko/tui.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/app/packages/web/src/content/docs/ko/tui.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
