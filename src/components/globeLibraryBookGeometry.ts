import * as THREE from "three";
import { mergeGeometries, mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";

/** A real bound shell with two standard material groups: leather, then brass.
 * Pages stay separate so their exact dimensions and colour do not inherit the
 * leather's per-volume tint. The caller owns the returned geometry. */
export function createLibraryBookShellGeometry(cover: THREE.BufferGeometry,
  spine: THREE.BufferGeometry, binding: THREE.BufferGeometry): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  let merged: THREE.BufferGeometry | null = null;
  const referenceWidth = 0.25, referenceHeight = 0.8, referenceDepth = 0.469;
  const centerZ = 9.006 + referenceDepth / 2;
  const scale = new THREE.Vector3(), position = new THREE.Vector3();
  const transform = new THREE.Matrix4(), rotation = new THREE.Quaternion();
  const add = (source: THREE.BufferGeometry, x: number, y: number, z: number,
    width: number, height: number, depth: number) => {
    const part = source.clone(); parts.push(part); part.clearGroups();
    if (!part.index) part.setIndex(Array.from({ length: part.getAttribute("position").count }, (_, index) => index));
    position.set(x / referenceWidth, y / referenceHeight, (z - centerZ) / referenceDepth);
    scale.set(width / referenceWidth, height / referenceHeight, depth / referenceDepth);
    transform.compose(position, rotation, scale); part.applyMatrix4(transform);
    const vertices = part.getAttribute("position"), normals = part.getAttribute("normal");
    const color = new Float32Array(vertices.count * 3);
    for (let index = 0; index < vertices.count; index++) {
      const ny = normals.getY(index), v = Math.max(0, Math.min(1, vertices.getY(index) + 0.5));
      const shade = (ny < -0.5 ? 0.66 : ny > 0.5 ? 1 : 0.93) * (0.91 + 0.09 * v);
      color.set([shade, shade, shade], index * 3);
    }
    part.setAttribute("color", new THREE.Float32BufferAttribute(color, 3));
  };
  try {
    for (const side of [-1, 1]) add(cover, side * (referenceWidth / 2 - 0.008), 0,
      9.015 + 0.46 / 2, 0.016, referenceHeight, 0.46);
    add(spine, 0, 0, 9.039, referenceWidth - 0.008, referenceHeight - 0.012, 0.06);
    const skinCount = parts.reduce((sum, part) => sum + part.index!.count, 0);
    for (const fraction of [0.18, 0.82]) add(binding, 0, referenceHeight * (fraction - 0.5),
      9.039, referenceWidth - 0.002, 0.014, 0.066);
    merged = mergeGeometries(parts, false);
    if (!merged) throw new Error("Unable to construct library book shell");
    merged.addGroup(0, skinCount, 0);
    merged.addGroup(skinCount, merged.index!.count - skinCount, 1);
    const geometry = mergeVertices(merged, 1e-6);
    geometry.name = "library-bound-book-shell";
    geometry.userData = { provenance: "authored-in-project", materialParts: ["leather", "bindings"] };
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    return geometry;
  } finally {
    for (const part of parts) part.dispose();
    merged?.dispose();
  }
}
