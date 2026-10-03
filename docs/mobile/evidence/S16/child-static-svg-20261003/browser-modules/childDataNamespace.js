import { isChildExactAge } from "./childProfile.js";
export const CHILD_DATA_PURPOSES = Object.freeze([
    "search", "cache", "history", "favorites", "offline", "recommendations", "narration", "themes",
]);
const fields = ["schemaVersion", "namespace", "profileId", "profileRevision", "exactAge", "locale", "policyVersion",
    "policyChecksum", "packageId", "packageVersion", "packageChecksum"];
const purposes = new Set(CHILD_DATA_PURPOSES);
const identifier = (value) => typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,95}$/u.test(value);
const revision = (value) => typeof value === "number" && Number.isSafeInteger(value) && value >= 1;
const checksum = (value) => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
/**
 * Strict metadata projection for a future trusted child-only storage/index
 * adapter. No strings, getters, inherited fields or approval flags are accepted.
 * Child package signature, review, rights, exact-age eligibility and startup
 * admission must be established separately; a successful decode grants none.
 */
export function decodeChildDataScope(input) {
    try {
        if (!input || typeof input !== "object" || Array.isArray(input))
            return null;
        const prototype = Object.getPrototypeOf(input);
        if (prototype !== Object.prototype && prototype !== null)
            return null;
        const descriptors = Object.getOwnPropertyDescriptors(input), keys = Reflect.ownKeys(descriptors);
        if (keys.length !== fields.length || keys.some(key => typeof key !== "string" || !fields.includes(key)
            || !descriptors[key].enumerable || !("value" in descriptors[key])))
            return null;
        const data = Object.create(null);
        for (const field of fields)
            data[field] = descriptors[field].value;
        if (data.schemaVersion !== 1 || data.namespace !== "child" || !identifier(data.profileId) || !revision(data.profileRevision)
            || !isChildExactAge(data.exactAge) || data.locale !== "ru" && data.locale !== "en"
            || !identifier(data.policyVersion) || !checksum(data.policyChecksum) || !identifier(data.packageId)
            || !revision(data.packageVersion) || !checksum(data.packageChecksum))
            return null;
        return Object.freeze(data);
    }
    catch {
        return null;
    }
}
/** Full immutable scope comparison for publication fencing; never compare only age bands or a package name. */
export function sameChildDataScope(a, b) {
    const left = decodeChildDataScope(a), right = decodeChildDataScope(b);
    return left !== null && right !== null && fields.every(field => left[field] === right[field]);
}
/**
 * Opaque child key, not an OS path or an authorization receipt. The fixed tuple
 * is encoded losslessly in lowercase hexadecimal, avoiding concatenation,
 * separator, case-folding and Unicode-normalization aliases. No hash collision
 * assumption is needed; checksums are explicit identity coordinates only.
 * This module reads nothing and has no adult source or fallback. Future host
 * code must atomically retire old references on scope change and check its own
 * operation generation before publishing results. It must use a separately
 * verified child-only source, never retrieve an adult index and filter it later.
 */
export function childDataNamespace(input, purpose) {
    if (typeof purpose !== "string" || !purposes.has(purpose))
        return null;
    const scope = decodeChildDataScope(input);
    if (!scope)
        return null;
    const tuple = JSON.stringify([scope.schemaVersion, scope.namespace, scope.profileId, scope.profileRevision, scope.exactAge,
        scope.locale, scope.policyVersion, scope.policyChecksum, scope.packageId, scope.packageVersion, scope.packageChecksum]);
    // Every accepted coordinate and JSON delimiter is ASCII; no locale folding.
    let encoded = "";
    for (let index = 0; index < tuple.length; index += 1)
        encoded += tuple.charCodeAt(index).toString(16).padStart(2, "0");
    return `probpera-child-v1/${purpose}/${encoded}`;
}
