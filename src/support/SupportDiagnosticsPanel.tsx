import { useId, useLayoutEffect, useState, useSyncExternalStore } from "react";
import { useInterfaceLanguage } from "../i18n/InterfaceLanguage";
import type { SupportDiagnosticSession } from "./supportDiagnosticSession";
import "./supportDiagnosticsPanel.css";

const copy = {
  ru: {
    heading: "Диагностика для поддержки",
    intro: "Подготовьте локальный технический отчёт, проверьте его содержимое и сохраните файл.",
    privacy: "Отчёт содержит доступные технические сведения и идентификаторы открытых материалов. Недоступные сведения отмечены как unknown. PIN, токены, чеки, детские запросы и данные профиля в него не включаются.",
    local: "Скачайте файл на своё устройство. Отправка в поддержку остаётся вашим действием.",
    consent: "Я взрослый и разрешаю подготовить этот диагностический отчёт для просмотра и сохранения.",
    preview: "Просмотреть отчёт", download: "Скачать JSON", cancel: "Отменить и очистить",
    previewLabel: "Содержимое диагностического отчёта",
    unavailable: "Просмотр сейчас недоступен. Подтвердите согласие снова в настройках для взрослого.",
    invalid: "Доступные сведения не удалось собрать в отчёт. Попробуйте подготовить его снова.",
    downloadFailed: "Не удалось начать сохранение файла. Попробуйте снова.",
  },
  en: {
    heading: "Support diagnostics",
    intro: "Prepare a local technical report, review its contents and save the file.",
    privacy: "The report includes available technical details and IDs of open items. Unavailable information is marked as unknown. It excludes PINs, tokens, receipts, child queries and profile data.",
    local: "Download the file to your device. Sending it to support remains your choice.",
    consent: "I am an adult and consent to preparing this diagnostic report for review and saving.",
    preview: "Preview report", download: "Download JSON", cancel: "Cancel and clear",
    previewLabel: "Diagnostic report contents",
    unavailable: "Preview is currently unavailable. Confirm consent again in the adult settings.",
    invalid: "The available details could not be assembled into a report. Try preparing it again.",
    downloadFailed: "The file download could not be started. Try again.",
  },
} as const;

/** Only exact controller-approved preview bytes reach a temporary local download. */
export function downloadDiagnosticPreview(session: SupportDiagnosticSession): boolean {
  let url: string | null = null;
  let anchor: HTMLAnchorElement | null = null;
  try {
    const bytes = session.exportPreview();
    if (bytes === null) return false;
    const blob = new Blob([bytes], { type: "application/json" });
    url = URL.createObjectURL(blob);
    anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "literary-planet-diagnostics.json";
    document.body.append(anchor);
    anchor.click();
    return true;
  } catch {
    return false;
  } finally {
    try { anchor?.remove(); }
    finally { if (url !== null) URL.revokeObjectURL(url); }
  }
}

/** Mounted only in the admitted adult settings/help slot owned by the app boundary. */
export default function SupportDiagnosticsPanel({ session, active }: {
  session: SupportDiagnosticSession; active: boolean;
}) {
  const { language } = useInterfaceLanguage();
  const text = copy[language];
  const id = useId();
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const [open, setOpen] = useState(false);
  const [downloadFailed, setDownloadFailed] = useState(false);
  useLayoutEffect(() => {
    session.clear();
    setOpen(false);
    setDownloadFailed(false);
    return () => { session.clear(); };
  }, [session, active, language]);
  const clear = () => {
    session.clear();
    setOpen(false);
    setDownloadFailed(false);
  };
  if (!active) return null;
  return <details className="support-diagnostics" data-support-diagnostics open={open}
    onToggle={event => { if (!event.currentTarget.open) clear(); }}>
    <summary onClick={event => {
      event.preventDefault();
      if (open) clear(); else setOpen(true);
    }}>{text.heading}</summary>
    <p id={`${id}-intro`}>{text.intro}</p>
    <p id={`${id}-privacy`}>{text.privacy}</p>
    <p>{text.local}</p>
    <label className="support-diagnostics__consent">
      <input type="checkbox" checked={snapshot.consented}
        aria-describedby={`${id}-privacy`}
        onChange={event => {
          if (!active || !open) return;
          setDownloadFailed(false);
          session.setConsent(event.currentTarget.checked);
        }} />
      <span>{text.consent}</span>
    </label>
    <div className="support-diagnostics__actions">
      <button type="button" disabled={!open || !snapshot.consented}
        onClick={() => { if (active && open) { setDownloadFailed(false); session.preview(); } }}>
        {text.preview}
      </button>
      <button type="button" disabled={!open || !snapshot.consented || snapshot.preview === null}
        onClick={() => { if (active && open) setDownloadFailed(!downloadDiagnosticPreview(session)); }}>
        {text.download}
      </button>
      <button type="button" onClick={clear}>{text.cancel}</button>
    </div>
    {snapshot.failure !== null ? <p role="status">
      {snapshot.failure === "unavailable" ? text.unavailable : text.invalid}
    </p> : null}
    {downloadFailed ? <p role="status">{text.downloadFailed}</p> : null}
    {snapshot.consented && snapshot.preview !== null ? <div className="support-diagnostics__preview">
      <label htmlFor={`${id}-preview`}>{text.previewLabel}</label>
      <textarea id={`${id}-preview`} readOnly spellCheck={false} rows={12}
        value={snapshot.preview} aria-describedby={`${id}-privacy`} />
    </div> : null}
  </details>;
}
