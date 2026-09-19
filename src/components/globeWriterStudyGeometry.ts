import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createGlobeCraftMaterials } from "./globeCraftMaterials";
import type { GlobeQualityTier } from "./globeQuality";

export interface OwnedGlobeWriterStudy {
  readonly group: THREE.Group;
  setAmbientTime(seconds: number): void;
  dispose(): void;
}

const FLOOR = -6.15;
const levels = {
  high: { bevel: 2, radial: 28, curve: 24, page: 16, texture: 64 },
  balanced: { bevel: 1, radial: 18, curve: 16, page: 10, texture: 32 },
  economy: { bevel: 0, radial: 10, curve: 10, page: 6, texture: 16 },
} as const;
const smooth = (value: number) => THREE.MathUtils.smoothstep(value, 0, 1);
function variation(a: number, b: number, c = 0): number {
  let bits = Math.imul(a + 71, 73856093) ^ Math.imul(b + 23, 19349663) ^ Math.imul(c + 3, 83492791);
  bits = Math.imul(bits ^ (bits >>> 13), 1274126177);
  return ((bits ^ (bits >>> 16)) >>> 0) / 4294967295;
}

type Placement = Readonly<{
  x: number; y: number; z: number; width: number; height: number; depth: number;
  angle?: number; roll?: number; color?: THREE.Color;
}>;

/** Original, fully three-dimensional room. The complete furniture layout and
 * all 192 bound volumes are invariant across quality tiers. Only tessellation
 * and map resolution change. Nothing owns a camera, renderer or global light. */
export function createGlobeWriterStudy(quality: GlobeQualityTier): OwnedGlobeWriterStudy {
  if (!Object.prototype.hasOwnProperty.call(levels, quality)) throw new Error("Invalid writer study quality");
  const detail = levels[quality];
  const group = new THREE.Group();
  group.name = "included-globe-background:background.base.writer-study";
  group.userData = { backgroundId: "background.base.writer-study", sceneId: "probpera-writer-study-3d",
    qualityTier: quality, provenance: "authored-in-project", cameraClearanceRadius: 5.6 };
  const layer = (name: string) => { const value = new THREE.Group(); value.name = `writer-study-${name}`; group.add(value); return value; };
  const foreground = layer("foreground"), midground = layer("midground"), background = layer("background");
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>(), instances = new Set<THREE.InstancedMesh>(), lights = new Set<THREE.PointLight>();
  let craft: ReturnType<typeof createGlobeCraftMaterials> | undefined;
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const value of instances) value.dispose();
    for (const value of lights) value.dispose();
    for (const value of geometries) value.dispose();
    for (const value of materials) value.dispose();
    for (const value of textures) value.dispose();
    craft?.dispose();
    group.clear();
  };
  const own = <T extends THREE.BufferGeometry>(value: T): T => { geometries.add(value); return value; };
  const mesh = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], root: THREE.Group) => {
    const result = new THREE.Mesh(geometry, material); result.name = `writer-study-${name}`;
    result.raycast = () => undefined; root.add(result); return result;
  };
  const cloneFinish = (base: THREE.MeshStandardMaterial, color: string, exposure = 0.3) => {
    const material = base.clone(); material.color.set(color); material.vertexColors = true;
    material.envMapIntensity = exposure; materials.add(material); return material;
  };
  const plainFinish = (color: string, roughness = 0.8) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness, vertexColors: true });
    materials.add(material); return material;
  };
  const daylight = new THREE.Vector3(-4.9, 0.3, -10.75);
  const lampPosition = new THREE.Vector3(1.45, -2.80, -8.12);
  const exposureAt = (point: THREE.Vector3) => {
    const cool = Math.exp(-point.distanceToSquared(daylight) / 41);
    const warm = Math.exp(-point.distanceToSquared(lampPosition) / 6);
    return new THREE.Color().setRGB(.78 + cool * .13 + warm * .09, .80 + cool * .15 + warm * .055, .83 + cool * .16 + warm * .015);
  };
  const shade = (geometry: THREE.BufferGeometry, tint = new THREE.Color(1, 1, 1), world = false) => {
    const positions = geometry.getAttribute("position"), normals = geometry.getAttribute("normal");
    const colors = new Float32Array(positions.count * 3), point = new THREE.Vector3();
    for (let index = 0; index < positions.count; index++) {
      const ny = normals.getY(index), value = ny < -.5 ? .70 : ny > .5 ? 1 : .91;
      const color = tint.clone().multiplyScalar(value);
      if (world) color.multiply(exposureAt(point.fromBufferAttribute(positions, index)));
      colors.set([color.r, color.g, color.b], index * 3);
    }
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3)); return geometry;
  };
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), scale = new THREE.Vector3();
  const rotation = new THREE.Quaternion(), roll = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0), forward = new THREE.Vector3(0, 0, 1);
  const placementMatrix = (item: Placement) => {
    position.set(item.x, item.y, item.z); scale.set(item.width, item.height, item.depth);
    rotation.setFromAxisAngle(up, item.angle ?? 0);
    if (item.roll) rotation.multiply(roll.setFromAxisAngle(forward, item.roll));
    return matrix.compose(position, rotation, scale);
  };
  const instanced = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[],
    placements: readonly Placement[], root: THREE.Group, unlitColor = false) => {
    const result = new THREE.InstancedMesh(geometry, material, placements.length); instances.add(result);
    result.name = `writer-study-${name}`; result.raycast = () => undefined;
    placements.forEach((item, index) => {
      result.setMatrixAt(index, placementMatrix(item));
      const color = item.color?.clone() ?? new THREE.Color(1, 1, 1);
      if (!unlitColor) color.multiply(exposureAt(new THREE.Vector3(item.x, item.y, item.z)));
      result.setColorAt(index, color);
    });
    result.instanceMatrix.needsUpdate = true;
    if (result.instanceColor) result.instanceColor.needsUpdate = true;
    result.computeBoundingSphere(); root.add(result); return result;
  };

  // Local geometric batches retain proper per-piece physical UVs. Long wood
  // fibres follow each board's length, rather than stretching one tile across
  // unrelated table tops, end grain, legs and wall panels.
  const physicalWoodUv = (geometry: THREE.BufferGeometry, width: number, height: number, depth: number) => {
    const vertices = geometry.getAttribute("position"), normals = geometry.getAttribute("normal"), uv = geometry.getAttribute("uv");
    for (let index = 0; index < vertices.count; index++) {
      const x = vertices.getX(index), y = vertices.getY(index), z = vertices.getZ(index);
      const nx = Math.abs(normals.getX(index)), ny = Math.abs(normals.getY(index)), nz = Math.abs(normals.getZ(index));
      if (width >= height && width >= depth) uv.setXY(index, (nx > ny && nx > nz ? z : ny > nz ? z : y) * .50, (nx > ny && nx > nz ? y : x) * .38);
      else if (height >= depth) uv.setXY(index, (ny > nx && ny > nz ? x : nx > nz ? z : x) * .50, (ny > nx && ny > nz ? z : y) * .38);
      else uv.setXY(index, (nz > nx && nz > ny ? x : ny > nx ? x : y) * .50, (nz > nx && nz > ny ? y : z) * .38);
    }
    return geometry;
  };
  const board = (width: number, height: number, depth: number, radius = .025, woodUv = true) => {
    let result: THREE.BufferGeometry;
    if (!detail.bevel || radius <= 0) result = new THREE.BoxGeometry(width, height, depth);
    else {
      const bevel = Math.min(radius, width / 4, height / 4, depth / 4);
      const shape = new THREE.Shape(), hx = width / 2 - bevel, hy = height / 2 - bevel;
      shape.moveTo(-hx, -hy); shape.lineTo(hx, -hy); shape.lineTo(hx, hy); shape.lineTo(-hx, hy); shape.closePath();
      result = new THREE.ExtrudeGeometry(shape, { depth: depth - bevel * 2, bevelEnabled: true,
        bevelSegments: detail.bevel, steps: 1, bevelSize: bevel, bevelThickness: bevel, curveSegments: 1 });
      result.translate(0, 0, -(depth - bevel * 2) / 2); result.clearGroups();
    }
    return woodUv ? physicalWoodUv(result, width, height, depth) : result;
  };
  type Batch = { parts: THREE.BufferGeometry[]; material: THREE.Material; root: THREE.Group };
  const batches = new Map<string, Batch>();
  const append = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, root: THREE.Group,
    transform = new THREE.Matrix4(), tint = new THREE.Color(1, 1, 1)) => {
    const batch = batches.get(name) ?? { parts: [], material, root };
    if (batch.material !== material || batch.root !== root) {
      geometry.dispose(); throw new Error(`Mismatched writer study batch ${name}`);
    }
    // Extruded boards have split face vertices, while lathes/boxes are indexed.
    // Normalise temporary pieces before merging, retaining their hard normals.
    const part = geometry.index ? geometry.toNonIndexed() : geometry;
    if (part !== geometry) geometry.dispose();
    part.clearGroups(); part.applyMatrix4(transform); shade(part, tint, name !== "room-shell");
    batch.parts.push(part); batches.set(name, batch);
  };
  const box = (name: string, material: THREE.Material, root: THREE.Group, x: number, y: number, z: number,
    width: number, height: number, depth: number, radius = .025, angle = 0, tint?: THREE.Color) => {
    const transform = new THREE.Matrix4().makeRotationY(angle); transform.setPosition(x, y, z);
    append(name, board(width, height, depth, radius), material, root, transform, tint);
  };
  const lathe = (points: readonly (readonly [number, number])[], material: THREE.Material, name: string,
    root: THREE.Group, x: number, y: number, z: number, xScale = 1, zScale = 1) => {
    const geometry = new THREE.LatheGeometry(points.map(([r, h]) => new THREE.Vector2(r, h)), detail.radial);
    geometry.scale(xScale, 1, zScale);
    append(name, geometry, material, root, new THREE.Matrix4().makeTranslation(x, y, z));
  };
  const tube = (name: string, points: THREE.Vector3[], radius: number, material: THREE.Material, root: THREE.Group) => {
    append(name, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), detail.curve, radius,
      quality === "high" ? 8 : quality === "balanced" ? 6 : 4, false), material, root);
  };
  const tile = (name: string, paint: (u: number, v: number) => readonly number[], color = false) => {
    const size = detail.texture, bytes = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) bytes.set(paint((x + .5) / size, (y + .5) / size), (y * size + x) * 4);
    const result = new THREE.DataTexture(bytes, size, size, THREE.RGBAFormat); textures.add(result);
    result.name = `writer-study-${name}:${quality}`; result.userData = { provenance: "authored-in-project", qualityTier: quality };
    result.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    result.minFilter = THREE.LinearMipmapLinearFilter; result.magFilter = THREE.LinearFilter;
    result.generateMipmaps = true; result.needsUpdate = true; return result;
  };

  // Closed page stacks with curved upper leaves: indexed physical surfaces,
  // no cover image, labels or text. Both sides and the fore-edges are present.
  const curvedPaper = (width: number, depth: number, thickness: number,
    rise: (u: number, v: number) => number, segments = detail.page) => {
    const vertices: number[] = [], uv: number[] = [], indices: number[] = [];
    const row = segments + 1, layerSize = row * row;
    for (let layer = 0; layer < 2; layer++) for (let z = 0; z <= segments; z++) for (let x = 0; x <= segments; x++) {
      const u = x / segments, v = z / segments;
      vertices.push((u - .5) * width, rise(u, v) - layer * thickness, (v - .5) * depth); uv.push(u, v);
    }
    for (let z = 0; z < segments; z++) for (let x = 0; x < segments; x++) {
      const a = z * row + x, b = a + 1, c = a + row, d = c + 1;
      indices.push(a, c, b, b, c, d, a + layerSize, b + layerSize, c + layerSize, b + layerSize, d + layerSize, c + layerSize);
    }
    const perimeter: number[] = [];
    for (let x = 0; x < segments; x++) perimeter.push(x);
    for (let z = 0; z < segments; z++) perimeter.push(z * row + segments);
    for (let x = segments; x > 0; x--) perimeter.push(segments * row + x);
    for (let z = segments; z > 0; z--) perimeter.push(z * row);
    for (let i = 0; i < perimeter.length; i++) {
      const a = perimeter[i], b = perimeter[(i + 1) % perimeter.length];
      indices.push(a, b, a + layerSize, b, b + layerSize, a + layerSize);
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
  };

  try {
    craft = createGlobeCraftMaterials(quality);
    const walnut = cloneFinish(craft.darkWood, "#766657", .24); walnut.normalScale.set(.12, .12);
    const lightWood = cloneFinish(craft.wood, "#9e8b70", .22); lightWood.normalScale.set(.14, .14);
    const recess = cloneFinish(craft.darkWood, "#6b6256", .14); recess.normalScale.set(.10, .10);
    const brass = cloneFinish(craft.brass, "#b39a69", .58); brass.metalness = .83;
    const leather = cloneFinish(craft.leather, "#ffffff", .20);
    const chairLeather = cloneFinish(craft.leather, "#414d43", .20);
    const paperEdges = cloneFinish(craft.paper, "#d8cfb7", .08);
    const paper = cloneFinish(craft.paper, "#e8dfca", .06); paper.map = null; paper.normalScale.set(.06, .06);
    // Quiet lime plaster has no stone veins. The architectural pieces receive
    // the same diffuse colour and spatial vertex exposure across their seams.
    const wall = plainFinish("#89918c", .96);
    const plaster = plainFinish("#c6c0ad", .92);
    const floorFinish = cloneFinish(craft.wood, "#85735e", .18); floorFinish.normalScale.set(.12, .12);
    const darkMetal = plainFinish("#292c2b", .6);
    const contactMap = tile("contact-occlusion", (u, v) => {
      const a = Math.pow(Math.max(0, 1 - Math.pow((u - .5) * 2, 6)), 2)
        * Math.pow(Math.max(0, 1 - Math.pow((v - .5) * 2, 6)), 2);
      const value = Math.round(a * 255); return [value, value, value, 255];
    });
    const contact = new THREE.MeshStandardMaterial({ color: "#161811", alphaMap: contactMap,
      transparent: true, opacity: .37, depthWrite: false, roughness: 1, side: THREE.DoubleSide });
    contact.forceSinglePass = true; materials.add(contact);
    const shadows: Placement[] = [];

    // Complete 360-degree shell. Every crossing floor/ceiling face is beyond
    // r=5.6; furniture and panel surfaces are still farther away.
    box("room-shell", wall, background, -11.15, .225, 0, .30, 12.75, 22.6, 0);
    box("room-shell", wall, background, 11.15, .225, 0, .30, 12.75, 22.6, 0);
    box("room-shell", wall, background, 0, .225, 11.15, 22.6, 12.75, .30, 0);
    box("room-shell", wall, background, 0, 4.775, -11.15, 22.0, 3.65, .30, 0);
    box("room-shell", wall, background, 0, -4.25, -11.15, 22.0, 3.90, .30, 0);
    for (const [x, width] of [[-8.7, 4.6], [-1.15, 4.3], [7.7, 6.6]]) box("room-shell", wall, background, x, .325, -11.15, width, 5.25, .30, 0);
    // The substrate ends below the planks, including their bevelled underside.
    // Coincident top faces would shimmer across the entire room when orbiting.
    box("floor-substrate", recess, background, 0, FLOOR - .21, 0, 22.6, .30, 22.6, 0);
    box("ceiling-coffers", plaster, background, 0, 6.75, 0, 22.6, .30, 22.6, 0);
    for (const x of [-7.3, 0, 7.3]) box("ceiling-coffers", plaster, background, x, 6.36, 0, .30, .48, 22.0, .05);
    for (const z of [-7.3, 0, 7.3]) box("ceiling-coffers", plaster, background, 0, 6.36, z, 22.0, .48, .30, .05);
    for (let strip = 0; strip < 22; strip++) for (let plank = 0; plank < 11; plank++) {
      const tint = new THREE.Color().setScalar(.91 + variation(strip, plank) * .15);
      box("parquet-floor", floorFinish, background, -10 + plank * 2, FLOOR - .022, -10.5 + strip,
        1.985, .044, .984, .004, 0, tint);
    }
    // Joined wall panels, skirtings, dado rails and a restrained cornice.
    for (let side = 0; side < 4; side++) {
      const angle = side * Math.PI / 2, cs = Math.cos(angle), sn = Math.sin(angle);
      const wallBox = (name: string, material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, r = .02) =>
        box(name, material, background, x * cs + z * sn, y, z * cs - x * sn, w, h, d, r, angle);
      wallBox("wall-paneling", walnut, 0, -4.88, -10.88, 21.9, 2.42, .15);
      for (let panel = 0; panel < 11; panel++) {
        const x = -10 + panel * 2;
        wallBox("panel-insets", recess, x, -4.82, -10.785, 1.69, 1.98, .025, .015);
        for (const dx of [-.87, .87]) wallBox("wall-panel-beading", lightWood, x + dx, -4.82, -10.69, .075, 2.15, .095, .012);
        for (const y of [-5.89, -3.75]) wallBox("wall-panel-beading", lightWood, x, y, -10.69, 1.81, .08, .095, .012);
      }
      for (const [y, h, d] of [[-6.01, .22, .29], [-3.55, .15, .26], [-3.40, .08, .20]]) wallBox("wall-paneling", walnut, 0, y, -10.72, 22, h, d);
      for (const [y, h, d] of [[5.88, .13, .28], [6.07, .24, .42], [6.30, .20, .60]]) wallBox("cornice", plaster, 0, y, -10.75, 22, h, d, .035);
    }
    // A closed paneled door completes the rear view rather than ending the room.
    box("door", walnut, background, -3.1, -3.07, 10.72, 2.40, 6.00, .18, .025);
    for (const x of [-4.40, -1.80]) box("door-casing", lightWood, background, x, -3.06, 10.59, .17, 6.17, .18, .02);
    box("door-casing", lightWood, background, -3.1, .09, 10.59, 2.77, .18, .18, .02);
    for (const y of [-4.83, -1.63]) {
      box("door-panels", recess, background, -3.1, y, 10.605, 1.85, 2.31, .04, .03);
      for (const x of [-4.08, -2.12]) box("door", walnut, background, x, y, 10.55, .12, 2.45, .10, .02);
      for (const dy of [-1.22, 1.22]) box("door", walnut, background, -3.1, y + dy, 10.55, 2.04, .10, .10, .02);
    }
    tube("door-hardware", [new THREE.Vector3(-2.18, -3.20, 10.46), new THREE.Vector3(-2.18, -3.20, 10.32),
      new THREE.Vector3(-2.45, -3.20, 10.32)], .035, brass, background);

    const windowMap = tile("window-daylight", (u, v) => {
      const soft = .76 + .12 * smooth(v) + .025 * Math.sin(u * 7 + Math.sin(v * 5));
      const edge = .87 + .13 * smooth(Math.min(u, 1 - u) * 8);
      return [Math.round(soft * edge * 218), Math.round(soft * edge * 234), Math.round(soft * edge * 248), 255];
    }, true);
    const glazing = new THREE.MeshStandardMaterial({ color: "#ccdadd", map: windowMap, emissiveMap: windowMap,
      emissive: "#a9c4d5", emissiveIntensity: .40, roughness: .26, metalness: .04, envMap: craft.stone.envMap, envMapIntensity: .26 });
    materials.add(glazing);
    const windows: Placement[] = [];
    for (const x of [-4.9, 2.6]) {
      windows.push({ x, y: .325, z: -11.24, width: 3.02, height: 5.10, depth: .045 });
      for (const dx of [-1.61, 1.61]) box("window-reveals", plaster, midground, x + dx, .325, -10.90, .19, 5.35, .81, .025);
      for (const y of [-2.34, 2.99]) box("window-reveals", plaster, midground, x, y, -10.83, 3.48, .19, .94, .025);
      for (const dx of [-1.48, 0, 1.48]) box("window-frames", lightWood, midground, x + dx, .325, -10.62, dx === 0 ? .075 : .11, 5.1, .13, .018);
      for (let row = 0; row < 4; row++) box("window-frames", lightWood, midground, x, -2.19 + row * 1.67, -10.62, 3.06, .075, .13, .014);
      box("window-reveals", plaster, midground, x, -2.45, -10.39, 3.65, .16, 1.18, .035);
      // The recessed dark seam under the sill makes the reveal legible in flat light.
      box("window-joints", recess, midground, x, -2.55, -10.72, 3.35, .045, .46, .005);
    }
    instanced("window-glazing", own(new THREE.BoxGeometry(1, 1, 1)), glazing, windows, midground, true);
    const windowLight = new THREE.PointLight("#d9e6ef", 12, 3.5, 2); lights.add(windowLight);
    windowLight.name = "writer-study-window-daylight"; windowLight.position.copy(daylight);
    windowLight.userData = { emitterMesh: "writer-study-window-glazing", emitterInstance: 0 };
    background.add(windowLight);

    // Two low, deep bookcases. Books have the same real page volumes, colour
    // groups, small gaps and occasional lean at every tier.
    const pages: Placement[] = [], covers: Placement[] = [], spines: Placement[] = [], bands: Placement[] = [];
    const palette = ["#714d41", "#52614f", "#465665", "#876c47", "#493c43", "#857966"].map(value => new THREE.Color(value));
    for (let cabinet = 0; cabinet < 2; cabinet++) {
      const cx = cabinet === 0 ? -9.82 : 9.82, cz = cabinet === 0 ? -1.45 : -2.3;
      const angle = cabinet === 0 ? Math.PI / 2 : -Math.PI / 2, cs = Math.cos(angle), sn = Math.sin(angle);
      const point = (x: number, y: number, z: number) => new THREE.Vector3(cx + x * cs + z * sn, y, cz + z * cs - x * sn);
      const localBox = (name: string, material: THREE.Material, x: number, y: number, z: number, w: number, h: number, d: number, r = .025) => {
        const p = point(x, y, z); box(name, material, midground, p.x, p.y, p.z, w, h, d, r, angle);
      };
      localBox("cabinet-cases", walnut, 0, -4.44, -.43, 5.50, 3.44, .12);
      for (const x of [-2.74, 2.74]) localBox("cabinet-cases", walnut, x, -4.44, 0, .14, 3.44, 1.00);
      for (const y of [-6.01, -2.68]) localBox("cabinet-cases", walnut, 0, y, 0, 5.70, .20, 1.14);
      for (const x of [-2.63, 2.63]) localBox("cabinet-stiles", lightWood, x, -4.38, .50, .11, 3.25, .15, .018);
      for (let row = 0; row < 4; row++) {
        const shelfY = -5.88 + row * .76;
        localBox("cabinet-shelves", lightWood, 0, shelfY, .035, 5.34, .11, .94, .018);
        localBox("cabinet-recesses", recess, 0, shelfY + .36, -.349, 5.23, .63, .022, .005);
        for (let volume = 0; volume < 24; volume++) {
          const n = variation(cabinet, row, volume), width = .164 + n * .031, height = .51 + variation(row, volume, cabinet + 8) * .13, depth = .48 + n * .047;
          const x = -2.48 + volume * .215 + .006 * Math.sin(volume * 1.9 + row), y = shelfY + .057 + height / 2;
          const lean = volume % 8 === 6 ? .05 : volume % 8 === 7 ? -.035 : 0;
          const z = .095 + (volume % 8 === 0 ? .028 : 0), p = point(x, y, z);
          const tint = palette[(Math.floor(volume / 4) + row * 2 + cabinet) % palette.length];
          const item = { x: p.x, y: p.y, z: p.z, width, height, depth, angle, roll: lean };
          pages.push({ ...item, width: width * .86, height: height * .947, depth: depth * .85, color: new THREE.Color().setScalar(.94 + n * .055) });
          const bookRotation = new THREE.Quaternion().setFromAxisAngle(up, angle).multiply(new THREE.Quaternion().setFromAxisAngle(forward, lean));
          const member = (dx: number, dy: number, dz: number, w: number, h: number, d: number, color?: THREE.Color): Placement => {
            const offset = new THREE.Vector3(dx, dy, dz).applyQuaternion(bookRotation).add(p);
            return { x: offset.x, y: offset.y, z: offset.z, width: w, height: h, depth: d, angle, roll: lean, color };
          };
          for (const side of [-1, 1]) covers.push(member(side * width * .477, 0, 0, width * .07, height, depth * 1.05, tint));
          spines.push(member(0, 0, depth * .444, width * .98, height * .985, depth * .215, tint));
          for (const fraction of [-.31, .31]) bands.push(member(0, height * fraction, depth * .445, width * 1.025, .012, depth * .235));
          const shadow = point(x, shelfY + .058, z);
          shadows.push({ x: shadow.x, y: shadow.y, z: shadow.z, width: width * 1.26, height: 1, depth: depth * 1.08, angle });
        }
      }
      const s = point(0, FLOOR + .003, .14); shadows.push({ x: s.x, y: s.y, z: s.z, width: 5.95, height: 1, depth: 1.45, angle });
    }
    const pageGeometry = own(shade(new THREE.BoxGeometry(1, 1, 1)));
    instanced("book-page-blocks", pageGeometry, paperEdges, pages, midground);
    const coverGeometry = board(.014, .65, .54, .005, false); coverGeometry.scale(1 / .014, 1 / .65, 1 / .54);
    instanced("book-covers", own(shade(coverGeometry)), leather, covers, midground);
    const spineGeometry = new THREE.CylinderGeometry(.5, .5, 1, detail.radial, 1, false);
    spineGeometry.scale(1, 1, 1); instanced("book-spines", own(shade(spineGeometry)), leather, spines, midground);
    const bindingGeometry = own(shade(new THREE.CylinderGeometry(.5, .5, 1, detail.radial, 1, false)));
    instanced("book-raised-bands", bindingGeometry, brass, bands, midground);

    // Joinery of the writing desk: rounded moulded top, deep apron, real drawers
    // with reveals and pulls, four turned legs and brass feet.
    const deskX = 3.1, deskZ = -8.0, deskY = -3.65;
    box("desk-top", walnut, foreground, deskX, deskY, deskZ, 4.60, .20, 2.10, .055);
    box("desk-top-moulding", lightWood, foreground, deskX, deskY - .12, deskZ, 4.48, .08, 1.99, .022);
    box("desk-joinery", walnut, foreground, deskX, deskY - .40, deskZ - .81, 4.07, .54, .17, .025);
    for (const side of [-1, 1]) box("desk-joinery", walnut, foreground, deskX + side * 1.98, deskY - .39, deskZ, .16, .52, 1.67, .02);
    box("desk-drawer-reveals", recess, foreground, deskX, deskY - .385, deskZ + .895, 4.02, .45, .12, .015);
    for (let drawer = -1; drawer <= 1; drawer++) {
      const x = deskX + drawer * 1.31;
      box("desk-drawers", walnut, foreground, x, deskY - .365, deskZ + .987, 1.235, .362, .115, .025);
      box("desk-drawer-insets", lightWood, foreground, x, deskY - .365, deskZ + 1.051, 1.072, .225, .028, .017);
      for (const dx of [-.20, .20]) {
        const mount = new THREE.CylinderGeometry(.047, .047, .020, detail.radial, 1); mount.rotateX(Math.PI / 2);
        append("desk-hardware", mount, brass, foreground, new THREE.Matrix4().makeTranslation(x + dx, deskY - .37, deskZ + 1.078));
      }
      tube("desk-hardware", [new THREE.Vector3(x - .20, deskY - .375, deskZ + 1.08), new THREE.Vector3(x - .15, deskY - .415, deskZ + 1.18),
        new THREE.Vector3(x + .15, deskY - .415, deskZ + 1.18), new THREE.Vector3(x + .20, deskY - .375, deskZ + 1.08)], .025, brass, foreground);
    }
    for (const x of [-1.93, 1.93]) for (const z of [-.76, .76]) {
      lathe([[0,0],[.11,0],[.12,.10],[.086,.17],[.079,.30],[.096,.46],[.077,.61],[.067,1.65],[.10,1.82],[.13,1.91],[.14,2.15],[0,2.15]],
        walnut, "desk-legs", foreground, deskX + x, FLOOR + .04, deskZ + z);
      lathe([[0,0],[.126,0],[.129,.035],[.118,.13],[0,.13]], brass, "desk-hardware", foreground, deskX + x, FLOOR, deskZ + z);
      shadows.push({ x: deskX + x, y: FLOOR + .003, z: deskZ + z, width: .50, height: 1, depth: .50 });
    }
    shadows.push({ x: deskX, y: FLOOR + .004, z: deskZ, width: 5.35, height: 1, depth: 2.85 });
    box("desk-blotter", chairLeather, foreground, 3.65, deskY + .114, deskZ + .04, 2.28, .027, 1.30, .025);
    // The chair sits behind the writing desk, rather than in the camera's path.
    box("chair-frame", walnut, foreground, 3.55, -4.44, -9.85, 1.53, .22, 1.32, .055);
    box("chair-upholstery", chairLeather, foreground, 3.55, -4.285, -9.84, 1.38, .15, 1.18, .055);
    box("chair-frame", walnut, foreground, 3.55, -3.58, -10.41, 1.58, 1.83, .18, .075);
    box("chair-upholstery", chairLeather, foreground, 3.55, -3.58, -10.293, 1.33, 1.51, .105, .055);
    for (const dx of [-.60, .60]) for (const dz of [-.47, .47]) {
      box("chair-frame", walnut, foreground, 3.55 + dx, -5.25, -9.85 + dz, .135, 1.80, .135, .022);
    }
    for (const dx of [-.73, .73]) {
      box("chair-frame", walnut, foreground, 3.55 + dx, -3.95, -9.83, .12, .12, 1.15, .035);
      box("chair-frame", walnut, foreground, 3.55 + dx, -4.16, -9.37, .09, .50, .09, .02);
    }
    shadows.push({ x: 3.55, y: FLOOR + .003, z: -9.85, width: 2.05, height: 1, depth: 1.92 });

    const bookTransform = new THREE.Matrix4().makeRotationY(-.14); bookTransform.setPosition(2.81, deskY + .148, -7.50);
    for (const side of [-1, 1]) {
      const cover = board(.78, .035, 1.105, .012, false); cover.translate(side * .405, 0, 0);
      append("open-book-covers", cover, chairLeather, foreground, bookTransform);
      const block = curvedPaper(.742, 1.052, .052, (u, v) => {
        const t = side > 0 ? u : 1 - u;
        return .064 + .077 * Math.sin(Math.PI * t) + .009 * t + .006 * Math.sin(v * Math.PI);
      });
      block.translate(side * .386, 0, 0); append("open-book-pages", block, paper, foreground, bookTransform);
      for (const layer of [.0, .003, .006]) {
        const sheet = curvedPaper(.748, 1.054, .0025, (u, v) => {
          const t = side > 0 ? u : 1 - u;
          return .066 + layer + .077 * Math.sin(Math.PI * t) + .009 * t + .006 * Math.sin(v * Math.PI)
            + .019 * Math.pow(t, 6) * Math.pow(v, 4);
        });
        sheet.translate(side * .386, 0, 0); append("open-book-leaves", sheet, paper, foreground, bookTransform);
      }
    }
    for (let sheet = 0; sheet < 3; sheet++) {
      const geometry = curvedPaper(.70, .94, .006, (u, v) => .009 * Math.pow(u, 6) * Math.pow(v, 4));
      const transform = new THREE.Matrix4().makeRotationY(.14 + sheet * .04); transform.setPosition(4.43 + sheet * .025, deskY + .12 + sheet * .008, -8.21);
      append("loose-paper", geometry, paper, foreground, transform);
    }
    // An original pen sketch on the top sheet. These invented little islands
    // are decorative manuscript marks, not geographic data or copied maps.
    // The marks follow the paper's actual slight curl and contain no text.
    const sketchInk = plainFinish("#546568", 1);
    const sketchTransform = new THREE.Matrix4().makeRotationY(.22);
    sketchTransform.setPosition(4.48, deskY + .136, -8.21);
    const sketchPoint = (x: number, z: number) => new THREE.Vector3(x,
      .009 * Math.pow(x / .70 + .5, 6) * Math.pow(z / .94 + .5, 4) + .0032, z);
    const sketchStroke = (points: readonly (readonly [number, number])[], closed = false, thickness = .0018) => {
      const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => sketchPoint(x, z)), closed, "catmullrom", .20);
      append("manuscript-sketch", new THREE.TubeGeometry(curve, detail.curve, thickness, 4, closed),
        sketchInk, foreground, sketchTransform);
    };
    sketchStroke([[-.24,-.28],[-.17,-.34],[-.10,-.29],[-.11,-.19],[-.04,-.10],[-.08,-.04],
      [-.02,.03],[-.09,.14],[-.17,.12],[-.22,.20],[-.25,.09],[-.20,.01],[-.25,-.11]], true);
    sketchStroke([[.02,-.24],[.09,-.29],[.20,-.23],[.19,-.14],[.25,-.08],[.20,.03],
      [.24,.10],[.16,.18],[.12,.31],[.04,.26],[.07,.17],[.03,.09],[.09,.01],[.04,-.11]], true);
    sketchStroke([[-.02,.25],[-.07,.30],[-.03,.35],[.025,.31]], true);
    sketchStroke([[.14,-.20],[.12,-.11],[.16,-.03],[.13,.06],[.15,.14]], false, .00125);
    sketchStroke([[-.21,-.24],[-.18,-.20],[-.16,-.23],[-.13,-.18]], false, .00125);
    sketchStroke([[-.225,.285],[-.225,.355]], false, .00125);
    sketchStroke([[-.260,.32],[-.190,.32]], false, .00125);
    // A turned wood pencil and a small blank ceramic pen cup are original props.
    const pencil = new THREE.CylinderGeometry(.016, .016, .78, 6, 1); pencil.rotateZ(Math.PI / 2); pencil.rotateY(-.3);
    append("writing-tools", pencil, lightWood, foreground, new THREE.Matrix4().makeTranslation(4.41, deskY + .168, -7.90));
    lathe([[0,0],[.14,0],[.155,.035],[.16,.32],[.146,.34],[.124,.34],[.12,.047],[0,.047]], plaster,
      "ceramic-pen-cup", foreground, 4.9, deskY + .11, -8.70);
    for (let pencilIndex = 0; pencilIndex < 3; pencilIndex++) {
      const geometry = new THREE.CylinderGeometry(.018, .018, .52, 6, 1); geometry.rotateZ((pencilIndex - 1) * .08);
      append("writing-tools", geometry, lightWood, foreground, new THREE.Matrix4().makeTranslation(4.84 + pencilIndex * .055, deskY + .48, -8.70));
    }
    const inkGlass = new THREE.MeshPhysicalMaterial({ color: "#253b42", roughness: .20, metalness: 0,
      clearcoat: .55, clearcoatRoughness: .19, envMap: craft.stone.envMap, envMapIntensity: .37, vertexColors: true });
    materials.add(inkGlass);
    lathe([[0,0],[.137,0],[.159,.035],[.160,.174],[.125,.216],[.075,.230],[.075,.290],[.056,.302],[.048,.281],[.048,.247],[.098,.192],[.101,.051],[0,.051]],
      inkGlass, "inkwell", foreground, 4.58, deskY + .115, -8.59);
    lathe([[0,0],[.045,0],[.046,.010],[0,.010]], darkMetal, "inkwell-ink", foreground, 4.58, deskY + .358, -8.59);
    const pen = new THREE.CylinderGeometry(.019, .023, .68, detail.radial, 1); pen.rotateZ(Math.PI / 2); pen.rotateY(.36);
    append("fountain-pen", pen, recess, foreground, new THREE.Matrix4().makeTranslation(3.99, deskY + .158, -7.26));
    const nib = new THREE.ConeGeometry(.026, .16, 6, 1); nib.scale(.45, 1, 1); nib.rotateZ(-Math.PI / 2); nib.rotateY(.36);
    append("pen-nib", nib, brass, foreground, new THREE.Matrix4().makeTranslation(4.383, deskY + .158, -7.404));

    // Banker's lamp: turned brass foot and stem, arched thick glass shade with
    // a warm inner face, and an actual small emitter under the shade.
    lathe([[0,0],[.32,0],[.36,.027],[.34,.070],[.27,.107],[.11,.124],[0,.124]], brass,
      "lamp-metalwork", foreground, 1.45, deskY + .11, -8.12, 1, .76);
    lathe([[0,0],[.065,0],[.065,.05],[.039,.10],[.030,.54],[.060,.58],[0,.58]], brass,
      "lamp-metalwork", foreground, 1.45, deskY + .21, -8.12);
    tube("lamp-metalwork", [new THREE.Vector3(1.45, -2.86, -8.12), new THREE.Vector3(1.45, -2.72, -8.26),
      new THREE.Vector3(1.45, -2.70, -8.30)], .029, brass, foreground);
    const greenGlass = new THREE.MeshPhysicalMaterial({ color: "#234b3d", metalness: 0, roughness: .20,
      clearcoat: .60, clearcoatRoughness: .16, envMap: craft.stone.envMap, envMapIntensity: .43 });
    const lampInner = new THREE.MeshStandardMaterial({ color: "#e4d5ab", roughness: .39, emissive: "#e8bd72", emissiveIntensity: .43 });
    lampInner.userData = { ambientChannel: "task-lamp" }; materials.add(greenGlass); materials.add(lampInner);
    const shadePositions: number[] = [], shadeUvs: number[] = [], shadeIndices: number[] = [];
    const shadeSegments = detail.curve, shadeRow = shadeSegments + 1;
    for (let layer = 0; layer < 2; layer++) for (const x of [-.46, .46]) for (let i = 0; i <= shadeSegments; i++) {
      const angle = i / shadeSegments * Math.PI;
      shadePositions.push(x + 1.45, -2.86 + Math.sin(angle) * (layer ? .201 : .226), -8.12 + Math.cos(angle) * (layer ? .237 : .262));
      shadeUvs.push(x < 0 ? 0 : 1, i / shadeSegments);
    }
    for (let i = 0; i < shadeSegments; i++) shadeIndices.push(i, i + shadeRow, i + 1, i + 1, i + shadeRow, i + shadeRow + 1);
    for (let i = 0; i < shadeSegments; i++) {
      const a = i, b = i + 1, ia = a + shadeRow * 2, ib = b + shadeRow * 2;
      shadeIndices.push(a, b, ia, b, ib, ia, a + shadeRow, ia + shadeRow, b + shadeRow, b + shadeRow, ia + shadeRow, ib + shadeRow);
    }
    for (const i of [0, shadeSegments]) {
      const a = i, b = i + shadeRow, c = i + shadeRow * 2, d = i + shadeRow * 3;
      if (i === 0) shadeIndices.push(a, c, b, b, c, d); else shadeIndices.push(a, b, c, b, d, c);
    }
    const outerCount = shadeIndices.length;
    for (let i = 0; i < shadeSegments; i++) {
      const a = i + shadeRow * 2, b = a + shadeRow;
      shadeIndices.push(a, a + 1, b, a + 1, b + 1, b);
    }
    const lampShade = own(new THREE.BufferGeometry()); lampShade.setAttribute("position", new THREE.Float32BufferAttribute(shadePositions, 3));
    lampShade.setAttribute("uv", new THREE.Float32BufferAttribute(shadeUvs, 2)); lampShade.setIndex(shadeIndices); lampShade.computeVertexNormals();
    lampShade.addGroup(0, outerCount, 0); lampShade.addGroup(outerCount, shadeIndices.length - outerCount, 1);
    mesh("lamp-shade", lampShade, [greenGlass, lampInner], foreground);
    const emitterGeometry = own(new THREE.SphereGeometry(.060, detail.radial, Math.max(6, Math.round(detail.radial / 2))));
    emitterGeometry.scale(2.8, 1, 1); emitterGeometry.translate(lampPosition.x, lampPosition.y, lampPosition.z);
    mesh("lamp-light-source", emitterGeometry, lampInner, foreground);
    const taskLight = new THREE.PointLight("#eed19d", 6, 3.1, 2); lights.add(taskLight);
    taskLight.name = "writer-study-task-light"; taskLight.position.copy(lampPosition);
    taskLight.userData = { emitterMesh: "writer-study-lamp-light-source" }; foreground.add(taskLight);
    shadows.push({ x: 1.45, y: deskY + .102, z: -8.12, width: .95, height: 1, depth: .76 });

    const contactGeometry = own(new THREE.PlaneGeometry(1, 1)); contactGeometry.rotateX(-Math.PI / 2);
    instanced("contact-shadows", contactGeometry, contact, shadows, foreground, true);
    // Each material batch becomes one real draw. Instanced book parts retain
    // independent physical transforms for tier-independent cabinet density.
    for (const [name, batch] of batches) {
      const geometry = mergeGeometries(batch.parts, false);
      if (!geometry) throw new Error(`Unable to assemble writer study ${name}`);
      geometry.clearGroups(); mesh(name, own(geometry), batch.material, batch.root);
      for (const part of batch.parts) part.dispose(); batch.parts.length = 0;
    }
    group.updateMatrixWorld(true);
    return Object.freeze({ group, setAmbientTime(seconds: number) {
      if (disposed || !Number.isFinite(seconds) || seconds < 0) return;
      lampInner.emissiveIntensity = .43 + .017 * Math.sin((seconds % 3600) * .37);
    }, dispose });
  } catch (error) {
    for (const batch of batches.values()) for (const part of batch.parts) part.dispose();
    dispose(); throw error;
  }
}
