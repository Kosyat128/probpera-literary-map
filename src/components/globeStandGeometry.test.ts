import { BufferGeometry, DataTexture, LOD, Matrix4, Mesh, PerspectiveCamera, Raycaster, Texture, Vector3, type Intersection, type Material } from "three";
import { describe, expect, it, vi } from "vitest";
import type { IncludedGlobeStandId } from "../planet/globeStands";
import { createIncludedGlobeStand } from "./globeStandGeometry";
import type { GlobeQualityTier } from "./globeQuality";

const stands: readonly IncludedGlobeStandId[] = ["stand.base.museum", "stand.base.wood", "stand.base.book-stack"];
const tiers: readonly GlobeQualityTier[] = ["high", "balanced", "economy"];
type Stand = ReturnType<typeof createIncludedGlobeStand>;
function resources(stand: Stand) {
  const geometries = new Set<BufferGeometry>(), materials = new Set<Material>(), textures = new Set<Texture>();
  stand.group.traverse(object => {
    if (!(object instanceof Mesh)) return;
    geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  for (const material of materials) for (const value of Object.values(material)) {
    if (value instanceof Texture) textures.add(value);
  }
  return { geometries, materials, textures };
}

describe("included adult stand geometry and resource ownership", () => {
  it.each(stands)("keeps every transformed vertex of %s inside the reserved stand volume at all tiers", id => {
    const budgets: { geometryBytes: number; textureBytes: number; triangles: number }[] = [];
    for (const [tierIndex, tier] of tiers.entries()) {
      const stand = createIncludedGlobeStand(id, tier);
      try {
        stand.group.updateMatrixWorld(true);
        if (id === "stand.base.book-stack") {
          const detail = stand.group.getObjectByName("book-page-cut-detail");
          expect(detail).toBeInstanceOf(LOD);
          if (detail instanceof LOD) {
            const camera = new PerspectiveCamera();
            camera.position.set(0, -1.25, 1); camera.updateMatrixWorld(); detail.update(camera);
            expect(detail.levels[0].object.visible).toBe(true);
            camera.position.z = 4; camera.updateMatrixWorld(); detail.update(camera);
            expect(detail.levels[0].object.visible).toBe(false);
            expect(detail.levels[1].object.visible).toBe(true);
          }
        }
        let meshes = 0, vertices = 0, triangles = 0, validBounds = true, validNormals = true, validIndices = true;
        let minimumY = Infinity, maximumY = -Infinity, maximumRadius = 0;
        let checkedFaces = 0, minimumNormalAgreement = 1, leastAlignedFace = "";
        let woodenCapFaces = 0, collapsedCapUv = "";
        const point = new Vector3(), relative = new Matrix4();
        const faceA = new Vector3(), faceB = new Vector3(), faceC = new Vector3();
        const edgeAB = new Vector3(), edgeAC = new Vector3(), faceNormal = new Vector3(), averageNormal = new Vector3();
        stand.group.traverse(object => {
          if (!(object instanceof Mesh)) return;
          meshes++;
          const position = object.geometry.getAttribute("position"), normal = object.geometry.getAttribute("normal");
          expect(position).toBeDefined(); expect(position.itemSize).toBe(3);
          expect(normal).toBeDefined(); expect(normal.count).toBe(position.count);
          const uv = object.geometry.getAttribute("uv");
          expect(uv).toBeDefined(); expect(uv.itemSize).toBe(2); expect(uv.count).toBe(position.count);
          expect(uv.array.every(Number.isFinite)).toBe(true);
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
          triangles += (index?.count ?? position.count) / 3;
          if (index) {
            validIndices &&= index.count > 0 && index.count % 3 === 0
              && index.array.every((value: number) => Number.isInteger(value) && value >= 0 && value < position.count);
          } else validIndices &&= position.count % 3 === 0;
          for (let offset = 0; offset < (index?.count ?? position.count); offset += 3) {
            const a = index ? index.getX(offset) : offset;
            const b = index ? index.getX(offset + 1) : offset + 1;
            const c = index ? index.getX(offset + 2) : offset + 2;
            faceA.fromBufferAttribute(position, a); faceB.fromBufferAttribute(position, b); faceC.fromBufferAttribute(position, c);
            edgeAB.subVectors(faceB, faceA); edgeAC.subVectors(faceC, faceA);
            faceNormal.crossVectors(edgeAB, edgeAC);
            // Ignore collapsed pole/seam triangles, but retain thin board faces.
            if (faceNormal.lengthSq() <= edgeAB.lengthSq() * edgeAC.lengthSq() * 1e-12) continue;
            averageNormal.set(
              normal.getX(a) + normal.getX(b) + normal.getX(c),
              normal.getY(a) + normal.getY(b) + normal.getY(c),
              normal.getZ(a) + normal.getZ(b) + normal.getZ(c),
            ).normalize();
            const agreement = faceNormal.normalize().dot(averageNormal);
            if ((object.name === "wood-turned-body" || object.name === "wood-underfoot")
              && Math.abs(faceNormal.y) > 1 - 1e-6) {
              woodenCapFaces++;
              const uAB = uv.getX(b) - uv.getX(a), vAB = uv.getY(b) - uv.getY(a);
              const uAC = uv.getX(c) - uv.getX(a), vAC = uv.getY(c) - uv.getY(a);
              const doubleUvArea = uAB * vAC - vAB * uAC;
              // A finite UV array can still collapse an entire visible cap
              // triangle to one line and produce radial streaks in the finish.
              if (doubleUvArea ** 2 <= (uAB ** 2 + vAB ** 2) * (uAC ** 2 + vAC ** 2) * 1e-12) {
                collapsedCapUv ||= `${object.name} triangle ${offset / 3}`;
              }
            }
            checkedFaces++;
            if (agreement < minimumNormalAgreement) {
              minimumNormalAgreement = agreement;
              leastAlignedFace = `${object.name} triangle ${offset / 3}`;
            }
          }
          const aim = new Vector3();
          for (let corner = 0; corner < 3; corner++) {
            point.fromBufferAttribute(position, index ? index.getX(corner) : corner).applyMatrix4(relative);
            aim.add(point);
          }
          const hits: Intersection[] = [];
          object.raycast(new Raycaster(new Vector3(), aim.normalize()), hits);
          expect(object.raycast).not.toBe(Mesh.prototype.raycast);
          expect(hits).toEqual([]);
        });
        expect(meshes, `${id}/${tier}`).toBeGreaterThan(0); expect(vertices).toBeGreaterThan(0);
        expect(validBounds, `${id}/${tier} world bounds`).toBe(true);
        expect(validNormals, `${id}/${tier} finite normals`).toBe(true);
        expect(checkedFaces, `${id}/${tier} nondegenerate faces`).toBeGreaterThan(0);
        expect(minimumNormalAgreement, `${id}/${tier} outward normals: ${leastAlignedFace}`).toBeGreaterThanOrEqual(-1e-5);
        if (id === "stand.base.wood") {
          expect(woodenCapFaces, `${tier} actual wooden cap faces`).toBeGreaterThan(0);
          expect(collapsedCapUv, `${tier} noncollapsed wooden cap UV`).toBe("");
        }
        expect(validIndices, `${id}/${tier} topology`).toBe(true);
        expect(maximumY - minimumY).toBeGreaterThan(0.1);
        expect(maximumRadius).toBeGreaterThan(0.15);
        const owned = resources(stand);
        expect(owned.geometries.size).toBeGreaterThan(0); expect(owned.materials.size).toBeGreaterThan(0);
        expect(meshes).toBeLessThanOrEqual(40); expect(triangles).toBeLessThanOrEqual(70000);
        expect(owned.textures.size).toBeGreaterThan(0);
        for (const texture of owned.textures) expect(texture).toBeInstanceOf(DataTexture);
        const geometryBytes = [...owned.geometries].reduce((sum, geometry) => sum
          + Object.values(geometry.attributes).reduce((size, attribute) => size + attribute.array.byteLength, 0)
          + (geometry.getIndex()?.array.byteLength ?? 0), 0);
        // Source DataTextures plus mips; browser evidence accounts for generated PMREM.
        const textureBytes = [...owned.textures].reduce((sum, texture) => sum
          + Math.ceil((texture as DataTexture).image.data.byteLength * (texture.generateMipmaps ? 4 / 3 : 1)), 0);
        expect(textureBytes).toBeLessThanOrEqual(5.5 * 1024 ** 2 / 4 ** tierIndex);
        budgets.push({ geometryBytes, textureBytes, triangles });
      } finally {
        stand.dispose();
      }
    }
    for (const field of ["geometryBytes", "textureBytes", "triangles"] as const) {
      expect(budgets[1][field], `${id}/${field}`).toBeLessThan(budgets[0][field]);
      expect(budgets[2][field], `${id}/${field}`).toBeLessThan(budgets[1][field]);
    }
  });

  it("disposes each owned GPU resource once without disposing another live stand", () => {
    const first = createIncludedGlobeStand("stand.base.wood", "high");
    const second = createIncludedGlobeStand("stand.base.wood", "high");
    const ownedFirst = resources(first), ownedSecond = resources(second);
    const firstEvents = [...ownedFirst.geometries, ...ownedFirst.materials, ...ownedFirst.textures].map(resource => {
      const listener = vi.fn();
      if (resource instanceof Texture) resource.addEventListener("dispose", listener);
      else if (resource instanceof BufferGeometry) resource.addEventListener("dispose", listener);
      else resource.addEventListener("dispose", listener);
      return listener;
    });
    const secondEvents = [...ownedSecond.geometries, ...ownedSecond.materials, ...ownedSecond.textures].map(resource => {
      const listener = vi.fn();
      if (resource instanceof Texture) resource.addEventListener("dispose", listener);
      else if (resource instanceof BufferGeometry) resource.addEventListener("dispose", listener);
      else resource.addEventListener("dispose", listener);
      return listener;
    });
    try {
      for (const geometry of ownedFirst.geometries) expect(ownedSecond.geometries.has(geometry)).toBe(false);
      for (const material of ownedFirst.materials) expect(ownedSecond.materials.has(material)).toBe(false);
      for (const texture of ownedFirst.textures) expect(ownedSecond.textures.has(texture)).toBe(false);
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
