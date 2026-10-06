import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import { createBookyModel } from "./bookyModel";
import { boundedBookyLook, createBookyPose, type BookyInput } from "./bookyAnimation";

function resources(group: THREE.Group) {
  const meshes: THREE.Mesh[] = [], geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  group.traverse(object => {
    expect(object instanceof THREE.Light || object instanceof THREE.Camera).toBe(false);
    if (!(object instanceof THREE.Mesh)) return;
    meshes.push(object); geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      materials.add(material);
      for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value);
    }
  });
  return { meshes, geometries, materials, textures };
}

function closedSleeve(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute("position"), index = geometry.getIndex()!;
  const edges = new Map<string, { count: number; direction: number }>();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), cross = new THREE.Vector3();
  const key = (point: THREE.Vector3) => point.toArray().map(value => Math.round(value * 1e6)).join(",");
  let volume = 0;
  for (let i = 0; i < index.count; i += 3) {
    a.fromBufferAttribute(position, index.getX(i)); b.fromBufferAttribute(position, index.getX(i + 1)); c.fromBufferAttribute(position, index.getX(i + 2));
    volume += a.dot(cross.crossVectors(b, c)) / 6;
    const ids = [key(a), key(b), key(c)];
    expect(new Set(ids).size).toBe(3);
    for (let edge = 0; edge < 3; edge++) {
      const from = ids[edge], to = ids[(edge + 1) % 3], forward = from < to;
      const edgeKey = forward ? `${from}/${to}` : `${to}/${from}`;
      const state = edges.get(edgeKey) ?? { count: 0, direction: 0 };
      state.count++; state.direction += forward ? 1 : -1; edges.set(edgeKey, state);
    }
  }
  expect([...edges.values()].every(edge => edge.count === 2 && edge.direction === 0)).toBe(true);
  expect(volume).toBeGreaterThan(.001);
}

describe("original articulated Mr. Booky model", () => {
  it("contains actual bounded 3D features and independent face/arm/cover joints within the render budget", () => {
    const model = createBookyModel();
    try {
      const { meshes } = resources(model.group);
      expect(meshes.length).toBeLessThanOrEqual(50);
      let triangles = 0;
      const ray = new THREE.Raycaster(new THREE.Vector3(0, 0, 4), new THREE.Vector3(0, 0, -1));
      for (const mesh of meshes) {
        const position = mesh.geometry.getAttribute("position"), normal = mesh.geometry.getAttribute("normal");
        expect(normal.count).toBe(position.count);
        for (let i = 0; i < position.count; i++) {
          expect([position.getX(i), position.getY(i), position.getZ(i), normal.getX(i), normal.getY(i), normal.getZ(i)].every(Number.isFinite)).toBe(true);
          const length = Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i));
          expect(length).toBeGreaterThan(.95); expect(length).toBeLessThan(1.05);
        }
        triangles += (mesh.geometry.index?.count ?? position.count) / 3;
        const hits: THREE.Intersection[] = []; mesh.raycast(ray, hits); expect(hits).toHaveLength(0);
      }
      // The rounded binding, layered paper and full sneakers remain bounded
      // after the requested refinement of the original reference character.
      expect(triangles).toBeLessThanOrEqual(50_000);
      const bounds = new THREE.Box3().setFromObject(model.group, true);
      expect(bounds.min.x).toBeGreaterThan(-1.25); expect(bounds.max.x).toBeLessThan(1.25);
      expect(bounds.min.y).toBeGreaterThan(-1.30); expect(bounds.max.y).toBeLessThan(1.35);
      expect(bounds.getSize(new THREE.Vector3()).z).toBeGreaterThan(.55);
      for (const name of ["booky-front-hardcover", "booky-page-block", "booky-layered-leaf-edges", "booky-left-open-glove",
        "booky-right-grip-glove", "booky-smile-teeth", "booky-smile-tongue", "booky-magnifier-lens",
        "booky-soft-upper-lid-left", "booky-soft-upper-lid-right"]) {
        expect(model.group.getObjectByName(name)).toBeInstanceOf(THREE.Mesh);
      }
      const lens = model.group.getObjectByName("booky-magnifier-lens") as THREE.Mesh<THREE.BufferGeometry, THREE.MeshPhysicalMaterial>;
      expect(lens.material.transparent).toBe(true); expect(lens.material.opacity).toBeLessThan(.5);
      expect(lens.material.depthWrite).toBe(false);
      for (const name of ["booky-left-sleeve", "booky-right-sleeve"]) closedSleeve((model.group.getObjectByName(name) as THREE.Mesh).geometry);
      const left = model.group.getObjectByName("booky-left-open-glove")!, right = model.group.getObjectByName("booky-right-grip-glove")!;
      const beforeLeft = left.matrixWorld.clone(), beforeRight = right.matrixWorld.clone();
      model.rig.leftArm.rotation.z += .2; model.group.updateMatrixWorld(true);
      expect(left.matrixWorld.equals(beforeLeft)).toBe(false); expect(right.matrixWorld.equals(beforeRight)).toBe(true);
      const beforeEye = model.rig.eyes[0].matrixWorld.clone();
      model.rig.frontCover.rotation.y = -.1; model.group.updateMatrixWorld(true);
      expect(model.rig.eyes[0].matrixWorld.equals(beforeEye)).toBe(false);
      expect(right.matrixWorld.equals(beforeRight)).toBe(true);
      const secondPupil = model.rig.pupils[1].matrixWorld.clone();
      model.rig.pupils[0].position.x += .02; model.group.updateMatrixWorld(true);
      expect(model.rig.pupils[1].matrixWorld.equals(secondPupil)).toBe(true);
      expect(model.rig.pupils[0].parent).toBe(model.rig.eyes[0]);
      expect(model.rig.mouth.parent).toBe(model.rig.frontCover);
    } finally { model.dispose(); }
  });

  it("rebuilds real articulated poses without drift and keeps reduced-motion reactions static", () => {
    const model = createBookyModel();
    try {
      const rig = model.rig, pose = createBookyPose(rig);
      const members = [rig.body, rig.leftArm, rig.rightArm, rig.frontCover, rig.bookmark,
        rig.leftLeg, rig.rightLeg, rig.leftFoot, rig.rightFoot, ...rig.eyes, ...rig.upperLids, ...rig.pupils, ...rig.brows, rig.mouth];
      const transforms = () => [
        ...members.map(object => [...object.position.toArray(), ...object.quaternion.toArray(), ...object.scale.toArray()]),
        ...["left", "right"].map(side => Array.from((model.group.getObjectByName(`booky-soft-upper-lid-${side}`) as THREE.Mesh).geometry.getAttribute("position").array)),
      ];
      const rest = transforms();
      const neutral: BookyInput = { mood: "idle", interaction: "rest", lookAt: { x: 0, y: 0 },
        reactionKey: 0, active: true };
      const pointing: BookyInput = { ...neutral, mood: "guiding", interaction: "pointing" };
      const greeting: BookyInput = { ...neutral, interaction: "greeting", reactionKey: 1 };
      const originalPupil = rig.pupils[0].position.clone(), originalEye = rig.eyes[0].position.clone();
      const eyeScales = rig.eyes.map(eye => eye.scale.clone()), pupilScales = rig.pupils.map(pupil => pupil.scale.clone());
      const lid = model.group.getObjectByName("booky-soft-upper-lid-left") as THREE.Mesh;
      const pupilInk = model.group.getObjectByName("booky-pupil-ink-left") as THREE.Mesh;
      const sclera = model.group.getObjectByName("booky-sclera-left")!;
      expect(rig.upperLids[0].parent).toBe(rig.eyes[0].parent);
      expect(new THREE.Box3().setFromObject(lid, true).min.y).toBeGreaterThan(new THREE.Box3().setFromObject(sclera, true).max.y);
      const look = boundedBookyLook({ x: 200, y: -200 });
      expect(look).toEqual({ x: 1, y: -1 });
      pose(pointing, look, null, false);
      expect(rig.pupils[0].position.x).toBeGreaterThan(originalPupil.x);
      expect(rig.pupils[0].position.y).toBeGreaterThan(originalPupil.y);
      expect(rig.eyes[0].position.equals(originalEye)).toBe(true);
      const pointed = transforms();
      for (let repeat = 0; repeat < 12; repeat++) {
        pose(greeting, { x: -.6, y: .4 }, .34, false);
        rig.eyes.forEach((eye, index) => expect(eye.scale.equals(eyeScales[index])).toBe(true));
        rig.pupils.forEach((pupil, index) => expect(pupil.scale.equals(pupilScales[index])).toBe(true));
        // Actual lid geometry hides the preserved pupil from the front; this
        // bypasses disabled UI picking only for the geometry assertion.
        model.group.updateMatrixWorld(true);
        const ray = new THREE.Raycaster(rig.pupils[0].localToWorld(new THREE.Vector3(0, 0, 1)),
          new THREE.Vector3(0, 0, -1).transformDirection(rig.pupils[0].matrixWorld));
        const lidHits: THREE.Intersection[] = [], pupilHits: THREE.Intersection[] = [];
        THREE.Mesh.prototype.raycast.call(lid, ray, lidHits);
        THREE.Mesh.prototype.raycast.call(pupilInk, ray, pupilHits);
        expect(lidHits.length).toBeGreaterThan(0); expect(pupilHits.length).toBeGreaterThan(0);
        expect(Math.min(...lidHits.map(hit => hit.distance))).toBeLessThan(Math.min(...pupilHits.map(hit => hit.distance)));
        pose(pointing, look, null, false);
        expect(transforms()).toEqual(pointed);
      }
      const celebration: BookyInput = { ...neutral, mood: "celebrate" };
      pose(celebration, look, .34, true);
      const reduced = transforms();
      expect(rig.eyes[0].scale.y).toBe(1);
      expect(rig.frontCover.rotation.y).toBeCloseTo(0, 12);
      expect(rig.bookmark.rotation.z).toBeCloseTo(0, 12);
      pose(celebration, look, .72, true);
      expect(transforms()).toEqual(reduced);
      const malformed = boundedBookyLook({ x: Number.NaN, y: Number.POSITIVE_INFINITY });
      expect(malformed).toEqual({ x: 0, y: 0 });
      pose(neutral, malformed, null, false);
      const restored = transforms();
      expect(restored.flat().every(Number.isFinite)).toBe(true);
      for (let index = 0; index < restored.length; index++) {
        restored[index].forEach((value, coordinate) => expect(value).toBeCloseTo(rest[index][coordinate], 12));
      }
    } finally { model.dispose(); }
  });

  it("keeps partial eyelids on their curved shell, independently closes the wink and reopens without drift", () => {
    const model = createBookyModel();
    try {
      const left = model.group.getObjectByName("booky-soft-upper-lid-left") as THREE.Mesh;
      const right = model.group.getObjectByName("booky-soft-upper-lid-right") as THREE.Mesh;
      const positions = (mesh: THREE.Mesh) => Array.from(mesh.geometry.getAttribute("position").array);
      const originalLeft = positions(left), originalRight = positions(right);
      expect(left.geometry).not.toBe(right.geometry);
      const normal = new THREE.Vector3(), expected = new THREE.Vector3();
      for (const closure of [.1, .25, .5, .62, .8, 1]) {
        model.rig.setEyelidClosure(0, closure);
        const vertex = left.geometry.getAttribute("position"), normals = left.geometry.getAttribute("normal");
        for (let index = 0; index < vertex.count; index++) {
          const x = vertex.getX(index) / .214, y = vertex.getY(index) / .253, z = vertex.getZ(index) / .130;
          // A partially closed cap must stay outside the eye rather than shrink to a chord.
          expect(x * x + y * y + z * z).toBeCloseTo(1, 5);
          normal.fromBufferAttribute(normals, index); expected.set(x / .214, y / .253, z / .130).normalize();
          expect(normal.length()).toBeCloseTo(1, 5); expect(normal.dot(expected)).toBeGreaterThan(.9999);
        }
        expect(positions(right)).toEqual(originalRight);
      }
      // Rays from the real oblique avatar camera must hit the curved lid
      // before covered sclera samples, including both lateral upper regions.
      const bounds = new THREE.Box3().setFromObject(model.group, true), center = bounds.getCenter(new THREE.Vector3());
      const cameraDirection = center.clone().sub(center.clone().add(new THREE.Vector3(-1.85, 1.8, 6))).normalize();
      const sclera = model.group.getObjectByName("booky-sclera-left") as THREE.Mesh;
      for (const closure of [.25, .5, .8, 1]) {
        model.rig.setEyelidClosure(0, closure); model.group.updateMatrixWorld(true);
        for (const x of [-.075, 0, .075]) {
          const y = closure < .5 ? .19 : .05;
          const z = .082 * Math.sqrt(1 - (x / .205) ** 2 - (y / .237) ** 2);
          const target = sclera.localToWorld(new THREE.Vector3(x, y, z));
          const ray = new THREE.Raycaster(target.clone().addScaledVector(cameraDirection, -2), cameraDirection);
          const coverHits: THREE.Intersection[] = [], eyeHits: THREE.Intersection[] = [];
          THREE.Mesh.prototype.raycast.call(left, ray, coverHits); THREE.Mesh.prototype.raycast.call(sclera, ray, eyeHits);
          expect(coverHits.length).toBeGreaterThan(0); expect(eyeHits.length).toBeGreaterThan(0);
          expect(Math.min(...coverHits.map(hit => hit.distance))).toBeLessThan(Math.min(...eyeHits.map(hit => hit.distance)));
        }
      }
      model.rig.setEyelidClosure(0, 0); expect(positions(left)).toEqual(originalLeft);
      const neutral: BookyInput = { mood: "idle", interaction: "rest", lookAt: { x: 0, y: 0 }, reactionKey: 0, active: true };
      const pose = createBookyPose(model.rig), wink = { ...neutral, interaction: "wink" as const };
      pose(wink, neutral.lookAt, .5, false); expect(positions(left)).not.toEqual(originalLeft); expect(positions(right)).toEqual(originalRight);
      pose(wink, neutral.lookAt, null, true); const stillWink = positions(left);
      for (const phase of [0, .25, .5, 1]) { pose(wink, neutral.lookAt, phase, true); expect(positions(left)).toEqual(stillWink); }
      pose(neutral, neutral.lookAt, null, false); expect(positions(left)).toEqual(originalLeft); expect(positions(right)).toEqual(originalRight);
      const version = (left.geometry.getAttribute("position") as THREE.BufferAttribute).version;
      pose(neutral, neutral.lookAt, null, false); expect((left.geometry.getAttribute("position") as THREE.BufferAttribute).version).toBe(version);
    } finally { model.dispose(); }
  });

  it("articulates each complete sneaker independently and keeps alternating step extremes in the existing viewport", () => {
    const model = createBookyModel();
    try {
      const { leftLeg, rightLeg, leftFoot, rightFoot } = model.rig;
      expect(leftFoot.parent).toBe(leftLeg); expect(rightFoot.parent).toBe(rightLeg);
      expect(leftLeg.parent).toBe(model.rig.body); expect(rightLeg.parent).toBe(model.rig.body);
      expect(leftFoot.children.map(object => object.name).sort()).toEqual([
        "booky-left-shoe-laces", "booky-left-shoe-upper", "booky-shoe-soles-and-caps",
      ]);
      expect(rightFoot.children.map(object => object.name).sort()).toEqual([
        "booky-right-shoe-laces", "booky-right-shoe-upper", "booky-shoe-soles-and-caps-right",
      ]);
      const original = leftFoot.children.map(object => object.matrixWorld.clone());
      const rightOriginal = rightFoot.children.map(object => object.matrixWorld.clone());
      const legOriginal = model.group.getObjectByName("booky-legs")!.matrixWorld.clone();
      leftFoot.rotation.x = .08; model.group.updateMatrixWorld(true);
      leftFoot.children.forEach((part, index) => expect(part.matrixWorld.equals(original[index])).toBe(false));
      rightFoot.children.forEach((part, index) => expect(part.matrixWorld.equals(rightOriginal[index])).toBe(true));
      expect(model.group.getObjectByName("booky-legs")!.matrixWorld.equals(legOriginal)).toBe(true);
      leftFoot.rotation.x = 0; model.group.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(model.group);
      const center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
      const h = Math.max(size.x, size.y) * .59;
      const camera = new THREE.OrthographicCamera(-h, h, h, -h, .1, 20);
      camera.position.copy(center).add(new THREE.Vector3(-1.85, 1.8, 6)); camera.lookAt(center); camera.updateMatrixWorld(true);
      const point = new THREE.Vector3();
      for (const phase of [-1, 0, 1]) {
        leftLeg.rotation.x = phase * .12; rightLeg.rotation.x = -phase * .12;
        leftFoot.rotation.x = -phase * .08; rightFoot.rotation.x = phase * .08;
        leftLeg.position.y = -.73 + Math.max(0, phase) * .025;
        rightLeg.position.y = -.73 + Math.max(0, -phase) * .025;
        model.rig.body.position.y = Math.abs(phase) * .014;
        model.rig.body.rotation.z = phase * .012; model.group.updateMatrixWorld(true);
        let extentX = 0, extentY = 0;
        model.group.traverse(part => {
          if (!(part instanceof THREE.Mesh)) return;
          const vertices = part.geometry.getAttribute("position");
          for (let index = 0; index < vertices.count; index++) {
            point.fromBufferAttribute(vertices, index).applyMatrix4(part.matrixWorld).project(camera);
            extentX = Math.max(extentX, Math.abs(point.x)); extentY = Math.max(extentY, Math.abs(point.y));
          }
        });
        expect(extentX).toBeLessThan(1); expect(extentY).toBeLessThan(1);
      }
    } finally { model.dispose(); }
  });

  it("wraps the magnifier shaft with a real glove and retains the grip through walking and curious poses", () => {
    const model = createBookyModel();
    try {
      const glove = model.group.getObjectByName("booky-right-grip-glove") as THREE.Mesh;
      const handle = model.group.getObjectByName("booky-magnifier-handle") as THREE.Mesh;
      const magnifier = handle.parent!, hand = glove.parent!;
      expect(hand.name).toBe("booky-right-hand");
      expect(magnifier.parent).toBe(hand); expect(hand.parent).toBe(model.rig.rightArm);
      // Bypass disabled UI picking only in this geometry check. From both sides
      // of the middle finger, actual glove surfaces enclose the actual shaft.
      for (const direction of [-1, 1]) {
        const origin = hand.localToWorld(new THREE.Vector3(.08, .017, -direction));
        const axis = new THREE.Vector3(0, 0, direction).transformDirection(hand.matrixWorld);
        const ray = new THREE.Raycaster(origin, axis), gloveHits: THREE.Intersection[] = [], shaftHits: THREE.Intersection[] = [];
        THREE.Mesh.prototype.raycast.call(glove, ray, gloveHits);
        THREE.Mesh.prototype.raycast.call(handle, ray, shaftHits);
        expect(gloveHits.length).toBeGreaterThan(0); expect(shaftHits.length).toBeGreaterThan(0);
        expect(Math.min(...gloveHits.map(hit => hit.distance))).toBeLessThan(Math.min(...shaftHits.map(hit => hit.distance)));
      }
      const relative = () => glove.matrixWorld.clone().invert().multiply(handle.matrixWorld).elements;
      const initial = relative(), pose = createBookyPose(model.rig);
      for (const interaction of ["curious", "walking"] as const) for (const progress of [.125, .3125, .4375, .5, .875, 1]) {
        pose({ mood: "idle", interaction, lookAt: { x: 0, y: 0 }, reactionKey: 1, active: true },
          { x: 0, y: 0 }, progress, false);
        model.group.updateMatrixWorld(true);
        relative().forEach((value, index) => expect(value).toBeCloseTo(initial[index], 12));
      }
    } finally { model.dispose(); }
  });

  it("keeps the magnifier outside the face in the production camera and bounded curious poses", () => {
    const model = createBookyModel();
    try {
      const bounds = new THREE.Box3().setFromObject(model.group, true);
      const center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
      const halfHeight = Math.max(size.x, size.y) * .59;
      const camera = new THREE.OrthographicCamera(-halfHeight, halfHeight, halfHeight, -halfHeight, .1, 20);
      camera.position.copy(center).add(new THREE.Vector3(-1.85, 1.8, 6)); camera.lookAt(center); camera.updateMatrixWorld(true);
      const projected = (object: THREE.Object3D) => {
        const result = new THREE.Box2(), point = new THREE.Vector3();
        object.traverse(part => {
          if (!(part instanceof THREE.Mesh)) return;
          const vertices = part.geometry.getAttribute("position");
          for (let index = 0; index < vertices.count; index++) {
            point.fromBufferAttribute(vertices, index).applyMatrix4(part.matrixWorld).project(camera);
            result.expandByPoint(new THREE.Vector2(point.x, point.y));
          }
        });
        return result;
      };
      const frame = model.group.getObjectByName("booky-magnifier-gold-frame")!;
      for (const yaw of [-.18, 0, .18]) for (const pitch of [-.06, 0, .06]) for (const tilt of [-.06, .06]) for (const raised of [-.06, 0, .16]) {
        model.rig.body.rotation.set(pitch, yaw, tilt); model.rig.rightArm.rotation.z = raised;
        model.group.updateMatrixWorld(true);
        const face = projected(model.rig.eyes[1]), magnifier = projected(frame);
        // A visible gap remains even at the smallest 88px control. This checks
        // the actual rendered projection, not only world-space separation.
        expect((magnifier.min.x - face.max.x) * 44, `yaw=${yaw}, pitch=${pitch}, tilt=${tilt}, arm=${raised}`).toBeGreaterThan(1);
        expect(magnifier.max.x).toBeLessThan(1); expect(magnifier.max.y).toBeLessThan(1);
      }
    } finally { model.dispose(); }
  });

  it("owns independent buffers/materials/maps and disposes shared resources exactly once", () => {
    const first = createBookyModel(), second = createBookyModel();
    const a = resources(first.group), b = resources(second.group);
    const spies = [...a.geometries, ...a.materials, ...a.textures].map(value => vi.spyOn(value, "dispose"));
    const otherSpies = [...b.geometries, ...b.materials, ...b.textures].map(value => vi.spyOn(value, "dispose"));
    expect(a.textures.size).toBe(3);
    for (const geometry of a.geometries) expect(b.geometries.has(geometry)).toBe(false);
    for (const material of a.materials) expect(b.materials.has(material)).toBe(false);
    for (const texture of a.textures) expect(b.textures.has(texture)).toBe(false);
    const irisLeft = first.group.getObjectByName("booky-iris-left") as THREE.Mesh;
    const irisRight = first.group.getObjectByName("booky-iris-right") as THREE.Mesh;
    expect(irisLeft.geometry).toBe(irisRight.geometry);
    createBookyPose(first.rig)({ mood: "idle", interaction: "walking", lookAt: { x: 0, y: 0 },
      reactionKey: 1, active: true }, { x: 0, y: 0 }, .3125, false);
    first.group.updateMatrixWorld(true);
    first.dispose(); first.dispose();
    expect(first.group.children).toHaveLength(0);
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
    for (const spy of otherSpies) expect(spy).not.toHaveBeenCalled();
    second.dispose(); for (const spy of otherSpies) expect(spy).toHaveBeenCalledTimes(1);
  });
});

it.each([
  { name: "booky-right-grip-glove", components: 4 },
  { name: "booky-left-open-glove", components: 1 },
])("keeps $name closed and oriented with $components continuous surfaces", ({ name, components }) => {
  const model = createBookyModel();
  try {
    const glove = model.group.getObjectByName(name) as THREE.Mesh;
    const position = glove.geometry.getAttribute("position"), index = glove.geometry.getIndex()!;
    expect(index).not.toBeNull();
    const point = new THREE.Vector3(), keys: string[] = [], parent = new Map<string, string>();
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i);
      const key = point.toArray().map(value => Math.round(value * 1e6)).join(",");
      keys.push(key); parent.set(key, key);
    }
    const find = (key: string): string => {
      const next = parent.get(key)!;
      if (key === next) return key;
      const root = find(next); parent.set(key, root); return root;
    };
    const edges = new Map<string, { count: number; direction: number }>();
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
    let signedVolume = 0;
    for (let i = 0; i < index.count; i += 3) {
      a.fromBufferAttribute(position, index.getX(i));
      b.fromBufferAttribute(position, index.getX(i + 1));
      c.fromBufferAttribute(position, index.getX(i + 2));
      signedVolume += a.dot(b.cross(c)) / 6;
      const triangle = [keys[index.getX(i)], keys[index.getX(i + 1)], keys[index.getX(i + 2)]];
      expect(new Set(triangle).size).toBe(3);
      for (let edge = 0; edge < 3; edge++) {
        const from = triangle[edge], to = triangle[(edge + 1) % 3], forward = from < to;
        const key = forward ? `${from}/${to}` : `${to}/${from}`;
        const value = edges.get(key) ?? { count: 0, direction: 0 };
        value.count++; value.direction += forward ? 1 : -1; edges.set(key, value);
        parent.set(find(from), find(to));
      }
    }
    expect([...edges.values()].filter(edge => edge.count !== 2 || edge.direction !== 0)).toEqual([]);
    expect(new Set([...parent.keys()].map(find)).size).toBe(components);
    expect(signedVolume).toBeGreaterThan(0);
  } finally { model.dispose(); }
});
