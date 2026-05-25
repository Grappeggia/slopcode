globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"
import { c as config } from "./config_UI6PtV27.mjs"

const frontmatter = {
  title: "SDK",
  description: "slopcode sunucusu için type-safe JS istemcisi.",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "kurulum",
      text: "Kurulum",
    },
    {
      depth: 2,
      slug: "i̇stemci-oluşturma",
      text: "İstemci Oluşturma",
    },
    {
      depth: 4,
      slug: "seçenekler",
      text: "Seçenekler",
    },
    {
      depth: 2,
      slug: "yapılandırma",
      text: "Yapılandırma",
    },
    {
      depth: 2,
      slug: "yalnızca-istemci",
      text: "Yalnızca istemci",
    },
    {
      depth: 4,
      slug: "seçenekler-1",
      text: "Seçenekler",
    },
    {
      depth: 2,
      slug: "türler",
      text: "Türler",
    },
    {
      depth: 2,
      slug: "hatalar",
      text: "Hatalar",
    },
    {
      depth: 2,
      slug: "apiler",
      text: "API’ler",
    },
    {
      depth: 3,
      slug: "global",
      text: "Global",
    },
    {
      depth: 4,
      slug: "örnekler",
      text: "Örnekler",
    },
    {
      depth: 3,
      slug: "app",
      text: "App",
    },
    {
      depth: 4,
      slug: "örnekler-1",
      text: "Örnekler",
    },
    {
      depth: 3,
      slug: "project",
      text: "Project",
    },
    {
      depth: 4,
      slug: "örnekler-2",
      text: "Örnekler",
    },
    {
      depth: 3,
      slug: "path",
      text: "Path",
    },
    {
      depth: 4,
      slug: "örnekler-3",
      text: "Örnekler",
    },
    {
      depth: 3,
      slug: "config",
      text: "Config",
    },
    {
      depth: 4,
      slug: "örnekler-4",
      text: "Örnekler",
    },
    {
      depth: 3,
      slug: "oturumlar",
      text: "Oturumlar",
    },
    {
      depth: 4,
      slug: "örnekler-5",
      text: "Örnekler",
    },
    {
      depth: 3,
      slug: "dosyalar",
      text: "Dosyalar",
    },
    {
      depth: 4,
      slug: "örnekler-6",
      text: "Örnekler",
    },
    {
      depth: 3,
      slug: "tui",
      text: "TUI",
    },
    {
      depth: 4,
      slug: "örnekler-7",
      text: "Örnekler",
    },
    {
      depth: 3,
      slug: "auth",
      text: "Auth",
    },
    {
      depth: 4,
      slug: "örnekler-8",
      text: "Örnekler",
    },
    {
      depth: 3,
      slug: "olaylar",
      text: "Olaylar",
    },
    {
      depth: 4,
      slug: "örnekler-9",
      text: "Örnekler",
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
          '<p>slopcode JS/TS SDK, sunucu ile etkileşmek için type-safe bir istemci sağlar.\nslopcode’u programatik olarak kontrol etmek ve entegrasyonlar oluşturmak için kullanabilirsiniz.</p>\n<p><a href="/docs/server">Sunucu</a> sayfasında nasıl çalıştığını görebilir, örnekler için topluluğun oluşturduğu <a href="/docs/ecosystem#projects">projeler</a> bölümüne bakabilirsiniz.</p>\n<hr>\n<h2 id="kurulum"><a href="#kurulum">Kurulum</a></h2>\n<p>SDK’yı npm’den yükleyin:</p>\n<div class="expressive-code"><link rel="stylesheet" href="/docs/_astro/ec.4c0k7.css"><script type="module" src="/docs/_astro/ec.0vx5m.js"></script><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">npm</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">@slopcode-ai/sdk</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="npm install @slopcode-ai/sdk"><div></div></button></div></figure></div>\n<hr>\n<h2 id="i̇stemci-oluşturma"><a href="#i̇stemci-oluşturma">İstemci Oluşturma</a></h2>\n<p>Bir slopcode örneği oluşturun:</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">import</span><span style="--0:#24292E;--1:#E1E4E8"> { createSlopcode } </span><span style="--0:#BF3441;--1:#F97583">from</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">"@slopcode-ai/sdk"</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> { </span><span style="--0:#005CC5;--1:#79B8FF">client</span><span style="--0:#24292E;--1:#E1E4E8"> } </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#6F42C1;--1:#B392F0">createSlopcode</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="import { createSlopcode } from &#x22;@slopcode-ai/sdk&#x22;const { client } = await createSlopcode()"><div></div></button></div></figure></div>\n<p>Bu, hem bir sunucu hem de bir istemci başlatır</p>\n<h4 id="seçenekler"><a href="#seçenekler">Seçenekler</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Seçenek</th><th>Tip</th><th>Açıklama</th><th>Varsayılan</th></tr></thead><tbody><tr><td><code dir="auto">hostname</code></td><td><code dir="auto">string</code></td><td>Sunucu ana bilgisayar adı</td><td><code dir="auto">127.0.0.1</code></td></tr><tr><td><code dir="auto">port</code></td><td><code dir="auto">number</code></td><td>Sunucu bağlantı noktası</td><td><code dir="auto">4096</code></td></tr><tr><td><code dir="auto">signal</code></td><td><code dir="auto">AbortSignal</code></td><td>İptal için durdurma sinyali</td><td><code dir="auto">undefined</code></td></tr><tr><td><code dir="auto">timeout</code></td><td><code dir="auto">number</code></td><td>Sunucu başlatma için ms cinsinden zaman aşımı</td><td><code dir="auto">5000</code></td></tr><tr><td><code dir="auto">config</code></td><td><code dir="auto">Config</code></td><td>Yapılandırma nesnesi</td><td><code dir="auto">{}</code></td></tr></tbody></table>\n<hr>\n<h2 id="yapılandırma"><a href="#yapılandırma">Yapılandırma</a></h2>\n<p>Davranışı özelleştirmek için bir yapılandırma nesnesi iletebilirsiniz. Örnek yine de <code dir="auto">slopcode.json</code> dosyanızı alır, ancak yapılandırmayı satır içi olarak geçersiz kılabilir veya ekleyebilirsiniz:</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">import</span><span style="--0:#24292E;--1:#E1E4E8"> { createSlopcode } </span><span style="--0:#BF3441;--1:#F97583">from</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">"@slopcode-ai/sdk"</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">slopcode</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#6F42C1;--1:#B392F0">createSlopcode</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">hostname: </span><span style="--0:#032F62;--1:#9ECBFF">"127.0.0.1"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">port: </span><span style="--0:#005CC5;--1:#79B8FF">4096</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">config: {</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">model: </span><span style="--0:#032F62;--1:#9ECBFF">"anthropic/claude-3-5-sonnet-20241022"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">},</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">console.</span><span style="--0:#6F42C1;--1:#B392F0">log</span><span style="--0:#24292E;--1:#E1E4E8">(</span><span style="--0:#032F62;--1:#9ECBFF">`Server running at ${</span><span style="--0:#24292E;--1:#E1E4E8">slopcode</span><span style="--0:#032F62;--1:#9ECBFF">.</span><span style="--0:#24292E;--1:#E1E4E8">server</span><span style="--0:#032F62;--1:#9ECBFF">.</span><span style="--0:#24292E;--1:#E1E4E8">url</span><span style="--0:#032F62;--1:#9ECBFF">}`</span><span style="--0:#24292E;--1:#E1E4E8">)</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">slopcode.server.</span><span style="--0:#6F42C1;--1:#B392F0">close</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="import { createSlopcode } from &#x22;@slopcode-ai/sdk&#x22;const slopcode = await createSlopcode({  hostname: &#x22;127.0.0.1&#x22;,  port: 4096,  config: {    model: &#x22;anthropic/claude-3-5-sonnet-20241022&#x22;,  },})console.log(&#x60;Server running at ${slopcode.server.url}&#x60;)slopcode.server.close()"><div></div></button></div></figure></div>\n<h2 id="yalnızca-istemci"><a href="#yalnızca-istemci">Yalnızca istemci</a></h2>\n<p>Halihazırda çalışan bir slopcode örneğiniz varsa, ona bağlanmak için bir istemci örneği oluşturabilirsiniz:</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">import</span><span style="--0:#24292E;--1:#E1E4E8"> { createSlopcodeClient } </span><span style="--0:#BF3441;--1:#F97583">from</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">"@slopcode-ai/sdk"</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">client</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#6F42C1;--1:#B392F0">createSlopcodeClient</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">baseUrl: </span><span style="--0:#032F62;--1:#9ECBFF">"http://localhost:4096"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="import { createSlopcodeClient } from &#x22;@slopcode-ai/sdk&#x22;const client = createSlopcodeClient({  baseUrl: &#x22;http://localhost:4096&#x22;,})"><div></div></button></div></figure></div>\n<h4 id="seçenekler-1"><a href="#seçenekler-1">Seçenekler</a></h4>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Seçenek</th><th>Tip</th><th>Açıklama</th><th>Varsayılan</th></tr></thead><tbody><tr><td><code dir="auto">baseUrl</code></td><td><code dir="auto">string</code></td><td>Sunucunun URL’si</td><td><code dir="auto">http://localhost:4096</code></td></tr><tr><td><code dir="auto">fetch</code></td><td><code dir="auto">function</code></td><td>Özel fetch uygulaması</td><td><code dir="auto">globalThis.fetch</code></td></tr><tr><td><code dir="auto">parseAs</code></td><td><code dir="auto">string</code></td><td>Yanıt ayrıştırma yöntemi</td><td><code dir="auto">auto</code></td></tr><tr><td><code dir="auto">responseStyle</code></td><td><code dir="auto">string</code></td><td>Dönüş stili: <code dir="auto">data</code> veya <code dir="auto">fields</code></td><td><code dir="auto">fields</code></td></tr><tr><td><code dir="auto">throwOnError</code></td><td><code dir="auto">boolean</code></td><td>Dönüş yerine hata fırlat</td><td><code dir="auto">false</code></td></tr></tbody></table>\n<hr>\n<h2 id="türler"><a href="#türler">Türler</a></h2>\n<p>SDK, tüm API türleri için TypeScript tanımlarını içerir. Bunları doğrudan içe aktarın:</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="typescript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">import</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">type</span><span style="--0:#24292E;--1:#E1E4E8"> { Session, Message, Part } </span><span style="--0:#BF3441;--1:#F97583">from</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">"@slopcode-ai/sdk"</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="import type { Session, Message, Part } from &#x22;@slopcode-ai/sdk&#x22;"><div></div></button></div></figure></div>\n',
      }),
      createVNode(_components.p, {
        children: [
          "Tüm tipler, sunucunun OpenAPI spesifikasyonundan oluşturulur ve ",
          createVNode("a", {
            href: typesUrl,
            "set:html": "tipler dosyasında",
          }),
          " mevcuttur.",
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h2 id="hatalar"><a href="#hatalar">Hatalar</a></h2>\n<p>SDK, yakalayabileceğiniz ve işleyebileceğiniz hatalar fırlatabilir:</p>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="typescript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">try</span><span style="--0:#24292E;--1:#E1E4E8"> {</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.session.</span><span style="--0:#6F42C1;--1:#B392F0">get</span><span style="--0:#24292E;--1:#E1E4E8">({ path: { id: </span><span style="--0:#032F62;--1:#9ECBFF">"invalid-id"</span><span style="--0:#24292E;--1:#E1E4E8"> } })</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">} </span><span style="--0:#BF3441;--1:#F97583">catch</span><span style="--0:#24292E;--1:#E1E4E8"> (error) {</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">console.</span><span style="--0:#6F42C1;--1:#B392F0">error</span><span style="--0:#24292E;--1:#E1E4E8">(</span><span style="--0:#032F62;--1:#9ECBFF">"Failed to get session:"</span><span style="--0:#24292E;--1:#E1E4E8">, (error </span><span style="--0:#BF3441;--1:#F97583">as</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#6F42C1;--1:#B392F0">Error</span><span style="--0:#24292E;--1:#E1E4E8">).message)</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">}</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="try {  await client.session.get({ path: { id: &#x22;invalid-id&#x22; } })} catch (error) {  console.error(&#x22;Failed to get session:&#x22;, (error as Error).message)}"><div></div></button></div></figure></div>\n<hr>\n<h2 id="apiler"><a href="#apiler">API’ler</a></h2>\n<p>SDK, tüm sunucu API’lerini type-safe bir istemci aracılığıyla sunar.</p>\n<hr>\n<h3 id="global"><a href="#global">Global</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Yöntem</th><th>Açıklama</th><th>Yanıt</th></tr></thead><tbody><tr><td><code dir="auto">global.health()</code></td><td>Sunucu sağlığını ve sürümünü kontrol et</td><td><code dir="auto">{ healthy: true, version: string }</code></td></tr></tbody></table>\n<hr>\n<h4 id="örnekler"><a href="#örnekler">Örnekler</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">health</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.global.</span><span style="--0:#6F42C1;--1:#B392F0">health</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">console.</span><span style="--0:#6F42C1;--1:#B392F0">log</span><span style="--0:#24292E;--1:#E1E4E8">(health.data.version)</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="const health = await client.global.health()console.log(health.data.version)"><div></div></button></div></figure></div>\n<hr>\n<h3 id="app"><a href="#app">App</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "Yöntem",
                }),
                createVNode(_components.th, {
                  children: "Açıklama",
                }),
                createVNode(_components.th, {
                  children: "Yanıt",
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
                    children: "Bir günlük girdisi yaz",
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
                    children: "Tüm mevcut agent’ları listele",
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
          '<hr>\n<h4 id="örnekler-1"><a href="#örnekler-1">Örnekler</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Write a log entry</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.app.</span><span style="--0:#6F42C1;--1:#B392F0">log</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">body: {</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">service: </span><span style="--0:#032F62;--1:#9ECBFF">"my-app"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">level: </span><span style="--0:#032F62;--1:#9ECBFF">"info"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">message: </span><span style="--0:#032F62;--1:#9ECBFF">"Operation completed"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">},</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// List available agents</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">agents</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.app.</span><span style="--0:#6F42C1;--1:#B392F0">agents</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="// Write a log entryawait client.app.log({  body: {    service: &#x22;my-app&#x22;,    level: &#x22;info&#x22;,    message: &#x22;Operation completed&#x22;,  },})// List available agentsconst agents = await client.app.agents()"><div></div></button></div></figure></div>\n<hr>\n<h3 id="project"><a href="#project">Project</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "Yöntem",
                }),
                createVNode(_components.th, {
                  children: "Açıklama",
                }),
                createVNode(_components.th, {
                  children: "Yanıt",
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
                    children: "Tüm projeleri listele",
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
                    children: "Mevcut projeyi al",
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
          '<hr>\n<h4 id="örnekler-2"><a href="#örnekler-2">Örnekler</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// List all projects</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">projects</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.project.</span><span style="--0:#6F42C1;--1:#B392F0">list</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Get current project</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">currentProject</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.project.</span><span style="--0:#6F42C1;--1:#B392F0">current</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="// List all projectsconst projects = await client.project.list()// Get current projectconst currentProject = await client.project.current()"><div></div></button></div></figure></div>\n<hr>\n<h3 id="path"><a href="#path">Path</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "Yöntem",
                }),
                createVNode(_components.th, {
                  children: "Açıklama",
                }),
                createVNode(_components.th, {
                  children: "Yanıt",
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
                  children: "Mevcut yolu al",
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
          '<hr>\n<h4 id="örnekler-3"><a href="#örnekler-3">Örnekler</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Get current path information</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">pathInfo</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.path.</span><span style="--0:#6F42C1;--1:#B392F0">get</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="// Get current path informationconst pathInfo = await client.path.get()"><div></div></button></div></figure></div>\n<hr>\n<h3 id="config"><a href="#config">Config</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "Yöntem",
                }),
                createVNode(_components.th, {
                  children: "Açıklama",
                }),
                createVNode(_components.th, {
                  children: "Yanıt",
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
                    children: "Yapılandırma bilgisini al",
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
                    children: "Sağlayıcıları ve varsayılan modelleri listele",
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
          '<hr>\n<h4 id="örnekler-4"><a href="#örnekler-4">Örnekler</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">config</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.config.</span><span style="--0:#6F42C1;--1:#B392F0">get</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> { </span><span style="--0:#005CC5;--1:#79B8FF">providers</span><span style="--0:#24292E;--1:#E1E4E8">, </span><span style="--0:#AE4B07;--1:#FFAB70">default</span><span style="--0:#24292E;--1:#E1E4E8">: </span><span style="--0:#005CC5;--1:#79B8FF">defaults</span><span style="--0:#24292E;--1:#E1E4E8"> } </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.config.</span><span style="--0:#6F42C1;--1:#B392F0">providers</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="const config = await client.config.get()const { providers, default: defaults } = await client.config.providers()"><div></div></button></div></figure></div>\n<hr>\n<h3 id="oturumlar"><a href="#oturumlar">Oturumlar</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "Yöntem",
                }),
                createVNode(_components.th, {
                  children: "Açıklama",
                }),
                createVNode(_components.th, {
                  children: "Notlar",
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
                    children: "Oturumları listele",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>Session[]</code>",
                      }),
                      " döndürür",
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
                    children: "Oturum al",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>Session</code>",
                      }),
                      " döndürür",
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
                    children: "Alt oturumları listele",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>Session[]</code>",
                      }),
                      " döndürür",
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
                    children: "Oturum oluştur",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>Session</code>",
                      }),
                      " döndürür",
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                "set:html":
                  '<td><code dir="auto">session.delete({ path })</code></td><td>Oturum sil</td><td><code dir="auto">boolean</code> döndürür</td>',
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
                    children: "Oturum özelliklerini güncelle",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>Session</code>",
                      }),
                      " döndürür",
                    ],
                  }),
                ],
              }),
              createVNode(Fragment$1, {
                "set:html":
                  '<tr><td><code dir="auto">session.init({ path, body })</code></td><td>Uygulamayı analiz et ve <code dir="auto">AGENTS.md</code> oluştur</td><td><code dir="auto">boolean</code> döndürür</td></tr><tr><td><code dir="auto">session.abort({ path })</code></td><td>Çalışan bir oturumu iptal et</td><td><code dir="auto">boolean</code> döndürür</td></tr>',
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
                    children: "Oturum paylaş",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>Session</code>",
                      }),
                      " döndürür",
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
                    children: "Oturum paylaşımını kaldır",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>Session</code>",
                      }),
                      " döndürür",
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                "set:html":
                  '<td><code dir="auto">session.summarize({ path, body })</code></td><td>Oturumu özetle</td><td><code dir="auto">boolean</code> döndürür</td>',
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
                    children: "Oturumdaki mesajları listele",
                  }),
                  createVNode(_components.td, {
                    children: [
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
                      createVNode(Fragment$1, {
                        "set:html": '<code dir="auto">}[]</code> döndürür',
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
                    children: "Mesaj ayrıntılarını al",
                  }),
                  createVNode(_components.td, {
                    children: [
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
                      createVNode(Fragment$1, {
                        "set:html": '<code dir="auto">}</code> döndürür',
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
                    children: "İstem mesajı gönder",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "body.noReply: true",
                      }),
                      " UserMessage (yalnızca bağlam) döndürür. Varsayılan olarak AI yanıtıyla ",
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>AssistantMessage</code>",
                      }),
                      " döndürür",
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
                    children: "Oturuma komut gönder",
                  }),
                  createVNode(_components.td, {
                    children: [
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
                      createVNode(Fragment$1, {
                        "set:html": '<code dir="auto">}</code> döndürür',
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
                    children: "Bir kabuk komutu çalıştır",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>AssistantMessage</code>",
                      }),
                      " döndürür",
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
                    children: "Bir mesajı geri al",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>Session</code>",
                      }),
                      " döndürür",
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
                    children: "Geri alınan mesajları geri yükle",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode("a", {
                        href: typesUrl,
                        "set:html": "<code>Session</code>",
                      }),
                      " döndürür",
                    ],
                  }),
                ],
              }),
              createVNode(_components.tr, {
                "set:html":
                  '<td><code dir="auto">postSessionByIdPermissionsByPermissionId({ path, body })</code></td><td>Bir izin isteğine yanıt ver</td><td><code dir="auto">boolean</code> döndürür</td>',
              }),
            ],
          }),
        ],
      }),
      "\n",
      createVNode(Fragment$1, {
        "set:html":
          '<hr>\n<h4 id="örnekler-5"><a href="#örnekler-5">Örnekler</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Create and manage sessions</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">session</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.session.</span><span style="--0:#6F42C1;--1:#B392F0">create</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">body: { title: </span><span style="--0:#032F62;--1:#9ECBFF">"My session"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">sessions</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.session.</span><span style="--0:#6F42C1;--1:#B392F0">list</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Send a prompt message</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">result</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.session.</span><span style="--0:#6F42C1;--1:#B392F0">prompt</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">path: { id: session.id },</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">body: {</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">model: { providerID: </span><span style="--0:#032F62;--1:#9ECBFF">"anthropic"</span><span style="--0:#24292E;--1:#E1E4E8">, modelID: </span><span style="--0:#032F62;--1:#9ECBFF">"claude-3-5-sonnet-20241022"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">parts: [{ type: </span><span style="--0:#032F62;--1:#9ECBFF">"text"</span><span style="--0:#24292E;--1:#E1E4E8">, text: </span><span style="--0:#032F62;--1:#9ECBFF">"Hello!"</span><span style="--0:#24292E;--1:#E1E4E8"> }],</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">},</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Inject context without triggering AI response (useful for plugins)</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.session.</span><span style="--0:#6F42C1;--1:#B392F0">prompt</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">path: { id: session.id },</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">body: {</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">noReply: </span><span style="--0:#005CC5;--1:#79B8FF">true</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">    </span></span><span style="--0:#24292E;--1:#E1E4E8">parts: [{ type: </span><span style="--0:#032F62;--1:#9ECBFF">"text"</span><span style="--0:#24292E;--1:#E1E4E8">, text: </span><span style="--0:#032F62;--1:#9ECBFF">"You are a helpful assistant."</span><span style="--0:#24292E;--1:#E1E4E8"> }],</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">},</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="// Create and manage sessionsconst session = await client.session.create({  body: { title: &#x22;My session&#x22; },})const sessions = await client.session.list()// Send a prompt messageconst result = await client.session.prompt({  path: { id: session.id },  body: {    model: { providerID: &#x22;anthropic&#x22;, modelID: &#x22;claude-3-5-sonnet-20241022&#x22; },    parts: [{ type: &#x22;text&#x22;, text: &#x22;Hello!&#x22; }],  },})// Inject context without triggering AI response (useful for plugins)await client.session.prompt({  path: { id: session.id },  body: {    noReply: true,    parts: [{ type: &#x22;text&#x22;, text: &#x22;You are a helpful assistant.&#x22; }],  },})"><div></div></button></div></figure></div>\n<hr>\n<h3 id="dosyalar"><a href="#dosyalar">Dosyalar</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n',
      }),
      createVNode(_components.table, {
        children: [
          createVNode(_components.thead, {
            children: createVNode(_components.tr, {
              children: [
                createVNode(_components.th, {
                  children: "Yöntem",
                }),
                createVNode(_components.th, {
                  children: "Açıklama",
                }),
                createVNode(_components.th, {
                  children: "Yanıt",
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
                    children: "Dosyalarda metin ara",
                  }),
                  createVNode(_components.td, {
                    children: [
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
                      " içeren eşleşme nesneleri dizisi",
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
                    children: "Dosya ve dizinleri isme göre bul",
                  }),
                  createVNode(_components.td, {
                    children: [
                      createVNode(_components.code, {
                        dir: "auto",
                        children: "string[]",
                      }),
                      " (yollar)",
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
                    children: "Çalışma alanı sembollerini bul",
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
                  '<td><code dir="auto">file.read({ query })</code></td><td>Bir dosyayı oku</td><td><code dir="auto">{ type: "raw" | "patch", content: string }</code></td>',
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
                    children: "İzlenen dosyalar için durumu al",
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
          '<p><code dir="auto">find.files</code> birkaç isteğe bağlı sorgu alanını destekler:</p>\n<ul>\n<li><code dir="auto">type</code>: <code dir="auto">"file"</code> veya <code dir="auto">"directory"</code></li>\n<li><code dir="auto">directory</code>: arama için proje kökünü geçersiz kılma</li>\n<li><code dir="auto">limit</code>: maksimum sonuç (1-200)</li>\n</ul>\n<hr>\n<h4 id="örnekler-6"><a href="#örnekler-6">Örnekler</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Search and read files</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">textResults</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.find.</span><span style="--0:#6F42C1;--1:#B392F0">text</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">query: { pattern: </span><span style="--0:#032F62;--1:#9ECBFF">"function.*slopcode"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">files</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.find.</span><span style="--0:#6F42C1;--1:#B392F0">files</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">query: { query: </span><span style="--0:#032F62;--1:#9ECBFF">"*.ts"</span><span style="--0:#24292E;--1:#E1E4E8">, type: </span><span style="--0:#032F62;--1:#9ECBFF">"file"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">directories</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.find.</span><span style="--0:#6F42C1;--1:#B392F0">files</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">query: { query: </span><span style="--0:#032F62;--1:#9ECBFF">"packages"</span><span style="--0:#24292E;--1:#E1E4E8">, type: </span><span style="--0:#032F62;--1:#9ECBFF">"directory"</span><span style="--0:#24292E;--1:#E1E4E8">, limit: </span><span style="--0:#005CC5;--1:#79B8FF">20</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">content</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.file.</span><span style="--0:#6F42C1;--1:#B392F0">read</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">query: { path: </span><span style="--0:#032F62;--1:#9ECBFF">"src/index.ts"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="// Search and read filesconst textResults = await client.find.text({  query: { pattern: &#x22;function.*slopcode&#x22; },})const files = await client.find.files({  query: { query: &#x22;*.ts&#x22;, type: &#x22;file&#x22; },})const directories = await client.find.files({  query: { query: &#x22;packages&#x22;, type: &#x22;directory&#x22;, limit: 20 },})const content = await client.file.read({  query: { path: &#x22;src/index.ts&#x22; },})"><div></div></button></div></figure></div>\n<hr>\n<h3 id="tui"><a href="#tui">TUI</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Yöntem</th><th>Açıklama</th><th>Yanıt</th></tr></thead><tbody><tr><td><code dir="auto">tui.appendPrompt({ body })</code></td><td>İsteme metin ekle</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.openHelp()</code></td><td>Yardım iletişim kutusunu aç</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.openSessions()</code></td><td>Oturum seçiciyi aç</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.openThemes()</code></td><td>Tema seçiciyi aç</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.openModels()</code></td><td>Model seçiciyi aç</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.submitPrompt()</code></td><td>Mevcut istemi gönder</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.clearPrompt()</code></td><td>İstemi temizle</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.executeCommand({ body })</code></td><td>Bir komut çalıştır</td><td><code dir="auto">boolean</code></td></tr><tr><td><code dir="auto">tui.showToast({ body })</code></td><td>Toast bildirimi göster</td><td><code dir="auto">boolean</code></td></tr></tbody></table>\n<hr>\n<h4 id="örnekler-7"><a href="#örnekler-7">Örnekler</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Control TUI interface</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.tui.</span><span style="--0:#6F42C1;--1:#B392F0">appendPrompt</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">body: { text: </span><span style="--0:#032F62;--1:#9ECBFF">"Add this to prompt"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div><div class="ec-line"><div class="code">\n</div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.tui.</span><span style="--0:#6F42C1;--1:#B392F0">showToast</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">body: { message: </span><span style="--0:#032F62;--1:#9ECBFF">"Task completed"</span><span style="--0:#24292E;--1:#E1E4E8">, variant: </span><span style="--0:#032F62;--1:#9ECBFF">"success"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="// Control TUI interfaceawait client.tui.appendPrompt({  body: { text: &#x22;Add this to prompt&#x22; },})await client.tui.showToast({  body: { message: &#x22;Task completed&#x22;, variant: &#x22;success&#x22; },})"><div></div></button></div></figure></div>\n<hr>\n<h3 id="auth"><a href="#auth">Auth</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Yöntem</th><th>Açıklama</th><th>Yanıt</th></tr></thead><tbody><tr><td><code dir="auto">auth.set({ ... })</code></td><td>Kimlik bilgilerini ayarla</td><td><code dir="auto">boolean</code></td></tr></tbody></table>\n<hr>\n<h4 id="örnekler-8"><a href="#örnekler-8">Örnekler</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.auth.</span><span style="--0:#6F42C1;--1:#B392F0">set</span><span style="--0:#24292E;--1:#E1E4E8">({</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">path: { id: </span><span style="--0:#032F62;--1:#9ECBFF">"anthropic"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">body: { type: </span><span style="--0:#032F62;--1:#9ECBFF">"api"</span><span style="--0:#24292E;--1:#E1E4E8">, key: </span><span style="--0:#032F62;--1:#9ECBFF">"your-api-key"</span><span style="--0:#24292E;--1:#E1E4E8"> },</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">})</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="await client.auth.set({  path: { id: &#x22;anthropic&#x22; },  body: { type: &#x22;api&#x22;, key: &#x22;your-api-key&#x22; },})"><div></div></button></div></figure></div>\n<hr>\n<h3 id="olaylar"><a href="#olaylar">Olaylar</a></h3>\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n<table><thead><tr><th>Yöntem</th><th>Açıklama</th><th>Yanıt</th></tr></thead><tbody><tr><td><code dir="auto">event.subscribe()</code></td><td>Sunucu tarafından gönderilen olay akışı</td><td>Sunucu tarafından gönderilen olay akışı</td></tr></tbody></table>\n<hr>\n<h4 id="örnekler-9"><a href="#örnekler-9">Örnekler</a></h4>\n<div class="expressive-code"><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="javascript"><code><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6">// Listen to real-time events</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">events</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> client.event.</span><span style="--0:#6F42C1;--1:#B392F0">subscribe</span><span style="--0:#24292E;--1:#E1E4E8">()</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">for</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">await</span><span style="--0:#24292E;--1:#E1E4E8"> (</span><span style="--0:#BF3441;--1:#F97583">const</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">event</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">of</span><span style="--0:#24292E;--1:#E1E4E8"> events.stream) {</span></div></div><div class="ec-line"><div class="code"><span class="indent"><span style="--0:#24292E;--1:#E1E4E8">  </span></span><span style="--0:#24292E;--1:#E1E4E8">console.</span><span style="--0:#6F42C1;--1:#B392F0">log</span><span style="--0:#24292E;--1:#E1E4E8">(</span><span style="--0:#032F62;--1:#9ECBFF">"Event:"</span><span style="--0:#24292E;--1:#E1E4E8">, event.type, event.properties)</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">}</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="// Listen to real-time eventsconst events = await client.event.subscribe()for await (const event of events.stream) {  console.log(&#x22;Event:&#x22;, event.type, event.properties)}"><div></div></button></div></figure></div>',
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

const url = "src/content/docs/tr/sdk.mdx"
const file = "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/sdk.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/home/marcos/Disk-Extra-4TB/Projects/Personal/slopcode/packages/web/src/content/docs/tr/sdk.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, typesUrl, url }
