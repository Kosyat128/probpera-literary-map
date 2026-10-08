/** Local child help only. Human readability approval is separate.
 * The only action opens the existing parent-control entry; this component
 * receives no child data, services, native authority or support transport. */
const copy = {
  ru: {
    title: "Нужна помощь?",
    guidance: "Если что-то не получается или тебя беспокоит, позови взрослого. Он поможет разобраться.",
    local: "Здесь ничего не нужно вводить или отправлять. Кнопка ниже откроет настройки для взрослого на этом устройстве.",
  },
  en: {
    title: "Need help?",
    guidance: "If something is not working or makes you uncomfortable, ask an adult to help.",
    local: "You do not need to type or send anything here. The button below opens the parent settings on this device.",
  },
} as const;

function closeHelp(details: HTMLDetailsElement) {
  details.open = false;
  details.querySelector<HTMLElement>("summary")?.focus({ preventScroll: true });
}

export function ChildHelp({ language, askAdultLabel, closeLabel, onAskAdult, disabled = false }: {
  language: "ru" | "en"; askAdultLabel: string; closeLabel: string; onAskAdult(): void; disabled?: boolean;
}) {
  const text = copy[language];
  return <details className="child-native-privacy child-native-help" lang={language} data-child-native-help="local-v1"
    onKeyDown={event => {
      if (event.key !== "Escape" || !event.currentTarget.open) return;
      event.preventDefault(); event.stopPropagation(); closeHelp(event.currentTarget);
    }}>
    <summary>{text.title}</summary>
    <div className="child-native-privacy-copy">
      <p>{text.guidance}</p><p>{text.local}</p>
      <div className="child-native-help-actions">
        <button type="button" disabled={disabled} onClick={() => { if (!disabled) onAskAdult(); }}>{askAdultLabel}</button>
        <button type="button" onClick={event => {
          const details = event.currentTarget.closest("details"); if (details) closeHelp(details);
        }}>{closeLabel}</button>
      </div>
    </div>
  </details>;
}
