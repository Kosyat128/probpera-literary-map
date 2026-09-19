import { Box3, BufferGeometry, Camera, DataTexture, InstancedMesh, Light, Line, Line3, Matrix4, Mesh,
  MeshStandardMaterial, PointLight, Raycaster, Texture, Triangle, Vector3, type Intersection, type Material } from "three";
import { describe, expect, it, vi } from "vitest";
import { createGlobeWriterStudy } from "./globeWriterStudyGeometry";
import { createIncludedGlobeBackground } from "./globeBackgroundGeometry";
import type { GlobeQualityTier } from "./globeQuality";

const tiers: readonly GlobeQualityTier[] = ["high", "balanced", "economy"];
type Study = ReturnType<typeof createGlobeWriterStudy>;

/** Observe the real owner cleanup, including palette maps retained outside the
 * scene graph. The original disposal still runs; no factory or resource is mocked. */
function withTextureDisposalLedger<T>(action: (disposals: Map<Texture, number>) => T): T {
  const disposals = new Map<Texture, number>(), original = Texture.prototype.dispose;
  const spy = vi.spyOn(Texture.prototype, "dispose").mockImplementation(function (this: Texture) {
    disposals.set(this, (disposals.get(this) ?? 0) + 1);
    original.call(this);
  });
  try { return action(disposals); } finally { spy.mockRestore(); }
}

function collect(study: Study) {
  const meshes: Mesh[] = [], geometries = new Set<BufferGeometry>(), materials = new Set<Material>();
  const textures = new Set<Texture>(), lights: PointLight[] = [];
  study.group.traverse(object => {
    expect(object instanceof Camera || object instanceof Line).toBe(false);
    if (object instanceof Light) {
      expect(object).toBeInstanceOf(PointLight);
      if (object instanceof PointLight) lights.push(object);
    }
    if (!(object instanceof Mesh)) return;
    meshes.push(object); geometries.add(object.geometry);
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
  });
  for (const material of materials) for (const value of Object.values(material)) if (value instanceof Texture) textures.add(value);
  return { meshes, geometries, materials, textures, lights,
    instances: meshes.filter((mesh): mesh is InstancedMesh => mesh instanceof InstancedMesh) };
}

function physicalBounds(mesh: Mesh, requireVolume = false) {
  const positions = mesh.geometry.getAttribute("position"), result: number[][] = [];
  const local = new Matrix4(), world = new Matrix4(), point = new Vector3(), box = new Box3();
  for (let instance = 0; instance < (mesh instanceof InstancedMesh ? mesh.count : 1); instance++) {
    if (mesh instanceof InstancedMesh) { mesh.getMatrixAt(instance, local); world.multiplyMatrices(mesh.matrixWorld, local); }
    else world.copy(mesh.matrixWorld);
    box.makeEmpty();
    for (let vertex = 0; vertex < positions.count; vertex++) box.expandByPoint(point.fromBufferAttribute(positions, vertex).applyMatrix4(world));
    const bounds = [...box.min.toArray(), ...box.max.toArray()];
    expect(bounds.every(Number.isFinite), mesh.name).toBe(true);
    if (requireVolume) expect(box.getSize(point).toArray().every(value => value > 0), `${mesh.name}: physical volume`).toBe(true);
    result.push(bounds);
  }
  return result;
}

function layout(study: Study) {
  const pages = study.group.getObjectByName("writer-study-book-page-blocks");
  expect(pages).toBeInstanceOf(InstancedMesh);
  if (!(pages instanceof InstancedMesh)) throw new Error("Missing physical study books");
  expect(pages.count).toBe(192); expect(pages.instanceColor).not.toBeNull();
  expect(pages.instanceMatrix.array.every(Number.isFinite)).toBe(true);
  expect(pages.instanceColor!.array.every(Number.isFinite)).toBe(true);
  const furniture: Record<string, number[][]> = {};
  for (const name of ["writer-study-desk-top", "writer-study-cabinet-cases", "writer-study-window-glazing"]) {
    const mesh = study.group.getObjectByName(name);
    expect(mesh, name).toBeInstanceOf(Mesh);
    if (!(mesh instanceof Mesh)) throw new Error(`Missing physical furniture: ${name}`);
    furniture[name] = physicalBounds(mesh, name !== "writer-study-window-glazing");
  }
  return { furniture, pageBounds: physicalBounds(pages, true), pagePositions: Array.from(pages.geometry.getAttribute("position").array),
    pageIndices: pages.geometry.getIndex() ? Array.from(pages.geometry.getIndex()!.array) : null,
    pageMatrices: Array.from(pages.instanceMatrix.array), pageColors: Array.from(pages.instanceColor!.array) };
}

/** Test complete transformed faces, not just vertex distances: the interior
 * of a large wall or desk triangle can enter the camera sphere independently. */
function cameraClearance(study: Study, meshes: readonly Mesh[], tier: GlobeQualityTier) {
  const triangle = new Triangle(), origin = new Vector3(), nearest = new Vector3(), segment = new Line3();
  const ab = new Vector3(), ac = new Vector3(), area = new Vector3(), local = new Matrix4(), world = new Matrix4();
  const corners = [triangle.a, triangle.b, triangle.c];
  const sides = [[triangle.a, triangle.b], [triangle.b, triangle.c], [triangle.c, triangle.a]];
  const layerFaces = new Map<string, number>();
  let closest = Infinity, closestFace = "", finite = true, triangles = 0;
  for (const mesh of meshes) {
    const position = mesh.geometry.getAttribute("position"), normal = mesh.geometry.getAttribute("normal"), uv = mesh.geometry.getAttribute("uv");
    const index = mesh.geometry.getIndex(), count = index?.count ?? position.count;
    expect(position.itemSize).toBe(3); expect(position.count).toBeGreaterThan(0); expect(position.array.every(Number.isFinite), mesh.name).toBe(true);
    expect(normal.count).toBe(position.count); expect(normal.array.every(Number.isFinite), mesh.name).toBe(true);
    expect(uv.itemSize).toBe(2); expect(uv.count).toBe(position.count); expect(uv.array.every(Number.isFinite), mesh.name).toBe(true);
    expect(count % 3).toBe(0);
    if (index) expect(index.array.every(value => Number.isInteger(value) && value >= 0 && value < position.count), mesh.name).toBe(true);
    let layer = mesh.parent!;
    while (layer.parent && layer.parent !== study.group) layer = layer.parent;
    const pickingDirection = new Vector3();
    for (let instance = 0; instance < (mesh instanceof InstancedMesh ? mesh.count : 1); instance++) {
      if (mesh instanceof InstancedMesh) { mesh.getMatrixAt(instance, local); world.multiplyMatrices(mesh.matrixWorld, local); }
      else world.copy(mesh.matrixWorld);
      expect(world.elements.every(Number.isFinite), mesh.name).toBe(true);
      for (let offset = 0; offset < count; offset += 3) {
        for (let corner = 0; corner < 3; corner++) corners[corner].fromBufferAttribute(position, index ? index.getX(offset + corner) : offset + corner).applyMatrix4(world);
        ab.subVectors(triangle.b, triangle.a); ac.subVectors(triangle.c, triangle.a);
        const longest = Math.max(ab.lengthSq(), ac.lengthSq(), triangle.b.distanceToSquared(triangle.c));
        const squaredArea = area.crossVectors(ab, ac).lengthSq();
        let distance: number;
        if (squaredArea <= longest ** 2 * 1e-12) {
          // Degenerate poles still occupy their finite edges/point. For an
          // almost collinear face, subtract its altitude conservatively.
          distance = Infinity;
          for (const [start, end] of sides) {
            if (start.distanceToSquared(end) === 0) nearest.copy(start);
            else segment.set(start, end).closestPointToPoint(origin, true, nearest);
            distance = Math.min(distance, nearest.length());
          }
          if (longest > 0) distance = Math.max(0, distance - Math.sqrt(squaredArea / longest));
        } else { triangle.closestPointToPoint(origin, nearest); distance = nearest.length(); }
        finite &&= Number.isFinite(distance);
        if (distance < closest) { closest = distance; closestFace = `${mesh.name} instance ${instance} triangle ${offset / 3}`; }
        if (instance === 0 && offset === 0) triangle.getMidpoint(pickingDirection).normalize();
        triangles++; layerFaces.set(layer.name, (layerFaces.get(layer.name) ?? 0) + 1);
      }
    }
    const raycaster = new Raycaster(), hits: Intersection[] = [];
    raycaster.ray.direction.copy(pickingDirection); mesh.raycast(raycaster, hits);
    for (const direction of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      raycaster.ray.direction.set(direction[0], direction[1], direction[2]); mesh.raycast(raycaster, hits);
    }
    expect(hits, `${mesh.name}: decorative ray dispatch`).toEqual([]);
    expect(mesh.raycast).not.toBe(mesh instanceof InstancedMesh ? InstancedMesh.prototype.raycast : Mesh.prototype.raycast);
  }
  expect(finite).toBe(true); expect(triangles).toBeGreaterThan(0);
  expect(closest, `${tier}: ${closestFace}`).toBeGreaterThanOrEqual(5.6 - 1e-5);
  for (const name of ["writer-study-foreground", "writer-study-midground", "writer-study-background"]) expect(layerFaces.get(name), name).toBeGreaterThan(0);
  return triangles;
}

describe("writer study surrounding the persistent globe", () => {
  it("preserves physical furniture and books at every tier while keeping all triangles outside the camera and reducing detail", () => {
    const budgets = tiers.map((tier, tierIndex) => withTextureDisposalLedger(disposals => {
      let study: Study | undefined;
      try {
        study = createIncludedGlobeBackground("background.base.writer-study", tier);
        study.group.updateMatrixWorld(true);
        const owned = collect(study);
        expect(owned.meshes.length).toBeGreaterThan(0); expect(owned.meshes.length).toBeLessThanOrEqual(55);
        const triangles = cameraClearance(study, owned.meshes, tier);
        expect(triangles).toBeLessThanOrEqual([500000, 300000, 120000][tierIndex]);
        expect(owned.lights.length).toBeLessThanOrEqual(2);
        for (const light of owned.lights) {
          const radius = light.getWorldPosition(new Vector3()).length();
          expect(radius).toBeGreaterThanOrEqual(8); expect(light.distance).toBeGreaterThan(0); expect(light.distance).toBeLessThanOrEqual(3.5);
          expect(radius - light.distance, `${light.name}: no globe/support lighting reach`).toBeGreaterThan(2);
          expect(Number.isFinite(light.intensity)).toBe(true); expect(light.intensity).toBeGreaterThanOrEqual(0);
          expect(light.castShadow).toBe(false); expect(light.shadow.map).toBeNull();
        }
        const instanceCount = owned.instances.reduce((sum, mesh) => sum + mesh.count, 0);
        expect(instanceCount).toBeGreaterThan(0); expect(instanceCount).toBeLessThanOrEqual([12000, 7000, 3000][tierIndex]);
        const instanceBytes = owned.instances.reduce((sum, mesh) => sum + mesh.instanceMatrix.array.byteLength + (mesh.instanceColor?.array.byteLength ?? 0), 0);
        const geometryBytes = [...owned.geometries].reduce((sum, geometry) => sum
          + Object.values(geometry.attributes).reduce((bytes, attribute) => bytes + attribute.array.byteLength, 0) + (geometry.getIndex()?.array.byteLength ?? 0), 0);
        const physicalLayout = layout(study);
        study.dispose(); study.dispose();
        for (const texture of owned.textures) expect(disposals.get(texture), texture.name).toBe(1);
        let textureBytes = 0;
        for (const [texture, count] of disposals) {
          expect(count, `${texture.name}: owned texture disposal`).toBe(1);
          expect(texture).toBeInstanceOf(DataTexture);
          expect(texture.userData).toMatchObject({ provenance: "authored-in-project", qualityTier: tier });
          const image = (texture as DataTexture).image;
          expect(image.data).toBeInstanceOf(Uint8Array); expect(image.data.byteLength).toBe(image.width * image.height * 4);
          textureBytes += Math.ceil(image.data.byteLength * (texture.generateMipmaps ? 4 / 3 : 1));
        }
        expect(textureBytes).toBeGreaterThan(0);
        // Includes retained, unbound palette maps observed during owner cleanup.
        // Renderer PMREM retirement is a browser concern.
        expect(textureBytes).toBeLessThanOrEqual(5.5 * 1024 ** 2 / 4 ** tierIndex);
        return { triangles, instanceCount, instanceBytes, geometryBytes, textureBytes, layout: physicalLayout };
      } finally { study?.dispose(); }
    }));
    for (const field of ["triangles", "geometryBytes", "textureBytes"] as const) {
      expect(budgets[0][field], field).toBeGreaterThan(budgets[1][field]); expect(budgets[1][field], field).toBeGreaterThan(budgets[2][field]);
    }
    for (let index = 1; index < budgets.length; index++) {
      expect(budgets[index].instanceCount).toBeLessThanOrEqual(budgets[index - 1].instanceCount);
      expect(budgets[index].instanceBytes).toBeLessThanOrEqual(budgets[index - 1].instanceBytes);
      for (const field of ["pagePositions", "pageIndices", "pageMatrices", "pageColors", "pageBounds"] as const) {
        expect(budgets[index].layout[field], `${tiers[index]}: ${field}`).toEqual(budgets[0].layout[field]);
      }
      for (const [name, members] of Object.entries(budgets[index].layout.furniture)) {
        const original = budgets[0].layout.furniture[name]; expect(members.length, name).toBe(original.length);
        for (let member = 0; member < members.length; member++) for (let coordinate = 0; coordinate < 6; coordinate++) {
          expect(Math.abs(members[member][coordinate] - original[member][coordinate]), `${tiers[index]}/${name}: physical layout`).toBeLessThanOrEqual(1e-4);
        }
      }
    }
  });

  it("keeps ambience away from geometry and retires independent owned resources once", () => withTextureDisposalLedger(disposals => {
    let first: Study | undefined, second: Study | undefined;
    const listen = (owned: ReturnType<typeof collect>) => [...owned.geometries, ...owned.materials, ...owned.textures, ...owned.instances].map(resource => {
      const listener = vi.fn();
      if (resource instanceof InstancedMesh) resource.addEventListener("dispose", listener);
      else if (resource instanceof BufferGeometry) resource.addEventListener("dispose", listener);
      else if (resource instanceof Texture) resource.addEventListener("dispose", listener);
      else resource.addEventListener("dispose", listener);
      return listener;
    });
    try {
      first = createGlobeWriterStudy("economy"); second = createGlobeWriterStudy("economy");
      first.group.updateMatrixWorld(true); second.group.updateMatrixWorld(true);
      const a = collect(first), b = collect(second);
      const disposedA = listen(a), disposedB = listen(b);
      const poses = a.meshes.map(mesh => [...mesh.matrixWorld.elements]), matrices = a.instances.map(mesh => [...mesh.instanceMatrix.array]);
      const finishes = [...a.materials].filter((material): material is MeshStandardMaterial => material instanceof MeshStandardMaterial);
      for (const geometry of a.geometries) expect(b.geometries.has(geometry)).toBe(false);
      for (const material of a.materials) expect(b.materials.has(material)).toBe(false);
      for (const texture of a.textures) expect(b.textures.has(texture)).toBe(false);
      first.setAmbientTime(2); first.group.updateMatrixWorld(true);
      expect(a.meshes.map(mesh => [...mesh.matrixWorld.elements])).toEqual(poses);
      expect(a.instances.map(mesh => [...mesh.instanceMatrix.array])).toEqual(matrices);
      expect(finishes.every(material => Number.isFinite(material.emissiveIntensity) && material.emissiveIntensity >= 0)).toBe(true);
      const intensity = finishes.map(material => material.emissiveIntensity);
      first.dispose(); first.dispose();
      const firstTextures = new Set(disposals.keys());
      for (const texture of a.textures) expect(firstTextures.has(texture), texture.name).toBe(true);
      for (const texture of b.textures) expect(firstTextures.has(texture), texture.name).toBe(false);
      for (const [texture, count] of disposals) expect(count, texture.name).toBe(1);
      for (const listener of disposedA) expect(listener).toHaveBeenCalledOnce();
      for (const listener of disposedB) expect(listener).not.toHaveBeenCalled();
      expect(first.group.children).toHaveLength(0); expect(second.group.children.length).toBeGreaterThan(0);
      first.setAmbientTime(9); expect(finishes.map(material => material.emissiveIntensity)).toEqual(intensity);
      second.dispose(); second.dispose();
      for (const texture of b.textures) expect(disposals.get(texture), texture.name).toBe(1);
      expect(disposals.size).toBeGreaterThan(firstTextures.size);
      // Shared retained maps would now have a second disposal, even when neither
      // scene graph exposes them through a material.
      for (const [texture, count] of disposals) expect(count, texture.name).toBe(1);
      for (const listener of disposedA) expect(listener).toHaveBeenCalledOnce();
      for (const listener of disposedB) expect(listener).toHaveBeenCalledOnce();
    } finally { try { first?.dispose(); } finally { second?.dispose(); } }
  }));
});
