import { Component, type ErrorInfo, type ReactNode } from "react";

import { reportClientError } from "../community/diagnosticsReporter";

type Props = { children: ReactNode };
type State = { failed: boolean };

export default class BootstrapErrorBoundary extends Component<Props, State> {
  state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    reportClientError(error, "react", {
      boundary: "bootstrap",
      componentStack: (info.componentStack || "").slice(0, 3000),
    });
  }

  render() {
    if (this.state.failed) {
      return (
        <main className="app-error" role="alert">
          <span>Проба Пера</span>
          <h1>Не удалось открыть интерфейс журнала</h1>
          <p>
            Обновите страницу. Опубликованные материалы при этом не потеряны.
          </p>
          <button type="button" onClick={() => globalThis.location.reload()}>
            Обновить страницу
          </button>
          <a href="/stati/">Открыть статический архив статей</a>
        </main>
      );
    }

    return this.props.children;
  }
}
