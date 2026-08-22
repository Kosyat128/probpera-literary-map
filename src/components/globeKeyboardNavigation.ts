export type GlobeDirection = Readonly<{
  x: number;
  y: number;
  z: number;
}>;

export type GlobeKeyboardCandidate<T> = Readonly<{
  id: string;
  name: string;
  value: T;
  direction: GlobeDirection;
  visible: boolean;
  selectable: boolean;
}>;

export type GlobeKeyboardCandidateOptions<T> = Readonly<{
  centreHit?: GlobeKeyboardCandidate<T> | null;
  candidates: ReadonlyArray<GlobeKeyboardCandidate<T>>;
  viewDirection: GlobeDirection;
  maxAngularDistanceRadians?: number;
}>;

export const DEFAULT_KEYBOARD_CANDIDATE_ANGLE_RADIANS = Math.PI / 5;

function normalizedDirection(direction: GlobeDirection) {
  const length = Math.hypot(direction.x, direction.y, direction.z);
  if (!Number.isFinite(length) || length <= Number.EPSILON) return null;
  return {
    x: direction.x / length,
    y: direction.y / length,
    z: direction.z / length,
  };
}

function angularDistance(first: GlobeDirection, second: GlobeDirection) {
  const a = normalizedDirection(first);
  const b = normalizedDirection(second);
  if (!a || !b) return Number.POSITIVE_INFINITY;
  const dot = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z));
  return Math.acos(dot);
}

function isUsableCandidate<T>(candidate: GlobeKeyboardCandidate<T>) {
  return candidate.visible && candidate.selectable;
}

/**
 * Picks the country hit by the view-centre ray first. Over ocean, it falls
 * back only to a selectable front-side country close to the visual centre.
 */
export function selectGlobeKeyboardCandidate<T>({
  centreHit,
  candidates,
  viewDirection,
  maxAngularDistanceRadians = DEFAULT_KEYBOARD_CANDIDATE_ANGLE_RADIANS,
}: GlobeKeyboardCandidateOptions<T>): GlobeKeyboardCandidate<T> | null {
  const normalizedView = normalizedDirection(viewDirection);
  if (!normalizedView) return null;

  if (
    centreHit &&
    isUsableCandidate(centreHit) &&
    angularDistance(centreHit.direction, normalizedView) < Math.PI / 2
  ) {
    return centreHit;
  }

  const threshold = Math.max(
    0,
    Math.min(Math.PI / 2, maxAngularDistanceRadians)
  );
  let nearest: GlobeKeyboardCandidate<T> | null = null;
  let nearestAngle = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    if (!isUsableCandidate(candidate)) continue;
    const angle = angularDistance(candidate.direction, normalizedView);
    if (angle > threshold || angle >= Math.PI / 2) continue;
    if (
      angle < nearestAngle - Number.EPSILON ||
      (Math.abs(angle - nearestAngle) <= Number.EPSILON &&
        candidate.id.localeCompare(nearest?.id ?? "") < 0)
    ) {
      nearest = candidate;
      nearestAngle = angle;
    }
  }

  return nearest;
}

export type GlobeKeyboardCopyLanguage = "ru" | "en";

export function globeKeyboardCandidateAriaCopy({
  countryName,
  writerCount,
  selected = false,
  language = "ru",
}: Readonly<{
  countryName?: string | null;
  writerCount?: number | null;
  selected?: boolean;
  language?: GlobeKeyboardCopyLanguage;
}>) {
  const name = countryName?.trim();
  if (language === "en") {
    if (!name) {
      return "No available country at the globe centre. Use the arrow keys to rotate the globe.";
    }
    const count = Number.isFinite(writerCount)
      ? ` ${Number(writerCount).toLocaleString("en-US")} writers in the archive.`
      : "";
    return selected
      ? `At the globe centre: ${name}.${count} Country selected.`
      : `At the globe centre: ${name}.${count} Press Enter to open the country.`;
  }

  if (!name) {
    return "В центре глобуса нет доступной страны. Поверните глобус клавишами со стрелками.";
  }
  const normalizedWriterCount = Number.isFinite(writerCount)
    ? Math.max(0, Math.trunc(Number(writerCount)))
    : null;
  const writerWord =
    normalizedWriterCount === null
      ? null
      : normalizedWriterCount % 10 === 1 && normalizedWriterCount % 100 !== 11
        ? "автор"
        : [2, 3, 4].includes(normalizedWriterCount % 10) &&
            ![12, 13, 14].includes(normalizedWriterCount % 100)
          ? "автора"
          : "авторов";
  const count =
    normalizedWriterCount === null
      ? ""
      : ` ${normalizedWriterCount.toLocaleString("ru-RU")} ${writerWord} в архиве.`;
  return selected
    ? `В центре глобуса: ${name}.${count} Страна выбрана.`
    : `В центре глобуса: ${name}.${count} Нажмите Enter, чтобы открыть страну.`;
}
