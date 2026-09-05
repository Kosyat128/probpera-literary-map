"use client";

import Link from "next/link";

import ConfirmSubmitButton from "@/components/ConfirmSubmitButton";
import { editorialPreviewFonts } from "@/components/EditorialPreviewFonts";
import previewStyles from "@/components/EditorialPreview.module.css";
import {
  typographyBreakpoints,
  typographyFontStyles,
  typographyLayers,
  typographySemanticScopes,
  typographySystemFamilies,
  typographyTextAlignments,
  typographyTextDecorations,
  typographyTextTransforms,
  type SiteTypographyOverride,
  type SiteTypographyProperties,
  type SiteTypographyTarget,
} from "@/lib/site-typography";
import {
  typographyBreakpointLabels,
  typographyErrorMessage,
  typographyLayerLabels,
  typographyPropertyFormValues,
  typographyScopeLabels,
  typographySystemFamilyLabels,
} from "@/lib/site-typography-ui";

import FontUploadForm from "./FontUploadForm";
import {
  archiveFontAssetAction,
  publishTypographyOverrideAction,
  resetTypographyOverrideAction,
  restoreTypographyRevisionAction,
  saveTypographyOverrideAction,
} from "./actions";
import styles from "./page.module.css";

export type FontAssetView = {
  id: string;
  display_name: string | null;
  family_name: string;
  source_type: "system" | "bundled" | "uploaded";
  format: "woff" | "woff2" | null;
  font_style: "normal" | "italic" | "oblique";
  weight_min: number;
  weight_max: number;
  byte_size: number | null;
  is_variable: boolean;
  license_name: string | null;
  license_url: string | null;
  created_at: string;
  cas_version: number;
};

export type TypographyOverrideView = SiteTypographyOverride & {
  id: string;
  casVersion: number;
  draftSettings: SiteTypographyProperties;
  publishedSettings: SiteTypographyProperties;
  updatedAt: string;
};

export type TypographyRevisionView = {
  id: number;
  overrideId: string;
  revisionNumber: number;
  action: string;
  createdLabel: string;
};

export type TypographyPageMessages = {
  error?: string;
  saved?: string;
  published?: string;
  restored?: string;
  reset?: string;
  archived?: string;
};

export type TypographyWorkspaceProps = {
  fonts: FontAssetView[];
  overrides: TypographyOverrideView[];
  revisions: TypographyRevisionView[];
  selectedId: string | null;
  messages: TypographyPageMessages;
  schemaUnavailable: boolean;
  canManage: boolean;
};

const typographyValueLabels: Record<string, string> = {
  normal: "Обычное",
  italic: "Курсив",
  oblique: "Наклонное",
  left: "По левому краю",
  center: "По центру",
  right: "По правому краю",
  justify: "По ширине",
  none: "Без изменений",
  uppercase: "Верхний регистр",
  lowercase: "Нижний регистр",
  capitalize: "С прописной буквы",
  underline: "Подчёркивание",
  "line-through": "Зачёркивание",
};

const revisionActionLabels: Record<string, string> = {
  publish: "Публикация",
  restore: "Восстановление",
};

function formatBytes(bytes: number | null) {
  if (bytes === null || !Number.isFinite(bytes) || bytes <= 0) {
    return "Нет данных";
  }
  if (bytes < 1024) return `${bytes} Б`;
  return `${(bytes / 1024).toLocaleString("ru-RU", {
    maximumFractionDigits: 1,
  })} КБ`;
}

function typographyStatus(row: TypographyOverrideView) {
  return JSON.stringify(row.draftSettings) === JSON.stringify(row.publishedSettings)
    ? "Опубликовано"
    : "Есть черновик";
}

function safeLicenseUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function familyKind(settings: SiteTypographyProperties) {
  if (settings.familyId) return "asset";
  if (settings.systemFamily) return "system";
  return "inherit";
}

function TargetHiddenFields({ target }: { target: SiteTypographyTarget }) {
  return (
    <>
      <input name="layer" type="hidden" value={target.layer} />
      <input name="target_key" type="hidden" value={target.targetKey} />
      <input name="semantic_scope" type="hidden" value={target.semanticScope} />
      <input name="breakpoint" type="hidden" value={target.breakpoint} />
    </>
  );
}

function TypographyEditor({
  fonts,
  selected,
  canManage,
}: {
  fonts: FontAssetView[];
  selected: TypographyOverrideView | null;
  canManage: boolean;
}) {
  const target: SiteTypographyTarget = selected || {
    layer: "site",
    targetKey: "site",
    semanticScope: "body",
    breakpoint: "base",
  };
  const settings = selected?.draftSettings || {};
  const values = typographyPropertyFormValues(settings);

  return (
    <section className={styles.panel} aria-labelledby="typography-editor-title">
      <div className={styles.panelHeader}>
        <div>
          <h2 id="typography-editor-title">
            {selected ? "Настройка типографики" : "Новая настройка"}
          </h2>
          <p>
            Пустое поле наследует значение предыдущего уровня. Произвольный CSS
            здесь не сохраняется.
          </p>
        </div>
        {selected && <span className={styles.count}>Версия {selected.casVersion}</span>}
      </div>
      <form action={saveTypographyOverrideAction}>
        {selected && (
          <>
            <input name="override_id" type="hidden" value={selected.id} />
            <input name="expected_version" type="hidden" value={selected.casVersion} />
          </>
        )}
        <fieldset disabled={!canManage}>
          <legend className="sr-only">Область применения</legend>
          {selected ? (
            <>
              <TargetHiddenFields target={target} />
              <div className={styles.targetGrid}>
                <div className="field">
                  <span>Уровень</span>
                  <strong>{typographyLayerLabels[target.layer]}</strong>
                </div>
                <div className="field">
                  <span>Ключ области</span>
                  <strong>{target.targetKey}</strong>
                </div>
                <div className="field">
                  <span>Тип текста</span>
                  <strong>{typographyScopeLabels[target.semanticScope]}</strong>
                </div>
                <div className="field">
                  <span>Экран</span>
                  <strong>{typographyBreakpointLabels[target.breakpoint]}</strong>
                </div>
              </div>
              <p className={styles.statusMessage}>
                Область существующего правила зафиксирована. Ниже можно менять
                только параметры оформления.
              </p>
            </>
          ) : (
            <div className={styles.targetGrid}>
              <label className="field">
                <span>Уровень</span>
                <select name="layer" defaultValue={target.layer}>
                  {typographyLayers.map((layer) => (
                    <option key={layer} value={layer}>{typographyLayerLabels[layer]}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Ключ области</span>
                <input
                  name="target_key"
                  defaultValue={target.targetKey}
                  pattern="[a-z0-9][a-z0-9_-]{0,79}"
                  maxLength={80}
                  required
                  aria-describedby="target-key-help"
                />
                <small id="target-key-help">
                  Сайт: site; шаблоны: home, article, page; компоненты: magazine,
                  journal, article-reader, cms-page-reader. Страница: безопасный ключ
                  пути, например stranitsy_sl_about. Экземпляр: article-ID или page-slug.
                </small>
              </label>
              <label className="field">
                <span>Тип текста</span>
                <select name="semantic_scope" defaultValue={target.semanticScope}>
                  {typographySemanticScopes.map((scope) => (
                    <option key={scope} value={scope}>{typographyScopeLabels[scope]}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Экран</span>
                <select name="breakpoint" defaultValue={target.breakpoint}>
                  {typographyBreakpoints.map((breakpoint) => (
                    <option key={breakpoint} value={breakpoint}>
                      {typographyBreakpointLabels[breakpoint]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          <div className={styles.propertyGrid}>
            <label className="field">
              <span>Источник шрифта</span>
              <select name="family_kind" defaultValue={familyKind(settings)}>
                <option value="inherit">Наследовать</option>
                <option value="system">Системный</option>
                <option value="asset">Из менеджера шрифтов</option>
              </select>
            </label>
            <label className="field">
              <span>Системный шрифт</span>
              <select name="systemFamily" defaultValue={values.systemFamily}>
                <option value="">Не выбран</option>
                {typographySystemFamilies.map((family) => (
                  <option key={family} value={family}>{typographySystemFamilyLabels[family]}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Загруженный шрифт</span>
              <select name="familyId" defaultValue={values.familyId}>
                <option value="">Не выбран</option>
                {fonts.filter((font) => font.source_type !== "system").map((font) => (
                  <option key={font.id} value={font.id}>
                    {font.display_name || font.family_name} · {font.weight_min}
                    {font.weight_max !== font.weight_min ? `-${font.weight_max}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Размер, px</span>
              <input name="fontSize" type="number" min={8} max={144} step="0.1" defaultValue={values.fontSize} />
            </label>
            <label className="field">
              <span>Насыщенность</span>
              <input name="fontWeight" type="number" min={1} max={1000} step={1} defaultValue={values.fontWeight} />
            </label>
            <label className="field">
              <span>Начертание</span>
              <select name="fontStyle" defaultValue={values.fontStyle}>
                <option value="">Наследовать</option>
                {typographyFontStyles.map((value) => <option key={value} value={value}>{typographyValueLabels[value]}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Межстрочный интервал</span>
              <input name="lineHeight" type="number" min={0.8} max={3} step="0.01" defaultValue={values.lineHeight} />
            </label>
            <label className="field">
              <span>Межбуквенный интервал, em</span>
              <input name="letterSpacing" type="number" min={-0.2} max={1} step="0.001" defaultValue={values.letterSpacing} />
            </label>
            <label className="field">
              <span>Выравнивание</span>
              <select name="textAlign" defaultValue={values.textAlign}>
                <option value="">Наследовать</option>
                {typographyTextAlignments.map((value) => <option key={value} value={value}>{typographyValueLabels[value]}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Регистр</span>
              <select name="textTransform" defaultValue={values.textTransform}>
                <option value="">Наследовать</option>
                {typographyTextTransforms.map((value) => <option key={value} value={value}>{typographyValueLabels[value]}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Оформление</span>
              <select name="textDecoration" defaultValue={values.textDecoration}>
                <option value="">Наследовать</option>
                {typographyTextDecorations.map((value) => <option key={value} value={value}>{typographyValueLabels[value]}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Абзацный отступ, em</span>
              <input name="textIndent" type="number" min={0} max={12} step="0.01" defaultValue={values.textIndent} />
            </label>
            <label className="field">
              <span>Интервал слов, em</span>
              <input name="wordSpacing" type="number" min={-0.2} max={2} step="0.01" defaultValue={values.wordSpacing} />
            </label>
          </div>
        </fieldset>
        <div className={styles.formActions}>
          <button className="button" type="submit" disabled={!canManage}>
            Сохранить черновик
          </button>
          {!canManage && <p className={styles.statusMessage}>Изменять оформление могут владелец и администратор.</p>}
        </div>
      </form>

      {selected && canManage && (
        <div className={styles.formActions}>
          <form action={publishTypographyOverrideAction}>
            <input name="override_id" type="hidden" value={selected.id} />
            <input name="expected_version" type="hidden" value={selected.casVersion} />
            <ConfirmSubmitButton message="Опубликовать этот черновик на сайте?">
              Опубликовать
            </ConfirmSubmitButton>
          </form>
          <form action={resetTypographyOverrideAction}>
            <input name="override_id" type="hidden" value={selected.id} />
            <input name="expected_version" type="hidden" value={selected.casVersion} />
            <TargetHiddenFields target={selected} />
            <ConfirmSubmitButton
              className={`button-secondary ${styles.dangerButton}`}
              message="Сбросить настройку и вернуть наследуемое оформление?"
            >
              Сбросить и опубликовать
            </ConfirmSubmitButton>
          </form>
          <Link className="button-secondary" href="/site-studio/fonts">Новая настройка</Link>
        </div>
      )}
    </section>
  );
}

export default function TypographyWorkspace({
  fonts,
  overrides,
  revisions,
  selectedId,
  messages,
  schemaUnavailable,
  canManage,
}: TypographyWorkspaceProps) {
  const overrideById = new Map(overrides.map((override) => [override.id, override]));
  const selected = selectedId ? overrideById.get(selectedId) || null : null;

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div>
          <span className="eyebrow">Site Studio · Шрифты</span>
          <h1>Шрифты и типографика</h1>
          <p>
            Управляйте локальными WOFF2/WOFF и настраивайте текст по смысловым
            областям. Наследование идёт от сайта к отдельному элементу, а затем
            от базового правила к выбранному экрану.
          </p>
        </div>
        <div className={styles.guardrail}>
          Только проверенные свойства. Произвольные CSS, font-family, URL и
          @import не принимаются.
        </div>
      </header>

      {messages.error && (
        <p className={styles.message} role="alert">
          {typographyErrorMessage(messages.error)}
        </p>
      )}
      {messages.saved && <p className={`${styles.message} ${styles.success}`} role="status">Черновик сохранён.</p>}
      {messages.published && <p className={`${styles.message} ${styles.success}`} role="status">Настройка опубликована.</p>}
      {messages.restored && <p className={`${styles.message} ${styles.success}`} role="status">Версия восстановлена и опубликована.</p>}
      {messages.reset && <p className={`${styles.message} ${styles.success}`} role="status">Настройка сброшена, снова действует наследование.</p>}
      {messages.archived && <p className={`${styles.message} ${styles.success}`} role="status">Шрифт перемещён в архив.</p>}
      {schemaUnavailable && (
        <p className={styles.message} role="alert">
          Контур типографики ещё не применён в базе или временно недоступен.
        </p>
      )}

      <div className={styles.workspace}>
        <div className={styles.stack}>
          <TypographyEditor
            key={selected ? `${selected.id}:${selected.casVersion}` : "new"}
            fonts={fonts}
            selected={selected}
            canManage={canManage}
          />

          <section className={styles.panel} aria-labelledby="font-upload-title">
            <div className={styles.panelHeader}>
              <div>
                <h2 id="font-upload-title">Добавить локальный шрифт</h2>
                <p>Без внешних CDN: файл проходит проверку и сохраняется по SHA-256.</p>
              </div>
            </div>
            {canManage ? (
              <FontUploadForm />
            ) : (
              <p className={styles.empty}>Загрузка доступна владельцу и администратору.</p>
            )}
          </section>

          <section className={styles.panel} aria-labelledby="font-assets-title">
            <div className={styles.panelHeader}>
              <div>
                <h2 id="font-assets-title">Менеджер шрифтов</h2>
                <p>
                  Встроенные и загруженные семейства в одном каталоге. Системные
                  стеки доступны в редакторе выше.
                </p>
              </div>
              <span className={styles.count}>{fonts.length}</span>
            </div>
            {fonts.length ? (
              <ul className={styles.assetList}>
                {fonts.map((font) => {
                  const licenseUrl = safeLicenseUrl(font.license_url);
                  return (
                    <li className={styles.asset} key={font.id}>
                      <div className={styles.assetHeader}>
                        <strong>{font.display_name || font.family_name}</strong>
                        <span className={styles.meta}>
                          {font.source_type === "system"
                            ? "Системный"
                            : font.source_type === "bundled"
                              ? "Встроенный"
                              : "Загруженный"}
                        </span>
                      </div>
                      <small>
                        {font.family_name} · {font.format ? font.format.toUpperCase() : "системный стек"} · {typographyValueLabels[font.font_style]} · вес {font.weight_min}
                        {font.weight_max !== font.weight_min ? `-${font.weight_max}` : ""}
                        {font.is_variable ? " · вариативный" : ""} · {formatBytes(font.byte_size)}
                      </small>
                      <small>
                        Лицензия: {font.license_name || "не указана"}
                        {licenseUrl && (
                          <>
                            {" · "}
                            <a
                              className={styles.licenseLink}
                              href={licenseUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              открыть условия ↗
                            </a>
                          </>
                        )}
                      </small>
                      {canManage && font.source_type !== "system" && (
                        <form action={archiveFontAssetAction} className={styles.inlineActions}>
                          <input name="font_id" type="hidden" value={font.id} />
                          <input name="expected_version" type="hidden" value={font.cas_version} />
                          <ConfirmSubmitButton message="Архивировать этот шрифт? Используемые шрифты защищены от удаления.">
                            Архивировать
                          </ConfirmSubmitButton>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className={styles.empty}>Шрифты ещё не добавлены.</p>
            )}
          </section>
        </div>

        <aside className={styles.stack} aria-label="Настройки и история типографики">
          <section className={styles.panel} aria-labelledby="override-list-title">
            <div className={styles.panelHeader}>
              <div>
                <h2 id="override-list-title">Правила</h2>
                <p>Выберите правило для правки или публикации.</p>
              </div>
              <span className={styles.count}>{overrides.length}</span>
            </div>
            {overrides.length ? (
              <ul className={styles.overrideList}>
                {overrides.map((override) => (
                  <li
                    className={`${styles.override} ${selected?.id === override.id ? styles.selected : ""}`}
                    key={override.id}
                  >
                    <div className={styles.overrideHeader}>
                      <Link className={styles.overrideLink} href={`/site-studio/fonts?override=${encodeURIComponent(override.id)}`}>
                        <strong>{typographyScopeLabels[override.semanticScope]}</strong>
                      </Link>
                      <span className={styles.meta}>{typographyStatus(override)}</span>
                    </div>
                    <small>
                      {typographyLayerLabels[override.layer]} · {override.targetKey} · {typographyBreakpointLabels[override.breakpoint]}
                    </small>
                    <small>{Object.keys(override.draftSettings).length} параметров · версия {override.casVersion}</small>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.empty}>Пока действует исходная типографика сайта.</p>
            )}
          </section>

          <section className={styles.panel} aria-labelledby="preview-title">
            <div className={styles.panelHeader}>
              <div>
                <h2 id="preview-title">Структурный эскиз</h2>
                <p>Показывает только иерархию текста; выбранные значения появятся на сайте после публикации.</p>
              </div>
            </div>
            <div className={`${styles.preview} ${editorialPreviewFonts} ${previewStyles.fonts}`}>
              <strong>Литература сохраняет голос времени</strong>
              <p>Пример абзаца помогает оценить ритм, длину строки и иерархию текста до публикации.</p>
            </div>
          </section>

          <section className={styles.panel} aria-labelledby="revision-list-title">
            <div className={styles.panelHeader}>
              <div>
                <h2 id="revision-list-title">История</h2>
                <p>Восстановление сразу публикует выбранную версию и защищено проверкой актуальности.</p>
              </div>
              <span className={styles.count}>{revisions.length}</span>
            </div>
            {revisions.length ? (
              <ul className={styles.revisionList}>
                {revisions.map((revision) => {
                  const current = overrideById.get(revision.overrideId);
                  return (
                    <li className={styles.revision} key={revision.id}>
                      <div className={styles.revisionHeader}>
                        <strong>Версия {revision.revisionNumber || revision.id}</strong>
                        <span className={styles.meta}>{revisionActionLabels[revision.action] || "Изменение"}</span>
                      </div>
                      <small>{revision.createdLabel}</small>
                      {canManage && current && (
                        <form action={restoreTypographyRevisionAction} className={styles.inlineActions}>
                          <input name="revision_id" type="hidden" value={revision.id} />
                          <input name="expected_version" type="hidden" value={current.casVersion} />
                          <ConfirmSubmitButton message="Восстановить и опубликовать эту версию?">
                            Восстановить
                          </ConfirmSubmitButton>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className={styles.empty}>История появится после первого сохранения.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
