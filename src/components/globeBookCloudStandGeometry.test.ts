import { Box3, BufferGeometry, Camera, DataTexture, FrontSide, Light, Mesh, Raycaster, Texture, Vector3,
  type Intersection, type Material } from "three";
import { describe, expect, it, vi } from "vitest";
import { BOOK_CLOUD_GLOBE_STAND_ID, INCLUDED_GLOBE_STANDS } from "../planet/globeStands";
import { createBookCloudStandGeometry } from "./globeBookCloudStandGeometry";
import { createIncludedGlobeStand } from "./globeStandGeometry";

type Stand = ReturnType<typeof createBookCloudStandGeometry>;
function resources(stand: Stand) {
  const meshes: Mesh[] = [], geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>(), textures = new Set<Texture>();
  stand.group.traverse(object => {
    expect(object instanceof Camera || object instanceof Light).toBe(false);
    if (!(object instanceof Mesh)) return;
    meshes.push(object); geometries.add(object.geometry);
    for (const finish of Array.isArray(object.material) ? object.material : [object.material]) materials.add(finish);
  });
  for (const finish of materials) for (const value of Object.values(finish)) {
    if (value instanceof Texture) textures.add(value);
  }
  return { meshes, geometries, materials, textures };
}

/** Check physical welded topology, independently of the parameterization. A
 * connected closed volume cannot be replaced by intersecting sphere shells. */
function expectSingleClosedVolume(geometry: BufferGeometry, label: string) {
  const positions = geometry.getAttribute("position"), index = geometry.getIndex();
  const edges = new Map<string, { uses: number; orientation: number }>();
  const neighbors = new Map<string, Set<string>>();
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), ab = new Vector3(), ac = new Vector3(), cross = new Vector3();
  const key = (point: Vector3) => point.toArray().map(value => Math.round(value * 1e7)).join(",");
  geometry.computeBoundingBox();
  const origin = geometry.boundingBox!.getCenter(new Vector3());
  let volume = 0, collapsed = 0;
  for (let offset = 0; offset < (index?.count ?? positions.count); offset += 3) {
    a.fromBufferAttribute(positions, index ? index.getX(offset) : offset);
    b.fromBufferAttribute(positions, index ? index.getX(offset + 1) : offset + 1);
    c.fromBufferAttribute(positions, index ? index.getX(offset + 2) : offset + 2);
    ab.subVectors(b, a); ac.subVectors(c, a); cross.crossVectors(ab, ac);
    const ids = [key(a), key(b), key(c)];
    if (new Set(ids).size < 3 || cross.lengthSq() <= ab.lengthSq() * ac.lengthSq() * 1e-12) {
      collapsed++; continue;
    }
    for (let edge = 0; edge < 3; edge++) {
      const from = ids[edge], to = ids[(edge + 1) % 3], forward = from < to;
      const edgeKey = forward ? `${from}/${to}` : `${to}/${from}`;
      const value = edges.get(edgeKey) ?? { uses: 0, orientation: 0 };
      value.uses++; value.orientation += forward ? 1 : -1; edges.set(edgeKey, value);
      if (!neighbors.has(from)) neighbors.set(from, new Set());
      neighbors.get(from)!.add(to);
      if (!neighbors.has(to)) neighbors.set(to, new Set());
      neighbors.get(to)!.add(from);
    }
    a.sub(origin); b.sub(origin); c.sub(origin); volume += a.dot(cross.crossVectors(b, c)) / 6;
  }
  expect(collapsed, `${label}: collapsed faces`).toBe(0);
  expect([...edges.values()].every(edge => edge.uses === 2 && edge.orientation === 0), `${label}: watertight winding`).toBe(true);
  const first = neighbors.keys().next().value as string | undefined;
  expect(first).toBeDefined();
  const visited = new Set<string>(), pending = first ? [first] : [];
  while (pending.length) {
    const vertex = pending.pop()!;
    if (visited.has(vertex)) continue;
    visited.add(vertex);
    for (const neighbor of neighbors.get(vertex)!) if (!visited.has(neighbor)) pending.push(neighbor);
  }
  expect(visited.size, `${label}: connected surface`).toBe(neighbors.size);
  expect(volume, `${label}: outward enclosed volume`).toBeGreaterThan(1e-4);
}

describe("original book on a sculpted cloud support", () => {
  it("dispatches a solid non-pickable support with the same bound book and safe layout at every tier", () => {
    const budgets: { geometryBytes: number; textureBytes: number; triangles: number }[] = [];
    const landmarks = ["book-cloud-sculpted-cloud", "book-cloud-rounded-covers", "book-cloud-page-blocks", "book-cloud-contact-seat"];
    const reference = new Map<string, { bounds: number[]; matrix: number[] }>();
    expect(INCLUDED_GLOBE_STANDS.find(value => value.id === BOOK_CLOUD_GLOBE_STAND_ID)).toMatchObject({
      source: "src/components/globeBookCloudStandGeometry.ts", supportedAccess: "adult", childReviewed: false,
      provenance: "authored-in-project", grantsEntitlement: false,
    });
    for (const [tierIndex, tier] of (["high", "balanced", "economy"] as const).entries()) {
      const stand = createIncludedGlobeStand(BOOK_CLOUD_GLOBE_STAND_ID, tier);
      // Observe the palette's complete owned set, including maps not currently
      // referenced by a clone. Counting only scene materials understates it.
      const textureDisposal = vi.spyOn(Texture.prototype, "dispose");
      try {
        expect(stand.group.name).toBe(`included-globe-stand:${BOOK_CLOUD_GLOBE_STAND_ID}`);
        stand.group.updateMatrixWorld(true);
        const owned = resources(stand);
        expect(owned.meshes.length).toBeLessThanOrEqual(10);
        const cloud = stand.group.getObjectByName("book-cloud-sculpted-cloud") as Mesh;
        expect(cloud).toBeInstanceOf(Mesh);
        expectSingleClosedVolume(cloud.geometry, `${tier}/cloud`);
        for (const name of ["book-cloud-top-leaves", "book-cloud-spine", "book-cloud-bookmark", "book-cloud-cover-tooling"]) {
          expect(stand.group.getObjectByName(name), name).toBeInstanceOf(Mesh);
        }
        let triangles = 0, minimumY = Infinity, maximumY = -Infinity, radius = 0;
        let minimumNormalAgreement = 1, worstFace = "";
        const point = new Vector3(), a = new Vector3(), b = new Vector3(), c = new Vector3();
        const ab = new Vector3(), ac = new Vector3(), faceNormal = new Vector3(), vertexNormal = new Vector3();
        for (const object of owned.meshes) {
          const positions = object.geometry.getAttribute("position"), normals = object.geometry.getAttribute("normal");
          const uv = object.geometry.getAttribute("uv"), index = object.geometry.getIndex();
          expect(positions.array.every(Number.isFinite), object.name).toBe(true);
          expect(normals.count).toBe(positions.count); expect(normals.array.every(Number.isFinite)).toBe(true);
          expect(uv.count).toBe(positions.count); expect(uv.array.every(Number.isFinite)).toBe(true);
          expect((index?.count ?? positions.count) % 3).toBe(0);
          if (index) expect(index.array.every(value => Number.isInteger(value) && value >= 0 && value < positions.count)).toBe(true);
          triangles += (index?.count ?? positions.count) / 3;
          for (let vertex = 0; vertex < positions.count; vertex++) {
            point.fromBufferAttribute(positions, vertex).applyMatrix4(object.matrixWorld);
            radius = Math.max(radius, Math.hypot(point.x, point.z));
            minimumY = Math.min(minimumY, point.y); maximumY = Math.max(maximumY, point.y);
          }
          for (let offset = 0; offset < (index?.count ?? positions.count); offset += 3) {
            const ia = index ? index.getX(offset) : offset, ib = index ? index.getX(offset + 1) : offset + 1;
            const ic = index ? index.getX(offset + 2) : offset + 2;
            a.fromBufferAttribute(positions, ia); b.fromBufferAttribute(positions, ib); c.fromBufferAttribute(positions, ic);
            ab.subVectors(b, a); ac.subVectors(c, a); faceNormal.crossVectors(ab, ac);
            // Standard LatheGeometry has collapsed triangles on its pole rows;
            // the independently checked cloud does not have that exception.
            if (faceNormal.lengthSq() <= ab.lengthSq() * ac.lengthSq() * 1e-12) continue;
            vertexNormal.set(normals.getX(ia) + normals.getX(ib) + normals.getX(ic),
              normals.getY(ia) + normals.getY(ib) + normals.getY(ic), normals.getZ(ia) + normals.getZ(ib) + normals.getZ(ic));
            const agreement = faceNormal.normalize().dot(vertexNormal.normalize());
            if (agreement < minimumNormalAgreement) { minimumNormalAgreement = agreement; worstFace = `${object.name}:${offset / 3}`; }
          }
          const hits: Intersection[] = []; object.raycast(new Raycaster(), hits);
          expect(object.raycast).not.toBe(Mesh.prototype.raycast); expect(hits).toEqual([]);
          if (landmarks.includes(object.name)) {
            const bounds = new Box3().setFromObject(object), values = [...bounds.min.toArray(), ...bounds.max.toArray()];
            const baseline = reference.get(object.name);
            if (!baseline) reference.set(object.name, { bounds: values, matrix: [...object.matrixWorld.elements] });
            else {
              expect(object.matrixWorld.elements, object.name).toEqual(baseline.matrix);
              expect(Math.max(...values.map((value, index) => Math.abs(value - baseline.bounds[index]))), object.name)
                .toBeLessThanOrEqual(object.name === "book-cloud-sculpted-cloud" ? .004 : .002);
            }
          }
        }
        expect(minimumNormalAgreement, `${tier}/${worstFace}: front face and shading normal`).toBeGreaterThanOrEqual(-1e-5);
        expect(radius).toBeLessThanOrEqual(.55 + 1e-6); expect(radius).toBeGreaterThan(.42);
        expect(minimumY).toBeGreaterThanOrEqual(-1.44 - 1e-6); expect(minimumY).toBeCloseTo(-1.438, 6);
        expect(maximumY).toBeLessThanOrEqual(-1.03 + 1e-6); expect(maximumY).toBeCloseTo(-1.0308, 6);
        expect(triangles).toBeLessThan([30000, 18000, 10000][tierIndex]);
        for (const finish of owned.materials) { expect(finish.transparent).toBe(false); expect(finish.opacity).toBe(1); expect(finish.side).toBe(FrontSide); }
        const geometryBytes = [...owned.geometries].reduce((sum, geometry) => sum
          + Object.values(geometry.attributes).reduce((bytes, attribute) => bytes + attribute.array.byteLength, 0)
          + (geometry.getIndex()?.array.byteLength ?? 0), 0);
        stand.dispose(); stand.dispose();
        const allTextures = textureDisposal.mock.contexts;
        expect(allTextures).toHaveLength(16); expect(new Set(allTextures).size).toBe(16);
        let textureBytes = 0;
        for (const texture of allTextures) {
          expect(texture).toBeInstanceOf(DataTexture);
          if (!(texture instanceof DataTexture)) throw new Error("Unexpected external texture");
          textureBytes += Math.ceil(texture.image.data.byteLength * (texture.generateMipmaps ? 4 / 3 : 1));
        }
        expect(textureBytes).toBeLessThanOrEqual(5.5 * 1024 * 1024 / 4 ** tierIndex);
        budgets.push({ geometryBytes, textureBytes, triangles });
      } finally { stand.dispose(); textureDisposal.mockRestore(); }
    }
    for (const metric of ["geometryBytes", "textureBytes", "triangles"] as const) {
      expect(budgets[0][metric], metric).toBeGreaterThan(budgets[1][metric]);
      expect(budgets[1][metric], metric).toBeGreaterThan(budgets[2][metric]);
    }
  });

  it("retires every owned resource once without invalidating an independent preview", () => {
    const first = createBookCloudStandGeometry("economy"), second = createBookCloudStandGeometry("economy");
    const a = resources(first), b = resources(second);
    const listen = (owned: ReturnType<typeof resources>) => [...owned.geometries, ...owned.materials, ...owned.textures].map(resource => {
      const listener = vi.fn();
      if (resource instanceof BufferGeometry) resource.addEventListener("dispose", listener);
      else if (resource instanceof Texture) resource.addEventListener("dispose", listener);
      else resource.addEventListener("dispose", listener);
      return listener;
    });
    const observedA = listen(a), observedB = listen(b);
    try {
      for (const key of ["geometries", "materials", "textures"] as const) {
        for (const value of a[key]) expect(b[key].has(value as never), key).toBe(false);
      }
      first.dispose(); first.dispose();
      expect(first.group.children).toHaveLength(0);
      for (const listener of observedA) expect(listener).toHaveBeenCalledTimes(1);
      for (const listener of observedB) expect(listener).not.toHaveBeenCalled();
      expect(second.group.getObjectByName("book-cloud-sculpted-cloud")).toBeInstanceOf(Mesh);
      second.dispose(); second.dispose();
      for (const listener of observedB) expect(listener).toHaveBeenCalledTimes(1);
    } finally { first.dispose(); second.dispose(); }
  });
});
