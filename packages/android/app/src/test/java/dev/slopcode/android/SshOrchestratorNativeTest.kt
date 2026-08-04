package dev.slopcode.android

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.InputStream

class SshOrchestratorNativeTest {
  @Test
  fun `preflight and install commands are fixed`() {
    val preflight = SshCommand.orchestratorVersion("/home/marcos/Project's code")
    val install = SshCommand.orchestratorInstall("/home/marcos/Project's code")

    assertTrue(preflight.contains("exec \"slopcode\" \"--version\""))
    assertFalse(preflight.contains("remote-orchestrator"))
    assertTrue(preflight.contains("'\"'\"'"))
    assertTrue(install.contains("npm install --prefix \"\u0024HOME/.local\" -g \"slopcode@latest\""))
    assertTrue(install.contains("apt-get install -y nodejs npm"))
    assertTrue(install.contains("sudo -n"))
    assertFalse(install.contains("sudo -S"))
  }

  @Test
  fun `requests accept only one bounded canonical workspace field`() {
    assertEquals(
      "/home/marcos/temp",
      SshOrchestratorRequest.parse("""{"directory":"/home/marcos/temp"}""")?.directory,
    )
    assertNull(SshOrchestratorRequest.parse("""{"directory":"/home/marcos/temp","command":"curl bad"}"""))
    assertNull(SshOrchestratorRequest.parse("""{"directory":"/home/marcos/temp","package":"attacker"}"""))
    assertNull(SshOrchestratorRequest.parse("""{"directory":7}"""))
    assertNull(SshOrchestratorRequest.parse("""{"directory":"/home/marcos/../agent"}"""))
    assertNull(SshOrchestratorRequest.parse("{" + " ".repeat(8 * 1024) + "}"))
  }

  @Test
  fun `operations require and preserve the selected workspace binding`() {
    val scope = SshWorkspaceScope()
    val commands = mutableListOf<String>()
    val native = SshOrchestratorNative(scope) { command, _ ->
      commands += command
      Triple("slopcode 0.2.208", "", 0)
    }
    val selected = """{"directory":"/home/marcos/temp"}"""

    assertEquals("workspace_selection_required", failure { native.preflight(selected) })
    assertTrue(commands.isEmpty())
    scope.bind("/home/marcos/temp")
    assertEquals("workspace_mismatch", failure { native.preflight("""{"directory":"/home/marcos/other"}""") })
    assertTrue(commands.isEmpty())

    val result = native.preflight(selected)
    assertTrue(result.getBoolean("ok"))
    assertEquals(1, commands.size)
    assertTrue(commands.single().startsWith("cd '/home/marcos/temp'"))
  }

  @Test
  fun `request command text can never reach the executor`() {
    val scope = SshWorkspaceScope().apply { bind("/home/marcos/temp") }
    var command: String? = null
    val native = SshOrchestratorNative(scope) { value, _ ->
      command = value
      Triple("", "", 0)
    }

    assertEquals(
      "invalid_configuration",
      failure { native.install("""{"directory":"/home/marcos/temp","command":"touch /tmp/pwned"}""") },
    )
    assertNull(command)
  }

  @Test
  fun `preflight returns bounded typed classifications`() {
    val ready = SshOrchestratorResult.preflight("slopcode version 0.2.208\n" + "x".repeat(32 * 1024), "", 0)
    assertEquals("slopcode", ready.getString("executable"))
    assertEquals("0.2.208", ready.getString("version"))
    assertTrue(ready.getBoolean("ok"))
    assertTrue(ready.isNull("error"))

    assertError(SshOrchestratorResult.preflight("", "not found", 127), "missing_executable")
    assertError(SshOrchestratorResult.preflight("", "permission denied", 126), "permission_denied")
    assertError(SshOrchestratorResult.preflight("", "bad config", 78), "unavailable")
    assertError(SshOrchestratorResult.preflight("unexpected", "", 0), "invalid_version")
  }

  @Test
  fun `install is a bounded explicit install or upgrade operation`() {
    val scope = SshWorkspaceScope().apply { bind("/home/marcos/temp") }
    var timeout = 0L
    val native = SshOrchestratorNative(scope) { command, value ->
      assertTrue(command.contains("\"slopcode@latest\""))
      timeout = value
      Triple("large output is not returned", "", 0)
    }
    val result = native.install("""{"directory":"/home/marcos/temp"}""")

    assertEquals(120_000L, timeout)
    assertTrue(result.getBoolean("ok"))
    assertEquals("slopcode@latest", result.getString("package"))
    assertEquals("install_or_upgrade", result.getString("operation"))
    assertFalse(result.has("output"))
    assertError(SshOrchestratorResult.install(126), "permission_denied")
    assertError(SshOrchestratorResult.install(127), "dependency_missing")
    assertError(SshOrchestratorResult.install(1), "install_failed")
  }

  @Test
  fun `bounded exec times out even while a remote process continuously writes`() {
    val input = object : InputStream() {
      override fun available() = 1
      override fun read() = 0
      override fun read(buffer: ByteArray, offset: Int, length: Int): Int {
        buffer[offset] = 0
        return 1
      }
    }
    val error = assertThrows(SshTransportException::class.java) {
      SshExecReader.read(input, { false }, System.currentTimeMillis() - 1)
    }
    assertEquals("exec_timeout", error.code)
  }

  private fun assertError(value: JSONObject, code: String) {
    assertFalse(value.getBoolean("ok"))
    assertEquals(code, value.getJSONObject("error").getString("code"))
    assertTrue(value.getJSONObject("error").getString("message").length <= 128)
  }

  private fun failure(block: () -> Unit) = try {
    block()
    ""
  } catch (cause: SshTransportException) {
    cause.code
  }
}
