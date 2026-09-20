import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createGlobeCraftMaterials } from "./globeCraftMaterials";
import type { GlobeQualityTier } from "./globeQuality";

const TAU = Math.PI * 2;
const GROUND_Y = -1.438;
const details = {
  high: { radial: 96, cloudRows: 32, pageColumns: 24, pageRows: 12, bevel: 3, curve: 28, tube: 8 },
  balanced: { radial: 64, cloudRows: 24, pageColumns: 16, pageRows: 8, bevel: 2, curve: 20, tube: 6 },
  economy: { radial: 48, cloudRows: 16, pageColumns: 12, pageRows: 6, bevel: 1, curve: 12, tube: 4 },
} as const;
export interface OwnedBookCloudStand {
  readonly group: THREE.Group;
  dispose(): void;
}

/** An original, opaque sculpted support. All tiers keep the same solid cloud,
 * bound book, six sewn leaves and ribbon; only surface sampling becomes coarser.
 * Its complete authored volume is r<=.55, y[-1.44,-1.03]. */
export function createBookCloudStandGeometry(quality: GlobeQualityTier): OwnedBookCloudStand {
  if (!Object.prototype.hasOwnProperty.call(details, quality)) throw new Error("Invalid book-cloud quality");
  const detail = details[quality], group = new THREE.Group();
  group.name = "included-globe-stand:stand.base.child-book-cloud";
  group.userData = { standId: "stand.base.child-book-cloud", provenance: "authored-in-project", qualityTier: quality, groundY: GROUND_Y };
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  let craft: ReturnType<typeof createGlobeCraftMaterials> | null = null, disposed = false;
  const dispose = () => {
    if (disposed) return; disposed = true;
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    craft?.dispose(); group.clear();
  };
  const own = <T extends THREE.BufferGeometry>(geometry: T): T => { geometries.add(geometry); return geometry; };
  const material = <T extends THREE.Material>(value: T): T => { materials.add(value); return value; };
  const mesh = (name: string, geometry: THREE.BufferGeometry, finish: THREE.Material, parent = group) => {
    const value = new THREE.Mesh(own(geometry), finish);
    value.name = name; value.raycast = () => undefined; parent.add(value); return value;
  };
  const merge = (parts: THREE.BufferGeometry[]) => {
    try {
      const indexed = parts.map(part => {
        if (!part.index) part.setIndex(Array.from({ length: part.getAttribute("position").count }, (_, index) => index));
        part.clearGroups(); return part;
      });
      const result = mergeGeometries(indexed, false);
      if (!result) throw new Error("Unable to assemble book-cloud geometry");
      return own(result);
    } finally { for (const part of parts) { geometries.delete(part); part.dispose(); } }
  };
  const mirror = (geometry: THREE.BufferGeometry, side: number) => {
    if (side < 0) {
      geometry.scale(-1, 1, 1);
      const indices = geometry.getIndex()!;
      for (let i = 0; i < indices.count; i += 3) {
        const b = indices.getX(i + 1); indices.setX(i + 1, indices.getX(i + 2)); indices.setX(i + 2, b);
      }
    }
    return own(geometry);
  };

  function cloud() {
    const positions: number[] = [0, GROUND_Y, 0], uvs: number[] = [.5, 0], indices: number[] = [];
    // Smooth overlapping directional bulges form one continuous surface, rather
    // than separate balls, their intersections, or a transparent particle shell.
    const lobes = [[0, 1.0], [.79, .76], [1.57, 1.14], [2.36, .69], [3.14, .94], [3.93, 1.20], [4.71, .72], [5.50, .90]];
    for (let row = 1; row < detail.cloudRows; row++) {
      const q = row / detail.cloudRows, profile = Math.sin(q * Math.PI);
      const rise = Math.max(0, (q - .18) / .82);
      for (let column = 0; column <= detail.radial; column++) {
        const theta = column === detail.radial ? 0 : column / detail.radial * TAU;
        let lobing = 0;
        for (const [angle, amount] of lobes) lobing += amount * Math.exp((Math.cos(theta - angle) - 1) / .068);
        const shoulder = .77 + .38 * lobing * Math.sin(q * Math.PI);
        const r = profile * shoulder;
        const x = .385 * Math.cos(theta) * r, z = .285 * Math.sin(theta) * r;
        const swell = .045 * Math.pow(profile, 3) * (lobing - .72) * Math.min(1, Math.max(0, (q - .18) / .12)) ** 2;
        const y = GROUND_Y + .206 * (.5 - .5 * Math.cos(rise * Math.PI)) + swell;
        positions.push(x, y, z); uvs.push(column / detail.radial, q);
      }
    }
    const stride = detail.radial + 1;
    for (let column = 0; column < detail.radial; column++) indices.push(0, 1 + column, 2 + column);
    for (let row = 0; row < detail.cloudRows - 2; row++) for (let column = 0; column < detail.radial; column++) {
      const a = 1 + row * stride + column, b = a + 1, c = a + stride, d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
    const top = positions.length / 3; positions.push(0, GROUND_Y + .206, 0); uvs.push(.5, 1);
    const last = 1 + (detail.cloudRows - 2) * stride;
    for (let column = 0; column < detail.radial; column++) indices.push(last + column, top, last + column + 1);
    const geometry = own(new THREE.BufferGeometry());
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
    const normals = geometry.getAttribute("normal"), normal = new THREE.Vector3();
    for (let row = 0; row < detail.cloudRows - 1; row++) {
      const first = 1 + row * stride, last = first + detail.radial;
      normal.set(normals.getX(first) + normals.getX(last), normals.getY(first) + normals.getY(last), normals.getZ(first) + normals.getZ(last)).normalize();
      normals.setXYZ(first, normal.x, normal.y, normal.z); normals.setXYZ(last, normal.x, normal.y, normal.z);
    }
    normals.setXYZ(0, 0, -1, 0); normals.setXYZ(top, 0, 1, 0);
    const color = new Float32Array(positions.length);
    for (let index = 0; index < positions.length / 3; index++) {
      const x = positions[index * 3], y = positions[index * 3 + 1], z = positions[index * 3 + 2];
      const supportOcclusion = .14 * Math.exp(-(x * x / .065 + z * z / .050)) * Math.max(0, (y + 1.31) / .08);
      const shade = .88 + .10 * Math.max(0, normals.getY(index)) - supportOcclusion;
      color.set([shade * .96, shade * .987, shade], index * 3);
    }
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(color, 3));
    geometry.computeBoundingBox(); geometry.computeBoundingSphere(); return geometry;
  }

  /** Six explicitly stitched faces give each cut paper edge its own normal/UV.
   * The upper surface is not a plane: sewn gutter, arch and fore-edge curl are
   * actual positions shared by the closed underside and perimeter walls. */
  function paperVolume(width: number, depth: number, bottom: (u: number, v: number) => number,
    top: (u: number, v: number) => number) {
    const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
    const nu = detail.pageColumns, nv = detail.pageRows, corner = .009;
    const point = (u: number, v: number, upper: number) => {
      const z = (v - .5) * depth;
      const inset = Math.max(0, Math.abs(z) - (depth / 2 - corner));
      const halfWidth = width / 2 - corner + Math.sqrt(Math.max(0, corner * corner - inset * inset));
      return [.008 + width / 2 + (u - .5) * 2 * halfWidth,
        THREE.MathUtils.lerp(bottom(u, v), top(u, v), upper), z];
    };
    const face = (columns: number, rows: number, evaluate: (u: number, v: number) => number[], reverse: boolean) => {
      const start = positions.length / 3;
      for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
        const u = column / columns, v = row / rows; positions.push(...evaluate(u, v)); uvs.push(u, v);
      }
      for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
        const a = start + row * (columns + 1) + column, b = a + 1, c = a + columns + 1, d = c + 1;
        if (reverse) indices.push(a, c, b, b, c, d); else indices.push(a, b, c, b, d, c);
      }
    };
    face(nu, nv, (u, v) => point(u, v, 1), true);
    face(nu, nv, (u, v) => point(u, v, 0), false);
    face(nv, 1, (v, height) => point(0, v, height), false);
    face(nv, 1, (v, height) => point(1, v, height), true);
    face(nu, 1, (u, height) => point(u, 0, height), true);
    face(nu, 1, (u, height) => point(u, 1, height), false);
    const geometry = own(new THREE.BufferGeometry());
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
    return geometry;
  }
  const coverY = (u: number) => -1.228 - .030 * u + .006 * Math.sin(Math.PI * u);
  const pageY = (u: number, v: number) => -1.150 - .028 * u + .043 * Math.sin(Math.PI * u) + .002 * Math.sin(Math.PI * v);
  // Thin physical lamination follows all exposed cut edges, including the
  // rounded page corners. Batching keeps the whole edge detail to one draw.
  function pageCuts() {
    const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
    const count = quality === "high" ? 16 : quality === "balanced" ? 10 : 6;
    const strip = (segments: number, evaluate: (t: number, edge: number) => number[], reverse: boolean) => {
      const start = positions.length / 3;
      for (let i = 0; i <= segments; i++) for (const edge of [-1, 1]) {
        positions.push(...evaluate(i / segments, edge)); uvs.push(i / segments, (edge + 1) / 2);
      }
      for (let i = 0; i < segments; i++) {
        const a = start + i * 2, b = a + 2, c = a + 1, d = b + 1;
        if (reverse) indices.push(a, c, b, b, c, d); else indices.push(a, b, c, b, d, c);
      }
    };
    for (let layer = 1; layer <= count; layer++) {
      const fraction = layer / (count + 1);
      const height = (u: number, v: number, edge: number) =>
        THREE.MathUtils.lerp(coverY(u) + .009, pageY(u, v), fraction) + edge * .00023;
      for (const zSide of [-1, 1]) strip(detail.pageColumns, (t, edge) => {
        const u = .012 + t * .976;
        return [.210 + (u - .5) * .386, height(u, (zSide + 1) / 2, edge), zSide * .29212];
      }, zSide < 0);
      strip(detail.pageRows, (v, edge) => {
        const z = (v - .5) * .563;
        return [.41212, height(1, z / .584 + .5, edge), z];
      }, true);
    }
    const geometry = own(new THREE.BufferGeometry());
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
  }
  function cover() {
    const width = .418, height = .014, depth = .612, radius = .005;
    const geometry = own(new RoundedBoxGeometry(1, 1, 1, detail.bevel, .1));
    const positions = geometry.getAttribute("position"), normals = geometry.getAttribute("normal"), uvs = geometry.getAttribute("uv");
    const verticesPerFace = positions.count / 6, transformedNormal = new THREE.Vector3();
    for (let index = 0; index < positions.count; index++) {
      const x = Math.sign(positions.getX(index)) * (width / 2 - radius) + normals.getX(index) * radius;
      const y = Math.sign(positions.getY(index)) * (height / 2 - radius) + normals.getY(index) * radius;
      const z = Math.sign(positions.getZ(index)) * (depth / 2 - radius) + normals.getZ(index) * radius;
      const u = x / width + .5, slope = (-.030 + .006 * Math.PI * Math.cos(Math.PI * u)) / width;
      transformedNormal.set(normals.getX(index) - slope * normals.getY(index), normals.getY(index), normals.getZ(index)).normalize();
      normals.setXYZ(index, transformedNormal.x, transformedNormal.y, transformedNormal.z);
      positions.setXYZ(index, x + width / 2 + .009, y + coverY(u), z);
      const axis = Math.floor(index / verticesPerFace);
      if (axis < 2) uvs.setXY(index, .5 + z / depth, .5 + y / height);
      else if (axis < 4) uvs.setXY(index, u, .5 + z / depth);
      else uvs.setXY(index, u, .5 + y / height);
    }
    // The addon returns a non-indexed geometry; provide indices before mirroring.
    geometry.setIndex(Array.from({ length: positions.count }, (_, index) => index)); return own(geometry);
  }

  try {
    craft = createGlobeCraftMaterials(quality);
    const cloudFinish = material(new THREE.MeshPhysicalMaterial({ color: "#e2e9e8", metalness: 0, roughness: .54,
      clearcoat: .18, clearcoatRoughness: .36, envMap: craft.paper.envMap, envMapIntensity: .30, vertexColors: true }));
    cloudFinish.name = "book-cloud-satin-ceramic";
    const leather = material(craft.leather.clone()); leather.name = "book-cloud-blue-leather"; leather.color.set("#406477");
    leather.roughness = .88; leather.normalScale.set(.14, .14); leather.envMapIntensity = .18;
    const pages = material(craft.paper.clone()); pages.name = "book-cloud-cut-paper"; pages.color.set("#e8dfc8"); pages.normalScale.set(.04, .04);
    const cutLines = material(craft.paper.clone()); cutLines.name = "book-cloud-paper-lamination"; cutLines.color.set("#d3c6aa"); cutLines.normalScale.set(.02, .02);
    const leaves = material(craft.paper.clone()); leaves.name = "book-cloud-sewn-leaves"; leaves.color.set("#f2eddf"); leaves.normalScale.set(.025, .025);
    const gold = material(craft.brass.clone()); gold.name = "book-cloud-binding-tooling"; gold.color.set("#c9b789"); gold.envMapIntensity = .46;
    const ribbonFinish = material(craft.leather.clone()); ribbonFinish.name = "book-cloud-woven-bookmark"; ribbonFinish.color.set("#9c5660");
    ribbonFinish.metalness = 0; ribbonFinish.roughness = 1; ribbonFinish.envMapIntensity = .08;
    mesh("book-cloud-sculpted-cloud", cloud(), cloudFinish);
    const book = new THREE.Group(); book.name = "book-cloud-bound-book"; book.rotation.y = -.12; group.add(book);
    const covers: THREE.BufferGeometry[] = [], blocks: THREE.BufferGeometry[] = [], sheets: THREE.BufferGeometry[] = [];
    for (const side of [-1, 1]) {
      covers.push(mirror(cover(), side));
      blocks.push(mirror(paperVolume(.404, .584, u => coverY(u) + .009, pageY), side));
      for (let layer = 0; layer < 3; layer++) {
        const height = (u: number, v: number) => pageY(u, v) + layer * .0016
          + (.004 + layer * .002) * Math.pow(u, 5) * (.3 + .7 * Math.pow(v, 3));
        sheets.push(mirror(paperVolume(.404, .584, height, (u, v) => height(u, v) + .0016), side));
      }
    }
    mesh("book-cloud-rounded-covers", merge(covers), leather, book);
    mesh("book-cloud-page-blocks", merge(blocks), pages, book);
    mesh("book-cloud-top-leaves", merge(sheets), leaves, book);
    mesh("book-cloud-paper-lamination", merge([-1, 1].map(side => mirror(pageCuts(), side))), cutLines, book);
    const spineProfile = new THREE.Shape();
    spineProfile.moveTo(-.034, .012); spineProfile.bezierCurveTo(-.040, -.013, -.021, -.034, 0, -.036);
    spineProfile.bezierCurveTo(.021, -.034, .040, -.013, .034, .012); spineProfile.lineTo(-.034, .012);
    const spine = own(new THREE.ExtrudeGeometry(spineProfile, { depth: .602, steps: 1,
      curveSegments: detail.curve, bevelEnabled: true, bevelSegments: detail.bevel, bevelSize: .002, bevelThickness: .002 }));
    spine.translate(0, -1.210, -.301); mesh("book-cloud-spine", spine, leather, book);
    const seatProfile = [[0, -1.157], [.047, -1.157], [.052, -1.126], [.046, -1.119], [.041, -1.103],
      [.043, -1.080], [.066, -1.060], [.102, -1.046], [.105, -1.038], [.098, -1.0308], [0, -1.0308]];
    mesh("book-cloud-contact-seat", new THREE.LatheGeometry(seatProfile.map(([r, y]) => new THREE.Vector2(r, y)), detail.radial), gold);
    const ornament: THREE.BufferGeometry[] = [];
    for (const side of [-1, 1]) {
      const points: THREE.Vector3[] = [];
      for (let index = 0; index <= detail.curve; index++) {
        const u = index / detail.curve; points.push(new THREE.Vector3(side * (.022 + .391 * u), coverY(u) + .0078, .299));
      }
      ornament.push(own(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), detail.curve, .0012, detail.tube, false)));
      const outer = new THREE.LineCurve3(new THREE.Vector3(side * .422, coverY(1) + .0078, -.292),
        new THREE.Vector3(side * .422, coverY(1) + .0078, .292));
      ornament.push(own(new THREE.TubeGeometry(outer, 1, .0012, detail.tube, false)));
    }
    mesh("book-cloud-cover-tooling", merge(ornament), gold, book);
    const ribbonCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-.028, -1.138, .07), new THREE.Vector3(-.030, -1.138, .22),
      new THREE.Vector3(-.035, -1.138, .292), new THREE.Vector3(-.042, -1.160, .326),
      new THREE.Vector3(-.057, -1.242, .369), new THREE.Vector3(-.085, -1.343, .401),
    ]);
    const ribbon = own(new THREE.TubeGeometry(ribbonCurve, detail.curve, 1, detail.tube, false));
    const frames = ribbonCurve.computeFrenetFrames(detail.curve, false), vertices = ribbon.getAttribute("position");
    for (let row = 0; row <= detail.curve; row++) {
      const centre = ribbonCurve.getPointAt(row / detail.curve), tangent = frames.tangents[row];
      const widthDirection = new THREE.Vector3(1, 0, 0).addScaledVector(tangent, -tangent.x).normalize();
      const thicknessDirection = new THREE.Vector3().crossVectors(tangent, widthDirection).normalize();
      for (let column = 0; column <= detail.tube; column++) {
        const angle = column / detail.tube * TAU;
        const point = centre.clone().addScaledVector(widthDirection, -Math.cos(angle) * .012)
          .addScaledVector(thicknessDirection, Math.sin(angle) * .0014);
        vertices.setXYZ(row * (detail.tube + 1) + column, point.x, point.y, point.z);
      }
    }
    ribbon.computeVertexNormals(); mesh("book-cloud-bookmark", ribbon, ribbonFinish, book);
    group.updateMatrixWorld(true);
    return Object.freeze({ group, dispose });
  } catch (error) { dispose(); throw error; }
}
