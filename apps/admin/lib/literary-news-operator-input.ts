export const newsOperatorActions = ["pause", "resume", "bind_remote", "not_sent", "explicitly_close"] as const;
export type NewsOperatorAction = typeof newsOperatorActions[number];
export class NewsOperatorInputError extends Error {}
export function parseNewsOperatorForm(form: FormData) {
  const read = (name: string, max: number) => { const value = form.get(name); if (typeof value !== "string" || value.length > max) throw new NewsOperatorInputError("invalid_input"); return value.trim(); };
  const key = read("key", 400), action = read("operation", 30) as NewsOperatorAction, expected = read("expected_version", 30);
  if (!newsOperatorActions.includes(action) || !/^[1-9]\d{0,18}$/u.test(expected) || BigInt(expected) > 9223372036854775807n) throw new NewsOperatorInputError("invalid_input");
  const destination = /^destination:(telegram|vk):(-[1-9]\d{0,15})$/u.exec(key);
  const post = /^post:news:[A-Za-z0-9_%.-]+:(telegram|vk):(-[1-9]\d{0,15})$/u.exec(key);
  if ((action === "pause" || action === "resume") ? !destination : !post) throw new NewsOperatorInputError("invalid_input");
  const reason = read("reason", 2000);
  if (reason.length < 12) throw new NewsOperatorInputError("reason_required");
  const remoteId = action === "bind_remote" ? read("remote_id", 20) : "";
  const proofUrl = action === "bind_remote" ? read("proof_url", 2048) : "";
  const verified = form.get("verified") === "on";
  if (["bind_remote", "not_sent"].includes(action) && !verified) throw new NewsOperatorInputError("evidence_required");
  if (action === "bind_remote") {
    if (!post || !/^[1-9]\d{0,14}$/u.test(remoteId)) throw new NewsOperatorInputError("invalid_remote");
    const expectedUrl = post[1] === "telegram" && /^-100\d+$/u.test(post[2]) ? `https://t.me/c/${post[2].slice(4)}/${remoteId}` : post[1] === "vk" ? `https://vk.com/wall${post[2]}_${remoteId}` : "";
    if (!expectedUrl || proofUrl !== expectedUrl) throw new NewsOperatorInputError("invalid_remote");
  }
  return { key, action, expectedVersion: expected, reason, remoteId: remoteId || null, proofUrl: proofUrl || null, verified };
}
