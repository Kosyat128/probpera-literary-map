import { BOOKY_GESTURES, type BookyGesture, type BookyInteraction } from "./bookyAnimation";

export type BookySurpriseState = Readonly<{
  remaining: readonly BookyGesture[];
  last: BookyGesture | null;
}>;

/** Local presentation state only. A manual choice can consume its pending slot;
 * a fresh round includes every gesture and avoids the last visible surprise. */
export function pickBookySurprise(state: BookySurpriseState, current: BookyInteraction,
  random: () => number = Math.random): { gesture: BookyGesture; state: BookySurpriseState } {
  let remaining = state.remaining.filter(value => value !== current && value !== state.last);
  if (!remaining.length) {
    remaining = [...BOOKY_GESTURES];
    for (let i = remaining.length - 1; i > 0; i--) {
      const at = Math.floor(random() * (i + 1));
      [remaining[i], remaining[at]] = [remaining[at], remaining[i]];
    }
  }
  const at = remaining.findIndex(value => value !== current && value !== state.last);
  const [gesture] = remaining.splice(at, 1);
  // The caller commits this state only when the presentation action succeeds.
  return { gesture, state: { remaining, last: gesture } };
}
