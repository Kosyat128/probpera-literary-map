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
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const broad = noise(u, v, 4, 4, 13), fine = noise(u, v, 64, 64, 29);
      let tone = 0.8, height = fine, roughness = 0.7;
      let red = 1, green = 1, blue = 1;
      if (kind === "wood") {
        // Uneven longitudinal growth and pores, not equally spaced corrugations.
        // The warp is periodic too, so an arbitrary UV phase still tiles cleanly.
        const drift = (noise(u, v, 3, 2, 3) - 0.5) * 0.065
          + (noise(u, v, 7, 3, 19) - 0.5) * 0.014;
        const along = u + drift;
        const growth = noise(along, v, 11, 2, 41);
        const fibres = noise(along, v, 44, 3, 47);
        const pores = smooth(clamp((noise(along, v, 120, 5, 91) - 0.60) * 3.2));
        const dense = smooth(clamp((fibres - 0.45) * 2.4));
        tone = 0.75 + growth * 0.11 + broad * 0.035 - dense * 0.055 - pores * 0.045;
        height = fibres * 0.019 - pores * 0.012;
        roughness = 0.48 + growth * 0.075 + dense * 0.085 + pores * 0.035;
        // The canonical warm lights already supply warmth. A neutral brown tile
        // avoids amplifying orange in existing walnut/wood material tints.
        red = 0.90 + growth * 0.025; green = 0.98; blue = 1.02 - dense * 0.015;
      } else if (kind === "brass") {
        const oxidation = smooth(clamp((noise(u, v, 5, 3, 59) - 0.43) * 2.8));
        const handled = smooth(clamp((noise(u, v, 3, 6, 61) - 0.48) * 2.3));
        const brushed = noise(u + (broad - 0.5) * 0.015, v, 4, 100, 71);
        tone = 0.85 + brushed * 0.012 - oxidation * 0.12 + handled * 0.018;
        height = fine * 0.002 + brushed * 0.0025;
        roughness = 0.49 + oxidation * 0.17 - handled * 0.075 + brushed * 0.025;
        red = 0.97 - oxidation * 0.10; green = 0.99 - oxidation * 0.045; blue = 0.98;
      } else if (kind === "leather") {
        const pebble = noise(u, v, 38, 38, 83);
        const pores = Math.pow(clamp((fine - 0.4) * 2), 3);
        const crease = smooth(clamp((noise(u + broad * 0.025, v, 7, 18, 97) - 0.68) * 4));
        const handled = noise(u, v, 3, 5, 101);
        tone = 0.79 + broad * 0.065 + pebble * 0.035 - pores * 0.025 - crease * 0.025;
        height = pebble * 0.035 - pores * 0.014 - crease * 0.014;
        roughness = 0.63 + pores * 0.055 + crease * 0.05 - handled * 0.11;
      } else if (kind === "paper") {
        const leaves = noise(u, v, 4, 64, 107);
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
      rough.set([r, r, r, 255], offset);
      relief[y * size + x] = height;
    }
    // Central differences use wrapped neighbours, so normal-map seams also close.
    // Resolution scaling retains the same apparent relief at each quality tier.
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const h = (dx: number, dy: number) => relief[((y + dy + size) % size) * size + (x + dx + size) % size];
      const dx = (h(-1, 0) - h(1, 0)) * size / 128;
      const dy = (h(0, -1) - h(0, 1)) * size / 128;
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
    // A material-local, authored window reflection gives metals broad highlights.
    // It is not a background image, light or global environment override.
    const reflectionBytes = new Uint8Array(size * (size / 2) * 4);
    for (let y = 0; y < size / 2; y++) for (let x = 0; x < size; x++) {
      const u = x / size, v = y / (size / 2);
      const windows = Math.pow(Math.max(0, Math.cos(u * TAU * 4)), 12)
        * smooth(clamp((v - 0.12) * 8)) * smooth(clamp((0.69 - v) * 9));
      const ceiling = Math.pow(Math.max(0, 1 - v), 4) * 0.2;
      reflectionBytes.set([Math.round((0.12 + ceiling + windows * 0.45) * 255),
        Math.round((0.12 + ceiling * 0.96 + windows * 0.47) * 255),
        Math.round((0.115 + ceiling * 0.90 + windows * 0.49) * 255), 255], (y * size + x) * 4);
    }
    const reflection = texture(reflectionBytes, size, size / 2, "window-reflections", true);
    reflection.mapping = THREE.EquirectangularReflectionMapping;
    reflection.wrapT = THREE.ClampToEdgeWrapping;
    const finish = (kind: Finish, color: string, metalness: number, reflectionIntensity: number) => {
      const reliefScale = kind === "leather" ? 0.22 : kind === "brass" ? 0.08 : kind === "paper" ? 0.08 : kind === "wood" ? 0.12 : 0.14;
      const material = new THREE.MeshStandardMaterial({ ...mapsFor(kind), color, metalness, roughness: 1,
        normalScale: new THREE.Vector2(reliefScale, reliefScale),
        envMap: reflection, envMapIntensity: reflectionIntensity });
      material.name = `original-craft:${kind}`;
      material.userData.provenance = "authored-in-project";
      materials.add(material);
      return material;
    };
    const wood = finish("wood", "#92785b", 0.02, 0.30);
    const darkWood = wood.clone();
    darkWood.color.set("#66503c"); darkWood.name = "original-craft:dark-wood";
    materials.add(darkWood);
    return Object.freeze({ wood, darkWood, brass: finish("brass", "#bba779", 0.82, 0.72),
      leather: finish("leather", "#ffffff", 0, 0.22), paper: finish("paper", "#dfd7be", 0, 0.06),
      stone: finish("stone", "#8f8374", 0.08, 0.32), dispose });
  } catch (error) { dispose(); throw error; }
}
