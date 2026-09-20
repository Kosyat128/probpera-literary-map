import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { GlobeQualityTier } from "./globeQuality";
export type CeramicPortraitKind = "pushkin" | "hemingway" | "tolstoy";
export interface OwnedCeramicPortraitStand {
    readonly group: THREE.Group;
    dispose(): void;
}
type Section = readonly [
    height: number,
    halfWidth: number,
    front: number,
    back: number
];
const TAU = Math.PI * 2, mix = THREE.MathUtils.lerp, clamp = THREE.MathUtils.clamp;
const g = (v: number, c: number, r: number) => Math.exp(-Math.pow((v - c) / r, 2));
const fade = (v: number, a: number, b: number) => THREE.MathUtils.smoothstep(v, a, b);
const signedAngle = (v: number) => Math.atan2(Math.sin(v), Math.cos(v));
const variation = (index: number, seed: number) => {
    const value = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453;
    return value - Math.floor(value);
};
// Original three-dimensional sections, informed by portrait references rather
// than an image mapped onto a generic head. Hair and beard share this surface.
const portraits = {
    pushkin: { bottom: -1.535, top: -1.055, eyesY: -1.266, eyeX: .062, eyeWidth: .029, eyeHeight: .0085,
        noseY: -1.339, noseWidth: .024, noseProjection: .034, mouthY: -1.405, mouthWidth: .041,
        skin: "#c3a28b", hair: "#29241f", brow: "#342923", iris: "#554d3f", browHeight: .010,
        sections: [[0, 0, -.025, -.025], [.065, .066, .092, -.051], [.14, .097, .128, -.075], [.28, .124, .139, -.124],
            [.46, .151, .143, -.151], [.64, .157, .137, -.161], [.79, .152, .132, -.152], [.9, .121, .100, -.123], [.97, .065, .060, -.062], [1, 0, 0, 0]] },
    hemingway: { bottom: -1.537, top: -1.047, eyesY: -1.268, eyeX: .071, eyeWidth: .032, eyeHeight: .0078,
        noseY: -1.335, noseWidth: .035, noseProjection: .037, mouthY: -1.402, mouthWidth: .050,
        skin: "#c8aa95", hair: "#929b98", brow: "#66706a", iris: "#596267", browHeight: .017,
        sections: [[0, 0, -.022, -.022], [.065, .084, .110, -.055], [.145, .139, .147, -.081], [.29, .170, .154, -.131],
            [.47, .184, .155, -.160], [.65, .179, .142, -.166], [.80, .163, .130, -.159], [.91, .127, .106, -.120], [.97, .068, .057, -.061], [1, 0, 0, 0]] },
    tolstoy: { bottom: -1.606, top: -1.044, eyesY: -1.224, eyeX: .066, eyeWidth: .027, eyeHeight: .0058,
        noseY: -1.294, noseWidth: .043, noseProjection: .047, mouthY: -1.350, mouthWidth: .047,
        skin: "#c3ad99", hair: "#ccd0cc", brow: "#73796e", iris: "#5d655c", browHeight: .028,
        sections: [[0, 0, .046, .046], [.018, .055, .088, .005], [.065, .085, .122, -.021], [.17, .132, .161, -.060], [.30, .163, .177, -.091],
            [.43, .166, .168, -.114], [.57, .176, .154, -.149], [.72, .177, .143, -.165], [.85, .156, .134, -.143], [.94, .106, .089, -.091], [1, 0, .010, .010]] }
} as const;
const levels = {
    high: { rows: 128, radial: 176, patch: 7, patchRadial: 24, reflection: 128 },
    balanced: { rows: 96, radial: 128, patch: 5, patchRadial: 18, reflection: 64 },
    economy: { rows: 64, radial: 96, patch: 4, patchRadial: 14, reflection: 32 }
} as const;
function sectionAt(sections: readonly Section[], q: number): [
    number,
    number,
    number
] {
    for (let i = 1; i < sections.length; i++)
        if (q <= sections[i][0]) {
            const a = sections[i - 1], b = sections[i], before = sections[Math.max(0, i - 2)], after = sections[Math.min(sections.length - 1, i + 1)];
            const span = b[0] - a[0], t = clamp((q - a[0]) / span, 0, 1), t2 = t * t, t3 = t2 * t, values: number[] = [];
            for (let f = 1; f < 4; f++) {
                const da = (b[f] - before[f]) / (b[0] - before[0]), db = (after[f] - a[f]) / (after[0] - a[0]);
                values.push((2 * t3 - 3 * t2 + 1) * a[f] + (t3 - 2 * t2 + t) * da * span + (-2 * t3 + 3 * t2) * b[f] + (t3 - t2) * db * span);
            }
            return [Math.max(0, values[0]), values[1], values[2]];
        }
    const last = sections[sections.length - 1];
    return [last[1], last[2], last[3]];
}
function averageSeams(geometry: THREE.BufferGeometry, vertexLimit?: number): void {
    const positions = geometry.getAttribute("position"), normals = geometry.getAttribute("normal");
    const groups = new Map<string, number[]>();
    for (let index = 0; index < (vertexLimit ?? positions.count); index++) {
        const key = [positions.getX(index), positions.getY(index), positions.getZ(index)].map(value => Math.round(value * 1e7)).join(":");
        const members = groups.get(key) ?? [];
        members.push(index);
        groups.set(key, members);
    }
    for (const members of groups.values()) {
        if (members.length < 2)
            continue;
        const normal = new THREE.Vector3();
        for (const index of members)
            normal.add(new THREE.Vector3().fromBufferAttribute(normals, index));
        normal.normalize();
        for (const index of members)
            normals.setXYZ(index, normal.x, normal.y, normal.z);
    }
}
/** A closed, curved skin volume: the two parameter surfaces meet along their
 * boundaries. Used for hair/beard masses and ear folds, not flat image cards. */
function closedPatch(rings: number, radial: number, surface: (r: number, angle: number, outer: boolean) => THREE.Vector3): THREE.BufferGeometry {
    const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
    const row = radial + 1, layer = 1 + rings * row;
    for (const outer of [true, false]) {
        positions.push(...surface(0, 0, outer).toArray());
        uvs.push(0.5, 0.5);
        for (let ring = 1; ring <= rings; ring++)
            for (let segment = 0; segment <= radial; segment++) {
                const angle = segment / radial * Math.PI * 2, r = ring / rings;
                positions.push(...surface(r, angle, outer).toArray());
                uvs.push(0.5 + r * Math.cos(angle) / 2, 0.5 + r * Math.sin(angle) / 2);
            }
    }
    for (let segment = 0; segment < radial; segment++) {
        indices.push(0, 1 + segment, 2 + segment, layer, layer + 2 + segment, layer + 1 + segment);
    }
    for (let ring = 0; ring < rings - 1; ring++)
        for (let segment = 0; segment < radial; segment++) {
            const a = 1 + ring * row + segment, b = a + row;
            indices.push(a, b, a + 1, a + 1, b, b + 1);
            indices.push(a + layer, a + 1 + layer, b + layer, a + 1 + layer, b + 1 + layer, b + layer);
        }
    const last = 1 + (rings - 1) * row;
    for (let segment = 0; segment < radial; segment++) {
        const a = last + segment, rim = positions.length / 3;
        // A thin closed rim needs its own shading normals; averaging it into
        // both curved faces can reverse the apparent winding at the iris edge.
        for (const vertex of [a, a + layer, a + 1, a + 1 + layer]) {
            positions.push(positions[vertex * 3], positions[vertex * 3 + 1], positions[vertex * 3 + 2]);
            uvs.push(uvs[vertex * 2], uvs[vertex * 2 + 1]);
        }
        indices.push(rim, rim + 1, rim + 2, rim + 2, rim + 1, rim + 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    averageSeams(geometry, layer * 2);
    return geometry;
}
export function createCeramicPortraitStand(kind: CeramicPortraitKind, quality: GlobeQualityTier): OwnedCeramicPortraitStand {
    if (!Object.prototype.hasOwnProperty.call(portraits, kind) || !Object.prototype.hasOwnProperty.call(levels, quality))
        throw new Error("Invalid ceramic portrait stand");
    const portrait = portraits[kind], detail = levels[quality], height = portrait.top - portrait.bottom;
    const group = new THREE.Group();
    group.name = `included-globe-stand:stand.base.portrait-${kind}`;
    group.userData = { standId: `stand.base.portrait-${kind}`, portraitKind: kind, qualityTier: quality, provenance: "authored-in-project" };
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
    let disposed = false;
    const dispose = () => { if (disposed)
        return; disposed = true; for (const v of geometries)
        v.dispose(); for (const v of materials)
        v.dispose(); for (const v of textures)
        v.dispose(); group.clear(); };
    const own = <T extends THREE.BufferGeometry>(v: T): T => { geometries.add(v); return v; };
    const mesh = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material) => { const object = new THREE.Mesh(geometry, material); object.name = name; object.raycast = () => undefined; group.add(object); return object; };
    const merge = (name: string, parts: THREE.BufferGeometry[], material: THREE.Material) => { try {
        const combined = mergeGeometries(parts, false);
        if (!combined)
            throw new Error("Unable to assemble ceramic detail");
        mesh(name, own(combined), material);
    }
    finally {
        for (const v of parts)
            v.dispose();
    } };
    const hairLine = (angle: number) => {
        const a = Math.abs(signedAngle(angle));
        // A broad forehead and recession at the temples; no pointed curtain opening.
        const front = kind === "pushkin" ? -1.172 + .004 * Math.sin(angle * 3 + .5) - .006 * g(signedAngle(angle), -.28, .20) : -1.118 + .014 * g(a, .77, .23);
        const side = kind === "pushkin" ? -1.356 : -1.337;
        return mix(front, side, fade(a, .78, 1.37)) + .0018 * Math.sin(angle * 17 + .7);
    };
    const hairLocks: {
        angle: number;
        y: number;
        wide: number;
        tall: number;
        relief: number;
        phase: number;
    }[] = [];
    if (kind === "pushkin") {
        // Deterministic uneven spacing and overlapping swept volumes, rather
        // than latitude rows of identical round beads. All tiers share them.
        for (let candidate = 0; candidate < 680; candidate++) {
            const angle = variation(candidate, 1) * TAU, y = mix(-1.455, -1.066, variation(candidate, 2));
            const q = clamp((y - portrait.bottom) / height, .025, .975), [width] = sectionAt(portrait.sections, q);
            const a = Math.abs(signedAngle(angle)), sideburn = a > 1.09 && a < 1.49 && y < -1.30;
            if (y < hairLine(angle) - .004 && !sideburn) continue;
            const radius = .021 + variation(candidate, 3) * .013;
            const near = hairLocks.some(lock => {
                const spacing = Math.hypot(signedAngle(angle - lock.angle) * Math.max(.060, width), y - lock.y);
                return spacing < .61 * (radius + lock.tall);
            });
            if (near) continue;
            hairLocks.push({ angle, y, wide: radius / Math.max(.055, width), tall: radius * mix(.78, 1.17, variation(candidate, 4)),
                relief: (sideburn ? .018 : .024) + variation(candidate, 5) * (sideburn ? .006 : .015), phase: variation(candidate, 6) * TAU });
        }
    }
    else {
        const columns = 22, rows = 6;
        for (let row = 0; row < rows; row++)
            for (let column = 0; column < columns; column++) {
                const angle = (column + row * .47 + .14 * Math.sin(column * 2.1 + row)) / columns * TAU;
                const low = kind === "tolstoy" ? -1.343 : hairLine(angle), high = kind === "tolstoy" ? -1.093 : portrait.top;
                hairLocks.push({ angle, y: mix(low, high, (row + .38 + .10 * Math.sin(column * 3.7)) / rows), wide: TAU / columns * .40,
                    tall: (high - low) / rows * 1.25, relief: kind === "tolstoy" ? .006 : .0016, phase: column * 1.7 + row * 2.1 });
            }
    }
    const beardLocks = Array.from({ length: kind === "tolstoy" ? 43 : 29 }, (_, index) => ({
        angle: mix(-1.50, 1.50, variation(index, 11)),
        y: kind === "tolstoy" ? mix(-1.581, -1.337, variation(index, 12)) : mix(-1.516, -1.345, variation(index, 12)),
        wide: mix(.13, .30, variation(index, 13)), tall: kind === "tolstoy" ? mix(.023, .061, variation(index, 14)) : mix(.010, .023, variation(index, 14)),
        relief: kind === "tolstoy" ? mix(.005, .011, variation(index, 15)) : mix(.0010, .0021, variation(index, 15)),
        bend: mix(-3.0, 3.0, variation(index, 16)), phase: variation(index, 17) * TAU,
    }));
    const browYAt = (x: number, side: number) => portrait.eyesY + (kind === "tolstoy" ? .010 : kind === "hemingway" ? .016 : .017)
        - Math.pow((x - side * portrait.eyeX) / portrait.eyeWidth, 2) * .0035
        + (kind === "tolstoy" ? .10 * (Math.abs(x) - portrait.eyeX) : kind === "hemingway" ? -.035 * (Math.abs(x) - portrait.eyeX) : 0);
    const facialRelief = (x: number, y: number) => {
        let amount = 0;
        for (const side of [-1, 1]) {
            amount -= (kind === "tolstoy" ? .025 : kind === "hemingway" ? .019 : .012) * g(x, side * portrait.eyeX, portrait.eyeWidth * 1.24) * g(y, portrait.eyesY, .016);
            const browY = browYAt(x, side);
            amount += portrait.browHeight * g(x, side * portrait.eyeX, portrait.eyeWidth * 1.3) * g(y, browY, kind === "tolstoy" ? .013 : .009);
            const cheekLine = portrait.eyesY - .035 + .16 * (Math.abs(x) - portrait.eyeX);
            amount += (kind === "hemingway" ? .022 : kind === "tolstoy" ? .017 : .012) * g(x, side * portrait.eyeX * 1.28, .041) * g(y, cheekLine, .023);
            amount -= (kind === "pushkin" ? .008 : kind === "tolstoy" ? .011 : .006) * g(x, side * portrait.eyeX * 1.34, .036) * g(y, portrait.eyesY - .077, .032);
            // A shallow temple hollow separates the orbital rim from the
            // broad lateral head volume; it is not a painted age line.
            amount -= (kind === "pushkin" ? .003 : .007) * g(x, side * portrait.eyeX * 1.80, .026) * g(y, portrait.eyesY + .013, .038);
            amount += (kind === "tolstoy" ? .016 : .010) * g(x, side * portrait.noseWidth, kind === "tolstoy" ? .017 : .011) * g(y, portrait.noseY - .007, .013);
            amount -= .007 * g(x, side * portrait.noseWidth * .83, .0065) * g(y, portrait.noseY - .016, .0055);
            amount -= .0035 * g(x, side * portrait.noseWidth * 1.65, .009) * g(y, portrait.noseY - .035, .030);
        }
        amount += (kind === "tolstoy" ? .012 : .018) * g(x, 0, portrait.noseWidth * .64) * g(y, portrait.eyesY - .029, .039);
        amount += portrait.noseProjection * g(x, 0, portrait.noseWidth) * g(y, portrait.noseY, kind === "tolstoy" ? .019 : .022);
        amount += (kind === "tolstoy" ? .010 : kind === "hemingway" ? .006 : .003) * g(x, 0, portrait.noseWidth * .73) * g(y, portrait.noseY - .006, .013);
        amount -= .003 * g(x, 0, .008) * g(y, portrait.mouthY + .024, .017);
        if (kind !== "pushkin")
            for (const side of [-1, 1]) {
                amount -= .0035 * g(x, side * portrait.eyeX, .035) * g(y, portrait.eyesY - .018 + .12 * (Math.abs(x) - portrait.eyeX), .0045);
                amount += (kind === "hemingway" ? .006 : .0045) * g(x, side * portrait.eyeX, .032) * g(y, portrait.eyesY - .027, .008);
                amount -= .0024 * g(x, side * (portrait.eyeX + .027), .020) * g(y, portrait.eyesY - .010 + side * (x - side * (portrait.eyeX + .027)) * .38, .004);
            }
        if (kind !== "pushkin")
            for (const side of [-1, 1]) {
                const foldX = side * (portrait.noseWidth * 1.42 + (portrait.noseY - y) * .34);
                amount -= (kind === "hemingway" ? .0065 : .0045) * g(x, foldX, .0065) * g(y, portrait.noseY - .034, .034);
            }
        const line = portrait.mouthY + (kind === "tolstoy" ? -.003 : .002) * Math.pow(x / portrait.mouthWidth, 2), lips = Math.exp(-Math.pow(x / portrait.mouthWidth, 4));
        const cupid = .0017 * g(x, 0, .010) - .0013 * (g(x, -.013, .007) + g(x, .013, .007));
        amount += lips * ((kind === "pushkin" ? .010 : .005) * g(y, line + .006 + cupid, .0045) + (kind === "pushkin" ? .013 : .006) * g(y, line - .006, .0055) - .0031 * g(y, line, .0027));
        amount += (kind === "pushkin" ? .008 : .005) * g(x, 0, .044) * g(y, portrait.mouthY - .051, .024);
        if (kind !== "pushkin")
            for (let line = 0; line < 3; line++) {
                const fold = portrait.eyesY + .045 + line * .018 + x * x * .37 + .0018 * Math.sin(x * 39 + line * 1.7);
                amount -= .0019 * g(x, line === 1 ? -.008 : .006, .087 - line * .008) * g(y, fold, .0033);
            }
        if (kind === "tolstoy") {
            amount += .009 * g(x, 0, .027) * g(y, portrait.eyesY + .025, .030);
            amount -= .0028 * (g(x, -.009, .004) + g(x, .010, .004)) * g(y, portrait.eyesY + .031, .018);
        }
        return amount;
    };
    const basePoint = (q: number, angle: number) => {
        const [width, front, back] = sectionAt(portrait.sections, q);
        return new THREE.Vector3(Math.sin(angle) * width, portrait.bottom + q * height, (front + back) / 2 + (front - back) / 2 * Math.cos(angle));
    };
    // Scalp, curls, sideburns and beard deform the same closed head. Their smooth
    // growth boundaries have no separate shell, edge wall, card or glued lock.
    const surface = (q: number, angle: number) => {
        const point = basePoint(q, angle), x = point.x, y = point.y, cosine = Math.cos(angle), front = Math.max(0, cosine);
        point.z += facialRelief(x, y) * Math.pow(front, 3) * fade(q, 0, .055) * (1 - fade(q, .96, 1));
        let hairMask: number;
        if (kind === "tolstoy")
            hairMask = fade(Math.abs(signedAngle(angle)), .79, 1.16) * fade(y, -1.36, -1.327) * (1 - fade(y, -1.115, -1.081));
        else
            hairMask = fade(y, hairLine(angle) - .007, hairLine(angle) + .008);
        if (kind === "pushkin")
            hairMask = Math.max(hairMask, g(Math.abs(signedAngle(angle)), 1.28, .18) * fade(y, -1.474, -1.439) * (1 - fade(y, -1.309, -1.276)));
        // Leave the helix and a little skin around each ear visible.
        const earWindow = g(Math.abs(signedAngle(angle)), 1.63, .23) * g(y, portrait.eyesY - .039, .043);
        hairMask *= 1 - .98 * earWindow;
        let beardMask = 0;
        if (kind !== "pushkin") {
            const high = portrait.mouthY + (kind === "tolstoy" ? .017 : .008) + Math.abs(Math.sin(angle)) * (kind === "tolstoy" ? .082 : .055)
                + .0035 * Math.sin(angle * 4 + .5) + .002 * Math.sin(angle * 9 - .8);
            beardMask = (1 - fade(y, high - .014, high + .012)) * fade(cosine, -.42, .16);
            if (kind === "tolstoy")
                beardMask = Math.max(beardMask, (1 - fade(y, -1.430, -1.388)) * fade(cosine, .04, .42));
            const moustacheY = portrait.mouthY + .017 - .10 * Math.abs(x);
            const moustache = g(y, moustacheY, kind === "tolstoy" ? .013 : .010) * Math.exp(-Math.pow(x / (portrait.mouthWidth * 1.18), 4)) * Math.pow(front, 3);
            beardMask = Math.max(beardMask, moustache);
            beardMask *= 1 - Math.exp(-Math.pow(x / (portrait.mouthWidth * .97), 6)) * g(y, portrait.mouthY, .009);
        }
        let hairRelief = 0;
        if (hairMask > .002)
            for (const lock of hairLocks) {
                const dy = (y - lock.y) / lock.tall;
                const sweep = kind === "pushkin" ? .20 * Math.sin(lock.phase) * dy + .11 * Math.sin(dy * 2 + lock.phase) : (y - lock.y) * 2 / lock.wide;
                const da = signedAngle(angle - lock.angle) / lock.wide - sweep, distance = da * da + dy * dy;
                if (distance < 5) {
                    const crease = .0018 * Math.exp(-((da - .18) ** 2 / .038 + (dy + .05) ** 2 / .56));
                    hairRelief += Math.pow(Math.max(0, lock.relief * Math.exp(-distance * 1.35) - crease), 4);
                }
            }
        hairRelief = Math.pow(hairRelief, .25);
        const reliefLimit = kind === "pushkin" ? .075 : .022;
        hairRelief = reliefLimit * (1 - Math.exp(-Math.max(0, hairRelief) / reliefLimit));
        let beardRelief = 0;
        if (beardMask > .002 && kind !== "pushkin") {
            for (const lock of beardLocks) {
                const dy = (y - lock.y) / lock.tall;
                const da = signedAngle(angle - lock.angle - lock.bend * (y - lock.y) - .025 * Math.sin(dy * 1.7 + lock.phase)) / lock.wide;
                const distance = da * da + dy * dy;
                if (distance < 5) beardRelief += Math.pow(lock.relief * Math.exp(-distance * 1.2), 4);
            }
            beardRelief = Math.pow(beardRelief, .25) + (kind === "tolstoy" ? .0025 : .0010);
            const moustacheLine = portrait.mouthY + .017 - .10 * Math.abs(x);
            beardRelief += (kind === "tolstoy" ? .006 : .0035) * g(y, moustacheLine, .012)
                * (g(x, -.022, .023) + g(x, .023, .023)) * Math.pow(front, 3);
        }
        const crownFade = 1 - fade(q, .965, 1);
        const displacement = (hairMask * ((kind === "pushkin" ? .004 : .0025) + hairRelief) + beardMask * beardRelief)
            * crownFade * fade(q, 0, .035);
        if (displacement > 0) {
            const du = basePoint(q, angle + .0005).sub(basePoint(q, angle - .0005));
            const dv = basePoint(clamp(q + .0005, 0, 1), angle).sub(basePoint(clamp(q - .0005, 0, 1), angle));
            const normal = q === 0 ? new THREE.Vector3(0, -1, 0) : q === 1 ? new THREE.Vector3(0, 1, 0) : du.cross(dv).normalize();
            normal.y *= 1 - .74 * fade(q, .89, 1);
            point.addScaledVector(normal, displacement);
        }
        if (kind === "tolstoy")
            point.y += .009 * g(x, 0, .028) * fade(q, 0, .055) * (1 - fade(q, .12, .22)) * front;
        if (kind === "pushkin") point.y += .0032 * fade(q, .96, 1);
        const brows = [-1, 1].reduce((value, side) => Math.max(value, g(x, side * portrait.eyeX, portrait.eyeWidth * 1.05) * g(y, browYAt(x, side), kind === "tolstoy" ? .011 : .006)), 0) * Math.pow(front, 2);
        const lips = g(y, portrait.mouthY, .010) * Math.exp(-Math.pow(x / portrait.mouthWidth, 4)) * Math.pow(front, 6) * (1 - beardMask);
        const hairTone = clamp((hairRelief * 6 + beardRelief * 9 - .05), -.045, .065);
        return { point, hairMask: Math.max(hairMask, beardMask), beardMask, hairTone, brows: clamp(brows * 1.8, 0, 1), lips };
    };
    const facePoint = (x: number, y: number) => { const q = clamp((y - portrait.bottom) / height, .01, .99), [width] = sectionAt(portrait.sections, q); return surface(q, Math.asin(clamp(x / width, -.99, .99))).point; };
    try {
        const size = detail.reflection, bytes = new Uint8Array(size * size / 2 * 4);
        for (let y = 0; y < size / 2; y++)
            for (let x = 0; x < size; x++) {
                const u = x / size, v = y / (size / 2), value = clamp(.20 + .18 * (1 - v) + g(u, .21, .085) * g(v, .40, .20) * .52 + g(u, .71, .17) * g(v, .49, .25) * .18, 0, 1), offset = (y * size + x) * 4;
                bytes[offset] = Math.round(value * 255);
                bytes[offset + 1] = Math.round(value * 253);
                bytes[offset + 2] = Math.round(value * 249);
                bytes[offset + 3] = 255;
            }
        const reflection = new THREE.DataTexture(bytes, size, size / 2, THREE.RGBAFormat);
        textures.add(reflection);
        reflection.name = `ceramic-sculpt-reflection:${quality}`;
        reflection.mapping = THREE.EquirectangularReflectionMapping;
        reflection.colorSpace = THREE.SRGBColorSpace;
        reflection.generateMipmaps = true;
        reflection.minFilter = THREE.LinearMipmapLinearFilter;
        reflection.magFilter = THREE.LinearFilter;
        reflection.userData = { provenance: "authored-in-project", qualityTier: quality };
        reflection.needsUpdate = true;
        const finish = (name: string, color: string, roughness: number) => {
            const material = new THREE.MeshPhysicalMaterial({ name, color, metalness: 0, roughness, clearcoat: .32, clearcoatRoughness: .29, ior: 1.5, envMap: reflection, envMapIntensity: .45 });
            materials.add(material);
            return material;
        };
        const headMaterial = finish("painted-ceramic-sculpture", "#ffffff", .52);
        headMaterial.vertexColors = true;
        headMaterial.clearcoat = .21; headMaterial.clearcoatRoughness = .38;
        const skinMaterial = finish("painted-ceramic-facial-detail", portrait.skin, .46), porcelain = finish("unglazed-ivory-contact-and-foot", "#e6e3dc", .40);
        const eyeMaterial = finish("ceramic-eye-white", "#bdb7ad", .44), irisMaterial = finish("painted-ceramic-iris", portrait.iris, .40), pupilMaterial = finish("painted-ceramic-pupil", "#292b27", .38);
        eyeMaterial.clearcoat = .16; eyeMaterial.clearcoatRoughness = .43;
        const skinColor = new THREE.Color(portrait.skin), hairColor = new THREE.Color(portrait.hair), browColor = new THREE.Color(portrait.brow), lipColor = new THREE.Color("#aa7869");
        const positions: number[] = [], colors: number[] = [], uvs: number[] = [], indices: number[] = [], row = detail.radial + 1;
        // Reuse the same grid budget where the modeled surface changes fastest.
        // This cumulative density is strictly increasing (every weight >= 1),
        // so its inverse cannot exchange rows. Crown and lower beard rows remain
        // exactly uniform, outside this bounded facial interval.
        const facialLow = clamp((portrait.mouthY - .070 - portrait.bottom) / height, 0, 1);
        const facialHigh = clamp((portrait.eyesY + .090 - portrait.bottom) / height, 0, 1);
        const densitySteps = 256, density = new Float64Array(densitySteps + 1);
        for (let step = 1; step <= densitySteps; step++) {
            const y = portrait.bottom + mix(facialLow, facialHigh, (step - .5) / densitySteps) * height;
            density[step] = density[step - 1] + 1 + 5.2 * g(y, portrait.mouthY, .014)
                + 4.0 * g(y, portrait.noseY - .006, .017) + 3.0 * g(y, portrait.eyesY + .004, .025);
        }
        const facialRow = (q: number) => {
            if (q <= facialLow || q >= facialHigh) return q;
            const target = (q - facialLow) / (facialHigh - facialLow) * density[densitySteps];
            let low = 0, high = densitySteps;
            while (high - low > 1) {
                const middle = (low + high) >>> 1;
                if (density[middle] < target) low = middle; else high = middle;
            }
            const fraction = (target - density[low]) / (density[high] - density[low]);
            return mix(facialLow, facialHigh, (low + fraction) / densitySteps);
        };
        const pushVertex = (q: number, angle: number) => {
            const sample = surface(q, angle), paint = hairColor.clone().lerp(new THREE.Color("#d2d9d8"), kind === "hemingway" ? sample.beardMask * .65 : 0);
            paint.multiplyScalar(1 + sample.hairTone);
            const color = skinColor.clone().lerp(paint, sample.hairMask).lerp(browColor, sample.brows * .9).lerp(lipColor, sample.lips * .58);
            positions.push(...sample.point.toArray());
            colors.push(color.r, color.g, color.b);
            uvs.push(angle / TAU, q);
        };
        pushVertex(0, Math.PI);
        for (let y = 1; y < detail.rows; y++) {
            const uniformQ = y / detail.rows, faceQ = facialRow(uniformQ);
            for (let x = 0; x <= detail.radial; x++) {
                const t = x / detail.radial * TAU;
                // da/dt = 1 - .55 cos(t) >= .45; both seam endpoints are exact.
                const angle = x === 0 ? 0 : x === detail.radial ? TAU : t - .55 * Math.sin(t);
                const frontWeight = 1 - fade(Math.abs(signedAngle(angle)), .80, 1.45);
                // A fixed-angle convex blend of increasing maps remains
                // increasing. The back of the head retains its original rows.
                pushVertex(mix(uniformQ, faceQ, frontWeight), angle);
            }
        }
        const tip = positions.length / 3;
        pushVertex(1, 0);
        for (let x = 0; x < detail.radial; x++)
            indices.push(0, 2 + x, 1 + x);
        for (let y = 0; y < detail.rows - 2; y++)
            for (let x = 0; x < detail.radial; x++) {
                const a = 1 + y * row + x, b = a + row;
                indices.push(a, a + 1, b, b, a + 1, b + 1);
            }
        const last = 1 + (detail.rows - 2) * row;
        for (let x = 0; x < detail.radial; x++)
            indices.push(last + x, last + x + 1, tip);
        const head = own(new THREE.BufferGeometry());
        head.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
        head.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
        head.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
        head.setIndex(indices);
        head.computeVertexNormals();
        averageSeams(head);
        mesh("connected-portrait-head-and-face", head, headMaterial);
        // A broad ceramic saucer, with a rounded raised rim and a recessed
        // inner well flowing into the neck. The plate is wider than the head.
        const foot = own(new THREE.LatheGeometry([
            [0, -1.724], [.350 * 2 / 3, -1.724], [.374 * 2 / 3, -1.721], [.386 * 2 / 3, -1.713],
            [.472 * 2 / 3, -1.710], [.534 * 2 / 3, -1.704], [.572 * 2 / 3, -1.696], [.588 * 2 / 3, -1.688],
            [.590 * 2 / 3, -1.680], [.580 * 2 / 3, -1.674], [.564 * 2 / 3, -1.673], [.546 * 2 / 3, -1.678],
            [.518 * 2 / 3, -1.684], [.472 * 2 / 3, -1.690], [.408 * 2 / 3, -1.695], [.324 * 2 / 3, -1.697],
            [.252 * 2 / 3, -1.694], [.136, -1.684], [.106, -1.665], [.086, -1.642],
            [.081, -1.541], [0, -1.541],
        ].map(([r, y]) => new THREE.Vector2(r, y)), detail.radial / 2));
        foot.scale(1, 1, .94);
        foot.translate(0, 0, -.037);
        mesh("ceramic-neck-and-oval-foot", foot, porcelain);
        const seat = own(new THREE.LatheGeometry([[0, -1.054], [.021, -1.054], [.039, -1.037], [.048, -1.024], [.045, -1.017], [0, -1.017]].map(([r, y]) => new THREE.Vector2(r, y)), detail.radial / 2));
        mesh("subtle-globe-contact-seat", seat, porcelain);
        const eyeParts: THREE.BufferGeometry[] = [], lidParts: THREE.BufferGeometry[] = [], irisParts: THREE.BufferGeometry[] = [], pupilParts: THREE.BufferGeometry[] = [], earParts: THREE.BufferGeometry[] = [];
        for (const side of [-1, 1]) {
            const centre = facePoint(side * portrait.eyeX, portrait.eyesY);
            // Eye axes follow the cranium, not the steep brow crease.
            const horizontal = new THREE.Vector3(1, 0, -side * .18).normalize();
            const vertical = new THREE.Vector3(0, 1, 0);
            const normal = horizontal.clone().cross(vertical).normalize(), up = normal.clone().cross(horizontal).normalize();
            const eyeSlope = side * (kind === "pushkin" ? .055 : kind === "hemingway" ? .020 : -.035);
            const upperHeight = portrait.eyeHeight * .72, lowerHeight = portrait.eyeHeight * .80, eyeBulge = .0055;
            const point = (x: number, y: number, z: number) => centre.clone().addScaledVector(horizontal, x).addScaledVector(up, y + eyeSlope * x).addScaledVector(normal, z);
            eyeParts.push(closedPatch(4, detail.patchRadial, (r, angle, outer) => {
                const sine = Math.sin(angle);
                return point(Math.cos(angle) * r * portrait.eyeWidth, sine * r * (sine >= 0 ? upperHeight : lowerHeight),
                    outer ? eyeBulge * Math.sqrt(Math.max(0, 1 - r * r)) : -.003);
            }));
            for (const upper of [true, false]) {
                const points: THREE.Vector3[] = [];
                for (let step = 0; step <= 20; step++) {
                    const angle = step / 20 * Math.PI;
                    points.push(point(-Math.cos(angle) * portrait.eyeWidth, Math.sin(angle) * (upper ? upperHeight : -lowerHeight), .0006));
                }
                lidParts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), detail.patchRadial, upper ? .0027 : .0018, 6, false));
            }
            const eyeDepth = (x: number, y: number) => eyeBulge * Math.sqrt(Math.max(0, 1 - (x / portrait.eyeWidth) ** 2 - (y / (y >= 0 ? upperHeight : lowerHeight)) ** 2));
            const irisRadius = kind === "tolstoy" ? .0105 : kind === "hemingway" ? .0116 : .0112;
            const irisOffset = -side * .0012;
            // The iris is a painted ceramic disc partly covered by the lids,
            // not a small round button floating inside a fully exposed white eye.
            // Clip radial rays to the actual upper/lower aperture analytically.
            const irisPoint = (r: number, angle: number) => {
                const dx = Math.cos(angle) * irisRadius, dy = Math.sin(angle) * irisRadius;
                const aperture = (dy >= 0 ? upperHeight : lowerHeight) * .96, width = portrait.eyeWidth * .97;
                const a = (dx / width) ** 2 + (dy / aperture) ** 2;
                const b = 2 * irisOffset * dx / (width * width), c = (irisOffset / width) ** 2 - 1;
                const limit = Math.min(1, (-b + Math.sqrt(Math.max(0, b * b - 4 * a * c))) / (2 * a));
                return { x: irisOffset + dx * r * limit, y: dy * r * limit };
            };
            irisParts.push(closedPatch(3, detail.patchRadial, (r, angle, outer) => {
                const { x, y } = irisPoint(r, angle);
                return point(x, y, eyeDepth(x, y) + (outer ? .00035 : -.001));
            }));
            pupilParts.push(closedPatch(2, detail.patchRadial, (r, angle, outer) => {
                const x = irisOffset + Math.cos(angle) * r * .0032, y = Math.sin(angle) * r * .0032;
                return point(x, y, eyeDepth(x, y) + (outer ? .00070 : -.0005));
            }));
            const earQ = (portrait.eyesY - .036 - portrait.bottom) / height, [earWidth] = sectionAt(portrait.sections, earQ);
            const earCentre = new THREE.Vector3(side * earWidth * .985, portrait.eyesY - .036, -.023), earNormal = new THREE.Vector3(side * .95, 0, .31).normalize(), across = new THREE.Vector3(earNormal.z, 0, -earNormal.x);
            earParts.push(closedPatch(detail.patch, detail.patchRadial, (r, angle, outer) => {
                const depth = outer ? .001 + .007 * g(r, .81, .15) + .004 * g(r, .45, .14) * (.65 + .35 * Math.sin(angle)) - .002 * g(r, .2, .15) : -.005;
                return earCentre.clone().addScaledVector(across, Math.cos(angle) * r * .025 * (1 - .08 * Math.sin(angle))).add(new THREE.Vector3(0, Math.sin(angle) * r * .043, 0)).addScaledVector(earNormal, depth);
            }));
        }
        merge("sculpted-almond-eyes", eyeParts, eyeMaterial);
        merge("upper-and-lower-eyelids", lidParts, skinMaterial);
        merge("incised-iris-detail", irisParts, irisMaterial);
        merge("pupil-detail", pupilParts, pupilMaterial);
        merge("folded-ears-with-helix", earParts, skinMaterial);
        // Enlarge the entire portrait together, including the eyes and ears,
        // around its upper contact point so the globe stays seated in place.
        for (const object of group.children) {
            if (object instanceof THREE.Mesh && object.name !== "ceramic-neck-and-oval-foot"
                && object.name !== "subtle-globe-contact-seat") {
                object.geometry.translate(0, 1.044, 0);
                object.geometry.scale(1.12, 1.12, 1.12);
                object.geometry.translate(0, -1.044, 0);
            }
        }
        group.updateMatrixWorld(true);
        return Object.freeze({ group, dispose });
    }
    catch (error) {
        dispose();
        throw error;
    }
}
