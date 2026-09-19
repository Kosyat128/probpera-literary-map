import * as THREE from "three";
import type { GlobeQualityTier } from "./globeQuality";
import { createGlobeCraftMaterials } from "./globeCraftMaterials";

export interface OwnedGlobeLibrary {
  readonly group: THREE.Group;
  setAmbientTime(seconds: number): void;
  dispose(): void;
}

const detail = Object.freeze({
  high: Object.freeze({ bays: 16, rows: 8, books: 8, archSegments: 32, tubeSegments: 8, turnedSegments: 28, spineSegments: 8, parquetStrips: 4 }),
  balanced: Object.freeze({ bays: 12, rows: 6, books: 7, archSegments: 24, tubeSegments: 6, turnedSegments: 20, spineSegments: 6, parquetStrips: 3 }),
  economy: Object.freeze({ bays: 8, rows: 4, books: 5, archSegments: 16, tubeSegments: 4, turnedSegments: 12, spineSegments: 4, parquetStrips: 2 }),
});
const FLOOR_Y = -6.15;

/**
 * Original reading hall, with joined cabinetry, turned/fluted columns, bound
 * volumes and recessed glazing. All faces stay outside the camera's r=5.6
 * sphere. Procedural craft maps are local; two short-range lights cannot reach
 * the globe. No camera, renderer or global scene/environment state is changed.
 */
export function createGlobeLibrary(quality: GlobeQualityTier): OwnedGlobeLibrary {
  if (!Object.prototype.hasOwnProperty.call(detail, quality)) throw new Error("Invalid globe library quality");
  const budget = detail[quality];
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
      const faceShade = normalY < -0.5 ? 0.58 : normalY > 0.5 ? 1 : 0.84;
      const shade = faceShade * (0.82 + 0.18 * vertical);
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
  // A single planar chamfer gives real edge highlights with 28 triangles,
  // avoiding a highly subdivided rounded cube for each of thousands of parts.
  const chamferedBox = (width: number, height: number, depth: number, radius: number) => {
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
  const instanced = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material,
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
      if (placement.color) result.setColorAt(index, placement.color);
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

  try {
    craft = createGlobeCraftMaterials(quality);
    const wood = finish(craft.darkWood, "#866044");
    const trim = finish(craft.brass);
    const shelves = finish(craft.wood, "#b58a59");
    const recess = finish(craft.darkWood, "#473126");
    const books = finish(craft.leather);
    const paper = finish(craft.paper);
    const wall = finish(craft.stone, "#555664");
    wall.emissive.set("#090d15");
    wall.side = THREE.BackSide;
    const stone = finish(craft.stone, "#777065");
    const galleryFinish = finish(craft.wood, "#936744");
    galleryFinish.side = THREE.DoubleSide;
    const windowFinish = finish(craft.stone, "#657f99");
    // Frosted daylight behind the glazing has no stone veins or surface relief.
    windowFinish.map = null; windowFinish.normalMap = null; windowFinish.roughnessMap = null;
    windowFinish.roughness = 0.7;
    windowFinish.emissive.set("#233b57");
    windowFinish.emissiveIntensity = 0.7;
    const glass = new THREE.MeshPhysicalMaterial({ color: "#9db6bc", roughness: 0.2,
      metalness: 0.06, transparent: true, opacity: 0.25, depthWrite: false,
      envMap: craft.brass.envMap, envMapIntensity: 0.7, clearcoat: 0.7, side: THREE.DoubleSide });
    glass.forceSinglePass = true;
    materials.add(glass);
    const lamp = finish(craft.paper, "#ecd8b0");
    lamp.emissive.set("#ffd299");
    lamp.emissiveIntensity = 0.3;
    lamp.userData.ambientChannel = "reading-lamps";
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
    const boardGeometry = chamferedBox(2.32, 0.14, 0.72, 0.02);
    const stileGeometry = chamferedBox(0.18, 2.9, 0.72, 0.025);
    const coverGeometry = chamferedBox(0.018, 1, 0.46, 0.004);
    const moldingGeometry = chamferedBox(2.4, 0.09, 0.08, 0.017);
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
    const spineGeometry = ownGeometry(new THREE.CylinderGeometry(0.5, 0.5, 1,
      budget.spineSegments, 1, false, Math.PI / 2, Math.PI));
    const bindingGeometry = ownGeometry(new THREE.CylinderGeometry(0.5, 0.5, 1,
      budget.spineSegments, 1, true, Math.PI / 2, Math.PI));

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
    const casePanels: Placement[] = [], caseMoldings: Placement[] = [], joinery: Placement[] = [];
    const parquet: Placement[] = [], cofferBeams: Placement[] = [], coffers: Placement[] = [];
    const arches: Placement[] = [], archInlays: Placement[] = [];
    const floorContacts: Placement[] = [];
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
    const spineColors = ["#865847", "#46605f", "#625772", "#9a8058", "#3c5268", "#756e51"];
    const palette = spineColors.map(color => new THREE.Color(color));
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
        for (const yOffset of [-1.95, 0, 1.95]) {
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
        shelfBoards.push(radial(angle, 9.35, 0, shelfY + 0.055, 2.32, 0.11, 0.7));
        caseMoldings.push(radial(angle, 8.995, 0, shelfY + 0.055, 2.35, 0.045, 0.06));
        for (const tangent of [-1.1, 1.1]) {
          joinery.push(radial(angle, 8.985, tangent, shelfY + 0.055, 0.027, 0.027, 0.025));
        }
        // Volumes have separate page blocks, beveled covers, convex leather
        // spines and two raised binding bands. Nothing depicts a real title.
        const horizontalStack = (bay * 3 + row) % 7 === 0;
        const standingCount = budget.books - (horizontalStack ? 3 : 0);
        const standingStart = horizontalStack ? -0.12 : -1.04;
        const gap = 0.008;
        const weights = Array.from({ length: standingCount }, (_, book) =>
          0.65 + ((bay * 13 + row * 7 + book * 5) % 9) * 0.09);
        const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
        const availableWidth = 1.04 - standingStart - gap * (standingCount - 1);
        const volumes: { width: number; height: number; tangent: number; centerY: number; roll: number }[] = [];
        let edge = standingStart;
        for (let book = 0; book < standingCount; book += 1) {
          const width = weights[book] / weightSum * availableWidth;
          const height = 0.67 + ((bay * 7 + row * 3 + book) % 6) * 0.071;
          volumes.push({ width, height, tangent: edge + width / 2,
            centerY: shelfY + 0.11 + height / 2, roll: 0 });
          edge += width + gap;
        }
        if (horizontalStack) for (let stack = 0; stack < 2; stack += 1) {
          volumes.push({ width: 0.13, height: 0.82 - stack * 0.055,
            tangent: -0.60 + stack * 0.025, centerY: shelfY + 0.11 + 0.065 + stack * 0.13,
            roll: Math.PI / 2 });
        }
        volumes.forEach(({ width, height, tangent, centerY, roll }, book) => {
          const offset = (((bay * 11 + row * 3 + book) % 5) - 2) * 0.012;
          const coverDepth = 0.43 + ((bay + row * 2 + book) % 5) * 0.018;
          const part = (radius: number, x: number, y: number, w: number, h: number, d: number) => {
            const placement = radial(angle, radius + offset,
              tangent + x * Math.cos(roll) - y * Math.sin(roll),
              centerY + x * Math.sin(roll) + y * Math.cos(roll), w, h, d);
            placement.roll = roll;
            return placement;
          };
          const color = palette[(bay + row * 2 + book) % palette.length];
          const spine = part(9.055, 0, 0, width - 0.008, height - 0.012, 0.13);
          spine.color = color; bookPlacements.push(spine);
          pageBlocks.push(part(9.05 + (coverDepth - 0.055) / 2, 0, 0, width - 0.028, height - 0.035, coverDepth - 0.055));
          for (const side of [-1, 1]) {
            const cover = part(9.015 + coverDepth / 2, side * (width / 2 - 0.008), 0, 0.016, height, coverDepth);
            cover.color = color; bookCovers.push(cover);
          }
          for (const bandHeight of [0.18, 0.82]) {
            bindingBands.push(part(9.055, 0, height * (bandHeight - 0.5), width - 0.002, 0.014, 0.14));
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
    instanced("library-columns", shaftGeometry, wood, posts, foreground);
    instanced("library-column-feet", turnedGeometry, shelves, feet, foreground);
    instanced("library-column-capitals", capitalGeometry, shelves, cornices, foreground);
    instanced("library-gallery-balusters", balusterGeometry, wood, balusters, foreground);
    instanced("library-arches", ownGeometry(new THREE.TorusGeometry(1.02, 0.13,
      budget.tubeSegments, budget.archSegments, Math.PI)), wood, arches, foreground);
    instanced("library-arch-inlay", ownGeometry(new THREE.TorusGeometry(0.88, 0.024,
      budget.tubeSegments, budget.archSegments, Math.PI)), trim, archInlays, foreground);
    instanced("library-bookcase-backs", unitBox, recess, backs, midground);
    instanced("library-bookcase-raised-panels", chamferedBox(2.1, 2.5, 0.06, 0.015), wood, casePanels, midground);
    instanced("library-case-moldings", moldingGeometry, shelves, caseMoldings, midground);
    instanced("library-joinery-pins", unitBox, trim, joinery, midground);
    instanced("library-gallery-supports", boardGeometry, wood, gallerySupports, midground);
    instanced("library-bookcase-uprights", stileGeometry, wood, bookcaseSides, midground);
    instanced("library-shelves", boardGeometry, shelves, shelfBoards, midground);
    instanced("library-unlettered-books", spineGeometry, books, bookPlacements, midground);
    instanced("library-book-page-blocks", unitBox, paper, pageBlocks, midground);
    instanced("library-book-covers", coverGeometry, books, bookCovers, midground);
    instanced("library-book-binding-bands", bindingGeometry, trim, bindingBands, midground);
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
    instanced("library-window-reveals", boardGeometry, stone, windowReveals, background);
    instanced("library-window-frames", moldingGeometry, trim, windowFrames, background);
    instanced("library-parquet", boardGeometry, galleryFinish, parquet, background);
    instanced("library-ceiling-coffer-beams", boardGeometry, wood, cofferBeams, background);
    instanced("library-ceiling-coffer-panels", boardGeometry, shelves, coffers, background);
    instanced("library-floor-contact-occlusion", ownGeometry(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)),
      contactFinish, floorContacts, background);
    for (const z of [-8.6, 8.6]) {
      const light = new THREE.PointLight("#ffd3a0", 5, 3.8, 2);
      lights.add(light);
      light.name = "library-local-reading-light";
      light.position.set(0, 1.9, z);
      light.userData = { source: "authored-in-project", restrictedDistance: 3.8 };
      midground.add(light);
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
