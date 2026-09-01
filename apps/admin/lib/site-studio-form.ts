import {
  normalizeSiteStudioTokenValue,
  siteStudioBreakpoints,
  siteStudioLayers,
  siteStudioStates,
  siteStudioTokenCategories,
  siteStudioTokenValueTypes,
  type SiteStudioBreakpoint,
  type SiteStudioLayer,
  type SiteStudioState,
  type SiteStudioTokenCategory,
  type SiteStudioTokenValue,
  type SiteStudioTokenValueType,
} from "./site-studio-contract";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const targetPattern = /^[a-z][a-z0-9_-]{0,119}$/u;
const tokenPattern = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9-]*){1,5}$/u;

export type SiteStudioFormErrorCode =
  | "site_studio_id_invalid"
  | "site_studio_identity_invalid"
  | "site_studio_value_invalid"
  | "site_studio_version_invalid"
  | "site_studio_change_set_invalid";

export class SiteStudioFormError extends Error {
  readonly code: SiteStudioFormErrorCode;

  constructor(code: SiteStudioFormErrorCode) {
    super(code);
    this.name = "SiteStudioFormError";
    this.code = code;
  }
}

function text(formData: FormData, name: string, maximum: number) {
  const value = formData.get(name);
  if (typeof value !== "string") return "";
  return value.trim().slice(0, maximum);
}

function enumText<const Values extends readonly string[]>(
  formData: FormData,
  name: string,
  allowed: Values
): Values[number] {
  const value = text(formData, name, 80);
  if (!allowed.includes(value as Values[number])) {
    throw new SiteStudioFormError("site_studio_identity_invalid");
  }
  return value as Values[number];
}

export function optionalSiteStudioUuid(value: FormDataEntryValue | null) {
  const candidate = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!candidate) return null;
  if (!uuidPattern.test(candidate)) {
    throw new SiteStudioFormError("site_studio_id_invalid");
  }
  return candidate;
}

export function requiredSiteStudioUuid(value: FormDataEntryValue | null) {
  const candidate = optionalSiteStudioUuid(value);
  if (!candidate) throw new SiteStudioFormError("site_studio_id_invalid");
  return candidate;
}

export function optionalSiteStudioVersion(value: FormDataEntryValue | null) {
  const candidate = typeof value === "string" ? value.trim() : "";
  if (!candidate) return null;
  if (!/^[1-9][0-9]{0,15}$/u.test(candidate)) {
    throw new SiteStudioFormError("site_studio_version_invalid");
  }
  const version = Number(candidate);
  if (!Number.isSafeInteger(version)) {
    throw new SiteStudioFormError("site_studio_version_invalid");
  }
  return version;
}

export function requiredSiteStudioVersion(value: FormDataEntryValue | null) {
  const version = optionalSiteStudioVersion(value);
  if (version === null) {
    throw new SiteStudioFormError("site_studio_version_invalid");
  }
  return version;
}

export type ParsedSiteDesignTokenForm = {
  id: string | null;
  layer: SiteStudioLayer;
  targetKey: string;
  tokenKey: string;
  category: SiteStudioTokenCategory;
  valueType: SiteStudioTokenValueType;
  breakpoint: SiteStudioBreakpoint;
  state: SiteStudioState;
  description: string;
  draftValue: SiteStudioTokenValue;
  expectedVersion: number | null;
};

export function parseSiteDesignTokenForm(
  formData: FormData
): ParsedSiteDesignTokenForm {
  const id = optionalSiteStudioUuid(formData.get("token_id"));
  const layer = enumText(formData, "layer", siteStudioLayers);
  const targetKey = text(formData, "target_key", 120);
  const tokenKey = text(formData, "token_key", 160);
  const category = enumText(
    formData,
    "category",
    siteStudioTokenCategories
  );
  const valueType = enumText(
    formData,
    "value_type",
    siteStudioTokenValueTypes
  );
  const breakpoint = enumText(
    formData,
    "breakpoint",
    siteStudioBreakpoints
  );
  const state = enumText(formData, "state", siteStudioStates);
  const description = text(formData, "description", 500);
  if (
    !targetPattern.test(targetKey) ||
    (layer === "site" && targetKey !== "site") ||
    !tokenPattern.test(tokenKey)
  ) {
    throw new SiteStudioFormError("site_studio_identity_invalid");
  }

  const rawValue = text(formData, "draft_value", 8193);
  if (!rawValue || rawValue.length > 8192) {
    throw new SiteStudioFormError("site_studio_value_invalid");
  }
  let parsedValue: unknown;
  try {
    parsedValue = JSON.parse(rawValue);
  } catch {
    throw new SiteStudioFormError("site_studio_value_invalid");
  }
  let draftValue: SiteStudioTokenValue;
  try {
    draftValue = normalizeSiteStudioTokenValue(category, valueType, parsedValue);
  } catch {
    throw new SiteStudioFormError("site_studio_value_invalid");
  }

  const expectedVersion = optionalSiteStudioVersion(
    formData.get("expected_version")
  );
  if ((id === null) !== (expectedVersion === null)) {
    throw new SiteStudioFormError("site_studio_version_invalid");
  }
  return {
    id,
    layer,
    targetKey,
    tokenKey,
    category,
    valueType,
    breakpoint,
    state,
    description,
    draftValue,
    expectedVersion,
  };
}

export function parseSiteDesignChangeSetForm(formData: FormData) {
  const id = optionalSiteStudioUuid(formData.get("change_set_id"));
  const name = text(formData, "name", 161);
  const description = text(formData, "description", 1201);
  if (!name || name.length > 160 || description.length > 1200) {
    throw new SiteStudioFormError("site_studio_change_set_invalid");
  }
  const expectedVersion = optionalSiteStudioVersion(
    formData.get("expected_version")
  );
  if ((id === null) !== (expectedVersion === null)) {
    throw new SiteStudioFormError("site_studio_version_invalid");
  }
  return { id, name, description, expectedVersion };
}
