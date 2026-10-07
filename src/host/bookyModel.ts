import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { BOOKY_GRIP_SHAFT, BOOKY_GRIP_WRIST, createBookyGloveGeometry } from "./bookyGloveGeometry";

export interface BookyRig {
  readonly body: THREE.Group;
  readonly frontCover: THREE.Group;
  readonly bookmark: THREE.Group;
  readonly leftArm: THREE.Group;
  readonly rightArm: THREE.Group;
  readonly leftLeg: THREE.Group;
  readonly rightLeg: THREE.Group;
  readonly leftFoot: THREE.Group;
  readonly rightFoot: THREE.Group;
  readonly eyes: readonly [THREE.Group, THREE.Group];
  readonly upperLids: readonly [THREE.Group, THREE.Group];
  readonly pupils: readonly [THREE.Group, THREE.Group];
  readonly brows: readonly [THREE.Group, THREE.Group];
  readonly mouth: THREE.Group;
  readonly setEyelidClosure: (index: number, closure: number) => void;
}
export interface OwnedBookyModel {
  readonly group: THREE.Group;
  readonly rig: BookyRig;
  dispose(): void;
}
type Point = readonly [number, number, number];
const TAU = Math.PI * 2;
const noPicking = () => undefined;

/** An original articulated bound-book character. All coordinates are local,
 * front is +Z; lighting, motion, timing and interaction belong to its renderer. */
export function createBookyModel(): OwnedBookyModel {
  const group = new THREE.Group(); group.name = "booky-model"; group.rotation.z = .065;
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const textures = new Set<THREE.Texture>();
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    group.clear();
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    for (const texture of textures) texture.dispose();
    geometries.clear(); materials.clear(); textures.clear();
  };
  const own = <T extends THREE.BufferGeometry>(geometry: T): T => { geometries.add(geometry); return geometry; };
  const finish = <T extends THREE.Material>(material: T): T => { materials.add(material); return material; };
  const node = (parent: THREE.Object3D, name: string, position: Point = [0, 0, 0]) => {
    const value = new THREE.Group(); value.name = name; value.position.set(...position); parent.add(value); return value;
  };
  const mesh = (parent: THREE.Object3D, name: string, geometry: THREE.BufferGeometry, material: THREE.Material) => {
    const value = new THREE.Mesh(geometry, material); value.name = name;
    value.raycast = noPicking; parent.add(value); return value;
  };
  try {
    // Small deterministic, seamless leather response; no canvas, image or IO.
    const size = 256, height = new Float32Array(size * size);
    const noise = (x: number, y: number, period: number) => {
      const hash = (a: number, b: number) => {
        let n = Math.imul((a + period) % period + 19, 374761393)
          ^ Math.imul((b + period) % period + 73, 668265263);
        n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
      };
      // Jittered isotropic pores avoid the Cartesian value-noise weave that
      // was visible across the rejected cover. Existing owned maps are reused.
      const ix = Math.floor(x), iy = Math.floor(y); let nearest = Infinity, second = Infinity;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const cx = ix + dx, cy = iy + dy, px = cx + .15 + .70 * hash(cx, cy), py = cy + .15 + .70 * hash(cx + 47, cy + 29);
        const distance = (px - x) ** 2 + (py - y) ** 2;
        if (distance < nearest) { second = nearest; nearest = distance; } else second = Math.min(second, distance);
      }
      return THREE.MathUtils.clamp(.72 * Math.sqrt(nearest) + .28 * Math.sqrt(second), 0, 1);
    };
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      // Fine isotropic pores carry the leather response. There is no coarse
      // pigment layer whose cells can read as broad camouflage-like mottling.
      height[y * size + x] = .50 * noise(x * 48 / size, y * 48 / size, 48)
        + .35 * noise(x * 96 / size, y * 96 / size, 96) + .15 * noise(x / 2, y / 2, 128);
    }
    const albedo = new Uint8Array(size * size * 4), roughness = new Uint8Array(albedo.length), normal = new Uint8Array(albedo.length);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const at = (u: number, v: number) => height[((v + size) % size) * size + (u + size) % size];
      const h = at(x, y), offset = (y * size + x) * 4;
      const tone = Math.round(224 + h * 30), matte = Math.round(199 + h * 40);
      albedo.set([tone, tone, tone, 255], offset); roughness.set([255, matte, 255, 255], offset);
      const direction = new THREE.Vector3((at(x - 1, y) - at(x + 1, y)) * 1.6,
        (at(x, y - 1) - at(x, y + 1)) * 1.6, 1).normalize();
      normal.set([Math.round((direction.x * .5 + .5) * 255), Math.round((direction.y * .5 + .5) * 255),
        Math.round((direction.z * .5 + .5) * 255), 255], offset);
    }
    const texture = (name: string, data: Uint8Array, srgb = false) => {
      const value = new THREE.DataTexture(data, size, size);
      value.name = name; value.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      value.wrapS = value.wrapT = THREE.RepeatWrapping; value.magFilter = THREE.LinearFilter;
      value.repeat.set(4, 5);
      value.minFilter = THREE.LinearMipmapLinearFilter; value.generateMipmaps = true;
      value.userData.provenance = "authored-in-project"; value.needsUpdate = true;
      textures.add(value); return value;
    };
    const leather = finish(new THREE.MeshPhysicalMaterial({ color: "#327348", roughness: .43,
      map: texture("booky-leather-albedo", albedo, true), roughnessMap: texture("booky-leather-roughness", roughness),
      normalMap: texture("booky-leather-normal", normal), normalScale: new THREE.Vector2(.24, .24),
      clearcoat: .42, clearcoatRoughness: .28 })); leather.name = "booky-sage-leather";
    const darkGreen = finish(leather.clone()); darkGreen.color.set("#205c3c"); darkGreen.name = "booky-emerald-binding";
    const frontGreen = finish(leather.clone()); frontGreen.color.set("#326f45"); frontGreen.name = "booky-sage-front";
    const ivory = finish(new THREE.MeshStandardMaterial({ color: "#f3e7cc", roughness: .79 })); ivory.name = "booky-ivory-paper";
    const leafEdge = finish(new THREE.MeshStandardMaterial({ color: "#fff4dc", roughness: .68 }));
    const gold = finish(new THREE.MeshStandardMaterial({ color: "#e4ad42", metalness: .80, roughness: .20, envMapIntensity: 2.6 })); gold.name = "booky-gilt";
    const white = finish(new THREE.MeshPhysicalMaterial({ color: "#fff5e9", roughness: .56, clearcoat: .05, envMapIntensity: .25 })); white.name = "booky-soft-glove";
    // The gloves have their own satin response and a mild, geometry-derived
    // cavity colour. Teeth and cuffs keep their established white material.
    const gloveFinish = finish(white.clone()); gloveFinish.name = "booky-satin-glove";
    gloveFinish.vertexColors = true; gloveFinish.roughness = .42; gloveFinish.clearcoat = .12;
    gloveFinish.clearcoatRoughness = .32; gloveFinish.envMapIntensity = .50;
    const purple = finish(new THREE.MeshPhysicalMaterial({ color: "#7828a4", roughness: .44, clearcoat: .22 }));
    const brown = finish(new THREE.MeshPhysicalMaterial({ color: "#483329", roughness: .40, clearcoat: .28, clearcoatRoughness: .25 }));
    // Readable dark pupils remain dark under the renderer's broad environment.
    // Only the small authored catchlights are white, never the whole pupil.
    const pupilInk = finish(new THREE.MeshPhysicalMaterial({ color: "#090611", roughness: .17, clearcoat: .7, clearcoatRoughness: .13, envMapIntensity: .14 }));
    const eyeWhite = finish(new THREE.MeshPhysicalMaterial({ color: "#fff5e9", roughness: .32, clearcoat: .24, envMapIntensity: .20 }));
    const sparkle = finish(new THREE.MeshStandardMaterial({ color: "#fffcf4", roughness: .46,
      emissive: "#fff5e6", emissiveIntensity: .06, envMapIntensity: .1 }));
    const mouthInside = finish(new THREE.MeshStandardMaterial({ color: "#421b21", roughness: .65 }));
    const tonguePink = finish(new THREE.MeshPhysicalMaterial({ color: "#dc7282", roughness: .42, clearcoat: .28, clearcoatRoughness: .25 }));
    const irisFinish = finish(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: .19, clearcoat: .75, clearcoatRoughness: .18, envMapIntensity: .24 }));
    const glass = finish(new THREE.MeshPhysicalMaterial({ color: "#ffffff", transparent: true, opacity: .38,
      roughness: .025, metalness: 0, ior: 1.48,
      clearcoat: 0, clearcoatRoughness: .045, envMapIntensity: 1.35, depthWrite: false })); glass.name = "booky-magnifying-glass";

    const sphere = own(new THREE.SphereGeometry(1, 20, 14));
    const transformed = (source: THREE.BufferGeometry, position: Point, scale: Point = [1, 1, 1], rotation: Point = [0, 0, 0]) => {
      const geometry = own(source.clone());
      geometry.scale(...scale); geometry.rotateX(rotation[0]); geometry.rotateY(rotation[1]); geometry.rotateZ(rotation[2]);
      geometry.translate(...position); return geometry;
    };
    const ellipsoid = (position: Point, scale: Point) => transformed(sphere, position, scale);
    const torus = (radius: number, tube: number, position: Point, rotation: Point = [0, 0, 0]) => {
      const geometry = own(new THREE.TorusGeometry(radius, tube, 8, 48));
      geometry.rotateX(rotation[0]); geometry.rotateY(rotation[1]); geometry.rotateZ(rotation[2]); geometry.translate(...position); return geometry;
    };
    // A capped variable-radius organic loft. Unlike TubeGeometry it has actual
    // end faces, so glove digits and sleeves remain closed when articulated.
    const sweep = (points: readonly Point[], radii: readonly number[], steps = 20, radial = 10, roundedTip = false, authoredPath?: THREE.Curve<THREE.Vector3>) => {
      const path = authoredPath ?? new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, "centripetal");
      const frames = path.computeFrenetFrames(steps, false), positions: number[] = [], uvs: number[] = [], indices: number[] = [];
      for (let row = 0; row <= steps; row++) {
        const u = row / steps, r = u * (radii.length - 1), lower = Math.min(radii.length - 2, Math.floor(r));
        const radius = THREE.MathUtils.lerp(radii[lower], radii[lower + 1], r - lower);
        const center = path.getPointAt(u);
        for (let col = 0; col <= radial; col++) {
          const angle = col === radial ? 0 : col / radial * TAU;
          const point = center.clone().addScaledVector(frames.normals[row], Math.cos(angle) * radius)
            .addScaledVector(frames.binormals[row], Math.sin(angle) * radius);
          positions.push(point.x, point.y, point.z); uvs.push(col / radial, u);
        }
      }
      // Gloves have a continuous hemispherical tip, sharing the terminal ring
      // with the finger instead of overlapping a separate sphere or flat cap.
      const tip = new THREE.Vector3(...points[points.length - 1]);
      const rows = steps + (roundedTip ? 4 : 0);
      if (roundedTip) {
        const radius = radii[radii.length - 1];
        for (let ring = 1; ring <= 4; ring++) {
          const angle = ring / 5 * Math.PI / 2;
          const center = tip.clone().addScaledVector(frames.tangents[steps], radius * Math.sin(angle));
          for (let col = 0; col <= radial; col++) {
            const around = col === radial ? 0 : col / radial * TAU;
            const point = center.clone().addScaledVector(frames.normals[steps], Math.cos(around) * radius * Math.cos(angle))
              .addScaledVector(frames.binormals[steps], Math.sin(around) * radius * Math.cos(angle));
            positions.push(point.x, point.y, point.z); uvs.push(col / radial, 1 + ring / 5);
          }
        }
        tip.addScaledVector(frames.tangents[steps], radius);
      }
      const stride = radial + 1;
      for (let row = 0; row < rows; row++) for (let col = 0; col < radial; col++) {
        const a = row * stride + col, b = a + 1, c = a + stride, d = c + 1;
        indices.push(a, b, c, b, d, c);
      }
      const start = positions.length / 3, end = start + 1;
      positions.push(...points[0], tip.x, tip.y, tip.z); uvs.push(.5, 0, .5, 1);
      for (let col = 0; col < radial; col++) {
        indices.push(start, col + 1, col);
        const a = rows * stride + col; indices.push(end, a, a + 1);
      }
      const result = own(new THREE.BufferGeometry());
      result.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      result.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)); result.setIndex(indices); result.computeVertexNormals();
      const normals = result.getAttribute("normal"), sum = new THREE.Vector3();
      for (let row = 0; row <= rows; row++) {
        const a = row * stride, b = a + radial;
        sum.set(normals.getX(a) + normals.getX(b), normals.getY(a) + normals.getY(b), normals.getZ(a) + normals.getZ(b)).normalize();
        normals.setXYZ(a, sum.x, sum.y, sum.z); normals.setXYZ(b, sum.x, sum.y, sum.z);
      }
      return result;
    };
    const fused = (parent: THREE.Object3D, name: string, parts: THREE.BufferGeometry[], material: THREE.Material) => {
      const expanded = parts.map(part => part.index ? own(part.toNonIndexed()) : part);
      const joined = mergeGeometries(expanded, false);
      if (!joined) throw new Error("booky-geometry-merge-failed");
      own(joined);
      for (const part of new Set([...parts, ...expanded])) { part.dispose(); geometries.delete(part); }
      return mesh(parent, name, joined, material);
    };
    const shape = (draw: (value: THREE.Shape) => void, depth = .02, bevel = .008) => {
      const outline = new THREE.Shape(); draw(outline);
      const geometry = own(new THREE.ExtrudeGeometry(outline, { depth, bevelEnabled: true,
        bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, steps: 1, curveSegments: 20 }));
      return geometry;
    };
    // XY corners belong to the book silhouette, independently of board
    // thickness. RoundedBox would clamp these corners to half the thickness.
    const roundedCover = (width: number, height: number, depth: number, radius: number, bevel: number, position: Point) => {
      const x = width / 2, y = height / 2;
      const geometry = shape(s => {
        s.moveTo(-x + radius, -y); s.lineTo(x - radius, -y);
        s.quadraticCurveTo(x, -y, x, -y + radius); s.lineTo(x, y - radius);
        s.quadraticCurveTo(x, y, x - radius, y); s.lineTo(-x + radius, y);
        s.quadraticCurveTo(-x, y, -x, y - radius); s.lineTo(-x, -y + radius);
        s.quadraticCurveTo(-x, -y, -x + radius, -y); s.closePath();
      }, depth, bevel);
      geometry.translate(position[0], position[1], position[2] - depth / 2); return geometry;
    };
    // A closed radial surface has interior vertices for real tonal curvature.
    // The outer wall separates its visible front normals from the back cap.
    const sculptedSolid = (outline: THREE.Shape, center: readonly [number, number],
      front: (radius: number, x: number, y: number) => number, back: number, rings = 9) => {
      const boundary = outline.getPoints(12); if (boundary[0].distanceTo(boundary[boundary.length - 1]) < 1e-8) boundary.pop();
      // Front fans require CCW: the smile/tongue outlines are authored CW.
      // Their reversed front normals previously exposed the flat rear cap.
      if (THREE.ShapeUtils.isClockWise(boundary)) boundary.reverse();
      const count = boundary.length, positions = [center[0], center[1], front(0, ...center)], uvs = [.5, .5], indices: number[] = [];
      const min = new THREE.Vector2(Infinity, Infinity), max = new THREE.Vector2(-Infinity, -Infinity);
      boundary.forEach(p => { min.min(p); max.max(p); });
      const add = (x: number, y: number, z: number) => { positions.push(x, y, z); uvs.push((x - min.x) / (max.x - min.x), (y - min.y) / (max.y - min.y)); };
      for (let row = 1; row <= rings; row++) {
        const radius = row / rings;
        boundary.forEach(p => { const x = center[0] + (p.x - center[0]) * radius, y = center[1] + (p.y - center[1]) * radius; add(x, y, front(radius, x, y)); });
      }
      for (let col = 0; col < count; col++) indices.push(0, 1 + col, 1 + (col + 1) % count);
      const connect = (a: number, b: number) => {
        for (let col = 0; col < count; col++) { const next = (col + 1) % count; indices.push(a + col, b + col, a + next, a + next, b + col, b + next); }
      };
      for (let row = 1; row < rings; row++) connect(1 + (row - 1) * count, 1 + row * count);
      let previous = 1 + (rings - 1) * count;
      for (const [scale, depth] of [[1, .35], [.988, 1]]) {
        const start = positions.length / 3;
        boundary.forEach(p => { const z = THREE.MathUtils.lerp(front(1, p.x, p.y), back, depth); add(center[0] + (p.x - center[0]) * scale, center[1] + (p.y - center[1]) * scale, z); });
        connect(previous, start); previous = start;
      }
      const end = positions.length / 3; add(center[0], center[1], back);
      for (let col = 0; col < count; col++) indices.push(end, previous + (col + 1) % count, previous + col);
      const geometry = own(new THREE.BufferGeometry()); geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
    };
    // One authored contour joins board, tooling, pages and attached face.
    // Camera, outer group and body scale remain independent runtime owners.
    const coverX = (x: number, y: number) => .56 + (x - .56) * (1.032 + .010 * y / .817) - .036 * y / .817;
    const bookX = (x: number, y: number) => coverX(x + .56, y) - .56;
    const bindBookContour = (geometry: THREE.BufferGeometry) => {
      const p = geometry.getAttribute("position");
      for (let i = 0; i < p.count; i++) p.setX(i, bookX(p.getX(i), p.getY(i)));
      p.needsUpdate = true; geometry.computeVertexNormals(); return geometry;
    };
    // Keep the authored allocation at unit width. The former whole-body 4.5%
    // stretch pushed the prop beyond its fixed horizontal host bounds.
    const body = node(group, "booky-body");
    const frontCover = node(body, "booky-front-cover", [-.56, 0, .18]);
    const facePosition = (x: number, y: number, z: number): Point => [coverX(x + .56, y), y, z - .18];
    const coverOutline = new THREE.Shape(), hx = .617, hy = .817, cornerRadius = .124;
    coverOutline.moveTo(.56 - hx + cornerRadius, -hy); coverOutline.lineTo(.56 + hx - cornerRadius, -hy);
    coverOutline.quadraticCurveTo(.56 + hx, -hy, .56 + hx, -hy + cornerRadius); coverOutline.lineTo(.56 + hx, hy - cornerRadius);
    coverOutline.quadraticCurveTo(.56 + hx, hy, .56 + hx - cornerRadius, hy); coverOutline.lineTo(.56 - hx + cornerRadius, hy);
    coverOutline.quadraticCurveTo(.56 - hx, hy, .56 - hx, hy - cornerRadius); coverOutline.lineTo(.56 - hx, -hy + cornerRadius);
    coverOutline.quadraticCurveTo(.56 - hx, -hy, .56 - hx + cornerRadius, -hy); coverOutline.closePath();
    // One smooth two-axis bow replaces the max(|x|,|y|) field, whose derivative
    // jumped along both diagonals and lit the leather as four large facets.
    // The perimeter stays fixed; the slightly fuller bow and tooling share this field.
    const coverCoordinates = (x: number, y: number) => {
      const scale = 1.032 + .010 * y / .817, originalX = (x - .56 + .036 * y / .817) / scale;
      return { u: originalX / hx, v: y / hy, ux: 1 / (hx * scale), uy: (.036 - .010 * originalX) / (.817 * hx * scale) };
    };
    const coverZ = (x: number, y: number) => {
      const { u, v } = coverCoordinates(x, y), bow = Math.max(0, 1 - u * u) * Math.max(0, 1 - v * v);
      return .052 + .038 * bow * bow;
    };
    const coverNormal = (x: number, y: number) => {
      const { u, v, ux, uy } = coverCoordinates(x, y), a = Math.max(0, 1 - u * u), b = Math.max(0, 1 - v * v);
      const du = a > 0 ? -2 * u * b : 0, dv = b > 0 ? -2 * v * a : 0, factor = .076 * a * b;
      return new THREE.Vector3(-factor * du * ux, -factor * (du * uy + dv / hy), 1).normalize();
    };
    // A shared positive width field gives the white, moving lid and sewn cup
    // a narrower upper pole and a full lower cheek. Their common deformation
    // preserves nested shells; the iris follows this same implicit surface.
    const eyeTaper = Object.freeze({ strength: .070, slope: 1.5, height: .268 });
    const eyeWidth = (y: number) => 1 - eyeTaper.strength * (1 + Math.tanh(eyeTaper.slope * y / eyeTaper.height));
    const eyeWidthSlope = (y: number) => {
      const t = Math.tanh(eyeTaper.slope * y / eyeTaper.height);
      return -eyeTaper.strength * eyeTaper.slope / eyeTaper.height * (1 - t * t);
    };
    const eyeGradient = (out: THREE.Vector3, x: number, y: number, z: number, axes: THREE.Vector3) => {
      const width = eyeWidth(y), derivative = eyeWidthSlope(y);
      return out.set(x / (axes.x * axes.x * width * width),
        y / (axes.y * axes.y) - x * x * derivative / (axes.x * axes.x * width * width * width),
        z / (axes.z * axes.z)).normalize();
    };
    const eyeSurfaces = [
      { side: "left", bodyX: -.190, y: .185, scaleX: .770, scaleY: .935, yaw: -.280, pitch: -.100, irisX: .145, irisY: .178, gazeX: .008, gazeY: -.014 },
      { side: "right", bodyX: .306, y: .192, scaleX: .690, scaleY: .955, yaw: -.280, pitch: -.100, irisX: .140, irisY: .176, gazeX: -.024, gazeY: -.020 },
    ].map(value => ({ ...value, center: new THREE.Vector3(...facePosition(value.bodyX, value.y, .198)),
      frame: new THREE.Quaternion().setFromEuler(new THREE.Euler(value.pitch, value.yaw, 0)),
      sclera: new THREE.Vector3(.205, .237, .090), lid: new THREE.Vector3(.214, .253, .115),
      pocket: new THREE.Vector3(.234, .268, .132) }));
    // The original tangent-ring parameterization is deformed together with
    // the complete nested eye shells. The sewn annulus follows its resulting
    // contour; proper cover/lid separation is checked on the actual triangles.
    const eyePocketFrames = eyeSurfaces.map(eye => {
      const axes = eye.pocket.clone().multiply(new THREE.Vector3(eye.scaleX, eye.scaleY, 1));
      const inverse = eye.frame.clone().invert();
      const depth = new THREE.Vector3(0, 0, 1).applyQuaternion(inverse).divide(axes).normalize();
      const horizontal = new THREE.Vector3(1, 0, 0).applyQuaternion(inverse).multiply(axes).normalize();
      const vertical = new THREE.Vector3().crossVectors(depth, horizontal).normalize();
      return { axes, depth, horizontal, vertical };
    });
    const eyePocketPoint = (index: number, backAngle: number, phi: number) => {
      const eye = eyeSurfaces[index], pocket = eyePocketFrames[index];
      const p = pocket.horizontal.clone().multiplyScalar(Math.cos(phi) * Math.cos(backAngle))
        .addScaledVector(pocket.vertical, Math.sin(phi) * Math.cos(backAngle))
        .addScaledVector(pocket.depth, -Math.sin(backAngle)).multiply(pocket.axes);
      p.x *= eyeWidth(p.y / eye.scaleY);
      return p.applyQuaternion(eye.frame).add(eye.center);
    };
    const mouthSurface = { position: facePosition(.056, -.153, .267), scaleX: .930, scaleY: 1.280 };
    const smileOutline = new THREE.Shape();
    smileOutline.moveTo(-.231, .030); smileOutline.bezierCurveTo(-.100, -.015, .102, -.014, .237, .041);
    smileOutline.bezierCurveTo(.151, -.194, -.140, -.196, -.231, .030); smileOutline.closePath();
    const mouthWeights = new Map<number, number>();
    const fixedPocketNormals = new Map<number, THREE.Vector3>();
    // Shared boundary vertices carry the same normal on panel and annulus.
    // Use the bowed panel and the actual ellipsoid gradients, not the area of
    // long triangulation spokes, to shade the joined leather consistently.
    const updateCoverNormals = (geometry: THREE.BufferGeometry) => {
      geometry.computeVertexNormals();
      const positions = geometry.getAttribute("position"), normals = geometry.getAttribute("normal");
      const sheet = geometry.userData.sheet as { panelVertexCount: number; underside: number[] };
      for (let i = 0; i < sheet.panelVertexCount; i++) {
        if (mouthWeights.has(i)) continue;
        const normal = coverNormal(positions.getX(i), positions.getY(i));
        normals.setXYZ(i, normal.x, normal.y, normal.z);
        normals.setXYZ(sheet.underside[i], -normal.x, -normal.y, -normal.z);
      }
      for (const [index, normal] of fixedPocketNormals) {
        if (!mouthWeights.has(index)) normals.setXYZ(index, normal.x, normal.y, normal.z);
      }
      normals.needsUpdate = true;
    };
    // The cover, eye cups and lower lip share the same indexed surface.
    // Concentric cups close behind the independently articulated whites; there
    // are no flattened socket ellipsoids or overlapping green lip solids.
    const continuousCover = () => {
      const divisions = 2, outer = coverOutline.getPoints(12).map(p => new THREE.Vector2(coverX(p.x, p.y), p.y)); outer.pop();
      const mouthCenter = new THREE.Vector2(mouthSurface.position[0], mouthSurface.position[1] - .065 * mouthSurface.scaleY);
      const mouthLoop = smileOutline.getSpacedPoints(32).slice(0, -1).map(p =>
        new THREE.Vector2(mouthSurface.position[0] + p.x * mouthSurface.scaleX * 1.15,
          mouthCenter.y + (p.y + .065) * mouthSurface.scaleY * 1.15));
      const eyeLoops = eyeSurfaces.map((eye, index) => Array.from({ length: 32 }, (_, i) => {
        const p = eyePocketPoint(index, 0, i / 32 * TAU);
        return new THREE.Vector2(eye.center.x + (p.x - eye.center.x) * 1.085, eye.center.y + (p.y - eye.center.y) * 1.045);
      }));
      const holes = [...eyeLoops, mouthLoop];
      holes.forEach(hole => { if (THREE.ShapeUtils.isClockWise(hole)) hole.reverse(); });
      const anchors = [...outer, ...holes.flat()], faces = THREE.ShapeUtils.triangulateShape(outer, holes);
      const points: number[] = [], uvs: number[] = [], colors: number[] = [], indices: number[] = [], shared = new Map<string, number>();
      const add = (x: number, y: number, z: number, tone = 1, mouth = 0) => {
        const key = [x, y, z].map(v => Math.round(v * 1e8)).join(":"), previous = shared.get(key);
        if (previous !== undefined) { if (mouth) mouthWeights.set(previous, Math.max(mouthWeights.get(previous) ?? 0, mouth)); return previous; }
        const index = points.length / 3; shared.set(key, index); points.push(x, y, z);
        uvs.push((x - .56 + hx) / (2 * hx), (y + hy) / (2 * hy)); colors.push(tone, tone, tone);
        if (mouth) mouthWeights.set(index, mouth); return index;
      };
      const connect = (a: number[], b: number[], reverse = false) => {
        for (let i = 0; i < a.length; i++) {
          const j = (i + 1) % a.length;
          if (reverse) indices.push(a[j], a[i], b[i], a[j], b[i], b[j]);
          else indices.push(a[i], a[j], b[j], a[i], b[j], b[i]);
        }
      };
      // Matching edge subdivisions keep every interior and socket join exact.
      for (const face of faces) {
        const [a, b, c] = face.map(i => anchors[i]), grid = new Map<string, number>();
        for (let row = 0; row <= divisions; row++) for (let col = 0; col <= divisions - row; col++) {
          const x = a.x + (b.x - a.x) * row / divisions + (c.x - a.x) * col / divisions;
          const y = a.y + (b.y - a.y) * row / divisions + (c.y - a.y) * col / divisions;
          grid.set(row + ":" + col, add(x, y, coverZ(x, y)));
        }
        const get = (r: number, c: number) => grid.get(r + ":" + c)!;
        for (let row = 0; row < divisions; row++) for (let col = 0; col < divisions - row; col++) {
          indices.push(get(row, col), get(row + 1, col), get(row, col + 1));
          if (col + row < divisions - 1) indices.push(get(row + 1, col), get(row + 1, col + 1), get(row, col + 1));
        }
      }
      const panelVertexCount = points.length / 3; // The exterior remains an injective XY height field on both sides.
      const sample = (loop: THREE.Vector2[]) => loop.flatMap((p, i) => Array.from({ length: divisions }, (_, step) => p.clone().lerp(loop[(i + 1) % loop.length], step / divisions)));
      holes.forEach((hole, holeIndex) => {
        const boundary = sample(hole);
        let previous = boundary.map(p => add(p.x, p.y, coverZ(p.x, p.y)));
        if (holeIndex < 2) {
          // A narrower ruled annulus joins the panel to the shared tapered cup.
          // Retained radial clearance accommodates the real .008 backside;
          // the analytical normal belongs to this deformed surface itself.
          // Matching angular indices preserve the actual stitched topology.
          for (const [angle, tone] of [[0, 1], [.30, .99], [.62, .97], [.96, .94], [1.28, .90]]) {
            const ring = boundary.map((_, i) => {
              const p = eyePocketPoint(holeIndex, angle, i / boundary.length * TAU), id = add(p.x, p.y, p.z, tone);
              const eye = eyeSurfaces[holeIndex], scale = new THREE.Vector3(eye.scaleX, eye.scaleY, 1);
              const local = p.clone().sub(eye.center).applyQuaternion(eye.frame.clone().invert()).divide(scale);
              const normal = eyeGradient(new THREE.Vector3(), local.x, local.y, local.z, eye.pocket)
                .divide(scale).applyQuaternion(eye.frame).normalize().negate();
              fixedPocketNormals.set(id, normal); return id;
            });
            connect(previous, ring); previous = ring;
          }
          const pole = eyePocketPoint(holeIndex, Math.PI / 2, 0), floor = add(pole.x, pole.y, pole.z, .85);
          const eye = eyeSurfaces[holeIndex], scale = new THREE.Vector3(eye.scaleX, eye.scaleY, 1);
          const local = pole.clone().sub(eye.center).applyQuaternion(eye.frame.clone().invert()).divide(scale);
          fixedPocketNormals.set(floor, eyeGradient(new THREE.Vector3(), local.x, local.y, local.z, eye.pocket)
            .divide(scale).applyQuaternion(eye.frame).normalize().negate());
          for (let i = 0; i < previous.length; i++) indices.push(floor, previous[i], previous[(i + 1) % previous.length]);
        } else {
          for (const [scale, rise, tone] of [[.965, .007, 1], [.91, .026, 1], [.83, .010, .72], [.805, -.037, .48]]) {
            const ring = boundary.map(p => {
              const x = mouthCenter.x + (p.x - mouthCenter.x) * scale, y = mouthCenter.y + (p.y - mouthCenter.y) * scale;
              const lowerLip = 1 - THREE.MathUtils.smoothstep(y - mouthCenter.y, .040, .095);
              return add(x, y, coverZ(x, y) + rise * (rise > 0 ? .22 + .78 * lowerLip : 1), tone,
                1 - THREE.MathUtils.smoothstep(scale, .83, 1));
            });
            connect(previous, ring); previous = ring;
          }
          const floor = add(mouthCenter.x, mouthCenter.y, .017, .45, 1);
          for (let i = 0; i < previous.length; i++) indices.push(floor, previous[i], previous[(i + 1) % previous.length]);
        }
      });
      const edge = sample(outer), front = edge.map(p => add(p.x, p.y, coverZ(p.x, p.y)));
      // The panel underside keeps its triangulated XY domain: averaged socket
      // normals previously sheared skinny panel triangles into the annulus.
      // The mouth is also an XY height field: offsetting its sharp commissure
      // normally folded the underside across three neighboring lip rings.
      // Only the truly overhanging EYE cups need a normal-offset backside.
      // Shared boundary vertices and final mouth weights keep both sides sewn.
      const frontTriangles = indices.slice(), frontCount = points.length / 3, underside: number[] = [];
      const backNormals = Array.from({ length: frontCount }, () => new THREE.Vector3());
      const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), cross = new THREE.Vector3();
      for (let i = 0; i < frontTriangles.length; i += 3) {
        const ids = frontTriangles.slice(i, i + 3);
        a.fromArray(points, ids[0] * 3); b.fromArray(points, ids[1] * 3); c.fromArray(points, ids[2] * 3);
        cross.crossVectors(b.sub(a), c.sub(a)); for (const id of ids) backNormals[id].add(cross);
      }
      for (let i = 0; i < frontCount; i++) {
        const normal = i < panelVertexCount || mouthWeights.has(i) ? new THREE.Vector3(0, 0, 1) : backNormals[i].normalize(), thickness = .008;
        underside.push(add(points[i * 3] - normal.x * thickness, points[i * 3 + 1] - normal.y * thickness,
          points[i * 3 + 2] - normal.z * thickness, colors[i * 3], mouthWeights.get(i) ?? 0));
      }
      for (let i = 0; i < frontTriangles.length; i += 3) indices.push(underside[frontTriangles[i]], underside[frontTriangles[i + 2]], underside[frontTriangles[i + 1]]);
      connect(front, front.map(index => underside[index]), true);
      const geometry = own(new THREE.BufferGeometry());
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)); geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      geometry.setIndex(indices); geometry.computeVertexNormals(); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      geometry.userData.topology = "closed leather sheet: panel and mouth height-field backsides, normal-offset overhanging eye-cup backsides, final shared mouth rest";
      geometry.userData.sheet = { frontCount, underside, panelVertexCount, mouthHeightFieldVertices: [...mouthWeights.keys()].filter(i => i < frontCount), thickness: .008 };
      updateCoverNormals(geometry); return geometry;
    };
    const coverGeometry = continuousCover();
    // Only the cover owns per-vertex pocket tones. Sharing vertexColors=true
    // with plain nose/lid meshes made their absent color attribute render black.
    const coverFinish = finish(frontGreen.clone()); coverFinish.vertexColors = true;
    mesh(frontCover, "booky-front-hardcover", coverGeometry, coverFinish);
    const bindingParts: THREE.BufferGeometry[] = [bindBookContour(roundedCover(1.21, 1.61, .055, .112, .012, [0, 0, -.270]))];
    // A complete rounded leather back joins both boards. Its flush tooling
    // follows this same surface, rather than standing away like binder rings.
    // A rolled leather shell surrounds the pages. Its top is the thin edge
    // of the binding, not the solid disk of an extruded half-cylinder.
    const spineProfile = new THREE.Shape();
    for (let i = 0; i <= 36; i++) {
      const angle = -Math.PI / 2 - i / 36 * Math.PI;
      const x = Math.cos(angle) * .138, z = -.024 + Math.sin(angle) * .245;
      if (i === 0) spineProfile.moveTo(x, z); else spineProfile.lineTo(x, z);
    }
    for (let i = 36; i >= 0; i--) {
      const angle = -Math.PI / 2 - i / 36 * Math.PI;
      spineProfile.lineTo(Math.cos(angle) * .101, -.024 + Math.sin(angle) * .210);
    }
    spineProfile.closePath();
    const spine = own(new THREE.ExtrudeGeometry(spineProfile, { depth: 1.535, bevelEnabled: true,
      bevelSize: .009, bevelThickness: .012, bevelSegments: 3, steps: 1 }));
    spine.rotateX(Math.PI / 2); spine.translate(-.569, .7675, 0); bindingParts.push(bindBookContour(spine));
    // One real recessed page volume retains the external book thickness.
    // Its interior is a non-overhanging clearance bowl below the complete
    // eye/cup/mouth envelope, not a second copy of the cup's overhang.
    const pageVolume = () => {
      const positions: number[] = [], indices: number[] = [], rings: number[][] = [];
      const boundary = (width: number, height: number, radius: number, z: number) => {
        const ring: number[] = [];
        for (let corner = 0; corner < 4; corner++) for (let step = 0; step <= 8; step++) {
          const angle = (corner + step / 8) * Math.PI / 2;
          const cx = corner === 0 || corner === 3 ? width - radius : -width + radius;
          const cy = corner < 2 ? height - radius : -height + radius;
          const x = cx + Math.cos(angle) * radius, y = cy + Math.sin(angle) * radius;
          ring.push(positions.length / 3); positions.push(bookX(x, y), y, z);
        }
        rings.push(ring); return ring;
      };
      const outer = boundary(.560, .770, .022, .172), interior = boundary(.490, .580, .055, .030);
      const rear = boundary(.560, .770, .022, -.228);
      const join = (outside: number[], inside: number[]) => {
        for (let i = 0; i < outside.length; i++) {
          const j = (i + 1) % outside.length;
          indices.push(outside[i], outside[j], inside[j], outside[i], inside[j], inside[i]);
        }
      };
      join(outer, interior); join(rear, outer);
      const frontCenter = positions.length / 3; positions.push(bookX(0, 0), 0, .030);
      const backCenter = positions.length / 3; positions.push(bookX(0, 0), 0, -.228);
      for (let i = 0; i < outer.length; i++) {
        const j = (i + 1) % outer.length;
        indices.push(frontCenter, interior[i], interior[j], backCenter, rear[j], rear[i]);
      }
      const geometry = own(new THREE.BufferGeometry()); geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setIndex(indices); geometry.computeVertexNormals();
      geometry.userData.pageEnvelope = { plateau: .030, outerFront: .172, rear: -.228, interiorHalfSize: [.490, .580] };
      return geometry;
    };
    mesh(body, "booky-page-block", pageVolume(), ivory);
    const pageParts: THREE.BufferGeometry[] = [];
    for (let index = 0; index < 18; index++) {
      const z = -.222 + index / 17 * .388, inset = .0015 * Math.sin(index * 2.17);
      const width = (1.124 + inset) / 2, height = (1.542 + inset) / 2, radius = .022;
      const loop: THREE.Vector2[] = [];
      for (let corner = 0; corner < 4; corner++) for (let step = 0; step <= 2; step++) {
        const angle = (corner + step / 2) * Math.PI / 2;
        const cx = corner === 0 || corner === 3 ? width - radius : -width + radius;
        const cy = corner < 2 ? height - radius : -height + radius;
        loop.push(new THREE.Vector2(cx + Math.cos(angle) * radius + .002 + inset, cy + Math.sin(angle) * radius));
      }
      // Each visible leaf edge is a closed thin perimeter band. The actual
      // recessed page solid owns the interior; no hidden full leaf crosses it.
      const positions: number[] = [], indices: number[] = [];
      for (const [scale, depth] of [[1, -.0015], [1, .0015], [.982, .0015], [.982, -.0015]]) {
        for (const p of loop) positions.push(.002 + (p.x - .002) * scale, p.y * scale, z + depth);
      }
      for (let band = 0; band < 4; band++) for (let i = 0; i < loop.length; i++) {
        const next = (i + 1) % loop.length, a = band * loop.length + i, b = band * loop.length + next;
        const c = ((band + 1) % 4) * loop.length + i, d = ((band + 1) % 4) * loop.length + next;
        indices.push(a, b, c, b, d, c);
      }
      const leaf = own(new THREE.BufferGeometry()); leaf.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      leaf.setIndex(indices); leaf.computeVertexNormals(); pageParts.push(bindBookContour(leaf));
    }
    fused(body, "booky-layered-leaf-edges", pageParts, leafEdge);
    const gilding: THREE.BufferGeometry[] = [];
    for (const y of [-.690, -.638, -.168, .275, .327, .680]) {
      const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
      const profile = [[-.012, 0], [-.008, .005], [.008, .005], [.012, 0]];
      for (let row = 0; row < profile.length; row++) for (let i = 0; i <= 40; i++) {
        const angle = -Math.PI / 2 - i / 40 * Math.PI, [offsetY, rise] = profile[row];
        positions.push(bookX(-.569 + Math.cos(angle) * (.149 + rise), y + offsetY), y + offsetY, -.024 + Math.sin(angle) * (.256 + rise));
        uvs.push(i / 40, row / (profile.length - 1));
      }
      for (let row = 0; row < profile.length - 1; row++) for (let i = 0; i < 40; i++) {
        const a = row * 41 + i; indices.push(a, a + 1, a + 41, a + 1, a + 42, a + 41);
      }
      const band = own(new THREE.BufferGeometry());
      band.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      band.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)); band.setIndex(indices); band.computeVertexNormals(); gilding.push(band);
    }
    // Straight tooling joins four tangent quarter curves; unlike a spline
    // through corner samples this never overshoots into bent-wire hooks.
    const borderPath = new THREE.CurvePath<THREE.Vector3>();
    const corner = .074, bx = .494, by = .682;
    const bp = (x: number, y: number) => new THREE.Vector3(coverX(x + .574, y), y, coverZ(coverX(x + .574, y), y) + .006);
    const line = (ax: number, ay: number, cx: number, cy: number) => borderPath.add(new THREE.LineCurve3(bp(ax, ay), bp(cx, cy)));
    const arc = (ax: number, ay: number, mx: number, my: number, cx: number, cy: number) =>
      borderPath.add(new THREE.QuadraticBezierCurve3(bp(ax, ay), bp(mx, my), bp(cx, cy)));
    line(-bx + corner, -by, bx - corner, -by); arc(bx - corner, -by, bx - corner, -by + corner, bx, -by + corner);
    line(bx, -by + corner, bx, by - corner); arc(bx, by - corner, bx - corner, by - corner, bx - corner, by);
    line(bx - corner, by, -bx + corner, by); arc(-bx + corner, by, -bx + corner, by - corner, -bx, by - corner);
    line(-bx, by - corner, -bx, -by + corner); arc(-bx, -by + corner, -bx + corner, -by + corner, -bx + corner, -by);
    const border = own(new THREE.TubeGeometry(borderPath, 112, .0085, 8, true));
    mesh(frontCover, "booky-gold-cover-tooling", border, gold);

    const bookmark = node(body, "booky-bookmark", [bookX(-.40, .754), .754, 0]);
    // One closed cloth strip drapes over the top and down in FRONT of the
    // cover. The former planar tail sat inside the raised face panel.
    const ribbonPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, .018, -.143), new THREE.Vector3(0, .125, -.075),
      new THREE.Vector3(0, .125, .180), new THREE.Vector3(0, .075, .292),
      new THREE.Vector3(0, -.090, .293), new THREE.Vector3(0, -.177, .287),
    ], false, "centripetal");
    const ribbonRows = 32, ribbonColumns = 8, ribbonStride = ribbonColumns + 1;
    const ribbonPoints: number[] = [], ribbonUvs: number[] = [], ribbonIndices: number[] = [];
    for (let side = 0; side < 2; side++) for (let row = 0; row <= ribbonRows; row++) {
      const u = row / ribbonRows, center = ribbonPath.getPointAt(u), tangent = ribbonPath.getTangentAt(u);
      const normal = new THREE.Vector3(0, tangent.z, -tangent.y).normalize();
      for (let col = 0; col <= ribbonColumns; col++) {
        const v = col / ribbonColumns, cross = v * 2 - 1;
        const notch = (1 - Math.abs(cross)) * .032 * THREE.MathUtils.smoothstep(u, .84, 1);
        const point = center.clone().addScaledVector(normal, (side ? -1 : 1) * .004 + .0025 * (1 - cross * cross));
        point.x += cross * .074; point.y += notch;
        ribbonPoints.push(point.x, point.y, point.z); ribbonUvs.push(v, u);
      }
    }
    const ribbonLayer = (ribbonRows + 1) * ribbonStride;
    for (let row = 0; row < ribbonRows; row++) for (let col = 0; col < ribbonColumns; col++) {
      const a = row * ribbonStride + col, b = a + ribbonStride, c = a + 1, d = b + 1;
      ribbonIndices.push(a, b, c, b, d, c, a + ribbonLayer, c + ribbonLayer, b + ribbonLayer,
        b + ribbonLayer, c + ribbonLayer, d + ribbonLayer);
    }
    const ribbonEdge = (a: number, b: number) => ribbonIndices.push(a, a + ribbonLayer, b, b, a + ribbonLayer, b + ribbonLayer);
    for (let row = 0; row < ribbonRows; row++) {
      ribbonEdge(row * ribbonStride, (row + 1) * ribbonStride);
      ribbonEdge((row + 1) * ribbonStride + ribbonColumns, row * ribbonStride + ribbonColumns);
    }
    for (let col = 0; col < ribbonColumns; col++) {
      ribbonEdge(col + 1, col);
      ribbonEdge(ribbonRows * ribbonStride + col, ribbonRows * ribbonStride + col + 1);
    }
    const ribbon = own(new THREE.BufferGeometry());
    ribbon.setAttribute("position", new THREE.Float32BufferAttribute(ribbonPoints, 3));
    ribbon.setAttribute("uv", new THREE.Float32BufferAttribute(ribbonUvs, 2)); ribbon.setIndex(ribbonIndices); ribbon.computeVertexNormals();
    mesh(bookmark, "booky-purple-ribbon", ribbon, purple);

    const legs: THREE.Group[] = [], feet: THREE.Group[] = [];
    const shoeSole = (x: number) => {
      const levels = [[-.045, .88], [-.038, .97], [-.024, .994], [.007, 1], [.020, .976], [.027, .91]];
      const columns = 40, stride = columns + 1, positions: number[] = [], uvs: number[] = [], indices: number[] = [];
      for (const [y, scale] of levels) for (let col = 0; col <= columns; col++) {
        const a = col === columns ? 0 : col / columns * TAU, toe = Math.sin(a);
        // A restrained toe spring and rounded welt turn the sole under the vamp.
        const spring = .016 * Math.max(0, toe) ** 3;
        positions.push(x + Math.cos(a) * .164 * scale * (.96 + .055 * toe), -1.189 + y + spring,
          .117 + toe * .227 * scale + Math.max(0, toe) * .038 * scale); uvs.push(col / columns, (y + .045) / .072);
      }
      for (let row = 0; row < levels.length - 1; row++) for (let col = 0; col < columns; col++) {
        const a = row * stride + col, b = a + stride, c = a + 1;
        indices.push(a, b, c, b, b + 1, c);
      }
      const bottom = positions.length / 3, top = bottom + 1, last = (levels.length - 1) * stride;
      positions.push(x, -1.234, .117, x, -1.162, .117); uvs.push(.5, 0, .5, 1);
      for (let col = 0; col < columns; col++) indices.push(bottom, col, col + 1, top, last + col + 1, last + col);
      const geometry = own(new THREE.BufferGeometry());
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
      const normal = geometry.getAttribute("normal"), average = new THREE.Vector3();
      for (let row = 0; row < levels.length; row++) {
        const a = row * stride, b = a + columns;
        average.set(normal.getX(a) + normal.getX(b), normal.getY(a) + normal.getY(b), normal.getZ(a) + normal.getZ(b)).normalize();
        normal.setXYZ(a, average.x, average.y, average.z); normal.setXYZ(b, average.x, average.y, average.z);
      }
      return geometry;
    };
    const bootMaterial = finish(leather.clone()); bootMaterial.color.set("#ffffff");
    bootMaterial.vertexColors = false; bootMaterial.roughness = .43; bootMaterial.clearcoat = .30;
    bootMaterial.normalScale.set(.075, .075);
    // The actual curved vamp carries a continuous material boundary. Mixing
    // sparse per-vertex colours produced the visible jagged triangular toe edge.
    bootMaterial.onBeforeCompile = shader => {
      shader.uniforms.bookyBootGreen = { value: new THREE.Color("#286141") };
      shader.uniforms.bookyBootIvory = { value: new THREE.Color("#fff2dc") };
      shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying float bookyBootDepth;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nbookyBootDepth = position.z;");
      shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying float bookyBootDepth;\nuniform vec3 bookyBootGreen;\nuniform vec3 bookyBootIvory;")
        .replace("#include <color_fragment>", "#include <color_fragment>\nfloat bookyToe = smoothstep(0.210, 0.217, bookyBootDepth);\ndiffuseColor.rgb *= mix(bookyBootGreen, bookyBootIvory, bookyToe);")
        .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.46, bookyToe);");
    };
    bootMaterial.customProgramCacheKey = () => "booky-continuous-ivory-toe-v2";
    const shoeTrim = finish(white.clone()); shoeTrim.vertexColors = true; shoeTrim.color.set("#ffffff"); shoeTrim.roughness = .61;
    const trimColour = (geometry: THREE.BufferGeometry, hex: string) => {
      const colour = new THREE.Color(hex), values = new Float32Array(geometry.getAttribute("position").count * 3);
      for (let i = 0; i < values.length; i += 3) values.set([colour.r, colour.g, colour.b], i);
      geometry.setAttribute("color", new THREE.BufferAttribute(values, 3)); return geometry;
    };
    // One cross-section skin turns continuously from heel to ankle and vamp.
    // The toe cap changes material colour on that same surface, not its volume.
    const bootUpper = (x: number) => {
      const sections = [[-.136, .142, .086, .225], [-.111, .153, .085, .230],
        [-.071, .150, .078, .220], [-.016, .121, .032, .174],
        [.029, .094, -.022, .110], [.071, .078, -.044, .077], [.096, .076, -.044, .074]];
      const rows = 22, columns = 40, positions: number[] = [], colors: number[] = [], uvs: number[] = [], indices: number[] = [];
      const green = new THREE.Color("#ffffff");
      const paths = Array.from({ length: columns }, (_, col) => {
        const angle = col / columns * TAU, toe = Math.sin(angle);
        return new THREE.CatmullRomCurve3(sections.map(([y, width, center, radius]) =>
          new THREE.Vector3(Math.cos(angle) * width * (1 + .035 * toe), y, center + toe * radius)), false, "centripetal");
      });
      for (let row = 0; row <= rows; row++) for (let col = 0; col < columns; col++) {
        const point = paths[col].getPoint(row / rows);
        positions.push(point.x + x, point.y - 1.045, point.z + .05); uvs.push(col / columns, row / rows);
        colors.push(1, 1, 1);
      }
      for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
        const a = row * columns + col, b = row * columns + (col + 1) % columns, c = a + columns, d = b + columns;
        indices.push(a, c, b, b, c, d);
      }
      const bottom = positions.length / 3, top = bottom + 1;
      positions.push(x, sections[0][0] - 1.045, sections[0][2] + .05, x, sections[6][0] - 1.045, sections[6][2] + .05);
      colors.push(green.r, green.g, green.b, green.r, green.g, green.b); uvs.push(.5, 0, .5, 1);
      for (let col = 0; col < columns; col++) {
        const next = (col + 1) % columns;
        indices.push(bottom, col, next, top, rows * columns + next, rows * columns + col);
      }
      const geometry = own(new THREE.BufferGeometry());
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
      geometry.userData.topology = "closed ankle-vamp-toe cross-section skin"; return geometry;
    };
    for (const [side, x] of [["left", -.33], ["right", .203]] as const) {
      // Preserve the authored neutral vertices, but give each whole leg a hip
      // hidden inside the cover and each complete sneaker its own ankle.
      const leg = node(body, `booky-${side}-leg`, [x, -.73, 0]); legs.push(leg);
      const foot = node(leg, `booky-${side}-foot`, [0, side === "left" ? -.308 : -.393, .05]); feet.push(foot); foot.rotation.y = side === "left" ? -.72 : .32;
      const legGeometry = sweep([[x, -.73, 0], [x * .95, -.93, .035], [x, -1.08, .07]], [.076, .071, .073], 14, 10);
      legGeometry.translate(-x, .73, 0);
      mesh(leg, side === "left" ? "booky-legs" : "booky-legs-right", legGeometry, leather);
      const shoeUpper = [bootUpper(x)];
      const shoeWhite = [trimColour(shoeSole(x), "#ead8bf"), trimColour(torus(.079, .020, [x, -.952, .007], [Math.PI / 2, 0, 0]), "#fff1dc")];
      const shoeLaces: THREE.BufferGeometry[] = [];
      for (const z of [.119, .174]) {
        const top = (dx: number) => {
          const vertices = shoeUpper[0].getAttribute("position"), triangles = shoeUpper[0].getIndex()!, px = x + dx;
          let height = -Infinity;
          for (let i = 0; i < triangles.count; i += 3) {
            const a = triangles.getX(i), b = triangles.getX(i + 1), c = triangles.getX(i + 2);
            const ax = vertices.getX(a), az = vertices.getZ(a), bx = vertices.getX(b), bz = vertices.getZ(b), cx = vertices.getX(c), cz = vertices.getZ(c);
            const determinant = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
            if (Math.abs(determinant) < 1e-12) continue;
            const u = ((bz - cz) * (px - cx) + (cx - bx) * (z - cz)) / determinant;
            const v = ((cz - az) * (px - cx) + (ax - cx) * (z - cz)) / determinant, w = 1 - u - v;
            if (Math.min(u, v, w) >= -1e-7) height = Math.max(height, u * vertices.getY(a) + v * vertices.getY(b) + w * vertices.getY(c));
          }
          if (!Number.isFinite(height)) throw new Error("booky-lace-outside-boot");
          return height + .008;
        };
        const lacePoints = [-.070, -.047, -.023, 0, .023, .047, .070].map(dx => [x + dx, top(dx) + .006 * (1 - (dx / .070) ** 2), z] as Point);
        shoeLaces.push(sweep(lacePoints, [.011, .009, .011], 14, 8));
        for (const dx of [-.070, .070]) {
          const eyelet = own(new THREE.TorusGeometry(.014, .004, 6, 12)); eyelet.rotateX(Math.PI / 2);
          eyelet.translate(x + dx, top(dx) - .004, z); shoeLaces.push(eyelet);
        }
      }
      for (const geometry of [...shoeUpper, ...shoeWhite, ...shoeLaces]) geometry.translate(-x, 1.045, -.05);
      fused(foot, `booky-${side}-shoe-upper`, shoeUpper, bootMaterial);
      fused(foot, side === "left" ? "booky-shoe-soles-and-caps" : "booky-shoe-soles-and-caps-right", shoeWhite, shoeTrim);
      fused(foot, `booky-${side}-shoe-laces`, shoeLaces, gold);
    }
    fused(body, "booky-bound-spine-and-shoes", bindingParts, darkGreen);
    fused(body, "booky-spine-bands-and-shoe-laces", gilding, gold);

    const irisGeometry = (pupil: THREE.Group, surface: typeof eyeSurfaces[number]) => {
      const positions: number[] = [0, 0, 0], colors: number[] = [], uvs: number[] = [.5, .5], indices: number[] = [];
      const radii = [.20, .40, .60, .76, .87, .94, .975, 1], rows = radii.length, columns = 56, color = new THREE.Color();
      color.set("#643084"); colors.push(color.r, color.g, color.b);
      for (let row = 1; row <= rows; row++) for (let col = 0; col <= columns; col++) {
        const r = radii[row - 1], a = (col === columns ? 0 : col / columns) * TAU;
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        positions.push(x, y, 0);
        uvs.push(Math.cos(a) * r * .5 + .5, Math.sin(a) * r * .5 + .5);
        const fiber = Math.sin(a * 31 + r * 7) * .5 + Math.sin(a * 19 - r * 4) * .3;
        color.setHSL(.765 + fiber * .007, .90, (.095 + Math.sin(r * Math.PI) * .165 + fiber * .017) * (.88 - Math.sin(a) * .22));
        // The dark limbus occupies only the narrow outer edge of the iris.
        if (r > .94) color.multiplyScalar(1 - .56 * (r - .94) / .06);
        colors.push(color.r, color.g, color.b);
      }
      for (let col = 0; col < columns; col++) indices.push(0, 1 + col, 2 + col);
      const stride = columns + 1;
      for (let row = 0; row < rows - 1; row++) for (let col = 0; col < columns; col++) {
        const a = 1 + row * stride + col, b = a + 1, c = a + stride, d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
      const last = 1 + (rows - 1) * stride;
      // The closed rear cone owns a duplicate rim. Averaging its normals into
      // the visible perimeter used to turn the iris into a dark, flat badge.
      const frontCount = positions.length / 3, rear = frontCount;
      for (let col = 0; col <= columns; col++) {
        const at = (last + col) * 3; positions.push(positions[at], positions[at + 1], 0);
        uvs.push(uvs[(last + col) * 2], uvs[(last + col) * 2 + 1]); colors.push(colors[at], colors[at + 1], colors[at + 2]);
      }
      const back = positions.length / 3; positions.push(0, 0, -.070); uvs.push(.5, .5); colors.push(color.r, color.g, color.b);
      for (let col = 0; col < columns; col++) indices.push(back, rear + col + 1, rear + col);
      const result = own(new THREE.BufferGeometry());
      result.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      result.setAttribute("normal", new THREE.Float32BufferAttribute(new Float32Array(positions.length), 3));
      result.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      result.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3)); result.setIndex(indices);
      const position = result.getAttribute("position"), normal = result.getAttribute("normal"), direction = new THREE.Vector3();
      if (!(position instanceof THREE.BufferAttribute) || !(normal instanceof THREE.BufferAttribute)) {
        throw new Error("booky-iris-owned-buffer-attribute");
      }
      position.setUsage(THREE.DynamicDrawUsage); normal.setUsage(THREE.DynamicDrawUsage);
      let previousX = NaN, previousY = NaN, previousZ = NaN;
      const followSclera = () => {
        if (disposed || !Number.isFinite(pupil.position.x + pupil.position.y + pupil.position.z)) return;
        if (pupil.position.x === previousX && pupil.position.y === previousY && pupil.position.z === previousZ) return;
        previousX = pupil.position.x; previousY = pupil.position.y; previousZ = pupil.position.z;
        for (let at = 0; at < frontCount; at++) {
          const x = position.getX(at) * surface.irisX + previousX, y = position.getY(at) * surface.irisY + previousY;
          const z = surface.sclera.z * Math.sqrt(Math.max(.0001, 1 - (x / (surface.sclera.x * eyeWidth(y))) ** 2 - (y / surface.sclera.y) ** 2));
          position.setZ(at, z - previousZ + .0045);
        }
        for (let col = 0; col <= columns; col++) position.setZ(rear + col, position.getZ(last + col));
        result.computeVertexNormals();
        // Analytic front normals include the iris mesh's XY scale. The parent
        // rig still owns gaze; this surface merely follows its final transform.
        for (let at = 0; at < frontCount; at++) {
          const x = position.getX(at) * surface.irisX + previousX, y = position.getY(at) * surface.irisY + previousY;
          const z = position.getZ(at) + previousZ - .0045;
          eyeGradient(direction, x, y, z, surface.sclera);
          direction.multiply(new THREE.Vector3(surface.irisX, surface.irisY, 1)).normalize();
          normal.setXYZ(at, direction.x, direction.y, direction.z);
        }
        position.needsUpdate = true; normal.needsUpdate = true; result.computeBoundingBox(); result.computeBoundingSphere();
      };
      const updateMatrix = pupil.updateMatrix;
      pupil.updateMatrix = function () { updateMatrix.call(this); followSclera(); };
      followSclera();
      return result;
    };
    const eyes: THREE.Group[] = [], upperLids: THREE.Group[] = [], pupils: THREE.Group[] = [], brows: THREE.Group[] = [];
    // Evaluate the curved shell itself: interpolation between distant cap
    // positions would contract the lid and expose white crescents mid-blink.
    // Two small owned buffers deform only when closure changes; no morph texture.
    const lidColumns = 20, lidRows = 10, lidStride = lidColumns + 1;
    const lidIndices: number[] = [], lidUvs: number[] = [];
    for (let row = 0; row <= lidRows; row++) for (let col = 0; col <= lidColumns; col++) {
      lidUvs.push(col / lidColumns, row / lidRows);
      if (row < lidRows && col < lidColumns) {
        const a = row * lidStride + col;
        if (row > 0) lidIndices.push(a, a + 1, a + lidStride);
        lidIndices.push(a + 1, a + lidStride + 1, a + lidStride);
      }
    }
    const lidGeometries = [0, 1].map(() => {
      const geometry = own(new THREE.BufferGeometry());
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array((lidRows + 1) * lidStride * 3), 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute("normal", new THREE.Float32BufferAttribute(new Float32Array((lidRows + 1) * lidStride * 3), 3).setUsage(THREE.DynamicDrawUsage));
      geometry.setAttribute("uv", new THREE.Float32BufferAttribute(lidUvs, 2)); geometry.setIndex(lidIndices);
      return geometry;
    });
    const lidClosures = [NaN, NaN], lidNormal = new THREE.Vector3();
    const setEyelidClosure = (index: number, value: number) => {
      if (disposed || (index !== 0 && index !== 1)) return;
      const closure = Number.isFinite(value) ? THREE.MathUtils.clamp(value, 0, 1) : 0;
      if (closure === lidClosures[index]) return;
      lidClosures[index] = closure;
      const geometry = lidGeometries[index], positions = geometry.getAttribute("position"), normals = geometry.getAttribute("normal");
      const limit = .10 + closure * (Math.PI * .985 - .10);
      for (let row = 0; row <= lidRows; row++) for (let col = 0; col <= lidColumns; col++) {
        const theta = row / lidRows * limit, phi = col / lidColumns * Math.PI;
        const x = Math.cos(phi) * Math.sin(theta), y = Math.cos(theta), z = Math.sin(phi) * Math.sin(theta);
        const at = row * lidStride + col;
        const shell = eyeSurfaces[index].lid, py = y * shell.y, px = x * shell.x * eyeWidth(py), pz = z * shell.z;
        positions.setXYZ(at, px, py, pz);
        eyeGradient(lidNormal, px, py, pz, shell);
        normals.setXYZ(at, lidNormal.x, lidNormal.y, lidNormal.z);
      }
      positions.needsUpdate = true; normals.needsUpdate = true;
      geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    };
    setEyelidClosure(0, 0); setEyelidClosure(1, 0);
    // Capped rounded brows and a broader iris give a gentle, attentive face at
    // 88px too. Independent soft lids leave the eye and pupil shapes intact.
    const browOutline = new THREE.Shape();
    browOutline.moveTo(-.128, -.035); browOutline.bezierCurveTo(-.086, .047, .040, .091, .098, .061);
    browOutline.bezierCurveTo(.126, .046, .126, .003, .100, -.004);
    browOutline.bezierCurveTo(.032, .019, -.060, .011, -.128, -.035); browOutline.closePath();
    // A single domed leaf has a pointed tail and a rounded head, with no tube
    // radius join or hemispherical tip seam across the visible eyebrow.
    const browShape = sculptedSolid(browOutline, [.018, .032], r => .013 + .029 * (1 - r * r), -.007, 5);
    for (const surface of eyeSurfaces) {
      const side = surface.side;
      const eye = node(frontCover, `booky-eye-${side}`, surface.center.toArray() as unknown as Point); eyes.push(eye);
      eye.quaternion.copy(surface.frame); eye.scale.set(surface.scaleX, surface.scaleY, 1);
      // Use the existing white tessellation for the shared tapered surface;
      // the independent nose, pupil and catchlight geometry remains intact.
      const scleraGeometry = own(new THREE.SphereGeometry(1, 24, 18));
      scleraGeometry.scale(surface.sclera.x, surface.sclera.y, surface.sclera.z);
      const whitePositions = scleraGeometry.getAttribute("position"), whiteNormals = scleraGeometry.getAttribute("normal"), whiteNormal = new THREE.Vector3();
      for (let i = 0; i < whitePositions.count; i++) {
        const y = whitePositions.getY(i), x = whitePositions.getX(i) * eyeWidth(y), z = whitePositions.getZ(i);
        whitePositions.setX(i, x); eyeGradient(whiteNormal, x, y, z, surface.sclera);
        whiteNormals.setXYZ(i, whiteNormal.x, whiteNormal.y, whiteNormal.z);
      }
      mesh(eye, `booky-sclera-${side}`, scleraGeometry, eyeWhite);
      const upperLid = node(frontCover, `booky-upper-lid-${side}`, surface.center.toArray() as unknown as Point);
      upperLid.quaternion.copy(surface.frame); upperLid.scale.copy(eye.scale); upperLids.push(upperLid);
      mesh(upperLid, `booky-soft-upper-lid-${side}`, lidGeometries[side === "left" ? 0 : 1], frontGreen);
      const pupil = node(eye, `booky-pupil-${side}`, [surface.gazeX, surface.gazeY, .074]); pupils.push(pupil);
      const colored = mesh(pupil, `booky-iris-${side}`, irisGeometry(pupil, surface), irisFinish); colored.scale.set(surface.irisX, surface.irisY, 1);
      mesh(pupil, `booky-pupil-ink-${side}`, ellipsoid([0, 0, .013], [.097, .130, .014]), pupilInk);
      fused(pupil, `booky-eye-catchlights-${side}`, [ellipsoid([.026, .067, .025], [.028, .035, .003]),
        ellipsoid([-.039, .010, .026], [.009, .011, .003])], sparkle);
      const brow = node(frontCover, `booky-brow-${side}`, facePosition(surface.bodyX, side === "left" ? .510 : .527, .282)); brows.push(brow);
      const browMesh = mesh(brow, `booky-sculpted-brow-${side}`, browShape, brown);
      browMesh.rotation.z = side === "left" ? .07 : -.04;
      browMesh.scale.set(side === "left" ? 1.05 : -.93, side === "left" ? 1.02 : .96, .82);
      eye.userData.surface = { frame: surface.frame.toArray(), sclera: surface.sclera.toArray(), lid: surface.lid.toArray(), pocket: surface.pocket.toArray(), taper: eyeTaper };
    }
    mesh(frontCover, "booky-soft-nose", ellipsoid(facePosition(.040, -.002, .280), [.054, .038, .030]), frontGreen);
    const mouth = node(frontCover, "booky-mouth", mouthSurface.position);
    mouth.scale.set(mouthSurface.scaleX, mouthSurface.scaleY, 1);
    // Capture the final common rest after the complete sockets, lips and cover.
    const restCoverPositions = (coverGeometry.getAttribute("position").array as Float32Array).slice();
    const restMouthMatrix = new THREE.Matrix4().compose(mouth.position, mouth.quaternion, mouth.scale), restMouthInverse = restMouthMatrix.clone().invert();
    const lastMouthMatrix = restMouthMatrix.clone(), mouthMatrix = new THREE.Matrix4(), mouthDelta = new THREE.Matrix4(), lipPoint = new THREE.Vector3();
    const updateCoverMatrix = frontCover.updateMatrix;
    frontCover.updateMatrix = function () {
      updateCoverMatrix.call(this);
      if (disposed) return;
      mouthMatrix.compose(mouth.position, mouth.quaternion, mouth.scale);
      if (mouthMatrix.equals(lastMouthMatrix)) return;
      lastMouthMatrix.copy(mouthMatrix); mouthDelta.multiplyMatrices(mouthMatrix, restMouthInverse);
      const positions = coverGeometry.getAttribute("position");
      for (const [index, weight] of mouthWeights) {
        lipPoint.fromArray(restCoverPositions, index * 3).applyMatrix4(mouthDelta);
        positions.setXYZ(index,
          THREE.MathUtils.lerp(restCoverPositions[index * 3], lipPoint.x, weight),
          THREE.MathUtils.lerp(restCoverPositions[index * 3 + 1], lipPoint.y, weight),
          THREE.MathUtils.lerp(restCoverPositions[index * 3 + 2], lipPoint.z, weight));
      }
      positions.needsUpdate = true; updateCoverNormals(coverGeometry); coverGeometry.computeBoundingBox(); coverGeometry.computeBoundingSphere();
    };

    mesh(mouth, "booky-smile-cavity", sculptedSolid(smileOutline, [0, -.065], r => .014 - .010 * (1 - r * r), -.010, 5), mouthInside);
    const teeth = shape(s => {
      s.moveTo(-.194, .017); s.bezierCurveTo(-.076, -.008, .095, -.007, .200, .024);
      s.bezierCurveTo(.118, -.047, -.105, -.049, -.194, .017); s.closePath();
    }, .005, .003); teeth.translate(0, 0, .017);
    const toothPositions = teeth.getAttribute("position");
    for (let i = 0; i < toothPositions.count; i++) toothPositions.setZ(i, toothPositions.getZ(i) + .014 * (1 - (toothPositions.getX(i) / .215) ** 2));
    teeth.computeVertexNormals(); mesh(mouth, "booky-smile-teeth", teeth, white);
    const tongueOutline = new THREE.Shape();
    tongueOutline.moveTo(-.088, -.101);
    tongueOutline.bezierCurveTo(-.079, -.071, -.030, -.065, 0, -.083);
    tongueOutline.bezierCurveTo(.030, -.065, .079, -.071, .088, -.101);
    tongueOutline.bezierCurveTo(.084, -.152, -.080, -.152, -.088, -.101); tongueOutline.closePath();
    const tongueGeometry = sculptedSolid(tongueOutline, [0, -.113], r => .031 + .023 * Math.sqrt(Math.max(0, 1 - r * r)), .012, 6);
    const tongueVertices = tongueGeometry.getAttribute("position");
    for (let i = 0; i < tongueVertices.count; i++) tongueVertices.setXYZ(i, tongueVertices.getX(i) * 1.18, -.113 + (tongueVertices.getY(i) + .113) * 1.10, tongueVertices.getZ(i));
    tongueGeometry.computeVertexNormals(); mesh(mouth, "booky-smile-tongue", tongueGeometry, tonguePink);


    const leftArm = node(body, "booky-left-arm", [-.551, -.21, .020]);
    mesh(leftArm, "booky-left-sleeve", sweep([[0, 0, 0], [-.090, -.100, .040], [-.165, -.150, .108], [-.214, -.158, .158]],
      [.069, .061, .064, .068], 24, 12), leather);
    const leftHand = node(leftArm, "booky-left-hand", [-.265, -.148, .158]); leftHand.rotation.z = -.20;
    leftHand.scale.set(1.19, 1.10, 1.08);
    mesh(leftHand, "booky-left-open-glove", own(createBookyGloveGeometry("open")), gloveFinish);
    const leftCuff = torus(.068, .018, [0, 0, 0]);
    leftCuff.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, -.03, .2).normalize()));
    leftCuff.translate(.028, 0, -.001); mesh(leftHand, "booky-left-cuff", leftCuff, white);

    const rightArm = node(body, "booky-right-arm", [.551, -.21, .020]);
    // The complete wrist/grip/loupe rests nearer the front board; a small
    // outboard component accompanies that real depth change. The sleeve is
    // rebuilt to this cuff, with the same physical shoulder and runtime axes.
    // The unchanged frame/eye and real foreground guards must judge this rest.
    const rightHand = node(rightArm, "booky-right-hand", [.422, -.047, .200]); rightHand.rotation.z = .12;
    const wristCenter = new THREE.Vector3(...BOOKY_GRIP_WRIST.center).applyQuaternion(rightHand.quaternion).add(rightHand.position);
    const wristTangent = new THREE.Vector3(...BOOKY_GRIP_WRIST.normal).normalize().applyQuaternion(rightHand.quaternion);
    const sleeveMiddle = wristCenter.clone().multiplyScalar(.32), sleeveApproach = wristCenter.clone().addScaledVector(wristTangent, -.125);
    const sleevePath = new THREE.CubicBezierCurve3(new THREE.Vector3(), sleeveMiddle, sleeveApproach, wristCenter);
    mesh(rightArm, "booky-right-sleeve", sweep([[0, 0, 0], wristCenter.toArray() as unknown as Point],
      [.069, .062, .063, .065], 24, 12, false, sleevePath), leather);
    mesh(rightHand, "booky-right-grip-glove", own(createBookyGloveGeometry("grip")), gloveFinish);
    const rightCuff = torus(.063, .017, [0, 0, 0]);
    rightCuff.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(...BOOKY_GRIP_WRIST.normal).normalize()));
    rightCuff.translate(...BOOKY_GRIP_WRIST.center); mesh(rightHand, "booky-right-cuff", rightCuff, white);
    const magnifier = node(rightHand, "booky-magnifier", BOOKY_GRIP_SHAFT.position); magnifier.rotation.z = BOOKY_GRIP_SHAFT.rotationZ; magnifier.scale.set(1.00, 1.00, 1);
    mesh(magnifier, "booky-magnifier-handle", sweep([[0, BOOKY_GRIP_SHAFT.startY, BOOKY_GRIP_SHAFT.axisZ], [0, BOOKY_GRIP_SHAFT.middleY, BOOKY_GRIP_SHAFT.axisZ], [0, BOOKY_GRIP_SHAFT.endY, BOOKY_GRIP_SHAFT.axisZ]],
      BOOKY_GRIP_SHAFT.radii, 16, 12), darkGreen);
    const rimProfile = [[.274, -.013], [.299, -.023], [.314, -.008], [.316, .022], [.309, .057],
      [.298, .075], [.284, .078], [.274, .060], [.272, .040], [.274, -.013]];
    const rim = own(new THREE.LatheGeometry(rimProfile.map(([radius, depth]) => new THREE.Vector2(radius, depth)), 64));
    rim.rotateX(Math.PI / 2); rim.translate(0, .510, 0);
    const frameParts: THREE.BufferGeometry[] = [rim];
    for (const y of [-.236, .211, .239]) frameParts.push(torus(.038, .012, [0, y, .018], [Math.PI / 2, 0, 0]));
    fused(magnifier, "booky-magnifier-gold-frame", frameParts, gold);
    const lensGeometry = own(new THREE.SphereGeometry(1, 32, 20));
    lensGeometry.scale(.273, .273, .074); lensGeometry.translate(0, .510, .018);
    // Reflect and refract the renderer-owned environment on the actual curved
    // dielectric surface. Direct specular lights remain physical. This is a
    // single-pass environment approximation, not opaque-scene transmission.
    // No separate reflection decals or extra environment resource is owned.
    glass.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace("#include <opaque_fragment>", "\n        vec3 bookyGlassView = isOrthographic ? vec3(0.0, 0.0, 1.0) : normalize(vViewPosition);\n        vec3 bookyGlassNormal = normalize(normal);\n        float bookyGlassFacing = clamp(abs(dot(bookyGlassNormal, bookyGlassView)), 0.0, 1.0);\n        float bookyGlassF0 = pow((1.48 - 1.0) / (1.48 + 1.0), 2.0);\n        float bookyGlassFresnel = bookyGlassF0 + (1.0 - bookyGlassF0) * pow(1.0 - bookyGlassFacing, 5.0);\n        outgoingLight = reflectedLight.directSpecular;\n        #ifdef ENVMAP_TYPE_CUBE_UV\n          vec3 bookyReflectionDirection = inverseTransformDirection(reflect(-bookyGlassView, bookyGlassNormal), viewMatrix);\n          vec3 bookyRefractionDirection = inverseTransformDirection(refract(-bookyGlassView, bookyGlassNormal, 1.0 / 1.48), viewMatrix);\n          vec3 bookyReflected = textureCubeUV(envMap, bookyReflectionDirection, roughnessFactor).rgb * envMapIntensity;\n          vec3 bookyTransmitted = textureCubeUV(envMap, bookyRefractionDirection, roughnessFactor).rgb * envMapIntensity;\n          float bookyGlassPath = 0.148 / max(bookyGlassFacing, 0.20);\n          vec3 bookyAbsorption = exp(-vec3(0.80, 0.20, 0.10) * bookyGlassPath);\n          outgoingLight += mix(bookyTransmitted * bookyAbsorption, bookyReflected, bookyGlassFresnel);\n        #endif\n        diffuseColor.a = 0.12 + 0.86 * bookyGlassFresnel;\n        #include <opaque_fragment>\n");
    };
    glass.customProgramCacheKey = () => "booky-dielectric-environment-glass-v1";
    const lens = mesh(magnifier, "booky-magnifier-lens", lensGeometry, glass); lens.renderOrder = 1;
    for (const [index, foot] of feet.entries()) {
      for (const child of foot.children) child.scale.set(index === 0 ? 1.18 : 1.24, index === 0 ? 1.02 : .94, 1.21);
    }

    const rig: BookyRig = Object.freeze({ body, frontCover, bookmark, leftArm, rightArm,
      leftLeg: legs[0], rightLeg: legs[1], leftFoot: feet[0], rightFoot: feet[1],
      eyes: Object.freeze(eyes) as unknown as readonly [THREE.Group, THREE.Group],
      upperLids: Object.freeze(upperLids) as unknown as readonly [THREE.Group, THREE.Group],
      pupils: Object.freeze(pupils) as unknown as readonly [THREE.Group, THREE.Group],
      brows: Object.freeze(brows) as unknown as readonly [THREE.Group, THREE.Group], mouth, setEyelidClosure });
    group.updateMatrixWorld(true);
    return Object.freeze({ group, rig, dispose });
  } catch (error) { dispose(); throw error; }
}
