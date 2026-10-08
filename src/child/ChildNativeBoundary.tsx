import { childCanonicalGlobeAtlasCountries, projectChildNativeGlobeCountry, resolveChildGlobeCountry } from "./childCanonicalGlobeGeometry";
import { createChildCanonicalResources, type ChildCanonicalSnapshot } from "./childNativeCanonicalResources";
import type { ChildNativeSceneSummary } from "./childNativeScene";
import { ChildNativeMediaView } from "./ChildNativeMediaView";
import { ChildNativeJourneyView } from "./ChildNativeJourneyView";
import { ChildNativeReadingView } from "./ChildNativeReadingView";
import { ChildPrivacyNotice } from "./ChildPrivacyNotice";
import { ChildHelp } from "./ChildHelp";
import { ChildNativeLocaleControl } from "./ChildNativeLocaleControl";
import { ParentChildLocaleLockControl } from "./ParentChildLocaleLockControl";
import { ParentChildLocalePolicyControl } from "./ParentChildLocalePolicyControl";
import type { ChildLocalePolicy } from "./childProfile";
import { ChildNativeDiscoveryPassportView, type ChildNativeDiscoveryPassportViewName } from "./ChildNativeDiscoveryPassportView";
import type { ChildNativeRemovalTarget } from "./childNativeDiscoveryPassport";
import { childNativeJourneyId } from "./childNativeJourney";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { ChildNativeAppController, ChildNativeAppSnapshot, ChildNativeCollection,
  ChildNativeCollectionValue, ChildNativeEntity, ChildNativeAction } from "./childNativeAppBridge";
import type { ChildEntityReference } from "./childPackage";
import { CHILD_NATIVE_EXPORT_IDLE, decodeChildNativeExportReceipt } from "./childNativeExport";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import LiteraryWorldMap from "../components/LiteraryWorldMap";
import type { Country } from "../data/countries/types";
import BookyPlayControl from "../host/BookyPlayControl";
import { createBookySizeController } from "../host/bookySizePreference";
import { usePlatformServices } from "../platform/PlatformServices";
import mascotImage from "../assets/mascots/knizhulyk-green-v1.png";
import { createPlanetSceneInspectionController } from "../host/planetSceneInspection";
import "./ChildNativeBoundary.css";

const same = (a: ChildEntityReference, b: ChildEntityReference) => a.kind === b.kind && a.id === b.id && a.contentChecksum === b.contentChecksum;
const labels = {
  ru: { title: "Литературная планета", waiting: "Проверяем защищённый профиль…", unavailable: "Защищённый профиль пока недоступен.",
    content: "Детские материалы пока недоступны.", retry: "Проверить снова", parent: "Спросить взрослого", profiles: "Профили на устройстве",
    initialize: "Настроить защищённое хранение", initializeText: "Подтвердите владельца устройства, чтобы сохранить настройку.",
    pin: "Установить родительский PIN", replace: "Изменить PIN", recover: "Восстановить PIN", create: "Добавить детский профиль",
    nickname: "Имя профиля", age: "Полных лет", locale: "Язык профиля", reading: "Уровень чтения", none: "Не выбран",
    plain: "Начальный", developing: "Развивающийся", fluent: "Свободный", enter: "Открыть детский профиль", exit: "Вернуться ко взрослому профилю",
    save: "Подтвердить на устройстве", close: "Закрыть", local: "Профили, возраст и PIN хранятся на этом устройстве.",
    failed: "Действие не завершено. Проверьте текущее состояние профиля.", search: "Поиск", home: "Главная", back: "Назад",
    favorites: "Избранное", recent: "Недавнее", offline: "Сохранённое", empty: "Пока ничего нет.", add: "Сохранить", remove: "Убрать",
    loading: "Открываем материал…", bodyUnavailable: "Этот материал сейчас недоступен.", noResults: "Ничего не найдено.",
    parentDetails: "Родительские настройки", settings: "Настройки профиля", confirmAge: "Подтверждаю возраст и настройки",
    sound: "Звук", narration: "Озвучивание", lock: "Язык меняет только взрослый", calm: "Спокойное движение",
    topics: "Запрещённые темы", blockedTopicsHelp: "Коды тем через запятую", ageAction: "Подтвердить возраст", topicAction: "Изменить темы" },
  en: { title: "Literary Planet", waiting: "Checking the secure profile…", unavailable: "The secure profile is unavailable.",
    content: "Child content is currently unavailable.", retry: "Check again", parent: "Ask an adult", profiles: "Profiles on this device",
    initialize: "Set up secure storage", initializeText: "Confirm the device owner to save this setting.",
    pin: "Set parent PIN", replace: "Change PIN", recover: "Recover PIN", create: "Add child profile",
    nickname: "Profile name", age: "Age in whole years", locale: "Profile language", reading: "Reading level", none: "Not selected",
    plain: "Beginning", developing: "Developing", fluent: "Fluent", enter: "Open child profile", exit: "Return to adult profile",
    save: "Confirm on this device", close: "Close", local: "Profiles, ages and PIN stay on this device.",
    failed: "The action did not finish. Check the current profile state.", search: "Search", home: "Home", back: "Back",
    favorites: "Favorites", recent: "Recent", offline: "Saved", empty: "Nothing here yet.", add: "Save", remove: "Remove",
    loading: "Opening content…", bodyUnavailable: "This content is currently unavailable.", noResults: "No results found.",
    parentDetails: "Parent settings", settings: "Profile settings", confirmAge: "I confirm the age and settings",
    sound: "Sound", narration: "Narration", lock: "Only an adult can change language", calm: "Calm motion",
    topics: "Blocked topics", blockedTopicsHelp: "Topic codes, separated by commas", ageAction: "Confirm age", topicAction: "Change topics" },
} as const;
const idleExportSnapshot = () => CHILD_NATIVE_EXPORT_IDLE;
/** Only the exact native receipt can report a saved file. This observation
 * remains available while the original private child tree is sealed. */
export function ParentChildExportStatus({ controller }: { controller: ChildNativeAppController }) {
  const state = useSyncExternalStore(controller.subscribe, controller.getExportSnapshot ?? idleExportSnapshot, controller.getExportSnapshot ?? idleExportSnapshot);
  const { language } = useInterfaceLanguage();
  if (state.phase === "idle") return null;
  const receipt = state.receipt && decodeChildNativeExportReceipt(state.receipt, state.receipt.requestId, state.receipt.profileId);
  const copy = language === "ru" ? {
    saving: "Сохраняем копию данных со взрослым…", saved: "Файл экспорта сохранён.", cancelled: "Экспорт отменён.",
    error: "Не удалось сохранить файл экспорта.", unavailable: "Сохранение экспорта не подтверждено." }
    : { saving: "Saving a data copy with an adult…", saved: "The export file was saved.", cancelled: "Export cancelled.",
      error: "The export file could not be saved.", unavailable: "The export save could not be confirmed." };
  const outcome = state.phase === "complete" && receipt ? receipt.outcome : null;
  const message = state.phase === "saving" ? copy.saving : outcome ? copy[outcome] : copy.unavailable;
  return <p role={outcome === "error" || state.phase === "unavailable" || state.phase === "complete" && !receipt ? "alert" : "status"}
    aria-live="polite" data-child-native-export={state.phase}>{message}</p>;
}
export function NativeProfileExportControl({ controller, profileId, label, disabled = false }: {
  controller: ChildNativeAppController; profileId: string; label: string; disabled?: boolean;
}) {
  const state = useSyncExternalStore(controller.subscribe, controller.getExportSnapshot ?? idleExportSnapshot, controller.getExportSnapshot ?? idleExportSnapshot);
  const { language } = useInterfaceLanguage();
  return <button disabled={disabled || state.phase === "saving" || typeof controller.exportChildData !== "function"}
    type="button" onClick={() => { void controller.exportChildData?.(profileId); }}>
    {language === "ru" ? "Сохранить копию данных со взрослым" : "Save a data copy with an adult"} · {label}</button>;
}
export function ChildNativeClosedView({ snapshot, controller }: { snapshot: ChildNativeAppSnapshot; controller: ChildNativeAppController }) {
  const { language } = useInterfaceLanguage(), copy = labels[language];
  const waiting = snapshot.phase === "transition" || snapshot.phase === "sealed" && snapshot.reason === null;
  return <main className="child-native-closed" data-child-native-phase={snapshot.phase}>
    <h1>{copy.title}</h1>
    {snapshot.status !== "blocked-child" && <ParentChildExportStatus controller={controller} />}
    <p role={waiting || snapshot.status === "first-install-required" ? "status" : "alert"}>{waiting ? copy.waiting
      : snapshot.status === "first-install-required" ? copy.initializeText : snapshot.status === "blocked-child" ? copy.content : copy.unavailable}</p>
    {snapshot.status === "first-install-required" ? <>
      <button type="button" onClick={() => { void controller.perform("first-install"); }}>{copy.initialize}</button>
    </> : snapshot.phase !== "transition" && <button type="button" onClick={() => { void controller.refresh(); }}>{copy.retry}</button>}
    {snapshot.phase === "transition" && <button type="button" onClick={() => { void controller.suspend(); }}>
      {language === "ru" ? "Отмена" : "Cancel"}</button>}
    {snapshot.status === "blocked-child" && <NativeProfileControls controller={controller} snapshot={snapshot} />}
  </main>;
}
/** Inputs are proposals. Actual native owner/PIN UI fixes and authenticates the
 * target and generated UID; no form result is a permission or successful write. */
export function NativeProfileControls({ controller, snapshot }: { controller: ChildNativeAppController; snapshot?: ChildNativeAppSnapshot }) {
  const live = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const state = snapshot ?? live, { language } = useInterfaceLanguage(), copy = labels[language];
  const [open, setOpen] = useState(false), [creating, setCreating] = useState(false), [editing, setEditing] = useState(false), [busy, setBusy] = useState(false);
  const [label, setLabel] = useState(""), [age, setAge] = useState(""), [locale, setLocale] = useState<"ru" | "en">(language);
  const [reading, setReading] = useState<"plain" | "developing" | "fluent" | "">(""), [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState(false), [topicInput, setTopicInput] = useState("");
  const [removal, setRemoval] = useState<(ChildNativeRemovalTarget & { contextToken: string; language: "ru" | "en" }) | null>(null);
  const selectedRemoval = removal && removal.contextToken === state.context?.token && removal.language === language && state.profiles.find(profile => profile.id === removal.profileId);
  const mounted = useRef(true), sequence = useRef(0), trigger = useRef<HTMLButtonElement>(null);
  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; ++sequence.current; }; }, []);
  useLayoutEffect(() => { setRemoval(null); }, [state.context?.token, language]);
  async function act(action: ChildNativeAction, target: unknown = null) {
    if (busy || state.phase !== "ready") return; const attempt = ++sequence.current;
    setBusy(true); setError(false);
    const ok = await controller.perform(action, target);
    if (mounted.current && sequence.current === attempt) { setBusy(false); setError(!ok); if (ok) setRemoval(null); }
  }
  async function actLocalePolicy(policy: ChildLocalePolicy) {
    if (busy || state.phase !== "ready" || !state.context || !controller.setProfileLocalePolicy) return;
    const attempt = ++sequence.current, original = state.context;
    setBusy(true); setError(false);
    const ok = await controller.setProfileLocalePolicy(original, policy);
    if (mounted.current && sequence.current === attempt) { setBusy(false); setError(!ok); }
  }
  async function actLocaleLock(locked: boolean) {
    if (busy || state.phase !== "ready" || !state.context || !controller.setProfileLocaleLocked) return;
    const attempt = ++sequence.current, original = state.context;
    setBusy(true); setError(false);
    const ok = await controller.setProfileLocaleLocked(original, locked);
    if (mounted.current && sequence.current === attempt) { setBusy(false); setError(!ok); }
  }
  if (state.phase !== "ready" || !state.context) return null;
  const selectedLocalePolicy = state.profiles.find(profile => profile.id === state.context?.profileId)?.localePolicy;
  const localePermitted = !selectedLocalePolicy || selectedLocalePolicy.allowedLocales.includes(locale);
  const validAge = /^[0-9]{1,2}$/u.test(age) && Number(age) >= 3 && Number(age) <= 17;
  const validLabel = label.trim() === label && label.length > 0 && label.length <= 80 && !/[\u0000-\u001f\u007f]/u.test(label);
  const topicValues = topicInput.trim() === "" ? [] : topicInput.split(",").map(value => value.trim());
  const validTopics = topicValues.length <= 64 && topicValues.every(value => /^[a-z0-9][a-z0-9._-]{0,63}$/u.test(value)) && new Set(topicValues).size === topicValues.length;
  return <section className="child-native-parent" data-child-native-profiles="">
    <button ref={trigger} type="button" aria-expanded={open} onClick={() => { setOpen(value => !value); setError(false); setRemoval(null); }}>
      {state.context.mode === "child" ? copy.parent : copy.profiles}
    </button>
    {state.context.mode === "child" && !open && <ChildHelp language={language}
      askAdultLabel={copy.parent} closeLabel={copy.close} disabled={busy}
      onAskAdult={() => { trigger.current?.click(); trigger.current?.focus({ preventScroll: true }); }} />}
    <ParentChildExportStatus controller={controller} />
    {open && <div className="child-native-parent-panel" role="region" aria-label={copy.parentDetails}>
      <h2>{copy.profiles}</h2><p>{copy.local}</p>
      {state.status === "unenrolled" ? <button disabled={busy} type="button" onClick={() => { void act("enroll-pin"); }}>{copy.pin}</button> : <>
        {state.profiles.map(profile => <div key={profile.id} className="child-native-profile-row">
          <NativeProfileExportControl controller={controller} profileId={profile.id} label={profile.label} disabled={busy} />
          <button disabled={busy || state.context?.mode === "child" && state.context.profileId === profile.id}
            type="button" onClick={() => { void act("enter-child", { profileId: profile.id }); }}>{profile.label} · {profile.exactAge}</button>
          <button disabled={busy} type="button" onClick={() => { setRemoval({ profileId: profile.id, scope: "history", contextToken: state.context!.token, language }); setCreating(false); setEditing(false); }}>
            {language === "ru" ? "Очистить историю и паспорт" : "Clear history and passport"} · {profile.label}</button>
          <button disabled={busy} type="button" onClick={() => { setRemoval({ profileId: profile.id, scope: "profile", contextToken: state.context!.token, language }); setCreating(false); setEditing(false); }}>
            {language === "ru" ? "Удалить профиль" : "Remove profile"} · {profile.label}</button>
          <button disabled={busy} type="button" onClick={() => { setRemoval({ profileId: profile.id, scope: "downloads", contextToken: state.context!.token, language }); setCreating(false); setEditing(false); }}>
            {language === "ru" ? "Удалить скачанные маршруты" : "Remove downloaded routes"} · {profile.label}</button>
        </div>)}
        {removal && selectedRemoval && <div className="child-native-removal" role="region"
          aria-label={language === "ru" ? "Подтверждение удаления" : "Removal confirmation"}>
          <h3>{selectedRemoval.label}</h3>
          <p>{removal.scope === "history"
            ? language === "ru" ? "Очистить историю, литературный паспорт, значки и скачанные маршруты этого профиля? Имя, PIN, оформление и избранное останутся."
              : "Clear this profile's history, literary passport, badges and downloaded routes? Its name, the parent PIN, appearance and favorites will stay."
            : removal.scope === "downloads"
              ? language === "ru" ? "Удалить скачанные тексты, изображения, озвучивание и тексты озвучивания маршрутов этого профиля с устройства? Пройденные шаги, значки, избранное, оформление и другие профили останутся."
                : "Remove this profile's downloaded route texts, images, narration and transcripts from this device? Completed steps, badges, favorites, appearance and other profiles will stay."
            : language === "ru" ? "Удалить этот профиль и все его данные на устройстве? Другие профили и родительский PIN останутся."
              : "Remove this profile and all its data on this device? Other profiles and the parent PIN will stay."}</p>
          <button disabled={busy} type="button" onClick={() => { void act("delete-child-data", { profileId: removal.profileId, scope: removal.scope }); }}>
            {language === "ru" ? "Подтвердить со взрослым" : "Confirm with an adult"}</button>
          <button disabled={busy} type="button" onClick={() => setRemoval(null)}>{language === "ru" ? "Отмена" : "Cancel"}</button>
        </div>}
        {state.context.mode === "child" && <button disabled={busy} type="button" onClick={() => { void act("exit-child-mode"); }}>{copy.exit}</button>}
        {state.context.mode === "child" && <button disabled={busy} type="button" onClick={() => {
          setEditing(value => !value); setCreating(false); setConfirmed(false);
          const selected = state.profiles.find(profile => profile.id === state.context?.profileId);
          setAge(selected ? String(selected.exactAge) : ""); setLocale(selected?.locale ?? language);
        }}>{copy.settings}</button>}
        {editing && state.context.mode === "child" && <div className="child-native-profile-edit">
          <form onSubmit={event => { event.preventDefault(); if (validAge && confirmed) void act("change-exact-age", { profileId: state.context!.profileId, exactAge: Number(age) }); }}>
            <label>{copy.age}<input value={age} inputMode="numeric" autoComplete="off" pattern="[0-9]{1,2}"
              onChange={event => { setAge(event.currentTarget.value); setConfirmed(false); }} /></label>
            <label className="child-native-check"><input type="checkbox" checked={confirmed}
              onChange={event => setConfirmed(event.currentTarget.checked)} />{copy.confirmAge}</label>
            <button type="submit" disabled={busy || !validAge || !confirmed}>{copy.ageAction}</button>
          </form>
          <form onSubmit={event => { event.preventDefault(); if (validTopics) void act("change-blocked-topics", { profileId: state.context!.profileId, blockedTopics: topicValues }); }}>
            <label>{copy.topics}<input value={topicInput} maxLength={4096} autoComplete="off"
              onChange={event => setTopicInput(event.currentTarget.value)} /></label>
            <small>{copy.blockedTopicsHelp}</small>
            <button type="submit" disabled={busy || !validTopics}>{copy.topicAction}</button>
          </form>
          <form onSubmit={event => { event.preventDefault(); if (localePermitted) void act("expand-access-settings", { profileId: state.context!.profileId, changes: { locale } }); }}>
            <label>{copy.locale}<select value={locale} onChange={event => setLocale(event.currentTarget.value as "ru" | "en")}>
              <option value="ru">Русский</option><option value="en">English</option></select></label>
            {!localePermitted && <p role="status">{language === "ru" ? "Сначала разрешите этот язык со взрослым ниже." : "First allow this language with an adult below."}</p>}
            <button type="submit" disabled={busy || !localePermitted}>{copy.save}</button>
          </form>
          <ParentChildLocalePolicyControl snapshot={live} expectedContext={state.context} disabled={busy || !controller.setProfileLocalePolicy}
            onRequest={policy => { void actLocalePolicy(policy); }} />
          <ParentChildLocaleLockControl snapshot={live} expectedContext={state.context} disabled={busy || !controller.setProfileLocaleLocked}
            onRequest={locked => { void actLocaleLock(locked); }} />
          <form onSubmit={event => { event.preventDefault(); void act("expand-access-settings", { profileId: state.context!.profileId, changes: { readingLevel: reading || null } }); }}>
            <label>{copy.reading}<select value={reading} onChange={event => setReading(event.currentTarget.value as typeof reading)}>
              <option value="">{copy.none}</option><option value="plain">{copy.plain}</option>
              <option value="developing">{copy.developing}</option><option value="fluent">{copy.fluent}</option></select></label>
            <button type="submit" disabled={busy}>{copy.save}</button>
          </form>
        </div>}
        <button disabled={busy} type="button" onClick={() => { void act("replace-pin"); }}>{copy.replace}</button>
        <button disabled={busy} type="button" onClick={() => { void act("recover-pin"); }}>{copy.recover}</button>
        {state.profiles.length < 4 && <button disabled={busy} type="button" onClick={() => { setCreating(value => !value); setEditing(false); setConfirmed(false); }}>{copy.create}</button>}
        {creating && <form onSubmit={event => {
          event.preventDefault();
          if (!validAge || !validLabel || !confirmed) return;
          void act("create-profile", { label, exactAge: Number(age), locale, readingLevel: reading || null,
            allowedTopics: null, blockedTopics: [], soundEnabled: false, motion: "calm", narrationEnabled: false });
        }}>
          <label>{copy.nickname}<input value={label} maxLength={80} autoComplete="off" onChange={event => setLabel(event.currentTarget.value)} /></label>
          <label>{copy.age}<input value={age} inputMode="numeric" pattern="[0-9]{1,2}" min={3} max={17} autoComplete="off"
            onChange={event => { setAge(event.currentTarget.value); setConfirmed(false); }} /></label>
          <label>{copy.locale}<select value={locale} onChange={event => setLocale(event.currentTarget.value as "ru" | "en")}>
            <option value="ru">Русский</option><option value="en">English</option></select></label>
          <label>{copy.reading}<select value={reading} onChange={event => setReading(event.currentTarget.value as typeof reading)}>
            <option value="">{copy.none}</option><option value="plain">{copy.plain}</option>
            <option value="developing">{copy.developing}</option><option value="fluent">{copy.fluent}</option></select></label>
          <label className="child-native-check"><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.currentTarget.checked)} />{copy.confirmAge}</label>
          <button type="submit" disabled={busy || !validAge || !validLabel || !confirmed}>{copy.save}</button>
        </form>}
      </>}
      {error && <p role="alert">{copy.failed}</p>}
      <button type="button" onClick={() => { setOpen(false); setRemoval(null); trigger.current?.focus(); }}>{copy.close}</button>
    </div>}
  </section>;
}
const emptyCountries: Country[] = [];
const emptySceneValue: ChildCanonicalSnapshot={phase:"empty",revision:0,scene:null,textures:null,preview:null};
const emptySceneSnapshot=()=>emptySceneValue;
const emptySceneSubscribe=()=>()=>undefined;
export function ChildNativeReadyView({ controller, snapshot, retainedProfileId }: {
  controller: ChildNativeAppController; snapshot: ChildNativeAppSnapshot; retainedProfileId?: string;
}) {
  const { language } = useInterfaceLanguage(), copy = labels[language], services = usePlatformServices();
  const c = snapshot.context;
  const resources=useMemo(()=>c?createChildCanonicalResources(controller,c.token):null,[controller,c?.token]);
  const [scenes,setScenes]=useState<readonly ChildNativeSceneSummary[]>([]);
  const [sceneOwner,setSceneOwner]=useState<ChildNativeEntity|null>(null);
  const sceneState=useSyncExternalStore(resources?.subscribe??emptySceneSubscribe,resources?.getSnapshot??emptySceneSnapshot,resources?.getSnapshot??emptySceneSnapshot);
  const sceneInspection=useMemo(()=>createPlanetSceneInspectionController(),[resources]);
  const inspectionState=useSyncExternalStore(sceneInspection.subscribe,sceneInspection.getSnapshot,sceneInspection.getSnapshot);
  const sceneMarkerRef=useRef<HTMLButtonElement>(null), sceneTriggerRef=useRef<HTMLButtonElement|null>(null), exploreTriggerRef=useRef<HTMLButtonElement>(null);
  const [sceneError,setSceneError]=useState(false);
  const shownScene=sceneState.preview?.phase==="ready"||sceneState.preview?.phase==="applying"?sceneState.preview.scene:sceneState.scene;
  const sceneInspectionBridge=useMemo(()=>({controller:sceneInspection,markerRef:sceneMarkerRef,mode:inspectionState.mode,
    cameraSession:sceneState.preview?`child-preview:${c?.token}:${sceneState.preview.revision}`
      :inspectionState.sessionId===null?null:`child-explore:${c?.token}:${inspectionState.sessionId}`}),
    [sceneInspection,inspectionState.mode,inspectionState.sessionId,sceneState.preview?.revision,c?.token]);
  useLayoutEffect(()=>resources?.activate(),[resources]);
  const [current, setCurrent] = useState<ChildNativeEntity | null>(null), [loading, setLoading] = useState(true);
  const [roots, setRoots] = useState<readonly ChildNativeEntity[]>([]), [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<readonly ChildNativeEntity[] | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [history, setHistory] = useState<readonly ChildEntityReference[]>([]);
  const [collection, setCollection] = useState<ChildNativeCollection | null>(null);
  const [saved, setSaved] = useState<ChildNativeCollectionValue | null>(null), [savedRows, setSavedRows] = useState<readonly ChildNativeEntity[]>([]);
  const sequence = useRef(0), mounted = useRef(true), context = useRef(c); context.current = c;
  const pendingCountryOpen = useRef<{ contextToken: string; profileId: string; attempt: number; reference: ChildEntityReference } | null>(null);
  const previousProfile = useRef(c?.profileId ?? retainedProfileId ?? null);
  const [journeyActive,setJourneyActive]=useState(false),[journeyNavigation,setJourneyNavigation]=useState(0);
  const [discoveryView, setDiscoveryView] = useState<ChildNativeDiscoveryPassportViewName | null>(null);
  const journeyIntent=useRef<{profileId:string;journeyId:string}|null>(null);
  const onJourneyActive=useCallback((active:boolean)=>{setJourneyActive(active);if(active){setDiscoveryView(null);pendingCountryOpen.current=null;}},[]);
  const onJourneyIntent=useCallback((journeyId:string|null)=>{
    const profileId=context.current?.profileId;
    journeyIntent.current=journeyId&&profileId?{profileId,journeyId}:null;
  },[]);
  // Only logical route intent survives a seal. Fresh native references and
  // their locale checksums must be resolved again before any text is shown.
  const navigationIntent = useRef<{ profileId: string; current: string | null; history: string[]; collection: ChildNativeCollection | null } | null>(null);
  const hydratedContext = useRef<typeof c>(null);
  const logicalKey = (ref: ChildEntityReference) => ref.kind + "/" + ref.id;
  useLayoutEffect(() => {
    if(c?.profileId && hydratedContext.current === c) navigationIntent.current = {
      profileId:c.profileId,current:current ? logicalKey(current.reference) : null,
      history:history.map(logicalKey),collection,
    };
  }, [c,current,history,collection]);
  const size = useMemo(() => createBookySizeController({ preferences: services.preferences, enabled: true }), [services.preferences]);
  const sizeSnapshot = useSyncExternalStore(size.subscribe, size.getSnapshot, size.getServerSnapshot);
  useLayoutEffect(() => size.activate(), [size]);
  useLayoutEffect(() => { mounted.current = true; return () => { mounted.current = false; ++sequence.current; }; }, []);
  const countries = useMemo<Country[]>(() => roots.flatMap(row => {
    const country = projectChildNativeGlobeCountry(row); return country ? [country] : [];
  }), [roots]);
  const onJourneyNode=useCallback((node:ChildNativeEntity|null)=>{
    if(node?.reference.kind!=="country")return;
    const country=resolveChildGlobeCountry(node.reference,countries);
    if(country)setSelectedCountry(country);
  },[countries]);
  async function resolve(ref: ChildEntityReference): Promise<ChildNativeEntity | null> {
    const row = await controller.readEntity(ref);
    if (!row) return null;
    return ["search-result", "recommendation", "favorite", "recent", "offline-package", "deep-link"].includes(row.reference.kind)
      && row.payload.references.length === 1 ? controller.readEntity(row.payload.references[0]) : row;
  }
  function navigationCurrent(original: typeof c, attempt: number) {
    return mounted.current&&!!original&&context.current===original&&sequence.current===attempt
      &&controller.getSnapshot().phase==="ready"&&controller.getSnapshot().context?.token===original.token;
  }
  async function leaveScene(original: typeof c, attempt: number) {
    sceneInspection.close();
    if(resources&&!await resources.cancelAndWait())return false;
    return navigationCurrent(original,attempt);
  }
  async function open(ref: ChildEntityReference, back = false, onCommit?: () => void) {
    const original = context.current, attempt = ++sequence.current;
    if(!await leaveScene(original,attempt)||!navigationCurrent(original,attempt))return;
    setJourneyNavigation(value=>value+1);setJourneyActive(false);journeyIntent.current=null;setDiscoveryView(null);pendingCountryOpen.current=null;
    setLoading(true); setCollection(null); setSaved(null); setSavedRows([]); setSearchResults(null);
    resources?.clear();try{await resources?.join();}catch{if(navigationCurrent(original,attempt))await controller.suspend();return;}
    if(!navigationCurrent(original,attempt))return;
    if(controller.scenes&&!await controller.scenes.releaseAll())return;
    if(!navigationCurrent(original,attempt))return;
    if (controller.media && !await controller.media.releaseAll()) { if (navigationCurrent(original,attempt)) { setCurrent(null); setLoading(false); } return; }
    if(!navigationCurrent(original,attempt))return;
    let row = await resolve(ref);
    if (!mounted.current || context.current !== original || sequence.current !== attempt) return;
    // Record only after this explicit navigation commits its visible article.
    // A superseded click, hydration, label read or restored cursor is no credit.
    pendingCountryOpen.current = row?.reference.kind === "country" && original?.profileId
      ? { contextToken: original.token, profileId: original.profileId, attempt, reference: row.reference } : null;
    if (!mounted.current || context.current !== original || sequence.current !== attempt) return;
    if (row) { if (!back && current) setHistory(previous => [...previous.slice(-31), current.reference]); setCurrent(row);
      if(row.reference.kind==="country"){const country=resolveChildGlobeCountry(row.reference,countries);if(country)setSelectedCountry(country);} onCommit?.(); }
    else setCurrent(null);
    await resources?.restore?.();
    if(mounted.current&&context.current===original&&sequence.current===attempt)setLoading(false);
  }
  useLayoutEffect(() => {
    const sameProfile=!c||previousProfile.current===c.profileId;
    const intent=c?.profileId&&navigationIntent.current?.profileId===c.profileId?navigationIntent.current:null;
    hydratedContext.current=null;pendingCountryOpen.current=null;
    if(c)previousProfile.current=c.profileId;
    setJourneyActive(false);if(!sameProfile)setDiscoveryView(null);
    if(!sameProfile){navigationIntent.current=null;journeyIntent.current=null;}
    setCurrent(null);setRoots([]);setQuery("");setSearchResults(null);setHistory([]);
    setCollection(null);setSaved(null);setSavedRows([]);setScenes([]);setSceneOwner(null);setLoading(true);
    // Keep only a stable canonical country ID/camera intent, never retired copy.
    setSelectedCountry(previous=>sameProfile&&previous?{id:previous.id,name:"",description:"",writers:[]}:null);
    if (!c?.home || snapshot.status !== "child") return;
    const original = c, attempt = ++sequence.current; let alive = true;
    void (async () => {
      // The host flushes this layout effect during the controller's ready
      // publication. Let its control transaction release busy before issuing
      // the first read, while stale presentation was already cleared above.
      await Promise.resolve();
      if(!alive||!mounted.current||context.current!==original||sequence.current!==attempt)return;
      const home = await controller.readEntity(original.home!);
      const rows: ChildNativeEntity[] = [];
      if (home) for (const ref of home.payload.references) {
        if (ref.kind !== "country") continue;
        const row = await controller.readEntity(ref); if (!row) return;
        rows.push(row);
      }
      if(!alive||!mounted.current||context.current!==original||sequence.current!==attempt)return;
      const valid=()=>alive&&mounted.current&&context.current===original&&sequence.current===attempt;
      const freshRows=new Map<string,ChildNativeEntity>();
      if(home)freshRows.set(logicalKey(home.reference),home);
      for(const row of rows)freshRows.set(logicalKey(row.reference),row);
      let restoredCollection:ChildNativeCollectionValue|null=null;
      const restoredRows:ChildNativeEntity[]=[];
      if(intent?.collection) {
        restoredCollection=await controller.readCollection(intent.collection);
        if(!valid())return;
        if(restoredCollection)for(const ref of restoredCollection.references) {
          const row=await controller.readEntity(ref);if(!valid())return;
          if(!row)break;restoredRows.push(row);freshRows.set(logicalKey(row.reference),row);
        }
      }
      // Walk only freshly admitted child references; never manufacture a
      // destination checksum from a retired reference or an adult index.
      const wanted=new Set([...(intent?.history??[]),...(intent?.current?[intent.current]:[])]);
      const queue=[...freshRows.values()].flatMap(row=>row.payload.references);
      const visited=new Set(freshRows.keys());
      for(let scanned=0;queue.length&&scanned<256&&[...wanted].some(key=>!freshRows.has(key));scanned++) {
        const ref=queue.shift()!,key=logicalKey(ref);if(visited.has(key))continue;visited.add(key);
        const row=await controller.readEntity(ref);if(!valid())return;
        if(!row)break;freshRows.set(key,row);queue.push(...row.payload.references);
      }
      await resources?.restore?.();
      if (valid()) {
        hydratedContext.current=original;
        setCurrent(intent?.current?freshRows.get(intent.current)??home:home);setRoots(Object.freeze(rows));
        setHistory((intent?.history??[]).flatMap(key=>{const row=freshRows.get(key);return row?[row.reference]:[];}));
        setCollection(intent?.collection??null);setSaved(restoredCollection);setSavedRows(Object.freeze(restoredRows));
        setSelectedCountry(previous=>resolveChildGlobeCountry(previous,rows.flatMap(row=>{const country=projectChildNativeGlobeCountry(row);return country?[country]:[];})));
        setLoading(false);
      }
    })();
    return () => { alive = false; ++sequence.current; };
  }, [controller, c, snapshot.status, resources]);
  async function search() {
    const original = context.current, attempt = ++sequence.current;
    if(!await leaveScene(original,attempt)||!navigationCurrent(original,attempt))return;
    setJourneyNavigation(value=>value+1);setJourneyActive(false);journeyIntent.current=null;setDiscoveryView(null);pendingCountryOpen.current=null;
    setCollection(null); setSaved(null); setSavedRows([]); setLoading(true);
    resources?.clear();try{await resources?.join();}catch{if(navigationCurrent(original,attempt))await controller.suspend();return;}
    if(!navigationCurrent(original,attempt))return;
    if(controller.scenes&&!await controller.scenes.releaseAll())return;
    if(!navigationCurrent(original,attempt))return;
    if (controller.media && !await controller.media.releaseAll()) { if (navigationCurrent(original,attempt)) setLoading(false); return; }
    if(!navigationCurrent(original,attempt))return;
    const result = await controller.search(query);
    if (!mounted.current || context.current !== original || sequence.current !== attempt) return;
    setSearchResults(result);await resources?.restore?.();
    if(mounted.current&&context.current===original&&sequence.current===attempt)setLoading(false);
  }
  async function showCollection(name: ChildNativeCollection) {
    const original = context.current, attempt = ++sequence.current;
    if(!await leaveScene(original,attempt)||!navigationCurrent(original,attempt))return;
    setJourneyNavigation(value=>value+1);setJourneyActive(false);journeyIntent.current=null;setDiscoveryView(null);pendingCountryOpen.current=null;
    setCollection(name); setSaved(null); setSavedRows([]); setSearchResults(null); setLoading(true);
    resources?.clear();try{await resources?.join();}catch{if(navigationCurrent(original,attempt))await controller.suspend();return;}
    if(!navigationCurrent(original,attempt))return;
    if(controller.scenes&&!await controller.scenes.releaseAll())return;
    if(!navigationCurrent(original,attempt))return;
    if (controller.media && !await controller.media.releaseAll()) { if (navigationCurrent(original,attempt)) setLoading(false); return; }
    if(!navigationCurrent(original,attempt))return;
    const value = await controller.readCollection(name), rows: ChildNativeEntity[] = [];
    if (value) for (const ref of value.references) {
      if(!navigationCurrent(original,attempt))return;
      const row = await controller.readEntity(ref); if (!row) break;
      rows.push(row);
    }
    if (!mounted.current || context.current !== original || sequence.current !== attempt) return;
    setSaved(value);setSavedRows(Object.freeze(rows));await resources?.restore?.();
    if(mounted.current&&context.current===original&&sequence.current===attempt)setLoading(false);
  }
  async function showDiscoveryPassport(view: ChildNativeDiscoveryPassportViewName) {
    if (view === "home") { if (context.current?.home) await open(context.current.home, true); return; }
    const original = context.current, attempt = ++sequence.current;
    if(!await leaveScene(original,attempt)||!navigationCurrent(original,attempt))return;
    setJourneyNavigation(value=>value+1);setJourneyActive(false);journeyIntent.current=null;
    pendingCountryOpen.current=null;setDiscoveryView(view);setCollection(null);setSaved(null);setSavedRows([]);setSearchResults(null);setLoading(true);
    resources?.clear();try { await resources?.join(); } catch { if(navigationCurrent(original,attempt))await controller.suspend(); return; }
    if(!navigationCurrent(original,attempt))return;
    if (controller.scenes && !await controller.scenes.releaseAll()) return;
    if(!navigationCurrent(original,attempt))return;
    if (controller.media && !await controller.media.releaseAll()) return;
    if(!navigationCurrent(original,attempt))return;
    await resources?.restore?.();
    if (mounted.current && context.current === original && sequence.current === attempt) setLoading(false);
  }
  async function remove(ref: ChildEntityReference) {
    if (!collection || !saved || collection === "recent") return;
    const original = context.current, attempt = ++sequence.current;
    const value = await controller.writeCollection(collection, saved.revision, saved.references.filter(row => !same(row, ref)));
    if (!mounted.current || context.current !== original || sequence.current !== attempt) return;
    if (value) { setSaved(value); setSavedRows(previous => previous.filter(row => !same(row.reference, ref))); }
  }
  async function save(ref: ChildEntityReference) {
    const name: ChildNativeCollection = ref.kind === "favorite" ? "favorites" : "offline", original = context.current;
    const value = await controller.readCollection(name); if (!value || context.current !== original) return;
    const next = value.references.some(row => same(row, ref)) ? value.references : [...value.references, ref];
    await controller.writeCollection(name, value.revision, next);
  }
  useEffect(() => {
    const intent = pendingCountryOpen.current;
    if (!intent || loading || collection || discoveryView || journeyActive || searchResults !== null || !current
      || intent.attempt !== sequence.current || c?.token !== intent.contextToken || c.profileId !== intent.profileId
      || !same(current.reference, intent.reference)) return;
    // React has committed this exact admitted country article. Consume the
    // intent once before the native durable receipt; no retry or optimistic
    // passport count follows a missing/uncertain acknowledgement.
    pendingCountryOpen.current = null;
    void controller.passport?.recordCountryOpen(current.reference);
  }, [controller, c, current, loading, collection, discoveryView, journeyActive, searchResults]);
  useEffect(()=>{let alive=true;setScenes([]);setSceneOwner(null);if(current&&controller.scenes)void controller.scenes.list(current.reference).then(values=>{if(alive){setScenes(values??[]);setSceneOwner(current);}});return()=>{alive=false;};},[controller,current]);
  const admitted=!!c&&snapshot.phase==="ready"&&snapshot.status==="child";
  const sceneUiVisible=admitted&&!journeyActive&&!discoveryView&&!loading&&!collection&&searchResults===null&&!!current;
  const previousPreviewRevision=useRef<number|null>(null);
  const previousInspectionMode=useRef(inspectionState.mode);
  useLayoutEffect(()=>{
    const prior=previousInspectionMode.current;previousInspectionMode.current=inspectionState.mode;
    if(prior!=="closed"&&inspectionState.mode==="closed"&&inspectionState.available&&sceneUiVisible){
      const focused=document.activeElement;
      if(focused===document.body||focused instanceof Element&&(focused.tagName==="CANVAS"||focused.hasAttribute("data-globe-style")||focused.closest(".child-native-scene-controls")))
        exploreTriggerRef.current?.focus({preventScroll:true});
    }
  },[inspectionState.mode,inspectionState.available,sceneUiVisible]);
  useLayoutEffect(()=>{
    const prior=previousPreviewRevision.current;previousPreviewRevision.current=sceneState.preview?.revision??null;
    if(prior!==null&&!sceneState.preview&&sceneUiVisible&&sceneTriggerRef.current?.isConnected){
      const focused=document.activeElement;
      if(focused===document.body||focused instanceof Element&&focused.closest(".child-native-scene-controls"))sceneTriggerRef.current.focus({preventScroll:true});
    }
  },[sceneState.preview,sceneUiVisible]);
  useLayoutEffect(()=>{
    const ready=sceneState.preview?sceneState.preview.phase==="ready":sceneState.phase==="ready";
    sceneInspection.setContext({enabled:admitted,access:admitted?"child":"blocked",visible:sceneUiVisible,
      editorOpen:!!sceneState.preview,previewReady:ready,appliedBackgroundId:sceneState.scene?.sceneToken??"",displayedBackgroundId:shownScene?.sceneToken??""});
    if(!resources||!shownScene||!ready)return;
    const shownToken=shownScene.sceneToken;
    return sceneInspection.registerTarget(shownScene,{kind:"native",backgroundId:shownToken,canActivate:()=>{
      const now=resources.getSnapshot(),shown=now.preview?.phase==="ready"?now.preview.scene:!now.preview&&now.phase==="ready"?now.scene:null;
      return !!shown&&shown.sceneToken===shownToken&&resources.isCurrent()&&shown.hotspots.length>0
        &&(!shown.modelPackage?.engineComposition||shown.modelPackage.engineComposition.items.every(item=>item.explore));
    }});
  },[sceneInspection,resources,admitted,sceneUiVisible,sceneState,shownScene]);
  useLayoutEffect(()=>{
    if(!sceneUiVisible){sceneInspection.close();const preview=resources?.getSnapshot().preview;if(preview)void resources?.cancelPreview(preview.revision);}
  },[sceneUiVisible,resources,sceneInspection]);
  useLayoutEffect(()=>()=>{sceneInspection.setContext({enabled:false,access:"blocked",visible:false,editorOpen:false,
    appliedBackgroundId:"",displayedBackgroundId:""});},[sceneInspection]);
  const startPreview=(sceneId:string,trigger:HTMLButtonElement)=>{
    if(!resources||!current||!sceneUiVisible||sceneOwner!==current||!scenes.some(scene=>scene.sceneId===sceneId))return;
    const original=context.current,attempt=++sequence.current;sceneTriggerRef.current=trigger;sceneInspection.close();setSceneError(false);
    void resources.preview(current.reference,sceneId).then(ready=>{if(mounted.current&&context.current===original&&sequence.current===attempt&&!ready)setSceneError(true);});
  };
  const finishPreview=(apply:boolean,expectedRevision:number|undefined)=>{
    const preview=resources?.getSnapshot().preview;
    if(!resources||!preview||expectedRevision!==preview.revision||apply&&preview.phase!=="ready")return;
    const original=context.current,attempt=++sequence.current;sceneInspection.close();setSceneError(false);
    void (apply?resources.applyPreview(preview.revision):resources.cancelPreview(preview.revision)).then(done=>{
      if(!mounted.current||context.current!==original||sequence.current!==attempt)return;
      if(!done)setSceneError(true);else if(sceneTriggerRef.current?.isConnected)sceneTriggerRef.current.focus({preventScroll:true});
    });
  };
  const openHotspot=(target:ChildEntityReference)=>{
    const shown=resources?.getSnapshot(),scene=shown?.preview?.phase==="ready"?shown.preview.scene:!shown?.preview&&shown?.phase==="ready"?shown.scene:null;
    if(sceneInspection.getSnapshot().mode==="closed"||!sceneInspection.getSnapshot().available||!resources?.isCurrent()
      ||!scene?.hotspots.some(hotspot=>same(hotspot.target,target)))return;
    void open(target);
  };
  const retained=!!retainedProfileId&&!c&&(snapshot.phase==="sealed"||snapshot.phase==="transition");
  if(!admitted&&!retained)return <ChildNativeClosedView snapshot={snapshot} controller={controller}/>;
  return <main className="child-native-app" data-child-native-phase={admitted?"ready":"sealed"} data-child-native-profile={admitted?c!.profileId:undefined}>
    <div className="child-native-canonical-shell" data-native-child-retained={admitted?"active":"sealed"} aria-hidden={!admitted}
      ref={element=>{if(element)element.inert=!admitted;}}>
    <LiteraryWorldMap countries={countries.length ? countries : emptyCountries} atlasCountries={childCanonicalGlobeAtlasCountries} selectedCountry={selectedCountry}
      onCountrySelect={hint => {
        if(!admitted)return;
        const country = resolveChildGlobeCountry(hint,countries);
        const ref = country && roots.find(row => row.reference.kind === "country" && row.reference.id === country.id)?.reference;
        if (country && ref) { void open(ref); }
      }} childPresentation childResources={resources??undefined} onChildHotspot={openHotspot} sceneInspection={sceneInspectionBridge}
      mode="immersive" forceLoad bookyCalmMotion runtimeActive={admitted} preserveSceneDuringReload />
    </div>
    {c&&admitted?<>
    <header className="child-native-header"><h1>{copy.title}</h1><ChildNativeLocaleControl controller={controller} snapshot={snapshot} /><NativeProfileControls controller={controller} snapshot={snapshot} /></header>
    <aside className="child-native-booky" data-booky-size={sizeSnapshot.size}>
      <BookyPlayControl key={c.token} src={mascotImage} context="child" className="child-native-booky__play" calmMotion active={admitted} />
      <span>{language === "ru" ? "Книжулик" : "Mr. Booky"}</span>
    </aside>
    <section className="child-native-panel" aria-label={copy.title}>
      <ChildPrivacyNotice language={language} />
      {sceneState.phase==="unavailable"&&<p role="alert" className="child-native-appearance-error">
        {sceneState.persistence==="save-failed"?(language==="ru"?"Не удалось подтвердить сохранение оформления.":"The appearance save could not be confirmed."):(language==="ru"?"Сохранённое оформление сейчас недоступно.":"The saved appearance is currently unavailable.")}
        <button type="button" onClick={()=>{void resources?.restore?.();}}>{language==="ru"?"Повторить восстановление":"Retry restoration"}</button>
      </p>}
      {sceneUiVisible&&(sceneOwner===current&&!!scenes.length||!!shownScene?.hotspots.length||!!sceneState.preview)&&<section className="child-native-scene-controls" aria-busy={sceneState.preview?.phase==="preparing"||sceneState.preview?.phase==="applying"} data-child-scene-phase={sceneState.preview?.phase??sceneState.phase} aria-label={language==="ru"?"Оформление планеты":"Planet appearance"}
        onKeyDown={event=>{if(event.key!=="Escape")return;event.preventDefault();event.stopPropagation();
          if(sceneInspection.getSnapshot().mode!=="closed"){sceneInspection.close();exploreTriggerRef.current?.focus({preventScroll:true});}else finishPreview(false,sceneState.preview?.revision);}}>
        <h2>{language==="ru"?"Оформление планеты":"Planet appearance"}</h2>
        {sceneOwner===current&&scenes.map(scene=><button key={scene.sceneId} type="button" disabled={sceneState.preview?.phase==="applying"}
          onClick={event=>startPreview(scene.sceneId,event.currentTarget)}>{scene.title}</button>)}
        {sceneState.preview&&<>
          <p role="status" aria-live="polite">{sceneState.preview.phase==="preparing"?(language==="ru"?"Готовим временный предпросмотр…":"Preparing temporary preview…")
            :sceneState.preview.phase==="applying"?(language==="ru"?"Подтверждаем сохранение…":"Confirming saved appearance…")
              :(language==="ru"?"Временный предпросмотр. Выбор ещё не сохранён.":"Temporary preview. Your choice has not been saved.")}</p>
          <button type="button" disabled={sceneState.preview.phase!=="ready"} onClick={()=>finishPreview(true,sceneState.preview?.revision)}>{language==="ru"?"Применить":"Apply"}</button>
          <button type="button" onClick={()=>finishPreview(false,sceneState.preview?.revision)}>{language==="ru"?"Отмена":"Cancel"}</button>
        </>}
        {sceneError&&<p role="alert">{language==="ru"?"Предпросмотр не применён. Проверьте доступное оформление и попробуйте снова.":"The preview was not applied. Check the available appearance and try again."}</p>}
        {(inspectionState.available||inspectionState.mode!=="closed")&&<button ref={exploreTriggerRef} type="button" aria-expanded={inspectionState.mode!=="closed"}
          aria-controls="child-native-scene-content" onClick={()=>{if(inspectionState.mode!=="closed")sceneInspection.close();else sceneInspection.open();}}>
          {inspectionState.mode!=="closed"?(language==="ru"?"Завершить осмотр":"Finish exploring"):(language==="ru"?"Осмотреть сцену":"Explore scene")}</button>}
        {inspectionState.mode!=="closed"&&inspectionState.available&&!!shownScene?.hotspots.length&&<ul id="child-native-scene-content" aria-label={language==="ru"?"Материалы оформления":"Scene content"}>
          {shownScene.hotspots.map(hotspot=><li key={shownScene.sceneToken+hotspot.id}><ChildNativeReferenceButton controller={controller} reference={hotspot.target} onOpen={()=>openHotspot(hotspot.target)}/></li>)}
        </ul>}
      </section>}
      <nav aria-label={copy.title}>
        <button type="button" onClick={() => { if (c.home) { void open(c.home, true,()=>{setHistory([]);setSelectedCountry(null);}); } }}>{copy.home}</button>
        <button type="button" disabled={!history.length} onClick={() => {
          const ref = history[history.length - 1]; if (ref) void open(ref, true,()=>setHistory(previous=>previous.slice(0,-1)));
        }}>{copy.back}</button>
        {(["favorites", "recent", "offline"] as const).map(name => <button type="button" key={name} aria-pressed={collection === name}
          onClick={() => { void showCollection(name); }}>{copy[name]}</button>)}
      </nav>
      <form className="child-native-search" onSubmit={event => { event.preventDefault(); void search(); }}>
        <label>{copy.search}<input value={query} maxLength={240} type="search" autoComplete="off" onChange={event => setQuery(event.currentTarget.value)} /></label>
        <button type="submit">{copy.search}</button>
      </form>
      <ChildNativeDiscoveryPassportView controller={controller} contextToken={c.token} profileId={c.profileId!} language={language}
        view={discoveryView ?? "home"} visible={!journeyActive&&!loading&&!collection&&searchResults===null
          && (!!discoveryView || !!current&&!!c.home&&same(current.reference,c.home))}
        onRequestView={view => { void showDiscoveryPassport(view); }} onOpen={ref => { void open(ref); }}
        onStartJourney={journeyId => {
          if (context.current !== c || !childNativeJourneyId(journeyId)) return;
          const attempt=++sequence.current;void leaveScene(c,attempt).then(joined=>{if(!joined||!navigationCurrent(c,attempt))return;
            setDiscoveryView(null);journeyIntent.current={profileId:c.profileId!,journeyId};setJourneyNavigation(value=>value+1);});
        }} />
      <ChildNativeJourneyView key={c.profileId!} controller={controller} contextToken={c.token} profileId={c.profileId!}
        language={language} navigationEpoch={journeyNavigation}
        homeVisible={!discoveryView&&!loading&&!collection&&searchResults===null&&!!current&&!!c.home&&same(current.reference,c.home)}
        initialJourneyId={journeyIntent.current?.profileId===c.profileId?journeyIntent.current.journeyId:null}
        beforeNavigate={()=>leaveScene(context.current,sequence.current)}
        onActiveChange={onJourneyActive} onIntentChange={onJourneyIntent} onNode={onJourneyNode}/>
      {!journeyActive&&(loading ? <p role="status">{copy.loading}</p> : collection ? <>
        <h2>{copy[collection]}</h2>
        {!savedRows.length && <p>{saved ? copy.empty : copy.bodyUnavailable}</p>}
        <ul>{savedRows.map(row => <li key={row.reference.kind + "/" + row.reference.id}>
          <button type="button" onClick={() => { void open(row.reference); }}>{row.payload.title}</button>
          {collection !== "recent" && <button type="button" onClick={() => { void remove(row.reference); }}>{copy.remove}</button>}
        </li>)}</ul>
      </> : searchResults ? <>
        <h2>{copy.search}</h2>{!searchResults.length && <p>{copy.noResults}</p>}
        <ul>{searchResults.map(row => <li key={row.reference.id}><button type="button" onClick={() => { void open(row.reference); }}>{row.payload.title}</button></li>)}</ul>
      </> : discoveryView ? null : current ? <article data-child-native-entity={current.reference.kind + "/" + current.reference.id}>
        <h2>{current.payload.title}</h2>
        <ChildNativeMediaView key={c.token + "/" + current.reference.kind + "/" + current.reference.id}
          controller={controller} owner={current.reference} contextToken={c.token} language={language} /><ChildNativeReadingView key={c.token + "/" + current.reference.kind + "/" + current.reference.id}
            controller={controller} reference={current.reference} payload={current.payload} contextToken={c.token} language={language} />
        <ul>{current.payload.references.map(ref => <li key={ref.kind + "/" + ref.id}>
          {ref.kind === "favorite" || ref.kind === "offline-package" ? <button type="button" onClick={() => { void save(ref); }}>{copy.add}</button>
            : <ChildNativeReferenceButton controller={controller} reference={ref} onOpen={() => { void open(ref); }} />}
        </li>)}</ul>
      </article> : <p role="status">{copy.bodyUnavailable}</p>)}
    </section>
    </>:<ChildNativeClosedView snapshot={snapshot} controller={controller}/>}
  </main>;
}
function ChildNativeReferenceButton({ controller, reference, onOpen }: {
  controller: ChildNativeAppController; reference: ChildEntityReference; onOpen(): void;
}) {
  const [title, setTitle] = useState<string | null>(null);
  useEffect(() => {
    let live = true; setTitle(null);
    void controller.readEntity(reference).then(row => { if (live) setTitle(row?.payload.title ?? null); });
    return () => { live = false; };
  }, [controller, reference]);
  return title ? <button type="button" onClick={onOpen}>{title}</button> : null;
}
