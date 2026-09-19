import { createHash } from "node:crypto";
import { BufferGeometry, Camera, DataTexture, Group, Light, Line, Mesh, MeshStandardMaterial,
  Raycaster, Texture, Vector3, type Intersection, type Material } from "three";
import { describe, expect, it, vi } from "vitest";
import { createAntiqueWhaleBodyGeometry } from "./globeAntiqueGeometry";
import { createIncludedGlobeStand } from "./globeStandGeometry";
import { createWhaleStandGeometry } from "./globeWhaleStandGeometry";
import type { GlobeQualityTier } from "./globeQuality";

type WhaleStand = ReturnType<typeof createWhaleStandGeometry>;
const tiers = [
  { tier: "high" as const, longitudinal: 68, radial: 40 },
  { tier: "balanced" as const, longitudinal: 50, radial: 28 },
  { tier: "economy" as const, longitudinal: 34, radial: 20 },
];
const digest = (array: ArrayBufferView) => createHash("sha256")
  .update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength)).digest("hex");

function resources(stand: WhaleStand) {
  const renderables: (Mesh | Line)[] = [], geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>(), textures = new Set<Texture>();
  stand.group.traverse(object => {
    expect(object instanceof Camera || object instanceof Light).toBe(false);
    if (!(object instanceof Mesh || object instanceof Line)) return;
    renderables.push(object); geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  for (const material of materials) for (const value of Object.values(material)) {
    if (value instanceof Texture) textures.add(value);
  }
  return { renderables, geometries, materials, textures };
}

/** A cast appendage must be a closed, consistently wound volume, not a plane
 * hidden by DoubleSide. Weld only coincident render vertices at UV/normal seams. */
function expectClosedCasting(geometry: BufferGeometry, label: string, flatFacets = false, forbidCollapsedFaces = false) {
  const position = geometry.getAttribute("position"), index = geometry.getIndex();
  geometry.computeBoundingBox();
  const center = geometry.boundingBox!.getCenter(new Vector3());
  const a = new Vector3(), b = new Vector3(), c = new Vector3();
  const ab = new Vector3(), ac = new Vector3(), cross = new Vector3(), shadingNormal = new Vector3();
  const edges = new Map<string, { uses: number; direction: number }>();
  let volume = 0, faces = 0, collapsedFaces = 0, minimumFacetAgreement = 1;
  const key = (point: Vector3) => point.toArray().map(value => Math.round(value * 1e6)).join(",");
  for (let offset = 0; offset < (index?.count ?? position.count); offset += 3) {
    a.fromBufferAttribute(position, index ? index.getX(offset) : offset);
    b.fromBufferAttribute(position, index ? index.getX(offset + 1) : offset + 1);
    c.fromBufferAttribute(position, index ? index.getX(offset + 2) : offset + 2);
    ab.subVectors(b, a); ac.subVectors(c, a); cross.crossVectors(ab, ac);
    if (cross.lengthSq() <= ab.lengthSq() * ac.lengthSq() * 1e-12) { collapsedFaces++; continue; }
    const ids = [key(a), key(b), key(c)];
    if (new Set(ids).size < 3) { collapsedFaces++; continue; }
    if (flatFacets) {
      cross.normalize();
      const normals = geometry.getAttribute("normal");
      for (let corner = 0; corner < 3; corner++) {
        shadingNormal.fromBufferAttribute(normals, index ? index.getX(offset + corner) : offset + corner).normalize();
        minimumFacetAgreement = Math.min(minimumFacetAgreement, cross.dot(shadingNormal));
      }
    }
    for (let edge = 0; edge < 3; edge++) {
      const from = ids[edge], to = ids[(edge + 1) % 3];
      const forward = from < to, id = forward ? `${from}/${to}` : `${to}/${from}`;
      const value = edges.get(id) ?? { uses: 0, direction: 0 };
      value.uses++; value.direction += forward ? 1 : -1; edges.set(id, value);
    }
    a.sub(center); b.sub(center); c.sub(center);
    volume += a.dot(cross.crossVectors(b, c)) / 6; faces++;
  }
  const broken = [...edges].find(([, edge]) => edge.uses !== 2 || edge.direction !== 0);
  expect(faces, label).toBeGreaterThan(4);
  expect(broken?.[0] ?? "", `${label}: open or inconsistently wound edge`).toBe("");
  expect(Number.isFinite(volume), label).toBe(true);
  expect(volume, `${label}: outward closed volume`).toBeGreaterThan(1e-8);
  if (forbidCollapsedFaces) expect(collapsedFaces, `${label}: collapsed loft faces`).toBe(0);
  if (flatFacets) expect(minimumFacetAgreement, `${label}: actual flat facet normals`).toBeGreaterThan(0.999);
}

describe("owned three-whale support derived from the canonical globe", () => {
  it("keeps three canonical bodies, closed cast fins and a full-sized support through all detail tiers", () => {
    const allocations: { geometryBytes: number; triangles: number }[] = [];
    for (const { tier, longitudinal, radial } of tiers) {
      const stand = createIncludedGlobeStand("stand.base.three-whales", tier);
      try {
        stand.group.updateMatrixWorld(true);
        const owned = resources(stand);
        const whales = stand.group.children.filter((object): object is Group => object instanceof Group);
        expect(whales.map(whale => whale.name)).toEqual([
          "canonical-gold-whale-1", "canonical-gold-whale-2", "canonical-gold-whale-3",
        ]);
        for (const [index, whale] of whales.entries()) {
          expect(whale.position.toArray()).toEqual([0, 0, 0]); expect(whale.scale.toArray()).toEqual([1, 1, 1]);
          expect(whale.rotation.x).toBe(0); expect(whale.rotation.z).toBe(0);
          expect(whale.rotation.y).toBeCloseTo(index * Math.PI * 2 / 3, 12);
        }
        const bodies = whales.map(whale => whale.getObjectByName("whale-canonical-body"));
        for (const body of bodies) expect(body).toBeInstanceOf(Mesh);
        const bodyGeometry = (bodies[0] as Mesh).geometry;
        expect(new Set(bodies.map(body => (body as Mesh).geometry)).size).toBe(1);
        // The generator already has an independent, pre-change byte fixture in
        // globeAntiqueGeometry.test.ts (8ca9f7e5 / locked Three r178). Reuse that
        // authority at the new quality counts, not a copied analytic formula.
        const canonical = createAntiqueWhaleBodyGeometry({ longitudinalSegments: longitudinal, radialSegments: radial });
        try {
          expect(digest(bodyGeometry.getAttribute("position").array), `${tier}/position`)
            .toBe(digest(canonical.getAttribute("position").array));
          expect(digest(bodyGeometry.getIndex()!.array), `${tier}/index`).toBe(digest(canonical.getIndex()!.array));
        } finally { canonical.dispose(); }
        // Surface topology remains canonical, while the duplicated angular seam
        // and coincident pole vertices must shade continuously after repair.
        const bodyNormals = bodyGeometry.getAttribute("normal"), row = radial + 1;
        const firstNormal = new Vector3(), normal = new Vector3();
        let maximumUnitError = 0, minimumContinuity = 1;
        expect(bodyNormals.array.every(Number.isFinite), `${tier}/body normals`).toBe(true);
        for (let slice = 0; slice <= longitudinal; slice++) {
          firstNormal.fromBufferAttribute(bodyNormals, slice * row);
          for (let ring = 0; ring <= radial; ring++) {
            normal.fromBufferAttribute(bodyNormals, slice * row + ring);
            maximumUnitError = Math.max(maximumUnitError, Math.abs(normal.length() - 1));
            if (ring === radial || slice === 0 || slice === longitudinal) {
              minimumContinuity = Math.min(minimumContinuity, firstNormal.dot(normal));
            }
          }
        }
        expect(maximumUnitError, `${tier}/unit body normals`).toBeLessThan(1e-5);
        expect(minimumContinuity, `${tier}/continuous seam and pole normals`).toBeGreaterThan(1 - 1e-6);

        for (const name of ["whale-rounded-flukes", "whale-left-cast-flipper", "whale-right-cast-flipper", "whale-swept-dorsal-fin"]) {
          const parts = whales.map(whale => whale.getObjectByName(name));
          for (const part of parts) expect(part, name).toBeInstanceOf(Mesh);
          expect(new Set(parts.map(part => (part as Mesh).geometry)).size, name).toBe(1);
          expectClosedCasting((parts[0] as Mesh).geometry, `${tier}/${name}`, false, true);
        }
        const gems = owned.renderables.filter(object => object.name.startsWith("whale-inset-emerald-"));
        expect(gems).toHaveLength(6);
        expect(new Set(gems.map(gem => gem.geometry)).size).toBe(1);
        expect(gems[0].geometry.type).not.toBe("SphereGeometry");
        expectClosedCasting(gems[0].geometry, `${tier}/faceted emerald`, true);
        for (const gem of gems) {
          expect(gem.material).toBeInstanceOf(MeshStandardMaterial);
          const material = gem.material as MeshStandardMaterial;
          expect(material.color.g).toBeGreaterThan(material.color.r);
          expect(material.color.g).toBeGreaterThan(material.color.b);
        }

        let radius = 0, minimumY = Infinity, maximumY = -Infinity, triangles = 0;
        const point = new Vector3(), raycaster = new Raycaster();
        for (const object of owned.renderables) {
          const positions = object.geometry.getAttribute("position"), index = object.geometry.getIndex();
          expect(positions.array.every(Number.isFinite), object.name).toBe(true);
          if (object instanceof Mesh) {
            const normals = object.geometry.getAttribute("normal"), uv = object.geometry.getAttribute("uv");
            expect(normals.count).toBe(positions.count); expect(normals.array.every(Number.isFinite)).toBe(true);
            expect(uv.count).toBe(positions.count); expect(uv.array.every(Number.isFinite)).toBe(true);
            expect((index?.count ?? positions.count) % 3).toBe(0);
            triangles += (index?.count ?? positions.count) / 3;
          }
          if (index) expect(index.array.every(value => Number.isInteger(value) && value >= 0 && value < positions.count)).toBe(true);
          for (let vertex = 0; vertex < positions.count; vertex++) {
            point.fromBufferAttribute(positions, vertex).applyMatrix4(object.matrixWorld);
            radius = Math.max(radius, Math.hypot(point.x, point.z));
            minimumY = Math.min(minimumY, point.y); maximumY = Math.max(maximumY, point.y);
          }
          const hits: Intersection[] = [];
          for (const direction of [[1, 0, 0], [-1, 0, 0], [0, -1, 0], [0, 0, 1]]) {
            raycaster.ray.direction.set(direction[0], direction[1], direction[2]); object.raycast(raycaster, hits);
          }
          expect(object.raycast).not.toBe(object instanceof Mesh ? Mesh.prototype.raycast : Line.prototype.raycast);
          expect(hits, object.name).toEqual([]);
        }
        // This is the source support's own large envelope, including its three
        // lower rings. It must neither include the polar finial/meridians nor
        // be shrunk to the compact museum/wood/book stand's r=.55 envelope.
        expect(radius).toBeGreaterThan(1.38); expect(radius).toBeLessThanOrEqual(1.4);
        expect(minimumY).toBeLessThan(-1.33); expect(minimumY).toBeGreaterThanOrEqual(-1.36);
        expect(maximumY).toBeGreaterThan(-0.85); expect(maximumY).toBeLessThanOrEqual(-0.78);
        expect(owned.renderables.length).toBeLessThanOrEqual(70);
        allocations.push({ triangles, geometryBytes: [...owned.geometries].reduce((bytes, geometry) => bytes
          + Object.values(geometry.attributes).reduce((sum, attribute) => sum + attribute.array.byteLength, 0)
          + (geometry.getIndex()?.array.byteLength ?? 0), 0) });
      } finally { stand.dispose(); }
    }
    for (const field of ["geometryBytes", "triangles"] as const) {
      expect(allocations[0][field], field).toBeGreaterThan(allocations[1][field]);
      expect(allocations[1][field], field).toBeGreaterThan(allocations[2][field]);
    }
  });

  it("owns independent assemblies and retires each geometry, material and borrowed map once", () => {
    const first = createWhaleStandGeometry("economy"), second = createWhaleStandGeometry("economy");
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
      for (const geometry of a.geometries) expect(b.geometries.has(geometry)).toBe(false);
      for (const material of a.materials) expect(b.materials.has(material)).toBe(false);
      for (const texture of a.textures) { expect(texture).toBeInstanceOf(DataTexture); expect(b.textures.has(texture)).toBe(false); }
      first.dispose(); first.dispose();
      for (const listener of disposedA) expect(listener).toHaveBeenCalledOnce();
      for (const listener of disposedB) expect(listener).not.toHaveBeenCalled();
      expect(first.group.children).toHaveLength(0); expect(second.group.children.length).toBeGreaterThan(0);
      second.dispose(); second.dispose();
      for (const listener of disposedA) expect(listener).toHaveBeenCalledOnce();
      for (const listener of disposedB) expect(listener).toHaveBeenCalledOnce();
    } finally { first.dispose(); second.dispose(); }
  });

  it("rejects unsupported quality before making a stand", () => {
    for (const tier of ["automatic", "constructor", "HIGH"]) {
      expect(() => createWhaleStandGeometry(tier as GlobeQualityTier)).toThrow("Invalid whale stand quality");
    }
  });
});
