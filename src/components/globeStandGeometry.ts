import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { THREE_WHALES_GLOBE_STAND_ID, isIncludedGlobeStandId, type IncludedGlobeStandId } from "../planet/globeStands";
import { createGlobeCraftMaterials } from "./globeCraftMaterials";
import { createTurnedWoodAtlas } from "./globeTurnedWoodAtlas";
import { createWhaleStandGeometry } from "./globeWhaleStandGeometry";
import type { GlobeQualityTier } from "./globeQuality";

export interface OwnedGlobeStand {
  readonly group: THREE.Group;
  dispose(): void;
}

const detail = Object.freeze({
  high: Object.freeze({ radial: 96, bevel: 3, tube: 8, engravings: 48, pageEdges: 12, spineBands: 5 }),
  balanced: Object.freeze({ radial: 64, bevel: 2, tube: 6, engravings: 32, pageEdges: 8, spineBands: 4 }),
  economy: Object.freeze({ radial: 40, bevel: 1, tube: 4, engravings: 20, pageEdges: 4, spineBands: 3 }),
});

/** Original crafted supports. Museum/wood/books fit r<=.55, y[-1.44,-1.03].
 * The three-whale derivative retains its separate, larger canonical envelope. */
export function createIncludedGlobeStand(id: IncludedGlobeStandId, quality: GlobeQualityTier): OwnedGlobeStand {
  if (!isIncludedGlobeStandId(id) || !Object.prototype.hasOwnProperty.call(detail, quality)) {
    throw new Error("Invalid included globe stand");
  }
  if (id === THREE_WHALES_GLOBE_STAND_ID) {
    const resource = createWhaleStandGeometry(quality);
    resource.group.name = `included-globe-stand:${id}`;
    resource.group.userData = { ...resource.group.userData, standId: id,
      provenance: "canonical-site-derived", qualityTier: quality };
    return resource;
  }
  const budget = detail[quality];
  const group = new THREE.Group();
  group.name = `included-globe-stand:${id}`;
  group.userData = { standId: id, provenance: "authored-in-project", qualityTier: quality };
  const geometries = new Set<THREE.BufferGeometry>();
  // Original finishes and maps belong to craft; only material clones go here.
  const materials = new Set<THREE.Material>();
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  let craft: ReturnType<typeof createGlobeCraftMaterials> | null = null;
  let woodAtlas: ReturnType<typeof createTurnedWoodAtlas> | null = null;
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const geometry of geometries) geometry.dispose();
    for (const pending of batches.values()) for (const geometry of pending) geometry.dispose();
    batches.clear();
    for (const material of materials) material.dispose();
    woodAtlas?.dispose();
    craft?.dispose();
    group.clear();
  };
  const finish = (base: THREE.MeshStandardMaterial, name: string, color: string, metalness = base.metalness) => {
    const material = base.clone();
    material.name = name; material.color.set(color); material.metalness = metalness;
    materials.add(material);
    return material;
  };
  const mesh = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Group = group) => {
    geometries.add(geometry);
    const result = new THREE.Mesh(geometry, material);
    result.name = name; result.raycast = () => undefined; parent.add(result);
    return result;
  };
  const transform = (x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) =>
    new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)).setPosition(x, y, z);
  const batch = (geometry: THREE.BufferGeometry, material: THREE.Material, matrix?: THREE.Matrix4) => {
    const expanded = geometry.index ? geometry.toNonIndexed() : geometry;
    if (expanded !== geometry) geometry.dispose();
    if (matrix) expanded.applyMatrix4(matrix);
    const pending = batches.get(material) ?? [];
    pending.push(expanded); batches.set(material, pending);
  };
  const lathe = (name: string, profile: readonly (readonly [number, number])[], material: THREE.Material, flutes = 0, woodGrain?: "body" | "underfoot") => {
    const points = profile.map(([radius, y]) => new THREE.Vector2(radius, y));
    if (flutes) {
      // Recomputed fluted normals must not average a broad flat cap into its
      // narrow side wall. Coincident rings give each surface its own normals.
      if (points[0].x === 0 && points[0].y === points[1].y) {
        points.splice(2, 0, points[1].clone());
      }
      const last = points.length - 1;
      if (points[last].x === 0 && points[last].y === points[last - 1].y) {
        points.splice(last, 0, points[last - 1].clone());
      }
    }
    const geometry = new THREE.LatheGeometry(points, budget.radial);
    if (flutes) {
      const positions = geometry.getAttribute("position");
      for (let vertex = 0; vertex < positions.count; vertex++) {
        const x = positions.getX(vertex), z = positions.getZ(vertex);
        const scale = 1 - 0.065 * (0.5 + 0.5 * Math.cos(Math.atan2(x, z) * flutes));
        positions.setXYZ(vertex, x * scale, positions.getY(vertex), z * scale);
      }
      positions.needsUpdate = true;
      geometry.computeVertexNormals();
    }
    if (woodGrain && woodAtlas) {
      const positions = geometry.getAttribute("position");
      const normals = geometry.getAttribute("normal");
      const uvs = geometry.getAttribute("uv");
      // The atlas bakes one continuous solid-wood field over this exact shape.
      // Meridian distance provides resolution where the turned surface needs
      // it; shrinking radius no longer compresses a fixed number of stripes.
      for (let vertex = 0; vertex < positions.count; vertex++) {
        const profileIndex = Math.round(uvs.getY(vertex) * (profile.length - 1));
        const [u, v] = woodAtlas.sideUv(woodGrain, uvs.getX(vertex), profileIndex);
        uvs.setXY(vertex, u, v);
      }
      // A rim vertex belongs to both cap and side. Split only that UV seam:
      // otherwise interpolating planar centre UVs with angular rim UVs creates
      // a swirl on the cap. Face positions, normals and triangle count stay put.
      const indices = Array.from(geometry.getIndex()!.array);
      const mappedPositions = Array.from(positions.array), mappedNormals = Array.from(normals.array);
      const mappedUvs = Array.from(uvs.array), capVertices = new Map<number, number>();
      for (let offset = 0; offset < indices.length; offset += 3) {
        const a = indices[offset], b = indices[offset + 1], c = indices[offset + 2];
        if (Math.abs(positions.getY(a) - positions.getY(b)) > 1e-7
          || Math.abs(positions.getY(a) - positions.getY(c)) > 1e-7) continue;
        for (let corner = 0; corner < 3; corner++) {
          const source = indices[offset + corner];
          let target = capVertices.get(source);
          if (target === undefined) {
            target = mappedPositions.length / 3;
            mappedPositions.push(positions.getX(source), positions.getY(source), positions.getZ(source));
            mappedNormals.push(normals.getX(source), normals.getY(source), normals.getZ(source));
            mappedUvs.push(...woodAtlas.endUv(positions.getX(source), positions.getY(source), positions.getZ(source)));
            capVertices.set(source, target);
          }
          indices[offset + corner] = target;
        }
      }
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(mappedPositions, 3));
      geometry.setAttribute("normal", new THREE.Float32BufferAttribute(mappedNormals, 3));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(mappedUvs, 2));
      geometry.setIndex(indices);
      geometry.userData.grainMapping = "solid-wood-profile-atlas";
    }
    return mesh(name, geometry, material);
  };
  const ring = (radius: number, tube: number, y: number, material: THREE.Material) =>
    batch(new THREE.TorusGeometry(radius, tube, budget.tube, budget.radial), material, transform(0, y, 0, Math.PI / 2));
  const rounded = (width: number, height: number, depth: number, radius: number) => {
    // The installed addon derives corner normals from unit-cube coordinates.
    // Build those normals first, then place the rounded surface in real units;
    // scaling a cube or passing a thin board directly distorts its bevels.
    const geometry = new RoundedBoxGeometry(1, 1, 1, budget.bevel, 0.1);
    const positions = geometry.getAttribute("position");
    const normals = geometry.getAttribute("normal");
    const uvs = geometry.getAttribute("uv");
    const bevelRadius = Math.min(radius, width / 2, height / 2, depth / 2);
    const verticesPerFace = positions.count / 6;
    for (let vertex = 0; vertex < positions.count; vertex++) {
      const x = Math.sign(positions.getX(vertex)) * (width / 2 - bevelRadius) + normals.getX(vertex) * bevelRadius;
      const y = Math.sign(positions.getY(vertex)) * (height / 2 - bevelRadius) + normals.getY(vertex) * bevelRadius;
      const z = Math.sign(positions.getZ(vertex)) * (depth / 2 - bevelRadius) + normals.getZ(vertex) * bevelRadius;
      positions.setXYZ(vertex, x, y, z);
      // Box projection follows the physical face, including the narrow bevel.
      // Paper grain therefore remains horizontal on every exposed cut edge.
      switch (Math.floor(vertex / verticesPerFace)) {
        case 0: uvs.setXY(vertex, 0.5 - z / depth, 0.5 + y / height); break;
        case 1: uvs.setXY(vertex, 0.5 + z / depth, 0.5 + y / height); break;
        case 2: uvs.setXY(vertex, 0.5 + x / width, 0.5 - z / depth); break;
        case 3: uvs.setXY(vertex, 0.5 + x / width, 0.5 + z / depth); break;
        case 4: uvs.setXY(vertex, 0.5 + x / width, 0.5 + y / height); break;
        case 5: uvs.setXY(vertex, 0.5 - x / width, 0.5 + y / height); break;
      }
    }
    geometry.userData.authoredDimensions = { width, height, depth, radius: bevelRadius };
    positions.needsUpdate = true;
    uvs.needsUpdate = true;
    return geometry;
  };

  try {
    craft = createGlobeCraftMaterials(quality);
    const bronze = finish(craft.brass, "aged-bronze", "#8c8069", 0.78);
    bronze.roughness = 1; bronze.envMapIntensity = 0.52;
    const bright = finish(craft.brass, "polished-brass-inlay", "#c1ad86", 0.91);
    bright.roughness = 0.86; bright.envMapIntensity = 0.76;
    const patina = finish(craft.brass, "recessed-bronze", "#4c514a", 0.35);
    patina.roughness = 1; patina.envMapIntensity = 0.27;
    if (id === "stand.base.museum") {
      const stone = finish(craft.stone, "museum-dark-stone", "#49413c", 0.05);
      lathe("museum-bevelled-foot", [
        [0, -1.438], [0.424, -1.438], [0.449, -1.434], [0.466, -1.425],
        [0.480, -1.416], [0.482, -1.408], [0.478, -1.401], [0.463, -1.394],
        [0.442, -1.390], [0, -1.390],
      ], patina);
      lathe("museum-stone-plinth", [
        [0, -1.400], [0.441, -1.400], [0.447, -1.393], [0.439, -1.385],
        [0.423, -1.381], [0.423, -1.373], [0.407, -1.367], [0, -1.367],
      ], stone);
      lathe("museum-turned-shoulder", [
        [0, -1.375], [0.400, -1.375], [0.410, -1.369], [0.407, -1.363],
        [0.390, -1.358], [0.364, -1.354], [0.329, -1.344], [0.291, -1.332],
        [0.255, -1.322], [0.208, -1.315], [0.143, -1.310], [0.110, -1.306], [0, -1.306],
      ], bronze);
      // Twelve recessed flutes deform the stem itself, not detached ornaments.
      lathe("museum-fluted-column", [
        [0, -1.321], [0.110, -1.321], [0.112, -1.310], [0.104, -1.300],
        [0.086, -1.283], [0.073, -1.256], [0.064, -1.225], [0.062, -1.190],
        [0.066, -1.159], [0.076, -1.134], [0.090, -1.118], [0.104, -1.112], [0, -1.112],
      ], bronze, 12);
      lathe("museum-capital", [
        [0, -1.124], [0.087, -1.124], [0.106, -1.118], [0.112, -1.111],
        [0.101, -1.105], [0.108, -1.096], [0.124, -1.088], [0.144, -1.083],
        [0.151, -1.077], [0.149, -1.068], [0.145, -1.062], [0.155, -1.051],
        [0.155, -1.039], [0.145, -1.0308], [0, -1.0308],
      ], bronze);
      const collar = mesh("museum-engraved-collar", new THREE.CylinderGeometry(0.425, 0.425, 0.017, budget.radial), bronze);
      collar.position.y = -1.381;
      for (const [radius, y] of [[0.475, -1.409], [0.424, -1.389], [0.424, -1.373],
        [0.402, -1.364], [0.108, -1.308], [0.102, -1.114], [0.147, -1.077], [0.151, -1.046]]) {
        ring(radius, 0.0017, y, bright);
      }
      // A flush geometric cut band with no text or borrowed insignia.
      for (let mark = 0; mark < budget.engravings; mark++) {
        const angle = mark / budget.engravings * Math.PI * 2;
        for (const slope of [-1, 1]) {
          const local = transform(slope * 0.0033, 0, 0, 0, 0, slope * 0.66);
          const placement = transform(Math.sin(angle) * 0.4252, -1.381, Math.cos(angle) * 0.4252, 0, angle);
          batch(new THREE.BoxGeometry(0.010, 0.0012, 0.0008), patina, placement.multiply(local));
        }
      }
    } else if (id === "stand.base.wood") {
      const underfootProfile = [
        [0, -1.438], [0.405, -1.438], [0.429, -1.432], [0.447, -1.420],
        [0.450, -1.408], [0.441, -1.400], [0, -1.400],
      ] as const;
      const bodyProfile = [
        [0, -1.411], [0.438, -1.411], [0.444, -1.405], [0.442, -1.397],
        [0.431, -1.388], [0.405, -1.382], [0.397, -1.379], [0.351, -1.379],
        [0.342, -1.369], [0.337, -1.357], [0.293, -1.347], [0.246, -1.334],
        [0.199, -1.318], [0.163, -1.299], [0.131, -1.277], [0.109, -1.253],
        [0.094, -1.226], [0.086, -1.199], [0.087, -1.174], [0.093, -1.152],
        [0.107, -1.135], [0.126, -1.122], [0.137, -1.115], [0.139, -1.105],
        [0.129, -1.098], [0.136, -1.091], [0.156, -1.084], [0.166, -1.075],
        [0.164, -1.065], [0.160, -1.060], [0.164, -1.051], [0.164, -1.040],
        [0.154, -1.0308], [0, -1.0308],
      ] as const;
      woodAtlas = createTurnedWoodAtlas(quality, { body: bodyProfile, underfoot: underfootProfile });
      const withAtlas = (material: THREE.MeshStandardMaterial) => {
        material.map = woodAtlas!.map; material.normalMap = woodAtlas!.normalMap;
        material.roughnessMap = woodAtlas!.roughnessMap;
        material.normalScale.set(0.65, 0.65);
        return material;
      };
      const wood = withAtlas(finish(craft.wood, "turned-walnut", "#736858", 0));
      wood.roughness = 0.98; wood.envMapIntensity = 0.16;
      const darkWood = finish(craft.darkWood, "ebonised-wood-edges", "#423e36", 0);
      darkWood.roughness = 1; darkWood.envMapIntensity = 0.13;
      // Torus ornaments keep their ordinary grain UVs; only the turned foot
      // uses the profile atlas, on a separately owned material clone.
      const underfoot = withAtlas(finish(darkWood, "ebonised-wood-underfoot", "#423e36", 0));
      const endgrain = withAtlas(finish(craft.wood, "wooden-joinery", "#938675", 0));
      endgrain.roughness = 1; endgrain.envMapIntensity = 0.17;
      lathe("wood-underfoot", underfootProfile, underfoot, 0, "underfoot");
      lathe("wood-turned-body", bodyProfile, wood, 0, "body");
      for (const [radius, tube, y] of [[0.441, 0.0022, -1.401], [0.385, 0.0020, -1.377],
        [0.137, 0.0018, -1.109], [0.162, 0.0020, -1.072], [0.162, 0.0015, -1.046]]) {
        ring(radius, tube, y, darkWood);
      }
      ring(0.404, 0.0015, -1.381, bright);
      ring(0.138, 0.0012, -1.110, bright);
      // Dovetail keys sit in a flat annular shoulder with exposed endgrain.
      const keys = quality === "high" ? 12 : quality === "balanced" ? 8 : 6;
      for (let index = 0; index < keys; index++) {
        const angle = index / keys * Math.PI * 2;
        const wedge = new THREE.Shape();
        wedge.moveTo(-0.010, -0.022); wedge.lineTo(0.010, -0.022);
        wedge.lineTo(0.0065, 0.021); wedge.lineTo(-0.0065, 0.021); wedge.closePath();
        const geometry = new THREE.ExtrudeGeometry(wedge, { depth: 0.0015, bevelEnabled: false });
        geometry.rotateX(-Math.PI / 2);
        const placement = transform(Math.sin(angle) * 0.374, -1.380, Math.cos(angle) * 0.374, 0, angle);
        const positions = geometry.getAttribute("position"), uvs = geometry.getAttribute("uv");
        const worldPoint = new THREE.Vector3();
        for (let vertex = 0; vertex < positions.count; vertex++) {
          worldPoint.fromBufferAttribute(positions, vertex).applyMatrix4(placement);
          const [u, v] = woodAtlas.endUv(worldPoint.x, worldPoint.y, worldPoint.z);
          uvs.setXY(vertex, u, v);
        }
        batch(geometry, endgrain, placement);
      }
      const bearing = mesh("wood-inset-bronze-bearing", new THREE.CylinderGeometry(0.070, 0.065, 0.004, budget.radial), bronze);
      bearing.position.y = -1.033;
    } else {
      const pages = craft.paper;
      const pageShadow = finish(craft.paper, "fine-cut-page-edges", "#c8b891", 0);
      const endpaper = finish(craft.paper, "laid-endpapers", "#efe2bd", 0);
      const thread = finish(craft.paper, "binding-headband-thread", "#d1b783", 0);
      const covers = [
        finish(craft.leather, "oxblood-leather", "#653943", 0),
        finish(craft.leather, "forest-leather", "#34514b", 0),
        finish(craft.leather, "saddle-leather", "#8c5732", 0),
      ];
      const widths = [0.78, 0.70, 0.73], depths = [0.48, 0.46, 0.44];
      for (let index = 0; index < 3; index++) {
        const book = new THREE.Group();
        book.name = `handbound-book-${index + 1}`;
        book.position.y = -1.438 + index * 0.096;
        book.rotation.y = [-0.09, 0.12, -0.055][index];
        book.updateMatrix(); group.add(book);
        const width = widths[index], depth = depths[index], leather = covers[index];
        const bookDetail = (geometry: THREE.BufferGeometry, material: THREE.Material, matrix: THREE.Matrix4) =>
          batch(geometry, material, book.matrix.clone().multiply(matrix));
        for (const [name, y] of [["lower", 0.006], ["upper", 0.089]] as const) {
          const board = mesh(`${name}-rounded-leather-board`, rounded(width, 0.011, depth, 0.005), leather, book);
          board.position.y = y;
        }
        const leaves = mesh("rounded-page-block", rounded(width - 0.037, 0.066, depth - 0.025, 0.006), pages, book);
        leaves.position.set(0.006, 0.0475, 0);
        for (const y of [0.0135, 0.0815]) {
          bookDetail(rounded(width - 0.017, 0.002, depth - 0.012, 0.0008), endpaper, transform(0.002, y));
        }
        // A curved leather spine wraps the sewn signatures between the boards.
        const spine = new THREE.Shape();
        spine.moveTo(0.011, -0.037); spine.lineTo(0, -0.037);
        spine.bezierCurveTo(-0.022, -0.034, -0.022, 0.034, 0, 0.037);
        spine.lineTo(0.011, 0.037); spine.closePath();
        const back = new THREE.ExtrudeGeometry(spine, {
          depth: depth - 0.006, steps: 1, curveSegments: budget.radial / 4,
          bevelEnabled: true, bevelThickness: 0.001, bevelSize: 0.001, bevelSegments: budget.bevel,
        });
        const binding = mesh("rounded-leather-spine", back, leather, book);
        binding.position.set(-width / 2 + 0.010, 0.0475, -depth / 2 + 0.003);
        for (let band = 0; band < budget.spineBands; band++) {
          const z = ((band + 1) / (budget.spineBands + 1) - 0.5) * (depth - 0.036);
          bookDetail(rounded(0.026, 0.077, 0.013, 0.005), leather, transform(-width / 2 + 0.002, 0.0475, z));
          for (const offset of [-0.009, 0.009]) {
            bookDetail(rounded(0.023, 0.070, 0.0012, 0.0005), bright,
              transform(-width / 2 + 0.001, 0.0475, z + offset));
          }
        }
        for (const z of [-depth / 2 + 0.006, depth / 2 - 0.006]) {
          const headband = new THREE.TorusGeometry(0.034, 0.0016, budget.tube, budget.radial / 2, Math.PI);
          headband.rotateZ(Math.PI / 2); headband.scale(0.47, 1, 1);
          bookDetail(headband, thread, transform(-width / 2 + 0.010, 0.0475, z));
        }
        // Individual signature cuts on the three exposed paper faces.
        for (let line = 1; line <= budget.pageEdges; line++) {
          const y = 0.016 + line / (budget.pageEdges + 1) * 0.063;
          const inset = 0.00008 * Math.sin(line * 1.7 + index);
          for (const sign of [-1, 1]) {
            bookDetail(new THREE.BoxGeometry(width - 0.052, 0.00045, 0.00065), pageShadow,
              transform(0.006, y, sign * ((depth - 0.025) / 2 + 0.00015 + inset)));
          }
          bookDetail(new THREE.BoxGeometry(0.00065, 0.00045, depth - 0.044), pageShadow,
            transform((width - 0.037) / 2 + 0.00615, y));
        }
        // Ruled tooling with no lettering, logos or borrowed insignia.
        const rules = quality === "economy" ? 1 : 2;
        for (let rule = 0; rule < rules; rule++) {
          const inset = 0.022 + rule * 0.006, ruleWidth = width - 2 * inset, ruleDepth = depth - 2 * inset;
          const y = 0.09465, stroke = rule === 0 ? 0.0014 : 0.0008;
          for (const sign of [-1, 1]) {
            bookDetail(new THREE.BoxGeometry(ruleWidth, 0.00055, stroke), bright, transform(0, y, sign * ruleDepth / 2));
            bookDetail(new THREE.BoxGeometry(stroke, 0.00055, ruleDepth), bright, transform(sign * ruleWidth / 2, y));
          }
        }
        for (const xSign of [-1, 1]) for (const zSign of [-1, 1]) {
          bookDetail(new THREE.TorusGeometry(0.009, 0.0008, budget.tube, budget.radial / 4), bright,
            transform(xSign * (width / 2 - 0.044), 0.0947, zSign * (depth / 2 - 0.044), Math.PI / 2));
        }
      }
      lathe("book-stack-turned-bronze-bearing", [
        [0, -1.152], [0.115, -1.152], [0.127, -1.148], [0.127, -1.141],
        [0.116, -1.135], [0.099, -1.127], [0.085, -1.111], [0.079, -1.093],
        [0.086, -1.082], [0.113, -1.074], [0.143, -1.071], [0.153, -1.064],
        [0.154, -1.041], [0.145, -1.0308], [0, -1.0308],
      ], bronze);
      ring(0.125, 0.0015, -1.146, bright);
      ring(0.151, 0.0013, -1.055, bright);
    }
    // Fine details share one draw call per finish. Constituent buffers are
    // disposed now; the returned owner retains only the final merged meshes.
    for (const [material, pending] of batches) {
      const combined = mergeGeometries(pending, false);
      if (!combined) throw new Error("Unable to assemble crafted stand detail");
      const details = mesh(`${material.name || "craft"}-details`, combined, material);
      if (material.name === "fine-cut-page-edges") {
        // Actual sub-millimetre signature cuts are useful close up, but rasterise
        // into a woven moire when the whole stand is small. Keep those cuts only
        // in the near LOD; filtered paper maps supply distant surface detail.
        const cutDetail = new THREE.LOD();
        cutDetail.name = "book-page-cut-detail";
        cutDetail.position.y = -1.25;
        combined.translate(0, 1.25, 0);
        cutDetail.addLevel(details, 0);
        cutDetail.addLevel(new THREE.Group(), 2.2, 0.12);
        group.add(cutDetail);
      }
      for (const geometry of pending) geometry.dispose();
      pending.length = 0;
    }
    batches.clear();
    group.updateMatrixWorld(true);
    return Object.freeze({ group, dispose });
  } catch (error) {
    dispose();
    throw error;
  }
}
