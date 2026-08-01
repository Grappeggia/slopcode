#include <slopcode/remoteqt/frame.h>

#include <QDir>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonParseError>
#include <QRegularExpression>
#include <QSet>
#include <QUrl>

namespace slopcode::remoteqt {
namespace {

const QRegularExpression kRequestIDPattern(QStringLiteral(R"(^req_[A-Za-z0-9._:-]{1,127}$)"));
const QRegularExpression kHeaderNamePattern(QStringLiteral(R"(^[!#$%&'*+.^_`|~0-9A-Za-z-]+$)"));

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
    if (character == QChar::Null || character == QChar::CarriageReturn || character == QChar::LineFeed) {
      return true;
    }
  }
  return false;
}

bool sensitiveKey(const QString &key)
{
  const QString lowered = key.toLower();
  return lowered.contains(QStringLiteral("password")) ||
         lowered.contains(QStringLiteral("passphrase")) ||
         lowered.contains(QStringLiteral("private")) ||
         lowered.contains(QStringLiteral("identity")) ||
         lowered.contains(QStringLiteral("secret")) ||
         lowered.contains(QStringLiteral("credential")) ||
         lowered.contains(QStringLiteral("apikey")) ||
         lowered.contains(QStringLiteral("accesskey")) ||
         lowered.contains(QStringLiteral("auth")) ||
         lowered == QStringLiteral("passwd") ||
         lowered == QStringLiteral("pwd") ||
         lowered == QStringLiteral("pass") ||
         lowered.contains(QStringLiteral("sessiontoken")) ||
         lowered == QStringLiteral("token") ||
         lowered.endsWith(QStringLiteral("token")) ||
         lowered == QStringLiteral("authorization") ||
         lowered == QStringLiteral("proxy-authorization");
}

bool sensitiveValue(const QString &value)
{
  const QString lowered = value.toLower();
  return lowered.contains(QStringLiteral("-----begin private key-----")) ||
         lowered.contains(QStringLiteral("-----begin openssh private key-----"));
}

bool safeValue(const QJsonValue &value, QString *error)
{
  if (value.isString()) {
    if (sensitiveValue(value.toString())) {
      return fail(error, QStringLiteral("credential material is not allowed in a frame"));
    }
    return true;
  }

  if (value.isArray()) {
    for (const QJsonValue &item : value.toArray()) {
      if (!safeValue(item, error)) {
        return false;
      }
    }
    return true;
  }

  if (!value.isObject()) {
    return true;
  }

  const QJsonObject object = value.toObject();
  for (auto it = object.cbegin(); it != object.cend(); ++it) {
    if (sensitiveKey(it.key())) {
      return fail(error, QStringLiteral("credential-bearing frame fields are not allowed"));
    }
    if (!safeValue(it.value(), error)) {
      return false;
    }
  }
  return true;
}

bool exactKeys(const QJsonObject &object,
               const QSet<QString> &required,
               const QSet<QString> &allowed,
               QString *error)
{
  for (const QString &key : object.keys()) {
    if (!allowed.contains(key)) {
      return fail(error, QStringLiteral("unknown frame field"));
    }
  }
  for (const QString &key : required) {
    if (!object.contains(key)) {
      return fail(error, QStringLiteral("missing required frame field"));
    }
  }
  return true;
}

bool validateHeaderObject(const QJsonObject &headers, QString *error)
{
  for (auto it = headers.cbegin(); it != headers.cend(); ++it) {
    if (!kHeaderNamePattern.match(it.key()).hasMatch() || sensitiveKey(it.key())) {
      return fail(error, QStringLiteral("unsafe target header"));
    }
    if (!it.value().isString() || hasControl(it.value().toString()) || it.value().toString().size() > 16 * 1024) {
      return fail(error, QStringLiteral("invalid target header"));
    }
  }
  return true;
}

bool validateRemoteURL(const QString &value, QString *error)
{
  const QUrl url(value);
  if (!url.isValid() || !url.userInfo().isEmpty() || url.hasFragment() || url.hasQuery()) {
    return fail(error, QStringLiteral("remote target URL must not contain credentials or query data"));
  }
  const QString scheme = url.scheme().toLower();
  if (scheme != QStringLiteral("http") && scheme != QStringLiteral("https")) {
    return fail(error, QStringLiteral("remote target URL must use HTTP or HTTPS"));
  }
  const QString host = url.host().toLower();
  if (host != QStringLiteral("localhost") && host != QStringLiteral("127.0.0.1") && host != QStringLiteral("::1")) {
    return fail(error, QStringLiteral("remote target URL must be loopback"));
  }
  if (url.port() < 1) {
    return fail(error, QStringLiteral("remote target URL must include a port"));
  }
  return true;
}

bool validateFrameObject(const QJsonObject &object, Frame *frame, QString *error)
{
  if (!exactKeys(object,
                 QSet<QString>{QStringLiteral("version"), QStringLiteral("kind"), QStringLiteral("requestID"),
                               QStringLiteral("target"), QStringLiteral("payload")},
                 QSet<QString>{QStringLiteral("version"), QStringLiteral("kind"), QStringLiteral("requestID"),
                               QStringLiteral("target"), QStringLiteral("payload")},
                 error)) {
    return false;
  }

  if (!object.value(QStringLiteral("version")).isString() ||
      object.value(QStringLiteral("version")).toString() != QStringLiteral("v1")) {
    return fail(error, QStringLiteral("unsupported RemoteV1 version"));
  }

  const auto kind = frameKindFromName(object.value(QStringLiteral("kind")).toString());
  if (!kind.has_value()) {
    return fail(error, QStringLiteral("unknown RemoteV1 frame kind"));
  }

  const QString requestID = object.value(QStringLiteral("requestID")).toString();
  if (!object.value(QStringLiteral("requestID")).isString() || !kRequestIDPattern.match(requestID).hasMatch()) {
    return fail(error, QStringLiteral("invalid RemoteV1 requestID"));
  }

  if (!object.value(QStringLiteral("target")).isObject()) {
    return fail(error, QStringLiteral("invalid RemoteV1 target"));
  }
  if (!validateTarget(object.value(QStringLiteral("target")).toObject(), error)) {
    return false;
  }
  if (!safeValue(object.value(QStringLiteral("target")), error) ||
      !safeValue(object.value(QStringLiteral("payload")), error)) {
    return false;
  }

  frame->version = QStringLiteral("v1");
  frame->kind = *kind;
  frame->requestID = requestID;
  frame->target = object.value(QStringLiteral("target")).toObject();
  frame->payload = object.value(QStringLiteral("payload"));
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
      return fail(error, duplicate_ ? QStringLiteral("duplicate JSON object key") : QStringLiteral("invalid JSON"));
    }
    skipSpace();
    if (position_ != input_.size()) {
      return fail(error, QStringLiteral("invalid JSON"));
    }
    return true;
  }

private:
  bool value()
  {
    skipSpace();
    if (position_ >= input_.size()) {
      return false;
    }
    switch (input_.at(position_)) {
    case '{':
      return object();
    case '[':
      return array();
    case '"':
      return string();
    case 't':
      return literal("true");
    case 'f':
      return literal("false");
    case 'n':
      return literal("null");
    default:
      return number();
    }
  }

  bool object()
  {
    ++position_;
    skipSpace();
    QSet<QString> keys;
    if (take('}')) {
      return true;
    }
    while (position_ < input_.size()) {
      const int start = position_;
      if (!string() || position_ <= start) {
        return false;
      }
      const QByteArray encodedKey = input_.mid(start, position_ - start);
      QJsonParseError parseError;
      const QJsonDocument keyDocument = QJsonDocument::fromJson(QByteArray("[") + encodedKey + QByteArray("]"), &parseError);
      if (parseError.error != QJsonParseError::NoError || keyDocument.array().isEmpty()) {
        return false;
      }
      const QString key = keyDocument.array().at(0).toString();
      if (keys.contains(key)) {
        duplicate_ = true;
        return false;
      }
      keys.insert(key);
      skipSpace();
      if (!take(':') || !value()) {
        return false;
      }
      skipSpace();
      if (take('}')) {
        return true;
      }
      if (!take(',')) {
        return false;
      }
      skipSpace();
    }
    return false;
  }

  bool array()
  {
    ++position_;
    skipSpace();
    if (take(']')) {
      return true;
    }
    while (position_ < input_.size()) {
      if (!value()) {
        return false;
      }
      skipSpace();
      if (take(']')) {
        return true;
      }
      if (!take(',')) {
        return false;
      }
      skipSpace();
    }
    return false;
  }

  bool string()
  {
    if (!take('"')) {
      return false;
    }
    while (position_ < input_.size()) {
      const unsigned char character = static_cast<unsigned char>(input_.at(position_++));
      if (character == '"') {
        return true;
      }
      if (character == '\\') {
        if (position_ >= input_.size()) {
          return false;
        }
        const unsigned char escaped = static_cast<unsigned char>(input_.at(position_++));
        if (escaped == 'u') {
          if (position_ + 4 > input_.size()) {
            return false;
          }
          position_ += 4;
        }
        continue;
      }
      if (character < 0x20) {
        return false;
      }
    }
    return false;
  }

  bool literal(const char *literal)
  {
    const int length = static_cast<int>(qstrlen(literal));
    if (position_ + length > input_.size() || input_.mid(position_, length) != QByteArray(literal, length)) {
      return false;
    }
    position_ += length;
    return true;
  }

  bool number()
  {
    const int start = position_;
    while (position_ < input_.size()) {
      const char character = input_.at(position_);
      if (character == ',' || character == ']' || character == '}' || character == ' ' || character == '\t' ||
          character == '\r' || character == '\n') {
        break;
      }
      ++position_;
    }
    return position_ > start;
  }

  bool take(char expected)
  {
    if (position_ >= input_.size() || input_.at(position_) != expected) {
      return false;
    }
    ++position_;
    return true;
  }

  void skipSpace()
  {
    while (position_ < input_.size()) {
      const char character = input_.at(position_);
      if (character != ' ' && character != '\t' && character != '\r' && character != '\n') {
        return;
      }
      ++position_;
    }
  }

  const QByteArray &input_;
  int position_ = 0;
  bool duplicate_ = false;
};

} // namespace

QString frameKindName(FrameKind kind)
{
  switch (kind) {
  case FrameKind::Request:
    return QStringLiteral("request");
  case FrameKind::Response:
    return QStringLiteral("response");
  case FrameKind::Event:
    return QStringLiteral("event");
  case FrameKind::Error:
    return QStringLiteral("error");
  }
  return QString();
}

std::optional<FrameKind> frameKindFromName(const QString &name)
{
  if (name == QStringLiteral("request")) {
    return FrameKind::Request;
  }
  if (name == QStringLiteral("response")) {
    return FrameKind::Response;
  }
  if (name == QStringLiteral("event")) {
    return FrameKind::Event;
  }
  if (name == QStringLiteral("error")) {
    return FrameKind::Error;
  }
  return std::nullopt;
}

bool validateTarget(const QJsonObject &target, QString *error)
{
  if (!target.contains(QStringLiteral("type")) || !target.value(QStringLiteral("type")).isString()) {
    return fail(error, QStringLiteral("target type is required"));
  }

  const QString type = target.value(QStringLiteral("type")).toString();
  if (type == QStringLiteral("local")) {
    if (!exactKeys(target,
                   QSet<QString>{QStringLiteral("type"), QStringLiteral("directory")},
                   QSet<QString>{QStringLiteral("type"), QStringLiteral("directory")},
                   error)) {
      return false;
    }
    const QString directory = target.value(QStringLiteral("directory")).toString();
    if (!target.value(QStringLiteral("directory")).isString() || hasControl(directory) || !QDir::isAbsolutePath(directory)) {
      return fail(error, QStringLiteral("local target directory must be absolute"));
    }
    return true;
  }

  if (type == QStringLiteral("remote")) {
    if (!exactKeys(target,
                   QSet<QString>{QStringLiteral("type"), QStringLiteral("url")},
                   QSet<QString>{QStringLiteral("type"), QStringLiteral("url"), QStringLiteral("headers")},
                   error)) {
      return false;
    }
    if (!target.value(QStringLiteral("url")).isString() ||
        !validateRemoteURL(target.value(QStringLiteral("url")).toString(), error)) {
      return false;
    }
    if (target.contains(QStringLiteral("headers")) &&
        (!target.value(QStringLiteral("headers")).isObject() ||
         !validateHeaderObject(target.value(QStringLiteral("headers")).toObject(), error))) {
      return false;
    }
    return true;
  }

  return fail(error, QStringLiteral("unknown target type"));
}

ParseResult parseFrame(const QByteArray &bytes)
{
  if (bytes.isEmpty()) {
    return {std::nullopt, QStringLiteral("empty frame")};
  }
  if (bytes.size() > kMaxFrameBytes) {
    return {std::nullopt, QStringLiteral("frame exceeds maximum size")};
  }

  QString scanError;
  if (!JsonKeyScanner(bytes).run(&scanError)) {
    return {std::nullopt, scanError};
  }

  QJsonParseError parseError;
  const QJsonDocument document = QJsonDocument::fromJson(bytes, &parseError);
  if (parseError.error != QJsonParseError::NoError || !document.isObject()) {
    return {std::nullopt, QStringLiteral("frame must be a JSON object")};
  }

  Frame frame;
  QString error;
  if (!validateFrameObject(document.object(), &frame, &error)) {
    return {std::nullopt, error};
  }
  return {frame, QString()};
}

QByteArray encodeFrame(const Frame &frame, QString *error)
{
  if (frame.version != QStringLiteral("v1")) {
    fail(error, QStringLiteral("unsupported RemoteV1 version"));
    return {};
  }
  if (frameKindName(frame.kind).isEmpty()) {
    fail(error, QStringLiteral("unknown RemoteV1 frame kind"));
    return {};
  }
  if (!kRequestIDPattern.match(frame.requestID).hasMatch()) {
    fail(error, QStringLiteral("invalid RemoteV1 requestID"));
    return {};
  }
  if (!validateTarget(frame.target, error)) {
    return {};
  }
  if (frame.payload.isUndefined()) {
    fail(error, QStringLiteral("frame payload is required"));
    return {};
  }
  if (!safeValue(frame.payload, error)) {
    return {};
  }

  QJsonObject object;
  object.insert(QStringLiteral("version"), frame.version);
  object.insert(QStringLiteral("kind"), frameKindName(frame.kind));
  object.insert(QStringLiteral("requestID"), frame.requestID);
  object.insert(QStringLiteral("target"), frame.target);
  object.insert(QStringLiteral("payload"), frame.payload);

  const QByteArray bytes = QJsonDocument(object).toJson(QJsonDocument::Compact);
  if (bytes.size() > kMaxFrameBytes) {
    fail(error, QStringLiteral("frame exceeds maximum size"));
    return {};
  }
  return bytes;
}

} // namespace slopcode::remoteqt
