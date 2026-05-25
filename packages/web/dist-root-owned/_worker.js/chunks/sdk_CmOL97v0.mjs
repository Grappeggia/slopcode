globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"
import { c as config } from "./config_UI6PtV27.mjs"

const frontmatter = {
  title: "مجموعة تطوير البرمجيات (SDK)",
  description: "عميل JavaScript آمن الأنواع لخادم slopcode.",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "التثبيت",
      text: "التثبيت",
    },
    {
      depth: 2,
      slug: "إنشاء-عميل",
      text: "إنشاء عميل",
    },
    {
      depth: 4,
      slug: "الخيارات",
      text: "الخيارات",
    },
    {
      depth: 2,
      slug: "الإعدادات",
      text: "الإعدادات",
    },
    {
      depth: 2,
      slug: "العميل-فقط",
      text: "العميل فقط",
    },
    {
      depth: 4,
      slug: "الخيارات-1",
      text: "الخيارات",
    },
    {
      depth: 2,
      slug: "الأنواع",
      text: "الأنواع",
    },
    {
      depth: 2,
      slug: "الأخطاء",
      text: "الأخطاء",
    },
    {
      depth: 2,
      slug: "apis",
      text: "APIs",
    },
    {
      depth: 3,
      slug: "عام-global",
      text: "عام (global)",
    },
    {
      depth: 4,
      slug: "أمثلة",
      text: "أمثلة",
    },
    {
      depth: 3,
      slug: "التطبيق-app",
      text: "التطبيق (app)",
    },
    {
      depth: 4,
      slug: "أمثلة-1",
      text: "أمثلة",
    },
    {
      depth: 3,
      slug: "المشروع-project",
      text: "المشروع (project)",
    },
    {
      depth: 4,
      slug: "أمثلة-2",
      text: "أمثلة",
    },
    {
      depth: 3,
      slug: "المسار-path",
      text: "المسار (path)",
    },
    {
      depth: 4,
      slug: "أمثلة-3",
      text: "أمثلة",
    },
    {
      depth: 3,
      slug: "الإعدادات-config",
      text: "الإعدادات (config)",
    },
    {
      depth: 4,
      slug: "أمثلة-4",
      text: "أمثلة",
    },
    {
      depth: 3,
      slug: "الجلسات-session",
      text: "الجلسات (session)",
    },
    {
      depth: 4,
      slug: "أمثلة-5",
      text: "أمثلة",
    },
    {
      depth: 3,
      slug: "الملفات",
      text: "الملفات",
    },
    {
      depth: 4,
      slug: "أمثلة-6",
      text: "أمثلة",
    },
    {
      depth: 3,
      slug: "واجهة-tui-tui",
      text: "واجهة TUI (tui)",
    },
    {
      depth: 4,
      slug: "أمثلة-7",
      text: "أمثلة",
    },
    {
      depth: 3,
      slug: "المصادقة-auth",
      text: "المصادقة (auth)",
    },
    {
      depth: 4,
      slug: "أمثلة-8",
      text: "أمثلة",
    },
    {
      depth: 3,
      slug: "الأحداث-event",
      text: "الأحداث (event)",
    },
    {
      depth: 4,
      slug: "أمثلة-9",
      text: "أمثلة",
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
          '<p>توفر SDK الخاصة بـ slopcode لـ JS/TS عميلا آمنا للأنواع للتفاعل مع الخادم.\nاستخدمها لبناء التكاملات والتحكم في slopcode برمجيا.</p>\n<p><a href="/docs/server">اعرف المزيد</a> حول كيفية عمل الخادم. للاطلاع على أمثلة، تفقد <a href="/docs/ecosystem#projects">المشاريع</a> التي أنشأها المجتمع.</p>\n<hr>\n<h2 id="التثبيت"><a href="#التثبيت">التثبيت</a></h2>\n<p>ثبّت SDK من npm:</p>\n<div class="expressive-code"><link rel="stylesheet" href="/docs/_astro/ec.4c0k7.css"><script type="module" src="/docs/_astro/ec.0vx5m.js"></script><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">npm</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">@slopcode-ai/sdk</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="npm install @slopcode-ai/sdk"><div></div></button></div></figure></div>\n<hr>\n<h2 id="إنشاء-عميل"><a href="#إنشاء-عميل">إنشاء عميل</a></h2>\n<p>أنشئ مثيلا من slopcode:</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">import</span><span style="--0:#24292E;--1:#E1E4E8"> { createSlopcode } </span><span style="--0:#BF3441;--1:#F97583">from</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">"@slopcode-ai/sdk"</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> { </span><span style="--0:#005CC5;--1:#79B8FF">client</span><span style="--0:#24292E;--1:#E1E4E8"> } </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#6F42C1;--1:#B392F0">createSlopcode</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="import { createSlopcode } from &#x22;@slopcode-ai/sdk&#x22;const { client } = await createSlopcode()"><div></div></button></div></figure></div>\n<p>هذا يشغّل خادما وعميلا معا.</p>\n<h4 id="الخيارات"><a href="#الخيارات">الخيارات</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>الخيار</th><th>النوع</th><th>الوصف</th><th>الافتراضي</th></tr></thead><tbody><tr><td><code dir="auto">hostname</code></td><td><code dir="auto">string</code></td><td>اسم مضيف الخادم</td><td><code dir="auto">127.0.0.1</code></td></tr><tr><td><code dir="auto">port</code></td><td><code dir="auto">number</code></td><td>منفذ الخادم</td><td><code dir="auto">4096</code></td></tr><tr><td><code dir="auto">signal</code></td><td><code dir="auto">AbortSignal</code></td><td>إشارة إلغاء للإيقاف</td><td><code dir="auto">undefined</code></td></tr><tr><td><code dir="auto">timeout</code></td><td><code dir="auto">number</code></td><td>مهلة بدء الخادم بالمللي ثانية</td><td><code dir="auto">5000</code></td></tr><tr><td><code dir="auto">config</code></td><td><code dir="auto">Config</code></td><td>كائن الإعدادات</td><td><code dir="auto">{}</code></td></tr></tbody></table>\n<hr>\n<h2 id="الإعدادات"><a href="#الإعدادات">الإعدادات</a></h2>\n<p>يمكنك تمرير كائن إعدادات لتخصيص السلوك. سيستمر المثيل في التقاط <code dir="auto">slopcode.json</code> لديك، لكن يمكنك تجاوز الإعدادات أو إضافة إعدادات مباشرة:</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">import</span><span style="--0:#24292E;--1:#E1E4E8"> { createSlopcode } </span><span style="--0:#BF3441;--1:#F97583">from</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">"@slopcode-ai/sdk"</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#6F42C1;--1:#B392F0">createSlopcode</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">hostname: </span><span style="--0:#032F62;--1:#9ECBFF">"127.0.0.1"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">port: </span><span style="--0:#005CC5;--1:#79B8FF">4096</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">config: {</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">model: </span><span style="--0:#032F62;--1:#9ECBFF">"anthropic/claude-3-5-sonnet-20241022"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">},</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">console.</span><span style="--0:#6F42C1;--1:#B392F0">log</span><span style="--0:#24292E;--1:#E1E4E8">(</span><span style="--0:#032F62;--1:#9ECBFF">`Server running at ${</span><span style="--0:#24292E;--1:#E1E4E8">slopcode</span><span style="--0:#032F62;--1:#9ECBFF">.</span><span style="--0:#24292E;--1:#E1E4E8">server</span><span style="--0:#032F62;--1:#9ECBFF">.</span><span style="--0:#24292E;--1:#E1E4E8">url</span><span style="--0:#032F62;--1:#9ECBFF">}`</span><span style="--0:#24292E;--1:#E1E4E8">)</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">slopcode.server.</span><span style="--0:#6F42C1;--1:#B392F0">close</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="import { createSlopcode } from &#x22;@slopcode-ai/sdk&#x22;const slopcode = await createSlopcode({  hostname: &#x22;127.0.0.1&#x22;,  port: 4096,  config: {    model: &#x22;anthropic/claude-3-5-sonnet-20241022&#x22;,  },})console.log(&#x60;Server running at ${slopcode.server.url}&#x60;)slopcode.server.close()"><div></div></button></div></figure></div>\n<h2 id="العميل-فقط"><a href="#العميل-فقط">العميل فقط</a></h2>\n<p>إذا كان لديك مثيل slopcode يعمل بالفعل، يمكنك إنشاء مثيل عميل للاتصال به:</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">import</span><span style="--0:#24292E;--1:#E1E4E8"> { createSlopcodeClient } </span><span style="--0:#BF3441;--1:#F97583">from</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">"@slopcode-ai/sdk"</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">client</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#6F42C1;--1:#B392F0">createSlopcodeClient</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">baseUrl: </span><span style="--0:#032F62;--1:#9ECBFF">"http://localhost:4096"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="import { createSlopcodeClient } from &#x22;@slopcode-ai/sdk&#x22;const client = createSlopcodeClient({  baseUrl: &#x22;http://localhost:4096&#x22;,})"><div></div></button></div></figure></div>\n<h4 id="الخيارات-1"><a href="#الخيارات-1">الخيارات</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>الخيار</th><th>النوع</th><th>الوصف</th><th>الافتراضي</th></tr></thead><tbody><tr><td><code dir="auto">baseUrl</code></td><td><code dir="auto">string</code></td><td>عنوان URL للخادم</td><td><code dir="auto">http://localhost:4096</code></td></tr><tr><td><code dir="auto">fetch</code></td><td><code dir="auto">function</code></td><td>تنفيذ fetch مخصص</td><td><code dir="auto">globalThis.fetch</code></td></tr><tr><td><code dir="auto">parseAs</code></td><td><code dir="auto">string</code></td><td>طريقة تحليل الاستجابة</td><td><code dir="auto">auto</code></td></tr><tr><td><code dir="auto">responseStyle</code></td><td><code dir="auto">string</code></td><td>أسلوب الإرجاع: <code dir="auto">data</code> أو <code dir="auto">fields</code></td><td><code dir="auto">fields</code></td></tr><tr><td><code dir="auto">throwOnError</code></td><td><code dir="auto">boolean</code></td><td>رمي الأخطاء بدلا من إرجاعها</td><td><code dir="auto">false</code></td></tr></tbody></table>\n<hr>\n<h2 id="الأنواع"><a href="#الأنواع">الأنواع</a></h2>\n<p>تتضمن SDK تعريفات TypeScript لجميع أنواع API. استوردها مباشرة:</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="typescript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">import</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">type</span><span style="--0:#24292E;--1:#E1E4E8"> { Session, Message, Part } </span><span style="--0:#BF3441;--1:#F97583">from</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">"@slopcode-ai/sdk"</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="import type { Session, Message, Part } from &#x22;@slopcode-ai/sdk&#x22;"><div></div></button></div></figure></div>\n',
      }),
      createVNode(_components.p, {
        children: [
          "جميع الأنواع مولّدة من مواصفات OpenAPI الخاصة بالخادم ومتاحة في ",
          createVNode("a", {
            href: typesUrl,
            "set:html": "ملف الأنواع",
          }),
          ".",
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h2 id="الأخطاء"><a href="#الأخطاء">الأخطاء</a></h2>\n<p>يمكن أن ترمي SDK أخطاء يمكنك التقاطها ومعالجتها:</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="typescript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">try</span><span style="--0:#24292E;--1:#E1E4E8"> {</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.session.</span><span style="--0:#6F42C1;--1:#B392F0">get</span><span style="--0:#24292E;--1:#E1E4E8">({ path: { id: </span><span style="--0:#032F62;--1:#9ECBFF">"invalid-id"</span><span style="--0:#24292E;--1:#E1E4E8"> } })</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">} </span><span style="--0:#BF3441;--1:#F97583">catch</span><span style="--0:#24292E;--1:#E1E4E8"> (error) {</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">console.</span><span style="--0:#6F42C1;--1:#B392F0">error</span><span style="--0:#24292E;--1:#E1E4E8">(</span><span style="--0:#032F62;--1:#9ECBFF">"Failed to get session:"</span><span style="--0:#24292E;--1:#E1E4E8">, (error </span><span style="--0:#BF3441;--1:#F97583">as</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#6F42C1;--1:#B392F0">Error</span><span style="--0:#24292E;--1:#E1E4E8">).message)</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">}</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="try {  await client.session.get({ path: { id: &#x22;invalid-id&#x22; } })} catch (error) {  console.error(&#x22;Failed to get session:&#x22;, (error as Error).message)}"><div></div></button></div></figure></div>\n<hr>\n<h2 id="apis"><a href="#apis">APIs</a></h2>\n<p>توفر SDK جميع واجهات الخادم عبر عميل آمن للأنواع.</p>\n<hr>\n<h3 id="عام-global"><a href="#عام-global">عام (<code dir="auto">global</code>)</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>الطريقة</th><th>الوصف</th><th>الاستجابة</th></tr></thead><tbody><tr><td><code dir="auto">global.health()</code></td><td>التحقق من صحة الخادم وإصداره</td><td><code dir="auto">{ healthy: true, version: string }</code></td></tr></tbody></table>\n<hr>\n<h4 id="أمثلة"><a href="#أمثلة">أمثلة</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">health</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.global.</span><span style="--0:#6F42C1;--1:#B392F0">health</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">console.</span><span style="--0:#6F42C1;--1:#B392F0">log</span><span style="--0:#24292E;--1:#E1E4E8">(health.data.version)</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="const health = await client.global.health()console.log(health.data.version)"><div></div></button></div></figure></div>\n<hr>\n<h3 id="التطبيق-app"><a href="#التطبيق-app">التطبيق (<code dir="auto">app</code>)</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "الطريقة",
                }),
                createVNode(_components.th, {
                  children: "الوصف",
                }),
                createVNode(_components.th, {
                  children: "الاستجابة",
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
                    children: "كتابة إدخال في السجل",
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
                    children: "سرد جميع الوكلاء المتاحين",
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
          '<hr>\n<h4 id="أمثلة-1"><a href="#أمثلة-1">أمثلة</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Write a log entry</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.app.</span><span style="--0:#6F42C1;--1:#B392F0">log</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">body: {</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">service: </span><span style="--0:#032F62;--1:#9ECBFF">"my-app"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">level: </span><span style="--0:#032F62;--1:#9ECBFF">"info"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">message: </span><span style="--0:#032F62;--1:#9ECBFF">"Operation completed"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">},</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// List available agents</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">agents</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.app.</span><span style="--0:#6F42C1;--1:#B392F0">agents</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="// Write a log entryawait client.app.log({  body: {    service: &#x22;my-app&#x22;,    level: &#x22;info&#x22;,    message: &#x22;Operation completed&#x22;,  },})// List available agentsconst agents = await client.app.agents()"><div></div></button></div></figure></div>\n<hr>\n<h3 id="المشروع-project"><a href="#المشروع-project">المشروع (<code dir="auto">project</code>)</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "الطريقة",
                }),
                createVNode(_components.th, {
                  children: "الوصف",
                }),
                createVNode(_components.th, {
                  children: "الاستجابة",
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
                    children: "سرد جميع المشاريع",
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
                    children: "جلب المشروع الحالي",
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
          '<hr>\n<h4 id="أمثلة-2"><a href="#أمثلة-2">أمثلة</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// List all projects</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">projects</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.project.</span><span style="--0:#6F42C1;--1:#B392F0">list</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Get current project</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">currentProject</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.project.</span><span style="--0:#6F42C1;--1:#B392F0">current</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="// List all projectsconst projects = await client.project.list()// Get current projectconst currentProject = await client.project.current()"><div></div></button></div></figure></div>\n<hr>\n<h3 id="المسار-path"><a href="#المسار-path">المسار (<code dir="auto">path</code>)</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "الطريقة",
                }),
                createVNode(_components.th, {
                  children: "الوصف",
                }),
                createVNode(_components.th, {
                  children: "الاستجابة",
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
                  children: "جلب المسار الحالي",
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
          '<hr>\n<h4 id="أمثلة-3"><a href="#أمثلة-3">أمثلة</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Get current path information</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">pathInfo</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.path.</span><span style="--0:#6F42C1;--1:#B392F0">get</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="// Get current path informationconst pathInfo = await client.path.get()"><div></div></button></div></figure></div>\n<hr>\n<h3 id="الإعدادات-config"><a href="#الإعدادات-config">الإعدادات (<code dir="auto">config</code>)</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "الطريقة",
                }),
                createVNode(_components.th, {
                  children: "الوصف",
                }),
                createVNode(_components.th, {
                  children: "الاستجابة",
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
                    children: "جلب معلومات الإعدادات",
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
                    children: "سرد المزوّدين والنماذج الافتراضية",
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
          '<hr>\n<h4 id="أمثلة-4"><a href="#أمثلة-4">أمثلة</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">config</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.config.</span><span style="--0:#6F42C1;--1:#B392F0">get</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> { </span><span style="--0:#005CC5;--1:#79B8FF">providers</span><span style="--0:#24292E;--1:#E1E4E8">, </span><span style="--0:#AE4B07;--1:#FFAB70">default</span><span style="--0:#24292E;--1:#E1E4E8">: </span><span style="--0:#005CC5;--1:#79B8FF">defaults</span><span style="--0:#24292E;--1:#E1E4E8"> } </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.config.</span><span style="--0:#6F42C1;--1:#B392F0">providers</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="const config = await client.config.get()const { providers, default: defaults } = await client.config.providers()"><div></div></button></div></figure></div>\n<hr>\n<h3 id="الجلسات-session"><a href="#الجلسات-session">الجلسات (<code dir="auto">session</code>)</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "الطريقة",
                }),
                createVNode(_components.th, {
                  children: "الوصف",
                }),
                createVNode(_components.th, {
                  children: "ملاحظات",
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
                    children: "سرد الجلسات",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "يعيد ",
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
                    children: "جلب جلسة",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "يعيد ",
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
                    children: "سرد الجلسات الفرعية",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "يعيد ",
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
                    children: "إنشاء جلسة",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "يعيد ",
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
                  '<td><code dir="auto">session.delete({ path })</code></td><td>حذف جلسة</td><td>يعيد <code dir="auto">boolean</code></td>',
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
                    children: "تحديث خصائص الجلسة",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "يعيد ",
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
                  '<tr><td><code dir="auto">session.init({ path, body })</code></td><td>تحليل التطبيق وإنشاء <code dir="auto">AGENTS.md</code></td><td>يعيد <code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">session.abort({ path })</code></td><td>إيقاف جلسة قيد التشغيل</td><td>يعيد <code dir="auto">boolean</code></td></tr>',
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
                    children: "مشاركة جلسة",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "يعيد ",
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
                    children: "إلغاء مشاركة جلسة",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "يعيد ",
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
                  '<td><code dir="auto">session.summarize({ path, body })</code></td><td>تلخيص جلسة</td><td>يعيد <code dir="auto">boolean</code></td>',
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
                    children: "سرد الرسائل في جلسة",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "يعيد ",
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
                    children: "جلب تفاصيل الرسالة",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "يعيد ",
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
                    children: "إرسال رسالة مطالبة",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "body.noReply: true",
                      }),
                      " يعيد UserMessage (للسياق فقط). الافتراضي يعيد ",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>AssistantMessage</code>",
                      }),
                      " مع استجابة AI",
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
                    children: "إرسال أمر إلى الجلسة",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "يعيد ",
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
                    children: "تشغيل أمر shell",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "يعيد ",
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
                    children: "التراجع عن رسالة",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "يعيد ",
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
                    children: "استعادة الرسائل المتراجع عنها",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "يعيد ",
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
                  '<td><code dir="auto">postSessionByIdPermissionsByPermissionId({ path, body })</code></td><td>الاستجابة لطلب إذن</td><td>يعيد <code dir="auto">boolean</code></td>',
              }),
            ],
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h4 id="أمثلة-5"><a href="#أمثلة-5">أمثلة</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Create and manage sessions</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">session</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.session.</span><span style="--0:#6F42C1;--1:#B392F0">create</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">body: { title: </span><span style="--0:#032F62;--1:#9ECBFF">"My session"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">sessions</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.session.</span><span style="--0:#6F42C1;--1:#B392F0">list</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Send a prompt message</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">result</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.session.</span><span style="--0:#6F42C1;--1:#B392F0">prompt</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">path: { id: session.id },</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">body: {</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">model: { providerID: </span><span style="--0:#032F62;--1:#9ECBFF">"anthropic"</span><span style="--0:#24292E;--1:#E1E4E8">, modelID: </span><span style="--0:#032F62;--1:#9ECBFF">"claude-3-5-sonnet-20241022"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">parts: [{ type: </span><span style="--0:#032F62;--1:#9ECBFF">"text"</span><span style="--0:#24292E;--1:#E1E4E8">, text: </span><span style="--0:#032F62;--1:#9ECBFF">"Hello!"</span><span style="--0:#24292E;--1:#E1E4E8"> }],</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">},</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Inject context without triggering AI response (useful for plugins)</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.session.</span><span style="--0:#6F42C1;--1:#B392F0">prompt</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">path: { id: session.id },</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">body: {</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">noReply: </span><span style="--0:#005CC5;--1:#79B8FF">true</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">parts: [{ type: </span><span style="--0:#032F62;--1:#9ECBFF">"text"</span><span style="--0:#24292E;--1:#E1E4E8">, text: </span><span style="--0:#032F62;--1:#9ECBFF">"You are a helpful assistant."</span><span style="--0:#24292E;--1:#E1E4E8"> }],</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">},</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="// Create and manage sessionsconst session = await client.session.create({  body: { title: &#x22;My session&#x22; },})const sessions = await client.session.list()// Send a prompt messageconst result = await client.session.prompt({  path: { id: session.id },  body: {    model: { providerID: &#x22;anthropic&#x22;, modelID: &#x22;claude-3-5-sonnet-20241022&#x22; },    parts: [{ type: &#x22;text&#x22;, text: &#x22;Hello!&#x22; }],  },})// Inject context without triggering AI response (useful for plugins)await client.session.prompt({  path: { id: session.id },  body: {    noReply: true,    parts: [{ type: &#x22;text&#x22;, text: &#x22;You are a helpful assistant.&#x22; }],  },})"><div></div></button></div></figure></div>\n<hr>\n<h3 id="الملفات"><a href="#الملفات">الملفات</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "الطريقة",
                }),
                createVNode(_components.th, {
                  children: "الوصف",
                }),
                createVNode(_components.th, {
                  children: "الاستجابة",
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
                    children: "البحث عن نص داخل الملفات",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "مصفوفة من كائنات المطابقة مع ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "path",
                      }),
                      " و",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "lines",
                      }),
                      " و",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "line_number",
                      }),
                      " و",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "absolute_offset",
                      }),
                      " و",
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
                    children: "العثور على الملفات والمجلدات بالاسم",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "string[]",
                      }),
                      " (مسارات)",
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
                    children: "العثور على رموز مساحة العمل",
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
                  '<td><code dir="auto">file.read({ query })</code></td><td>قراءة ملف</td><td><code dir="auto">{ type: "raw" | "patch", content: string }</code></td>',
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
                    children: "جلب حالة الملفات المتتبَّعة",
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
          '<p>يدعم <code dir="auto">find.files</code> بعض حقول الاستعلام الاختيارية:</p>\n<ul>\n<li><code dir="auto">type</code>: <code dir="auto">"file"</code> أو <code dir="auto">"directory"</code></li>\n<li><code dir="auto">directory</code>: تجاوز جذر المشروع لعملية البحث</li>\n<li><code dir="auto">limit</code>: الحد الأقصى للنتائج (1–200)</li>\n</ul>\n<hr>\n<h4 id="أمثلة-6"><a href="#أمثلة-6">أمثلة</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Search and read files</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">textResults</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.find.</span><span style="--0:#6F42C1;--1:#B392F0">text</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">query: { pattern: </span><span style="--0:#032F62;--1:#9ECBFF">"function.*slopcode"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">files</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.find.</span><span style="--0:#6F42C1;--1:#B392F0">files</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">query: { query: </span><span style="--0:#032F62;--1:#9ECBFF">"*.ts"</span><span style="--0:#24292E;--1:#E1E4E8">, type: </span><span style="--0:#032F62;--1:#9ECBFF">"file"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">directories</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.find.</span><span style="--0:#6F42C1;--1:#B392F0">files</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">query: { query: </span><span style="--0:#032F62;--1:#9ECBFF">"packages"</span><span style="--0:#24292E;--1:#E1E4E8">, type: </span><span style="--0:#032F62;--1:#9ECBFF">"directory"</span><span style="--0:#24292E;--1:#E1E4E8">, limit: </span><span style="--0:#005CC5;--1:#79B8FF">20</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">content</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.file.</span><span style="--0:#6F42C1;--1:#B392F0">read</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">query: { path: </span><span style="--0:#032F62;--1:#9ECBFF">"src/index.ts"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="// Search and read filesconst textResults = await client.find.text({  query: { pattern: &#x22;function.*slopcode&#x22; },})const files = await client.find.files({  query: { query: &#x22;*.ts&#x22;, type: &#x22;file&#x22; },})const directories = await client.find.files({  query: { query: &#x22;packages&#x22;, type: &#x22;directory&#x22;, limit: 20 },})const content = await client.file.read({  query: { path: &#x22;src/index.ts&#x22; },})"><div></div></button></div></figure></div>\n<hr>\n<h3 id="واجهة-tui-tui"><a href="#واجهة-tui-tui">واجهة TUI (<code dir="auto">tui</code>)</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>الطريقة</th><th>الوصف</th><th>الاستجابة</th></tr></thead><tbody><tr><td><code dir="auto">tui.appendPrompt({ body })</code></td><td>إلحاق نص بالمطالبة</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.openHelp()</code></td><td>فتح مربع حوار المساعدة</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.openSessions()</code></td><td>فتح محدد الجلسات</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.openThemes()</code></td><td>فتح محدد السمات</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.openModels()</code></td><td>فتح محدد النماذج</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.submitPrompt()</code></td><td>إرسال المطالبة الحالية</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.clearPrompt()</code></td><td>مسح المطالبة</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.executeCommand({ body })</code></td><td>تنفيذ أمر</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.showToast({ body })</code></td><td>عرض إشعار toast</td><td><code dir="auto">boolean</code></td></tr></tbody></table>\n<hr>\n<h4 id="أمثلة-7"><a href="#أمثلة-7">أمثلة</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Control TUI interface</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.tui.</span><span style="--0:#6F42C1;--1:#B392F0">appendPrompt</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">body: { text: </span><span style="--0:#032F62;--1:#9ECBFF">"Add this to prompt"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.tui.</span><span style="--0:#6F42C1;--1:#B392F0">showToast</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">body: { message: </span><span style="--0:#032F62;--1:#9ECBFF">"Task completed"</span><span style="--0:#24292E;--1:#E1E4E8">, variant: </span><span style="--0:#032F62;--1:#9ECBFF">"success"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="// Control TUI interfaceawait client.tui.appendPrompt({  body: { text: &#x22;Add this to prompt&#x22; },})await client.tui.showToast({  body: { message: &#x22;Task completed&#x22;, variant: &#x22;success&#x22; },})"><div></div></button></div></figure></div>\n<hr>\n<h3 id="المصادقة-auth"><a href="#المصادقة-auth">المصادقة (<code dir="auto">auth</code>)</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>الطريقة</th><th>الوصف</th><th>الاستجابة</th></tr></thead><tbody><tr><td><code dir="auto">auth.set({ ... })</code></td><td>تعيين بيانات اعتماد المصادقة</td><td><code dir="auto">boolean</code></td></tr></tbody></table>\n<hr>\n<h4 id="أمثلة-8"><a href="#أمثلة-8">أمثلة</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.auth.</span><span style="--0:#6F42C1;--1:#B392F0">set</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">path: { id: </span><span style="--0:#032F62;--1:#9ECBFF">"anthropic"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">body: { type: </span><span style="--0:#032F62;--1:#9ECBFF">"api"</span><span style="--0:#24292E;--1:#E1E4E8">, key: </span><span style="--0:#032F62;--1:#9ECBFF">"your-api-key"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="await client.auth.set({  path: { id: &#x22;anthropic&#x22; },  body: { type: &#x22;api&#x22;, key: &#x22;your-api-key&#x22; },})"><div></div></button></div></figure></div>\n<hr>\n<h3 id="الأحداث-event"><a href="#الأحداث-event">الأحداث (<code dir="auto">event</code>)</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>الطريقة</th><th>الوصف</th><th>الاستجابة</th></tr></thead><tbody><tr><td><code dir="auto">event.subscribe()</code></td><td>تدفق أحداث مرسلة من الخادم</td><td>تدفق أحداث مرسلة من الخادم</td></tr></tbody></table>\n<hr>\n<h4 id="أمثلة-9"><a href="#أمثلة-9">أمثلة</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Listen to real-time events</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">events</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.event.</span><span style="--0:#6F42C1;--1:#B392F0">subscribe</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">for</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> (</span><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">event</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">of</span><span style="--0:#24292E;--1:#E1E4E8"> events.stream) {</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">console.</span><span style="--0:#6F42C1;--1:#B392F0">log</span><span style="--0:#24292E;--1:#E1E4E8">(</span><span style="--0:#032F62;--1:#9ECBFF">"Event:"</span><span style="--0:#24292E;--1:#E1E4E8">, event.type, event.properties)</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">}</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="// Listen to real-time eventsconst events = await client.event.subscribe()for await (const event of events.stream) {  console.log(&#x22;Event:&#x22;, event.type, event.properties)}"><div></div></button></div></figure></div>',
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

const url = "src/content/docs/ar/sdk.mdx"
const file = "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/sdk.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/sdk.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, typesUrl, url }
