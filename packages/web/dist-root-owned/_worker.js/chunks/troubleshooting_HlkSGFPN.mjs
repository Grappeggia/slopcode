globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"

const frontmatter = {
  title: "การแก้ไขปัญหา",
  description: "ปัญหาทั่วไปและวิธีแก้ปัญหา",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "บันทึก",
      text: "บันทึก",
    },
    {
      depth: 2,
      slug: "พื้นที่จัดเก็บ",
      text: "พื้นที่จัดเก็บ",
    },
    {
      depth: 2,
      slug: "แอปเดสก์ท็อป",
      text: "แอปเดสก์ท็อป",
    },
    {
      depth: 3,
      slug: "การตรวจสอบอย่างรวดเร็ว",
      text: "การตรวจสอบอย่างรวดเร็ว",
    },
    {
      depth: 3,
      slug: "ปิดการใช้งานปลั๊กอิน",
      text: "ปิดการใช้งานปลั๊กอิน",
    },
    {
      depth: 4,
      slug: "ตรวจสอบการกำหนดค่าส่วนกลาง",
      text: "ตรวจสอบการกำหนดค่าส่วนกลาง",
    },
    {
      depth: 4,
      slug: "ตรวจสอบไดเร็กทอรีปลั๊กอิน",
      text: "ตรวจสอบไดเร็กทอรีปลั๊กอิน",
    },
    {
      depth: 3,
      slug: "ล้างแคช",
      text: "ล้างแคช",
    },
    {
      depth: 3,
      slug: "แก้ไขปัญหาการเชื่อมต่อเซิร์ฟเวอร์",
      text: "แก้ไขปัญหาการเชื่อมต่อเซิร์ฟเวอร์",
    },
    {
      depth: 4,
      slug: "ล้างเซิร์ฟเวอร์เริ่มต้นของเดสก์ท็อป-url",
      text: "ล้างเซิร์ฟเวอร์เริ่มต้นของเดสก์ท็อป URL",
    },
    {
      depth: 4,
      slug: "ลบ-serverport--serverhostname-ออกจากการกำหนดค่าของคุณ",
      text: "ลบ server.port / server.hostname ออกจากการกำหนดค่าของคุณ",
    },
    {
      depth: 4,
      slug: "ตรวจสอบตัวแปรสภาพแวดล้อม",
      text: "ตรวจสอบตัวแปรสภาพแวดล้อม",
    },
    {
      depth: 3,
      slug: "linux-ปัญหา-wayland--x11",
      text: "Linux: ปัญหา Wayland / X11",
    },
    {
      depth: 3,
      slug: "windows-รันไทม์-webview2",
      text: "Windows: รันไทม์ WebView2",
    },
    {
      depth: 3,
      slug: "windows-ปัญหาด้านประสิทธิภาพทั่วไป",
      text: "Windows: ปัญหาด้านประสิทธิภาพทั่วไป",
    },
    {
      depth: 3,
      slug: "การแจ้งเตือนไม่แสดง",
      text: "การแจ้งเตือนไม่แสดง",
    },
    {
      depth: 3,
      slug: "รีเซ็ตที่เก็บข้อมูลแอปเดสก์ท็อป-วิธีสุดท้าย",
      text: "รีเซ็ตที่เก็บข้อมูลแอปเดสก์ท็อป (วิธีสุดท้าย)",
    },
    {
      depth: 2,
      slug: "การขอความช่วยเหลือ",
      text: "การขอความช่วยเหลือ",
    },
    {
      depth: 2,
      slug: "ปัญหาทั่วไป",
      text: "ปัญหาทั่วไป",
    },
    {
      depth: 3,
      slug: "slopcode-จะไม่เริ่มทำงาน",
      text: "SlopCode จะไม่เริ่มทำงาน",
    },
    {
      depth: 3,
      slug: "ปัญหาการรับรองความถูกต้อง",
      text: "ปัญหาการรับรองความถูกต้อง",
    },
    {
      depth: 3,
      slug: "ไม่มีรุ่น",
      text: "ไม่มีรุ่น",
    },
    {
      depth: 3,
      slug: "provideriniterror",
      text: "ProviderInitError",
    },
    {
      depth: 3,
      slug: "ai_apicallerror-และปัญหาแพ็คเกจผู้ให้บริการ",
      text: "AI_APICallError และปัญหาแพ็คเกจผู้ให้บริการ",
    },
    {
      depth: 3,
      slug: "copypaste-ไม่ทำงานบน-linux",
      text: "Copy/paste ไม่ทำงานบน Linux",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>หากต้องการแก้ไขข้อบกพร่องเกี่ยวกับ SlopCode ให้เริ่มต้นด้วยการตรวจสอบบันทึกและข้อมูลในเครื่องที่จัดเก็บไว้ในดิสก์</p>\n<hr>\n<h2 id="บันทึก"><a href="#บันทึก">บันทึก</a></h2>\n<p>ไฟล์บันทึกถูกเขียนไปที่:</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.local/share/slopcode/log/</code></li>\n<li><strong>Windows</strong>: กด <code dir="auto">WIN+R</code> แล้ววาง <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode\\log</code></li>\n</ul>\n<p>ไฟล์บันทึกจะถูกตั้งชื่อด้วยการประทับเวลา (เช่น <code dir="auto">2025-01-09T123456.log</code>) และไฟล์บันทึกล่าสุด 10 ไฟล์จะถูกเก็บไว้</p>\n<p>คุณสามารถตั้งค่าระดับการบันทึกด้วยตัวเลือกบรรทัดคำสั่ง <code dir="auto">--log-level</code> เพื่อรับข้อมูลการแก้ไขข้อบกพร่องโดยละเอียดเพิ่มเติม ตัวอย่างเช่น <code dir="auto">slopcode --log-level DEBUG</code></p>\n<hr>\n<h2 id="พื้นที่จัดเก็บ"><a href="#พื้นที่จัดเก็บ">พื้นที่จัดเก็บ</a></h2>\n<p>slopcode เก็บข้อมูลเซสชันและข้อมูลแอปพลิเคชันอื่น ๆ ไว้บนดิสก์ที่:</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.local/share/slopcode/</code></li>\n<li><strong>Windows</strong>: กด <code dir="auto">WIN+R</code> แล้ววาง <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode</code></li>\n</ul>\n<p>ไดเรกทอรีนี้ประกอบด้วย:</p>\n<ul>\n<li><code dir="auto">auth.json</code> - ​​ข้อมูลการตรวจสอบสิทธิ์ เช่น คีย์ API, OAuth Token</li>\n<li><code dir="auto">log/</code> - ​​บันทึกแอปพลิเคชัน</li>\n<li><code dir="auto">project/</code> - ​​ข้อมูลเฉพาะโครงการ เช่น ข้อมูลเซสชันและข้อความ\n<ul>\n<li>หากโปรเจ็กต์อยู่ภายใน repo Git มันจะถูกจัดเก็บไว้ใน <code dir="auto">./&#x3C;project-slug>/storage/</code></li>\n<li>หากไม่ใช่ repo Git มันจะถูกเก็บไว้ใน <code dir="auto">./global/storage/</code></li>\n</ul>\n</li>\n</ul>\n<hr>\n<h2 id="แอปเดสก์ท็อป"><a href="#แอปเดสก์ท็อป">แอปเดสก์ท็อป</a></h2>\n<p>SlopCode Desktop รันเซิร์ฟเวอร์ SlopCode ในเครื่อง (ไฟล์ <code dir="auto">slopcode-cli</code> sidecar) ในเบื้องหลัง ปัญหาส่วนใหญ่มีสาเหตุมาจากปลั๊กอินที่ทำงานผิดปกติ แคชเสียหาย หรือการตั้งค่าเซิร์ฟเวอร์ไม่ถูกต้อง</p>\n<h3 id="การตรวจสอบอย่างรวดเร็ว"><a href="#การตรวจสอบอย่างรวดเร็ว">การตรวจสอบอย่างรวดเร็ว</a></h3>\n<ul>\n<li>ออกจากระบบโดยสมบูรณ์แล้วเปิดแอปใหม่อีกครั้ง</li>\n<li>หากแอปแสดงหน้าจอข้อผิดพลาด ให้คลิก <strong>รีสตาร์ท</strong> และคัดลอกรายละเอียดข้อผิดพลาด</li>\n<li>macOS เท่านั้น: เมนู <code dir="auto">SlopCode</code> -> <strong>โหลด Webview ใหม่</strong> (ช่วยได้หาก UI ว่างเปล่า/frozen)</li>\n</ul>\n<hr>\n<h3 id="ปิดการใช้งานปลั๊กอิน"><a href="#ปิดการใช้งานปลั๊กอิน">ปิดการใช้งานปลั๊กอิน</a></h3>\n<p>หากแอปเดสก์ท็อปขัดข้องเมื่อเปิดใช้งาน หยุดทำงาน หรือทำงานผิดปกติ ให้เริ่มต้นด้วยการปิดใช้งานปลั๊กอิน</p>\n<h4 id="ตรวจสอบการกำหนดค่าส่วนกลาง"><a href="#ตรวจสอบการกำหนดค่าส่วนกลาง">ตรวจสอบการกำหนดค่าส่วนกลาง</a></h4>\n<p>เปิดไฟล์กำหนดค่าส่วนกลางของคุณแล้วมองหาคีย์ <code dir="auto">plugin</code></p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.config/slopcode/slopcode.jsonc</code> (หรือ <code dir="auto">~/.config/slopcode/slopcode.json</code>)</li>\n<li><strong>macOS/Linux</strong> (การติดตั้งเก่ากว่า): <code dir="auto">~/.local/share/slopcode/slopcode.jsonc</code></li>\n<li><strong>Windows</strong>: กด <code dir="auto">WIN+R</code> แล้ววาง <code dir="auto">%USERPROFILE%\\.config\\slopcode\\slopcode.jsonc</code></li>\n</ul>\n<p>หากคุณได้กำหนดค่าปลั๊กอินไว้ ให้ปิดการใช้งานชั่วคราวโดยลบคีย์ออกหรือตั้งค่าเป็นอาร์เรย์ว่าง:</p>\n<div class="expressive-code"><link rel="stylesheet" href="/docs/_astro/ec.4c0k7.css"><script type="module" src="/docs/_astro/ec.0vx5m.js"></script><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="jsonc"><code><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">{</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"$schema"</span><span style="--0:#24292E;--1:#E1E4E8">: </span><span style="--0:#032F62;--1:#9ECBFF">"https://slopcode.dev/config.json"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"plugin"</span><span style="--0:#24292E;--1:#E1E4E8">: [],</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">}</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="{  &#x22;$schema&#x22;: &#x22;https://slopcode.dev/config.json&#x22;,  &#x22;plugin&#x22;: [],}"><div></div></button></div></figure></div>\n<h4 id="ตรวจสอบไดเร็กทอรีปลั๊กอิน"><a href="#ตรวจสอบไดเร็กทอรีปลั๊กอิน">ตรวจสอบไดเร็กทอรีปลั๊กอิน</a></h4>\n<p>SlopCode ยังสามารถโหลดปลั๊กอินในเครื่องจากดิสก์ได้ ย้ายสิ่งเหล่านี้ออกไปชั่วคราว (หรือเปลี่ยนชื่อโฟลเดอร์) และรีสตาร์ทแอปเดสก์ท็อป:</p>\n<ul>\n<li><strong>ปลั๊กอินสากล</strong>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.config/slopcode/plugins/</code></li>\n<li><strong>Windows</strong>: กด <code dir="auto">WIN+R</code> แล้ววาง <code dir="auto">%USERPROFILE%\\.config\\slopcode\\plugins</code></li>\n</ul>\n</li>\n<li><strong>ปลั๊กอินโครงการ</strong> (เฉพาะในกรณีที่คุณใช้การกำหนดค่าต่อโครงการ)\n<ul>\n<li><code dir="auto">&#x3C;your-project>/.slopcode/plugins/</code></li>\n</ul>\n</li>\n</ul>\n<p>หากแอปเริ่มทำงานอีกครั้ง ให้เปิดใช้งานปลั๊กอินอีกครั้งทีละรายการเพื่อดูว่าปลั๊กอินใดเป็นสาเหตุของปัญหา</p>\n<hr>\n<h3 id="ล้างแคช"><a href="#ล้างแคช">ล้างแคช</a></h3>\n<p>หากการปิดใช้งานปลั๊กอินไม่ได้ผล (หรือการติดตั้งปลั๊กอินค้าง) ให้ล้างแคชเพื่อให้ SlopCode สามารถสร้างใหม่ได้</p>\n<ol>\n<li>ออกจาก SlopCode Desktop โดยสมบูรณ์</li>\n<li>ลบไดเรกทอรีแคช:</li>\n</ol>\n<ul>\n<li><strong>macOS</strong>: ตัวค้นหา -> <code dir="auto">Cmd+Shift+G</code> -> วาง <code dir="auto">~/.cache/slopcode</code></li>\n<li><strong>Linux</strong>: ลบ <code dir="auto">~/.cache/slopcode</code> (หรือรัน <code dir="auto">rm -rf ~/.cache/slopcode</code>)</li>\n<li><strong>Windows</strong>: กด <code dir="auto">WIN+R</code> แล้ววาง <code dir="auto">%USERPROFILE%\\.cache\\slopcode</code></li>\n</ul>\n<ol start="3">\n<li>รีสตาร์ทเดสก์ท็อป SlopCode</li>\n</ol>\n<hr>\n<h3 id="แก้ไขปัญหาการเชื่อมต่อเซิร์ฟเวอร์"><a href="#แก้ไขปัญหาการเชื่อมต่อเซิร์ฟเวอร์">แก้ไขปัญหาการเชื่อมต่อเซิร์ฟเวอร์</a></h3>\n<p>SlopCode Desktop สามารถเริ่มต้นเซิร์ฟเวอร์ภายในเครื่องของตนเองได้ (ค่าเริ่มต้น) หรือเชื่อมต่อกับเซิร์ฟเวอร์ URL ที่คุณกำหนดค่าไว้</p>\n<p>หากคุณเห็นกล่องโต้ตอบ <strong>“การเชื่อมต่อล้มเหลว”</strong> (หรือแอปไม่เคยผ่านหน้าจอเริ่มต้น) ให้ตรวจสอบเซิร์ฟเวอร์ที่กำหนดเอง URL</p>\n<h4 id="ล้างเซิร์ฟเวอร์เริ่มต้นของเดสก์ท็อป-url"><a href="#ล้างเซิร์ฟเวอร์เริ่มต้นของเดสก์ท็อป-url">ล้างเซิร์ฟเวอร์เริ่มต้นของเดสก์ท็อป URL</a></h4>\n<p>จากหน้าจอหลัก คลิกชื่อเซิร์ฟเวอร์ (ที่มีจุดสถานะ) เพื่อเปิดตัวเลือกเซิร์ฟเวอร์ ในส่วน <strong>เซิร์ฟเวอร์เริ่มต้น</strong> คลิก <strong>ล้าง</strong></p>\n<h4 id="ลบ-serverport--serverhostname-ออกจากการกำหนดค่าของคุณ"><a href="#ลบ-serverport--serverhostname-ออกจากการกำหนดค่าของคุณ">ลบ <code dir="auto">server.port</code> / <code dir="auto">server.hostname</code> ออกจากการกำหนดค่าของคุณ</a></h4>\n<p>หาก <code dir="auto">slopcode.json(c)</code> ของคุณมีส่วน <code dir="auto">server</code> ให้ลบออกชั่วคราวแล้วรีสตาร์ทแอปเดสก์ท็อป</p>\n<h4 id="ตรวจสอบตัวแปรสภาพแวดล้อม"><a href="#ตรวจสอบตัวแปรสภาพแวดล้อม">ตรวจสอบตัวแปรสภาพแวดล้อม</a></h4>\n<p>หากคุณตั้งค่า <code dir="auto">SLOPCODE_PORT</code> ในสภาพแวดล้อมของคุณ แอปเดสก์ท็อปจะพยายามใช้พอร์ตนั้นสำหรับเซิร์ฟเวอร์ภายในเครื่อง</p>\n<ul>\n<li>ยกเลิกการตั้งค่า <code dir="auto">SLOPCODE_PORT</code> (หรือเลือกพอร์ตว่าง) แล้วรีสตาร์ท</li>\n</ul>\n<hr>\n<h3 id="linux-ปัญหา-wayland--x11"><a href="#linux-ปัญหา-wayland--x11">Linux: ปัญหา Wayland / X11</a></h3>\n<p>บน Linux การตั้งค่า Wayland บางอย่างอาจทำให้เกิดหน้าต่างว่างหรือข้อผิดพลาดของตัวประกอบ</p>\n<ul>\n<li>หากคุณอยู่บน Wayland และแอปว่างเปล่า/crashing ให้ลองเปิดใช้งานด้วย <code dir="auto">OC_ALLOW_WAYLAND=1</code></li>\n<li>หากสิ่งนั้นทำให้สิ่งต่าง ๆ แย่ลง ให้ลบออกแล้วลองเปิดใช้งานภายใต้เซสชัน X11 แทน</li>\n</ul>\n<hr>\n<h3 id="windows-รันไทม์-webview2"><a href="#windows-รันไทม์-webview2">Windows: รันไทม์ WebView2</a></h3>\n<p>บน Windows SlopCode Desktop ต้องใช้ Microsoft Edge <strong>WebView2 Runtime</strong> หากแอปเปิดเป็นหน้าต่างว่างหรือไม่เริ่มทำงาน ให้ติดตั้ง/update WebView2 แล้วลองอีกครั้ง</p>\n<hr>\n<h3 id="windows-ปัญหาด้านประสิทธิภาพทั่วไป"><a href="#windows-ปัญหาด้านประสิทธิภาพทั่วไป">Windows: ปัญหาด้านประสิทธิภาพทั่วไป</a></h3>\n<p>หากคุณประสบปัญหาประสิทธิภาพการทำงานช้า ปัญหาการเข้าถึงไฟล์ หรือปัญหา terminal บน Windows ให้ลองใช้ <a href="/docs/windows-wsl">WSL (ระบบย่อย Windows สำหรับ Linux)</a> WSL มอบสภาพแวดล้อม Linux ที่ทำงานร่วมกับคุณสมบัติของ SlopCode ได้อย่างราบรื่นยิ่งขึ้น</p>\n<hr>\n<h3 id="การแจ้งเตือนไม่แสดง"><a href="#การแจ้งเตือนไม่แสดง">การแจ้งเตือนไม่แสดง</a></h3>\n<p>SlopCode Desktop จะแสดงการแจ้งเตือนของระบบเฉพาะเมื่อ:</p>\n<ul>\n<li>การแจ้งเตือนเปิดใช้งานสำหรับ SlopCode ในการตั้งค่าระบบปฏิบัติการของคุณและ</li>\n<li>หน้าต่างแอพไม่ได้โฟกัส</li>\n</ul>\n<hr>\n<h3 id="รีเซ็ตที่เก็บข้อมูลแอปเดสก์ท็อป-วิธีสุดท้าย"><a href="#รีเซ็ตที่เก็บข้อมูลแอปเดสก์ท็อป-วิธีสุดท้าย">รีเซ็ตที่เก็บข้อมูลแอปเดสก์ท็อป (วิธีสุดท้าย)</a></h3>\n<p>หากแอปไม่เริ่มทำงานและคุณไม่สามารถล้างการตั้งค่าจากภายใน UI ได้ ให้รีเซ็ตสถานะที่บันทึกไว้ของแอปเดสก์ท็อป</p>\n<ol>\n<li>ออกจากเดสก์ท็อป SlopCode</li>\n<li>ค้นหาและลบไฟล์เหล่านี้ (อยู่ในไดเร็กทอรีข้อมูลแอป SlopCode Desktop):</li>\n</ol>\n<ul>\n<li><code dir="auto">slopcode.settings.dat</code> (เซิร์ฟเวอร์เริ่มต้นของเดสก์ท็อป URL)</li>\n<li><code dir="auto">slopcode.global.dat</code> และ <code dir="auto">slopcode.workspace.*.dat</code> (สถานะ UI เช่น เซิร์ฟเวอร์ล่าสุด/projects)</li>\n</ul>\n<p>หากต้องการค้นหาไดเร็กทอรีอย่างรวดเร็ว:</p>\n<ul>\n<li><strong>macOS</strong>: Finder -> <code dir="auto">Cmd+Shift+G</code> -> <code dir="auto">~/Library/Application Support</code> (จากนั้นค้นหาชื่อไฟล์ด้านบน)</li>\n<li><strong>Linux</strong>: ค้นหาภายใต้ <code dir="auto">~/.local/share</code> สำหรับชื่อไฟล์ด้านบน</li>\n<li><strong>Windows</strong>: กด <code dir="auto">WIN+R</code> -> <code dir="auto">%APPDATA%</code> (จากนั้นค้นหาชื่อไฟล์ด้านบน)</li>\n</ul>\n<hr>\n<h2 id="การขอความช่วยเหลือ"><a href="#การขอความช่วยเหลือ">การขอความช่วยเหลือ</a></h2>\n<p>หากคุณประสบปัญหากับ SlopCode:</p>\n<ol>\n<li>\n<p><strong>รายงานปัญหาเกี่ยวกับ GitHub</strong></p>\n<p>วิธีที่ดีที่สุดในการรายงานจุดบกพร่องหรือขอคุณสมบัติคือผ่านพื้นที่เก็บข้อมูล GitHub ของเรา:</p>\n<p><a href="http://github.com/teamslop/slopcode/issues"><strong>github.com/teamslop/slopcode/issues</strong></a></p>\n<p>ก่อนที่จะสร้างปัญหาใหม่ ให้ค้นหาปัญหาที่มีอยู่เพื่อดูว่าปัญหาของคุณได้รับการรายงานแล้วหรือไม่</p>\n</li>\n<li>\n<p><strong>เข้าร่วม Discord ของเรา</strong></p>\n<p>สำหรับความช่วยเหลือแบบเรียลไทม์และการสนทนาในชุมชน เข้าร่วมเซิร์ฟเวอร์ Discord ของเรา:</p>\n<p><a href="https://slopcode.dev/discord"><strong>slopcode.dev/discord</strong></a></p>\n</li>\n</ol>\n<hr>\n<h2 id="ปัญหาทั่วไป"><a href="#ปัญหาทั่วไป">ปัญหาทั่วไป</a></h2>\n<p>ต่อไปนี้เป็นปัญหาทั่วไปบางประการและวิธีแก้ปัญหา</p>\n<hr>\n<h3 id="slopcode-จะไม่เริ่มทำงาน"><a href="#slopcode-จะไม่เริ่มทำงาน">SlopCode จะไม่เริ่มทำงาน</a></h3>\n<ol>\n<li>ตรวจสอบบันทึกเพื่อดูข้อความแสดงข้อผิดพลาด</li>\n<li>ลองรันด้วย <code dir="auto">--print-logs</code> เพื่อดูเอาต์พุตใน terminal</li>\n<li>ตรวจสอบให้แน่ใจว่าคุณมีเวอร์ชันล่าสุดด้วย <code dir="auto">slopcode upgrade</code></li>\n</ol>\n<hr>\n<h3 id="ปัญหาการรับรองความถูกต้อง"><a href="#ปัญหาการรับรองความถูกต้อง">ปัญหาการรับรองความถูกต้อง</a></h3>\n<ol>\n<li>ลองตรวจสอบความถูกต้องอีกครั้งด้วยคำสั่ง <code dir="auto">/connect</code> ใน TUI</li>\n<li>ตรวจสอบว่าคีย์ API ของคุณถูกต้อง</li>\n<li>ตรวจสอบให้แน่ใจว่าเครือข่ายของคุณอนุญาตการเชื่อมต่อกับ API ของผู้ให้บริการ</li>\n</ol>\n<hr>\n<h3 id="ไม่มีรุ่น"><a href="#ไม่มีรุ่น">ไม่มีรุ่น</a></h3>\n<ol>\n<li>ตรวจสอบว่าคุณได้รับการรับรองความถูกต้องกับผู้ให้บริการแล้ว</li>\n<li>ตรวจสอบชื่อรุ่นในการกำหนดค่าของคุณถูกต้อง</li>\n<li>บางรุ่นอาจต้องมีการเข้าถึงหรือสมัครสมาชิกโดยเฉพาะ</li>\n</ol>\n<p>หากคุณพบ <code dir="auto">ProviderModelNotFoundError</code> เป็นไปได้มากว่าคุณจะคิดผิด\nอ้างอิงแบบจำลองที่ไหนสักแห่ง\nควรอ้างอิงโมเดลดังนี้: <code dir="auto">&#x3C;providerId>/&#x3C;modelId></code></p>\n<p>ตัวอย่าง:</p>\n<ul>\n<li><code dir="auto">openai/gpt-4.1</code></li>\n<li><code dir="auto">openrouter/google/gemini-2.5-flash</code></li>\n<li><code dir="auto">slopcode/kimi-k2</code></li>\n</ul>\n<p>หากต้องการทราบว่าคุณมีสิทธิ์เข้าถึงรุ่นใด ให้เรียกใช้ <code dir="auto">slopcode models</code></p>\n<hr>\n<h3 id="provideriniterror"><a href="#provideriniterror">ProviderInitError</a></h3>\n<p>หากคุณพบ ProviderInitError คุณอาจมีการกำหนดค่าที่ไม่ถูกต้องหรือเสียหาย</p>\n<p>เพื่อแก้ไขปัญหานี้:</p>\n<ol>\n<li>\n<p>ขั้นแรก ตรวจสอบให้แน่ใจว่าผู้ให้บริการของคุณตั้งค่าอย่างถูกต้องโดยทำตาม <a href="/docs/providers">คู่มือผู้ให้บริการ</a></p>\n</li>\n<li>\n<p>หากปัญหายังคงอยู่ ให้ลองล้างการกำหนดค่าที่เก็บไว้:</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">rm</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-rf</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">~/.local/share/slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="rm -rf ~/.local/share/slopcode"><div></div></button></div></figure></div>\n<p>บน Windows กด <code dir="auto">WIN+R</code> และลบ: <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode</code></p>\n</li>\n<li>\n<p>ตรวจสอบความถูกต้องอีกครั้งกับผู้ให้บริการของคุณโดยใช้คำสั่ง <code dir="auto">/connect</code> ใน TUI</p>\n</li>\n</ol>\n<hr>\n<h3 id="ai_apicallerror-และปัญหาแพ็คเกจผู้ให้บริการ"><a href="#ai_apicallerror-และปัญหาแพ็คเกจผู้ให้บริการ">AI_APICallError และปัญหาแพ็คเกจผู้ให้บริการ</a></h3>\n<p>หากคุณพบข้อผิดพลาดในการโทร API อาจเนื่องมาจากแพ็คเกจผู้ให้บริการที่ล้าสมัย slopcode จะติดตั้งแพ็คเกจของผู้ให้บริการแบบไดนามิก (OpenAI, Anthropic, Google ฯลฯ) ตามความจำเป็น และแคชไว้ในเครื่อง</p>\n<p>ในการแก้ไขปัญหาแพ็คเกจผู้ให้บริการ:</p>\n<ol>\n<li>\n<p>ล้างแคชแพ็คเกจผู้ให้บริการ:</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">rm</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-rf</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">~/.cache/slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="rm -rf ~/.cache/slopcode"><div></div></button></div></figure></div>\n<p>บน Windows กด <code dir="auto">WIN+R</code> และลบ: <code dir="auto">%USERPROFILE%\\.cache\\slopcode</code></p>\n</li>\n<li>\n<p>รีสตาร์ท slopcode เพื่อติดตั้งแพ็คเกจผู้ให้บริการล่าสุดอีกครั้ง</p>\n</li>\n</ol>\n<p>การดำเนินการนี้จะบังคับให้ slopcode ดาวน์โหลดแพ็คเกจผู้ให้บริการเวอร์ชันล่าสุด ซึ่งมักจะแก้ไขปัญหาความเข้ากันได้กับพารามิเตอร์โมเดลและการเปลี่ยนแปลง API</p>\n<hr>\n<h3 id="copypaste-ไม่ทำงานบน-linux"><a href="#copypaste-ไม่ทำงานบน-linux">Copy/paste ไม่ทำงานบน Linux</a></h3>\n<p>ผู้ใช้ Linux จำเป็นต้องติดตั้งยูทิลิตี้คลิปบอร์ดตัวใดตัวหนึ่งต่อไปนี้เพื่อให้ฟังก์ชัน copy/paste ทำงาน:</p>\n<p><strong>สำหรับระบบ X11:</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xclip</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># or</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xsel</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y xclipapt install -y xsel"><div></div></button></div></figure></div>\n<p><strong>สำหรับระบบ Wayland:</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">wl-clipboard</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y wl-clipboard"><div></div></button></div></figure></div>\n<p><strong>สำหรับสภาพแวดล้อมที่ไม่มีหัว:</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xvfb</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># and run:</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">Xvfb</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">:99</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-screen</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">0</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">1024x768x24</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">></span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">/dev/null</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">2>&#x26;1</span><span style="--0:#24292E;--1:#E1E4E8"> &#x26;</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">export</span><span style="--0:#24292E;--1:#E1E4E8"> DISPLAY</span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8">:99.0</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y xvfbXvfb :99 -screen 0 1024x768x24 > /dev/null 2>&#x26;1 &#x26;export DISPLAY=:99.0"><div></div></button></div></figure></div>\n<p>slopcode จะตรวจพบว่าคุณใช้ Wayland และชอบ <code dir="auto">wl-clipboard</code> หรือไม่เช่นนั้นจะพยายามค้นหาเครื่องมือคลิปบอร์ดตามลำดับ: <code dir="auto">xclip</code> และ <code dir="auto">xsel</code></p>',
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
const url = "src/content/docs/th/troubleshooting.mdx"
const file =
  "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/troubleshooting.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId =
  "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/th/troubleshooting.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
