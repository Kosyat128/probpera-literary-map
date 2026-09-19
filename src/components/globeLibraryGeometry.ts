import * as THREE from "three";
import type { GlobeQualityTier } from "./globeQuality";
import { createGlobeCraftMaterials } from "./globeCraftMaterials";
import { createLibraryBookShellGeometry } from "./globeLibraryBookGeometry";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export interface OwnedGlobeLibrary {
  readonly group: THREE.Group;
  setAmbientTime(seconds: number): void;
  dispose(): void;
}

const detail = Object.freeze({
  high: Object.freeze({ bays: 16, rows: 8, books: 8, archSegments: 32, tubeSegments: 8, turnedSegments: 28, spineSegments: 8, parquetStrips: 4 }),
  balanced: Object.freeze({ bays: 16, rows: 8, books: 8, archSegments: 24, tubeSegments: 6, turnedSegments: 20, spineSegments: 6, parquetStrips: 3 }),
  economy: Object.freeze({ bays: 16, rows: 8, books: 8, archSegments: 16, tubeSegments: 3, turnedSegments: 8, spineSegments: 3, parquetStrips: 1 }),
});
const FLOOR_Y = -6.15;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
function variation(bay: number, row: number, item: number) {
  let value = Math.imul(bay + 37, 73856093) ^ Math.imul(row + 19, 19349663) ^ Math.imul(item + 7, 83492791);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}
function surfaceNoise(u: number, v: number, columns: number, rows: number, seed: number) {
  const x = u * columns, y = v * rows, ix = Math.floor(x), iy = Math.floor(y);
  const at = (dx: number, dy: number) => variation(((ix + dx) % columns + columns) % columns,
    ((iy + dy) % rows + rows) % rows, seed);
  const sx = smooth(x - ix), sy = smooth(y - iy);
  return (at(0, 0) * (1 - sx) + at(1, 0) * sx) * (1 - sy)
    + (at(0, 1) * (1 - sx) + at(1, 1) * sx) * sy;
}

/**
 * Original reading hall, with joined cabinetry, turned/fluted columns, bound
 * volumes and recessed glazing. All faces stay outside the camera's r=5.6
 * sphere. Procedural craft maps are local; two short-range lights cannot reach
 * the globe. No camera, renderer or global scene/environment state is changed.
 */
export function createGlobeLibrary(quality: GlobeQualityTier): OwnedGlobeLibrary {
  if (!Object.prototype.hasOwnProperty.call(detail, quality)) throw new Error("Invalid globe library quality");
  const budget = detail[quality];
  const daylightBay = Math.floor(budget.bays / 2);
  const daylightAngle = (daylightBay + 0.5) / budget.bays * Math.PI * 2;
  const warmBay = daylightBay - 1;
  const warmAngle = warmBay / budget.bays * Math.PI * 2;
  const daylightPosition = new THREE.Vector3(Math.sin(daylightAngle) * 10.66, 2.35, Math.cos(daylightAngle) * 10.66);
  const warmPosition = new THREE.Vector3(Math.sin(warmAngle) * 8.81 + Math.cos(warmAngle) * 1.14,
    2.15, Math.cos(warmAngle) * 8.81 - Math.sin(warmAngle) * 1.14);
  const group = new THREE.Group();
  group.name = "included-globe-background:background.base.library";
  group.userData = { backgroundId: "background.base.library", qualityTier: quality,
    provenance: "authored-in-project", cameraClearanceRadius: 5.6 };
  const layer = (name: string) => {
    const root = new THREE.Group();
    root.name = `library-${name}`;
    group.add(root);
    return root;
  };
  const foreground = layer("foreground");
  const midground = layer("midground");
  const background = layer("background");
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  const instances = new Set<THREE.InstancedMesh>();
  const lights = new Set<THREE.PointLight>();
  let craft: ReturnType<typeof createGlobeCraftMaterials> | undefined;
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const instance of instances) instance.dispose();
    for (const light of lights) light.dispose();
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
    craft?.dispose();
    group.clear();
  };
  const ownGeometry = <T extends THREE.BufferGeometry>(geometry: T): T => {
    geometries.add(geometry);
    // Authored vertex shading darkens undersides and recessed lower corners.
    // It is baked into the owned mesh, not a lightmap or extra dynamic light.
    geometry.computeBoundingBox();
    const vertices = geometry.getAttribute("position");
    const normals = geometry.getAttribute("normal");
    const bounds = geometry.boundingBox!;
    const height = bounds.max.y - bounds.min.y;
    const colors = new Float32Array(vertices.count * 3);
    for (let index = 0; index < vertices.count; index += 1) {
      const vertical = height > 0 ? (vertices.getY(index) - bounds.min.y) / height : 1;
      const normalY = normals.getY(index);
      const faceShade = normalY < -0.5 ? 0.66 : normalY > 0.5 ? 1 : 0.93;
      const shade = faceShade * (0.91 + 0.09 * vertical);
      colors.set([shade, shade, shade], index * 3);
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geometry;
  };
  const finish = (base: THREE.MeshStandardMaterial, color?: string) => {
    const material = base.clone();
    material.vertexColors = true;
    if (color) material.color.set(color);
    materials.add(material);
    return material;
  };
  const ownedTile = (name: string, paint: (u: number, v: number) => readonly [number, number, number, number], color = false, resolution = 1) => {
    const size = (quality === "high" ? 64 : quality === "balanced" ? 32 : 16) * resolution;
    const bytes = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      bytes.set(paint((x + 0.5) / size, (y + 0.5) / size), (y * size + x) * 4);
    }
    const texture = new THREE.DataTexture(bytes, size, size, THREE.RGBAFormat);
    texture.name = name;
    texture.userData = { provenance: "authored-in-project", qualityTier: quality };
    texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.minFilter = texture.magFilter = THREE.LinearFilter;
    texture.needsUpdate = true;
    textures.add(texture);
    return texture;
  };
  const occlusion = (name: string, alpha: (u: number, v: number) => number, opacity: number) => {
    const alphaMap = ownedTile(name, (u, v) => {
      const value = Math.round(clamp(alpha(u, v)) * 255);
      return [value, value, value, 255];
    });
    const material = new THREE.MeshStandardMaterial({ color: "#000000", roughness: 1,
      alphaMap, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
    material.forceSinglePass = true;
    materials.add(material);
    return material;
  };
  const woodUv = (geometry: THREE.BufferGeometry, width: number, height: number, depth: number) => {
    const vertices = geometry.getAttribute("position"), normals = geometry.getAttribute("normal");
    const uv = geometry.getAttribute("uv");
    for (let index = 0; index < vertices.count; index++) {
      const x = vertices.getX(index) * width, y = vertices.getY(index) * height, z = vertices.getZ(index) * depth;
      const nx = Math.abs(normals.getX(index)), ny = Math.abs(normals.getY(index)), nz = Math.abs(normals.getZ(index));
      // Lengthwise grain follows the timber's longest dimension; adjacent
      // panels use the same physical texture scale rather than one tile each.
      if (width >= height && width >= depth) {
        if (nx > ny && nx > nz) uv.setXY(index, z * 0.55, y * 0.45);
        else uv.setXY(index, (ny > nz ? z : y) * 0.55, x * 0.45);
      } else if (height >= depth) {
        if (ny > nx && ny > nz) uv.setXY(index, x * 0.55, z * 0.45);
        else uv.setXY(index, (nx > nz ? z : x) * 0.55, y * 0.45);
      } else {
        if (nz > nx && nz > ny) uv.setXY(index, x * 0.55, y * 0.45);
        else uv.setXY(index, (ny > nx ? x : y) * 0.55, z * 0.45);
      }
    }
    uv.needsUpdate = true;
    return geometry;
  };
  // A single planar chamfer gives real edge highlights with 28 triangles,
  // avoiding a highly subdivided rounded cube for each of thousands of parts.
  const chamferedBox = (width: number, height: number, depth: number, radius: number) => {
    if (quality === "economy") return ownGeometry(new THREE.BoxGeometry(1, 1, 1));
    const r = Math.min(radius, width / 3, height / 3, depth / 3);
    const halfX = width / 2 - r, halfY = height / 2 - r;
    const shape = new THREE.Shape();
    shape.moveTo(-halfX, -halfY); shape.lineTo(halfX, -halfY);
    shape.lineTo(halfX, halfY); shape.lineTo(-halfX, halfY); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: depth - 2 * r,
      bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: r, bevelThickness: r, curveSegments: 1 });
    geometry.translate(0, 0, -(depth - 2 * r) / 2);
    geometry.scale(1 / width, 1 / height, 1 / depth);
    // Both cap and edge groups intentionally share the same owned finish.
    geometry.clearGroups();
    return ownGeometry(geometry);
  };
  const mesh = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, root: THREE.Group) => {
    const result = new THREE.Mesh(geometry, material);
    result.name = name;
    result.raycast = () => undefined;
    root.add(result);
    return result;
  };
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const rollRotation = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const outward = new THREE.Vector3(0, 0, 1);
  type Placement = { x: number; y: number; z: number; width: number; height: number; depth: number; angle: number; roll?: number; color?: THREE.Color };
  const instanced = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[],
    placements: Placement[], root: THREE.Group) => {
    const result = new THREE.InstancedMesh(geometry, material, placements.length);
    instances.add(result);
    result.name = name;
    result.raycast = () => undefined;
    placements.forEach((placement, index) => {
      position.set(placement.x, placement.y, placement.z);
      scale.set(placement.width, placement.height, placement.depth);
      rotation.setFromAxisAngle(up, placement.angle);
      if (placement.roll) rotation.multiply(rollRotation.setFromAxisAngle(outward, placement.roll));
      matrix.compose(position, rotation, scale);
      result.setMatrixAt(index, matrix);
      const color = placement.color?.clone() ?? new THREE.Color(1, 1, 1);
      if (!name.includes("occlusion") && name !== "library-reading-lamps" && name !== "library-window-glazing") {
        // A bounded baked room exposure complements the two visible fixtures.
        // It creates stable cool/warm zones without a shared ambient-light edit.
        const daylight = Math.exp(-position.distanceToSquared(daylightPosition) / 31);
        const warmth = Math.exp(-position.distanceToSquared(warmPosition) / 5.5);
        const lowerRoom = 0.87 + 0.13 * smooth((placement.y + 5.6) / 6.2);
        color.multiply(new THREE.Color().setRGB(
          (0.72 + daylight * 0.21 + warmth * 0.15) * lowerRoom,
          (0.75 + daylight * 0.25 + warmth * 0.075) * lowerRoom,
          (0.80 + daylight * 0.28 + warmth * 0.020) * lowerRoom,
        ));
      }
      result.setColorAt(index, color);
    });
    result.instanceMatrix.needsUpdate = true;
    if (result.instanceColor) result.instanceColor.needsUpdate = true;
    result.computeBoundingSphere();
    root.add(result);
    return result;
  };
  const radial = (angle: number, radius: number, tangent: number, y: number,
    width: number, height: number, depth: number): Placement => ({
    x: Math.sin(angle) * radius + Math.cos(angle) * tangent,
    y,
    z: Math.cos(angle) * radius - Math.sin(angle) * tangent,
    width, height, depth, angle,
  });
  const repeatedAssembly = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material,
    placements: Placement[], root: THREE.Group, members: number) => {
    if (quality !== "economy") return instanced(name, geometry, material, placements, root);
    if (placements.length % members !== 0) throw new Error("Incomplete library assembly");
    const anchor = placements[0];
    const inverse = new THREE.Matrix4().compose(new THREE.Vector3(anchor.x, anchor.y, anchor.z),
      new THREE.Quaternion().setFromAxisAngle(up, anchor.angle), new THREE.Vector3(1, 1, 1)).invert();
    const parts: THREE.BufferGeometry[] = [], ranges: { start: number; count: number }[] = [];
    const frames: Placement[] = [];
    let start = 0;
    try {
      for (const placement of placements.slice(0, members)) {
        const part = geometry.clone(); parts.push(part); part.clearGroups();
        if (!part.index) part.setIndex(Array.from({ length: part.getAttribute("position").count }, (_, index) => index));
        position.set(placement.x, placement.y, placement.z);
        scale.set(placement.width, placement.height, placement.depth);
        rotation.setFromAxisAngle(up, placement.angle);
        matrix.compose(position, rotation, scale).premultiply(inverse);
        part.applyMatrix4(matrix);
        ranges.push({ start, count: part.index!.count }); start += part.index!.count;
      }
      const combined = mergeGeometries(parts, false);
      if (!combined) throw new Error("Unable to construct library assembly");
      geometries.add(combined);
      combined.userData = { provenance: "authored-in-project", assemblyParts: ranges };
      for (let index = 0; index < placements.length; index += members) {
        const placement = placements[index];
        frames.push({ x: placement.x, y: placement.y, z: placement.z, angle: placement.angle,
          width: 1, height: 1, depth: 1 });
      }
      return instanced(name, combined, material, frames, root);
    } finally { for (const part of parts) part.dispose(); }
  };

  try {
    craft = createGlobeCraftMaterials(quality);
    const wood = finish(craft.darkWood, "#82705d");
    wood.envMapIntensity = 0.24;
    const trim = finish(craft.brass, "#b39a68");
    trim.metalness = 0.78; trim.envMapIntensity = 0.70;
    // Keep oxidation, roughness and metal response in the same craft-map space.
    // An unrelated local roughness pattern would polish the oxidized patches.
    const shelves = finish(craft.wood, "#aa9277");
    shelves.roughness = 0.88; shelves.envMapIntensity = 0.38;
    const recess = finish(craft.darkWood, "#45382d");
    recess.envMapIntensity = 0.12;
    const books = finish(craft.leather);
    books.envMapIntensity = 0.26;
    const leatherResolution = quality === "high" ? 128 : quality === "balanced" ? 64 : 32;
    const leatherFinish = (u: number, v: number) => {
      const cloud = surfaceNoise(u, v, 5, 8, 181);
      const irregular = surfaceNoise(u, v, 9, 13, 193);
      // Resolve several texels per leather grain even in Economy. Finer noise
      // would alias into an unrelated speckle pattern when the tier changes.
      const frequency = Math.min(27, leatherResolution / 4);
      const grain = surfaceNoise(u + (cloud - 0.5) * 0.018, v, frequency, frequency, 171);
      const valley = smooth((0.47 - grain) * 3.7);
      const edge = Math.exp(-Math.min(v, 1 - v) * 27)
        + Math.exp(-Math.min(u, 1 - u) * 38) * 0.38;
      const rubbed = edge * smooth((irregular - 0.28) * 2.3);
      const creaseDrift = (surfaceNoise(u, v, 3, 7, 211) - 0.5) * 0.022;
      const crease = Math.exp(-Math.pow((u - 0.065 - creaseDrift) / 0.016, 2))
        + Math.exp(-Math.pow((u - 0.935 + creaseDrift) / 0.016, 2));
      return {
        tone: 0.77 + cloud * 0.13 + grain * 0.028 - valley * 0.026 + rubbed * 0.10 - crease * 0.025,
        relief: grain * 0.0032 - valley * 0.0025 - crease * 0.003,
        roughness: 0.75 + valley * 0.11 - rubbed * 0.20 - cloud * 0.055,
      };
    };
    books.map = ownedTile("library-worn-leather-albedo", (u, v) => {
      const value = Math.round(clamp(leatherFinish(u, v).tone) * 255);
      return [value, value, value, 255];
    }, true, 2);
    books.normalMap = ownedTile("library-worn-leather-normal", (u, v) => {
      const step = 1 / leatherResolution;
      const dx = (leatherFinish(u - step, v).relief - leatherFinish(u + step, v).relief) / (2 * step);
      const dy = (leatherFinish(u, v - step).relief - leatherFinish(u, v + step).relief) / (2 * step);
      const length = Math.hypot(dx, dy, 1);
      return [Math.round((dx / length * 0.5 + 0.5) * 255),
        Math.round((dy / length * 0.5 + 0.5) * 255), Math.round((1 / length * 0.5 + 0.5) * 255), 255];
    }, false, 2);
    books.normalScale.set(0.18, 0.18);
    books.roughnessMap = ownedTile("library-handled-leather-roughness", (u, v) => {
      const value = Math.round(clamp(leatherFinish(u, v).roughness) * 255);
      return [value, value, value, 255];
    });
    const paper = finish(craft.paper, "#d9cfb8");
    paper.envMapIntensity = 0.07;
    paper.map = ownedTile("library-bound-page-edges", (u, v) => {
      const signatures = Math.pow(0.5 + 0.5 * Math.cos(v * Math.PI * 2 * 15), 12);
      const foreEdge = Math.exp(-Math.min(u, 1 - u) * 12);
      const value = Math.round(239 - signatures * 12 - foreEdge * 13 + surfaceNoise(u, v, 12, 24, 209) * 5);
      return [value, value, Math.round(value * 0.97), 255];
    }, true);
    const wall = finish(craft.stone, "#555664");
    wall.emissive.set("#090d15");
    wall.side = THREE.BackSide;
    const stone = finish(craft.stone, "#777065");
    const galleryFinish = finish(craft.wood, "#8e7961");
    galleryFinish.side = THREE.DoubleSide;
    const windowFinish = finish(craft.stone, "#d7e4e9");
    // Irregular, softly transmitted daylight belongs behind the actual glass.
    // The nearer leaded panes carry their own reflections and waviness, so the
    // recess has depth instead of reading as an opaque blue board.
    const windowLightMap = ownedTile("library-window-daylight", (u, v) => {
      const edge = smooth(Math.min(u, 1 - u) * 8);
      const cloud = surfaceNoise(u, v, 3, 4, 233);
      const distantCanopy = (1 - smooth((v - 0.05) * 3.5))
        * smooth((surfaceNoise(u, v, 6, 4, 241) - 0.22) * 2.3);
      const sky = (0.70 + 0.18 * smooth(v) + cloud * 0.10 - distantCanopy * 0.17) * (0.90 + edge * 0.10);
      return [Math.round(sky * 218), Math.round(sky * 234), Math.round(sky * 246), 255];
    }, true);
    windowFinish.map = windowLightMap; windowFinish.normalMap = null; windowFinish.roughnessMap = null;
    windowFinish.roughness = 0.7;
    windowFinish.emissiveMap = windowLightMap;
    windowFinish.emissive.set("#b9d9ed");
    windowFinish.emissiveIntensity = 0.82;
    const glassNormal = ownedTile("library-drawn-glass-normal", (u, v) => {
      const dx = Math.sin(v * Math.PI * 2 * 3 + Math.sin(u * Math.PI * 4)) * 0.12;
      const dy = Math.sin(u * Math.PI * 2 * 4 + Math.sin(v * Math.PI * 6)) * 0.09;
      const length = Math.hypot(dx, dy, 1);
      return [Math.round((dx / length * 0.5 + 0.5) * 255), Math.round((dy / length * 0.5 + 0.5) * 255),
        Math.round((1 / length * 0.5 + 0.5) * 255), 255];
    });
    const glass = new THREE.MeshPhysicalMaterial({ color: "#dce5df", roughness: 0.12,
      normalMap: glassNormal, normalScale: new THREE.Vector2(0.45, 0.45),
      metalness: 0.04, transparent: true, opacity: 0.24, depthWrite: false,
      envMap: craft.brass.envMap, envMapIntensity: 0.8, clearcoat: 0.8, clearcoatRoughness: 0.1, side: THREE.DoubleSide });
    glass.forceSinglePass = true;
    materials.add(glass);
    const lamp = finish(craft.paper, "#ecd8b0");
    lamp.emissive.set("#ffd299");
    lamp.emissiveIntensity = 0.3;
    lamp.userData.ambientChannel = "reading-lamps";
    const cabinetOcclusion = occlusion("library-cabinet-contact-occlusion", (u, v) =>
      0.60 * Math.exp(-(1 - v) * 8) + 0.28 * (Math.exp(-u * 13) + Math.exp(-(1 - u) * 13))
      + 0.16 * Math.exp(-v * 11), 0.78);
    const shelfOcclusion = occlusion("library-shelf-contact-occlusion", (u, v) =>
      (0.64 * Math.exp(-v * 6) + 0.42 * Math.exp(-Math.pow((v - 0.76) / 0.15, 2)))
      * smooth(Math.min(u, 1 - u) * 15), 0.56);
    const galleryOcclusion = occlusion("library-gallery-contact-occlusion", (_u, v) =>
      0.10 + 0.72 * smooth(v), 0.70);
    // Small, owned contact-occlusion tiles ground the fixed architectural feet.
    // They follow the physical floor, never the camera, and require no global
    // shadow renderer or extra pass. The low-resolution falloff is intentional.
    const contactSize = quality === "high" ? 64 : quality === "balanced" ? 32 : 16;
    const contactBytes = new Uint8Array(contactSize * contactSize * 4);
    for (let y = 0; y < contactSize; y++) for (let x = 0; x < contactSize; x++) {
      const distance = Math.hypot((x + 0.5) / contactSize * 2 - 1, (y + 0.5) / contactSize * 2 - 1);
      const falloff = Math.max(0, 1 - distance);
      const alpha = Math.round(falloff * falloff * (3 - 2 * falloff) * 255);
      contactBytes.set([255, alpha, 255, 255], (y * contactSize + x) * 4);
    }
    const contactMap = new THREE.DataTexture(contactBytes, contactSize, contactSize, THREE.RGBAFormat);
    textures.add(contactMap);
    contactMap.name = "library-authored-contact-occlusion";
    contactMap.userData = { provenance: "authored-in-project", qualityTier: quality };
    contactMap.minFilter = contactMap.magFilter = THREE.LinearFilter;
    contactMap.needsUpdate = true;
    const contactFinish = new THREE.MeshStandardMaterial({ color: "#000000", roughness: 1,
      metalness: 0, alphaMap: contactMap, transparent: true, opacity: 0.46, depthWrite: false });
    materials.add(contactFinish);
    const unitBox = ownGeometry(new THREE.BoxGeometry(1, 1, 1));
    const boardGeometry = woodUv(chamferedBox(2.32, 0.14, 0.72, 0.02), 2.32, 0.14, 0.72);
    const stileGeometry = woodUv(chamferedBox(0.18, 2.9, 0.72, 0.025), 0.18, 2.9, 0.72);
    const coverGeometry = chamferedBox(0.018, 1, 0.46, 0.004);
    const coverVertices = coverGeometry.getAttribute("position"), coverNormals = coverGeometry.getAttribute("normal");
    const coverUv = coverGeometry.getAttribute("uv");
    for (let index = 0; index < coverVertices.count; index++) {
      // Extrude's world-unit UVs would squeeze the entire skin into a sliver
      // on a thin cover. A whole leather panel belongs on each real board face.
      const nx = Math.abs(coverNormals.getX(index)), ny = Math.abs(coverNormals.getY(index));
      const nz = Math.abs(coverNormals.getZ(index));
      if (nx >= ny && nx >= nz) coverUv.setXY(index, coverVertices.getZ(index) + 0.5, coverVertices.getY(index) + 0.5);
      else if (ny >= nz) coverUv.setXY(index, coverVertices.getX(index) + 0.5, coverVertices.getZ(index) + 0.5);
      else coverUv.setXY(index, coverVertices.getX(index) + 0.5, coverVertices.getY(index) + 0.5);
    }
    coverUv.needsUpdate = true;
    const moldingGeometry = woodUv(chamferedBox(2.4, 0.09, 0.08, 0.017), 2.4, 0.09, 0.08);
    const shaftGeometry = new THREE.CylinderGeometry(0.5, 0.5, 1, budget.turnedSegments, 3);
    const shaftPositions = shaftGeometry.getAttribute("position");
    for (let index = 0; index < shaftPositions.count; index += 1) {
      const x = shaftPositions.getX(index), z = shaftPositions.getZ(index), y = shaftPositions.getY(index);
      const angle = Math.atan2(z, x), radius = Math.hypot(x, z);
      if (radius > 0) {
        const entasis = 0.94 + Math.sin((y + 0.5) * Math.PI) * 0.06;
        const flute = 0.95 + Math.cos(angle * (quality === "economy" ? 6 : 10)) * 0.05;
        shaftPositions.setXYZ(index, x * entasis * flute, y, z * entasis * flute);
      }
    }
    shaftGeometry.computeVertexNormals(); ownGeometry(shaftGeometry);
    const turnedGeometry = ownGeometry(new THREE.LatheGeometry([
      [0, -0.5], [0.5, -0.5], [0.5, -0.36], [0.39, -0.27],
      [0.35, -0.17], [0.43, -0.06], [0.43, 0.09], [0.31, 0.2],
      [0.28, 0.5], [0, 0.5],
    ].map(([radius, y]) => new THREE.Vector2(radius, y)), budget.turnedSegments));
    const capitalGeometry = ownGeometry(turnedGeometry.clone().rotateZ(Math.PI));
    const balusterGeometry = ownGeometry(new THREE.LatheGeometry([
      [0, -0.5], [0.5, -0.5], [0.5, -0.42], [0.29, -0.33], [0.22, -0.14],
      [0.42, 0.03], [0.34, 0.2], [0.22, 0.35], [0.5, 0.42], [0.5, 0.5], [0, 0.5],
    ].map(([radius, y]) => new THREE.Vector2(radius, y)), budget.tubeSegments));
    const spineGeometry = (() => {
      if (quality !== "economy") return ownGeometry(new THREE.CylinderGeometry(0.5, 0.5, 1,
        budget.spineSegments, 1, false, Math.PI / 2, Math.PI));
      const sides = new THREE.CylinderGeometry(0.5, 0.5, 1, budget.spineSegments, 1, true, Math.PI / 2, Math.PI);
      const caps = new THREE.BufferGeometry();
      const positions: number[] = [], normals: number[] = [], uv: number[] = [], index: number[] = [];
      for (const y of [0.5, -0.5]) {
        const start = positions.length / 3;
        for (let segment = 0; segment <= budget.spineSegments; segment++) {
          const angle = Math.PI / 2 + segment / budget.spineSegments * Math.PI;
          const x = Math.sin(angle) / 2, z = Math.cos(angle) / 2;
          positions.push(x, y, z); normals.push(0, Math.sign(y), 0); uv.push(x + 0.5, z + 0.5);
        }
        // The cap's diameter already joins its two end vertices. A fan from
        // an endpoint closes it with n−2 faces and needs no redundant centre.
        for (let segment = 1; segment < budget.spineSegments; segment++) {
          if (y > 0) index.push(start, start + segment, start + segment + 1);
          else index.push(start, start + segment + 1, start + segment);
        }
      }
      caps.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      caps.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
      caps.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); caps.setIndex(index);
      try {
        const closed = mergeGeometries([sides, caps], false);
        if (!closed) throw new Error("Unable to close library spine");
        return ownGeometry(closed);
      } finally { sides.dispose(); caps.dispose(); }
    })();
    const bindingGeometry = ownGeometry(new THREE.CylinderGeometry(0.5, 0.5, 1,
      budget.spineSegments, 1, true, Math.PI / 2, Math.PI));
    // Fine gilt rules are actual thin surfaces following the convex binding.
    // There are no letters, titles or borrowed decorations. Sampling follows
    // the body facets, avoiding a flat decal crossing through the curved spine.
    const toolingPositions: number[] = [], toolingNormals: number[] = [], toolingUv: number[] = [];
    const giltPoint = (u: number, v: number) => {
      const angle = Math.PI / 2 + u * Math.PI;
      toolingPositions.push(Math.sin(angle) * 0.516, v - 0.5, Math.cos(angle) * 0.516);
      toolingNormals.push(Math.sin(angle), 0, Math.cos(angle));
      toolingUv.push(u, v);
    };
    const giltQuad = (u0: number, v0: number, u1: number, v1: number,
      u2: number, v2: number, u3: number, v3: number) => {
      for (const [u, v] of [[u0, v0], [u1, v1], [u2, v2], [u0, v0], [u2, v2], [u3, v3]]) giltPoint(u, v);
    };
    const horizontalRule = (v: number) => {
      const samples = [0.25];
      for (let segment = 1; segment < budget.spineSegments; segment++) {
        const u = segment / budget.spineSegments;
        if (u > 0.25 && u < 0.75) samples.push(u);
      }
      samples.push(0.75);
      for (let index = 0; index < samples.length - 1; index++) {
        giltQuad(samples[index], v, samples[index + 1], v,
          samples[index + 1], v + 0.005, samples[index], v + 0.005);
      }
    };
    horizontalRule(0.285); horizontalRule(0.695);
    for (const u of [0.25, 0.746]) giltQuad(u, 0.29, u + 0.004, 0.29, u + 0.004, 0.695, u, 0.695);
    const diamond = [[0.5, 0.45], [0.59, 0.49], [0.5, 0.53], [0.41, 0.49], [0.5, 0.45]];
    for (let edge = 0; edge < diamond.length - 1; edge++) {
      const [u0, v0] = diamond[edge], [u1, v1] = diamond[edge + 1];
      const length = Math.hypot(u1 - u0, v1 - v0);
      const du = -(v1 - v0) / length * 0.002, dv = (u1 - u0) / length * 0.002;
      giltQuad(u0 + du, v0 + dv, u0 - du, v0 - dv, u1 - du, v1 - dv, u1 + du, v1 + dv);
    }
    const toolingGeometry = new THREE.BufferGeometry();
    toolingGeometry.setAttribute("position", new THREE.Float32BufferAttribute(toolingPositions, 3));
    toolingGeometry.setAttribute("normal", new THREE.Float32BufferAttribute(toolingNormals, 3));
    toolingGeometry.setAttribute("uv", new THREE.Float32BufferAttribute(toolingUv, 2));
    ownGeometry(toolingGeometry);

    // A closed opaque room fills every view from within the existing camera
    // envelope. Its wall chords are >11.8 from the origin; floor/ceiling >6.15.
    mesh("library-outer-wall", ownGeometry(new THREE.CylinderGeometry(12, 12, 12.5,
      budget.bays * 2, 1, true)), wall, background).position.y = 0.1;
    const floor = mesh("library-floor", unitBox, stone, background);
    floor.scale.set(26, 0.3, 26);
    floor.position.y = FLOOR_Y - 0.15;
    const ceiling = mesh("library-ceiling", unitBox, stone, background);
    ceiling.scale.set(26, 0.3, 26);
    ceiling.position.y = 6.5;
    const gallery = mesh("library-upper-gallery", ownGeometry(new THREE.RingGeometry(7.8, 12.1,
      budget.bays * 4)), galleryFinish, midground);
    gallery.rotation.x = -Math.PI / 2;
    gallery.position.y = -0.7;
    const galleryEdge = mesh("library-gallery-edge", ownGeometry(new THREE.CylinderGeometry(7.8, 7.8,
      0.16, budget.bays * 4, 1, true)), wood, midground);
    galleryEdge.position.y = -0.78;
    const galleryShadeGeometry = ownGeometry(new THREE.RingGeometry(7.81, 11.95, budget.bays * 4));
    const galleryShadePositions = galleryShadeGeometry.getAttribute("position");
    const galleryShadeUv = galleryShadeGeometry.getAttribute("uv");
    for (let vertex = 0; vertex < galleryShadePositions.count; vertex++) {
      galleryShadeUv.setXY(vertex, 0.5, (Math.hypot(galleryShadePositions.getX(vertex), galleryShadePositions.getY(vertex)) - 7.81) / (11.95 - 7.81));
    }
    const galleryShade = mesh("library-gallery-contact-occlusion", galleryShadeGeometry, galleryOcclusion, midground);
    galleryShade.rotation.x = -Math.PI / 2;
    galleryShade.position.y = -0.862;
    const handrail = mesh("library-gallery-handrail", ownGeometry(new THREE.TorusGeometry(7.9, 0.04,
      budget.tubeSegments, budget.bays * 4)), trim, foreground);
    handrail.rotation.x = -Math.PI / 2;
    handrail.position.y = 0.25;
    mesh("library-continuous-cornice", ownGeometry(new THREE.LatheGeometry([
      [7.5, 4.97], [7.85, 4.97], [7.85, 5.05], [7.75, 5.1],
      [7.92, 5.15], [7.92, 5.29], [7.5, 5.29], [7.5, 4.97],
    ].map(([radius, y]) => new THREE.Vector2(radius, y)), budget.bays * 4)), shelves, foreground);
    const corniceBead = mesh("library-cornice-bead", ownGeometry(new THREE.TorusGeometry(7.49, 0.035,
      budget.tubeSegments, budget.bays * 4)), trim, foreground);
    corniceBead.rotation.x = Math.PI / 2; corniceBead.position.y = 5.13;
    for (const radius of [2.65, 5.25]) {
      const inlay = mesh(`library-floor-inlay-${radius}`, ownGeometry(new THREE.RingGeometry(radius, radius + 0.035,
        budget.bays * 4)), trim, background);
      inlay.rotation.x = -Math.PI / 2; inlay.position.y = FLOOR_Y + 0.029;
    }

    const posts: Placement[] = [], feet: Placement[] = [], cornices: Placement[] = [];
    const shelfBoards: Placement[] = [], bookPlacements: Placement[] = [], backs: Placement[] = [];
    const pageBlocks: Placement[] = [], bookCovers: Placement[] = [], bindingBands: Placement[] = [];
    const bookcaseSides: Placement[] = [], lamps: Placement[] = [], lampBrackets: Placement[] = [];
    const gallerySupports: Placement[] = [], balusters: Placement[] = [], windows: Placement[] = [], windowFrames: Placement[] = [];
    const windowReveals: Placement[] = [], glazing: Placement[] = [], lampCaps: Placement[] = [];
    const casePanels: Placement[] = [], caseMoldings: Placement[] = [], joinery: Placement[] = [], bookTooling: Placement[] = [];
    const parquet: Placement[] = [], cofferBeams: Placement[] = [], coffers: Placement[] = [];
    const arches: Placement[] = [], archInlays: Placement[] = [];
    const floorContacts: Placement[] = [], cabinetContacts: Placement[] = [], shelfContacts: Placement[] = [], bookContacts: Placement[] = [];
    for (let x = -10; x <= 10; x += 2) for (let z = -10; z <= 10; z += 2) {
      if (Math.hypot(x, z) > 10.2) continue;
      const angle = ((x + z) / 2) % 2 === 0 ? 0 : Math.PI / 2;
      for (let strip = 0; strip < budget.parquetStrips; strip += 1) {
        const offset = -1 + (strip + 0.5) * 2 / budget.parquetStrips;
        parquet.push({ x: x + Math.sin(angle) * offset, z: z + Math.cos(angle) * offset,
          y: FLOOR_Y + 0.014, width: 1.98, height: 0.028, depth: 2 / budget.parquetStrips - 0.015, angle,
          color: new THREE.Color().setRGB(0.82 + ((x + 10 + z + 10 + strip) % 5) * 0.035, 0.83, 0.8) });
      }
    }
    for (let coordinate = -10; coordinate <= 10; coordinate += 2.5) {
      cofferBeams.push({ x: coordinate, z: 0, y: 6.23, width: 0.19, height: 0.24, depth: 24, angle: 0 });
      cofferBeams.push({ x: 0, z: coordinate, y: 6.23, width: 24, height: 0.24, depth: 0.19, angle: 0 });
      for (let other = -10; other < 10; other += 2.5) {
        if (Math.hypot(coordinate + 1.25, other + 1.25) > 10) continue;
        coffers.push({ x: coordinate + 1.25, z: other + 1.25, y: 6.31,
          width: 2.22, height: 0.075, depth: 2.22, angle: 0 });
      }
    }
    const spineColors = ["#7e5144", "#475e52", "#64504f", "#947654", "#414f5d", "#676346", "#7a3f38", "#9b8965"];
    const palette = spineColors.map(color => new THREE.Color(color));
    const bookShells: Placement[][] = palette.map(() => []);
    for (let bay = 0; bay < budget.bays; bay += 1) {
      const angle = bay / budget.bays * Math.PI * 2;
      // Each storey has a fluted shaft seated between turned base and capital.
      // The shaft's entire radial surface stays beyond7.5, not just its endpoints.
      for (const tangent of [-0.96, 0.96]) {
        floorContacts.push(radial(angle, 7.7, tangent, FLOOR_Y + 0.030, 0.78, 1, 0.78));
        feet.push(radial(angle, 7.7, tangent, FLOOR_Y + 0.19, 0.50, 0.38, 0.50));
        feet.push(radial(angle, 7.7, tangent, -0.55, 0.43, 0.30, 0.43));
        posts.push(radial(angle, 7.7, tangent, -3.475, 0.28, 4.59, 0.28));
        posts.push(radial(angle, 7.7, tangent, 1.515, 0.25, 3.83, 0.25));
        cornices.push(radial(angle, 7.7, tangent, -0.94, 0.49, 0.48, 0.49));
        cornices.push(radial(angle, 7.7, tangent, 3.64, 0.46, 0.42, 0.46));
      }
      arches.push(radial(angle, 7.7, 0, 3.85, 1, 1, 1));
      archInlays.push(radial(angle, 7.57, 0, 3.85, 1, 1, 1));
      for (const tangent of [-0.96, 0.96]) {
        gallerySupports.push(radial(angle, 9.9, tangent, -0.87, 0.18, 0.34, 4.4));
      }
      for (let post = 0; post < 4; post += 1) {
        balusters.push(radial(angle + post / 4 * Math.PI * 2 / budget.bays,
          7.9, 0, -0.225, 0.095, 0.95, 0.095));
      }
      const windowAngle = angle + Math.PI / budget.bays;
      const windowWidth = Math.min(2.3, 11.45 * Math.PI * 2 / budget.bays * 0.52);
      for (const windowY of [-3.35, 2.35]) {
        windows.push(radial(windowAngle, 11.91, 0, windowY, windowWidth, 3.9, 0.44));
        glazing.push(radial(windowAngle, 11.41, 0, windowY, windowWidth - 0.13, 3.8, 1));
        for (const tangent of [-windowWidth / 2, windowWidth / 2]) {
          windowReveals.push(radial(windowAngle, 11.61, tangent, windowY, 0.18, 4.2, 0.88));
        }
        for (const yOffset of [-2.03, 2.03]) {
          windowReveals.push(radial(windowAngle, 11.61, 0, windowY + yOffset, windowWidth + 0.3, 0.20, 0.88));
        }
        for (const tangent of [-windowWidth / 2, 0, windowWidth / 2]) {
          windowFrames.push(radial(windowAngle, 11.38, tangent, windowY, 0.08, 4, 0.12));
        }
        for (const yOffset of [-1.95, -0.975, 0, 0.975, 1.95]) {
          windowFrames.push(radial(windowAngle, 11.38, 0, windowY + yOffset, windowWidth + 0.08, 0.08, 0.12));
        }
      }
      // The deeper bookcase stands on its own plinth, continuous down to floor.
      floorContacts.push(radial(angle, 9.35, 0, FLOOR_Y + 0.030, 2.76, 1, 1.05));
      shelfBoards.push(radial(angle, 9.35, 0, FLOOR_Y + 0.18, 2.42, 0.36, 0.74));
      for (let segment = 0; segment < 4; segment += 1) {
        const y = FLOOR_Y + 1.45 + segment * 2.9;
        backs.push(radial(angle, 9.73, 0, y, 2.35, 2.9, 0.14));
        casePanels.push(radial(angle, 9.63, 0, y, 2.08, 2.55, 0.06));
        for (const tangent of [-1.04, 1.04]) {
          caseMoldings.push(radial(angle, 9.54, tangent, y, 0.045, 2.6, 0.05));
        }
        for (const offset of [-1.28, 1.28]) {
          caseMoldings.push(radial(angle, 9.54, 0, y + offset, 2.14, 0.055, 0.05));
        }
        for (const tangent of [-1.14, 1.14]) bookcaseSides.push(radial(angle, 9.35, tangent, y, 0.16, 2.9, 0.68));
      }
      for (let row = 0; row < budget.rows; row += 1) {
        const rowsPerLevel = budget.rows / 2;
        const shelfY = (row < rowsPerLevel ? FLOOR_Y + 0.36 : -0.45)
          + (row % rowsPerLevel) * (4.7 / rowsPerLevel);
        const chamberHeight = 4.7 / rowsPerLevel - 0.11;
        cabinetContacts.push(radial(angle, 9.588, 0, shelfY + 0.11 + chamberHeight / 2,
          2.075, chamberHeight, 1));
        shelfContacts.push(radial(angle, 9.35, 0, shelfY + 0.112, 2.25, 1, 0.64));
        shelfBoards.push(radial(angle, 9.35, 0, shelfY + 0.055, 2.32, 0.11, 0.7));
        caseMoldings.push(radial(angle, 8.995, 0, shelfY + 0.055, 2.35, 0.045, 0.06));
        for (const tangent of [-1.1, 1.1]) {
          joinery.push(radial(angle, 8.985, tangent, shelfY + 0.055, 0.027, 0.027, 0.025));
        }
        // Volumes have separate page blocks, beveled covers, convex leather
        // spines and two raised binding bands. Nothing depicts a real title.
        const horizontalStack = variation(bay, row, 1) < 0.22;
        const standingCount = budget.books - (horizontalStack ? 3 : 0);
        const standingStart = horizontalStack ? -0.12 : -1.04;
        const gap = 0.009;
        const clusterBoundary = Math.max(1, Math.floor(standingCount * (0.35 + variation(bay, row, 2) * 0.3)));
        const clusterGap = horizontalStack ? 0.035 : 0.09 + variation(bay, row, 3) * 0.16;
        // The occasional last book rests toward the cabinet upright. Reserve
        // its full projected width before filling the row, so it never cuts a neighbour.
        const leaning = standingCount > 2 && variation(bay, row, 4) > 0.55;
        const lean = leaning ? -(0.04 + variation(bay, row, 5) * 0.055) : 0;
        const leanReserve = leaning ? 0.105 : 0;
        const weights = Array.from({ length: standingCount }, (_, book) =>
          0.62 + variation(bay, row, 20 + book) * 0.8);
        const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
        const availableWidth = 1.04 - standingStart - gap * (standingCount - 1) - clusterGap - leanReserve;
        const volumes: { width: number; height: number; tangent: number; centerY: number; roll: number }[] = [];
        const collectionHeight = 0.69 + variation(bay, row, 6) * 0.17;
        let edge = standingStart;
        for (let book = 0; book < standingCount; book += 1) {
          if (book === clusterBoundary) edge += clusterGap;
          const width = weights[book] / weightSum * availableWidth;
          const height = collectionHeight + (variation(bay, row, 40 + book) - 0.5) * 0.19;
          const roll = book === standingCount - 1 ? lean : 0;
          const halfWidth = (width * Math.cos(roll) + height * Math.abs(Math.sin(roll))) / 2;
          const halfHeight = (height * Math.cos(roll) + width * Math.abs(Math.sin(roll))) / 2;
          const tangent = roll ? 1.043 - halfWidth : edge + halfWidth;
          volumes.push({ width, height, tangent,
            centerY: shelfY + 0.11 + halfHeight, roll });
          edge += halfWidth * 2 + gap;
        }
        if (horizontalStack) for (let stack = 0; stack < 2; stack += 1) {
          volumes.push({ width: 0.13, height: 0.82 - stack * 0.055,
            tangent: -0.60 + stack * 0.025, centerY: shelfY + 0.11 + 0.065 + stack * 0.13,
            roll: Math.PI / 2 });
        }
        let stackSupport: { left: number; right: number; front: number; back: number; top: number } | undefined;
        volumes.forEach(({ width, height, tangent, centerY, roll }, book) => {
          const offset = (variation(bay, row, 60 + book) - 0.5) * 0.08;
          const coverDepth = 0.42 + variation(bay, row, 80 + book) * 0.085;
          // Narrow volumes have a much flatter binding than a thick folio.
          // Keep the front edge aligned with the cover boards while all three
          // curved layers share the same proportion and centre.
          const spineDepth = Math.max(0.035, Math.min(0.075, width * 0.24));
          const spineRadius = 9.009 + spineDepth / 2;
          const part = (radius: number, x: number, y: number, w: number, h: number, d: number) => {
            const placement = radial(angle, radius + offset,
              tangent + x * Math.cos(roll) - y * Math.sin(roll),
              centerY + x * Math.sin(roll) + y * Math.cos(roll), w, h, d);
            placement.roll = roll;
            return placement;
          };
          const clusterColor = Math.floor(variation(bay, row, book < clusterBoundary ? 8 : 9) * palette.length);
          const collection = (clusterColor + (variation(bay, row, 155 + book) > 0.78 ? 1 : 0)) % palette.length;
          const leatherValue = 0.88 + variation(bay, row, 100 + book) * 0.22;
          const color = palette[collection].clone().multiplyScalar(leatherValue);
          if (quality !== "high") {
            const shell = part(9.006 + (coverDepth + 0.009) / 2, 0, 0, width, height, coverDepth + 0.009);
            shell.color = new THREE.Color(leatherValue, leatherValue, leatherValue);
            bookShells[collection].push(shell);
          }
          const spine = part(spineRadius, 0, 0, width - 0.008, height - 0.012, spineDepth);
          spine.color = color; bookPlacements.push(spine);
          if (variation(bay, row, 165 + book) > 0.42) {
            const tooling = part(spineRadius, 0, 0, width - 0.008, height - 0.012, spineDepth);
            const patina = 0.55 + variation(bay, row, 175 + book) * 0.4;
            tooling.color = new THREE.Color().setRGB(patina, patina * 0.96, patina * 0.84);
            bookTooling.push(tooling);
          }
          const page = part(9.05 + (coverDepth - 0.055) / 2, 0, 0, width - 0.028, height - 0.035, coverDepth - 0.055);
          page.color = new THREE.Color().setRGB(0.94, 0.90 + variation(bay, row, 120 + book) * 0.07, 0.81 + variation(bay, row, 140 + book) * 0.11);
          pageBlocks.push(page);
          for (const side of [-1, 1]) {
            const cover = part(9.015 + coverDepth / 2, side * (width / 2 - 0.008), 0, 0.016, height, coverDepth);
            cover.color = color; bookCovers.push(cover);
          }
          for (const bandHeight of [0.18, 0.82]) {
            bindingBands.push(part(spineRadius, 0, height * (bandHeight - 0.5), width - 0.002, 0.014, spineDepth + 0.006));
          }
          // Reuse the room's soft contact tile at the actual support surface.
          // A leaning book touches at its lower corner; a horizontal volume
          // rests on the previous cover, not on a floating shadow above a shelf.
          const lyingFlat = Math.abs(roll) > Math.PI / 4;
          const front = 9.009 + offset, back = 9.015 + offset + coverDepth;
          if (lyingFlat) {
            let left = tangent - height / 2, right = tangent + height / 2;
            let shadowFront = front, shadowBack = back;
            let surfaceY = shelfY + 0.11;
            if (stackSupport) {
              left = Math.max(left, stackSupport.left) + 0.001;
              right = Math.min(right, stackSupport.right) - 0.001;
              shadowFront = Math.max(shadowFront, stackSupport.front) + 0.001;
              shadowBack = Math.min(shadowBack, stackSupport.back) - 0.001;
              surfaceY = stackSupport.top;
            } else {
              left -= 0.025; right += 0.025;
              shadowFront -= 0.025; shadowBack += 0.025;
            }
            bookContacts.push(radial(angle, (shadowFront + shadowBack) / 2, (left + right) / 2,
              surfaceY + 0.0015, right - left, 1, shadowBack - shadowFront));
            stackSupport = { left: tangent - height / 2, right: tangent + height / 2,
              front: 9.015 + offset, back, top: centerY + width / 2 };
          } else {
            const supportX = roll === 0 ? tangent
              : tangent - Math.sign(roll) * width * Math.cos(roll) / 2 + height * Math.sin(roll) / 2;
            const contactWidth = roll === 0 ? width + 0.055 : Math.min(width, 0.075) + 0.055;
            bookContacts.push(radial(angle, (front + back) / 2, supportX,
              shelfY + 0.1115, contactWidth, 1, back - front + 0.055));
          }
        });
      }
      shelfBoards.push(radial(angle, 9.35, 0, 5.46, 2.5, 0.18, 0.80));
      shelfBoards.push(radial(angle, 9.35, 0, 5.59, 2.62, 0.08, 0.86));
      caseMoldings.push(radial(angle, 8.92, 0, 5.61, 2.65, 0.045, 0.06));
      // Wall lamps attach to bookcase uprights; no suspended or free-floating prop.
      lampBrackets.push(radial(angle, 9.26, 1.14, 1.75, 1, 1, 1));
      lamps.push(radial(angle, 8.81, 1.14, 2.15, 0.36, 0.46, 0.36));
      lampCaps.push(radial(angle, 8.81, 1.14, 1.90, 0.3, 0.06, 0.3));
      lampCaps.push(radial(angle, 8.81, 1.14, 2.39, 0.3, 0.06, 0.3));
    }
    repeatedAssembly("library-columns", shaftGeometry, wood, posts, foreground, 4);
    instanced("library-column-feet", turnedGeometry, shelves, feet, foreground);
    instanced("library-column-capitals", capitalGeometry, shelves, cornices, foreground);
    repeatedAssembly("library-gallery-balusters", balusterGeometry, wood, balusters, foreground, 4);
    instanced("library-arches", ownGeometry(new THREE.TorusGeometry(1.02, 0.13,
      budget.tubeSegments, budget.archSegments, Math.PI)), wood, arches, foreground);
    instanced("library-arch-inlay", ownGeometry(new THREE.TorusGeometry(0.88, 0.024,
      budget.tubeSegments, budget.archSegments, Math.PI)), trim, archInlays, foreground);
    repeatedAssembly("library-bookcase-backs", unitBox, recess, backs, midground, 4);
    instanced("library-cabinet-contact-occlusion", ownGeometry(new THREE.PlaneGeometry(1, 1).rotateY(Math.PI)),
      cabinetOcclusion, cabinetContacts, midground);
    instanced("library-shelf-contact-occlusion", ownGeometry(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)),
      shelfOcclusion, shelfContacts, midground);
    repeatedAssembly("library-bookcase-raised-panels", woodUv(chamferedBox(2.1, 2.5, 0.06, 0.015), 2.1, 2.5, 0.06), wood, casePanels, midground, 4);
    repeatedAssembly("library-case-moldings", moldingGeometry, shelves, caseMoldings, midground, 25);
    repeatedAssembly("library-joinery-pins", unitBox, trim, joinery, midground, 16);
    repeatedAssembly("library-gallery-supports", woodUv(chamferedBox(0.18, 0.34, 4.4, 0.02), 0.18, 0.34, 4.4), wood, gallerySupports, midground, 2);
    repeatedAssembly("library-bookcase-uprights", stileGeometry, wood, bookcaseSides, midground, 8);
    repeatedAssembly("library-shelves", boardGeometry, shelves, shelfBoards, midground, 11);
    if (quality === "high") {
      instanced("library-unlettered-books", spineGeometry, books, bookPlacements, midground);
      instanced("library-book-covers", coverGeometry, books, bookCovers, midground);
      instanced("library-book-binding-bands", bindingGeometry, trim, bindingBands, midground);
      instanced("library-book-gilt-tooling", toolingGeometry, trim, bookTooling, midground);
    } else {
      // Palette changes need material colour, not eight copies of identical
      // geometry. Both material groups share this one owned bound shell.
      const shell = createLibraryBookShellGeometry(coverGeometry, spineGeometry, bindingGeometry);
      geometries.add(shell);
      for (const [index, shellPlacements] of bookShells.entries()) {
        const leather = books.clone(); leather.color.copy(palette[index]); materials.add(leather);
        instanced(`library-book-shell-${index}`, shell, [leather, trim], shellPlacements, midground);
      }
    }
    instanced("library-book-page-blocks", unitBox, paper, pageBlocks, midground);
    if (quality !== "economy") {
      instanced("library-book-contact-occlusion", ownGeometry(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)),
        contactFinish, bookContacts, midground);
    }
    instanced("library-lamp-brackets", ownGeometry(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.02, -0.40), new THREE.Vector3(0, 0.15, -0.45)),
      budget.tubeSegments * 2, 0.026, budget.tubeSegments, false)), trim, lampBrackets, midground);
    instanced("library-reading-lamps", ownGeometry(new THREE.LatheGeometry([
      [0.30, -0.5], [0.43, -0.4], [0.5, 0.30], [0.38, 0.5],
      [0.32, 0.48], [0.43, 0.28], [0.36, -0.38], [0.25, -0.5], [0.30, -0.5],
    ].map(([radius, y]) => new THREE.Vector2(radius, y)), budget.turnedSegments)), lamp, lamps, midground);
    instanced("library-lamp-caps", turnedGeometry, trim, lampCaps, midground);
    instanced("library-windows", unitBox, windowFinish, windows, background);
    instanced("library-window-glazing", ownGeometry(new THREE.PlaneGeometry(1, 1)), glass, glazing, background);
    repeatedAssembly("library-window-reveals", boardGeometry, stone, windowReveals, background, 4);
    repeatedAssembly("library-window-frames", moldingGeometry, trim, windowFrames, background, 8);
    instanced("library-parquet", boardGeometry, galleryFinish, parquet, background);
    instanced("library-ceiling-coffer-beams", boardGeometry, wood, cofferBeams, background);
    instanced("library-ceiling-coffer-panels", boardGeometry, shelves, coffers, background);
    instanced("library-floor-contact-occlusion", ownGeometry(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)),
      contactFinish, floorContacts, background);
    for (const source of [
      { name: "library-window-daylight", color: "#c2dbf0", intensity: 7, distance: 4,
        position: daylightPosition, emitterMesh: "library-window-glazing", emitterInstance: daylightBay * 2 + 1, emitterOffset: 0.75 },
      { name: "library-sconce-light", color: "#ffd3a0", intensity: 1.65, distance: 3.6,
        position: warmPosition, emitterMesh: "library-reading-lamps", emitterInstance: warmBay, emitterOffset: 0 },
    ]) {
      const light = new THREE.PointLight(source.color, source.intensity, source.distance, 2);
      lights.add(light);
      light.name = source.name;
      light.position.copy(source.position);
      light.userData = { source: "authored-in-project", restrictedDistance: source.distance,
        emitterMesh: source.emitterMesh, emitterInstance: source.emitterInstance, emitterOffset: source.emitterOffset };
      midground.add(light);
    }
    if (quality === "economy") {
      // Pack baked shading after all assembly/merge operations. Normalized
      // bytes retain the same standard-material colour path while cutting
      // colour-buffer storage by 75%; maximum rounding error is 1/255.
      // The shared page core and per-instance palette remain exact Float32.
      for (const geometry of geometries) {
        if (geometry === unitBox) continue;
        const colors = geometry.getAttribute("color");
        if (!colors) continue;
        const packed = new Uint8Array(colors.count * 3);
        for (let index = 0; index < colors.count; index++) {
          packed[index * 3] = Math.round(clamp(colors.getX(index)) * 255);
          packed[index * 3 + 1] = Math.round(clamp(colors.getY(index)) * 255);
          packed[index * 3 + 2] = Math.round(clamp(colors.getZ(index)) * 255);
        }
        geometry.setAttribute("color", new THREE.Uint8BufferAttribute(packed, 3, true));
      }
    }
    group.updateMatrixWorld(true);
    return Object.freeze({
      group,
      setAmbientTime(seconds: number) {
        if (!disposed && Number.isFinite(seconds) && seconds >= 0) {
          lamp.emissiveIntensity = 0.3 + Math.sin(seconds * 0.45) * 0.035;
        }
      },
      dispose,
    });
  } catch (error) {
    dispose();
    throw error;
  }
}
