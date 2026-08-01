#pragma once

#include <QByteArray>
#include <QJsonObject>
#include <QJsonValue>
#include <QMetaType>
#include <QString>

#include <optional>

namespace slopcode::remoteqt {

inline constexpr int kMaxFrameBytes = 256 * 1024;

enum class FrameKind {
  Request,
  Response,
  Event,
  Error,
};

struct Frame {
  QString version = QStringLiteral("v1");
  FrameKind kind = FrameKind::Request;
  QString requestID;
  QJsonObject target;
  QJsonValue payload = QJsonValue(QJsonValue::Undefined);
};

struct ParseResult {
  std::optional<Frame> frame;
  QString error;

  explicit operator bool() const { return frame.has_value(); }
};

QString frameKindName(FrameKind kind);
std::optional<FrameKind> frameKindFromName(const QString &name);

// The target is intentionally a small subset of the conceptual RemoteV1 target
// shape: {type:"local",directory:"/..."} or
// {type:"remote",url:"http://127.0.0.1:...",headers:{...}}.
bool validateTarget(const QJsonObject &target, QString *error = nullptr);

ParseResult parseFrame(const QByteArray &bytes);

// Returns an empty byte array on failure and writes a non-secret diagnostic.
QByteArray encodeFrame(const Frame &frame, QString *error = nullptr);

} // namespace slopcode::remoteqt

Q_DECLARE_METATYPE(slopcode::remoteqt::Frame)
