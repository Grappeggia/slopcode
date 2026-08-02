globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"
import { c as config } from "./config_UI6PtV27.mjs"

const frontmatter = {
  title: "Zen",
  description: "Kurirana lista modela koje nudi SlopCode.",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "pozadina",
      text: "Pozadina",
    },
    {
      depth: 2,
      slug: "kako-radi",
      text: "Kako radi",
    },
    {
      depth: 2,
      slug: "endpoints",
      text: "Endpoints",
    },
    {
      depth: 3,
      slug: "modeli",
      text: "Modeli",
    },
    {
      depth: 2,
      slug: "cijene",
      text: "Cijene",
    },
    {
      depth: 3,
      slug: "automatska-dopuna",
      text: "Automatska dopuna",
    },
    {
      depth: 3,
      slug: "mjesečni-limiti",
      text: "Mjesečni limiti",
    },
    {
      depth: 2,
      slug: "privatnost",
      text: "Privatnost",
    },
    {
      depth: 2,
      slug: "za-timove",
      text: "Za timove",
    },
    {
      depth: 3,
      slug: "uloge",
      text: "Uloge",
    },
    {
      depth: 3,
      slug: "pristup-modelima",
      text: "Pristup modelima",
    },
    {
      depth: 3,
      slug: "donesite-vlastiti-ključ",
      text: "Donesite vlastiti ključ",
    },
    {
      depth: 2,
      slug: "ciljevi",
      text: "Ciljevi",
    },
  ]
}
const console = config.console
const email = `mailto:${config.email}`
function _createMdxContent(props) {
  const _components = {
      li: "li",
      ol: "ol",
      p: "p",
      strong: "strong",
      ...props.components,
    },
    { Fragment: Fragment$1 } = _components
  if (!Fragment$1) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    children: [
      createVNode(Fragment$1, {
        "set:html":
          '<p>SlopCode Zen je lista testiranih i provjerenih modela koje obezbjeduje SlopCode tim.</p>\n<aside aria-label="Note" class="starlight-aside starlight-aside--note"><p class="starlight-aside__title" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="starlight-aside__icon"><path d="M12 11C11.7348 11 11.4804 11.1054 11.2929 11.2929C11.1054 11.4804 11 11.7348 11 12V16C11 16.2652 11.1054 16.5196 11.2929 16.7071C11.4804 16.8946 11.7348 17 12 17C12.2652 17 12.5196 16.8946 12.7071 16.7071C12.8946 16.5196 13 16.2652 13 16V12C13 11.7348 12.8946 11.4804 12.7071 11.2929C12.5196 11.1054 12.2652 11 12 11ZM12.38 7.08C12.1365 6.97998 11.8635 6.97998 11.62 7.08C11.4973 7.12759 11.3851 7.19896 11.29 7.29C11.2017 7.3872 11.1306 7.49882 11.08 7.62C11.024 7.73868 10.9966 7.86882 11 8C10.9992 8.13161 11.0245 8.26207 11.0742 8.38391C11.124 8.50574 11.1973 8.61656 11.29 8.71C11.3872 8.79833 11.4988 8.86936 11.62 8.92C11.7715 8.98224 11.936 9.00632 12.099 8.99011C12.2619 8.97391 12.4184 8.91792 12.5547 8.82707C12.691 8.73622 12.8029 8.61328 12.8805 8.46907C12.9582 8.32486 12.9992 8.16378 13 8C12.9963 7.73523 12.8927 7.48163 12.71 7.29C12.6149 7.19896 12.5028 7.12759 12.38 7.08ZM12 2C10.0222 2 8.08879 2.58649 6.4443 3.6853C4.79981 4.78412 3.51809 6.3459 2.76121 8.17317C2.00433 10.0004 1.8063 12.0111 2.19215 13.9509C2.578 15.8907 3.53041 17.6725 4.92894 19.0711C6.32746 20.4696 8.10929 21.422 10.0491 21.8079C11.9889 22.1937 13.9996 21.9957 15.8268 21.2388C17.6541 20.4819 19.2159 19.2002 20.3147 17.5557C21.4135 15.9112 22 13.9778 22 12C22 10.6868 21.7413 9.38642 21.2388 8.17317C20.7363 6.95991 19.9997 5.85752 19.0711 4.92893C18.1425 4.00035 17.0401 3.26375 15.8268 2.7612C14.6136 2.25866 13.3132 2 12 2ZM12 20C10.4178 20 8.87104 19.5308 7.55544 18.6518C6.23985 17.7727 5.21447 16.5233 4.60897 15.0615C4.00347 13.5997 3.84504 11.9911 4.15372 10.4393C4.4624 8.88743 5.22433 7.46197 6.34315 6.34315C7.46197 5.22433 8.88743 4.4624 10.4393 4.15372C11.9911 3.84504 13.5997 4.00346 15.0615 4.60896C16.5233 5.21447 17.7727 6.23984 18.6518 7.55544C19.5308 8.87103 20 10.4177 20 12C20 14.1217 19.1572 16.1566 17.6569 17.6569C16.1566 19.1571 14.1217 20 12 20Z"></path></svg>Note</p><div class="starlight-aside__content"><p>SlopCode Zen je trenutno u beta fazi.</p></div></aside>\n<p>Zen radi kao i svaki drugi provajder u SlopCode. Prijavite se u SlopCode Zen i uzmete API kljuc. Ovo je <strong>potpuno opcionalno</strong> i ne morate ga koristiti da biste koristili SlopCode.</p>\n<hr>\n<h2 id="pozadina"><a href="#pozadina">Pozadina</a></h2>\n<p>Postoji veliki broj modela, ali samo mali dio radi dobro kao coding agent. Dodatno, vecina provajdera je drugacije konfigurisana, pa su performanse i kvalitet cesto neujednaceni.</p>\n<aside aria-label="Tip" class="starlight-aside starlight-aside--tip"><p class="starlight-aside__title" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="starlight-aside__icon"><path fill-rule="evenodd" clip-rule="evenodd" d="M1.43909 8.85483L1.44039 8.85354L4.96668 5.33815C5.30653 4.99386 5.7685 4.79662 6.2524 4.78972L6.26553 4.78963L12.9014 4.78962L13.8479 3.84308C16.9187 0.772319 20.0546 0.770617 21.4678 0.975145C21.8617 1.02914 22.2271 1.21053 22.5083 1.4917C22.7894 1.77284 22.9708 2.13821 23.0248 2.53199C23.2294 3.94517 23.2278 7.08119 20.1569 10.1521L19.2107 11.0983V17.7338L19.2106 17.7469C19.2037 18.2308 19.0067 18.6933 18.6624 19.0331L15.1456 22.5608C14.9095 22.7966 14.6137 22.964 14.29 23.0449C13.9663 23.1259 13.6267 23.1174 13.3074 23.0204C12.9881 22.9235 12.7011 22.7417 12.4771 22.4944C12.2533 22.2473 12.1006 21.9441 12.0355 21.6171L11.1783 17.3417L6.65869 12.822L4.34847 12.3589L2.38351 11.965C2.05664 11.8998 1.75272 11.747 1.50564 11.5232C1.25835 11.2992 1.07653 11.0122 0.979561 10.6929C0.882595 10.3736 0.874125 10.034 0.955057 9.7103C1.03599 9.38659 1.20328 9.09092 1.43909 8.85483ZM6.8186 10.8724L2.94619 10.096L6.32006 6.73268H10.9583L6.8186 10.8724ZM15.2219 5.21703C17.681 2.75787 20.0783 2.75376 21.1124 2.8876C21.2462 3.92172 21.2421 6.31895 18.783 8.77812L12.0728 15.4883L8.51172 11.9272L15.2219 5.21703ZM13.9042 21.0538L13.1279 17.1811L17.2676 13.0414V17.68L13.9042 21.0538Z"></path><path d="M9.31827 18.3446C9.45046 17.8529 9.17864 17.3369 8.68945 17.1724C8.56178 17.1294 8.43145 17.1145 8.30512 17.1243C8.10513 17.1398 7.91519 17.2172 7.76181 17.3434C7.62613 17.455 7.51905 17.6048 7.45893 17.7835C6.97634 19.2186 5.77062 19.9878 4.52406 20.4029C4.08525 20.549 3.6605 20.644 3.29471 20.7053C3.35607 20.3395 3.45098 19.9148 3.59711 19.476C4.01221 18.2294 4.78141 17.0237 6.21648 16.5411C6.39528 16.481 6.54504 16.3739 6.65665 16.2382C6.85126 16.0016 6.92988 15.678 6.84417 15.3647C6.83922 15.3466 6.83373 15.3286 6.82767 15.3106C6.74106 15.053 6.55701 14.8557 6.33037 14.7459C6.10949 14.6389 5.84816 14.615 5.59715 14.6994C5.47743 14.7397 5.36103 14.7831 5.24786 14.8294C3.22626 15.6569 2.2347 17.4173 1.75357 18.8621C1.49662 19.6337 1.36993 20.3554 1.30679 20.8818C1.27505 21.1464 1.25893 21.3654 1.25072 21.5213C1.24662 21.5993 1.24448 21.6618 1.24337 21.7066L1.243 21.7226L1.24235 21.7605L1.2422 21.7771L1.24217 21.7827L1.24217 21.7856C1.24217 22.3221 1.67703 22.7579 2.2137 22.7579L2.2155 22.7579L2.22337 22.7578L2.23956 22.7577C2.25293 22.7575 2.27096 22.7572 2.29338 22.7567C2.33821 22.7555 2.40073 22.7534 2.47876 22.7493C2.63466 22.7411 2.85361 22.725 3.11822 22.6932C3.64462 22.6301 4.36636 22.5034 5.13797 22.2464C6.58274 21.7653 8.3431 20.7738 9.17063 18.7522C9.21696 18.639 9.26037 18.5226 9.30064 18.4029C9.30716 18.3835 9.31304 18.364 9.31827 18.3446Z"></path></svg>Tip</p><div class="starlight-aside__content"><p>Testirali smo odabranu grupu modela i provajdera koji dobro rade s SlopCode.</p></div></aside>\n<p>Ako model koristite preko servisa poput OpenRouter-a, cesto ne mozete biti sigurni da dobijate najbolju verziju zeljenog modela.</p>\n<p>Da to rijesimo, uradili smo nekoliko stvari:</p>\n<ol>\n<li>Testirali smo odabrane modele i razgovarali sa njihovim timovima kako ih najbolje pokretati.</li>\n<li>Zatim smo saradjivali s nekoliko provajdera da potvrdimo da se modeli isporucuju ispravno.</li>\n<li>Na kraju smo benchmarkirali kombinacije model/provajder i sastavili listu koju preporucujemo.</li>\n</ol>\n<p>SlopCode Zen je AI gateway koji vam daje pristup tim modelima.</p>\n<hr>\n<h2 id="kako-radi"><a href="#kako-radi">Kako radi</a></h2>\n<p>SlopCode Zen radi kao i svaki drugi provajder u SlopCode.</p>\n',
      }),
      createVNode(_components.ol, {
        children: [
          "\n",
          createVNode(_components.li, {
            children: [
              "Prijavite se na ",
              createVNode(_components.strong, {
                children: createVNode("a", {
                  href: console,
                  "set:html": "SlopCode Zen",
                }),
              }),
              ", dodajte billing podatke i kopirajte API kljuc.",
            ],
          }),
          "\n",
          createVNode(Fragment$1, {
            "set:html":
              '<li>U TUI-ju pokrenite <code dir="auto">/connect</code>, izaberite SlopCode Zen i zalijepite API kljuc.</li>\n<li>Pokrenite <code dir="auto">/models</code> u TUI-ju da vidite listu preporucenih modela.</li>\n',
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<p>Naplata je po zahtjevu i mozete dodavati kredit na racun.</p>\n<hr>\n<h2 id="endpoints"><a href="#endpoints">Endpoints</a></h2>\n<p>Nasim modelima mozete pristupiti i preko sljedecih API endpointa.</p>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Model</th><th>Model ID</th><th>Endpoint</th><th>AI SDK Package</th></tr></thead><tbody><tr><td>GPT 5.2</td><td>gpt-5.2</td><td><code dir="auto">https://slopcode.dev/zen/v1/responses</code></td><td><code dir="auto">@ai-sdk/openai</code></td></tr><tr><td>GPT 5.2 Codex</td><td>gpt-5.2-codex</td><td><code dir="auto">https://slopcode.dev/zen/v1/responses</code></td><td><code dir="auto">@ai-sdk/openai</code></td></tr><tr><td>GPT 5.1</td><td>gpt-5.1</td><td><code dir="auto">https://slopcode.dev/zen/v1/responses</code></td><td><code dir="auto">@ai-sdk/openai</code></td></tr><tr><td>GPT 5.1 Codex</td><td>gpt-5.1-codex</td><td><code dir="auto">https://slopcode.dev/zen/v1/responses</code></td><td><code dir="auto">@ai-sdk/openai</code></td></tr><tr><td>GPT 5.1 Codex Max</td><td>gpt-5.1-codex-max</td><td><code dir="auto">https://slopcode.dev/zen/v1/responses</code></td><td><code dir="auto">@ai-sdk/openai</code></td></tr><tr><td>GPT 5.1 Codex Mini</td><td>gpt-5.1-codex-mini</td><td><code dir="auto">https://slopcode.dev/zen/v1/responses</code></td><td><code dir="auto">@ai-sdk/openai</code></td></tr><tr><td>GPT 5</td><td>gpt-5</td><td><code dir="auto">https://slopcode.dev/zen/v1/responses</code></td><td><code dir="auto">@ai-sdk/openai</code></td></tr><tr><td>GPT 5 Codex</td><td>gpt-5-codex</td><td><code dir="auto">https://slopcode.dev/zen/v1/responses</code></td><td><code dir="auto">@ai-sdk/openai</code></td></tr><tr><td>GPT 5 Nano</td><td>gpt-5-nano</td><td><code dir="auto">https://slopcode.dev/zen/v1/responses</code></td><td><code dir="auto">@ai-sdk/openai</code></td></tr><tr><td>Claude Sonnet 4.5</td><td>claude-sonnet-4-5</td><td><code dir="auto">https://slopcode.dev/zen/v1/messages</code></td><td><code dir="auto">@ai-sdk/anthropic</code></td></tr><tr><td>Claude Sonnet 4</td><td>claude-sonnet-4</td><td><code dir="auto">https://slopcode.dev/zen/v1/messages</code></td><td><code dir="auto">@ai-sdk/anthropic</code></td></tr><tr><td>Claude Haiku 4.5</td><td>claude-haiku-4-5</td><td><code dir="auto">https://slopcode.dev/zen/v1/messages</code></td><td><code dir="auto">@ai-sdk/anthropic</code></td></tr><tr><td>Claude Haiku 3.5</td><td>claude-3-5-haiku</td><td><code dir="auto">https://slopcode.dev/zen/v1/messages</code></td><td><code dir="auto">@ai-sdk/anthropic</code></td></tr><tr><td>Claude Opus 4.6</td><td>claude-opus-4-6</td><td><code dir="auto">https://slopcode.dev/zen/v1/messages</code></td><td><code dir="auto">@ai-sdk/anthropic</code></td></tr><tr><td>Claude Opus 4.5</td><td>claude-opus-4-5</td><td><code dir="auto">https://slopcode.dev/zen/v1/messages</code></td><td><code dir="auto">@ai-sdk/anthropic</code></td></tr><tr><td>Claude Opus 4.1</td><td>claude-opus-4-1</td><td><code dir="auto">https://slopcode.dev/zen/v1/messages</code></td><td><code dir="auto">@ai-sdk/anthropic</code></td></tr><tr><td>Gemini 3 Pro</td><td>gemini-3-pro</td><td><code dir="auto">https://slopcode.dev/zen/v1/models/gemini-3-pro</code></td><td><code dir="auto">@ai-sdk/google</code></td></tr><tr><td>Gemini 3 Flash</td><td>gemini-3-flash</td><td><code dir="auto">https://slopcode.dev/zen/v1/models/gemini-3-flash</code></td><td><code dir="auto">@ai-sdk/google</code></td></tr><tr><td>MiniMax M2.1</td><td>minimax-m2.1</td><td><code dir="auto">https://slopcode.dev/zen/v1/chat/completions</code></td><td><code dir="auto">@ai-sdk/openai-compatible</code></td></tr><tr><td>MiniMax M2.1 Free</td><td>minimax-m2.1-free</td><td><code dir="auto">https://slopcode.dev/zen/v1/messages</code></td><td><code dir="auto">@ai-sdk/anthropic</code></td></tr><tr><td>GLM 4.7</td><td>glm-4.7</td><td><code dir="auto">https://slopcode.dev/zen/v1/chat/completions</code></td><td><code dir="auto">@ai-sdk/openai-compatible</code></td></tr><tr><td>GLM 4.7 Free</td><td>glm-4.7-free</td><td><code dir="auto">https://slopcode.dev/zen/v1/chat/completions</code></td><td><code dir="auto">@ai-sdk/openai-compatible</code></td></tr><tr><td>GLM 4.6</td><td>glm-4.6</td><td><code dir="auto">https://slopcode.dev/zen/v1/chat/completions</code></td><td><code dir="auto">@ai-sdk/openai-compatible</code></td></tr><tr><td>Kimi K2.5</td><td>kimi-k2.5</td><td><code dir="auto">https://slopcode.dev/zen/v1/chat/completions</code></td><td><code dir="auto">@ai-sdk/openai-compatible</code></td></tr><tr><td>Kimi K2.5 Free</td><td>kimi-k2.5-free</td><td><code dir="auto">https://slopcode.dev/zen/v1/chat/completions</code></td><td><code dir="auto">@ai-sdk/openai-compatible</code></td></tr><tr><td>Kimi K2 Thinking</td><td>kimi-k2-thinking</td><td><code dir="auto">https://slopcode.dev/zen/v1/chat/completions</code></td><td><code dir="auto">@ai-sdk/openai-compatible</code></td></tr><tr><td>Kimi K2</td><td>kimi-k2</td><td><code dir="auto">https://slopcode.dev/zen/v1/chat/completions</code></td><td><code dir="auto">@ai-sdk/openai-compatible</code></td></tr><tr><td>Qwen3 Coder 480B</td><td>qwen3-coder</td><td><code dir="auto">https://slopcode.dev/zen/v1/chat/completions</code></td><td><code dir="auto">@ai-sdk/openai-compatible</code></td></tr><tr><td>Big Pickle</td><td>big-pickle</td><td><code dir="auto">https://slopcode.dev/zen/v1/chat/completions</code></td><td><code dir="auto">@ai-sdk/openai-compatible</code></td></tr></tbody></table>\n<p><a href="/docs/config/#models">model id</a> u SlopCode konfiguraciji koristi format <code dir="auto">slopcode/&#x3C;model-id></code>. Na primjer, za GPT 5.2 Codex u konfiguraciji koristite <code dir="auto">slopcode/gpt-5.2-codex</code>.</p>\n<hr>\n<h3 id="modeli"><a href="#modeli">Modeli</a></h3>\n<p>Pun spisak dostupnih modela i metapodataka mozete preuzeti na:</p>\n<div class="expressive-code"><link rel="stylesheet" href="/docs/_astro/ec.4c0k7.css"><script type="module" src="/docs/_astro/ec.0vx5m.js"></script><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="plaintext"><code><div class="ec-line"><div class="code"><span style="--0:#24292e;--1:#e1e4e8">https://slopcode.dev/zen/v1/models</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="https://slopcode.dev/zen/v1/models"><div></div></button></div></figure></div>\n<hr>\n<h2 id="cijene"><a href="#cijene">Cijene</a></h2>\n<p>Podrzavamo pay-as-you-go model. Ispod su cijene <strong>po 1M tokena</strong>.</p>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Model</th><th>Input</th><th>Output</th><th>Cached Read</th><th>Cached Write</th></tr></thead><tbody><tr><td>Big Pickle</td><td>Free</td><td>Free</td><td>Free</td><td>-</td></tr><tr><td>MiniMax M2.1 Free</td><td>Free</td><td>Free</td><td>Free</td><td>-</td></tr><tr><td>MiniMax M2.1</td><td>$0.30</td><td>$1.20</td><td>$0.10</td><td>-</td></tr><tr><td>GLM 4.7 Free</td><td>Free</td><td>Free</td><td>Free</td><td>-</td></tr><tr><td>GLM 4.7</td><td>$0.60</td><td>$2.20</td><td>$0.10</td><td>-</td></tr><tr><td>GLM 4.6</td><td>$0.60</td><td>$2.20</td><td>$0.10</td><td>-</td></tr><tr><td>Kimi K2.5 Free</td><td>Free</td><td>Free</td><td>Free</td><td>-</td></tr><tr><td>Kimi K2.5</td><td>$0.60</td><td>$3.00</td><td>$0.08</td><td>-</td></tr><tr><td>Kimi K2 Thinking</td><td>$0.40</td><td>$2.50</td><td>-</td><td>-</td></tr><tr><td>Kimi K2</td><td>$0.40</td><td>$2.50</td><td>-</td><td>-</td></tr><tr><td>Qwen3 Coder 480B</td><td>$0.45</td><td>$1.50</td><td>-</td><td>-</td></tr><tr><td>Claude Sonnet 4.5 (≤ 200K tokens)</td><td>$3.00</td><td>$15.00</td><td>$0.30</td><td>$3.75</td></tr><tr><td>Claude Sonnet 4.5 (> 200K tokens)</td><td>$6.00</td><td>$22.50</td><td>$0.60</td><td>$7.50</td></tr><tr><td>Claude Sonnet 4 (≤ 200K tokens)</td><td>$3.00</td><td>$15.00</td><td>$0.30</td><td>$3.75</td></tr><tr><td>Claude Sonnet 4 (> 200K tokens)</td><td>$6.00</td><td>$22.50</td><td>$0.60</td><td>$7.50</td></tr><tr><td>Claude Haiku 4.5</td><td>$1.00</td><td>$5.00</td><td>$0.10</td><td>$1.25</td></tr><tr><td>Claude Haiku 3.5</td><td>$0.80</td><td>$4.00</td><td>$0.08</td><td>$1.00</td></tr><tr><td>Claude Opus 4.6 (≤ 200K tokens)</td><td>$5.00</td><td>$25.00</td><td>$0.50</td><td>$6.25</td></tr><tr><td>Claude Opus 4.6 (> 200K tokens)</td><td>$10.00</td><td>$37.50</td><td>$1.00</td><td>$12.50</td></tr><tr><td>Claude Opus 4.5</td><td>$5.00</td><td>$25.00</td><td>$0.50</td><td>$6.25</td></tr><tr><td>Claude Opus 4.1</td><td>$15.00</td><td>$75.00</td><td>$1.50</td><td>$18.75</td></tr><tr><td>Gemini 3 Pro (≤ 200K tokens)</td><td>$2.00</td><td>$12.00</td><td>$0.20</td><td>-</td></tr><tr><td>Gemini 3 Pro (> 200K tokens)</td><td>$4.00</td><td>$18.00</td><td>$0.40</td><td>-</td></tr><tr><td>Gemini 3 Flash</td><td>$0.50</td><td>$3.00</td><td>$0.05</td><td>-</td></tr><tr><td>GPT 5.2</td><td>$1.75</td><td>$14.00</td><td>$0.175</td><td>-</td></tr><tr><td>GPT 5.2 Codex</td><td>$1.75</td><td>$14.00</td><td>$0.175</td><td>-</td></tr><tr><td>GPT 5.1</td><td>$1.07</td><td>$8.50</td><td>$0.107</td><td>-</td></tr><tr><td>GPT 5.1 Codex</td><td>$1.07</td><td>$8.50</td><td>$0.107</td><td>-</td></tr><tr><td>GPT 5.1 Codex Max</td><td>$1.25</td><td>$10.00</td><td>$0.125</td><td>-</td></tr><tr><td>GPT 5.1 Codex Mini</td><td>$0.25</td><td>$2.00</td><td>$0.025</td><td>-</td></tr><tr><td>GPT 5</td><td>$1.07</td><td>$8.50</td><td>$0.107</td><td>-</td></tr><tr><td>GPT 5 Codex</td><td>$1.07</td><td>$8.50</td><td>$0.107</td><td>-</td></tr><tr><td>GPT 5 Nano</td><td>Free</td><td>Free</td><td>Free</td><td>-</td></tr></tbody></table>\n<p>U historiji koristenja mozete primijetiti <em>Claude Haiku 3.5</em>. To je <a href="/docs/config/#models">low cost model</a> koji se koristi za generisanje naslova sesija.</p>\n<aside aria-label="Note" class="starlight-aside starlight-aside--note"><p class="starlight-aside__title" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="starlight-aside__icon"><path d="M12 11C11.7348 11 11.4804 11.1054 11.2929 11.2929C11.1054 11.4804 11 11.7348 11 12V16C11 16.2652 11.1054 16.5196 11.2929 16.7071C11.4804 16.8946 11.7348 17 12 17C12.2652 17 12.5196 16.8946 12.7071 16.7071C12.8946 16.5196 13 16.2652 13 16V12C13 11.7348 12.8946 11.4804 12.7071 11.2929C12.5196 11.1054 12.2652 11 12 11ZM12.38 7.08C12.1365 6.97998 11.8635 6.97998 11.62 7.08C11.4973 7.12759 11.3851 7.19896 11.29 7.29C11.2017 7.3872 11.1306 7.49882 11.08 7.62C11.024 7.73868 10.9966 7.86882 11 8C10.9992 8.13161 11.0245 8.26207 11.0742 8.38391C11.124 8.50574 11.1973 8.61656 11.29 8.71C11.3872 8.79833 11.4988 8.86936 11.62 8.92C11.7715 8.98224 11.936 9.00632 12.099 8.99011C12.2619 8.97391 12.4184 8.91792 12.5547 8.82707C12.691 8.73622 12.8029 8.61328 12.8805 8.46907C12.9582 8.32486 12.9992 8.16378 13 8C12.9963 7.73523 12.8927 7.48163 12.71 7.29C12.6149 7.19896 12.5028 7.12759 12.38 7.08ZM12 2C10.0222 2 8.08879 2.58649 6.4443 3.6853C4.79981 4.78412 3.51809 6.3459 2.76121 8.17317C2.00433 10.0004 1.8063 12.0111 2.19215 13.9509C2.578 15.8907 3.53041 17.6725 4.92894 19.0711C6.32746 20.4696 8.10929 21.422 10.0491 21.8079C11.9889 22.1937 13.9996 21.9957 15.8268 21.2388C17.6541 20.4819 19.2159 19.2002 20.3147 17.5557C21.4135 15.9112 22 13.9778 22 12C22 10.6868 21.7413 9.38642 21.2388 8.17317C20.7363 6.95991 19.9997 5.85752 19.0711 4.92893C18.1425 4.00035 17.0401 3.26375 15.8268 2.7612C14.6136 2.25866 13.3132 2 12 2ZM12 20C10.4178 20 8.87104 19.5308 7.55544 18.6518C6.23985 17.7727 5.21447 16.5233 4.60897 15.0615C4.00347 13.5997 3.84504 11.9911 4.15372 10.4393C4.4624 8.88743 5.22433 7.46197 6.34315 6.34315C7.46197 5.22433 8.88743 4.4624 10.4393 4.15372C11.9911 3.84504 13.5997 4.00346 15.0615 4.60896C16.5233 5.21447 17.7727 6.23984 18.6518 7.55544C19.5308 8.87103 20 10.4177 20 12C20 14.1217 19.1572 16.1566 17.6569 17.6569C16.1566 19.1571 14.1217 20 12 20Z"></path></svg>Note</p><div class="starlight-aside__content"><p>Naknade kartica se prenose po stvarnom trosku (4.4% + $0.30 po transakciji) i ne naplacujemo nista preko toga.</p></div></aside>\n<p>Besplatni modeli:</p>\n<ul>\n<li>GLM 4.7 Free je dostupan na SlopCode ograniceno vrijeme. Tim koristi taj period za prikupljanje feedbacka i unapredenje modela.</li>\n<li>Kimi K2.5 Free je dostupan na SlopCode ograniceno vrijeme. Tim koristi taj period za prikupljanje feedbacka i unapredenje modela.</li>\n<li>MiniMax M2.1 Free je dostupan na SlopCode ograniceno vrijeme. Tim koristi taj period za prikupljanje feedbacka i unapredenje modela.</li>\n<li>Big Pickle je stealth model koji je besplatan na SlopCode ograniceno vrijeme. Tim koristi taj period za prikupljanje feedbacka i unapredenje modela.</li>\n</ul>\n',
      }),
      createVNode(_components.p, {
        children: [
          "Ako imate pitanja, ",
          createVNode("a", {
            href: email,
            "set:html": "kontaktirajte nas",
          }),
          ".",
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h3 id="automatska-dopuna"><a href="#automatska-dopuna">Automatska dopuna</a></h3>\n<p>Ako vam stanje padne ispod $5, Zen ce automatski dopuniti $20.</p>\n<p>Iznos auto-reloada mozete promijeniti. Auto-reload mozete i potpuno iskljuciti.</p>\n<hr>\n<h3 id="mjesečni-limiti"><a href="#mjesečni-limiti">Mjesečni limiti</a></h3>\n<p>Mozete postaviti mjesecni limit potrosnje za cijeli workspace i za svakog clana tima.</p>\n<p>Na primjer, ako postavite mjesecni limit na $20, Zen nece potrositi vise od $20 u mjesecu. Ali ako je auto-reload ukljucen, ukupna naplata moze preci $20 ako stanje padne ispod $5.</p>\n<hr>\n<h2 id="privatnost"><a href="#privatnost">Privatnost</a></h2>\n<p>Svi nasi modeli su hostovani u SAD-u. Provajderi prate zero-retention politiku i ne koriste vase podatke za treniranje modela, uz sljedece izuzetke:</p>\n<ul>\n<li>Big Pickle: Tokom besplatnog perioda, prikupljeni podaci mogu se koristiti za poboljsanje modela.</li>\n<li>GLM 4.7 Free: Tokom besplatnog perioda, prikupljeni podaci mogu se koristiti za poboljsanje modela.</li>\n<li>Kimi K2.5 Free: Tokom besplatnog perioda, prikupljeni podaci mogu se koristiti za poboljsanje modela.</li>\n<li>MiniMax M2.1 Free: Tokom besplatnog perioda, prikupljeni podaci mogu se koristiti za poboljsanje modela.</li>\n<li>OpenAI API-ji: Zahtjevi se cuvaju 30 dana prema <a href="https://platform.openai.com/docs/guides/your-data">OpenAI Data Policies</a>.</li>\n<li>Anthropic API-ji: Zahtjevi se cuvaju 30 dana prema <a href="https://docs.anthropic.com/en/docs/claude-code/data-usage">Anthropic Data Policies</a>.</li>\n</ul>\n<hr>\n<h2 id="za-timove"><a href="#za-timove">Za timove</a></h2>\n<p>Zen odlicno radi i za timove. Mozete pozvati clanove tima, dodijeliti uloge, birati modele koje tim koristi i jos mnogo toga.</p>\n<aside aria-label="Note" class="starlight-aside starlight-aside--note"><p class="starlight-aside__title" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="starlight-aside__icon"><path d="M12 11C11.7348 11 11.4804 11.1054 11.2929 11.2929C11.1054 11.4804 11 11.7348 11 12V16C11 16.2652 11.1054 16.5196 11.2929 16.7071C11.4804 16.8946 11.7348 17 12 17C12.2652 17 12.5196 16.8946 12.7071 16.7071C12.8946 16.5196 13 16.2652 13 16V12C13 11.7348 12.8946 11.4804 12.7071 11.2929C12.5196 11.1054 12.2652 11 12 11ZM12.38 7.08C12.1365 6.97998 11.8635 6.97998 11.62 7.08C11.4973 7.12759 11.3851 7.19896 11.29 7.29C11.2017 7.3872 11.1306 7.49882 11.08 7.62C11.024 7.73868 10.9966 7.86882 11 8C10.9992 8.13161 11.0245 8.26207 11.0742 8.38391C11.124 8.50574 11.1973 8.61656 11.29 8.71C11.3872 8.79833 11.4988 8.86936 11.62 8.92C11.7715 8.98224 11.936 9.00632 12.099 8.99011C12.2619 8.97391 12.4184 8.91792 12.5547 8.82707C12.691 8.73622 12.8029 8.61328 12.8805 8.46907C12.9582 8.32486 12.9992 8.16378 13 8C12.9963 7.73523 12.8927 7.48163 12.71 7.29C12.6149 7.19896 12.5028 7.12759 12.38 7.08ZM12 2C10.0222 2 8.08879 2.58649 6.4443 3.6853C4.79981 4.78412 3.51809 6.3459 2.76121 8.17317C2.00433 10.0004 1.8063 12.0111 2.19215 13.9509C2.578 15.8907 3.53041 17.6725 4.92894 19.0711C6.32746 20.4696 8.10929 21.422 10.0491 21.8079C11.9889 22.1937 13.9996 21.9957 15.8268 21.2388C17.6541 20.4819 19.2159 19.2002 20.3147 17.5557C21.4135 15.9112 22 13.9778 22 12C22 10.6868 21.7413 9.38642 21.2388 8.17317C20.7363 6.95991 19.9997 5.85752 19.0711 4.92893C18.1425 4.00035 17.0401 3.26375 15.8268 2.7612C14.6136 2.25866 13.3132 2 12 2ZM12 20C10.4178 20 8.87104 19.5308 7.55544 18.6518C6.23985 17.7727 5.21447 16.5233 4.60897 15.0615C4.00347 13.5997 3.84504 11.9911 4.15372 10.4393C4.4624 8.88743 5.22433 7.46197 6.34315 6.34315C7.46197 5.22433 8.88743 4.4624 10.4393 4.15372C11.9911 3.84504 13.5997 4.00346 15.0615 4.60896C16.5233 5.21447 17.7727 6.23984 18.6518 7.55544C19.5308 8.87103 20 10.4177 20 12C20 14.1217 19.1572 16.1566 17.6569 17.6569C16.1566 19.1571 14.1217 20 12 20Z"></path></svg>Note</p><div class="starlight-aside__content"><p>Workspaces su trenutno besplatni za timove kao dio beta faze.</p></div></aside>\n<p>Upravljanje workspace-om je trenutno besplatno za timove tokom beta faze. Vise detalja o cijenama podijelit cemo uskoro.</p>\n<hr>\n<h3 id="uloge"><a href="#uloge">Uloge</a></h3>\n<p>Mozete pozvati clanove tima u workspace i dodijeliti uloge:</p>\n<ul>\n<li><strong>Admin</strong>: upravlja modelima, clanovima, API kljucevima i billingom</li>\n<li><strong>Member</strong>: upravlja samo svojim API kljucevima</li>\n</ul>\n<p>Admini mogu postaviti i mjesecne limite potrosnje po clanu da drze troskove pod kontrolom.</p>\n<hr>\n<h3 id="pristup-modelima"><a href="#pristup-modelima">Pristup modelima</a></h3>\n<p>Admini mogu ukljuciti ili iskljuciti odredene modele za workspace. Zahtjevi prema iskljucenom modelu vracaju gresku.</p>\n<p>Ovo je korisno kada zelite zabraniti model koji prikuplja podatke.</p>\n<hr>\n<h3 id="donesite-vlastiti-ključ"><a href="#donesite-vlastiti-ključ">Donesite vlastiti ključ</a></h3>\n<p>Mozete koristiti vlastite OpenAI ili Anthropic API kljuceve i dalje koristiti ostale modele u Zen-u.</p>\n<p>Kada koristite vlastite kljuceve, tokene direktno naplacuje provajder, ne Zen.</p>\n<p>Na primjer, vasa organizacija mozda vec ima OpenAI ili Anthropic kljuc i zelite koristiti njega umjesto onog koji daje Zen.</p>\n<hr>\n<h2 id="ciljevi"><a href="#ciljevi">Ciljevi</a></h2>\n<p>SlopCode Zen smo napravili da:</p>\n<ol>\n<li><strong>Benchmarkiramo</strong> najbolje kombinacije model/provajder za coding agente.</li>\n<li>Omogucimo pristup opcijama <strong>najviseg kvaliteta</strong> bez degradacije performansi i preusmjeravanja na jeftinije provajdere.</li>\n<li>Prenesemo svaka <strong>snizenja cijena</strong> prodajom po trosku, tako da je jedini markup pokrice processing naknada.</li>\n<li>Obezbijedimo <strong>bez lock-ina</strong> tako da Zen mozete koristiti sa bilo kojim coding agentom, uz slobodu koristenja drugih provajdera u SlopCode.</li>\n</ol>',
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

const url = "src/content/docs/bs/zen.mdx"
const file = "/app/packages/web/src/content/docs/bs/zen.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/app/packages/web/src/content/docs/bs/zen.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, console, Content as default, email, file, frontmatter, getHeadings, url }
