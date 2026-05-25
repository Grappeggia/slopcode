globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"

const frontmatter = {
  title: "Sorun giderme",
  description: "Yaygin sorunlar ve cozum adimlari.",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "loglar",
      text: "Loglar",
    },
    {
      depth: 2,
      slug: "depolama",
      text: "Depolama",
    },
    {
      depth: 2,
      slug: "masaüstü-uygulaması",
      text: "Masaüstü uygulaması",
    },
    {
      depth: 3,
      slug: "hızlı-kontroller",
      text: "Hızlı kontroller",
    },
    {
      depth: 3,
      slug: "eklentileri-devre-dışı-bırakın",
      text: "Eklentileri devre dışı bırakın",
    },
    {
      depth: 4,
      slug: "global-configi-kontrol-edin",
      text: "Global config’i kontrol edin",
    },
    {
      depth: 4,
      slug: "eklenti-dizinlerini-kontrol-edin",
      text: "Eklenti dizinlerini kontrol edin",
    },
    {
      depth: 3,
      slug: "cachei-temizleyin",
      text: "Cache’i temizleyin",
    },
    {
      depth: 3,
      slug: "sunucu-bağlantı-sorunlarını-düzeltin",
      text: "Sunucu bağlantı sorunlarını düzeltin",
    },
    {
      depth: 4,
      slug: "desktop-varsayilan-sunucu-urlsini-temizleyin",
      text: "Desktop varsayilan sunucu URL’sini temizleyin",
    },
    {
      depth: 4,
      slug: "configten-serverport--serverhostname-kaldirin",
      text: "Config’ten server.port / server.hostname kaldirin",
    },
    {
      depth: 4,
      slug: "ortam-degiskenlerini-kontrol-edin",
      text: "Ortam degiskenlerini kontrol edin",
    },
    {
      depth: 3,
      slug: "linux-wayland--x11-sorunları",
      text: "Linux: Wayland / X11 sorunları",
    },
    {
      depth: 3,
      slug: "windows-webview2-çalışma-zamanı",
      text: "Windows: WebView2 Çalışma Zamanı",
    },
    {
      depth: 3,
      slug: "windows-genel-performans-sorunları",
      text: "Windows: Genel performans sorunları",
    },
    {
      depth: 3,
      slug: "bildirimler-görünmüyor",
      text: "Bildirimler görünmüyor",
    },
    {
      depth: 3,
      slug: "desktop-depolamasını-sıfırlayın-son-çare",
      text: "Desktop depolamasını sıfırlayın (son çare)",
    },
    {
      depth: 2,
      slug: "yardım-alın",
      text: "Yardım alın",
    },
    {
      depth: 2,
      slug: "yaygın-sorunlar",
      text: "Yaygın sorunlar",
    },
    {
      depth: 3,
      slug: "slopcode-başlamıyor",
      text: "slopcode başlamıyor",
    },
    {
      depth: 3,
      slug: "kimlik-doğrulama-sorunları",
      text: "Kimlik doğrulama sorunları",
    },
    {
      depth: 3,
      slug: "model-kullanılamıyor",
      text: "Model kullanılamıyor",
    },
    {
      depth: 3,
      slug: "provideriniterror",
      text: "ProviderInitError",
    },
    {
      depth: 3,
      slug: "ai_apicallerror-ve-provider-paket-sorunlari",
      text: "AI_APICallError ve provider paket sorunlari",
    },
    {
      depth: 3,
      slug: "linuxta-kopyalayapıştır-çalışmıyor",
      text: "Linux’ta kopyala/yapıştır çalışmıyor",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>slopcode ile ilgili bir sorunu ayiklamak icin once loglari ve diskte tuttugu yerel verileri kontrol edin.</p>\n<hr>\n<h2 id="loglar"><a href="#loglar">Loglar</a></h2>\n<p>Log dosyalari su konuma yazilir:</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.local/share/slopcode/log/</code></li>\n<li><strong>Windows</strong>: <code dir="auto">WIN+R</code> tuslayip <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode\\log</code> yapistirin</li>\n</ul>\n<p>Log dosyalari zaman damgasiyla adlandirilir (ornegin <code dir="auto">2025-01-09T123456.log</code>) ve en yeni 10 log dosyasi tutulur.</p>\n<p>Daha ayrintili ayiklama bilgisi icin <code dir="auto">--log-level</code> komut satiri secenegini kullanabilirsiniz. Ornek: <code dir="auto">slopcode --log-level DEBUG</code>.</p>\n<hr>\n<h2 id="depolama"><a href="#depolama">Depolama</a></h2>\n<p>slopcode, oturum verilerini ve diger uygulama verilerini diskte su konumda saklar:</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.local/share/slopcode/</code></li>\n<li><strong>Windows</strong>: <code dir="auto">WIN+R</code> tuslayip <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode</code> yapistirin</li>\n</ul>\n<p>Bu dizin sunlari icerir:</p>\n<ul>\n<li><code dir="auto">auth.json</code> - API anahtarlari, OAuth tokenlari gibi kimlik dogrulama verileri</li>\n<li><code dir="auto">log/</code> - Uygulama loglari</li>\n<li><code dir="auto">project/</code> - Oturum ve mesaj verileri gibi projeye ozel veriler\n<ul>\n<li>Proje bir Git deposundaysa <code dir="auto">./&#x3C;project-slug>/storage/</code> altinda saklanir</li>\n<li>Git deposu degilse <code dir="auto">./global/storage/</code> altinda saklanir</li>\n</ul>\n</li>\n</ul>\n<hr>\n<h2 id="masaüstü-uygulaması"><a href="#masaüstü-uygulaması">Masaüstü uygulaması</a></h2>\n<p>slopcode Desktop arka planda yerel bir slopcode sunucusu (<code dir="auto">slopcode-cli</code> sidecar) calistirir. Sorunlarin cogu bozuk bir plugin, hasarli cache veya hatali sunucu ayarindan kaynaklanir.</p>\n<h3 id="hızlı-kontroller"><a href="#hızlı-kontroller">Hızlı kontroller</a></h3>\n<ul>\n<li>Uygulamayi tamamen kapatip yeniden acin</li>\n<li>Uygulama hata ekrani gosteriyorsa <strong>Restart</strong>’a tiklayip hata detaylarini kopyalayin</li>\n<li>Yalnizca macOS: <code dir="auto">slopcode</code> menusu -> <strong>Reload Webview</strong> (arayuz bos/donukse yardimci olur)</li>\n</ul>\n<hr>\n<h3 id="eklentileri-devre-dışı-bırakın"><a href="#eklentileri-devre-dışı-bırakın">Eklentileri devre dışı bırakın</a></h3>\n<p>Desktop uygulamasi acilista cokuyorsa, takiliyorsa veya garip davranislar gosteriyorsa once pluginleri devre disi birakin.</p>\n<h4 id="global-configi-kontrol-edin"><a href="#global-configi-kontrol-edin">Global config’i kontrol edin</a></h4>\n<p>Global config dosyanizi acin ve <code dir="auto">plugin</code> anahtarini arayin.</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.config/slopcode/slopcode.jsonc</code> (veya <code dir="auto">~/.config/slopcode/slopcode.json</code>)</li>\n<li><strong>macOS/Linux</strong> (eski kurulumlar): <code dir="auto">~/.local/share/slopcode/slopcode.jsonc</code></li>\n<li><strong>Windows</strong>: <code dir="auto">WIN+R</code> tuslayip <code dir="auto">%USERPROFILE%\\.config\\slopcode\\slopcode.jsonc</code> yapistirin</li>\n</ul>\n<p>Plugin tanimliysa anahtari kaldirarak veya bos bir diziye cekerek gecici olarak devre disi birakin:</p>\n<div class="expressive-code"><link rel="stylesheet" href="/docs/_astro/ec.4c0k7.css"><script type="module" src="/docs/_astro/ec.0vx5m.js"></script><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="jsonc"><code><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">{</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"$schema"</span><span style="--0:#24292E;--1:#E1E4E8">: </span><span style="--0:#032F62;--1:#9ECBFF">"https://slopcode.dev/config.json"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"plugin"</span><span style="--0:#24292E;--1:#E1E4E8">: [],</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">}</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="{  &#x22;$schema&#x22;: &#x22;https://slopcode.dev/config.json&#x22;,  &#x22;plugin&#x22;: [],}"><div></div></button></div></figure></div>\n<h4 id="eklenti-dizinlerini-kontrol-edin"><a href="#eklenti-dizinlerini-kontrol-edin">Eklenti dizinlerini kontrol edin</a></h4>\n<p>slopcode diskten yerel plugin de yukleyebilir. Bu dizinleri gecici olarak tasiyin (veya klasoru yeniden adlandirin) ve uygulamayi yeniden baslatin:</p>\n<ul>\n<li><strong>Global plugins</strong>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.config/slopcode/plugins/</code></li>\n<li><strong>Windows</strong>: <code dir="auto">WIN+R</code> tuslayip <code dir="auto">%USERPROFILE%\\.config\\slopcode\\plugins</code> yapistirin</li>\n</ul>\n</li>\n<li><strong>Project plugins</strong> (sadece proje bazli config kullaniyorsaniz)\n<ul>\n<li><code dir="auto">&#x3C;your-project>/.slopcode/plugins/</code></li>\n</ul>\n</li>\n</ul>\n<p>Uygulama duzelirse soruna neden olan plugini bulmak icin pluginleri tek tek yeniden etkinlestirin.</p>\n<hr>\n<h3 id="cachei-temizleyin"><a href="#cachei-temizleyin">Cache’i temizleyin</a></h3>\n<p>Pluginleri kapatmak ise yaramazsa (veya plugin kurulumu takili kaldiysa), slopcode’un cache’i yeniden olusturmasi icin cache’i temizleyin.</p>\n<ol>\n<li>slopcode Desktop’u tamamen kapatin</li>\n<li>Cache dizinini silin:</li>\n</ol>\n<ul>\n<li><strong>macOS</strong>: Finder -> <code dir="auto">Cmd+Shift+G</code> -> <code dir="auto">~/.cache/slopcode</code></li>\n<li><strong>Linux</strong>: <code dir="auto">~/.cache/slopcode</code> dizinini silin (veya <code dir="auto">rm -rf ~/.cache/slopcode</code> calistirin)</li>\n<li><strong>Windows</strong>: <code dir="auto">WIN+R</code> tuslayip <code dir="auto">%USERPROFILE%\\.cache\\slopcode</code> yapistirin</li>\n</ul>\n<ol start="3">\n<li>slopcode Desktop’u yeniden baslatin</li>\n</ol>\n<hr>\n<h3 id="sunucu-bağlantı-sorunlarını-düzeltin"><a href="#sunucu-bağlantı-sorunlarını-düzeltin">Sunucu bağlantı sorunlarını düzeltin</a></h3>\n<p>slopcode Desktop ya kendi yerel sunucusunu baslatir (varsayilan) ya da sizin tanimladiginiz bir sunucu URL’sine baglanir.</p>\n<p><strong>“Connection Failed”</strong> penceresi goruyorsaniz (veya uygulama acilis ekranini gecemiyorsa), ozel bir sunucu URL’si olup olmadigini kontrol edin.</p>\n<h4 id="desktop-varsayilan-sunucu-urlsini-temizleyin"><a href="#desktop-varsayilan-sunucu-urlsini-temizleyin">Desktop varsayilan sunucu URL’sini temizleyin</a></h4>\n<p>Ana ekranda sunucu adina (durum noktali) tiklayarak Server secicisini acin. <strong>Default server</strong> bolumunde <strong>Clear</strong>’a tiklayin.</p>\n<h4 id="configten-serverport--serverhostname-kaldirin"><a href="#configten-serverport--serverhostname-kaldirin">Config’ten <code dir="auto">server.port</code> / <code dir="auto">server.hostname</code> kaldirin</a></h4>\n<p><code dir="auto">slopcode.json(c)</code> dosyanizda <code dir="auto">server</code> bolumu varsa gecici olarak kaldirin ve desktop uygulamasini yeniden baslatin.</p>\n<h4 id="ortam-degiskenlerini-kontrol-edin"><a href="#ortam-degiskenlerini-kontrol-edin">Ortam degiskenlerini kontrol edin</a></h4>\n<p>Ortamda <code dir="auto">SLOPCODE_PORT</code> ayarliysa desktop uygulamasi yerel sunucu icin o portu kullanmaya calisir.</p>\n<ul>\n<li><code dir="auto">SLOPCODE_PORT</code> degerini kaldirin (veya bos bir port secin) ve yeniden baslatin</li>\n</ul>\n<hr>\n<h3 id="linux-wayland--x11-sorunları"><a href="#linux-wayland--x11-sorunları">Linux: Wayland / X11 sorunları</a></h3>\n<p>Linux’ta bazi Wayland kurulumlari bos pencere veya compositor hatalarina yol acabilir.</p>\n<ul>\n<li>Wayland kullaniyorsaniz ve uygulama bos/acilmiyorsa <code dir="auto">OC_ALLOW_WAYLAND=1</code> ile baslatin</li>\n<li>Bu daha kotu olursa kaldirip X11 oturumunda baslatmayi deneyin</li>\n</ul>\n<hr>\n<h3 id="windows-webview2-çalışma-zamanı"><a href="#windows-webview2-çalışma-zamanı">Windows: WebView2 Çalışma Zamanı</a></h3>\n<p>Windows’ta slopcode Desktop, Microsoft Edge <strong>WebView2 Runtime</strong> gerektirir. Uygulama bos pencereyle aciliyorsa veya hic baslamiyorsa WebView2’yi kurup/guncelleyip tekrar deneyin.</p>\n<hr>\n<h3 id="windows-genel-performans-sorunları"><a href="#windows-genel-performans-sorunları">Windows: Genel performans sorunları</a></h3>\n<p>Windows’ta yavaslik, dosya erisim sorunlari veya terminal problemleri yasiyorsaniz <a href="/docs/windows-wsl">WSL (Windows Subsystem for Linux)</a> kullanmayi deneyin. WSL, slopcode ozellikleriyle daha sorunsuz calisan bir Linux ortami saglar.</p>\n<hr>\n<h3 id="bildirimler-görünmüyor"><a href="#bildirimler-görünmüyor">Bildirimler görünmüyor</a></h3>\n<p>slopcode Desktop sistem bildirimlerini yalnizca su durumlarda gosterir:</p>\n<ul>\n<li>Isletim sistemi ayarlarinizda slopcode icin bildirimler etkinse</li>\n<li>Uygulama penceresi odakta degilse</li>\n</ul>\n<hr>\n<h3 id="desktop-depolamasını-sıfırlayın-son-çare"><a href="#desktop-depolamasını-sıfırlayın-son-çare">Desktop depolamasını sıfırlayın (son çare)</a></h3>\n<p>Uygulama acilmiyorsa ve ayarlari arayuz icinden temizleyemiyorsaniz, desktop uygulamasinin kayitli durumunu sifirlayin.</p>\n<ol>\n<li>slopcode Desktop’u kapatin</li>\n<li>Su dosyalari bulun ve silin (slopcode Desktop uygulama veri dizininde yer alirlar):</li>\n</ol>\n<ul>\n<li><code dir="auto">slopcode.settings.dat</code> (desktop varsayilan sunucu URL’si)</li>\n<li><code dir="auto">slopcode.global.dat</code> ve <code dir="auto">slopcode.workspace.*.dat</code> (son sunucular/projeler gibi UI durumu)</li>\n</ul>\n<p>Dizini hizlica bulmak icin:</p>\n<ul>\n<li><strong>macOS</strong>: Finder -> <code dir="auto">Cmd+Shift+G</code> -> <code dir="auto">~/Library/Application Support</code> (ardindan yukaridaki dosya adlarini aratin)</li>\n<li><strong>Linux</strong>: <code dir="auto">~/.local/share</code> altinda bu dosya adlarini aratin</li>\n<li><strong>Windows</strong>: <code dir="auto">WIN+R</code> -> <code dir="auto">%APPDATA%</code> (ardindan bu dosya adlarini aratin)</li>\n</ul>\n<hr>\n<h2 id="yardım-alın"><a href="#yardım-alın">Yardım alın</a></h2>\n<p>slopcode ile ilgili bir sorun yasiyorsaniz:</p>\n<ol>\n<li>\n<p><strong>GitHub’da issue acin</strong></p>\n<p>Hata bildirmek veya ozellik talep etmek icin en iyi yol GitHub depomuzdur:</p>\n<p><a href="http://github.com/teamslop/slopcode/issues"><strong>github.com/teamslop/slopcode/issues</strong></a></p>\n<p>Yeni issue acmadan once sorununuzun daha once raporlanip raporlanmadigini kontrol edin.</p>\n</li>\n<li>\n<p><strong>Discord’a katilin</strong></p>\n<p>Gercek zamanli yardim ve topluluk sohbeti icin Discord sunucumuza katilin:</p>\n<p><a href="https://slopcode.dev/discord"><strong>slopcode.dev/discord</strong></a></p>\n</li>\n</ol>\n<hr>\n<h2 id="yaygın-sorunlar"><a href="#yaygın-sorunlar">Yaygın sorunlar</a></h2>\n<p>Asagida yaygin sorunlar ve cozumleri yer aliyor.</p>\n<hr>\n<h3 id="slopcode-başlamıyor"><a href="#slopcode-başlamıyor">slopcode başlamıyor</a></h3>\n<ol>\n<li>Hata mesaji icin loglari kontrol edin</li>\n<li>Terminalde cikti gormek icin <code dir="auto">--print-logs</code> ile calistirin</li>\n<li><code dir="auto">slopcode upgrade</code> ile en guncel surumu kullandiginizdan emin olun</li>\n</ol>\n<hr>\n<h3 id="kimlik-doğrulama-sorunları"><a href="#kimlik-doğrulama-sorunları">Kimlik doğrulama sorunları</a></h3>\n<ol>\n<li>TUI’da <code dir="auto">/connect</code> komutuyla yeniden kimlik dogrulamasi yapin</li>\n<li>API anahtarlarinizin gecerli oldugunu kontrol edin</li>\n<li>Aginizin provider API baglantilarina izin verdiginden emin olun</li>\n</ol>\n<hr>\n<h3 id="model-kullanılamıyor"><a href="#model-kullanılamıyor">Model kullanılamıyor</a></h3>\n<ol>\n<li>Provider ile kimlik dogrulamasi yaptiginizi kontrol edin</li>\n<li>Config’teki model adinin dogru oldugunu dogrulayin</li>\n<li>Bazi modeller ozel erisim veya abonelik gerektirebilir</li>\n</ol>\n<p><code dir="auto">ProviderModelNotFoundError</code> aliyorsaniz buyuk olasilikla bir yerde model referansi yanlistir.\nModel referansi su formatta olmalidir: <code dir="auto">&#x3C;providerId>/&#x3C;modelId></code></p>\n<p>Ornekler:</p>\n<ul>\n<li><code dir="auto">openai/gpt-4.1</code></li>\n<li><code dir="auto">openrouter/google/gemini-2.5-flash</code></li>\n<li><code dir="auto">slopcode/kimi-k2</code></li>\n</ul>\n<p>Erisiminiz olan modelleri gormek icin <code dir="auto">slopcode models</code> calistirin.</p>\n<hr>\n<h3 id="provideriniterror"><a href="#provideriniterror">ProviderInitError</a></h3>\n<p><code dir="auto">ProviderInitError</code> aliyorsaniz buyuk olasilikla config’iniz gecersiz veya bozulmustur.</p>\n<p>Cozum adimlari:</p>\n<ol>\n<li>\n<p>Once <a href="/docs/providers">providers rehberini</a> izleyerek provider kurulumunun dogru oldugunu dogrulayin</p>\n</li>\n<li>\n<p>Sorun surerse kayitli konfigurasyonu temizlemeyi deneyin:</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">rm</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-rf</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">~/.local/share/slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="rm -rf ~/.local/share/slopcode"><div></div></button></div></figure></div>\n<p>Windows’ta <code dir="auto">WIN+R</code> tuslayip su konumu silin: <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode</code></p>\n</li>\n<li>\n<p>TUI’da <code dir="auto">/connect</code> komutuyla provider kimlik dogrulamasini tekrar yapin</p>\n</li>\n</ol>\n<hr>\n<h3 id="ai_apicallerror-ve-provider-paket-sorunlari"><a href="#ai_apicallerror-ve-provider-paket-sorunlari">AI_APICallError ve provider paket sorunlari</a></h3>\n<p>API cagrisi hatalari aliyorsaniz bunun nedeni guncel olmayan provider paketleri olabilir. slopcode, provider paketlerini (OpenAI, Anthropic, Google vb.) gerektikce dinamik yukler ve yerelde onbellekler.</p>\n<p>Provider paket sorunlarini gidermek icin:</p>\n<ol>\n<li>\n<p>Provider paket cache’ini temizleyin:</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">rm</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-rf</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">~/.cache/slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="rm -rf ~/.cache/slopcode"><div></div></button></div></figure></div>\n<p>Windows’ta <code dir="auto">WIN+R</code> tuslayip su konumu silin: <code dir="auto">%USERPROFILE%\\.cache\\slopcode</code></p>\n</li>\n<li>\n<p>En guncel provider paketlerini yeniden kurmak icin slopcode’u yeniden baslatin</p>\n</li>\n</ol>\n<p>Bu, slopcode’un en yeni provider paket surumlerini indirmesini zorlar ve model parametresi/API degisikliklerinden kaynakli uyumsuzluklari cogu zaman cozer.</p>\n<hr>\n<h3 id="linuxta-kopyalayapıştır-çalışmıyor"><a href="#linuxta-kopyalayapıştır-çalışmıyor">Linux’ta kopyala/yapıştır çalışmıyor</a></h3>\n<p>Linux kullanicilarinin kopyala/yapistir ozelliginin calismasi icin asagidaki pano araclarindan en az birini kurmasi gerekir:</p>\n<p><strong>X11 sistemleri icin:</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xclip</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># or</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xsel</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y xclipapt install -y xsel"><div></div></button></div></figure></div>\n<p><strong>Wayland sistemleri icin:</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">wl-clipboard</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y wl-clipboard"><div></div></button></div></figure></div>\n<p><strong>Headless ortamlar icin:</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xvfb</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># and run:</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">Xvfb</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">:99</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-screen</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">0</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">1024x768x24</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">></span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">/dev/null</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">2>&#x26;1</span><span style="--0:#24292E;--1:#E1E4E8"> &#x26;</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">export</span><span style="--0:#24292E;--1:#E1E4E8"> DISPLAY</span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8">:99.0</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y xvfbXvfb :99 -screen 0 1024x768x24 > /dev/null 2>&#x26;1 &#x26;export DISPLAY=:99.0"><div></div></button></div></figure></div>\n<p>slopcode, Wayland kullandiginizi algilarsa <code dir="auto">wl-clipboard</code> tercihi yapar. Aksi halde sirayla <code dir="auto">xclip</code> ve <code dir="auto">xsel</code> araclarini arar.</p>',
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
const url = "src/content/docs/tr/troubleshooting.mdx"
const file = "/app/packages/web/src/content/docs/tr/troubleshooting.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/app/packages/web/src/content/docs/tr/troubleshooting.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
