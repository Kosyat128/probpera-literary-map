"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import {
  normalizeSiteStudioEffect,
  siteStudioBreakpoints,
  siteStudioEasings,
  siteStudioEffectRegistry,
  siteStudioLayers,
  siteStudioStates,
  siteStudioTokenCategories,
  siteStudioTokenCategoryValueTypes,
  type SiteStudioBreakpoint,
  type SiteStudioEffectName,
  type SiteStudioLayer,
  type SiteStudioState,
  type SiteStudioTokenCategory,
  type SiteStudioTokenValueType,
} from "@/lib/site-studio-contract";
import { siteStudioErrorMessage } from "@/lib/site-studio-messages";

import {
  saveSiteDesignTokenAction,
  stageSiteDesignTokenAction,
} from "./actions";
import styles from "./tokens.module.css";

export type DesignTokenView = {
  id: string;
  layer: SiteStudioLayer;
  targetKey: string;
  tokenKey: string;
  category: SiteStudioTokenCategory;
  valueType: SiteStudioTokenValueType;
  breakpoint: SiteStudioBreakpoint;
  state: SiteStudioState;
  description: string;
  draftValue: unknown;
  publishedValue: unknown;
  casVersion: number;
  updatedAt: string;
};

export type DesignComponentOption = {
  key: string;
  displayName: string;
  ownerLock: boolean;
};

export type DesignChangeSetOption = {
  id: string;
  name: string;
  casVersion: number;
};

export type TokenStudioMessages = {
  error?: string;
  saved?: string | number;
  staged?: string | number;
};

const categoryLabels: Record<SiteStudioTokenCategory, string> = {
  color: "Цвет",
  typography: "Типографика",
  spacing: "Интервал",
  radius: "Скругление",
  shadow: "Тень",
  motion: "Движение",
  layout: "Сетка и контейнер",
};

const valueTypeLabels: Record<SiteStudioTokenValueType, string> = {
  color: "Цвет",
  length: "Размер",
  number: "Число",
  shadow: "Тень",
  duration: "Длительность",
  easing: "Плавность",
  effect: "Эффект",
  layout: "Сетка",
};

const layerLabels: Record<SiteStudioLayer, string> = {
  site: "Весь сайт",
  component: "Компонент",
  template: "Шаблон",
  page: "Страница",
  instance: "Экземпляр",
};

const breakpointLabels: Record<SiteStudioBreakpoint, string> = {
  base: "Все экраны",
  mobile: "Телефон",
  tablet: "Планшет",
  desktop: "Компьютер",
};

const stateLabels: Record<SiteStudioState, string> = {
  default: "Обычное",
  hover: "Наведение",
  focus: "Фокус",
  active: "Активное",
  selected: "Выбрано",
  open: "Открыто",
  disabled: "Отключено",
};

const effectLabels: Record<SiteStudioEffectName, string> = {
  none: "Без эффекта",
  fade: "Мягкое появление",
  "reveal-up": "Появление снизу",
  "zoom-soft": "Мягкое приближение",
};

function record(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function number(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function defaultValue(valueType: SiteStudioTokenValueType): unknown {
  if (valueType === "color") return "#ff7619";
  if (valueType === "length") return { value: 16, unit: "px" };
  if (valueType === "number") return 1;
  if (valueType === "duration") return 240;
  if (valueType === "easing") return "ease-out";
  if (valueType === "effect") return normalizeSiteStudioEffect("fade");
  if (valueType === "shadow") {
    return {
      x: { value: 0, unit: "px" },
      y: { value: 12, unit: "px" },
      blur: { value: 32, unit: "px" },
      spread: { value: 0, unit: "px" },
      color: "#00000055",
      inset: false,
    };
  }
  return { display: "block" };
}

function LengthFields({
  value,
  onChange,
  prefix,
  units = ["px", "rem", "em", "%", "vw", "vh"],
}: {
  value: unknown;
  onChange: (value: unknown) => void;
  prefix?: string;
  units?: readonly string[];
}) {
  const source = record(value);
  const selectedUnit =
    typeof source.unit === "string" && units.includes(source.unit)
      ? source.unit
      : units[0];
  return (
    <div className={styles.inlineFields}>
      <label className="field">
        <span>{prefix ? `${prefix}: значение` : "Значение"}</span>
        <input
          type="number"
          step="0.01"
          value={number(source.value, 0)}
          onChange={(event) =>
            onChange({ ...source, value: Number(event.target.value) })
          }
        />
      </label>
      <label className="field">
        <span>{prefix ? `${prefix}: единица` : "Единица"}</span>
        <select
          value={selectedUnit}
          onChange={(event) => onChange({ ...source, unit: event.target.value })}
        >
          {units.map((unit) => (
            <option value={unit} key={unit}>{unit}</option>
          ))}
        </select>
      </label>
    </div>
  );
}

function TokenValueFields({
  valueType,
  value,
  onChange,
}: {
  valueType: SiteStudioTokenValueType;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (valueType === "color") {
    const color = typeof value === "string" && value.startsWith("#")
      ? value.slice(0, 7)
      : "#ff7619";
    return (
      <div className={styles.inlineFields}>
        <label className="field">
          <span>Палитра</span>
          <input type="color" value={color} onChange={(event) => onChange(event.target.value)} />
        </label>
        <label className="field">
          <span>HEX или transparent</span>
          <input value={typeof value === "string" ? value : color} onChange={(event) => onChange(event.target.value)} />
        </label>
      </div>
    );
  }
  if (valueType === "length") return <LengthFields value={value} onChange={onChange} />;
  if (valueType === "number" || valueType === "duration") {
    return (
      <label className="field">
        <span>{valueType === "duration" ? "Длительность, мс (0-5000)" : "Число"}</span>
        <input
          type="number"
          min={valueType === "duration" ? 0 : -10000}
          max={valueType === "duration" ? 5000 : 10000}
          step={valueType === "duration" ? 1 : 0.01}
          value={number(value, valueType === "duration" ? 240 : 1)}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      </label>
    );
  }
  if (valueType === "easing") {
    return (
      <label className="field">
        <span>Кривая движения</span>
        <select value={typeof value === "string" ? value : "ease-out"} onChange={(event) => onChange(event.target.value)}>
          {siteStudioEasings.map((item) => <option value={item} key={item}>{item}</option>)}
        </select>
      </label>
    );
  }
  if (valueType === "effect") {
    const source = record(value);
    const name = Object.hasOwn(siteStudioEffectRegistry, String(source.name))
      ? (String(source.name) as SiteStudioEffectName)
      : "fade";
    return (
      <div className={styles.valueStack}>
        <label className="field">
          <span>Разрешённый эффект</span>
          <select
            value={name}
            onChange={(event) => onChange(normalizeSiteStudioEffect(event.target.value))}
          >
            {(Object.keys(siteStudioEffectRegistry) as SiteStudioEffectName[]).map((item) => (
              <option value={item} key={item}>{effectLabels[item]}</option>
            ))}
          </select>
        </label>
        <div className={styles.inlineFields}>
          <label className="field">
            <span>Длительность, мс</span>
            <input
              type="number"
              min={0}
              max={5000}
              value={number(source.durationMs, 240)}
              onChange={(event) => onChange({ ...source, durationMs: Number(event.target.value) })}
            />
          </label>
          <label className="field">
            <span>Плавность</span>
            <select value={String(source.easing || "ease-out")} onChange={(event) => onChange({ ...source, easing: event.target.value })}>
              {siteStudioEasings.map((item) => <option value={item} key={item}>{item}</option>)}
            </select>
          </label>
        </div>
      </div>
    );
  }
  if (valueType === "shadow") {
    const source = record(value);
    const shadowLength = (key: string, fallback: number) => {
      const item = record(source[key]);
      return { value: number(item.value, fallback), unit: "px" };
    };
    return (
      <div className={styles.valueStack}>
        {(["x", "y", "blur", "spread"] as const).map((key) => (
          <LengthFields
            key={key}
            prefix={{ x: "Сдвиг X", y: "Сдвиг Y", blur: "Размытие", spread: "Расширение" }[key]}
            value={shadowLength(key, key === "y" ? 12 : key === "blur" ? 32 : 0)}
            onChange={(next) => onChange({ ...source, [key]: { ...record(next), unit: "px" } })}
            units={["px"]}
          />
        ))}
        <div className={styles.inlineFields}>
          <label className="field">
            <span>Цвет тени</span>
            <input value={String(source.color || "#00000055")} onChange={(event) => onChange({ ...source, color: event.target.value })} />
          </label>
          <label className={styles.checkbox}>
            <input type="checkbox" checked={source.inset === true} onChange={(event) => onChange({ ...source, inset: event.target.checked })} />
            <span>Внутренняя тень</span>
          </label>
        </div>
      </div>
    );
  }

  const source = record(value);
  const display = ["block", "flex", "grid"].includes(String(source.display))
    ? String(source.display)
    : "block";
  return (
    <div className={styles.valueStack}>
      <div className={styles.inlineFields}>
        <label className="field">
          <span>Режим раскладки</span>
          <select value={display} onChange={(event) => onChange({ ...source, display: event.target.value })}>
            <option value="block">Обычный блок</option>
            <option value="flex">Гибкая строка</option>
            <option value="grid">Сетка</option>
          </select>
        </label>
        {display === "grid" && (
          <label className="field">
            <span>Колонки (1-12)</span>
            <input type="number" min={1} max={12} value={number(source.columns, 2)} onChange={(event) => onChange({ ...source, columns: Number(event.target.value) })} />
          </label>
        )}
      </div>
      {(["gap", "padding", "maxWidth", "borderRadius"] as const).map((key) => (
        <LengthFields
          key={key}
          prefix={{ gap: "Расстояние", padding: "Внутренний отступ", maxWidth: "Макс. ширина", borderRadius: "Скругление" }[key]}
          value={source[key] || { value: key === "maxWidth" ? 1280 : 16, unit: "px" }}
          onChange={(next) => onChange({ ...source, [key]: next })}
          units={key === "maxWidth" ? ["px", "rem"] : undefined}
        />
      ))}
      <div className={styles.inlineFields}>
        <label className="field">
          <span>Выравнивание</span>
          <select value={String(source.alignItems || "stretch")} onChange={(event) => onChange({ ...source, alignItems: event.target.value })}>
            {["start", "center", "end", "stretch"].map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Распределение</span>
          <select value={String(source.justifyContent || "start")} onChange={(event) => onChange({ ...source, justifyContent: event.target.value })}>
            {["start", "center", "end", "space-between"].map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </div>
    </div>
  );
}

function TokenEditor({
  token,
  components,
  defaultLayer,
  defaultTarget,
  canManage,
  isOwner,
}: {
  token: DesignTokenView | null;
  components: readonly DesignComponentOption[];
  defaultLayer: SiteStudioLayer;
  defaultTarget: string;
  canManage: boolean;
  isOwner: boolean;
}) {
  const [layer, setLayer] = useState(token?.layer || defaultLayer);
  const [targetKey, setTargetKey] = useState(token?.targetKey || defaultTarget);
  const [category, setCategory] = useState(token?.category || "color");
  const [valueType, setValueType] = useState(token?.valueType || "color");
  const [value, setValue] = useState(token?.draftValue ?? defaultValue(valueType));
  const identityLocked = Boolean(token);
  const selectedComponent = components.find((item) => item.key === targetKey);
  const componentLocked = layer === "component" && selectedComponent?.ownerLock && !isOwner;
  const disabled = !canManage || componentLocked;
  const valueTypes = siteStudioTokenCategoryValueTypes[category] as readonly SiteStudioTokenValueType[];

  function changeCategory(next: SiteStudioTokenCategory) {
    setCategory(next);
    const nextType = siteStudioTokenCategoryValueTypes[next][0] as SiteStudioTokenValueType;
    setValueType(nextType);
    setValue(defaultValue(nextType));
  }

  return (
    <form action={saveSiteDesignTokenAction} className={styles.editorForm}>
      {token && (
        <>
          <input type="hidden" name="token_id" value={token.id} />
          <input type="hidden" name="expected_version" value={token.casVersion} />
        </>
      )}
      <input type="hidden" name="draft_value" value={JSON.stringify(value)} />
      <fieldset disabled={disabled}>
        <legend className="sr-only">Параметры токена</legend>
        <div className={styles.identityGrid}>
          <label className="field">
            <span>Уровень</span>
            <select name="layer" value={layer} disabled={identityLocked} onChange={(event) => {
              const next = event.target.value as SiteStudioLayer;
              setLayer(next);
              if (next === "site") setTargetKey("site");
            }}>
              {siteStudioLayers.map((item) => <option key={item} value={item}>{layerLabels[item]}</option>)}
            </select>
            {identityLocked && <input type="hidden" name="layer" value={layer} />}
          </label>
          <label className="field">
            <span>Область</span>
            {layer === "component" && !identityLocked ? (
              <select name="target_key" value={targetKey} onChange={(event) => setTargetKey(event.target.value)}>
                {components.map((item) => <option key={item.key} value={item.key}>{item.displayName}{item.ownerLock ? " · системный" : ""}</option>)}
              </select>
            ) : (
              <input name="target_key" value={targetKey} readOnly={identityLocked || layer === "site"} onChange={(event) => setTargetKey(event.target.value)} pattern="[a-z][a-z0-9_-]{0,119}" required />
            )}
            {identityLocked && <input type="hidden" name="target_key" value={targetKey} />}
          </label>
          <label className="field">
            <span>Ключ токена</span>
            <input name="token_key" defaultValue={token?.tokenKey || "color.surface"} readOnly={identityLocked} pattern="[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*){1,5}" required />
          </label>
          <label className="field">
            <span>Категория</span>
            <select name="category" value={category} disabled={identityLocked} onChange={(event) => changeCategory(event.target.value as SiteStudioTokenCategory)}>
              {siteStudioTokenCategories.map((item) => <option key={item} value={item}>{categoryLabels[item]}</option>)}
            </select>
            {identityLocked && <input type="hidden" name="category" value={category} />}
          </label>
          <label className="field">
            <span>Тип значения</span>
            <select name="value_type" value={valueType} disabled={identityLocked} onChange={(event) => {
              const next = event.target.value as SiteStudioTokenValueType;
              setValueType(next);
              setValue(defaultValue(next));
            }}>
              {valueTypes.map((item) => <option key={item} value={item}>{valueTypeLabels[item]}</option>)}
            </select>
            {identityLocked && <input type="hidden" name="value_type" value={valueType} />}
          </label>
          <label className="field">
            <span>Экран</span>
            <select name="breakpoint" defaultValue={token?.breakpoint || "base"} disabled={identityLocked}>
              {siteStudioBreakpoints.map((item) => <option key={item} value={item}>{breakpointLabels[item]}</option>)}
            </select>
            {identityLocked && <input type="hidden" name="breakpoint" value={token?.breakpoint || "base"} />}
          </label>
          <label className="field">
            <span>Состояние</span>
            <select name="state" defaultValue={token?.state || "default"} disabled={identityLocked}>
              {siteStudioStates.map((item) => <option key={item} value={item}>{stateLabels[item]}</option>)}
            </select>
            {identityLocked && <input type="hidden" name="state" value={token?.state || "default"} />}
          </label>
          <label className={`field ${styles.description}`}>
            <span>Пояснение для редакции</span>
            <input name="description" maxLength={500} defaultValue={token?.description || ""} placeholder="Где и зачем используется настройка" />
          </label>
        </div>

        <section className={styles.valueEditor}>
          <header>
            <div>
              <span className="eyebrow">Безопасное значение</span>
              <h3>{valueTypeLabels[valueType]}</h3>
            </div>
            <span>{categoryLabels[category]}</span>
          </header>
          <TokenValueFields valueType={valueType} value={value} onChange={setValue} />
        </section>

        {componentLocked && (
          <p className={styles.warning}>Этот системный компонент доступен только владельцу.</p>
        )}
        <div className={styles.formActions}>
          <button className="button" type="submit" disabled={disabled}>
            {token ? "Сохранить черновик" : "Создать токен"}
          </button>
          {token && <Link className="button-secondary" href="/site-studio/tokens">Новый токен</Link>}
        </div>
      </fieldset>
    </form>
  );
}

export default function TokenStudio({
  tokens,
  components,
  changeSets,
  selectedId,
  defaultLayer,
  defaultTarget,
  canManage,
  isOwner,
  schemaUnavailable,
  messages,
}: {
  tokens: readonly DesignTokenView[];
  components: readonly DesignComponentOption[];
  changeSets: readonly DesignChangeSetOption[];
  selectedId: string | null;
  defaultLayer: SiteStudioLayer;
  defaultTarget: string;
  canManage: boolean;
  isOwner: boolean;
  schemaUnavailable: boolean;
  messages: TokenStudioMessages;
}) {
  const [query, setQuery] = useState("");
  const selected = tokens.find((item) => item.id === selectedId) || null;
  const visibleTokens = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("ru-RU");
    if (!normalized) return tokens;
    return tokens.filter((item) =>
      `${item.tokenKey} ${item.targetKey} ${item.description}`
        .toLocaleLowerCase("ru-RU")
        .includes(normalized)
    );
  }, [query, tokens]);

  return (
    <div className={styles.page}>
      <header className={styles.heading}>
        <div>
          <span className="eyebrow">Site Studio · Токены</span>
          <h1>Единая система оформления</h1>
          <p>Только типизированные значения, адаптивные уровни и явная публикация через набор изменений.</p>
        </div>
        <div className={styles.headingActions}>
          <Link className="button-secondary" href="/site-studio/components">Компоненты</Link>
          <Link className="button-secondary" href="/site-studio/releases">Выпуски</Link>
        </div>
      </header>

      {schemaUnavailable && <p className={styles.message} role="alert">Схема Site Studio ещё не применена к этой среде.</p>}
      {messages.error && <p className={styles.message} role="alert">{siteStudioErrorMessage(messages.error)}</p>}
      {messages.saved && <p className={`${styles.message} ${styles.success}`} role="status">Черновик токена сохранён.</p>}
      {messages.staged && <p className={`${styles.message} ${styles.success}`} role="status">Токен добавлен в набор изменений.</p>}

      <div className={styles.workspace}>
        <aside className={styles.catalog}>
          <header>
            <div><span className="eyebrow">Каталог</span><h2>Токены</h2></div>
            <span>{tokens.length}</span>
          </header>
          <label className="field">
            <span className="sr-only">Поиск токена</span>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ключ, область или описание" />
          </label>
          <div className={styles.tokenList}>
            {visibleTokens.map((token) => (
              <Link className={token.id === selected?.id ? styles.selected : undefined} href={`/site-studio/tokens?token=${encodeURIComponent(token.id)}`} key={token.id}>
                <strong>{token.tokenKey}</strong>
                <small>{layerLabels[token.layer]} · {token.targetKey}</small>
                <span>{breakpointLabels[token.breakpoint]} · {stateLabels[token.state]}</span>
              </Link>
            ))}
            {visibleTokens.length === 0 && <p className={styles.empty}>Подходящих токенов нет.</p>}
          </div>
        </aside>

        <main className={styles.editor}>
          <header><span className="eyebrow">Inspector</span><h2>{selected ? selected.tokenKey : "Новый токен"}</h2></header>
          <TokenEditor
            key={selected?.id || `${defaultLayer}-${defaultTarget}`}
            token={selected}
            components={components}
            defaultLayer={defaultLayer}
            defaultTarget={defaultTarget}
            canManage={canManage}
            isOwner={isOwner}
          />
        </main>

        <aside className={styles.releasePanel}>
          <header><span className="eyebrow">Release</span><h2>Добавить в выпуск</h2></header>
          {!selected ? (
            <p>Сначала сохраните или выберите токен.</p>
          ) : changeSets.length === 0 ? (
            <div className={styles.empty}>
              <p>Создайте черновик набора изменений.</p>
              <Link href="/site-studio/releases">Перейти к выпускам</Link>
            </div>
          ) : (
            <div className={styles.changeSets}>
              {changeSets.map((changeSet) => (
                <form action={stageSiteDesignTokenAction} key={changeSet.id}>
                  <input type="hidden" name="change_set_id" value={changeSet.id} />
                  <input type="hidden" name="change_set_version" value={changeSet.casVersion} />
                  <input type="hidden" name="token_id" value={selected.id} />
                  <input type="hidden" name="token_version" value={selected.casVersion} />
                  <button type="submit" disabled={!canManage}>
                    <strong>{changeSet.name}</strong>
                    <small>Добавить снимок черновика →</small>
                  </button>
                </form>
              ))}
            </div>
          )}
          <small className={styles.releaseHint}>Публичный сайт не меняется до атомарной публикации всего выпуска.</small>
        </aside>
      </div>
    </div>
  );
}
