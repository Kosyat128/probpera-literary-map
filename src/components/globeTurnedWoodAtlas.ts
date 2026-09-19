import * as THREE from "three";
import type { GlobeQualityTier } from "./globeQuality";

type Profile = readonly (readonly [radius: number, y: number])[];
type Side = "body" | "underfoot";
type Chart = readonly [left: number, bottom: number, right: number, top: number];
type Point = readonly [x: number, y: number, z: number];

const charts: Readonly<Record<Side | "endgrain", Chart>> = Object.freeze({
  body: Object.freeze([1 / 32, 17 / 32, 31 / 32, 31 / 32] as const),
  underfoot: Object.freeze([17 / 32, 1 / 32, 31 / 32, 15 / 32] as const),
  endgrain: Object.freeze([1 / 32, 1 / 32, 15 / 32, 15 / 32] as const),
});
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const smooth = (value: number) => { const t = clamp(value); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const hash = (x: number, y: number) => {
  const value = Math.sin(x * 127.1 + y * 311.7 + 19.23) * 43758.5453;
  return value - Math.floor(value);
};
const noise = (x: number, y: number) => {
  const ix = Math.floor(x), iy = Math.floor(y), fx = smooth(x - ix), fy = smooth(y - iy);
  return lerp(lerp(hash(ix, iy), hash(ix + 1, iy), fx),
    lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), fx), fy);
};
const chartUv = (chart: Chart, u: number, v: number): readonly [number, number] =>
  [lerp(chart[0], chart[2], clamp(u)), lerp(chart[1], chart[3], clamp(v))];

export interface TurnedWoodAtlas {
  readonly map: THREE.DataTexture;
  readonly normalMap: THREE.DataTexture;
  readonly roughnessMap: THREE.DataTexture;
  sideUv(side: Side, angle: number, profileIndex: number): readonly [number, number];
  endUv(x: number, y: number, z: number): readonly [number, number];
  dispose(): void;
}

/** The same solid-wood field is baked onto the actual turned profiles and cuts.
 * These maps belong only to this stand, never to the shared craft palette. */
export function createTurnedWoodAtlas(
  quality: GlobeQualityTier, profiles: Readonly<Record<Side, Profile>>,
): TurnedWoodAtlas {
  const scale = quality === "high" ? 1 : quality === "balanced" ? 2 : 4;
  const allPoints = [...profiles.body, ...profiles.underfoot];
  const originY = Math.min(...allPoints.map(([, y]) => y));
  const height = Math.max(...allPoints.map(([, y]) => y)) - originY;
  const extent = Math.max(...allPoints.map(([radius]) => radius)) + height * 0.05 + 0.01;
  const paths = {} as Record<Side, { profile: Profile; distances: number[]; length: number }>;
  for (const side of ["body", "underfoot"] as const) {
    const profile = profiles[side], distances = [0];
    for (let index = 1; index < profile.length; index++) {
      const [r0, y0] = profile[index - 1], [r1, y1] = profile[index];
      // Terminal flat caps have their own chart. Internal annular shoulders
      // still occupy real meridian distance, so the adjoining grain matches.
      const terminalCap = (index === 1 && r0 === 0 && y0 === y1)
        || (index === profile.length - 1 && r1 === 0 && y0 === y1);
      distances.push(distances[index - 1] + (terminalCap ? 0 : Math.hypot(r1 - r0, y1 - y0)));
    }
    paths[side] = { profile, distances, length: distances[distances.length - 1] };
  }
  // Fibres run along the original billet with a slight, continuous natural
  // slope. An off-centre pith avoids concentric target rings on the capitals.
  const woodPoint = (x: number, y: number, z: number): readonly [number, number] =>
    [x + (y - originY) * 0.037, z - (y - originY) * 0.024];
  const point = (side: Side | "endgrain", u: number, v: number): Point => {
    if (side === "endgrain") return [(u * 2 - 1) * extent, originY, (v * 2 - 1) * extent];
    const path = paths[side], distance = clamp(v) * path.length;
    let index = 1;
    while (index < path.profile.length - 1 && (path.distances[index] < distance
      || path.distances[index] === path.distances[index - 1])) index++;
    const span = path.distances[index] - path.distances[index - 1];
    const t = span ? clamp((distance - path.distances[index - 1]) / span) : 0;
    const radius = lerp(path.profile[index - 1][0], path.profile[index][0], t);
    const y = lerp(path.profile[index - 1][1], path.profile[index][1], t);
    const angle = u * Math.PI * 2;
    return [Math.sin(angle) * radius, y, Math.cos(angle) * radius];
  };
  const field = (position: Point, footprint: number): readonly [shade: number, roughness: number, relief: number] => {
    const [x, z] = woodPoint(...position);
    const warp = (noise(x * 5.1 + 17, z * 4.3 - 11) - 0.5) * 0.025;
    const radius = Math.hypot((x + 0.29) * 0.93, (z - 0.21) * 1.05) + warp;
    const growthPhase = (radius * 7.5 + (noise(radius * 4.3, 6.2) - 0.5) * 0.8) * Math.PI * 2;
    const visible = (frequency: number) => 1 - smooth((footprint * frequency - 0.18) / 0.72);
    // Filter the narrow latewood harmonics separately from the broad growth
    // figure. Reducing quality must soften a wood surface, not erase its whole
    // material identity when one high-frequency ring signal exceeds Nyquist.
    const growth = 0.5 + 0.34 * Math.cos(growthPhase) * visible(7.5)
      + 0.13 * Math.cos(growthPhase * 2) * visible(15)
      + 0.03 * Math.cos(growthPhase * 3) * visible(22.5);
    // These vessel clusters remain resolvable on the real atlas. Frequencies
    // above its sampling rate contribute neither wood identity nor useful
    // relief; the narrower neck naturally reveals more of this same field.
    const fine = (noise(x * 28 + 9, z * 28 - 4) - 0.5)
      * (0.35 + 0.65 * noise(x * 7.3, z * 7.3));
    const visiblePores = visible(28);
    const broad = noise(x * 5.2 - 13, z * 5.2 + 5) - 0.5;
    const figure = noise(x * 2.3 + 8, z * 2.3 - 3) - 0.5;
    return [0.835 + broad * 0.045 + figure * 0.035 - (growth - 0.5) * 0.19 + fine * 0.06 * visiblePores,
      0.615 + broad * 0.06 + growth * 0.12 - fine * 0.09 * visiblePores,
      -growth * 0.00032 + fine * 0.00013 * visiblePores];
  };
  const owned: THREE.DataTexture[] = [];
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const texture of owned) texture.dispose();
  };
  const makeMap = (kind: "albedo" | "normal" | "roughness", width: number, heightPixels: number) => {
    const mipmaps: { data: Uint8Array; width: number; height: number }[] = [];
    for (let w = width, h = heightPixels; ; w = Math.max(1, w / 2), h = Math.max(1, h / 2)) {
      const data = new Uint8Array(w * h * 4);
      // Each level is baked independently with extruded chart borders. GPU
      // downsampling an atlas would blend endgrain into a neighbouring side.
      const detailFade = smooth((Math.min(w, h) - 2) / 10);
      for (let row = 0; row < h; row++) for (let column = 0; column < w; column++) {
        const atlasU = (column + 0.5) / w, atlasV = (row + 0.5) / h;
        // Below a half-texel gutter, both texels bordering a chart join must
        // converge to the same quiet finish. Bilinear/trilinear sampling can
        // then cross that join without importing another surface's grain.
        const coarseJoin = (h < 16 && Math.abs(atlasV - 0.5) <= 0.5 / h + 1e-9)
          || (w < 16 && atlasV < 0.5 && Math.abs(atlasU - 0.5) <= 0.5 / w + 1e-9);
        const fade = coarseJoin ? 0 : detailFade;
        const side = atlasV >= 0.5 ? "body" : atlasU < 0.5 ? "endgrain" : "underfoot";
        const rect = charts[side];
        const u = clamp((atlasU - rect[0]) / (rect[2] - rect[0]));
        const v = clamp((atlasV - rect[1]) / (rect[3] - rect[1]));
        const du = 1 / (w * (rect[2] - rect[0])), dv = 1 / (h * (rect[3] - rect[1]));
        const p = point(side, u, v);
        const left = point(side, side === "endgrain" ? clamp(u - du) : u - du, v);
        const right = point(side, side === "endgrain" ? clamp(u + du) : u + du, v);
        const below = point(side, u, clamp(v - dv)), above = point(side, u, clamp(v + dv));
        const distance = (a: Point, b: Point) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
        const uDistance = distance(left, right), vDistance = distance(below, above);
        // Along the billet, a large surface step can cross almost no fibres.
        // Filter in the coordinates where the grain actually varies, while
        // normal derivatives below retain physical surface-distance units.
        const grainDistance = (a: Point, b: Point) => {
          const qa = woodPoint(...a), qb = woodPoint(...b);
          return Math.hypot(qa[0] - qb[0], qa[1] - qb[1]);
        };
        const footprint = Math.max(grainDistance(left, right), grainDistance(below, above)) / 2;
        const [shade, roughness] = field(p, footprint);
        let red: number, green: number, blue: number;
        if (kind === "normal") {
          const dx = -(field(right, footprint)[2] - field(left, footprint)[2]) / Math.max(1e-6, uDistance) * fade;
          const dy = -(field(above, footprint)[2] - field(below, footprint)[2]) / Math.max(1e-6, vDistance) * fade;
          const length = Math.hypot(dx, dy, 1);
          red = 0.5 + dx / length / 2; green = 0.5 + dy / length / 2; blue = 0.5 + 1 / length / 2;
        } else if (kind === "roughness") {
          red = green = blue = lerp(0.675, roughness, fade);
        } else {
          const value = lerp(0.835, shade, fade);
          red = value * 0.97; green = value; blue = value * 0.99;
        }
        const offset = (row * w + column) * 4;
        data[offset] = Math.round(clamp(red) * 255); data[offset + 1] = Math.round(clamp(green) * 255);
        data[offset + 2] = Math.round(clamp(blue) * 255); data[offset + 3] = 255;
      }
      mipmaps.push({ data, width: w, height: h });
      if (w === 1 && h === 1) break;
    }
    const texture = new THREE.DataTexture(mipmaps[0].data, width, heightPixels, THREE.RGBAFormat);
    owned.push(texture);
    texture.name = `turned-wood:${kind}`;
    texture.userData = { provenance: "authored-in-project", qualityTier: quality, atlasLayout: "turned-wood-v1", charts };
    texture.colorSpace = kind === "albedo" ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter; texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = false; texture.mipmaps = mipmaps; texture.needsUpdate = true;
    return texture;
  };
  try {
    const map = makeMap("albedo", 256 / scale, 128 / scale);
    const normalMap = makeMap("normal", 128 / scale, 64 / scale);
    const roughnessMap = makeMap("roughness", 64 / scale, 32 / scale);
    return Object.freeze({ map, normalMap, roughnessMap, dispose,
      sideUv(side: Side, angle: number, profileIndex: number) {
        return chartUv(charts[side], angle, paths[side].distances[profileIndex] / paths[side].length);
      },
      endUv(x: number, y: number, z: number) {
        const [qx, qz] = woodPoint(x, y, z);
        return chartUv(charts.endgrain, 0.5 + qx / (2 * extent), 0.5 + qz / (2 * extent));
      },
    });
  } catch (error) {
    dispose();
    throw error;
  }
}
