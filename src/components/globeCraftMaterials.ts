import * as THREE from "three";
import type { GlobeQualityTier } from "./globeQuality";

export interface GlobeCraftMaterials {
  readonly wood: THREE.MeshStandardMaterial;
  readonly darkWood: THREE.MeshStandardMaterial;
  readonly brass: THREE.MeshStandardMaterial;
  readonly leather: THREE.MeshStandardMaterial;
  readonly paper: THREE.MeshStandardMaterial;
  readonly stone: THREE.MeshStandardMaterial;
  dispose(): void;
}

const TAU = Math.PI * 2;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (t: number) => t * t * (3 - 2 * t);
function hash(x: number, y: number, seed: number): number {
  let bits = Math.imul(x + seed * 127, 374761393) ^ Math.imul(y + 31, 668265263);
  bits = Math.imul(bits ^ (bits >>> 13), 1274126177);
  return ((bits ^ (bits >>> 16)) >>> 0) / 4294967295;
}
// Periodic lattice noise keeps the albedo, roughness and tangent normals seamless.
function noise(u: number, v: number, nx: number, ny: number, seed: number): number {
  const x = u * nx, y = v * ny, ix = Math.floor(x), iy = Math.floor(y);
  const at = (dx: number, dy: number) => hash(((ix + dx) % nx + nx) % nx, ((iy + dy) % ny + ny) % ny, seed);
  return mix(mix(at(0, 0), at(1, 0), smooth(x - ix)), mix(at(0, 1), at(1, 1), smooth(x - ix)), smooth(y - iy));
}

/** Original small PBR tile sets, generated locally without a canvas or network.
 * Every palette owns its maps/reflection texture; material clones may borrow them
 * only for this owner's lifetime. None modifies the shared scene environment.
 */
export function createGlobeCraftMaterials(quality: GlobeQualityTier): GlobeCraftMaterials {
  if (!["high", "balanced", "economy"].includes(quality)) throw new Error("Invalid craft material quality");
  const size = quality === "high" ? 256 : quality === "balanced" ? 128 : 64;
  const textures = new Set<THREE.Texture>();
  const materials = new Set<THREE.Material>();
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
  };
  const texture = (bytes: Uint8Array, width: number, height: number, name: string, color = false) => {
    const map = new THREE.DataTexture(bytes, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);
    textures.add(map);
    map.name = `original-craft:${name}:${quality}`;
    map.userData = { provenance: "authored-in-project", qualityTier: quality };
    map.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.magFilter = THREE.LinearFilter;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.generateMipmaps = true;
    map.anisotropy = quality === "economy" ? 1 : 4;
    map.needsUpdate = true;
    return map;
  };
  type Finish = "wood" | "brass" | "leather" | "paper" | "stone";
  const mapsFor = (kind: Finish) => {
    const albedo = new Uint8Array(size * size * 4), rough = new Uint8Array(albedo.length);
    const normal = new Uint8Array(albedo.length), relief = new Float32Array(size * size);
    // Keep several texels across a pore even on the small palette. Sampling the
    // high-tier lattice at one texel per cell turns detail into coarse stripes.
    const fineCells = Math.min(64, size / 4);
    const fibreCells = Math.min(44, size / 4);
    const pebbleCells = Math.min(38, size / 4);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const broad = noise(u, v, 4, 4, 13), fine = noise(u, v, fineCells, fineCells, 29);
      let tone = 0.8, height = fine, roughness = 0.7;
      let metallic = 1;
      let red = 1, green = 1, blue = 1;
      if (kind === "wood") {
        // Quiet growth colour sits behind discontinuous fine longitudinal pores.
        // All warps are periodic; long panels and turned surfaces close cleanly.
        const drift = (noise(u, v, 3, 2, 3) - 0.5) * 0.048
          + (noise(u, v, 7, 3, 19) - 0.5) * 0.011;
        const along = u + drift;
        const growth = noise(along, v, 9, 3, 41);
        const fibres = noise(along, v, fibreCells, 5, 47);
        const openPore = smooth(clamp((noise(along, v, fineCells, 11, 91) - 0.57) * 3.1));
        const poreLength = smooth(clamp((noise(along, v, 13, 17, 113) - 0.28) * 2.2));
        const pores = openPore * poreLength;
        const polished = noise(along, v, 5, 4, 127);
        tone = 0.818 + (growth - 0.5) * 0.045 + (broad - 0.5) * 0.022
          + (fibres - 0.5) * 0.016 - pores * 0.030;
        height = (fibres - 0.5) * 0.008 - pores * 0.010;
        roughness = 0.49 + growth * 0.035 + pores * 0.10 - polished * 0.045;
        // The canonical warm lights already supply warmth. A neutral brown tile
        // avoids amplifying orange in existing walnut/wood material tints.
        red = 0.925 + growth * 0.015; green = 0.985; blue = 1.01 - pores * 0.010;
      } else if (kind === "brass") {
        const patinaField = noise(u + (broad - 0.5) * 0.025, v, 4, 3, 59) * 0.7
          + noise(u, v, 9, 7, 131) * 0.3;
        const handled = smooth(clamp((noise(u, v, 3, 6, 61) - 0.42) * 2.2));
        const oxidation = smooth(clamp((patinaField - 0.35) * 2.7)) * (1 - handled * 0.62);
        const brushed = noise(u + (broad - 0.5) * 0.012, v, 4, fineCells, 71);
        tone = 0.855 + brushed * 0.014 - oxidation * 0.115 + handled * 0.026;
        height = fine * 0.0015 + brushed * 0.0025 + oxidation * 0.001;
        roughness = 0.43 + oxidation * 0.34 - handled * 0.085 + brushed * 0.025;
        metallic = 0.98 - oxidation * 0.77 + handled * 0.020;
        red = 0.975 - oxidation * 0.10; green = 0.99 - oxidation * 0.022; blue = 0.98;
      } else if (kind === "leather") {
        const warpedU = u + (noise(u, v, 5, 7, 137) - 0.5) * 0.035;
        const pebble = noise(warpedU, v, pebbleCells, pebbleCells, 83);
        const pores = smooth(clamp((fine - 0.59) * 3));
        const crease = smooth(clamp((noise(warpedU, v, 7, Math.min(18, size / 4), 97) - 0.67) * 3.6));
        const handled = smooth(clamp((noise(u, v, 3, 5, 101) - 0.28) * 1.8));
        const rubbed = smooth(clamp((noise(u, v, 11, 13, 139) - 0.57) * 3)) * handled;
        // Wear affects dye, relief and response together, without a tiled border
        // or painted scratches pretending to be actual binding geometry.
        tone = 0.805 + (broad - 0.5) * 0.045 + (pebble - 0.5) * 0.025
          - pores * 0.016 - crease * 0.022 + rubbed * 0.050;
        height = (pebble - 0.5) * 0.020 - pores * 0.008 - crease * 0.009;
        roughness = 0.67 + pores * 0.045 + crease * 0.065 - handled * 0.10 - rubbed * 0.055;
      } else if (kind === "paper") {
        const leaves = noise(u, v, 4, fineCells, 107);
        // Cut signatures are already modelled. Strong additional stripe maps
        // beat against those edges at phone scale and produce a woven moire.
        tone = 0.91 + broad * 0.025 + fine * 0.008;
        height = leaves * 0.0015 + fine * 0.002;
        roughness = 0.90 + fine * 0.075;
        red = 0.98; green = 0.99;
      } else {
        const veins = Math.pow(0.5 + 0.5 * Math.sin(u * TAU * 3 + v * TAU * 2 + broad * 8), 18);
        tone = 0.8 + broad * 0.08 + fine * 0.025 - veins * 0.08;
        height = fine * 0.01 - veins * 0.008;
        roughness = 0.53 + fine * 0.13 + veins * 0.12;
      }
      const offset = (y * size + x) * 4;
      const r = Math.round(clamp(roughness) * 255);
      albedo.set([Math.round(clamp(tone * red) * 255), Math.round(clamp(tone * green) * 255),
        Math.round(clamp(tone * blue) * 255), 255], offset);
      // Standard materials read roughness from G and metalness from B. Reusing
      // this one linear texture couples oxidation to both without another map.
      rough.set(kind === "brass" ? [255, r, Math.round(clamp(metallic) * 255), 255] : [r, r, r, 255], offset);
      relief[y * size + x] = height;
    }
    // Central differences use wrapped neighbours, so normal-map seams also close.
    // Resolution scaling retains the authored slope as the palette is sampled.
    // Fine wood/leather relief needs a visible response without broad corrugation;
    // paper deliberately keeps its quiet, filtered surface beside actual cuts.
    const reliefGain = kind === "wood" ? 4 : kind === "leather" ? 14 : kind === "brass" ? 8 : 1;
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const h = (dx: number, dy: number) => relief[((y + dy + size) % size) * size + (x + dx + size) % size];
      const dx = (h(-1, 0) - h(1, 0)) * size / 128 * reliefGain;
      const dy = (h(0, -1) - h(0, 1)) * size / 128 * reliefGain;
      const inverse = 1 / Math.hypot(dx, dy, 1);
      normal.set([Math.round((dx * inverse * 0.5 + 0.5) * 255), Math.round((dy * inverse * 0.5 + 0.5) * 255),
        Math.round((inverse * 0.5 + 0.5) * 255), 255], (y * size + x) * 4);
    }
    const maps = { map: texture(albedo, size, size, `${kind}-albedo`, true),
      roughnessMap: texture(rough, size, size, `${kind}-roughness`),
      normalMap: texture(normal, size, size, `${kind}-normal`) };
    // Grain and pores are millimetre-scale craft detail, not broad painted bands.
    const repeats = kind === "wood" ? [2, 1] : kind === "leather" ? [2, 2] : [1, 1];
    for (const map of Object.values(maps)) map.repeat.set(repeats[0], repeats[1]);
    return maps;
  };
  try {
    // A material-local, authored room reflection gives metals broad highlights.
    // It is not a background image, light or global environment override.
    const windows = [
      { u: 0.12, v: 0.34, width: 0.079, height: 0.24, strength: 0.70 },
      { u: 0.47, v: 0.40, width: 0.048, height: 0.19, strength: 0.48 },
      { u: 0.79, v: 0.31, width: 0.108, height: 0.26, strength: 0.37 },
    ];
    const reflectionBytes = new Uint8Array(size * (size / 2) * 4);
    for (let y = 0; y < size / 2; y++) for (let x = 0; x < size; x++) {
      const u = x / size, v = y / (size / 2);
      const cloud = noise(u, v, 5, 4, 149);
      const canopy = smooth(clamp((noise(u, v, 9, 6, 151) - 0.35) * 2)) * smooth(clamp((v - 0.37) * 5));
      let daylight = 0;
      for (const window of windows) {
        const distance = Math.abs(u - window.u);
        const horizontal = 1 - smooth(clamp((Math.min(distance, 1 - distance) / window.width - 0.65) / 0.6));
        const vertical = 1 - smooth(clamp((Math.abs(v - window.v) / window.height - 0.65) / 0.6));
        daylight = Math.max(daylight, horizontal * vertical * window.strength);
      }
      daylight *= (0.78 + cloud * 0.22 - canopy * 0.20)
        * smooth(clamp(v / 0.06)) * smooth(clamp((1 - v) / 0.08));
      const latitude = Math.sin(v * Math.PI);
      const wall = 0.145 + (noise(u, v, 3, 3, 157) - 0.5) * 0.05 * latitude;
      const ceiling = Math.pow(1 - v, 3) * 0.14;
      const floor = smooth(clamp((v - 0.63) / 0.29)) * 0.05;
      // The authored field runs from ceiling to floor. DataTexture does not
      // flip rows, while Three's equirectangular +Y direction samples v=1.
      const textureRow = size / 2 - 1 - y;
      reflectionBytes.set([Math.round(clamp(wall + ceiling * 0.94 + floor + daylight * 0.85) * 255),
        Math.round(clamp(wall + ceiling + floor * 0.65 + daylight * 0.94) * 255),
        Math.round(clamp(wall + ceiling * 1.06 + floor * 0.40 + daylight) * 255), 255], (textureRow * size + x) * 4);
    }
    const reflection = texture(reflectionBytes, size, size / 2, "window-reflections", true);
    reflection.mapping = THREE.EquirectangularReflectionMapping;
    reflection.wrapT = THREE.ClampToEdgeWrapping;
    const finish = (kind: Finish, color: string, metalness: number, reflectionIntensity: number) => {
      const reliefScale = kind === "leather" ? 0.32 : kind === "brass" ? 0.20 : kind === "paper" ? 0.08 : kind === "wood" ? 0.18 : 0.14;
      const maps = mapsFor(kind);
      const material = new THREE.MeshStandardMaterial({ ...maps, color, metalness, roughness: 1,
        normalScale: new THREE.Vector2(reliefScale, reliefScale),
        envMap: reflection, envMapIntensity: reflectionIntensity });
      if (kind === "brass") material.metalnessMap = maps.roughnessMap;
      material.name = `original-craft:${kind}`;
      material.userData.provenance = "authored-in-project";
      materials.add(material);
      return material;
    };
    const wood = finish("wood", "#92785b", 0.02, 0.30);
    const darkWood = wood.clone();
    darkWood.color.set("#66503c"); darkWood.name = "original-craft:dark-wood";
    materials.add(darkWood);
    return Object.freeze({ wood, darkWood, brass: finish("brass", "#bba779", 1, 0.72),
      leather: finish("leather", "#ffffff", 0, 0.22), paper: finish("paper", "#dfd7be", 0, 0.06),
      stone: finish("stone", "#8f8374", 0.08, 0.32), dispose });
  } catch (error) { dispose(); throw error; }
}
