import * as THREE from "three";

type Point = readonly [number, number, number];
const TAU = Math.PI * 2;

/** Both the sewn grip and the prop use this physical shaft frame. */
export const BOOKY_GRIP_SHAFT = Object.freeze({
  position: [.085, .075, .025] as Point,
  rotationZ: .12,
  axisZ: .018,
  startY: -.250, middleY: .065, endY: .236,
  radii: [.039, .035, .032] as const,
});
// The short wrist shares the shaft's transverse section plane. Moving this
// internal cuff frame also rebuilds its green sleeve, without moving the hand.
const wristYaw = BOOKY_GRIP_SHAFT.rotationZ;
const wristNativeCenter = [-.214, -.099375, BOOKY_GRIP_SHAFT.axisZ] as const;
export const BOOKY_GRIP_WRIST = Object.freeze({
  center: [BOOKY_GRIP_SHAFT.position[0] + Math.cos(wristYaw) * wristNativeCenter[0] - Math.sin(wristYaw) * wristNativeCenter[1],
    BOOKY_GRIP_SHAFT.position[1] + Math.sin(wristYaw) * wristNativeCenter[0] + Math.cos(wristYaw) * wristNativeCenter[1],
    BOOKY_GRIP_SHAFT.position[2] + wristNativeCenter[2]] as Point,
  normal: [Math.cos(wristYaw), Math.sin(wristYaw), 0] as Point,
});

function geometry(points: THREE.Vector3[], triangles: number[], topology: string) {
  // Removed wrist-patch interiors do not survive as unused bounds/normal data.
  const remap = new Map<number, number>(), used: THREE.Vector3[] = [];
  const indices = triangles.map(id => {
    let next = remap.get(id);
    if (next === undefined) { next = used.length; remap.set(id, next); used.push(points[id]); }
    return next;
  });
  const result = new THREE.BufferGeometry();
  result.setAttribute("position", new THREE.Float32BufferAttribute(used.flatMap(p => [p.x, p.y, p.z]), 3));
  result.setAttribute("uv", new THREE.Float32BufferAttribute(used.flatMap(p => [p.x + .5, p.y + .5]), 2));
  result.setIndex(indices); result.computeVertexNormals(); result.computeBoundingBox(); result.computeBoundingSphere();
  result.userData.topology = topology;
  return result;
}

/** Farthest forward intersection with a genuine round swept segment. This is
 * used to construct skin, never to add overlapping finger meshes. */
function capsuleExit(origin: THREE.Vector3, direction: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3, radius: number) {
  const ba = b.clone().sub(a), oa = origin.clone().sub(a), length2 = ba.lengthSq();
  const along = ba.dot(direction), location = ba.dot(oa);
  const aa = length2 - along * along, bb = length2 * oa.dot(direction) - location * along;
  const cc = length2 * (oa.lengthSq() - radius * radius) - location * location;
  let result = 0;
  if (aa > 1e-12) {
    const discriminant = bb * bb - aa * cc;
    if (discriminant >= 0) for (const sign of [-1, 1]) {
      const distance = (-bb + sign * Math.sqrt(discriminant)) / aa, u = location + distance * along;
      if (distance > 0 && u >= 0 && u <= length2) result = Math.max(result, distance);
    }
  }
  for (const center of [a, b]) {
    const delta = origin.clone().sub(center), projection = delta.dot(direction);
    const discriminant = projection * projection - delta.lengthSq() + radius * radius;
    if (discriminant >= 0) result = Math.max(result, -projection + Math.sqrt(discriminant));
  }
  return result;
}
const softMaximum = (a: number, b: number, width: number) => Math.max(a, b) + Math.max(0, width - Math.abs(a - b)) ** 2 / (4 * width);

/** A full cupped palm and four bunched curved digits share one skin.
 * Each visible fingertip is the round end of a real spatial capsule chain;
 * the opposed raised thumb and short wrist have independent volume paths. */
function openHand() {
  const columns = 112, rows = 10, points: THREE.Vector3[] = [], triangles: number[] = [];
  const origin = new THREE.Vector3(), forward = new THREE.Vector3(0, 0, 1), backward = new THREE.Vector3(0, 0, -1);
  const paths = [
    { radius: .047, points: [[-.048, .036, .012], [-.115, .089, .039], [-.172, .121, .050]] },
    { radius: .047, points: [[-.065, -.035, .010], [-.131, -.093, .032], [-.171, -.128, .031]] },
    { radius: .048, points: [[-.034, -.050, .005], [-.093, -.123, .032], [-.126, -.172, .028]] },
    { radius: .046, points: [[.004, -.051, .001], [-.040, -.137, .028], [-.074, -.185, .020]] },
    { radius: .043, points: [[.040, -.041, -.003], [.005, -.126, .018], [-.024, -.173, .011]] },
    { radius: .052, points: [[.025, .005, -.012], [.082, .006, -.015]] },
  ].map(path => ({ radius: path.radius, points: path.points.map(p => new THREE.Vector3(...p as [number, number, number])) }));
  const segments = paths.flatMap(path => path.points.slice(1).map((b, index) => ({ a: path.points[index], b, radius: path.radius })));
  const outline = Array.from({ length: columns }, (_, col) => {
    const angle = col / columns * TAU, direction = new THREE.Vector3(Math.cos(angle), Math.sin(angle), 0);
    let radius = 1 / Math.sqrt((direction.x / .128) ** 2 + (direction.y / .116) ** 2);
    for (const segment of segments) {
      const a = segment.a.clone().setZ(0), b = segment.b.clone().setZ(0);
      radius = softMaximum(radius, capsuleExit(origin, direction, a, b, segment.radius), .007);
    }
    return radius;
  });
  const heights = (x: number, y: number, r: number) => {
    const palm = 1 - (x / .128) ** 2 - (y / .116) ** 2;
    let front = palm >= 0 ? .092 * Math.sqrt(palm) - .011 * Math.exp(-((x + .023) ** 2 + (y + .011) ** 2) / .0027) : -Infinity;
    let back = palm >= 0 ? -.075 * Math.sqrt(palm) : Infinity, edgeZ = 0, nearest = Infinity;
    for (const segment of segments) {
      const dx = segment.b.x - segment.a.x, dy = segment.b.y - segment.a.y;
      const t = THREE.MathUtils.clamp(((x - segment.a.x) * dx + (y - segment.a.y) * dy) / (dx * dx + dy * dy), 0, 1);
      const distance = Math.hypot(x - segment.a.x - t * dx, y - segment.a.y - t * dy) / segment.radius;
      if (distance < nearest) { nearest = distance; edgeZ = THREE.MathUtils.lerp(segment.a.z, segment.b.z, t); }
      const top = capsuleExit(new THREE.Vector3(x, y, -.5), forward, segment.a, segment.b, segment.radius);
      const bottom = capsuleExit(new THREE.Vector3(x, y, .5), backward, segment.a, segment.b, segment.radius);
      if (top > 0) front = Number.isFinite(front) ? softMaximum(front, top - .5, .007) : top - .5;
      if (bottom > 0) back = Number.isFinite(back) ? -softMaximum(-back, bottom - .5, .007) : .5 - bottom;
    }
    if (r === 1) return [edgeZ, edgeZ];
    const web = .013 * Math.sqrt(Math.max(0, 1 - r * r));
    return [Math.max(Number.isFinite(front) ? front : edgeZ, edgeZ + web), Math.min(Number.isFinite(back) ? back : edgeZ, edgeZ - web)];
  };
  const centerHeight = heights(0, 0, 0), frontCenter = points.push(new THREE.Vector3(-.085, -.020, centerHeight[0])) - 1;
  const backCenter = points.push(new THREE.Vector3(-.085, -.020, centerHeight[1])) - 1;
  const ring = (row: number, front: boolean) => Array.from({ length: columns }, (_, col) => {
    const angle = col / columns * TAU, r = row === rows ? 1 : Math.sin(row / rows * Math.PI / 2);
    const x = Math.cos(angle) * outline[col] * r, y = Math.sin(angle) * outline[col] * r;
    const z = heights(x, y, r)[front ? 0 : 1], id = points.length; points.push(new THREE.Vector3(-.085 + x, -.020 + y, z)); return id;
  });
  const front = Array.from({ length: rows }, (_, i) => ring(i + 1, true));
  const back = Array.from({ length: rows - 1 }, (_, i) => ring(i + 1, false)); back.push(front[rows - 1]);
  for (let col = 0; col < columns; col++) {
    const next = (col + 1) % columns;
    triangles.push(frontCenter, front[0][col], front[0][next], backCenter, back[0][next], back[0][col]);
    for (let row = 0; row < rows - 1; row++) {
      const a = front[row], b = front[row + 1], c = back[row], d = back[row + 1];
      triangles.push(a[col], b[col], b[next], a[col], b[next], a[next]);
      triangles.push(c[col], d[next], d[col], c[col], c[next], d[next]);
    }
  }
  return geometry(points, triangles, "closed volumetric cupped palm, four bunched spatial capsule digits and raised opposed thumb");
}

/** A real shaft lining remains fixed. Outside it the skin follows a rounded
 * heel and three curved capsule fingers, with a separate opposing thumb path.
 * Their continuous radial envelope joins the volumes without intersecting
 * roots. There is no cone taper or shallow bump-only finger approximation. */
function gripHand() {
  const rows = 28, columns = 60, points: THREE.Vector3[] = [], triangles: number[] = [];
  const frame = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), BOOKY_GRIP_SHAFT.rotationZ);
  const origin = new THREE.Vector3(...BOOKY_GRIP_SHAFT.position);
  const toHand = (p: THREE.Vector3) => p.applyQuaternion(frame).add(origin);
  const start = -.230, end = .155;
  const shaftRadius = (y: number) => {
    const t = (y - BOOKY_GRIP_SHAFT.startY) / (BOOKY_GRIP_SHAFT.endY - BOOKY_GRIP_SHAFT.startY), radii = BOOKY_GRIP_SHAFT.radii;
    return t < .5 ? THREE.MathUtils.lerp(radii[0], radii[1], t * 2) : THREE.MathUtils.lerp(radii[1], radii[2], t * 2 - 1);
  };
  const liningRadius = (y: number, phi: number) => {
    const sector = TAU / 12, middle = (Math.floor(phi / sector) + .5) * sector;
    return shaftRadius(y) * Math.cos(sector / 2) / Math.cos(phi - middle) + .0004;
  };
  const fingerArcs = [.091, -.004, -.099].map(centerY => Array.from({ length: 15 }, (_, i) => {
    const phi = -.75 + i / 14 * 2.95;
    return new THREE.Vector3(Math.cos(phi) * .069, centerY + .014 * Math.cos(phi - .65), BOOKY_GRIP_SHAFT.axisZ + Math.sin(phi) * .069);
  }));
  const roundedArcs = [.088, -.004, -.097].map((centerY, digit) => ({
    radius: [.047, .049, .046][digit],
    points: Array.from({ length: 15 }, (_, i) => {
      const phi = -.78 + i / 14 * 2.95, bend = .011 * Math.cos(phi - .65) + .005 * Math.sin(phi * 2);
      return new THREE.Vector3(Math.cos(phi) * [.070, .072, .070][digit], centerY + bend,
        BOOKY_GRIP_SHAFT.axisZ + Math.sin(phi) * .073);
    }),
  }));
  const thumb = [new THREE.Vector3(-.113, -.078, BOOKY_GRIP_SHAFT.axisZ + .012),
    new THREE.Vector3(-.112, -.030, BOOKY_GRIP_SHAFT.axisZ + .064),
    new THREE.Vector3(-.078, .031, BOOKY_GRIP_SHAFT.axisZ + .087)];
  const palmCenter = new THREE.Vector3(-.057, -.066, BOOKY_GRIP_SHAFT.axisZ - .015), palmAxes = new THREE.Vector3(.123, .154, .083);
  const palmExit = (origin: THREE.Vector3, direction: THREE.Vector3) => {
    const o = origin.clone().sub(palmCenter).divide(palmAxes), d = direction.clone().divide(palmAxes);
    const a = d.lengthSq(), b = o.dot(d), c = o.lengthSq() - 1, discriminant = b * b - a * c;
    return discriminant < 0 ? 0 : Math.max(0, (-b + Math.sqrt(discriminant)) / a);
  };
  const outer: number[][] = [];
  for (let row = 0; row <= rows; row++) {
    const y = THREE.MathUtils.lerp(start, end, row / rows), origin = new THREE.Vector3(0, y, BOOKY_GRIP_SHAFT.axisZ);
    outer.push(Array.from({ length: columns }, (_, col) => {
      const phi = col / columns * TAU, direction = new THREE.Vector3(Math.cos(phi), 0, Math.sin(phi));
      let radius = softMaximum(shaftRadius(y) + .0065, palmExit(origin, direction), .008);
      for (const arc of fingerArcs) {
        let finger = 0;
        for (let i = 0; i < arc.length - 1; i++) finger = Math.max(finger, capsuleExit(origin, direction, arc[i], arc[i + 1], .048));
        radius = softMaximum(radius, finger, .007);
      }
      let opposedThumb = 0;
      for (let i = 0; i < thumb.length - 1; i++) opposedThumb = Math.max(opposedThumb, capsuleExit(origin, direction, thumb[i], thumb[i + 1], i === 0 ? .047 : .043));
      radius = softMaximum(radius, opposedThumb, .007);
      // Preserve every proven side-entry/wrist vertex exactly. Away from that
      // sector the three real digit arcs have a fuller round knuckle envelope
      // and a softer continuous merge into the opposing thumb and heel.
      const wrap = THREE.MathUtils.smoothstep(Math.cos(phi), -.88, -.32);
      if (wrap > 0) {
        let rounded = softMaximum(shaftRadius(y) + .0065, palmExit(origin, direction), .010);
        for (const arc of roundedArcs) {
          let finger = 0;
          for (let i = 0; i < arc.points.length - 1; i++) finger = Math.max(finger, capsuleExit(origin, direction, arc.points[i], arc.points[i + 1], arc.radius));
          rounded = softMaximum(rounded, finger, .012);
        }
        rounded = softMaximum(rounded, opposedThumb, .014);
        radius = THREE.MathUtils.lerp(radius, rounded, wrap);
      }
      const id = points.length; points.push(toHand(origin.clone().addScaledVector(direction, radius))); return id;
    }));
  }
  // This side-entry opening replaces actual wall faces. Its single boundary is
  // lofted into the cuff; the contact lining remains continuous around the shaft.
  const patch = { row0: 5, row1: 14, col0: 26, col1: 34 };
  const removed: number[][] = [];
  for (let row = 0; row < rows; row++) for (let col = 0; col < columns; col++) {
    const next = (col + 1) % columns, face = [outer[row][col], outer[row + 1][col], outer[row + 1][next], outer[row][next]];
    if (row >= patch.row0 && row < patch.row1 && col >= patch.col0 && col < patch.col1) removed.push(face);
    else triangles.push(face[0], face[1], face[2], face[0], face[2], face[3]);
  }
  const middleY = (BOOKY_GRIP_SHAFT.startY + BOOKY_GRIP_SHAFT.endY) / 2;
  const inner = [start, middleY, end].map(y => Array.from({ length: columns }, (_, col) => {
    const phi = col / columns * TAU, radius = liningRadius(y, phi), id = points.length;
    points.push(toHand(new THREE.Vector3(Math.cos(phi) * radius, y, BOOKY_GRIP_SHAFT.axisZ + Math.sin(phi) * radius))); return id;
  }));
  for (let col = 0; col < columns; col++) {
    const next = (col + 1) % columns;
    for (let row = 0; row < inner.length - 1; row++) {
      const a = inner[row][col], b = inner[row + 1][col], c = inner[row + 1][next], d = inner[row][next];
      triangles.push(a, c, b, a, d, c);
    }
    const a = inner[0][col], d = inner[0][next], b = inner[2][col], c = inner[2][next];
    triangles.push(outer[0][col], outer[0][next], d, outer[0][col], d, a);
    triangles.push(outer[rows][col], b, c, outer[rows][col], c, outer[rows][next]);
  }
  const edges = new Map<string, { a: number; b: number; count: number }>();
  for (const face of removed) for (let i = 0; i < face.length; i++) {
    const a = face[i], b = face[(i + 1) % face.length], key = a < b ? a + ":" + b : b + ":" + a;
    const value = edges.get(key); if (value) value.count++; else edges.set(key, { a, b, count: 1 });
  }
  const links = new Map([...edges.values()].filter(edge => edge.count === 1).map(edge => [edge.a, edge.b]));
  const boundary: number[] = [], first = links.keys().next().value as number;
  let cursor = first;
  do { boundary.push(cursor); cursor = links.get(cursor)!; } while (cursor !== first && boundary.length <= links.size);
  if (boundary.length !== links.size) throw new Error("booky-grip-wrist-boundary");
  // Keep the sewn boundary's actual cyclic order in the native shaft YZ plane.
  // Every next section contracts the same rays. Its polygon is nested inside
  // the preceding one, so each belt is a single-valued skin over that annulus.
  // Independent angles on a tilted cuff and crossing per-vertex Hermite rails
  // are deliberately absent from this construction.
  const inverseFrame = frame.clone().invert(), cuff = new THREE.Vector3(...wristNativeCenter);
  const wristRadius = .051, capX = cuff.x - .016, epsilon = 1e-8;
  const rails = boundary.map(id => {
    const first = points[id].clone().sub(origin).applyQuaternion(inverseFrame);
    const transverse = new THREE.Vector2(first.y - cuff.y, cuff.z - first.z), radius = transverse.length();
    if (!(radius > wristRadius + epsilon && first.x > capX + epsilon)) throw new Error("booky-grip-wrist-section");
    return { first, radius, direction: transverse.divideScalar(radius) };
  });
  let winding = 0;
  for (let i = 0; i < rails.length; i++) {
    const a = rails[i].direction, b = rails[(i + 1) % rails.length].direction;
    const cross = a.x * b.y - a.y * b.x;
    if (!(cross > epsilon)) throw new Error("booky-grip-wrist-order");
    winding += Math.atan2(cross, a.dot(b));
  }
  if (Math.abs(winding - TAU) > 1e-6) throw new Error("booky-grip-wrist-winding");
  let previous = boundary;
  for (let step = 1; step <= 4; step++) {
    const t = step / 4, section = t * t * (3 - 2 * t);
    const ring = rails.map(rail => {
      const radius = THREE.MathUtils.lerp(rail.radius, wristRadius, section), index = points.length;
      points.push(toHand(new THREE.Vector3(THREE.MathUtils.lerp(rail.first.x, capX, t),
        cuff.y + rail.direction.x * radius, cuff.z - rail.direction.y * radius)));
      return index;
    });
    for (let i = 0; i < boundary.length; i++) {
      const next = (i + 1) % boundary.length;
      triangles.push(previous[i], previous[next], ring[next], previous[i], ring[next], ring[i]);
    }
    previous = ring;
  }
  const cap = points.length; points.push(toHand(new THREE.Vector3(capX, cuff.y, cuff.z)));
  for (let i = 0; i < previous.length; i++) triangles.push(cap, previous[i], previous[(i + 1) % previous.length]);
  const result = geometry(points, triangles, "closed shaft-lined wrapping palm with opposed thumb, three broad integral pads, sewn side-entry wrist");
  result.userData.shaftFrame = BOOKY_GRIP_SHAFT;
  result.userData.wristFrame = BOOKY_GRIP_WRIST;
  return result;
}

export function createBookyGloveGeometry(kind: "open" | "grip"): THREE.BufferGeometry {
  return kind === "grip" ? gripHand() : openHand();
}