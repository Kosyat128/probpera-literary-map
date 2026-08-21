import { readWebStorage, writeWebStorage } from "../utils/safeWebStorage";

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
  const existing = readWebStorage("local", visitorKey);
  if (existing) return existing;

  const legacy = readWebStorage("session", legacySessionKey);
  const created = legacy || createVisitorId();
  if (!writeWebStorage("local", visitorKey, created)) {
    writeWebStorage("session", legacySessionKey, created);
  }
  return created;
}
