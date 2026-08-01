#pragma once

#include <QByteArray>
#include <QJsonObject>
#include <QJsonValue>
#include <QHash>
#include <QMetaType>
#include <QMutex>
#include <QString>
#include <QtGlobal>

#include <optional>

namespace slopcode::remoteqt {

inline constexpr int kMaxFrameBytes = 256 * 1024;
inline constexpr int kMaxJsonDepth = 64;
inline constexpr int kMaxObjectMembers = 128;
inline constexpr int kMaxArrayItems = 256;

enum class FrameKind {
  Request,
  Response,
  Stream,
  Event,
  Error,
};

struct Frame {
  // `object` is the wire frame. The remaining fields are parsed conveniences;
  // encodeFrame always validates and serializes object, so callers cannot
  // accidentally emit a legacy generic-payload envelope.
  QJsonObject object;
  QString version = QStringLiteral("v1");
  FrameKind kind = FrameKind::Request;
  QString type;
  QString requestID;
  QString idempotencyKey;
  QJsonObject target;

  Frame() = default;
  explicit Frame(const QJsonObject &value)
    : object(value)
  {
  }
};

enum class RemoteIdempotencyStatus {
  Accepted,
  Replay,
  Conflict,
  Capacity,
  InvalidDigest,
  TargetMismatch,
};

struct RemoteIdempotencyClaim {
  RemoteIdempotencyStatus status = RemoteIdempotencyStatus::InvalidDigest;
  QString existingDigest;
};

// Bounded process-local replay binding. A production multi-process relay
// must replace this with an atomic database/transactional store.
class RemoteIdempotencyStore final {
public:
  explicit RemoteIdempotencyStore(int maxEntries = 4'096, qint64 ttlMs = 10 * 60 * 1000);

  RemoteIdempotencyClaim claim(const QString &sessionID,
                               const QJsonObject &registeredTarget,
                               const QJsonObject &requestTarget,
                               const QString &idempotencyKey,
                               const QString &requestDigest,
                               qint64 now = 0);
  bool complete(const QString &sessionID,
                const QJsonObject &registeredTarget,
                const QJsonObject &requestTarget,
                const QString &idempotencyKey,
                const QString &requestDigest,
                qint64 now = 0);
  bool release(const QString &sessionID,
               const QJsonObject &registeredTarget,
               const QJsonObject &requestTarget,
               const QString &idempotencyKey,
               const QString &requestDigest,
               qint64 now = 0);
  void prune(qint64 now = 0);

private:
  void pruneUnlocked(qint64 now);

  struct Record {
    QString digest;
    bool completed = false;
    qint64 expiresAt = 0;
  };

  int maxEntries_;
  qint64 ttlMs_;
  QMutex mutex_;
  QHash<QString, Record> records_;
};

struct RemoteStreamState {
  quint32 nextSequence = 0;
  bool final = false;
  qint64 totalBytes = 0;
  qint64 windowBytes = 0;
  qint64 maxBytes = 16 * 1024 * 1024;
  qint64 maxWindowBytes = 256 * 1024;
  std::optional<qint64> expectedBytes;
};

RemoteStreamState createRemoteStreamState(qint64 maxBytes = 16 * 1024 * 1024,
                                           qint64 maxWindowBytes = 256 * 1024,
                                           std::optional<qint64> expectedBytes = std::nullopt);
std::optional<RemoteStreamState> createRemoteUploadStreamState(qint64 expectedBytes);
bool advanceRemoteStream(RemoteStreamState &state, const Frame &frame, QString *error = nullptr);
bool acknowledgeRemoteStream(RemoteStreamState &state, qint64 bytes, QString *error = nullptr);
bool remoteStreamComplete(const RemoteStreamState &state);

struct ParseResult {
  std::optional<Frame> frame;
  QString error;

  explicit operator bool() const { return frame.has_value(); }
};

QString frameKindName(FrameKind kind);
std::optional<FrameKind> frameKindFromName(const QString &name);

// RemoteV1 transport targets are scoped references. Loopback URLs are an
// implementation detail of the local forwarder and never appear on the wire.
bool validateTarget(const QJsonObject &target, QString *error = nullptr);

// These helpers implement the deterministic SHA-256 fields used by the wire
// contract. They do not verify an Ed25519 session proof; the reference
// session rejects session.open until a production verifier is supplied.
std::optional<QString> computeRemoteTargetDigest(const QJsonObject &target, QString *error = nullptr);
std::optional<QString> computeRemoteRequestDigest(const QJsonObject &request, QString *error = nullptr);
std::optional<QByteArray> remoteTransportSessionProofTranscript(const QJsonObject &open,
                                                                 QString *error = nullptr);
bool verifyRemoteRequestDigest(const QJsonObject &request, QString *error = nullptr);
bool remoteTransportCapabilitiesMatch(const QJsonObject &offered,
                                      const QJsonObject &accepted,
                                      QString *error = nullptr);

ParseResult parseFrame(const QByteArray &bytes);

// Returns an empty byte array on failure and writes a non-secret diagnostic.
QByteArray encodeFrame(const Frame &frame, QString *error = nullptr);

} // namespace slopcode::remoteqt

Q_DECLARE_METATYPE(slopcode::remoteqt::Frame)
