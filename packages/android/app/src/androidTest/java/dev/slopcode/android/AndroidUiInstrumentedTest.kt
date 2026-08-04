package dev.slopcode.android

import android.content.pm.ActivityInfo
import android.webkit.WebView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import androidx.webkit.ScriptHandler
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONArray
import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

/**
 * Renderer-contract coverage only.
 *
 * The transport fixture below is a document-start WebView fixture. It does not
 * exercise SSH, SFTP, PTY, credentials, or native transport success.
 */
@RunWith(AndroidJUnit4::class)
class AndroidUiInstrumentedTest {
  private val savedPreferences = mutableMapOf<String, Any?>()

  @Before
  fun snapshotEncryptedPreferences() {
    savedPreferences.clear()
    preferences().all.forEach { (key, value) -> savedPreferences[key] = value }
  }

  @After
  fun restoreEncryptedPreferencesAndFixtures() {
    val handler = script
    script = null
    if (handler != null) {
      InstrumentationRegistry.getInstrumentation().runOnMainSync { handler.remove() }
    }

    val prefs = preferences()
    val current = prefs.all
    val edit = prefs.edit()
    current.keys.filter { !savedPreferences.containsKey(it) }.forEach { edit.remove(it) }
    savedPreferences.forEach { (key, value) ->
      if (current[key] == value) return@forEach
      when (value) {
        is Boolean -> edit.putBoolean(key, value)
        is Float -> edit.putFloat(key, value)
        is Int -> edit.putInt(key, value)
        is Long -> edit.putLong(key, value)
        is String -> edit.putString(key, value)
        is Set<*> -> edit.putStringSet(key, value.filterIsInstance<String>().toSet())
      }
    }
    assertTrue("Encrypted preference snapshot could not be restored.", edit.commit())
  }

  @Test
  fun savedComputerAndAddComputerStayVisibleAndSeparatedInLandscape() {
    preferences().edit().putString(SSH_WORKSPACE_KEY, savedWorkspace()).commit()
    launch().use { scenario ->
      try {
        waitFor(scenario) { snapshot(scenario).optString("text").contains("Your computers") }
        val first = snapshot(scenario)
        assertTrue(first.optString("text").contains("void"))
        assertTrue(first.optString("text").contains("Add computer"))
        assertHit(first, "add")
        assertHit(first, "primary")
        assertSemantic(scenario, "Open navigation")

        rotate(scenario, ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE)
        scrollLandscapeForActions(scenario)
        val landscape = snapshot(scenario)
        assertTrue("The ActivityScenario did not render landscape.", landscape.optBoolean("landscape"))
        assertHit(landscape, "add")
        assertHit(landscape, "primary")
        assertFalse("The primary computer CTA overlaps Add computer in landscape.", overlaps(landscape, "primary", "add"))
        assertMenuBelowActualInset(scenario, landscape)

        rotate(scenario, ActivityInfo.SCREEN_ORIENTATION_PORTRAIT)
        val portrait = snapshot(scenario)
        assertFalse("The test did not restore portrait orientation.", portrait.optBoolean("landscape"))

        assertTrue(click(scenario, "Add computer"))
        waitFor(scenario) { snapshot(scenario).optBoolean("address") }
        val next = snapshot(scenario)
        assertTrue(next.optString("text").contains("Advanced connection details"))
        assertHit(next, "menu")
        assertSemantic(scenario, "Open navigation")
      } finally {
        restorePortrait(scenario)
      }
    }
  }

  @Test
  fun renderedOnboardingMapsAgentsToSetupAndChecksDarkContrastAndInsets() {
    launch(fakeBridge = true).use { scenario ->
      waitForStableDocument(scenario) { it.optBoolean("address") }
      assertTrue(submitField(scenario, "input[placeholder='user@mac.example.com']", "agent@void"))
      waitFor(scenario) { snapshot(scenario).optBoolean("password") }
      assertTrue(submitField(scenario, "input[type='password']", "fixture-placeholder"))
      waitFor(scenario) { snapshot(scenario).getJSONObject("buttons").getJSONObject("folder").getInt("height") > 0 }

      val folder = snapshot(scenario)
      assertFalse(folder.optBoolean("hidden"))
      assertFalse(folder.optString("text").contains(".fixture-hidden"))
      assertHit(folder, "folder")
      assertHit(folder, "hiddenSummary")
      assertTrue(toggleHidden(scenario))
      waitFor(scenario) { snapshot(scenario).optString("text").contains(".fixture-hidden") }
      val revealed = snapshot(scenario)
      assertSemantic(scenario, "Show hidden files")
      assertTrue("The hidden-file fixture was not rendered after toggling.", revealed.optString("text").contains(".fixture-hidden"))

      assertTrue(click(scenario, "Use this folder"))
      waitFor(scenario) {
        val cards = snapshot(scenario).optJSONArray("agentCards")
        cards != null && cards.length() == 4 && (0 until cards.length()).all {
          cards.getJSONObject(it).optString("status") != "Checking"
        }
      }
      val agents = snapshot(scenario)
      val expected = mapOf(
        "Codex" to "Not installed",
        "OpenCode" to "Needs setup",
        "Claude Code" to "Ready",
        "Antigravity" to "Not installed",
      )
      val cards = agentCards(agents)
      expected.forEach { (name, status) ->
        val card = cards[name] ?: error("Missing rendered agent card for " + name + ".")
        assertEquals(name + " status is not mapped to its rendered card.", status, card.optString("status"))
        assertHitRect(card.getJSONObject("rect"), "agent." + name, name)
      }

      assertTrue(click(scenario, "Codex"))
      assertTrue(click(scenario, "Run preflight and open agent"))
      waitFor(scenario) { snapshot(scenario).optString("text").contains("Codex is not installed") }
      val codexSetup = snapshot(scenario)
      assertSetup(codexSetup, "install", "Codex is not installed")
      assertTrue(codexSetup.optString("text").contains("Installing"))
      assertTrue(codexSetup.optString("text").contains("Signing in"))
      scrollIntoView(scenario, "section[aria-live='polite'] button:last-of-type")
      waitFor(scenario) { snapshot(scenario).getJSONObject("buttons").getJSONObject("setupPrimary").getBoolean("visible") }
      val codexSetupAction = snapshot(scenario)
      assertHit(codexSetupAction, "setupPrimary")

      assertTrue(click(scenario, "OpenCode"))
      assertTrue(click(scenario, "Run preflight and open agent"))
      waitFor(scenario) { snapshot(scenario).optString("text").contains("Sign in to OpenCode") }
      val opencodeSetup = snapshot(scenario)
      assertSetup(opencodeSetup, "login", "Sign in to OpenCode")
      scrollIntoView(scenario, "section[aria-live='polite'] button:last-of-type")
      waitFor(scenario) { snapshot(scenario).getJSONObject("buttons").getJSONObject("setupPrimary").getBoolean("visible") }
      val opencodeSetupAction = snapshot(scenario)
      assertHit(opencodeSetupAction, "setupPrimary")

      val beforeTheme = snapshot(scenario)
      assertTrue(clickAria(scenario, "Open navigation"))
      waitFor(scenario) { snapshot(scenario).optString("text").contains("mode") }
      if (beforeTheme.optString("theme") != "dark") {
        assertTrue(click(scenario, "Light mode"))
      }
      waitFor(scenario) { snapshot(scenario).optString("theme") == "dark" }
      val dark = snapshot(scenario)
      assertEquals("dark", dark.optString("theme"))
      assertContrast(dark, "drawer")
      assertContrast(dark, "content")
      assertContrast(dark, "status")
      assertTrue("The native Android bridge did not receive setSystemBars(true).", nativeSystemBarCalls(dark).contains(true))
      assertInsetVariables(dark)
      assertSemantic(scenario, "Close navigation")
    }
  }

  @Test
  fun renderedAgenticSessionCompletesAndRestoresAcrossImeAndWebViewRecreation() {
    launch(fakeBridge = true, session = true).use { scenario ->
      waitFor(scenario) { agentState(scenario).optString("phase") == "ready" }
      val ready = agentState(scenario)
      assertTrue("The composer is not in the unscrolled first viewport: " + ready, ready.optBoolean("firstViewport"))
      assertTrue("The compact context disclosure expanded unexpectedly.", ready.optBoolean("compactContext"))
      assertEquals(4, ready.optInt("reviewTabs"))
      assertTrue("The initial review panel does not expose an empty state.", ready.optBoolean("reviewEmpty"))
      assertHitRect(ready.getJSONObject("prompt"), "agent.prompt", "Message the agent")

      assertTrue(tapSelector(scenario, "[data-agent-prompt]"))
      waitFor(scenario) { agentState(scenario).optBoolean("promptFocused") }
      showIme(scenario)
      assertTrue(refreshInsets(scenario))
      val ime = agentState(scenario)
      val nativeIme = actualImeInset(scenario).toDouble()
      assertTrue(
        "The CSS IME inset does not match Android's reported inset: " + ime,
        kotlin.math.abs(ime.optDouble("imeBottom") * ime.optDouble("pixelRatio", 1.0) - nativeIme) <= 2.0,
      )
      assertTrue("The composer is not visible above the IME: " + ime, ime.getJSONObject("composer").optBoolean("visible"))
      assertTrue(
        "The composer extends below the resized WebView viewport: " + ime,
        ime.getJSONObject("composer").getDouble("bottom") <= ime.getDouble("height") + 1.0,
      )
      hideIme(scenario)

      assertTrue(input(scenario, "[data-agent-prompt]", "Build a small fixture app"))
      assertTrue(submitPrompt(scenario))
      waitFor(scenario) { agentState(scenario).getJSONArray("entries").toString().contains("user") }
      waitFor(scenario) { agentState(scenario).optString("interaction") == "approval_fixture" }
      val approval = agentState(scenario)
      assertTrue(approval.getJSONArray("entries").toString().contains("output"))
      assertTrue(approval.getJSONArray("entries").toString().contains("reasoning"))
      assertTrue(approval.getJSONArray("entries").toString().contains("tool"))
      assertEquals("approve", approval.optString("focusAction"))
      assertTrue(clickSelector(scenario, "[data-agent-action='approve']"))

      waitFor(scenario) { agentState(scenario).optString("interaction") == "question_fixture" }
      assertEquals("question_fixture", agentState(scenario).optString("focusAnswer"))
      assertTrue(hasElement(scenario, "label[for='agent-answer-question_fixture']"))
      assertTrue(input(scenario, "[data-agent-answer='question_fixture']", "Use TypeScript"))
      assertTrue(clickSelector(scenario, "[data-agent-action='answer']"))
      waitFor(scenario) { agentState(scenario).getJSONArray("entries").toString().contains("completion") }

      mapOf("changes" to 2, "files" to 3, "tests" to 1, "screenshots" to 1).forEach { (tab, count) ->
        assertTrue(clickSelector(scenario, "[data-review-tab='" + tab + "']"))
        waitFor(scenario) { agentState(scenario).optString("review") == tab }
        assertEquals("Unexpected projected review count for " + tab + ".", count, agentState(scenario).optInt("reviewItems"))
      }
      val complete = agentState(scenario)
      assertTrue("Completion is not exposed as a polite live status.", complete.optBoolean("completionLive"))

      recreateWithFakeBridge(scenario)
      waitFor(scenario) { agentState(scenario).optBoolean("restored") }
      val restored = agentState(scenario)
      assertTrue("The recreated WebView did not restore a detached snapshot: " + restored, restored.optBoolean("detached"))
      assertTrue("The detached transcript lost completion.", restored.getJSONArray("entries").toString().contains("completion"))
      assertTrue("The detached composer is enabled.", restored.optBoolean("promptDisabled"))
      assertEquals("screenshots", restored.optString("review"))
      assertEquals("A detached restore started a new remote session.", 0, restored.optInt("starts"))
    }
  }

  private fun launch(
    fakeBridge: Boolean = false,
    session: Boolean = false,
  ): ActivityScenario<MainActivity> {
    val scenario = ActivityScenario.launch(MainActivity::class.java)
    if (!fakeBridge) return scenario
    scenario.onActivity { activity ->
      assertTrue(
        "The packaged WebView does not support document-start UI test fixtures.",
        WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT),
      )
      val web = activity.findViewById<WebView>(R.id.webview)
      script = WebViewCompat.addDocumentStartJavaScript(web, fake(session), setOf(ORIGIN))
      web.reload()
    }
    return scenario
  }

  private fun snapshot(scenario: ActivityScenario<MainActivity>): JSONObject {
    val value = string(
      evaluate(
        scenario,
        """
        (() => {
          const clean = (value) => (value || '').replace(/\s+/g, ' ').trim()
          const button = (value) => [...document.querySelectorAll('button')].find((item) => clean(item.innerText) === value || clean(item.innerText).includes(value))
          const summary = (value) => [...document.querySelectorAll('summary')].find((item) => clean(item.innerText) === value)
          const box = (item) => {
            if (!(item instanceof Element)) return { width: 0, height: 0, top: -1, bottom: -1, left: -1, right: -1, visible: false }
            const rect = item.getBoundingClientRect()
            const style = getComputedStyle(item)
            const viewport = visualViewport || { width: innerWidth, height: innerHeight }
            const visible = rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.left < viewport.width && rect.bottom > 0 && rect.top < viewport.height && style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0'
            return { width: Math.round(rect.width), height: Math.round(rect.height), top: Math.round(rect.top), bottom: Math.round(rect.bottom), left: Math.round(rect.left), right: Math.round(rect.right), visible }
          }
          const style = (item) => {
            const value = item instanceof Element ? item : document.documentElement
            const result = getComputedStyle(value)
            let background = result.backgroundColor
            if (background === 'transparent' || background === 'rgba(0, 0, 0, 0)') background = getComputedStyle(value.parentElement || document.documentElement).backgroundColor
            return { background, foreground: result.color }
          }
          const channels = (value) => {
            const match = value.match(/rgba?\(([^)]+)\)/)
            if (!match) return
            const parts = match[1].replace(/\//g, ',').split(',').map((part) => Number.parseFloat(part.trim()))
            if (parts.length < 3 || parts.slice(0, 3).some((part) => !Number.isFinite(part))) return
            return [parts[0], parts[1], parts[2]]
          }
          const luminance = (value) => {
            const rgb = channels(value)
            if (!rgb) return
            return rgb.map((part) => part / 255).map((part) => part <= 0.03928 ? part / 12.92 : Math.pow((part + 0.055) / 1.055, 2.4)).reduce((sum, part, index) => sum + part * [0.2126, 0.7152, 0.0722][index], 0)
          }
          const contrast = (item) => {
            const colors = style(item)
            const foreground = luminance(colors.foreground)
            const background = luminance(colors.background)
            if (foreground === undefined || background === undefined) return 0
            return Math.round(((Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05)) * 100) / 100
          }
          const control = (item) => {
            const result = box(item)
            result.text = clean(item?.innerText)
            result.disabled = Boolean(item?.disabled)
            return result
          }
          const statusValues = new Set(['Ready', 'Needs setup', 'Not installed', 'Recommended', 'Checking'])
          const agents = [...document.querySelectorAll('[aria-label="Remote agent selection"] button')].map((item) => {
            const name = [...item.querySelectorAll('span')].map((node) => clean(node.innerText)).find((value) => ['Slopcode', 'Codex', 'OpenCode', 'Claude Code', 'Antigravity'].includes(value)) || ''
            const badge = [...item.querySelectorAll('span')].find((node) => statusValues.has(clean(node.innerText)))
            return { name, status: clean(badge?.innerText), text: clean(item.innerText), rect: box(item), statusContrast: contrast(badge) }
          })
          const setupNode = document.querySelector('section[aria-label="Agent setup"]')
          const setup = setupNode ? { text: clean(setupNode.innerText), rect: box(setupNode), action: clean(setupNode.innerText).includes('is not installed') ? 'install' : 'login', steps: [...setupNode.querySelectorAll('li')].map((item) => clean(item.innerText)) } : null
          const hidden = document.querySelector("input[type='checkbox']")
          const shell = document.querySelector('[data-ssh-shell]')
          const root = document.documentElement
          const main = document.querySelector('main')
          const drawer = document.querySelector('[data-ssh-drawer]')
          const questionOptions = [...document.querySelectorAll('section[aria-label="Question from agent"] button')].map((item) => ({ rect: box(item), text: clean(item.innerText) }))
          const savedComputer = document.querySelector('[aria-label="Saved computers"] button')
          const primary = button('Run preflight and open agent') || button('Install the agent above') || button('Continue') || button('Connect to SSH host') || savedComputer
          return JSON.stringify({
            text: document.body?.innerText || '',
            document: performance.timeOrigin,
            address: !!document.querySelector("input[placeholder='user@mac.example.com']"),
            password: !!document.querySelector("input[type='password']"),
            values: {
              address: document.querySelector("input[placeholder='user@mac.example.com']")?.value || '',
              passwordLength: document.querySelector("input[type='password']")?.value?.length || 0
            },
            hidden: !!hidden?.checked,
            theme: shell?.getAttribute('data-ssh-theme') || '',
            canvas: getComputedStyle(shell || root).backgroundColor,
            textColor: getComputedStyle(main || root).color,
            landscape: matchMedia('(orientation: landscape)').matches,
            width: Math.round(visualViewport?.width || innerWidth),
            height: Math.round(visualViewport?.height || innerHeight),
            drawerOpen: document.querySelector('[data-ssh-drawer]')?.getAttribute('data-ssh-drawer-open') || '',
            pixelRatio: window.devicePixelRatio || 1,
            insetTop: Number.parseFloat(getComputedStyle(root).getPropertyValue('--android-inset-top')) || 0,
            insets: {
              top: Number.parseFloat(getComputedStyle(root).getPropertyValue('--android-inset-top')) || 0,
              right: Number.parseFloat(getComputedStyle(root).getPropertyValue('--android-inset-right')) || 0,
              bottom: Number.parseFloat(getComputedStyle(root).getPropertyValue('--android-inset-bottom')) || 0,
              left: Number.parseFloat(getComputedStyle(root).getPropertyValue('--android-inset-left')) || 0,
              imeBottom: Number.parseFloat(getComputedStyle(root).getPropertyValue('--android-ime-bottom')) || 0
            },
            buttons: {
              add: control(button('Add computer')),
              menu: control(document.querySelector('[data-ssh-menu-toggle]')),
              folder: control(button('Use this folder')),
              primary: control(primary),
              hiddenSummary: control(summary('More')),
              disconnect: control(button('Disconnect')),
              prompt: box(document.querySelector('#agent-prompt')),
              send: control(button('Send')),
              stop: control(button('Stop')),
              retry: control(button('Retry last request')),
              reconnect: control(button('Reconnect')),
              diagnostics: control(summary('Diagnostics')),
              interactive: control(button('Open Interactive CLI')),
              activeSession: control(document.querySelector('[aria-label="Session navigation"] button')),
              approve: control(button('Approve')),
              reject: control(button('Reject')),
              setupPrimary: control(setupNode?.querySelector('button:last-of-type')),
              questionInput: box(document.querySelector('section[aria-label="Question from agent"] input[placeholder="Your answer"]')),
              questionSend: control(document.querySelector('section[aria-label="Question from agent"] button:last-of-type')),
              questionOptions
            },
            agentCards: agents,
            setup,
            contrast: {
              drawer: contrast(drawer),
              content: contrast(main),
              status: agents.find((item) => item.statusContrast > 0)?.statusContrast || contrast(document.querySelector('[role="alert"]'))
            },
            systemBars: window.__SLOPCODE_TEST_SYSTEM_BAR_CALLS || [],
            nativeSystemBars: window.__SLOPCODE_TEST_NATIVE_SYSTEM_BAR_CALLS || [],
            bridgeCalls: window.__SLOPCODE_TEST_BRIDGE_CALLS || []
          })
        })()
        """.trimIndent(),
      ),
    )
    if (value == "null") return JSONObject()
    return JSONObject(value)
  }

  private fun click(scenario: ActivityScenario<MainActivity>, text: String) = evaluate(
    scenario,
    """(() => { const value = """ + json(text) + """; const item = [...document.querySelectorAll('button')].find((button) => button.innerText.replace(/\s+/g, ' ').trim() === value || button.innerText.includes(value)); if (!item || item.disabled) return JSON.stringify(false); item.click(); return JSON.stringify(true) })()""",
  ).let(::string).toBoolean()

  private fun clickAria(scenario: ActivityScenario<MainActivity>, label: String) = evaluate(
    scenario,
    """(() => { const item = [...document.querySelectorAll('[aria-label]')].find((node) => node.getAttribute('aria-label') === """ + json(label) + """); if (!(item instanceof HTMLElement)) return JSON.stringify(false); item.click(); return JSON.stringify(true) })()""",
  ).let(::string).toBoolean()

  private fun closeNavigation(scenario: ActivityScenario<MainActivity>) = evaluate(
    scenario,
    """(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); return JSON.stringify(true) })()""",
  ).let(::string).toBoolean()

  private fun clickSummary(scenario: ActivityScenario<MainActivity>, text: String) = evaluate(
    scenario,
    """(() => { const value = """ + json(text) + """; const item = [...document.querySelectorAll('summary')].find((summary) => summary.innerText.replace(/\s+/g, ' ').trim() === value); if (!item) return JSON.stringify(false); item.click(); return JSON.stringify(true) })()""",
  ).let(::string).toBoolean()

  private fun scrollIntoView(scenario: ActivityScenario<MainActivity>, selector: String) = evaluate(
    scenario,
    """(() => { const item = document.querySelector(${json(selector)}); if (!item) return JSON.stringify(false); item.scrollIntoView({ block: 'center', inline: 'nearest' }); return JSON.stringify(true) })()""",
  ).let(::string).toBoolean()

  private fun scrollButtonIntoView(scenario: ActivityScenario<MainActivity>, label: String) = evaluate(
    scenario,
    """(() => { const value = ${json(label)}; const item = [...document.querySelectorAll('button')].find((button) => button.innerText.replace(/\s+/g, ' ').trim() === value); if (!item) return JSON.stringify(false); item.scrollIntoView({ block: 'center', inline: 'nearest' }); return JSON.stringify(true) })()""",
  ).let(::string).toBoolean()

  private fun input(scenario: ActivityScenario<MainActivity>, selector: String, value: String) = evaluate(
    scenario,
    """(() => { const item = document.querySelector(""" + json(selector) + """); if (!(item instanceof HTMLInputElement) && !(item instanceof HTMLTextAreaElement)) return JSON.stringify(false); const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(item), 'value')?.set; setter?.call(item, """ + json(value) + """); item.value = """ + json(value) + """; item.dispatchEvent(new Event('input', { bubbles: true })); item.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: """ + json(value) + """ })); item.dispatchEvent(new Event('change', { bubbles: true })); return JSON.stringify(true) })()""",
  ).let(::string).toBoolean()

  private fun submitField(scenario: ActivityScenario<MainActivity>, selector: String, value: String) = evaluate(
    scenario,
    """(() => { const item = document.querySelector(${json(selector)}); const form = item?.closest('form'); if (!(item instanceof HTMLInputElement) || !(form instanceof HTMLFormElement)) return JSON.stringify(false); item.value = ${json(value)}; form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); return JSON.stringify(true) })()""",
  ).let(::string).toBoolean()

  private fun submitPrompt(scenario: ActivityScenario<MainActivity>) = evaluate(
    scenario,
    """(() => { const form = document.querySelector('#agent-prompt')?.closest('form'); if (!(form instanceof HTMLFormElement)) return JSON.stringify(false); form.requestSubmit(); return JSON.stringify(true) })()""",
  ).let(::string).toBoolean()

  private fun clickSelector(scenario: ActivityScenario<MainActivity>, selector: String) = evaluate(
    scenario,
    """(() => { const item = document.querySelector(${json(selector)}); if (!(item instanceof HTMLElement) || item.hasAttribute('disabled')) return JSON.stringify(false); item.click(); return JSON.stringify(true) })()""",
  ).let(::string).toBoolean()

  private fun tapSelector(scenario: ActivityScenario<MainActivity>, selector: String): Boolean {
    val value = JSONObject(
      string(
        evaluate(
          scenario,
          """(() => { const item = document.querySelector(${json(selector)}); if (!(item instanceof HTMLElement)) return JSON.stringify({ ok: false }); item.scrollIntoView({ block: 'center', inline: 'nearest' }); const rect = item.getBoundingClientRect(); return JSON.stringify({ ok: rect.width > 0 && rect.height > 0, x: (rect.left + rect.width / 2) * devicePixelRatio, y: (rect.top + rect.height / 2) * devicePixelRatio }) })()""",
        ),
      ),
    )
    if (!value.optBoolean("ok")) return false
    InstrumentationRegistry.getInstrumentation().uiAutomation
      .executeShellCommand("input tap ${Math.round(value.getDouble("x"))} ${Math.round(value.getDouble("y"))}")
      .close()
    return true
  }

  private fun refreshInsets(scenario: ActivityScenario<MainActivity>) = evaluate(
    scenario,
    """(() => { window.dispatchEvent(new Event('resize')); window.visualViewport?.dispatchEvent(new Event('resize')); return JSON.stringify(true) })()""",
  ).let(::string).toBoolean()

  private fun showIme(scenario: ActivityScenario<MainActivity>) {
    scenario.onActivity { activity ->
      val web = activity.findViewById<WebView>(R.id.webview)
      ViewCompat.getWindowInsetsController(web)?.show(WindowInsetsCompat.Type.ime())
      (activity.getSystemService(android.content.Context.INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager)
        .showSoftInput(web, android.view.inputmethod.InputMethodManager.SHOW_IMPLICIT)
    }
  }

  private fun hideIme(scenario: ActivityScenario<MainActivity>) {
    scenario.onActivity { activity ->
      val web = activity.findViewById<WebView>(R.id.webview)
      ViewCompat.getWindowInsetsController(web)?.hide(WindowInsetsCompat.Type.ime())
      (activity.getSystemService(android.content.Context.INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager)
        .hideSoftInputFromWindow(web.windowToken, 0)
    }
  }

  private fun actualImeInset(scenario: ActivityScenario<MainActivity>): Int {
    val result = AtomicReference(0)
    scenario.onActivity { activity ->
      val web = activity.findViewById<WebView>(R.id.webview)
      result.set(ViewCompat.getRootWindowInsets(web)?.getInsets(WindowInsetsCompat.Type.ime())?.bottom ?: 0)
    }
    return result.get()
  }

  private fun agentState(scenario: ActivityScenario<MainActivity>) = JSONObject(
    string(
      evaluate(
        scenario,
        """
        (() => {
          const box = (item) => {
            if (!(item instanceof Element)) return { width: 0, height: 0, top: -1, bottom: -1, left: -1, right: -1, visible: false };
            const rect = item.getBoundingClientRect();
            const viewport = visualViewport || { width: innerWidth, height: innerHeight };
            const style = getComputedStyle(item);
            return { width: Math.round(rect.width), height: Math.round(rect.height), top: Math.round(rect.top), bottom: Math.round(rect.bottom), left: Math.round(rect.left), right: Math.round(rect.right), visible: rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.left < viewport.width && rect.bottom > 0 && rect.top < viewport.height && style.display !== 'none' && style.visibility !== 'hidden' };
          };
          const workspace = document.querySelector('[data-agent-workspace]');
          const panel = document.querySelector('[data-agent-panel]');
          const appbar = document.querySelector('[data-agent-app-bar]');
          const scroll = document.querySelector('[data-agent-scroll]');
          const context = document.querySelector('[data-agent-context]');
          const composer = document.querySelector('[data-agent-composer]');
          const prompt = document.querySelector('[data-agent-prompt]');
          const completion = document.querySelector('[data-agent-entry="completion"]');
          const active = document.querySelector('[data-agent-interaction-active="true"]');
          return JSON.stringify({
            phase: workspace?.getAttribute('data-agent-phase') || '',
            detached: workspace?.getAttribute('data-agent-detached') === 'true' && !document.querySelector('[data-ssh-active-session]'),
            restored: !!document.querySelector('[data-agent-restored]'),
            starts: window.__SLOPCODE_TEST_ORCHESTRATOR_STARTS || 0,
            height: Math.round(visualViewport?.height || innerHeight),
            pixelRatio: devicePixelRatio || 1,
            imeBottom: Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--android-ime-bottom')) || 0,
            firstViewport: panel?.firstElementChild === appbar && panel?.lastElementChild === composer && scroll?.scrollTop === 0 && box(composer).visible,
            compactContext: context instanceof HTMLDetailsElement && !context.open && box(context).height <= 64,
            composer: box(composer),
            prompt: box(prompt),
            promptDisabled: Boolean(prompt?.disabled),
            promptFocused: document.activeElement === prompt,
            entries: [...document.querySelectorAll('[data-agent-entry]')].map((item) => item.getAttribute('data-agent-entry')),
            interaction: active?.getAttribute('data-interaction-id') || '',
            focusAction: document.activeElement?.getAttribute('data-agent-action') || '',
            focusAnswer: document.activeElement?.getAttribute('data-agent-answer') || '',
            reviewTabs: document.querySelectorAll('[data-review-tab]').length,
            review: document.querySelector('[data-review-panel]')?.getAttribute('data-review-selected') || '',
            reviewEmpty: !!document.querySelector('[data-review-empty]'),
            reviewItems: document.querySelectorAll('[data-review-item]').length,
            completionLive: !completion?.hasAttribute('aria-live') && !!document.querySelector('[data-agent-status-live][role="status"][aria-live="polite"]')
          });
        })()
        """.trimIndent(),
      ),
    ),
  )

  private fun recreateWithFakeBridge(scenario: ActivityScenario<MainActivity>) {
    val values = string(
      evaluate(
        scenario,
        "JSON.stringify(window.__SLOPCODE_TEST_STORAGE?.() || {})",
      ),
    )
    scenario.onActivity {
      script?.remove()
      script = null
    }
    scenario.recreate()
    scenario.onActivity { activity ->
      val web = activity.findViewById<WebView>(R.id.webview)
      script = WebViewCompat.addDocumentStartJavaScript(web, fake(session = true, values = values), setOf(ORIGIN))
      web.reload()
    }
  }

  private fun toggleHidden(scenario: ActivityScenario<MainActivity>) = evaluate(
    scenario,
    """(() => { const details = [...document.querySelectorAll('details')].find((item) => item.querySelector('summary')?.innerText.trim() === 'More'); const item = details?.querySelector("input[type='checkbox']"); if (!(item instanceof HTMLInputElement)) return JSON.stringify(false); details.open = true; item.checked = true; item.dispatchEvent(new Event('change', { bubbles: true })); return JSON.stringify(true) })()""",
  ).let(::string).toBoolean()

  private fun evaluate(scenario: ActivityScenario<MainActivity>, code: String): String {
    val result = AtomicReference<String>()
    val latch = CountDownLatch(1)
    scenario.onActivity { activity ->
      activity.findViewById<WebView>(R.id.webview).evaluateJavascript(code) {
        result.set(it)
        latch.countDown()
      }
    }
    assertTrue("Timed out waiting for rendered WebView DOM.", latch.await(10, TimeUnit.SECONDS))
    return result.get()
  }

  private fun waitFor(scenario: ActivityScenario<MainActivity>, predicate: () -> Boolean) {
    val end = System.nanoTime() + TimeUnit.SECONDS.toNanos(15)
    while (System.nanoTime() < end) {
      if (predicate()) return
      Thread.sleep(100)
    }
    throw AssertionError("Timed out waiting for rendered Android UI state: " + snapshot(scenario))
  }

  private fun waitForStableDocument(
    scenario: ActivityScenario<MainActivity>,
    predicate: (JSONObject) -> Boolean,
  ) {
    val end = System.nanoTime() + TimeUnit.SECONDS.toNanos(15)
    var document = Double.NaN
    var stable = System.nanoTime()
    while (System.nanoTime() < end) {
      val state = snapshot(scenario)
      val current = state.optDouble("document", Double.NaN)
      if (current != document) {
        document = current
        stable = System.nanoTime()
      }
      if (predicate(state) && System.nanoTime() - stable >= TimeUnit.MILLISECONDS.toNanos(500)) return
      Thread.sleep(100)
    }
    throw AssertionError("Timed out waiting for a stable rendered Android document: " + snapshot(scenario))
  }

  private fun rotate(scenario: ActivityScenario<MainActivity>, orientation: Int) {
    scenario.onActivity { it.requestedOrientation = orientation }
    val landscape = orientation == ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
    waitFor(scenario) { snapshot(scenario).optBoolean("landscape") == landscape }
  }

  private fun restorePortrait(scenario: ActivityScenario<MainActivity>) {
    scenario.onActivity { it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT }
    waitFor(scenario) { !snapshot(scenario).optBoolean("landscape") }
  }

  private fun scrollLandscapeForActions(scenario: ActivityScenario<MainActivity>) {
    val result = evaluate(
      scenario,
      "(() => { const content = document.querySelector('[data-ssh-shell-content]'); const main = content?.querySelector('main'); if (!main) return JSON.stringify({ scrollable: false }); main.scrollTo({ top: Math.max(0, main.scrollHeight - main.clientHeight), left: 0, behavior: 'instant' }); return JSON.stringify({ scrollable: content.contains(main) && main.scrollHeight >= main.clientHeight, scrollTop: main.scrollTop }); })()",
    )
    assertTrue("The SSH shell content container is not the measured landscape scroll surface: " + result, string(result).contains("\"scrollable\":true"))
  }

  private fun hasElement(scenario: ActivityScenario<MainActivity>, selector: String) = evaluate(
    scenario,
    "JSON.stringify(!!document.querySelector(" + json(selector) + "))",
  ).let(::string).toBoolean()

  private fun actualTopInset(scenario: ActivityScenario<MainActivity>): Int {
    val result = AtomicReference(0)
    scenario.onActivity { activity ->
      val web = activity.findViewById<WebView>(R.id.webview)
      val insets = ViewCompat.getRootWindowInsets(web)
      result.set(
        insets?.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())?.top ?: 0,
      )
    }
    return result.get()
  }

  private fun assertMenuBelowActualInset(scenario: ActivityScenario<MainActivity>, state: JSONObject) {
    val menu = state.getJSONObject("buttons").getJSONObject("menu")
    val ratio = state.optDouble("pixelRatio", 1.0)
    val top = actualTopInset(scenario).toDouble() / ratio
    assertTrue("The menu is not visible in the rendered layout.", menu.optBoolean("visible"))
    assertTrue("The menu overlaps the actual top inset.", menu.getDouble("top") + 1.0 >= top)
    assertTrue("The CSS inset variable is not reflected in the menu position.", menu.getDouble("top") + 1.0 >= state.getJSONObject("insets").getDouble("top"))
  }

  private fun assertHit(state: JSONObject, name: String, label: String = name) {
    assertHitRect(state.getJSONObject("buttons").getJSONObject(name), "buttons." + name, label)
  }

  private fun assertHitRect(rect: JSONObject, path: String, label: String) {
    assertTrue(label + " is not visible in the rendered UI: " + rect, rect.optBoolean("visible"))
    assertTrue(label + " width is below 48dp: " + rect.optInt("width"), rect.optInt("width") >= 48)
    assertTrue(label + " height is below 48dp: " + rect.optInt("height"), rect.optInt("height") >= 48)
  }

  private fun overlaps(state: JSONObject, first: String, second: String): Boolean {
    val a = state.getJSONObject("buttons").getJSONObject(first)
    val b = state.getJSONObject("buttons").getJSONObject(second)
    return a.getInt("left") < b.getInt("right") &&
      a.getInt("right") > b.getInt("left") &&
      a.getInt("top") < b.getInt("bottom") &&
      a.getInt("bottom") > b.getInt("top")
  }

  private fun agentCards(state: JSONObject): Map<String, JSONObject> {
    val cards = state.getJSONArray("agentCards")
    return (0 until cards.length()).associate {
      val card = cards.getJSONObject(it)
      card.getString("name") to card
    }
  }

  private fun assertSetup(state: JSONObject, action: String, title: String) {
    val setup = state.optJSONObject("setup") ?: error("Expected rendered setup content for " + title + ".")
    assertTrue("Setup title was not rendered: " + title, setup.optString("text").contains(title))
    assertEquals(action, setup.optString("action"))
    val steps = setup.getJSONArray("steps").toString()
    assertTrue(steps.contains("Installing"))
    assertTrue(steps.contains("Signing in"))
    assertTrue(steps.contains("Verifying"))
  }

  private fun assertContrast(state: JSONObject, name: String) {
    val ratio = state.getJSONObject("contrast").getDouble(name)
    assertTrue(name + " contrast is below WCAG AA: " + ratio, ratio >= 4.5)
  }

  private fun assertInsetVariables(state: JSONObject) {
    val insets = state.getJSONObject("insets")
    listOf("top", "right", "bottom", "left", "imeBottom").forEach {
      assertTrue("Missing CSS inset variable: " + it, insets.has(it))
      assertTrue("Negative CSS inset variable: " + it, insets.getDouble(it) >= 0)
    }
  }

  private fun nativeSystemBarCalls(state: JSONObject): List<Boolean> {
    val calls = state.optJSONArray("nativeSystemBars") ?: return emptyList()
    return (0 until calls.length()).map { calls.getBoolean(it) }
  }

  private fun assertSemantic(scenario: ActivityScenario<MainActivity>, label: String) {
    val result = JSONObject(
      string(
        evaluate(
          scenario,
          """(() => { const item = [...document.querySelectorAll('[aria-label]')].find((node) => node.getAttribute('aria-label') === """ + json(label) + """); if (!item) return JSON.stringify({ exists: false }); const rect = item.getBoundingClientRect(); return JSON.stringify({ exists: true, visible: rect.width > 0 && rect.height > 0, label: item.getAttribute('aria-label') }); })()""",
        ),
      ),
    )
    assertTrue("No rendered semantic control found for " + label + ".", result.optBoolean("exists"))
    assertTrue(label + " is not visible in the rendered UI.", result.optBoolean("visible"))
    assertEquals(label, result.optString("label"))
  }

  private fun preferences() = EncryptedSharedPreferences.create(
    context(),
    "slopcode.slopcode.android.remote.dat",
    MasterKey.Builder(context()).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
  )

  private fun savedWorkspace() = JSONObject()
    .put("version", 1)
    .put("target", "agent@void")
    .put("profile", "agent@void:22")
    .put("host", "void")
    .put("port", 22)
    .put("username", "agent")
    .put("directory", "/home/marcos/temp")
    .put("agent", "opencode-cli")
    .put("recentTargets", JSONArray().put("agent@void"))
    .put("recentFolders", JSONArray().put("/home/marcos/temp"))
    .toString()

  private fun fake(session: Boolean = false, values: String = "{}") = """
    (() => {
      const native = window.SlopcodeAndroid;
      const nativePost = typeof native?.postMessage === 'function' ? native.postMessage.bind(native) : null;
      const nativeBars = [];
      const systemBars = [];
      const bridgeCalls = [];
      window.__SLOPCODE_TEST_NATIVE_SYSTEM_BAR_CALLS = nativeBars;
      window.__SLOPCODE_TEST_SYSTEM_BAR_CALLS = systemBars;
      window.__SLOPCODE_TEST_BRIDGE_CALLS = bridgeCalls;
      const values = new Map(Object.entries(__VALUES__));
      window.__SLOPCODE_TEST_STORAGE = () => Object.fromEntries(values);
      window.__SLOPCODE_TEST_ORCHESTRATOR_STARTS = 0;
      const workspace = __WORKSPACE__;
      let connected = __CONNECTED__;
      let profile = __PROFILE__;
      let nonce = '';
      let channel = '';
      const reply = (port, id, result) => queueMicrotask(() => port.onmessage?.({ data: JSON.stringify({ id, ok: true, result }) }));
      const line = (value, delay = 0) => window.setTimeout(() => {
        const data = JSON.stringify({ type: 'slopcode.ssh', channel: 'slopcode.android.ssh', nonce, event: { type: 'orchestrator_output', id: channel, data: JSON.stringify(value) } });
        window.dispatchEvent(new MessageEvent('message', { data, origin: '', source: null }));
      }, delay);
      const listing = (path, hidden) => ({
        path,
        parent: path === '/home/marcos/temp' ? '/home/marcos' : '/home/marcos/temp',
        entries: [
          { name: 'src', path: path + '/src', type: 'directory' },
          { name: 'README.md', path: path + '/README.md', type: 'file', size: 12 },
          ...(hidden ? [{ name: '.fixture-hidden', path: path + '/.fixture-hidden', type: 'file', size: 1 }] : [])
        ]
      });
      const port = {
        onmessage: null,
        postMessage(raw) {
          const request = JSON.parse(raw);
          bridgeCalls.push(request.method);
          const args = request.args || [];
          const parse = (value) => { try { return JSON.parse(value || '{}'); } catch { return {}; } };
          const call = ['sshConnect', 'sshExec', 'sshAuthStatus', 'sshCodexAppServerStatus', 'sshStart', 'sshOrchestratorStart'].includes(request.method) ? parse(args[0]) : {};
          const frame = request.method === 'sshOrchestratorInput' ? parse(args[0]) : {};
          if (request.method === 'setSystemBars') {
            const dark = args[0] === true;
            systemBars.push(dark);
            if (nativePost) {
              nativeBars.push(dark);
              nativePost(raw);
            }
            reply(port, request.id, null);
            return;
          }
          if (request.method === 'systemInsets') {
            if (nativePost) {
              nativePost(raw);
              return;
            }
            reply(port, request.id, { top: 0, right: 0, bottom: 0, left: 0, imeBottom: 0 });
            return;
          }
          let result = null;
          if (request.method === 'capabilities') result = { secureStorage: true, qrPairing: false, notifications: false, deepLinks: false, remoteTransport: true, backgroundExecution: false, remoteJobs: false };
          if (request.method === 'storageGet') result = __STORAGE__ values.get(args[0] + ':' + args[1]) || null;
          if (request.method === 'storageSet') { values.set(args[0] + ':' + args[1], args[2]); result = null; }
          if (request.method === 'storageRemove') { values.delete(args[0] + ':' + args[1]); result = null; }
          if (request.method === 'storageClear') { values.clear(); result = null; }
          if (request.method === 'storageKeys') result = [];
          if (request.method === 'storageLength') result = 0;
          if (request.method === 'sshEventsReady') { nonce = String(args[0] || ''); result = true; }
          if (request.method === 'sshStatus') result = { connected, remoteTransport: connected, ...(connected ? { profile } : {}) };
          if (request.method === 'sshConnect') { profile = call.profile; connected = true; result = { status: 'connected', profile, host: call.host, port: call.port, remoteTransport: true }; }
          if (request.method === 'sshDisconnect' || request.method === 'sshCleanup') { connected = false; result = null; }
          if (request.method === 'sshHome') result = { path: '/home/marcos/temp' };
          if (request.method === 'sshList') result = listing(args[0], args[1] === true);
          if (request.method === 'sshSelectWorkspace') result = { path: args[0] };
          if (request.method === 'sshCredentialGet') result = null;
          if (request.method === 'sshCredentialSet' || request.method === 'sshCredentialClear') result = null;
          if (request.method === 'sshExec') {
            const missing = call.agent === 'codex-cli' || call.agent === 'antigravity-cli';
            result = { agent: call.agent, executable: call.agent, exitCode: missing ? 127 : 0, output: missing ? 'not found' : 'ready', ok: !missing };
          }
          if (request.method === 'sshCodexAppServerStatus') result = { executable: 'codex', state: 'not_installed', ready: false, handshake: 'not_run', message: 'Install Codex before its App Server can start.', output: 'codex: not found', preflight: { agent: 'codex-cli', executable: 'codex', exitCode: 127, output: 'not found', ok: false } };
          if (request.method === 'sshAuthStatus') result = { agent: call.agent, executable: call.agent, exitCode: 0, output: call.agent === 'opencode-cli' ? 'sign in required' : 'signed in', ok: true, loggedIn: call.agent !== 'opencode-cli' };
          if (request.method === 'sshOrchestratorStart') { window.__SLOPCODE_TEST_ORCHESTRATOR_STARTS += 1; channel = 'ssh_orchestrator'; result = { id: channel, status: 'started' }; }
          if (request.method === 'sshOrchestratorInput') {
            if (frame.type === 'workspace.open') line({ kind: 'response', requestID: frame.requestID, workspace: { id: 'wrk_android' } });
            if (frame.type === 'session.create') line({ kind: 'response', requestID: frame.requestID, sessionID: 'ssh_fixture' });
            if (frame.type === 'turn.create' || typeof frame.prompt === 'string') {
              line({ kind: 'response', requestID: frame.requestID, turnID: 'turn_fixture' });
              line({ kind: 'event', cursor: 'cur_output', sessionID: 'ssh_fixture', turnID: 'turn_fixture', type: 'turn.output', text: 'Inspecting the workspace.' }, 10);
              line({ kind: 'event', cursor: 'cur_reasoning', sessionID: 'ssh_fixture', turnID: 'turn_fixture', type: 'turn.reasoning', text: 'Use the smallest safe fixture.' }, 15);
              line({ kind: 'event', cursor: 'cur_plan', sessionID: 'ssh_fixture', turnID: 'turn_fixture', type: 'plan.available', plan: { id: 'plan_fixture', content: '1. Create a fixture app\\n2. Verify the rendered result' } }, 20);
              line({ kind: 'event', cursor: 'cur_tool', sessionID: 'ssh_fixture', turnID: 'turn_fixture', type: 'tool.updated', tool: { id: 'tool_fixture', title: 'Create app files', status: 'in_progress', kind: 'edit', metadata: { path: '/home/marcos/temp/fixture.ts', progress: '1/2' } } }, 25);
              line({ kind: 'event', cursor: 'cur_approval', sessionID: 'ssh_fixture', turnID: 'turn_fixture', type: 'interaction.approval.requested', interaction: { id: 'approval_fixture', revision: 1, title: 'Create app files?', command: 'mkdir -p ./fixture-app', cwd: '/home/marcos/temp', reason: 'The agent needs to create the requested local app.', risk: 'low' } }, 30);
            }
            if (frame.type === 'interaction.approval.reply') {
              line({ kind: 'response', requestID: frame.requestID });
              line({ kind: 'event', cursor: 'cur_question', sessionID: 'ssh_fixture', turnID: 'turn_fixture', type: 'interaction.question.requested', interaction: { id: 'question_fixture', revision: 1, prompt: 'Which language should the fixture use?', allowFreeform: true } }, 20);
            }
            if (frame.type === 'interaction.question.reply') {
              line({ kind: 'response', requestID: frame.requestID });
              line({ kind: 'event', cursor: 'cur_tool_done', sessionID: 'ssh_fixture', turnID: 'turn_fixture', type: 'tool.updated', tool: { id: 'tool_fixture', title: 'Create app files', status: 'completed', kind: 'edit', metadata: { path: '/home/marcos/temp/fixture.ts', progress: '2/2' } } }, 10);
              line({ kind: 'event', cursor: 'cur_test', sessionID: 'ssh_fixture', turnID: 'turn_fixture', type: 'tool.updated', tool: { id: 'test_fixture', title: 'Run fixture tests', status: 'completed', kind: 'execute', metadata: { test: 'Android UI', result: 'passed', exitCode: '0' } } }, 15);
              line({ kind: 'event', cursor: 'cur_diff', sessionID: 'ssh_fixture', turnID: 'turn_fixture', type: 'artifact.created', artifact: { id: 'diff_fixture', name: 'fixture.diff', path: '/home/marcos/temp/fixture.diff', kind: 'diff', size: 128 } }, 20);
              line({ kind: 'event', cursor: 'cur_file', sessionID: 'ssh_fixture', turnID: 'turn_fixture', type: 'artifact.created', artifact: { id: 'file_fixture', name: 'fixture.ts', path: '/home/marcos/temp/fixture.ts', kind: 'file', size: 256 } }, 25);
              line({ kind: 'event', cursor: 'cur_image', sessionID: 'ssh_fixture', turnID: 'turn_fixture', type: 'artifact.created', artifact: { id: 'image_fixture', name: 'fixture.png', path: '/home/marcos/temp/fixture.png', kind: 'image', size: 512, mime: 'image/png' } }, 30);
              line({ kind: 'event', cursor: 'cur_complete', sessionID: 'ssh_fixture', turnID: 'turn_fixture', type: 'turn.completed', status: 'completed', message: 'Fixture verified.' }, 35);
            }
            result = true;
          }
          if (request.method === 'sshOrchestratorStop') result = true;
          if (request.method === 'sshStart') result = { id: 'pty_fixture', operation: call.operation || 'prompt', agent: call.agent || 'slopcode' };
          if (request.method === 'deepLinksReady' || request.method === 'remoteJobsReady') result = true;
          if (request.method === 'consumeDeepLinks' || request.method === 'remoteJobList') result = [];
          reply(port, request.id, result);
        }
      };
      if (native && nativePost) {
        const previous = native.onmessage;
        native.onmessage = (event) => {
          previous?.(event);
          port.onmessage?.(event);
        };
      }
      Object.defineProperty(window, 'SlopcodeAndroid', { configurable: true, value: port });
    })();
  """.trimIndent()
    .replace("__WORKSPACE__", json(savedWorkspace()))
    .replace("__CONNECTED__", if (session) "true" else "false")
    .replace("__PROFILE__", json(if (session) "agent@void:22" else ""))
    .replace("__VALUES__", values)
    .replace(
      "__STORAGE__",
      if (session) "args[0] === 'slopcode.android.remote.dat' && args[1] === 'ssh.workspace.v1' ? workspace :" else "",
    )

  private fun string(value: String) = JSONArray("[$value]").getString(0)

  private fun json(value: String) = JSONObject.quote(value)

  private fun context() = InstrumentationRegistry.getInstrumentation().targetContext

  companion object {
    private const val ORIGIN = "https://appassets.androidplatform.net"
    private const val SSH_WORKSPACE_KEY = "ssh.workspace.v1"
    private var script: ScriptHandler? = null
  }
}
