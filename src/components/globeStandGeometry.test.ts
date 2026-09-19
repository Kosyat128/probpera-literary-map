import { BufferGeometry, DataTexture, LOD, Matrix4, Mesh, MeshStandardMaterial, NoColorSpace, PerspectiveCamera, Raycaster,
  RGBAFormat, SRGBColorSpace, Texture, UnsignedByteType, Vector3, type Intersection, type Material } from "three";
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

type SourceMip = { data: ArrayBufferView; width: number; height: number };
function sourceTextureBytes(texture: DataTexture) {
  if (texture.generateMipmaps) return Math.ceil(texture.image.data.byteLength * 4 / 3);
  // A supplied mip chain owns real buffers. Its level zero shares image.data;
  // count each backing allocation once, including every smaller manual level.
  const buffers = new Set([texture.image.data.buffer]);
  for (const mip of (texture.mipmaps ?? []) as SourceMip[]) buffers.add(mip.data.buffer);
  return [...buffers].reduce((sum, buffer) => sum + buffer.byteLength, 0);
}

function turnedWoodAtlas(stand: Stand, owned: ReturnType<typeof resources>, tier: GlobeQualityTier, tierIndex: number) {
  const finishes = ["wood-turned-body", "wood-underfoot", "wooden-joinery-details"].map(name => {
    const object = stand.group.getObjectByName(name);
    expect(object, name).toBeInstanceOf(Mesh);
    if (!(object instanceof Mesh)) throw new Error(`Missing wood atlas surface: ${name}`);
    expect(object.material, name).toBeInstanceOf(MeshStandardMaterial);
    return object.material as MeshStandardMaterial;
  });
  const atlasTextures = new Set<Texture>();
  for (const [role, width, height] of [["map", 256, 128], ["normalMap", 128, 64], ["roughnessMap", 64, 32]] as const) {
    const texture = finishes[0][role] as DataTexture;
    expect(texture, role).toBeInstanceOf(DataTexture);
    for (const material of finishes) expect(material[role], `${material.name}/${role}`).toBe(texture);
    expect(owned.textures.has(texture)).toBe(true); atlasTextures.add(texture);
    expect(texture.image.width).toBe(width / 2 ** tierIndex); expect(texture.image.height).toBe(height / 2 ** tierIndex);
    expect(texture.image.data).toBeInstanceOf(Uint8Array);
    expect(texture.image.data.byteLength).toBe(texture.image.width * texture.image.height * 4);
    expect(texture.format).toBe(RGBAFormat); expect(texture.type).toBe(UnsignedByteType);
    expect(texture.colorSpace).toBe(role === "map" ? SRGBColorSpace : NoColorSpace);
    expect(texture.name).toBe(`turned-wood:${role === "map" ? "albedo" : role === "normalMap" ? "normal" : "roughness"}`);
    expect(texture.userData).toMatchObject({ provenance: "authored-in-project", qualityTier: tier, atlasLayout: "turned-wood-v1" });
    expect(texture.generateMipmaps).toBe(false);
    const mips = texture.mipmaps as SourceMip[];
    expect(mips.length).toBeGreaterThan(1); expect(mips[0].data).toBe(texture.image.data);
    let mipWidth = texture.image.width, mipHeight = texture.image.height;
    for (const mip of mips) {
      expect([mip.width, mip.height], texture.name).toEqual([mipWidth, mipHeight]);
      expect(mip.data).toBeInstanceOf(Uint8Array); expect(mip.data.byteLength).toBe(mipWidth * mipHeight * 4);
      mipWidth = Math.max(1, Math.floor(mipWidth / 2)); mipHeight = Math.max(1, Math.floor(mipHeight / 2));
    }
    expect([mips[mips.length - 1].width, mips[mips.length - 1].height]).toEqual([1, 1]);
    expect(mips.length).toBe(Math.log2(texture.image.width) + 1);
    if (role === "normalMap") {
      const pixels = texture.image.data as Uint8Array;
      let valid = true, varying = false;
      for (let offset = 0; offset < pixels.length; offset += 4) {
        const x = pixels[offset] / 127.5 - 1, y = pixels[offset + 1] / 127.5 - 1, z = pixels[offset + 2] / 127.5 - 1;
        valid &&= z > 0 && Math.abs(Math.hypot(x, y, z) - 1) < 0.012 && pixels[offset + 3] === 255;
        varying ||= pixels[offset] !== pixels[0] || pixels[offset + 1] !== pixels[1];
      }
      expect(valid, `${tier} encoded wood atlas normals`).toBe(true);
      expect(varying, `${tier} physical wood relief`).toBe(true);
    }
  }
  // The three finishes borrow one owned atlas rather than allocating another
  // texture copy for each lathe or joinery batch. Decorative rings retain their
  // separate tiled finish, so their standard torus UVs cannot cross atlas charts.
  expect(atlasTextures.size).toBe(3);
}

describe("included adult stand geometry and resource ownership", () => {
  it.each(stands)("keeps every transformed vertex of %s inside the reserved stand volume at all tiers", id => {
    const budgets: { geometryBytes: number; textureBytes: number; triangles: number }[] = [];
    for (const [tierIndex, tier] of tiers.entries()) {
      const stand = createIncludedGlobeStand(id, tier);
      const retainedTextures = id === "stand.base.wood" ? vi.spyOn(Texture.prototype, "dispose") : null;
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
        let misplacedAtlasFace = "";
        const atlasSurfaces = new Set<string>();
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
          const usesWoodAtlas = object.material instanceof MeshStandardMaterial
            && object.material.map?.name === "turned-wood:albedo";
          if (usesWoodAtlas) atlasSurfaces.add(object.name);
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
            if (usesWoodAtlas) {
              // Check actual face orientation against the authored chart
              // binding, independently of geometry metadata or the UV mapper.
              const isLathe = object.name === "wood-turned-body" || object.name === "wood-underfoot";
              const flat = Math.abs(faceNormal.y) > 1 - 1e-6;
              const chart = !isLathe || flat ? [1 / 32, 15 / 32, 1 / 32, 15 / 32]
                : object.name === "wood-turned-body" ? [1 / 32, 31 / 32, 17 / 32, 31 / 32]
                  : [17 / 32, 31 / 32, 1 / 32, 15 / 32];
              for (const corner of [a, b, c]) {
                if (uv.getX(corner) < chart[0] - 1e-6 || uv.getX(corner) > chart[1] + 1e-6
                  || uv.getY(corner) < chart[2] - 1e-6 || uv.getY(corner) > chart[3] + 1e-6) {
                  misplacedAtlasFace ||= `${object.name} triangle ${offset / 3}`;
                }
              }
            }
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
          expect([...atlasSurfaces].sort()).toEqual(["wood-turned-body", "wood-underfoot", "wooden-joinery-details"]);
          expect(misplacedAtlasFace, `${tier} actual face-to-atlas chart binding`).toBe("");
        }
        expect(validIndices, `${id}/${tier} topology`).toBe(true);
        expect(maximumY - minimumY).toBeGreaterThan(0.1);
        expect(maximumRadius).toBeGreaterThan(0.15);
        const owned = resources(stand);
        if (id === "stand.base.wood") turnedWoodAtlas(stand, owned, tier, tierIndex);
        expect(owned.geometries.size).toBeGreaterThan(0); expect(owned.materials.size).toBeGreaterThan(0);
        expect(meshes).toBeLessThanOrEqual(40); expect(triangles).toBeLessThanOrEqual(70000);
        expect(owned.textures.size).toBeGreaterThan(0);
        for (const texture of owned.textures) expect(texture).toBeInstanceOf(DataTexture);
        const geometryBytes = [...owned.geometries].reduce((sum, geometry) => sum
          + Object.values(geometry.attributes).reduce((size, attribute) => size + attribute.array.byteLength, 0)
          + (geometry.getIndex()?.array.byteLength ?? 0), 0);
        // Source DataTextures plus mips; browser evidence accounts for generated PMREM.
        let textureBytes = [...owned.textures].reduce((sum, texture) => sum
          + sourceTextureBytes(texture as DataTexture), 0);
        if (retainedTextures) {
          // The craft owner also retains finishes unused by this particular
          // stand. Observe its real disposal, preserving the original method,
          // so the full 16-map palette plus atlas stays inside the same cap.
          stand.dispose();
          const textures = new Set(retainedTextures.mock.contexts.filter((value): value is DataTexture => value instanceof DataTexture));
          const expectedNames = [
            ...["wood", "brass", "leather", "paper", "stone"].flatMap(kind =>
              ["albedo", "normal", "roughness"].map(role => `original-craft:${kind}-${role}:${tier}`)),
            `original-craft:window-reflections:${tier}`, "turned-wood:albedo", "turned-wood:normal", "turned-wood:roughness",
          ];
          expect([...textures].map(texture => texture.name).sort()).toEqual(expectedNames.sort());
          expect(retainedTextures).toHaveBeenCalledTimes(expectedNames.length);
          for (const texture of owned.textures) expect(textures.has(texture as DataTexture)).toBe(true);
          textureBytes = [...textures].reduce((sum, texture) => sum + sourceTextureBytes(texture), 0);
        }
        expect(textureBytes).toBeLessThanOrEqual(5.5 * 1024 ** 2 / 4 ** tierIndex);
        budgets.push({ geometryBytes, textureBytes, triangles });
      } finally {
        try { stand.dispose(); } finally { retainedTextures?.mockRestore(); }
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
