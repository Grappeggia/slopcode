#include <slopcode/remoteqt/frame.h>
#include <slopcode/remoteqt/local_forwarder.h>
#include <slopcode/remoteqt/ssh_supervisor.h>

#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QFile>
#include <QFileInfo>
#include <QHostAddress>
#include <QNetworkReply>
#include <QTcpServer>
#include <QTcpSocket>
#include <QTemporaryDir>
#include <QUrl>
#include <QtTest/QtTest>

using namespace slopcode::remoteqt;

class FrameTest final : public QObject {
  Q_OBJECT

private slots:
  void acceptsAllSupportedFrames();
  void roundTripsEncodedFrame();
  void rejectsUnknownFieldsAndLegacyEnvelope();
  void rejectsUnsafeScopePathsAndBodies();
  void rejectsDuplicateOversizedAndDeepFrames();
  void validatesDigestsCapabilitiesIdempotencyAndStreams();
  void validatesSessionNegotiationBindings();
  void hardensLocalForwarding();
  void followsValidatedHttpRedirects();
  void requestsAnOsAssignedSshPort();
  void makesSshTeardownIdempotent();
  void restartsAfterSshFailure();
};

namespace {

#ifndef Q_OS_WIN
class ScopedPath final {
public:
  explicit ScopedPath(const QByteArray &prefix)
    : previous_(qgetenv("PATH"))
    , wasSet_(qEnvironmentVariableIsSet("PATH"))
  {
    QByteArray value = prefix;
    value += ':';
    value += previous_;
    qputenv("PATH", value);
  }

  ~ScopedPath()
  {
    if (wasSet_) {
      qputenv("PATH", previous_);
      return;
    }
    qunsetenv("PATH");
  }

private:
  QByteArray previous_;
  bool wasSet_ = false;
};
#endif

QJsonObject target()
{
  return QJsonObject{
    {QStringLiteral("hostID"), QStringLiteral("hst_desktop")},
    {QStringLiteral("pairingID"), QStringLiteral("pair_android")},
    {QStringLiteral("workspaceID"), QStringLiteral("wrk_slopcode")},
    {QStringLiteral("remoteDirectory"), QStringLiteral("/srv/slopcode")},
  };
}

QJsonObject body(const QString &data)
{
  return QJsonObject{{QStringLiteral("encoding"), QStringLiteral("utf8")}, {QStringLiteral("data"), data}};
}

QJsonObject capabilities()
{
  const QJsonArray features{
    QStringLiteral("proof.ed25519.v1"), QStringLiteral("frame.bounds.v1"), QStringLiteral("http.upload.v1")};
  return QJsonObject{{QStringLiteral("offered"), features}, {QStringLiteral("required"), features}};
}

QJsonObject requestBase(const QString &type, const QString &requestID = QStringLiteral("req_base_1"))
{
  return QJsonObject{
    {QStringLiteral("version"), QStringLiteral("v1")},
    {QStringLiteral("kind"), QStringLiteral("request")},
    {QStringLiteral("type"), type},
    {QStringLiteral("requestID"), requestID},
    {QStringLiteral("idempotencyKey"), QStringLiteral("idem_base_1")},
    {QStringLiteral("requestDigest"), QString(64, QChar('a'))},
    {QStringLiteral("target"), target()},
  };
}

QJsonObject responseBase(const QString &type, const QString &requestID = QStringLiteral("req_base_1"))
{
  QJsonObject value = requestBase(type, requestID);
  value.insert(QStringLiteral("kind"), QStringLiteral("response"));
  return value;
}

QJsonObject streamBase(const QString &type, const QString &requestID = QStringLiteral("req_base_1"))
{
  QJsonObject value = requestBase(type, requestID);
  value.insert(QStringLiteral("kind"), QStringLiteral("stream"));
  return value;
}

QJsonObject eventBase(const QString &type)
{
  return QJsonObject{
    {QStringLiteral("version"), QStringLiteral("v1")},
    {QStringLiteral("kind"), QStringLiteral("event")},
    {QStringLiteral("type"), type},
    {QStringLiteral("target"), target()},
  };
}

QJsonObject sessionOpen()
{
  QJsonObject challenge{
    {QStringLiteral("issuer"), QStringLiteral("server")},
    {QStringLiteral("id"), QStringLiteral("chl_open_1")},
    {QStringLiteral("nonce"), QStringLiteral("c2VydmVyX25vbmNlXzEyMzQ1Ng")},
    {QStringLiteral("issuedAt"), 1'700'000'000'000LL},
    {QStringLiteral("expiresAt"), 1'700'000'060'000LL},
    {QStringLiteral("oneTime"), true},
  };
  QJsonObject proof{
    {QStringLiteral("algorithm"), QStringLiteral("ed25519")},
    {QStringLiteral("encoding"), QStringLiteral("base64url")},
    {QStringLiteral("signature"), QString(86, QChar('A'))},
  };
  QJsonObject auth{
    {QStringLiteral("method"), QStringLiteral("pairing-signature")},
    {QStringLiteral("pairingID"), QStringLiteral("pair_android")},
    {QStringLiteral("target"), target()},
    {QStringLiteral("targetDigest"), QString(64, QChar('b'))},
    {QStringLiteral("challenge"), challenge},
    {QStringLiteral("proof"), proof},
  };
  QJsonObject value = requestBase(QStringLiteral("session.open"), QStringLiteral("req_open_1"));
  value.insert(QStringLiteral("capabilities"), capabilities());
  value.insert(QStringLiteral("auth"), auth);
  return value;
}

QByteArray validFrame()
{
  return QJsonDocument(sessionOpen()).toJson(QJsonDocument::Compact);
}

} // namespace

void FrameTest::acceptsAllSupportedFrames()
{
  QList<QJsonObject> frames;
  frames << sessionOpen();

  QJsonObject close = requestBase(QStringLiteral("session.close"));
  close.insert(QStringLiteral("sessionID"), QStringLiteral("ses_remote_1"));
  close.insert(QStringLiteral("reason"), QStringLiteral("mobile closed"));
  frames << close;

  QJsonObject http = requestBase(QStringLiteral("http.request"));
  http.insert(QStringLiteral("method"), QStringLiteral("POST"));
  http.insert(QStringLiteral("path"), QStringLiteral("/api/session/ses_remote_1/message"));
  http.insert(QStringLiteral("query"), QStringLiteral("page=1&cursor=cur_events_1"));
  http.insert(QStringLiteral("headers"), QJsonObject{{QStringLiteral("content-type"), QStringLiteral("application/json")} });
  http.insert(QStringLiteral("body"), body(QStringLiteral("{\"message\":\"hello\"}")));
  frames << http;

  QJsonObject upload = requestBase(QStringLiteral("http.upload"), QStringLiteral("req_upload_1"));
  upload.insert(QStringLiteral("method"), QStringLiteral("POST"));
  upload.insert(QStringLiteral("path"), QStringLiteral("/api/upload"));
  upload.insert(QStringLiteral("query"), QStringLiteral("a=%2fetc&q=hello+world"));
  upload.insert(QStringLiteral("contentLength"), 3);
  frames << upload;

  QJsonObject response = responseBase(QStringLiteral("http.response"));
  response.insert(QStringLiteral("status"), 200);
  response.insert(QStringLiteral("body"), body(QStringLiteral("{\"ok\":true}")));
  frames << response;

  QJsonObject chunk = streamBase(QStringLiteral("http.chunk"));
  chunk.insert(QStringLiteral("sequence"), 0);
  chunk.insert(QStringLiteral("chunk"), body(QStringLiteral("event: message\ndata: hello\n\n")));
  chunk.insert(QStringLiteral("final"), true);
  frames << chunk;

  QJsonObject uploadChunk = streamBase(QStringLiteral("http.upload.chunk"), QStringLiteral("req_upload_1"));
  uploadChunk.insert(QStringLiteral("sequence"), 0);
  uploadChunk.insert(QStringLiteral("chunk"), body(QStringLiteral("abc")));
  uploadChunk.insert(QStringLiteral("final"), true);
  frames << uploadChunk;

  QJsonObject replay = requestBase(QStringLiteral("event.replay"));
  replay.insert(QStringLiteral("cursor"), QStringLiteral("cur_events_1"));
  replay.insert(QStringLiteral("limit"), 20);
  frames << replay;

  QJsonObject event = eventBase(QStringLiteral("event"));
  event.insert(QStringLiteral("cursor"), QStringLiteral("cur_events_2"));
  event.insert(QStringLiteral("event"), QStringLiteral("session.message"));
  event.insert(QStringLiteral("data"), body(QStringLiteral("hello")));
  event.insert(QStringLiteral("replayed"), true);
  frames << event;

  QJsonObject ptyOpen = requestBase(QStringLiteral("pty.open"));
  ptyOpen.insert(QStringLiteral("ptyID"), QStringLiteral("pty_remote_1"));
  ptyOpen.insert(QStringLiteral("command"), QStringLiteral("bash"));
  ptyOpen.insert(QStringLiteral("args"), QJsonArray{QString(), QStringLiteral("printf ready")});
  ptyOpen.insert(QStringLiteral("cwd"), QStringLiteral("/srv/slopcode/packages/protocol"));
  ptyOpen.insert(QStringLiteral("rows"), 40);
  ptyOpen.insert(QStringLiteral("cols"), 120);
  frames << ptyOpen;

  QJsonObject ptyOpened = responseBase(QStringLiteral("pty.opened"));
  ptyOpened.insert(QStringLiteral("ptyID"), QStringLiteral("pty_remote_1"));
  ptyOpened.insert(QStringLiteral("rows"), 40);
  ptyOpened.insert(QStringLiteral("cols"), 120);
  frames << ptyOpened;

  QJsonObject ptyInput = requestBase(QStringLiteral("pty.input"));
  ptyInput.insert(QStringLiteral("ptyID"), QStringLiteral("pty_remote_1"));
  ptyInput.insert(QStringLiteral("chunk"), body(QStringLiteral("ls\n")));
  frames << ptyInput;

  QJsonObject ptyResize = requestBase(QStringLiteral("pty.resize"));
  ptyResize.insert(QStringLiteral("ptyID"), QStringLiteral("pty_remote_1"));
  ptyResize.insert(QStringLiteral("rows"), 50);
  ptyResize.insert(QStringLiteral("cols"), 140);
  frames << ptyResize;

  QJsonObject ptyOutput = streamBase(QStringLiteral("pty.output"));
  ptyOutput.insert(QStringLiteral("ptyID"), QStringLiteral("pty_remote_1"));
  ptyOutput.insert(QStringLiteral("sequence"), 0);
  ptyOutput.insert(QStringLiteral("chunk"), body(QStringLiteral("ready\n")));
  ptyOutput.insert(QStringLiteral("final"), false);
  frames << ptyOutput;

  QJsonObject ptyClose = requestBase(QStringLiteral("pty.close"));
  ptyClose.insert(QStringLiteral("ptyID"), QStringLiteral("pty_remote_1"));
  frames << ptyClose;

  QJsonObject ptyClosed = responseBase(QStringLiteral("pty.closed"));
  ptyClosed.insert(QStringLiteral("ptyID"), QStringLiteral("pty_remote_1"));
  ptyClosed.insert(QStringLiteral("exitCode"), 0);
  frames << ptyClosed;

  QJsonObject approval = eventBase(QStringLiteral("approval.request"));
  approval.insert(QStringLiteral("notificationID"), QStringLiteral("ntf_approval_1"));
  approval.insert(QStringLiteral("requestID"), QStringLiteral("req_http_1"));
  approval.insert(QStringLiteral("action"), QStringLiteral("shell"));
  approval.insert(QStringLiteral("resources"), QJsonArray{QStringLiteral("bash -lc\nprintf ready")});
  approval.insert(QStringLiteral("reason"), QStringLiteral("The session requested a shell command"));
  frames << approval;

  QJsonObject question = eventBase(QStringLiteral("question.request"));
  question.insert(QStringLiteral("notificationID"), QStringLiteral("ntf_question_1"));
  question.insert(QStringLiteral("questions"), QJsonArray{QJsonObject{
    {QStringLiteral("question"), QStringLiteral("Continue?")},
    {QStringLiteral("header"), QStringLiteral("Confirm")},
    {QStringLiteral("options"), QJsonArray{QJsonObject{{QStringLiteral("label"), QStringLiteral("Yes")},
                                                        {QStringLiteral("value"), QStringLiteral("yes")}}}},
    {QStringLiteral("multiple"), false},
  }});
  frames << question;

  QJsonObject approvalReply = requestBase(QStringLiteral("approval.reply"));
  approvalReply.insert(QStringLiteral("notificationID"), QStringLiteral("ntf_approval_1"));
  approvalReply.insert(QStringLiteral("reply"), QStringLiteral("once"));
  frames << approvalReply;

  QJsonObject questionReply = requestBase(QStringLiteral("question.reply"));
  questionReply.insert(QStringLiteral("notificationID"), QStringLiteral("ntf_question_1"));
  questionReply.insert(QStringLiteral("answers"), QJsonArray{QJsonArray{QStringLiteral("yes\n")}});
  frames << questionReply;

  QJsonObject questionReject = requestBase(QStringLiteral("question.reject"));
  questionReject.insert(QStringLiteral("notificationID"), QStringLiteral("ntf_question_1"));
  frames << questionReject;

  QJsonObject opened = responseBase(QStringLiteral("session.opened"));
  opened.insert(QStringLiteral("sessionID"), QStringLiteral("ses_remote_1"));
  opened.insert(QStringLiteral("capabilities"), QJsonObject{{QStringLiteral("accepted"), capabilities().value(QStringLiteral("offered"))}});
  frames << opened;

  QJsonObject closed = responseBase(QStringLiteral("session.closed"));
  closed.insert(QStringLiteral("sessionID"), QStringLiteral("ses_remote_1"));
  frames << closed;

  QJsonObject replayEvent = eventBase(QStringLiteral("event"));
  replayEvent.insert(QStringLiteral("cursor"), QStringLiteral("cur_events_3"));
  replayEvent.insert(QStringLiteral("event"), QStringLiteral("session.message"));
  replayEvent.insert(QStringLiteral("data"), body(QStringLiteral("replayed")));
  QJsonObject replayResponse = responseBase(QStringLiteral("event.replay"));
  replayResponse.insert(QStringLiteral("events"), QJsonArray{replayEvent});
  replayResponse.insert(QStringLiteral("hasMore"), false);
  frames << replayResponse;

  QJsonObject error{
    {QStringLiteral("version"), QStringLiteral("v1")},
    {QStringLiteral("kind"), QStringLiteral("error")},
    {QStringLiteral("type"), QStringLiteral("error")},
    {QStringLiteral("requestID"), QStringLiteral("req_http_1")},
    {QStringLiteral("idempotencyKey"), QStringLiteral("idem_base_1")},
    {QStringLiteral("requestDigest"), QString(64, QChar('a'))},
    {QStringLiteral("target"), target()},
    {QStringLiteral("code"), QStringLiteral("out_of_scope")},
    {QStringLiteral("message"), QStringLiteral("The selected workspace does not own this path")},
    {QStringLiteral("retryable"), false},
    {QStringLiteral("details"), QJsonObject{{QStringLiteral("boundary"), QStringLiteral("remoteDirectory")}}},
  };
  frames << error;

  for (const QJsonObject &frame : frames) {
    const ParseResult result = parseFrame(QJsonDocument(frame).toJson(QJsonDocument::Compact));
    QVERIFY2(result, qPrintable(result.error));
  }
}

void FrameTest::roundTripsEncodedFrame()
{
  const QJsonObject source = sessionOpen();
  Frame frame(source);
  QString error;
  const QByteArray encoded = encodeFrame(frame, &error);
  QVERIFY2(!encoded.isEmpty(), qPrintable(error));
  const ParseResult decoded = parseFrame(encoded);
  QVERIFY2(decoded, qPrintable(decoded.error));
  QCOMPARE(decoded.frame->type, QStringLiteral("session.open"));
  QCOMPARE(decoded.frame->object, source);
}

void FrameTest::rejectsUnknownFieldsAndLegacyEnvelope()
{
  QJsonObject unknown = sessionOpen();
  unknown.insert(QStringLiteral("payload"), QJsonObject{{QStringLiteral("operation"), QStringLiteral("health")} });
  QVERIFY(!parseFrame(QJsonDocument(unknown).toJson(QJsonDocument::Compact)));

  QJsonObject nested = sessionOpen();
  QJsonObject proof = nested.value(QStringLiteral("auth")).toObject().value(QStringLiteral("proof")).toObject();
  proof.insert(QStringLiteral("unexpected"), true);
  QJsonObject auth = nested.value(QStringLiteral("auth")).toObject();
  auth.insert(QStringLiteral("proof"), proof);
  nested.insert(QStringLiteral("auth"), auth);
  QVERIFY(!parseFrame(QJsonDocument(nested).toJson(QJsonDocument::Compact)));

  QJsonObject invalidProof = sessionOpen();
  QJsonObject invalidAuth = invalidProof.value(QStringLiteral("auth")).toObject();
  QJsonObject proofValue = invalidAuth.value(QStringLiteral("proof")).toObject();
  proofValue.insert(QStringLiteral("signature"), QStringLiteral("not-a-signature"));
  invalidAuth.insert(QStringLiteral("proof"), proofValue);
  invalidProof.insert(QStringLiteral("auth"), invalidAuth);
  QVERIFY(!parseFrame(QJsonDocument(invalidProof).toJson(QJsonDocument::Compact)));

  QJsonObject missingCapabilities = sessionOpen();
  missingCapabilities.remove(QStringLiteral("capabilities"));
  QVERIFY(!parseFrame(QJsonDocument(missingCapabilities).toJson(QJsonDocument::Compact)));

  QJsonObject targetValue = target();
  targetValue.insert(QStringLiteral("type"), QStringLiteral("remote"));
  targetValue.insert(QStringLiteral("url"), QStringLiteral("http://127.0.0.1:43123"));
  QJsonObject wrongTarget = sessionOpen();
  wrongTarget.insert(QStringLiteral("target"), targetValue);
  QVERIFY(!parseFrame(QJsonDocument(wrongTarget).toJson(QJsonDocument::Compact)));

  QJsonObject opened = responseBase(QStringLiteral("session.opened"));
  opened.insert(QStringLiteral("sessionID"), QStringLiteral("ses_remote_1"));
  QVERIFY(!parseFrame(QJsonDocument(opened).toJson(QJsonDocument::Compact)));

  QJsonObject invalidDetails{
    {QStringLiteral("version"), QStringLiteral("v1")},
    {QStringLiteral("kind"), QStringLiteral("error")},
    {QStringLiteral("type"), QStringLiteral("error")},
    {QStringLiteral("code"), QStringLiteral("bad_request")},
    {QStringLiteral("message"), QStringLiteral("invalid details")},
    {QStringLiteral("retryable"), false},
    {QStringLiteral("details"), QJsonObject{{QStringLiteral("apiKey"), QStringLiteral("not-allowed")}}},
  };
  QVERIFY(!parseFrame(QJsonDocument(invalidDetails).toJson(QJsonDocument::Compact)));
}

void FrameTest::rejectsUnsafeScopePathsAndBodies()
{
  QJsonObject wrong = sessionOpen();
  QJsonObject badTarget = target();
  badTarget.insert(QStringLiteral("remoteDirectory"), QStringLiteral("/srv/slopcode/../secrets"));
  wrong.insert(QStringLiteral("target"), badTarget);
  QVERIFY(!parseFrame(QJsonDocument(wrong).toJson(QJsonDocument::Compact)));

  QJsonObject request = requestBase(QStringLiteral("http.request"));
  request.insert(QStringLiteral("method"), QStringLiteral("GET"));
  request.insert(QStringLiteral("path"), QStringLiteral("/api%2f..%2fetc"));
  QVERIFY(!parseFrame(QJsonDocument(request).toJson(QJsonDocument::Compact)));

  request.insert(QStringLiteral("path"), QStringLiteral("/api/location"));
  request.insert(QStringLiteral("query"), QStringLiteral("a=%ZZ"));
  QVERIFY(!parseFrame(QJsonDocument(request).toJson(QJsonDocument::Compact)));

  request.remove(QStringLiteral("query"));
  request.insert(QStringLiteral("body"), QJsonObject{{QStringLiteral("encoding"), QStringLiteral("base64")},
                                                      {QStringLiteral("data"), QStringLiteral("Zm8")}});
  QVERIFY(!parseFrame(QJsonDocument(request).toJson(QJsonDocument::Compact)));
  request.insert(QStringLiteral("body"), body(QString(64 * 1024 + 1, QChar('x'))));
  QVERIFY(!parseFrame(QJsonDocument(request).toJson(QJsonDocument::Compact)));

  QJsonObject approval = eventBase(QStringLiteral("approval.request"));
  approval.insert(QStringLiteral("notificationID"), QStringLiteral("ntf_approval_1"));
  approval.insert(QStringLiteral("action"), QStringLiteral("shell"));
  approval.insert(QStringLiteral("resources"), QJsonArray{QString()});
  approval.insert(QStringLiteral("reason"), QStringLiteral("needs approval"));
  QVERIFY(!parseFrame(QJsonDocument(approval).toJson(QJsonDocument::Compact)));

  QJsonObject question = requestBase(QStringLiteral("question.reply"));
  question.insert(QStringLiteral("notificationID"), QStringLiteral("ntf_question_1"));
  question.insert(QStringLiteral("answers"), QJsonArray{QJsonArray{QString()}});
  QVERIFY(!parseFrame(QJsonDocument(question).toJson(QJsonDocument::Compact)));
}

void FrameTest::rejectsDuplicateOversizedAndDeepFrames()
{
  const QByteArray duplicate = QByteArrayLiteral(
    R"({"version":"v1","kind":"request","type":"event.replay","requestID":"req_demo-1","requestID":"req_demo-2","idempotencyKey":"idem_demo","requestDigest":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","target":{"hostID":"hst_desktop","pairingID":"pair_android","workspaceID":"wrk_slopcode","remoteDirectory":"/srv/slopcode"},"limit":1})");
  QVERIFY(!parseFrame(duplicate));

  QByteArray oversized = validFrame();
  const QByteArray signature(86, 'A');
  oversized.replace(oversized.indexOf(signature), signature.size(), QByteArray(270 * 1024, 'x'));
  QCOMPARE(parseFrame(oversized).error, QStringLiteral("frame exceeds maximum size"));

  QByteArray deep = QByteArrayLiteral("{");
  for (int index = 0; index < kMaxJsonDepth + 4; ++index) deep += QByteArrayLiteral("\"a\":{");
  deep += QByteArrayLiteral("true");
  for (int index = 0; index < kMaxJsonDepth + 4; ++index) deep += QByteArrayLiteral("}");
  deep += QByteArrayLiteral("}");
  QVERIFY(!parseFrame(deep));
  QCOMPARE(parseFrame(deep).error, QStringLiteral("JSON nesting is too deep"));
}

void FrameTest::validatesDigestsCapabilitiesIdempotencyAndStreams()
{
  for (const QString &query : {QStringLiteral("a=%2fetc"), QStringLiteral("a=%252e%252e"),
                               QStringLiteral("a=%2e%2e"), QStringLiteral("a=%26b%3Dc"),
                               QStringLiteral("q=hello+world")}) {
    QJsonObject queryRequest = requestBase(QStringLiteral("http.request"));
    queryRequest.insert(QStringLiteral("method"), QStringLiteral("GET"));
    queryRequest.insert(QStringLiteral("path"), QStringLiteral("/api/query"));
    queryRequest.insert(QStringLiteral("query"), query);
    const ParseResult result = parseFrame(QJsonDocument(queryRequest).toJson(QJsonDocument::Compact));
    QVERIFY2(result, qPrintable(result.error));
  }

  QJsonObject replayEvent = eventBase(QStringLiteral("event"));
  replayEvent.insert(QStringLiteral("cursor"), QStringLiteral("cur_replay_1"));
  replayEvent.insert(QStringLiteral("event"), QStringLiteral("session.message"));
  replayEvent.insert(QStringLiteral("data"), body(QStringLiteral("one")));
  QJsonObject replay = responseBase(QStringLiteral("event.replay"));
  replay.insert(QStringLiteral("events"), QJsonArray{replayEvent, replayEvent});
  replay.insert(QStringLiteral("hasMore"), false);
  QVERIFY(!parseFrame(QJsonDocument(replay).toJson(QJsonDocument::Compact)));
  replay.insert(QStringLiteral("events"), QJsonArray{replayEvent});
  replay.insert(QStringLiteral("nextCursor"), QStringLiteral("cur_replay_1"));
  QVERIFY(!parseFrame(QJsonDocument(replay).toJson(QJsonDocument::Compact)));

  QJsonObject request = requestBase(QStringLiteral("http.request"), QStringLiteral("req_digest_1"));
  request.insert(QStringLiteral("method"), QStringLiteral("POST"));
  request.insert(QStringLiteral("path"), QStringLiteral("/api/message"));
  request.insert(QStringLiteral("body"), body(QStringLiteral("hello")));
  QString error;
  const std::optional<QString> digest = computeRemoteRequestDigest(request, &error);
  QVERIFY2(digest.has_value(), qPrintable(error));
  request.insert(QStringLiteral("requestDigest"), *digest);
  QVERIFY2(verifyRemoteRequestDigest(request, &error), qPrintable(error));
  QVERIFY(computeRemoteTargetDigest(target(), &error).has_value());
  const std::optional<QByteArray> transcript = remoteTransportSessionProofTranscript(sessionOpen(), &error);
  QVERIFY2(transcript.has_value(), qPrintable(error));
  QVERIFY(transcript->contains("slopcode-remote-v1"));
  QVERIFY(remoteTransportCapabilitiesMatch(capabilities(), QJsonObject{
    {QStringLiteral("accepted"), capabilities().value(QStringLiteral("offered"))}}, &error));

  RemoteIdempotencyStore store(2, 1000);
  const RemoteIdempotencyClaim accepted = store.claim(QStringLiteral("ses_remote_1"), target(), target(),
                                                      QStringLiteral("idem_stream_1"), QString(64, QChar('a')), 100);
  QVERIFY(accepted.status == RemoteIdempotencyStatus::Accepted);
  QVERIFY(store.claim(QStringLiteral("ses_remote_1"), target(), target(), QStringLiteral("idem_stream_1"),
                      QString(64, QChar('a')), 101)
            .status == RemoteIdempotencyStatus::Replay);
  QVERIFY(store.claim(QStringLiteral("ses_remote_1"), target(), target(), QStringLiteral("idem_stream_1"),
                      QString(64, QChar('b')), 102)
            .status == RemoteIdempotencyStatus::Conflict);
  QVERIFY(store.complete(QStringLiteral("ses_remote_1"), target(), target(), QStringLiteral("idem_stream_1"),
                         QString(64, QChar('a')), 103));
  QVERIFY(!store.release(QStringLiteral("ses_remote_1"), target(), target(), QStringLiteral("idem_stream_1"),
                         QString(64, QChar('a')), 104));

  const std::optional<RemoteStreamState> uploadState = createRemoteUploadStreamState(3);
  QVERIFY(uploadState.has_value());
  RemoteStreamState state = *uploadState;
  QJsonObject first = streamBase(QStringLiteral("http.upload.chunk"), QStringLiteral("req_upload_1"));
  first.insert(QStringLiteral("sequence"), 0);
  first.insert(QStringLiteral("chunk"), body(QStringLiteral("ab")));
  first.insert(QStringLiteral("final"), false);
  const ParseResult firstResult = parseFrame(QJsonDocument(first).toJson(QJsonDocument::Compact));
  QVERIFY2(firstResult, qPrintable(firstResult.error));
  QVERIFY2(advanceRemoteStream(state, *firstResult.frame, &error), qPrintable(error));
  QVERIFY(acknowledgeRemoteStream(state, 1, &error));
  QJsonObject second = first;
  second.insert(QStringLiteral("sequence"), 1);
  second.insert(QStringLiteral("chunk"), body(QStringLiteral("c")));
  second.insert(QStringLiteral("final"), true);
  const ParseResult secondResult = parseFrame(QJsonDocument(second).toJson(QJsonDocument::Compact));
  QVERIFY2(secondResult, qPrintable(secondResult.error));
  QVERIFY2(advanceRemoteStream(state, *secondResult.frame, &error), qPrintable(error));
  QVERIFY(remoteStreamComplete(state));
}

void FrameTest::validatesSessionNegotiationBindings()
{
  QJsonObject opened = responseBase(QStringLiteral("session.opened"), QStringLiteral("req_open_1"));
  opened.insert(QStringLiteral("sessionID"), QStringLiteral("ses_remote_1"));
  opened.insert(QStringLiteral("capabilities"), QJsonObject{{QStringLiteral("accepted"), capabilities().value(QStringLiteral("offered"))}});

  QString error;
  QVERIFY2(remoteTransportSessionOpenedMatches(sessionOpen(), opened, &error), qPrintable(error));

  QJsonObject mismatch = opened;
  mismatch.insert(QStringLiteral("requestID"), QStringLiteral("req_other_1"));
  QVERIFY(!remoteTransportSessionOpenedMatches(sessionOpen(), mismatch, &error));
  mismatch = opened;
  mismatch.insert(QStringLiteral("idempotencyKey"), QStringLiteral("idem_other_1"));
  QVERIFY(!remoteTransportSessionOpenedMatches(sessionOpen(), mismatch, &error));
  mismatch = opened;
  mismatch.insert(QStringLiteral("requestDigest"), QString(64, QChar('b')));
  QVERIFY(!remoteTransportSessionOpenedMatches(sessionOpen(), mismatch, &error));
  mismatch = opened;
  QJsonObject otherTarget = target();
  otherTarget.insert(QStringLiteral("remoteDirectory"), QStringLiteral("/srv/other"));
  mismatch.insert(QStringLiteral("target"), otherTarget);
  QVERIFY(!remoteTransportSessionOpenedMatches(sessionOpen(), mismatch, &error));
  mismatch = opened;
  mismatch.insert(QStringLiteral("capabilities"), QJsonObject{{QStringLiteral("accepted"), QJsonArray{QStringLiteral("frame.bounds.v1")}}});
  QVERIFY(!remoteTransportSessionOpenedMatches(sessionOpen(), mismatch, &error));
}

void FrameTest::hardensLocalForwarding()
{
  LocalSlopcodeForwarder forwarder;
  QString error;
  QVERIFY(!forwarder.setBaseURL(QUrl(QStringLiteral("http://localhost:43123")), &error));
  QVERIFY(!forwarder.setBaseURL(QUrl(QStringLiteral("http://127.0.0.2:43123")), &error));
  QVERIFY(forwarder.setBaseURL(QUrl(QStringLiteral("http://127.0.0.1:43123")), &error));
  QVERIFY(forwarder.forwardHTTP(QByteArrayLiteral("TRACE"), QStringLiteral("/"), {}, {}, &error) == nullptr);
  QVERIFY(forwarder.forwardHTTP(QByteArrayLiteral("GET"), QStringLiteral("/api/%2e%2e/secrets"), {}, {}, &error) == nullptr);
  QVERIFY(forwarder.forwardHTTP(QByteArrayLiteral("GET"), QStringLiteral("/api/%252e%252e"), {}, {}, &error) == nullptr);
  QVERIFY(forwarder.forwardHTTP(QByteArrayLiteral("GET"), QStringLiteral("/api"), {},
                                Headers{{QByteArrayLiteral("Connection"), QByteArrayLiteral("close")}}, &error) == nullptr);
  QVERIFY(forwarder.forwardWebSocket(QStringLiteral("/api/%2f.."), {}, &error) == nullptr);
  QVERIFY(forwarder.forwardHTTPWithQuery(QByteArrayLiteral("GET"), QStringLiteral("/api"), QStringLiteral("q=hello+world"),
                                         {}, {}, &error) != nullptr);
  QVERIFY(forwarder.forwardHTTPWithQuery(QByteArrayLiteral("GET"), QStringLiteral("/api"), QStringLiteral("q=%23"),
                                         {}, {}, &error) == nullptr);

  const QUrl origin(QStringLiteral("http://127.0.0.1:43123"));
  QUrl resolved;
  QVERIFY2(LocalSlopcodeForwarder::validateRedirectLocation(origin, QByteArrayLiteral("/api/next?q=1"), &resolved, &error),
           qPrintable(error));
  QCOMPARE(resolved, QUrl(QStringLiteral("http://127.0.0.1:43123/api/next?q=1")));
  for (const QByteArray &location : {
         QByteArrayLiteral("../secrets"),
         QByteArrayLiteral("/api/../secrets"),
         QByteArrayLiteral("/api/%2e%2e/secrets"),
         QByteArrayLiteral("/api?next=%23"),
         QByteArrayLiteral("http://127.0.0.2:43123/api"),
         QByteArrayLiteral("http://127.0.0.1:43123/api/../secrets"),
       }) {
    QVERIFY(!LocalSlopcodeForwarder::validateRedirectLocation(origin, location, &resolved, &error));
  }
}

void FrameTest::followsValidatedHttpRedirects()
{
  QTcpServer server;
  QVERIFY(server.listen(QHostAddress::LocalHost, 0));

  int redirectRequests = 0;
  int unsafeRequests = 0;
  int finalRequests = 0;
  connect(&server, &QTcpServer::newConnection, &server, [&server, &redirectRequests, &unsafeRequests, &finalRequests] {
    while (server.hasPendingConnections()) {
      QTcpSocket *socket = server.nextPendingConnection();
      connect(socket, &QTcpSocket::readyRead, socket,
              [socket, &redirectRequests, &unsafeRequests, &finalRequests, request = QByteArray()]() mutable {
                request += socket->readAll();
                if (!request.contains(QByteArrayLiteral("\r\n\r\n"))) {
                  return;
                }

                if (request.startsWith(QByteArrayLiteral("GET /redirect "))) {
                  ++redirectRequests;
                  socket->write(QByteArrayLiteral(
                    "HTTP/1.1 302 Found\r\nLocation: /final\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"));
                } else if (request.startsWith(QByteArrayLiteral("GET /unsafe "))) {
                  ++unsafeRequests;
                  socket->write(QByteArrayLiteral(
                    "HTTP/1.1 302 Found\r\nLocation: http://127.0.0.2/final\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"));
                } else if (request.startsWith(QByteArrayLiteral("GET /final "))) {
                  ++finalRequests;
                  const QByteArray response = QByteArrayLiteral("redirected");
                  socket->write(QByteArrayLiteral("HTTP/1.1 200 OK\r\nContent-Length: "));
                  socket->write(QByteArray::number(response.size()));
                  socket->write(QByteArrayLiteral("\r\nConnection: close\r\n\r\n"));
                  socket->write(response);
                }
                socket->disconnectFromHost();
              });
    }
  });

  LocalSlopcodeForwarder forwarder(QUrl(QStringLiteral("http://127.0.0.1:%1").arg(server.serverPort())));
  QString error;
  QNetworkReply *reply = forwarder.forwardHTTP(QByteArrayLiteral("GET"), QStringLiteral("/redirect"), {}, {}, &error);
  QVERIFY2(reply != nullptr, qPrintable(error));
  QTRY_VERIFY_WITH_TIMEOUT(reply->isFinished(), 3000);
  QCOMPARE(reply->error(), QNetworkReply::NoError);
  QCOMPARE(reply->readAll(), QByteArrayLiteral("redirected"));
  QCOMPARE(redirectRequests, 1);
  QCOMPARE(finalRequests, 1);
  delete reply;

  QNetworkReply *unsafeReply = forwarder.forwardHTTP(QByteArrayLiteral("GET"), QStringLiteral("/unsafe"), {}, {}, &error);
  QVERIFY2(unsafeReply != nullptr, qPrintable(error));
  QTRY_VERIFY_WITH_TIMEOUT(unsafeReply->isFinished(), 3000);
  QVERIFY(unsafeReply->error() != QNetworkReply::NoError);
  QCOMPARE(unsafeRequests, 1);
  QCOMPARE(finalRequests, 1);
  delete unsafeReply;
}

void FrameTest::requestsAnOsAssignedSshPort()
{
  SshTarget targetValue;
  targetValue.host = QStringLiteral("example.invalid");
  targetValue.user = QStringLiteral("remote");
  targetValue.remoteFolder = QStringLiteral("/srv/slopcode");
  targetValue.remotePort = 43123;
  targetValue.knownHostsPath = QStringLiteral("/tmp/slopcode-known-hosts");

  QString error;
  const QStringList arguments = buildSshTunnelArguments(targetValue, targetValue.knownHostsPath, 0, &error);
  QVERIFY2(!arguments.isEmpty(), qPrintable(error));
  QVERIFY(arguments.contains(QStringLiteral("-v")));
  QVERIFY(arguments.contains(QStringLiteral("127.0.0.1:0:127.0.0.1:43123")));
  QVERIFY(buildSshTunnelArguments(targetValue, targetValue.knownHostsPath, 43124, &error).isEmpty());
  QVERIFY(!validateRemoteFolder(QStringLiteral("/srv/slopcode/../secrets"), &error));
}

void FrameTest::makesSshTeardownIdempotent()
{
  SshTargetSupervisor supervisor;
  supervisor.stop();
  QCOMPARE(supervisor.state(), SshState::Stopped);
  QCOMPARE(supervisor.localPort(), quint16(0));
  supervisor.stop();
  QCOMPARE(supervisor.state(), SshState::Stopped);
  QCOMPARE(supervisor.localPort(), quint16(0));
}

void FrameTest::restartsAfterSshFailure()
{
#ifdef Q_OS_WIN
  QSKIP("the deterministic OpenSSH test helper requires a POSIX shell");
#else
  QTemporaryDir directory;
  QVERIFY(directory.isValid());

  const QString scriptPath = directory.filePath(QStringLiteral("ssh"));
  QFile script(scriptPath);
  QVERIFY(script.open(QIODevice::WriteOnly));
  QVERIFY(script.write(R"(#!/bin/sh
state="$0.count"
known_hosts="$0.known_hosts_path"
is_tunnel=0
for arg in "$@"; do
  case "$arg" in
    UserKnownHostsFile=*) printf '%s\n' "${arg#UserKnownHostsFile=}" > "$known_hosts" ;;
    -N) is_tunnel=1 ;;
  esac
done
if [ -f "$state" ]; then
  count=$(cat "$state")
else
  count=0
fi
count=$((count + 1))
printf '%s\n' "$count" > "$state"
if [ "$count" -eq 1 ]; then
  exit 1
fi
if [ "$is_tunnel" -eq 1 ]; then
  exec tail -f /dev/null
fi
cat >/dev/null
exec tail -f /dev/null
)
"));
  QVERIFY(script.setPermissions(QFileDevice::ReadOwner | QFileDevice::WriteOwner | QFileDevice::ExeOwner));
  script.close();
  ScopedPath path(directory.path().toLocal8Bit());

  SshTarget targetValue;
  targetValue.host = QStringLiteral("127.0.0.1");
  targetValue.user = QStringLiteral("remote");
  targetValue.remoteFolder = QStringLiteral("/srv/slopcode");
  targetValue.remotePort = 43123;
  targetValue.pinnedHostKey = QStringLiteral("ssh-ed25519 AAAA");

  SshTargetSupervisor supervisor;
  bool restarted = false;
  bool restartSucceeded = false;
  QString restartError;
  connect(&supervisor, &SshTargetSupervisor::failed, &supervisor, [&] {
    if (restarted) {
      return;
    }
    restarted = true;
    supervisor.stop();
    restartSucceeded = supervisor.start(targetValue, &restartError);
  });

  QString error;
  QVERIFY2(supervisor.start(targetValue, &error), qPrintable(error));
  QTRY_VERIFY_WITH_TIMEOUT(restarted, 5000);
  QVERIFY2(restartSucceeded, qPrintable(restartError));

  QFile countFile(scriptPath + QStringLiteral(".count"));
  auto count = [&countFile] {
    if (!countFile.isOpen() && !countFile.open(QIODevice::ReadOnly)) {
      return 0;
    }
    countFile.seek(0);
    bool ok = false;
    const int value = countFile.readAll().trimmed().toInt(&ok);
    return ok ? value : 0;
  };
  QTRY_VERIFY_WITH_TIMEOUT(count() >= 3, 5000);

  QFile knownHostsFile(scriptPath + QStringLiteral(".known_hosts_path"));
  QVERIFY(knownHostsFile.open(QIODevice::ReadOnly));
  const QString knownHostsPath = QString::fromLocal8Bit(knownHostsFile.readAll()).trimmed();
  QVERIFY(!knownHostsPath.isEmpty());
  QVERIFY2(QFileInfo::exists(knownHostsPath), qPrintable(knownHostsPath));
  QCOMPARE(supervisor.state(), SshState::Starting);
  QCOMPARE(supervisor.remotePort(), targetValue.remotePort);

  supervisor.stop();
  QCOMPARE(supervisor.state(), SshState::Stopped);
  QVERIFY(!QFileInfo::exists(knownHostsPath));
#endif
}

QTEST_MAIN(FrameTest)
#include "frame_test.moc"
