#include <slopcode/remoteqt/frame.h>

#include <QJsonDocument>
#include <QJsonObject>
#include <QtTest/QtTest>

using namespace slopcode::remoteqt;

class FrameTest final : public QObject {
  Q_OBJECT

private slots:
  void acceptsValidRemoteFrame();
  void rejectsUnknownEnvelopeFields();
  void rejectsWrongVersionKindAndRequestID();
  void rejectsUnsafeTargetAndPayloadFields();
  void rejectsDuplicateAndOversizedFrames();
  void roundTripsEncodedFrame();
};

namespace {

QByteArray validFrame()
{
  return QByteArrayLiteral(
    R"({"version":"v1","kind":"request","requestID":"req_demo-1","target":{"type":"remote","url":"http://127.0.0.1:43123"},"payload":{"operation":"health"}})");
}

} // namespace

void FrameTest::acceptsValidRemoteFrame()
{
  const ParseResult result = parseFrame(validFrame());
  QVERIFY(result);
  QCOMPARE(result.frame->version, QStringLiteral("v1"));
  QCOMPARE(static_cast<int>(result.frame->kind), static_cast<int>(FrameKind::Request));
  QCOMPARE(result.frame->requestID, QStringLiteral("req_demo-1"));
  QCOMPARE(result.frame->target.value(QStringLiteral("type")).toString(), QStringLiteral("remote"));
}

void FrameTest::rejectsUnknownEnvelopeFields()
{
  QByteArray frame = validFrame();
  frame.chop(1);
  frame += QByteArrayLiteral(",\"extra\":true}");
  const ParseResult result = parseFrame(frame);
  QVERIFY(!result);
  QCOMPARE(result.error, QStringLiteral("unknown frame field"));
}

void FrameTest::rejectsWrongVersionKindAndRequestID()
{
  const QList<QByteArray> invalid{
    QByteArrayLiteral(
      R"({"version":"v2","kind":"request","requestID":"req_demo-1","target":{"type":"remote","url":"http://127.0.0.1:43123"},"payload":{}})"),
    QByteArrayLiteral(
      R"({"version":"v1","kind":"unknown","requestID":"req_demo-1","target":{"type":"remote","url":"http://127.0.0.1:43123"},"payload":{}})"),
    QByteArrayLiteral(
      R"({"version":"v1","kind":"request","requestID":"not-a-request","target":{"type":"remote","url":"http://127.0.0.1:43123"},"payload":{}})"),
  };
  for (const QByteArray &frame : invalid) {
    QVERIFY(!parseFrame(frame));
  }
}

void FrameTest::rejectsUnsafeTargetAndPayloadFields()
{
  const QList<QByteArray> invalid{
    QByteArrayLiteral(
      R"({"version":"v1","kind":"request","requestID":"req_demo-1","target":{"type":"remote","url":"https://example.invalid:443"},"payload":{}})"),
    QByteArrayLiteral(
      R"({"version":"v1","kind":"request","requestID":"req_demo-1","target":{"type":"remote","url":"http://127.0.0.1:43123","headers":{"Authorization":"Bearer no-frame-token"}},"payload":{}})"),
    QByteArrayLiteral(
      R"({"version":"v1","kind":"request","requestID":"req_demo-1","target":{"type":"remote","url":"http://127.0.0.1:43123"},"payload":{"sshPassword":"not-allowed"}})"),
    QByteArrayLiteral(
      R"({"version":"v1","kind":"request","requestID":"req_demo-1","target":{"type":"local","directory":"relative/path"},"payload":{}})"),
  };
  for (const QByteArray &frame : invalid) {
    QVERIFY(!parseFrame(frame));
  }
}

void FrameTest::rejectsDuplicateAndOversizedFrames()
{
  const QByteArray duplicate = QByteArrayLiteral(
    R"({"version":"v1","kind":"request","requestID":"req_demo-1","requestID":"req_demo-2","target":{"type":"remote","url":"http://127.0.0.1:43123"},"payload":{}})");
  QVERIFY(!parseFrame(duplicate));

  QByteArray oversized = validFrame();
  oversized.replace(oversized.indexOf("health"), 6, QByteArray(kMaxFrameBytes, 'x'));
  QVERIFY(oversized.size() > kMaxFrameBytes);
  QVERIFY(!parseFrame(oversized));
  QCOMPARE(parseFrame(oversized).error, QStringLiteral("frame exceeds maximum size"));
}

void FrameTest::roundTripsEncodedFrame()
{
  Frame frame;
  frame.kind = FrameKind::Event;
  frame.requestID = QStringLiteral("req_roundtrip");
  frame.target = QJsonObject{{QStringLiteral("type"), QStringLiteral("remote")},
                             {QStringLiteral("url"), QStringLiteral("http://localhost:43123")}};
  frame.payload = QJsonObject{{QStringLiteral("operation"), QStringLiteral("event")}};

  QString error;
  const QByteArray encoded = encodeFrame(frame, &error);
  QVERIFY2(!encoded.isEmpty(), qPrintable(error));
  const ParseResult decoded = parseFrame(encoded);
  QVERIFY(decoded);
  QCOMPARE(static_cast<int>(decoded.frame->kind), static_cast<int>(FrameKind::Event));
  QCOMPARE(decoded.frame->payload.toObject().value(QStringLiteral("operation")).toString(), QStringLiteral("event"));
}

QTEST_MAIN(FrameTest)
#include "frame_test.moc"
