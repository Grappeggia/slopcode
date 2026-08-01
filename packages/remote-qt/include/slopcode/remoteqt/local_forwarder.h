#pragma once

#include <QList>
#include <QObject>
#include <QPair>
#include <QNetworkRequest>
#include <QUrl>

class QNetworkAccessManager;
class QNetworkReply;
class QWebSocket;

namespace slopcode::remoteqt {

using Headers = QList<QPair<QByteArray, QByteArray>>;

class LocalSlopcodeForwarder final : public QObject {
  Q_OBJECT

public:
  explicit LocalSlopcodeForwarder(const QUrl &baseURL = QUrl(), QObject *parent = nullptr);

  bool setBaseURL(const QUrl &baseURL, QString *error = nullptr);
  QUrl baseURL() const { return baseURL_; }

  // These are intentionally hooks rather than a transparent proxy. The
  // caller owns the reply/socket and supplies any local-server headers at
  // runtime; no RemoteV1 frame is converted into an unrestricted URL.
  QNetworkReply *forwardHTTP(const QByteArray &method,
                             const QString &path,
                             const QByteArray &body = QByteArray(),
                             const Headers &headers = Headers(),
                             QString *error = nullptr);
  QNetworkReply *forwardHTTPWithQuery(const QByteArray &method,
                                      const QString &path,
                                      const QString &query,
                                      const QByteArray &body = QByteArray(),
                                      const Headers &headers = Headers(),
                                      QString *error = nullptr);
  QWebSocket *forwardWebSocket(const QString &path,
                               const Headers &headers = Headers(),
                               QString *error = nullptr);

  static bool validateLoopbackURL(const QUrl &url, QString *error = nullptr);
  static bool validateRedirectLocation(const QUrl &origin,
                                       const QByteArray &rawLocation,
                                       QUrl *resolvedURL = nullptr,
                                       QString *error = nullptr);

private:
  bool makeURL(const QString &path, const QString &query, QUrl *url, QString *error) const;
  static bool validatePath(const QString &path, QString *error);
  static bool validateQuery(const QString &query, QString *error);
  static bool applyHeaders(QNetworkRequest &request, const Headers &headers, QString *error);

  QUrl baseURL_;
  QNetworkAccessManager *manager_ = nullptr;
};

} // namespace slopcode::remoteqt
