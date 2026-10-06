import * as THREE from "three";
import { decodeCommon3dModel, type Common3dModel, type Common3dTier } from "./childCommon3d";

export interface Common3dImported {
  readonly root: THREE.Group; readonly decodedBytes: number; readonly triangles: number; dispose(): void;
}
/** Converts only the checked profile. No network loaders, additional camera,
 * renderer, geographic transform or extension decoder is created. */
export function importCommon3dModel(bytes: Uint8Array, descriptor: Common3dModel, buffers: ReadonlyMap<string, Uint8Array>, textures: ReadonlyMap<string, THREE.Texture>, tier: Common3dTier): Common3dImported {
  const checked = decodeCommon3dModel(bytes, descriptor, buffers, tier), raw = checked.raw as Record<string, any>;
  const root = new THREE.Group(); root.name = "child-common-3d:" + descriptor.model.assetId;
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), ownedTextures = new Set<THREE.Texture>(), samplerTextures = new Map<number, THREE.Texture>(), imageUses = new Map<string, number>(); let retired = false, extraTextureBytes = 0;
  function dispose() { if (retired) return; retired = true; root.removeFromParent(); root.traverse(o => { o.raycast = () => undefined; o.userData = {}; }); root.clear(); for (const g of geometries) { for (const name of Object.keys(g.attributes)) { g.getAttribute(name).array.fill(0); g.deleteAttribute(name); } g.index?.array.fill(0); g.setIndex(null); g.dispose(); } for (const m of materials) { if (m instanceof THREE.MeshStandardMaterial) m.map = null; m.dispose(); } for (const t of ownedTextures) t.dispose(); geometries.clear(); materials.clear(); ownedTextures.clear(); samplerTextures.clear(); }
  try {
    const declaredMaterials = (raw.materials ?? []).map((m: any) => {
      const pbr = m.pbrMetallicRoughness ?? {}, color = pbr.baseColorFactor ?? [1, 1, 1, 1];
      let map: THREE.Texture | null = null;
      if (pbr.baseColorTexture !== undefined) {
        const textureIndex = pbr.baseColorTexture.index, texture = raw.textures[textureIndex], alias = raw.images[texture.source].uri;
        const source = textures.get(alias); if (!source) throw new Error("Acquired model texture unavailable");
        // Samplers belong to the model, while acquired images remain owned by
        // the transaction. A shared image may use different glTF samplers.
        const sampler = raw.samplers?.[texture.sampler] ?? {};
        map = samplerTextures.get(textureIndex) ?? null;
        if (!map) { map = source.clone(); ownedTextures.add(map); samplerTextures.set(textureIndex, map); const uses = imageUses.get(alias) ?? 0; imageUses.set(alias, uses + 1); if (uses > 0) extraTextureBytes += Math.ceil(source.image.naturalWidth * source.image.naturalHeight * 16 / 3); }
        const wrap = (v: number | undefined) => v === 33071 ? THREE.ClampToEdgeWrapping : v === 33648 ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping;
        const min = new Map<number, THREE.MinificationTextureFilter>([[9728, THREE.NearestFilter], [9729, THREE.LinearFilter], [9984, THREE.NearestMipmapNearestFilter], [9985, THREE.LinearMipmapNearestFilter], [9986, THREE.NearestMipmapLinearFilter], [9987, THREE.LinearMipmapLinearFilter]]);
        map.wrapS = wrap(sampler.wrapS); map.wrapT = wrap(sampler.wrapT); map.magFilter = sampler.magFilter === 9728 ? THREE.NearestFilter : THREE.LinearFilter;
        map.minFilter = min.get(sampler.minFilter) ?? THREE.LinearMipmapLinearFilter; map.flipY = false; map.needsUpdate = true;
      }
      const result = new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(color[0], color[1], color[2], THREE.LinearSRGBColorSpace), map, roughness: pbr.roughnessFactor ?? 1, metalness: pbr.metallicFactor ?? 1, side: m.doubleSided ? THREE.DoubleSide : THREE.FrontSide });
      materials.add(result); return result;
    });
    const defaultMaterial = new THREE.MeshStandardMaterial({ roughness: .9, metalness: 0 }); materials.add(defaultMaterial);
    const meshes = checked.meshes.map(primitives => primitives.map(p => {
      const g = new THREE.BufferGeometry(); geometries.add(g); g.setAttribute("position", new THREE.BufferAttribute(p.positions, 3));
      if (p.normals) g.setAttribute("normal", new THREE.BufferAttribute(p.normals, 3)); else g.computeVertexNormals();
      if (p.uv) g.setAttribute("uv", new THREE.BufferAttribute(p.uv, 2));
      g.setIndex(new THREE.BufferAttribute(p.indices, 1)); g.computeBoundingBox(); g.computeBoundingSphere();
      const material = p.material === null ? defaultMaterial : declaredMaterials[p.material];
      if (material.map && !p.uv) throw new Error("Textured geometry lacks UV coordinates");
      return { geometry: g, material };
    }));
    const nodes = raw.nodes.map((n: any, index: number) => {
      const group = new THREE.Group(); group.name = "common3d-node:" + index;
      if (n.translation) group.position.fromArray(n.translation); if (n.rotation) group.quaternion.fromArray(n.rotation); if (n.scale) group.scale.fromArray(n.scale);
      if (n.mesh !== undefined) for (const p of meshes[n.mesh]) { const mesh = new THREE.Mesh(p.geometry, p.material); mesh.raycast = () => undefined; mesh.castShadow = false; mesh.receiveShadow = true; group.add(mesh); }
      return group;
    });
    raw.nodes.forEach((n: any, i: number) => { for (const child of n.children ?? []) nodes[i].add(nodes[child]); });
    for (const index of raw.scenes[0].nodes) root.add(nodes[index]); root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(root), expected = new THREE.Box3(new THREE.Vector3().fromArray(descriptor.bounds.min), new THREE.Vector3().fromArray(descriptor.bounds.max));
    if (bounds.isEmpty() || ![bounds.min.x, bounds.min.y, bounds.min.z, bounds.max.x, bounds.max.y, bounds.max.z].every(Number.isFinite)
      || !expected.clone().expandByScalar(.0001).containsBox(bounds)) throw new Error("Model violates signed clearance bounds");
    if (checked.decodedBytes + extraTextureBytes > tier.maxDecodedBytes) throw new Error("Model sampler decoded budget");
    return Object.freeze({ root, decodedBytes: checked.decodedBytes + extraTextureBytes, triangles: checked.triangles, dispose });
  } catch (error) { dispose(); throw error; }
}
