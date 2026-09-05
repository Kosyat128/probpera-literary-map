"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { saveCoreHomepageSectionAction } from "@/app/(dashboard)/homepage/actions";
import { saveInlineSiteCopyAction } from "@/app/(dashboard)/site-copy/inline-actions";
import {
  getVisualContentVersionAction,
  saveHomepageBlockVisualSettingsAction,
  saveVisualContentFieldAction,
} from "@/app/(dashboard)/visual-content-actions";
import {
  getVisualEntityVersionAction,
  saveVisualEntityFieldAction,
} from "@/app/(dashboard)/visual-entity-actions";
import type { HomepageMediaOption } from "@/components/HomepageMediaField";
import {
  defaultHomepageVisualSettings,
  homepageImageFits,
  homepageImagePositions,
  homepageTextAlignments,
  homepageTextWeights,
  type HomepageVisualSettings,
} from "@/lib/homepage-visual-settings";
import {
  siteStudioComponentRegistry,
  siteStudioStates,
  type SiteStudioBreakpoint,
  type SiteStudioComponentId,
  type SiteStudioState,
} from "@/lib/site-studio-contract";

const BRIDGE_CHANNEL = "probpera:cms-edit";
const BRIDGE_VERSION = 2;
const BRIDGE_LEGACY_VERSION = 1;

export type HomepagePreviewSection = {
  key: string;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  buttonText: string;
  buttonUrl: string;
  backgroundStyle: string;
  backgroundMediaId: string;
  updatedAt: string;
  visualSettings: HomepageVisualSettings;
};

type PreviewSelection = {
  type: "selection";
  key: string;
  copyKey: string;
  sourceText: string;
  field: string;
  kind: "text" | "textarea" | "image" | "richtext";
  label: string;
  value: string;
  href: string;
  entityType: string;
  entityId: string;
  mediaId?: string;
  componentId: SiteStudioComponentId;
  instanceId: string;
  ancestry: Array<{
    componentId: SiteStudioComponentId;
    instanceId: string;
  }>;
  breakpoint: Exclude<SiteStudioBreakpoint, "base">;
  state: SiteStudioState;
  ownerLocked: boolean;
};

type EntityMessage = {
  type: "entity-open";
  entityType: string;
  entityId: string;
  label: string;
  adminHref: string;
};

function isBridgeRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isComponentId(value: unknown): value is SiteStudioComponentId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(siteStudioComponentRegistry, value)
  );
}

function isInstanceId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9][a-z0-9_-]{0,79}$/u.test(value);
}

function previewBreakpoint(): PreviewSelection["breakpoint"] {
  if (window.innerWidth <= 639) return "mobile";
  if (window.innerWidth <= 1023) return "tablet";
  return "desktop";
}

function legacyInstanceId(value: unknown) {
  const normalized = String(value || "legacy")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 80);
  return /^[a-z0-9]/u.test(normalized) ? normalized : "legacy";
}

function readPreviewSelection(
  value: Record<string, unknown>,
  version: number
): PreviewSelection | null {
  const commonKeys = [
    "channel",
    "version",
    "type",
    "key",
    "copyKey",
    "sourceText",
    "field",
    "kind",
    "label",
    "value",
    "href",
    "entityType",
    "entityId",
    "mediaId",
  ];
  const allowedKeys =
    version === BRIDGE_VERSION
      ? [
          ...commonKeys,
          "componentId",
          "instanceId",
          "ancestry",
          "breakpoint",
          "state",
          "ownerLocked",
        ]
      : commonKeys;
  if (
    Object.keys(value).some((key) => !allowedKeys.includes(key)) ||
    value.type !== "selection" ||
    typeof value.key !== "string" ||
    typeof value.copyKey !== "string" ||
    typeof value.sourceText !== "string" ||
    typeof value.field !== "string" ||
    !["text", "textarea", "image", "richtext"].includes(String(value.kind)) ||
    typeof value.label !== "string" ||
    typeof value.value !== "string" ||
    typeof value.href !== "string" ||
    typeof value.entityType !== "string" ||
    typeof value.entityId !== "string" ||
    (value.mediaId !== undefined && typeof value.mediaId !== "string")
  ) {
    return null;
  }

  const base = {
    type: "selection" as const,
    key: value.key,
    copyKey: value.copyKey,
    sourceText: value.sourceText,
    field: value.field,
    kind: value.kind as PreviewSelection["kind"],
    label: value.label,
    value: value.value,
    href: value.href,
    entityType: value.entityType,
    entityId: value.entityId,
    ...(typeof value.mediaId === "string" ? { mediaId: value.mediaId } : {}),
  };
  if (version === BRIDGE_LEGACY_VERSION) {
    const instanceId = legacyInstanceId(value.entityId || value.key);
    return {
      ...base,
      componentId: "magazine",
      instanceId,
      ancestry: [{ componentId: "magazine", instanceId }],
      breakpoint: previewBreakpoint(),
      state: "default",
      ownerLocked: false,
    };
  }
  if (
    version !== BRIDGE_VERSION ||
    !isComponentId(value.componentId) ||
    !isInstanceId(value.instanceId) ||
    !["mobile", "tablet", "desktop"].includes(String(value.breakpoint)) ||
    !siteStudioStates.includes(value.state as SiteStudioState) ||
    value.ownerLocked !== siteStudioComponentRegistry[value.componentId].ownerLocked ||
    !Array.isArray(value.ancestry) ||
    value.ancestry.length < 1 ||
    value.ancestry.length > 12
  ) {
    return null;
  }
  const ancestry = value.ancestry.flatMap((entry) => {
    if (!isBridgeRecord(entry)) return [];
    if (
      Object.keys(entry).length !== 2 ||
      !isComponentId(entry.componentId) ||
      !isInstanceId(entry.instanceId)
    ) {
      return [];
    }
    return [{ componentId: entry.componentId, instanceId: entry.instanceId }];
  });
  if (ancestry.length !== value.ancestry.length) return null;
  const nearest = ancestry[ancestry.length - 1];
  if (
    nearest.componentId !== value.componentId ||
    nearest.instanceId !== value.instanceId
  ) {
    return null;
  }
  return {
    ...base,
    componentId: value.componentId,
    instanceId: value.instanceId,
    ancestry,
    breakpoint: value.breakpoint as PreviewSelection["breakpoint"],
    state: value.state as SiteStudioState,
    ownerLocked: value.ownerLocked,
  };
}

function isReadyCapabilities(value: unknown) {
  if (!isBridgeRecord(value)) return false;
  const components = Object.keys(siteStudioComponentRegistry);
  const exact = (candidate: unknown, expected: readonly unknown[]) =>
    Array.isArray(candidate) &&
    candidate.length === expected.length &&
    candidate.every((item, index) => item === expected[index]);
  return (
    Object.keys(value).length === 7 &&
    value.selectionContext === true &&
    value.ancestry === true &&
    value.ownerLocks === true &&
    exact(value.breakpoints, ["mobile", "tablet", "desktop"]) &&
    exact(value.states, siteStudioStates) &&
    exact(value.components, components) &&
    exact(value.legacyInboundVersions, [BRIDGE_LEGACY_VERSION])
  );
}

function safeAdminHref(value: unknown) {
  if (typeof value !== "string") return "";
  return /^\/(articles|homepage|library|pages|menus|banners)(?:[/?#]|$)/u.test(value)
    ? value
    : "";
}

function publicationLabel(state: string) {
  if (state === "started") return "Сохранено. Публикация сайта запущена.";
  if (state === "queued") {
    return "Сохранено. Изменение поставлено в резервную очередь публикации.";
  }
  return "Текст сохранён, но очередь публикации сейчас недоступна.";
}

type VisualContentEntityType =
  | "page"
  | "navigation-item"
  | "banner"
  | "homepage-block";

function isVisualContentEntityType(value: string): value is VisualContentEntityType {
  return ["page", "navigation-item", "banner", "homepage-block"].includes(value);
}

function isMediaField(field: string) {
  return [
    "desktopMediaId",
    "tabletMediaId",
    "mobileMediaId",
    "backgroundMediaId",
  ].includes(field);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(
    value
  );
}

type InlineSaveResult =
  | { ok: true; publication: string; updatedAt?: string }
  | { ok: false; error: string };

function VisualRange({
  name,
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  disabled = false,
  onChange,
}: {
  name: keyof HomepageVisualSettings;
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <label className="visual-setting-range">
      <span>
        {label}
        <output>{value}{unit}</output>
      </span>
      <input
        name={name}
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function VisualSettingsControls({
  value,
  disabled = false,
  onChange,
}: {
  value: HomepageVisualSettings;
  disabled?: boolean;
  onChange: (value: HomepageVisualSettings) => void;
}) {
  const update = <Key extends keyof HomepageVisualSettings>(
    key: Key,
    next: HomepageVisualSettings[Key]
  ) => onChange({ ...value, [key]: next });

  return (
    <div className="homepage-visual-settings">
      <fieldset>
        <legend>Изображение и эффекты</legend>
        <div className="homepage-visual-setting-grid">
          <label className="field">
            <span>Размещение</span>
            <select
              name="imageFit"
              value={value.imageFit}
              disabled={disabled}
              onChange={(event) =>
                update(
                  "imageFit",
                  event.target.value as HomepageVisualSettings["imageFit"]
                )
              }
            >
              {homepageImageFits.map((fit) => (
                <option key={fit} value={fit}>
                  {fit === "cover"
                    ? "Заполнить с обрезкой"
                    : fit === "contain"
                      ? "Показать целиком"
                      : "Растянуть"}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Фокус изображения</span>
            <select
              name="imagePosition"
              value={value.imagePosition}
              disabled={disabled}
              onChange={(event) =>
                update(
                  "imagePosition",
                  event.target.value as HomepageVisualSettings["imagePosition"]
                )
              }
            >
              {homepageImagePositions.map((position) => (
                <option key={position} value={position}>
                  {{
                    "top-left": "Сверху слева",
                    top: "Сверху",
                    "top-right": "Сверху справа",
                    left: "Слева",
                    center: "По центру",
                    right: "Справа",
                    "bottom-left": "Снизу слева",
                    bottom: "Снизу",
                    "bottom-right": "Снизу справа",
                  }[position]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <VisualRange name="imageZoom" label="Масштаб" value={value.imageZoom} min={50} max={200} unit="%" disabled={disabled} onChange={(next) => update("imageZoom", next)} />
        <VisualRange name="imageOverlay" label="Затемнение" value={value.imageOverlay} min={0} max={90} unit="%" disabled={disabled} onChange={(next) => update("imageOverlay", next)} />
        <VisualRange name="imageBrightness" label="Яркость" value={value.imageBrightness} min={0} max={200} unit="%" disabled={disabled} onChange={(next) => update("imageBrightness", next)} />
        <VisualRange name="imageContrast" label="Контраст" value={value.imageContrast} min={0} max={200} unit="%" disabled={disabled} onChange={(next) => update("imageContrast", next)} />
        <VisualRange name="imageSaturation" label="Насыщенность" value={value.imageSaturation} min={0} max={200} unit="%" disabled={disabled} onChange={(next) => update("imageSaturation", next)} />
        <VisualRange name="imageBlur" label="Размытие" value={value.imageBlur} min={0} max={20} step={0.1} unit=" px" disabled={disabled} onChange={(next) => update("imageBlur", next)} />
      </fieldset>

      <fieldset>
        <legend>Заголовок</legend>
        <div className="homepage-visual-setting-grid">
          <label className="field">
            <span>Выравнивание</span>
            <select name="titleAlign" value={value.titleAlign} disabled={disabled} onChange={(event) => update("titleAlign", event.target.value as HomepageVisualSettings["titleAlign"])}>
              {homepageTextAlignments.map((alignment) => (
                <option key={alignment} value={alignment}>
                  {alignment === "left" ? "Слева" : alignment === "center" ? "По центру" : "Справа"}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Начертание</span>
            <select name="titleWeight" value={value.titleWeight} disabled={disabled} onChange={(event) => update("titleWeight", Number(event.target.value) as HomepageVisualSettings["titleWeight"])}>
              {homepageTextWeights.map((weight) => <option key={weight} value={weight}>{weight}</option>)}
            </select>
          </label>
        </div>
        <VisualRange name="titleFontSize" label="Размер" value={value.titleFontSize} min={20} max={112} unit=" px" disabled={disabled} onChange={(next) => update("titleFontSize", next)} />
        <VisualRange name="titleLineHeight" label="Межстрочный интервал" value={value.titleLineHeight} min={0.8} max={1.6} step={0.05} disabled={disabled} onChange={(next) => update("titleLineHeight", next)} />
      </fieldset>

      <fieldset>
        <legend>Основной текст</legend>
        <div className="homepage-visual-setting-grid">
          <label className="field">
            <span>Выравнивание</span>
            <select name="bodyAlign" value={value.bodyAlign} disabled={disabled} onChange={(event) => update("bodyAlign", event.target.value as HomepageVisualSettings["bodyAlign"])}>
              {homepageTextAlignments.map((alignment) => (
                <option key={alignment} value={alignment}>
                  {alignment === "left" ? "Слева" : alignment === "center" ? "По центру" : "Справа"}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Начертание</span>
            <select name="bodyWeight" value={value.bodyWeight} disabled={disabled} onChange={(event) => update("bodyWeight", Number(event.target.value) as HomepageVisualSettings["bodyWeight"])}>
              {homepageTextWeights.map((weight) => <option key={weight} value={weight}>{weight}</option>)}
            </select>
          </label>
        </div>
        <VisualRange name="bodyFontSize" label="Размер" value={value.bodyFontSize} min={12} max={32} unit=" px" disabled={disabled} onChange={(next) => update("bodyFontSize", next)} />
        <VisualRange name="bodyLineHeight" label="Межстрочный интервал" value={value.bodyLineHeight} min={1} max={2.2} step={0.05} disabled={disabled} onChange={(next) => update("bodyLineHeight", next)} />
      </fieldset>
      <small>
        Редактор сохраняет только перечисленные параметры и не принимает CSS-код.
      </small>
    </div>
  );
}

export default function HomepageVisualPreview({
  url,
  sections,
  media,
  blockVisualSettings,
  blockVisualUpdatedAt,
}: {
  url: string;
  sections: readonly HomepagePreviewSection[];
  media: readonly HomepageMediaOption[];
  blockVisualSettings: Readonly<Record<string, HomepageVisualSettings>>;
  blockVisualUpdatedAt: Readonly<Record<string, string>>;
}) {
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [revision, setRevision] = useState(0);
  const [previewAddress, setPreviewAddress] = useState("/");
  const [addressDraft, setAddressDraft] = useState("/");
  const [parentOrigin, setParentOrigin] = useState("");
  const [selection, setSelection] = useState<PreviewSelection | null>(null);
  const [inlineValue, setInlineValue] = useState("");
  const [inlineStatus, setInlineStatus] = useState("");
  const [isSavingInline, setIsSavingInline] = useState(false);
  const [inlineExpectedUpdatedAt, setInlineExpectedUpdatedAt] = useState("");
  const [inlineVersionReady, setInlineVersionReady] = useState(false);
  const [isLoadingInlineVersion, setIsLoadingInlineVersion] = useState(false);
  const [visualSettings, setVisualSettings] = useState<HomepageVisualSettings>({
    ...defaultHomepageVisualSettings,
  });
  const [visualUpdatedAtByBlock, setVisualUpdatedAtByBlock] = useState(
    () => ({ ...blockVisualUpdatedAt })
  );
  const savingInlineRef = useRef(false);
  const mountedRef = useRef(true);
  const selectionRef = useRef<PreviewSelection | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const previewOrigin = useMemo(() => new URL(url).origin, [url]);

  useEffect(() => {
    mountedRef.current = true;
    setParentOrigin(window.location.origin);
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setVisualUpdatedAtByBlock({ ...blockVisualUpdatedAt });
  }, [blockVisualUpdatedAt]);

  const previewUrl = useMemo(() => {
    let target = new URL(url);
    try {
      const requested = new URL(previewAddress || "/", `${url}/`);
      if (requested.origin === previewOrigin) target = requested;
    } catch {
      // Keep the configured public homepage for an invalid draft URL.
    }
    target.searchParams.set("admin-preview", String(revision));
    if (parentOrigin) {
      target.searchParams.set("cms-edit", "1");
      target.searchParams.set("cms-parent-origin", parentOrigin);
    }
    return target.toString();
  }, [parentOrigin, previewAddress, previewOrigin, revision, url]);

  useEffect(() => {
    const onMessage = (event: MessageEvent<unknown>) => {
      if (
        event.origin !== previewOrigin ||
        event.source !== iframeRef.current?.contentWindow ||
        !isBridgeRecord(event.data) ||
        event.data.channel !== BRIDGE_CHANNEL ||
        ![BRIDGE_LEGACY_VERSION, BRIDGE_VERSION].includes(
          Number(event.data.version)
        )
      ) {
        return;
      }

      const version = Number(event.data.version);
      if (event.data.type === "ready") {
        if (
          version !== BRIDGE_VERSION ||
          !isReadyCapabilities(event.data.capabilities)
        ) return;
        return;
      }

      if (event.data.type === "selection") {
        const next = readPreviewSelection(event.data, version);
        if (!next) return;
        selectionRef.current = next;
        setSelection(next);
        const selectedMediaId =
          next.mediaId ||
          (isMediaField(next.field)
            ? media.find((item) => item.publicUrl === next.value)?.id || next.value
            : "");
        setInlineValue(isMediaField(next.field) ? selectedMediaId : next.value);
        const nextVisualSettings =
          next.entityType === "homepage-core"
            ? sections.find((section) => section.key === next.entityId)
                ?.visualSettings
            : next.entityType === "homepage-block"
              ? blockVisualSettings[next.entityId]
              : undefined;
        setVisualSettings(
          nextVisualSettings
            ? { ...nextVisualSettings }
            : { ...defaultHomepageVisualSettings }
        );
        setInlineStatus("");
        return;
      }

      if (event.data.type === "entity-open") {
        const entity = event.data as unknown as EntityMessage;
        if (
          Object.keys(event.data).some(
            (key) =>
              ![
                "channel",
                "version",
                "type",
                "entityType",
                "entityId",
                "label",
                "adminHref",
              ].includes(key)
          ) ||
          ![BRIDGE_LEGACY_VERSION, BRIDGE_VERSION].includes(version) ||
          typeof entity.entityType !== "string" ||
          typeof entity.entityId !== "string" ||
          typeof entity.label !== "string" ||
          typeof entity.adminHref !== "string"
        ) {
          return;
        }
        const href = safeAdminHref(entity.adminHref);
        if (href) window.location.assign(href);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [blockVisualSettings, media, previewOrigin, sections]);

  const selectedSection = selection?.entityType === "homepage-core"
    ? sections.find((section) => section.key === selection.entityId) || null
    : null;
  const selectedMedia = selectedSection?.backgroundMediaId || "";

  useEffect(() => {
    let active = true;
    setInlineExpectedUpdatedAt("");
    setInlineVersionReady(false);
    setIsLoadingInlineVersion(false);
    if (!selection) return () => { active = false; };

    const visualEntity =
      selection.entityType === "writer" || selection.entityType === "book";
    const visualContent = isVisualContentEntityType(selection.entityType);
    if (!visualEntity && !visualContent) return () => { active = false; };

    const cachedBlockVersion =
      selection.entityType === "homepage-block"
        ? visualUpdatedAtByBlock[selection.entityId]
        : "";
    if (cachedBlockVersion) {
      setInlineExpectedUpdatedAt(cachedBlockVersion);
      setInlineVersionReady(true);
      return () => { active = false; };
    }

    setIsLoadingInlineVersion(true);
    const request = visualEntity
      ? getVisualEntityVersionAction({
          entityType: selection.entityType as "writer" | "book",
          entityId: selection.entityId,
        })
      : getVisualContentVersionAction({
          entityType: selection.entityType as VisualContentEntityType,
          entityId: selection.entityId,
        });
    void request.then((result) => {
      if (!active) return;
      setIsLoadingInlineVersion(false);
      if (result.ok) {
        setInlineExpectedUpdatedAt(result.updatedAt);
        setInlineVersionReady(true);
      } else {
        setInlineStatus(result.error);
      }
    }).catch(() => {
      if (!active) return;
      setIsLoadingInlineVersion(false);
      setInlineStatus(
        "Не удалось загрузить запись. Проверьте соединение и выберите поле повторно."
      );
    });
    return () => { active = false; };
  }, [selection, visualUpdatedAtByBlock]);

  const updatePreview = (
    key: string,
    kind: PreviewSelection["kind"],
    value: string,
    mediaId?: string
  ) => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        channel: BRIDGE_CHANNEL,
        version: BRIDGE_VERSION,
        type: "preview-update",
        key,
        kind,
        value,
        mediaId,
      },
      previewOrigin
    );
  };

  const updateVisualSettingsPreview = (
    next: HomepageVisualSettings,
    reset = false
  ) => {
    setVisualSettings(next);
    if (!selection) return;
    iframeRef.current?.contentWindow?.postMessage(
      {
        channel: BRIDGE_CHANNEL,
        version: BRIDGE_VERSION,
        type: "preview-style-update",
        key: selection.key,
        styles: next,
        reset,
      },
      previewOrigin
    );
  };

  const runInlineSave = async (
    operation: () => Promise<InlineSaveResult>
  ) => {
    if (savingInlineRef.current) return;
    const savingSelection = selectionRef.current;
    savingInlineRef.current = true;
    setIsSavingInline(true);
    setInlineStatus("");
    try {
      const result = await operation();
      if (!mountedRef.current) return;
      if (selectionRef.current !== savingSelection) return result;
      setInlineStatus(
        result.ok ? publicationLabel(result.publication) : result.error
      );
      return result;
    } catch {
      if (!mountedRef.current || selectionRef.current !== savingSelection) return;
      setInlineStatus(
        "Не удалось подтвердить сохранение. Проверьте соединение и обновите предпросмотр."
      );
      return undefined;
    } finally {
      savingInlineRef.current = false;
      if (mountedRef.current) setIsSavingInline(false);
    }
  };

  const saveInlineCopy = () => {
    if (!selection?.copyKey) return;
    const copyKey = selection.copyKey;
    const value = inlineValue;
    void runInlineSave(() =>
      saveInlineSiteCopyAction({
        key: copyKey,
        value,
      })
    );
  };

  const selectedVisualEntity =
    selection?.entityType === "writer" || selection?.entityType === "book"
      ? selection
      : null;
  const selectedVisualContent =
    selection && isVisualContentEntityType(selection.entityType)
      ? selection
      : null;
  const hasUnresolvedMedia = Boolean(
    selectedVisualContent &&
      isMediaField(selectedVisualContent.field) &&
      inlineValue &&
      !isUuid(inlineValue)
  );

  const saveVisualEntityField = () => {
    if (!selectedVisualEntity) return;
    const entity = selectedVisualEntity;
    const value = inlineValue;
    void (async () => {
      const result = await runInlineSave(() =>
        saveVisualEntityFieldAction({
          entityType: entity.entityType as "writer" | "book",
          entityId: entity.entityId,
          field: entity.field,
          value,
          expectedUpdatedAt: inlineExpectedUpdatedAt,
        })
      );
      if (result?.ok && result.updatedAt && selectionRef.current === entity) {
        setInlineExpectedUpdatedAt(result.updatedAt);
        setInlineVersionReady(true);
      }
    })();
  };

  const saveVisualContentField = () => {
    if (!selectedVisualContent) return;
    const content = selectedVisualContent;
    const value = inlineValue;
    void (async () => {
      const result = await runInlineSave(() =>
        saveVisualContentFieldAction({
          entityType: content.entityType as VisualContentEntityType,
          entityId: content.entityId,
          field: content.field,
          value,
          expectedUpdatedAt: inlineExpectedUpdatedAt,
        })
      );
      if (result?.ok && result.updatedAt) {
        if (selectionRef.current === content) {
          setInlineExpectedUpdatedAt(result.updatedAt);
          setInlineVersionReady(true);
        }
        if (content.entityType === "homepage-block") {
          setVisualUpdatedAtByBlock((current) => ({
            ...current,
            [content.entityId]: result.updatedAt!,
          }));
        }
      }
    })();
  };

  const saveVisualSettings = (reset = false) => {
    if (selectedVisualContent?.entityType !== "homepage-block") return;
    const entityId = selectedVisualContent.entityId;
    const nextSettings = reset
      ? { ...defaultHomepageVisualSettings }
      : visualSettings;
    if (reset) updateVisualSettingsPreview(nextSettings, true);
    void (async () => {
      const result = await runInlineSave(() =>
        saveHomepageBlockVisualSettingsAction({
        entityId,
        expectedUpdatedAt: visualUpdatedAtByBlock[entityId] || "",
        settings: nextSettings,
        reset,
      })
      );
      if (result?.ok && result.updatedAt) {
        setVisualUpdatedAtByBlock((current) => ({
          ...current,
          [entityId]: result.updatedAt!,
        }));
      }
    })();
  };

  return (
    <section className="panel homepage-visual-editor" aria-labelledby="homepage-preview-title">
      <header>
        <div>
          <span className="eyebrow">Прямое редактирование</span>
          <h2 id="homepage-preview-title">Нажмите на текст или изображение</h2>
          <p>
            Выберите элемент прямо на странице. Управляемый блок откроется
            целиком; любой другой короткий текст сохранится через единый словарь
            интерфейса.
          </p>
        </div>
        <div className="editor-actions">
          <button
            className={viewport === "desktop" ? "button" : "button-secondary"}
            type="button"
            onClick={() => setViewport("desktop")}
          >
            Компьютер
          </button>
          <button
            className={viewport === "mobile" ? "button" : "button-secondary"}
            type="button"
            onClick={() => setViewport("mobile")}
          >
            Телефон
          </button>
          <button className="button-secondary" type="button" onClick={() => setRevision(Date.now())}>
            Обновить
          </button>
        </div>
      </header>

      <form
        className="homepage-preview-address"
        onSubmit={(event) => {
          event.preventDefault();
          setPreviewAddress(addressDraft);
          setRevision(Date.now());
        }}
      >
        <label className="field">
          <span>Страница в предпросмотре</span>
          <input
            value={addressDraft}
            onChange={(event) => setAddressDraft(event.target.value)}
            placeholder="/ или /stranitsy/o-proekte/"
          />
        </label>
        <button className="button-secondary" type="submit">
          Открыть
        </button>
        <small>
          Ctrl/⌘ + клик по внутренней ссылке открывает её в этом окне. Shift
          или Alt + клик временно включает обычное взаимодействие с глобусом,
          аккордеоном или слайдером без выбора элемента.
        </small>
      </form>

      <div className="homepage-direct-layout">
        <div className={`homepage-preview-frame is-${viewport}`}>
          <iframe
            ref={iframeRef}
            src={previewUrl}
            title="Интерактивный предпросмотр главной страницы"
            loading="lazy"
          />
        </div>

        <aside className="homepage-direct-inspector" aria-live="polite">
          {!selection && (
            <div className="empty-state">
              <strong>Выберите элемент слева</strong>
              <p>Оранжевая рамка показывает, что можно изменить.</p>
            </div>
          )}

          {selectedSection && (
            <form
              action={saveCoreHomepageSectionAction}
              className="settings-stack"
              key={selectedSection.key}
            >
              <input type="hidden" name="core_section_key" value={selectedSection.key} />
              <input type="hidden" name="expected_updated_at" value={selectedSection.updatedAt} />
              <span className="badge">{selectedSection.label}</span>
              <h3>Настройки выбранного блока</h3>
              <label className="field">
                <span>Надзаголовок</span>
                <input
                  name="eyebrow"
                  defaultValue={selectedSection.eyebrow}
                  autoFocus={selection?.field === "eyebrow"}
                  onChange={(event) =>
                    updatePreview(
                      `homepage.${selectedSection.key}.eyebrow`,
                      "text",
                      event.target.value
                    )
                  }
                />
              </label>
              <label className="field">
                <span>Заголовок</span>
                <input
                  name="title"
                  defaultValue={selectedSection.title}
                  autoFocus={selection?.field === "title"}
                  onChange={(event) =>
                    updatePreview(
                      `homepage.${selectedSection.key}.title`,
                      "text",
                      event.target.value
                    )
                  }
                />
              </label>
              <label className="field">
                <span>Описание</span>
                <textarea
                  name="description"
                  defaultValue={selectedSection.description}
                  autoFocus={selection?.field === "description"}
                  onChange={(event) =>
                    updatePreview(
                      `homepage.${selectedSection.key}.description`,
                      "textarea",
                      event.target.value
                    )
                  }
                />
              </label>
              <label className="field">
                <span>Текст кнопки</span>
                <input
                  name="button_text"
                  defaultValue={selectedSection.buttonText}
                  autoFocus={selection?.field === "buttonText"}
                  onChange={(event) =>
                    updatePreview(
                      `homepage.${selectedSection.key}.buttonText`,
                      "text",
                      event.target.value
                    )
                  }
                />
              </label>
              <label className="field">
                <span>Ссылка кнопки</span>
                <input name="button_url" defaultValue={selectedSection.buttonUrl} />
              </label>
              <label className="field">
                <span>Стиль фона</span>
                <select name="background_style" defaultValue={selectedSection.backgroundStyle}>
                  <option value="violet">Фиолетовый</option>
                  <option value="orange">Оранжевый</option>
                  <option value="paper">Бумага с мазками</option>
                  <option value="light">Светлый</option>
                  <option value="transparent">Прозрачный</option>
                </select>
              </label>
              <label className="field">
                <span>Фоновое изображение</span>
                <select
                  name="background_media_id"
                  defaultValue={selectedMedia}
                  autoFocus={selection?.field === "backgroundMediaId"}
                  onChange={(event) => {
                    const asset = media.find((item) => item.id === event.target.value);
                    updatePreview(
                      `homepage.${selectedSection.key}.backgroundMediaId`,
                      "image",
                      asset?.publicUrl || ""
                    );
                  }}
                >
                  <option value="">Без отдельного изображения</option>
                  {media.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.label}
                    </option>
                  ))}
                </select>
              </label>
              <VisualSettingsControls
                value={visualSettings}
                onChange={updateVisualSettingsPreview}
              />
              <div className="editor-actions">
                <button className="button" type="submit">
                  Сохранить и опубликовать блок
                </button>
                <button
                  className="button-secondary"
                  type="submit"
                  name="reset_visual_settings"
                  value="1"
                  onClick={() =>
                    updateVisualSettingsPreview(
                      { ...defaultHomepageVisualSettings },
                      true
                    )
                  }
                >
                  Сбросить оформление
                </button>
              </div>
            </form>
          )}

          {selection && !selectedSection && !selectedVisualEntity && !selectedVisualContent && selection.copyKey && (
            <div className="settings-stack">
              <span className="badge">Текст интерфейса</span>
              <h3>{selection.label || "Выбранный текст"}</h3>
              <label className="field">
                <span>Новый русский текст</span>
                {inlineValue.length > 120 ? (
                  <textarea
                    value={inlineValue}
                    onChange={(event) => {
                      setInlineValue(event.target.value);
                      updatePreview(selection.key, "textarea", event.target.value);
                    }}
                  />
                ) : (
                  <input
                    value={inlineValue}
                    onChange={(event) => {
                      setInlineValue(event.target.value);
                      updatePreview(selection.key, "text", event.target.value);
                    }}
                  />
                )}
                <small>Исходная строка: {selection.sourceText}</small>
              </label>
              <button
                className="button"
                type="button"
                disabled={isSavingInline}
                onClick={saveInlineCopy}
              >
                {isSavingInline ? "Сохраняем…" : "Сохранить и опубликовать текст"}
              </button>
              {inlineStatus && (
                <p className={`form-message${inlineStatus.startsWith("Сохранено") ? " form-success" : " form-error"}`}>
                  {inlineStatus}
                </p>
              )}
            </div>
          )}

          {selectedVisualContent && (
            <div className="settings-stack" key={selectedVisualContent.key}>
              <span className="badge">
                {selectedVisualContent.entityType === "page"
                  ? "Страница"
                  : selectedVisualContent.entityType === "navigation-item"
                    ? "Навигация"
                    : selectedVisualContent.entityType === "banner"
                      ? "Баннер"
                      : "Блок главной"}
              </span>
              <h3>{selectedVisualContent.label || "Выбранное поле"}</h3>
              <label className="field">
                <span>Новое значение</span>
                {isMediaField(selectedVisualContent.field) ? (
                  <select
                    value={inlineValue}
                    onChange={(event) => {
                      const mediaId = event.target.value;
                      const asset = media.find((item) => item.id === mediaId);
                      setInlineValue(mediaId);
                      updatePreview(
                        selectedVisualContent.key,
                        "image",
                        asset?.publicUrl || "",
                        mediaId
                      );
                    }}
                  >
                    <option value="">Без изображения</option>
                    {inlineValue && !media.some((asset) => asset.id === inlineValue) && (
                      <option value={inlineValue}>
                        Текущее изображение - выберите замену
                      </option>
                    )}
                    {media.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.label}
                      </option>
                    ))}
                  </select>
                ) : selectedVisualContent.field === "backgroundStyle" ? (
                  <select
                    value={inlineValue}
                    onChange={(event) => {
                      setInlineValue(event.target.value);
                      updatePreview(
                        selectedVisualContent.key,
                        "text",
                        event.target.value
                      );
                    }}
                  >
                    <option value="violet">Фиолетовый</option>
                    <option value="orange">Оранжевый</option>
                    <option value="paper">Бумага с мазками</option>
                    <option value="light">Светлый</option>
                    <option value="transparent">Прозрачный</option>
                  </select>
                ) : selectedVisualContent.kind === "textarea" ? (
                  <textarea
                    value={inlineValue}
                    onChange={(event) => {
                      setInlineValue(event.target.value);
                      updatePreview(
                        selectedVisualContent.key,
                        "textarea",
                        event.target.value
                      );
                    }}
                  />
                ) : (
                  <input
                    value={inlineValue}
                    inputMode={
                      selectedVisualContent.field.toLowerCase().includes("url") ||
                      selectedVisualContent.field === "href"
                        ? "url"
                        : undefined
                    }
                    onChange={(event) => {
                      setInlineValue(event.target.value);
                      updatePreview(
                        selectedVisualContent.key,
                        "text",
                        event.target.value
                      );
                    }}
                  />
                )}
                {selectedVisualContent.entityType === "page" && (
                  <small>
                    Основной текст страницы открывается в штатном редакторе, чтобы
                    сохранить структуру и историю версий.
                  </small>
                )}
                {hasUnresolvedMedia && (
                  <small className="is-error" role="alert">
                    Текущее изображение не найдено в загруженной части медиатеки.
                    Выберите его заново или укажите «Без изображения» осознанно.
                  </small>
                )}
              </label>
              <button
                className="button"
                type="button"
                disabled={isSavingInline || isLoadingInlineVersion || !inlineVersionReady || hasUnresolvedMedia}
                onClick={saveVisualContentField}
              >
                {isSavingInline
                  ? "Сохраняем…"
                  : "Сохранить и опубликовать"}
              </button>
              {selectedVisualContent.entityType === "homepage-block" && (
                <div className="homepage-visual-settings-section">
                  <h3>Оформление всего блока</h3>
                  <p>
                    Настройки изображения применяются к фону блока, а размеры и
                    интервалы текста - отдельно к заголовку и описанию.
                  </p>
                  <VisualSettingsControls
                    value={visualSettings}
                    disabled={isSavingInline || isLoadingInlineVersion || !inlineVersionReady}
                    onChange={updateVisualSettingsPreview}
                  />
                  <div className="editor-actions">
                    <button
                      className="button"
                      type="button"
                      disabled={isSavingInline}
                      onClick={() => saveVisualSettings(false)}
                    >
                      {isSavingInline ? "Сохраняем…" : "Сохранить оформление"}
                    </button>
                    <button
                      className="button-secondary"
                      type="button"
                      disabled={isSavingInline}
                      onClick={() => saveVisualSettings(true)}
                    >
                      Сбросить к оформлению сайта
                    </button>
                  </div>
                </div>
              )}
              {inlineStatus && (
                <p
                  className={`form-message${
                    inlineStatus.startsWith("Сохранено")
                      ? " form-success"
                      : " form-error"
                  }`}
                >
                  {inlineStatus}
                </p>
              )}
            </div>
          )}

          {selectedVisualEntity && (
            <div className="settings-stack" key={selectedVisualEntity.key}>
              <span className="badge">
                {selectedVisualEntity.entityType === "writer"
                  ? "Карточка писателя"
                  : "Карточка произведения"}
              </span>
              <h3>{selectedVisualEntity.label || "Выбранное поле"}</h3>
              <label className="field">
                <span>Новое значение</span>
                {selectedVisualEntity.kind === "textarea" ? (
                  <textarea
                    value={inlineValue}
                    onChange={(event) => {
                      setInlineValue(event.target.value);
                      updatePreview(
                        selectedVisualEntity.key,
                        selectedVisualEntity.kind,
                        event.target.value
                      );
                    }}
                  />
                ) : (
                  <input
                    value={inlineValue}
                    inputMode={
                      selectedVisualEntity.field === "firstPublished"
                        ? "numeric"
                        : undefined
                    }
                    onChange={(event) => {
                      setInlineValue(event.target.value);
                      updatePreview(
                        selectedVisualEntity.key,
                        selectedVisualEntity.kind,
                        event.target.value
                      );
                    }}
                  />
                )}
                {(selectedVisualEntity.field === "works" ||
                  selectedVisualEntity.field === "awards" ||
                  selectedVisualEntity.field === "genres" ||
                  selectedVisualEntity.field === "tags") && (
                  <small>Каждый пункт укажите с новой строки.</small>
                )}
              </label>
              <button
                className="button"
                type="button"
                disabled={isSavingInline || isLoadingInlineVersion || !inlineVersionReady}
                onClick={saveVisualEntityField}
              >
                {isSavingInline
                  ? "Сохраняем…"
                  : "Сохранить и опубликовать"}
              </button>
              {inlineStatus && (
                <p
                  className={`form-message${
                    inlineStatus.startsWith("Сохранено")
                      ? " form-success"
                      : " form-error"
                  }`}
                >
                  {inlineStatus}
                </p>
              )}
            </div>
          )}

          {selection && !selectedSection && !selectedVisualEntity && !selectedVisualContent && !selection.copyKey && (
            <div className="empty-state">
              <strong>Элемент связан с отдельной сущностью</strong>
              <p>Откройте штатный редактор книги, автора, статьи или страницы.</p>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
