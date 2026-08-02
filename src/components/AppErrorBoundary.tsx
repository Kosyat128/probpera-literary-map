import { Component, type ErrorInfo, type ReactNode } from "react";

import { reportClientError } from "../community/diagnosticsReporter";

type Props = { children: ReactNode };
type State = { failed: boolean };

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
    return (
      <main className="fatal-error-screen" role="alert">
        <section>
          <span>Проба Пера · восстановление</span>
          <h1>Страница столкнулась с ошибкой</h1>
          <p>Состояние сохранено в журнале редакции. Обновите страницу — публикации и ваша библиотека не пострадали.</p>
          <button type="button" onClick={() => window.location.reload()}>Обновить страницу</button>
        </section>
      </main>
    );
  }
}
