#include <slopcode/remoteqt/session.h>

#include <QCommandLineOption>
#include <QCommandLineParser>
#include <QCoreApplication>
#include <QDebug>

using slopcode::remoteqt::RemoteSession;

int main(int argc, char **argv)
{
  QCoreApplication application(argc, argv);
  QCoreApplication::setApplicationName(QStringLiteral("slopcode-remote-qt-reference"));

  QCommandLineParser parser;
  parser.setApplicationDescription(QStringLiteral("Bounded Slopcode RemoteV1 Qt host adapter reference"));
  parser.addHelpOption();
  const QCommandLineOption endpointOption({QStringLiteral("e"), QStringLiteral("endpoint")},
                                           QStringLiteral("wss:// control-plane endpoint"),
                                           QStringLiteral("url"));
  parser.addOption(endpointOption);
  parser.process(application);

  if (!parser.isSet(endpointOption)) {
    qInfo().noquote() << QStringLiteral("No endpoint supplied; library reference is ready for embedding.");
    return 0;
  }

  const QByteArray token = qgetenv("SLOPCODE_REMOTE_SESSION_TOKEN");
  RemoteSession session;
  QString error;
  if (!session.connectTo(QUrl(parser.value(endpointOption)), token, QSslConfiguration::defaultConfiguration(), &error)) {
    qCritical().noquote() << error;
    return 2;
  }

  QObject::connect(&session, &RemoteSession::connected, &application, []() {
    qInfo().noquote() << QStringLiteral("RemoteV1 TLS session connected; no relay is enabled by this reference.");
  });
  QObject::connect(&session, &RemoteSession::protocolError, &application, [](const QString &message) {
    qCritical().noquote() << message;
  });
  QObject::connect(&session, &RemoteSession::closed, &application, &QCoreApplication::quit);
  return application.exec();
}
