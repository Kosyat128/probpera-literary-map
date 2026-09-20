import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

export interface BookyRig {
  readonly body: THREE.Group;
  readonly frontCover: THREE.Group;
  readonly bookmark: THREE.Group;
  readonly leftArm: THREE.Group;
  readonly rightArm: THREE.Group;
  readonly eyes: readonly [THREE.Group, THREE.Group];
  readonly pupils: readonly [THREE.Group, THREE.Group];
  readonly brows: readonly [THREE.Group, THREE.Group];
  readonly mouth: THREE.Group;
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
  const group = new THREE.Group(); group.name = "booky-model";
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
    const size = 128, height = new Float32Array(size * size);
    const noise = (x: number, y: number, period: number) => {
      const hash = (a: number, b: number) => {
        let n = Math.imul((a + period) % period + 19, 374761393)
          ^ Math.imul((b + period) % period + 73, 668265263);
        n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
      };
      const ix = Math.floor(x), iy = Math.floor(y);
      const smooth = (v: number) => v * v * (3 - 2 * v);
      const fx = smooth(x - ix), fy = smooth(y - iy);
      return THREE.MathUtils.lerp(THREE.MathUtils.lerp(hash(ix, iy), hash(ix + 1, iy), fx),
        THREE.MathUtils.lerp(hash(ix, iy + 1), hash(ix + 1, iy + 1), fx), fy);
    };
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      height[y * size + x] = .56 * noise(x / 8, y / 8, 16)
        + .31 * noise(x / 4, y / 4, 32) + .13 * noise(x / 2, y / 2, 64);
    }
    const albedo = new Uint8Array(size * size * 4), roughness = new Uint8Array(albedo.length), normal = new Uint8Array(albedo.length);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const at = (u: number, v: number) => height[((v + size) % size) * size + (u + size) % size];
      const h = at(x, y), offset = (y * size + x) * 4;
      const tone = Math.round(239 + h * 12), matte = Math.round(204 + h * 24);
      albedo.set([tone, tone, tone, 255], offset); roughness.set([255, matte, 255, 255], offset);
      const direction = new THREE.Vector3((at(x - 1, y) - at(x + 1, y)) * .7,
        (at(x, y - 1) - at(x, y + 1)) * .7, 1).normalize();
      normal.set([Math.round((direction.x * .5 + .5) * 255), Math.round((direction.y * .5 + .5) * 255),
        Math.round((direction.z * .5 + .5) * 255), 255], offset);
    }
    const texture = (name: string, data: Uint8Array, srgb = false) => {
      const value = new THREE.DataTexture(data, size, size);
      value.name = name; value.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
      value.wrapS = value.wrapT = THREE.RepeatWrapping; value.magFilter = THREE.LinearFilter;
      value.repeat.set(4, 4);
      value.minFilter = THREE.LinearMipmapLinearFilter; value.generateMipmaps = true;
      value.userData.provenance = "authored-in-project"; value.needsUpdate = true;
      textures.add(value); return value;
    };
    const leather = finish(new THREE.MeshPhysicalMaterial({ color: "#43875b", roughness: .74,
      map: texture("booky-leather-albedo", albedo, true), roughnessMap: texture("booky-leather-roughness", roughness),
      normalMap: texture("booky-leather-normal", normal), normalScale: new THREE.Vector2(.24, .24),
      clearcoat: .12, clearcoatRoughness: .55 })); leather.name = "booky-sage-leather";
    const darkGreen = finish(leather.clone()); darkGreen.color.set("#245f43"); darkGreen.name = "booky-emerald-binding";
    const frontGreen = finish(leather.clone()); frontGreen.color.set("#518c61"); frontGreen.name = "booky-sage-front";
    const ivory = finish(new THREE.MeshStandardMaterial({ color: "#eee2c8", roughness: .79 })); ivory.name = "booky-ivory-paper";
    const leafEdge = finish(new THREE.MeshStandardMaterial({ color: "#fff4dc", roughness: .68 }));
    const gold = finish(new THREE.MeshStandardMaterial({ color: "#d6b469", metalness: .75, roughness: .36, envMapIntensity: .55 })); gold.name = "booky-gilt";
    const white = finish(new THREE.MeshPhysicalMaterial({ color: "#fff4e5", roughness: .61, clearcoat: .06, envMapIntensity: .25 })); white.name = "booky-soft-glove";
    const purple = finish(new THREE.MeshPhysicalMaterial({ color: "#8146a7", roughness: .70, clearcoat: .03 }));
    const brown = finish(new THREE.MeshStandardMaterial({ color: "#3b271f", roughness: .59 }));
    // Readable dark pupils remain dark under the renderer's broad environment.
    // Only the small authored catchlights are white, never the whole pupil.
    const pupilInk = finish(new THREE.MeshStandardMaterial({ color: "#090b10", roughness: .56, envMapIntensity: .08 }));
    const eyeWhite = finish(new THREE.MeshPhysicalMaterial({ color: "#fff4e2", roughness: .56, clearcoat: .04, envMapIntensity: .12 }));
    const sparkle = finish(new THREE.MeshStandardMaterial({ color: "#fffcf4", roughness: .46,
      emissive: "#fff5e6", emissiveIntensity: .06, envMapIntensity: .1 }));
    const mouthInside = finish(new THREE.MeshStandardMaterial({ color: "#50332f", roughness: .78 }));
    const tonguePink = finish(new THREE.MeshStandardMaterial({ color: "#c9817e", roughness: .66 }));
    const irisFinish = finish(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: .53, clearcoat: .08, envMapIntensity: .20 }));
    const glass = finish(new THREE.MeshPhysicalMaterial({ color: "#cee4e4", transparent: true, opacity: .16,
      roughness: .18, metalness: 0, clearcoat: .15, clearcoatRoughness: .35, envMapIntensity: .16, depthWrite: false })); glass.name = "booky-magnifying-glass";
    const glassGlint = finish(new THREE.MeshBasicMaterial({ color: "#f1fdff", transparent: true, opacity: .54, depthWrite: false }));

    const sphere = own(new THREE.SphereGeometry(1, 24, 16));
    const transformed = (source: THREE.BufferGeometry, position: Point, scale: Point = [1, 1, 1], rotation: Point = [0, 0, 0]) => {
      const geometry = own(source.clone());
      geometry.scale(...scale); geometry.rotateX(rotation[0]); geometry.rotateY(rotation[1]); geometry.rotateZ(rotation[2]);
      geometry.translate(...position); return geometry;
    };
    const ellipsoid = (position: Point, scale: Point) => transformed(sphere, position, scale);
    const box = (width: number, height: number, depth: number, radius: number, position: Point) => {
      const value = own(new RoundedBoxGeometry(width, height, depth, 2, radius)); value.translate(...position); return value;
    };
    const torus = (radius: number, tube: number, position: Point, rotation: Point = [0, 0, 0]) => {
      const geometry = own(new THREE.TorusGeometry(radius, tube, 8, 48));
      geometry.rotateX(rotation[0]); geometry.rotateY(rotation[1]); geometry.rotateZ(rotation[2]); geometry.translate(...position); return geometry;
    };
    // A capped variable-radius organic loft. Unlike TubeGeometry it has actual
    // end faces, so glove digits and sleeves remain closed when articulated.
    const sweep = (points: readonly Point[], radii: readonly number[], steps = 20, radial = 10) => {
      const path = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), false, "centripetal");
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
      const stride = radial + 1;
      for (let row = 0; row < steps; row++) for (let col = 0; col < radial; col++) {
        const a = row * stride + col, b = a + 1, c = a + stride, d = c + 1;
        indices.push(a, b, c, b, d, c);
      }
      const start = positions.length / 3, end = start + 1;
      positions.push(...points[0], ...points[points.length - 1]); uvs.push(.5, 0, .5, 1);
      for (let col = 0; col < radial; col++) {
        indices.push(start, col + 1, col);
        const a = steps * stride + col; indices.push(end, a, a + 1);
      }
      const result = own(new THREE.BufferGeometry());
      result.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      result.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)); result.setIndex(indices); result.computeVertexNormals();
      const normals = result.getAttribute("normal"), sum = new THREE.Vector3();
      for (let row = 0; row <= steps; row++) {
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
    const body = node(group, "booky-body");
    const frontCover = node(body, "booky-front-cover", [-.56, 0, .18]);
    const facePosition = (x: number, y: number, z: number): Point => [x + .56, y, z - .18];
    mesh(frontCover, "booky-front-hardcover", roundedCover(1.21, 1.61, .066, .125, .018, [.56, 0, .014]), leather);
    mesh(frontCover, "booky-front-embossed-panel", roundedCover(1.075, 1.455, .012, .115, .009, [.574, 0, .063]), frontGreen);
    const bindingParts: THREE.BufferGeometry[] = [roundedCover(1.21, 1.61, .066, .125, .018, [0, 0, -.195])];
    // A complete rounded leather back joins both boards. Its flush tooling
    // follows this same surface, rather than standing away like binder rings.
    const spineProfile = new THREE.Shape();
    spineProfile.moveTo(0, -.214);
    spineProfile.absarc(0, 0, .214, -Math.PI / 2, -Math.PI * 1.5, true);
    spineProfile.closePath();
    const spine = own(new THREE.ExtrudeGeometry(spineProfile, { depth: 1.55, bevelEnabled: true,
      bevelSize: .009, bevelThickness: .013, bevelSegments: 4, curveSegments: 28, steps: 1 }));
    spine.rotateX(Math.PI / 2); spine.translate(-.569, .775, 0); bindingParts.push(spine);
    mesh(body, "booky-page-block", box(1.04, 1.56, .298, .018, [.025, 0, -.004]), ivory);
    const pageParts: THREE.BufferGeometry[] = [];
    for (let index = 0; index < 28; index++) {
      const z = -.144 + index / 27 * .284;
      const inset = .0015 * Math.sin(index * 2.17);
      const leaf = own(new RoundedBoxGeometry(1.045 + inset, 1.562 + inset, .003, 1, .001));
      leaf.translate(.025 + inset, 0, z); pageParts.push(leaf);
    }
    fused(body, "booky-layered-leaf-edges", pageParts, leafEdge);
    const gilding: THREE.BufferGeometry[] = [];
    for (const y of [-.68, -.57, -.17, .28, .67]) {
      const band = own(new THREE.CylinderGeometry(.224, .224, .022, 48, 1, true, Math.PI, Math.PI));
      band.translate(-.569, y, 0); gilding.push(band);
    }
    // Straight tooling joins four tangent quarter curves; unlike a spline
    // through corner samples this never overshoots into bent-wire hooks.
    const borderPath = new THREE.CurvePath<THREE.Vector3>();
    const corner = .080, bx = .494, by = .682;
    const bp = (x: number, y: number) => new THREE.Vector3(x + .574, y, .079);
    const line = (ax: number, ay: number, cx: number, cy: number) => borderPath.add(new THREE.LineCurve3(bp(ax, ay), bp(cx, cy)));
    const arc = (ax: number, ay: number, mx: number, my: number, cx: number, cy: number) =>
      borderPath.add(new THREE.QuadraticBezierCurve3(bp(ax, ay), bp(mx, my), bp(cx, cy)));
    line(-bx + corner, -by, bx - corner, -by); arc(bx - corner, -by, bx, -by, bx, -by + corner);
    line(bx, -by + corner, bx, by - corner); arc(bx, by - corner, bx, by, bx - corner, by);
    line(bx - corner, by, -bx + corner, by); arc(-bx + corner, by, -bx, by, -bx, by - corner);
    line(-bx, by - corner, -bx, -by + corner); arc(-bx, -by + corner, -bx, -by, -bx + corner, -by);
    const border = own(new THREE.TubeGeometry(borderPath, 128, .0055, 6, true));
    mesh(frontCover, "booky-gold-cover-tooling", border, gold);

    const bookmark = node(body, "booky-bookmark", [-.40, .754, 0]);
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

    const legParts: THREE.BufferGeometry[] = [], shoeWhite: THREE.BufferGeometry[] = [];
    const shoeSole = (x: number) => {
      const levels = [[-.040, .87], [-.032, .97], [-.018, 1], [.017, 1], [.031, .97], [.038, .89]];
      const columns = 40, stride = columns + 1, positions: number[] = [], uvs: number[] = [], indices: number[] = [];
      for (const [y, scale] of levels) for (let col = 0; col <= columns; col++) {
        const a = col === columns ? 0 : col / columns * TAU, toe = Math.sin(a);
        positions.push(x + Math.cos(a) * .162 * scale * (.96 + .055 * toe), -1.189 + y,
          .117 + toe * .227 * scale); uvs.push(col / columns, (y + .04) / .078);
      }
      for (let row = 0; row < levels.length - 1; row++) for (let col = 0; col < columns; col++) {
        const a = row * stride + col, b = a + stride, c = a + 1;
        indices.push(a, b, c, b, b + 1, c);
      }
      const bottom = positions.length / 3, top = bottom + 1, last = (levels.length - 1) * stride;
      positions.push(x, -1.229, .117, x, -1.151, .117); uvs.push(.5, 0, .5, 1);
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
    for (const x of [-.24, .24]) {
      legParts.push(sweep([[x, -.73, 0], [x * .95, -.93, .035], [x, -1.08, .07]], [.052, .053, .064], 14, 10));
      bindingParts.push(ellipsoid([x, -1.098, .103], [.147, .128, .198]),
        ellipsoid([x, -1.063, -.007], [.085, .105, .087]));
      shoeWhite.push(shoeSole(x), ellipsoid([x, -1.111, .235], [.143, .096, .113]));
      shoeWhite.push(torus(.078, .018, [x, -1.002, -.004], [Math.PI / 2, 0, 0]));
      for (const z of [.119, .174]) {
        const top = (dx: number) => -1.098 + .128 * Math.sqrt(1 - (dx / .147) ** 2 - ((z - .103) / .198) ** 2) + .006;
        gilding.push(sweep([[x - .070, top(-.070), z], [x, top(0), z], [x + .070, top(.070), z]], [.011, .008, .011], 14, 8));
      }
    }
    fused(body, "booky-bound-spine-and-shoes", bindingParts, darkGreen);
    fused(body, "booky-legs", legParts, leather);
    fused(body, "booky-shoe-soles-and-caps", shoeWhite, white);
    fused(body, "booky-spine-bands-and-shoe-laces", gilding, gold);

    const irisGeometry = () => {
      const positions: number[] = [0, 0, .006], colors: number[] = [], uvs: number[] = [.5, .5], indices: number[] = [];
      const rows = 7, columns = 64, color = new THREE.Color();
      color.set("#583085"); colors.push(color.r, color.g, color.b);
      for (let row = 1; row <= rows; row++) for (let col = 0; col <= columns; col++) {
        const r = row / rows, a = (col === columns ? 0 : col / columns) * TAU;
        positions.push(Math.cos(a) * r, Math.sin(a) * r, .006 * Math.sqrt(Math.max(0, 1 - r * r)));
        uvs.push(Math.cos(a) * r * .5 + .5, Math.sin(a) * r * .5 + .5);
        const fiber = Math.sin(a * 31 + r * 7) * .5 + Math.sin(a * 19 - r * 4) * .3;
        color.setHSL(.755 + fiber * .012, .40, .30 + Math.sin(r * Math.PI) * .12 + fiber * .016);
        if (row === rows) color.multiplyScalar(.72);
        colors.push(color.r, color.g, color.b);
      }
      for (let col = 0; col < columns; col++) indices.push(0, 1 + col, 2 + col);
      const stride = columns + 1;
      for (let row = 0; row < rows - 1; row++) for (let col = 0; col < columns; col++) {
        const a = 1 + row * stride + col, b = a + 1, c = a + stride, d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
      const back = positions.length / 3; positions.push(0, 0, -.004); uvs.push(.5, .5); colors.push(color.r, color.g, color.b);
      const last = 1 + (rows - 1) * stride;
      for (let col = 0; col < columns; col++) indices.push(back, last + col + 1, last + col);
      const result = own(new THREE.BufferGeometry());
      result.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      result.setAttribute("normal", new THREE.Float32BufferAttribute(new Float32Array(positions.length), 3));
      result.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
      result.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3)); result.setIndex(indices); result.computeVertexNormals();
      return result;
    };
    const iris = irisGeometry(), eyes: THREE.Group[] = [], pupils: THREE.Group[] = [], brows: THREE.Group[] = [];
    const browShape = shape(s => {
      s.moveTo(-.156, -.005); s.bezierCurveTo(-.084, .110, .092, .099, .154, .011);
      s.bezierCurveTo(.073, .054, -.035, .048, -.156, -.005); s.closePath();
    }, .022, .010);
    for (const [side, x] of [["left", -.235], ["right", .235]] as const) {
      const eye = node(frontCover, `booky-eye-${side}`, facePosition(x, .233, .274)); eyes.push(eye);
      mesh(eye, `booky-eye-socket-${side}`, ellipsoid([0, .001, -.011], [.202, .234, .035]), frontGreen);
      mesh(eye, `booky-sclera-${side}`, ellipsoid([0, 0, 0], [.193, .222, .043]), eyeWhite);
      const pupil = node(eye, `booky-pupil-${side}`, [.008, -.009, .046]); pupils.push(pupil);
      const colored = mesh(pupil, `booky-iris-${side}`, iris, irisFinish); colored.scale.set(.112, .141, 1);
      mesh(pupil, `booky-pupil-ink-${side}`, ellipsoid([0, 0, .007], [.088, .112, .009]), pupilInk);
      fused(pupil, `booky-eye-catchlights-${side}`, [ellipsoid([-.030, .052, .016], [.014, .019, .005]),
        ellipsoid([.037, -.041, .014], [.005, .006, .003])], sparkle);
      const brow = node(frontCover, `booky-brow-${side}`, facePosition(x, side === "left" ? .514 : .527, .270)); brows.push(brow);
      const browMesh = mesh(brow, `booky-sculpted-brow-${side}`, browShape, brown);
      browMesh.rotation.z = side === "left" ? .075 : -.06;
    }
    mesh(frontCover, "booky-soft-nose", ellipsoid(facePosition(.008, -.050, .271), [.049, .033, .021]), frontGreen);
    const mouth = node(frontCover, "booky-mouth", facePosition(0, -.274, .267));
    mesh(mouth, "booky-smile-cavity", shape(s => {
      s.moveTo(-.252, .033); s.bezierCurveTo(-.103, -.013, .102, -.003, .258, .066);
      s.bezierCurveTo(.145, -.245, -.150, -.252, -.252, .033); s.closePath();
    }, .010, .006), mouthInside);
    const teeth = shape(s => {
      s.moveTo(-.207, .020); s.bezierCurveTo(-.076, -.011, .099, .004, .216, .042);
      s.bezierCurveTo(.124, -.026, -.102, -.050, -.207, .020); s.closePath();
    }, .005, .003); teeth.translate(0, 0, .017); mesh(mouth, "booky-smile-teeth", teeth, white);
    fused(mouth, "booky-smile-tongue", [ellipsoid([-.029, -.139, .020], [.064, .038, .009]),
      ellipsoid([.029, -.139, .020], [.064, .038, .009])], tonguePink);
    mesh(mouth, "booky-lower-lip", sweep([[-.245, .031, .001], [-.117, -.167, .004], [.083, -.161, .006], [.248, .061, .002]],
      [.004, .008, .008, .004], 30, 8), frontGreen);

    const leftArm = node(body, "booky-left-arm", [-.551, -.21, .020]);
    mesh(leftArm, "booky-left-sleeve", sweep([[0, 0, 0], [-.11, -.058, .042], [-.235, -.047, .134], [-.285, -.025, .16]],
      [.069, .063, .071, .072], 24, 12), leather);
    const leftPalm: THREE.BufferGeometry[] = [ellipsoid([-.354, -.042, .176], [.137, .137, .080])];
    for (let digit = 0; digit < 3; digit++) {
      const y = -.122 + digit * .081, length = [.070, .103, .088][digit];
      leftPalm.push(sweep([[-.396, y, .190], [-.452, y - .005, .212], [-.443 - length, y + .014, .202]],
        [.047, .048, .028], 12, 10));
    }
    leftPalm.push(sweep([[-.290, .012, .192], [-.303, .109, .214], [-.370, .147, .214]], [.058, .052, .032], 14, 10));
    fused(leftArm, "booky-left-open-glove", leftPalm, white);
    const leftCuff = torus(.074, .018, [0, 0, 0]);
    leftCuff.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, .15, .30).normalize()));
    leftCuff.translate(-.277, -.029, .152); mesh(leftArm, "booky-left-cuff", leftCuff, white);

    const rightArm = node(body, "booky-right-arm", [.551, -.21, .020]);
    mesh(rightArm, "booky-right-sleeve", sweep([[0, 0, 0], [.085, -.085, .049], [.219, -.025, .133], [.283, .046, .191]],
      [.069, .063, .069, .073], 24, 12), leather);
    const rightPalm: THREE.BufferGeometry[] = [ellipsoid([.321, .087, .218], [.123, .145, .084])];
    for (let digit = 0; digit < 3; digit++) {
      const y = -.018 + digit * .083;
      rightPalm.push(sweep([[.301, y, .254], [.383, y + .012, .291], [.416, y + .043, .265]], [.047, .049, .029], 12, 10));
    }
    rightPalm.push(sweep([[.249, .081, .256], [.238, .188, .278], [.312, .213, .290]], [.056, .053, .031], 14, 10));
    fused(rightArm, "booky-right-grip-glove", rightPalm, white);
    const rightCuff = torus(.074, .018, [0, 0, 0]);
    rightCuff.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(.7, .65, .6).normalize()));
    rightCuff.translate(.280, .041, .186); mesh(rightArm, "booky-right-cuff", rightCuff, white);
    const magnifier = node(rightArm, "booky-magnifier", [.36, .10, .215]); magnifier.rotation.z = .15;
    mesh(magnifier, "booky-magnifier-handle", sweep([[0, -.205, .018], [0, .080, .018], [0, .375, .018]],
      [.039, .035, .032], 16, 12), darkGreen);
    const lensCenter: Point = [0, .664, .018];
    const frameParts = [torus(.274, .021, [0, .664, .046]), torus(.274, .018, [0, .664, -.009])];
    for (const y of [-.191, .337, .371]) frameParts.push(torus(.038, .012, [0, y, .018], [Math.PI / 2, 0, 0]));
    fused(magnifier, "booky-magnifier-gold-frame", frameParts, gold);
    const lens = mesh(magnifier, "booky-magnifier-lens", ellipsoid(lensCenter, [.260, .260, .027]), glass); lens.renderOrder = 1;
    const reflection = sweep([[-.183, .741, .040], [-.170, .817, .041], [-.112, .857, .040]], [.008, .017, .007], 14, 8);
    mesh(magnifier, "booky-magnifier-highlight", reflection, glassGlint).renderOrder = 2;

    const rig: BookyRig = Object.freeze({ body, frontCover, bookmark, leftArm, rightArm,
      eyes: Object.freeze(eyes) as unknown as readonly [THREE.Group, THREE.Group],
      pupils: Object.freeze(pupils) as unknown as readonly [THREE.Group, THREE.Group],
      brows: Object.freeze(brows) as unknown as readonly [THREE.Group, THREE.Group], mouth });
    group.updateMatrixWorld(true);
    return Object.freeze({ group, rig, dispose });
  } catch (error) { dispose(); throw error; }
}
