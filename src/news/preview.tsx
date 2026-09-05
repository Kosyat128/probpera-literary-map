import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { InterfaceLanguageProvider, useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import InterfaceLanguageControl from "../components/InterfaceLanguageControl";
import LiteraryNewsPanel from "../components/LiteraryNewsPanel";
import "./preview.css";

function Preview() {
  const { language } = useInterfaceLanguage();
  return <div className="news-preview-page">
    <header className="news-preview-header">
      <a className="news-preview-brand" href={`${import.meta.env.BASE_URL}?literary-news=1#book-day`}>
        {language === "ru" ? "Проба Пера" : "Proba Pera"}<span>{language === "ru" ? "ЛИТЕРАТУРНЫЙ ЖУРНАЛ" : "LITERARY MAGAZINE"}</span>
      </a>
      <InterfaceLanguageControl />
    </header>
    <main>
      <div className="news-preview-intro">
        <p>{language === "ru" ? "КНИГИ · ЛЮДИ · СОБЫТИЯ" : "BOOKS · PEOPLE · EVENTS"}</p>
        <h1>{language === "ru" ? "Литература продолжается." : "Literature keeps unfolding."}</h1>
        <p>{language === "ru" ? "Новые истории, важные даты и события книжного мира - в одном небольшом блоке." : "New stories, notable dates and events from the book world, in one compact panel."}</p>
      </div>
      <a className="news-preview-placement" href={`${import.meta.env.BASE_URL}?literary-news=1#book-day`}>
        {language === "ru" ? "Посмотреть новости рядом с книгой месяца →" : "See the news beside the book of the month →"}
      </a>
      <LiteraryNewsPanel />
      <p className="news-preview-note">{language === "ru" ? "Локальный прототип. В подборке - проверенные примеры с исходными датами. Новые материалы источников ожидают проверки фактов и обеих языковых версий." : "Local prototype. The selection contains reviewed examples with their original dates. New source material awaits fact checking and review in both languages."}</p>
    </main>
  </div>;
}

if (!import.meta.env.DEV) throw new Error("This preview is available only on the local development server.");
createRoot(document.getElementById("root")!).render(<StrictMode><InterfaceLanguageProvider><Preview /></InterfaceLanguageProvider></StrictMode>);
