import { Component, type ErrorInfo, type ReactNode } from "react";

import { reportClientError } from "../community/diagnosticsReporter";

type Props = { children: ReactNode };
type State = { failed: boolean };

const bootstrapCopy = {
  ru: {
    brand: "Проба Пера",
    title: "Не удалось открыть интерфейс журнала",
    description:
      "Обновите страницу. Опубликованные материалы при этом не потеряны.",
    reload: "Обновить страницу",
    archive: "Открыть статический архив статей",
  },
  en: {
    brand: "PROBA PERA",
    title: "The journal interface could not be opened",
    description:
      "Reload the page. Published materials have not been lost.",
    reload: "Reload page",
    archive: "Open the static article archive",
  },
} as const;

function currentBootstrapCopy() {
  const documentLanguage =
    typeof document === "undefined"
      ? "ru"
      : document.documentElement.dataset.routeLanguage ||
        document.documentElement.lang;
  return documentLanguage.toLocaleLowerCase("en").startsWith("en")
    ? bootstrapCopy.en
    : bootstrapCopy.ru;
}

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
      const copy = currentBootstrapCopy();
      return (
        <main className="app-error" role="alert">
          <span>{copy.brand}</span>
          <h1>{copy.title}</h1>
          <p>{copy.description}</p>
          <button type="button" onClick={() => globalThis.location.reload()}>
            {copy.reload}
          </button>
          <a href={`${import.meta.env.BASE_URL}stati/`}>{copy.archive}</a>
        </main>
      );
    }

    return this.props.children;
  }
}
