import { useLayoutEffect, useRef, useState } from "react";
import type { ChildEntityReference } from "./childPackage";
import type { ChildNativeAppController, ChildNativeEntity } from "./childNativeAppBridge";
import type { ChildNativeDiscoveryResult, ChildNativeDiscoveryShelf, ChildNativePassport } from "./childNativeDiscoveryPassport";
import type { ChildNativeRouteMediaDownload } from "./childNativePassportProgram";

export type ChildNativeDiscoveryPassportViewName = ChildNativeDiscoveryShelf | "passport" | "home";
export const childDiscoveryPassportLabels = {
  ru: { writers: "Писатели для моего возраста", books: "Книги для моего возраста", collections: "Мягкие подборки",
    passport: "Мой литературный паспорт", loading: "Проверяем материалы…", empty: "Пока ничего нет.",
    unavailable: "Эти материалы сейчас недоступны.", retry: "Проверить снова", home: "На главную",
    private: "Этот паспорт хранится на устройстве. Взрослый может очистить историю в родительских настройках.",
    countries: "Открытые страны", studiedWriters: "Изученные писатели", studiedWorks: "Изученные произведения",
    journeys: "Завершённые путешествия", badges: "Значки", routes: "Скачанные маршруты",
    badgesUnavailable: "Значки пока недоступны.", routesUnavailable: "Сведения о сохранённых маршрутах пока недоступны.",
    learning: "Здесь появляются писатели и произведения после завершённых обучающих шагов путешествия.",
    routeText: "Тексты этих маршрутов сохранены на устройстве.", startRoute: "Открыть маршрут",
    audioSaved: "Озвучивание и его текст скачаны.", audioMissing: "Озвучивание не скачано. Можно читать текст маршрута.",
    ru: "Русский", en: "Английский",
    retained: "Ранее пройденные шаги сохранены. Некоторые материалы сейчас недоступны." },
  en: { writers: "Writers for my age", books: "Books for my age", collections: "Gentle collections",
    passport: "My literary passport", loading: "Checking content…", empty: "Nothing here yet.",
    unavailable: "This content is currently unavailable.", retry: "Check again", home: "Back home",
    private: "This passport stays on this device. An adult can clear its history in parent settings.",
    countries: "Opened countries", studiedWriters: "Studied writers", studiedWorks: "Studied works",
    journeys: "Completed journeys", badges: "Badges", routes: "Downloaded routes",
    badgesUnavailable: "Badges are currently unavailable.", routesUnavailable: "Information about saved routes is currently unavailable.",
    learning: "Writers and works appear here after completed learning steps in a journey.",
    routeText: "The texts of these routes are saved on this device.", startRoute: "Open route",
    audioSaved: "Narration and its transcript are downloaded.", audioMissing: "Narration is not downloaded. You can read the route text.",
    ru: "Russian", en: "English",
    retained: "Earlier completed steps are saved. Some content is currently unavailable." },
} as const;
export function childNativeRouteAudioStatus(language: "ru" | "en", media: ChildNativeRouteMediaDownload): string {
  const copy = childDiscoveryPassportLabels[language];
  return copy[media.locale] + " · " + (media.audioStatus === "downloaded" ? copy.audioSaved : copy.audioMissing);
}
export interface ChildNativeDiscoveryPassportViewProps {
  controller: ChildNativeAppController; contextToken: string; profileId: string; language: "ru" | "en";
  view: ChildNativeDiscoveryPassportViewName; visible: boolean;
  onRequestView(view: ChildNativeDiscoveryPassportViewName): void;
  onOpen(reference: ChildEntityReference): void;
  onStartJourney?(journeyId: string): void;
}
type Loaded = { key: string; phase: "loading" | "ready" | "unavailable"; discovery: ChildNativeDiscoveryResult | null; passport: ChildNativePassport | null };
/** Only native projections are displayed. Retired titles are hidden by an
 * exact render key even before layout-effect cleanup. Rendering never records
 * a country open, completes a learning step, or persists a child record. */
export function ChildNativeDiscoveryPassportView(props: ChildNativeDiscoveryPassportViewProps) {
  const { controller, contextToken, profileId, language, view, visible } = props, copy = childDiscoveryPassportLabels[language];
  const key = [contextToken, profileId, language, view, visible ? "visible" : "hidden"].join("/");
  const [loaded, setLoaded] = useState<Loaded>({ key: "", phase: "loading", discovery: null, passport: null });
  const [retry, setRetry] = useState(0), latest = useRef(props), sequence = useRef(0);
  latest.current = props;
  useLayoutEffect(() => {
    const attempt = ++sequence.current; let live = true;
    setLoaded({ key, phase: "loading", discovery: null, passport: null });
    if (visible) void Promise.resolve().then(async () => {
      const captured = latest.current;
      const current = () => live && sequence.current === attempt && latest.current.contextToken === contextToken
        && latest.current.profileId === profileId && latest.current.language === language && latest.current.view === view && latest.current.visible
        && controller.getSnapshot().phase === "ready" && controller.getSnapshot().status === "child"
        && controller.getSnapshot().context?.token === contextToken && controller.getSnapshot().context?.profileId === profileId
        && controller.getSnapshot().context?.locale === language;
      if (!current()) return;
      try {
        const value = view === "passport" ? await controller.passport?.read() ?? null
          : await controller.discovery?.list(view === "home" ? "collections" : view) ?? null;
        if (!current() || latest.current !== captured && latest.current.contextToken !== contextToken) return;
        setLoaded({ key, phase: value ? "ready" : "unavailable", discovery: view === "passport" ? null : value as ChildNativeDiscoveryResult | null,
          passport: view === "passport" ? value as ChildNativePassport | null : null });
      } catch { if (current()) setLoaded({ key, phase: "unavailable", discovery: null, passport: null }); }
    });
    return () => { live = false; ++sequence.current; };
  }, [controller, contextToken, profileId, language, view, visible, retry, key]);
  if (!visible) return null;
  const state = loaded.key === key ? loaded : { key, phase: "loading" as const, discovery: null, passport: null };
  const open = (row: ChildNativeEntity) => {
    const c = controller.getSnapshot().context;
    if (controller.getSnapshot().phase === "ready" && controller.getSnapshot().status === "child"
      && c?.token === contextToken && c.profileId === profileId && c.locale === language && loaded.key === key && state.phase === "ready") props.onOpen(row.reference);
  };
  function rows(title: string, values: readonly ChildNativeEntity[]) {
    return <section><h3>{title} · {values.length}</h3>{!values.length && <p>{copy.empty}</p>}
      <ul>{values.map(row => <li key={row.reference.kind + "/" + row.reference.id}>
        <button type="button" onClick={() => open(row)}>{row.payload.title}</button>
      </li>)}</ul></section>;
  }
  const passport = state.passport;
  return <section className="child-native-discovery-passport" aria-busy={state.phase === "loading"}
    data-child-discovery-view={view} aria-label={view === "home" ? copy.collections : copy[view]}>
    {view === "home" ? <div className="child-native-home-actions">
      <button type="button" onClick={() => props.onRequestView("writers")}>{copy.writers}</button>
      <button type="button" onClick={() => props.onRequestView("books")}>{copy.books}</button>
      <button type="button" onClick={() => props.onRequestView("passport")}>{copy.passport}</button>
      <h2>{copy.collections}</h2>
    </div> : <><h2>{copy[view]}</h2><button type="button" onClick={() => props.onRequestView("home")}>{copy.home}</button></>}
    {state.phase === "loading" ? <p role="status">{copy.loading}</p> : state.phase === "unavailable" ? <div>
      <p role="status">{copy.unavailable}</p><button type="button" onClick={() => setRetry(value => value + 1)}>{copy.retry}</button>
    </div> : passport ? <div data-child-passport="private-local">
      <p>{copy.private}</p><p>{copy.learning}</p>
      {rows(copy.countries, passport.countries)}{rows(copy.studiedWriters, passport.writers)}{rows(copy.studiedWorks, passport.works)}
      <section><h3>{copy.journeys} · {passport.journeys.length}</h3>{!passport.journeys.length && <p>{copy.empty}</p>}
        <ul>{passport.journeys.map(journey => <li key={journey.journeyId}>{journey.title}</li>)}</ul></section>
      {!!passport.unresolvedCompletedNodeIds.length && <p role="status">{copy.retained}</p>}
      <section data-child-passport-badges={passport.badges.status}><h3>{copy.badges} · {passport.badges.items.length}</h3>
        {passport.badges.status === "unavailable" ? <p>{copy.badgesUnavailable}</p> : !passport.badges.items.length ? <p>{copy.empty}</p>
          : <ul>{passport.badges.items.map(badge => <li key={badge.programChecksum + "/" + badge.badgeId + "/" + badge.ruleVersion}>{badge.title}</li>)}</ul>}
      </section>
      <section data-child-passport-downloads={passport.downloadedRoutes.status}><h3>{copy.routes} · {passport.downloadedRoutes.items.length}</h3>
        {passport.downloadedRoutes.status === "unavailable" ? <p>{copy.routesUnavailable}</p> : !passport.downloadedRoutes.items.length ? <p>{copy.empty}</p>
          : <><p>{copy.routeText}</p><ul>{passport.downloadedRoutes.items.map(route => <li key={route.journeyId}>
            <p data-child-route-audio={route.media.audioStatus} lang={language}>{childNativeRouteAudioStatus(language, route.media)}</p>
            <button type="button" onClick={() => {
              const state = controller.getSnapshot(), context = state.context;
              if (state.phase === "ready" && state.status === "child" && context?.token === contextToken
                && context.profileId === profileId && context.locale === language && loaded.key === key) props.onStartJourney?.(route.journeyId);
            }}>{copy.startRoute} · {route.title}</button>
          </li>)}</ul></>}
      </section>
    </div> : <>
      {!state.discovery?.items.length && <p>{copy.empty}</p>}
      <ul>{state.discovery?.items.map(row => <li key={row.reference.kind + "/" + row.reference.id}>
        <button type="button" onClick={() => open(row)}>{row.payload.title}</button>
      </li>)}</ul>
    </>}
  </section>;
}
