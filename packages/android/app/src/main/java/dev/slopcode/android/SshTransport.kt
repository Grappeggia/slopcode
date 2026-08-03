package dev.slopcode.android

import android.content.Context
import android.util.Base64
import com.jcraft.jsch.Channel
import com.jcraft.jsch.ChannelExec
import com.jcraft.jsch.HostKey
import com.jcraft.jsch.HostKeyRepository
import com.jcraft.jsch.JSch
import com.jcraft.jsch.JSchException
import com.jcraft.jsch.Session
import com.jcraft.jsch.UserInfo
import com.jcraft.jsch.ChannelSftp
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.io.OutputStream
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.util.Collections
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

internal class SshTransport(
  context: Context,
  private val emit: (JSONObject) -> Unit,
) {
  private val app = context.applicationContext
  private val keys = SshHostKeyStore(app)
  val credentials = SshCredentialStore(app)
  private val executor = Executors.newCachedThreadPool()
  private val lock = Any()
  private val pending = ConcurrentHashMap<String, PendingHostKey>()
  private val workspace = SshWorkspaceScope()
  private var session: Session? = null
  private var channel: ChannelExec? = null
  private var output: OutputStream? = null
  private var channelID: String? = null
  private var orchestratorChannel: ChannelExec? = null
  private var orchestratorOutput: OutputStream? = null
  private var orchestratorID: String? = null
  private var profile: String? = null
  private var closed = false
  private var connectionEpoch = 0L
  private val folderCache = ConcurrentHashMap<String, CachedFolder>()

  fun isConnected(): Boolean = synchronized(lock) { session?.isConnected == true }

  fun connect(raw: String): JSONObject {
    val request = SshConnectionRequest.parse(JSONObject(raw))
      ?: throw SshTransportException("invalid_configuration", "SSH configuration is invalid.")
    synchronized(lock) {
      check(!closed) { "SSH transport is unavailable." }
    }
    val stored = credentials.get(request.profile)
    val auth = request.auth ?: stored?.optString("auth")?.takeIf(String::isNotEmpty)
    val password = request.password ?: stored?.optString("password")?.takeIf(String::isNotEmpty)
    val privateKey = request.privateKey ?: stored?.optString("privateKey")?.takeIf(String::isNotEmpty)
    val passphrase = request.passphrase ?: stored?.optString("passphrase")?.takeIf(String::isNotEmpty)
    if (auth == "password" && password.isNullOrEmpty()) {
      throw SshTransportException("credentials_required", "Enter the SSH password for this host.")
    }
    if (auth == "privateKey" && privateKey.isNullOrEmpty()) {
      throw SshTransportException("credentials_required", "Enter the SSH private key for this host.")
    }
    if (auth == null || (password.isNullOrEmpty() && privateKey.isNullOrEmpty())) {
      throw SshTransportException("credentials_required", "Enter an SSH password or private key.")
    }
    disconnect()
    val jsch = JSch()
    val repository = keys
    val next = try {
      if (privateKey != null && (auth == "privateKey" || password == null)) {
        jsch.addIdentity(
          "slopcode-android",
          privateKey.toByteArray(StandardCharsets.UTF_8),
          null,
          passphrase?.toByteArray(StandardCharsets.UTF_8),
        )
      }
      val session = jsch.getSession(request.username, request.host, request.port)
      session.setHostKeyRepository(repository)
      session.setConfig("StrictHostKeyChecking", "yes")
      session.setConfig("PreferredAuthentications", if (auth == "privateKey") "publickey" else "password,keyboard-interactive")
      session.setUserInfo(NoPromptUserInfo)
      if (password != null && auth != "privateKey") session.setPassword(password)
      session.setTimeout(CONNECT_TIMEOUT_MS)
      session.setServerAliveInterval(15_000)
      session.setServerAliveCountMax(3)
      session.connect(CONNECT_TIMEOUT_MS)
      session
    } catch (cause: Throwable) {
      val candidate = hostCandidate(request, jsch)
      val changed = repository.wasChanged(request.hostKeyName())
      if (changed) {
        throw SshTransportException(
          "host_key_mismatch",
          "SSH host key changed for ${request.host}:${request.port}. Refusing the connection.",
        )
      }
      if (candidate != null) {
        pending[request.profile] = candidate
        return JSONObject()
          .put("status", "host_key_required")
          .put("profile", request.profile)
          .put("host", request.host)
          .put("port", request.port)
          .put("type", candidate.key.type)
          .put("fingerprint", candidate.fingerprint)
      }
      throw classify(cause)
    }
    synchronized(lock) {
      this.session = next
      this.profile = request.profile
      connectionEpoch += 1
      folderCache.clear()
    }
    if (request.saveCredentials && (request.auth != null || request.password != null || request.privateKey != null)) {
      credentials.save(
        request.profile,
        JSONObject().apply {
          put("auth", auth)
          password?.let { put("password", it) }
          privateKey?.let { put("privateKey", it) }
          passphrase?.let { put("passphrase", it) }
        },
      )
    }
    return JSONObject()
      .put("status", "connected")
      .put("profile", request.profile)
      .put("host", request.host)
      .put("port", request.port)
      .put("remoteTransport", true)
  }

  fun trust(raw: String): JSONObject {
    val request = SshTrustRequest.parse(JSONObject(raw))
      ?: throw SshTransportException("invalid_host_key", "Host-key confirmation is invalid.")
    val candidate = pending[request.profile]
      ?: throw SshTransportException("host_key_expired", "The pending host key has expired; connect again.")
    if (candidate.fingerprint != request.fingerprint) {
      throw SshTransportException("host_key_mismatch", "The host key fingerprint no longer matches.")
    }
    keys.trust(candidate.key)
    pending.remove(request.profile)
    return JSONObject()
      .put("status", "trusted")
      .put("profile", request.profile)
      .put("fingerprint", candidate.fingerprint)
  }

  fun status(): JSONObject = synchronized(lock) {
    JSONObject()
      .put("connected", session?.isConnected == true)
      .put("remoteTransport", session?.isConnected == true)
      .apply { profile?.let { put("profile", it) } }
  }

  fun home(): JSONObject {
    val session = currentSession()
    val sftp = openSftp(session)
    return try {
      val path = SshPath.normalize(sftp.getHome())
        ?: throw SshTransportException("invalid_remote_home", "The SSH server returned an invalid home directory.")
      JSONObject().put("path", path)
    } catch (cause: Throwable) {
      throw classifySftp(cause)
    } finally {
      sftp.disconnect()
    }
  }

  fun list(rawPath: String, showHidden: Boolean = false): JSONObject {
    val path = SshPath.normalize(rawPath)
      ?: throw SshTransportException("invalid_path", "Remote folder path is invalid.")
    val session = currentSession()
    val epoch = synchronized(lock) { connectionEpoch }
    val key = cacheKey(path, showHidden, epoch)
    folderCache[key]?.let { cached ->
      if (cached.epoch == epoch) return JSONObject(cached.value)
      folderCache.remove(key, cached)
    }
    val result = readFolder(session, path, showHidden)
    folderCache[key] = CachedFolder(epoch, result.toString())
    prefetchFolders(session, path, result, showHidden, epoch)
    return result
  }

  fun selectWorkspace(rawPath: String): JSONObject {
    val path = SshPath.normalize(rawPath)
      ?: throw SshTransportException("invalid_workspace", "Remote workspace path is invalid.")
    if (path == "/") {
      throw SshTransportException("invalid_workspace", "Choose a specific remote workspace instead of the filesystem root.")
    }
    val current = currentSession()
    val epoch = synchronized(lock) {
      if (channel?.isConnected == true || orchestratorChannel?.isConnected == true) {
        throw SshTransportException("session_busy", "Stop the active SSH session before selecting another workspace.")
      }
      connectionEpoch
    }
    val sftp = openSftp(current)
    return try {
      val canonical = SshPath.normalize(sftp.realpath(path))
        ?: throw SshTransportException("invalid_workspace", "The SSH server returned an invalid canonical workspace path.")
      if (canonical == "/") {
        throw SshTransportException("invalid_workspace", "Choose a specific remote workspace instead of the filesystem root.")
      }
      if (!sftp.stat(canonical).isDir) {
        throw SshTransportException("workspace_not_directory", "The selected remote workspace is not a directory.")
      }
      synchronized(lock) {
        if (session !== current || !current.isConnected || connectionEpoch != epoch) {
          throw SshTransportException("stale_workspace", "The SSH connection changed while selecting the workspace.")
        }
        workspace.bind(canonical)
      }
      JSONObject().put("path", canonical)
    } catch (cause: Throwable) {
      throw classifySftp(cause)
    } finally {
      sftp.disconnect()
    }
  }

  fun version(raw: String): JSONObject {
    val request = SshVersionRequest.parse(JSONObject(raw))
      ?: throw SshTransportException("invalid_configuration", "CLI preflight configuration is invalid.")
    val directory = workspace.require(request.directory)
    val result = runExec(SshCommand.version(request.agent, directory))
    val combined = "${result.first}\n${result.second}".trim().take(MAX_OUTPUT_CHARS)
    return JSONObject()
      .put("agent", request.agent.id)
      .put("executable", request.agent.binary)
      .put("exitCode", result.third)
      .put("output", combined)
      .put("ok", result.third == 0)
      .apply {
        if (result.third != 0) {
          put("error", when {
            result.third == 127 -> "${request.agent.binary} is not installed or is not on PATH."
            result.third == 126 -> "${request.agent.binary} exists but is not executable."
            else -> "${request.agent.binary} preflight failed with exit code ${result.third}."
          })
        }
      }
  }

  fun authStatus(raw: String): JSONObject {
    val request = SshVersionRequest.parse(JSONObject(raw))
      ?: throw SshTransportException("invalid_configuration", "CLI authentication check is invalid.")
    val directory = workspace.require(request.directory)
    val result = runExec(SshCommand.authStatus(request.agent, directory))
    val combined = "${result.first}\n${result.second}".trim().take(MAX_OUTPUT_CHARS)
    return JSONObject()
      .put("agent", request.agent.id)
      .put("executable", request.agent.binary)
      .put("exitCode", result.third)
      .put("output", combined)
      .put("ok", result.third == 0)
      .put("loggedIn", request.agent.loggedIn(combined, result.third))
      .apply {
        if (result.third != 0) {
          put("error", when {
            result.third == 127 -> "${request.agent.binary} is not installed or is not on PATH."
            result.third == 126 -> "${request.agent.binary} exists but is not executable."
            else -> "${request.agent.binary} authentication check exited with code ${result.third}."
          })
        }
      }
  }

  fun start(raw: String): JSONObject {
    val request = SshStartRequest.parse(JSONObject(raw))
      ?: throw SshTransportException("invalid_configuration", "SSH agent session configuration is invalid.")
    val directory = workspace.require(request.directory)
    val id = "ssh_${UUID.randomUUID().toString().replace("-", "")}"
    val next = currentSession()
    synchronized(lock) {
      if (channel?.isConnected == true) throw SshTransportException("session_busy", "An SSH agent session is already running.")
      if (orchestratorChannel?.isConnected == true) throw SshTransportException("session_busy", "The remote orchestrator is already running.")
    }
    val channel = next.openChannel("exec") as ChannelExec
    val pty = request.setup != SshSetupAction.INSTALL
    channel.setPty(pty)
    if (pty) channel.setPtyType("xterm-256color", request.cols, request.rows, request.width, request.height)
    channel.setCommand(
      when (request.setup) {
        SshSetupAction.INSTALL -> SshCommand.install(request.agent, directory)
        SshSetupAction.LOGIN -> SshCommand.login(request.agent, directory)
        null -> if (request.operation == "prompt") SshCommand.prompt(request.agent, directory)
        else SshCommand.interactive(request.agent, directory)
      },
    )
    if (request.operation == "prompt") {
      val prompt = request.prompt ?: throw SshTransportException("invalid_prompt", "Prompt is required.")
      channel.setInputStream(ByteArrayInputStream("$prompt\n".toByteArray(StandardCharsets.UTF_8)))
    }
    try {
      channel.connect(CONNECT_TIMEOUT_MS)
      val input = channel.inputStream
      synchronized(lock) {
        this.channel = channel
        this.output = if (request.operation == "interactive" || request.setup == SshSetupAction.LOGIN) channel.outputStream else null
        this.channelID = id
      }
      emit(JSONObject().put("type", "started").put("id", id).put("operation", request.operation).put("agent", request.agent.id))
      executor.execute { readChannel(id, channel, input) }
      if (request.setup == SshSetupAction.INSTALL) {
        executor.execute {
          try {
            Thread.sleep(INSTALL_TIMEOUT_MS)
            val timedOut = synchronized(lock) { this@SshTransport.channel === channel && !channel.isClosed }
            if (timedOut) {
              emit(JSONObject().put("type", "error").put("id", id).put("message", "Remote installation timed out."))
              runCatching { channel.disconnect() }
            }
          } catch (_: InterruptedException) {
            Thread.currentThread().interrupt()
          }
        }
      }
      return JSONObject().put("id", id).put("status", "started").put("operation", request.operation)
    } catch (cause: Throwable) {
      channel.disconnect()
      throw classify(cause)
    }
  }

  fun orchestratorStart(raw: String): JSONObject {
    val request = SshOrchestratorRequest.parse(JSONObject(raw))
      ?: throw SshTransportException("invalid_configuration", "Remote orchestrator configuration is invalid.")
    val directory = workspace.require(request.directory)
    val next = currentSession()
    val id = "ssh_${UUID.randomUUID().toString().replace("-", "")}"
    synchronized(lock) {
      if (channel?.isConnected == true || orchestratorChannel?.isConnected == true) {
        throw SshTransportException("session_busy", "An SSH agent session is already running.")
      }
    }
    val channel = next.openChannel("exec") as ChannelExec
    channel.setPty(false)
    channel.setCommand(SshCommand.orchestrator(directory))
    channel.setEnv("SLOPCODE_REMOTE_ORCHESTRATOR_ROOT", directory)
    try {
      channel.connect(CONNECT_TIMEOUT_MS)
      synchronized(lock) {
        orchestratorChannel = channel
        orchestratorOutput = channel.outputStream
        orchestratorID = id
      }
      emit(JSONObject().put("type", "orchestrator_started").put("id", id))
      executor.execute { readOrchestrator(id, channel, channel.inputStream) }
      return JSONObject().put("id", id).put("status", "started")
    } catch (cause: Throwable) {
      runCatching { channel.disconnect() }
      throw classify(cause)
    }
  }

  fun orchestratorInput(value: String) {
    val bytes = value.toByteArray(StandardCharsets.UTF_8)
    if (bytes.isEmpty() || bytes.size > MAX_ORCHESTRATOR_FRAME_BYTES || bytes.any { it == 0.toByte() }) {
      throw SshTransportException("invalid_orchestrator_frame", "Remote orchestrator input is invalid or too large.")
    }
    val stream = synchronized(lock) {
      orchestratorOutput
        ?: throw SshTransportException("orchestrator_not_running", "The remote orchestrator is not running.")
    }
    try {
      stream.write(bytes)
      if (bytes.last() != '\n'.code.toByte()) stream.write('\n'.code)
      stream.flush()
    } catch (cause: Throwable) {
      throw classify(cause)
    }
  }

  fun orchestratorStop() {
    val next = synchronized(lock) {
      val value = orchestratorChannel
      orchestratorChannel = null
      orchestratorOutput = null
      orchestratorID = null
      value
    }
    runCatching { next?.disconnect() }
  }

  fun cleanup() {
    val next = synchronized(lock) {
      val value = channel
      channel = null
      output = null
      channelID = null
      value
    }
    runCatching { next?.disconnect() }
  }

  fun input(value: String) {
    if (value.toByteArray(StandardCharsets.UTF_8).size > MAX_INPUT_BYTES || value.contains('\u0000')) {
      throw SshTransportException("invalid_input", "SSH input is too large or contains an invalid character.")
    }
    val stream = synchronized(lock) {
      output ?: throw SshTransportException("session_not_interactive", "No interactive SSH session is running.")
    }
    try {
      stream.write(value.toByteArray(StandardCharsets.UTF_8))
      stream.flush()
    } catch (cause: Throwable) {
      throw classify(cause)
    }
  }

  fun resize(cols: Int, rows: Int, width: Int, height: Int) {
    if (cols !in 20..500 || rows !in 4..200 || width !in 0..8_000 || height !in 0..8_000) {
      throw SshTransportException("invalid_terminal_size", "Terminal dimensions are invalid.")
    }
    val next = synchronized(lock) { channel }
      ?: throw SshTransportException("session_not_running", "No SSH PTY session is running.")
    try {
      next.setPtySize(cols, rows, width, height)
    } catch (cause: Throwable) {
      throw classify(cause)
    }
  }

  fun interrupt() {
    val next = synchronized(lock) { channel }
      ?: throw SshTransportException("session_not_running", "No SSH session is running.")
    runCatching { next.sendSignal("INT") }
    val stream = synchronized(lock) { output }
    if (stream == null) {
      runCatching { next.disconnect() }
      return
    }
    try {
      stream.write(byteArrayOf(3))
      stream.flush()
    } catch (cause: Throwable) {
      throw classify(cause)
    }
  }

  fun disconnect() {
    val next: ChannelExec?
    val remote: ChannelExec?
    val current: Session?
    synchronized(lock) {
      next = channel
      remote = orchestratorChannel
      current = session
      channel = null
      output = null
      channelID = null
      orchestratorChannel = null
      orchestratorOutput = null
      orchestratorID = null
      session = null
      profile = null
      workspace.reset()
      connectionEpoch += 1
      folderCache.clear()
    }
    runCatching { next?.disconnect() }
    runCatching { remote?.disconnect() }
    runCatching { current?.disconnect() }
  }

  fun close() {
    disconnect()
    synchronized(lock) { closed = true }
    executor.shutdownNow()
    runCatching { executor.awaitTermination(2, TimeUnit.SECONDS) }
  }

  private fun readChannel(id: String, channel: ChannelExec, input: InputStream) {
    val buffer = ByteArray(8 * 1024)
    var failure: Throwable? = null
    try {
      while (true) {
        val count = input.read(buffer)
        if (count < 0) break
        if (count == 0) continue
        emit(
          JSONObject()
            .put("type", "output")
            .put("id", id)
            .put("stream", "stdout")
            .put("data", String(buffer, 0, count, StandardCharsets.UTF_8).take(MAX_EVENT_OUTPUT_CHARS)),
        )
      }
      while (!channel.isClosed) Thread.sleep(20)
    } catch (cause: Throwable) {
      failure = cause
    } finally {
      val exitCode = channel.exitStatus
      synchronized(lock) {
        if (this.channel === channel) {
          this.channel = null
          this.output = null
          this.channelID = null
        }
      }
      if (failure != null && !channel.isClosed) {
        emit(JSONObject().put("type", "error").put("id", id).put("message", classify(failure!!).message))
      }
      emit(JSONObject().put("type", "completed").put("id", id).put("exitCode", exitCode))
      runCatching { channel.disconnect() }
    }
  }

  private fun readOrchestrator(id: String, channel: ChannelExec, input: InputStream) {
    var failure: Throwable? = null
    try {
      while (true) {
        val line = readLineBounded(input) ?: break
        emit(JSONObject().put("type", "orchestrator_output").put("id", id).put("data", line))
      }
      while (!channel.isClosed) Thread.sleep(20)
    } catch (cause: Throwable) {
      failure = cause
    } finally {
      val exitCode = channel.exitStatus
      synchronized(lock) {
        if (orchestratorChannel === channel) {
          orchestratorChannel = null
          orchestratorOutput = null
          orchestratorID = null
        }
      }
      if (failure != null && !channel.isClosed) {
        emit(JSONObject().put("type", "orchestrator_error").put("id", id).put("message", classify(failure!!).message))
      }
      emit(JSONObject().put("type", "orchestrator_completed").put("id", id).put("exitCode", exitCode))
      runCatching { channel.disconnect() }
    }
  }

  private fun readFolder(session: Session, path: String, showHidden: Boolean): JSONObject {
    val sftp = openSftp(session)
    return try {
      val entries = JSONArray()
      sftp.ls(path).asSequence()
        .filter { it.filename != "." && it.filename != ".." && (showHidden || !it.filename.startsWith(".")) }
        .mapNotNull { item ->
          val name = item.filename
          val child = SshPath.child(path, name) ?: return@mapNotNull null
          val attrs = item.attrs
          if (attrs.isLink()) return@mapNotNull null
          JSONObject()
            .put("name", name)
            .put("path", child)
            .put("type", if (attrs.isDir()) "directory" else "file")
            .put("size", attrs.getSize())
            .put("modified", attrs.getMTime().toLong() * 1_000)
        }
        .sortedWith(compareBy<JSONObject> { it.optString("type") != "directory" }.thenBy { it.optString("name") })
        .take(MAX_SFTP_ENTRIES)
        .forEach(entries::put)
      JSONObject()
        .put("path", path)
        .apply { SshPath.parent(path)?.let { put("parent", it) } }
        .put("entries", entries)
    } catch (cause: Throwable) {
      throw classifySftp(cause)
    } finally {
      sftp.disconnect()
    }
  }

  private fun prefetchFolders(session: Session, parent: String, listing: JSONObject, showHidden: Boolean, epoch: Long) {
    SshPrefetch.directories(parent, listing.optJSONArray("entries") ?: JSONArray(), MAX_PREFETCH_FOLDERS).forEach { path ->
      executor.execute {
        if (!isCurrent(session, epoch)) return@execute
        val key = cacheKey(path, showHidden, epoch)
        if (folderCache.containsKey(key)) return@execute
        runCatching { readFolder(session, path, showHidden) }
          .onSuccess { value ->
            if (isCurrent(session, epoch)) folderCache.putIfAbsent(key, CachedFolder(epoch, value.toString()))
          }
      }
    }
  }

  private fun isCurrent(session: Session, epoch: Long) = synchronized(lock) {
    !closed && this.session === session && session.isConnected && connectionEpoch == epoch
  }

  private fun cacheKey(path: String, showHidden: Boolean, epoch: Long) = "$epoch:${if (showHidden) 1 else 0}:$path"

  private data class CachedFolder(val epoch: Long, val value: String)

  private fun readLineBounded(input: InputStream): String? {
    val output = ByteArrayOutputStream()
    while (true) {
      val next = input.read()
      if (next < 0) return if (output.size() == 0) null else output.toString(StandardCharsets.UTF_8.name())
      if (next == '\n'.code) return output.toString(StandardCharsets.UTF_8.name()).removeSuffix("\r")
      if (output.size() >= MAX_ORCHESTRATOR_FRAME_BYTES) {
        throw SshTransportException("orchestrator_frame_too_large", "Remote orchestrator output exceeded the frame limit.")
      }
      output.write(next)
    }
  }

  private fun runExec(command: String): Triple<String, String, Int> {
    val next = currentSession()
    val channel = next.openChannel("exec") as ChannelExec
    val stderr = ByteArrayOutputStream()
    channel.setCommand(command)
    channel.setErrStream(stderr)
    return try {
      channel.connect(CONNECT_TIMEOUT_MS)
      val stdout = readBounded(channel.inputStream)
      val deadline = System.currentTimeMillis() + EXEC_TIMEOUT_MS
      while (!channel.isClosed && System.currentTimeMillis() < deadline) Thread.sleep(20)
      if (!channel.isClosed) {
        channel.disconnect()
        throw SshTransportException("exec_timeout", "Remote CLI preflight timed out.")
      }
      Triple(stdout, stderr.toString(StandardCharsets.UTF_8.name()), channel.exitStatus)
    } catch (cause: Throwable) {
      throw if (cause is SshTransportException) cause else classify(cause)
    } finally {
      runCatching { channel.disconnect() }
    }
  }

  private fun readBounded(input: InputStream): String {
    val output = ByteArrayOutputStream()
    val buffer = ByteArray(4 * 1024)
    var remaining = MAX_OUTPUT_BYTES
    while (remaining > 0) {
      val count = input.read(buffer, 0, minOf(buffer.size, remaining))
      if (count < 0) break
      if (count == 0) continue
      output.write(buffer, 0, count)
      remaining -= count
    }
    return output.toString(StandardCharsets.UTF_8.name()).take(MAX_OUTPUT_CHARS)
  }

  private fun currentSession() = synchronized(lock) {
    session?.takeIf { it.isConnected }
      ?: throw SshTransportException("not_connected", "Connect to the SSH host first.")
  }

  private fun openSftp(session: Session): ChannelSftp {
    val sftp = try {
      session.openChannel("sftp") as ChannelSftp
    } catch (cause: Throwable) {
      throw classifySftp(cause)
    }
    try {
      sftp.connect(CONNECT_TIMEOUT_MS)
      return sftp
    } catch (cause: Throwable) {
      sftp.disconnect()
      throw classifySftp(cause)
    }
  }

  private fun hostCandidate(request: SshConnectionRequest, jsch: JSch): PendingHostKey? {
    val host = request.hostKeyName()
    val key = keys.pending(host) ?: return null
    val fingerprint = key.getFingerPrint(jsch)
    if (!keys.pendingIsUntrusted(host)) return null
    return PendingHostKey(request.profile, key, fingerprint)
  }

  private fun classify(cause: Throwable): SshTransportException {
    if (cause is SshTransportException) return cause
    val message = cause.message.orEmpty().lowercase()
    if (cause is JSchException && (message.contains("auth fail") || message.contains("auth cancel"))) {
      return SshTransportException("authentication_failed", "SSH authentication failed. Check the password or private key.", cause)
    }
    if (message.contains("unknownhost") || message.contains("unknown host key")) {
      return SshTransportException("host_key_required", "The SSH host key must be confirmed before connecting.", cause)
    }
    if (message.contains("auth") || message.contains("permission denied")) {
      return SshTransportException("authentication_failed", "SSH authentication failed. Check the password or private key.", cause)
    }
    if (message.contains("timeout") || message.contains("connection refused") || message.contains("connect")) {
      return SshTransportException("network_error", "Could not reach the SSH host. Check the host, port, and network.", cause)
    }
    return SshTransportException("ssh_failed", cause.message?.take(512) ?: "SSH operation failed.", cause)
  }

  private fun classifySftp(cause: Throwable): SshTransportException {
    val message = cause.message.orEmpty().lowercase()
    if (message.contains("permission")) return SshTransportException("remote_permission_denied", "The SSH user cannot read that remote folder.", cause)
    if (message.contains("no such") || message.contains("not found")) return SshTransportException("remote_path_not_found", "That remote folder does not exist.", cause)
    return classify(cause)
  }

  private data class PendingHostKey(
    val profile: String,
    val key: HostKey,
    val fingerprint: String,
  )

  companion object {
    private const val CONNECT_TIMEOUT_MS = 15_000
    private const val EXEC_TIMEOUT_MS = 15_000L
    private const val MAX_SFTP_ENTRIES = 256
    private const val MAX_OUTPUT_BYTES = 128 * 1024
    private const val MAX_OUTPUT_CHARS = 16 * 1024
    private const val MAX_EVENT_OUTPUT_CHARS = 8 * 1024
    private const val MAX_INPUT_BYTES = 128 * 1024
    private const val MAX_ORCHESTRATOR_FRAME_BYTES = 256 * 1024
    private const val INSTALL_TIMEOUT_MS = 120_000L
    private const val MAX_PREFETCH_FOLDERS = 8
  }
}

internal class SshTransportException(
  val code: String,
  override val message: String,
  cause: Throwable? = null,
) : Exception(message, cause)

private object NoPromptUserInfo : UserInfo {
  override fun getPassphrase(): String? = null
  override fun getPassword(): String? = null
  override fun promptPassword(message: String?): Boolean = false
  override fun promptPassphrase(message: String?): Boolean = false
  override fun promptYesNo(message: String?): Boolean = false
  override fun showMessage(message: String?) = Unit
}

internal class SshCredentialStore(context: Context) {
  private val key = MasterKey.Builder(context.applicationContext).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
  private val prefs = EncryptedSharedPreferences.create(
    context.applicationContext,
    "slopcode.ssh.credentials",
    key,
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
  )

  fun get(profile: String): JSONObject? = synchronized(this) {
    prefs.getString(key(profile), null)?.let { runCatching { JSONObject(it) }.getOrNull() }
  }

  fun save(profile: String, value: JSONObject) = synchronized(this) {
    check(prefs.edit().putString(key(profile), value.toString()).commit()) { "SSH credentials could not be saved." }
  }

  fun clear(profile: String) = synchronized(this) {
    check(prefs.edit().remove(key(profile)).commit()) { "SSH credentials could not be removed." }
  }

  private fun key(profile: String) = "credential." + Base64.encodeToString(profile.toByteArray(StandardCharsets.UTF_8), Base64.NO_WRAP or Base64.URL_SAFE)
}

internal class SshHostKeyStore(context: Context) : HostKeyRepository {
  private val key = MasterKey.Builder(context.applicationContext).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build()
  private val prefs = EncryptedSharedPreferences.create(
    context.applicationContext,
    "slopcode.ssh.hostkeys",
    key,
    EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
    EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
  )
  private val pending = ConcurrentHashMap<String, ByteArray>()
  private val changed = ConcurrentHashMap.newKeySet<String>()

  override fun check(host: String, key: ByteArray): Int {
    pending[host] = key.copyOf()
    val type = runCatching { HostKey(host, key).type }.getOrNull() ?: return HostKeyRepository.CHANGED
    val record = record(host) ?: return HostKeyRepository.NOT_INCLUDED
    val encoded = record.optString(type).takeIf(String::isNotEmpty) ?: return HostKeyRepository.NOT_INCLUDED
    val raw = runCatching { Base64.decode(encoded, Base64.DEFAULT) }.getOrNull()
      ?: return HostKeyRepository.CHANGED
    if (MessageDigest.isEqual(raw, key)) {
      pending.remove(host)
      return HostKeyRepository.OK
    }
    changed += host
    return HostKeyRepository.CHANGED
  }

  override fun add(hostkey: HostKey, ui: com.jcraft.jsch.UserInfo?) = Unit

  override fun remove(host: String, type: String?) {
    if (type == null) {
      prefs.edit().remove(pref(host)).commit()
      removeIndex(host)
      return
    }
    val next = record(host) ?: return
    next.remove(type)
    if (next.length() == 0) {
      prefs.edit().remove(pref(host)).commit()
      removeIndex(host)
    } else {
      prefs.edit().putString(pref(host), next.toString()).commit()
    }
  }

  override fun remove(host: String, type: String?, key: ByteArray?) {
    if (type == null) {
      remove(host, null)
      return
    }
    val record = record(host) ?: return
    val raw = runCatching { Base64.decode(record.optString(type), Base64.DEFAULT) }.getOrNull() ?: return
    if (key == null || MessageDigest.isEqual(raw, key)) remove(host, type)
  }

  override fun getKnownHostsRepositoryID(): String = "slopcode-keystore"

  override fun getHostKey(): Array<HostKey> = hosts()
    .flatMap { host -> hostKeys(host, record(host)) }
    .toTypedArray()

  override fun getHostKey(host: String?, type: String?): Array<HostKey> =
    if (host == null) getHostKey()
    else hostKeys(host, record(host)).filter { type == null || it.type == type }.toTypedArray()

  fun trust(hostkey: HostKey) = synchronized(this) {
    val next = record(hostkey.host) ?: JSONObject()
    next.put(hostkey.type, hostkey.key)
    val hosts = hosts().toMutableSet()
    hosts += hostkey.host
    check(
      prefs.edit()
        .putString(pref(hostkey.host), next.toString())
        .putString(HOSTS, JSONArray(hosts.toList().sorted()).toString())
        .commit(),
    ) { "SSH host key could not be saved." }
  }

  fun pending(host: String): HostKey? = pending[host]?.let { runCatching { HostKey(host, it) }.getOrNull() }

  fun pendingIsUntrusted(host: String): Boolean {
    val raw = pending[host] ?: return false
    val type = runCatching { HostKey(host, raw).type }.getOrNull() ?: return true
    val encoded = record(host)?.optString(type)?.takeIf { it.isNotEmpty() } ?: return true
    val stored = runCatching { Base64.decode(encoded, Base64.DEFAULT) }.getOrNull() ?: return true
    return !MessageDigest.isEqual(stored, raw)
  }

  fun wasChanged(host: String) = changed.remove(host) || changed.remove(canonical(host))

  private fun pref(host: String) = PREFIX + Base64.encodeToString(host.toByteArray(StandardCharsets.UTF_8), Base64.NO_WRAP or Base64.URL_SAFE)

  private fun record(host: String): JSONObject? {
    val raw = names(host).asSequence().mapNotNull { prefs.getString(pref(it), null) }.firstOrNull() ?: return null
    val parsed = runCatching { JSONObject(raw) }.getOrNull()
    if (parsed != null) return parsed
    val legacy = raw.split('|', limit = 2)
    if (legacy.size != 2) return null
    return JSONObject().put(legacy[0], legacy[1])
  }

  private fun hosts() = runCatching { JSONArray(prefs.getString(HOSTS, "[]")) }
    .getOrDefault(JSONArray())
    .let { array -> (0 until array.length()).mapNotNull { array.optString(it).takeIf(String::isNotEmpty) } }

  private fun hostKeys(host: String, record: JSONObject?) = record?.keys()?.asSequence()?.mapNotNull { type ->
    val encoded = record.optString(type).takeIf(String::isNotEmpty) ?: return@mapNotNull null
    val raw = runCatching { Base64.decode(encoded, Base64.DEFAULT) }.getOrNull() ?: return@mapNotNull null
    runCatching { HostKey(host, raw) }.getOrNull()
  }?.toList().orEmpty()

  private fun removeIndex(host: String) {
    val next = hosts().filterNot { it == host || it == canonical(host) }
    prefs.edit().putString(HOSTS, JSONArray(next).toString()).commit()
  }

  private fun names(host: String): List<String> = listOf(host, canonical(host)).distinct()

  private fun canonical(host: String): String =
    if (host.startsWith("[") && host.indexOf("]:") > 0) host.substring(1, host.indexOf("]:")) else host

  companion object {
    private const val PREFIX = "host."
    private const val HOSTS = "hosts"
  }
}

private fun SshConnectionRequest.hostKeyName() = if (port == 22) host else "[$host]:$port"
