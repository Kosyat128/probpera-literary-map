export function countryFlag(code?: string) {
  const normalized = code?.trim().toUpperCase();
  if (!normalized || !/^[A-Z]{2}$/.test(normalized)) return "◈";

  return String.fromCodePoint(
    ...normalized
      .split("")
      .map((character) => character.charCodeAt(0) + 127397)
  );
}
