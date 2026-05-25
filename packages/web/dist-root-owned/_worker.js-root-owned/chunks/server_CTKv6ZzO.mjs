globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"
import { c as config } from "./config_UI6PtV27.mjs"

const frontmatter = {
  title: "เซิร์ฟเวอร์",
  description: "โต้ตอบกับเซิร์ฟเวอร์ slopcode ผ่าน HTTP",
}
function getHeadings() {
  return [
    {
      depth: 3,
      slug: "การใช้งาน",
      text: "การใช้งาน",
    },
    {
      depth: 4,
      slug: "ตัวเลือก",
      text: "ตัวเลือก",
    },
    {
      depth: 3,
      slug: "การรับรองความถูกต้อง",
      text: "การรับรองความถูกต้อง",
    },
    {
      depth: 3,
      slug: "มันทำงานอย่างไร",
      text: "มันทำงานอย่างไร",
    },
    {
      depth: 4,
      slug: "เชื่อมต่อกับเซิร์ฟเวอร์ที่มีอยู่",
      text: "เชื่อมต่อกับเซิร์ฟเวอร์ที่มีอยู่",
    },
    {
      depth: 2,
      slug: "ข้อมูลจำเพาะ",
      text: "ข้อมูลจำเพาะ",
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
      depth: 3,
      slug: "โครงการ",
      text: "โครงการ",
    },
    {
      depth: 3,
      slug: "เส้นทาง--vcs",
      text: "เส้นทาง & VCS",
    },
    {
      depth: 3,
      slug: "ตัวอย่าง",
      text: "ตัวอย่าง",
    },
    {
      depth: 3,
      slug: "การกำหนดค่า",
      text: "การกำหนดค่า",
    },
    {
      depth: 3,
      slug: "ผู้ให้บริการ",
      text: "ผู้ให้บริการ",
    },
    {
      depth: 3,
      slug: "เซสชัน",
      text: "เซสชัน",
    },
    {
      depth: 3,
      slug: "ข้อความ",
      text: "ข้อความ",
    },
    {
      depth: 3,
      slug: "คำสั่ง",
      text: "คำสั่ง",
    },
    {
      depth: 3,
      slug: "ไฟล์",
      text: "ไฟล์",
    },
    {
      depth: 4,
      slug: "findfile-พารามิเตอร์การสืบค้น",
      text: "/find/file พารามิเตอร์การสืบค้น",
    },
    {
      depth: 3,
      slug: "เครื่องมือ-ขั้นทดลอง",
      text: "เครื่องมือ (ขั้นทดลอง)",
    },
    {
      depth: 3,
      slug: "lsp-ฟอร์แมตเตอร์--mcp",
      text: "LSP, ฟอร์แมตเตอร์ & MCP",
    },
    {
      depth: 3,
      slug: "ตัวแทน",
      text: "ตัวแทน",
    },
    {
      depth: 3,
      slug: "การบันทึก",
      text: "การบันทึก",
    },
    {
      depth: 3,
      slug: "tui",
      text: "TUI",
    },
    {
      depth: 3,
      slug: "การรับรองความถูกต้อง-1",
      text: "การรับรองความถูกต้อง",
    },
    {
      depth: 3,
      slug: "กิจกรรม",
      text: "กิจกรรม",
    },
    {
      depth: 3,
      slug: "เอกสาร",
      text: "เอกสาร",
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
          '<p>คำสั่ง <code dir="auto">slopcode serve</code> รันเซิร์ฟเวอร์ HTTP ที่ไม่มีหัวซึ่งเปิดเผยตำแหน่งข้อมูล OpenAPI ที่ไคลเอนต์ slopcode สามารถใช้ได้</p>\n<hr>\n<h3 id="การใช้งาน"><a href="#การใช้งาน">การใช้งาน</a></h3>\n<div class="expressive-code"><link rel="stylesheet" href="/docs/_astro/ec.4c0k7.css"><script type="module" src="/docs/_astro/ec.0vx5m.js"></script><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">serve</span><span style="--0:#24292E;--1:#E1E4E8"> [--port </span><span style="--0:#032F62;--1:#9ECBFF">&#x3C;number>]</span><span style="--0:#24292E;--1:#E1E4E8"> [--hostname </span><span style="--0:#032F62;--1:#9ECBFF">&#x3C;string>]</span><span style="--0:#24292E;--1:#E1E4E8"> [--cors </span><span style="--0:#032F62;--1:#9ECBFF">&#x3C;origin>]</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode serve [--port <number>] [--hostname <string>] [--cors <origin>]"><div></div></button></div></figure></div>\n<h4 id="ตัวเลือก"><a href="#ตัวเลือก">ตัวเลือก</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Flag</th><th>คำอธิบาย</th><th>ค่าเริ่มต้น</th></tr></thead><tbody><tr><td><code dir="auto">--port</code></td><td>พอร์ตที่จะฟัง</td><td><code dir="auto">4096</code></td></tr><tr><td><code dir="auto">--hostname</code></td><td>ชื่อโฮสต์ที่จะฟัง</td><td><code dir="auto">127.0.0.1</code></td></tr><tr><td><code dir="auto">--mdns</code></td><td>เปิดใช้งานการค้นพบ mDNS</td><td><code dir="auto">false</code></td></tr><tr><td><code dir="auto">--mdns-domain</code></td><td>ชื่อโดเมนที่กำหนดเองสำหรับบริการ mDNS</td><td><code dir="auto">slopcode.local</code></td></tr><tr><td><code dir="auto">--cors</code></td><td>ต้นกำเนิดเบราว์เซอร์เพิ่มเติมที่จะอนุญาต</td><td><code dir="auto">[]</code></td></tr></tbody></table>\n<p><code dir="auto">--cors</code> สามารถส่งผ่านได้หลายครั้ง:</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">serve</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--cors</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">http://localhost:5173</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">--cors</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">https://app.example.com</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="slopcode serve --cors http://localhost:5173 --cors https://app.example.com"><div></div></button></div></figure></div>\n<hr>\n<h3 id="การรับรองความถูกต้อง"><a href="#การรับรองความถูกต้อง">การรับรองความถูกต้อง</a></h3>\n<p>ตั้งค่า <code dir="auto">SLOPCODE_SERVER_PASSWORD</code> เพื่อปกป้องเซิร์ฟเวอร์ด้วย HTTP การตรวจสอบสิทธิ์ขั้นพื้นฐาน ชื่อผู้ใช้มีค่าเริ่มต้นเป็น <code dir="auto">slopcode</code> หรือตั้งค่า <code dir="auto">SLOPCODE_SERVER_USERNAME</code> เพื่อแทนที่ชื่อผู้ใช้ สิ่งนี้ใช้ได้กับทั้ง <code dir="auto">slopcode serve</code> และ <code dir="auto">slopcode web</code></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">SLOPCODE_SERVER_PASSWORD</span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#032F62;--1:#9ECBFF">your-password</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#6F42C1;--1:#B392F0">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">serve</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="SLOPCODE_SERVER_PASSWORD=your-password slopcode serve"><div></div></button></div></figure></div>\n<hr>\n<h3 id="มันทำงานอย่างไร"><a href="#มันทำงานอย่างไร">มันทำงานอย่างไร</a></h3>\n<p>เมื่อคุณรัน <code dir="auto">slopcode</code> มันจะเริ่มต้น TUI และเซิร์ฟเวอร์ โดยที่ TUI คือ\nลูกค้าที่พูดคุยกับเซิร์ฟเวอร์ เซิร์ฟเวอร์เปิดเผยข้อมูลจำเพาะของ OpenAPI 3.1\nจุดสิ้นสุด ตำแหน่งข้อมูลนี้ยังใช้เพื่อสร้าง <a href="/docs/sdk">SDK</a></p>\n<aside aria-label="Tip" class="starlight-aside starlight-aside--tip"><p class="starlight-aside__title" aria-hidden="true"><svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" class="starlight-aside__icon"><path fill-rule="evenodd" clip-rule="evenodd" d="M1.43909 8.85483L1.44039 8.85354L4.96668 5.33815C5.30653 4.99386 5.7685 4.79662 6.2524 4.78972L6.26553 4.78963L12.9014 4.78962L13.8479 3.84308C16.9187 0.772319 20.0546 0.770617 21.4678 0.975145C21.8617 1.02914 22.2271 1.21053 22.5083 1.4917C22.7894 1.77284 22.9708 2.13821 23.0248 2.53199C23.2294 3.94517 23.2278 7.08119 20.1569 10.1521L19.2107 11.0983V17.7338L19.2106 17.7469C19.2037 18.2308 19.0067 18.6933 18.6624 19.0331L15.1456 22.5608C14.9095 22.7966 14.6137 22.964 14.29 23.0449C13.9663 23.1259 13.6267 23.1174 13.3074 23.0204C12.9881 22.9235 12.7011 22.7417 12.4771 22.4944C12.2533 22.2473 12.1006 21.9441 12.0355 21.6171L11.1783 17.3417L6.65869 12.822L4.34847 12.3589L2.38351 11.965C2.05664 11.8998 1.75272 11.747 1.50564 11.5232C1.25835 11.2992 1.07653 11.0122 0.979561 10.6929C0.882595 10.3736 0.874125 10.034 0.955057 9.7103C1.03599 9.38659 1.20328 9.09092 1.43909 8.85483ZM6.8186 10.8724L2.94619 10.096L6.32006 6.73268H10.9583L6.8186 10.8724ZM15.2219 5.21703C17.681 2.75787 20.0783 2.75376 21.1124 2.8876C21.2462 3.92172 21.2421 6.31895 18.783 8.77812L12.0728 15.4883L8.51172 11.9272L15.2219 5.21703ZM13.9042 21.0538L13.1279 17.1811L17.2676 13.0414V17.68L13.9042 21.0538Z"></path><path d="M9.31827 18.3446C9.45046 17.8529 9.17864 17.3369 8.68945 17.1724C8.56178 17.1294 8.43145 17.1145 8.30512 17.1243C8.10513 17.1398 7.91519 17.2172 7.76181 17.3434C7.62613 17.455 7.51905 17.6048 7.45893 17.7835C6.97634 19.2186 5.77062 19.9878 4.52406 20.4029C4.08525 20.549 3.6605 20.644 3.29471 20.7053C3.35607 20.3395 3.45098 19.9148 3.59711 19.476C4.01221 18.2294 4.78141 17.0237 6.21648 16.5411C6.39528 16.481 6.54504 16.3739 6.65665 16.2382C6.85126 16.0016 6.92988 15.678 6.84417 15.3647C6.83922 15.3466 6.83373 15.3286 6.82767 15.3106C6.74106 15.053 6.55701 14.8557 6.33037 14.7459C6.10949 14.6389 5.84816 14.615 5.59715 14.6994C5.47743 14.7397 5.36103 14.7831 5.24786 14.8294C3.22626 15.6569 2.2347 17.4173 1.75357 18.8621C1.49662 19.6337 1.36993 20.3554 1.30679 20.8818C1.27505 21.1464 1.25893 21.3654 1.25072 21.5213C1.24662 21.5993 1.24448 21.6618 1.24337 21.7066L1.243 21.7226L1.24235 21.7605L1.2422 21.7771L1.24217 21.7827L1.24217 21.7856C1.24217 22.3221 1.67703 22.7579 2.2137 22.7579L2.2155 22.7579L2.22337 22.7578L2.23956 22.7577C2.25293 22.7575 2.27096 22.7572 2.29338 22.7567C2.33821 22.7555 2.40073 22.7534 2.47876 22.7493C2.63466 22.7411 2.85361 22.725 3.11822 22.6932C3.64462 22.6301 4.36636 22.5034 5.13797 22.2464C6.58274 21.7653 8.3431 20.7738 9.17063 18.7522C9.21696 18.639 9.26037 18.5226 9.30064 18.4029C9.30716 18.3835 9.31304 18.364 9.31827 18.3446Z"></path></svg>Tip</p><div class="starlight-aside__content"><p>ใช้เซิร์ฟเวอร์ slopcode เพื่อโต้ตอบกับ slopcode โดยทางโปรแกรม</p></div></aside>\n<p>สถาปัตยกรรมนี้ช่วยให้ slopcode รองรับไคลเอนต์หลายตัว และช่วยให้คุณสามารถโต้ตอบกับ slopcode โดยทางโปรแกรมได้</p>\n<p>คุณสามารถเรียกใช้ <code dir="auto">slopcode serve</code> เพื่อเริ่มเซิร์ฟเวอร์แบบสแตนด์อโลน ถ้าคุณมี\nslopcode TUI ทำงาน <code dir="auto">slopcode serve</code> จะเริ่มเซิร์ฟเวอร์ใหม่</p>\n<hr>\n<h4 id="เชื่อมต่อกับเซิร์ฟเวอร์ที่มีอยู่"><a href="#เชื่อมต่อกับเซิร์ฟเวอร์ที่มีอยู่">เชื่อมต่อกับเซิร์ฟเวอร์ที่มีอยู่</a></h4>\n<p>เมื่อคุณเริ่ม TUI มันจะสุ่มกำหนดพอร์ตและชื่อโฮสต์ คุณสามารถผ่าน <code dir="auto">--hostname</code> และ <code dir="auto">--port</code> <a href="/docs/cli">ธง</a> แทนได้ จากนั้นใช้สิ่งนี้เพื่อเชื่อมต่อกับเซิร์ฟเวอร์</p>\n<p>ตำแหน่งข้อมูล <a href="#tui"><code dir="auto">/tui</code></a> สามารถใช้เพื่อขับเคลื่อน TUI ผ่านเซิร์ฟเวอร์ ตัวอย่างเช่น คุณสามารถกรอกข้อมูลล่วงหน้าหรือเรียกใช้พร้อมท์ได้ การตั้งค่านี้ถูกใช้โดยปลั๊กอิน SlopCode <a href="/docs/ide">IDE</a></p>\n<hr>\n<h2 id="ข้อมูลจำเพาะ"><a href="#ข้อมูลจำเพาะ">ข้อมูลจำเพาะ</a></h2>\n<p>เซิร์ฟเวอร์เผยแพร่ข้อมูลจำเพาะ OpenAPI 3.1 ที่สามารถดูได้ที่:</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="plaintext"><code><div class="ec-line"><div class="code"><span style="--0:#24292e;--1:#e1e4e8">http://&#x3C;hostname>:&#x3C;port>/doc</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="http://<hostname>:<port>/doc"><div></div></button></div></figure></div>\n<p>ตัวอย่างเช่น <code dir="auto">http://localhost:4096/doc</code> ใช้ข้อมูลจำเพาะเพื่อสร้างไคลเอ็นต์หรือตรวจสอบคำขอและประเภทการตอบกลับ หรือดูใน Swagger explorer</p>\n<hr>\n<h2 id="api"><a href="#api">API</a></h2>\n<p>เซิร์ฟเวอร์ slopcode เปิดเผย API ต่อไปนี้</p>\n<hr>\n<h3 id="ทั่วโลก"><a href="#ทั่วโลก">ทั่วโลก</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Method</th><th>เส้นทาง</th><th>คำอธิบาย</th><th>การตอบสนอง</th></tr></thead><tbody><tr><td><code dir="auto">GET</code></td><td><code dir="auto">/global/health</code></td><td>รับสถานะและเวอร์ชันของเซิร์ฟเวอร์</td><td><code dir="auto">{ healthy: true, version: string }</code></td></tr><tr><td><code dir="auto">GET</code></td><td><code dir="auto">/global/event</code></td><td>รับกิจกรรมระดับโลก (SSE สตรีม)</td><td>สตรีมกิจกรรม</td></tr></tbody></table>\n<hr>\n<h3 id="โครงการ"><a href="#โครงการ">โครงการ</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "เส้นทาง",
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
          '<hr>\n<h3 id="เส้นทาง--vcs"><a href="#เส้นทาง--vcs">เส้นทาง &#x26; VCS</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "เส้นทาง",
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
                    children: "รับข้อมูล VCS สำหรับโครงการปัจจุบัน",
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
          '<hr>\n<h3 id="ตัวอย่าง"><a href="#ตัวอย่าง">ตัวอย่าง</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Method</th><th>เส้นทาง</th><th>คำอธิบาย</th><th>การตอบสนอง</th></tr></thead><tbody><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/instance/dispose</code></td><td>กำจัดอินสแตนซ์ปัจจุบัน</td><td><code dir="auto">boolean</code></td></tr></tbody></table>\n<hr>\n<h3 id="การกำหนดค่า"><a href="#การกำหนดค่า">การกำหนดค่า</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "เส้นทาง",
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
                    children: "อัปเดตการกำหนดค่า",
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
                        "set:html": "ผู้ให้บริการ[]",
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
          '<hr>\n<h3 id="ผู้ให้บริการ"><a href="#ผู้ให้บริการ">ผู้ให้บริการ</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "เส้นทาง",
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
                    children: "รายชื่อผู้ให้บริการทั้งหมด",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ all: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "ผู้ให้บริการ[]",
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
                    children: "รับวิธีการตรวจสอบความถูกต้องของผู้ให้บริการ",
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
                    children: "ให้สิทธิ์ผู้ให้บริการโดยใช้ OAuth",
                  }),
                  createVNode(_components.td, {
                    children: createVNode("a", {
                      href: typesUrl,
                      "set:html": "<code>การอนุญาตของผู้ให้บริการ</code>",
                    }),
                  }),
                ],
              }),
              createVNode(_components.tr, {
                "set:html":
                  '<td><code dir="auto">POST</code></td><td><code dir="auto">/provider/{id}/oauth/callback</code></td><td>จัดการการโทรกลับ OAuth สำหรับผู้ให้บริการ</td><td><code dir="auto">boolean</code></td>',
              }),
            ],
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h3 id="เซสชัน"><a href="#เซสชัน">เซสชัน</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "เส้นทาง",
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
                    children: "แสดงรายการเซสชันทั้งหมด",
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
                    children: "สร้างเซสชันใหม่",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "body: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ parentID?, title? }",
                      }),
                      " ส่งคืน ",
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
                    children: "รับสถานะเซสชันสำหรับเซสชันทั้งหมด",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "ส่งคืน ",
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
                    children: "รับรายละเอียดเซสชั่น",
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
                  '<td><code dir="auto">DELETE</code></td><td><code dir="auto">/session/:id</code></td><td>ลบเซสชันและข้อมูลทั้งหมด</td><td>ส่งคืน <code dir="auto">boolean</code></td>',
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
                    children: "อัปเดตคุณสมบัติเซสชัน",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "body: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ title? }",
                      }),
                      " ส่งคืน ",
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
                    children: "รับเซสชันย่อยของเซสชัน",
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
                    children: "รับรายการสิ่งที่ต้องทำสำหรับเซสชัน",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "ส่งคืน ",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>สิ่งที่ต้องทำ[]</code>",
                      }),
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                "set:html":
                  '<td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/init</code></td><td>วิเคราะห์แอปและสร้าง <code dir="auto">AGENTS.md</code></td><td>เนื้อความ: <code dir="auto">{ messageID, providerID, modelID }</code> ส่งคืน <code dir="auto">boolean</code></td>',
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
                    children: "แยกเซสชันที่มีอยู่ไปที่ข้อความ",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "body: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ messageID? }",
                      }),
                      " ส่งคืน ",
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
                  '<td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/abort</code></td><td>ยกเลิกเซสชันที่ทำงานอยู่</td><td>ส่งคืน <code dir="auto">boolean</code></td>',
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
                    children: "ยกเลิกการแชร์เซสชัน",
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
                    children: "รับความแตกต่างสำหรับเซสชั่นนี้",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "ข้อความค้นหา: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "messageID?",
                      }),
                      " ส่งคืน ",
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
                  '<tr><td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/summarize</code></td><td>สรุปเซสชัน</td><td>เนื้อความ: <code dir="auto">{ providerID, modelID }</code> ส่งคืน <code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/revert</code></td><td>คืนค่าข้อความ</td><td>เนื้อความ: <code dir="auto">{ messageID, partID? }</code> ส่งคืน <code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/unrevert</code></td><td>กู้คืนข้อความที่เปลี่ยนกลับทั้งหมด</td><td>ส่งคืน <code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/permissions/:permissionID</code></td><td>ตอบสนองต่อการร้องขอการอนุญาต</td><td>เนื้อความ: <code dir="auto">{ response, remember? }</code> ส่งคืน <code dir="auto">boolean</code></td></tr>',
              }),
            ],
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h3 id="ข้อความ"><a href="#ข้อความ">ข้อความ</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "เส้นทาง",
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
                    children: "แสดงรายการข้อความในเซสชัน",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "ข้อความค้นหา: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "limit?",
                      }),
                      " ส่งคืน ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ info: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "ข้อความ",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": ", parts: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "ส่วน[]",
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
                    children: "ส่งข้อความและรอการตอบกลับ",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "เนื้อความ: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ messageID?, model?, agent?, noReply?, system?, tools?, parts }",
                      }),
                      " ส่งคืน ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ info: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "ข้อความ",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": ", parts: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "ส่วน[]",
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
                        "set:html": "ข้อความ",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": ", parts: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "ส่วนหนึ่ง[]",
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
                  '<td><code dir="auto">POST</code></td><td><code dir="auto">/session/:id/prompt_async</code></td><td>ส่งข้อความแบบอะซิงโครนัส (ไม่ต้องรอ)</td><td>เนื้อความ: เหมือนกับ <code dir="auto">/session/:id/message</code> ส่งคืน <code dir="auto">204 No Content</code></td>',
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
                    children: "ดำเนินการคำสั่งเครื่องหมายทับ",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "เนื้อความ: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ messageID?, agent?, model?, command, arguments }",
                      }),
                      " ส่งคืน ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ info: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "ข้อความ",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": ", parts: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "ส่วน[]",
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
                    children: "รันคำสั่ง shell",
                  }),
                  createVNode(_components.td, {
                    children: [
                      "เนื้อความ: ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ agent, model?, command }",
                      }),
                      " ส่งคืน ",
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "{ info: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "ข้อความ",
                      }),
                      createVNode(_components.code, {
                        dir: "auto",
                        "set:html": ", parts: ",
                      }),
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "ส่วน[]",
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
        "set:html": '<hr>\n<h3 id="คำสั่ง"><a href="#คำสั่ง">คำสั่ง</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "เส้นทาง",
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
                  children: "แสดงรายการคำสั่งทั้งหมด",
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
          '<hr>\n<h3 id="ไฟล์"><a href="#ไฟล์">ไฟล์</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "เส้นทาง",
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
                    children: "แสดงรายการไฟล์และไดเร็กทอรี",
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
                    children: "อ่านไฟล์",
                  }),
                  createVNode(_components.td, {
                    children: createVNode("a", {
                      href: typesUrl,
                      "set:html": "<code>เนื้อหาไฟล์</code>",
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
          '<h4 id="findfile-พารามิเตอร์การสืบค้น"><a href="#findfile-พารามิเตอร์การสืบค้น"><code dir="auto">/find/file</code> พารามิเตอร์การสืบค้น</a></h4>\n<ul>\n<li><code dir="auto">query</code> (จำเป็น) — สตริงการค้นหา (การจับคู่แบบคลุมเครือ)</li>\n<li><code dir="auto">type</code> (ไม่บังคับ) — จำกัดผลลัพธ์ไว้ที่ <code dir="auto">"file"</code> หรือ <code dir="auto">"directory"</code></li>\n<li><code dir="auto">directory</code> (เป็นทางเลือก) — แทนที่รูทโปรเจ็กต์สำหรับการค้นหา</li>\n<li><code dir="auto">limit</code> (ไม่บังคับ) — ผลลัพธ์สูงสุด (1–200)</li>\n<li><code dir="auto">dirs</code> (ไม่บังคับ) — แฟล็กดั้งเดิม (<code dir="auto">"false"</code> ส่งคืนเฉพาะไฟล์)</li>\n</ul>\n<hr>\n<h3 id="เครื่องมือ-ขั้นทดลอง"><a href="#เครื่องมือ-ขั้นทดลอง">เครื่องมือ (ขั้นทดลอง)</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "เส้นทาง",
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
                    children: "แสดงรายการรหัสเครื่องมือทั้งหมด",
                  }),
                  createVNode(_components.td, {
                    children: createVNode("a", {
                      href: typesUrl,
                      "set:html": "<code>รหัสเครื่องมือ</code>",
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
                    children: "แสดงรายการเครื่องมือที่มีสกีมา JSON สำหรับโมเดล",
                  }),
                  createVNode(_components.td, {
                    children: createVNode("a", {
                      href: typesUrl,
                      "set:html": "<code>รายการเครื่องมือ</code>",
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
          '<hr>\n<h3 id="lsp-ฟอร์แมตเตอร์--mcp"><a href="#lsp-ฟอร์แมตเตอร์--mcp">LSP, ฟอร์แมตเตอร์ &#x26; MCP</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "เส้นทาง",
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
                    children: "รับ LSP สถานะเซิร์ฟเวอร์",
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
                    children: "รับสถานะฟอร์แมตเตอร์",
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
                    children: "รับ MCP สถานะเซิร์ฟเวอร์",
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
                  '<td><code dir="auto">POST</code></td><td><code dir="auto">/mcp</code></td><td>เพิ่มเซิร์ฟเวอร์ MCP แบบไดนามิก</td><td>body: <code dir="auto">{ name, config }</code> ส่งคืนออบเจ็กต์สถานะ MCP</td>',
              }),
            ],
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html": '<hr>\n<h3 id="ตัวแทน"><a href="#ตัวแทน">ตัวแทน</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
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
                  children: "เส้นทาง",
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
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h3 id="การบันทึก"><a href="#การบันทึก">การบันทึก</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Method</th><th>เส้นทาง</th><th>คำอธิบาย</th><th>การตอบสนอง</th></tr></thead><tbody><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/log</code></td><td>เขียนรายการบันทึก เนื้อความ: <code dir="auto">{ service, level, message, extra? }</code></td><td><code dir="auto">boolean</code></td></tr></tbody></table>\n<hr>\n<h3 id="tui"><a href="#tui">TUI</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Method</th><th>เส้นทาง</th><th>คำอธิบาย</th><th>การตอบสนอง</th></tr></thead><tbody><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/append-prompt</code></td><td>เพิ่มข้อความต่อท้ายข้อความแจ้ง</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/open-help</code></td><td>เปิดกล่องโต้ตอบความช่วยเหลือ</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/open-sessions</code></td><td>เปิดตัวเลือกเซสชัน</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/open-themes</code></td><td>เปิดตัวเลือกธีม</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/open-models</code></td><td>เปิดตัวเลือกรุ่น</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/submit-prompt</code></td><td>ส่งข้อความแจ้งปัจจุบัน</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/clear-prompt</code></td><td>ล้างข้อความแจ้ง</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/execute-command</code></td><td>ดำเนินการคำสั่ง (<code dir="auto">{ command }</code>)</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/show-toast</code></td><td>โชว์ขนมปังปิ้ง (<code dir="auto">{ title?, message, variant }</code>)</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">GET</code></td><td><code dir="auto">/tui/control/next</code></td><td>รอคำขอควบคุมถัดไป</td><td>วัตถุคำขอควบคุม</td></tr><tr><td><code dir="auto">POST</code></td><td><code dir="auto">/tui/control/response</code></td><td>ตอบสนองต่อคำขอควบคุม (<code dir="auto">{ body }</code>)</td><td><code dir="auto">boolean</code></td></tr></tbody></table>\n<hr>\n<h3 id="การรับรองความถูกต้อง-1"><a href="#การรับรองความถูกต้อง-1">การรับรองความถูกต้อง</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Method</th><th>เส้นทาง</th><th>คำอธิบาย</th><th>การตอบสนอง</th></tr></thead><tbody><tr><td><code dir="auto">PUT</code></td><td><code dir="auto">/auth/:id</code></td><td>ตั้งค่าข้อมูลประจำตัวการรับรองความถูกต้อง เนื้อความต้องตรงกับสคีมาของผู้ให้บริการ</td><td><code dir="auto">boolean</code></td></tr></tbody></table>\n<hr>\n<h3 id="กิจกรรม"><a href="#กิจกรรม">กิจกรรม</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Method</th><th>เส้นทาง</th><th>คำอธิบาย</th><th>การตอบสนอง</th></tr></thead><tbody><tr><td><code dir="auto">GET</code></td><td><code dir="auto">/event</code></td><td>สตรีมเหตุการณ์ที่เซิร์ฟเวอร์ส่ง งานแรกคือ <code dir="auto">server.connected</code> จากนั้นงานรถบัส</td><td>สตรีมเหตุการณ์ที่เซิร์ฟเวอร์ส่ง</td></tr></tbody></table>\n<hr>\n<h3 id="เอกสาร"><a href="#เอกสาร">เอกสาร</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Method</th><th>เส้นทาง</th><th>คำอธิบาย</th><th>การตอบสนอง</th></tr></thead><tbody><tr><td><code dir="auto">GET</code></td><td><code dir="auto">/doc</code></td><td>ข้อมูลจำเพาะของ OpenAPI 3.1</td><td>HTML หน้าพร้อมข้อมูลจำเพาะ OpenAPI</td></tr></tbody></table>',
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

const url = "src/content/docs/th/server.mdx"
const file = "/app/packages/web/src/content/docs/th/server.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/app/packages/web/src/content/docs/th/server.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, typesUrl, url }
