/** Canonical archive work identities, in the exact owner's reference order. */
export const OWNER_LOCKED_BOOK_KEYS = Object.freeze([
  "england:george_orwell:nineteen-eighty-four",
  "usa:ray_bradbury:fahrenheit-451-editorial",
  "england:h_g_wells:ann-veronica",
  "germany:thomas_mann:buddenbrooks-editorial",
  "russia:tolstoy:war-and-peace",
  "england:william_shakespeare:hamlet",
  "england:david_mitchell:slade-house",
  "france:flaubert:madame-bovary",
  "russia:chekhov:the-lady-with-the-dog",
  "russia:chekhov:the-duel",
  "russia:chekhov:uncle-vanya",
  "england:h_g_wells:the-history-of-mr-polly",
  "england:h_g_wells:when-the-sleeper-wakes",
  "england:david_mitchell:the-bone-clocks",
  "england:david_mitchell:ghostwritten",
  "usa:vladimir_nabokov:lolita-editorial",
  "england:h_g_wells:men-like-gods",
] as const);

const ownerSlots: ReadonlyMap<string, number> = new Map(OWNER_LOCKED_BOOK_KEYS.map((key, slot) => [key, slot]));

/** Identity never depends on translation, current shelf position or quality. */
export function ownerPaletteSlotForBookKey(bookKey: string): number | undefined {
  return ownerSlots.get(bookKey);
}
