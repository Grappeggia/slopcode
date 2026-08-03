package dev.slopcode.android

import android.util.Base64
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.jcraft.jsch.HostKey
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import org.junit.runner.RunWith
import java.nio.charset.StandardCharsets
import java.io.File

@RunWith(AndroidJUnit4::class)
class SshTransportInstrumentedTest {
  @Test
  fun configuredHostSupportsSftpPreflightAndPtyLifecycle() {
    val args = InstrumentationRegistry.getArguments()
    val key = key(args)
    assumeTrue("Pass -e sshKeyB64=... to run the live SSH test", !key.isNullOrBlank())
    val host = args.getString("sshHost", "10.0.2.2")
    val port = args.getString("sshPort", "22").toInt()
    val user = args.getString("sshUser", "marcos")
    val directory = args.getString("sshDirectory", "/tmp")
    val profile = "$user@$host:$port"
    val events = mutableListOf<JSONObject>()
    val transport = SshTransport(InstrumentationRegistry.getInstrumentation().targetContext) { event ->
      synchronized(events) { events += JSONObject(event.toString()) }
    }
    try {
      val result = connect(transport, profile, host, port, user, directory, key!!)
      assertTrue("Unexpected SSH result: $result", result.optString("status") == "connected")
      assertTrue(transport.status().optBoolean("remoteTransport"))
      assertNotNull(transport.list(directory))

      SshAgent.entries.forEach { agent ->
        val version = transport.version(JSONObject().put("agent", agent.id).put("directory", directory).toString())
        assertTrue("${agent.id}: ${version.optString("error")}", version.optBoolean("ok"))
      }

      SshAgent.entries.forEach { agent ->
        val session = transport.start(
          JSONObject()
            .put("operation", "prompt")
            .put("agent", agent.id)
            .put("directory", directory)
            .put("prompt", "Print exactly SSH_E2E_OK and exit")
            .toString(),
        )
        assertTrue(session.optString("id").startsWith("ssh_"))
        waitForCompletion(events, session.optString("id"))
      }

      val interactive = transport.start(
        JSONObject()
          .put("operation", "interactive")
          .put("agent", SshAgent.SLOPCODE.id)
          .put("directory", directory)
          .toString(),
      )
      transport.resize(100, 30, 0, 0)
      transport.input("SSH_INTERACTIVE_E2E\n")
      transport.interrupt()
      waitForCompletion(events, interactive.optString("id"))
      transport.disconnect()
      assertFalse(transport.status().optBoolean("remoteTransport"))
      val reconnect = transport.connect(
        JSONObject()
          .put("profile", profile)
          .put("host", host)
          .put("port", port)
          .put("username", user)
          .put("directory", directory)
          .put("auth", "privateKey")
          .put("privateKey", key)
          .put("saveCredentials", false)
          .toString(),
      )
      assertTrue(reconnect.optString("status") == "connected")
    } finally {
      transport.close()
    }
  }

  @Test
  fun configuredHostCanInstallMissingAgentsThroughAllowlistedSetup() {
    val args = InstrumentationRegistry.getArguments()
    val key = key(args)
    assumeTrue("Pass -e sshKeyB64=... to run the live SSH test", !key.isNullOrBlank())
    val host = args.getString("sshHost", "10.0.2.2")
    val port = args.getString("sshPort", "22").toInt()
    val user = args.getString("sshUser", "marcos")
    val directory = args.getString("sshDirectory", "/tmp")
    val profile = "$user@$host:$port"
    val events = mutableListOf<JSONObject>()
    val transport = SshTransport(InstrumentationRegistry.getInstrumentation().targetContext) { event ->
      synchronized(events) { events += JSONObject(event.toString()) }
    }
    try {
      assertEquals("connected", connect(transport, profile, host, port, user, directory, key!!).optString("status"))
      SshAgent.entries.forEach { agent ->
        val version = transport.version(JSONObject().put("agent", agent.id).put("directory", directory).toString())
        if (version.optBoolean("ok")) return@forEach
        assertEquals(127, version.optInt("exitCode"))
        val setup = transport.start(
          JSONObject()
            .put("operation", SshSetupAction.INSTALL.id)
            .put("agent", agent.id)
            .put("directory", directory)
            .toString(),
        )
        assertTrue(setup.optString("id").startsWith("ssh_"))
        assertEquals(0, waitForCompletion(events, setup.optString("id")))
        val ready = transport.version(JSONObject().put("agent", agent.id).put("directory", directory).toString())
        assertTrue("${agent.id}: ${ready.optString("error")}", ready.optBoolean("ok"))
      }
    } finally {
      transport.close()
    }
  }

  @Test
  fun configuredHostStartsEachAllowlistedLoginFlow() {
    val args = InstrumentationRegistry.getArguments()
    val key = key(args)
    assumeTrue("Pass -e sshKeyB64=... to run the live SSH test", !key.isNullOrBlank())
    val host = args.getString("sshHost", "10.0.2.2")
    val port = args.getString("sshPort", "22").toInt()
    val user = args.getString("sshUser", "marcos")
    val directory = args.getString("sshDirectory", "/tmp")
    val profile = "$user@$host:$port"
    val events = mutableListOf<JSONObject>()
    val transport = SshTransport(InstrumentationRegistry.getInstrumentation().targetContext) { event ->
      synchronized(events) { events += JSONObject(event.toString()) }
    }
    try {
      assertEquals("connected", connect(transport, profile, host, port, user, directory, key!!).optString("status"))
      SshAgent.entries.forEach { agent ->
        val session = transport.start(
          JSONObject()
            .put("operation", SshSetupAction.LOGIN.id)
            .put("agent", agent.id)
            .put("directory", directory)
            .toString(),
        )
        assertTrue(session.optString("id").startsWith("ssh_"))
        Thread.sleep(2_000)
        val completed = synchronized(events) {
          events.any { it.optString("type") == "completed" && it.optString("id") == session.optString("id") }
        }
        if (!completed) transport.interrupt()
        waitForCompletion(events, session.optString("id"))
      }
    } finally {
      transport.close()
    }
  }

  @Test
  fun configuredHostRunsTheNativeAgentOrchestrator() {
    val args = InstrumentationRegistry.getArguments()
    val key = key(args)
    assumeTrue("Pass -e sshKeyB64=... to run the live SSH test", !key.isNullOrBlank())
    val host = args.getString("sshHost", "10.0.2.2")
    val port = args.getString("sshPort", "22").toInt()
    val user = args.getString("sshUser", "marcos")
    val directory = args.getString("sshDirectory", "/tmp")
    val selected = args.getString("sshAgent", "slopcode-cli")
    val protocolAgent = when (selected) {
      "codex-cli" -> "codex"
      "opencode-cli" -> "opencode"
      "claude-code" -> "claude"
      "antigravity-cli" -> "antigravity"
      else -> "slopcode"
    }
    val profile = "$user@$host:$port"
    val events = mutableListOf<JSONObject>()
    val transport = SshTransport(InstrumentationRegistry.getInstrumentation().targetContext) { event ->
      synchronized(events) { events += JSONObject(event.toString()) }
    }
    try {
      assertEquals("connected", connect(transport, profile, host, port, user, directory, key!!).optString("status"))
      val started = transport.orchestratorStart(JSONObject().put("directory", directory).toString())
      assertTrue(started.optString("id").startsWith("ssh_"))
      send(
        transport,
        JSONObject()
          .put("version", "v1")
          .put("kind", "request")
          .put("type", "workspace.open")
          .put("requestID", "req_android_workspace")
          .put("idempotencyKey", "idem_android_workspace")
          .put("workspace", JSONObject().put("id", "wrk_android").put("path", directory).put("name", "Android E2E"))
          .put("agent", JSONObject().put("id", protocolAgent).put("capabilities", org.json.JSONArray(listOf("workspace", "sessions", "turns")))),
      )
      val workspace = waitForOrchestratorResponse(events, "req_android_workspace")
      assertEquals("workspace.open", workspace.optString("type"))
      send(
        transport,
        JSONObject()
          .put("version", "v1")
          .put("kind", "request")
          .put("type", "session.create")
          .put("requestID", "req_android_session")
          .put("idempotencyKey", "idem_android_session")
          .put("workspaceID", "wrk_android")
          .put("agent", protocolAgent)
          .put("title", "Android E2E"),
      )
      val session = waitForOrchestratorResponse(events, "req_android_session")
      val sessionID = session.optString("sessionID")
      assertTrue(sessionID.startsWith("ses_"))
      send(
        transport,
        JSONObject()
          .put("version", "v1")
          .put("kind", "request")
          .put("type", "turn.create")
          .put("requestID", "req_android_turn")
          .put("idempotencyKey", "idem_android_turn")
          .put("sessionID", sessionID)
          .put("agent", protocolAgent)
          .put("prompt", "Print exactly SSH_ORCHESTRATOR_E2E_OK and exit"),
      )
      assertEquals("turn.create", waitForOrchestratorResponse(events, "req_android_turn").optString("type"))
      waitForOrchestratorOutput(events, "SSH_ORCHESTRATOR_E2E_OK")
      assertEquals("completed", waitForOrchestratorType(events, "turn.completed").optString("status"))
    } finally {
      transport.orchestratorStop()
      transport.close()
    }
  }

  @Test
  fun wrongPasswordAndNetworkFailureAreActionable() {
    val args = InstrumentationRegistry.getArguments()
    val key = key(args)
    assumeTrue("Pass -e sshKeyB64=... to run the live SSH test", !key.isNullOrBlank())
    val host = args.getString("sshHost", "10.0.2.2")
    val user = args.getString("sshUser", "marcos")
    val profile = "$user@$host:22"
    val transport = SshTransport(InstrumentationRegistry.getInstrumentation().targetContext) { }
    try {
      assertEquals("connected", connect(transport, profile, host, 22, user, "/tmp", key!!).optString("status"))
      val passwordError = runCatching {
        transport.connect(
          JSONObject()
            .put("profile", "$user@$host:22")
            .put("host", host)
            .put("port", 22)
            .put("username", user)
            .put("directory", "/tmp")
            .put("auth", "password")
            .put("password", "definitely-wrong")
            .put("saveCredentials", false)
            .toString(),
        )
      }.exceptionOrNull()
      assertTrue(passwordError is SshTransportException)
      assertEquals("authentication_failed", (passwordError as SshTransportException).code)
      val networkError = runCatching {
        transport.connect(
          JSONObject()
            .put("profile", "$user@$host:1")
            .put("host", host)
            .put("port", 1)
            .put("username", user)
            .put("directory", "/tmp")
            .put("auth", "password")
            .put("password", "definitely-wrong")
            .put("saveCredentials", false)
            .toString(),
        )
      }.exceptionOrNull()
      assertTrue(networkError is SshTransportException)
      assertEquals("network_error", (networkError as SshTransportException).code)
    } finally {
      transport.close()
    }
  }

  @Test
  fun changedHostKeyIsRejected() {
    val args = InstrumentationRegistry.getArguments()
    val key = key(args)
    assumeTrue("Pass -e sshKeyB64=... to run the live SSH test", !key.isNullOrBlank())
    val host = args.getString("sshHost", "10.0.2.2")
    val user = args.getString("sshUser", "marcos")
    val profile = "$user@$host:22"
    val transport = SshTransport(InstrumentationRegistry.getInstrumentation().targetContext) { }
    val store = SshHostKeyStore(InstrumentationRegistry.getInstrumentation().targetContext)
    try {
      assertEquals("connected", connect(transport, profile, host, 22, user, "/tmp", key!!).optString("status"))
      val known = store.getHostKey(host, null).firstOrNull()
      assertNotNull("The live SSH host key was not persisted", known)
      val original = known!!
      val changed = Base64.decode(original.key, Base64.DEFAULT).also { it[it.lastIndex] = (it[it.lastIndex].toInt() xor 1).toByte() }
      store.trust(HostKey(host, changed))
      val error = runCatching {
        transport.connect(connection(profile, host, 22, user, "/tmp", key!!).toString())
      }.exceptionOrNull()
      store.remove(host, null)
      store.trust(original)
      assertTrue(error is SshTransportException)
      assertEquals("host_key_mismatch", (error as SshTransportException).code)
    } finally {
      transport.close()
    }
  }

  private fun key(args: android.os.Bundle): String? = args.getString("sshKeyPath")?.let {
    runCatching { File(it).readText(StandardCharsets.UTF_8) }.getOrNull()
  } ?: args.getString("sshKeyB64")?.let {
    runCatching { String(Base64.decode(it, Base64.DEFAULT), StandardCharsets.UTF_8) }.getOrNull()
  }

  private fun connect(
    transport: SshTransport,
    profile: String,
    host: String,
    port: Int,
    user: String,
    directory: String,
    key: String,
  ): JSONObject {
    val request = connection(profile, host, port, user, directory, key)
    var result = transport.connect(request.toString())
    if (result.optString("status") != "host_key_required") return result
    val fingerprint = result.optString("fingerprint")
    assertTrue(fingerprint.isNotBlank())
    assertEquals("trusted", transport.trust(JSONObject().put("profile", profile).put("fingerprint", fingerprint).toString()).optString("status"))
    result = transport.connect(request.toString())
    return result
  }

  private fun connection(profile: String, host: String, port: Int, user: String, directory: String, key: String) =
    JSONObject()
      .put("profile", profile)
      .put("host", host)
      .put("port", port)
      .put("username", user)
      .put("directory", directory)
      .put("auth", "privateKey")
      .put("privateKey", key)
      .put("saveCredentials", false)

  private fun waitForCompletion(events: MutableList<JSONObject>, id: String): Int {
    val deadline = System.currentTimeMillis() + 60_000
    while (System.currentTimeMillis() < deadline) {
      synchronized(events) {
        events.firstOrNull { it.optString("type") == "completed" && it.optString("id") == id }?.let {
          return it.optInt("exitCode", -1)
        }
      }
      Thread.sleep(100)
    }
    throw AssertionError("SSH session $id did not complete")
  }

  private fun send(transport: SshTransport, frame: JSONObject) {
    transport.orchestratorInput(frame.toString())
  }

  private fun waitForOrchestratorResponse(events: MutableList<JSONObject>, requestID: String): JSONObject {
    val deadline = System.currentTimeMillis() + 60_000
    while (System.currentTimeMillis() < deadline) {
      synchronized(events) {
        events.asSequence()
          .filter { it.optString("type") == "orchestrator_output" }
          .mapNotNull { runCatching { JSONObject(it.optString("data")) }.getOrNull() }
          .firstOrNull { it.optString("requestID") == requestID }
          ?.let { return it }
      }
      Thread.sleep(100)
    }
    throw AssertionError("Orchestrator response $requestID did not arrive")
  }

  private fun waitForOrchestratorType(events: MutableList<JSONObject>, type: String): JSONObject {
    val deadline = System.currentTimeMillis() + 60_000
    while (System.currentTimeMillis() < deadline) {
      synchronized(events) {
        events.asSequence()
          .filter { it.optString("type") == "orchestrator_output" }
          .mapNotNull { runCatching { JSONObject(it.optString("data")) }.getOrNull() }
          .firstOrNull { it.optString("type") == type }
          ?.let { return it }
      }
      Thread.sleep(100)
    }
    throw AssertionError("Orchestrator event $type did not arrive")
  }

  private fun waitForOrchestratorOutput(events: MutableList<JSONObject>, text: String): JSONObject {
    val deadline = System.currentTimeMillis() + 60_000
    while (System.currentTimeMillis() < deadline) {
      synchronized(events) {
        events.asSequence()
          .filter { it.optString("type") == "orchestrator_output" }
          .mapNotNull { runCatching { JSONObject(it.optString("data")) }.getOrNull() }
          .firstOrNull { it.optString("type") == "turn.output" && it.optString("text").contains(text) }
          ?.let { return it }
      }
      Thread.sleep(100)
    }
    val seen = synchronized(events) { events.joinToString(" | ") }
    throw AssertionError("Orchestrator output $text did not arrive; events: $seen")
  }
}
