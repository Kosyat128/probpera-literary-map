import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { publicImageAttributes } from "../utils/imageDelivery";
import type { ArticleCatalogEntry } from "../data/articles/catalog";
import { selectHeaderArticles } from "../utils/headerArticleSelection";
import { headerShowcasePins, loadHeaderArticleCatalog } from "../utils/headerArticleLoader";
import { articlePath, journalPath, navigateToArticle, navigateToJournal, shouldUseClientNavigation } from "../utils/articleRoutes";
import { selectInterfacePlural, translateInterfaceText, type InterfaceLanguage } from "../i18n/InterfaceLanguage";
import "../styles/header-showcase-r10.css";

function articlePreview(description: string) {
  const text = description.trim();
  if (text.length <= 120) return text;
  const sentence = text.match(/^.+?[.!?](?=\s|$)/u)?.[0];
  if (sentence && sentence.length <= 120) return sentence;
  const boundary = text.slice(0, 117).lastIndexOf(" ");
  return boundary > 0 ? `${text.slice(0, boundary).trimEnd()}…` : text;
}

function ArticleThumbnail({ imageUrl }: { imageUrl: string }) {
  const [failed, setFailed] = useState(false);
  return <span className="articles-mega-card-media" aria-hidden="true">
    {failed ? <span className="articles-mega-card-media-fallback">PP</span> :
      <img {...publicImageAttributes(imageUrl, 160, "48px")} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} />}
  </span>;
}

export default function HeaderArticlesMenu({ language = "ru" }: { language?: InterfaceLanguage }) {
  const [articles, setArticles] = useState<ArticleCatalogEntry[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "loaded" | "error">("idle");
  const [selectionTime, setSelectionTime] = useState(() => Date.now());
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const loadingRef = useRef(false);
  const loadedRef = useRef(false);
  const errorRef = useRef(false);
  const t = useCallback((text: string) => translateInterfaceText(text, language), [language]);
  const copy = (ru: string, en: string) => language === "en" ? en : ru;
  const loadArticles = useCallback(() => {
    if (loadedRef.current || loadingRef.current || errorRef.current) return;
    loadingRef.current = true;
    errorRef.current = false;
    setStatus("loading");
    loadHeaderArticleCatalog().then(catalog => {
      setArticles(catalog); loadedRef.current = true; setStatus("loaded");
    }).catch(() => { errorRef.current = true; setStatus("error"); })
      .finally(() => { loadingRef.current = false; });
  }, []);
  const measure = useCallback(() => {
    const details = detailsRef.current;
    if (!details?.open) return;
    const panel = details.querySelector<HTMLElement>(".articles-mega-menu");
    const header = details.closest(".site-header");
    if (!panel || !header) return;
    const viewport = window.visualViewport;
    const bottom = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight);
    panel.style.setProperty("--showcase-available-height", `${Math.max(80, bottom - header.getBoundingClientRect().bottom - 12)}px`);
  }, []);
  const refreshSelection = useCallback(() => {
    const now = Date.now();
    const active = document.activeElement instanceof HTMLElement ? document.activeElement.closest<HTMLAnchorElement>("a[data-article-id]") : null;
    if (active && detailsRef.current?.contains(active)) {
      const next = selectHeaderArticles(articles, language, headerShowcasePins, now);
      if (![next.lead, ...next.more].some(article => article?.id === active.dataset.articleId)) detailsRef.current.querySelector("summary")?.focus();
    }
    setSelectionTime(now);
  }, [articles, language]);
  useEffect(() => {
    const details = detailsRef.current;
    const closeFromOutside = (event: PointerEvent) => {
      if (details?.open && event.target instanceof Node && !details.contains(event.target)) details.open = false;
    };
    const closeForPanel = (event: Event) => {
      if (details?.open && event.target instanceof HTMLDetailsElement && event.target !== details && event.target.open && event.target.closest(".site-header")) details.open = false;
    };
    const onPageShow = () => { refreshSelection(); measure(); };
    document.addEventListener("pointerdown", closeFromOutside, true);
    document.addEventListener("toggle", closeForPanel, true);
    window.addEventListener("pageshow", onPageShow);
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    const observer = new ResizeObserver(measure);
    const header = details?.closest(".site-header");
    if (header) observer.observe(header);
    return () => {
      document.removeEventListener("pointerdown", closeFromOutside, true);
      document.removeEventListener("toggle", closeForPanel, true);
      window.removeEventListener("pageshow", onPageShow);
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
      observer.disconnect();
    };
  }, [measure, refreshSelection]);
  const featured = useMemo(() => selectHeaderArticles(articles, language, headerShowcasePins, selectionTime), [articles, language, selectionTime]);
  const closeMenu = () => { if (detailsRef.current) detailsRef.current.open = false; };
  const imageUrl = featured.lead?.imageUrl;
  return (
    <details ref={detailsRef} className="articles-menu"
      onPointerEnter={() => loadArticles()}
      onFocusCapture={() => loadArticles()}
      onBlur={event => { if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) closeMenu(); }}
      onKeyDown={event => {
        if (event.key !== "Escape" || !event.currentTarget.open) return;
        event.preventDefault(); closeMenu(); event.currentTarget.querySelector("summary")?.focus();
      }}
      onToggle={event => {
        if (!event.currentTarget.open) return;
        document.querySelectorAll<HTMLDetailsElement>(".site-header details[open]").forEach(other => { if (other !== event.currentTarget) other.open = false; });
        refreshSelection(); loadArticles(); measure();
        const panel = event.currentTarget.querySelector(".articles-mega-menu");
        if (panel) panel.scrollTop = 0;
      }}>
      <summary>{t("Статьи")} <span aria-hidden="true">⌄</span></summary>
      <div className="articles-mega-menu" aria-busy={status === "loading"}>
        <header><div><span>{t("Редакционная витрина")}</span><strong>{featured.editorialChoice ? copy("Выбор редакции", "Editor's choice") : t("Свежие публикации")}</strong></div>
          <p>{t("Авторские статьи, рецензии, литературные истории и материалы о языке.")}</p></header>
        {featured.lead ? <div className="articles-mega-content">
          <a className="articles-mega-lead" data-article-id={featured.lead.id} href={articlePath(featured.lead.id, featured.lead.title, featured.lead.sectionId, featured.lead.slug)}
            onClick={event => { if (!shouldUseClientNavigation(event)) return; event.preventDefault(); closeMenu(); navigateToArticle(featured.lead); }}>
            <span className="articles-mega-lead-media" aria-hidden="true">
              {imageUrl && failedImage !== imageUrl ? <img key={imageUrl} {...publicImageAttributes(imageUrl, 640, "(max-width: 1040px) calc(100vw - 36px), 448px")}
                alt="" loading="lazy" decoding="async" onError={() => setFailedImage(imageUrl)} /> : <span className="articles-mega-image-fallback">{copy("Проба Пера", "Proba Pera")}</span>}
            </span>
            <div><small>{featured.lead.sectionLabel}</small><strong>{featured.lead.title}</strong><p>{featured.lead.description}</p>
              {featured.lead.readingMinutes > 0 && <em>{featured.lead.readingMinutes} {t("мин. чтения")}</em>}</div>
          </a>
          <section aria-label={t("Другие свежие статьи")}>
            {featured.more.map(article => <a className="articles-mega-card" data-article-id={article.id} href={articlePath(article.id, article.title, article.sectionId, article.slug)} key={article.id}
              onClick={event => { if (!shouldUseClientNavigation(event)) return; event.preventDefault(); closeMenu(); navigateToArticle(article); }}>
              <div className="articles-mega-card-label">
                <small>{article.sectionLabel}</small>
                {article.imageUrl && <ArticleThumbnail key={article.imageUrl} imageUrl={article.imageUrl} />}
              </div>
              <strong>{article.title}</strong>
              {article.description && <p>{articlePreview(article.description)}</p>}
              {article.readingMinutes > 0 && <span className="articles-mega-card-meta">{article.readingMinutes} {t("мин.")}</span>}
            </a>)}
          </section>
        </div> : <div className="articles-mega-loading" role="status">
          {status === "error" ? <><p>{copy("Не удалось загрузить публикации.", "Publications could not be loaded.")}</p><button type="button" onClick={() => window.location.reload()}>{copy("Повторить загрузку страницы", "Reload and retry")}</button></> : status === "loaded" ? copy("Пока нет опубликованных материалов на выбранном языке.", "No publications are available in this language yet.") : t("Подключаем редакционный архив…")}
        </div>}
        <footer><span>{status === "loaded" ? `${new Intl.NumberFormat(language === "ru" ? "ru-RU" : "en-GB").format(featured.count)} ${t(selectInterfacePlural(featured.count, language, ["материал в архиве", "материала в архиве", "материалов в архиве"]))}` : t("Полный архив журнала")}</span>
          <a href={journalPath()} onClick={event => { if (!shouldUseClientNavigation(event)) return; event.preventDefault(); closeMenu(); navigateToJournal(); }}>{t("Все публикации")} <b aria-hidden="true">→</b></a>
        </footer>
      </div>
    </details>
  );
}
