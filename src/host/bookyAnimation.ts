import type { Object3D } from "three";

export type BookyMood = "idle" | "guiding" | "celebrate";
export type BookyInteraction = "rest" | "greeting" | "dragging" | "pointing";
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
};
export const BOOKY_REACTION_MS = 700;
export const BOOKY_LOOK_MS = 160;

export function boundedBookyLook(value?: BookyLook): BookyLook {
  const coordinate = (number: number | undefined) => Number.isFinite(number)
    ? Math.max(-1, Math.min(1, number!)) : 0;
  return { x: coordinate(value?.x), y: coordinate(value?.y) };
}

/** Rebuild each pose from the authored transforms: reactions cannot accumulate
 * drift in the hinged cover, expression or shoulder pivots. */
export function createBookyPose(rig: BookyRig) {
  const members = [...new Set([rig.body, rig.leftArm, rig.rightArm, ...rig.eyes,
    ...rig.pupils, ...rig.brows, rig.mouth, rig.frontCover, rig.bookmark])];
  const rest = members.map(object => ({ object, position: object.position.clone(),
    quaternion: object.quaternion.clone(), scale: object.scale.clone() }));
  return (input: BookyInput, look: BookyLook, reaction: number | null, reducedMotion: boolean) => {
    for (const entry of rest) {
      entry.object.position.copy(entry.position);
      entry.object.quaternion.copy(entry.quaternion);
      entry.object.scale.copy(entry.scale);
    }
    const guiding = input.mood === "guiding" || input.interaction === "pointing";
    const dragging = input.interaction === "dragging", celebrating = input.mood === "celebrate";
    const progress = reaction === null ? 1 : Math.max(0, Math.min(1, reaction));
    const envelope = !reducedMotion && reaction !== null ? Math.sin(Math.PI * progress) ** 2 : 0;
    const wave = envelope * Math.sin(progress * Math.PI * 5);
    rig.body.rotation.y += look.x * .10;
    rig.body.rotation.x += look.y * .025;
    rig.body.rotation.z += dragging ? -.075 * look.x : -.018 * look.x;
    if (celebrating && !reducedMotion) rig.body.position.y += envelope * .05;
    const blink = !reducedMotion && reaction !== null
      ? Math.max(0, 1 - Math.abs(progress - .34) / .09) : 0;
    for (let index = 0; index < 2; index += 1) {
      const pupil = rig.pupils[index];
      pupil.position.x += look.x * .021;
      pupil.position.y -= look.y * .016;
      rig.eyes[index].scale.y *= 1 - blink * .91;
      if (!rig.eyes[index].getObjectById(pupil.id)) pupil.scale.y *= 1 - blink * .91;
      rig.brows[index].position.y += celebrating ? .027 : guiding ? .013 : dragging ? .018 : 0;
      rig.brows[index].rotation.z += (index ? -1 : 1) * (guiding ? .035 : celebrating ? .055 : 0);
    }
    rig.leftArm.rotation.z -= (guiding && look.x <= 0 ? .16 : 0) + envelope * .13 + wave * .055;
    rig.rightArm.rotation.z += (guiding && look.x > 0 ? .13 : 0) + envelope * .075;
    rig.mouth.scale.y *= celebrating ? 1.1 : dragging ? .9 : 1;
    rig.frontCover.rotation.y -= envelope * .095;
    rig.bookmark.rotation.z += wave * .065;
    rig.body.updateMatrixWorld(true);
  };
}
