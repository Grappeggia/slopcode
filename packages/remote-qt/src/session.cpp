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

bool validToken(const QByteArray &token, QString *error)
{
  if (token.isEmpty() || token.trimmed() != token || token.contains('\r') || token.contains('\n')) {
    if (error != nullptr) {
      *error = QStringLiteral("a runtime session token is required");
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
  connect(socket_, &QWebSocket::connected, this, [this]() {
    closingForError_ = false;
    textBuffer_.clear();
    textBytes_ = 0;
    setState(State::Connected);
    emit connected();
  });
  connect(socket_, &QWebSocket::disconnected, this, [this]() {
    textBuffer_.clear();
    textBytes_ = 0;
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
                              const QByteArray &sessionToken,
                              const QSslConfiguration &tls,
                              QString *error)
{
  if (state_ == State::Connecting || state_ == State::Connected) {
    if (error != nullptr) {
      *error = QStringLiteral("RemoteSession is already connected");
    }
    return false;
  }
  if (!validEndpoint(endpoint, error) || !validToken(sessionToken, error)) {
    return false;
  }

  QSslConfiguration configuration = tls;
  configuration.setProtocol(QSsl::TlsV1_2OrLater);
  configuration.setPeerVerifyMode(QSslSocket::VerifyPeer);

  QNetworkRequest request(endpoint);
  request.setSslConfiguration(configuration);
  QByteArray authorization = QByteArrayLiteral("Bearer ") + sessionToken;
  request.setRawHeader(QByteArrayLiteral("Authorization"), authorization);
  authorization.fill('\0');

  closingForError_ = false;
  textBuffer_.clear();
  textBytes_ = 0;
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
  socket_->sendTextMessage(QString::fromUtf8(bytes));
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
  emit frameReceived(*result.frame);
}

} // namespace slopcode::remoteqt
