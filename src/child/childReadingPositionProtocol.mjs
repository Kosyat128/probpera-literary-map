// Explicit reviewed semantic alignment; these data records supply no native admission.
const identifier = value => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u.test(value);
const integer = (value, min, max = Number.MAX_SAFE_INTEGER - 1) => typeof value === "number"
  && Number.isSafeInteger(value) && !Object.is(value, -0) && value >= min && value <= max;
const kinds = new Set(["country", "writer", "biography", "work", "character", "storyworld", "fact", "quote", "activity", "quiz"]);
const text = value => typeof value === "string" && value.length > 0 && value.length <= 32768
  && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value);
function record(value, fields) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
  if (keys.length !== fields.length || keys.some(key => typeof key !== "string" || !fields.includes(key)
    || !descriptors[key].enumerable || !("value" in descriptors[key]))) return null;
  return Object.fromEntries(fields.map(key => [key, descriptors[key].value]));
}
function array(value, maximum) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) return null;
  const descriptors = Object.getOwnPropertyDescriptors(value), length = descriptors.length;
  if (!length || !("value" in length) || !integer(length.value, 0, maximum)
    || Reflect.ownKeys(descriptors).length !== length.value + 1) return null;
  const copy = [];
  for (let index = 0; index < length.value; index++) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) return null;
    copy.push(descriptor.value);
  }
  return copy;
}
function owner(value, checksum) {
  const row = record(value, checksum ? ["kind", "id", "contentChecksum"] : ["kind", "id"]);
  return row && kinds.has(row.kind) && identifier(row.id)
    && (!checksum || typeof row.contentChecksum === "string" && /^[a-f0-9]{64}$/u.test(row.contentChecksum))
    ? Object.freeze({ kind: row.kind, id: row.id }) : null;
}
function anchors(value, expectedText, bindText) {
  const row = record(value, ["schemaVersion", "anchorVersion", "segments", "narration"]);
  const pieces = row && array(row.segments, 128);
  if (!row || row.schemaVersion !== 1 || !integer(row.anchorVersion, 1) || !pieces?.length) return null;
  const segments = [], ids = new Set();
  for (const piece of pieces) {
    const segment = record(piece, ["anchorId", "text"]);
    if (!segment || !identifier(segment.anchorId) || !text(segment.text) || ids.has(segment.anchorId)) return null;
    ids.add(segment.anchorId); segments.push(Object.freeze(segment));
  }
  const joined = segments.map(segment => segment.text).join("");
  if (!text(joined) || bindText && joined !== expectedText) return null;
  let narration = null;
  if (row.narration !== null) {
    const audio = record(row.narration, ["assetId", "sha256", "sampleRate", "frameCount", "cues"]);
    const values = audio && array(audio.cues, 128);
    if (!audio || !identifier(audio.assetId) || typeof audio.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(audio.sha256)
      || !integer(audio.sampleRate, 8000, 48000) || !integer(audio.frameCount, 1, audio.sampleRate * 60)
      || !values || values.length !== segments.length) return null;
    const cues = []; let frame = 0;
    for (let index = 0; index < values.length; index++) {
      const cue = record(values[index], ["anchorId", "startFrame", "endFrame"]);
      if (!cue || cue.anchorId !== segments[index].anchorId || !integer(cue.startFrame, 0, audio.frameCount)
        || !integer(cue.endFrame, 1, audio.frameCount) || cue.startFrame !== frame || cue.endFrame <= cue.startFrame) return null;
      frame = cue.endFrame; cues.push(Object.freeze(cue));
    }
    if (frame !== audio.frameCount) return null;
    narration = Object.freeze({ assetId: audio.assetId, sha256: audio.sha256, sampleRate: audio.sampleRate,
      frameCount: audio.frameCount, cues: Object.freeze(cues) });
  }
  return Object.freeze({ schemaVersion: 1, anchorVersion: row.anchorVersion, segments: Object.freeze(segments), narration });
}
export function decodeReadingAnchors(value, expectedText) {
  try { return typeof expectedText === "string" ? anchors(value, expectedText, true) : null; } catch { return null; }
}
export function decodeReadingPosition(value) {
  try {
    const row = record(value, ["schemaVersion", "entity", "anchorVersion", "anchorId"]), entity = row && owner(row.entity, false);
    return row && row.schemaVersion === 1 && entity && integer(row.anchorVersion, 1) && identifier(row.anchorId)
      ? Object.freeze({ schemaVersion: 1, entity, anchorVersion: row.anchorVersion, anchorId: row.anchorId }) : null;
  } catch { return null; }
}
export function sameReadingPosition(a, b) {
  const first = decodeReadingPosition(a), second = decodeReadingPosition(b);
  return !!first && !!second && first.entity.kind === second.entity.kind && first.entity.id === second.entity.id
    && first.anchorVersion === second.anchorVersion && first.anchorId === second.anchorId;
}
export function decodeNativeReadingPosition(value, profileId, reference, expectedRevision, expectedPosition) {
  try {
    const row = record(value, ["profileId", "revision", "position"]), entity = owner(reference, true);
    const position = row?.position === null ? null : decodeReadingPosition(row?.position);
    if (!row || !identifier(profileId) || row.profileId !== profileId || !integer(row.revision, 0) || !entity
      || row.position !== null && (!position || row.revision === 0 || position.entity.kind !== entity.kind || position.entity.id !== entity.id)
      || expectedRevision !== undefined && (!integer(expectedRevision, 0, Number.MAX_SAFE_INTEGER - 2)
        || row.revision !== expectedRevision + 1 || !sameReadingPosition(position, expectedPosition))) return null;
    return Object.freeze({ profileId, revision: row.revision, position });
  } catch { return null; }
}
export function resolveReadingPosition(position, map, reference) {
  try {
    const saved = decodeReadingPosition(position), aligned = anchors(map, null, false), entity = owner(reference, true);
    if (!saved || !aligned || !entity || saved.entity.kind !== entity.kind || saved.entity.id !== entity.id
      || saved.anchorVersion !== aligned.anchorVersion) return null;
    return aligned.segments.find(segment => segment.anchorId === saved.anchorId) ?? null;
  } catch { return null; }
}
