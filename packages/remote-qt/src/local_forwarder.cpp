#include <slopcode/remoteqt/local_forwarder.h>

#include <QHostAddress>
#include <QNetworkAccessManager>
#include <QNetworkReply>
#include <QNetworkRequest>
#include <QNetworkProxy>
#include <QRegularExpression>
#include <QSet>
#include <QStringList>
#include <QWebSocket>

#include <optional>

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
  for (const unsigned char byte : value) {
    if (byte <= 0x1f || (byte >= 0x7f && byte <= 0x9f)) {
      return true;
    }
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

bool secretField(const QByteArray &name)
{
  static const QRegularExpression pattern(
    QStringLiteral(R"((?:password|passphrase|private[-_]?key|api[-_]?key|secret|token|authorization|cookie|credential))"),
    QRegularExpression::CaseInsensitiveOption);
  return pattern.match(QString::fromLatin1(name)).hasMatch();
}

bool prototypeKey(const QByteArray &name)
{
  const QByteArray lowered = name.toLower();
  return lowered == QByteArrayLiteral("__proto__") || lowered == QByteArrayLiteral("constructor") ||
         lowered == QByteArrayLiteral("prototype");
}

bool unsafeHeader(const QByteArray &name)
{
  const QByteArray lowered = name.toLower();
  static const QSet<QByteArray> hopByHop{
    QByteArrayLiteral("connection"), QByteArrayLiteral("keep-alive"), QByteArrayLiteral("proxy-authenticate"),
    QByteArrayLiteral("proxy-authorization"), QByteArrayLiteral("te"), QByteArrayLiteral("trailer"),
    QByteArrayLiteral("transfer-encoding"), QByteArrayLiteral("upgrade"), QByteArrayLiteral("host"),
    QByteArrayLiteral("content-length"), QByteArrayLiteral("proxy-connection"),
  };
  static const QSet<QByteArray> forwarding{
    QByteArrayLiteral("forward"), QByteArrayLiteral("forwarded"), QByteArrayLiteral("via"),
    QByteArrayLiteral("x-client-ip"), QByteArrayLiteral("x-cluster-client-ip"), QByteArrayLiteral("x-forwarded-for"),
    QByteArrayLiteral("x-forwarded-host"), QByteArrayLiteral("x-forwarded-port"), QByteArrayLiteral("x-forwarded-proto"),
    QByteArrayLiteral("x-real-ip"), QByteArrayLiteral("true-client-ip"), QByteArrayLiteral("cf-connecting-ip"),
  };
  return hopByHop.contains(lowered) || forwarding.contains(lowered) || lowered.startsWith("x-forwarded-") ||
         lowered.startsWith("sec-websocket-");
}

int hexValue(const QChar value)
{
  if (value >= QChar('0') && value <= QChar('9')) return value.unicode() - QChar('0').unicode();
  if (value >= QChar('a') && value <= QChar('f')) return value.unicode() - QChar('a').unicode() + 10;
  if (value >= QChar('A') && value <= QChar('F')) return value.unicode() - QChar('A').unicode() + 10;
  return -1;
}

std::optional<QString> decodePercent(const QString &value)
{
  QByteArray bytes;
  for (qsizetype index = 0; index < value.size();) {
    if (value.at(index) == QChar('%')) {
      if (index + 2 >= value.size()) return std::nullopt;
      const int high = hexValue(value.at(index + 1));
      const int low = hexValue(value.at(index + 2));
      if (high < 0 || low < 0) return std::nullopt;
      bytes.append(static_cast<char>((high << 4) | low));
      index += 3;
      continue;
    }
    const qsizetype width = value.at(index).isHighSurrogate() && index + 1 < value.size() &&
                                    value.at(index + 1).isLowSurrogate()
                              ? 2
                              : 1;
    bytes.append(value.mid(index, width).toUtf8());
    index += width;
  }
  const QString decoded = QString::fromUtf8(bytes);
  if (decoded.toUtf8() != bytes) return std::nullopt;
  return decoded;
}

bool safePathEncoding(const QString &path)
{
  const std::optional<QString> decoded = decodePercent(path);
  return decoded.has_value() && !decoded->contains('%') && !hasControl(*decoded) && !decoded->contains('\\') &&
         !decoded->contains('?') && !decoded->contains('#');
}

bool safePath(const QString &path)
{
  if (path.isEmpty() || !path.startsWith('/') || path.startsWith(QStringLiteral("//")) || path.contains(QChar::Null) ||
      path.contains('\\') || path.contains('?') || path.contains('#') || path.contains(QChar::CarriageReturn) ||
      path.contains(QChar::LineFeed) || !safePathEncoding(path)) {
    return false;
  }
  if (path == QStringLiteral("/")) {
    return true;
  }
  const std::optional<QString> decoded = decodePercent(path);
  if (!decoded.has_value()) return false;
  const QStringList segments = decoded->mid(1).split('/', Qt::KeepEmptyParts);
  for (qsizetype index = 0; index < segments.size(); ++index) {
    const QString &segment = segments.at(index);
    if ((segment.isEmpty() && index != segments.size() - 1) || segment == QStringLiteral(".") ||
        segment == QStringLiteral("..")) {
      return false;
    }
  }
  return true;
}

bool safeQuery(const QString &query)
{
  if (query.toUtf8().size() > 8 * 1024 || hasControl(query) || query.contains('?') || query.contains('#') ||
      query.contains('\\')) {
    return false;
  }
  const std::optional<QString> decoded = decodePercent(query);
  return decoded.has_value() && !hasControl(*decoded) && !decoded->contains('#');
}

bool sameOrigin(const QUrl &left, const QUrl &right)
{
  return left.scheme().compare(right.scheme(), Qt::CaseInsensitive) == 0 &&
         left.host().compare(right.host(), Qt::CaseInsensitive) == 0 && left.port() == right.port() &&
         left.userInfo().isEmpty() && right.userInfo().isEmpty();
}

} // namespace

namespace {

bool validateURL(const QUrl &url, bool allowQuery, QString *error)
{
  const QString path = url.path(QUrl::FullyEncoded).isEmpty() ? QStringLiteral("/") : url.path(QUrl::FullyEncoded);
  if (!url.isValid() || (url.scheme() != QStringLiteral("http") && url.scheme() != QStringLiteral("https")) ||
      url.host().isEmpty() || !url.userInfo().isEmpty() || url.hasFragment() || url.port() < 1 || !safePath(path) ||
      (!allowQuery && url.hasQuery()) || (url.hasQuery() && !safeQuery(url.query(QUrl::FullyEncoded)))) {
    return fail(error, QStringLiteral("local server URL must be an explicit HTTP(S) loopback URL"));
  }

  QHostAddress address;
  if (!address.setAddress(url.host()) ||
      (address != QHostAddress(QHostAddress::LocalHost) && address != QHostAddress(QHostAddress::LocalHostIPv6))) {
    return fail(error, QStringLiteral("local server URL must be loopback"));
  }
  return true;
}

} // namespace

LocalSlopcodeForwarder::LocalSlopcodeForwarder(const QUrl &baseURL, QObject *parent)
  : QObject(parent)
  , manager_(new QNetworkAccessManager(this))
{
  manager_->setProxy(QNetworkProxy(QNetworkProxy::NoProxy));
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
  return forwardHTTPWithQuery(method, path, QString(), body, headers, error);
}

QNetworkReply *LocalSlopcodeForwarder::forwardHTTPWithQuery(const QByteArray &method,
                                                             const QString &path,
                                                             const QString &query,
                                                             const QByteArray &body,
                                                             const Headers &headers,
                                                             QString *error)
{
  static const QSet<QByteArray> methods{
    QByteArrayLiteral("GET"), QByteArrayLiteral("HEAD"), QByteArrayLiteral("POST"), QByteArrayLiteral("PUT"),
    QByteArrayLiteral("PATCH"), QByteArrayLiteral("DELETE"), QByteArrayLiteral("OPTIONS"),
  };
  if (!methods.contains(method)) {
    fail(error, QStringLiteral("HTTP method is not allowed by RemoteV1"));
    return nullptr;
  }
  if (body.size() > 64 * 1024) {
    fail(error, QStringLiteral("forwarding body exceeds the RemoteV1 bound"));
    return nullptr;
  }
  if (!validateQuery(query, error)) {
    return nullptr;
  }

  QUrl url;
  if (!makeURL(path, query, &url, error)) {
    return nullptr;
  }
  QNetworkRequest request(url);
  if (!applyHeaders(request, headers, error)) {
    return nullptr;
  }
  request.setAttribute(QNetworkRequest::RedirectPolicyAttribute, QNetworkRequest::ManualRedirectPolicy);
  QNetworkReply *reply = manager_->sendCustomRequest(request, method, body);
  connect(reply, &QNetworkReply::redirected, reply, [this, reply](const QUrl &redirect) {
    const QUrl candidate = baseURL_.resolved(redirect);
    if (!validateURL(candidate, true, nullptr) || !sameOrigin(candidate, baseURL_)) {
      reply->abort();
      return;
    }
    reply->redirectAllowed();
  });
  connect(reply, &QNetworkReply::downloadProgress, reply, [reply](qint64 received, qint64 total) {
    if (received > 64 * 1024 || total > 64 * 1024) {
      reply->abort();
    }
  });
  return reply;
}

QWebSocket *LocalSlopcodeForwarder::forwardWebSocket(const QString &path,
                                                      const Headers &headers,
                                                      QString *error)
{
  QUrl url;
  if (!makeURL(path, QString(), &url, error)) {
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
  socket->setProxy(QNetworkProxy(QNetworkProxy::NoProxy));
  socket->open(request);
  return socket;
}

bool LocalSlopcodeForwarder::validateLoopbackURL(const QUrl &url, QString *error)
{
  return validateURL(url, false, error);
}

bool LocalSlopcodeForwarder::makeURL(const QString &path, const QString &query, QUrl *url, QString *error) const
{
  if (baseURL_.isEmpty()) {
    return fail(error, QStringLiteral("local server URL is not configured"));
  }
  if (!validatePath(path, error)) {
    return false;
  }
  if (!validateQuery(query, error)) {
    return false;
  }

  const QUrl relative(path);
  QUrl candidate = baseURL_.resolved(relative);
  candidate.setQuery(query, QUrl::TolerantMode);
  if (!validateURL(candidate, true, error) || !sameOrigin(candidate, baseURL_)) {
    return fail(error, QStringLiteral("forwarding path escaped the configured local server"));
  }
  *url = candidate;
  return true;
}

bool LocalSlopcodeForwarder::validatePath(const QString &path, QString *error)
{
  if (path.toUtf8().size() > 4 * 1024 || !safePath(path)) {
    return fail(error, QStringLiteral("forwarding path must be an absolute local path"));
  }
  const QUrl relative(path);
  if (!relative.isValid() || !relative.isRelative() || !relative.userInfo().isEmpty() || relative.hasQuery() || relative.hasFragment()) {
    return fail(error, QStringLiteral("invalid forwarding path"));
  }
  return true;
}

bool LocalSlopcodeForwarder::validateQuery(const QString &query, QString *error)
{
  return safeQuery(query) ? true : fail(error, QStringLiteral("forwarding query is malformed or outside its bounds"));
}

bool LocalSlopcodeForwarder::applyHeaders(QNetworkRequest &request, const Headers &headers, QString *error)
{
  if (headers.size() > 64) {
    return fail(error, QStringLiteral("too many forwarding headers"));
  }
  QSet<QByteArray> names;
  int bytes = 0;
  const QRegularExpression namePattern(QStringLiteral(R"(^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$)"));
  for (const auto &header : headers) {
    const QByteArray name = header.first;
    const QByteArray normalized = name.toLower();
    if (name.isEmpty() || name.size() > 128 || !namePattern.match(QString::fromLatin1(name)).hasMatch() ||
        prototypeKey(name) || secretField(name) || unsafeHeader(name) || hasControl(name) || hasControl(header.second) ||
        names.contains(normalized) || header.second.size() > 8 * 1024) {
      return fail(error, QStringLiteral("unsafe forwarding header"));
    }
    names.insert(normalized);
    bytes += name.size() + header.second.size();
    request.setRawHeader(name, header.second);
  }
  return bytes <= 64 * (128 + 8 * 1024) ? true : fail(error, QStringLiteral("forwarding headers are too large"));
}

} // namespace slopcode::remoteqt
