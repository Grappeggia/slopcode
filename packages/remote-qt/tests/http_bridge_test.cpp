#include <slopcode/remoteqt/http_bridge.h>
#include <slopcode/remoteqt/local_forwarder.h>
#include <slopcode/remoteqt/session.h>

#include <QHash>
#include <QHostAddress>
#include <QJsonArray>
#include <QJsonDocument>
#include <QNetworkReply>
#include <QPointer>
#include <QSignalSpy>
#include <QSslCertificate>
#include <QSslConfiguration>
#include <QSslKey>
#include <QSslSocket>
#include <QTcpServer>
#include <QTcpSocket>
#include <QUrl>
#include <QWebSocket>
#include <QWebSocketServer>
#include <QtTest/QtTest>

using namespace slopcode::remoteqt;

namespace {

constexpr auto kCertificate = R"(-----BEGIN CERTIFICATE-----
MIIDGjCCAgKgAwIBAgIUBi56hwfEwVguTZYGmOsrhPDiaPYwDQYJKoZIhvcNAQEL
BQAwFDESMBAGA1UEAwwJMTI3LjAuMC4xMB4XDTI2MDgwMTIyMjAzMloXDTM2MDcy
OTIyMjAzMlowFDESMBAGA1UEAwwJMTI3LjAuMC4xMIIBIjANBgkqhkiG9w0BAQEF
AAOCAQ8AMIIBCgKCAQEA0bGzIUfwCVnYfyWPYTWKC4gjgvpiPJskZPNyK5k+Bu7h
KgPoLadfvBbizlwwXFZ8IOe2EaBp1Ct2uXvK7tp/7oQA75yYkgwIzm+f08rZQvAX
4IbsM05WhQgDmvQGQ0BdDSmdXNMnl5mkz0yBk0t8t9jrz6+zh7C19txaO12HkD6Y
mKESsDH140+V9TnpUSahv+A11e1dqQPKpt+eqGTZ5VfrdaP4HwlE7zqoxG7Z/FHQ
aelnieWxqtfcde86+boMlTlFxNQxvO34nAtiHCMSwqhzmx1NMhVHUhtFJIBolB/G
UKH110q7kxBmsTmMTCX/MfxLy9isB7D+ZutTxrlqjwIDAQABo2QwYjAdBgNVHQ4E
FgQUcwBOhr/JJbIBl4ZspLAbTPe9c/MwHwYDVR0jBBgwFoAUcwBOhr/JJbIBl4Zs
pLAbTPe9c/MwDwYDVR0TAQH/BAUwAwEB/zAPBgNVHREECDAGhwR/AAABMA0GCSqG
SIb3DQEBCwUAA4IBAQAFEHqicLQFrhDBZXy5acQyaVAy7ZD/7QW3zUC58uauPnE1
NbxIuM6IuH5EPxOuf57MzHCOXti9E2822xijGz3KZg816oa/KKdjSoZq4+P+iyoM
eiVpGOU+aAaIJLDgOcVS3P3XhCyCzqYvItv86roNn8lmHsuynsKbC85TuBw0ywO1
cciXYdJfGgPo3at8g4J96DOEDlzUdz/Zpq5xMtzgdOmOAi8DERd4kDv5QbhKCDW7
fgWOMoL68Xf+cAqK1ntLCp8ZU+tx8WtDZLbgE+s4Ctj/2i2XZ28sUjCPLBYjozPl
EiLv3m+7Mk2lg9RJvkPe60wmcDvpUntYDWfghATh
-----END CERTIFICATE-----
)";

constexpr auto kKey = R"(-----BEGIN PRIVATE KEY-----
MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQDRsbMhR/AJWdh/
JY9hNYoLiCOC+mI8myRk83IrmT4G7uEqA+gtp1+8FuLOXDBcVnwg57YRoGnUK3a5
e8ru2n/uhADvnJiSDAjOb5/TytlC8BfghuwzTlaFCAOa9AZDQF0NKZ1c0yeXmaTP
TIGTS3y32OvPr7OHsLX23Fo7XYeQPpiYoRKwMfXjT5X1OelRJqG/4DXV7V2pA8qm
356oZNnlV+t1o/gfCUTvOqjEbtn8UdBp6WeJ5bGq19x17zr5ugyVOUXE1DG87fic
C2IcIxLCqHObHU0yFUdSG0UkgGiUH8ZQofXXSruTEGaxOYxMJf8x/EvL2KwHsP5m
61PGuWqPAgMBAAECggEAAKnaXkxt+hiWeL52AWly82xNfMXiNPYoJJmSFyMjRyEf
3ye9LyjEV/Cb5ipzN6enxyIoSNS9rKHwYS0oA+DFS3LBml7u0a5HB0h1ugbuM3jl
9+Ee4sc8ZmjSziyvV/D8TkVj3prvwPk77A5D3y2tYUiHkSkzdznbsbDunQfuBos2
REGeeutxVGPlufkuNtr1nD+ZCXhUCr+QXiV3ac0XL8B/QrG3Fst0Gfrq/e/klTJG
mRn8gdrK4HE3jc0uwEIRmTx220CWw35z9TbmGFpbsvJLVlWQxBCr8CDBYXi+I5GM
4273Ss6pSQmhEYRcwHg4/rZV8JBIPzxAb8E8k10bYQKBgQDoCjReAJcWLsf5yRJZ
EfCDxNSPvTFR++Rsc7JKHJYiWq33VYd8qm4WKWkM1Ql3suCS1okVaHBax3ixsFmr
AvCSADacWZz/JqwPVtDezRXrEywaMAESDu4UkUbGhB7PMVyTodz6TMvBkVKCojSM
o5pLPuCW/8xtDByKlnE6Qz+Y4QKBgQDnWM2c+l9EFtttTK9lMomkGoDMwdXogtZm
CvECe/OQkoDvQbg5dH/sUjQC8+tFe4UjnbGZu5R/p+uGt2soUUyNqidcq25ux400
t++3bhxFXSnDmSkBEocowLSGCoaBQ3SZkkLUyHFCI0zE7Le0nNZK7phHi14rYdOs
45KISfVBbwKBgQCIOz2FlxkdV/fmiguwqZyo8E3P2kbzmE0C82ZQprnqj4ylstxp
7/HUJxnbA9ScJzQ8YaJ4JCoa0hPlVuE+SuqM/X0SjHZlQwIvu0vEE2pz6nyxH0/x
lzxmbOi9smIYSSXOM3D2r1HNYpGryqnJjGARH2hinuoZd8vl/e+aQlM7YQKBgQDE
w2a9qMT16GrgX2SeMYmXpWL+w63nf8BSMeQiNMJHqBM5azAAzfEvUgsip8rm4dOv
IyQ2mLAIkw1jGwVs2Ri/NIUd8ECQv/B9ciPUYzZwWHh4//88BkImix//EVys/G5j
X16wE3sgwV098Aee+fXY7W1fDE4fn6ilVzj96clKyQKBgQDSo0aeu2Rsas17zE4t
Bl91+NVgawUFxxejV0zz1N0ROAZh78Dmj7iJZsA/2npqo/FHpQckXW4B8kZRHJFU
NQmI3XGT82QWMZmJxTPmQJZCAHq0Ee/EDzIyPzKRW5MIyLW/XcYXpBymOOrbKgHh
G4cDcaYFyQ/0fEqrJogFHtdyTA==
-----END PRIVATE KEY-----
)";

QSslCertificate certificate()
{
  return QSslCertificate(QByteArray(kCertificate));
}

QSslConfiguration tls()
{
  QSslConfiguration result = QSslConfiguration::defaultConfiguration();
  result.setCaCertificates({certificate()});
  return result;
}

QJsonObject target(const QString &workspace = QStringLiteral("wrk_slopcode"))
{
  return QJsonObject{
    {QStringLiteral("hostID"), QStringLiteral("hst_desktop")},
    {QStringLiteral("pairingID"), QStringLiteral("pair_android")},
    {QStringLiteral("workspaceID"), workspace},
    {QStringLiteral("remoteDirectory"), QStringLiteral("/srv/slopcode")},
  };
}

QJsonObject capabilities()
{
  const QJsonArray features{
    QStringLiteral("proof.ed25519.v1"), QStringLiteral("frame.bounds.v1"), QStringLiteral("http.upload.v1")};
  return QJsonObject{{QStringLiteral("offered"), features}, {QStringLiteral("required"), features}};
}

QJsonObject open()
{
  const QJsonObject scope = target();
  QJsonObject result{
    {QStringLiteral("version"), QStringLiteral("v1")},
    {QStringLiteral("kind"), QStringLiteral("request")},
    {QStringLiteral("type"), QStringLiteral("session.open")},
    {QStringLiteral("requestID"), QStringLiteral("req_open_1")},
    {QStringLiteral("idempotencyKey"), QStringLiteral("idem_open_1")},
    {QStringLiteral("requestDigest"), QString(64, QChar('0'))},
    {QStringLiteral("target"), scope},
    {QStringLiteral("capabilities"), capabilities()},
    {QStringLiteral("auth"), QJsonObject{
      {QStringLiteral("method"), QStringLiteral("pairing-signature")},
      {QStringLiteral("pairingID"), QStringLiteral("pair_android")},
      {QStringLiteral("target"), scope},
      {QStringLiteral("targetDigest"), QString(64, QChar('b'))},
      {QStringLiteral("challenge"), QJsonObject{
        {QStringLiteral("issuer"), QStringLiteral("server")},
        {QStringLiteral("id"), QStringLiteral("chl_open_1")},
        {QStringLiteral("nonce"), QStringLiteral("c2VydmVyX25vbmNlXzEyMzQ1Ng")},
        {QStringLiteral("issuedAt"), 1'700'000'000'000LL},
        {QStringLiteral("expiresAt"), 1'700'000'060'000LL},
        {QStringLiteral("oneTime"), true},
      }},
      {QStringLiteral("proof"), QJsonObject{
        {QStringLiteral("algorithm"), QStringLiteral("ed25519")},
        {QStringLiteral("encoding"), QStringLiteral("base64url")},
        {QStringLiteral("signature"), QString(86, QChar('A'))},
      }},
    }},
  };
  result.insert(QStringLiteral("requestDigest"), *computeRemoteRequestDigest(result));
  return result;
}

QJsonObject request(const QJsonObject &scope = target())
{
  QJsonObject result{
    {QStringLiteral("version"), QStringLiteral("v1")},
    {QStringLiteral("kind"), QStringLiteral("request")},
    {QStringLiteral("type"), QStringLiteral("http.request")},
    {QStringLiteral("requestID"), QStringLiteral("req_http_1")},
    {QStringLiteral("idempotencyKey"), QStringLiteral("idem_http_1")},
    {QStringLiteral("requestDigest"), QString(64, QChar('0'))},
    {QStringLiteral("target"), scope},
    {QStringLiteral("method"), QStringLiteral("POST")},
    {QStringLiteral("path"), QStringLiteral("/api/session")},
    {QStringLiteral("query"), QStringLiteral("page=1")},
    {QStringLiteral("headers"), QJsonObject{{QStringLiteral("content-type"), QStringLiteral("application/json")}}},
    {QStringLiteral("body"), QJsonObject{{QStringLiteral("encoding"), QStringLiteral("utf8")},
                                             {QStringLiteral("data"), QStringLiteral("{\"message\":\"hello\"}")}}},
  };
  result.insert(QStringLiteral("requestDigest"), *computeRemoteRequestDigest(result));
  return result;
}

class HttpServer final : public QObject {
public:
  explicit HttpServer(QObject *parent = nullptr)
    : QObject(parent)
  {
    QVERIFY(server_.listen(QHostAddress::LocalHost));
    connect(&server_, &QTcpServer::newConnection, this, [this]() {
      QTcpSocket *socket = server_.nextPendingConnection();
      socket_ = socket;
      connect(socket, &QTcpSocket::readyRead, this, [this, socket]() { read(socket); });
      connect(socket, &QTcpSocket::disconnected, this, [this]() { ++disconnects; });
      connect(socket, &QObject::destroyed, this, [this, socket]() { buffers_.remove(socket); });
    });
  }

  QUrl url() const { return QUrl(QStringLiteral("http://127.0.0.1:%1/").arg(server_.serverPort())); }
  QList<QByteArray> requests;
  QByteArray body = QByteArrayLiteral("{\"ok\":true}");
  QByteArray responseHeaders = QByteArrayLiteral(
    "Content-Type: application/json\r\nX-Trace: local\r\nSet-Cookie: secret\r\n");
  bool close = false;
  bool hold = false;
  bool contentLength = true;
  bool stream = false;
  int disconnects = 0;
  QPointer<QTcpSocket> socket_;

  void resume()
  {
    if (!socket_) {
      return;
    }
    socket_->write(body.mid(64 * 1024));
    socket_->disconnectFromHost();
  }

private:
  void read(QTcpSocket *socket)
  {
    QByteArray &buffer = buffers_[socket];
    buffer.append(socket->readAll());
    const qsizetype boundary = buffer.indexOf(QByteArrayLiteral("\r\n\r\n"));
    if (boundary < 0) {
      return;
    }
    const QByteArray headers = buffer.left(boundary).toLower();
    const qsizetype marker = headers.indexOf(QByteArrayLiteral("content-length:"));
    const int length = marker < 0 ? 0 : headers.mid(marker + 15).split('\r').first().trimmed().toInt();
    if (buffer.size() < boundary + 4 + length) {
      return;
    }
    requests.append(buffer);
    buffers_.remove(socket);
    if (close) {
      socket->disconnectFromHost();
      return;
    }
    if (hold) {
      return;
    }
    const QByteArray response = QByteArrayLiteral("HTTP/1.1 201 Created\r\n") + responseHeaders +
                                (contentLength ? QByteArrayLiteral("Content-Length: ") + QByteArray::number(body.size()) + QByteArrayLiteral("\r\n")
                                               : QByteArray()) +
                                QByteArrayLiteral("Connection: close\r\n\r\n");
    socket->write(response + (stream ? body.left(64 * 1024) : body));
    if (stream) {
      return;
    }
    socket->disconnectFromHost();
  }

  QTcpServer server_;
  QHash<QTcpSocket *, QByteArray> buffers_;
};

class ControlServer final : public QObject {
public:
  explicit ControlServer(QObject *parent = nullptr)
    : QObject(parent)
    , server_(QStringLiteral("remote-test"), QWebSocketServer::SecureMode, this)
  {
    QSslConfiguration configuration = QSslConfiguration::defaultConfiguration();
    configuration.setLocalCertificate(certificate());
    configuration.setPrivateKey(QSslKey(QByteArray(kKey), QSsl::Rsa));
    configuration.setPeerVerifyMode(QSslSocket::VerifyNone);
    server_.setSslConfiguration(configuration);
    QVERIFY(server_.listen(QHostAddress::LocalHost));
    connect(&server_, &QWebSocketServer::newConnection, this, [this]() {
      socket_ = server_.nextPendingConnection();
      connect(socket_, &QWebSocket::textMessageReceived, this, [this](const QString &text) { receive(text); });
    });
  }

  QUrl url() const { return QUrl(QStringLiteral("wss://127.0.0.1:%1").arg(server_.serverPort())); }
  QList<Frame> frames;
  QPointer<QWebSocket> socket_;

  void send(const QJsonObject &object)
  {
    QVERIFY(socket_);
    QString error;
    const QByteArray encoded = encodeFrame(Frame(object), &error);
    QVERIFY2(!encoded.isEmpty(), qPrintable(error));
    socket_->sendTextMessage(QString::fromUtf8(encoded));
  }

private:
  void receive(const QString &text)
  {
    const ParseResult result = parseFrame(text.toUtf8());
    QVERIFY(result);
    frames.append(*result.frame);
    if (result.frame->type != QStringLiteral("session.open")) {
      return;
    }
    const QJsonObject object = result.frame->object;
    send(QJsonObject{
      {QStringLiteral("version"), QStringLiteral("v1")},
      {QStringLiteral("kind"), QStringLiteral("response")},
      {QStringLiteral("type"), QStringLiteral("session.opened")},
      {QStringLiteral("requestID"), object.value(QStringLiteral("requestID"))},
      {QStringLiteral("idempotencyKey"), object.value(QStringLiteral("idempotencyKey"))},
      {QStringLiteral("requestDigest"), object.value(QStringLiteral("requestDigest"))},
      {QStringLiteral("target"), object.value(QStringLiteral("target"))},
      {QStringLiteral("sessionID"), QStringLiteral("ses_remote_1")},
      {QStringLiteral("capabilities"), QJsonObject{{QStringLiteral("accepted"), capabilities().value(QStringLiteral("offered"))}}},
    });
  }

  QWebSocketServer server_;
};

class Harness final {
public:
  Harness()
    : forwarder(http.url())
    , bridge(session)
  {
    QVERIFY(bridge.setTarget(target()));
    bridge.setForwarder(&forwarder);
    bridge.setAuthorizer([](const Frame &, QString *) { return true; });
    QString error;
    QVERIFY2(session.connectTo(control.url(), tls(), &error), qPrintable(error));
    QTRY_VERIFY(control.socket_);
    QTRY_VERIFY(session.state() == RemoteSession::State::Connected);
    QVERIFY(session.send(Frame(open())));
    QTRY_VERIFY(session.negotiated());
  }

  HttpServer http;
  ControlServer control;
  LocalSlopcodeForwarder forwarder;
  RemoteSession session;
  RemoteHttpBridge bridge;
};

Frame response(const ControlServer &control)
{
  return control.frames.value(1);
}

} // namespace

class HttpBridgeTest final : public QObject {
  Q_OBJECT

private slots:
  void dispatchesRequestAndResponse();
  void handlesBase64Bodies();
  void rejectsMismatchedTarget();
  void rejectsInvalidDigest();
  void failsClosedWithoutAuthorizer();
  void boundsUtf8AuthorizerError();
  void rejectsUnsupportedBody();
  void returnsBoundedNetworkError();
  void rejectsOversizedResponse();
  void rejectsCloseDelimitedOversizedResponse();
  void rejectsMalformedResponseHeaders_data();
  void rejectsMalformedResponseHeaders();
  void abortsInFlightReplyOnCleanup();
};

void HttpBridgeTest::dispatchesRequestAndResponse()
{
  Harness test;
  const QJsonObject value = request();
  test.control.send(value);

  QTRY_COMPARE(test.http.requests.size(), 1);
  QTRY_COMPARE(test.control.frames.size(), 2);
  QVERIFY(test.http.requests.first().contains(QByteArrayLiteral("POST /api/session?page=1 HTTP/1.1")));
  QVERIFY(test.http.requests.first().endsWith(QByteArrayLiteral("{\"message\":\"hello\"}")));
  const Frame frame = response(test.control);
  QCOMPARE(frame.type, QStringLiteral("http.response"));
  QCOMPARE(frame.object.value(QStringLiteral("status")).toInt(), 201);
  QCOMPARE(frame.object.value(QStringLiteral("requestID")), value.value(QStringLiteral("requestID")));
  QCOMPARE(frame.object.value(QStringLiteral("idempotencyKey")), value.value(QStringLiteral("idempotencyKey")));
  QCOMPARE(frame.object.value(QStringLiteral("requestDigest")), value.value(QStringLiteral("requestDigest")));
  QCOMPARE(frame.object.value(QStringLiteral("target")), value.value(QStringLiteral("target")));
  QCOMPARE(frame.object.value(QStringLiteral("body")).toObject().value(QStringLiteral("encoding")).toString(), QStringLiteral("utf8"));
  QCOMPARE(frame.object.value(QStringLiteral("body")).toObject().value(QStringLiteral("data")).toString(), QStringLiteral("{\"ok\":true}"));
  QVERIFY(frame.object.value(QStringLiteral("headers")).toObject().contains(QStringLiteral("X-Trace")));
  QVERIFY(!frame.object.value(QStringLiteral("headers")).toObject().contains(QStringLiteral("Set-Cookie")));
}

void HttpBridgeTest::handlesBase64Bodies()
{
  Harness test;
  test.http.body = QByteArray::fromHex("ff00");
  QJsonObject value = request();
  value.insert(QStringLiteral("body"), QJsonObject{{QStringLiteral("encoding"), QStringLiteral("base64")},
                                                     {QStringLiteral("data"), QStringLiteral("eyJtZXNzYWdlIjoiaGVsbG8ifQ==")}});
  value.insert(QStringLiteral("requestDigest"), *computeRemoteRequestDigest(value));
  test.control.send(value);

  QTRY_COMPARE(test.http.requests.size(), 1);
  QTRY_COMPARE(test.control.frames.size(), 2);
  QVERIFY(test.http.requests.first().endsWith(QByteArrayLiteral("{\"message\":\"hello\"}")));
  const QJsonObject body = response(test.control).object.value(QStringLiteral("body")).toObject();
  QCOMPARE(body.value(QStringLiteral("encoding")).toString(), QStringLiteral("base64"));
  QCOMPARE(body.value(QStringLiteral("data")).toString(), QStringLiteral("/wA="));
}

void HttpBridgeTest::rejectsMismatchedTarget()
{
  Harness test;
  const QJsonObject value = request(target(QStringLiteral("wrk_other")));
  test.control.send(value);

  QTRY_COMPARE(test.control.frames.size(), 2);
  QCOMPARE(test.http.requests.size(), 0);
  const Frame frame = response(test.control);
  QCOMPARE(frame.kind, FrameKind::Error);
  QCOMPARE(frame.object.value(QStringLiteral("code")).toString(), QStringLiteral("out_of_scope"));
  QCOMPARE(frame.object.value(QStringLiteral("target")), value.value(QStringLiteral("target")));
}

void HttpBridgeTest::rejectsInvalidDigest()
{
  Harness test;
  QJsonObject value = request();
  value.insert(QStringLiteral("requestDigest"), QString(64, QChar('a')));
  test.control.send(value);

  QTRY_COMPARE(test.control.frames.size(), 2);
  QCOMPARE(test.http.requests.size(), 0);
  const Frame frame = response(test.control);
  QCOMPARE(frame.kind, FrameKind::Error);
  QCOMPARE(frame.object.value(QStringLiteral("code")).toString(), QStringLiteral("bad_request"));
  QCOMPARE(frame.object.value(QStringLiteral("requestDigest")), value.value(QStringLiteral("requestDigest")));
}

void HttpBridgeTest::failsClosedWithoutAuthorizer()
{
  Harness test;
  test.bridge.setAuthorizer({});
  test.control.send(request());

  QTRY_COMPARE(test.control.frames.size(), 2);
  QCOMPARE(test.http.requests.size(), 0);
  QCOMPARE(response(test.control).object.value(QStringLiteral("code")).toString(), QStringLiteral("unauthorized"));
}

void HttpBridgeTest::boundsUtf8AuthorizerError()
{
  Harness test;
  test.bridge.setAuthorizer([](const Frame &, QString *error) {
    if (error != nullptr) {
      *error = QString(1'000, QChar(0x4e00));
    }
    return false;
  });
  test.control.send(request());

  QTRY_COMPARE(test.control.frames.size(), 2);
  QCOMPARE(test.http.requests.size(), 0);
  const Frame frame = response(test.control);
  QCOMPARE(frame.object.value(QStringLiteral("code")).toString(), QStringLiteral("forbidden"));
  const QString message = frame.object.value(QStringLiteral("message")).toString();
  QVERIFY(message.toUtf8().size() <= 2 * 1024);
  QVERIFY(!message.contains(QChar::ReplacementCharacter));
}

void HttpBridgeTest::rejectsUnsupportedBody()
{
  Harness test;
  QJsonObject value = request();
  value.insert(QStringLiteral("body"), QJsonObject{{QStringLiteral("encoding"), QStringLiteral("binary")},
                                                     {QStringLiteral("data"), QStringLiteral("hello")}});
  value.insert(QStringLiteral("requestDigest"), *computeRemoteRequestDigest(value));
  QSignalSpy errors(&test.session, &RemoteSession::protocolError);
  test.control.socket_->sendTextMessage(QString::fromUtf8(QJsonDocument(value).toJson(QJsonDocument::Compact)));

  QTRY_COMPARE(errors.count(), 1);
  QCOMPARE(test.http.requests.size(), 0);
  QCOMPARE(test.control.frames.size(), 1);
}

void HttpBridgeTest::returnsBoundedNetworkError()
{
  Harness test;
  test.http.close = true;
  const QJsonObject value = request();
  test.control.send(value);

  QTRY_COMPARE(test.http.requests.size(), 1);
  QTRY_COMPARE(test.control.frames.size(), 2);
  const Frame frame = response(test.control);
  QCOMPARE(frame.kind, FrameKind::Error);
  QCOMPARE(frame.object.value(QStringLiteral("code")).toString(), QStringLiteral("internal"));
  QVERIFY(frame.object.value(QStringLiteral("message")).toString().toUtf8().size() <= 2 * 1024);
  QCOMPARE(frame.object.value(QStringLiteral("requestID")), value.value(QStringLiteral("requestID")));
}

void HttpBridgeTest::rejectsOversizedResponse()
{
  Harness test;
  test.http.body = QByteArray(64 * 1024 + 1, 'x');
  const QJsonObject value = request();
  test.control.send(value);

  QTRY_COMPARE(test.http.requests.size(), 1);
  QTRY_COMPARE(test.control.frames.size(), 2);
  QCOMPARE(test.control.frames.size(), 2);
  QCOMPARE(response(test.control).kind, FrameKind::Error);
  QCOMPARE(response(test.control).object.value(QStringLiteral("code")).toString(), QStringLiteral("too_large"));
  QTRY_VERIFY(test.http.disconnects > 0);
}

void HttpBridgeTest::rejectsCloseDelimitedOversizedResponse()
{
  Harness test;
  test.http.body = QByteArray(64 * 1024 + 1, 'x');
  test.http.contentLength = false;
  test.http.stream = true;
  test.control.send(request());

  QTRY_COMPARE(test.http.requests.size(), 1);
  QTRY_VERIFY(!test.forwarder.findChildren<QNetworkReply *>().isEmpty());
  QNetworkReply *reply = test.forwarder.findChild<QNetworkReply *>();
  QVERIFY(reply != nullptr);
  QCOMPARE(reply->readBufferSize(), qint64(64 * 1024));
  test.http.resume();
  QTRY_COMPARE(test.control.frames.size(), 2);
  QCOMPARE(response(test.control).kind, FrameKind::Error);
  QCOMPARE(response(test.control).object.value(QStringLiteral("code")).toString(), QStringLiteral("too_large"));
  QTRY_VERIFY(test.http.disconnects > 0);
}

void HttpBridgeTest::rejectsMalformedResponseHeaders_data()
{
  QTest::addColumn<QByteArray>("headers");

  QByteArray many;
  for (int index = 0; index < 65; ++index) {
    many += QByteArrayLiteral("X-Response-") + QByteArray::number(index) + QByteArrayLiteral(": value\r\n");
  }
  QTest::newRow("too-many") << many;
  QTest::newRow("invalid-name") << QByteArrayLiteral("X Response: value\r\n");
  QTest::newRow("invalid-utf8-value") << QByteArray("X-Response: \xff\r\n");
  QTest::newRow("control-value") << QByteArray("X-Response: value\x01\r\n");
}

void HttpBridgeTest::rejectsMalformedResponseHeaders()
{
  QFETCH(QByteArray, headers);
  Harness test;
  test.http.responseHeaders = headers;
  test.control.send(request());

  QTRY_COMPARE(test.http.requests.size(), 1);
  QTRY_COMPARE(test.control.frames.size(), 2);
  QCOMPARE(response(test.control).kind, FrameKind::Error);
  QCOMPARE(response(test.control).object.value(QStringLiteral("code")).toString(), QStringLiteral("internal"));
}

void HttpBridgeTest::abortsInFlightReplyOnCleanup()
{
  HttpServer http;
  ControlServer control;
  LocalSlopcodeForwarder forwarder(http.url());
  RemoteSession session;
  auto *bridge = new RemoteHttpBridge(session);
  QVERIFY(bridge->setTarget(target()));
  bridge->setForwarder(&forwarder);
  bridge->setAuthorizer([](const Frame &, QString *) { return true; });
  QString error;
  QVERIFY(session.connectTo(control.url(), tls(), &error));
  QTRY_VERIFY(session.state() == RemoteSession::State::Connected);
  QVERIFY(session.send(Frame(open())));
  QTRY_VERIFY(session.negotiated());

  http.hold = true;
  control.send(request());
  QTRY_COMPARE(http.requests.size(), 1);
  delete bridge;
  QTRY_VERIFY(http.disconnects > 0);
  QCOMPARE(control.frames.size(), 1);
}

QTEST_MAIN(HttpBridgeTest)

#include "http_bridge_test.moc"
