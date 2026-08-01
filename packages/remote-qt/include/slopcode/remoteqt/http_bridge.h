#pragma once

#include <slopcode/remoteqt/frame.h>

#include <QPointer>
#include <QSet>
#include <QObject>

#include <functional>

class QNetworkReply;

namespace slopcode::remoteqt {

class LocalSlopcodeForwarder;
class RemoteSession;

// Dispatches the narrow RemoteV1 HTTP request surface to a configured local
// Slopcode forwarder. Pairing/proof authority stays outside this adapter: an
// application must install an authorizer before any request is forwarded.
class RemoteHttpBridge final : public QObject {
  Q_OBJECT

public:
  using Authorizer = std::function<bool(const Frame &request, QString *error)>;

  explicit RemoteHttpBridge(RemoteSession &session, QObject *parent = nullptr);
  ~RemoteHttpBridge() override;

  bool setTarget(const QJsonObject &target, QString *error = nullptr);
  QJsonObject target() const { return target_; }
  void setForwarder(LocalSlopcodeForwarder *forwarder);
  void setAuthorizer(Authorizer authorizer);

signals:
  void rejected(const QString &message);

private:
  void dispatch(const Frame &request);
  void reject(const Frame &request, const QString &code, const QString &message, bool retryable = false);
  void finish(QNetworkReply *reply, const Frame &request);

  RemoteSession &session_;
  QPointer<LocalSlopcodeForwarder> forwarder_;
  QJsonObject target_;
  Authorizer authorizer_;
  QSet<QNetworkReply *> replies_;
  bool stopping_ = false;
};

} // namespace slopcode::remoteqt
