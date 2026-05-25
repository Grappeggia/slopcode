globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"
import { c as config } from "./config_UI6PtV27.mjs"

const frontmatter = {
  title: "Zen",
  description: "SlopCode가 제공하는 엄선된 모델 목록.",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "배경",
      text: "배경",
    },
    {
      depth: 2,
      slug: "어떻게-작동하나요",
      text: "어떻게 작동하나요?",
    },
    {
      depth: 2,
      slug: "엔드포인트",
      text: "엔드포인트",
    },
    {
      depth: 3,
      slug: "모델",
      text: "모델",
    },
    {
      depth: 2,
      slug: "요금제",
      text: "요금제",
    },
    {
      depth: 3,
      slug: "자동-충전",
      text: "자동 충전",
    },
    {
      depth: 3,
      slug: "월간-사용-한도",
      text: "월간 사용 한도",
    },
    {
      depth: 2,
      slug: "개인정보-보호",
      text: "개인정보 보호",
    },
    {
      depth: 2,
      slug: "팀을-위한-기능",
      text: "팀을 위한 기능",
    },
    {
      depth: 3,
      slug: "역할",
      text: "역할",
    },
    {
      depth: 3,
      slug: "모델-접근-권한",
      text: "모델 접근 권한",
    },
    {
      depth: 2,
      slug: "byok-bring-your-own-key",
      text: "BYOK (Bring Your Own Key)",
    },
    {
      depth: 2,
      slug: "목표",
      text: "목표",
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
      ...props.components,
    },
    { Fragment: Fragment$1 } = _components
  if (!Fragment$1) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    children: [
      createVNode(Fragment$1, {
        "set:html":
          '<p>SlopCode Zen은 SlopCode 팀이 제공하는, 테스트 및 검증을 완료한 모델 목록입니다.</p>\n<aside aria-label="Note" class="starlight-aside starlight-aside--note"><p class="starlight-aside__title" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="starlight-aside__icon"><path d="M12 11C11.7348 11 11.4804 11.1054 11.2929 11.2929C11.1054 11.4804 11 11.7348 11 12V16C11 16.2652 11.1054 16.5196 11.2929 16.7071C11.4804 16.8946 11.7348 17 12 17C12.2652 17 12.5196 16.8946 12.7071 16.7071C12.8946 16.5196 13 16.2652 13 16V12C13 11.7348 12.8946 11.4804 12.7071 11.2929C12.5196 11.1054 12.2652 11 12 11ZM12.38 7.08C12.1365 6.97998 11.8635 6.97998 11.62 7.08C11.4973 7.12759 11.3851 7.19896 11.29 7.29C11.2017 7.3872 11.1306 7.49882 11.08 7.62C11.024 7.73868 10.9966 7.86882 11 8C10.9992 8.13161 11.0245 8.26207 11.0742 8.38391C11.124 8.50574 11.1973 8.61656 11.29 8.71C11.3872 8.79833 11.4988 8.86936 11.62 8.92C11.7715 8.98224 11.936 9.00632 12.099 8.99011C12.2619 8.97391 12.4184 8.91792 12.5547 8.82707C12.691 8.73622 12.8029 8.61328 12.8805 8.46907C12.9582 8.32486 12.9992 8.16378 13 8C12.9963 7.73523 12.8927 7.48163 12.71 7.29C12.6149 7.19896 12.5028 7.12759 12.38 7.08ZM12 2C10.0222 2 8.08879 2.58649 6.4443 3.6853C4.79981 4.78412 3.51809 6.3459 2.76121 8.17317C2.00433 10.0004 1.8063 12.0111 2.19215 13.9509C2.578 15.8907 3.53041 17.6725 4.92894 19.0711C6.32746 20.4696 8.10929 21.422 10.0491 21.8079C11.9889 22.1937 13.9996 21.9957 15.8268 21.2388C17.6541 20.4819 19.2159 19.2002 20.3147 17.5557C21.4135 15.9112 22 13.9778 22 12C22 10.6868 21.7413 9.38642 21.2388 8.17317C20.7363 6.95991 19.9997 5.85752 19.0711 4.92893C18.1425 4.00035 17.0401 3.26375 15.8268 2.7612C14.6136 2.25866 13.3132 2 12 2ZM12 20C10.4178 20 8.87104 19.5308 7.55544 18.6518C6.23985 17.7727 5.21447 16.5233 4.60897 15.0615C4.00347 13.5997 3.84504 11.9911 4.15372 10.4393C4.4624 8.88743 5.22433 7.46197 6.34315 6.34315C7.46197 5.22433 8.88743 4.4624 10.4393 4.15372C11.9911 3.84504 13.5997 4.00346 15.0615 4.60896C16.5233 5.21447 17.7727 6.23984 18.6518 7.55544C19.5308 8.87103 20 10.4177 20 12C20 14.1217 19.1572 16.1566 17.6569 17.6569C16.1566 19.1571 14.1217 20 12 20Z"></path></svg>Note</p><div class="starlight-aside__content"><p>SlopCode Zen은 현재 베타(Beta) 단계에 있습니다.</p></div></aside>\n<p>Zen은 SlopCode 내의 다른 공급자와 동일한 방식으로 작동합니다. 사용자는 SlopCode Zen에 로그인하여 API 키를 발급받을 수 있습니다. 본 서비스는 <strong>전적으로 선택 사항</strong>이며, SlopCode를 사용하기 위해 반드시 SlopCode Zen을 이용할 필요는 없습니다.</p>\n<hr>\n<h2 id="배경"><a href="#배경">배경</a></h2>\n<p>현재 다양한 모델이 존재하지만, 이 중 코딩 에이전트로서 우수한 성능을 발휘하는 모델은 일부에 불과합니다. 또한 대부분의 공급자는 각기 다른 방식으로 구성되어 있어, 그에 따라 성능과 품질 또한 크게 달라질 수 있습니다.</p>\n<aside aria-label="Tip" class="starlight-aside starlight-aside--tip"><p class="starlight-aside__title" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="starlight-aside__icon"><path fill-rule="evenodd" clip-rule="evenodd" d="M1.43909 8.85483L1.44039 8.85354L4.96668 5.33815C5.30653 4.99386 5.7685 4.79662 6.2524 4.78972L6.26553 4.78963L12.9014 4.78962L13.8479 3.84308C16.9187 0.772319 20.0546 0.770617 21.4678 0.975145C21.8617 1.02914 22.2271 1.21053 22.5083 1.4917C22.7894 1.77284 22.9708 2.13821 23.0248 2.53199C23.2294 3.94517 23.2278 7.08119 20.1569 10.1521L19.2107 11.0983V17.7338L19.2106 17.7469C19.2037 18.2308 19.0067 18.6933 18.6624 19.0331L15.1456 22.5608C14.9095 22.7966 14.6137 22.964 14.29 23.0449C13.9663 23.1259 13.6267 23.1174 13.3074 23.0204C12.9881 22.9235 12.7011 22.7417 12.4771 22.4944C12.2533 22.2473 12.1006 21.9441 12.0355 21.6171L11.1783 17.3417L6.65869 12.822L4.34847 12.3589L2.38351 11.965C2.05664 11.8998 1.75272 11.747 1.50564 11.5232C1.25835 11.2992 1.07653 11.0122 0.979561 10.6929C0.882595 10.3736 0.874125 10.034 0.955057 9.7103C1.03599 9.38659 1.20328 9.09092 1.43909 8.85483ZM6.8186 10.8724L2.94619 10.096L6.32006 6.73268H10.9583L6.8186 10.8724ZM15.2219 5.21703C17.681 2.75787 20.0783 2.75376 21.1124 2.8876C21.2462 3.92172 21.2421 6.31895 18.783 8.77812L12.0728 15.4883L8.51172 11.9272L15.2219 5.21703ZM13.9042 21.0538L13.1279 17.1811L17.2676 13.0414V17.68L13.9042 21.0538Z"></path><path d="M9.31827 18.3446C9.45046 17.8529 9.17864 17.3369 8.68945 17.1724C8.56178 17.1294 8.43145 17.1145 8.30512 17.1243C8.10513 17.1398 7.91519 17.2172 7.76181 17.3434C7.62613 17.455 7.51905 17.6048 7.45893 17.7835C6.97634 19.2186 5.77062 19.9878 4.52406 20.4029C4.08525 20.549 3.6605 20.644 3.29471 20.7053C3.35607 20.3395 3.45098 19.9148 3.59711 19.476C4.01221 18.2294 4.78141 17.0237 6.21648 16.5411C6.39528 16.481 6.54504 16.3739 6.65665 16.2382C6.85126 16.0016 6.92988 15.678 6.84417 15.3647C6.83922 15.3466 6.83373 15.3286 6.82767 15.3106C6.74106 15.053 6.55701 14.8557 6.33037 14.7459C6.10949 14.6389 5.84816 14.615 5.59715 14.6994C5.47743 14.7397 5.36103 14.7831 5.24786 14.8294C3.22626 15.6569 2.2347 17.4173 1.75357 18.8621C1.49662 19.6337 1.36993 20.3554 1.30679 20.8818C1.27505 21.1464 1.25893 21.3654 1.25072 21.5213C1.24662 21.5993 1.24448 21.6618 1.24337 21.7066L1.243 21.7226L1.24235 21.7605L1.2422 21.7771L1.24217 21.7827L1.24217 21.7856C1.24217 22.3221 1.67703 22.7579 2.2137 22.7579L2.2155 22.7579L2.22337 22.7578L2.23956 22.7577C2.25293 22.7575 2.27096 22.7572 2.29338 22.7567C2.33821 22.7555 2.40073 22.7534 2.47876 22.7493C2.63466 22.7411 2.85361 22.725 3.11822 22.6932C3.64462 22.6301 4.36636 22.5034 5.13797 22.2464C6.58274 21.7653 8.3431 20.7738 9.17063 18.7522C9.21696 18.639 9.26037 18.5226 9.30064 18.4029C9.30716 18.3835 9.31304 18.364 9.31827 18.3446Z"></path></svg>Tip</p><div class="starlight-aside__content"><p>SlopCode와 함께 원활하게 작동하는 일부 모델 및 제공자를 선별하여 테스트를 진행하였습니다.</p></div></aside>\n<p>따라서 OpenRouter와 같은 서비스를 통해 모델을 사용하는 경우, 사용자가 원하는 모델의 최적 버전을 실제로 사용하고 있는지 확신하기 어렵습니다.</p>\n<p>이 문제를 해결하기 위해 다음과 같은 조치를 수행하였습니다.</p>\n<ol>\n<li>일부 모델을 선별하여 테스트를 진행하고, 각 모델 팀과 협력하여 최적의 운영 방안을 논의하였습니다.</li>\n<li>일부 제공자와 협력하여 해당 모델이 올바르게 제공되도록 구성하였습니다.</li>\n<li>마지막으로 모델과 제공자 조합에 대한 벤치마크를 수행하여, 신뢰를 바탕으로 권장할 수 있는 목록을 도출하였습니다.</li>\n</ol>\n<p>SlopCode Zen은 이러한 모델에 대한 접근을 제공하는 AI 게이트웨이입니다.</p>\n<hr>\n<h2 id="어떻게-작동하나요"><a href="#어떻게-작동하나요">어떻게 작동하나요?</a></h2>\n<p>SlopCode Zen은 SlopCode의 다른 제공자와 동일한 방식으로 작동합니다.</p>\n',
      }),
      createVNode(_components.ol, {
        children: [
          "\n",
          createVNode(_components.li, {
            children: [
              "**",
              createVNode("a", {
                href: console,
                "set:html": "SlopCode Zen",
              }),
              "**에 로그인한 후, 결제 정보를 추가하고 API 키를 복사합니다.",
            ],
          }),
          "\n",
          createVNode(Fragment$1, {
            "set:html":
              '<li>TUI에서 <code dir="auto">/connect</code> 명령어를 실행한 뒤, SlopCode Zen을 선택하고 API 키를 붙여넣습니다.</li>\n<li>TUI에서 <code dir="auto">/models</code> 명령어를 실행하여, 당사가 권장하는 모델 목록을 확인합니다.</li>\n',
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<p>요금은 요청 단위로 부과되며, 계정에 크레딧을 추가하여 사용할 수 있습니다.</p>\n<hr>\n<h2 id="엔드포인트"><a href="#엔드포인트">엔드포인트</a></h2>\n<p>다음 API 엔드포인트를 통해서도 당사의 모델에 접근할 수 있습니다.</p>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>모델</th><th>모델 ID</th><th>엔드포인트</th><th>AI SDK 패키지</th></tr></thead><tbody><tr><td>GPT 5.2</td><td>gpt-5.2</td><td><code dir="auto">https://slopcode.dev/zen/v1/responses</code></td><td><code dir="auto">@ai-sdk/openai</code></td></tr><tr><td>GPT 5.2 Codex</td><td>gpt-5.2-codex</td><td><code dir="auto">https://slopcode.dev/zen/v1/responses</code></td><td><code dir="auto">@ai-sdk/openai</code></td></tr><tr><td>GPT 5.1</td><td>gpt-5.1</td><td><code dir="auto">https://slopcode.dev/zen/v1/responses</code></td><td><code dir="auto">@ai-sdk/openai</code></td></tr><tr><td>GPT 5.1 Codex</td><td>gpt-5.1-codex</td><td><code dir="auto">https://slopcode.dev/zen/v1/responses</code></td><td><code dir="auto">@ai-sdk/openai</code></td></tr><tr><td>GPT 5.1 Codex Max</td><td>gpt-5.1-codex-max</td><td><code dir="auto">https://slopcode.dev/zen/v1/responses</code></td><td><code dir="auto">@ai-sdk/openai</code></td></tr><tr><td>GPT 5.1 Codex Mini</td><td>gpt-5.1-codex-mini</td><td><code dir="auto">https://slopcode.dev/zen/v1/responses</code></td><td><code dir="auto">@ai-sdk/openai</code></td></tr><tr><td>GPT 5</td><td>gpt-5</td><td><code dir="auto">https://slopcode.dev/zen/v1/responses</code></td><td><code dir="auto">@ai-sdk/openai</code></td></tr><tr><td>GPT 5 Codex</td><td>gpt-5-codex</td><td><code dir="auto">https://slopcode.dev/zen/v1/responses</code></td><td><code dir="auto">@ai-sdk/openai</code></td></tr><tr><td>GPT 5 Nano</td><td>gpt-5-nano</td><td><code dir="auto">https://slopcode.dev/zen/v1/responses</code></td><td><code dir="auto">@ai-sdk/openai</code></td></tr><tr><td>Claude Sonnet 4.5</td><td>claude-sonnet-4-5</td><td><code dir="auto">https://slopcode.dev/zen/v1/messages</code></td><td><code dir="auto">@ai-sdk/anthropic</code></td></tr><tr><td>Claude Sonnet 4</td><td>claude-sonnet-4</td><td><code dir="auto">https://slopcode.dev/zen/v1/messages</code></td><td><code dir="auto">@ai-sdk/anthropic</code></td></tr><tr><td>Claude Haiku 4.5</td><td>claude-haiku-4-5</td><td><code dir="auto">https://slopcode.dev/zen/v1/messages</code></td><td><code dir="auto">@ai-sdk/anthropic</code></td></tr><tr><td>Claude Haiku 3.5</td><td>claude-3-5-haiku</td><td><code dir="auto">https://slopcode.dev/zen/v1/messages</code></td><td><code dir="auto">@ai-sdk/anthropic</code></td></tr><tr><td>Claude Opus 4.6</td><td>claude-opus-4-6</td><td><code dir="auto">https://slopcode.dev/zen/v1/messages</code></td><td><code dir="auto">@ai-sdk/anthropic</code></td></tr><tr><td>Claude Opus 4.5</td><td>claude-opus-4-5</td><td><code dir="auto">https://slopcode.dev/zen/v1/messages</code></td><td><code dir="auto">@ai-sdk/anthropic</code></td></tr><tr><td>Claude Opus 4.1</td><td>claude-opus-4-1</td><td><code dir="auto">https://slopcode.dev/zen/v1/messages</code></td><td><code dir="auto">@ai-sdk/anthropic</code></td></tr><tr><td>Gemini 3 Pro</td><td>gemini-3-pro</td><td><code dir="auto">https://slopcode.dev/zen/v1/models/gemini-3-pro</code></td><td><code dir="auto">@ai-sdk/google</code></td></tr><tr><td>Gemini 3 Flash</td><td>gemini-3-flash</td><td><code dir="auto">https://slopcode.dev/zen/v1/models/gemini-3-flash</code></td><td><code dir="auto">@ai-sdk/google</code></td></tr><tr><td>MiniMax M2.1</td><td>minimax-m2.1</td><td><code dir="auto">https://slopcode.dev/zen/v1/chat/completions</code></td><td><code dir="auto">@ai-sdk/openai-compatible</code></td></tr><tr><td>MiniMax M2.1 Free</td><td>minimax-m2.1-free</td><td><code dir="auto">https://slopcode.dev/zen/v1/messages</code></td><td><code dir="auto">@ai-sdk/anthropic</code></td></tr><tr><td>GLM 4.7</td><td>glm-4.7</td><td><code dir="auto">https://slopcode.dev/zen/v1/chat/completions</code></td><td><code dir="auto">@ai-sdk/openai-compatible</code></td></tr><tr><td>GLM 4.7 Free</td><td>glm-4.7-free</td><td><code dir="auto">https://slopcode.dev/zen/v1/chat/completions</code></td><td><code dir="auto">@ai-sdk/openai-compatible</code></td></tr><tr><td>GLM 4.6</td><td>glm-4.6</td><td><code dir="auto">https://slopcode.dev/zen/v1/chat/completions</code></td><td><code dir="auto">@ai-sdk/openai-compatible</code></td></tr><tr><td>Kimi K2.5</td><td>kimi-k2.5</td><td><code dir="auto">https://slopcode.dev/zen/v1/chat/completions</code></td><td><code dir="auto">@ai-sdk/openai-compatible</code></td></tr><tr><td>Kimi K2.5 Free</td><td>kimi-k2.5-free</td><td><code dir="auto">https://slopcode.dev/zen/v1/chat/completions</code></td><td><code dir="auto">@ai-sdk/openai-compatible</code></td></tr><tr><td>Kimi K2 Thinking</td><td>kimi-k2-thinking</td><td><code dir="auto">https://slopcode.dev/zen/v1/chat/completions</code></td><td><code dir="auto">@ai-sdk/openai-compatible</code></td></tr><tr><td>Kimi K2</td><td>kimi-k2</td><td><code dir="auto">https://slopcode.dev/zen/v1/chat/completions</code></td><td><code dir="auto">@ai-sdk/openai-compatible</code></td></tr><tr><td>Qwen3 Coder 480B</td><td>qwen3-coder</td><td><code dir="auto">https://slopcode.dev/zen/v1/chat/completions</code></td><td><code dir="auto">@ai-sdk/openai-compatible</code></td></tr><tr><td>Big Pickle</td><td>big-pickle</td><td><code dir="auto">https://slopcode.dev/zen/v1/chat/completions</code></td><td><code dir="auto">@ai-sdk/openai-compatible</code></td></tr></tbody></table>\n<p>SlopCode 설정 파일에서 사용하는 <a href="/docs/config/#models">모델 ID</a>는 <code dir="auto">slopcode/&#x3C;model-id></code> 형식을 따릅니다.<br>\n예를 들어 GPT 5.2 Codex의 경우 설정에서 <code dir="auto">slopcode/gpt-5.2-codex</code>와 같이 사용합니다.</p>\n<hr>\n<h3 id="모델"><a href="#모델">모델</a></h3>\n<p>사용 가능한 전체 모델 목록과 해당 메타데이터는 다음 경로에서 확인할 수 있습니다:</p>\n<div class="expressive-code"><link rel="stylesheet" href="/docs/_astro/ec.4c0k7.css"><script type="module" src="/docs/_astro/ec.0vx5m.js"></script><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="plaintext"><code><div class="ec-line"><div class="code"><span style="--0:#24292e;--1:#e1e4e8">https://slopcode.dev/zen/v1/models</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="https://slopcode.dev/zen/v1/models"><div></div></button></div></figure></div>\n<hr>\n<h2 id="요금제"><a href="#요금제">요금제</a></h2>\n<p>당사는 종량제(pay-as-you-go) 요금 모델을 지원합니다. 아래는 <strong>1백만 토큰(1M tokens)당</strong> 요금입니다.</p>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>모델</th><th>입력</th><th>출력</th><th>캐시 읽기</th><th>캐시 쓰기</th></tr></thead><tbody><tr><td>Big Pickle</td><td>Free</td><td>Free</td><td>Free</td><td>-</td></tr><tr><td>MiniMax M2.1 Free</td><td>Free</td><td>Free</td><td>Free</td><td>-</td></tr><tr><td>MiniMax M2.1</td><td>$0.30</td><td>$1.20</td><td>$0.10</td><td>-</td></tr><tr><td>GLM 4.7 Free</td><td>Free</td><td>Free</td><td>Free</td><td>-</td></tr><tr><td>GLM 4.7</td><td>$0.60</td><td>$2.20</td><td>$0.10</td><td>-</td></tr><tr><td>GLM 4.6</td><td>$0.60</td><td>$2.20</td><td>$0.10</td><td>-</td></tr><tr><td>Kimi K2.5 Free</td><td>Free</td><td>Free</td><td>Free</td><td>-</td></tr><tr><td>Kimi K2.5</td><td>$0.60</td><td>$3.00</td><td>$0.08</td><td>-</td></tr><tr><td>Kimi K2 Thinking</td><td>$0.40</td><td>$2.50</td><td>-</td><td>-</td></tr><tr><td>Kimi K2</td><td>$0.40</td><td>$2.50</td><td>-</td><td>-</td></tr><tr><td>Qwen3 Coder 480B</td><td>$0.45</td><td>$1.50</td><td>-</td><td>-</td></tr><tr><td>Claude Sonnet 4.5 (≤ 200K tokens)</td><td>$3.00</td><td>$15.00</td><td>$0.30</td><td>$3.75</td></tr><tr><td>Claude Sonnet 4.5 (> 200K tokens)</td><td>$6.00</td><td>$22.50</td><td>$0.60</td><td>$7.50</td></tr><tr><td>Claude Sonnet 4 (≤ 200K tokens)</td><td>$3.00</td><td>$15.00</td><td>$0.30</td><td>$3.75</td></tr><tr><td>Claude Sonnet 4 (> 200K tokens)</td><td>$6.00</td><td>$22.50</td><td>$0.60</td><td>$7.50</td></tr><tr><td>Claude Haiku 4.5</td><td>$1.00</td><td>$5.00</td><td>$0.10</td><td>$1.25</td></tr><tr><td>Claude Haiku 3.5</td><td>$0.80</td><td>$4.00</td><td>$0.08</td><td>$1.00</td></tr><tr><td>Claude Opus 4.6 (≤ 200K tokens)</td><td>$5.00</td><td>$25.00</td><td>$0.50</td><td>$6.25</td></tr><tr><td>Claude Opus 4.6 (> 200K tokens)</td><td>$10.00</td><td>$37.50</td><td>$1.00</td><td>$12.50</td></tr><tr><td>Claude Opus 4.5</td><td>$5.00</td><td>$25.00</td><td>$0.50</td><td>$6.25</td></tr><tr><td>Claude Opus 4.1</td><td>$15.00</td><td>$75.00</td><td>$1.50</td><td>$18.75</td></tr><tr><td>Gemini 3 Pro (≤ 200K tokens)</td><td>$2.00</td><td>$12.00</td><td>$0.20</td><td>-</td></tr><tr><td>Gemini 3 Pro (> 200K tokens)</td><td>$4.00</td><td>$18.00</td><td>$0.40</td><td>-</td></tr><tr><td>Gemini 3 Flash</td><td>$0.50</td><td>$3.00</td><td>$0.05</td><td>-</td></tr><tr><td>GPT 5.2</td><td>$1.75</td><td>$14.00</td><td>$0.175</td><td>-</td></tr><tr><td>GPT 5.2 Codex</td><td>$1.75</td><td>$14.00</td><td>$0.175</td><td>-</td></tr><tr><td>GPT 5.1</td><td>$1.07</td><td>$8.50</td><td>$0.107</td><td>-</td></tr><tr><td>GPT 5.1 Codex</td><td>$1.07</td><td>$8.50</td><td>$0.107</td><td>-</td></tr><tr><td>GPT 5.1 Codex Max</td><td>$1.25</td><td>$10.00</td><td>$0.125</td><td>-</td></tr><tr><td>GPT 5.1 Codex Mini</td><td>$0.25</td><td>$2.00</td><td>$0.025</td><td>-</td></tr><tr><td>GPT 5</td><td>$1.07</td><td>$8.50</td><td>$0.107</td><td>-</td></tr><tr><td>GPT 5 Codex</td><td>$1.07</td><td>$8.50</td><td>$0.107</td><td>-</td></tr><tr><td>GPT 5 Nano</td><td>Free</td><td>Free</td><td>Free</td><td>-</td></tr></tbody></table>\n<p>사용 내역에서 <em>Claude Haiku 3.5</em>를 확인하실 수 있습니다. 이는 세션 제목을 생성하는 데 사용되는 <a href="/docs/config/#models">저비용 모델</a>입니다.</p>\n<aside aria-label="Note" class="starlight-aside starlight-aside--note"><p class="starlight-aside__title" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="starlight-aside__icon"><path d="M12 11C11.7348 11 11.4804 11.1054 11.2929 11.2929C11.1054 11.4804 11 11.7348 11 12V16C11 16.2652 11.1054 16.5196 11.2929 16.7071C11.4804 16.8946 11.7348 17 12 17C12.2652 17 12.5196 16.8946 12.7071 16.7071C12.8946 16.5196 13 16.2652 13 16V12C13 11.7348 12.8946 11.4804 12.7071 11.2929C12.5196 11.1054 12.2652 11 12 11ZM12.38 7.08C12.1365 6.97998 11.8635 6.97998 11.62 7.08C11.4973 7.12759 11.3851 7.19896 11.29 7.29C11.2017 7.3872 11.1306 7.49882 11.08 7.62C11.024 7.73868 10.9966 7.86882 11 8C10.9992 8.13161 11.0245 8.26207 11.0742 8.38391C11.124 8.50574 11.1973 8.61656 11.29 8.71C11.3872 8.79833 11.4988 8.86936 11.62 8.92C11.7715 8.98224 11.936 9.00632 12.099 8.99011C12.2619 8.97391 12.4184 8.91792 12.5547 8.82707C12.691 8.73622 12.8029 8.61328 12.8805 8.46907C12.9582 8.32486 12.9992 8.16378 13 8C12.9963 7.73523 12.8927 7.48163 12.71 7.29C12.6149 7.19896 12.5028 7.12759 12.38 7.08ZM12 2C10.0222 2 8.08879 2.58649 6.4443 3.6853C4.79981 4.78412 3.51809 6.3459 2.76121 8.17317C2.00433 10.0004 1.8063 12.0111 2.19215 13.9509C2.578 15.8907 3.53041 17.6725 4.92894 19.0711C6.32746 20.4696 8.10929 21.422 10.0491 21.8079C11.9889 22.1937 13.9996 21.9957 15.8268 21.2388C17.6541 20.4819 19.2159 19.2002 20.3147 17.5557C21.4135 15.9112 22 13.9778 22 12C22 10.6868 21.7413 9.38642 21.2388 8.17317C20.7363 6.95991 19.9997 5.85752 19.0711 4.92893C18.1425 4.00035 17.0401 3.26375 15.8268 2.7612C14.6136 2.25866 13.3132 2 12 2ZM12 20C10.4178 20 8.87104 19.5308 7.55544 18.6518C6.23985 17.7727 5.21447 16.5233 4.60897 15.0615C4.00347 13.5997 3.84504 11.9911 4.15372 10.4393C4.4624 8.88743 5.22433 7.46197 6.34315 6.34315C7.46197 5.22433 8.88743 4.4624 10.4393 4.15372C11.9911 3.84504 13.5997 4.00346 15.0615 4.60896C16.5233 5.21447 17.7727 6.23984 18.6518 7.55544C19.5308 8.87103 20 10.4177 20 12C20 14.1217 19.1572 16.1566 17.6569 17.6569C16.1566 19.1571 14.1217 20 12 20Z"></path></svg>Note</p><div class="starlight-aside__content"><p>신용카드 수수료는 원가 기준(거래당 4.4% + $0.30)으로 그대로 반영되며, 당사는 그 외의 추가 수수료를 부과하지 않습니다.</p></div></aside>\n<p>무료 모델:</p>\n<ul>\n<li>GLM 5 Free는 한정된 기간 동안 SlopCode에서 제공됩니다. 해당 기간 동안 팀은 사용자 피드백을 수집하고 모델을 개선할 예정입니다.</li>\n<li>Kimi K2.5 Free는 한정된 기간 동안 SlopCode에서 제공됩니다. 해당 기간 동안 팀은 사용자 피드백을 수집하고 모델을 개선할 예정입니다.</li>\n<li>MiniMax M2.5 Free는 한정된 기간 동안 SlopCode에서 제공됩니다. 해당 기간 동안 팀은 사용자 피드백을 수집하고 모델을 개선할 예정입니다.</li>\n<li>Big Pickle은 한정된 기간 동안 SlopCode에서 무료로 제공되는 스텔스 모델입니다. 해당 기간 동안 팀은 사용자 피드백을 수집하고 모델을 개선할 예정입니다.</li>\n</ul>\n',
      }),
      createVNode(_components.p, {
        children: [
          "문의 사항이 있으시면 ",
          createVNode("a", {
            href: email,
            "set:html": "Contact us",
          }),
          "를 통해 연락해 주시기 바랍니다.",
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h3 id="자동-충전"><a href="#자동-충전">자동 충전</a></h3>\n<p>잔액이 $5 미만으로 내려가면, Zen은 자동으로 $20을 충전합니다.</p>\n<p>자동 충전 금액은 변경할 수 있으며, 자동 충전 기능을 완전히 비활성화할 수도 있습니다.</p>\n<hr>\n<h3 id="월간-사용-한도"><a href="#월간-사용-한도">월간 사용 한도</a></h3>\n<p>워크스페이스 전체 및 각 팀 구성원별로 월간 사용 한도를 설정할 수 있습니다.</p>\n<p>예를 들어 월간 사용 한도를 $20로 설정한 경우, Zen은 한 달 동안 $20을 초과하여 사용하지 않습니다.<br>\n다만 자동 충전이 활성화되어 있는 경우, 잔액이 $5 미만으로 내려가면 자동으로 충전이 이루어질 수 있으므로 실제 청구 금액이 $20을 초과할 수 있습니다.</p>\n<hr>\n<h2 id="개인정보-보호"><a href="#개인정보-보호">개인정보 보호</a></h2>\n<p>당사의 모든 모델은 미국에서 호스팅됩니다. 당사 제공자는 데이터 무보존(zero-retention) 정책을 따르며, 아래의 예외를 제외하고는 귀하의 데이터를 모델 학습에 사용하지 않습니다.</p>\n<ul>\n<li>Big Pickle: 무료 제공 기간 동안 수집된 데이터는 모델 개선을 위해 사용될 수 있습니다.</li>\n<li>GLM 5 Free: 무료 제공 기간 동안 수집된 데이터는 모델 개선을 위해 사용될 수 있습니다.</li>\n<li>Kimi K2.5 Free: 무료 제공 기간 동안 수집된 데이터는 모델 개선을 위해 사용될 수 있습니다.</li>\n<li>MiniMax M2.5 Free: 무료 제공 기간 동안 수집된 데이터는 모델 개선을 위해 사용될 수 있습니다.</li>\n<li>OpenAI APIs: 요청 데이터는 <a href="https://platform.openai.com/docs/guides/your-data">OpenAI의 데이터 정책</a>에 따라 30일간 보관됩니다.</li>\n<li>Anthropic APIs: 요청 데이터는 <a href="https://docs.anthropic.com/en/docs/claude-code/data-usage">Anthropic의 데이터 정책</a>에 따라 30일간 보관됩니다.</li>\n</ul>\n<hr>\n<h2 id="팀을-위한-기능"><a href="#팀을-위한-기능">팀을 위한 기능</a></h2>\n<p>Zen은 팀 환경에서도 효과적으로 활용할 수 있습니다. 팀원을 초대하고, 역할을 지정하며, 팀에서 사용할 모델을 선별하는 등 다양한 기능을 제공합니다.</p>\n<aside aria-label="Note" class="starlight-aside starlight-aside--note"><p class="starlight-aside__title" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="starlight-aside__icon"><path d="M12 11C11.7348 11 11.4804 11.1054 11.2929 11.2929C11.1054 11.4804 11 11.7348 11 12V16C11 16.2652 11.1054 16.5196 11.2929 16.7071C11.4804 16.8946 11.7348 17 12 17C12.2652 17 12.5196 16.8946 12.7071 16.7071C12.8946 16.5196 13 16.2652 13 16V12C13 11.7348 12.8946 11.4804 12.7071 11.2929C12.5196 11.1054 12.2652 11 12 11ZM12.38 7.08C12.1365 6.97998 11.8635 6.97998 11.62 7.08C11.4973 7.12759 11.3851 7.19896 11.29 7.29C11.2017 7.3872 11.1306 7.49882 11.08 7.62C11.024 7.73868 10.9966 7.86882 11 8C10.9992 8.13161 11.0245 8.26207 11.0742 8.38391C11.124 8.50574 11.1973 8.61656 11.29 8.71C11.3872 8.79833 11.4988 8.86936 11.62 8.92C11.7715 8.98224 11.936 9.00632 12.099 8.99011C12.2619 8.97391 12.4184 8.91792 12.5547 8.82707C12.691 8.73622 12.8029 8.61328 12.8805 8.46907C12.9582 8.32486 12.9992 8.16378 13 8C12.9963 7.73523 12.8927 7.48163 12.71 7.29C12.6149 7.19896 12.5028 7.12759 12.38 7.08ZM12 2C10.0222 2 8.08879 2.58649 6.4443 3.6853C4.79981 4.78412 3.51809 6.3459 2.76121 8.17317C2.00433 10.0004 1.8063 12.0111 2.19215 13.9509C2.578 15.8907 3.53041 17.6725 4.92894 19.0711C6.32746 20.4696 8.10929 21.422 10.0491 21.8079C11.9889 22.1937 13.9996 21.9957 15.8268 21.2388C17.6541 20.4819 19.2159 19.2002 20.3147 17.5557C21.4135 15.9112 22 13.9778 22 12C22 10.6868 21.7413 9.38642 21.2388 8.17317C20.7363 6.95991 19.9997 5.85752 19.0711 4.92893C18.1425 4.00035 17.0401 3.26375 15.8268 2.7612C14.6136 2.25866 13.3132 2 12 2ZM12 20C10.4178 20 8.87104 19.5308 7.55544 18.6518C6.23985 17.7727 5.21447 16.5233 4.60897 15.0615C4.00347 13.5997 3.84504 11.9911 4.15372 10.4393C4.4624 8.88743 5.22433 7.46197 6.34315 6.34315C7.46197 5.22433 8.88743 4.4624 10.4393 4.15372C11.9911 3.84504 13.5997 4.00346 15.0615 4.60896C16.5233 5.21447 17.7727 6.23984 18.6518 7.55544C19.5308 8.87103 20 10.4177 20 12C20 14.1217 19.1572 16.1566 17.6569 17.6569C16.1566 19.1571 14.1217 20 12 20Z"></path></svg>Note</p><div class="starlight-aside__content"><p>워크스페이스는 현재 베타 프로그램의 일환으로 팀에 무료로 제공되고 있습니다.</p></div></aside>\n<p>현재 베타 기간 동안 팀의 워크스페이스 관리 기능은 무료로 제공됩니다. 요금 정책에 대한 보다 자세한 내용은 추후 안내될 예정입니다.</p>\n<hr>\n<h3 id="역할"><a href="#역할">역할</a></h3>\n<p>워크스페이스에 팀원을 초대하고 다음과 같은 역할을 부여할 수 있습니다.</p>\n<ul>\n<li><strong>Admin</strong>: 모델, 구성원, API 키 및 결제를 관리</li>\n<li><strong>Member</strong>: 본인의 API 키만 관리</li>\n</ul>\n<p>관리자는 비용 통제를 위해 각 구성원별 월간 지출 한도를 설정할 수 있습니다.</p>\n<hr>\n<h3 id="모델-접근-권한"><a href="#모델-접근-권한">모델 접근 권한</a></h3>\n<p>관리자는 워크스페이스에서 특정 모델의 사용을 활성화하거나 비활성화할 수 있습니다. 비활성화된 모델에 대한 요청은 오류를 반환합니다.</p>\n<p>이는 데이터 수집이 이루어지는 모델의 사용을 제한하려는 경우에 유용합니다.</p>\n<hr>\n<h2 id="byok-bring-your-own-key"><a href="#byok-bring-your-own-key">BYOK (Bring Your Own Key)</a></h2>\n<p>Zen에서 다른 모델을 계속 이용하면서도, OpenAI 또는 Anthropic의 자체 API 키를 사용할 수 있습니다.</p>\n<p>자체 키를 사용하는 경우, 토큰 사용 요금은 Zen이 아닌 해당 제공자가 직접 청구합니다.</p>\n<p>예를 들어, 귀하의 조직이 이미 OpenAI 또는 Anthropic의 API 키를 보유하고 있는 경우, Zen에서 제공하는 키 대신 해당 키를 사용할 수 있습니다.</p>\n<hr>\n<h2 id="목표"><a href="#목표">목표</a></h2>\n<p>SlopCode Zen은 다음과 같은 목표를 바탕으로 개발되었습니다.</p>\n<ol>\n<li>코딩 에이전트에 적합한 최상의 모델 및 제공자를 <strong>벤치마킹</strong>합니다.</li>\n<li>성능을 저하시키거나 더 저렴한 제공자로 우회하지 않고, <strong>최고 품질의 옵션</strong>에 접근할 수 있도록 합니다.</li>\n<li>가격 인하가 있을 경우 이를 원가로 반영하여 제공하며, 당사의 마진은 처리 수수료를 충당하기 위한 최소 수준으로 제한합니다.</li>\n<li>특정 서비스에 종속되지 않도록 하여, 다른 코딩 에이전트와도 자유롭게 함께 사용할 수 있도록 하며, SlopCode 내에서 다른 제공자 역시 언제든지 사용할 수 있도록 합니다.</li>\n</ol>',
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

const url = "src/content/docs/ko/zen.mdx"
const file = "/app/packages/web/src/content/docs/ko/zen.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/app/packages/web/src/content/docs/ko/zen.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, console, Content as default, email, file, frontmatter, getHeadings, url }
