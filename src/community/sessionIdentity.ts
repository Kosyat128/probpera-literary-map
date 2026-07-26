const sessionKey = "probpera-session-id";

export function getCommunitySessionId() {
  const existing = window.sessionStorage.getItem(sessionKey);
  if (existing) return existing;
  const created = crypto.randomUUID();
  window.sessionStorage.setItem(sessionKey, created);
  return created;
}
