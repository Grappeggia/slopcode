#pragma once

#include <QByteArray>
#include <QObject>
#include <QProcess>
#include <QStringList>
#include <QTemporaryFile>

#include <optional>

namespace slopcode::remoteqt {

struct SshTarget {
  QString host;
  QString user;
  quint16 port = 22;
  QString remoteFolder;

  // Exactly one of knownHostsPath and pinnedHostKey is required. A pinned
  // key is the two-field public-key value, for example
  // "ssh-ed25519 AAAAC3...", not a private key or a password.
  QString knownHostsPath;
  QString pinnedHostKey;
  QString identityPath;

  quint16 remotePort = 0;
  quint16 localPort = 0;
  QString serverExecutable = QStringLiteral("slopcode");
  QStringList serverArguments;
};

enum class SshState {
  Stopped,
  Starting,
  Ready,
  Failed,
};

bool validateRemoteFolder(const QString &folder, QString *error = nullptr);
QStringList buildSshExecArguments(const SshTarget &target,
                                  const QString &knownHostsPath,
                                  QString *error = nullptr);
QStringList buildSshTunnelArguments(const SshTarget &target,
                                    const QString &knownHostsPath,
                                    quint16 localPort,
                                    QString *error = nullptr);
QString buildRemoteStartScript(const SshTarget &target, QString *error = nullptr);

class SshTargetSupervisor final : public QObject {
  Q_OBJECT

public:
  explicit SshTargetSupervisor(QObject *parent = nullptr);
  ~SshTargetSupervisor() override;

  bool start(const SshTarget &target, QString *error = nullptr);
  void stop();

  SshState state() const { return state_; }
  quint16 localPort() const { return localPort_; }
  quint16 remotePort() const { return target_.has_value() ? target_->remotePort : 0; }

signals:
  void stateChanged(slopcode::remoteqt::SshState state);
  void ready(quint16 localPort, quint16 remotePort);
  void failed(const QString &message);
  void stopped();

private:
  void cleanupKnownHosts();
  void setState(SshState state);
  void failClosed(const QString &message);
  void handleRemoteStarted();
  void handleTunnelStarted();
  void handleTunnelOutput();
  void handleProcessError(QProcess::ProcessError error);
  void handleRemoteFinished(int exitCode, QProcess::ExitStatus status);
  void handleTunnelFinished(int exitCode, QProcess::ExitStatus status);

  QProcess remoteProcess_;
  QProcess tunnelProcess_;
  QTemporaryFile pinnedKnownHosts_;
  std::optional<SshTarget> target_;
  QString knownHostsPath_;
  QByteArray tunnelError_;
  quint16 localPort_ = 0;
  SshState state_ = SshState::Stopped;
};

} // namespace slopcode::remoteqt
