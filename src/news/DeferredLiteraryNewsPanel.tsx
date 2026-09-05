import { useEffect, useState, type ComponentType } from "react";

import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";

type NewsPanel = ComponentType<{ endpoint?: string; variant?: "wide" | "sidebar" }>;
let panelPromise: Promise<NewsPanel> | null = null;

function loadNewsPanel() {
  panelPromise ??= import("../components/LiteraryNewsPanel")
    .then((module) => module.default)
    .catch((error) => {
      panelPromise = null;
      throw error;
    });
  return panelPromise;
}

/** Keep news code and requests behind the existing monthly-book activation gate. */
export default function DeferredLiteraryNewsPanel({ active, endpoint }: {
  active: boolean;
  endpoint: string;
}) {
  const { language } = useInterfaceLanguage();
  const [Panel, setPanel] = useState<NewsPanel | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!active) return;
    let current = true;
    setFailed(false);
    void loadNewsPanel().then(
      (component) => {
        if (!current) return;
        setPanel(() => component);
      },
      () => { if (current) setFailed(true); },
    );
    return () => { current = false; };
  }, [active]);

  const status = Panel ? "ready" : failed ? "error" : active ? "loading" : "idle";
  return (
    <div id={Panel ? undefined : "literary-news"} className="literary-news-slot" data-loading-status={status}>
      {Panel ? <Panel endpoint={endpoint} variant="sidebar" /> : (
        <section className="literary-news-placeholder" aria-busy={status === "loading"}>
          <p className="literary-news-placeholder__eyebrow">{language === "ru" ? "Проба Пера · Новости" : "Proba Pera · News"}</p>
          <h2>{language === "ru" ? "Литературная повестка" : "The literary briefing"}</h2>
          <p role={active ? "status" : undefined}>{failed
            ? language === "ru" ? "Не удалось загрузить новости. Попробуйте ещё раз." : "The news could not be loaded. Please try again."
            : language === "ru" ? "Новые книги, премии и события со всего мира." : "New books, prizes and events from around the world."}</p>
          {failed ? (
            <button type="button" onClick={() => window.location.reload()}>
              {language === "ru" ? "Перезагрузить страницу" : "Reload page"}
            </button>
          ) : <div className="literary-news-placeholder__lines" aria-hidden="true"><span /><span /><span /></div>}
        </section>
      )}
    </div>
  );
}
