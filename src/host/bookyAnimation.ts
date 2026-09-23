import type { Object3D } from "three";

export type BookyMood = "idle" | "guiding" | "celebrate";
export const BOOKY_GESTURES = ["greeting", "nod", "curious", "happy", "reassuring", "wink", "sway",
  "dance", "hop", "twirl", "stretch", "shy", "highfive"] as const;
export type BookyGesture = typeof BOOKY_GESTURES[number];
export type BookyInteraction = "rest" | "dragging" | "pointing" | "walking" | BookyGesture;
export type BookyLook = Readonly<{ x: number; y: number }>;
export type BookyInput = Readonly<{
  mood: BookyMood;
  interaction: BookyInteraction;
  lookAt: BookyLook;
  reactionKey: number;
  active: boolean;
}>;
type BookyRig = {
  body: Object3D;
  leftArm: Object3D;
  rightArm: Object3D;
  eyes: readonly [Object3D, Object3D];
  pupils: readonly [Object3D, Object3D];
  brows: readonly [Object3D, Object3D];
  mouth: Object3D;
  frontCover: Object3D;
  bookmark: Object3D;
  leftLeg?: Object3D;
  rightLeg?: Object3D;
  leftFoot?: Object3D;
  rightFoot?: Object3D;
};
export const BOOKY_REACTION_MS = 700;
export const BOOKY_LOOK_MS = 160;
export const BOOKY_WALK_MS = 4000;
const GESTURE_DURATION: Readonly<Record<BookyGesture, number>> = {
  greeting: 900, nod: 640, curious: 1000, happy: 800, reassuring: 900, wink: 760, sway: 1100,
  dance: 2200, hop: 1000, twirl: 1400, stretch: 1400, shy: 1100, highfive: 1100,
};

export function bookyReactionDuration(input: Pick<BookyInput, "interaction">): number {
  if (input.interaction === "walking") return BOOKY_WALK_MS;
  return BOOKY_GESTURES.some(value => value === input.interaction)
    ? GESTURE_DURATION[input.interaction as BookyGesture] : BOOKY_REACTION_MS;
}

/** A repeated explicit gesture uses a new key. Tracking, visibility and ordinary
 * state refreshes do not restart a reaction or create an idle animation loop. */
export function hasBookyReactionChanged(previous: BookyInput, next: BookyInput): boolean {
  return previous.reactionKey !== next.reactionKey
    || (previous.mood !== next.mood && next.mood === "celebrate"
      && next.interaction !== "walking" && !BOOKY_GESTURES.some(value => value === next.interaction))
    || (previous.interaction !== next.interaction
      && (next.interaction === "walking" || BOOKY_GESTURES.some(value => value === next.interaction)));
}

export function boundedBookyLook(value?: BookyLook): BookyLook {
  const coordinate = (number: number | undefined) => Number.isFinite(number)
    ? Math.max(-1, Math.min(1, number!)) : 0;
  return { x: coordinate(value?.x), y: coordinate(value?.y) };
}

/** Rebuild each pose from the authored transforms: reactions cannot accumulate
 * drift in the hinged cover, expression or shoulder pivots. Every gesture has
 * a static readable pose, also used when motion is reduced or suspended. */
export function createBookyPose(rig: BookyRig) {
  const members = [...new Set([rig.body, rig.leftArm, rig.rightArm, ...rig.eyes,
    ...rig.pupils, ...rig.brows, rig.mouth, rig.frontCover, rig.bookmark,
    rig.leftLeg, rig.rightLeg, rig.leftFoot, rig.rightFoot].filter((object): object is Object3D => Boolean(object)))];
  const rest = members.map(object => ({ object, position: object.position.clone(),
    quaternion: object.quaternion.clone(), scale: object.scale.clone() }));
  return (input: BookyInput, targetLook: BookyLook, reaction: number | null, reducedMotion: boolean) => {
    for (const entry of rest) {
      entry.object.position.copy(entry.position);
      entry.object.quaternion.copy(entry.quaternion);
      entry.object.scale.copy(entry.scale);
    }
    const look = boundedBookyLook(targetLook);
    const walking = input.interaction === "walking";
    const explicitGesture = walking || BOOKY_GESTURES.some(value => value === input.interaction);
    const guiding = (!explicitGesture && input.mood === "guiding") || input.interaction === "pointing";
    const dragging = input.interaction === "dragging";
    const greeting = input.interaction === "greeting", nod = input.interaction === "nod";
    const wink = input.interaction === "wink", sway = input.interaction === "sway";
    const curious = input.interaction === "curious", reassuring = input.interaction === "reassuring";
    const celebrating = (!explicitGesture && input.mood === "celebrate") || input.interaction === "happy";
    const animated = !reducedMotion && reaction !== null && Number.isFinite(reaction);
    const progress = animated ? Math.max(0, Math.min(1, reaction!)) : 1;
    const envelope = animated && progress > 0 && progress < 1 ? Math.sin(Math.PI * progress) ** 2 : 0;
    const wave = envelope * Math.sin(progress * Math.PI * 5);
    const doubleNod = envelope * Math.sin(progress * Math.PI * 4);
    // Four alternating step pairs within one bounded walk; edges settle exactly.
    const walkFade = walking && animated && progress > 0 && progress < 1
      ? Math.min(1, progress * 12, (1 - progress) * 12) : 0;
    const stride = walkFade * Math.sin(progress * Math.PI * 8);
    if (walking && stride !== 0) {
      if (rig.leftLeg) { rig.leftLeg.rotation.x += stride * .12; rig.leftLeg.position.y += Math.max(0, stride) * .025; }
      if (rig.rightLeg) { rig.rightLeg.rotation.x -= stride * .12; rig.rightLeg.position.y += Math.max(0, -stride) * .025; }
      if (rig.leftFoot) rig.leftFoot.rotation.x -= stride * .08;
      if (rig.rightFoot) rig.rightFoot.rotation.x += stride * .08;
      rig.body.position.y += Math.abs(stride) * .014;
      rig.body.rotation.z += stride * .012;
      rig.leftArm.rotation.z += stride * .035;
      rig.rightArm.rotation.z -= stride * .02;
    }
    const inspect = envelope * Math.sin(progress * Math.PI * 2);
    const rocking = envelope * Math.sin(progress * Math.PI * 4);
    rig.body.rotation.y += look.x * (curious ? .05 : sway ? .085 : .10)
      + (curious ? .035 + inspect * .009 : sway ? rocking * .012 : 0);
    rig.body.rotation.x += look.y * .025 + (nod ? .045 + doubleNod * .105 : reassuring ? .025 : 0);
    rig.body.rotation.z += dragging ? -.075 * look.x : -.018 * look.x;
    if (greeting) rig.body.rotation.z += .025 + wave * .012;
    if (curious) rig.body.rotation.z += -.030 - envelope * .005 + inspect * .006;
    if (wink) rig.body.rotation.z += .022;
    if (sway) {
      rig.body.rotation.z += -.008 + rocking * .028;
      rig.leftArm.rotation.z += rocking * .045;
      rig.rightArm.rotation.z -= rocking * .015;
    }
    if (reassuring) rig.body.rotation.z -= .025;
    if (celebrating) {
      rig.body.position.y += envelope * .035;
      rig.body.rotation.z += wave * .02;
    }
    const blink = animated && !wink ? Math.max(0, 1 - Math.abs(progress - .34) / (walking ? .018 : .09)) : 0;
    const winkPhase = Math.max(0, Math.min(1, (progress - .2) / .6));
    const winkClose = wink ? reducedMotion ? .62
      : animated && winkPhase > 0 && winkPhase < 1 ? Math.sin(winkPhase * Math.PI) ** 2 : 0 : 0;
    for (let index = 0; index < 2; index += 1) {
      const pupil = rig.pupils[index], eye = rig.eyes[index];
      pupil.position.x += curious ? .020 + look.x * .004 + inspect * .005 : look.x * .021;
      pupil.position.y += curious ? .009 - look.y * .004 + inspect * .003 : -look.y * .016 - (nod ? .005 : 0);
      const lid = index === 0 && wink ? 1 - winkClose * .93 : 1 - blink * .91;
      eye.scale.y *= (curious ? 1.035 : reassuring ? .96 : 1) * lid;
      if (!eye.getObjectById(pupil.id)) pupil.scale.y *= lid;
      rig.brows[index].position.y += curious ? (index ? .006 : .04)
        : wink ? (index ? .010 : .023) : celebrating ? .027 : guiding || greeting ? .013 : dragging ? .018 : reassuring ? .008 : 0;
      rig.brows[index].rotation.z += curious ? (index ? -.025 : .065)
        : (index ? -1 : 1) * (guiding ? .035 : celebrating ? .055 : reassuring ? -.035 : 0);
    }
    // The magnifier belongs to the right shoulder. Keep it clear of the face;
    // the open left hand supplies the larger greeting and reassuring motion.
    rig.leftArm.rotation.z -= (guiding && look.x <= 0 ? .16 : 0)
      + (greeting ? .28 + wave * .16 : reassuring ? .10 + envelope * .035
        : celebrating ? .16 + envelope * .075 : curious ? .035 : 0);
    rig.rightArm.rotation.z += curious ? .11 + envelope * .025 + inspect * .012
      : celebrating ? .065 + envelope * .025 : guiding && look.x > 0 ? .13 : 0;
    rig.mouth.scale.x *= reassuring || celebrating ? 1.045 : wink ? 1.035 : curious ? .94 : 1;
    rig.mouth.scale.y *= celebrating ? 1.13 : wink ? 1.04 : reassuring ? .84 : curious ? .82 : dragging ? .9 : 1;
    rig.frontCover.rotation.y -= envelope * (greeting ? .065 : curious ? .045 : .035);
    rig.bookmark.rotation.z += wave * (celebrating ? .08 : greeting ? .065 : .035);
    // Longer explicit expressions settle back to the authored tracking pose.
    // Reduced motion instead presents one readable pose without elapsed motion.
    // The lens and its gripping hand remain one rigid right-arm assembly.
    const expression = reducedMotion ? 1 : envelope;
    if (expression > 0) {
      const dance = input.interaction === "dance", hop = input.interaction === "hop";
      const twirl = input.interaction === "twirl", stretch = input.interaction === "stretch";
      const shy = input.interaction === "shy", highfive = input.interaction === "highfive";
      if (dance || hop || twirl || stretch || shy || highfive) {
        rig.body.rotation.y -= look.x * .06 * expression;
      }
      if (dance) {
        const beat = reducedMotion ? .6 : Math.sin(progress * Math.PI * 6);
        const side = expression * beat;
        rig.body.rotation.z += side * .039;
        rig.body.rotation.y += expression * (reducedMotion ? .02 : Math.cos(progress * Math.PI * 6) * .04);
        rig.body.position.y += expression * (.008 + Math.abs(beat) * .008);
        rig.leftArm.rotation.z -= expression * (.13 + beat * .075);
        rig.rightArm.rotation.z += expression * (.045 - beat * .020);
        if (rig.leftLeg) { rig.leftLeg.rotation.x += side * .075; rig.leftLeg.rotation.z += side * .065; rig.leftLeg.position.y += expression * Math.max(0, beat) * .015; }
        if (rig.rightLeg) { rig.rightLeg.rotation.x -= side * .075; rig.rightLeg.rotation.z -= side * .065; rig.rightLeg.position.y += expression * Math.max(0, -beat) * .015; }
        if (rig.leftFoot) rig.leftFoot.rotation.x -= side * .06;
        if (rig.rightFoot) rig.rightFoot.rotation.x += side * .06;
        rig.mouth.scale.y *= 1 + expression * .14;
      }
      if (hop) {
        // A small jump within the existing canvas; reduced motion shows its
        // bent-leg preparation without lifting the character off its baseline.
        rig.body.position.y += reducedMotion ? 0 : expression * .06;
        rig.body.rotation.x -= expression * .035;
        rig.leftArm.rotation.z -= expression * .12;
        if (rig.leftLeg) rig.leftLeg.rotation.x += expression * .10;
        if (rig.rightLeg) rig.rightLeg.rotation.x += expression * .10;
        if (rig.leftFoot) rig.leftFoot.rotation.x -= expression * .07;
        if (rig.rightFoot) rig.rightFoot.rotation.x -= expression * .07;
        for (const eye of rig.eyes) eye.scale.y *= 1 + expression * .045;
        rig.mouth.scale.y *= 1 + expression * .10;
      }
      if (twirl) {
        const turn = reducedMotion ? .055 : Math.PI * 2 * progress * progress * (3 - 2 * progress);
        rig.body.rotation.y += turn;
        rig.leftArm.rotation.z -= expression * .13;
        rig.mouth.scale.x *= 1 + expression * .035;
      }
      if (stretch) {
        rig.body.scale.y *= 1 + expression * .035;
        rig.body.position.y += expression * .007;
        rig.body.rotation.z -= expression * .020;
        rig.leftArm.rotation.z -= expression * .48;
        rig.rightArm.rotation.z += expression * .055;
        for (const brow of rig.brows) brow.position.y += expression * .020;
        rig.mouth.scale.y *= 1 - expression * .12;
      }
      if (shy) {
        rig.body.rotation.x += expression * .065;
        rig.body.rotation.y -= expression * .05;
        rig.body.rotation.z -= expression * .026;
        rig.body.position.y -= expression * .012;
        rig.leftArm.rotation.z += expression * .16;
        for (let index = 0; index < 2; index += 1) {
          rig.pupils[index].position.x -= expression * (.015 + look.x * .010);
          rig.pupils[index].position.y -= expression * (.010 - look.y * .010);
          rig.eyes[index].scale.y *= 1 - expression * .11;
          rig.brows[index].rotation.z += (index ? 1 : -1) * expression * .05;
        }
        rig.mouth.scale.x *= 1 - expression * .10;
        rig.mouth.scale.y *= 1 - expression * .13;
      }
      if (highfive) {
        rig.leftArm.rotation.z -= expression * .92;
        rig.body.rotation.z += expression * .020;
        for (const brow of rig.brows) brow.position.y += expression * .018;
        rig.mouth.scale.x *= 1 + expression * .055;
        rig.mouth.scale.y *= 1 + expression * .06;
      }
    }
    rig.body.updateMatrixWorld(true);
  };
}
