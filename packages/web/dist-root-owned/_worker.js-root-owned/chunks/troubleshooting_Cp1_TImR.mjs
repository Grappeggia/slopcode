globalThis.process ??= {}
globalThis.process.env ??= {}
import { d as createVNode, F as Fragment, _ as __astro_tag_component__ } from "./astro/server_z27GPXmP.mjs"

const frontmatter = {
  title: "Solución de problemas",
  description: "Problemas comunes y cómo resolverlos.",
}
function getHeadings() {
  return [
    {
      depth: 2,
      slug: "registros",
      text: "Registros",
    },
    {
      depth: 2,
      slug: "almacenamiento",
      text: "Almacenamiento",
    },
    {
      depth: 2,
      slug: "aplicación-de-escritorio",
      text: "Aplicación de escritorio",
    },
    {
      depth: 3,
      slug: "comprobaciones-rápidas",
      text: "Comprobaciones rápidas",
    },
    {
      depth: 3,
      slug: "deshabilitar-complementos",
      text: "Deshabilitar complementos",
    },
    {
      depth: 4,
      slug: "verifique-la-configuración-global",
      text: "Verifique la configuración global",
    },
    {
      depth: 4,
      slug: "verificar-directorios-de-complementos",
      text: "Verificar directorios de complementos",
    },
    {
      depth: 3,
      slug: "borrar-el-caché",
      text: "Borrar el caché",
    },
    {
      depth: 3,
      slug: "solucionar-problemas-de-conexión-del-servidor",
      text: "Solucionar problemas de conexión del servidor",
    },
    {
      depth: 4,
      slug: "borrar-la-url-del-servidor-predeterminado-del-escritorio",
      text: "Borrar la URL del servidor predeterminado del escritorio",
    },
    {
      depth: 4,
      slug: "elimina-serverport--serverhostname-de-tu-configuración",
      text: "Elimina server.port / server.hostname de tu configuración",
    },
    {
      depth: 4,
      slug: "verificar-variables-de-entorno",
      text: "Verificar variables de entorno",
    },
    {
      depth: 3,
      slug: "linux-problemas-con-waylandx11",
      text: "Linux: Problemas con Wayland/X11",
    },
    {
      depth: 3,
      slug: "windows-tiempo-de-ejecución-de-webview2",
      text: "Windows: tiempo de ejecución de WebView2",
    },
    {
      depth: 3,
      slug: "windows-problemas-generales-de-rendimiento",
      text: "Windows: Problemas generales de rendimiento",
    },
    {
      depth: 3,
      slug: "notificaciones-que-no-se-muestran",
      text: "Notificaciones que no se muestran",
    },
    {
      depth: 3,
      slug: "restablecer-el-almacenamiento-de-la-aplicación-de-escritorio-último-recurso",
      text: "Restablecer el almacenamiento de la aplicación de escritorio (último recurso)",
    },
    {
      depth: 2,
      slug: "obtener-ayuda",
      text: "Obtener ayuda",
    },
    {
      depth: 2,
      slug: "problemas-comunes",
      text: "Problemas comunes",
    },
    {
      depth: 3,
      slug: "slopcode-no-se-inicia",
      text: "SlopCode no se inicia",
    },
    {
      depth: 3,
      slug: "problemas-de-autenticación",
      text: "Problemas de autenticación",
    },
    {
      depth: 3,
      slug: "modelo-no-disponible",
      text: "Modelo no disponible",
    },
    {
      depth: 3,
      slug: "error-de-inicio-del-proveedor",
      text: "Error de inicio del proveedor",
    },
    {
      depth: 3,
      slug: "ai_apicallerror-y-problemas-con-el-paquete-del-proveedor",
      text: "AI_APICallError y problemas con el paquete del proveedor",
    },
    {
      depth: 3,
      slug: "copiarpegar-no-funciona-en-linux",
      text: "Copiar/pegar no funciona en Linux",
    },
  ]
}
function _createMdxContent(props) {
  const { Fragment } = props.components || {}
  if (!Fragment) _missingMdxReference("Fragment")
  return createVNode(Fragment, {
    "set:html":
      '<p>Para depurar problemas con SlopCode, comience verificando los registros y los datos locales que almacena en el disco.</p>\n<hr>\n<h2 id="registros"><a href="#registros">Registros</a></h2>\n<p>Los archivos de registro se escriben en:</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.local/share/slopcode/log/</code></li>\n<li><strong>Windows</strong>: Presione <code dir="auto">WIN+R</code> y pegue <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode\\log</code></li>\n</ul>\n<p>Los archivos de registro reciben nombres con marcas de tiempo (por ejemplo, <code dir="auto">2025-01-09T123456.log</code>) y se conservan los 10 archivos de registro más recientes.</p>\n<p>Puede configurar el nivel de registro con la opción de línea de comandos <code dir="auto">--log-level</code> para obtener información de depuración más detallada. Por ejemplo, <code dir="auto">slopcode --log-level DEBUG</code>.</p>\n<hr>\n<h2 id="almacenamiento"><a href="#almacenamiento">Almacenamiento</a></h2>\n<p>slopcode almacena datos de sesión y otros datos de aplicaciones en el disco en:</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.local/share/slopcode/</code></li>\n<li><strong>Windows</strong>: Presione <code dir="auto">WIN+R</code> y pegue <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode</code></li>\n</ul>\n<p>Este directorio contiene:</p>\n<ul>\n<li><code dir="auto">auth.json</code> - Datos de autenticación como API claves, OAuth tokens</li>\n<li><code dir="auto">log/</code> - Registros de aplicaciones</li>\n<li><code dir="auto">project/</code> - Datos específicos del proyecto, como datos de sesión y mensajes.\n<ul>\n<li>Si el proyecto está dentro de un repositorio de Git, se almacena en <code dir="auto">./&#x3C;project-slug>/storage/</code></li>\n<li>Si no es un repositorio de Git, se almacena en <code dir="auto">./global/storage/</code></li>\n</ul>\n</li>\n</ul>\n<hr>\n<h2 id="aplicación-de-escritorio"><a href="#aplicación-de-escritorio">Aplicación de escritorio</a></h2>\n<p>SlopCode Desktop ejecuta un servidor SlopCode local (el sidecar <code dir="auto">slopcode-cli</code>) en segundo plano. La mayoría de los problemas se deben a un complemento que no funciona correctamente, una memoria caché dañada o una mala configuración del servidor.</p>\n<h3 id="comprobaciones-rápidas"><a href="#comprobaciones-rápidas">Comprobaciones rápidas</a></h3>\n<ul>\n<li>Salga por completo y reinicie la aplicación.</li>\n<li>Si la aplicación muestra una pantalla de error, haga clic en <strong>Reiniciar</strong> y copie los detalles del error.</li>\n<li>Solo macOS: menú <code dir="auto">SlopCode</code> -> <strong>Recargar vista web</strong> (ayuda si la interfaz de usuario está en blanco/congelada).</li>\n</ul>\n<hr>\n<h3 id="deshabilitar-complementos"><a href="#deshabilitar-complementos">Deshabilitar complementos</a></h3>\n<p>Si la aplicación de escritorio falla al iniciarse, se bloquea o se comporta de manera extraña, comience por deshabilitar los complementos.</p>\n<h4 id="verifique-la-configuración-global"><a href="#verifique-la-configuración-global">Verifique la configuración global</a></h4>\n<p>Abra su archivo de configuración global y busque una clave <code dir="auto">plugin</code>.</p>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.config/slopcode/slopcode.jsonc</code> (o <code dir="auto">~/.config/slopcode/slopcode.json</code>)</li>\n<li><strong>macOS/Linux</strong> (instalaciones anteriores): <code dir="auto">~/.local/share/slopcode/slopcode.jsonc</code></li>\n<li><strong>Windows</strong>: Presione <code dir="auto">WIN+R</code> y pegue <code dir="auto">%USERPROFILE%\\.config\\slopcode\\slopcode.jsonc</code></li>\n</ul>\n<p>Si tiene complementos configurados, desactívelos temporalmente eliminando la clave o configurándola en una matriz vacía:</p>\n<div class="expressive-code"><link rel="stylesheet" href="/docs/_astro/ec.4c0k7.css"><script type="module" src="/docs/_astro/ec.0vx5m.js"></script><figure class="frame not-content"><figcaption class="header"></figcaption><pre data-language="jsonc"><code><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">{</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"$schema"</span><span style="--0:#24292E;--1:#E1E4E8">: </span><span style="--0:#032F62;--1:#9ECBFF">"https://slopcode.dev/config.json"</span><span style="--0:#24292E;--1:#E1E4E8">,</span></div></div><div class="ec-line"><div class="code"><span class="indent">  </span><span style="--0:#005CC5;--1:#79B8FF">"plugin"</span><span style="--0:#24292E;--1:#E1E4E8">: [],</span></div></div><div class="ec-line"><div class="code"><span style="--0:#24292E;--1:#E1E4E8">}</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="{  &#x22;$schema&#x22;: &#x22;https://slopcode.dev/config.json&#x22;,  &#x22;plugin&#x22;: [],}"><div></div></button></div></figure></div>\n<h4 id="verificar-directorios-de-complementos"><a href="#verificar-directorios-de-complementos">Verificar directorios de complementos</a></h4>\n<p>SlopCode también puede cargar complementos locales desde el disco. Quítelos temporalmente del camino (o cambie el nombre de la carpeta) y reinicie la aplicación de escritorio:</p>\n<ul>\n<li><strong>Complementos globales</strong>\n<ul>\n<li><strong>macOS/Linux</strong>: <code dir="auto">~/.config/slopcode/plugins/</code></li>\n<li><strong>Windows</strong>: Presione <code dir="auto">WIN+R</code> y pegue <code dir="auto">%USERPROFILE%\\.config\\slopcode\\plugins</code></li>\n</ul>\n</li>\n<li><strong>Complementos de proyecto</strong> (solo si usas la configuración por proyecto)\n<ul>\n<li><code dir="auto">&#x3C;your-project>/.slopcode/plugins/</code></li>\n</ul>\n</li>\n</ul>\n<p>Si la aplicación comienza a funcionar nuevamente, vuelva a habilitar los complementos uno a la vez para encontrar cuál está causando el problema.</p>\n<hr>\n<h3 id="borrar-el-caché"><a href="#borrar-el-caché">Borrar el caché</a></h3>\n<p>Si deshabilitar los complementos no ayuda (o la instalación de un complemento está bloqueada), borre el caché para que SlopCode pueda reconstruirlo.</p>\n<ol>\n<li>Salga de SlopCode Desktop por completo.</li>\n<li>Elimine el directorio de caché:</li>\n</ol>\n<ul>\n<li><strong>macOS</strong>: Buscador -> <code dir="auto">Cmd+Shift+G</code> -> pegar <code dir="auto">~/.cache/slopcode</code></li>\n<li><strong>Linux</strong>: eliminar <code dir="auto">~/.cache/slopcode</code> (o ejecutar <code dir="auto">rm -rf ~/.cache/slopcode</code>)</li>\n<li><strong>Windows</strong>: Presione <code dir="auto">WIN+R</code> y pegue <code dir="auto">%USERPROFILE%\\.cache\\slopcode</code></li>\n</ul>\n<ol start="3">\n<li>Reinicie el escritorio SlopCode.</li>\n</ol>\n<hr>\n<h3 id="solucionar-problemas-de-conexión-del-servidor"><a href="#solucionar-problemas-de-conexión-del-servidor">Solucionar problemas de conexión del servidor</a></h3>\n<p>SlopCode Desktop puede iniciar su propio servidor local (predeterminado) o conectarse a la URL de un servidor que haya configurado.</p>\n<p>Si ve un cuadro de diálogo <strong>“Error de conexión”</strong> (o la aplicación nunca pasa de la pantalla de inicio), busque una URL de servidor personalizada.</p>\n<h4 id="borrar-la-url-del-servidor-predeterminado-del-escritorio"><a href="#borrar-la-url-del-servidor-predeterminado-del-escritorio">Borrar la URL del servidor predeterminado del escritorio</a></h4>\n<p>Desde la pantalla de inicio, haga clic en el nombre del servidor (con el punto de estado) para abrir el selector de servidor. En la sección <strong>Servidor predeterminado</strong>, haga clic en <strong>Borrar</strong>.</p>\n<h4 id="elimina-serverport--serverhostname-de-tu-configuración"><a href="#elimina-serverport--serverhostname-de-tu-configuración">Elimina <code dir="auto">server.port</code> / <code dir="auto">server.hostname</code> de tu configuración</a></h4>\n<p>Si su <code dir="auto">slopcode.json(c)</code> contiene una sección <code dir="auto">server</code>, elimínela temporalmente y reinicie la aplicación de escritorio.</p>\n<h4 id="verificar-variables-de-entorno"><a href="#verificar-variables-de-entorno">Verificar variables de entorno</a></h4>\n<p>Si tiene <code dir="auto">SLOPCODE_PORT</code> configurado en su entorno, la aplicación de escritorio intentará usar ese puerto para el servidor local.</p>\n<ul>\n<li>Desarme <code dir="auto">SLOPCODE_PORT</code> (o elija un puerto libre) y reinicie.</li>\n</ul>\n<hr>\n<h3 id="linux-problemas-con-waylandx11"><a href="#linux-problemas-con-waylandx11">Linux: Problemas con Wayland/X11</a></h3>\n<p>En Linux, algunas configuraciones de Wayland pueden causar ventanas en blanco o errores de compositor.</p>\n<ul>\n<li>Si estás en Wayland y la aplicación está en blanco o falla, intenta iniciarla con <code dir="auto">OC_ALLOW_WAYLAND=1</code>.</li>\n<li>Si eso empeora las cosas, elimínelo e intente iniciarlo en una sesión X11.</li>\n</ul>\n<hr>\n<h3 id="windows-tiempo-de-ejecución-de-webview2"><a href="#windows-tiempo-de-ejecución-de-webview2">Windows: tiempo de ejecución de WebView2</a></h3>\n<p>En Windows, el escritorio SlopCode requiere Microsoft Edge <strong>WebView2 Runtime</strong>. Si la aplicación se abre en una ventana en blanco o no se inicia, instale/actualice WebView2 e inténtelo nuevamente.</p>\n<hr>\n<h3 id="windows-problemas-generales-de-rendimiento"><a href="#windows-problemas-generales-de-rendimiento">Windows: Problemas generales de rendimiento</a></h3>\n<p>Si tiene un rendimiento lento, problemas de acceso a archivos o problemas de terminal en Windows, intente usar <a href="/docs/windows-wsl">WSL (Windows Subsistema para Linux)</a>. WSL proporciona un entorno Linux que funciona de manera más fluida con las funciones de SlopCode.</p>\n<hr>\n<h3 id="notificaciones-que-no-se-muestran"><a href="#notificaciones-que-no-se-muestran">Notificaciones que no se muestran</a></h3>\n<p>SlopCode Desktop solo muestra notificaciones del sistema cuando:</p>\n<ul>\n<li>las notificaciones están habilitadas para SlopCode en la configuración de su sistema operativo, y</li>\n<li>la ventana de la aplicación no está enfocada.</li>\n</ul>\n<hr>\n<h3 id="restablecer-el-almacenamiento-de-la-aplicación-de-escritorio-último-recurso"><a href="#restablecer-el-almacenamiento-de-la-aplicación-de-escritorio-último-recurso">Restablecer el almacenamiento de la aplicación de escritorio (último recurso)</a></h3>\n<p>Si la aplicación no se inicia y no puede borrar la configuración desde la interfaz de usuario, restablezca el estado guardado de la aplicación de escritorio.</p>\n<ol>\n<li>Salga del escritorio SlopCode.</li>\n<li>Busque y elimine estos archivos (se encuentran en el directorio de datos de la aplicación de escritorio SlopCode):</li>\n</ol>\n<ul>\n<li><code dir="auto">slopcode.settings.dat</code> (URL del servidor predeterminado de escritorio)</li>\n<li><code dir="auto">slopcode.global.dat</code> y <code dir="auto">slopcode.workspace.*.dat</code> (estado de la interfaz de usuario como servidores/proyectos recientes)</li>\n</ul>\n<p>Para encontrar el directorio rápidamente:</p>\n<ul>\n<li><strong>macOS</strong>: Finder -> <code dir="auto">Cmd+Shift+G</code> -> <code dir="auto">~/Library/Application Support</code> (luego busque los nombres de archivo arriba)</li>\n<li><strong>Linux</strong>: busque en <code dir="auto">~/.local/share</code> los nombres de archivo anteriores</li>\n<li><strong>Windows</strong>: Presione <code dir="auto">WIN+R</code> -> <code dir="auto">%APPDATA%</code> (luego busque los nombres de archivo arriba)</li>\n</ul>\n<hr>\n<h2 id="obtener-ayuda"><a href="#obtener-ayuda">Obtener ayuda</a></h2>\n<p>Si tiene problemas con SlopCode:</p>\n<ol>\n<li>\n<p><strong>Informar problemas el GitHub</strong></p>\n<p>La mejor manera de informar errores o solicitar funciones es a través de nuestro repositorio GitHub:</p>\n<p><a href="http://github.com/teamslop/slopcode/issues"><strong>github.com/teamslop/slopcode/issues</strong></a></p>\n<p>Antes de crear un nuevo problema, busque los problemas existentes para ver si su problema ya ha sido informado.</p>\n</li>\n<li>\n<p><strong>Únete a nuestro Discord</strong></p>\n<p>Para obtener ayuda en tiempo real y debates comunitarios, únase a nuestro servidor de Discord:</p>\n<p><a href="https://slopcode.dev/discord"><strong>slopcode.dev/discord</strong></a></p>\n</li>\n</ol>\n<hr>\n<h2 id="problemas-comunes"><a href="#problemas-comunes">Problemas comunes</a></h2>\n<p>A continuación se detallan algunos problemas comunes y cómo resolverlos.</p>\n<hr>\n<h3 id="slopcode-no-se-inicia"><a href="#slopcode-no-se-inicia">SlopCode no se inicia</a></h3>\n<ol>\n<li>Verifique los registros en busca de mensajes de error.</li>\n<li>Intente ejecutar con <code dir="auto">--print-logs</code> para ver el resultado en la terminal.</li>\n<li>Asegúrese de tener la última versión con <code dir="auto">slopcode upgrade</code></li>\n</ol>\n<hr>\n<h3 id="problemas-de-autenticación"><a href="#problemas-de-autenticación">Problemas de autenticación</a></h3>\n<ol>\n<li>Intente volver a autenticarse con el comando <code dir="auto">/connect</code> en TUI</li>\n<li>Verifique que sus claves API sean válidas</li>\n<li>Asegúrese de que su red permita conexiones al API del proveedor.</li>\n</ol>\n<hr>\n<h3 id="modelo-no-disponible"><a href="#modelo-no-disponible">Modelo no disponible</a></h3>\n<ol>\n<li>Comprueba que te has autenticado con el proveedor.</li>\n<li>Verifique que el nombre del modelo en su configuración sea correcto</li>\n<li>Algunos modelos pueden requerir acceso o suscripciones específicas</li>\n</ol>\n<p>Si encuentra <code dir="auto">ProviderModelNotFoundError</code>, lo más probable es que esté equivocado.\nhaciendo referencia a un modelo en alguna parte.\nSe debe hacer referencia a los modelos así: <code dir="auto">&#x3C;providerId>/&#x3C;modelId></code></p>\n<p>Ejemplos:</p>\n<ul>\n<li><code dir="auto">openai/gpt-4.1</code></li>\n<li><code dir="auto">openrouter/google/gemini-2.5-flash</code></li>\n<li><code dir="auto">slopcode/kimi-k2</code></li>\n</ul>\n<p>Para saber a qué modelos tiene acceso, ejecute <code dir="auto">slopcode models</code></p>\n<hr>\n<h3 id="error-de-inicio-del-proveedor"><a href="#error-de-inicio-del-proveedor">Error de inicio del proveedor</a></h3>\n<p>Si encuentra un ProviderInitError, es probable que tenga una configuración no válida o dañada.</p>\n<p>Para resolver esto:</p>\n<ol>\n<li>\n<p>Primero, verifique que su proveedor esté configurado correctamente siguiendo la <a href="/docs/providers">guía de proveedores</a></p>\n</li>\n<li>\n<p>Si el problema persiste, intente borrar la configuración almacenada:</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">rm</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-rf</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">~/.local/share/slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="rm -rf ~/.local/share/slopcode"><div></div></button></div></figure></div>\n<p>En Windows, presione <code dir="auto">WIN+R</code> y elimine: <code dir="auto">%USERPROFILE%\\.local\\share\\slopcode</code></p>\n</li>\n<li>\n<p>Vuelva a autenticarse con su proveedor utilizando el comando <code dir="auto">/connect</code> en TUI.</p>\n</li>\n</ol>\n<hr>\n<h3 id="ai_apicallerror-y-problemas-con-el-paquete-del-proveedor"><a href="#ai_apicallerror-y-problemas-con-el-paquete-del-proveedor">AI_APICallError y problemas con el paquete del proveedor</a></h3>\n<p>Si encuentra errores de llamada API, esto puede deberse a paquetes de proveedores obsoletos. slopcode instala dinámicamente paquetes de proveedores (OpenAI, Anthropic, Google, etc.) según sea necesario y los almacena en caché localmente.</p>\n<p>Para resolver problemas con el paquete del proveedor:</p>\n<ol>\n<li>\n<p>Borre la caché del paquete del proveedor:</p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">rm</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-rf</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">~/.cache/slopcode</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="rm -rf ~/.cache/slopcode"><div></div></button></div></figure></div>\n<p>En Windows, presione <code dir="auto">WIN+R</code> y elimine: <code dir="auto">%USERPROFILE%\\.cache\\slopcode</code></p>\n</li>\n<li>\n<p>Reinicie slopcode para reinstalar los paquetes del proveedor más recientes.</p>\n</li>\n</ol>\n<p>Esto obligará a slopcode a descargar las versiones más recientes de los paquetes del proveedor, lo que a menudo resuelve problemas de compatibilidad con los parámetros del modelo y los cambios de API.</p>\n<hr>\n<h3 id="copiarpegar-no-funciona-en-linux"><a href="#copiarpegar-no-funciona-en-linux">Copiar/pegar no funciona en Linux</a></h3>\n<p>Los usuarios de Linux deben tener instalada una de las siguientes utilidades del portapapeles para que funcione la función copiar/pegar:</p>\n<p><strong>Para sistemas X11:</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xclip</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># or</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xsel</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y xclipapt install -y xsel"><div></div></button></div></figure></div>\n<p><strong>Para sistemas Wayland:</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">wl-clipboard</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y wl-clipboard"><div></div></button></div></figure></div>\n<p><strong>Para entornos sin cabeza:</strong></p>\n<div class="expressive-code"><figure class="frame is-terminal not-content"><figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption><pre data-language="bash"><code><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">apt</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">install</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-y</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">xvfb</span></div></div><div class="ec-line"><div class="code"><span style="--0:#616972;--1:#99A0A6"># and run:</span></div></div><div class="ec-line"><div class="code"><span style="--0:#6F42C1;--1:#B392F0">Xvfb</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">:99</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">-screen</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#005CC5;--1:#79B8FF">0</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">1024x768x24</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">></span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#032F62;--1:#9ECBFF">/dev/null</span><span style="--0:#24292E;--1:#E1E4E8"> </span><span style="--0:#BF3441;--1:#F97583">2>&#x26;1</span><span style="--0:#24292E;--1:#E1E4E8"> &#x26;</span></div></div><div class="ec-line"><div class="code"><span style="--0:#BF3441;--1:#F97583">export</span><span style="--0:#24292E;--1:#E1E4E8"> DISPLAY</span><span style="--0:#BF3441;--1:#F97583">=</span><span style="--0:#24292E;--1:#E1E4E8">:99.0</span></div></div></code></pre><div class="copy"><div aria-live="polite"></div><button title="Copy to clipboard" data-copied="Copied!" data-code="apt install -y xvfbXvfb :99 -screen 0 1024x768x24 > /dev/null 2>&#x26;1 &#x26;export DISPLAY=:99.0"><div></div></button></div></figure></div>\n<p>slopcode detectará si estás usando Wayland y prefieres <code dir="auto">wl-clipboard</code>; de lo contrario, intentará encontrar herramientas del portapapeles en el orden de: <code dir="auto">xclip</code> y <code dir="auto">xsel</code>.</p>',
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
const url = "src/content/docs/es/troubleshooting.mdx"
const file = "/app/packages/web/src/content/docs/es/troubleshooting.mdx"
const Content = (props = {}) =>
  MDXContent({
    ...props,
    components: { Fragment: Fragment, ...props.components },
  })
Content[Symbol.for("mdx-component")] = true
Content[Symbol.for("astro.needsHeadRendering")] = !Boolean(frontmatter.layout)
Content.moduleId = "/app/packages/web/src/content/docs/es/troubleshooting.mdx"
__astro_tag_component__(Content, "astro:jsx")

export { Content, Content as default, file, frontmatter, getHeadings, url }
