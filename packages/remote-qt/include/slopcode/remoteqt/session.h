#pragma once

#include <slopcode/remoteqt/frame.h>

#include <QNetworkRequest>
#include <QObject>
#include <QSslConfiguration>
#include <QUrl>

class QWebSocket;

namespace slopcode::remoteqt {

class RemoteSession final : public QObject {
  Q_OBJECT

public:
  enum class State {
    Disconnected,
    Connecting,
    Connected,
    Failed,
  };
  Q_ENUM(State)

  explicit RemoteSession(QObject *parent = nullptr);

  bool connectTo(const QUrl &endpoint,
                 const QSslConfiguration &tls = QSslConfiguration::defaultConfiguration(),
                 QString *error = nullptr);
  void disconnectFromHost();

  bool send(const Frame &frame, QString *error = nullptr);
  State state() const { return state_; }
  QWebSocket *socket() const { return socket_; }

signals:
  void stateChanged(slopcode::remoteqt::RemoteSession::State state);
  void connected();
  void frameReceived(const slopcode::remoteqt::Frame &frame);
  void protocolError(const QString &message);
  void failed(const QString &message);
  void closed();

private:
  void setState(State state);
  void failClosed(const QString &message);
  void handleTextFrame(const QString &fragment, bool isLastFrame);

  QWebSocket *socket_ = nullptr;
  State state_ = State::Disconnected;
  QString textBuffer_;
  qsizetype textBytes_ = 0;
  QJsonObject offeredCapabilities_;
  bool closingForError_ = false;
};

} // namespace slopcode::remoteqt
