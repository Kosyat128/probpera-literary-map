import { Matrix4, Mesh, Texture, Vector3, type BufferGeometry, type Material } from "three";
import { describe, expect, it, vi } from "vitest";
import type { IncludedGlobeStandId } from "../planet/globeStands";
import { createIncludedGlobeStand } from "./globeStandGeometry";
import type { GlobeQualityTier } from "./globeQuality";

const stands: readonly IncludedGlobeStandId[] = ["stand.base.museum", "stand.base.wood", "stand.base.book-stack"];
const tiers: readonly GlobeQualityTier[] = ["high", "balanced", "economy"];
type Stand = ReturnType<typeof createIncludedGlobeStand>;
function resources(stand: Stand) {
  const geometries = new Set<BufferGeometry>(), materials = new Set<Material>();
  stand.group.traverse(object => {
    if (!(object instanceof Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  return { geometries, materials };
}

describe("included adult stand geometry and resource ownership", () => {
  it.each(stands)("keeps every transformed vertex of %s inside the reserved stand volume at all tiers", id => {
    for (const tier of tiers) {
      const stand = createIncludedGlobeStand(id, tier);
      try {
        stand.group.updateMatrixWorld(true);
        let meshes = 0, vertices = 0, validBounds = true, validNormals = true, validIndices = true;
        let minimumY = Infinity, maximumY = -Infinity, maximumRadius = 0;
        const point = new Vector3(), relative = new Matrix4();
        stand.group.traverse(object => {
          if (!(object instanceof Mesh)) return;
          meshes++;
          const position = object.geometry.getAttribute("position"), normal = object.geometry.getAttribute("normal");
          expect(position).toBeDefined(); expect(position.itemSize).toBe(3);
          expect(normal).toBeDefined(); expect(normal.count).toBe(position.count);
          relative.copy(object.matrixWorld);
          for (let vertex = 0; vertex < position.count; vertex++) {
            vertices++;
            point.fromBufferAttribute(position, vertex).applyMatrix4(relative);
            const radius = Math.hypot(point.x, point.z);
            validBounds &&= [point.x, point.y, point.z].every(Number.isFinite)
              && radius <= 0.55 + 1e-6 && point.y >= -1.44 - 1e-6 && point.y <= -1.03 + 1e-6;
            minimumY = Math.min(minimumY, point.y); maximumY = Math.max(maximumY, point.y);
            maximumRadius = Math.max(maximumRadius, radius);
            validNormals &&= [normal.getX(vertex), normal.getY(vertex), normal.getZ(vertex)].every(Number.isFinite);
          }
          const index = object.geometry.getIndex();
          if (index) {
            validIndices &&= index.count > 0 && index.count % 3 === 0
              && index.array.every((value: number) => Number.isInteger(value) && value >= 0 && value < position.count);
          } else validIndices &&= position.count % 3 === 0;
        });
        expect(meshes, `${id}/${tier}`).toBeGreaterThan(0); expect(vertices).toBeGreaterThan(0);
        expect(validBounds, `${id}/${tier} world bounds`).toBe(true);
        expect(validNormals, `${id}/${tier} finite normals`).toBe(true);
        expect(validIndices, `${id}/${tier} topology`).toBe(true);
        expect(maximumY - minimumY).toBeGreaterThan(0.1);
        expect(maximumRadius).toBeGreaterThan(0.15);
        const owned = resources(stand);
        expect(owned.geometries.size).toBeGreaterThan(0); expect(owned.materials.size).toBeGreaterThan(0);
        // These original procedural models must not acquire texture dependencies.
        for (const material of owned.materials) {
          expect(Object.values(material).some(value => value instanceof Texture)).toBe(false);
        }
      } finally {
        stand.dispose();
      }
    }
  });

  it("reduces actual allocated geometry buffers for each stand at lower detail", () => {
    for (const id of stands) {
      const bytes = tiers.map(tier => {
        const stand = createIncludedGlobeStand(id, tier);
        try {
          return [...resources(stand).geometries].reduce((sum, geometry) => sum
            + Object.values(geometry.attributes).reduce((size, attribute) => size + attribute.array.byteLength, 0)
            + (geometry.getIndex()?.array.byteLength ?? 0), 0);
        } finally { stand.dispose(); }
      });
      expect(bytes[1], id).toBeLessThan(bytes[0]); expect(bytes[2], id).toBeLessThan(bytes[1]);
    }
  });

  it("disposes each owned GPU resource once without disposing another live stand", () => {
    const first = createIncludedGlobeStand("stand.base.wood", "high");
    const second = createIncludedGlobeStand("stand.base.wood", "high");
    const ownedFirst = resources(first), ownedSecond = resources(second);
    const firstEvents = [...ownedFirst.geometries, ...ownedFirst.materials].map(resource => {
      const listener = vi.fn(); resource.addEventListener("dispose", listener); return listener;
    });
    const secondEvents = [...ownedSecond.geometries, ...ownedSecond.materials].map(resource => {
      const listener = vi.fn(); resource.addEventListener("dispose", listener); return listener;
    });
    try {
      for (const geometry of ownedFirst.geometries) expect(ownedSecond.geometries.has(geometry)).toBe(false);
      for (const material of ownedFirst.materials) expect(ownedSecond.materials.has(material)).toBe(false);
      first.dispose(); first.dispose();
      for (const listener of firstEvents) expect(listener).toHaveBeenCalledOnce();
      for (const listener of secondEvents) expect(listener).not.toHaveBeenCalled();
      expect(resources(second).geometries.size).toBe(ownedSecond.geometries.size);
      second.dispose(); second.dispose();
      for (const listener of secondEvents) expect(listener).toHaveBeenCalledOnce();
      for (const listener of firstEvents) expect(listener).toHaveBeenCalledOnce();
    } finally { first.dispose(); second.dispose(); }
  });

  it("rejects child, canonical and unknown stand requests instead of manufacturing an included model", () => {
    for (const id of ["canonical", "stand.base.child-book-cloud", "wood", "constructor"]) {
      expect(() => createIncludedGlobeStand(id as IncludedGlobeStandId, "high")).toThrow("Invalid included globe stand");
    }
    expect(() => createIncludedGlobeStand("stand.base.wood", "automatic" as GlobeQualityTier)).toThrow("Invalid included globe stand");
  });
});
