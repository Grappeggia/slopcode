#include <slopcode/remoteqt/local_forwarder.h>

#include <QHostAddress>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QRegularExpression>
#include <QWebSocket>

namespace slopcode::remoteqt {
namespace {

bool fail(QString *error, const QString &message)
{
  if (error != nullptr) {
    *error = message;
  }
  return false;
}

bool hasControl(const QByteArray &value)
{
  return value.contains('\0') || value.contains('\r') || value.contains('\n');
}

} // namespace

LocalSlopcodeForwarder::LocalSlopcodeForwarder(const QUrl &baseURL, QObject *parent)
  : QObject(parent)
  , manager_(new QNetworkAccessManager(this))
{
  if (!baseURL.isEmpty()) {
    setBaseURL(baseURL);
  }
}

bool LocalSlopcodeForwarder::setBaseURL(const QUrl &baseURL, QString *error)
{
  if (!validateLoopbackURL(baseURL, error)) {
    return false;
  }
  baseURL_ = baseURL;
  return true;
}

QNetworkReply *LocalSlopcodeForwarder::forwardHTTP(const QByteArray &method,
                                                    const QString &path,
                                                    const QByteArray &body,
                                                    const Headers &headers,
                                                    QString *error)
{
  if (method.isEmpty() || hasControl(method) || !QRegularExpression(QStringLiteral(R"(^[A-Za-z]+$)"))
                                                  .match(QString::fromLatin1(method))
                                                  .hasMatch()) {
    fail(error, QStringLiteral("invalid HTTP method"));
    return nullptr;
  }

  QUrl url;
  if (!makeURL(path, &url, error)) {
    return nullptr;
  }
  QNetworkRequest request(url);
  if (!applyHeaders(request, headers, error)) {
    return nullptr;
  }
  return manager_->sendCustomRequest(request, method, body);
}

QWebSocket *LocalSlopcodeForwarder::forwardWebSocket(const QString &path,
                                                      const Headers &headers,
                                                      QString *error)
{
  QUrl url;
  if (!makeURL(path, &url, error)) {
    return nullptr;
  }
  if (url.scheme() == QStringLiteral("http")) {
    url.setScheme(QStringLiteral("ws"));
  } else if (url.scheme() == QStringLiteral("https")) {
    url.setScheme(QStringLiteral("wss"));
  }

  QNetworkRequest request(url);
  if (!applyHeaders(request, headers, error)) {
    return nullptr;
  }
  auto *socket = new QWebSocket(QString(), QWebSocketProtocol::VersionLatest, this);
  socket->open(request);
  return socket;
}

bool LocalSlopcodeForwarder::validateLoopbackURL(const QUrl &url, QString *error)
{
  if (!url.isValid() || (url.scheme() != QStringLiteral("http") && url.scheme() != QStringLiteral("https")) ||
      url.host().isEmpty() || !url.userInfo().isEmpty() || url.hasFragment() || url.hasQuery() || url.port() < 1) {
    return fail(error, QStringLiteral("local server URL must be an explicit HTTP(S) loopback URL"));
  }

  const QString host = url.host().toLower();
  if (host != QStringLiteral("localhost") && host != QStringLiteral("127.0.0.1") && host != QStringLiteral("::1")) {
    return fail(error, QStringLiteral("local server URL must be loopback"));
  }
  return true;
}

bool LocalSlopcodeForwarder::makeURL(const QString &path, QUrl *url, QString *error) const
{
  if (baseURL_.isEmpty()) {
    return fail(error, QStringLiteral("local server URL is not configured"));
  }
  if (!validatePath(path, error)) {
    return false;
  }

  const QUrl relative(path);
  const QUrl candidate = baseURL_.resolved(relative);
  if (!validateLoopbackURL(candidate, error) || candidate.host() != baseURL_.host() ||
      candidate.port() != baseURL_.port() || candidate.scheme() != baseURL_.scheme()) {
    return fail(error, QStringLiteral("forwarding path escaped the configured local server"));
  }
  *url = candidate;
  return true;
}

bool LocalSlopcodeForwarder::validatePath(const QString &path, QString *error)
{
  if (path.isEmpty() || !path.startsWith('/') || path.startsWith(QStringLiteral("//")) ||
      path.contains(QChar::Null) || path.contains(QChar::CarriageReturn) || path.contains(QChar::LineFeed)) {
    return fail(error, QStringLiteral("forwarding path must be an absolute local path"));
  }
  const QUrl relative(path);
  if (!relative.isValid() || !relative.isRelative() || !relative.userInfo().isEmpty()) {
    return fail(error, QStringLiteral("invalid forwarding path"));
  }
  return true;
}

bool LocalSlopcodeForwarder::applyHeaders(QNetworkRequest &request, const Headers &headers, QString *error)
{
  for (const auto &header : headers) {
    if (header.first.isEmpty() || hasControl(header.first) || hasControl(header.second) ||
        header.first.compare(QByteArrayLiteral("Host"), Qt::CaseInsensitive) == 0 ||
        header.first.compare(QByteArrayLiteral("Content-Length"), Qt::CaseInsensitive) == 0) {
      return fail(error, QStringLiteral("unsafe forwarding header"));
    }
    request.setRawHeader(header.first, header.second);
  }
  return true;
}

} // namespace slopcode::remoteqt
