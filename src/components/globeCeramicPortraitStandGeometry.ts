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
// Original three-dimensional sections, informed by portrait references rather
// than an image mapped onto a generic head. Hair and beard share this surface.
const portraits = {
    pushkin: { bottom: -1.535, top: -1.055, eyesY: -1.266, eyeX: .062, eyeWidth: .030, eyeHeight: .0100,
        noseY: -1.339, noseWidth: .023, noseProjection: .030, mouthY: -1.410, mouthWidth: .045,
        skin: "#cda789", hair: "#29241f", brow: "#342923", iris: "#554d3f", browHeight: .008,
        sections: [[0, 0, -.025, -.025], [.065, .066, .092, -.051], [.14, .097, .128, -.075], [.28, .124, .139, -.124],
            [.46, .151, .143, -.151], [.64, .157, .137, -.161], [.79, .152, .132, -.152], [.9, .121, .100, -.123], [.97, .065, .060, -.062], [1, 0, 0, 0]] },
    hemingway: { bottom: -1.537, top: -1.047, eyesY: -1.268, eyeX: .071, eyeWidth: .033, eyeHeight: .0100,
        noseY: -1.339, noseWidth: .032, noseProjection: .035, mouthY: -1.410, mouthWidth: .052,
        skin: "#d0b29a", hair: "#9caaa9", brow: "#66706a", iris: "#596267", browHeight: .011,
        sections: [[0, 0, -.022, -.022], [.065, .075, .104, -.055], [.145, .127, .141, -.079], [.29, .157, .153, -.129],
            [.47, .180, .155, -.160], [.65, .183, .144, -.166], [.80, .170, .132, -.159], [.91, .130, .106, -.120], [.97, .068, .057, -.061], [1, 0, 0, 0]] },
    tolstoy: { bottom: -1.606, top: -1.044, eyesY: -1.224, eyeX: .066, eyeWidth: .029, eyeHeight: .0068,
        noseY: -1.298, noseWidth: .040, noseProjection: .043, mouthY: -1.354, mouthWidth: .047,
        skin: "#cbb098", hair: "#d6dfe1", brow: "#738078", iris: "#5d655c", browHeight: .025,
        sections: [[0, 0, .046, .046], [.018, .053, .091, .008], [.065, .079, .119, -.011], [.17, .122, .149, -.054], [.30, .154, .172, -.087],
            [.43, .160, .165, -.114], [.57, .178, .158, -.149], [.72, .178, .145, -.165], [.85, .153, .132, -.143], [.94, .103, .086, -.091], [1, 0, .010, .010]] }
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
        const front = kind === "pushkin" ? -1.174 + .007 * Math.cos(angle * 4) : -1.118 + .014 * g(a, .77, .23);
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
        // World-space spacing keeps forehead and temple curls round at every latitude.
        for (let row = 0; row < 13; row++) {
            const y = -1.427 + row * .030, q = clamp((y - portrait.bottom) / height, .025, .975), [width] = sectionAt(portrait.sections, q);
            const count = Math.max(6, Math.round(TAU * width / .045));
            for (let column = 0; column < count; column++) {
                const angle = (column + row * .47 + .13 * Math.sin(column * 2.1 + row)) / count * TAU;
                const a = Math.abs(signedAngle(angle)), sideburn = a > 1.10 && a < 1.48 && y < -1.30;
                if (y < hairLine(angle) - .006 && !sideburn)
                    continue;
                const radius = .026 + .003 * Math.sin(column * 1.7 + row * 2.4);
                hairLocks.push({ angle, y: y + .002 * Math.sin(column * 2.7), wide: radius / Math.max(.055, width), tall: radius * .92,
                    relief: sideburn ? .018 : .026, phase: column * 1.7 + row * 2.1 });
            }
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
    const browYAt = (x: number, side: number) => portrait.eyesY + (kind === "tolstoy" ? .012 : .019) - Math.pow((x - side * portrait.eyeX) / portrait.eyeWidth, 2) * .004 + (kind === "tolstoy" ? .12 * (Math.abs(x) - portrait.eyeX) : 0);
    const facialRelief = (x: number, y: number) => {
        let amount = 0;
        for (const side of [-1, 1]) {
            amount -= (kind === "tolstoy" ? .021 : kind === "hemingway" ? .015 : .010) * g(x, side * portrait.eyeX, portrait.eyeWidth * 1.18) * g(y, portrait.eyesY, .014);
            const browY = browYAt(x, side);
            amount += portrait.browHeight * g(x, side * portrait.eyeX, portrait.eyeWidth * 1.3) * g(y, browY, kind === "tolstoy" ? .013 : .009);
            amount += (kind === "hemingway" ? .017 : .011) * g(x, side * portrait.eyeX * 1.26, .038) * g(y, portrait.eyesY - .034, .028);
            amount -= (kind === "pushkin" ? .006 : .003) * g(x, side * portrait.eyeX * 1.28, .032) * g(y, portrait.eyesY - .080, .040);
            amount += (kind === "tolstoy" ? .016 : .010) * g(x, side * portrait.noseWidth, kind === "tolstoy" ? .017 : .011) * g(y, portrait.noseY - .007, .013);
            amount -= .006 * g(x, side * portrait.noseWidth * .83, .0055) * g(y, portrait.noseY - .016, .005);
            amount -= .0035 * g(x, side * portrait.noseWidth * 1.65, .009) * g(y, portrait.noseY - .035, .030);
        }
        amount += (kind === "tolstoy" ? .012 : .018) * g(x, 0, portrait.noseWidth * .64) * g(y, portrait.eyesY - .029, .039);
        amount += portrait.noseProjection * g(x, 0, portrait.noseWidth) * g(y, portrait.noseY, kind === "tolstoy" ? .019 : .022);
        if (kind !== "pushkin")
            for (const side of [-1, 1]) {
                amount -= .0045 * g(x, side * portrait.eyeX, .040) * g(y, portrait.eyesY - .020, .005);
                amount += .004 * g(x, side * portrait.eyeX, .033) * g(y, portrait.eyesY - .032, .008);
                amount -= .0035 * g(x, side * (portrait.eyeX + .025), .023) * g(y, portrait.eyesY - .010 + side * (x - side * (portrait.eyeX + .025)) * .38, .004);
            }
        if (kind !== "pushkin")
            for (const side of [-1, 1]) {
                const foldX = side * (portrait.noseWidth * 1.42 + (portrait.noseY - y) * .34);
                amount -= (kind === "hemingway" ? .0065 : .0045) * g(x, foldX, .0065) * g(y, portrait.noseY - .034, .034);
            }
        const line = portrait.mouthY + (kind === "tolstoy" ? -.003 : .002) * Math.pow(x / portrait.mouthWidth, 2), lips = Math.exp(-Math.pow(x / portrait.mouthWidth, 4));
        amount += lips * ((kind === "pushkin" ? .010 : .005) * g(y, line + .006, .0045) + (kind === "pushkin" ? .012 : .006) * g(y, line - .006, .0055) - .0024 * g(y, line, .0027));
        if (kind !== "pushkin")
            for (let line = 0; line < 3; line++)
                amount -= .0024 * g(x, 0, .092) * g(y, portrait.eyesY + .046 + line * .020 + x * x * .30, .003);
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
            const high = portrait.mouthY + .017 + Math.abs(Math.sin(angle)) * (kind === "tolstoy" ? .082 : .069);
            beardMask = (1 - fade(y, high - .010, high + .010)) * fade(cosine, -.42, .16);
            if (kind === "tolstoy")
                beardMask = Math.max(beardMask, (1 - fade(y, -1.430, -1.388)) * fade(cosine, .04, .42));
            const moustache = g(y, portrait.mouthY + .016, .010) * Math.exp(-Math.pow(x / (portrait.mouthWidth * 1.12), 4)) * Math.pow(front, 3);
            beardMask = Math.max(beardMask, moustache);
            beardMask *= 1 - Math.exp(-Math.pow(x / (portrait.mouthWidth * .97), 6)) * g(y, portrait.mouthY, .009);
        }
        let hairRelief = 0;
        if (hairMask > .002)
            for (const lock of hairLocks) {
                const dy = (y - lock.y) / lock.tall, da = signedAngle(angle - lock.angle - (kind === "pushkin" ? 0 : (y - lock.y) * 2)) / lock.wide, distance = da * da + dy * dy;
                if (distance < 5)
                    hairRelief += Math.pow(Math.max(0, lock.relief * Math.exp(-distance * 1.75) - .003 * Math.exp(-((da - .24) ** 2 + (dy + .16) ** 2) / .11)), 4);
            }
        hairRelief = Math.pow(hairRelief, .25);
        const reliefLimit = kind === "pushkin" ? .075 : .022;
        hairRelief = reliefLimit * (1 - Math.exp(-Math.max(0, hairRelief) / reliefLimit));
        const beardRelief = kind === "tolstoy" ? .004 + .004 * Math.pow(.5 + .5 * Math.cos(angle * 22 + Math.sin(y * 51 + angle * 3) * 1.1), 2) + .0015 * Math.cos(angle * 53 + y * 41) : .0018 + .0006 * Math.sin(angle * 67 + y * 143) * Math.cos(angle * 79 - y * 97);
        const displacement = hairMask * ((kind === "pushkin" ? .006 : .0025) + hairRelief) + beardMask * beardRelief;
        if (displacement > 0) {
            const du = basePoint(q, angle + .0005).sub(basePoint(q, angle - .0005));
            const dv = basePoint(clamp(q + .0005, 0, 1), angle).sub(basePoint(clamp(q - .0005, 0, 1), angle));
            const normal = q === 0 ? new THREE.Vector3(0, -1, 0) : q === 1 ? new THREE.Vector3(0, 1, 0) : du.cross(dv).normalize();
            normal.y *= 1 - .74 * fade(q, .89, 1);
            point.addScaledVector(normal, displacement);
        }
        if (kind === "tolstoy")
            point.y += .016 * g(x, 0, .026) * (1 - fade(q, 0, .15)) * front;
        const brows = [-1, 1].reduce((value, side) => Math.max(value, g(x, side * portrait.eyeX, portrait.eyeWidth * 1.05) * g(y, browYAt(x, side), kind === "tolstoy" ? .011 : .006)), 0) * Math.pow(front, 2);
        const lips = g(y, portrait.mouthY, .010) * Math.exp(-Math.pow(x / portrait.mouthWidth, 4)) * Math.pow(front, 6) * (1 - beardMask);
        return { point, hairMask: Math.max(hairMask, beardMask), beardMask, brows: clamp(brows * 1.8, 0, 1), lips };
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
        const headMaterial = finish("painted-ceramic-sculpture", "#ffffff", .46);
        headMaterial.vertexColors = true;
        const skinMaterial = finish("painted-ceramic-facial-detail", portrait.skin, .37), porcelain = finish("unglazed-ivory-contact-and-foot", "#e6e3dc", .40);
        const eyeMaterial = finish("ceramic-eye-white", "#e7e5df", .30), irisMaterial = finish("painted-ceramic-iris", portrait.iris, .32), pupilMaterial = finish("painted-ceramic-pupil", "#242321", .29);
        const skinColor = new THREE.Color(portrait.skin), hairColor = new THREE.Color(portrait.hair), browColor = new THREE.Color(portrait.brow), lipColor = new THREE.Color("#aa7869");
        const positions: number[] = [], colors: number[] = [], uvs: number[] = [], indices: number[] = [], row = detail.radial + 1;
        const pushVertex = (q: number, angle: number) => {
            const sample = surface(q, angle), paint = hairColor.clone().lerp(new THREE.Color("#d2d9d8"), kind === "hemingway" ? sample.beardMask * .65 : 0), color = skinColor.clone().lerp(paint, sample.hairMask).lerp(browColor, sample.brows * .9).lerp(lipColor, sample.lips * .58);
            positions.push(...sample.point.toArray());
            colors.push(color.r, color.g, color.b);
            uvs.push(angle / TAU, q);
        };
        pushVertex(0, Math.PI);
        for (let y = 1; y < detail.rows; y++)
            for (let x = 0; x <= detail.radial; x++)
                pushVertex(y / detail.rows, x / detail.radial * TAU);
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
            const point = (x: number, y: number, z: number) => centre.clone().addScaledVector(horizontal, x).addScaledVector(up, y).addScaledVector(normal, z);
            eyeParts.push(closedPatch(4, detail.patchRadial, (r, angle, outer) => point(Math.cos(angle) * r * portrait.eyeWidth, Math.sin(angle) * r * portrait.eyeHeight, outer ? .007 * Math.sqrt(Math.max(0, 1 - r * r)) : -.003)));
            for (const upper of [true, false]) {
                const points: THREE.Vector3[] = [];
                for (let step = 0; step <= 20; step++) {
                    const t = step / 20;
                    points.push(point((t * 2 - 1) * portrait.eyeWidth, Math.sin(t * Math.PI) * portrait.eyeHeight * (upper ? 1 : -.85), .0005));
                }
                lidParts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), detail.patchRadial, upper ? .0022 : .0016, 6, false));
            }
            const eyeDepth = (x: number, y: number) => .007 * Math.sqrt(Math.max(0, 1 - (x / portrait.eyeWidth) ** 2 - (y / portrait.eyeHeight) ** 2));
            const irisRadius = kind === "tolstoy" ? .0074 : .0088;
            irisParts.push(closedPatch(3, detail.patchRadial, (r, angle, outer) => {
                const x = Math.cos(angle) * r * irisRadius, y = Math.sin(angle) * r * irisRadius * .89;
                return point(x, y, eyeDepth(x, y) + (outer ? .00035 : -.001));
            }));
            pupilParts.push(closedPatch(2, detail.patchRadial, (r, angle, outer) => {
                const x = Math.cos(angle) * r * .0031, y = Math.sin(angle) * r * .0031;
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
