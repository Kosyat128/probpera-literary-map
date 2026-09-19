import { createHash } from "node:crypto";
import { BufferGeometry, Camera, DataTexture, Light, Line, Mesh, MeshPhysicalMaterial, Raycaster,
  SRGBColorSpace, Texture, Vector3, type Intersection, type Material } from "three";
import { describe, expect, it, vi } from "vitest";
import { createIncludedGlobeStand } from "./globeStandGeometry";
import { createCeramicPortraitStand } from "./globeCeramicPortraitStandGeometry";
import type { GlobeQualityTier } from "./globeQuality";

const portraits = [
  { kind: "pushkin", id: "stand.base.portrait-pushkin" },
  { kind: "hemingway", id: "stand.base.portrait-hemingway" },
  { kind: "tolstoy", id: "stand.base.portrait-tolstoy" },
] as const;
const tiers: readonly GlobeQualityTier[] = ["high", "balanced", "economy"];
type Stand = ReturnType<typeof createCeramicPortraitStand>;

function resources(stand: Stand) {
  const meshes: Mesh[] = [], geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>(), textures = new Set<Texture>();
  stand.group.traverse(object => {
    expect(object instanceof Light || object instanceof Camera || object instanceof Line).toBe(false);
    if (!(object instanceof Mesh)) return;
    meshes.push(object); geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  for (const material of materials) for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
  return { meshes, geometries, materials, textures };
}

/** Inspect actual triangle streams. Only the head promises a single closed
 * volume; decorative eyelid tubes may legitimately have embedded open ends. */
function inspectSurface(mesh: Mesh, label: string) {
  const geometry = mesh.geometry, position = geometry.getAttribute("position"), normal = geometry.getAttribute("normal");
  const uv = geometry.getAttribute("uv"), index = geometry.getIndex();
  expect(position.array.every(Number.isFinite), `${label}: positions`).toBe(true);
  expect(normal.count).toBe(position.count); expect(normal.array.every(Number.isFinite), `${label}: normals`).toBe(true);
  expect(uv.count).toBe(position.count); expect(uv.array.every(Number.isFinite), `${label}: uv`).toBe(true);
  const count = index?.count ?? position.count;
  expect(count).toBeGreaterThan(0); expect(count % 3).toBe(0);
  if (index) expect(index.array.every(value => Number.isInteger(value) && value >= 0 && value < position.count), label).toBe(true);
  const closedHead = mesh.name === "connected-portrait-head-and-face";
  const edges = new Map<string, { count: number; direction: number }>();
  const key = (point: Vector3) => point.toArray().map(value => Math.round(value * 1e7)).join(":");
  geometry.computeBoundingBox();
  const centre = geometry.boundingBox!.getCenter(new Vector3());
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), ab = new Vector3(), ac = new Vector3();
  const face = new Vector3(), average = new Vector3();
  let wrongNormal = "", collapsed = 0, volume = 0;
  for (let offset = 0; offset < count; offset += 3) {
    const ia = index ? index.getX(offset) : offset;
    const ib = index ? index.getX(offset + 1) : offset + 1, ic = index ? index.getX(offset + 2) : offset + 2;
    a.fromBufferAttribute(position, ia); b.fromBufferAttribute(position, ib); c.fromBufferAttribute(position, ic);
    ab.subVectors(b, a); ac.subVectors(c, a); face.crossVectors(ab, ac);
    if (face.lengthSq() <= ab.lengthSq() * ac.lengthSq() * 1e-12) { collapsed++; continue; }
    average.set(normal.getX(ia) + normal.getX(ib) + normal.getX(ic),
      normal.getY(ia) + normal.getY(ib) + normal.getY(ic), normal.getZ(ia) + normal.getZ(ib) + normal.getZ(ic));
    const agreement = face.normalize().dot(average.normalize());
    if (!Number.isFinite(agreement) || average.lengthSq() < 0.5 || agreement < -1e-4) wrongNormal ||= `triangle ${offset / 3}`;
    if (!closedHead) continue;
    const vertices = [key(a), key(b), key(c)];
    if (new Set(vertices).size !== 3) { collapsed++; continue; }
    for (let edge = 0; edge < 3; edge++) {
      const from = vertices[edge], to = vertices[(edge + 1) % 3], forward = from < to;
      const id = forward ? `${from}/${to}` : `${to}/${from}`;
      const entry = edges.get(id) ?? { count: 0, direction: 0 };
      entry.count++; entry.direction += forward ? 1 : -1; edges.set(id, entry);
    }
    a.sub(centre); b.sub(centre); c.sub(centre); volume += a.dot(face.crossVectors(b, c)) / 6;
  }
  expect(wrongNormal, `${label}: face/shading normal winding`).toBe("");
  if (closedHead) {
    expect(collapsed, `${label}: collapsed head triangles`).toBe(0);
    expect([...edges.values()].every(edge => edge.count === 2 && edge.direction === 0), `${label}: welded closed head`).toBe(true);
    expect(Number.isFinite(volume)).toBe(true); expect(volume, `${label}: outward head volume`).toBeGreaterThan(1e-6);
  }
  return count / 3;
}

describe("owned ceramic portrait stand geometry", () => {
  it("routes every portrait through valid sculpted geometry with bounded resources and decreasing detail at all tiers", () => {
    const headIdentities = new Set<string>();
    for (const { id, kind } of portraits) {
      const budgets: { geometryBytes: number; textureBytes: number; triangles: number }[] = [];
      for (const [tierIndex, tier] of tiers.entries()) {
        const stand = createIncludedGlobeStand(id, tier);
        try {
          stand.group.updateMatrixWorld(true);
          expect(stand.group.name).toBe(`included-globe-stand:${id}`);
          expect(stand.group.userData).toMatchObject({ standId: id, portraitKind: kind, qualityTier: tier, provenance: "authored-in-project" });
          const owned = resources(stand);
          expect(owned.meshes.length).toBeLessThanOrEqual(16);
          for (const name of ["connected-portrait-head-and-face", "sculpted-almond-eyes", "upper-and-lower-eyelids",
            "incised-iris-detail", "pupil-detail", "folded-ears-with-helix", "ceramic-neck-and-oval-foot", "subtle-globe-contact-seat"]) {
            expect(stand.group.getObjectByName(name), `${kind}/${name}`).toBeInstanceOf(Mesh);
          }
          const head = stand.group.getObjectByName("connected-portrait-head-and-face") as Mesh;
          const color = head.geometry.getAttribute("color"), headPositions = head.geometry.getAttribute("position");
          expect(head.material).toBeInstanceOf(MeshPhysicalMaterial);
          expect((head.material as MeshPhysicalMaterial).vertexColors).toBe(true);
          expect(color, `${kind}/${tier}: authored surface colors`).toBeDefined();
          expect(color.itemSize).toBe(3); expect(color.count).toBe(headPositions.count);
          let validColors = true, minimumColor = Infinity, maximumColor = -Infinity;
          const firstColor = new Vector3().fromBufferAttribute(color, 0), currentColor = new Vector3();
          let colorVariation = 0;
          for (let vertex = 0; vertex < color.count; vertex++) {
            currentColor.fromBufferAttribute(color, vertex);
            for (const channel of [currentColor.x, currentColor.y, currentColor.z]) {
              validColors &&= Number.isFinite(channel) && channel >= 0 && channel <= 1;
              minimumColor = Math.min(minimumColor, channel); maximumColor = Math.max(maximumColor, channel);
            }
            colorVariation = Math.max(colorVariation, currentColor.distanceToSquared(firstColor));
          }
          expect(validColors, `${kind}/${tier}: finite linear RGB`).toBe(true);
          expect(maximumColor - minimumColor).toBeGreaterThan(0);
          expect(colorVariation, `${kind}/${tier}: varying sculpted surface colors`).toBeGreaterThan(1e-6);
          if (tier === "economy") {
            const array = head.geometry.getAttribute("position").array;
            headIdentities.add(createHash("sha256").update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength)).digest("hex"));
          }
          const point = new Vector3(), raycaster = new Raycaster();
          let radius = 0, minimumY = Infinity, maximumY = -Infinity, triangles = 0;
          for (const mesh of owned.meshes) {
            triangles += inspectSurface(mesh, `${kind}/${tier}/${mesh.name}`);
            const position = mesh.geometry.getAttribute("position");
            for (let vertex = 0; vertex < position.count; vertex++) {
              point.fromBufferAttribute(position, vertex).applyMatrix4(mesh.matrixWorld);
              radius = Math.max(radius, Math.hypot(point.x, point.z));
              minimumY = Math.min(minimumY, point.y); maximumY = Math.max(maximumY, point.y);
            }
            const hits: Intersection[] = [];
            expect(mesh.raycast).not.toBe(Mesh.prototype.raycast);
            for (const direction of [[0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, -1]]) {
              raycaster.ray.origin.set(0, 0, 0); raycaster.ray.direction.set(direction[0], direction[1], direction[2]);
              mesh.raycast(raycaster, hits);
            }
            expect(hits, `${kind}/${mesh.name}: decorative picking`).toEqual([]);
          }
          expect(radius).toBeGreaterThan(0.39); expect(radius).toBeLessThanOrEqual(0.45);
          expect(minimumY).toBeGreaterThanOrEqual(-1.73); expect(minimumY).toBeLessThan(-1.70);
          expect(maximumY).toBeLessThanOrEqual(-1.0); expect(maximumY).toBeGreaterThan(-1.05);
          expect(owned.textures.size).toBe(1);
          const reflection = [...owned.textures][0] as DataTexture;
          expect(reflection).toBeInstanceOf(DataTexture); expect(reflection.image.data).toBeInstanceOf(Uint8Array);
          expect(reflection.image.width).toBe(128 / 2 ** tierIndex); expect(reflection.image.height).toBe(reflection.image.width / 2);
          expect(reflection.image.data.byteLength).toBe(reflection.image.width * reflection.image.height * 4);
          expect(reflection.colorSpace).toBe(SRGBColorSpace);
          expect(reflection.userData).toMatchObject({ provenance: "authored-in-project", qualityTier: tier });
          for (const material of owned.materials) {
            expect(material).toBeInstanceOf(MeshPhysicalMaterial);
            const finish = material as MeshPhysicalMaterial;
            expect(finish.envMap).toBe(reflection); expect(finish.map).toBeNull();
            expect([finish.roughness, finish.clearcoat, finish.clearcoatRoughness].every(value => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true);
          }
          // Source buffers plus generated mip estimate; renderer PMREM is an
          // independently measured GPU lifecycle, not duplicated into this sum.
          const textureBytes = Math.ceil(reflection.image.data.byteLength * 4 / 3);
          expect(textureBytes).toBeLessThanOrEqual(64 * 1024 / 4 ** tierIndex);
          budgets.push({ triangles, textureBytes, geometryBytes: [...owned.geometries].reduce((sum, geometry) => sum
            + Object.values(geometry.attributes).reduce((bytes, attribute) => bytes + attribute.array.byteLength, 0)
            + (geometry.getIndex()?.array.byteLength ?? 0), 0) });
        } finally { stand.dispose(); }
      }
      for (const field of ["geometryBytes", "textureBytes", "triangles"] as const) {
        expect(budgets[0][field], `${kind}/${field}`).toBeGreaterThan(budgets[1][field]);
        expect(budgets[1][field], `${kind}/${field}`).toBeGreaterThan(budgets[2][field]);
      }
    }
    // Distinct actual head meshes, not three labels for one fallback model.
    // This does not establish artistic likeness or portrait approval.
    expect(headIdentities.size).toBe(3);
  });

  it("shares one owned reflection within a stand and disposes independent assemblies exactly once", () => {
    const first = createCeramicPortraitStand("pushkin", "economy"), second = createCeramicPortraitStand("pushkin", "economy");
    const a = resources(first), b = resources(second);
    const listen = (owned: ReturnType<typeof resources>) => [...owned.geometries, ...owned.materials, ...owned.textures].map(resource => {
      const listener = vi.fn();
      if (resource instanceof BufferGeometry) resource.addEventListener("dispose", listener);
      else if (resource instanceof Texture) resource.addEventListener("dispose", listener);
      else resource.addEventListener("dispose", listener);
      return listener;
    });
    const disposedA = listen(a), disposedB = listen(b);
    try {
      expect(a.materials.size).toBeGreaterThan(1); expect(a.textures.size).toBe(1); expect(b.textures.size).toBe(1);
      for (const geometry of a.geometries) expect(b.geometries.has(geometry)).toBe(false);
      for (const material of a.materials) expect(b.materials.has(material)).toBe(false);
      for (const texture of a.textures) expect(b.textures.has(texture)).toBe(false);
      first.dispose(); first.dispose();
      for (const listener of disposedA) expect(listener).toHaveBeenCalledOnce();
      for (const listener of disposedB) expect(listener).not.toHaveBeenCalled();
      expect(first.group.children).toHaveLength(0); expect(second.group.children.length).toBeGreaterThan(0);
      second.dispose(); second.dispose();
      for (const listener of disposedA) expect(listener).toHaveBeenCalledOnce();
      for (const listener of disposedB) expect(listener).toHaveBeenCalledOnce();
    } finally { first.dispose(); second.dispose(); }
  });
});
