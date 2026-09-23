import { describe, expect, it } from "vitest";
import { Box3, Mesh, Object3D, OrthographicCamera, Vector3 } from "three";
import { BOOKY_GESTURES, BOOKY_WALK_MS, bookyReactionDuration, boundedBookyLook, createBookyPose,
  hasBookyReactionChanged, type BookyInput } from "./bookyAnimation";
import { createBookyModel } from "./bookyModel";

const neutral: BookyInput = { mood: "idle", interaction: "rest", lookAt: { x: 0, y: 0 }, reactionKey: 0, active: true };
const newGestures = ["dance", "hop", "twirl", "stretch", "shy", "highfive"] as const;
function fixture() {
  const body = new Object3D(), leftArm = new Object3D(), rightArm = new Object3D();
  const eyes = [new Object3D(), new Object3D()] as const;
  const pupils = [new Object3D(), new Object3D()] as const;
  const brows = [new Object3D(), new Object3D()] as const;
  const mouth = new Object3D(), frontCover = new Object3D(), bookmark = new Object3D();
  const leftLeg = new Object3D(), rightLeg = new Object3D(), leftFoot = new Object3D(), rightFoot = new Object3D();
  body.add(leftLeg, rightLeg); leftLeg.add(leftFoot); rightLeg.add(rightFoot);
  body.add(leftArm, rightArm, frontCover, bookmark); frontCover.add(...eyes, ...brows, mouth);
  eyes.forEach((eye, index) => eye.add(pupils[index]));
  const rig = { body, leftArm, rightArm, eyes, pupils, brows, mouth, frontCover, bookmark, leftLeg, rightLeg, leftFoot, rightFoot };
  const members = [body, leftArm, rightArm, ...eyes, ...pupils, ...brows, mouth, frontCover, bookmark, leftLeg, rightLeg, leftFoot, rightFoot];
  const snapshot = () => members.flatMap(item => [...item.position.toArray(), ...item.quaternion.toArray(), ...item.scale.toArray()]);
  return { rig, members, snapshot, pose: createBookyPose(rig) };
}

// These checks verify deterministic rig motion, not art approval or GPU/camera framing.
describe("Booky's finite explicit gestures", () => {
  it("keeps all thirteen reduced-motion gestures distinct from each other and from rest", () => {
    const { pose, snapshot } = fixture(), signatures: string[] = [];
    for (const interaction of ["rest", ...BOOKY_GESTURES] as const) {
      pose({ ...neutral, interaction }, neutral.lookAt, null, true);
      signatures.push(JSON.stringify(snapshot()));
    }
    expect(new Set(signatures).size).toBe(14);
  });

  it("waves the open hand, nods the book, raises the lens and celebrates without conflating gestures", () => {
    const { rig, pose } = fixture();
    pose({ ...neutral, interaction: "greeting" }, neutral.lookAt, .3, false);
    const firstWave = rig.leftArm.rotation.z;
    pose({ ...neutral, interaction: "greeting" }, neutral.lookAt, .5, false);
    expect(Math.abs(rig.leftArm.rotation.z - firstWave)).toBeGreaterThan(.1);
    expect(rig.rightArm.rotation.z).toBe(0);
    pose({ ...neutral, interaction: "nod" }, neutral.lookAt, .3, false);
    const firstNod = rig.body.rotation.x;
    pose({ ...neutral, interaction: "nod" }, neutral.lookAt, .6, false);
    expect(Math.abs(rig.body.rotation.x - firstNod)).toBeGreaterThan(.05);
    expect(rig.leftArm.rotation.z).toBeCloseTo(0, 12);
    pose({ ...neutral, interaction: "curious" }, neutral.lookAt, .5, false);
    expect(rig.rightArm.rotation.z).toBeGreaterThan(.1);
    expect(rig.brows[0].position.y).toBeGreaterThan(rig.brows[1].position.y);
    pose({ ...neutral, interaction: "happy" }, neutral.lookAt, .5, false);
    expect(rig.body.position.y).toBeGreaterThan(0);
    expect(rig.mouth.scale.y).toBeGreaterThan(1);
    pose({ ...neutral, interaction: "reassuring" }, neutral.lookAt, .5, false);
    expect(rig.body.position.y).toBe(0);
    expect(rig.mouth.scale.x).toBeGreaterThan(1);
    expect(rig.mouth.scale.y).toBeLessThan(1);
  });

  it("returns exactly to the static gesture at its endpoints and never accumulates authored-transform drift", () => {
    const { rig, members } = fixture();
    members.forEach((item, index) => { item.position.set(index / 30, -index / 50, index / 60); item.rotation.set(.02, -.01, .03); item.scale.set(1, .95, 1.05); });
    const pose = createBookyPose(rig);
    const snapshot = () => members.flatMap(item => [...item.position.toArray(), ...item.quaternion.toArray(), ...item.scale.toArray()]);
    for (const interaction of BOOKY_GESTURES) {
      const input = { ...neutral, interaction }, look = { x: -.4, y: .3 };
      pose(input, look, null, false); const settled = snapshot();
      for (const phase of [0, 1, 2, -1]) { pose(input, look, phase, false); expect(snapshot()).toEqual(settled); }
      for (let repeat = 0; repeat < 20; repeat++) {
        pose({ ...neutral, interaction: "greeting" }, { x: 1, y: -1 }, .34, false);
        pose(input, look, .52, false); pose(input, look, null, false);
        expect(snapshot()).toEqual(settled);
      }
    }
  });

  it.each(BOOKY_GESTURES)("%s is motionless under reduced motion, including finite reaction endpoints", interaction => {
    const { pose, snapshot, rig } = fixture(), input = { ...neutral, interaction };
    pose(input, neutral.lookAt, null, true); const expected = snapshot();
    for (const phase of [0, .13, .34, .55, .8, 1]) {
      pose(input, neutral.lookAt, phase, true); expect(snapshot()).toEqual(expected);
      expect(rig.frontCover.rotation.y).toBe(0); expect(rig.bookmark.rotation.z).toBe(0);
    }
    expect(bookyReactionDuration(input)).toBeGreaterThanOrEqual(600);
    expect(bookyReactionDuration(input)).toBeLessThanOrEqual(2400);
  });

  it("keeps invalid elapsed samples and pointer coordinates out of rig transforms", () => {
    const { pose, snapshot } = fixture();
    for (const interaction of BOOKY_GESTURES) {
      const input = { ...neutral, interaction };
      pose(input, neutral.lookAt, null, false); const expected = snapshot();
      for (const phase of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
        pose(input, { x: Number.NaN, y: Number.POSITIVE_INFINITY }, phase, false);
        expect(snapshot()).toEqual(expected); expect(snapshot().every(Number.isFinite)).toBe(true);
      }
    }
    expect(boundedBookyLook({ x: 7, y: -8 })).toEqual({ x: 1, y: -1 });
  });

  it("replays an explicit repeated key without restarting on tracking, visibility or unchanged context", () => {
    const greeting: BookyInput = { ...neutral, interaction: "greeting", reactionKey: 1 };
    expect(hasBookyReactionChanged(neutral, greeting)).toBe(true);
    expect(hasBookyReactionChanged(greeting, { ...greeting, reactionKey: 2 })).toBe(true);
    expect(hasBookyReactionChanged(greeting, { ...greeting, interaction: "curious" })).toBe(true);
    expect(hasBookyReactionChanged(greeting, { ...greeting, active: false, lookAt: { x: 1, y: 1 } })).toBe(false);
    expect(hasBookyReactionChanged(greeting, { ...greeting, interaction: "dragging" })).toBe(false);
    expect(hasBookyReactionChanged(greeting, { ...greeting, mood: "celebrate" })).toBe(false);
    expect(hasBookyReactionChanged(neutral, { ...neutral, mood: "guiding" })).toBe(false);
    expect(hasBookyReactionChanged(neutral, { ...neutral, mood: "celebrate" })).toBe(true);
  });

  it("lets explicit gestures override contextual mood while preserving legacy guiding and celebration poses", () => {
    const { rig, pose, snapshot } = fixture();
    for (const interaction of BOOKY_GESTURES) {
      const input = { ...neutral, interaction };
      pose(input, neutral.lookAt, .5, false); const explicit = snapshot();
      for (const mood of ["guiding", "celebrate"] as const) { pose({ ...input, mood }, neutral.lookAt, .5, false); expect(snapshot()).toEqual(explicit); }
    }
    pose({ ...neutral, mood: "guiding" }, { x: -1, y: 0 }, null, false); expect(rig.leftArm.rotation.z).toBeLessThan(0);
    pose({ ...neutral, mood: "guiding" }, { x: 1, y: 0 }, null, false); expect(rig.rightArm.rotation.z).toBeGreaterThan(0);
    pose({ ...neutral, mood: "celebrate" }, neutral.lookAt, .5, false); expect(rig.body.position.y).toBeGreaterThan(0);
  });

  it("keeps the lens shoulder, cover hinge and body tilt inside the shared geometry motion budget", () => {
    const { rig, pose } = fixture();
    for (const interaction of BOOKY_GESTURES.slice(0, 7)) for (const x of [-1, 0, 1]) for (let frame = 0; frame <= 100; frame++) {
      pose({ ...neutral, interaction }, { x, y: 0 }, frame / 100, false);
      expect(rig.rightArm.rotation.z).toBeGreaterThanOrEqual(-.06);
      expect(rig.rightArm.rotation.z).toBeLessThanOrEqual(.16);
      expect(Math.abs(rig.body.rotation.z)).toBeLessThanOrEqual(.060001);
      expect(Math.abs(rig.body.rotation.y)).toBeLessThanOrEqual(.100001);
      expect(rig.frontCover.rotation.y).toBeGreaterThanOrEqual(-.10);
      expect(rig.body.position.y).toBeLessThanOrEqual(.035001);
    }
  });
  it("walks with opposite hip and ankle phases and restores every limb immediately on stop", () => {
    const { pose, snapshot, rig } = fixture();
    pose(neutral, neutral.lookAt, null, false); const rest = snapshot();
    const walking: BookyInput = { ...neutral, interaction: "walking", reactionKey: 1 };
    pose(walking, neutral.lookAt, .28125, false);
    const left = rig.leftLeg.rotation.x, right = rig.rightLeg.rotation.x;
    expect(left).toBeGreaterThan(.08); expect(right).toBeLessThan(-.08);
    expect(rig.leftFoot.rotation.x).toBeLessThan(0); expect(rig.rightFoot.rotation.x).toBeGreaterThan(0);
    expect(rig.body.position.y).toBeGreaterThan(0);
    pose(walking, neutral.lookAt, .40625, false);
    expect(rig.leftLeg.rotation.x).toBeLessThan(-.08); expect(rig.rightLeg.rotation.x).toBeGreaterThan(.08);
    for (const phase of [0, 1, 1.1, null]) { pose(walking, neutral.lookAt, phase, false); expect(snapshot()).toEqual(rest); }
    pose(walking, neutral.lookAt, .28125, false);
    pose({ ...walking, interaction: "rest" }, neutral.lookAt, null, false); expect(snapshot()).toEqual(rest);
    expect(hasBookyReactionChanged(walking, { ...walking, interaction: "rest" })).toBe(false);
  });

  it("bounds walking to four seconds, excludes it from reaction buttons and removes all steps under reduced motion", () => {
    const { pose, snapshot } = fixture(), walking: BookyInput = { ...neutral, interaction: "walking" };
    expect(BOOKY_GESTURES).toHaveLength(13); expect(BOOKY_GESTURES).not.toContain("walking");
    expect(BOOKY_WALK_MS).toBeLessThanOrEqual(4000); expect(bookyReactionDuration(walking)).toBe(BOOKY_WALK_MS);
    expect(hasBookyReactionChanged(neutral, walking)).toBe(true);
    expect(hasBookyReactionChanged(walking, { ...walking, mood: "celebrate" })).toBe(false);
    pose(neutral, neutral.lookAt, null, true); const rest = snapshot();
    for (const phase of [0, .125, .28125, .34, .40625, .75, 1]) { pose(walking, neutral.lookAt, phase, true); expect(snapshot()).toEqual(rest); }
  });

  it("winks with one eye while the other remains open and restores that eye after the finite motion", () => {
    const { pose, rig } = fixture(), input: BookyInput = { ...neutral, interaction: "wink" };
    for (const phase of [0, .2, .8, 1, null]) {
      pose(input, neutral.lookAt, phase, false); expect(rig.eyes[0].scale.y).toBeCloseTo(1, 12); expect(rig.eyes[1].scale.y).toBe(1);
    }
    pose(input, neutral.lookAt, .5, false);
    expect(rig.eyes[0].scale.y).toBeLessThan(.1); expect(rig.eyes[1].scale.y).toBe(1);
    expect(rig.pupils[0].scale.y).toBe(1); // The child inherits its eye's closure once.
    pose(input, neutral.lookAt, .34, true);
    expect(rig.eyes[0].scale.y).toBeGreaterThan(.2); expect(rig.eyes[0].scale.y).toBeLessThan(.5); expect(rig.eyes[1].scale.y).toBe(1);
  });

  it("rocks gently to both sides with stationary legs instead of turning sway into walking", () => {
    const { pose, rig } = fixture(), input: BookyInput = { ...neutral, interaction: "sway" };
    const limbs = [rig.leftLeg, rig.rightLeg, rig.leftFoot, rig.rightFoot];
    pose(input, neutral.lookAt, .375, false); expect(rig.body.rotation.z).toBeLessThan(0);
    pose(input, neutral.lookAt, .625, false); expect(rig.body.rotation.z).toBeGreaterThan(0);
    for (const phase of [.125, .375, .625, .875]) {
      pose(input, neutral.lookAt, phase, false);
      expect(rig.body.position.y).toBe(0);
      for (const limb of limbs) { expect(limb.position.toArray()).toEqual([0, 0, 0]); expect(limb.quaternion.toArray()).toEqual([0, 0, 0, 1]); }
    }
  });

  it("inspects the raised magnifier with a directional gaze and a small reversible arm scan", () => {
    const { pose, rig } = fixture(), input: BookyInput = { ...neutral, interaction: "curious" };
    pose(input, { x: -1, y: 1 }, .25, false); const shoulder = rig.rightArm.rotation.z, gaze = rig.pupils[0].position.x;
    expect(gaze).toBeGreaterThan(0); expect(rig.pupils[0].position.y).toBeGreaterThan(0);
    pose(input, { x: -1, y: 1 }, .75, false);
    expect(rig.rightArm.rotation.z).toBeLessThan(shoulder); expect(rig.pupils[0].position.x).toBeLessThan(gaze);
    expect(rig.pupils[0].position.x).toBeGreaterThan(0); expect(rig.rightArm.rotation.z).toBeLessThan(.16);
  });

  it("preserves the seven established timings while bounding all six additional reactions", () => {
    expect(BOOKY_GESTURES.slice(0, 7)).toEqual(["greeting", "nod", "curious", "happy", "reassuring", "wink", "sway"]);
    expect(BOOKY_GESTURES.slice(0, 7).map(interaction => bookyReactionDuration({ interaction })))
      .toEqual([900, 640, 1000, 800, 900, 760, 1100]);
    expect(BOOKY_GESTURES.slice(7)).toEqual(newGestures);
    expect(newGestures.map(interaction => bookyReactionDuration({ interaction })))
      .toEqual([2200, 1000, 1400, 1400, 1100, 1100]);
  });

  it("dances in place with alternate feet and a body rhythm distinct from walking and a hop", () => {
    const { rig, pose } = fixture(), input: BookyInput = { ...neutral, interaction: "dance" };
    pose(input, neutral.lookAt, .25, false);
    expect(rig.leftLeg.rotation.x).toBeLessThan(0); expect(rig.rightLeg.rotation.x).toBeGreaterThan(0);
    expect(rig.leftFoot.rotation.x).toBeGreaterThan(0); expect(rig.rightFoot.rotation.x).toBeLessThan(0);
    expect(rig.body.rotation.z).toBeLessThan(0);
    pose(input, neutral.lookAt, .75, false);
    expect(rig.leftLeg.rotation.x).toBeGreaterThan(0); expect(rig.rightLeg.rotation.x).toBeLessThan(0);
    expect(rig.body.rotation.z).toBeGreaterThan(0);
    expect(rig.body.position.x).toBe(0); expect(rig.body.position.z).toBe(0);
    expect(rig.mouth.scale.y).toBeGreaterThan(1);
  });

  it("hops with both bent legs together then lands exactly, with no lift under reduced motion", () => {
    const { rig, pose, snapshot } = fixture(), input: BookyInput = { ...neutral, interaction: "hop" };
    pose(neutral, neutral.lookAt, null, false); const rest = snapshot();
    pose(input, neutral.lookAt, .5, false);
    expect(rig.body.position.y).toBeCloseTo(.06, 12);
    expect(rig.leftLeg.rotation.x).toBeGreaterThan(0); expect(rig.rightLeg.rotation.x).toBe(rig.leftLeg.rotation.x);
    expect(rig.leftFoot.rotation.x).toBeLessThan(0); expect(rig.rightFoot.rotation.x).toBe(rig.leftFoot.rotation.x);
    pose(input, neutral.lookAt, 1, false); expect(snapshot()).toEqual(rest);
    pose(input, neutral.lookAt, .5, true); expect(rig.body.position.y).toBe(0);
    expect(rig.leftLeg.rotation.x).toBeGreaterThan(0);
  });

  it("twirls through one full forward turn with smooth endpoints and a small static reduced pose", () => {
    const { rig, pose, snapshot } = fixture(), input: BookyInput = { ...neutral, interaction: "twirl" };
    pose(neutral, neutral.lookAt, null, false); const rest = snapshot();
    let previous = 0;
    for (let sample = 1; sample < 100; sample += 1) {
      pose(input, neutral.lookAt, sample / 100, false);
      expect(rig.body.rotation.y).toBeGreaterThan(previous);
      previous = rig.body.rotation.y;
    }
    expect(previous).toBeGreaterThan(Math.PI * 1.99);
    pose(input, neutral.lookAt, .5, false); expect(rig.body.rotation.y).toBeCloseTo(Math.PI, 12);
    pose(input, neutral.lookAt, 1, false); expect(snapshot()).toEqual(rest);
    pose(input, neutral.lookAt, .5, true); expect(rig.body.rotation.y).toBeCloseTo(.055, 12);
  });

  it("stretches the body and free arm, while shyness looks down and softens the face", () => {
    const { rig, pose } = fixture();
    pose({ ...neutral, interaction: "stretch" }, neutral.lookAt, .5, false);
    expect(rig.body.scale.y).toBeGreaterThan(1.03); expect(rig.leftArm.rotation.z).toBeLessThan(-.4);
    expect(rig.rightArm.rotation.z).toBeLessThan(.06);
    pose({ ...neutral, interaction: "shy" }, neutral.lookAt, .5, false);
    expect(rig.body.rotation.x).toBeGreaterThan(.06); expect(rig.body.rotation.y).toBeLessThan(0);
    for (const pupil of rig.pupils) { expect(pupil.position.x).toBeLessThan(0); expect(pupil.position.y).toBeLessThan(0); }
    expect(rig.eyes[0].scale.y).toBeLessThan(1); expect(rig.mouth.scale.x).toBeLessThan(1);
    for (const x of [-1, 1]) for (const y of [-1, 1]) {
      pose({ ...neutral, interaction: "shy" }, { x, y }, .5, false);
      for (const pupil of rig.pupils) { expect(pupil.position.x).toBeLessThan(0); expect(pupil.position.y).toBeLessThan(0); }
    }
  });

  it("high-fives with the open left hand while preserving every local magnifier-arm transform", () => {
    const { rig, pose } = fixture(), input: BookyInput = { ...neutral, interaction: "highfive" };
    const right = () => [...rig.rightArm.position.toArray(), ...rig.rightArm.quaternion.toArray(), ...rig.rightArm.scale.toArray()];
    const rest = right();
    for (const reduced of [false, true]) for (const phase of [0, .1, .3, .5, .7, .9, 1, null]) {
      pose(input, neutral.lookAt, phase, reduced); expect(right()).toEqual(rest);
    }
    pose(input, neutral.lookAt, .5, false); expect(rig.leftArm.rotation.z).toBeLessThan(-.9);
    expect(rig.mouth.scale.x).toBeGreaterThan(1);
  });

  it("bounds added expressions and immediately restores authored rest when interrupted", () => {
    const { rig, pose, snapshot } = fixture();
    for (const interaction of newGestures) for (const x of [-1, 0, 1]) {
      const look = { x, y: .4 };
      pose(neutral, look, null, false); const rest = snapshot();
      for (let frame = 0; frame <= 40; frame++) {
        pose({ ...neutral, interaction }, look, frame / 40, false);
        expect(snapshot().every(Number.isFinite)).toBe(true);
        expect(rig.rightArm.rotation.z).toBeGreaterThanOrEqual(-.06); expect(rig.rightArm.rotation.z).toBeLessThanOrEqual(.16);
        expect(Math.abs(rig.body.rotation.z)).toBeLessThanOrEqual(.060001);
        expect(Math.abs(rig.body.rotation.y)).toBeLessThanOrEqual(interaction === "twirl" ? Math.PI * 2 + .100001 : .100001);
        expect(rig.body.position.y).toBeLessThanOrEqual(.060001); expect(rig.body.position.y).toBeGreaterThanOrEqual(-.012001);
        expect(rig.body.scale.y).toBeLessThanOrEqual(1.035001);
      }
      expect(snapshot()).toEqual(rest);
      pose({ ...neutral, interaction }, look, .5, false); pose(neutral, look, null, false); expect(snapshot()).toEqual(rest);
    }
  });

  it.each(newGestures)("%s keeps the actual model inside its production camera and the magnifier in its grip", interaction => {
    const model = createBookyModel();
    try {
      // Match the fixed square avatar camera, which is sized from neutral
      // geometry once. No camera refit can hide clipping during a gesture.
      const bounds = new Box3().setFromObject(model.group, true);
      const center = bounds.getCenter(new Vector3()), size = bounds.getSize(new Vector3());
      const halfHeight = Math.max(size.x, size.y) * .59;
      const camera = new OrthographicCamera(-halfHeight, halfHeight, halfHeight, -halfHeight, .1, 20);
      camera.position.copy(center).add(new Vector3(-1.85, 1.8, 6)); camera.lookAt(center); camera.updateMatrixWorld(true);
      const glove = model.group.getObjectByName("booky-right-grip-glove")!;
      const handle = model.group.getObjectByName("booky-magnifier-handle")!;
      const relativeGrip = () => glove.matrixWorld.clone().invert().multiply(handle.matrixWorld).elements;
      const authoredGrip = relativeGrip(), pose = createBookyPose(model.rig), point = new Vector3();
      const samples = Array.from({ length: 33 }, (_, index) => ({ phase: index / 32, x: 0, y: 0, reduced: false }));
      for (const x of [-1, 1]) for (const y of [-1, 1]) {
        samples.push({ phase: .5, x, y, reduced: false }, { phase: .5, x, y, reduced: true });
      }
      for (const { phase, x, y, reduced } of samples) {
        pose({ ...neutral, interaction }, { x, y }, phase, reduced); model.group.updateMatrixWorld(true);
        relativeGrip().forEach((value, index) => expect(value).toBeCloseTo(authoredGrip[index], 10));
        let extentX = 0, extentY = 0, depth = 0;
        model.group.traverse(part => {
          if (!(part instanceof Mesh)) return;
          const vertices = part.geometry.getAttribute("position");
          for (let index = 0; index < vertices.count; index += 1) {
            point.fromBufferAttribute(vertices, index).applyMatrix4(part.matrixWorld).project(camera);
            extentX = Math.max(extentX, Math.abs(point.x)); extentY = Math.max(extentY, Math.abs(point.y)); depth = Math.max(depth, Math.abs(point.z));
          }
        });
        const sample = `${interaction} phase=${phase} look=${x},${y} reduced=${reduced}`;
        expect(extentX, sample).toBeLessThan(1); expect(extentY, sample).toBeLessThan(1); expect(depth, sample).toBeLessThan(1);
      }
    } finally { model.dispose(); }
  });

});
