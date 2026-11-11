// These nine managed keys feed the three count substitutions in src/App.tsx.
// Other interface strings keep their existing plain-text contract.
const countKeys = new Set([
  "interface.{count} документальный портрет подключён без генерации лиц",
  "interface.{count} документальных портрета подключены без генерации лиц",
  "interface.{count} документальных портретов подключены без генерации лиц",
  "interface.{count} карточка уже прошла публикационную проверку по открытым авторитетным источникам",
  "interface.{count} карточки уже прошли публикационную проверку по открытым авторитетным источникам",
  "interface.{count} карточек уже прошли публикационную проверку по открытым авторитетным источникам",
  "interface.Ещё {count} запись остаётся в редакционной очереди; автоматически собранные черновики не публикуются до ручной проверки",
  "interface.Ещё {count} записи остаются в редакционной очереди; автоматически собранные черновики не публикуются до ручной проверки",
  "interface.Ещё {count} записей остаются в редакционной очереди; автоматически собранные черновики не публикуются до ручной проверки",
]);

export class SiteCopyTranslationParameterError extends Error {
  readonly operatorMessage = "В исходнике и переводе должна остаться одна переменная {count}. Проверьте текст перед одобрением.";

  constructor() {
    super("Premium site-copy translation changed protected parameters");
    this.name = "SiteCopyTranslationParameterError";
  }
}

function hasSingleCount(value: string): boolean {
  const names = [...value.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)\}/gu)].map(match => match[1]);
  return names.length === 1 && names[0] === "count";
}

export function validateSiteCopyTranslationParameters(
  source: { key: string; text: string },
  translatedText: string
): void {
  if (countKeys.has(source.key) && (!hasSingleCount(source.text) || !hasSingleCount(translatedText))) {
    throw new SiteCopyTranslationParameterError();
  }
}
