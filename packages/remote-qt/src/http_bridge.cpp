#include <slopcode/remoteqt/http_bridge.h>

#include <slopcode/remoteqt/local_forwarder.h>
#include <slopcode/remoteqt/session.h>

#include <QNetworkReply>
#include <QNetworkRequest>
#include <QSet>

#include <utility>

namespace slopcode::remoteqt {
namespace {

constexpr int kMaxBodyBytes = 64 * 1024;
constexpr int kMaxErrorBytes = 2 * 1024;
constexpr int kMaxHeaderCount = 64;
constexpr int kMaxHeaderNameBytes = 128;
constexpr int kMaxHeaderValueBytes = 8 * 1024;

bool continuation(unsigned char byte)
{
  return (byte & 0xc0) == 0x80;
}

QString boundedUtf8(const QString &message)
{
  const QByteArray bytes = message.toUtf8();
  if (bytes.size() <= kMaxErrorBytes) {
    return message;
  }

  qsizetype end = kMaxErrorBytes;
  while (end > 0 && continuation(static_cast<unsigned char>(bytes.at(end - 1)))) {
    --end;
  }
  if (end < kMaxErrorBytes) {
    qsizetype start = end;
    while (start > 0 && continuation(static_cast<unsigned char>(bytes.at(start - 1)))) {
      --start;
    }
    if (start == 0 || (static_cast<unsigned char>(bytes.at(start - 1)) & 0x80) == 0) {
      end = start;
    } else {
      const unsigned char lead = static_cast<unsigned char>(bytes.at(start - 1));
      const int width = (lead & 0xe0) == 0xc0 ? 2 : (lead & 0xf0) == 0xe0 ? 3 : 4;
      if (start - 1 + width > end) {
        end = start - 1;
      }
    }
  }
  return QString::fromUtf8(bytes.constData(), end);
}

bool unsafeHeader(const QByteArray &name)
{
  const QByteArray lowered = name.toLower();
  static const QSet<QByteArray> secret{
    QByteArrayLiteral("authorization"), QByteArrayLiteral("cookie"), QByteArrayLiteral("set-cookie"),
    QByteArrayLiteral("proxy-authorization"),
  };
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
  return secret.contains(lowered) || lowered.contains("password") || lowered.contains("passphrase") ||
         lowered.contains("private-key") || lowered.contains("private_key") || lowered.contains("api-key") ||
         lowered.contains("privatekey") || lowered.contains("api_key") || lowered.contains("apikey") ||
         lowered.contains("secret") || lowered.contains("token") ||
         lowered.contains("credential") || hopByHop.contains(lowered) || forwarding.contains(lowered) ||
         lowered.startsWith("x-forwarded-") || lowered.startsWith("sec-websocket-");
}

QByteArray decode(const QJsonObject &body)
{
  if (body.value(QStringLiteral("encoding")).toString() == QStringLiteral("utf8")) {
    return body.value(QStringLiteral("data")).toString().toUtf8();
  }
  return QByteArray::fromBase64(body.value(QStringLiteral("data")).toString().toLatin1());
}

QJsonObject encode(const QByteArray &body)
{
  const QString text = QString::fromUtf8(body);
  if (text.toUtf8() == body) {
    return QJsonObject{{QStringLiteral("encoding"), QStringLiteral("utf8")}, {QStringLiteral("data"), text}};
  }
  return QJsonObject{{QStringLiteral("encoding"), QStringLiteral("base64")},
                     {QStringLiteral("data"), QString::fromLatin1(body.toBase64())}};
}

bool headerName(const QByteArray &name)
{
  if (name.isEmpty() || name.size() > kMaxHeaderNameBytes) {
    return false;
  }
  for (const unsigned char byte : name) {
    const bool alpha = (byte >= 'a' && byte <= 'z') || (byte >= 'A' && byte <= 'Z');
    const bool digit = byte >= '0' && byte <= '9';
    const bool punctuation = QByteArrayLiteral("!#$%&'*+-.^_`|~").contains(static_cast<char>(byte));
    if (!alpha && !digit && !punctuation) {
      return false;
    }
  }
  return true;
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

bool headers(const QNetworkReply &reply, QJsonObject *result, QString *error)
{
  QSet<QByteArray> names;
  int bytes = 0;
  for (const QNetworkReply::RawHeaderPair &header : reply.rawHeaderPairs()) {
    const QByteArray name = header.first;
    const QByteArray value = header.second;
    const QByteArray normalized = name.toLower();
    const QString text = QString::fromUtf8(value);
    if (unsafeHeader(name)) {
      continue;
    }
    if (!headerName(name) || value.size() > kMaxHeaderValueBytes || text.toUtf8() != value || hasControl(value)) {
      if (error != nullptr) {
        *error = QStringLiteral("local Slopcode response contains an invalid HTTP header");
      }
      return false;
    }
    if (names.contains(normalized)) {
      continue;
    }
    if (names.size() == kMaxHeaderCount || bytes > kMaxHeaderCount * (kMaxHeaderNameBytes + kMaxHeaderValueBytes) -
                                                   name.size() - value.size()) {
      if (error != nullptr) {
        *error = QStringLiteral("local Slopcode response headers exceed RemoteV1 bounds");
      }
      return false;
    }
    names.insert(normalized);
    bytes += name.size() + value.size();
    result->insert(QString::fromLatin1(name), text);
  }
  return true;
}

bool contentLengthTooLarge(const QNetworkReply &reply)
{
  bool ok = false;
  const qint64 length = reply.header(QNetworkRequest::ContentLengthHeader).toLongLong(&ok);
  return ok && length > kMaxBodyBytes;
}

bool sameTarget(const QJsonObject &left, const QJsonObject &right)
{
  return left == right;
}

} // namespace

RemoteHttpBridge::RemoteHttpBridge(RemoteSession &session, QObject *parent)
  : QObject(parent)
  , session_(session)
{
  connect(&session_, &RemoteSession::frameReceived, this, [this](const Frame &frame) {
    if (frame.kind == FrameKind::Request && frame.type == QStringLiteral("http.request")) {
      dispatch(frame);
    }
  });
}

RemoteHttpBridge::~RemoteHttpBridge()
{
  stopping_ = true;
  const QSet<QNetworkReply *> replies = replies_;
  replies_.clear();
  for (QNetworkReply *reply : replies) {
    reply->abort();
    reply->deleteLater();
  }
}

bool RemoteHttpBridge::setTarget(const QJsonObject &target, QString *error)
{
  if (!validateTarget(target, error)) {
    return false;
  }
  target_ = target;
  return true;
}

void RemoteHttpBridge::setForwarder(LocalSlopcodeForwarder *forwarder)
{
  forwarder_ = forwarder;
}

void RemoteHttpBridge::setAuthorizer(Authorizer authorizer)
{
  authorizer_ = std::move(authorizer);
}

void RemoteHttpBridge::dispatch(const Frame &request)
{
  if (!session_.negotiated()) {
    reject(request, QStringLiteral("unauthorized"), QStringLiteral("RemoteV1 session is not negotiated"));
    return;
  }
  if (target_.isEmpty() || !sameTarget(request.target, target_)) {
    reject(request, QStringLiteral("out_of_scope"), QStringLiteral("request target is not configured for this host"));
    return;
  }
  QString error;
  if (!verifyRemoteRequestDigest(request.object, &error)) {
    reject(request, QStringLiteral("bad_request"), QStringLiteral("request digest is invalid"));
    return;
  }
  if (!authorizer_) {
    reject(request, QStringLiteral("unauthorized"), QStringLiteral("no pairing/proof authorizer is configured"));
    return;
  }
  if (!authorizer_(request, &error)) {
    reject(request,
           QStringLiteral("forbidden"),
           error.isEmpty() ? QStringLiteral("pairing/proof authorization was rejected") : boundedUtf8(error));
    return;
  }
  if (forwarder_.isNull()) {
    reject(request, QStringLiteral("internal"), QStringLiteral("local Slopcode forwarder is not configured"), true);
    return;
  }

  const QJsonObject object = request.object;
  const QByteArray body = object.contains(QStringLiteral("body")) ? decode(object.value(QStringLiteral("body")).toObject()) : QByteArray();
  Headers requestHeaders;
  const QJsonObject inputHeaders = object.value(QStringLiteral("headers")).toObject();
  for (auto it = inputHeaders.cbegin(); it != inputHeaders.cend(); ++it) {
    const QByteArray name = it.key().toLatin1();
    if (!unsafeHeader(name)) {
      requestHeaders.append(qMakePair(name, it.value().toString().toUtf8()));
    }
  }
  QNetworkReply *reply = forwarder_->forwardHTTPWithQuery(object.value(QStringLiteral("method")).toString().toLatin1(),
                                                            object.value(QStringLiteral("path")).toString(),
                                                            object.value(QStringLiteral("query")).toString(),
                                                            body,
                                                            requestHeaders,
                                                            &error);
  if (reply == nullptr) {
    reject(request,
           QStringLiteral("internal"),
           error.isEmpty() ? QStringLiteral("local Slopcode forwarding failed") : boundedUtf8(error),
           true);
    return;
  }
  replies_.insert(reply);
  bodies_.insert(reply, QByteArray());
  connect(reply, &QObject::destroyed, this, [this, reply]() {
    replies_.remove(reply);
    bodies_.remove(reply);
    oversized_.remove(reply);
    finishing_.remove(reply);
  });
  connect(reply, &QNetworkReply::readyRead, this, [this, reply]() { consume(reply); });
  connect(reply, &QNetworkReply::downloadProgress, this, [this, reply](qint64 received, qint64 total) {
    if (received > kMaxBodyBytes || total > kMaxBodyBytes) {
      oversized_.insert(reply);
      reply->abort();
    }
  });
  connect(reply, &QNetworkReply::finished, this, [this, reply, request]() { finish(reply, request); });
}

void RemoteHttpBridge::reject(const Frame &request, const QString &code, const QString &message, bool retryable)
{
  const QJsonObject object{
    {QStringLiteral("version"), QStringLiteral("v1")},
    {QStringLiteral("kind"), QStringLiteral("error")},
    {QStringLiteral("type"), QStringLiteral("error")},
    {QStringLiteral("requestID"), request.requestID},
    {QStringLiteral("idempotencyKey"), request.idempotencyKey},
    {QStringLiteral("requestDigest"), request.object.value(QStringLiteral("requestDigest"))},
    {QStringLiteral("target"), request.target},
    {QStringLiteral("code"), code},
    {QStringLiteral("message"), boundedUtf8(message)},
    {QStringLiteral("retryable"), retryable},
  };
  QString error;
  if (!session_.send(Frame(object), &error)) {
    emit rejected(boundedUtf8(message));
  }
}

void RemoteHttpBridge::consume(QNetworkReply *reply)
{
  if (stopping_ || !replies_.contains(reply)) {
    return;
  }
  QByteArray &body = bodies_[reply];
  const qint64 remaining = kMaxBodyBytes - body.size();
  const qint64 available = reply->bytesAvailable();
  if (available <= 0) {
    return;
  }
  if (available > remaining) {
    oversized_.insert(reply);
    reply->abort();
    return;
  }
  const QByteArray chunk = reply->read(available);
  if (chunk.size() > remaining || reply->bytesAvailable() > 0) {
    oversized_.insert(reply);
    reply->abort();
    return;
  }
  body.append(chunk);
}

void RemoteHttpBridge::finish(QNetworkReply *reply, const Frame &request)
{
  if (!replies_.contains(reply) || finishing_.contains(reply)) {
    return;
  }
  finishing_.insert(reply);
  if (stopping_) {
    replies_.remove(reply);
    finishing_.remove(reply);
    reply->deleteLater();
    return;
  }
  consume(reply);
  const bool tooLarge = oversized_.remove(reply) || contentLengthTooLarge(*reply);
  const QByteArray body = bodies_.value(reply);
  replies_.remove(reply);
  bodies_.remove(reply);
  if (tooLarge) {
    reply->abort();
    reject(request, QStringLiteral("too_large"), QStringLiteral("local Slopcode response body exceeds RemoteV1 bounds"));
  } else if (reply->error() != QNetworkReply::NoError) {
    reject(request, QStringLiteral("internal"), QStringLiteral("local Slopcode request failed"), true);
  } else {
    const int status = reply->attribute(QNetworkRequest::HttpStatusCodeAttribute).toInt();
    if (status < 100 || status > 599) {
      reject(request, QStringLiteral("internal"), QStringLiteral("local Slopcode response has no valid HTTP status"), true);
    } else {
      QJsonObject object{
        {QStringLiteral("version"), QStringLiteral("v1")},
        {QStringLiteral("kind"), QStringLiteral("response")},
        {QStringLiteral("type"), QStringLiteral("http.response")},
        {QStringLiteral("requestID"), request.requestID},
        {QStringLiteral("idempotencyKey"), request.idempotencyKey},
        {QStringLiteral("requestDigest"), request.object.value(QStringLiteral("requestDigest"))},
        {QStringLiteral("target"), request.target},
        {QStringLiteral("status"), status},
      };
      QJsonObject responseHeaders;
      QString error;
      if (!headers(*reply, &responseHeaders, &error)) {
        reject(request,
               QStringLiteral("internal"),
               error.isEmpty() ? QStringLiteral("local Slopcode response headers are invalid") : boundedUtf8(error),
               true);
      } else {
        if (!responseHeaders.isEmpty()) {
          object.insert(QStringLiteral("headers"), responseHeaders);
        }
        if (!body.isEmpty()) {
          object.insert(QStringLiteral("body"), encode(body));
        }
        if (!session_.send(Frame(object), &error)) {
          reject(request,
                 QStringLiteral("internal"),
                 error.isEmpty() ? QStringLiteral("could not send local Slopcode response") : boundedUtf8(error),
                 true);
        }
      }
    }
  }
  finishing_.remove(reply);
  reply->deleteLater();
}

} // namespace slopcode::remoteqt
