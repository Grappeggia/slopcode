#include <slopcode/remoteqt/ssh_supervisor.h>

#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QRegularExpression>

namespace slopcode::remoteqt {
namespace {

const QRegularExpression kHostPattern(QStringLiteral(R"(^[A-Za-z0-9][A-Za-z0-9._:-]*$)"));
const QRegularExpression kUserPattern(QStringLiteral(R"(^[A-Za-z0-9._-]+$)"));
const QRegularExpression kKeyTypePattern(QStringLiteral(R"(^(ssh-|ecdsa-|sk-)[A-Za-z0-9@._+-]+$)"));
const QRegularExpression kKeyDataPattern(QStringLiteral(R"(^[A-Za-z0-9+/=]+$)"));

bool fail(QString *error, const QString &message)
{
  if (error != nullptr) {
    *error = message;
  }
  return false;
}

bool hasControl(const QString &value)
{
  for (const QChar character : value) {
    const ushort code = character.unicode();
    if (code <= 0x1f || (code >= 0x7f && code <= 0x9f)) {
      return true;
    }
  }
  return false;
}

bool absolutePath(const QString &path, const QString &label, QString *error)
{
  if (path.isEmpty() || hasControl(path) || !QDir::isAbsolutePath(path)) {
    return fail(error, label + QStringLiteral(" must be an absolute path"));
  }
  return true;
}

QString normalizedHost(const QString &value)
{
  if (value.startsWith('[') && value.endsWith(']')) {
    return value.mid(1, value.size() - 2);
  }
  return value;
}

QString sshHost(const QString &host)
{
  return host.contains(':') ? QStringLiteral("[") + host + QStringLiteral("]") : host;
}

QString authority(const SshTarget &target)
{
  return target.user + QStringLiteral("@") + sshHost(normalizedHost(target.host));
}

QString globalKnownHostsFile()
{
#ifdef Q_OS_WIN
  return QStringLiteral("NUL");
#else
  return QStringLiteral("/dev/null");
#endif
}

bool validatePinnedKey(const QString &value, QString *error)
{
  if (hasControl(value)) {
    return fail(error, QStringLiteral("pinned host key contains control characters"));
  }
  const QStringList fields = value.trimmed().split(QRegularExpression(QStringLiteral(R"(\s+)")), Qt::SkipEmptyParts);
  if (fields.size() != 2 || !kKeyTypePattern.match(fields.at(0)).hasMatch() ||
      !kKeyDataPattern.match(fields.at(1)).hasMatch()) {
    return fail(error, QStringLiteral("pinned host key must be a public key type and base64 value"));
  }
  return true;
}

bool validateTarget(const SshTarget &target, QString *error)
{
  const QString host = normalizedHost(target.host);
  if (host.isEmpty() || host.startsWith('-') || !kHostPattern.match(host).hasMatch()) {
    return fail(error, QStringLiteral("invalid SSH host"));
  }
  if (target.user.isEmpty() || target.user.startsWith('-') || !kUserPattern.match(target.user).hasMatch()) {
    return fail(error, QStringLiteral("invalid SSH user"));
  }
  if (target.port == 0 || target.remotePort == 0) {
    return fail(error, QStringLiteral("SSH and remote server ports are required"));
  }
  if (target.localPort != 0) {
    return fail(error, QStringLiteral("localPort must be zero; ssh must allocate it atomically"));
  }
  if (!validateRemoteFolder(target.remoteFolder, error)) {
    return false;
  }

  const bool hasKnownHosts = !target.knownHostsPath.isEmpty();
  const bool hasPinnedKey = !target.pinnedHostKey.isEmpty();
  if (hasKnownHosts == hasPinnedKey) {
    return fail(error, QStringLiteral("configure exactly one known_hosts path or pinned host key"));
  }
  if (hasKnownHosts && !absolutePath(target.knownHostsPath, QStringLiteral("known_hosts path"), error)) {
    return false;
  }
  if (hasPinnedKey && !validatePinnedKey(target.pinnedHostKey, error)) {
    return false;
  }
  if (!target.identityPath.isEmpty() && !absolutePath(target.identityPath, QStringLiteral("identity path"), error)) {
    return false;
  }
  if (target.serverExecutable.isEmpty() || hasControl(target.serverExecutable) || target.serverExecutable.startsWith('-')) {
    return fail(error, QStringLiteral("invalid remote server executable"));
  }
  for (const QString &argument : target.serverArguments) {
    if (hasControl(argument)) {
      return fail(error, QStringLiteral("remote server arguments contain control characters"));
    }
  }
  return true;
}

QString shellQuote(QString value)
{
  return QStringLiteral("'") + value.replace(QStringLiteral("'"), QStringLiteral("'\"'\"'")) + QStringLiteral("'");
}

QString hostPattern(const SshTarget &target)
{
  const QString host = normalizedHost(target.host);
  if (host.contains(':')) {
    return QStringLiteral("[") + host + QStringLiteral("]") +
           (target.port == 22 ? QString() : QStringLiteral(":") + QString::number(target.port));
  }
  if (target.port != 22) {
    return QStringLiteral("[") + host + QStringLiteral("]:") + QString::number(target.port);
  }
  return host;
}

QStringList baseArguments(const SshTarget &target, const QString &knownHostsPath, QString *error)
{
  if (!validateTarget(target, error)) {
    return {};
  }
  if (!absolutePath(knownHostsPath, QStringLiteral("materialized known_hosts path"), error)) {
    return {};
  }

  QStringList arguments{
    QStringLiteral("-o"), QStringLiteral("BatchMode=yes"),
    QStringLiteral("-o"), QStringLiteral("PasswordAuthentication=no"),
    QStringLiteral("-o"), QStringLiteral("KbdInteractiveAuthentication=no"),
    QStringLiteral("-o"), QStringLiteral("PreferredAuthentications=publickey"),
    QStringLiteral("-o"), QStringLiteral("StrictHostKeyChecking=yes"),
    QStringLiteral("-o"), QStringLiteral("GlobalKnownHostsFile=") + globalKnownHostsFile(),
    QStringLiteral("-o"), QStringLiteral("UserKnownHostsFile=") + knownHostsPath,
    QStringLiteral("-o"), QStringLiteral("ExitOnForwardFailure=yes"),
    QStringLiteral("-o"), QStringLiteral("ServerAliveInterval=15"),
    QStringLiteral("-o"), QStringLiteral("ServerAliveCountMax=3"),
  };
  if (!target.identityPath.isEmpty()) {
    arguments << QStringLiteral("-i") << target.identityPath << QStringLiteral("-o") << QStringLiteral("IdentitiesOnly=yes");
  }
  arguments << QStringLiteral("-p") << QString::number(target.port);
  return arguments;
}

} // namespace

bool validateRemoteFolder(const QString &folder, QString *error)
{
  if (folder.isEmpty() || folder.toUtf8().size() > 4 * 1024 || hasControl(folder) || !folder.startsWith('/') ||
      folder.contains('\\') || folder.contains(QStringLiteral("//"))) {
    return fail(error, QStringLiteral("remote folder must be an absolute POSIX path"));
  }

  if (folder == QStringLiteral("/")) {
    return true;
  }
  const QStringList segments = folder.mid(1).split('/', Qt::KeepEmptyParts);
  for (const QString &segment : segments) {
    if (segment.isEmpty() || segment == QStringLiteral(".") || segment == QStringLiteral("..")) {
      return fail(error, QStringLiteral("remote folder may not contain dot traversal segments"));
    }
  }
  return true;
}

QStringList buildSshExecArguments(const SshTarget &target, const QString &knownHostsPath, QString *error)
{
  QStringList arguments = baseArguments(target, knownHostsPath, error);
  if (arguments.isEmpty()) {
    return {};
  }
  arguments << QStringLiteral("-T") << authority(target) << QStringLiteral("sh") << QStringLiteral("-se");
  return arguments;
}

QStringList buildSshTunnelArguments(const SshTarget &target,
                                    const QString &knownHostsPath,
                                    quint16 localPort,
                                    QString *error)
{
  if (localPort != 0) {
    fail(error, QStringLiteral("the SSH tunnel must request an OS-assigned loopback port"));
    return {};
  }
  QStringList arguments = baseArguments(target, knownHostsPath, error);
  if (arguments.isEmpty()) {
    return {};
  }
  arguments << QStringLiteral("-v") << QStringLiteral("-N") << QStringLiteral("-T") << QStringLiteral("-L")
            << QStringLiteral("127.0.0.1:0:127.0.0.1:") +
                 QString::number(target.remotePort)
            << authority(target);
  return arguments;
}

QString buildRemoteStartScript(const SshTarget &target, QString *error)
{
  if (!validateTarget(target, error)) {
    return {};
  }

  QStringList command{target.serverExecutable};
  if (target.serverArguments.isEmpty()) {
    command << QStringLiteral("serve") << QStringLiteral("--hostname") << QStringLiteral("127.0.0.1")
            << QStringLiteral("--port") << QString::number(target.remotePort);
  } else {
    command += target.serverArguments;
  }

  QStringList quoted;
  quoted.reserve(command.size());
  for (const QString &part : command) {
    quoted << shellQuote(part);
  }
  return QStringLiteral("set -eu\ncd ") + shellQuote(QDir::cleanPath(target.remoteFolder)) + QStringLiteral("\nexec ") +
         quoted.join(' ') + QStringLiteral("\n");
}

SshTargetSupervisor::SshTargetSupervisor(QObject *parent)
  : QObject(parent)
  , remoteProcess_(this)
  , tunnelProcess_(this)
  , pinnedKnownHosts_()
{
  remoteProcess_.setProcessChannelMode(QProcess::SeparateChannels);
  tunnelProcess_.setProcessChannelMode(QProcess::SeparateChannels);
  connect(&remoteProcess_, &QProcess::started, this, &SshTargetSupervisor::handleRemoteStarted);
  connect(&tunnelProcess_, &QProcess::started, this, &SshTargetSupervisor::handleTunnelStarted);
  connect(&tunnelProcess_, &QProcess::readyReadStandardError, this, &SshTargetSupervisor::handleTunnelOutput);
  connect(&remoteProcess_, &QProcess::errorOccurred, this, &SshTargetSupervisor::handleProcessError);
  connect(&tunnelProcess_, &QProcess::errorOccurred, this, &SshTargetSupervisor::handleProcessError);
  connect(&remoteProcess_, &QProcess::finished, this, &SshTargetSupervisor::handleRemoteFinished);
  connect(&tunnelProcess_, &QProcess::finished, this, &SshTargetSupervisor::handleTunnelFinished);
}

SshTargetSupervisor::~SshTargetSupervisor()
{
  stop();
}

bool SshTargetSupervisor::start(const SshTarget &target, QString *error)
{
  if (state_ != SshState::Stopped) {
    return fail(error, QStringLiteral("SSH target supervisor is already running"));
  }
  if (!validateTarget(target, error)) {
    return false;
  }

  if (target.knownHostsPath.isEmpty()) {
    pinnedKnownHosts_.setAutoRemove(true);
    pinnedKnownHosts_.setFileTemplate(QDir::tempPath() + QStringLiteral("/slopcode-remote-known-hosts-XXXXXX"));
    if (!pinnedKnownHosts_.open()) {
      return fail(error, QStringLiteral("could not create pinned known_hosts file"));
    }
    const QStringList fields = target.pinnedHostKey.trimmed().split(QRegularExpression(QStringLiteral(R"(\s+)")), Qt::SkipEmptyParts);
    const QByteArray line = (hostPattern(target) + QStringLiteral(" ") + fields.at(0) + QStringLiteral(" ") + fields.at(1) + QStringLiteral("\n")).toUtf8();
    if (pinnedKnownHosts_.write(line) != line.size() || !pinnedKnownHosts_.flush()) {
      cleanupKnownHosts();
      return fail(error, QStringLiteral("could not write pinned known_hosts file"));
    }
    pinnedKnownHosts_.setPermissions(QFileDevice::ReadOwner | QFileDevice::WriteOwner);
    pinnedKnownHosts_.close();
    knownHostsPath_ = pinnedKnownHosts_.fileName();
  } else {
    const QFileInfo info(target.knownHostsPath);
    if (!info.isFile() || !info.isReadable()) {
      return fail(error, QStringLiteral("known_hosts path is not a readable file"));
    }
    knownHostsPath_ = target.knownHostsPath;
  }

  localPort_ = 0;
  tunnelError_.clear();
  QStringList execArguments = buildSshExecArguments(target, knownHostsPath_, error);
  if (execArguments.isEmpty()) {
    cleanupKnownHosts();
    return false;
  }

  target_ = target;
  setState(SshState::Starting);
  remoteProcess_.setProgram(QStringLiteral("ssh"));
  remoteProcess_.setArguments(execArguments);
  remoteProcess_.start();
  return true;
}

void SshTargetSupervisor::stop()
{
  if (state_ == SshState::Stopped) {
    cleanupKnownHosts();
    return;
  }

  setState(SshState::Stopped);
  if (remoteProcess_.state() != QProcess::NotRunning) {
    remoteProcess_.closeWriteChannel();
    remoteProcess_.terminate();
    if (!remoteProcess_.waitForFinished(1000)) {
      remoteProcess_.kill();
      remoteProcess_.waitForFinished(1000);
    }
  }
  if (tunnelProcess_.state() != QProcess::NotRunning) {
    tunnelProcess_.terminate();
    if (!tunnelProcess_.waitForFinished(1000)) {
      tunnelProcess_.kill();
      tunnelProcess_.waitForFinished(1000);
    }
  }
  target_.reset();
  tunnelError_.clear();
  localPort_ = 0;
  cleanupKnownHosts();
  emit stopped();
}

void SshTargetSupervisor::cleanupKnownHosts()
{
  pinnedKnownHosts_.close();
  pinnedKnownHosts_.remove();
  knownHostsPath_.clear();
}

void SshTargetSupervisor::setState(SshState state)
{
  if (state_ == state) {
    return;
  }
  state_ = state;
  emit stateChanged(state_);
}

void SshTargetSupervisor::failClosed(const QString &message)
{
  if (state_ == SshState::Failed || state_ == SshState::Stopped) {
    return;
  }
  setState(SshState::Failed);
  emit failed(message);
  if (remoteProcess_.state() != QProcess::NotRunning) {
    remoteProcess_.terminate();
  }
  if (tunnelProcess_.state() != QProcess::NotRunning) {
    tunnelProcess_.terminate();
  }
}

void SshTargetSupervisor::handleRemoteStarted()
{
  if (state_ != SshState::Starting || !target_.has_value()) {
    return;
  }
  QString error;
  const QString script = buildRemoteStartScript(*target_, &error);
  if (script.isEmpty()) {
    failClosed(error);
    return;
  }
  const QByteArray bytes = script.toUtf8();
  if (remoteProcess_.write(bytes) != bytes.size()) {
    failClosed(QStringLiteral("could not send SSH start script"));
    return;
  }
  remoteProcess_.closeWriteChannel();

  const QStringList tunnelArguments = buildSshTunnelArguments(*target_, knownHostsPath_, localPort_, &error);
  if (tunnelArguments.isEmpty()) {
    failClosed(error);
    return;
  }
  tunnelProcess_.setProgram(QStringLiteral("ssh"));
  tunnelProcess_.setArguments(tunnelArguments);
  tunnelProcess_.start();
}

void SshTargetSupervisor::handleTunnelStarted()
{
  if (state_ != SshState::Starting || !target_.has_value()) {
    return;
  }
  handleTunnelOutput();
}

void SshTargetSupervisor::handleTunnelOutput()
{
  if (state_ != SshState::Starting || !target_.has_value()) {
    return;
  }
  tunnelError_.append(tunnelProcess_.readAllStandardError());
  if (tunnelError_.size() > 32 * 1024) {
    tunnelError_.remove(0, tunnelError_.size() - 32 * 1024);
  }

  static const QRegularExpression listening(
    QStringLiteral(R"(Local forwarding listening on 127\.0\.0\.1 port ([1-9][0-9]{0,4})\.)"));
  const QRegularExpressionMatch match = listening.match(QString::fromUtf8(tunnelError_));
  if (!match.hasMatch()) {
    return;
  }
  bool ok = false;
  const quint32 port = match.captured(1).toUInt(&ok);
  if (!ok || port == 0 || port > 65535) {
    failClosed(QStringLiteral("SSH reported an invalid loopback forwarding port"));
    return;
  }
  localPort_ = static_cast<quint16>(port);
  setState(SshState::Ready);
  emit ready(localPort_, target_->remotePort);
}

void SshTargetSupervisor::handleProcessError(QProcess::ProcessError)
{
  failClosed(QStringLiteral("SSH process failed"));
}

void SshTargetSupervisor::handleRemoteFinished(int, QProcess::ExitStatus)
{
  if (state_ != SshState::Stopped && state_ != SshState::Failed) {
    failClosed(QStringLiteral("remote SSH command exited"));
  }
}

void SshTargetSupervisor::handleTunnelFinished(int, QProcess::ExitStatus)
{
  if (state_ != SshState::Stopped && state_ != SshState::Failed) {
    failClosed(QStringLiteral("SSH loopback tunnel exited"));
  }
}

} // namespace slopcode::remoteqt
