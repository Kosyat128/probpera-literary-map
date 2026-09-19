import { BufferGeometry, Camera, DataTexture, InstancedMesh, Light, Line3, Matrix4, Mesh, NoColorSpace, PointLight, Raycaster, Texture, Triangle, Vector3,
  type Intersection, type Material, type MeshStandardMaterial } from "three";
import { describe, expect, it, vi } from "vitest";
import { createGlobeLibrary } from "./globeLibraryGeometry";
import type { GlobeQualityTier } from "./globeQuality";

const tiers: readonly GlobeQualityTier[] = ["high", "balanced", "economy"];
type Library = ReturnType<typeof createGlobeLibrary>;
function collect(library: Library) {
  const meshes: Mesh[] = [], geometries = new Set<BufferGeometry>(), materials = new Set<Material>();
  const lights: PointLight[] = [], textures = new Set<Texture>();
  library.group.traverse(object => {
    expect(object instanceof Camera).toBe(false);
    if (object instanceof Light) {
      expect(object).toBeInstanceOf(PointLight);
      if (object instanceof PointLight) lights.push(object);
    }
    if (!(object instanceof Mesh)) return;
    meshes.push(object); geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  for (const material of materials) for (const value of Object.values(material)) {
    if (value instanceof Texture) textures.add(value);
  }
  expect(lights.length).toBeLessThanOrEqual(2);
  for (const light of lights) {
    expect(light.getWorldPosition(new Vector3()).length()).toBeGreaterThanOrEqual(8);
    expect(light.distance).toBeGreaterThan(0); expect(light.distance).toBeLessThanOrEqual(4);
    expect(Number.isFinite(light.intensity)).toBe(true); expect(light.intensity).toBeGreaterThanOrEqual(0);
    expect(light.castShadow).toBe(false); expect(light.shadow.map).toBeNull();
  }
  expect(lights.map(light => light.name).sort()).toEqual(["library-sconce-light", "library-window-daylight"]);
  for (const [name, emitterName, maximumOffset] of [
    ["library-window-daylight", "library-window-glazing", 0.8],
    ["library-sconce-light", "library-reading-lamps", 0.05],
  ] as const) {
    const light = lights.find(value => value.name === name)!;
    const emitter = library.group.getObjectByName(emitterName);
    expect(emitter, name).toBeInstanceOf(InstancedMesh);
    if (!(emitter instanceof InstancedMesh)) throw new Error("Missing physical light source");
    expect(light.userData.emitterMesh).toBe(emitterName);
    const instance = light.userData.emitterInstance;
    expect(Number.isSafeInteger(instance)).toBe(true);
    expect(instance).toBeGreaterThanOrEqual(0); expect(instance).toBeLessThan(emitter.count);
    emitter.geometry.computeBoundingBox();
    const world = new Matrix4(); emitter.getMatrixAt(instance, world);
    world.premultiply(emitter.matrixWorld);
    const sourceCenter = emitter.geometry.boundingBox!.getCenter(new Vector3()).applyMatrix4(world);
    // Measure real emitter geometry after its instance transform; the metadata
    // offset alone cannot turn a floating light into a visible source.
    expect(light.getWorldPosition(new Vector3()).distanceTo(sourceCenter), name).toBeLessThanOrEqual(maximumOffset);
  }
  return { meshes, geometries, materials, textures, lights };
}

describe("procedural library geometry around the whole canonical camera envelope", () => {
  it.each(tiers)("keeps every %s triangle outside r=5.6, including transformed instance faces", tier => {
    const library = createGlobeLibrary(tier);
    try {
      library.group.updateMatrixWorld(true);
      expect(library.group.children.map(layer => layer.name).sort()).toEqual([
        "library-background", "library-foreground", "library-midground",
      ]);
      const { meshes, textures } = collect(library);
      expect(meshes.length).toBeGreaterThan(0); expect(meshes.length).toBeLessThanOrEqual(55);
      const origin = new Vector3(), nearest = new Vector3();
      const triangle = new Triangle(), local = new Matrix4(), world = new Matrix4();
      const edgeAB = new Vector3(), edgeAC = new Vector3(), areaNormal = new Vector3(), segment = new Line3();
      const sides = [[triangle.a, triangle.b], [triangle.b, triangle.c], [triangle.c, triangle.a]];
      const depth = new Map<string, { faces: number; furthestRadius: number }>();
      let minimumDistance = Infinity, closestFace = "", faceCount = 0, allFinite = true;
      for (const mesh of meshes) {
        const pickingDirection = new Vector3();
        let layer = mesh.parent!;
        while (layer.parent && layer.parent !== library.group) layer = layer.parent;
        const layerEvidence = depth.get(layer.name) ?? { faces: 0, furthestRadius: 0 };
        depth.set(layer.name, layerEvidence);
        const positions = mesh.geometry.getAttribute("position"), normals = mesh.geometry.getAttribute("normal");
        const index = mesh.geometry.getIndex();
        expect(positions.itemSize).toBe(3); expect(positions.count).toBeGreaterThan(0);
        expect(positions.array.every(Number.isFinite)).toBe(true);
        expect(normals.array.every(Number.isFinite)).toBe(true);
        const uv = mesh.geometry.getAttribute("uv");
        expect(uv, mesh.name).toBeDefined(); expect(uv.itemSize).toBe(2); expect(uv.count).toBe(positions.count);
        expect(uv.array.every(Number.isFinite)).toBe(true);
        if (index) expect(index.array.every((value: number) => Number.isInteger(value) && value >= 0 && value < positions.count)).toBe(true);
        const count = index?.count ?? positions.count;
        expect(count % 3).toBe(0);
        for (let instance = 0; instance < (mesh instanceof InstancedMesh ? mesh.count : 1); instance++) {
          if (mesh instanceof InstancedMesh) {
            mesh.getMatrixAt(instance, local); world.multiplyMatrices(mesh.matrixWorld, local);
          } else world.copy(mesh.matrixWorld);
          expect(world.elements.every(Number.isFinite)).toBe(true);
          for (let face = 0; face < count; face += 3) {
            for (const [corner, vertex] of [triangle.a, triangle.b, triangle.c].entries()) {
              vertex.fromBufferAttribute(positions, index ? index.getX(face + corner) : face + corner).applyMatrix4(world);
              layerEvidence.furthestRadius = Math.max(layerEvidence.furthestRadius, Math.hypot(vertex.x, vertex.z));
            }
            edgeAB.subVectors(triangle.b, triangle.a); edgeAC.subVectors(triangle.c, triangle.a);
            const longestEdgeSquared = Math.max(edgeAB.lengthSq(), edgeAC.lengthSq(), triangle.b.distanceToSquared(triangle.c));
            const squaredDoubleArea = areaNormal.crossVectors(edgeAB, edgeAC).lengthSq();
            let distance: number;
            if (squaredDoubleArea <= longestEdgeSquared ** 2 * 1e-12) {
              // Lathe poles contain coincident vertices. Three's triangle
              // barycentric divisions are undefined there; test the whole
              // collapsed face as its three finite segments, including points.
              distance = Infinity;
              for (const [start, end] of sides) {
                if (start.distanceToSquared(end) === 0) nearest.copy(start);
                else segment.set(start, end).closestPointToPoint(origin, true, nearest);
                distance = Math.min(distance, nearest.length());
              }
              // A nearly collinear face can still have a thin interior. Its
              // altitude bounds that interior's distance from the longest
              // side, so subtract it to retain a conservative clearance proof.
              if (longestEdgeSquared > 0) distance = Math.max(0, distance - Math.sqrt(squaredDoubleArea / longestEdgeSquared));
            } else {
              triangle.closestPointToPoint(origin, nearest);
              distance = nearest.length();
            }
            if (instance === 0 && face === 0) triangle.getMidpoint(pickingDirection).normalize();
            allFinite &&= Number.isFinite(distance);
            if (distance < minimumDistance) { minimumDistance = distance; closestFace = `${mesh.name} instance ${instance} face ${face / 3}`; }
            faceCount++; layerEvidence.faces++;
          }
        }
        // Actual ray dispatch must remain empty: the room cannot intercept globe picking.
        const raycaster = new Raycaster();
        const hits: Intersection[] = [];
        raycaster.ray.direction.copy(pickingDirection);
        mesh.raycast(raycaster, hits);
        for (const direction of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
          raycaster.ray.direction.set(direction[0], direction[1], direction[2]);
          mesh.raycast(raycaster, hits);
        }
        expect(hits, mesh.name).toEqual([]);
      }
      expect(faceCount).toBeGreaterThan(0); expect(allFinite).toBe(true);
      expect(minimumDistance, `${tier}: ${closestFace}`).toBeGreaterThanOrEqual(5.6 - 1e-5);
      for (const name of ["library-foreground", "library-midground", "library-background"]) {
        expect(depth.get(name)?.faces, name).toBeGreaterThan(0);
      }
      // Confirm actual spatial depth, independently of the three group names.
      expect(depth.get("library-foreground")!.furthestRadius).toBeLessThan(depth.get("library-midground")!.furthestRadius);
      expect(depth.get("library-midground")!.furthestRadius).toBeLessThan(depth.get("library-background")!.furthestRadius);
      expect(textures.size).toBeGreaterThan(0);
      for (const texture of textures) {
        expect(texture).toBeInstanceOf(DataTexture);
        expect(texture.userData.provenance).toBe("authored-in-project");
        expect(texture.userData.qualityTier).toBe(tier);
      }
      for (const name of ["library-cabinet-contact-occlusion", "library-shelf-contact-occlusion", "library-gallery-contact-occlusion"]) {
        const surface = library.group.getObjectByName(name);
        expect(surface, name).toBeInstanceOf(Mesh);
        if (!(surface instanceof Mesh) || Array.isArray(surface.material)) throw new Error("Missing owned occlusion surface");
        const material = surface.material as MeshStandardMaterial;
        expect(material.transparent).toBe(true); expect(material.depthWrite).toBe(false);
        expect(material.opacity).toBeGreaterThan(0); expect(material.opacity).toBeLessThanOrEqual(1);
        expect(material.alphaMap).toBeInstanceOf(DataTexture);
        const alphaMap = material.alphaMap as DataTexture;
        expect(textures.has(alphaMap)).toBe(true); expect(alphaMap.colorSpace).toBe(NoColorSpace);
        const dimension = tier === "high" ? 64 : tier === "balanced" ? 32 : 16;
        expect(alphaMap.image.width).toBe(dimension); expect(alphaMap.image.height).toBe(dimension);
        expect(alphaMap.image.data).toBeInstanceOf(Uint8Array);
        expect(alphaMap.image.data.byteLength).toBe(dimension * dimension * 4);
        let minimum = 255, maximum = 0;
        const pixels = alphaMap.image.data as Uint8Array;
        for (let offset = 1; offset < pixels.length; offset += 4) {
          const value = pixels[offset];
          minimum = Math.min(minimum, value); maximum = Math.max(maximum, value);
        }
        // Three samples alphaMap's green channel: a uniform tile would add a
        // dark rectangle instead of the intended soft contact transition.
        expect(maximum - minimum, `${tier}/${name} contact variation`).toBeGreaterThan(0);
      }
      const pages = library.group.getObjectByName("library-book-page-blocks");
      expect(pages).toBeInstanceOf(InstancedMesh);
      if (!(pages instanceof InstancedMesh)) throw new Error("Missing physical book pages");
      let leaning = 0, upright = 0;
      const bookTransform = new Matrix4(), bookUp = new Vector3();
      for (let instance = 0; instance < pages.count; instance++) {
        pages.getMatrixAt(instance, bookTransform);
        const vertical = Math.abs(bookUp.setFromMatrixColumn(bookTransform, 1).normalize().y);
        if (vertical > 0.98 && vertical < 0.99995) leaning++;
        if (vertical > 0.99999) upright++;
      }
      // Small leaning volumes must exist independently of horizontal stacks;
      // varying only heights/colors would leave every row mechanically upright.
      expect(leaning, `${tier} small physical book lean`).toBeGreaterThan(0);
      expect(upright, `${tier} upright book support`).toBeGreaterThan(0);
    } finally { library.dispose(); }
  });

  it("reduces actual geometry and instance allocations within the tier budgets", () => {
    const budgets = tiers.map((tier, tierIndex) => {
      const library = createGlobeLibrary(tier);
      try {
        const { meshes, geometries, textures } = collect(library);
        const instances = meshes.filter((mesh): mesh is InstancedMesh => mesh instanceof InstancedMesh);
        const instanceCount = instances.reduce((count, mesh) => count + mesh.count, 0);
        const instanceBytes = instances.reduce((bytes, mesh) => bytes + mesh.instanceMatrix.array.byteLength
          + (mesh.instanceColor?.array.byteLength ?? 0), 0);
        const geometryBytes = [...geometries].reduce((bytes, geometry) => bytes
          + Object.values(geometry.attributes).reduce((sum, attribute) => sum + attribute.array.byteLength, 0)
          + (geometry.getIndex()?.array.byteLength ?? 0), 0);
        const textureBytes = [...textures].reduce((bytes, texture) => bytes
          + Math.ceil((texture as DataTexture).image.data.byteLength * (texture.generateMipmaps ? 4 / 3 : 1)), 0);
        const triangles = meshes.reduce((sum, mesh) => sum + (mesh.geometry.getIndex()?.count
          ?? mesh.geometry.getAttribute("position").count) / 3 * (mesh instanceof InstancedMesh ? mesh.count : 1), 0);
        expect(instanceCount).toBeGreaterThan(0); expect(instanceCount, tier).toBeLessThanOrEqual([12000, 7000, 3000][tierIndex]);
        expect(meshes.length, tier).toBeLessThanOrEqual(55);
        expect(triangles, tier).toBeLessThanOrEqual([500000, 300000, 120000][tierIndex]);
        expect(textureBytes).toBeGreaterThan(0);
        // Source maps/reflection plus mips; renderer-created PMREM targets are
        // covered by the separate browser GPU baseline and disposal evidence.
        expect(textureBytes, tier).toBeLessThanOrEqual(5.5 * 1024 ** 2 / 4 ** tierIndex);
        return { instanceCount, instanceBytes, geometryBytes, textureBytes, triangles };
      } finally { library.dispose(); }
    });
    for (const field of ["instanceCount", "instanceBytes", "geometryBytes", "textureBytes", "triangles"] as const) {
      expect(budgets[0][field], field).toBeGreaterThan(budgets[1][field]);
      expect(budgets[1][field], field).toBeGreaterThan(budgets[2][field]);
    }
  });

  it("keeps ambience away from geometry and disposes materials, textures and instance resources exactly once", () => {
    const library = createGlobeLibrary("high"), { meshes, materials, geometries, textures } = collect(library);
    const instances = meshes.filter((mesh): mesh is InstancedMesh => mesh instanceof InstancedMesh);
    const listeners = [...geometries, ...materials, ...instances, ...textures].map(resource => {
      const disposed = vi.fn();
      if (resource instanceof InstancedMesh) resource.addEventListener("dispose", disposed);
      else if (resource instanceof BufferGeometry) resource.addEventListener("dispose", disposed);
      else if (resource instanceof Texture) resource.addEventListener("dispose", disposed);
      else resource.addEventListener("dispose", disposed);
      return disposed;
    });
    const poses = meshes.map(mesh => [...mesh.matrixWorld.elements]);
    const matrices = instances.map(mesh => [...mesh.instanceMatrix.array]);
    const finishes = [...materials] as MeshStandardMaterial[];
    const oldIntensity = finishes.map(material => material.emissiveIntensity);
    try {
      library.setAmbientTime(2);
      const animatedIntensity = finishes.map(material => material.emissiveIntensity);
      expect(animatedIntensity.some((value, index) => value !== oldIntensity[index])).toBe(true);
      expect(animatedIntensity.every(value => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true);
      for (const invalidTime of [-1, Number.NaN, Infinity]) library.setAmbientTime(invalidTime);
      expect(finishes.map(material => material.emissiveIntensity)).toEqual(animatedIntensity);
      library.group.updateMatrixWorld(true);
      collect(library);
      expect(meshes.map(mesh => [...mesh.matrixWorld.elements])).toEqual(poses);
      expect(instances.map(mesh => [...mesh.instanceMatrix.array])).toEqual(matrices);
      library.dispose(); library.dispose();
      for (const listener of listeners) expect(listener).toHaveBeenCalledOnce();
      expect(library.group.children).toHaveLength(0);
      library.setAmbientTime(8);
      expect(finishes.map(material => material.emissiveIntensity)).toEqual(animatedIntensity);
    } finally { library.dispose(); }
  });
});
