globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"

const frontmatter = {
  title: "استكشاف الأخطاء وإصلاحها",
  description: "المشكلات الشائعة وكيفية حلها.",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "السجلات",
      text: "السجلات",
    },
    {
      depth: 2,
      slug: "التخزين",
      text: "التخزين",
    },
    {
      depth: 2,
      slug: "تطبيق-سطح-المكتب",
      text: "تطبيق سطح المكتب",
    },
    {
      depth: 3,
      slug: "فحوصات-سريعة",
      text: "فحوصات سريعة",
    },
    {
      depth: 3,
      slug: "تعطيل-الإضافات",
      text: "تعطيل الإضافات",
    },
    {
      depth: 4,
      slug: "تحقق-من-الإعدادات-العامة",
      text: "تحقق من الإعدادات العامة",
    },
    {
      depth: 4,
      slug: "تحقق-من-أدلة-الإضافات",
      text: "تحقق من أدلة الإضافات",
    },
    {
      depth: 3,
      slug: "مسح-ذاكرة-التخزين-المؤقت",
      text: "مسح ذاكرة التخزين المؤقت",
    },
    {
      depth: 3,
      slug: "إصلاح-مشكلات-اتصال-الخادم",
      text: "إصلاح مشكلات اتصال الخادم",
    },
    {
      depth: 4,
      slug: "مسح-عنوان-url-الافتراضي-لخادم-سطح-المكتب",
      text: "مسح عنوان URL الافتراضي لخادم سطح المكتب",
    },
    {
      depth: 4,
      slug: "إزالة-serverport--serverhostname-من-الإعدادات",
      text: "إزالة server.port / server.hostname من الإعدادات",
    },
    {
      depth: 4,
      slug: "تحقق-من-متغيرات-البيئة",
      text: "تحقق من متغيرات البيئة",
    },
    {
      depth: 3,
      slug: "linux-مشكلات-wayland--x11",
      text: "Linux: مشكلات Wayland / X11",
    },
    {
      depth: 3,
      slug: "windows-بيئة-تشغيل-webview2",
      text: "Windows: بيئة تشغيل WebView2",
    },
    {
      depth: 3,
      slug: "windows-مشكلات-الأداء-العامة",
      text: "Windows: مشكلات الأداء العامة",
    },
    {
      depth: 3,
      slug: "الإشعارات-لا-تظهر",
      text: "الإشعارات لا تظهر",
    },
    {
      depth: 3,
      slug: "إعادة-تعيين-تخزين-تطبيق-سطح-المكتب-كحل-أخير",
      text: "إعادة تعيين تخزين تطبيق سطح المكتب (كحل أخير)",
    },
    {
      depth: 2,
      slug: "الحصول-على-المساعدة",
      text: "الحصول على المساعدة",
    },
    {
      depth: 2,
      slug: "مشكلات-شائعة",
      text: "مشكلات شائعة",
    },
    {
      depth: 3,
      slug: "slopcode-لا-يبدأ",
      text: "SlopCode لا يبدأ",
    },
    {
      depth: 3,
      slug: "مشكلات-المصادقة",
      text: "مشكلات المصادقة",
    },
    {
      depth: 3,
      slug: "النموذج-غير-متاح",
      text: "النموذج غير متاح",
    },
    {
      depth: 3,
      slug: "provideriniterror",
      text: "ProviderInitError",
    },
    {
      depth: 3,
      slug: "ai_apicallerror-ومشكلات-حزم-المزوّد",
      text: "AI_APICallError ومشكلات حزم المزوّد",
    },
    {
      depth: 3,
      slug: "النسخاللصق-لا-يعمل-على-linux",
      text: "النسخ/اللصق لا يعمل على Linux",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>لاستكشاف المشكلات في SlopCode وإصلاحها، ابدأ بالتحقق من السجلات والبيانات المحلية التي يخزنها على القرص.</p>\n<hr>\n<h2 id="السجلات"><a href="#السجلات">السجلات</a></h2>\n<p>يتم حفظ ملفات السجل في:</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.local/share/slopcode/log/</code></li>\n<li><strong>Windows</strong>: اضغط <code dir="auto">WIN+R</code> والصق <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode\\log</code></li>\n</ul>\n<p>تتم تسمية ملفات السجل بطوابع زمنية (مثل <code dir="auto">2025-01-09T123456.log</code>) ويتم الاحتفاظ بأحدث 10 ملفات سجل.</p>\n<p>يمكنك ضبط مستوى السجل باستخدام خيار CLI <code dir="auto">--log-level</code> للحصول على معلومات تصحيح أكثر تفصيلا. على سبيل المثال: <code dir="auto">slopcode --log-level DEBUG</code>.</p>\n<hr>\n<h2 id="التخزين"><a href="#التخزين">التخزين</a></h2>\n<p>يخزن slopcode بيانات الجلسات وبيانات التطبيق الأخرى على القرص في:</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.local/share/slopcode/</code></li>\n<li><strong>Windows</strong>: اضغط <code dir="auto">WIN+R</code> والصق <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode</code></li>\n</ul>\n<p>يحتوي هذا الدليل على:</p>\n<ul>\n<li><code dir="auto">auth.json</code> - بيانات المصادقة مثل مفاتيح API ورموز OAuth</li>\n<li><code dir="auto">log/</code> - سجلات التطبيق</li>\n<li><code dir="auto">project/</code> - بيانات خاصة بالمشروع مثل بيانات الجلسة والرسائل\n<ul>\n<li>إذا كان المشروع داخل مستودع Git، فسيتم تخزينه في <code dir="auto">./&#x3C;project-slug>/storage/</code></li>\n<li>إذا لم يكن داخل مستودع Git، فسيتم تخزينه في <code dir="auto">./global/storage/</code></li>\n</ul>\n</li>\n</ul>\n<hr>\n<h2 id="تطبيق-سطح-المكتب"><a href="#تطبيق-سطح-المكتب">تطبيق سطح المكتب</a></h2>\n<p>يشغل SlopCode Desktop خادما محليا لـ SlopCode (العملية الجانبية <code dir="auto">slopcode-cli</code>) في الخلفية. معظم المشكلات سببها إضافة لا تعمل بشكل صحيح، أو ذاكرة تخزين مؤقت تالفة، أو إعداد خادم غير صحيح.</p>\n<h3 id="فحوصات-سريعة"><a href="#فحوصات-سريعة">فحوصات سريعة</a></h3>\n<ul>\n<li>أغلق التطبيق تماما ثم أعد تشغيله.</li>\n<li>إذا عرض التطبيق شاشة خطأ، انقر <strong>Restart</strong> وانسخ تفاصيل الخطأ.</li>\n<li>على macOS فقط: قائمة <code dir="auto">SlopCode</code> -> <strong>Reload Webview</strong> (يفيد إذا كانت الواجهة فارغة/متجمدة).</li>\n</ul>\n<hr>\n<h3 id="تعطيل-الإضافات"><a href="#تعطيل-الإضافات">تعطيل الإضافات</a></h3>\n<p>إذا كان تطبيق سطح المكتب يتعطل عند التشغيل، أو يتوقف عن الاستجابة، أو يتصرف بشكل غريب، فابدأ بتعطيل الإضافات.</p>\n<h4 id="تحقق-من-الإعدادات-العامة"><a href="#تحقق-من-الإعدادات-العامة">تحقق من الإعدادات العامة</a></h4>\n<p>افتح ملف الإعدادات العام وابحث عن المفتاح <code dir="auto">plugin</code>.</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.config/slopcode/slopcode.jsonc</code> (أو <code dir="auto">~/.config/slopcode/slopcode.json</code>)</li>\n<li><strong>macOS/Linux</strong> (عمليات تثبيت أقدم): <code dir="auto">~/.local/share/slopcode/slopcode.jsonc</code></li>\n<li><strong>Windows</strong>: اضغط <code dir="auto">WIN+R</code> والصق <code dir="auto">%USERPROFILE%\\.config\\slopcode\\slopcode.jsonc</code></li>\n</ul>\n<p>إذا كانت لديك إضافات مضبوطة، فقم بتعطيلها مؤقتا بإزالة المفتاح أو ضبطه على مصفوفة فارغة:</p>\n<div class="expressive-code"><link rel="stylesheet" href="/docs/_astro/ec.4c0k7.css"><script type="module" src="/docs/_astro/ec.0vx5m.js"></script><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="jsonc"><code><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">{</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"$schema"</span><span style="--0:#24292E;--1:#E1E4E8">: </span><span style="--0:#032F62;--1:#9ECBFF">"https://slopcode.dev/config.json"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"plugin"</span><span style="--0:#24292E;--1:#E1E4E8">: [],</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">}</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="{  &#x22;$schema&#x22;: &#x22;https://slopcode.dev/config.json&#x22;,  &#x22;plugin&#x22;: [],}"><div></div></button></div></figure></div>\n<h4 id="تحقق-من-أدلة-الإضافات"><a href="#تحقق-من-أدلة-الإضافات">تحقق من أدلة الإضافات</a></h4>\n<p>يمكن لـ SlopCode أيضا تحميل إضافات محلية من القرص. انقلها مؤقتا إلى مكان آخر (أو أعد تسمية المجلد) ثم أعد تشغيل تطبيق سطح المكتب:</p>\n<ul>\n<li><strong>إضافات عامة</strong>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.config/slopcode/plugins/</code></li>\n<li><strong>Windows</strong>: اضغط <code dir="auto">WIN+R</code> والصق <code dir="auto">%USERPROFILE%\\.config\\slopcode\\plugins</code></li>\n</ul>\n</li>\n<li><strong>إضافات المشروع</strong> (فقط إذا كنت تستخدم إعدادات لكل مشروع)\n<ul>\n<li><code dir="auto">&#x3C;your-project>/.slopcode/plugins/</code></li>\n</ul>\n</li>\n</ul>\n<p>إذا عاد التطبيق للعمل، فأعد تفعيل الإضافات واحدة تلو الأخرى لمعرفة أيها يسبب المشكلة.</p>\n<hr>\n<h3 id="مسح-ذاكرة-التخزين-المؤقت"><a href="#مسح-ذاكرة-التخزين-المؤقت">مسح ذاكرة التخزين المؤقت</a></h3>\n<p>إذا لم يساعد تعطيل الإضافات (أو كانت عملية تثبيت إضافة عالقة)، فامسح ذاكرة التخزين المؤقت حتى يتمكن SlopCode من إعادة بنائها.</p>\n<ol>\n<li>أغلق SlopCode Desktop تماما.</li>\n<li>احذف دليل ذاكرة التخزين المؤقت:</li>\n</ol>\n<ul>\n<li><strong>macOS</strong>: Finder -> <code dir="auto">Cmd+Shift+G</code> -> الصق <code dir="auto">~/.cache/slopcode</code></li>\n<li><strong>Linux</strong>: احذف <code dir="auto">~/.cache/slopcode</code> (أو شغّل <code dir="auto">rm -rf ~/.cache/slopcode</code>)</li>\n<li><strong>Windows</strong>: اضغط <code dir="auto">WIN+R</code> والصق <code dir="auto">%USERPROFILE%\\.cache\\slopcode</code></li>\n</ul>\n<ol start="3">\n<li>أعد تشغيل SlopCode Desktop.</li>\n</ol>\n<hr>\n<h3 id="إصلاح-مشكلات-اتصال-الخادم"><a href="#إصلاح-مشكلات-اتصال-الخادم">إصلاح مشكلات اتصال الخادم</a></h3>\n<p>يمكن لـ SlopCode Desktop إما تشغيل خادمه المحلي (افتراضيا) أو الاتصال بعنوان URL لخادم قمت بتهيئته.</p>\n<p>إذا ظهرت نافذة <strong>“Connection Failed”</strong> (أو لم يتجاوز التطبيق شاشة البداية)، فتحقق مما إذا كان هناك عنوان URL مخصص للخادم.</p>\n<h4 id="مسح-عنوان-url-الافتراضي-لخادم-سطح-المكتب"><a href="#مسح-عنوان-url-الافتراضي-لخادم-سطح-المكتب">مسح عنوان URL الافتراضي لخادم سطح المكتب</a></h4>\n<p>من شاشة Home، انقر اسم الخادم (مع نقطة الحالة) لفتح محدد الخوادم. في قسم <strong>Default server</strong>، انقر <strong>Clear</strong>.</p>\n<h4 id="إزالة-serverport--serverhostname-من-الإعدادات"><a href="#إزالة-serverport--serverhostname-من-الإعدادات">إزالة <code dir="auto">server.port</code> / <code dir="auto">server.hostname</code> من الإعدادات</a></h4>\n<p>إذا كان <code dir="auto">slopcode.json(c)</code> يحتوي على قسم <code dir="auto">server</code>، فأزله مؤقتا ثم أعد تشغيل تطبيق سطح المكتب.</p>\n<h4 id="تحقق-من-متغيرات-البيئة"><a href="#تحقق-من-متغيرات-البيئة">تحقق من متغيرات البيئة</a></h4>\n<p>إذا كان <code dir="auto">SLOPCODE_PORT</code> مضبوطا في بيئتك، فسيحاول تطبيق سطح المكتب استخدام ذلك المنفذ للخادم المحلي.</p>\n<ul>\n<li>أزل ضبط <code dir="auto">SLOPCODE_PORT</code> (أو اختر منفذا متاحا) ثم أعد التشغيل.</li>\n</ul>\n<hr>\n<h3 id="linux-مشكلات-wayland--x11"><a href="#linux-مشكلات-wayland--x11">Linux: مشكلات Wayland / X11</a></h3>\n<p>على Linux، قد تتسبب بعض إعدادات Wayland في نوافذ فارغة أو أخطاء في مدير التركيب (compositor).</p>\n<ul>\n<li>إذا كنت تستخدم Wayland وكانت نافذة التطبيق فارغة/يتعطل، فجرّب التشغيل مع <code dir="auto">OC_ALLOW_WAYLAND=1</code>.</li>\n<li>إذا جعل ذلك الأمور أسوأ، فأزل هذا المتغير وجرّب التشغيل ضمن جلسة X11 بدلا من ذلك.</li>\n</ul>\n<hr>\n<h3 id="windows-بيئة-تشغيل-webview2"><a href="#windows-بيئة-تشغيل-webview2">Windows: بيئة تشغيل WebView2</a></h3>\n<p>على Windows، يتطلب SlopCode Desktop وجود <strong>WebView2 Runtime</strong> الخاصة بـ Microsoft Edge. إذا فتح التطبيق نافذة فارغة أو لم يبدأ، فقم بتثبيت/تحديث WebView2 ثم جرّب مجددا.</p>\n<hr>\n<h3 id="windows-مشكلات-الأداء-العامة"><a href="#windows-مشكلات-الأداء-العامة">Windows: مشكلات الأداء العامة</a></h3>\n<p>إذا كنت تواجه بطءا في الأداء، أو مشكلات في الوصول إلى الملفات، أو مشكلات في terminal على Windows، فجرّب استخدام <a href="/docs/windows-wsl">WSL (نظام Windows الفرعي لـ Linux)</a>. يوفر WSL بيئة Linux تعمل بسلاسة أكبر مع ميزات SlopCode.</p>\n<hr>\n<h3 id="الإشعارات-لا-تظهر"><a href="#الإشعارات-لا-تظهر">الإشعارات لا تظهر</a></h3>\n<p>لا يعرض SlopCode Desktop إشعارات النظام إلا عندما:</p>\n<ul>\n<li>تكون الإشعارات مفعلة لـ SlopCode في إعدادات نظام التشغيل، و</li>\n<li>تكون نافذة التطبيق غير نشطة.</li>\n</ul>\n<hr>\n<h3 id="إعادة-تعيين-تخزين-تطبيق-سطح-المكتب-كحل-أخير"><a href="#إعادة-تعيين-تخزين-تطبيق-سطح-المكتب-كحل-أخير">إعادة تعيين تخزين تطبيق سطح المكتب (كحل أخير)</a></h3>\n<p>إذا لم يبدأ التطبيق ولم تتمكن من مسح الإعدادات من داخل الواجهة، فأعد تعيين الحالة المحفوظة لتطبيق سطح المكتب.</p>\n<ol>\n<li>أغلق SlopCode Desktop.</li>\n<li>اعثر على هذه الملفات واحذفها (توجد في دليل بيانات تطبيق SlopCode Desktop):</li>\n</ol>\n<ul>\n<li><code dir="auto">slopcode.settings.dat</code> (عنوان URL الافتراضي لخادم سطح المكتب)</li>\n<li><code dir="auto">slopcode.global.dat</code> و <code dir="auto">slopcode.workspace.*.dat</code> (حالة الواجهة مثل الخوادم/المشاريع الأخيرة)</li>\n</ul>\n<p>للعثور على الدليل بسرعة:</p>\n<ul>\n<li><strong>macOS</strong>: Finder -> <code dir="auto">Cmd+Shift+G</code> -> <code dir="auto">~/Library/Application Support</code> (ثم ابحث عن أسماء الملفات أعلاه)</li>\n<li><strong>Linux</strong>: ابحث ضمن <code dir="auto">~/.local/share</code> عن أسماء الملفات أعلاه</li>\n<li><strong>Windows</strong>: اضغط <code dir="auto">WIN+R</code> -> <code dir="auto">%APPDATA%</code> (ثم ابحث عن أسماء الملفات أعلاه)</li>\n</ul>\n<hr>\n<h2 id="الحصول-على-المساعدة"><a href="#الحصول-على-المساعدة">الحصول على المساعدة</a></h2>\n<p>إذا كنت تواجه مشكلات مع SlopCode:</p>\n<ol>\n<li>\n<p><strong>الإبلاغ عن المشكلات على GitHub</strong></p>\n<p>أفضل طريقة للإبلاغ عن الأخطاء أو طلب الميزات هي عبر مستودعنا على GitHub:</p>\n<p><a href="http://github.com/teamslop/slopcode/issues"><strong>github.com/teamslop/slopcode/issues</strong></a></p>\n<p>قبل إنشاء مشكلة جديدة، ابحث في المشكلات الموجودة لمعرفة ما إذا كانت مشكلتك قد تم الإبلاغ عنها بالفعل.</p>\n</li>\n<li>\n<p><strong>انضم إلى Discord</strong></p>\n<p>للحصول على مساعدة فورية ونقاشات المجتمع، انضم إلى خادم Discord الخاص بنا:</p>\n<p><a href="https://slopcode.dev/discord"><strong>slopcode.dev/discord</strong></a></p>\n</li>\n</ol>\n<hr>\n<h2 id="مشكلات-شائعة"><a href="#مشكلات-شائعة">مشكلات شائعة</a></h2>\n<p>فيما يلي بعض المشكلات الشائعة وكيفية حلها.</p>\n<hr>\n<h3 id="slopcode-لا-يبدأ"><a href="#slopcode-لا-يبدأ">SlopCode لا يبدأ</a></h3>\n<ol>\n<li>تحقق من السجلات بحثا عن رسائل الخطأ</li>\n<li>جرّب التشغيل مع <code dir="auto">--print-logs</code> لرؤية المخرجات في terminal</li>\n<li>تأكد من أنك تستخدم أحدث إصدار عبر <code dir="auto">slopcode upgrade</code></li>\n</ol>\n<hr>\n<h3 id="مشكلات-المصادقة"><a href="#مشكلات-المصادقة">مشكلات المصادقة</a></h3>\n<ol>\n<li>جرّب إعادة المصادقة باستخدام الأمر <code dir="auto">/connect</code> في واجهة TUI</li>\n<li>تحقق من أن مفاتيح API الخاصة بك صالحة</li>\n<li>تأكد من أن شبكتك تسمح بالاتصال بواجهة API الخاصة بالمزوّد</li>\n</ol>\n<hr>\n<h3 id="النموذج-غير-متاح"><a href="#النموذج-غير-متاح">النموذج غير متاح</a></h3>\n<ol>\n<li>تحقق من أنك قمت بالمصادقة مع المزوّد</li>\n<li>تأكد من أن اسم النموذج في الإعدادات صحيح</li>\n<li>قد تتطلب بعض النماذج صلاحيات وصول محددة أو اشتراكات</li>\n</ol>\n<p>إذا واجهت <code dir="auto">ProviderModelNotFoundError</code> فمن المرجح أنك تشير إلى نموذج بشكل غير صحيح في مكان ما.\nيجب الإشارة إلى النماذج بهذه الصيغة: <code dir="auto">&#x3C;providerId>/&#x3C;modelId></code></p>\n<p>أمثلة:</p>\n<ul>\n<li><code dir="auto">openai/gpt-4.1</code></li>\n<li><code dir="auto">openrouter/google/gemini-2.5-flash</code></li>\n<li><code dir="auto">slopcode/kimi-k2</code></li>\n</ul>\n<p>لمعرفة النماذج التي لديك صلاحية الوصول إليها، شغّل <code dir="auto">slopcode models</code></p>\n<hr>\n<h3 id="provideriniterror"><a href="#provideriniterror">ProviderInitError</a></h3>\n<p>إذا واجهت ProviderInitError، فمن المحتمل أن إعداداتك غير صالحة أو تالفة.</p>\n<p>لحل ذلك:</p>\n<ol>\n<li>\n<p>أولا، تحقق من أن المزوّد مضبوط بشكل صحيح باتباع <a href="/docs/providers">دليل المزوّدين</a></p>\n</li>\n<li>\n<p>إذا استمرت المشكلة، فجرّب مسح الإعدادات المخزنة لديك:</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">rm</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-rf</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">~/.local/share/slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="rm -rf ~/.local/share/slopcode"><div></div></button></div></figure></div>\n<p>على Windows، اضغط <code dir="auto">WIN+R</code> واحذف: <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode</code></p>\n</li>\n<li>\n<p>أعد المصادقة مع المزوّد باستخدام الأمر <code dir="auto">/connect</code> في واجهة TUI.</p>\n</li>\n</ol>\n<hr>\n<h3 id="ai_apicallerror-ومشكلات-حزم-المزوّد"><a href="#ai_apicallerror-ومشكلات-حزم-المزوّد">AI_APICallError ومشكلات حزم المزوّد</a></h3>\n<p>إذا واجهت أخطاء في استدعاءات API، فقد يكون السبب حزم مزوّد قديمة. يقوم slopcode بتثبيت حزم المزوّد (OpenAI و Anthropic و Google وغير ذلك) ديناميكيا عند الحاجة ويقوم بتخزينها مؤقتا محليا.</p>\n<p>لحل مشكلات حزم المزوّد:</p>\n<ol>\n<li>\n<p>امسح ذاكرة التخزين المؤقت لحزم المزوّد:</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">rm</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-rf</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">~/.cache/slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="rm -rf ~/.cache/slopcode"><div></div></button></div></figure></div>\n<p>على Windows، اضغط <code dir="auto">WIN+R</code> واحذف: <code dir="auto">%USERPROFILE%\\.cache\\slopcode</code></p>\n</li>\n<li>\n<p>أعد تشغيل slopcode لإعادة تثبيت أحدث حزم المزوّد</p>\n</li>\n</ol>\n<p>سيجبر ذلك slopcode على تنزيل أحدث إصدارات حزم المزوّد، وهو ما يحل غالبا مشكلات التوافق مع معاملات النماذج وتغييرات API.</p>\n<hr>\n<h3 id="النسخاللصق-لا-يعمل-على-linux"><a href="#النسخاللصق-لا-يعمل-على-linux">النسخ/اللصق لا يعمل على Linux</a></h3>\n<p>يحتاج مستخدمو Linux إلى تثبيت إحدى أدوات الحافظة التالية حتى تعمل ميزة النسخ/اللصق:</p>\n<p><strong>لأنظمة X11:</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xclip</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># or</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xsel</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y xclipapt install -y xsel"><div></div></button></div></figure></div>\n<p><strong>لأنظمة Wayland:</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">wl-clipboard</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y wl-clipboard"><div></div></button></div></figure></div>\n<p><strong>للبيئات بدون واجهة رسومية (Headless):</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xvfb</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># and run:</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">Xvfb</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">:99</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-screen</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">0</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">1024x768x24</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">></span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">/dev/null</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">2>&#x26;1</span><span style="--0:#24292E;--1:#E1E4E8"> &#x26;</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">export</span><span style="--0:#24292E;--1:#E1E4E8"> DISPLAY</span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8">:99.0</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y xvfbXvfb :99 -screen 0 1024x768x24 > /dev/null 2>&#x26;1 &#x26;export DISPLAY=:99.0"><div></div></button></div></figure></div>\n<p>سيكتشف slopcode ما إذا كنت تستخدم Wayland ويفضل <code dir="auto">wl-clipboard</code>، وإلا فسيحاول العثور على أدوات الحافظة بالترتيب التالي: <code dir="auto">xclip</code> ثم <code dir="auto">xsel</code>.</p>',
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
const url = "src/content/docs/ar/troubleshooting.mdx"
const file =
  "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/troubleshooting.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId =
  "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/ar/troubleshooting.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
