const visitorKey = "probpera-visitor-id";
const legacySessionKey = "probpera-session-id";

function createVisitorId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (symbol) => {
    const random = Math.floor(Math.random() * 16);
    const value = symbol === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function getCommunitySessionId() {
  try {
    const existing = window.localStorage.getItem(visitorKey);
    if (existing) return existing;
    const legacy = window.sessionStorage.getItem(legacySessionKey);
    const created = legacy || createVisitorId();
    window.localStorage.setItem(visitorKey, created);
    return created;
  } catch {
    const existing = window.sessionStorage.getItem(legacySessionKey);
    if (existing) return existing;
    const created = createVisitorId();
    window.sessionStorage.setItem(legacySessionKey, created);
    return created;
  }
}
