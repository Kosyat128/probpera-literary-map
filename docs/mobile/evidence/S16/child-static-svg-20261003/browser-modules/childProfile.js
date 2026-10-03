/** Local metadata only. Decoding does not verify a parent, restore a mode,
 * authorize content or access an adult/child history, index or cache. */
export const CHILD_PROFILE_SCHEMA_VERSION = 1;
export const CHILD_PROFILE_LIMIT = 4;
export const CHILD_PROFILE_MAX_LENGTH = 65536;
export function isChildExactAge(value) {
    return typeof value === "number" && Number.isInteger(value) && value >= 3 && value <= 17;
}
export function childAgeBand(value) {
    if (!isChildExactAge(value))
        return null;
    return value <= 5 ? "3-5" : value <= 8 ? "6-8" : value <= 11 ? "9-11" : value <= 14 ? "12-14" : "15-17";
}
function dataObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value))
        return null;
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null)
        return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const copy = Object.create(null);
    for (const key of Reflect.ownKeys(descriptors)) {
        if (typeof key !== "string")
            return null;
        const descriptor = descriptors[key];
        if (!descriptor.enumerable || !("value" in descriptor))
            return null;
        copy[key] = descriptor.value;
    }
    return copy;
}
function exact(data, fields) {
    return Object.keys(data).length === fields.length && fields.every(key => Object.prototype.hasOwnProperty.call(data, key));
}
function dataArray(value, limit) {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype)
        return null;
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const length = descriptors.length?.value;
    if (typeof length !== "number" || !Number.isSafeInteger(length) || length < 0 || length > limit
        || Reflect.ownKeys(descriptors).length !== length + 1)
        return null;
    const copy = [];
    for (let index = 0; index < length; index++) {
        const descriptor = descriptors[String(index)];
        if (!descriptor || !descriptor.enumerable || !("value" in descriptor))
            return null;
        copy.push(descriptor.value);
    }
    return copy;
}
function identifier(value) {
    return typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,95}$/u.test(value);
}
function topics(value) {
    const items = dataArray(value, 64);
    if (!items || items.some(item => typeof item !== "string" || !/^[a-z0-9][a-z0-9._-]{0,63}$/u.test(item))
        || new Set(items).size !== items.length)
        return null;
    return Object.freeze(items);
}
const profileFields = ["id", "label", "exactAge", "locale", "ageConfirmedAt", "readingLevel", "allowedTopics",
    "blockedTopics", "soundEnabled", "motion", "narrationEnabled"];
function profile(value, now) {
    const data = dataObject(value);
    if (!data || !(exact(data, profileFields) || exact(data, [...profileFields, "ageBand"])) || !identifier(data.id)
        || typeof data.label !== "string" || data.label.length < 1 || data.label.length > 80
        || data.label.trim() !== data.label || /[\u0000-\u001f\u007f]/u.test(data.label)
        || !isChildExactAge(data.exactAge)
        || Object.prototype.hasOwnProperty.call(data, "ageBand") && data.ageBand !== childAgeBand(data.exactAge)
        || data.locale !== "ru" && data.locale !== "en"
        || typeof data.ageConfirmedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(data.ageConfirmedAt)
        || new Date(data.ageConfirmedAt).toISOString() !== data.ageConfirmedAt
        || Date.parse(data.ageConfirmedAt) > now
        || data.readingLevel !== null && data.readingLevel !== "plain" && data.readingLevel !== "developing" && data.readingLevel !== "fluent"
        || typeof data.soundEnabled !== "boolean" || typeof data.narrationEnabled !== "boolean"
        || data.motion !== "calm" && data.motion !== "system")
        return null;
    const blockedTopics = topics(data.blockedTopics);
    const allowedTopics = data.allowedTopics === null ? null : topics(data.allowedTopics);
    if (!blockedTopics || data.allowedTopics !== null && !allowedTopics)
        return null;
    return Object.freeze({ id: data.id, label: data.label, exactAge: data.exactAge, ageBand: childAgeBand(data.exactAge),
        locale: data.locale, ageConfirmedAt: data.ageConfirmedAt, readingLevel: data.readingLevel, allowedTopics, blockedTopics,
        soundEnabled: data.soundEnabled, motion: data.motion, narrationEnabled: data.narrationEnabled });
}
/** Strict restoration seam for future local adapters. Invalid/missing/newer
 * data has no registry; callers must keep startup sealed, never infer adult
 * access. No age-reconfirmation interval or parent verification is invented.
 * IDs are restored unchanged; their generation belongs to a gated create flow.
 * The accepted metadata excludes birth dates, contacts, photos and tracking IDs. */
export function decodeChildProfiles(input, context) {
    const fail = (error) => Object.freeze({ registry: null, error });
    try {
        const environment = dataObject(context);
        if (!environment || !exact(environment, ["policyVersion", "now"]) || !identifier(environment.policyVersion)
            || typeof environment.now !== "number" || !Number.isSafeInteger(environment.now) || environment.now < 0
            || environment.now > 8640000000000000)
            return fail("invalid");
        if (input === null)
            return fail("missing");
        let value = input;
        if (typeof value === "string") {
            if (value.length > CHILD_PROFILE_MAX_LENGTH)
                return fail("invalid");
            value = JSON.parse(value);
        }
        const data = dataObject(value);
        if (!data)
            return fail("invalid");
        if (typeof data.schemaVersion === "number" && Number.isSafeInteger(data.schemaVersion) && data.schemaVersion > 1)
            return fail("unsupported");
        if (!exact(data, ["schemaVersion", "policyVersion", "activeProfileId", "profiles"])
            || data.schemaVersion !== CHILD_PROFILE_SCHEMA_VERSION || !identifier(data.policyVersion))
            return fail("invalid");
        if (data.policyVersion !== environment.policyVersion)
            return fail("policy-mismatch");
        const rows = dataArray(data.profiles, CHILD_PROFILE_LIMIT);
        if (!rows)
            return fail("invalid");
        const profiles = [];
        const ids = new Set();
        for (const row of rows) {
            const parsed = profile(row, environment.now);
            if (!parsed || ids.has(parsed.id))
                return fail("invalid");
            ids.add(parsed.id);
            profiles.push(parsed);
        }
        if (data.activeProfileId !== null && (!identifier(data.activeProfileId) || !ids.has(data.activeProfileId)))
            return fail("invalid");
        const registry = Object.freeze({ schemaVersion: 1, policyVersion: data.policyVersion,
            activeProfileId: data.activeProfileId, profiles: Object.freeze(profiles) });
        return Object.freeze({ registry, error: null });
    }
    catch {
        return fail("invalid");
    }
}
