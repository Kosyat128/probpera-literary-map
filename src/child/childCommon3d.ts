import { childDataArray, childRecord, decodeChildEntityReference, type ChildEntityReference } from "./childPackage";

/** A checked static glTF subset, not a general glTF/extension capability. Native
 * admission still owns the signed scene, media rights, profile and deadlines. */
export const COMMON_3D_PROFILE = "gltf2-static-v1";
export type Common3dTierId = "high" | "balanced" | "economy";
export type Common3dMime = "model/gltf+json" | "model/gltf-binary" | "application/octet-stream" | "image/png" | "image/jpeg" | "image/webp";
export interface Common3dResource {
  readonly assetId: string; readonly entity: ChildEntityReference; readonly mime: Common3dMime;
  readonly checksum: string; readonly encodedBytes: number; readonly alias: string; readonly kind: "model" | "buffer" | "texture";
}
export interface Common3dModel {
  readonly slotId: "stand" | "background"; readonly model: Common3dResource; readonly dependencies: readonly Common3dResource[];
  readonly bounds: Readonly<{ min: readonly number[]; max: readonly number[] }>;
}
export interface Common3dTier {
  readonly tier: Common3dTierId; readonly maxDecodedBytes: number; readonly maxTriangles: number; readonly models: readonly Common3dModel[];
}
export interface Common3dPackage {
  readonly schemaVersion: 1; readonly packageId: string; readonly packageVersion: number; readonly minAppVersion: 1;
  readonly formatProfile: typeof COMMON_3D_PROFILE; readonly tiers: readonly Common3dTier[];
}
const id = (x: unknown): x is string => typeof x === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}$/u.test(x);
const integer = (x: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): x is number => typeof x === "number" && Number.isSafeInteger(x) && !Object.is(x, -0) && x >= min && x <= max;
const extension = { "model/gltf+json": "gltf", "model/gltf-binary": "glb", "application/octet-stream": "bin", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
export function decodeCommon3dResource(raw: unknown, slotId: string): Common3dResource | null {
  const r = childRecord(raw, ["assetId", "entity", "mime", "checksum", "encodedBytes", "alias", "kind"]), e = r && decodeChildEntityReference(r.entity);
  if (!r || !e || e.kind !== slotId || !id(r.assetId) || typeof r.checksum !== "string" || !/^[a-f0-9]{64}$/u.test(r.checksum)
    || !integer(r.encodedBytes, 1, 33_554_432) || typeof r.mime !== "string" || !Object.hasOwn(extension, r.mime)
    || typeof r.alias !== "string" || !/^[a-z0-9][a-z0-9_-]{0,63}\.(gltf|glb|bin|png|jpg|webp)$/u.test(r.alias)
    || !r.alias.endsWith("." + extension[r.mime as Common3dMime])
    || (r.kind === "model" ? !r.mime.startsWith("model/") : r.kind === "buffer" ? r.mime !== "application/octet-stream" : r.kind !== "texture" || !r.mime.startsWith("image/"))) return null;
  return Object.freeze({ ...r, entity: e }) as unknown as Common3dResource;
}
export function decodeCommon3dPackage(raw: unknown): Common3dPackage | null {
  try {
    const p = childRecord(raw, ["schemaVersion", "packageId", "packageVersion", "minAppVersion", "formatProfile", "tiers"]), ts = p && childDataArray(p.tiers, 3);
    if (!p || p.schemaVersion !== 1 || !id(p.packageId) || !integer(p.packageVersion, 1) || p.minAppVersion !== 1 || p.formatProfile !== COMMON_3D_PROFILE || ts?.length !== 3) return null;
    const tiers: Common3dTier[] = [], identities = new Map<string, string>();
    for (const [i, rawTier] of ts.entries()) {
      const t = childRecord(rawTier, ["tier", "maxDecodedBytes", "maxTriangles", "models"]), ms = t && childDataArray(t.models, 2);
      if (!t || t.tier !== ["high", "balanced", "economy"][i] || !integer(t.maxDecodedBytes, 1, 67_108_864) || !integer(t.maxTriangles, 1, 200_000) || !ms?.length) return null;
      const models: Common3dModel[] = [], slots = new Set<string>(); let encoded = 0;
      for (const rawModel of ms) {
        const m = childRecord(rawModel, ["slotId", "model", "dependencies", "bounds"]), b = m && childRecord(m.bounds, ["min", "max"]);
        const min = b && childDataArray(b.min, 3), max = b && childDataArray(b.max, 3);
        if (!m || !["stand", "background"].includes(m.slotId as string) || slots.has(m.slotId as string) || !min || !max || min.length !== 3 || max.length !== 3
          || [...min, ...max].some(n => typeof n !== "number" || !Number.isFinite(n) || Object.is(n, -0) || Math.abs(n) > 12)
          || min.some((n, k) => (n as number) > (max[k] as number))) return null;
        slots.add(m.slotId as string);
        // A room may surround the globe, so its global box can contain the
        // origin. Actual indexed world triangles independently enforce globe
        // clearance after all checked dependency bytes are available.
        if (m.slotId === "stand" && (max[1] as number) > -1.05) return null;
        const model = decodeCommon3dResource(m.model, m.slotId as string), ds = childDataArray(m.dependencies, 16);
        if (!model || model.kind !== "model" || !ds) return null;
        const dependencies: Common3dResource[] = [], aliases = new Set([model.alias]), assetIds = new Set([model.assetId]);
        for (const d of ds) { const r = decodeCommon3dResource(d, m.slotId as string); if (!r || r.kind === "model" || aliases.has(r.alias) || assetIds.has(r.assetId)) return null; if (t.tier !== "economy" && r.mime === "image/webp") return null; aliases.add(r.alias); assetIds.add(r.assetId); dependencies.push(r); }
        for (const r of [model, ...dependencies]) {
          const key = JSON.stringify([r.entity, r.mime, r.checksum, r.encodedBytes, r.kind]), prior = identities.get(r.assetId);
          if (prior && prior !== key) return null; identities.set(r.assetId, key); encoded += r.encodedBytes;
        }
        models.push(Object.freeze({ slotId: m.slotId as Common3dModel["slotId"], model, dependencies: Object.freeze(dependencies), bounds: Object.freeze({ min: Object.freeze(min as number[]), max: Object.freeze(max as number[]) }) }));
      }
      if (encoded > 67_108_864) return null;
      tiers.push(Object.freeze({ tier: t.tier as Common3dTierId, maxDecodedBytes: t.maxDecodedBytes, maxTriangles: t.maxTriangles, models: Object.freeze(models) }));
    }
    if (identities.size > 64) return null;
    return Object.freeze({ schemaVersion: 1, packageId: p.packageId, packageVersion: p.packageVersion, minAppVersion: 1, formatProfile: COMMON_3D_PROFILE, tiers: Object.freeze(tiers) });
  } catch { return null; }
}

function demand(ok: unknown, message: string): asserts ok { if (!ok) throw new Error("Common 3D: " + message); }
/** Fatal UTF8, duplicate fields and bounded structure before JSON projection. */
export function parseCommon3dJson(bytes: Uint8Array): Record<string, unknown> {
  demand(bytes.length > 0 && bytes.length <= 1_048_576, "JSON byte budget");
  const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes), stack: (Set<string> | null)[] = [];
  let key = false, tokens = 0;
  for (const match of source.matchAll(/"(?:\\.|[^"\\])*"|[{}\[\],:]|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/gu)) {
    demand(++tokens <= 100_000, "JSON structure"); const token = match[0];
    if (token === "{") { stack.push(new Set()); key = true; }
    else if (token === "[") { stack.push(null); key = false; }
    else if (token === "}" || token === "]") { stack.pop(); key = false; }
    else if (token === ",") key = stack.at(-1) !== null;
    else if (token === ":") key = false;
    else if (token.startsWith('"') && key) { const decoded = JSON.parse(token); const set = stack.at(-1); demand(set && !set.has(decoded), "duplicate JSON field"); set.add(decoded); key = false; }
    demand(stack.length <= 16, "JSON depth");
  }
  const value: unknown = JSON.parse(source); demand(value && typeof value === "object" && !Array.isArray(value), "JSON object");
  return value as Record<string, unknown>;
}
export interface Common3dPrimitive { positions: Float32Array; normals: Float32Array | null; uv: Float32Array | null; indices: Uint32Array; material: number | null }
export interface Common3dDocument {
  readonly raw: Record<string, unknown>; readonly meshes: readonly (readonly Common3dPrimitive[])[];
  readonly decodedBytes: number; readonly triangles: number;
}
type Obj = Record<string, any>;
function fields(raw: unknown, required: string[], optional: string[] = []): Obj {
  demand(raw && typeof raw === "object" && !Array.isArray(raw), "object");
  demand(Object.keys(raw).every(k => [...required, ...optional].includes(k)) && required.every(k => Object.hasOwn(raw, k)), "closed glTF fields");
  return raw as Obj;
}
function list(raw: unknown, max: number): any[] { demand(Array.isArray(raw) && raw.length <= max, "glTF array budget"); return raw; }
function offset(raw: unknown, fallback = 0): number { const n = raw === undefined ? fallback : raw; demand(integer(n, 0, 33_554_432), "glTF offset"); return n; }
/** The compiler and actual renderer use this same decoding profile. External
 * fetch, extension decoders and unbounded GLTFLoader callbacks are absent. */
export function decodeCommon3dModel(bytes: Uint8Array, descriptor: Common3dModel, buffers: ReadonlyMap<string, Uint8Array>, budget: Pick<Common3dTier, "maxDecodedBytes" | "maxTriangles">): Common3dDocument {
  demand(bytes.length === descriptor.model.encodedBytes, "model length");
  let raw: Obj, internal: Uint8Array | null = null;
  if (descriptor.model.mime === "model/gltf-binary") {
    const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    demand(bytes.length >= 28 && v.getUint32(0, true) === 0x46546c67 && v.getUint32(4, true) === 2 && v.getUint32(8, true) === bytes.length, "GLB header");
    const n = v.getUint32(12, true); demand(n % 4 === 0 && n <= 1_048_576 && 20 + n <= bytes.length && v.getUint32(16, true) === 0x4e4f534a, "GLB JSON chunk");
    raw = parseCommon3dJson(bytes.subarray(20, 20 + n)); const pos = 20 + n;
    if (pos < bytes.length) { demand(pos + 8 <= bytes.length && v.getUint32(pos + 4, true) === 0x004e4942, "GLB binary chunk"); const size = v.getUint32(pos, true); demand(size % 4 === 0 && pos + 8 + size === bytes.length, "GLB exact closure"); internal = bytes.subarray(pos + 8); }
  } else { demand(descriptor.model.mime === "model/gltf+json", "checked model format"); raw = parseCommon3dJson(bytes); }
  fields(raw, ["asset", "scene", "scenes", "nodes", "meshes", "buffers", "bufferViews", "accessors"], ["materials", "textures", "images", "samplers"]);
  const asset = fields(raw.asset, ["version"], ["generator"]); demand(asset.version === "2.0", "glTF version");
  if (descriptor.model.mime === "model/gltf-binary") demand(internal && Array.isArray(raw.buffers) && raw.buffers.length === 1 && raw.buffers[0]?.uri === undefined, "embedded-only GLB buffer profile");
  const declared = new Map(descriptor.dependencies.map(r => [r.alias, r])), used = new Set<string>();
  const sources = list(raw.buffers, 16).map((b: unknown, i: number) => {
    const row = fields(b, ["byteLength"], ["uri"]); demand(integer(row.byteLength, 1, 33_554_432), "buffer bytes");
    let data: Uint8Array | undefined;
    if (row.uri === undefined) { demand(i === 0 && internal && raw.buffers.length === 1, "one embedded GLB buffer"); data = internal!; demand(data.length - row.byteLength < 4, "GLB padding"); }
    else { demand(typeof row.uri === "string" && declared.get(row.uri)?.kind === "buffer", "declared buffer alias"); used.add(row.uri); data = buffers.get(row.uri); }
    demand(data && data.length >= row.byteLength && (row.uri === undefined || data.length === row.byteLength), "exact acquired buffer"); return data!;
  });
  const views = list(raw.bufferViews, 256).map(b => { const v = fields(b, ["buffer", "byteLength"], ["byteOffset", "byteStride", "target"]); demand(integer(v.buffer, 0, sources.length - 1) && integer(v.byteLength, 1, 33_554_432) && offset(v.byteOffset) + v.byteLength <= raw.buffers[v.buffer].byteLength, "bufferView range"); if (v.byteStride !== undefined) demand(integer(v.byteStride, 4, 252) && v.byteStride % 4 === 0, "buffer stride"); if (v.target !== undefined) demand([34962, 34963].includes(v.target), "buffer target"); return v; });
  const accessors = list(raw.accessors, 512); let decodedBytes = 0;
  function decode(index: unknown, type: "VEC3" | "VEC2" | "SCALAR", indices = false): Float32Array | Uint32Array {
    demand(integer(index, 0, accessors.length - 1), "accessor index"); const a = fields(accessors[index], ["bufferView", "componentType", "count", "type"], ["byteOffset", "min", "max", "normalized"]);
    demand(a.type === type && integer(a.count, 1, 600_000) && integer(a.bufferView, 0, views.length - 1) && (a.normalized === undefined || a.normalized === false), "accessor type/count");
    demand(indices ? [5121, 5123, 5125].includes(a.componentType) : a.componentType === 5126, "accessor component");
    const size = a.componentType === 5121 ? 1 : a.componentType === 5123 ? 2 : 4, width = type === "VEC3" ? 3 : type === "VEC2" ? 2 : 1;
    const view = views[a.bufferView], stride = view.byteStride ?? size * width, start = offset(a.byteOffset);
    demand(stride >= size * width && stride % size === 0 && start % size === 0 && offset(view.byteOffset) % size === 0 && start + (a.count - 1) * stride + size * width <= view.byteLength, "accessor byte range/alignment");
    decodedBytes += a.count * width * 4; demand(decodedBytes <= budget.maxDecodedBytes, "decoded byte budget");
    const output = indices ? new Uint32Array(a.count) : new Float32Array(a.count * width), data = sources[view.buffer], dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
    for (let n = 0; n < a.count; n++) for (let c = 0; c < width; c++) {
      const at = offset(view.byteOffset) + start + n * stride + c * size;
      const value = indices ? size === 1 ? dv.getUint8(at) : size === 2 ? dv.getUint16(at, true) : dv.getUint32(at, true) : dv.getFloat32(at, true);
      demand(Number.isFinite(value) && (indices || Math.abs(value) <= 12), "finite bounded decoded value"); output[n * width + c] = value;
    }
    return output;
  }
  let triangles = 0;
  const materials = list(raw.materials ?? [], 64);
  const meshes = list(raw.meshes, 64).map(m => list(fields(m, ["primitives"], ["name"]).primitives, 32).map(p => {
    const prim = fields(p, ["attributes", "indices"], ["mode", "material"]), a = fields(prim.attributes, ["POSITION"], ["NORMAL", "TEXCOORD_0"]);
    demand(prim.mode === undefined || prim.mode === 4, "triangle topology"); const positions = decode(a.POSITION, "VEC3") as Float32Array;
    const normals = a.NORMAL === undefined ? null : decode(a.NORMAL, "VEC3") as Float32Array, uv = a.TEXCOORD_0 === undefined ? null : decode(a.TEXCOORD_0, "VEC2") as Float32Array;
    if (!normals) { decodedBytes += positions.byteLength; demand(decodedBytes <= budget.maxDecodedBytes, "generated normal budget"); }
    const ix = decode(prim.indices, "SCALAR", true) as Uint32Array;
    demand(ix.length % 3 === 0 && ix.every(n => n < positions.length / 3) && (!normals || normals.length === positions.length) && (!uv || uv.length / 2 === positions.length / 3), "triangle index/attribute bounds");
    triangles += ix.length / 3; demand(triangles <= budget.maxTriangles, "triangle budget"); if (prim.material !== undefined) demand(integer(prim.material, 0, materials.length - 1), "material reference");
    return { positions, normals, uv, indices: ix, material: prim.material ?? null };
  }));
  demand(meshes.length > 0 && triangles > 0, "actual mesh geometry");
  const images = list(raw.images ?? [], 16), textures = list(raw.textures ?? [], 16), samplers = list(raw.samplers ?? [], 16);
  for (const image of images) { const r = fields(image, ["uri"]); demand(typeof r.uri === "string" && declared.get(r.uri)?.kind === "texture", "declared texture alias"); used.add(r.uri); }
  for (const t of textures) { const r = fields(t, ["source"], ["sampler"]); demand(integer(r.source, 0, images.length - 1) && (r.sampler === undefined || integer(r.sampler, 0, samplers.length - 1)), "texture reference"); }
  for (const sampler of samplers) { const s = fields(sampler, [], ["magFilter", "minFilter", "wrapS", "wrapT"]); demand((s.magFilter === undefined || [9728, 9729].includes(s.magFilter)) && (s.minFilter === undefined || [9728, 9729, 9984, 9985, 9986, 9987].includes(s.minFilter)) && [s.wrapS, s.wrapT].every(n => n === undefined || [33071, 33648, 10497].includes(n)), "sampler capability"); }
  for (const m of materials) {
    const r = fields(m, [], ["name", "pbrMetallicRoughness", "doubleSided"]), pbr = fields(r.pbrMetallicRoughness ?? {}, [], ["baseColorFactor", "metallicFactor", "roughnessFactor", "baseColorTexture"]);
    demand(r.doubleSided === undefined || typeof r.doubleSided === "boolean", "material side");
    if (pbr.baseColorFactor !== undefined) demand(list(pbr.baseColorFactor, 4).length === 4 && pbr.baseColorFactor.every((n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1) && pbr.baseColorFactor[3] === 1, "opaque PBR color");
    for (const f of ["metallicFactor", "roughnessFactor"]) demand(pbr[f] === undefined || typeof pbr[f] === "number" && Number.isFinite(pbr[f]) && pbr[f] >= 0 && pbr[f] <= 1, "PBR factor");
    if (pbr.baseColorTexture !== undefined) { const r = fields(pbr.baseColorTexture, ["index"], ["texCoord"]); demand(integer(r.index, 0, textures.length - 1) && (r.texCoord === undefined || r.texCoord === 0), "material texture reference"); }
  }
  for (const primitives of meshes) for (const primitive of primitives) {
    if (primitive.material !== null && materials[primitive.material].pbrMetallicRoughness?.baseColorTexture !== undefined) demand(primitive.uv, "textured geometry requires UV coordinates");
  }
  const nodes = list(raw.nodes, 128), parents = new Set<number>();
  for (const n of nodes) { const row = fields(n, [], ["name", "mesh", "children", "translation", "rotation", "scale"]); if (row.mesh !== undefined) demand(integer(row.mesh, 0, meshes.length - 1), "node mesh"); for (const [f, count] of [["translation", 3], ["rotation", 4], ["scale", 3]] as const) if (row[f] !== undefined) demand(list(row[f], count).length === count && row[f].every((v: unknown) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= (f === "rotation" ? 1 : 12)) && (f !== "scale" || row.scale.every((v: number) => v > 0)) && (f !== "rotation" || Math.abs(Math.hypot(...row.rotation) - 1) < 0.0001), "node transform"); for (const c of list(row.children ?? [], 128)) { demand(integer(c, 0, nodes.length - 1) && !parents.has(c), "single node parent"); parents.add(c); } }
  const scenes = list(raw.scenes, 1); demand(scenes.length === 1 && raw.scene === 0, "one model scene"); const roots = list(fields(scenes[0], ["nodes"], ["name"]).nodes, 128), visited = new Set<number>();
  const walk = (i: number, depth: number) => { demand(integer(i, 0, nodes.length - 1) && depth <= 16 && !visited.has(i), "acyclic exact node tree"); visited.add(i); for (const c of nodes[i].children ?? []) walk(c, depth + 1); };
  for (const root of roots) { demand(!parents.has(root), "actual model root"); walk(root, 0); } demand(visited.size === nodes.length && roots.length > 0, "closed node graph");
  // Bounds and draw costs use the actual transformed instances, so a signed
  // descriptor cannot hide geometry behind a nested translation or mesh reuse.
  let renderedTriangles = 0;
  function transform(point: number[], node: Obj): number[] {
    const scale = node.scale ?? [1, 1, 1], q = node.rotation ?? [0, 0, 0, 1], t = node.translation ?? [0, 0, 0];
    const [x, y, z] = point.map((v, i) => v * scale[i]), [qx, qy, qz, qw] = q;
    const ix = qw*x + qy*z - qz*y, iy = qw*y + qz*x - qx*z, iz = qw*z + qx*y - qy*x, iw = -qx*x - qy*y - qz*z;
    return [ix*qw + iw*(-qx) + iy*(-qz) - iz*(-qy) + t[0], iy*qw + iw*(-qy) + iz*(-qx) - ix*(-qz) + t[1], iz*qw + iw*(-qz) + ix*(-qy) - iy*(-qx) + t[2]];
  }
  // Closest-point regions on an actual triangle, including its interior.
  // Vertex distance alone would admit a large face passing through the globe.
  function triangleDistanceSquared(a: number[], b: number[], c: number[]): number {
    const sub = (p: number[], q: number[]) => p.map((v, k) => v - q[k]);
    const dot = (p: number[], q: number[]) => p.reduce((sum, v, k) => sum + v * q[k], 0);
    const at = (origin: number[], edge: number[], t: number) => origin.map((v, k) => v + edge[k] * t);
    const squared = (p: number[]) => dot(p, p), ab = sub(b, a), ac = sub(c, a);
    const cross = [ab[1]*ac[2]-ab[2]*ac[1], ab[2]*ac[0]-ab[0]*ac[2], ab[0]*ac[1]-ab[1]*ac[0]];
    demand(squared(cross) > 1e-20, "nondegenerate rendered triangle");
    const ap = a.map(v => -v), d1 = dot(ab, ap), d2 = dot(ac, ap);
    if (d1 <= 0 && d2 <= 0) return squared(a);
    const bp = b.map(v => -v), d3 = dot(ab, bp), d4 = dot(ac, bp);
    if (d3 >= 0 && d4 <= d3) return squared(b);
    const vc = d1*d4-d3*d2;
    if (vc <= 0 && d1 >= 0 && d3 <= 0) return squared(at(a, ab, d1/(d1-d3)));
    const cp = c.map(v => -v), d5 = dot(ab, cp), d6 = dot(ac, cp);
    if (d6 >= 0 && d5 <= d6) return squared(c);
    const vb = d5*d2-d1*d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0) return squared(at(a, ac, d2/(d2-d6)));
    const va = d3*d6-d5*d4;
    if (va <= 0 && d4-d3 >= 0 && d5-d6 >= 0) return squared(at(b, sub(c, b), (d4-d3)/((d4-d3)+(d5-d6))));
    const inverse = 1/(va+vb+vc);
    return squared(a.map((v, k) => v + ab[k]*vb*inverse + ac[k]*vc*inverse));
  }
  function world(i: number, ancestors: Obj[]) {
    const node = nodes[i], chain = [...ancestors, node];
    if (node.mesh !== undefined) for (const primitive of meshes[node.mesh]) {
      renderedTriangles += primitive.indices.length / 3; demand(renderedTriangles <= budget.maxTriangles, "instance triangle budget");
      const point = (index: number) => {
        let value = Array.from(primitive.positions.subarray(index * 3, index * 3 + 3));
        for (let n = chain.length - 1; n >= 0; n--) value = transform(value, chain[n]);
        demand(value.every((v, k) => Number.isFinite(v) && Math.abs(v) <= 12 && v >= descriptor.bounds.min[k] - .0001 && v <= descriptor.bounds.max[k] + .0001), "transformed signed model bounds");
        return value;
      };
      for (let p = 0; p < primitive.positions.length / 3; p++) point(p);
      for (let p = 0; p < primitive.indices.length; p += 3) {
        const distance = triangleDistanceSquared(point(primitive.indices[p]), point(primitive.indices[p + 1]), point(primitive.indices[p + 2]));
        if (descriptor.slotId === "background") demand(Number.isFinite(distance) && distance >= 1.35 * 1.35 - 1e-8, "actual background triangle globe clearance");
      }
    }
    for (const child of node.children ?? []) world(child, chain);
  }
  for (const root of roots) world(root, []); demand(renderedTriangles > 0, "rendered model geometry");
  demand(used.size === declared.size && [...declared.keys()].every(alias => used.has(alias)), "no missing/orphan dependency");
  return { raw, meshes, decodedBytes, triangles: renderedTriangles };
}
