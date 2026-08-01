#include <slopcode/remoteqt/session.h>

#include <QAbstractSocket>
#include <QList>
#include <QNetworkRequest>
#include <QSslError>
#include <QSslSocket>
#include <QWebSocket>

namespace slopcode::remoteqt {
namespace {

bool validEndpoint(const QUrl &endpoint, QString *error)
{
  if (!endpoint.isValid() || endpoint.scheme().compare(QStringLiteral("wss"), Qt::CaseInsensitive) != 0 ||
      endpoint.host().isEmpty()) {
    if (error != nullptr) {
      *error = QStringLiteral("RemoteSession requires a valid wss:// endpoint");
    }
    return false;
  }
  if (!endpoint.userInfo().isEmpty() || endpoint.hasQuery() || endpoint.hasFragment()) {
    if (error != nullptr) {
      *error = QStringLiteral("WebSocket endpoint must not carry credentials or query data");
    }
    return false;
  }
  return true;
}

} // namespace

RemoteSession::RemoteSession(QObject *parent)
  : QObject(parent)
  , socket_(new QWebSocket(QString(), QWebSocketProtocol::VersionLatest, this))
{
  socket_->setMaxAllowedIncomingMessageSize(kMaxFrameBytes);
  connect(socket_, &QWebSocket::connected, this, [this]() {
    closingForError_ = false;
    textBuffer_.clear();
    textBytes_ = 0;
    pendingOpen_.reset();
    negotiated_ = false;
    setState(State::Connected);
    emit connected();
  });
  connect(socket_, &QWebSocket::disconnected, this, [this]() {
    textBuffer_.clear();
    textBytes_ = 0;
    pendingOpen_.reset();
    negotiated_ = false;
    if (!closingForError_) {
      setState(State::Disconnected);
    }
    emit closed();
  });
  connect(socket_, &QWebSocket::textFrameReceived, this, &RemoteSession::handleTextFrame);
  connect(socket_, &QWebSocket::binaryFrameReceived, this, [this](const QByteArray &, bool) {
    failClosed(QStringLiteral("binary WebSocket frames are not accepted"));
  });
  connect(socket_, &QWebSocket::sslErrors, this, [this](const QList<QSslError> &) {
    failClosed(QStringLiteral("TLS certificate validation failed"));
  });
  connect(socket_, &QWebSocket::peerVerifyError, this, [this](const QSslError &) {
    failClosed(QStringLiteral("TLS peer verification failed"));
  });
  connect(socket_, &QWebSocket::errorOccurred, this, [this](QAbstractSocket::SocketError) {
    if (!closingForError_) {
      emit failed(QStringLiteral("WebSocket transport error"));
    }
  });
}

bool RemoteSession::connectTo(const QUrl &endpoint,
                              const QSslConfiguration &tls,
                              QString *error)
{
  if (state_ == State::Connecting || state_ == State::Connected) {
    if (error != nullptr) {
      *error = QStringLiteral("RemoteSession is already connected");
    }
    return false;
  }
  if (!validEndpoint(endpoint, error)) {
    return false;
  }

  QSslConfiguration configuration = tls;
  configuration.setProtocol(QSsl::TlsV1_2OrLater);
  configuration.setPeerVerifyMode(QSslSocket::VerifyPeer);

  QNetworkRequest request(endpoint);
  request.setSslConfiguration(configuration);

  closingForError_ = false;
  textBuffer_.clear();
  textBytes_ = 0;
  pendingOpen_.reset();
  negotiated_ = false;
  setState(State::Connecting);
  socket_->open(request);
  return true;
}

void RemoteSession::disconnectFromHost()
{
  closingForError_ = false;
  if (socket_->state() != QAbstractSocket::UnconnectedState) {
    socket_->close(QWebSocketProtocol::NormalClosure, QStringLiteral("host closing"));
  }
  setState(State::Disconnected);
}

bool RemoteSession::send(const Frame &frame, QString *error)
{
  if (state_ != State::Connected) {
    if (error != nullptr) {
      *error = QStringLiteral("RemoteSession is not connected");
    }
    return false;
  }

  const QByteArray bytes = encodeFrame(frame, error);
  if (bytes.isEmpty()) {
    return false;
  }
  const QString type = frame.object.value(QStringLiteral("type")).toString();
  if (!negotiated_ && type != QStringLiteral("session.open")) {
    if (error != nullptr) {
      *error = QStringLiteral("session.open negotiation is required before other frames");
    }
    return false;
  }
  if (type == QStringLiteral("session.open")) {
    if (negotiated_ || pendingOpen_.has_value()) {
      if (error != nullptr) {
        *error = QStringLiteral("duplicate session.open");
      }
      return false;
    }
  }
  if (type == QStringLiteral("session.opened")) {
    if (error != nullptr) {
      *error = QStringLiteral("session.opened is a received negotiation response");
    }
    return false;
  }
  const bool opening = type == QStringLiteral("session.open");
  if (opening) {
    pendingOpen_ = frame.object;
  }
  const qint64 sent = socket_->sendTextMessage(QString::fromUtf8(bytes));
  if (sent < 0) {
    if (opening) {
      pendingOpen_.reset();
    }
    if (error != nullptr) {
      *error = QStringLiteral("WebSocket rejected the frame");
    }
    return false;
  }
  return true;
}

void RemoteSession::setState(State state)
{
  if (state_ == state) {
    return;
  }
  state_ = state;
  emit stateChanged(state_);
}

void RemoteSession::failClosed(const QString &message)
{
  if (closingForError_) {
    return;
  }
  closingForError_ = true;
  textBuffer_.clear();
  textBytes_ = 0;
  pendingOpen_.reset();
  negotiated_ = false;
  setState(State::Failed);
  emit protocolError(message);
  emit failed(message);
  socket_->close(QWebSocketProtocol::ProtocolError, QStringLiteral("invalid RemoteV1 frame"));
}

void RemoteSession::handleTextFrame(const QString &fragment, bool isLastFrame)
{
  if (closingForError_) {
    return;
  }

  const QByteArray encoded = fragment.toUtf8();
  if (encoded.size() > kMaxFrameBytes - textBytes_) {
    failClosed(QStringLiteral("frame exceeds maximum size"));
    return;
  }
  textBuffer_.append(fragment);
  textBytes_ += encoded.size();
  if (!isLastFrame) {
    return;
  }

  const ParseResult result = parseFrame(textBuffer_.toUtf8());
  textBuffer_.clear();
  textBytes_ = 0;
  if (!result) {
    failClosed(result.error);
    return;
  }
  if (result.frame->type == QStringLiteral("session.open")) {
    failClosed(pendingOpen_.has_value() || negotiated_ ? QStringLiteral("duplicate session.open")
                                                        : QStringLiteral("reference adapter cannot verify Ed25519 session proofs"));
    return;
  }
  if (result.frame->type == QStringLiteral("session.opened")) {
    if (negotiated_ || !pendingOpen_.has_value()) {
      failClosed(QStringLiteral("unexpected or duplicate session.opened"));
      return;
    }
    QString capabilityError;
    if (!remoteTransportSessionOpenedMatches(*pendingOpen_, result.frame->object, &capabilityError)) {
      failClosed(capabilityError.isEmpty() ? QStringLiteral("session.opened did not match session.open") : capabilityError);
      return;
    }
    pendingOpen_.reset();
    negotiated_ = true;
  } else if (!negotiated_) {
    failClosed(QStringLiteral("session.opened negotiation is required before other frames"));
    return;
  }
  emit frameReceived(*result.frame);
}

} // namespace slopcode::remoteqt
