import { Component, type ErrorInfo, type ReactNode } from "react";

import { reportClientError } from "../community/diagnosticsReporter";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";

type Props = { children: ReactNode };
type State = { failed: boolean };

function FatalErrorScreen() {
  const { t } = useInterfaceLanguage();
  return (
    <main className="fatal-error-screen" role="alert">
      <section>
        <span>{t("Проба Пера · восстановление")}</span>
        <h1>{t("Страница столкнулась с ошибкой")}</h1>
        <p>
          {t(
            "Состояние сохранено в журнале редакции. Обновите страницу — публикации и ваша библиотека не пострадали."
          )}
        </p>
        <button type="button" onClick={() => window.location.reload()}>
          {t("Обновить страницу")}
        </button>
      </section>
    </main>
  );
}

export default class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportClientError(error, "react", {
      componentStack: info.componentStack?.slice(0, 5000),
    });
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return <FatalErrorScreen />;
  }
}
