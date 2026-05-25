globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"

const frontmatter = {
  title: "Поиск неисправностей",
  description: "Распространенные проблемы и способы их решения.",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "журналы",
      text: "Журналы",
    },
    {
      depth: 2,
      slug: "хранилище",
      text: "Хранилище",
    },
    {
      depth: 2,
      slug: "настольное-приложение",
      text: "Настольное приложение",
    },
    {
      depth: 3,
      slug: "быстрые-проверки",
      text: "Быстрые проверки",
    },
    {
      depth: 3,
      slug: "отключить-плагины",
      text: "Отключить плагины",
    },
    {
      depth: 4,
      slug: "проверьте-глобальную-конфигурацию",
      text: "Проверьте глобальную конфигурацию",
    },
    {
      depth: 4,
      slug: "проверьте-каталоги-плагинов",
      text: "Проверьте каталоги плагинов",
    },
    {
      depth: 3,
      slug: "очистить-кеш",
      text: "Очистить кеш",
    },
    {
      depth: 3,
      slug: "исправить-проблемы-с-подключением-к-серверу",
      text: "Исправить проблемы с подключением к серверу",
    },
    {
      depth: 4,
      slug: "очистите-url-адрес-сервера-по-умолчанию-для-рабочего-стола",
      text: "Очистите URL-адрес сервера по умолчанию для рабочего стола.",
    },
    {
      depth: 4,
      slug: "удалите-serverportserverhostname-из-вашей-конфигурации",
      text: "Удалите server.port/server.hostname из вашей конфигурации.",
    },
    {
      depth: 4,
      slug: "проверьте-переменные-среды",
      text: "Проверьте переменные среды",
    },
    {
      depth: 3,
      slug: "linux-проблемы-с-waylandx11",
      text: "Linux: проблемы с Wayland/X11",
    },
    {
      depth: 3,
      slug: "windows-среда-выполнения-webview2",
      text: "Windows: среда выполнения WebView2.",
    },
    {
      depth: 3,
      slug: "windows-общие-проблемы-с-производительностью",
      text: "Windows: общие проблемы с производительностью",
    },
    {
      depth: 3,
      slug: "уведомления-не-отображаются",
      text: "Уведомления не отображаются",
    },
    {
      depth: 3,
      slug: "сбросить-хранилище-настольных-приложений-последнее-средство",
      text: "Сбросить хранилище настольных приложений (последнее средство)",
    },
    {
      depth: 2,
      slug: "получение-помощи",
      text: "Получение помощи",
    },
    {
      depth: 2,
      slug: "общие-проблемы",
      text: "Общие проблемы",
    },
    {
      depth: 3,
      slug: "slopcode-не-запускается",
      text: "slopcode не запускается",
    },
    {
      depth: 3,
      slug: "проблемы-аутентификации",
      text: "Проблемы аутентификации",
    },
    {
      depth: 3,
      slug: "модель-недоступна",
      text: "Модель недоступна",
    },
    {
      depth: 3,
      slug: "provideriniterror",
      text: "ProviderInitError",
    },
    {
      depth: 3,
      slug: "ai_apicallerror-и-проблемы-с-пакетом-провайдера",
      text: "AI_APICallError и проблемы с пакетом провайдера",
    },
    {
      depth: 3,
      slug: "копированиевставка-не-работает-в-linux",
      text: "Копирование/вставка не работает в Linux",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>Чтобы устранить проблемы с slopcode, начните с проверки журналов и локальных данных, которые он хранит на диске.</p>\n<hr>\n<h2 id="журналы"><a href="#журналы">Журналы</a></h2>\n<p>Лог-файлы записываются в:</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.local/share/slopcode/log/</code></li>\n<li><strong>Windows</strong>: нажмите <code dir="auto">WIN+R</code> и вставьте <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode\\log</code>.</li>\n</ul>\n<p>Файлам журналов присваиваются имена с метками времени (например, <code dir="auto">2025-01-09T123456.log</code>), и сохраняются 10 последних файлов журналов.</p>\n<p>Вы можете установить уровень журнала с помощью CLI-параметра <code dir="auto">--log-level</code>, чтобы получить более подробную информацию об отладке. Например, <code dir="auto">slopcode --log-level DEBUG</code>.</p>\n<hr>\n<h2 id="хранилище"><a href="#хранилище">Хранилище</a></h2>\n<p>slopcode хранит данные сеанса и другие данные приложения на диске по адресу:</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.local/share/slopcode/</code></li>\n<li><strong>Windows</strong>: нажмите <code dir="auto">WIN+R</code> и вставьте <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode</code>.</li>\n</ul>\n<p>Этот каталог содержит:</p>\n<ul>\n<li><code dir="auto">auth.json</code> – данные аутентификации, такие как ключи API и токены OAuth.</li>\n<li><code dir="auto">log/</code> – журналы приложений.</li>\n<li><code dir="auto">project/</code> — данные, специфичные для проекта, такие как данные сеанса и сообщения.\n<ul>\n<li>Если проект находится в репозитории Git, он хранится в <code dir="auto">./&#x3C;project-slug>/storage/</code>.</li>\n<li>Если это не репозиторий Git, он хранится в <code dir="auto">./global/storage/</code>.</li>\n</ul>\n</li>\n</ul>\n<hr>\n<h2 id="настольное-приложение"><a href="#настольное-приложение">Настольное приложение</a></h2>\n<p>slopcode Desktop запускает локальный сервер slopcode (спутник <code dir="auto">slopcode-cli</code>) в фоновом режиме. Большинство проблем вызвано неправильно работающим плагином, поврежденным кешем или неверными настройками сервера.</p>\n<h3 id="быстрые-проверки"><a href="#быстрые-проверки">Быстрые проверки</a></h3>\n<ul>\n<li>Полностью закройте и перезапустите приложение.</li>\n<li>Если приложение отображает экран с ошибкой, нажмите <strong>Перезапустить</strong> и скопируйте сведения об ошибке.</li>\n<li>Только для macOS: меню <code dir="auto">SlopCode</code> -> <strong>Обновить веб-просмотр</strong> (помогает, если пользовательский интерфейс пуст или завис).</li>\n</ul>\n<hr>\n<h3 id="отключить-плагины"><a href="#отключить-плагины">Отключить плагины</a></h3>\n<p>Если настольное приложение дает сбой при запуске, зависает или ведет себя странно, начните с отключения плагинов.</p>\n<h4 id="проверьте-глобальную-конфигурацию"><a href="#проверьте-глобальную-конфигурацию">Проверьте глобальную конфигурацию</a></h4>\n<p>Откройте файл глобальной конфигурации и найдите ключ <code dir="auto">plugin</code>.</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.config/slopcode/slopcode.jsonc</code> (или <code dir="auto">~/.config/slopcode/slopcode.json</code>)</li>\n<li><strong>macOS/Linux</strong> (более ранние версии): <code dir="auto">~/.local/share/slopcode/slopcode.jsonc</code></li>\n<li><strong>Windows</strong>: нажмите <code dir="auto">WIN+R</code> и вставьте <code dir="auto">%USERPROFILE%\\.config\\slopcode\\slopcode.jsonc</code>.</li>\n</ul>\n<p>Если у вас настроены плагины, временно отключите их, удалив ключ или установив для него пустой массив:</p>\n<div class="expressive-code"><link rel="stylesheet" href="/docs/_astro/ec.4c0k7.css"><script type="module" src="/docs/_astro/ec.0vx5m.js"></script><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="jsonc"><code><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">{</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"$schema"</span><span style="--0:#24292E;--1:#E1E4E8">: </span><span style="--0:#032F62;--1:#9ECBFF">"https://slopcode.dev/config.json"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"plugin"</span><span style="--0:#24292E;--1:#E1E4E8">: [],</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">}</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="{  &#x22;$schema&#x22;: &#x22;https://slopcode.dev/config.json&#x22;,  &#x22;plugin&#x22;: [],}"><div></div></button></div></figure></div>\n<h4 id="проверьте-каталоги-плагинов"><a href="#проверьте-каталоги-плагинов">Проверьте каталоги плагинов</a></h4>\n<p>slopcode также может загружать локальные плагины с диска. Временно переместите их в сторону (или переименуйте папку) и перезапустите настольное приложение:</p>\n<ul>\n<li><strong>Глобальные плагины</strong>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.config/slopcode/plugins/</code></li>\n<li><strong>Windows</strong>: нажмите <code dir="auto">WIN+R</code> и вставьте <code dir="auto">%USERPROFILE%\\.config\\slopcode\\plugins</code>.</li>\n</ul>\n</li>\n<li><strong>Плагины проекта</strong> (только если вы используете конфигурацию для каждого проекта)\n<ul>\n<li><code dir="auto">&#x3C;your-project>/.slopcode/plugins/</code></li>\n</ul>\n</li>\n</ul>\n<p>Если приложение снова начнет работать, повторно включите плагины по одному, чтобы определить, какой из них вызывает проблему.</p>\n<hr>\n<h3 id="очистить-кеш"><a href="#очистить-кеш">Очистить кеш</a></h3>\n<p>Если отключение плагинов не помогает (или установка плагина зависла), очистите кеш, чтобы slopcode мог его пересобрать.</p>\n<ol>\n<li>Полностью закройте slopcode Desktop.</li>\n<li>Удалите каталог кэша:</li>\n</ol>\n<ul>\n<li><strong>macOS</strong>: Finder -> <code dir="auto">Cmd+Shift+G</code> -> вставить <code dir="auto">~/.cache/slopcode</code>.</li>\n<li><strong>Linux</strong>: удалите <code dir="auto">~/.cache/slopcode</code> (или запустите <code dir="auto">rm -rf ~/.cache/slopcode</code>).</li>\n<li><strong>Windows</strong>: нажмите <code dir="auto">WIN+R</code> и вставьте <code dir="auto">%USERPROFILE%\\.cache\\slopcode</code>.</li>\n</ul>\n<ol start="3">\n<li>Перезапустите рабочий стол slopcode.</li>\n</ol>\n<hr>\n<h3 id="исправить-проблемы-с-подключением-к-серверу"><a href="#исправить-проблемы-с-подключением-к-серверу">Исправить проблемы с подключением к серверу</a></h3>\n<p>slopcode Desktop может либо запустить собственный локальный сервер (по умолчанию), либо подключиться к настроенному вами URL-адресу сервера.</p>\n<p>Если вы видите диалоговое окно <strong>Ошибка подключения</strong> (или приложение никогда не выходит за пределы заставки), проверьте URL-адрес пользовательского сервера.</p>\n<h4 id="очистите-url-адрес-сервера-по-умолчанию-для-рабочего-стола"><a href="#очистите-url-адрес-сервера-по-умолчанию-для-рабочего-стола">Очистите URL-адрес сервера по умолчанию для рабочего стола.</a></h4>\n<p>На главном экране щелкните имя сервера (с точкой состояния), чтобы открыть окно выбора сервера. В разделе <strong>Сервер по умолчанию</strong> нажмите <strong>Очистить</strong>.</p>\n<h4 id="удалите-serverportserverhostname-из-вашей-конфигурации"><a href="#удалите-serverportserverhostname-из-вашей-конфигурации">Удалите <code dir="auto">server.port</code>/<code dir="auto">server.hostname</code> из вашей конфигурации.</a></h4>\n<p>Если ваш <code dir="auto">slopcode.json(c)</code> содержит раздел <code dir="auto">server</code>, временно удалите его и перезапустите настольное приложение.</p>\n<h4 id="проверьте-переменные-среды"><a href="#проверьте-переменные-среды">Проверьте переменные среды</a></h4>\n<p>Если в вашей среде установлен <code dir="auto">SLOPCODE_PORT</code>, настольное приложение попытается использовать этот порт для локального сервера.</p>\n<ul>\n<li>Отмените настройку <code dir="auto">SLOPCODE_PORT</code> (или выберите свободный порт) и перезапустите.</li>\n</ul>\n<hr>\n<h3 id="linux-проблемы-с-waylandx11"><a href="#linux-проблемы-с-waylandx11">Linux: проблемы с Wayland/X11</a></h3>\n<p>В Linux некоторые настройки Wayland могут вызывать пустые окна или ошибки компоновщика.</p>\n<ul>\n<li>Если вы используете Wayland, а приложение не работает или вылетает, попробуйте запустить с помощью <code dir="auto">OC_ALLOW_WAYLAND=1</code>.</li>\n<li>Если это усугубляет ситуацию, удалите его и попробуйте вместо этого запустить сеанс X11.</li>\n</ul>\n<hr>\n<h3 id="windows-среда-выполнения-webview2"><a href="#windows-среда-выполнения-webview2">Windows: среда выполнения WebView2.</a></h3>\n<p>В Windows для slopcode Desktop требуется Microsoft Edge <strong>WebView2 Runtime</strong>. Если приложение открывается в пустом окне или не запускается, установите/обновите WebView2 и повторите попытку.</p>\n<hr>\n<h3 id="windows-общие-проблемы-с-производительностью"><a href="#windows-общие-проблемы-с-производительностью">Windows: общие проблемы с производительностью</a></h3>\n<p>Если вы испытываете низкую производительность, проблемы с доступом к файлам или проблемы с terminal в Windows, попробуйте использовать <a href="/docs/windows-wsl">WSL (подсистема Windows для Linux)</a>. WSL предоставляет среду Linux, которая более эффективно работает с функциями slopcode.</p>\n<hr>\n<h3 id="уведомления-не-отображаются"><a href="#уведомления-не-отображаются">Уведомления не отображаются</a></h3>\n<p>slopcode Desktop отображает системные уведомления только в следующих случаях:</p>\n<ul>\n<li>уведомления для slopcode включены в настройках вашей ОС, и</li>\n<li>окно приложения не в фокусе.</li>\n</ul>\n<hr>\n<h3 id="сбросить-хранилище-настольных-приложений-последнее-средство"><a href="#сбросить-хранилище-настольных-приложений-последнее-средство">Сбросить хранилище настольных приложений (последнее средство)</a></h3>\n<p>Если приложение не запускается и вы не можете очистить настройки из пользовательского интерфейса, сбросьте сохраненное состояние настольного приложения.</p>\n<ol>\n<li>Закройте рабочий стол slopcode.</li>\n<li>Найдите и удалите эти файлы (они находятся в каталоге данных приложения slopcode Desktop):</li>\n</ol>\n<ul>\n<li><code dir="auto">slopcode.settings.dat</code> (URL-адрес сервера по умолчанию для рабочего стола)</li>\n<li><code dir="auto">slopcode.global.dat</code> и <code dir="auto">slopcode.workspace.*.dat</code> (состояние пользовательского интерфейса, например, недавние серверы/проекты)</li>\n</ul>\n<p>Чтобы быстро найти каталог:</p>\n<ul>\n<li><strong>macOS</strong>: Finder -> <code dir="auto">Cmd+Shift+G</code> -> <code dir="auto">~/Library/Application Support</code> (затем найдите имена файлов, указанные выше)</li>\n<li><strong>Linux</strong>: найдите в <code dir="auto">~/.local/share</code> имена файлов, указанные выше.</li>\n<li><strong>Windows</strong>: нажмите <code dir="auto">WIN+R</code> -> <code dir="auto">%APPDATA%</code> (затем найдите имена файлов, указанные выше).</li>\n</ul>\n<hr>\n<h2 id="получение-помощи"><a href="#получение-помощи">Получение помощи</a></h2>\n<p>Если у вас возникли проблемы с slopcode:</p>\n<ol>\n<li>\n<p><strong>Сообщайте о проблемах на GitHub</strong></p>\n<p>Лучший способ сообщить об ошибках или запросить новые функции — через наш репозиторий GitHub:</p>\n<p><a href="http://github.com/teamslop/slopcode/issues"><strong>github.com/teamslop/slopcode/issues</strong></a></p>\n<p>Прежде чем создавать новую проблему, выполните поиск по существующим проблемам, чтобы узнать, не сообщалось ли уже о вашей проблеме.</p>\n</li>\n<li>\n<p><strong>Присоединяйтесь к нашему Discord</strong></p>\n<p>Для получения помощи в режиме реального времени и обсуждения в сообществе присоединяйтесь к нашему серверу Discord:</p>\n<p><a href="https://slopcode.dev/discord"><strong>slopcode.dev/discord</strong></a></p>\n</li>\n</ol>\n<hr>\n<h2 id="общие-проблемы"><a href="#общие-проблемы">Общие проблемы</a></h2>\n<p>Вот некоторые распространенные проблемы и способы их решения.</p>\n<hr>\n<h3 id="slopcode-не-запускается"><a href="#slopcode-не-запускается">slopcode не запускается</a></h3>\n<ol>\n<li>Проверьте журналы на наличие сообщений об ошибках</li>\n<li>Попробуйте запустить <code dir="auto">--print-logs</code>, чтобы увидеть вывод в terminal.</li>\n<li>Убедитесь, что у вас установлена ​​последняя версия <code dir="auto">slopcode upgrade</code>.</li>\n</ol>\n<hr>\n<h3 id="проблемы-аутентификации"><a href="#проблемы-аутентификации">Проблемы аутентификации</a></h3>\n<ol>\n<li>Попробуйте выполнить повторную аутентификацию с помощью команды <code dir="auto">/connect</code> в TUI.</li>\n<li>Убедитесь, что ваши ключи API действительны</li>\n<li>Убедитесь, что ваша сеть разрешает подключения к API провайдера.</li>\n</ol>\n<hr>\n<h3 id="модель-недоступна"><a href="#модель-недоступна">Модель недоступна</a></h3>\n<ol>\n<li>Убедитесь, что вы прошли аутентификацию у провайдера</li>\n<li>Проверьте правильность названия модели в вашей конфигурации.</li>\n<li>Для некоторых моделей может потребоваться специальный доступ или подписка.</li>\n</ol>\n<p>Если вы столкнулись с <code dir="auto">ProviderModelNotFoundError</code>, вы, скорее всего, ошибаетесь.\nссылка на модель где-то.\nНа модели следует ссылаться следующим образом: <code dir="auto">&#x3C;providerId>/&#x3C;modelId></code>.</p>\n<p>Примеры:</p>\n<ul>\n<li><code dir="auto">openai/gpt-4.1</code></li>\n<li><code dir="auto">openrouter/google/gemini-2.5-flash</code></li>\n<li><code dir="auto">slopcode/kimi-k2</code></li>\n</ul>\n<p>Чтобы выяснить, к каким моделям у вас есть доступ, запустите <code dir="auto">slopcode models</code>.</p>\n<hr>\n<h3 id="provideriniterror"><a href="#provideriniterror">ProviderInitError</a></h3>\n<p>Если вы столкнулись с ошибкой ProviderInitError, скорее всего, у вас неверная или поврежденная конфигурация.</p>\n<p>Чтобы решить эту проблему:</p>\n<ol>\n<li>\n<p>Сначала убедитесь, что ваш провайдер настроен правильно, следуя <a href="/docs/providers">руководству провайдеров</a></p>\n</li>\n<li>\n<p>Если проблема не устранена, попробуйте очистить сохраненную конфигурацию:</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">rm</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-rf</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">~/.local/share/slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="rm -rf ~/.local/share/slopcode"><div></div></button></div></figure></div>\n<p>В Windows нажмите <code dir="auto">WIN+R</code> и удалите: <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode</code>.</p>\n</li>\n<li>\n<p>Повторно выполните аутентификацию у своего провайдера, используя команду <code dir="auto">/connect</code> в TUI.</p>\n</li>\n</ol>\n<hr>\n<h3 id="ai_apicallerror-и-проблемы-с-пакетом-провайдера"><a href="#ai_apicallerror-и-проблемы-с-пакетом-провайдера">AI_APICallError и проблемы с пакетом провайдера</a></h3>\n<p>Если вы столкнулись с ошибками вызова API, это может быть связано с устаревшими пакетами провайдера. slopcode динамически устанавливает пакеты провайдеров (OpenAI, Anthropic, Google и т. д.) по мере необходимости и кэширует их локально.</p>\n<p>Чтобы решить проблемы с пакетом поставщика:</p>\n<ol>\n<li>\n<p>Очистите кеш пакетов провайдера:</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">rm</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-rf</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">~/.cache/slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="rm -rf ~/.cache/slopcode"><div></div></button></div></figure></div>\n<p>В Windows нажмите <code dir="auto">WIN+R</code> и удалите: <code dir="auto">%USERPROFILE%\\.cache\\slopcode</code>.</p>\n</li>\n<li>\n<p>Перезапустите slopcode, чтобы переустановить последние пакеты поставщиков.</p>\n</li>\n</ol>\n<p>Это заставит slopcode загружать самые последние версии пакетов провайдеров, что часто решает проблемы совместимости с параметрами модели и изменениями API.</p>\n<hr>\n<h3 id="копированиевставка-не-работает-в-linux"><a href="#копированиевставка-не-работает-в-linux">Копирование/вставка не работает в Linux</a></h3>\n<p>Для работы функций копирования/вставки пользователям Linux необходимо установить одну из следующих утилит буфера обмена:</p>\n<p><strong>Для систем X11:</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xclip</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># or</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xsel</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y xclipapt install -y xsel"><div></div></button></div></figure></div>\n<p><strong>Для систем Wayland:</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">wl-clipboard</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y wl-clipboard"><div></div></button></div></figure></div>\n<p><strong>Для headless-сред:</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xvfb</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># and run:</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">Xvfb</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">:99</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-screen</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">0</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">1024x768x24</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">></span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">/dev/null</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">2>&#x26;1</span><span style="--0:#24292E;--1:#E1E4E8"> &#x26;</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">export</span><span style="--0:#24292E;--1:#E1E4E8"> DISPLAY</span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8">:99.0</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y xvfbXvfb :99 -screen 0 1024x768x24 > /dev/null 2>&#x26;1 &#x26;export DISPLAY=:99.0"><div></div></button></div></figure></div>\n<p>slopcode определит, используете ли вы Wayland и предпочитаете <code dir="auto">wl-clipboard</code>, в противном случае он попытается найти инструменты буфера обмена в порядке: <code dir="auto">xclip</code> и <code dir="auto">xsel</code>.</p>',
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
const url = "src/content/docs/ru/troubleshooting.mdx"
const file = "/app/packages/web/src/content/docs/ru/troubleshooting.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/app/packages/web/src/content/docs/ru/troubleshooting.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
