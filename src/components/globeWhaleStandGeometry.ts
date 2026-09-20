import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { createAntiqueWhaleBodyGeometry } from "./globeAntiqueGeometry";
import { createGlobeCraftMaterials } from "./globeCraftMaterials";
import type { GlobeQualityTier } from "./globeQuality";

export interface OwnedWhaleStand {
  readonly group: THREE.Group;
  dispose(): void;
}

const details = Object.freeze({
  high: Object.freeze({ longitudinal: 68, radial: 40, loftSteps: 28, loftRadial: 20, eye: 20, ring: 192, tube: 8 }),
  balanced: Object.freeze({ longitudinal: 50, radial: 28, loftSteps: 22, loftRadial: 16, eye: 16, ring: 144, tube: 6 }),
  economy: Object.freeze({ longitudinal: 34, radial: 20, loftSteps: 16, loftRadial: 12, eye: 12, ring: 96, tube: 4 }),
});

/** Closed organic casting with a curved centreline and tapered elliptic rings.
 * A single vertex closes each pole; no collapsed triangles or flat extrusion
 * walls survive at the flipper edges. The thin axis fixes the membrane plane. */
function createOrganicLoft(
  curve: THREE.CubicBezierCurve3, thinAxis: THREE.Vector3,
  width: (t: number) => number, thickness: (t: number) => number,
  steps: number, radial: number,
): THREE.BufferGeometry {
  const positions = [...curve.v0.toArray()], uvs = [0.5, 0], indices: number[] = [];
  const row = radial + 1;
  for (let step = 1; step < steps; step++) {
    const t = step / steps, centre = curve.getPoint(t), tangent = curve.getTangent(t).normalize();
    const broad = thinAxis.clone().cross(tangent).normalize();
    const thin = tangent.clone().cross(broad).normalize();
    for (let segment = 0; segment <= radial; segment++) {
      const angle = segment / radial * Math.PI * 2;
      const point = centre.clone().addScaledVector(broad, Math.cos(angle) * width(t))
        .addScaledVector(thin, Math.sin(angle) * thickness(t));
      positions.push(...point.toArray()); uvs.push(segment / radial, t);
    }
  }
  const tip = positions.length / 3;
  positions.push(...curve.v3.toArray()); uvs.push(0.5, 1);
  for (let segment = 0; segment < radial; segment++) indices.push(0, 1 + segment + 1, 1 + segment);
  for (let step = 0; step < steps - 2; step++) {
    for (let segment = 0; segment < radial; segment++) {
      const a = 1 + step * row + segment, b = a + row;
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const last = 1 + (steps - 2) * row;
  for (let segment = 0; segment < radial; segment++) indices.push(last + segment, last + segment + 1, tip);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const normals = geometry.getAttribute("normal");
  for (let step = 0; step < steps - 1; step++) {
    const first = 1 + step * row, last = first + radial;
    const normal = new THREE.Vector3().fromBufferAttribute(normals, first)
      .add(new THREE.Vector3().fromBufferAttribute(normals, last)).normalize();
    normals.setXYZ(first, normal.x, normal.y, normal.z); normals.setXYZ(last, normal.x, normal.y, normal.z);
  }
  const startNormal = curve.getTangent(0).normalize().negate(), endNormal = curve.getTangent(1).normalize();
  normals.setXYZ(0, startNormal.x, startNormal.y, startNormal.z);
  normals.setXYZ(tip, endNormal.x, endNormal.y, endNormal.z);
  return geometry;
}

/** A closed, thin casting over the actual triangulated lower head. Every
 * surface triangle stays inside one source face in parameter space; merely
 * sampling exact vertices and bridging source edges can cut through a coarse
 * canonical body. The positive back clearance also survives the deepest cut. */
function createCastLowerJaw(body: THREE.BufferGeometry, detail: typeof details[keyof typeof details],
  quality: GlobeQualityTier): THREE.BufferGeometry {
  type Point = readonly [number, number];
  const u0 = .60, u1 = .974, v0 = .51, v1 = .99, backClearance = .0005;
  const positions = body.getAttribute("position"), normals = body.getAttribute("normal");
  const sourceRow = detail.radial + 1;
  const mouthAt = (v: number) => .883 + Math.sin((v - .5) * Math.PI * 2) * .075;
  const knots = (start: number, end: number, subdivisions: number, extra: number[]) => {
    const values = [start, end, ...extra];
    for (let n = 1; n < subdivisions; n++) values.push(n / subdivisions);
    return [...new Map(values.filter(value => value >= start && value <= end)
      .map(value => [Math.round(value * 1e11), value])).values()].sort((a, b) => a - b);
  };
  const grooveCenters = Array.from({ length: 7 }, (_, index) => .638 + index / 6 * .224);
  const grooveKnots = grooveCenters.flatMap(center => (quality === "high"
    ? [-.008, -.005, -.0025, 0, .0025, .005, .008] : [-.008, -.004, 0, .004, .008]).map(offset => center + offset));
  const us = knots(u0, u1, detail.longitudinal,
    [.614, .628, .65, .84, .87, .895]);
  const vs = knots(v0, v1, detail.radial, [v0 + .012, v0 + .024, .56, .60, .62,
    ...grooveKnots, .88, .90, .94, v1 - .024, v1 - .012]);
  const vertices: number[] = [], uvs: number[] = [], topFaces: number[] = [];
  const vertexIds = new Map<string, number>(), parameterPoints: Point[] = [];
  const smooth = (value: number) => THREE.MathUtils.smoothstep(value, 0, 1);
  const topOffset = (u: number, v: number) => {
    const mouth = u - mouthAt(v);
    const edge = smooth((u - u0) / .025) * smooth((v - v0) / .024)
      * smooth((v1 - v) / .024) * smooth((.011 - mouth) / .005);
    const throatFade = smooth((u - .614) / .036) * (1 - smooth((u - .84) / .055));
    let throat = 0;
    for (const center of grooveCenters) throat = Math.max(throat, Math.exp(-Math.pow((v - center) / .004, 2)));
    const mouthCut = Math.exp(-Math.pow(mouth / .003, 2));
    const rolledLip = Math.exp(-Math.pow((mouth - .006) / .003, 2));
    return backClearance + .00045 + edge * Math.max(.00015,
      .0032 - throat * throatFade * .0018 - mouthCut * .0022 + rolledLip * .0013);
  };
  const sample = (u: number, v: number) => {
    const x = u * detail.longitudinal, y = v * detail.radial;
    const i = Math.min(detail.longitudinal - 1, Math.floor(x)), j = Math.min(detail.radial - 1, Math.floor(y));
    const sx = x - i, sy = y - j, first = i * sourceRow + j;
    // Canonical diagonal: [first, second, first+1] and
    // [second, second+1, first+1], not a bilinear quadrilateral.
    const corners = sx + sy <= 1
      ? [[first, 1 - sx - sy], [first + sourceRow, sx], [first + 1, sy]]
      : [[first + sourceRow, 1 - sy], [first + sourceRow + 1, sx + sy - 1], [first + 1, 1 - sx]];
    const point = new THREE.Vector3(), normal = new THREE.Vector3(), scratch = new THREE.Vector3();
    for (const [index, weight] of corners) {
      point.addScaledVector(scratch.fromBufferAttribute(positions, index), weight);
      normal.addScaledVector(scratch.fromBufferAttribute(normals, index), -weight);
    }
    return { point, normal: normal.normalize() };
  };
  const vertex = (point: Point) => {
    const key = `${Math.round(point[0] * 1e10)},${Math.round(point[1] * 1e10)}`;
    const existing = vertexIds.get(key);
    if (existing !== undefined) return existing;
    const id = parameterPoints.length;
    parameterPoints.push(point); vertexIds.set(key, id); return id;
  };
  const clean = (polygon: Point[]) => {
    const result = polygon.filter((point, index) => index === 0
      || Math.abs(point[0] - polygon[index - 1][0]) + Math.abs(point[1] - polygon[index - 1][1]) > 1e-12);
    if (result.length > 1 && Math.abs(result[0][0] - result[result.length - 1][0])
      + Math.abs(result[0][1] - result[result.length - 1][1]) <= 1e-12) result.pop();
    return result;
  };
  const clip = (polygon: Point[], a: number, b: number, c: number, sign: number) => {
    const result: Point[] = [];
    for (let index = 0; index < polygon.length; index++) {
      const from = polygon[index], to = polygon[(index + 1) % polygon.length];
      const df = (a * from[0] + b * from[1] + c) * sign, dt = (a * to[0] + b * to[1] + c) * sign;
      if (df <= 1e-13) result.push(from);
      if ((df < -1e-13 && dt > 1e-13) || (df > 1e-13 && dt < -1e-13)) {
        const t = df / (df - dt);
        result.push([THREE.MathUtils.lerp(from[0], to[0], t), THREE.MathUtils.lerp(from[1], to[1], t)]);
      }
    }
    return clean(result);
  };
  const split = (polygons: Point[][], a: number, b: number, c: number) => polygons.flatMap(polygon => {
    const distances = polygon.map(point => a * point[0] + b * point[1] + c);
    if (Math.min(...distances) >= -1e-13 || Math.max(...distances) <= 1e-13) return [polygon];
    return [clip(polygon, a, b, c, 1), clip(polygon, a, b, c, -1)].filter(part => part.length >= 3);
  });
  for (let ui = 0; ui < us.length - 1; ui++) for (let vi = 0; vi < vs.length - 1; vi++) {
    const lowU = us[ui], highU = us[ui + 1], lowV = vs[vi], highV = vs[vi + 1];
    const slope = (mouthAt(highV) - mouthAt(lowV)) / (highV - lowV), intercept = mouthAt(lowV) - slope * lowV;
    const rectangle: Point[] = [[lowU, lowV], [highU, lowV], [highU, highV], [lowU, highV]];
    const outline = clip(rectangle, 1, -slope, -intercept - .011, 1);
    if (outline.length < 3) continue;
    const sourceI = Math.floor((lowU + highU) * .5 * detail.longitudinal);
    const sourceJ = Math.floor((lowV + highV) * .5 * detail.radial);
    let polygons = split([outline], detail.longitudinal, detail.radial, -sourceI - sourceJ - 1);
    // Explicit cross-sections put the mouth's trough and both rounded shoulders
    // into the mesh, even at Economy; they are not a painted line or a tube.
    for (const offset of [-.008, -.004, -.002, 0, .002, .004, .006, .009]) {
      polygons = split(polygons, 1, -slope, -intercept - offset);
    }
    for (const polygon of polygons) for (let corner = 1; corner < polygon.length - 1; corner++) {
      const a = polygon[0], b = polygon[corner], c = polygon[corner + 1];
      if ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) <= 1e-16) continue;
      const ia = vertex(a), ib = vertex(b), ic = vertex(c);
      if (ia !== ib && ib !== ic && ic !== ia) topFaces.push(ia, ib, ic);
    }
  }
  for (const layer of [0, 1]) for (const [u, v] of parameterPoints) {
    const { point, normal } = sample(u, v);
    point.addScaledVector(normal, layer === 0 ? topOffset(u, v) : backClearance);
    vertices.push(...point.toArray()); uvs.push(u, v);
  }
  const count = parameterPoints.length, indices: number[] = [];
  const boundary = new Map<string, readonly [number, number]>();
  for (let face = 0; face < topFaces.length; face += 3) {
    const a = topFaces[face], b = topFaces[face + 1], c = topFaces[face + 2];
    indices.push(c, b, a, a + count, b + count, c + count);
    for (const [from, to] of [[a, b], [b, c], [c, a]]) {
      const key = from < to ? `${from}/${to}` : `${to}/${from}`;
      if (boundary.has(key)) boundary.delete(key); else boundary.set(key, [from, to]);
    }
  }
  for (const [a, b] of boundary.values()) indices.push(a, b, a + count, b, b + count, a + count);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}

/** Site-derived golden whale support. It does not replace the site's existing frame,
 * change its camera, or take part in globe picking. The owner keeps every shared
 * buffer and craft map alive until the complete three-whale group is retired. */
export function createWhaleStandGeometry(quality: GlobeQualityTier): OwnedWhaleStand {
  if (!Object.prototype.hasOwnProperty.call(details, quality)) throw new Error("Invalid whale stand quality");
  const detail = details[quality];
  const group = new THREE.Group();
  group.name = "included-globe-stand:stand.base.three-whales";
  group.userData = { standId: "stand.base.three-whales", qualityTier: quality, provenance: "canonical-site-derived" };
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  let craft: ReturnType<typeof createGlobeCraftMaterials> | null = null;
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    craft?.dispose();
    group.clear();
  };
  const own = <T extends THREE.BufferGeometry>(geometry: T): T => { geometries.add(geometry); return geometry; };
  const mergeOwned = (parts: THREE.BufferGeometry[]) => {
    try {
      const combined = mergeGeometries(parts, false);
      if (!combined) throw new Error("Unable to assemble whale cast detail");
      return own(combined);
    } finally {
      for (const part of parts) part.dispose();
    }
  };
  const mesh = (parent: THREE.Group, name: string, geometry: THREE.BufferGeometry, material: THREE.Material) => {
    const result = new THREE.Mesh(geometry, material);
    result.name = name; result.raycast = () => undefined;
    parent.add(result);
    return result;
  };
  const goldSurface = (geometry: THREE.BufferGeometry, outwardSign = 1) => {
    const positions = geometry.getAttribute("position"), normals = geometry.getAttribute("normal");
    const colors: number[] = [];
    for (let index = 0; index < positions.count; index++) {
      const x = positions.getX(index), y = positions.getY(index), z = positions.getZ(index);
      const underside = Math.max(0, -normals.getY(index) * outwardSign);
      const mottling = 0.5 + 0.5 * Math.sin(x * 13 + z * 7) * Math.sin(z * 19 - y * 11);
      const shade = 0.91 - underside * 0.12 - mottling * 0.035;
      // Quiet contact shading changes value only: gold has no verdigris or
      // inherited brown albedo, and its exposed ridges remain polished.
      colors.push(shade, shade, shade);
    }
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return geometry;
  };
  try {
    craft = createGlobeCraftMaterials(quality);
    const finish = (name: string, color: string, metalness: number, roughness: number) => {
      const material = craft!.brass.clone();
      material.name = name; material.color.set(color); material.metalness = metalness;
      material.map = null; material.metalnessMap = null;
      material.roughness = roughness; material.envMapIntensity = 0.95;
      material.normalScale.set(0.12, 0.12); material.vertexColors = true;
      materials.add(material);
      return material;
    };
    const gold = finish("whale-cast-gold", "#efc674", 1, 0.65);
    const bodyGold = gold.clone();
    bodyGold.name = "whale-canonical-body-gold";
    // The site's canonical triangle winding points inward and its original
    // material is DoubleSide. Preserve inward normal orientation: Three flips
    // the back-facing shading normal to the visible outward direction itself.
    bodyGold.side = THREE.DoubleSide;
    materials.add(bodyGold);
    const recess = finish("whale-recess-gold", "#b18c41", 1, 0.98);
    const edge = finish("whale-burnished-gold", "#f5d483", 1, 0.38);
    const eyeMaterial = new THREE.MeshPhysicalMaterial({
      name: "whale-faceted-emerald", color: "#075634", metalness: 0, roughness: 0.07,
      clearcoat: 1, clearcoatRoughness: 0.045, ior: 1.57,
      envMap: craft.brass.envMap, envMapIntensity: 1.2,
    });
    materials.add(eyeMaterial);

    // The unchanged canonical profile gets a denser, smoother sampling. Even
    // economy keeps the site's former high body detail; no new body shape is
    // substituted for the user's recognizable three whales.
    const body = own(createAntiqueWhaleBodyGeometry({
      longitudinalSegments: detail.longitudinal, radialSegments: detail.radial,
    }));
    // Duplicate angular-seam vertices must shade as one smooth ring. The
    // generator's degenerate endpoint fans also leave unrelated pole normals;
    // axial inward normals close the specular nose without changing its shape.
    const bodyNormals = body.getAttribute("normal"), bodyRow = detail.radial + 1;
    for (let slice = 0; slice <= detail.longitudinal; slice++) {
      if (slice === 0 || slice === detail.longitudinal) {
        for (let ring = 0; ring <= detail.radial; ring++) {
          bodyNormals.setXYZ(slice * bodyRow + ring, 0, 0, slice === 0 ? 1 : -1);
        }
      } else {
        const first = slice * bodyRow, last = first + detail.radial;
        const normal = new THREE.Vector3().fromBufferAttribute(bodyNormals, first)
          .add(new THREE.Vector3().fromBufferAttribute(bodyNormals, last)).normalize();
        bodyNormals.setXYZ(first, normal.x, normal.y, normal.z); bodyNormals.setXYZ(last, normal.x, normal.y, normal.z);
      }
    }
    const bodyUvs: number[] = [];
    for (let slice = 0; slice <= detail.longitudinal; slice++) {
      for (let ring = 0; ring <= detail.radial; ring++) bodyUvs.push(slice / detail.longitudinal, ring / detail.radial);
    }
    body.setAttribute("uv", new THREE.Float32BufferAttribute(bodyUvs, 2));
    goldSurface(body, -1);

    // Paired swept flukes retain the canonical root, lateral tips and M-shaped
    // trailing silhouette. Rounded membrane sections remove the board edge.
    const lobes = ([-1, 1] as const).map((side) => createOrganicLoft(new THREE.CubicBezierCurve3(
      new THREE.Vector3(0, -1.105, -0.27), new THREE.Vector3(side * 0.17, -1.097, -0.34),
      new THREE.Vector3(side * 0.37, -1.087, -0.56), new THREE.Vector3(side * 0.46, -1.105, -0.51),
    ), new THREE.Vector3(0, 1, 0),
    (t) => 0.18 * Math.pow(Math.sin(Math.PI * t), 0.7) * (0.62 + 0.5 * t),
    (t) => 0.014 * Math.pow(Math.sin(Math.PI * t), 0.55), detail.loftSteps, detail.loftRadial));
    const tail = goldSurface(mergeOwned(lobes));
    const makeFin = (side: -1 | 1) => {
      return goldSurface(own(createOrganicLoft(new THREE.CubicBezierCurve3(
        new THREE.Vector3(side * 0.18, -1.11, 0.58), new THREE.Vector3(side * 0.28, -1.15, 0.56),
        new THREE.Vector3(side * 0.43, -1.258, 0.34), new THREE.Vector3(side * 0.50, -1.28, 0.16),
      ), new THREE.Vector3(0, 1, 0),
      (t) => (0.048 + 0.056 * Math.sin(Math.PI * t)) * Math.pow(Math.sin(Math.PI * t), 0.55) * (1 - 0.55 * t),
      (t) => 0.012 * Math.pow(Math.sin(Math.PI * t), 0.55) * (1 - 0.25 * t), detail.loftSteps, detail.loftRadial)));
    };
    const leftFin = makeFin(-1), rightFin = makeFin(1);
    const dorsal = goldSurface(own(createOrganicLoft(new THREE.CubicBezierCurve3(
      new THREE.Vector3(0, -0.945, 0.35), new THREE.Vector3(0, -0.892, 0.36),
      new THREE.Vector3(0, -0.83, 0.345), new THREE.Vector3(0, -0.795, 0.36),
    ), new THREE.Vector3(1, 0, 0),
    (t) => 0.16 * Math.sqrt(Math.sin(Math.PI * t)) * (1 - 0.65 * t),
    (t) => 0.025 * Math.pow(Math.sin(Math.PI * t), 0.65) * (1 - 0.4 * t), detail.loftSteps, detail.loftRadial)));

    // Attach facial details to interpolated *actual* canonical vertices, so the
    // same fit works at all three body tessellations without a copied profile.
    const surfaceAt = (progress: number, angle: number) => {
      const slice = THREE.MathUtils.clamp(progress, 0, 1) * detail.longitudinal;
      const ring = THREE.MathUtils.clamp(angle, 0, 1) * detail.radial;
      const i0 = Math.min(detail.longitudinal - 1, Math.floor(slice)), j0 = Math.min(detail.radial - 1, Math.floor(ring));
      const sx = slice - i0, sy = ring - j0, row = detail.radial + 1;
      const position = new THREE.Vector3(), normal = new THREE.Vector3();
      const positions = body.getAttribute("position"), normals = body.getAttribute("normal");
      for (const [di, dj, weight] of [[0, 0, (1 - sx) * (1 - sy)], [1, 0, sx * (1 - sy)],
        [0, 1, (1 - sx) * sy], [1, 1, sx * sy]]) {
        const index = (i0 + di) * row + j0 + dj;
        position.addScaledVector(new THREE.Vector3().fromBufferAttribute(positions, index), weight);
        normal.addScaledVector(new THREE.Vector3().fromBufferAttribute(normals, index), weight);
      }
      return { position, normal: normal.normalize().negate() };
    };
    // The continuous casting contains its own depressed mouth and seven
    // throat channels; the canonical body's buffers remain byte-identical.
    const lowerJaw = goldSurface(own(createCastLowerJaw(body, detail, quality)));
    const browCurves: THREE.BufferGeometry[] = [];
    const curveSegments = quality === "high" ? 32 : quality === "balanced" ? 24 : 18;
    for (const side of [-1, 1]) {
      const points: THREE.Vector3[] = [];
      for (let step = 0; step <= 12; step++) {
        const t = step / 12, arc = 0.078 + Math.sin(t * Math.PI) * 0.012;
        const sample = surfaceAt(0.804 + t * 0.081, side === 1 ? arc : 0.5 - arc);
        points.push(sample.position.addScaledVector(sample.normal, 0.00015));
      }
      browCurves.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), curveSegments,
        0.0015, detail.tube, false));
    }
    const brows = goldSurface(mergeOwned(browCurves));
    // A closed pavilion, girdle, sloping crown and flat table give the stones
    // real facets. Flat facet normals produce crisp reflections without a
    // transmission pass or any additional light/environment in the scene.
    const gemstoneProfile = [[0, -0.35], [0.56, -0.24], [1, -0.045], [1, 0], [0.58, 0.36], [0, 0.36]];
    const cutGemstone = new THREE.LatheGeometry(gemstoneProfile.map(([r, y]) => new THREE.Vector2(r, y)),
      quality === "high" ? 12 : quality === "balanced" ? 10 : 8);
    const eye = own(cutGemstone.toNonIndexed());
    cutGemstone.dispose();
    eye.rotateX(Math.PI / 2); eye.computeVertexNormals();
    const eyelid = own(new THREE.TorusGeometry(0.0155, 0.0016, detail.tube, detail.eye));
    goldSurface(eyelid);
    const facialSeats = [surfaceAt(0.845, 0.045), surfaceAt(0.845, 0.455)];
    const prongs: THREE.BufferGeometry[] = [];
    for (const sample of facialSeats) {
      const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), sample.normal);
      for (let prong = 0; prong < 4; prong++) {
        const angle = Math.PI / 4 + prong * Math.PI / 2;
        const position = new THREE.Vector3(Math.cos(angle) * 0.0136, Math.sin(angle) * 0.0109, 0.0025)
          .applyQuaternion(rotation).add(sample.position);
        // Rounded gold claws remain close to the girdle, never needle-like.
        const geometry = new THREE.SphereGeometry(0.0018, quality === "high" ? 12 : 8, 6);
        geometry.applyMatrix4(new THREE.Matrix4().compose(position, rotation, new THREE.Vector3(1, 1, 1.3)));
        prongs.push(geometry);
      }
    }
    const gemSettings = goldSurface(mergeOwned(prongs));

    for (let index = 0; index < 3; index++) {
      const whale = new THREE.Group();
      whale.name = `canonical-gold-whale-${index + 1}`;
      whale.rotation.y = index * Math.PI * 2 / 3;
      group.add(whale);
      mesh(whale, "whale-canonical-body", body, bodyGold);
      mesh(whale, "whale-rounded-flukes", tail, gold);
      mesh(whale, "whale-left-cast-flipper", leftFin, gold);
      mesh(whale, "whale-right-cast-flipper", rightFin, gold);
      mesh(whale, "whale-swept-dorsal-fin", dorsal, gold);
      mesh(whale, "whale-cast-lower-jaw", lowerJaw, gold);
      mesh(whale, "whale-brow-creases", brows, recess);
      mesh(whale, "whale-rounded-gem-claws", gemSettings, edge);
      for (let side = 0; side < facialSeats.length; side++) {
        const sample = facialSeats[side];
        const rotation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), sample.normal);
        const inset = mesh(whale, `whale-inset-emerald-${side}`, eye, eyeMaterial);
        inset.position.copy(sample.position).addScaledVector(sample.normal, -0.001);
        inset.quaternion.copy(rotation); inset.scale.set(0.015, 0.012, 0.015);
        const rim = mesh(whale, `whale-cast-eyelid-${side}`, eyelid, edge);
        rim.position.copy(sample.position).addScaledVector(sample.normal, 0.0004);
        rim.quaternion.copy(rotation); rim.rotateZ(-Math.PI * 0.175);
        rim.scale.y = 0.8;
      }
    }

    // Keep the site's three lower radii and placement. Their original luminous
    // lines become restrained thin gold cast rings, without any scene lights.
    for (const [index, radius] of [0.62, 1.02, 1.38].entries()) {
      const geometry = own(new THREE.TorusGeometry(radius, 0.0035, 6, detail.ring));
      goldSurface(geometry);
      const ring = mesh(group, `whale-base-ring-${index + 1}`, geometry, edge);
      ring.position.y = -1.31 - index * 0.012;
      ring.rotation.x = Math.PI / 2;
    }
    group.updateMatrixWorld(true);
    return Object.freeze({ group, dispose });
  } catch (error) {
    dispose();
    throw error;
  }
}
