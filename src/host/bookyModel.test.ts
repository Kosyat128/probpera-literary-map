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
        "booky-right-grip-glove", "booky-smile-teeth", "booky-smile-tongue", "booky-magnifier-lens"]) {
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
        ...rig.eyes, ...rig.pupils, ...rig.brows, rig.mouth];
      const transforms = () => members.map(object => [...object.position.toArray(),
        ...object.quaternion.toArray(), ...object.scale.toArray()]);
      const rest = transforms();
      const neutral: BookyInput = { mood: "idle", interaction: "rest", lookAt: { x: 0, y: 0 },
        reactionKey: 0, active: true };
      const pointing: BookyInput = { ...neutral, mood: "guiding", interaction: "pointing" };
      const greeting: BookyInput = { ...neutral, interaction: "greeting", reactionKey: 1 };
      const originalPupil = rig.pupils[0].position.clone(), originalEye = rig.eyes[0].position.clone();
      const look = boundedBookyLook({ x: 200, y: -200 });
      expect(look).toEqual({ x: 1, y: -1 });
      pose(pointing, look, null, false);
      expect(rig.pupils[0].position.x).toBeGreaterThan(originalPupil.x);
      expect(rig.pupils[0].position.y).toBeGreaterThan(originalPupil.y);
      expect(rig.eyes[0].position.equals(originalEye)).toBe(true);
      const pointed = transforms();
      for (let repeat = 0; repeat < 12; repeat++) {
        pose(greeting, { x: -.6, y: .4 }, .34, false);
        expect(rig.eyes[0].scale.y).toBeLessThan(.2);
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
    first.dispose(); first.dispose();
    expect(first.group.children).toHaveLength(0);
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1);
    for (const spy of otherSpies) expect(spy).not.toHaveBeenCalled();
    second.dispose(); for (const spy of otherSpies) expect(spy).toHaveBeenCalledTimes(1);
  });
});
