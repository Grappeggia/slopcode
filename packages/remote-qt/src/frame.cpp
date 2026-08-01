#include <slopcode/remoteqt/frame.h>

#include <QCryptographicHash>
#include <QDateTime>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonParseError>
#include <QList>
#include <QMutexLocker>
#include <QRegularExpression>
#include <QSet>
#include <QStringList>

#include <algorithm>
#include <cmath>

namespace slopcode::remoteqt {
namespace {

constexpr int kMaxIdentifierBytes = 128;
constexpr int kMaxHeaderCount = 64;
constexpr int kMaxHeaderNameBytes = 128;
constexpr int kMaxHeaderValueBytes = 8 * 1024;
constexpr int kMaxMetadataEntries = 32;
constexpr int kMaxMetadataKeyBytes = 128;
constexpr int kMaxMetadataValueBytes = 2 * 1024;
constexpr int kMaxMetadataBytes = 16 * 1024;
constexpr int kMaxBodyBytes = 64 * 1024;
constexpr int kMaxChunkBytes = 64 * 1024;
constexpr qint64 kMaxStreamBytes = 16 * 1024 * 1024;
constexpr qint64 kMaxStreamWindowBytes = 256 * 1024;
constexpr int kMaxQueryBytes = 8 * 1024;
constexpr int kMaxArrayBytes = 128 * 1024;
constexpr int kMaxReplayBytes = 128 * 1024;
constexpr int kMaxPathBytes = 4 * 1024;
constexpr int kMaxEventNameBytes = 128;
constexpr int kMaxReplayEvents = 100;
constexpr int kMaxNotificationItems = 32;
constexpr int kMaxPtyArguments = 64;
constexpr int kMaxPtyArgumentBytes = 1024;

const QRegularExpression kRequestIDPattern(QStringLiteral(R"(^req_[A-Za-z0-9._:-]{1,124}$)"));
const QRegularExpression kIdempotencyPattern(QStringLiteral(R"(^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$)"));
const QRegularExpression kCursorPattern(QStringLiteral(R"(^cur_[A-Za-z0-9._:-]+$)"));
const QRegularExpression kHostIDPattern(QStringLiteral(R"(^hst_[A-Za-z0-9._:-]+$)"));
const QRegularExpression kPairingIDPattern(QStringLiteral(R"(^pair_[A-Za-z0-9._:-]+$)"));
const QRegularExpression kWorkspaceIDPattern(QStringLiteral(R"(^wrk)"));
const QRegularExpression kSessionIDPattern(QStringLiteral(R"(^ses_[A-Za-z0-9._:-]+$)"));
const QRegularExpression kPtyIDPattern(QStringLiteral(R"(^pty_[A-Za-z0-9._:-]+$)"));
const QRegularExpression kChallengeIDPattern(QStringLiteral(R"(^chl_[A-Za-z0-9._:-]+$)"));
const QRegularExpression kNotificationIDPattern(QStringLiteral(R"(^ntf_[A-Za-z0-9._:-]+$)"));
const QRegularExpression kEventNamePattern(QStringLiteral(R"(^[A-Za-z0-9][A-Za-z0-9._:-]*$)"));
const QRegularExpression kFieldNamePattern(QStringLiteral(R"(^[A-Za-z0-9][A-Za-z0-9._-]*$)"));
const QRegularExpression kHeaderNamePattern(QStringLiteral(R"(^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$)"));
const QRegularExpression kDigestPattern(QStringLiteral(R"(^[0-9a-f]{64}$)"));
const QRegularExpression kBase64Pattern(QStringLiteral(R"(^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$)"));
const QRegularExpression kBase64UrlPattern(QStringLiteral(R"(^[A-Za-z0-9_-]+$)"));
const QRegularExpression kInvalidPercentPattern(QStringLiteral(R"(%(?![0-9a-f]{2}))"),
                                                 QRegularExpression::CaseInsensitiveOption);
const QRegularExpression kSecretFieldPattern(
  QStringLiteral(R"((?:password|passphrase|private[-_]?key|api[-_]?key|secret|token|authorization|cookie|credential))"),
  QRegularExpression::CaseInsensitiveOption);

bool fail(QString *error, const QString &message)
{
  if (error != nullptr) {
    *error = message;
  }
  return false;
}

int utf8Bytes(const QString &value)
{
  return value.toUtf8().size();
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

bool hasControl(const QByteArray &value)
{
  for (const unsigned char byte : value) {
    if (byte <= 0x1f || (byte >= 0x7f && byte <= 0x9f)) {
      return true;
    }
  }
  return false;
}

bool prototypeKey(const QString &key)
{
  return key == QStringLiteral("__proto__") || key == QStringLiteral("constructor") ||
         key == QStringLiteral("prototype");
}

bool secretField(const QString &key)
{
  return kSecretFieldPattern.match(key).hasMatch();
}

bool validateString(const QJsonValue &value,
                    int maxBytes,
                    bool nonEmpty,
                    bool controls,
                    const QRegularExpression *pattern,
                    const QString &label,
                    QString *error)
{
  if (!value.isString()) {
    return fail(error, label + QStringLiteral(" must be a string"));
  }
  const QString text = value.toString();
  if ((nonEmpty && text.isEmpty()) || utf8Bytes(text) > maxBytes) {
    return fail(error, label + QStringLiteral(" is outside its size bounds"));
  }
  if (controls && hasControl(text)) {
    return fail(error, label + QStringLiteral(" contains control characters"));
  }
  if (pattern != nullptr && !pattern->match(text).hasMatch()) {
    return fail(error, label + QStringLiteral(" has an invalid format"));
  }
  return true;
}

bool requiredString(const QJsonObject &object,
                    const QString &key,
                    int maxBytes,
                    bool nonEmpty,
                    bool controls,
                    const QRegularExpression *pattern,
                    QString *error)
{
  if (!object.contains(key)) {
    return fail(error, QStringLiteral("missing required field: ") + key);
  }
  return validateString(object.value(key), maxBytes, nonEmpty, controls, pattern, key, error);
}

bool optionalString(const QJsonObject &object,
                    const QString &key,
                    int maxBytes,
                    bool nonEmpty,
                    bool controls,
                    const QRegularExpression *pattern,
                    QString *error)
{
  if (!object.contains(key)) {
    return true;
  }
  return validateString(object.value(key), maxBytes, nonEmpty, controls, pattern, key, error);
}

bool requiredLiteral(const QJsonObject &object, const QString &key, const QString &expected, QString *error)
{
  if (!requiredString(object, key, utf8Bytes(expected), true, false, nullptr, error)) {
    return false;
  }
  return object.value(key).toString() == expected
           ? true
           : fail(error, key + QStringLiteral(" has an unexpected value"));
}

bool requiredBool(const QJsonObject &object, const QString &key, QString *error)
{
  if (!object.contains(key) || !object.value(key).isBool()) {
    return fail(error, key + QStringLiteral(" must be a boolean"));
  }
  return true;
}

bool optionalBool(const QJsonObject &object, const QString &key, QString *error)
{
  if (!object.contains(key)) {
    return true;
  }
  return requiredBool(object, key, error);
}

bool integerValue(const QJsonValue &value, int minimum, qint64 maximum, const QString &label, QString *error)
{
  if (!value.isDouble()) {
    return fail(error, label + QStringLiteral(" must be an integer"));
  }
  const double number = value.toDouble();
  if (!std::isfinite(number) || std::floor(number) != number || number < minimum || number > maximum) {
    return fail(error, label + QStringLiteral(" is outside its numeric bounds"));
  }
  return true;
}

bool requiredInteger(const QJsonObject &object, const QString &key, int minimum, qint64 maximum, QString *error)
{
  if (!object.contains(key)) {
    return fail(error, QStringLiteral("missing required field: ") + key);
  }
  return integerValue(object.value(key), minimum, maximum, key, error);
}

bool optionalInteger(const QJsonObject &object, const QString &key, int minimum, qint64 maximum, QString *error)
{
  if (!object.contains(key)) {
    return true;
  }
  return integerValue(object.value(key), minimum, maximum, key, error);
}

bool exactKeys(const QJsonObject &object,
               const QSet<QString> &required,
               const QSet<QString> &allowed,
               QString *error)
{
  if (object.size() > kMaxObjectMembers) {
    return fail(error, QStringLiteral("object has too many members"));
  }
  for (const QString &key : object.keys()) {
    if (!allowed.contains(key)) {
      return fail(error, QStringLiteral("unknown frame field: ") + key);
    }
  }
  for (const QString &key : required) {
    if (!object.contains(key)) {
      return fail(error, QStringLiteral("missing required field: ") + key);
    }
  }
  return true;
}

bool isSafeAbsolutePath(const QString &value)
{
  if (value == QStringLiteral("/")) {
    return true;
  }
  if (!value.startsWith('/') || value.contains('\\') || value.contains(QChar::Null) || value.contains("//")) {
    return false;
  }
  const QStringList segments = value.mid(1).split('/', Qt::KeepEmptyParts);
  for (const QString &segment : segments) {
    if (segment.isEmpty() || segment == QStringLiteral(".") || segment == QStringLiteral("..")) {
      return false;
    }
  }
  return true;
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

bool isSafeHttpPath(const QString &value)
{
  if (value == QStringLiteral("/")) {
    return true;
  }
  if (!value.startsWith('/') || value.contains('\\') || value.contains(QChar::Null) || value.contains("//") ||
      value.contains('?') || value.contains('#') || value.contains(QChar::CarriageReturn) ||
      value.contains(QChar::LineFeed) || kInvalidPercentPattern.match(value).hasMatch()) {
    return false;
  }
  const std::optional<QString> decodedValue = decodePercent(value);
  if (!decodedValue.has_value()) return false;
  const QString &decoded = *decodedValue;
  if (decoded.contains('%') || hasControl(decoded) || decoded.contains('\\') || decoded.contains('?') || decoded.contains('#')) {
    return false;
  }
  const QStringList segments = decoded.mid(1).split('/', Qt::KeepEmptyParts);
  for (qsizetype index = 0; index < segments.size(); ++index) {
    const QString &segment = segments.at(index);
    if ((segment.isEmpty() && index != segments.size() - 1) || segment == QStringLiteral(".") ||
        segment == QStringLiteral("..")) {
      return false;
    }
  }
  return true;
}

bool validateRemoteDirectory(const QJsonValue &value, QString *error)
{
  if (!validateString(value, kMaxPathBytes, true, true, nullptr, QStringLiteral("remoteDirectory"), error)) {
    return false;
  }
  return isSafeAbsolutePath(value.toString())
           ? true
           : fail(error, QStringLiteral("remoteDirectory must be a normalized absolute POSIX path"));
}

bool validateHttpPath(const QJsonValue &value, QString *error)
{
  if (!validateString(value, kMaxPathBytes, true, false, nullptr, QStringLiteral("path"), error)) {
    return false;
  }
  return isSafeHttpPath(value.toString())
           ? true
           : fail(error, QStringLiteral("path must be a scoped absolute path without traversal"));
}

bool validateQuery(const QJsonValue &value, QString *error)
{
  if (!validateString(value, kMaxQueryBytes, false, true, nullptr, QStringLiteral("query"), error)) {
    return false;
  }
  const QString query = value.toString();
  if (query.contains('?') || query.contains('#') || query.contains('\\') || kInvalidPercentPattern.match(query).hasMatch()) {
    return fail(error, QStringLiteral("query contains unsafe URL encoding"));
  }
  const std::optional<QString> decoded = decodePercent(query);
  if (!decoded.has_value() || hasControl(*decoded) || decoded->contains('#')) {
    return fail(error, QStringLiteral("query contains unsafe decoded characters"));
  }
  return true;
}

bool validateHeaders(const QJsonValue &value, QString *error)
{
  if (!value.isObject()) {
    return fail(error, QStringLiteral("headers must be an object"));
  }
  const QJsonObject headers = value.toObject();
  if (headers.size() > kMaxHeaderCount) {
    return fail(error, QStringLiteral("too many HTTP headers"));
  }
  QSet<QString> names;
  int bytes = 0;
  static const QSet<QString> hopByHop{
    QStringLiteral("connection"), QStringLiteral("keep-alive"), QStringLiteral("proxy-authenticate"),
    QStringLiteral("proxy-authorization"), QStringLiteral("te"), QStringLiteral("trailer"),
    QStringLiteral("transfer-encoding"), QStringLiteral("upgrade"), QStringLiteral("host"),
    QStringLiteral("content-length"), QStringLiteral("proxy-connection"),
  };
  static const QSet<QString> forwarding{
    QStringLiteral("forward"), QStringLiteral("forwarded"), QStringLiteral("via"),
    QStringLiteral("x-client-ip"), QStringLiteral("x-cluster-client-ip"), QStringLiteral("x-forwarded-for"),
    QStringLiteral("x-forwarded-host"), QStringLiteral("x-forwarded-port"), QStringLiteral("x-forwarded-proto"),
    QStringLiteral("x-real-ip"), QStringLiteral("true-client-ip"), QStringLiteral("cf-connecting-ip"),
  };
  for (auto it = headers.cbegin(); it != headers.cend(); ++it) {
    const QString name = it.key();
    const QString normalized = name.toLower();
    if (prototypeKey(name) || !kHeaderNamePattern.match(name).hasMatch() || utf8Bytes(name) > kMaxHeaderNameBytes ||
        secretField(name) || hopByHop.contains(normalized) || forwarding.contains(normalized) ||
        normalized.startsWith(QStringLiteral("x-forwarded-")) || normalized.startsWith(QStringLiteral("sec-websocket-"))) {
      return fail(error, QStringLiteral("unsafe HTTP header"));
    }
    if (names.contains(normalized)) {
      return fail(error, QStringLiteral("duplicate HTTP header names are not allowed"));
    }
    names.insert(normalized);
    if (!it.value().isString()) {
      return fail(error, QStringLiteral("HTTP header values must be strings"));
    }
    const QString headerValue = it.value().toString();
    if (utf8Bytes(headerValue) > kMaxHeaderValueBytes || hasControl(headerValue)) {
      return fail(error, QStringLiteral("HTTP header value is invalid or too large"));
    }
    bytes += utf8Bytes(name) + utf8Bytes(headerValue);
  }
  return bytes <= kMaxHeaderCount * (kMaxHeaderNameBytes + kMaxHeaderValueBytes)
           ? true
           : fail(error, QStringLiteral("HTTP headers are too large"));
}

bool validateMetadata(const QJsonValue &value, QString *error)
{
  if (!value.isObject()) {
    return fail(error, QStringLiteral("metadata must be an object"));
  }
  const QJsonObject metadata = value.toObject();
  if (metadata.size() > kMaxMetadataEntries) {
    return fail(error, QStringLiteral("too many metadata entries"));
  }
  int bytes = 0;
  for (auto it = metadata.cbegin(); it != metadata.cend(); ++it) {
    if (prototypeKey(it.key()) || !kFieldNamePattern.match(it.key()).hasMatch() ||
        utf8Bytes(it.key()) > kMaxMetadataKeyBytes || secretField(it.key()) || !it.value().isString()) {
      return fail(error, QStringLiteral("unsafe transport metadata"));
    }
    const QString valueText = it.value().toString();
    if (utf8Bytes(valueText) > kMaxMetadataValueBytes || hasControl(valueText)) {
      return fail(error, QStringLiteral("invalid transport metadata value"));
    }
    bytes += utf8Bytes(it.key()) + utf8Bytes(valueText);
  }
  return bytes <= kMaxMetadataBytes ? true : fail(error, QStringLiteral("transport metadata is too large"));
}

int base64ByteLength(const QString &value)
{
  if (utf8Bytes(value) != value.size() || value.size() % 4 != 0 || !kBase64Pattern.match(value).hasMatch()) {
    return -1;
  }
  int padding = 0;
  if (value.endsWith(QStringLiteral("=="))) {
    padding = 2;
  } else if (value.endsWith('=')) {
    padding = 1;
  }
  return value.size() / 4 * 3 - padding;
}

bool validateBody(const QJsonValue &value, int maxBytes, const QString &label, QString *error)
{
  if (!value.isObject()) {
    return fail(error, label + QStringLiteral(" must be an object"));
  }
  const QJsonObject body = value.toObject();
  if (!exactKeys(body,
                 QSet<QString>{QStringLiteral("encoding"), QStringLiteral("data")},
                 QSet<QString>{QStringLiteral("encoding"), QStringLiteral("data")},
                 error)) {
    return false;
  }
  if (!requiredString(body, QStringLiteral("encoding"), 8, true, false, nullptr, error)) {
    return fail(error, label + QStringLiteral(" has an invalid encoding"));
  }
  const QString encoding = body.value(QStringLiteral("encoding")).toString();
  if (encoding == QStringLiteral("utf8")) {
    return validateString(body.value(QStringLiteral("data")), maxBytes, false, false, nullptr, label + QStringLiteral(" data"), error);
  }
  if (encoding != QStringLiteral("base64")) {
    return fail(error, label + QStringLiteral(" has an invalid encoding"));
  }
  if (!validateString(body.value(QStringLiteral("data")), ((maxBytes * 4 + 2) / 3) + 4, false, false, nullptr, label + QStringLiteral(" data"), error)) {
    return false;
  }
  const int decoded = base64ByteLength(body.value(QStringLiteral("data")).toString());
  return decoded >= 0 && decoded <= maxBytes
           ? true
           : fail(error, label + QStringLiteral(" base64 data is invalid or too large"));
}

bool optionalBody(const QJsonObject &object, const QString &key, int maxBytes, QString *error)
{
  return !object.contains(key) || validateBody(object.value(key), maxBytes, key, error);
}

bool optionalHeaders(const QJsonObject &object, QString *error)
{
  return !object.contains(QStringLiteral("headers")) || validateHeaders(object.value(QStringLiteral("headers")), error);
}

bool optionalMetadata(const QJsonObject &object, QString *error)
{
  return !object.contains(QStringLiteral("metadata")) || validateMetadata(object.value(QStringLiteral("metadata")), error);
}

bool validateStringArray(const QJsonValue &value,
                         int maxItems,
                         int maxBytes,
                         int itemMaxBytes,
                         bool nonEmpty,
                         bool controls,
                         const QString &label,
                         QString *error)
{
  if (!value.isArray()) {
    return fail(error, label + QStringLiteral(" must be an array"));
  }
  const QJsonArray array = value.toArray();
  if (array.size() > maxItems || QJsonDocument(array).toJson(QJsonDocument::Compact).size() > maxBytes) {
    return fail(error, label + QStringLiteral(" is too large"));
  }
  for (const QJsonValue &item : array) {
    if (!validateString(item, itemMaxBytes, nonEmpty, controls, nullptr, label + QStringLiteral(" item"), error)) {
      return false;
    }
  }
  return true;
}

bool optionalTarget(const QJsonObject &object, QString *error)
{
  if (!object.contains(QStringLiteral("target"))) {
    return true;
  }
  return object.value(QStringLiteral("target")).isObject() && validateTarget(object.value(QStringLiteral("target")).toObject(), error)
           ? true
           : fail(error, QStringLiteral("invalid target"));
}

bool sameTarget(const QJsonObject &left, const QJsonObject &right)
{
  return left.value(QStringLiteral("hostID")) == right.value(QStringLiteral("hostID")) &&
         left.value(QStringLiteral("pairingID")) == right.value(QStringLiteral("pairingID")) &&
         left.value(QStringLiteral("workspaceID")) == right.value(QStringLiteral("workspaceID")) &&
         left.value(QStringLiteral("remoteDirectory")) == right.value(QStringLiteral("remoteDirectory"));
}

bool validateRequestBase(const QJsonObject &object,
                         const QString &type,
                         const QSet<QString> &requiredExtra,
                         const QSet<QString> &optionalExtra,
                         QString *error)
{
  QSet<QString> required{
    QStringLiteral("version"), QStringLiteral("kind"), QStringLiteral("type"), QStringLiteral("requestID"),
    QStringLiteral("idempotencyKey"), QStringLiteral("requestDigest"), QStringLiteral("target"),
  };
  required.unite(requiredExtra);
  QSet<QString> allowed{
    QStringLiteral("version"), QStringLiteral("kind"), QStringLiteral("type"), QStringLiteral("requestID"),
    QStringLiteral("idempotencyKey"), QStringLiteral("requestDigest"), QStringLiteral("target"),
  };
  allowed.unite(requiredExtra);
  allowed.unite(optionalExtra);
  if (!exactKeys(object, required, allowed, error) || !requiredLiteral(object, QStringLiteral("version"), QStringLiteral("v1"), error) ||
      !requiredLiteral(object, QStringLiteral("kind"), QStringLiteral("request"), error) ||
      !requiredLiteral(object, QStringLiteral("type"), type, error) ||
      !requiredString(object, QStringLiteral("requestID"), kMaxIdentifierBytes, true, false, &kRequestIDPattern, error) ||
      !requiredString(object, QStringLiteral("idempotencyKey"), kMaxIdentifierBytes, true, false, &kIdempotencyPattern, error) ||
      !requiredString(object, QStringLiteral("requestDigest"), 64, true, false, &kDigestPattern, error) ||
      !object.value(QStringLiteral("target")).isObject() || !validateTarget(object.value(QStringLiteral("target")).toObject(), error)) {
    return false;
  }
  return true;
}

bool validateResponseBase(const QJsonObject &object,
                          const QString &type,
                          const QSet<QString> &requiredExtra,
                          const QSet<QString> &optionalExtra,
                          QString *error)
{
  QSet<QString> required{
    QStringLiteral("version"), QStringLiteral("kind"), QStringLiteral("type"), QStringLiteral("requestID"),
    QStringLiteral("idempotencyKey"), QStringLiteral("requestDigest"), QStringLiteral("target"),
  };
  required.unite(requiredExtra);
  QSet<QString> allowed{
    QStringLiteral("version"), QStringLiteral("kind"), QStringLiteral("type"), QStringLiteral("requestID"),
    QStringLiteral("idempotencyKey"), QStringLiteral("requestDigest"), QStringLiteral("target"),
  };
  allowed.unite(requiredExtra);
  allowed.unite(optionalExtra);
  if (!exactKeys(object, required, allowed, error) || !requiredLiteral(object, QStringLiteral("version"), QStringLiteral("v1"), error) ||
      !requiredLiteral(object, QStringLiteral("kind"), QStringLiteral("response"), error) ||
      !requiredLiteral(object, QStringLiteral("type"), type, error) ||
      !requiredString(object, QStringLiteral("requestID"), kMaxIdentifierBytes, true, false, &kRequestIDPattern, error) ||
      !requiredString(object, QStringLiteral("idempotencyKey"), kMaxIdentifierBytes, true, false, &kIdempotencyPattern, error) ||
      !requiredString(object, QStringLiteral("requestDigest"), 64, true, false, &kDigestPattern, error) ||
      !object.value(QStringLiteral("target")).isObject() || !validateTarget(object.value(QStringLiteral("target")).toObject(), error)) {
    return false;
  }
  return true;
}

bool validateStreamBase(const QJsonObject &object,
                        const QString &type,
                        QString *error)
{
  const QSet<QString> required{
    QStringLiteral("version"), QStringLiteral("kind"), QStringLiteral("type"), QStringLiteral("requestID"),
    QStringLiteral("idempotencyKey"), QStringLiteral("requestDigest"), QStringLiteral("target"),
    QStringLiteral("sequence"), QStringLiteral("chunk"), QStringLiteral("final"),
  };
  if (!exactKeys(object, required, required, error) || !requiredLiteral(object, QStringLiteral("version"), QStringLiteral("v1"), error) ||
      !requiredLiteral(object, QStringLiteral("kind"), QStringLiteral("stream"), error) ||
      !requiredLiteral(object, QStringLiteral("type"), type, error) ||
      !requiredString(object, QStringLiteral("requestID"), kMaxIdentifierBytes, true, false, &kRequestIDPattern, error) ||
      !requiredString(object, QStringLiteral("idempotencyKey"), kMaxIdentifierBytes, true, false, &kIdempotencyPattern, error) ||
      !requiredString(object, QStringLiteral("requestDigest"), 64, true, false, &kDigestPattern, error) ||
      !object.value(QStringLiteral("target")).isObject() || !validateTarget(object.value(QStringLiteral("target")).toObject(), error)) {
    return false;
  }
  return true;
}

bool validateEventBase(const QJsonObject &object,
                       const QString &type,
                       const QSet<QString> &requiredExtra,
                       const QSet<QString> &optionalExtra,
                       QString *error)
{
  QSet<QString> required{
    QStringLiteral("version"), QStringLiteral("kind"), QStringLiteral("type"), QStringLiteral("target"),
  };
  required.unite(requiredExtra);
  QSet<QString> allowed{
    QStringLiteral("version"), QStringLiteral("kind"), QStringLiteral("type"), QStringLiteral("target"),
    QStringLiteral("cursor"),
  };
  allowed.unite(requiredExtra);
  allowed.unite(optionalExtra);
  if (!exactKeys(object, required, allowed, error) || !requiredLiteral(object, QStringLiteral("version"), QStringLiteral("v1"), error) ||
      !requiredLiteral(object, QStringLiteral("kind"), QStringLiteral("event"), error) ||
      !requiredLiteral(object, QStringLiteral("type"), type, error) ||
      !object.value(QStringLiteral("target")).isObject() || !validateTarget(object.value(QStringLiteral("target")).toObject(), error) ||
      !optionalString(object, QStringLiteral("cursor"), kMaxIdentifierBytes, true, false, &kCursorPattern, error)) {
    return false;
  }
  return true;
}

bool validateBase64Url(const QJsonValue &value, int maxBytes, bool nonEmpty, const QString &label, QString *error);

bool validateChallenge(const QJsonValue &value, QString *error)
{
  if (!value.isObject()) {
    return fail(error, QStringLiteral("challenge must be an object"));
  }
  const QJsonObject challenge = value.toObject();
  if (!exactKeys(challenge,
                 QSet<QString>{QStringLiteral("issuer"), QStringLiteral("id"), QStringLiteral("nonce"), QStringLiteral("issuedAt"),
                               QStringLiteral("expiresAt"), QStringLiteral("oneTime")},
                 QSet<QString>{QStringLiteral("issuer"), QStringLiteral("id"), QStringLiteral("nonce"), QStringLiteral("issuedAt"),
                               QStringLiteral("expiresAt"), QStringLiteral("oneTime")},
                 error) ||
      !requiredLiteral(challenge, QStringLiteral("issuer"), QStringLiteral("server"), error) ||
      !requiredString(challenge, QStringLiteral("id"), kMaxIdentifierBytes, true, false, &kChallengeIDPattern, error) ||
      !validateBase64Url(challenge.value(QStringLiteral("nonce")), 512, true, QStringLiteral("nonce"), error) ||
      challenge.value(QStringLiteral("nonce")).toString().size() < 16 ||
      !requiredInteger(challenge, QStringLiteral("issuedAt"), 0, 9'999'999'999'999LL, error) ||
      !requiredInteger(challenge, QStringLiteral("expiresAt"), 0, 9'999'999'999'999LL, error) ||
      !requiredBool(challenge, QStringLiteral("oneTime"), error) || !challenge.value(QStringLiteral("oneTime")).toBool()) {
    return false;
  }
  const qint64 issued = challenge.value(QStringLiteral("issuedAt")).toInteger();
  const qint64 expires = challenge.value(QStringLiteral("expiresAt")).toInteger();
  return expires > issued && expires - issued <= 5 * 60 * 1000
           ? true
           : fail(error, QStringLiteral("challenge must expire within five minutes and after issuance"));
}

bool validateBase64Url(const QJsonValue &value, int maxBytes, bool nonEmpty, const QString &label, QString *error)
{
  return validateString(value, maxBytes, nonEmpty, true, &kBase64UrlPattern, label, error);
}

bool validateSignature(const QJsonValue &value, QString *error)
{
  if (!validateBase64Url(value, 512, true, QStringLiteral("signature"), error)) {
    return false;
  }
  const QByteArray encoded = value.toString().toLatin1();
  QByteArray padded = encoded;
  padded.append(QByteArray((4 - (padded.size() % 4)) % 4, '='));
  const QByteArray decoded = QByteArray::fromBase64(padded, QByteArray::Base64UrlEncoding);
  const QByteArray canonical = decoded.toBase64(QByteArray::Base64UrlEncoding | QByteArray::OmitTrailingEquals);
  return canonical == encoded && decoded.size() == 64 && encoded.size() == 86
           ? true
           : fail(error, QStringLiteral("Ed25519 signatures must be exactly 64 bytes of unpadded base64url"));
}

bool validateFeatureList(const QJsonValue &value, bool requireAll, const QString &label, QString *error)
{
  if (!value.isArray()) {
    return fail(error, label + QStringLiteral(" must be an array"));
  }
  const QJsonArray features = value.toArray();
  if (features.size() > 3 || QJsonDocument(features).toJson(QJsonDocument::Compact).size() > kMaxArrayBytes) {
    return fail(error, label + QStringLiteral(" is too large"));
  }
  const QSet<QString> required{
    QStringLiteral("proof.ed25519.v1"), QStringLiteral("frame.bounds.v1"), QStringLiteral("http.upload.v1"),
  };
  QSet<QString> seen;
  for (const QJsonValue &feature : features) {
    if (!feature.isString() || !required.contains(feature.toString()) || seen.contains(feature.toString())) {
      return fail(error, label + QStringLiteral(" contains an unsupported or duplicate feature"));
    }
    seen.insert(feature.toString());
  }
  if (requireAll && seen != required) {
    return fail(error, label + QStringLiteral(" must contain every strict v1 feature"));
  }
  return true;
}

bool canonicalJsonValue(const QJsonValue &value, QByteArray *output, bool arrayItem, QString *error)
{
  if (value.isUndefined()) {
    if (arrayItem) {
      *output = QByteArrayLiteral("null");
      return true;
    }
    return false;
  }
  if (value.isObject()) {
    const QJsonObject object = value.toObject();
    QList<QString> keys = object.keys();
    std::sort(keys.begin(), keys.end(), [](const QString &left, const QString &right) {
      return left.toUtf8() < right.toUtf8();
    });
    QByteArray encoded = QByteArrayLiteral("{");
    bool first = true;
    for (const QString &key : keys) {
      const QJsonValue item = object.value(key);
      if (item.isUndefined()) {
        continue;
      }
      QJsonArray keyArray;
      keyArray.append(key);
      const QByteArray keyJson = QJsonDocument(keyArray).toJson(QJsonDocument::Compact);
      if (keyJson.size() < 2) {
        return fail(error, QStringLiteral("could not canonicalize JSON object key"));
      }
      if (!first) {
        encoded.append(',');
      }
      first = false;
      encoded.append(keyJson.mid(1, keyJson.size() - 2));
      encoded.append(':');
      QByteArray valueJson;
      if (!canonicalJsonValue(item, &valueJson, false, error)) {
        return false;
      }
      encoded.append(valueJson);
    }
    encoded.append('}');
    *output = encoded;
    return true;
  }
  if (value.isArray()) {
    QByteArray encoded = QByteArrayLiteral("[");
    const QJsonArray array = value.toArray();
    for (qsizetype index = 0; index < array.size(); ++index) {
      if (index != 0) {
        encoded.append(',');
      }
      QByteArray item;
      if (!canonicalJsonValue(array.at(index), &item, true, error)) {
        return false;
      }
      encoded.append(item);
    }
    encoded.append(']');
    *output = encoded;
    return true;
  }

  QJsonArray scalar;
  scalar.append(value);
  const QByteArray json = QJsonDocument(scalar).toJson(QJsonDocument::Compact);
  if (json.size() < 2 || json.front() != '[' || json.back() != ']') {
    return fail(error, QStringLiteral("could not canonicalize JSON value"));
  }
  *output = json.mid(1, json.size() - 2);
  return true;
}

std::optional<QString> digestJson(const QJsonValue &value, QString *error)
{
  QByteArray canonical;
  if (!canonicalJsonValue(value, &canonical, false, error)) {
    return std::nullopt;
  }
  return QString::fromLatin1(QCryptographicHash::hash(canonical, QCryptographicHash::Sha256).toHex());
}

QString idempotencyBindingKey(const QString &sessionID, const QJsonObject &target, const QString &idempotencyKey)
{
  QJsonObject binding{
    {QStringLiteral("idempotencyKey"), idempotencyKey},
    {QStringLiteral("sessionID"), sessionID},
    {QStringLiteral("target"), target},
  };
  QByteArray canonical;
  QString ignored;
  canonicalJsonValue(binding, &canonical, false, &ignored);
  return QString::fromUtf8(canonical);
}

bool validateCapabilities(const QJsonValue &value, QString *error)
{
  if (!value.isObject()) {
    return fail(error, QStringLiteral("capabilities must be an object"));
  }
  const QJsonObject capabilities = value.toObject();
  if (!exactKeys(capabilities,
                 QSet<QString>{QStringLiteral("offered"), QStringLiteral("required")},
                 QSet<QString>{QStringLiteral("offered"), QStringLiteral("required")},
                 error) ||
      !validateFeatureList(capabilities.value(QStringLiteral("offered")), true, QStringLiteral("offered capabilities"), error) ||
      !validateFeatureList(capabilities.value(QStringLiteral("required")), true, QStringLiteral("required capabilities"), error)) {
    return false;
  }
  return true;
}

bool validateAcceptedCapabilities(const QJsonValue &value, QString *error)
{
  if (!value.isObject()) {
    return fail(error, QStringLiteral("accepted capabilities must be an object"));
  }
  const QJsonObject capabilities = value.toObject();
  return exactKeys(capabilities,
                   QSet<QString>{QStringLiteral("accepted")},
                   QSet<QString>{QStringLiteral("accepted")},
                   error) &&
         validateFeatureList(capabilities.value(QStringLiteral("accepted")), true, QStringLiteral("accepted capabilities"), error);
}

bool validateProof(const QJsonValue &value, QString *error)
{
  if (!value.isObject()) {
    return fail(error, QStringLiteral("proof must be an object"));
  }
  const QJsonObject proof = value.toObject();
  return exactKeys(proof,
                   QSet<QString>{QStringLiteral("algorithm"), QStringLiteral("encoding"), QStringLiteral("signature")},
                   QSet<QString>{QStringLiteral("algorithm"), QStringLiteral("encoding"), QStringLiteral("signature")},
                   error) &&
         requiredLiteral(proof, QStringLiteral("algorithm"), QStringLiteral("ed25519"), error) &&
         requiredLiteral(proof, QStringLiteral("encoding"), QStringLiteral("base64url"), error) &&
         validateSignature(proof.value(QStringLiteral("signature")), error);
}

bool validateAuth(const QJsonObject &object, QString *error)
{
  if (!object.value(QStringLiteral("auth")).isObject()) {
    return fail(error, QStringLiteral("auth must be an object"));
  }
  const QJsonObject auth = object.value(QStringLiteral("auth")).toObject();
  if (!exactKeys(auth,
                 QSet<QString>{QStringLiteral("method"), QStringLiteral("pairingID"), QStringLiteral("target"),
                               QStringLiteral("targetDigest"), QStringLiteral("challenge"), QStringLiteral("proof")},
                 QSet<QString>{QStringLiteral("method"), QStringLiteral("pairingID"), QStringLiteral("target"),
                               QStringLiteral("targetDigest"), QStringLiteral("challenge"), QStringLiteral("proof")},
                 error) ||
      !requiredLiteral(auth, QStringLiteral("method"), QStringLiteral("pairing-signature"), error) ||
      !requiredString(auth, QStringLiteral("pairingID"), kMaxIdentifierBytes, true, false, &kPairingIDPattern, error) ||
      !auth.value(QStringLiteral("target")).isObject() || !validateTarget(auth.value(QStringLiteral("target")).toObject(), error) ||
      !requiredString(auth, QStringLiteral("targetDigest"), 64, true, false, &kDigestPattern, error) ||
      !validateChallenge(auth.value(QStringLiteral("challenge")), error) || !validateProof(auth.value(QStringLiteral("proof")), error)) {
    return false;
  }
  const QJsonObject target = object.value(QStringLiteral("target")).toObject();
  return auth.value(QStringLiteral("pairingID")).toString() == target.value(QStringLiteral("pairingID")).toString() &&
                 sameTarget(auth.value(QStringLiteral("target")).toObject(), target)
           ? true
           : fail(error, QStringLiteral("session auth target is outside request scope"));
}

bool validateQuestionOption(const QJsonValue &value, QString *error)
{
  if (!value.isObject()) {
    return fail(error, QStringLiteral("question option must be an object"));
  }
  const QJsonObject option = value.toObject();
  return exactKeys(option,
                   QSet<QString>{QStringLiteral("label"), QStringLiteral("value")},
                   QSet<QString>{QStringLiteral("label"), QStringLiteral("value")},
                   error) &&
         requiredString(option, QStringLiteral("label"), 256, true, false, nullptr, error) &&
         requiredString(option, QStringLiteral("value"), 256, true, false, nullptr, error);
}

bool validateQuestionPrompt(const QJsonValue &value, QString *error)
{
  if (!value.isObject()) {
    return fail(error, QStringLiteral("question prompt must be an object"));
  }
  const QJsonObject prompt = value.toObject();
  if (!exactKeys(prompt,
                 QSet<QString>{QStringLiteral("question"), QStringLiteral("options"), QStringLiteral("multiple")},
                 QSet<QString>{QStringLiteral("question"), QStringLiteral("header"), QStringLiteral("options"),
                               QStringLiteral("multiple")},
                 error) ||
      !requiredString(prompt, QStringLiteral("question"), 2 * 1024, true, false, nullptr, error) ||
      !optionalString(prompt, QStringLiteral("header"), 128, true, false, nullptr, error) ||
      !requiredBool(prompt, QStringLiteral("multiple"), error) || !prompt.value(QStringLiteral("options")).isArray()) {
    return false;
  }
  const QJsonArray options = prompt.value(QStringLiteral("options")).toArray();
  if (options.size() > 16 || QJsonDocument(options).toJson(QJsonDocument::Compact).size() > kMaxArrayBytes) {
    return fail(error, QStringLiteral("question options are too large"));
  }
  for (const QJsonValue &option : options) {
    if (!validateQuestionOption(option, error)) {
      return false;
    }
  }
  return true;
}

bool validateSseEvent(const QJsonObject &object, const QJsonObject *expectedTarget, QString *error)
{
  if (!validateEventBase(object,
                         QStringLiteral("event"),
                         QSet<QString>{QStringLiteral("cursor"), QStringLiteral("event"), QStringLiteral("data")},
                         QSet<QString>{QStringLiteral("replayed"), QStringLiteral("metadata")},
                         error) ||
      !requiredString(object, QStringLiteral("cursor"), kMaxIdentifierBytes, true, false, &kCursorPattern, error) ||
      !requiredString(object, QStringLiteral("event"), kMaxEventNameBytes, true, false, &kEventNamePattern, error) ||
      !validateBody(object.value(QStringLiteral("data")), kMaxChunkBytes, QStringLiteral("data"), error) ||
      !optionalBool(object, QStringLiteral("replayed"), error) || !optionalMetadata(object, error)) {
    return false;
  }
  return expectedTarget == nullptr || sameTarget(object.value(QStringLiteral("target")).toObject(), *expectedTarget)
           ? true
           : fail(error, QStringLiteral("replayed event target is outside response scope"));
}

bool validateFrameObject(const QJsonObject &object, Frame *frame, QString *error)
{
  if (object.size() > kMaxObjectMembers || !object.contains(QStringLiteral("type")) ||
      !object.value(QStringLiteral("type")).isString()) {
    return fail(error, QStringLiteral("invalid RemoteV1 frame envelope"));
  }
  const auto kind = frameKindFromName(object.value(QStringLiteral("kind")).toString());
  if (!kind.has_value()) {
    return fail(error, QStringLiteral("unknown RemoteV1 frame kind"));
  }
  const QString type = object.value(QStringLiteral("type")).toString();
  bool valid = false;

  if (type == QStringLiteral("session.open")) {
    valid = validateRequestBase(object, type, QSet<QString>{QStringLiteral("capabilities"), QStringLiteral("auth")}, {}, error) &&
            validateCapabilities(object.value(QStringLiteral("capabilities")), error) && validateAuth(object, error);
  } else if (type == QStringLiteral("session.close")) {
    valid = validateRequestBase(object, type, QSet<QString>{QStringLiteral("sessionID")}, QSet<QString>{QStringLiteral("reason")}, error) &&
            requiredString(object, QStringLiteral("sessionID"), kMaxIdentifierBytes, true, false, &kSessionIDPattern, error) &&
            optionalString(object, QStringLiteral("reason"), 2 * 1024, true, false, nullptr, error);
  } else if (type == QStringLiteral("http.upload")) {
    valid = validateRequestBase(object,
                                type,
                                QSet<QString>{QStringLiteral("method"), QStringLiteral("path"), QStringLiteral("contentLength")},
                                QSet<QString>{QStringLiteral("query"), QStringLiteral("headers")},
                                error) &&
            requiredString(object, QStringLiteral("method"), 7, true, false, nullptr, error) &&
            QSet<QString>{QStringLiteral("GET"), QStringLiteral("HEAD"), QStringLiteral("POST"), QStringLiteral("PUT"),
                          QStringLiteral("PATCH"), QStringLiteral("DELETE"), QStringLiteral("OPTIONS")}
                .contains(object.value(QStringLiteral("method")).toString()) &&
            validateHttpPath(object.value(QStringLiteral("path")), error) &&
            (!object.contains(QStringLiteral("query")) || validateQuery(object.value(QStringLiteral("query")), error)) &&
            optionalHeaders(object, error) && requiredInteger(object, QStringLiteral("contentLength"), 0, kMaxStreamBytes, error);
  } else if (type == QStringLiteral("http.request")) {
    valid = validateRequestBase(object,
                                type,
                                QSet<QString>{QStringLiteral("method"), QStringLiteral("path")},
                                QSet<QString>{QStringLiteral("query"), QStringLiteral("headers"), QStringLiteral("body")},
                                error) &&
            requiredString(object, QStringLiteral("method"), 7, true, false, nullptr, error) &&
            QSet<QString>{QStringLiteral("GET"), QStringLiteral("HEAD"), QStringLiteral("POST"), QStringLiteral("PUT"),
                          QStringLiteral("PATCH"), QStringLiteral("DELETE"), QStringLiteral("OPTIONS")}
                .contains(object.value(QStringLiteral("method")).toString()) &&
            validateHttpPath(object.value(QStringLiteral("path")), error) &&
            (!object.contains(QStringLiteral("query")) || validateQuery(object.value(QStringLiteral("query")), error)) &&
            optionalHeaders(object, error) && optionalBody(object, QStringLiteral("body"), kMaxBodyBytes, error);
    if (!valid && type == QStringLiteral("http.request") && object.value(QStringLiteral("method")).isString() &&
        !QSet<QString>{QStringLiteral("GET"), QStringLiteral("HEAD"), QStringLiteral("POST"), QStringLiteral("PUT"),
                       QStringLiteral("PATCH"), QStringLiteral("DELETE"), QStringLiteral("OPTIONS")}
          .contains(object.value(QStringLiteral("method")).toString())) {
      valid = fail(error, QStringLiteral("unsupported HTTP method"));
    }
  } else if (type == QStringLiteral("http.response")) {
    valid = validateResponseBase(object, type, QSet<QString>{QStringLiteral("status")}, QSet<QString>{QStringLiteral("headers"), QStringLiteral("body")}, error) &&
            requiredInteger(object, QStringLiteral("status"), 100, 599, error) && optionalHeaders(object, error) &&
            optionalBody(object, QStringLiteral("body"), kMaxBodyBytes, error);
  } else if (type == QStringLiteral("http.chunk") || type == QStringLiteral("http.upload.chunk")) {
    valid = validateStreamBase(object, type, error) && requiredInteger(object, QStringLiteral("sequence"), 0, 1'000'000, error) &&
            validateBody(object.value(QStringLiteral("chunk")), kMaxChunkBytes, QStringLiteral("chunk"), error) &&
            requiredBool(object, QStringLiteral("final"), error);
  } else if (type == QStringLiteral("event.replay") && *kind == FrameKind::Response) {
    valid = validateResponseBase(object, type, QSet<QString>{QStringLiteral("events"), QStringLiteral("hasMore")},
                                 QSet<QString>{QStringLiteral("nextCursor")}, error) &&
            optionalString(object, QStringLiteral("nextCursor"), kMaxIdentifierBytes, true, false, &kCursorPattern, error) &&
            requiredBool(object, QStringLiteral("hasMore"), error) && object.value(QStringLiteral("events")).isArray();
    if (valid) {
      const QJsonArray events = object.value(QStringLiteral("events")).toArray();
      valid = events.size() <= kMaxReplayEvents && QJsonDocument(events).toJson(QJsonDocument::Compact).size() <= kMaxReplayBytes;
      const QJsonObject responseTarget = object.value(QStringLiteral("target")).toObject();
      int bodyBytes = 0;
      QSet<QString> cursors;
      for (const QJsonValue &event : events) {
        valid = valid && event.isObject() && validateSseEvent(event.toObject(), &responseTarget, error);
        if (valid) {
          const QJsonObject eventObject = event.toObject();
          const QString cursor = eventObject.value(QStringLiteral("cursor")).toString();
          if (cursors.contains(cursor)) {
            valid = fail(error, QStringLiteral("replayed event cursors must be unique"));
            break;
          }
          cursors.insert(cursor);
          const QJsonObject data = eventObject.value(QStringLiteral("data")).toObject();
          const QString encoding = data.value(QStringLiteral("encoding")).toString();
          const QString text = data.value(QStringLiteral("data")).toString();
          const int decoded = encoding == QStringLiteral("base64") ? base64ByteLength(text) : utf8Bytes(text);
          bodyBytes += decoded;
        }
      }
      if (valid && object.contains(QStringLiteral("nextCursor")) &&
          cursors.contains(object.value(QStringLiteral("nextCursor")).toString())) {
        valid = fail(error, QStringLiteral("nextCursor must not duplicate a replayed event cursor"));
      }
      valid = valid && bodyBytes <= kMaxReplayBytes;
    }
  } else if (type == QStringLiteral("event.replay")) {
    valid = validateRequestBase(object, type, QSet<QString>{QStringLiteral("limit")}, QSet<QString>{QStringLiteral("cursor")}, error) &&
            optionalString(object, QStringLiteral("cursor"), kMaxIdentifierBytes, true, false, &kCursorPattern, error) &&
            requiredInteger(object, QStringLiteral("limit"), 1, kMaxReplayEvents, error);
  } else if (type == QStringLiteral("event")) {
    valid = validateSseEvent(object, nullptr, error);
  } else if (type == QStringLiteral("pty.open")) {
    valid = validateRequestBase(object,
                                type,
                                QSet<QString>{QStringLiteral("rows"), QStringLiteral("cols")},
                                QSet<QString>{QStringLiteral("ptyID"), QStringLiteral("command"), QStringLiteral("args"),
                                               QStringLiteral("cwd")},
                                error) &&
            optionalString(object, QStringLiteral("ptyID"), kMaxIdentifierBytes, true, false, &kPtyIDPattern, error) &&
            optionalString(object, QStringLiteral("command"), 2 * 1024, true, true, nullptr, error) &&
            (!object.contains(QStringLiteral("args")) ||
             validateStringArray(object.value(QStringLiteral("args")), kMaxPtyArguments, kMaxArrayBytes, kMaxPtyArgumentBytes, false, true,
                                 QStringLiteral("args"), error)) &&
            (!object.contains(QStringLiteral("cwd")) ||
             (validateRemoteDirectory(object.value(QStringLiteral("cwd")), error) &&
              (object.value(QStringLiteral("cwd")).toString() == object.value(QStringLiteral("target")).toObject().value(QStringLiteral("remoteDirectory")).toString() ||
               object.value(QStringLiteral("target")).toObject().value(QStringLiteral("remoteDirectory")).toString() == QStringLiteral("/") ||
               object.value(QStringLiteral("cwd")).toString().startsWith(object.value(QStringLiteral("target")).toObject().value(QStringLiteral("remoteDirectory")).toString() + QStringLiteral("/"))))) &&
            requiredInteger(object, QStringLiteral("rows"), 1, 500, error) && requiredInteger(object, QStringLiteral("cols"), 1, 500, error);
  } else if (type == QStringLiteral("pty.opened")) {
    valid = validateResponseBase(object, type, QSet<QString>{QStringLiteral("ptyID"), QStringLiteral("rows"), QStringLiteral("cols")}, {}, error) &&
            requiredString(object, QStringLiteral("ptyID"), kMaxIdentifierBytes, true, false, &kPtyIDPattern, error) &&
            requiredInteger(object, QStringLiteral("rows"), 1, 500, error) && requiredInteger(object, QStringLiteral("cols"), 1, 500, error);
  } else if (type == QStringLiteral("pty.input")) {
    valid = validateRequestBase(object, type, QSet<QString>{QStringLiteral("ptyID"), QStringLiteral("chunk")}, {}, error) &&
            requiredString(object, QStringLiteral("ptyID"), kMaxIdentifierBytes, true, false, &kPtyIDPattern, error) &&
            validateBody(object.value(QStringLiteral("chunk")), kMaxChunkBytes, QStringLiteral("chunk"), error);
  } else if (type == QStringLiteral("pty.resize")) {
    valid = validateRequestBase(object, type, QSet<QString>{QStringLiteral("ptyID"), QStringLiteral("rows"), QStringLiteral("cols")}, {}, error) &&
            requiredString(object, QStringLiteral("ptyID"), kMaxIdentifierBytes, true, false, &kPtyIDPattern, error) &&
            requiredInteger(object, QStringLiteral("rows"), 1, 500, error) && requiredInteger(object, QStringLiteral("cols"), 1, 500, error);
  } else if (type == QStringLiteral("pty.output")) {
    valid = validateStreamBase(object, type, error) && requiredString(object, QStringLiteral("ptyID"), kMaxIdentifierBytes, true, false, &kPtyIDPattern, error) &&
            requiredInteger(object, QStringLiteral("sequence"), 0, 1'000'000, error) &&
            validateBody(object.value(QStringLiteral("chunk")), kMaxChunkBytes, QStringLiteral("chunk"), error) &&
            requiredBool(object, QStringLiteral("final"), error);
  } else if (type == QStringLiteral("pty.close")) {
    valid = validateRequestBase(object, type, QSet<QString>{QStringLiteral("ptyID")}, {}, error) &&
            requiredString(object, QStringLiteral("ptyID"), kMaxIdentifierBytes, true, false, &kPtyIDPattern, error);
  } else if (type == QStringLiteral("pty.closed")) {
    valid = validateResponseBase(object, type, QSet<QString>{QStringLiteral("ptyID")}, QSet<QString>{QStringLiteral("exitCode")}, error) &&
            requiredString(object, QStringLiteral("ptyID"), kMaxIdentifierBytes, true, false, &kPtyIDPattern, error) &&
            optionalInteger(object, QStringLiteral("exitCode"), 0, 255, error);
  } else if (type == QStringLiteral("approval.request")) {
    valid = validateEventBase(object, type, QSet<QString>{QStringLiteral("notificationID"), QStringLiteral("action"), QStringLiteral("resources"), QStringLiteral("reason")},
                              QSet<QString>{QStringLiteral("requestID"), QStringLiteral("metadata")}, error) &&
            requiredString(object, QStringLiteral("notificationID"), kMaxIdentifierBytes, true, false, &kNotificationIDPattern, error) &&
            optionalString(object, QStringLiteral("requestID"), kMaxIdentifierBytes, true, false, &kRequestIDPattern, error) &&
            requiredString(object, QStringLiteral("action"), 512, true, false, nullptr, error) &&
            validateStringArray(object.value(QStringLiteral("resources")), kMaxNotificationItems, kMaxArrayBytes, 2 * 1024, true, false,
                                QStringLiteral("resources"), error) &&
            requiredString(object, QStringLiteral("reason"), 2 * 1024, true, false, nullptr, error) && optionalMetadata(object, error);
  } else if (type == QStringLiteral("question.request")) {
    valid = validateEventBase(object, type, QSet<QString>{QStringLiteral("notificationID"), QStringLiteral("questions")},
                              QSet<QString>{QStringLiteral("requestID"), QStringLiteral("metadata")}, error) &&
            requiredString(object, QStringLiteral("notificationID"), kMaxIdentifierBytes, true, false, &kNotificationIDPattern, error) &&
            optionalString(object, QStringLiteral("requestID"), kMaxIdentifierBytes, true, false, &kRequestIDPattern, error) &&
            object.value(QStringLiteral("questions")).isArray();
    if (valid) {
      const QJsonArray questions = object.value(QStringLiteral("questions")).toArray();
      valid = questions.size() <= 8 && QJsonDocument(questions).toJson(QJsonDocument::Compact).size() <= kMaxArrayBytes;
      for (const QJsonValue &question : questions) {
        valid = valid && validateQuestionPrompt(question, error);
      }
      valid = valid && optionalMetadata(object, error);
    }
  } else if (type == QStringLiteral("approval.reply")) {
    valid = validateRequestBase(object, type, QSet<QString>{QStringLiteral("notificationID"), QStringLiteral("reply")}, {}, error) &&
            requiredString(object, QStringLiteral("notificationID"), kMaxIdentifierBytes, true, false, &kNotificationIDPattern, error) &&
            requiredString(object, QStringLiteral("reply"), 7, true, false, nullptr, error) &&
            QSet<QString>{QStringLiteral("once"), QStringLiteral("always"), QStringLiteral("reject")}.contains(object.value(QStringLiteral("reply")).toString());
  } else if (type == QStringLiteral("question.reply")) {
    valid = validateRequestBase(object, type, QSet<QString>{QStringLiteral("notificationID"), QStringLiteral("answers")}, {}, error) &&
            requiredString(object, QStringLiteral("notificationID"), kMaxIdentifierBytes, true, false, &kNotificationIDPattern, error) &&
            object.value(QStringLiteral("answers")).isArray();
    if (valid) {
      const QJsonArray answers = object.value(QStringLiteral("answers")).toArray();
      valid = answers.size() <= 8 && QJsonDocument(answers).toJson(QJsonDocument::Compact).size() <= kMaxArrayBytes;
      for (const QJsonValue &answer : answers) {
        valid = valid && validateStringArray(answer, 16, kMaxArrayBytes, 2 * 1024, true, false, QStringLiteral("answers"), error);
      }
    }
  } else if (type == QStringLiteral("question.reject")) {
    valid = validateRequestBase(object, type, QSet<QString>{QStringLiteral("notificationID")}, {}, error) &&
            requiredString(object, QStringLiteral("notificationID"), kMaxIdentifierBytes, true, false, &kNotificationIDPattern, error);
  } else if (type == QStringLiteral("session.opened")) {
    valid = validateResponseBase(object, type, QSet<QString>{QStringLiteral("sessionID"), QStringLiteral("capabilities")}, {}, error) &&
            requiredString(object, QStringLiteral("sessionID"), kMaxIdentifierBytes, true, false, &kSessionIDPattern, error) &&
            validateAcceptedCapabilities(object.value(QStringLiteral("capabilities")), error);
  } else if (type == QStringLiteral("session.closed")) {
    valid = validateResponseBase(object, type, QSet<QString>{QStringLiteral("sessionID")}, {}, error) &&
            requiredString(object, QStringLiteral("sessionID"), kMaxIdentifierBytes, true, false, &kSessionIDPattern, error);
  } else if (type == QStringLiteral("error")) {
    const QSet<QString> allowed{
      QStringLiteral("version"), QStringLiteral("kind"), QStringLiteral("type"), QStringLiteral("requestID"),
      QStringLiteral("idempotencyKey"), QStringLiteral("requestDigest"), QStringLiteral("target"), QStringLiteral("code"),
      QStringLiteral("message"), QStringLiteral("retryable"), QStringLiteral("details"),
    };
    if (exactKeys(object, {}, allowed, error) && requiredLiteral(object, QStringLiteral("version"), QStringLiteral("v1"), error) &&
        requiredLiteral(object, QStringLiteral("kind"), QStringLiteral("error"), error) && requiredLiteral(object, QStringLiteral("type"), QStringLiteral("error"), error) &&
        optionalString(object, QStringLiteral("requestID"), kMaxIdentifierBytes, true, false, &kRequestIDPattern, error) &&
        optionalString(object, QStringLiteral("idempotencyKey"), kMaxIdentifierBytes, true, false, &kIdempotencyPattern, error) &&
        optionalString(object, QStringLiteral("requestDigest"), 64, true, false, &kDigestPattern, error) && optionalTarget(object, error) &&
        requiredString(object, QStringLiteral("code"), 32, true, false, nullptr, error) &&
        QSet<QString>{QStringLiteral("bad_request"), QStringLiteral("unauthorized"), QStringLiteral("forbidden"), QStringLiteral("out_of_scope"),
                      QStringLiteral("not_found"), QStringLiteral("conflict"), QStringLiteral("too_large"), QStringLiteral("unsupported"),
                      QStringLiteral("cancelled"), QStringLiteral("timeout"), QStringLiteral("rate_limited"), QStringLiteral("internal")}
          .contains(object.value(QStringLiteral("code")).toString()) &&
        requiredString(object, QStringLiteral("message"), 2 * 1024, true, false, nullptr, error) &&
        requiredBool(object, QStringLiteral("retryable"), error) &&
        (!object.contains(QStringLiteral("details")) || validateMetadata(object.value(QStringLiteral("details")), error))) {
      valid = true;
      if (object.contains(QStringLiteral("requestID")) &&
          (!object.contains(QStringLiteral("idempotencyKey")) || !object.contains(QStringLiteral("requestDigest")) ||
           !object.contains(QStringLiteral("target")))) {
        valid = fail(error, QStringLiteral("request errors must echo idempotency, digest, and target"));
      }
    }
  }

  if (!valid) {
    if (error == nullptr || error->isEmpty()) {
      fail(error, QStringLiteral("unsupported or invalid RemoteV1 frame shape"));
    }
    return false;
  }

  if (frame != nullptr) {
    frame->object = object;
    frame->version = object.value(QStringLiteral("version")).toString();
    frame->kind = *kind;
    frame->type = type;
    frame->requestID = object.value(QStringLiteral("requestID")).toString();
    frame->idempotencyKey = object.value(QStringLiteral("idempotencyKey")).toString();
    frame->target = object.value(QStringLiteral("target")).toObject();
  }
  return true;
}

class JsonKeyScanner final {
public:
  explicit JsonKeyScanner(const QByteArray &input)
    : input_(input)
  {
  }

  bool run(QString *error)
  {
    skipSpace();
    if (!value()) {
      if (duplicate_) return fail(error, QStringLiteral("duplicate JSON object key"));
      if (depthExceeded_) return fail(error, QStringLiteral("JSON nesting is too deep"));
      if (memberExceeded_ || arrayExceeded_) return fail(error, QStringLiteral("JSON container is too large"));
      return fail(error, QStringLiteral("invalid JSON"));
    }
    skipSpace();
    return position_ == input_.size() ? true : fail(error, QStringLiteral("invalid JSON"));
  }

private:
  bool enter()
  {
    if (depth_ >= kMaxJsonDepth) {
      depthExceeded_ = true;
      return false;
    }
    ++depth_;
    return true;
  }

  bool value()
  {
    skipSpace();
    if (position_ >= input_.size()) return false;
    switch (input_.at(position_)) {
    case '{': return object();
    case '[': return array();
    case '"': return string();
    case 't': return literal("true");
    case 'f': return literal("false");
    case 'n': return literal("null");
    default: return number();
    }
  }

  bool object()
  {
    if (!enter()) return false;
    ++position_;
    skipSpace();
    QSet<QString> keys;
    int members = 0;
    if (take('}')) {
      --depth_;
      return true;
    }
    while (position_ < input_.size()) {
      if (++members > kMaxObjectMembers) {
        memberExceeded_ = true;
        --depth_;
        return false;
      }
      const int start = position_;
      if (!string() || position_ <= start) {
        --depth_;
        return false;
      }
      const QByteArray encodedKey = input_.mid(start, position_ - start);
      QJsonParseError parseError;
      const QJsonDocument keyDocument = QJsonDocument::fromJson(QByteArray("[") + encodedKey + QByteArray("]"), &parseError);
      if (parseError.error != QJsonParseError::NoError || keyDocument.array().isEmpty()) {
        --depth_;
        return false;
      }
      const QString key = keyDocument.array().at(0).toString();
      if (keys.contains(key)) {
        duplicate_ = true;
        --depth_;
        return false;
      }
      keys.insert(key);
      skipSpace();
      if (!take(':') || !value()) {
        --depth_;
        return false;
      }
      skipSpace();
      if (take('}')) {
        --depth_;
        return true;
      }
      if (!take(',')) {
        --depth_;
        return false;
      }
      skipSpace();
    }
    --depth_;
    return false;
  }

  bool array()
  {
    if (!enter()) return false;
    ++position_;
    skipSpace();
    int items = 0;
    if (take(']')) {
      --depth_;
      return true;
    }
    while (position_ < input_.size()) {
      if (++items > kMaxArrayItems) {
        arrayExceeded_ = true;
        --depth_;
        return false;
      }
      if (!value()) {
        --depth_;
        return false;
      }
      skipSpace();
      if (take(']')) {
        --depth_;
        return true;
      }
      if (!take(',')) {
        --depth_;
        return false;
      }
      skipSpace();
    }
    --depth_;
    return false;
  }

  bool string()
  {
    if (!take('"')) return false;
    while (position_ < input_.size()) {
      const unsigned char character = static_cast<unsigned char>(input_.at(position_++));
      if (character == '"') return true;
      if (character == '\\') {
        if (position_ >= input_.size()) return false;
        const unsigned char escaped = static_cast<unsigned char>(input_.at(position_++));
        if (escaped == 'u') {
          if (position_ + 4 > input_.size()) return false;
          for (int index = 0; index < 4; ++index) {
            const char hex = input_.at(position_ + index);
            if (!QRegularExpression(QStringLiteral("[0-9A-Fa-f]")).match(QString(QChar::fromLatin1(hex))).hasMatch()) {
              return false;
            }
          }
          position_ += 4;
        } else if (escaped != '"' && escaped != '\\' && escaped != '/' && escaped != 'b' && escaped != 'f' &&
                   escaped != 'n' && escaped != 'r' && escaped != 't') {
          return false;
        }
        continue;
      }
      if (character < 0x20) return false;
    }
    return false;
  }

  bool literal(const char *literalValue)
  {
    const int length = static_cast<int>(qstrlen(literalValue));
    if (position_ + length > input_.size() || input_.mid(position_, length) != QByteArray(literalValue, length)) return false;
    position_ += length;
    return true;
  }

  bool number()
  {
    const int start = position_;
    while (position_ < input_.size()) {
      const char character = input_.at(position_);
      if (character == ',' || character == ']' || character == '}' || character == ' ' || character == '\t' ||
          character == '\r' || character == '\n') break;
      ++position_;
    }
    return position_ > start;
  }

  bool take(char expected)
  {
    if (position_ >= input_.size() || input_.at(position_) != expected) return false;
    ++position_;
    return true;
  }

  void skipSpace()
  {
    while (position_ < input_.size()) {
      const char character = input_.at(position_);
      if (character != ' ' && character != '\t' && character != '\r' && character != '\n') return;
      ++position_;
    }
  }

  const QByteArray &input_;
  int position_ = 0;
  int depth_ = 0;
  bool duplicate_ = false;
  bool depthExceeded_ = false;
  bool memberExceeded_ = false;
  bool arrayExceeded_ = false;
};

} // namespace

QString frameKindName(FrameKind kind)
{
  switch (kind) {
  case FrameKind::Request: return QStringLiteral("request");
  case FrameKind::Response: return QStringLiteral("response");
  case FrameKind::Stream: return QStringLiteral("stream");
  case FrameKind::Event: return QStringLiteral("event");
  case FrameKind::Error: return QStringLiteral("error");
  }
  return {};
}

std::optional<FrameKind> frameKindFromName(const QString &name)
{
  if (name == QStringLiteral("request")) return FrameKind::Request;
  if (name == QStringLiteral("response")) return FrameKind::Response;
  if (name == QStringLiteral("stream")) return FrameKind::Stream;
  if (name == QStringLiteral("event")) return FrameKind::Event;
  if (name == QStringLiteral("error")) return FrameKind::Error;
  return std::nullopt;
}

bool validateTarget(const QJsonObject &target, QString *error)
{
  if (!exactKeys(target,
                 QSet<QString>{QStringLiteral("hostID"), QStringLiteral("pairingID"), QStringLiteral("workspaceID"),
                               QStringLiteral("remoteDirectory")},
                 QSet<QString>{QStringLiteral("hostID"), QStringLiteral("pairingID"), QStringLiteral("workspaceID"),
                               QStringLiteral("remoteDirectory")},
                 error) ||
      !requiredString(target, QStringLiteral("hostID"), kMaxIdentifierBytes, true, false, &kHostIDPattern, error) ||
      !requiredString(target, QStringLiteral("pairingID"), kMaxIdentifierBytes, true, false, &kPairingIDPattern, error) ||
      !requiredString(target, QStringLiteral("workspaceID"), kMaxIdentifierBytes, true, false, &kWorkspaceIDPattern, error) ||
      !validateRemoteDirectory(target.value(QStringLiteral("remoteDirectory")), error)) {
    return false;
  }
  return true;
}

std::optional<QString> computeRemoteTargetDigest(const QJsonObject &target, QString *error)
{
  if (!validateTarget(target, error)) {
    return std::nullopt;
  }
  return digestJson(target, error);
}

std::optional<QString> computeRemoteRequestDigest(const QJsonObject &request, QString *error)
{
  if (request.isEmpty()) {
    fail(error, QStringLiteral("request must be a JSON object"));
    return std::nullopt;
  }
  QJsonObject input = request;
  input.remove(QStringLiteral("requestDigest"));
  if (input.value(QStringLiteral("auth")).isObject()) {
    QJsonObject auth = input.value(QStringLiteral("auth")).toObject();
    auth.remove(QStringLiteral("proof"));
    input.insert(QStringLiteral("auth"), auth);
  }
  return digestJson(input, error);
}

std::optional<QByteArray> remoteTransportSessionProofTranscript(const QJsonObject &open, QString *error)
{
  Frame frame;
  if (!validateFrameObject(open, &frame, error) || frame.kind != FrameKind::Request ||
      frame.type != QStringLiteral("session.open")) {
    if (error != nullptr && error->isEmpty()) {
      *error = QStringLiteral("session proof transcript requires a valid session.open request");
    }
    return std::nullopt;
  }
  const QJsonObject auth = open.value(QStringLiteral("auth")).toObject();
  QJsonObject transcript{
    {QStringLiteral("authTarget"), auth.value(QStringLiteral("target"))},
    {QStringLiteral("capabilities"), open.value(QStringLiteral("capabilities"))},
    {QStringLiteral("challenge"), auth.value(QStringLiteral("challenge"))},
    {QStringLiteral("domain"), QStringLiteral("slopcode-remote-v1")},
    {QStringLiteral("idempotencyKey"), open.value(QStringLiteral("idempotencyKey"))},
    {QStringLiteral("pairingID"), auth.value(QStringLiteral("pairingID"))},
    {QStringLiteral("requestDigest"), open.value(QStringLiteral("requestDigest"))},
    {QStringLiteral("requestID"), open.value(QStringLiteral("requestID"))},
    {QStringLiteral("target"), open.value(QStringLiteral("target"))},
    {QStringLiteral("targetDigest"), auth.value(QStringLiteral("targetDigest"))},
    {QStringLiteral("type"), open.value(QStringLiteral("type"))},
    {QStringLiteral("version"), open.value(QStringLiteral("version"))},
  };
  QByteArray canonical;
  if (!canonicalJsonValue(transcript, &canonical, false, error)) {
    return std::nullopt;
  }
  return canonical;
}

bool verifyRemoteRequestDigest(const QJsonObject &request, QString *error)
{
  Frame frame;
  if (!validateFrameObject(request, &frame, error) || frame.kind != FrameKind::Request ||
      !request.contains(QStringLiteral("requestDigest"))) {
    if (error != nullptr && error->isEmpty()) {
      *error = QStringLiteral("request digest verification requires a valid request frame");
    }
    return false;
  }
  const std::optional<QString> expected = computeRemoteRequestDigest(request, error);
  if (!expected.has_value()) {
    return false;
  }
  return request.value(QStringLiteral("requestDigest")).toString() == *expected
           ? true
           : fail(error, QStringLiteral("requestDigest does not match the canonical request"));
}

bool remoteTransportCapabilitiesMatch(const QJsonObject &offered,
                                      const QJsonObject &accepted,
                                      QString *error)
{
  if (!validateCapabilities(offered, error) || !validateAcceptedCapabilities(accepted, error)) {
    return false;
  }
  const QJsonArray offeredList = offered.value(QStringLiteral("offered")).toArray();
  const QJsonArray requiredList = offered.value(QStringLiteral("required")).toArray();
  const QJsonArray acceptedList = accepted.value(QStringLiteral("accepted")).toArray();
  for (const QJsonValue &feature : acceptedList) {
    if (!offeredList.contains(feature)) {
      return fail(error, QStringLiteral("accepted capability was not offered"));
    }
  }
  for (const QJsonValue &feature : requiredList) {
    if (!acceptedList.contains(feature)) {
      return fail(error, QStringLiteral("required capability was not accepted"));
    }
  }
  return true;
}

bool remoteTransportSessionOpenedMatches(const QJsonObject &open,
                                         const QJsonObject &opened,
                                         QString *error)
{
  Frame openFrame;
  Frame openedFrame;
  if (!validateFrameObject(open, &openFrame, error)) {
    return false;
  }
  if (openFrame.type != QStringLiteral("session.open")) {
    return fail(error, QStringLiteral("session negotiation requires a session.open frame"));
  }
  if (!validateFrameObject(opened, &openedFrame, error)) {
    return false;
  }
  if (openedFrame.type != QStringLiteral("session.opened")) {
    return fail(error, QStringLiteral("session negotiation requires a session.opened frame"));
  }
  for (const QString &field : {QStringLiteral("requestID"), QStringLiteral("idempotencyKey"),
                               QStringLiteral("requestDigest")}) {
    if (open.value(field) != opened.value(field)) {
      return fail(error, QStringLiteral("session.opened does not match ") + field);
    }
  }
  if (!sameTarget(open.value(QStringLiteral("target")).toObject(), opened.value(QStringLiteral("target")).toObject())) {
    return fail(error, QStringLiteral("session.opened target does not match session.open"));
  }
  return remoteTransportCapabilitiesMatch(open.value(QStringLiteral("capabilities")).toObject(),
                                           opened.value(QStringLiteral("capabilities")).toObject(),
                                           error);
}

RemoteIdempotencyStore::RemoteIdempotencyStore(int maxEntries, qint64 ttlMs)
  : maxEntries_(qBound(1, maxEntries, 4'096))
  , ttlMs_(qBound<qint64>(1, ttlMs, 10 * 60 * 1000))
{
}

void RemoteIdempotencyStore::prune(qint64 now)
{
  QMutexLocker locker(&mutex_);
  pruneUnlocked(now);
}

void RemoteIdempotencyStore::pruneUnlocked(qint64 now)
{
  const qint64 current = now == 0 ? QDateTime::currentMSecsSinceEpoch() : now;
  for (auto it = records_.begin(); it != records_.end();) {
    if (it->expiresAt <= current) {
      it = records_.erase(it);
    } else {
      ++it;
    }
  }
}

RemoteIdempotencyClaim RemoteIdempotencyStore::claim(const QString &sessionID,
                                                     const QJsonObject &registeredTarget,
                                                     const QJsonObject &requestTarget,
                                                     const QString &idempotencyKey,
                                                     const QString &requestDigest,
                                                     qint64 now)
{
  RemoteIdempotencyClaim claim;
  if (!kSessionIDPattern.match(sessionID).hasMatch() || !kIdempotencyPattern.match(idempotencyKey).hasMatch() ||
      !kDigestPattern.match(requestDigest).hasMatch()) {
    claim.status = RemoteIdempotencyStatus::InvalidDigest;
    return claim;
  }
  if (!validateTarget(registeredTarget, nullptr) || !validateTarget(requestTarget, nullptr) ||
      !sameTarget(registeredTarget, requestTarget)) {
    claim.status = RemoteIdempotencyStatus::TargetMismatch;
    return claim;
  }
  QMutexLocker locker(&mutex_);
  pruneUnlocked(now);
  const QString key = idempotencyBindingKey(sessionID, registeredTarget, idempotencyKey);
  const auto existing = records_.constFind(key);
  if (existing != records_.constEnd()) {
    claim.existingDigest = existing->digest;
    claim.status = existing->digest == requestDigest ? RemoteIdempotencyStatus::Replay
                                                      : RemoteIdempotencyStatus::Conflict;
    return claim;
  }
  if (records_.size() >= maxEntries_) {
    claim.status = RemoteIdempotencyStatus::Capacity;
    return claim;
  }
  const qint64 current = now == 0 ? QDateTime::currentMSecsSinceEpoch() : now;
  records_.insert(key, Record{requestDigest, false, current + ttlMs_});
  claim.status = RemoteIdempotencyStatus::Accepted;
  return claim;
}

bool RemoteIdempotencyStore::complete(const QString &sessionID,
                                      const QJsonObject &registeredTarget,
                                      const QJsonObject &requestTarget,
                                      const QString &idempotencyKey,
                                      const QString &requestDigest,
                                      qint64 now)
{
  QMutexLocker locker(&mutex_);
  pruneUnlocked(now);
  if (!validateTarget(registeredTarget, nullptr) || !validateTarget(requestTarget, nullptr) ||
      !sameTarget(registeredTarget, requestTarget) || !kSessionIDPattern.match(sessionID).hasMatch() ||
      !kIdempotencyPattern.match(idempotencyKey).hasMatch() || !kDigestPattern.match(requestDigest).hasMatch()) {
    return false;
  }
  const auto it = records_.find(idempotencyBindingKey(sessionID, registeredTarget, idempotencyKey));
  if (it == records_.end() || it->digest != requestDigest || it->completed) {
    return false;
  }
  it->completed = true;
  return true;
}

bool RemoteIdempotencyStore::release(const QString &sessionID,
                                     const QJsonObject &registeredTarget,
                                     const QJsonObject &requestTarget,
                                     const QString &idempotencyKey,
                                     const QString &requestDigest,
                                     qint64 now)
{
  QMutexLocker locker(&mutex_);
  pruneUnlocked(now);
  if (!validateTarget(registeredTarget, nullptr) || !validateTarget(requestTarget, nullptr) ||
      !sameTarget(registeredTarget, requestTarget) || !kSessionIDPattern.match(sessionID).hasMatch() ||
      !kIdempotencyPattern.match(idempotencyKey).hasMatch() || !kDigestPattern.match(requestDigest).hasMatch()) {
    return false;
  }
  const QString key = idempotencyBindingKey(sessionID, registeredTarget, idempotencyKey);
  const auto it = records_.find(key);
  if (it == records_.end() || it->digest != requestDigest || it->completed) {
    return false;
  }
  records_.erase(it);
  return true;
}

RemoteStreamState createRemoteStreamState(qint64 maxBytes,
                                           qint64 maxWindowBytes,
                                           std::optional<qint64> expectedBytes)
{
  RemoteStreamState state;
  state.maxBytes = qBound<qint64>(0, maxBytes, kMaxStreamBytes);
  state.maxWindowBytes = qBound<qint64>(0, maxWindowBytes, kMaxStreamWindowBytes);
  if (expectedBytes.has_value()) {
    state.expectedBytes = qBound<qint64>(0, *expectedBytes, kMaxStreamBytes);
  }
  return state;
}

std::optional<RemoteStreamState> createRemoteUploadStreamState(qint64 expectedBytes)
{
  if (expectedBytes < 0 || expectedBytes > kMaxStreamBytes) {
    return std::nullopt;
  }
  return createRemoteStreamState(kMaxStreamBytes, kMaxStreamWindowBytes, expectedBytes);
}

bool advanceRemoteStream(RemoteStreamState &state, const Frame &frame, QString *error)
{
  Frame validated;
  if (!validateFrameObject(frame.object, &validated, error) || validated.kind != FrameKind::Stream) {
    if (error != nullptr && error->isEmpty()) {
      *error = QStringLiteral("stream advancement requires a valid stream frame");
    }
    return false;
  }
  const QString type = validated.type;
  if (type != QStringLiteral("http.chunk") && type != QStringLiteral("http.upload.chunk") &&
      type != QStringLiteral("pty.output")) {
    return fail(error, QStringLiteral("unsupported stream frame type"));
  }
  const QJsonObject object = validated.object;
  const quint32 sequence = static_cast<quint32>(object.value(QStringLiteral("sequence")).toInteger());
  if (state.final || sequence != state.nextSequence) {
    return fail(error, QStringLiteral("stream sequence is not the next expected value"));
  }
  const QJsonObject chunk = object.value(QStringLiteral("chunk")).toObject();
  const QString encoding = chunk.value(QStringLiteral("encoding")).toString();
  const QString data = chunk.value(QStringLiteral("data")).toString();
  const qint64 bytes = encoding == QStringLiteral("base64") ? base64ByteLength(data) : utf8Bytes(data);
  const bool final = object.value(QStringLiteral("final")).toBool();
  const qint64 total = state.totalBytes + bytes;
  if (total > state.maxBytes || (state.expectedBytes.has_value() && total > *state.expectedBytes) ||
      state.windowBytes + bytes > state.maxWindowBytes ||
      (final && state.expectedBytes.has_value() && total != *state.expectedBytes)) {
    return fail(error, QStringLiteral("stream exceeds its byte or window bound"));
  }
  state.nextSequence += 1;
  state.final = final;
  state.totalBytes = total;
  state.windowBytes += bytes;
  return true;
}

bool acknowledgeRemoteStream(RemoteStreamState &state, qint64 bytes, QString *error)
{
  if (bytes < 0 || bytes > state.windowBytes) {
    return fail(error, QStringLiteral("stream acknowledgement exceeds the outstanding window"));
  }
  state.windowBytes -= bytes;
  return true;
}

bool remoteStreamComplete(const RemoteStreamState &state)
{
  return state.final && (!state.expectedBytes.has_value() || state.totalBytes == *state.expectedBytes);
}

ParseResult parseFrame(const QByteArray &bytes)
{
  if (bytes.isEmpty()) return {std::nullopt, QStringLiteral("empty frame")};
  if (bytes.size() > kMaxFrameBytes) return {std::nullopt, QStringLiteral("frame exceeds maximum size")};

  QString scanError;
  if (!JsonKeyScanner(bytes).run(&scanError)) return {std::nullopt, scanError};

  QJsonParseError parseError;
  const QJsonDocument document = QJsonDocument::fromJson(bytes, &parseError);
  if (parseError.error != QJsonParseError::NoError || !document.isObject()) {
    return {std::nullopt, QStringLiteral("frame must be a JSON object")};
  }

  Frame frame;
  QString error;
  if (!validateFrameObject(document.object(), &frame, &error)) return {std::nullopt, error};
  return {frame, {}};
}

QByteArray encodeFrame(const Frame &frame, QString *error)
{
  if (frame.object.isEmpty()) {
    fail(error, QStringLiteral("a complete RemoteV1 frame object is required"));
    return {};
  }
  Frame validated;
  if (!validateFrameObject(frame.object, &validated, error)) return {};
  const QByteArray bytes = QJsonDocument(validated.object).toJson(QJsonDocument::Compact);
  if (bytes.size() > kMaxFrameBytes) {
    fail(error, QStringLiteral("frame exceeds maximum size"));
    return {};
  }
  return bytes;
}

} // namespace slopcode::remoteqt
