globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"
import { $ as $$Image } from "./_astro_assets_VXEWGxWQ.mjs"
import {
  _ as __0__________assets_web_web_homepage_new_session_png__,
  a as __1__________assets_web_web_homepage_active_session_png__,
  b as __2__________assets_web_web_homepage_see_servers_png__,
} from "./web-homepage-see-servers_SodOMcu-.mjs"

const frontmatter = {
  title: "Web",
  description: "브라우저에서 SlopCode 사용하기.",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "시작하기",
      text: "시작하기",
    },
    {
      depth: 2,
      slug: "구성",
      text: "구성",
    },
    {
      depth: 2,
      slug: "포트",
      text: "포트",
    },
    {
      depth: 2,
      slug: "호스트-이름",
      text: "호스트 이름",
    },
    {
      depth: 3,
      slug: "mdns-발견",
      text: "mDNS 발견",
    },
    {
      depth: 6,
      slug: "cors",
      text: "CORS",
    },
    {
      depth: 3,
      slug: "인증",
      text: "인증",
    },
    {
      depth: 2,
      slug: "웹-인터페이스-사용",
      text: "웹 인터페이스 사용",
    },
    {
      depth: 2,
      slug: "세션",
      text: "세션",
    },
    {
      depth: 2,
      slug: "서버-상태",
      text: "서버 상태",
    },
    {
      depth: 2,
      slug: "터미널-연결",
      text: "터미널 연결",
    },
    {
      depth: 2,
      slug: "구성-파일",
      text: "구성 파일",
    },
  ]
}
const __usesAstroImage = true
function _createMdxContent(props) {
  const _components = {
      "astro-image": "astro-image",
      p: "p",
      ...props.components,
    },
    _component0 = _components["astro-image"],
    { Fragment: Fragment$1 } = _components
  if (!Fragment$1) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    children: [
      createVNode(Fragment$1, {
        "set:html":
          "<p>slopcode는 브라우저에서 웹 응용 프로그램을 실행할 수 있으며 terminal을 필요로하지 않고 동일한 강력한 AI 코딩 경험을 제공합니다.</p>\n",
      }),
      createVNode(_components.p, {
        children: createVNode(_component0, {
          alt: "slopcode Web - 새로운 세션",
          src: __0__________assets_web_web_homepage_new_session_png__,
        }),
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<h2 id="시작하기"><a href="#시작하기">시작하기</a></h2>\n<p>실행하여 웹 인터페이스를 시작:</p>\n<div class="expressive-code"><link rel="stylesheet" href="/docs/_astro/ec.4c0k7.css"><script type="module" src="/docs/_astro/ec.0vx5m.js"></script><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">web</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode web"><div></div></button></div></figure></div>\n<p><code dir="auto">127.0.0.1</code>의 로컬 서버를 랜덤 사용 가능한 포트로 시작하고 기본 브라우저에서 slopcode를 자동으로 엽니다.</p>\n<aside aria-label="Caution" class="starlight-aside starlight-aside--caution"><p class="starlight-aside__title" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="starlight-aside__icon"><path d="M12 16C11.8022 16 11.6089 16.0587 11.4444 16.1686C11.28 16.2784 11.1518 16.4346 11.0761 16.6173C11.0004 16.8001 10.9806 17.0011 11.0192 17.1951C11.0578 17.3891 11.153 17.5673 11.2929 17.7071C11.4327 17.847 11.6109 17.9422 11.8049 17.9808C11.9989 18.0194 12.2 17.9996 12.3827 17.9239C12.5654 17.8482 12.7216 17.72 12.8315 17.5556C12.9413 17.3911 13 17.1978 13 17C13 16.7348 12.8946 16.4805 12.7071 16.2929C12.5196 16.1054 12.2652 16 12 16ZM22.67 17.47L14.62 3.47003C14.3598 3.00354 13.9798 2.61498 13.5192 2.3445C13.0586 2.07401 12.5341 1.9314 12 1.9314C11.4659 1.9314 10.9414 2.07401 10.4808 2.3445C10.0202 2.61498 9.64019 3.00354 9.38 3.47003L1.38 17.47C1.11079 17.924 0.966141 18.441 0.960643 18.9688C0.955144 19.4966 1.089 20.0166 1.34868 20.4761C1.60837 20.9356 1.9847 21.3185 2.43968 21.5861C2.89466 21.8536 3.41218 21.9964 3.94 22H20.06C20.5921 22.0053 21.1159 21.8689 21.5779 21.6049C22.0399 21.341 22.4234 20.9589 22.689 20.4978C22.9546 20.0368 23.0928 19.5134 23.0895 18.9814C23.0862 18.4493 22.9414 17.9277 22.67 17.47ZM20.94 19.47C20.8523 19.626 20.7245 19.7556 20.5697 19.8453C20.4149 19.935 20.2389 19.9815 20.06 19.98H3.94C3.76111 19.9815 3.5851 19.935 3.43032 19.8453C3.27553 19.7556 3.14765 19.626 3.06 19.47C2.97223 19.318 2.92602 19.1456 2.92602 18.97C2.92602 18.7945 2.97223 18.622 3.06 18.47L11.06 4.47003C11.1439 4.30623 11.2714 4.16876 11.4284 4.07277C11.5855 3.97678 11.766 3.92599 11.95 3.92599C12.134 3.92599 12.3145 3.97678 12.4716 4.07277C12.6286 4.16876 12.7561 4.30623 12.84 4.47003L20.89 18.47C20.9892 18.6199 21.0462 18.7937 21.055 18.9732C21.0638 19.1527 21.0241 19.3312 20.94 19.49V19.47ZM12 8.00003C11.7348 8.00003 11.4804 8.10538 11.2929 8.29292C11.1054 8.48046 11 8.73481 11 9.00003V13C11 13.2652 11.1054 13.5196 11.2929 13.7071C11.4804 13.8947 11.7348 14 12 14C12.2652 14 12.5196 13.8947 12.7071 13.7071C12.8946 13.5196 13 13.2652 13 13V9.00003C13 8.73481 12.8946 8.48046 12.7071 8.29292C12.5196 8.10538 12.2652 8.00003 12 8.00003Z"></path></svg>Caution</p><div class="starlight-aside__content"><p><code dir="auto">SLOPCODE_SERVER_PASSWORD</code>가 설정되지 않은 경우 서버가 중단되지 않습니다. 이것은 로컬 사용을위한 괜찮지만 네트워크 액세스를 설정해야합니다.</p></div></aside>\n<aside aria-label="Windows 사용자" class="starlight-aside starlight-aside--tip"><p class="starlight-aside__title" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="starlight-aside__icon"><path fill-rule="evenodd" clip-rule="evenodd" d="M1.43909 8.85483L1.44039 8.85354L4.96668 5.33815C5.30653 4.99386 5.7685 4.79662 6.2524 4.78972L6.26553 4.78963L12.9014 4.78962L13.8479 3.84308C16.9187 0.772319 20.0546 0.770617 21.4678 0.975145C21.8617 1.02914 22.2271 1.21053 22.5083 1.4917C22.7894 1.77284 22.9708 2.13821 23.0248 2.53199C23.2294 3.94517 23.2278 7.08119 20.1569 10.1521L19.2107 11.0983V17.7338L19.2106 17.7469C19.2037 18.2308 19.0067 18.6933 18.6624 19.0331L15.1456 22.5608C14.9095 22.7966 14.6137 22.964 14.29 23.0449C13.9663 23.1259 13.6267 23.1174 13.3074 23.0204C12.9881 22.9235 12.7011 22.7417 12.4771 22.4944C12.2533 22.2473 12.1006 21.9441 12.0355 21.6171L11.1783 17.3417L6.65869 12.822L4.34847 12.3589L2.38351 11.965C2.05664 11.8998 1.75272 11.747 1.50564 11.5232C1.25835 11.2992 1.07653 11.0122 0.979561 10.6929C0.882595 10.3736 0.874125 10.034 0.955057 9.7103C1.03599 9.38659 1.20328 9.09092 1.43909 8.85483ZM6.8186 10.8724L2.94619 10.096L6.32006 6.73268H10.9583L6.8186 10.8724ZM15.2219 5.21703C17.681 2.75787 20.0783 2.75376 21.1124 2.8876C21.2462 3.92172 21.2421 6.31895 18.783 8.77812L12.0728 15.4883L8.51172 11.9272L15.2219 5.21703ZM13.9042 21.0538L13.1279 17.1811L17.2676 13.0414V17.68L13.9042 21.0538Z"></path><path d="M9.31827 18.3446C9.45046 17.8529 9.17864 17.3369 8.68945 17.1724C8.56178 17.1294 8.43145 17.1145 8.30512 17.1243C8.10513 17.1398 7.91519 17.2172 7.76181 17.3434C7.62613 17.455 7.51905 17.6048 7.45893 17.7835C6.97634 19.2186 5.77062 19.9878 4.52406 20.4029C4.08525 20.549 3.6605 20.644 3.29471 20.7053C3.35607 20.3395 3.45098 19.9148 3.59711 19.476C4.01221 18.2294 4.78141 17.0237 6.21648 16.5411C6.39528 16.481 6.54504 16.3739 6.65665 16.2382C6.85126 16.0016 6.92988 15.678 6.84417 15.3647C6.83922 15.3466 6.83373 15.3286 6.82767 15.3106C6.74106 15.053 6.55701 14.8557 6.33037 14.7459C6.10949 14.6389 5.84816 14.615 5.59715 14.6994C5.47743 14.7397 5.36103 14.7831 5.24786 14.8294C3.22626 15.6569 2.2347 17.4173 1.75357 18.8621C1.49662 19.6337 1.36993 20.3554 1.30679 20.8818C1.27505 21.1464 1.25893 21.3654 1.25072 21.5213C1.24662 21.5993 1.24448 21.6618 1.24337 21.7066L1.243 21.7226L1.24235 21.7605L1.2422 21.7771L1.24217 21.7827L1.24217 21.7856C1.24217 22.3221 1.67703 22.7579 2.2137 22.7579L2.2155 22.7579L2.22337 22.7578L2.23956 22.7577C2.25293 22.7575 2.27096 22.7572 2.29338 22.7567C2.33821 22.7555 2.40073 22.7534 2.47876 22.7493C2.63466 22.7411 2.85361 22.725 3.11822 22.6932C3.64462 22.6301 4.36636 22.5034 5.13797 22.2464C6.58274 21.7653 8.3431 20.7738 9.17063 18.7522C9.21696 18.639 9.26037 18.5226 9.30064 18.4029C9.30716 18.3835 9.31304 18.364 9.31827 18.3446Z"></path></svg>Windows 사용자</p><div class="starlight-aside__content"><p>최고의 경험을 위해서는 PowerShell보다 <code dir="auto">slopcode web</code>를 실행하십시오. 적절한 파일 시스템 액세스 및 terminal 통합을 보장합니다.</p></div></aside>\n<hr>\n<h2 id="구성"><a href="#구성">구성</a></h2>\n<p>명령줄 플래그 또는 <a href="/docs/config">config file</a>에서 웹 서버를 구성할 수 있습니다.</p>\n<h2 id="포트"><a href="#포트">포트</a></h2>\n<p>기본적으로 slopcode는 사용할 수 있는 포트를 선택합니다. 포트를 지정할 수 있습니다:</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">web</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--port</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">4096</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode web --port 4096"><div></div></button></div></figure></div>\n<h2 id="호스트-이름"><a href="#호스트-이름">호스트 이름</a></h2>\n<p>기본적으로 서버는 <code dir="auto">127.0.0.1</code> (localhost only)에 바인딩합니다. 네트워크에서 slopcode를 사용할 수 있도록:</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">web</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--hostname</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">0.0.0.0</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode web --hostname 0.0.0.0"><div></div></button></div></figure></div>\n<p><code dir="auto">0.0.0.0</code>를 사용할 때, slopcode는 로컬 및 네트워크 주소를 모두 표시합니다.</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="plaintext"><code><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292e;--1:#e1e4e8">  </span></span><span style="--0:#24292e;--1:#e1e4e8">Local access:       http://localhost:4096</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292e;--1:#e1e4e8">  </span></span><span style="--0:#24292e;--1:#e1e4e8">Network access:     http://192.168.1.100:4096</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="  Local access:       http://localhost:4096  Network access:     http://192.168.1.100:4096"><div></div></button></div></figure></div>\n<h3 id="mdns-발견"><a href="#mdns-발견">mDNS 발견</a></h3>\n<p>로컬 네트워크에서 서버를 발견할 수 있는 mDNS:</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">web</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--mdns</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode web --mdns"><div></div></button></div></figure></div>\n<p>이 자동으로 <code dir="auto">0.0.0.0</code>에 hostname을 설정하고 <code dir="auto">slopcode.local</code>로 서버를 광고합니다.</p>\n<p>동일한 네트워크에서 여러 인스턴스를 실행하려면 mDNS 도메인 이름을 지정할 수 있습니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">web</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--mdns</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--mdns-domain</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">myproject.local</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode web --mdns --mdns-domain myproject.local"><div></div></button></div></figure></div>\n<h6 id="cors"><a href="#cors">CORS</a></h6>\n<p>CORS에 대한 추가 도메인을 허용하려면 (사용자 정의 frontends에 적합) :</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">web</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--cors</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">https://example.com</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode web --cors https://example.com"><div></div></button></div></figure></div>\n<h3 id="인증"><a href="#인증">인증</a></h3>\n<p>액세스를 보호하려면 <code dir="auto">SLOPCODE_SERVER_PASSWORD</code> 환경 변수를 사용하여 암호를 설정하십시오.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">SLOPCODE_SERVER_PASSWORD</span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#032F62;--1:#9ECBFF">secret</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">web</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="SLOPCODE_SERVER_PASSWORD=secret slopcode web"><div></div></button></div></figure></div>\n<p><code dir="auto">slopcode</code>에 대한 사용자의 기본값은 <code dir="auto">SLOPCODE_SERVER_USERNAME</code>로 변경할 수 있습니다.</p>\n<hr>\n<h2 id="웹-인터페이스-사용"><a href="#웹-인터페이스-사용">웹 인터페이스 사용</a></h2>\n<p>시작되면 웹 인터페이스는 slopcode 세션에 액세스 할 수 있습니다.</p>\n<h2 id="세션"><a href="#세션">세션</a></h2>\n<p>홈페이지에서 세션을 보고 관리합니다. 활성 세션을 볼 수 있으며 새로운 것을 시작합니다.</p>\n',
      }),
      createVNode(_components.p, {
        children: createVNode(_component0, {
          alt: "slopcode Web - Active Session",
          src: __1__________assets_web_web_homepage_active_session_png__,
        }),
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<h2 id="서버-상태"><a href="#서버-상태">서버 상태</a></h2>\n<p>“See Servers”를 클릭하여 연결된 서버와 상태를 볼 수 있습니다.</p>\n',
      }),
      createVNode(_components.p, {
        children: createVNode(_component0, {
          alt: "slopcode Web - Servers 참조",
          src: __2__________assets_web_web_homepage_see_servers_png__,
        }),
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h2 id="터미널-연결"><a href="#터미널-연결">터미널 연결</a></h2>\n<p>실행 웹 서버에 terminal TUI를 연결할 수 있습니다.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># Start the web server</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">web</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--port</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">4096</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># In another terminal, attach the TUI</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">attach</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">http://localhost:4096</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode web --port 4096slopcode attach http://localhost:4096"><div></div></button></div></figure></div>\n<p>웹 인터페이스와 terminal을 동시에 사용할 수 있도록, 같은 세션과 상태를 공유합니다.</p>\n<hr>\n<h2 id="구성-파일"><a href="#구성-파일">구성 파일</a></h2>\n<p><code dir="auto">slopcode.json</code> config 파일에서 서버 설정을 구성할 수 있습니다:</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="json"><code><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">{</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"server"</span><span style="--0:#24292E;--1:#E1E4E8">: {</span></div></div><div class="ec-line"><div class="code"><span class="indent">    </span><span style="--0:#005CC5;--1:#79B8FF">"port"</span><span style="--0:#24292E;--1:#E1E4E8">: </span><span style="--0:#005CC5;--1:#79B8FF">4096</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent">    </span><span style="--0:#005CC5;--1:#79B8FF">"hostname"</span><span style="--0:#24292E;--1:#E1E4E8">: </span><span style="--0:#032F62;--1:#9ECBFF">"0.0.0.0"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent">    </span><span style="--0:#005CC5;--1:#79B8FF">"mdns"</span><span style="--0:#24292E;--1:#E1E4E8">: </span><span style="--0:#005CC5;--1:#79B8FF">true</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent">    </span><span style="--0:#005CC5;--1:#79B8FF">"cors"</span><span style="--0:#24292E;--1:#E1E4E8">: [</span><span style="--0:#032F62;--1:#9ECBFF">"https://example.com"</span><span style="--0:#24292E;--1:#E1E4E8">]</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">}</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">}</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="{  &#x22;server&#x22;: {    &#x22;port&#x22;: 4096,    &#x22;hostname&#x22;: &#x22;0.0.0.0&#x22;,    &#x22;mdns&#x22;: true,    &#x22;cors&#x22;: [&#x22;https://example.com&#x22;]  }}"><div></div></button></div></figure></div>\n<p>Command line flags는 config 파일 설정에 대한 precedence를 가져옵니다.</p>',
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

const url = "src/content/docs/ko/web.mdx"
const file = "/app/packages/web/src/content/docs/ko/web.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components, "astro-image": props.components?.img ?? $$Image },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/app/packages/web/src/content/docs/ko/web.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, __usesAstroImage, Content as default, file, frontmatter, getHeadings, url }
