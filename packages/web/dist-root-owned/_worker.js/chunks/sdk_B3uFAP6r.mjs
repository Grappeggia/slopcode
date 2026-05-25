globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"
import { c as config } from "./config_UI6PtV27.mjs"

const frontmatter = {
  title: "SDK",
  description: "ไคลเอนต์ JS ประเภทที่ปลอดภัยสำหรับเซิร์ฟเวอร์ slopcode",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "ติดตั้ง",
      text: "ติดตั้ง",
    },
    {
      depth: 2,
      slug: "สร้างไคลเอนต์",
      text: "สร้างไคลเอนต์",
    },
    {
      depth: 4,
      slug: "ตัวเลือก",
      text: "ตัวเลือก",
    },
    {
      depth: 2,
      slug: "การกำหนดค่า",
      text: "การกำหนดค่า",
    },
    {
      depth: 2,
      slug: "ลูกค้าเท่านั้น",
      text: "ลูกค้าเท่านั้น",
    },
    {
      depth: 4,
      slug: "ตัวเลือก-1",
      text: "ตัวเลือก",
    },
    {
      depth: 2,
      slug: "ประเภท",
      text: "ประเภท",
    },
    {
      depth: 2,
      slug: "ข้อผิดพลาด",
      text: "ข้อผิดพลาด",
    },
    {
      depth: 2,
      slug: "api",
      text: "API",
    },
    {
      depth: 3,
      slug: "ทั่วโลก",
      text: "ทั่วโลก",
    },
    {
      depth: 4,
      slug: "ตัวอย่าง",
      text: "ตัวอย่าง",
    },
    {
      depth: 3,
      slug: "แอป",
      text: "แอป",
    },
    {
      depth: 4,
      slug: "ตัวอย่าง-1",
      text: "ตัวอย่าง",
    },
    {
      depth: 3,
      slug: "โครงการ",
      text: "โครงการ",
    },
    {
      depth: 4,
      slug: "ตัวอย่าง-2",
      text: "ตัวอย่าง",
    },
    {
      depth: 3,
      slug: "เส้นทาง",
      text: "เส้นทาง",
    },
    {
      depth: 4,
      slug: "ตัวอย่าง-3",
      text: "ตัวอย่าง",
    },
    {
      depth: 3,
      slug: "การกำหนดค่า-1",
      text: "การกำหนดค่า",
    },
    {
      depth: 4,
      slug: "ตัวอย่าง-4",
      text: "ตัวอย่าง",
    },
    {
      depth: 3,
      slug: "เซสชัน",
      text: "เซสชัน",
    },
    {
      depth: 4,
      slug: "ตัวอย่าง-5",
      text: "ตัวอย่าง",
    },
    {
      depth: 3,
      slug: "ไฟล์",
      text: "ไฟล์",
    },
    {
      depth: 4,
      slug: "ตัวอย่าง-6",
      text: "ตัวอย่าง",
    },
    {
      depth: 3,
      slug: "tui",
      text: "TUI",
    },
    {
      depth: 4,
      slug: "ตัวอย่าง-7",
      text: "ตัวอย่าง",
    },
    {
      depth: 3,
      slug: "การรับรองความถูกต้อง",
      text: "การรับรองความถูกต้อง",
    },
    {
      depth: 4,
      slug: "ตัวอย่าง-8",
      text: "ตัวอย่าง",
    },
    {
      depth: 3,
      slug: "กิจกรรม",
      text: "กิจกรรม",
    },
    {
      depth: 4,
      slug: "ตัวอย่าง-9",
      text: "ตัวอย่าง",
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
          '<p>slopcode JS/TS SDK จัดเตรียมไคลเอ็นต์ประเภทที่ปลอดภัยสำหรับการโต้ตอบกับเซิร์ฟเวอร์\nใช้เพื่อสร้างการบูรณาการและควบคุม slopcode โดยทางโปรแกรม</p>\n<p><a href="/docs/server">เรียนรู้เพิ่มเติม</a> เกี่ยวกับวิธีการทำงานของเซิร์ฟเวอร์ ตัวอย่างเช่น ลองดู <a href="/docs/ecosystem#%E0%B9%82%E0%B8%84%E0%B8%A3%E0%B8%87%E0%B8%81%E0%B8%B2%E0%B8%A3">โครงการ</a> ที่สร้างโดยชุมชน</p>\n<hr>\n<h2 id="ติดตั้ง"><a href="#ติดตั้ง">ติดตั้ง</a></h2>\n<p>ติดตั้ง SDK จาก npm:</p>\n<div class="expressive-code"><link rel="stylesheet" href="/docs/_astro/ec.4c0k7.css"><script type="module" src="/docs/_astro/ec.0vx5m.js"></script><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">npm</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">@slopcode-ai/sdk</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="npm install @slopcode-ai/sdk"><div></div></button></div></figure></div>\n<hr>\n<h2 id="สร้างไคลเอนต์"><a href="#สร้างไคลเอนต์">สร้างไคลเอนต์</a></h2>\n<p>สร้างอินสแตนซ์ของ slopcode:</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">import</span><span style="--0:#24292E;--1:#E1E4E8"> { createSlopcode } </span><span style="--0:#BF3441;--1:#F97583">from</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">"@slopcode-ai/sdk"</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> { </span><span style="--0:#005CC5;--1:#79B8FF">client</span><span style="--0:#24292E;--1:#E1E4E8"> } </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#6F42C1;--1:#B392F0">createSlopcode</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="import { createSlopcode } from &#x22;@slopcode-ai/sdk&#x22;const { client } = await createSlopcode()"><div></div></button></div></figure></div>\n<p>สิ่งนี้จะเริ่มต้นทั้งเซิร์ฟเวอร์และไคลเอนต์</p>\n<h4 id="ตัวเลือก"><a href="#ตัวเลือก">ตัวเลือก</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>ตัวเลือก</th><th>Type</th><th>คำอธิบาย</th><th>ค่าเริ่มต้น</th></tr></thead><tbody><tr><td><code dir="auto">hostname</code></td><td><code dir="auto">string</code></td><td>ชื่อโฮสต์ของเซิร์ฟเวอร์</td><td><code dir="auto">127.0.0.1</code></td></tr><tr><td><code dir="auto">port</code></td><td><code dir="auto">number</code></td><td>พอร์ตเซิร์ฟเวอร์</td><td><code dir="auto">4096</code></td></tr><tr><td><code dir="auto">signal</code></td><td><code dir="auto">AbortSignal</code></td><td>ยกเลิกสัญญาณสำหรับการยกเลิก</td><td><code dir="auto">undefined</code></td></tr><tr><td><code dir="auto">timeout</code></td><td><code dir="auto">number</code></td><td>หมดเวลาเป็น ms สำหรับการเริ่มต้นเซิร์ฟเวอร์</td><td><code dir="auto">5000</code></td></tr><tr><td><code dir="auto">config</code></td><td><code dir="auto">Config</code></td><td>วัตถุการกำหนดค่า</td><td><code dir="auto">{}</code></td></tr></tbody></table>\n<hr>\n<h2 id="การกำหนดค่า"><a href="#การกำหนดค่า">การกำหนดค่า</a></h2>\n<p>คุณสามารถส่งผ่านออบเจ็กต์การกำหนดค่าเพื่อปรับแต่งลักษณะการทำงานได้ อินสแตนซ์ยังคงรับ <code dir="auto">slopcode.json</code> ของคุณ แต่คุณสามารถแทนที่หรือเพิ่มการกำหนดค่าแบบอินไลน์ได้:</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">import</span><span style="--0:#24292E;--1:#E1E4E8"> { createSlopcode } </span><span style="--0:#BF3441;--1:#F97583">from</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">"@slopcode-ai/sdk"</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#6F42C1;--1:#B392F0">createSlopcode</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">hostname: </span><span style="--0:#032F62;--1:#9ECBFF">"127.0.0.1"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">port: </span><span style="--0:#005CC5;--1:#79B8FF">4096</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">config: {</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">model: </span><span style="--0:#032F62;--1:#9ECBFF">"anthropic/claude-3-5-sonnet-20241022"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">},</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">console.</span><span style="--0:#6F42C1;--1:#B392F0">log</span><span style="--0:#24292E;--1:#E1E4E8">(</span><span style="--0:#032F62;--1:#9ECBFF">`Server running at ${</span><span style="--0:#24292E;--1:#E1E4E8">slopcode</span><span style="--0:#032F62;--1:#9ECBFF">.</span><span style="--0:#24292E;--1:#E1E4E8">server</span><span style="--0:#032F62;--1:#9ECBFF">.</span><span style="--0:#24292E;--1:#E1E4E8">url</span><span style="--0:#032F62;--1:#9ECBFF">}`</span><span style="--0:#24292E;--1:#E1E4E8">)</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">slopcode.server.</span><span style="--0:#6F42C1;--1:#B392F0">close</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="import { createSlopcode } from &#x22;@slopcode-ai/sdk&#x22;const slopcode = await createSlopcode({  hostname: &#x22;127.0.0.1&#x22;,  port: 4096,  config: {    model: &#x22;anthropic/claude-3-5-sonnet-20241022&#x22;,  },})console.log(&#x60;Server running at ${slopcode.server.url}&#x60;)slopcode.server.close()"><div></div></button></div></figure></div>\n<h2 id="ลูกค้าเท่านั้น"><a href="#ลูกค้าเท่านั้น">ลูกค้าเท่านั้น</a></h2>\n<p>หากคุณมีอินสแตนซ์ slopcode ที่ทำงานอยู่แล้ว คุณสามารถสร้างอินสแตนซ์ไคลเอ็นต์เพื่อเชื่อมต่อได้:</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">import</span><span style="--0:#24292E;--1:#E1E4E8"> { createSlopcodeClient } </span><span style="--0:#BF3441;--1:#F97583">from</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">"@slopcode-ai/sdk"</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">client</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#6F42C1;--1:#B392F0">createSlopcodeClient</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">baseUrl: </span><span style="--0:#032F62;--1:#9ECBFF">"http://localhost:4096"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="import { createSlopcodeClient } from &#x22;@slopcode-ai/sdk&#x22;const client = createSlopcodeClient({  baseUrl: &#x22;http://localhost:4096&#x22;,})"><div></div></button></div></figure></div>\n<h4 id="ตัวเลือก-1"><a href="#ตัวเลือก-1">ตัวเลือก</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>ตัวเลือก</th><th>Type</th><th>คำอธิบาย</th><th>ค่าเริ่มต้น</th></tr></thead><tbody><tr><td><code dir="auto">baseUrl</code></td><td><code dir="auto">string</code></td><td>URL ของเซิร์ฟเวอร์</td><td><code dir="auto">http://localhost:4096</code></td></tr><tr><td><code dir="auto">fetch</code></td><td><code dir="auto">function</code></td><td>การใช้งานการดึงข้อมูลแบบกำหนดเอง</td><td><code dir="auto">globalThis.fetch</code></td></tr><tr><td><code dir="auto">parseAs</code></td><td><code dir="auto">string</code></td><td>Methodการแยกวิเคราะห์การตอบสนอง</td><td><code dir="auto">auto</code></td></tr><tr><td><code dir="auto">responseStyle</code></td><td><code dir="auto">string</code></td><td>รูปแบบการคืนสินค้า: <code dir="auto">data</code> หรือ <code dir="auto">fields</code></td><td><code dir="auto">fields</code></td></tr><tr><td><code dir="auto">throwOnError</code></td><td><code dir="auto">boolean</code></td><td>โยนข้อผิดพลาดแทนการส่งคืน</td><td><code dir="auto">false</code></td></tr></tbody></table>\n<hr>\n<h2 id="ประเภท"><a href="#ประเภท">ประเภท</a></h2>\n<p>SDK มีคำจำกัดความ TypeScript สำหรับ API ประเภททั้งหมด นำเข้าโดยตรง:</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="typescript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">import</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">type</span><span style="--0:#24292E;--1:#E1E4E8"> { Session, Message, Part } </span><span style="--0:#BF3441;--1:#F97583">from</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">"@slopcode-ai/sdk"</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="import type { Session, Message, Part } from &#x22;@slopcode-ai/sdk&#x22;"><div></div></button></div></figure></div>\n',
      }),
      createVNode(_components.p, {
        children: [
          "ทุกประเภทสร้างขึ้นจากข้อกำหนด OpenAPI ของเซิร์ฟเวอร์และมีอยู่ใน ",
          createVNode("a", {
            href: typesUrl,
            "set:html": "ไฟล์ประเภท",
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h2 id="ข้อผิดพลาด"><a href="#ข้อผิดพลาด">ข้อผิดพลาด</a></h2>\n<p>SDK อาจทำให้เกิดข้อผิดพลาดที่คุณสามารถจับและจัดการได้:</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="typescript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">try</span><span style="--0:#24292E;--1:#E1E4E8"> {</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.session.</span><span style="--0:#6F42C1;--1:#B392F0">get</span><span style="--0:#24292E;--1:#E1E4E8">({ path: { id: </span><span style="--0:#032F62;--1:#9ECBFF">"invalid-id"</span><span style="--0:#24292E;--1:#E1E4E8"> } })</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">} </span><span style="--0:#BF3441;--1:#F97583">catch</span><span style="--0:#24292E;--1:#E1E4E8"> (error) {</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">console.</span><span style="--0:#6F42C1;--1:#B392F0">error</span><span style="--0:#24292E;--1:#E1E4E8">(</span><span style="--0:#032F62;--1:#9ECBFF">"Failed to get session:"</span><span style="--0:#24292E;--1:#E1E4E8">, (error </span><span style="--0:#BF3441;--1:#F97583">as</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#6F42C1;--1:#B392F0">Error</span><span style="--0:#24292E;--1:#E1E4E8">).message)</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">}</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="try {  await client.session.get({ path: { id: &#x22;invalid-id&#x22; } })} catch (error) {  console.error(&#x22;Failed to get session:&#x22;, (error as Error).message)}"><div></div></button></div></figure></div>\n<hr>\n<h2 id="api"><a href="#api">API</a></h2>\n<p>SDK เปิดเผย API ของเซิร์ฟเวอร์ทั้งหมดผ่านไคลเอ็นต์ประเภทที่ปลอดภัย</p>\n<hr>\n<h3 id="ทั่วโลก"><a href="#ทั่วโลก">ทั่วโลก</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Method</th><th>คำอธิบาย</th><th>การตอบสนอง</th></tr></thead><tbody><tr><td><code dir="auto">global.health()</code></td><td>ตรวจสอบสภาพและเวอร์ชันของเซิร์ฟเวอร์</td><td><code dir="auto">{ healthy: true, version: string }</code></td></tr></tbody></table>\n<hr>\n<h4 id="ตัวอย่าง"><a href="#ตัวอย่าง">ตัวอย่าง</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">health</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.global.</span><span style="--0:#6F42C1;--1:#B392F0">health</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">console.</span><span style="--0:#6F42C1;--1:#B392F0">log</span><span style="--0:#24292E;--1:#E1E4E8">(health.data.version)</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="const health = await client.global.health()console.log(health.data.version)"><div></div></button></div></figure></div>\n<hr>\n<h3 id="แอป"><a href="#แอป">แอป</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "Method",
                }),
                createVNode(_components.th, {
                  children: "คำอธิบาย",
                }),
                createVNode(_components.th, {
                  children: "การตอบสนอง",
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
                    children: "เขียนรายการบันทึก",
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
                    children: "รายชื่อตัวแทนที่มีอยู่ทั้งหมด",
                  }),
                  createVNode(_components.td, {
                    children: createVNode("a", {
                      href: typesUrl,
                      "set:html": "<code>ตัวแทน[]</code>",
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
          '<hr>\n<h4 id="ตัวอย่าง-1"><a href="#ตัวอย่าง-1">ตัวอย่าง</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Write a log entry</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.app.</span><span style="--0:#6F42C1;--1:#B392F0">log</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">body: {</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">service: </span><span style="--0:#032F62;--1:#9ECBFF">"my-app"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">level: </span><span style="--0:#032F62;--1:#9ECBFF">"info"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">message: </span><span style="--0:#032F62;--1:#9ECBFF">"Operation completed"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">},</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// List available agents</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">agents</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.app.</span><span style="--0:#6F42C1;--1:#B392F0">agents</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="// Write a log entryawait client.app.log({  body: {    service: &#x22;my-app&#x22;,    level: &#x22;info&#x22;,    message: &#x22;Operation completed&#x22;,  },})// List available agentsconst agents = await client.app.agents()"><div></div></button></div></figure></div>\n<hr>\n<h3 id="โครงการ"><a href="#โครงการ">โครงการ</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "Method",
                }),
                createVNode(_components.th, {
                  children: "คำอธิบาย",
                }),
                createVNode(_components.th, {
                  children: "การตอบสนอง",
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
                    children: "แสดงรายการโครงการทั้งหมด",
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
                    children: "รับโครงการปัจจุบัน",
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
          '<hr>\n<h4 id="ตัวอย่าง-2"><a href="#ตัวอย่าง-2">ตัวอย่าง</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// List all projects</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">projects</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.project.</span><span style="--0:#6F42C1;--1:#B392F0">list</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Get current project</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">currentProject</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.project.</span><span style="--0:#6F42C1;--1:#B392F0">current</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="// List all projectsconst projects = await client.project.list()// Get current projectconst currentProject = await client.project.current()"><div></div></button></div></figure></div>\n<hr>\n<h3 id="เส้นทาง"><a href="#เส้นทาง">เส้นทาง</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "Method",
                }),
                createVNode(_components.th, {
                  children: "คำอธิบาย",
                }),
                createVNode(_components.th, {
                  children: "การตอบสนอง",
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
                  children: "รับเส้นทางปัจจุบัน",
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
          '<hr>\n<h4 id="ตัวอย่าง-3"><a href="#ตัวอย่าง-3">ตัวอย่าง</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Get current path information</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">pathInfo</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.path.</span><span style="--0:#6F42C1;--1:#B392F0">get</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="// Get current path informationconst pathInfo = await client.path.get()"><div></div></button></div></figure></div>\n<hr>\n<h3 id="การกำหนดค่า-1"><a href="#การกำหนดค่า-1">การกำหนดค่า</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "Method",
                }),
                createVNode(_components.th, {
                  children: "คำอธิบาย",
                }),
                createVNode(_components.th, {
                  children: "การตอบสนอง",
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
                    children: "รับข้อมูลการกำหนดค่า",
                  }),
                  createVNode(_components.td, {
                    children: createVNode("a", {
                      href: typesUrl,
                      "set:html": "<code>กำหนดค่า</code>",
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
                    children: "ผู้ให้บริการรายชื่อและโมเดลเริ่มต้น",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ providers: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>ผู้ให้บริการ[]</code>",
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
          '<hr>\n<h4 id="ตัวอย่าง-4"><a href="#ตัวอย่าง-4">ตัวอย่าง</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">config</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.config.</span><span style="--0:#6F42C1;--1:#B392F0">get</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> { </span><span style="--0:#005CC5;--1:#79B8FF">providers</span><span style="--0:#24292E;--1:#E1E4E8">, </span><span style="--0:#AE4B07;--1:#FFAB70">default</span><span style="--0:#24292E;--1:#E1E4E8">: </span><span style="--0:#005CC5;--1:#79B8FF">defaults</span><span style="--0:#24292E;--1:#E1E4E8"> } </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.config.</span><span style="--0:#6F42C1;--1:#B392F0">providers</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="const config = await client.config.get()const { providers, default: defaults } = await client.config.providers()"><div></div></button></div></figure></div>\n<hr>\n<h3 id="เซสชัน"><a href="#เซสชัน">เซสชัน</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "Method",
                }),
                createVNode(_components.th, {
                  children: "คำอธิบาย",
                }),
                createVNode(_components.th, {
                  children: "หมายเหตุ",
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
                    children: "แสดงรายการเซสชัน",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "ส่งคืน ",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>เซสชัน[]</code>",
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
                    children: "รับเซสชัน",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "ส่งคืน ",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>เซสชัน</code>",
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
                    children: "แสดงรายการเซสชันย่อย",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "ส่งคืน ",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>เซสชัน[]</code>",
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
                    children: "สร้างเซสชัน",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "ส่งคืน ",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>เซสชัน</code>",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                "set:html":
                  '<td><code dir="auto">session.delete({ path })</code></td><td>ลบเซสชัน</td><td>ส่งคืน <code dir="auto">boolean</code></td>',
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
                    children: "อัปเดตคุณสมบัติเซสชัน",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "ส่งคืน ",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>เซสชัน</code>",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(Fragment$1, {
                "set:html":
                  '<tr><td><code dir="auto">session.init({ path, body })</code></td><td>วิเคราะห์แอปและสร้าง <code dir="auto">AGENTS.md</code></td><td>ส่งคืน <code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">session.abort({ path })</code></td><td>ยกเลิกเซสชันที่ทำงานอยู่</td><td>ส่งคืน <code dir="auto">boolean</code></td></tr>',
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
                    children: "แบ่งปันเซสชั่น",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "ส่งคืน ",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>เซสชัน</code>",
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
                    children: "เลิกแชร์เซสชัน",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "ส่งคืน ",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>เซสชัน</code>",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                "set:html":
                  '<td><code dir="auto">session.summarize({ path, body })</code></td><td>สรุปเซสชัน</td><td>ส่งคืน <code dir="auto">boolean</code></td>',
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
                    children: "แสดงรายการข้อความในเซสชัน",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "ส่งคืน ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ info: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>ข้อความ</code>",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": ", parts: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>ส่วน[]</code>",
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
                    children: "รับรายละเอียดข้อความ",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "ส่งคืน ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ info: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>ข้อความ</code>",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": ", parts: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>ส่วน[]</code>",
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
                    children: "ส่งข้อความแจ้ง",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "body.noReply: true",
                      }),
                      " ส่งคืน UserMessage (บริบทเท่านั้น) ค่าเริ่มต้นส่งคืน ",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>AssistantMessage</code>",
                      }),
                      " พร้อมการตอบสนองของ AI",
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
                    children: "ส่งคำสั่งไปยังเซสชั่น",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "ส่งคืน ",
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
                        "set:html": "<code>ส่วน[]</code>",
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
                    children: "รันคำสั่ง shell",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "ส่งคืน ",
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
                    children: "คืนค่าข้อความ",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "ส่งคืน ",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>เซสชัน</code>",
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
                    children: "คืนค่าข้อความที่เปลี่ยนกลับ",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "ส่งคืน ",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>เซสชัน</code>",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                "set:html":
                  '<td><code dir="auto">postSessionByIdPermissionsByPermissionId({ path, body })</code></td><td>ตอบสนองต่อการร้องขอการอนุญาต</td><td>ส่งคืน <code dir="auto">boolean</code></td>',
              }),
            ],
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h4 id="ตัวอย่าง-5"><a href="#ตัวอย่าง-5">ตัวอย่าง</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Create and manage sessions</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">session</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.session.</span><span style="--0:#6F42C1;--1:#B392F0">create</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">body: { title: </span><span style="--0:#032F62;--1:#9ECBFF">"My session"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">sessions</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.session.</span><span style="--0:#6F42C1;--1:#B392F0">list</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Send a prompt message</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">result</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.session.</span><span style="--0:#6F42C1;--1:#B392F0">prompt</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">path: { id: session.id },</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">body: {</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">model: { providerID: </span><span style="--0:#032F62;--1:#9ECBFF">"anthropic"</span><span style="--0:#24292E;--1:#E1E4E8">, modelID: </span><span style="--0:#032F62;--1:#9ECBFF">"claude-3-5-sonnet-20241022"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">parts: [{ type: </span><span style="--0:#032F62;--1:#9ECBFF">"text"</span><span style="--0:#24292E;--1:#E1E4E8">, text: </span><span style="--0:#032F62;--1:#9ECBFF">"Hello!"</span><span style="--0:#24292E;--1:#E1E4E8"> }],</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">},</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Inject context without triggering AI response (useful for plugins)</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.session.</span><span style="--0:#6F42C1;--1:#B392F0">prompt</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">path: { id: session.id },</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">body: {</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">noReply: </span><span style="--0:#005CC5;--1:#79B8FF">true</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">parts: [{ type: </span><span style="--0:#032F62;--1:#9ECBFF">"text"</span><span style="--0:#24292E;--1:#E1E4E8">, text: </span><span style="--0:#032F62;--1:#9ECBFF">"You are a helpful assistant."</span><span style="--0:#24292E;--1:#E1E4E8"> }],</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">},</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="// Create and manage sessionsconst session = await client.session.create({  body: { title: &#x22;My session&#x22; },})const sessions = await client.session.list()// Send a prompt messageconst result = await client.session.prompt({  path: { id: session.id },  body: {    model: { providerID: &#x22;anthropic&#x22;, modelID: &#x22;claude-3-5-sonnet-20241022&#x22; },    parts: [{ type: &#x22;text&#x22;, text: &#x22;Hello!&#x22; }],  },})// Inject context without triggering AI response (useful for plugins)await client.session.prompt({  path: { id: session.id },  body: {    noReply: true,    parts: [{ type: &#x22;text&#x22;, text: &#x22;You are a helpful assistant.&#x22; }],  },})"><div></div></button></div></figure></div>\n<hr>\n<h3 id="ไฟล์"><a href="#ไฟล์">ไฟล์</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "Method",
                }),
                createVNode(_components.th, {
                  children: "คำอธิบาย",
                }),
                createVNode(_components.th, {
                  children: "การตอบสนอง",
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
                    children: "ค้นหาข้อความในไฟล์",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "อาร์เรย์ของวัตถุที่ตรงกับ ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "path",
                      }),
                      ", ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "lines",
                      }),
                      ", ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "line_number",
                      }),
                      ", ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "absolute_offset",
                      }),
                      ", ",
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
                    children: "ค้นหาไฟล์และไดเร็กทอรีตามชื่อ",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "string[]",
                      }),
                      " (paths)",
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
                    children: "ค้นหาสัญลักษณ์พื้นที่ทำงาน",
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
                  '<td><code dir="auto">file.read({ query })</code></td><td>อ่านไฟล์</td><td><code dir="auto">{ type: "raw" | "patch", content: string }</code></td>',
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
                    children: "รับสถานะสำหรับไฟล์ที่ถูกติดตาม",
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
          '<p><code dir="auto">find.files</code> รองรับช่องค้นหาเพิ่มเติมบางช่อง:</p>\n<ul>\n<li><code dir="auto">type</code>: <code dir="auto">"file"</code> หรือ <code dir="auto">"directory"</code></li>\n<li><code dir="auto">directory</code>: แทนที่รูทโปรเจ็กต์สำหรับการค้นหา</li>\n<li><code dir="auto">limit</code>: ผลลัพธ์สูงสุด (1–200)</li>\n</ul>\n<hr>\n<h4 id="ตัวอย่าง-6"><a href="#ตัวอย่าง-6">ตัวอย่าง</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Search and read files</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">textResults</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.find.</span><span style="--0:#6F42C1;--1:#B392F0">text</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">query: { pattern: </span><span style="--0:#032F62;--1:#9ECBFF">"function.*slopcode"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">files</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.find.</span><span style="--0:#6F42C1;--1:#B392F0">files</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">query: { query: </span><span style="--0:#032F62;--1:#9ECBFF">"*.ts"</span><span style="--0:#24292E;--1:#E1E4E8">, type: </span><span style="--0:#032F62;--1:#9ECBFF">"file"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">directories</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.find.</span><span style="--0:#6F42C1;--1:#B392F0">files</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">query: { query: </span><span style="--0:#032F62;--1:#9ECBFF">"packages"</span><span style="--0:#24292E;--1:#E1E4E8">, type: </span><span style="--0:#032F62;--1:#9ECBFF">"directory"</span><span style="--0:#24292E;--1:#E1E4E8">, limit: </span><span style="--0:#005CC5;--1:#79B8FF">20</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">content</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.file.</span><span style="--0:#6F42C1;--1:#B392F0">read</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">query: { path: </span><span style="--0:#032F62;--1:#9ECBFF">"src/index.ts"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="// Search and read filesconst textResults = await client.find.text({  query: { pattern: &#x22;function.*slopcode&#x22; },})const files = await client.find.files({  query: { query: &#x22;*.ts&#x22;, type: &#x22;file&#x22; },})const directories = await client.find.files({  query: { query: &#x22;packages&#x22;, type: &#x22;directory&#x22;, limit: 20 },})const content = await client.file.read({  query: { path: &#x22;src/index.ts&#x22; },})"><div></div></button></div></figure></div>\n<hr>\n<h3 id="tui"><a href="#tui">TUI</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Method</th><th>คำอธิบาย</th><th>การตอบสนอง</th></tr></thead><tbody><tr><td><code dir="auto">tui.appendPrompt({ body })</code></td><td>เพิ่มข้อความต่อท้ายข้อความแจ้ง</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.openHelp()</code></td><td>เปิดกล่องโต้ตอบความช่วยเหลือ</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.openSessions()</code></td><td>เปิดตัวเลือกเซสชัน</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.openThemes()</code></td><td>เปิดตัวเลือกธีม</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.openModels()</code></td><td>เปิดตัวเลือกรุ่น</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.submitPrompt()</code></td><td>ส่งข้อความแจ้งปัจจุบัน</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.clearPrompt()</code></td><td>ล้างข้อความแจ้ง</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.executeCommand({ body })</code></td><td>ดำเนินการคำสั่ง</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.showToast({ body })</code></td><td>แสดงการแจ้งเตือนขนมปังปิ้ง</td><td><code dir="auto">boolean</code></td></tr></tbody></table>\n<hr>\n<h4 id="ตัวอย่าง-7"><a href="#ตัวอย่าง-7">ตัวอย่าง</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Control TUI interface</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.tui.</span><span style="--0:#6F42C1;--1:#B392F0">appendPrompt</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">body: { text: </span><span style="--0:#032F62;--1:#9ECBFF">"Add this to prompt"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.tui.</span><span style="--0:#6F42C1;--1:#B392F0">showToast</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">body: { message: </span><span style="--0:#032F62;--1:#9ECBFF">"Task completed"</span><span style="--0:#24292E;--1:#E1E4E8">, variant: </span><span style="--0:#032F62;--1:#9ECBFF">"success"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="// Control TUI interfaceawait client.tui.appendPrompt({  body: { text: &#x22;Add this to prompt&#x22; },})await client.tui.showToast({  body: { message: &#x22;Task completed&#x22;, variant: &#x22;success&#x22; },})"><div></div></button></div></figure></div>\n<hr>\n<h3 id="การรับรองความถูกต้อง"><a href="#การรับรองความถูกต้อง">การรับรองความถูกต้อง</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Method</th><th>คำอธิบาย</th><th>การตอบสนอง</th></tr></thead><tbody><tr><td><code dir="auto">auth.set({ ... })</code></td><td>ตั้งค่าข้อมูลประจำตัวการรับรองความถูกต้อง</td><td><code dir="auto">boolean</code></td></tr></tbody></table>\n<hr>\n<h4 id="ตัวอย่าง-8"><a href="#ตัวอย่าง-8">ตัวอย่าง</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.auth.</span><span style="--0:#6F42C1;--1:#B392F0">set</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">path: { id: </span><span style="--0:#032F62;--1:#9ECBFF">"anthropic"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">body: { type: </span><span style="--0:#032F62;--1:#9ECBFF">"api"</span><span style="--0:#24292E;--1:#E1E4E8">, key: </span><span style="--0:#032F62;--1:#9ECBFF">"your-api-key"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="await client.auth.set({  path: { id: &#x22;anthropic&#x22; },  body: { type: &#x22;api&#x22;, key: &#x22;your-api-key&#x22; },})"><div></div></button></div></figure></div>\n<hr>\n<h3 id="กิจกรรม"><a href="#กิจกรรม">กิจกรรม</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Method</th><th>คำอธิบาย</th><th>การตอบสนอง</th></tr></thead><tbody><tr><td><code dir="auto">event.subscribe()</code></td><td>สตรีมเหตุการณ์ที่เซิร์ฟเวอร์ส่ง</td><td>สตรีมเหตุการณ์ที่เซิร์ฟเวอร์ส่ง</td></tr></tbody></table>\n<hr>\n<h4 id="ตัวอย่าง-9"><a href="#ตัวอย่าง-9">ตัวอย่าง</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Listen to real-time events</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">events</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.event.</span><span style="--0:#6F42C1;--1:#B392F0">subscribe</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">for</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> (</span><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">event</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">of</span><span style="--0:#24292E;--1:#E1E4E8"> events.stream) {</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">console.</span><span style="--0:#6F42C1;--1:#B392F0">log</span><span style="--0:#24292E;--1:#E1E4E8">(</span><span style="--0:#032F62;--1:#9ECBFF">"Event:"</span><span style="--0:#24292E;--1:#E1E4E8">, event.type, event.properties)</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">}</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="// Listen to real-time eventsconst events = await client.event.subscribe()for await (const event of events.stream) {  console.log(&#x22;Event:&#x22;, event.type, event.properties)}"><div></div></button></div></figure></div>',
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

const url = "src/content/docs/th/sdk.mdx"
const file = "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/sdk.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/sdk.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, typesUrl, url }
