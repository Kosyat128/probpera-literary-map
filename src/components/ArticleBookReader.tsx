import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import BookShelfScene, { type BookShelfPresentationItem } from "./BookShelfScene";
import {
  beginBookInspectionDrag, createBookInspectionSession, endBookInspectionDrag,
  getBookInspectionKeyboardTarget, requestBookInspectionPage, settleBookInspectionSession,
  updateBookInspectionDrag, type BookInspectionPageDirection, type BookInspectionSession,
} from "../books/bookInspectionSession";
import { compileArticleBookDocument } from "../articles/articleBookTextures";
import { publicImageAttributes, publicImageUrl } from "../utils/imageDelivery";
import "../styles/article-book-reader.css";

type CompiledArticleBook = Awaited<ReturnType<typeof compileArticleBookDocument>>;
export type ArticleBookReaderProps = {
  articleId: string;
  title: string;
  sectionLabel: string;
  html: string;
  coverUrl?: string;
  locale: "ru" | "en";
  fontScale?: number;
  initialProgress?: number;
  restoreRequest?: Readonly<{ id: number; articleId: string; progress: number }>;
  onProgress?: (percentage: number) => void;
  onFallback?: () => void;
  onOpenImage?: (src: string, alt: string) => void;
};

const appearance = { shelfColor: "#3e254e", ambientColor: "#f8eedc", lightColor: "#fff6e8", materialRoughness: .82, intensity: .8 };
const noop = () => {};

/** The shelf's physical book receives an article-only presentation document. */
export default function ArticleBookReader(props: ArticleBookReaderProps) {
  const { articleId, title, sectionLabel, html, coverUrl, locale, fontScale = 1, onProgress, onOpenImage } = props;
  const [compiled, setCompiled] = useState<CompiledArticleBook | null>(null);
  const [session, setSession] = useState<BookInspectionSession | null>(null);
  const [failed, setFailed] = useState(false);
  const [pageReady, setPageReady] = useState(false);
  const [imageRevision, setImageRevision] = useState(0);
  const [compactViewport, setCompactViewport] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 359px)").matches);
  const [reducedMotion, setReducedMotion] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  const sequence = useRef(0);
  const position = useRef(Math.min(100, Math.max(0, props.initialProgress || 0)));
  const identity = useRef(`${articleId}:${locale}`);
  // Requests already present at mount are reflected in initialProgress. Only
  // later external restorations may move an existing physical-page session.
  const restoredRequest = useRef(props.restoreRequest?.id);
  const progressRef = useRef(onProgress);
  progressRef.current = onProgress;
  const en = locale === "en";
  // A smaller printed-page size, with a readability floor on very narrow phones.
  const pageFontScale = fontScale * (compactViewport ? 1.28 : 1.1);
  const backdropUrl = useMemo(() => {
    if (coverUrl) return publicImageUrl(coverUrl, 1280);
    if (typeof document === "undefined") return "";
    const container = document.createElement("div");
    container.innerHTML = html;
    return publicImageUrl(container.querySelector("img")?.getAttribute("src") || "", 1280);
  }, [coverUrl, html]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 359px)");
    const update = () => setCompactViewport(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    let current = true;
    let owned: CompiledArticleBook | null = null;
    const controller = new AbortController();
    const nextIdentity = `${articleId}:${locale}`;
    if (identity.current !== nextIdentity) {
      identity.current = nextIdentity;
      position.current = Math.min(100, Math.max(0, props.initialProgress || 0));
      setFailed(false);
    }
    setCompiled(null);
    setPageReady(false);
    setSession(null);
    void compileArticleBookDocument({ articleId, title, sectionLabel, html, coverUrl, locale, fontScale: pageFontScale }, {signal: controller.signal}).then(result => {
      if (!current) { result.dispose(); return; }
      owned = result;
      if (!result.document.pages.length) { setFailed(true); return; }
      setCompiled(result);
      setSession(createBookInspectionSession({ bookKey: result.document.bookKey, pageCount: result.document.pages.length,
        pageIndex: Math.round((result.document.pages.length - 1) * position.current / 100),
        pages: result.document.pages, requestId: ++sequence.current }));
    }).catch(() => { if (current) setFailed(true); });
    return () => { current = false; controller.abort(); owned?.dispose(); };
  }, [articleId, title, sectionLabel, html, coverUrl, locale, pageFontScale]);

  useEffect(() => {
    if (!compiled) return;
    const update = () => {
      // The loader batches arrivals; changing textures waits for a settled sheet.
      if (session?.phase === "idle") setImageRevision(compiled.getImageRevision());
    };
    update();
    return compiled.subscribeImages(update);
  }, [compiled, session?.phase]);
  const textureRenderer = useMemo((): CompiledArticleBook["renderer"] | undefined => compiled
    ? (request, plan, key) => compiled.renderer(request, plan, key)
    : undefined, [compiled, imageRevision]);

  useEffect(() => {
    const request = props.restoreRequest;
    if (!request || request.articleId !== articleId || restoredRequest.current === request.id) return;
    position.current = Math.min(100, Math.max(0, request.progress));
    if (!session || session.phase !== "idle") return;
    restoredRequest.current = request.id;
    if (failed) return;
    const target = Math.round((session.pageCount - 1) * position.current / 100);
    const requestId = ++sequence.current;
    setSession(value => value ? settleBookInspectionSession(requestBookInspectionPage(value, requestId, target), requestId) : value);
  }, [articleId, props.restoreRequest, session?.phase, session?.pageCount, failed]);

  useEffect(() => {
    if (!failed && session?.phase === "idle") {
      position.current = session.pageCount > 1 ? session.pageIndex / (session.pageCount - 1) * 100 : 100;
      progressRef.current?.(position.current);
    }
  }, [failed, session?.pageIndex, session?.pageCount, session?.phase]);

  useEffect(() => {
    if (failed) props.onFallback?.();
  }, [failed, props.onFallback]);

  useEffect(() => {
    if (failed) position.current = Math.min(100, Math.max(0, props.initialProgress || 0));
  }, [failed, props.initialProgress]);

  const go = useCallback((pageIndex: number) => {
    setSession(value => value ? requestBookInspectionPage(value, ++sequence.current, pageIndex) : value);
  }, []);
  const keyboard = useCallback((key: string, shiftKey = false) => {
    if (failed || !session || session.phase !== "idle") return false;
    const target = getBookInspectionKeyboardTarget(session, key, shiftKey);
    if (target === null) return false;
    go(target);
    return true;
  }, [failed, go, session]);
  const startDrag = useCallback((direction: BookInspectionPageDirection) => {
    setSession(value => value ? beginBookInspectionDrag(value, ++sequence.current, direction) : value);
  }, []);
  const updateDrag = useCallback((progress: number) => {
    setSession(value => value ? updateBookInspectionDrag(value, value.requestId, progress) : value);
  }, []);
  const endDrag = useCallback((velocity: number) => {
    setSession(value => value ? endBookInspectionDrag(value, { requestId: value.requestId, velocity }) : value);
  }, []);
  const settled = useCallback((requestId: number) => {
    setSession(value => value ? settleBookInspectionSession(value, requestId) : value);
  }, []);
  const fail = useCallback(() => setFailed(true), []);
  const markReady = useCallback(() => setPageReady(true), []);
  const items = useMemo<readonly BookShelfPresentationItem[]>(() => compiled ? [{
    key: compiled.document.bookKey, title, writer: sectionLabel,
    coverUrl, baseColor: "#3b1553", accentColor: "#d99b53", paperColor: "#fff9ed",
  }] : [], [compiled, title, sectionLabel, coverUrl]);
  const page = compiled?.pages[session?.pageIndex || 0];
  const semanticHtml = useMemo(() => {
    const source = failed ? html : page?.html || "";
    if (typeof document === "undefined") return source;
    const container = document.createElement("div");
    container.innerHTML = source;
    if (failed) {
      if (coverUrl) {
        const figure = document.createElement("figure");
        const image = document.createElement("img");
        image.src = coverUrl;
        image.alt = title;
        figure.append(image);
        container.prepend(figure);
      }
      const heading = document.createElement("h1");
      heading.textContent = title;
      container.prepend(heading);
    }
    container.querySelectorAll<HTMLImageElement>("img").forEach(image => {
      const attributes = publicImageAttributes(image.getAttribute("src") || "", 1280, "(max-width: 700px) calc(100vw - 48px), 720px");
      Object.entries(attributes).forEach(([name, value]) => { if (value !== undefined) image.setAttribute(name, String(value)); });
      image.loading = "lazy";
      image.decoding = "async";
    });
    if (!onOpenImage) return container.innerHTML;
    container.querySelectorAll<HTMLImageElement>("img").forEach(image => {
      if (image.hasAttribute("data-decorative") || image.getAttribute("role") === "presentation") return;
      const description = image.alt.trim() || image.closest("figure")?.querySelector("figcaption")?.textContent?.trim();
      if (!description) return;
      image.tabIndex = 0;
      image.setAttribute("role", "button");
      image.setAttribute("aria-label", `${en ? "Enlarge image" : "Увеличить изображение"}: ${description}`);
    });
    return container.innerHTML;
  }, [failed, html, page?.html, onOpenImage, en, coverUrl, title]);
  const busy = !session || session.phase !== "idle";
  const phase = session?.phase === "dragging" ? "PAGE_DRAGGING" : session?.phase === "settling" ? "PAGE_SETTLING" : "BOOK_OPEN";
  const openImage = (target: EventTarget) => {
    if (!(target instanceof Element) || !onOpenImage) return false;
    const image = target.closest<HTMLImageElement>("img");
    if (!image || image.getAttribute("role") !== "button") return false;
    onOpenImage(image.currentSrc || image.src, image.alt);
    return true;
  };

  return <section className={`article-book-reader${failed ? " has-fallback" : ""}`} lang={locale} style={{ "--reader-scale": fontScale } as CSSProperties} aria-label={en ? "Illustrated book reader" : "Иллюстрированная книга"}
    data-article-book-reader="" data-page-index={session?.pageIndex ?? 0} data-page-count={session?.pageCount ?? 0} data-renderer={failed ? "text" : "three"} data-book-ready={pageReady} tabIndex={0}
    onKeyDown={event => {
      if ((event.key === "Enter" || event.key === " ") && (event.target as Element).matches('img[role="button"]') && openImage(event.target)) { event.preventDefault(); return; }
      if ((event.target as Element).closest("button, input, select, textarea, a, summary")) return;
      if (keyboard(event.key, event.shiftKey)) event.preventDefault();
    }}>
    {failed ? <div className="article-book-reader__fallback">
      <p role="status">{en ? "The book view is unavailable. The complete illustrated article remains readable below." : "Книжный просмотр недоступен. Полный текст с иллюстрациями доступен ниже."}</p>
      <div onClick={event => { if (openImage(event.target)) event.preventDefault(); }} dangerouslySetInnerHTML={{ __html: semanticHtml }} />
    </div> : <>
      <div className="article-book-reader__stage">
        {backdropUrl && <div className="article-book-reader__backdrop" data-article-book-backdrop="" aria-hidden="true" style={{ backgroundImage: `url(${JSON.stringify(backdropUrl)})` }} />}
        {compiled && session ? <BookShelfScene key={compiled.document.cacheKey} inspectionOnly textureRenderer={textureRenderer}
          onInspectionReady={markReady}
          items={items} appearance={appearance} focusedBookKey={compiled.document.bookKey} selectedBookKey={compiled.document.bookKey}
          phase={phase} requestId={session.requestId} active economical={false} reducedMotion={reducedMotion}
          editorialDocument={compiled.document} inspectionSession={session} loadAttempt="primary"
          onFocusBook={noop} onOpenBook={noop} onRequestCoverOpen={noop}
          onRequestPageTurn={() => go(session.pageIndex + 1)} onRequestPreviousPage={() => go(session.pageIndex - 1)} onRequestKeyboardPage={keyboard}
          onRequestInspectionClose={noop} onRequestSceneCenter={noop} onCrackCover={noop}
          onStartPageDrag={startDrag} onUpdatePageDrag={updateDrag} onRequestPageSettle={endDrag}
          onMotionReached={noop} onMotionSettled={noop} onInspectionEntered={noop} onCoverOpened={noop}
          onPageSettled={settled} onInspectionClosed={noop} onShelfRestored={noop} onFailure={fail}
          sceneLabel={en ? "Turn the book pages" : "Перелистывайте страницы книги"}
          loadingLabel={en ? "Opening the book…" : "Открываем книгу…"} emptyLabel="" />
          : <p className="article-book-reader__loading" role="status">{en ? "Preparing illustrated pages…" : "Готовим страницы с иллюстрациями…"}</p>}
        {compiled && !pageReady && <p className="article-book-reader__preparing" role="status">{en ? "Opening the book…" : "Открываем книгу…"}</p>}
      </div>
      <nav className="article-book-reader__controls" aria-label={en ? "Book pages" : "Страницы книги"}>
        <button type="button" disabled={busy || !session?.pageIndex} onClick={() => go((session?.pageIndex || 0) - 1)} aria-label={en ? "Previous page" : "Предыдущая страница"}>← <span>{en ? "Previous" : "Назад"}</span></button>
        <label><span className="article-book-reader__sr-only">{en ? "Page" : "Страница"}</span>
          <select aria-label={en ? "Page" : "Страница"} value={session?.pageIndex ?? 0} disabled={busy} onChange={event => go(Number(event.target.value))}>
            {compiled?.pages.map((item, index) => <option key={item.id} value={index}>{index + 1} / {compiled.pages.length}</option>)}
          </select>
        </label>
        <button type="button" disabled={busy || !session || session.pageIndex >= session.pageCount - 1} onClick={() => go((session?.pageIndex || 0) + 1)} aria-label={en ? "Next page" : "Следующая страница"}><span>{en ? "Next" : "Вперёд"}</span> →</button>
      </nav>
      <p className="article-book-reader__sr-only" role="status" aria-live="polite">{session ? `${en ? "Page" : "Страница"} ${session.pageIndex + 1} / ${session.pageCount}` : ""}</p>
      {page && <details className="article-book-reader__text">
        <summary>{en ? "Read this page as text" : "Прочитать страницу текстом"}</summary>
        <div data-article-book-page={page.id} onClick={event => { if (openImage(event.target)) event.preventDefault(); }} dangerouslySetInnerHTML={{ __html: semanticHtml }} />
      </details>}
    </>}
  </section>;
}
