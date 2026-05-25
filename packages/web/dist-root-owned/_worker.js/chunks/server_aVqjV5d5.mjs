globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"
import { c as config } from "./config_UI6PtV27.mjs"

const frontmatter = {
  title: "الخادم",
  description: "تفاعل مع خادم slopcode عبر HTTP.",
}
function getHeadings() {
  return [
    {
      depth: 3,
      slug: "الاستخدام",
      text: "الاستخدام",
    },
    {
      depth: 4,
      slug: "الخيارات",
      text: "الخيارات",
    },
    {
      depth: 3,
      slug: "المصادقة",
      text: "المصادقة",
    },
    {
      depth: 3,
      slug: "كيف-يعمل",
      text: "كيف يعمل",
    },
    {
      depth: 4,
      slug: "الاتصال-بخادم-موجود",
      text: "الاتصال بخادم موجود",
    },
    {
      depth: 2,
      slug: "المواصفات",
      text: "المواصفات",
    },
    {
      depth: 2,
      slug: "واجهات-api",
      text: "واجهات API",
    },
    {
      depth: 3,
      slug: "عام",
      text: "عام",
    },
    {
      depth: 3,
      slug: "المشروع",
      text: "المشروع",
    },
    {
      depth: 3,
      slug: "المسار-و-vcs",
      text: "المسار و VCS",
    },
    {
      depth: 3,
      slug: "المثيل",
      text: "المثيل",
    },
    {
      depth: 3,
      slug: "الإعدادات",
      text: "الإعدادات",
    },
    {
      depth: 3,
      slug: "المزوّد",
      text: "المزوّد",
    },
    {
      depth: 3,
      slug: "الجلسات",
      text: "الجلسات",
    },
    {
      depth: 3,
      slug: "الرسائل",
      text: "الرسائل",
    },
    {
      depth: 3,
      slug: "الأوامر",
      text: "الأوامر",
    },
    {
      depth: 3,
      slug: "الملفات",
      text: "الملفات",
    },
    {
      depth: 4,
      slug: "معلمات-الاستعلام-لـ-findfile",
      text: "معلمات الاستعلام لـ /find/file",
    },
    {
      depth: 3,
      slug: "الأدوات-تجريبية",
      text: "الأدوات (تجريبية)",
    },
    {
      depth: 3,
      slug: "lsp-والمنسّقات-و-mcp",
      text: "LSP والمنسّقات و MCP",
    },
    {
      depth: 3,
      slug: "الوكلاء",
      text: "الوكلاء",
    },
    {
      depth: 3,
      slug: "التسجيل",
      text: "التسجيل",
    },
    {
      depth: 3,
      slug: "tui",
      text: "TUI",
    },
    {
      depth: 3,
      slug: "المصادقة-1",
      text: "المصادقة",
    },
    {
      depth: 3,
      slug: "الأحداث",
      text: "الأحداث",
    },
    {
      depth: 3,
      slug: "التوثيق",
      text: "التوثيق",
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
          '<p>يشغّل الأمر <code dir="auto">slopcode serve</code> خادما HTTP دون واجهة ويعرض نقطة نهاية OpenAPI يمكن لعميل slopcode استخدامها.</p>\n<hr>\n<h3 id="الاستخدام"><a href="#الاستخدام">الاستخدام</a></h3>\n<div class="expressive-code"><link rel="stylesheet" href="/docs/_astro/ec.4c0k7.css"><script type="module" src="/docs/_astro/ec.0vx5m.js"></script><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">serve</span><span style="--0:#24292E;--1:#E1E4E8"> [--port </span><span style="--0:#032F62;--1:#9ECBFF">&#x3C;number>]</span><span style="--0:#24292E;--1:#E1E4E8"> [--hostname </span><span style="--0:#032F62;--1:#9ECBFF">&#x3C;string>]</span><span style="--0:#24292E;--1:#E1E4E8"> [--cors </span><span style="--0:#032F62;--1:#9ECBFF">&#x3C;origin>]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode serve [--port <number>] [--hostname <string>] [--cors <origin>]"><div></div></button></div></figure></div>\n<h4 id="الخيارات"><a href="#الخيارات">الخيارات</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>الخيار</th><th>الوصف</th><th>الافتراضي</th></tr></thead><tbody><tr><td><code dir="auto">--port</code></td><td>المنفذ الذي يستمع عليه</td><td><code dir="auto">4096</code></td></tr><tr><td><code dir="auto">--hostname</code></td><td>اسم المضيف الذي يستمع عليه</td><td><code dir="auto">127.0.0.1</code></td></tr><tr><td><code dir="auto">--mdns</code></td><td>تفعيل اكتشاف mDNS</td><td><code dir="auto">false</code></td></tr><tr><td><code dir="auto">--mdns-domain</code></td><td>اسم نطاق مخصص لخدمة mDNS</td><td><code dir="auto">slopcode.local</code></td></tr><tr><td><code dir="auto">--cors</code></td><td>أصول (Origins) متصفح إضافية مسموح بها</td><td><code dir="auto">[]</code></td></tr></tbody></table>\n<p>يمكن تمرير <code dir="auto">--cors</code> عدة مرات:</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">serve</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--cors</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">http://localhost:5173</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--cors</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">https://app.example.com</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode serve --cors http://localhost:5173 --cors https://app.example.com"><div></div></button></div></figure></div>\n<hr>\n<h3 id="المصادقة"><a href="#المصادقة">المصادقة</a></h3>\n<p>عيّن <code dir="auto">SLOPCODE_SERVER_PASSWORD</code> لحماية الخادم باستخدام مصادقة HTTP الأساسية. اسم المستخدم افتراضيا هو <code dir="auto">slopcode</code>، أو عيّن <code dir="auto">SLOPCODE_SERVER_USERNAME</code> لتغييره. ينطبق ذلك على كل من <code dir="auto">slopcode serve</code> و <code dir="auto">slopcode web</code>.</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">SLOPCODE_SERVER_PASSWORD</span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#032F62;--1:#9ECBFF">your-password</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">serve</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="SLOPCODE_SERVER_PASSWORD=your-password slopcode serve"><div></div></button></div></figure></div>\n<hr>\n<h3 id="كيف-يعمل"><a href="#كيف-يعمل">كيف يعمل</a></h3>\n<p>عند تشغيل <code dir="auto">slopcode</code> يبدأ تشغيل واجهة terminal تفاعلية (TUI) وخادما. تكون الـ TUI هي\nالعميل الذي يتحدث إلى الخادم. يوفّر الخادم نقطة نهاية لمواصفة OpenAPI 3.1.\nوتُستخدم هذه النقطة أيضا لتوليد <a href="/docs/sdk">SDK</a>.</p>\n<aside aria-label="Tip" class="starlight-aside starlight-aside--tip"><p class="starlight-aside__title" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="starlight-aside__icon"><path fill-rule="evenodd" clip-rule="evenodd" d="M1.43909 8.85483L1.44039 8.85354L4.96668 5.33815C5.30653 4.99386 5.7685 4.79662 6.2524 4.78972L6.26553 4.78963L12.9014 4.78962L13.8479 3.84308C16.9187 0.772319 20.0546 0.770617 21.4678 0.975145C21.8617 1.02914 22.2271 1.21053 22.5083 1.4917C22.7894 1.77284 22.9708 2.13821 23.0248 2.53199C23.2294 3.94517 23.2278 7.08119 20.1569 10.1521L19.2107 11.0983V17.7338L19.2106 17.7469C19.2037 18.2308 19.0067 18.6933 18.6624 19.0331L15.1456 22.5608C14.9095 22.7966 14.6137 22.964 14.29 23.0449C13.9663 23.1259 13.6267 23.1174 13.3074 23.0204C12.9881 22.9235 12.7011 22.7417 12.4771 22.4944C12.2533 22.2473 12.1006 21.9441 12.0355 21.6171L11.1783 17.3417L6.65869 12.822L4.34847 12.3589L2.38351 11.965C2.05664 11.8998 1.75272 11.747 1.50564 11.5232C1.25835 11.2992 1.07653 11.0122 0.979561 10.6929C0.882595 10.3736 0.874125 10.034 0.955057 9.7103C1.03599 9.38659 1.20328 9.09092 1.43909 8.85483ZM6.8186 10.8724L2.94619 10.096L6.32006 6.73268H10.9583L6.8186 10.8724ZM15.2219 5.21703C17.681 2.75787 20.0783 2.75376 21.1124 2.8876C21.2462 3.92172 21.2421 6.31895 18.783 8.77812L12.0728 15.4883L8.51172 11.9272L15.2219 5.21703ZM13.9042 21.0538L13.1279 17.1811L17.2676 13.0414V17.68L13.9042 21.0538Z"></path><path d="M9.31827 18.3446C9.45046 17.8529 9.17864 17.3369 8.68945 17.1724C8.56178 17.1294 8.43145 17.1145 8.30512 17.1243C8.10513 17.1398 7.91519 17.2172 7.76181 17.3434C7.62613 17.455 7.51905 17.6048 7.45893 17.7835C6.97634 19.2186 5.77062 19.9878 4.52406 20.4029C4.08525 20.549 3.6605 20.644 3.29471 20.7053C3.35607 20.3395 3.45098 19.9148 3.59711 19.476C4.01221 18.2294 4.78141 17.0237 6.21648 16.5411C6.39528 16.481 6.54504 16.3739 6.65665 16.2382C6.85126 16.0016 6.92988 15.678 6.84417 15.3647C6.83922 15.3466 6.83373 15.3286 6.82767 15.3106C6.74106 15.053 6.55701 14.8557 6.33037 14.7459C6.10949 14.6389 5.84816 14.615 5.59715 14.6994C5.47743 14.7397 5.36103 14.7831 5.24786 14.8294C3.22626 15.6569 2.2347 17.4173 1.75357 18.8621C1.49662 19.6337 1.36993 20.3554 1.30679 20.8818C1.27505 21.1464 1.25893 21.3654 1.25072 21.5213C1.24662 21.5993 1.24448 21.6618 1.24337 21.7066L1.243 21.7226L1.24235 21.7605L1.2422 21.7771L1.24217 21.7827L1.24217 21.7856C1.24217 22.3221 1.67703 22.7579 2.2137 22.7579L2.2155 22.7579L2.22337 22.7578L2.23956 22.7577C2.25293 22.7575 2.27096 22.7572 2.29338 22.7567C2.33821 22.7555 2.40073 22.7534 2.47876 22.7493C2.63466 22.7411 2.85361 22.725 3.11822 22.6932C3.64462 22.6301 4.36636 22.5034 5.13797 22.2464C6.58274 21.7653 8.3431 20.7738 9.17063 18.7522C9.21696 18.639 9.26037 18.5226 9.30064 18.4029C9.30716 18.3835 9.31304 18.364 9.31827 18.3446Z"></path></svg>Tip</p><div class="starlight-aside__content"><p>استخدم خادم slopcode للتفاعل مع slopcode برمجيا.</p></div></aside>\n<p>تتيح هذه البنية لـ slopcode دعم عدة عملاء وتمكّنك من التفاعل مع slopcode برمجيا.</p>\n<p>يمكنك تشغيل <code dir="auto">slopcode serve</code> لبدء خادم مستقل. إذا كانت واجهة slopcode في terminal (TUI)\nقيد التشغيل، فسيبدأ <code dir="auto">slopcode serve</code> خادما جديدا.</p>\n<hr>\n<h4 id="الاتصال-بخادم-موجود"><a href="#الاتصال-بخادم-موجود">الاتصال بخادم موجود</a></h4>\n<p>عند بدء الـ TUI تقوم بتعيين منفذ واسم مضيف عشوائيا. يمكنك بدلا من ذلك تمرير <a href="/docs/cli">الخيارات</a> <code dir="auto">--hostname</code> و <code dir="auto">--port</code>، ثم استخدامهما للاتصال بخادمها.</p>\n<p>يمكن استخدام نقطة النهاية <a href="#tui"><code dir="auto">/tui</code></a> للتحكم في الـ TUI عبر الخادم. على سبيل المثال، يمكنك تعبئة الموجّه مسبقا أو تشغيله. يُستخدم هذا الإعداد بواسطة ملحقات SlopCode لـ <a href="/docs/ide">IDE</a>.</p>\n<hr>\n<h2 id="المواصفات"><a href="#المواصفات">المواصفات</a></h2>\n<p>ينشر الخادم مواصفة OpenAPI 3.1 ويمكن عرضها على:</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="plaintext"><code><div class="ec-line"><div class="code"><span style="--0:#24292e;--1:#e1e4e8">http://&#x3C;hostname>:&#x3C;port>/doc</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="http://<hostname>:<port>/doc"><div></div></button></div></figure></div>\n<p>على سبيل المثال: <code dir="auto">http://localhost:4096/doc</code>. استخدم المواصفة لتوليد عملاء أو لفحص أنواع الطلبات والاستجابات. أو اعرضها في مستكشف Swagger.</p>\n<hr>\n<h2 id="واجهات-api"><a href="#واجهات-api">واجهات API</a></h2>\n<p>يعرض خادم slopcode واجهات API التالية.</p>\n<hr>\n<h3 id="عام"><a href="#عام">عام</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>الطريقة</th><th>المسار</th><th>الوصف</th><th>الاستجابة</th></tr></thead><tbody><tr><td><code dir="auto">GET</code></td><td><code dir="auto">/global/health</code></td><td>الحصول على صحة الخادم وإصداره</td><td><code dir="auto">{ healthy: true, version: string }</code></td></tr><tr><td><code dir="auto">GET</code></td><td><code dir="auto">/global/event</code></td><td>الحصول على الأحداث العامة (تدفق SSE)</td><td>تدفق أحداث</td></tr></tbody></table>\n<hr>\n<h3 id="المشروع"><a href="#المشروع">المشروع</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "المسار",
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
                    children: "الحصول على المشروع الحالي",
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
          '<hr>\n<h3 id="المسار-و-vcs"><a href="#المسار-و-vcs">المسار و VCS</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "المسار",
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
                    children: "الحصول على المسار الحالي",
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
                    children: "الحصول على معلومات VCS للمشروع الحالي",
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
          '<hr>\n<h3 id="المثيل"><a href="#المثيل">المثيل</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>الطريقة</th><th>المسار</th><th>الوصف</th><th>الاستجابة</th></tr></thead><tbody><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/instance/dispose</code></td><td>التخلص من المثيل الحالي</td><td><code dir="auto">boolean</code></td></tr></tbody></table>\n<hr>\n<h3 id="الإعدادات"><a href="#الإعدادات">الإعدادات</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "المسار",
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
                    children: "الحصول على معلومات الإعدادات",
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
                    children: "تحديث الإعدادات",
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
          '<hr>\n<h3 id="المزوّد"><a href="#المزوّد">المزوّد</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "المسار",
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
                    children: "سرد جميع المزوّدين",
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
                    children: "الحصول على طرق مصادقة المزوّد",
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
                    children: "تفويض مزوّد باستخدام OAuth",
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
                  '<td><code dir="auto">POST</code></td><td><code dir="auto">/provider/{id}/oauth/callback</code></td><td>معالجة رد نداء OAuth لمزوّد</td><td><code dir="auto">boolean</code></td>',
              }),
            ],
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h3 id="الجلسات"><a href="#الجلسات">الجلسات</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "المسار",
                }),
                createVNode(_components.th, {
                  children: "الوصف",
                }),
                createVNode(_components.th, {
                  children: "الملاحظات",
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
                    children: "سرد جميع الجلسات",
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
                    children: "إنشاء جلسة جديدة",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "المتن: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ parentID?, title? }",
                      }),
                      "، يعيد ",
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
                    children: "الحصول على حالة الجلسات جميعها",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "يعيد ",
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
                    children: "الحصول على تفاصيل الجلسة",
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
                  '<td><code dir="auto">DELETE</code></td><td><code dir="auto">/session/:id</code></td><td>حذف جلسة وجميع بياناتها</td><td>يعيد <code dir="auto">boolean</code></td>',
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
                    children: "تحديث خصائص الجلسة",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "المتن: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ title? }",
                      }),
                      "، يعيد ",
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
                    children: "الحصول على الجلسات الفرعية لجلسة",
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
                    children: "الحصول على قائمة المهام (todo) للجلسة",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "يعيد ",
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
                  '<td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/init</code></td><td>تحليل التطبيق وإنشاء <code dir="auto">AGENTS.md</code></td><td>المتن: <code dir="auto">{ messageID, providerID, modelID }</code>، يعيد <code dir="auto">boolean</code></td>',
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
                    children: "تفريع جلسة موجودة عند رسالة",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "المتن: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ messageID? }",
                      }),
                      "، يعيد ",
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
                  '<td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/abort</code></td><td>إلغاء جلسة قيد التشغيل</td><td>يعيد <code dir="auto">boolean</code></td>',
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
                    children: "الحصول على diff لهذه الجلسة",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "الاستعلام: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "messageID?",
                      }),
                      "، يعيد ",
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
                  '<tr><td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/summarize</code></td><td>تلخيص الجلسة</td><td>المتن: <code dir="auto">{ providerID, modelID }</code>، يعيد <code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/revert</code></td><td>التراجع عن رسالة</td><td>المتن: <code dir="auto">{ messageID, partID? }</code>، يعيد <code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/unrevert</code></td><td>استعادة جميع الرسائل المتراجع عنها</td><td>يعيد <code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/permissions/:permissionID</code></td><td>الرد على طلب إذن</td><td>المتن: <code dir="auto">{ response, remember? }</code>، يعيد <code dir="auto">boolean</code></td></tr>',
              }),
            ],
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h3 id="الرسائل"><a href="#الرسائل">الرسائل</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "المسار",
                }),
                createVNode(_components.th, {
                  children: "الوصف",
                }),
                createVNode(_components.th, {
                  children: "الملاحظات",
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
                    children: "سرد رسائل جلسة",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "الاستعلام: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "limit?",
                      }),
                      "، يعيد ",
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
                    children: "إرسال رسالة والانتظار للحصول على رد",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "المتن: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ messageID?, model?, agent?, noReply?, system?, tools?, parts }",
                      }),
                      "، يعيد ",
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
                    children: "الحصول على تفاصيل الرسالة",
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
                  '<td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/prompt_async</code></td><td>إرسال رسالة بشكل غير متزامن (بدون انتظار)</td><td>المتن: مثل <code dir="auto">/session/:id/message</code>، يعيد <code dir="auto">204 No Content</code></td>',
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
                    children: "تنفيذ أمر شرطة مائلة (slash)",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "المتن: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ messageID?, agent?, model?, command, arguments }",
                      }),
                      "، يعيد ",
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
                    children: "تشغيل أمر في shell",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "المتن: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ agent, model?, command }",
                      }),
                      "، يعيد ",
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
        "set:html": '<hr>\n<h3 id="الأوامر"><a href="#الأوامر">الأوامر</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "المسار",
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
                  children: "سرد جميع الأوامر",
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
          '<hr>\n<h3 id="الملفات"><a href="#الملفات">الملفات</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "المسار",
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
                    children: "البحث عن نص داخل الملفات",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "مصفوفة من كائنات المطابقة تحتوي على ",
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
                    children: "سرد الملفات والمجلدات",
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
                    children: "قراءة ملف",
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
                    children: "الحصول على حالة الملفات المتعقّبة",
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
          '<h4 id="معلمات-الاستعلام-لـ-findfile"><a href="#معلمات-الاستعلام-لـ-findfile">معلمات الاستعلام لـ <code dir="auto">/find/file</code></a></h4>\n<ul>\n<li><code dir="auto">query</code> (مطلوب) — سلسلة البحث (مطابقة ضبابية)</li>\n<li><code dir="auto">type</code> (اختياري) — حصر النتائج في <code dir="auto">"file"</code> أو <code dir="auto">"directory"</code></li>\n<li><code dir="auto">directory</code> (اختياري) — تجاوز جذر المشروع لأجل البحث</li>\n<li><code dir="auto">limit</code> (اختياري) — الحد الأقصى للنتائج (1–200)</li>\n<li><code dir="auto">dirs</code> (اختياري) — خيار قديم (إرجاع <code dir="auto">"false"</code> يعيد الملفات فقط)</li>\n</ul>\n<hr>\n<h3 id="الأدوات-تجريبية"><a href="#الأدوات-تجريبية">الأدوات (تجريبية)</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "المسار",
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
                    children: "سرد جميع معرّفات الأدوات",
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
                    children: "سرد الأدوات مع مخططات JSON لنموذج",
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
          '<hr>\n<h3 id="lsp-والمنسّقات-و-mcp"><a href="#lsp-والمنسّقات-و-mcp">LSP والمنسّقات و MCP</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "المسار",
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
                    children: "الحصول على حالة خادم LSP",
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
                    children: "الحصول على حالة المنسّقات",
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
                    children: "الحصول على حالة خادم MCP",
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
                  '<td><code dir="auto">POST</code></td><td><code dir="auto">/mcp</code></td><td>إضافة خادم MCP ديناميكيا</td><td>المتن: <code dir="auto">{ name, config }</code>، يعيد كائن حالة MCP</td>',
              }),
            ],
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html": '<hr>\n<h3 id="الوكلاء"><a href="#الوكلاء">الوكلاء</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "المسار",
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
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h3 id="التسجيل"><a href="#التسجيل">التسجيل</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>الطريقة</th><th>المسار</th><th>الوصف</th><th>الاستجابة</th></tr></thead><tbody><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/log</code></td><td>كتابة إدخال سجل. المتن: <code dir="auto">{ service, level, message, extra? }</code></td><td><code dir="auto">boolean</code></td></tr></tbody></table>\n<hr>\n<h3 id="tui"><a href="#tui">TUI</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>الطريقة</th><th>المسار</th><th>الوصف</th><th>الاستجابة</th></tr></thead><tbody><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/append-prompt</code></td><td>إلحاق نص بالموجّه</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/open-help</code></td><td>فتح مربع حوار المساعدة</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/open-sessions</code></td><td>فتح محدد الجلسات</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/open-themes</code></td><td>فتح محدد السمات</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/open-models</code></td><td>فتح محدد النماذج</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/submit-prompt</code></td><td>إرسال الموجّه الحالي</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/clear-prompt</code></td><td>مسح الموجّه</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/execute-command</code></td><td>تنفيذ أمر (<code dir="auto">{ command }</code>)</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/show-toast</code></td><td>عرض toast (<code dir="auto">{ title?, message, variant }</code>)</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">GET</code></td><td><code dir="auto">/tui/control/next</code></td><td>الانتظار لطلب التحكم التالي</td><td>كائن طلب تحكم</td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/control/response</code></td><td>الاستجابة لطلب تحكم (<code dir="auto">{ body }</code>)</td><td><code dir="auto">boolean</code></td></tr></tbody></table>\n<hr>\n<h3 id="المصادقة-1"><a href="#المصادقة-1">المصادقة</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>الطريقة</th><th>المسار</th><th>الوصف</th><th>الاستجابة</th></tr></thead><tbody><tr><td><code dir="auto">PUT</code></td><td><code dir="auto">/auth/:id</code></td><td>تعيين بيانات اعتماد المصادقة. يجب أن يطابق المتن مخطط المزوّد</td><td><code dir="auto">boolean</code></td></tr></tbody></table>\n<hr>\n<h3 id="الأحداث"><a href="#الأحداث">الأحداث</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>الطريقة</th><th>المسار</th><th>الوصف</th><th>الاستجابة</th></tr></thead><tbody><tr><td><code dir="auto">GET</code></td><td><code dir="auto">/event</code></td><td>تدفق أحداث مرسلة من الخادم (SSE). أول حدث هو <code dir="auto">server.connected</code> ثم أحداث الحافلة</td><td>تدفق أحداث مرسلة من الخادم</td></tr></tbody></table>\n<hr>\n<h3 id="التوثيق"><a href="#التوثيق">التوثيق</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>الطريقة</th><th>المسار</th><th>الوصف</th><th>الاستجابة</th></tr></thead><tbody><tr><td><code dir="auto">GET</code></td><td><code dir="auto">/doc</code></td><td>مواصفة OpenAPI 3.1</td><td>صفحة HTML تتضمن مواصفة OpenAPI</td></tr></tbody></table>',
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

const url = "src/content/docs/ar/server.mdx"
const file = "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/server.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/server.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, typesUrl, url }
