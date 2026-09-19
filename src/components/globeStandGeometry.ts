import * as THREE from "three";
import { isIncludedGlobeStandId, type IncludedGlobeStandId } from "../planet/globeStands";
import type { GlobeQualityTier } from "./globeQuality";

export interface OwnedGlobeStand {
  readonly group: THREE.Group;
  dispose(): void;
}

/** Original untextured supports. All world vertices fit r<=.55, y[-1.44,-1.03]. */
export function createIncludedGlobeStand(id: IncludedGlobeStandId, quality: GlobeQualityTier): OwnedGlobeStand {
  if (!isIncludedGlobeStandId(id) || !["high", "balanced", "economy"].includes(quality)) {
    throw new Error("Invalid included globe stand");
  }
  const segments = quality === "high" ? 48 : quality === "balanced" ? 32 : 20;
  const group = new THREE.Group();
  group.name = `included-globe-stand:${id}`;
  group.userData = { standId: id, provenance: "authored-in-project", qualityTier: quality };
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) material.dispose();
    group.clear();
  };
  const material = (color: string, metalness = 0.08, roughness = 0.55) => {
    const result = new THREE.MeshStandardMaterial({ color, metalness, roughness });
    materials.add(result);
    return result;
  };
  const mesh = (geometry: THREE.BufferGeometry, finish: THREE.Material, y: number, parent: THREE.Group = group) => {
    geometries.add(geometry);
    const result = new THREE.Mesh(geometry, finish);
    result.position.y = y;
    result.raycast = () => undefined;
    parent.add(result);
    return result;
  };
  const cylinder = (radiusTop: number, radiusBottom: number, height: number, y: number, finish: THREE.Material) =>
    mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments), finish, y);

  try {
    if (id === "stand.base.museum") {
      const bronze = material("#8b603f", 0.64, 0.38);
      const dark = material("#352522", 0.24, 0.48);
      cylinder(0.46, 0.48, 0.06, -1.41, dark);
      cylinder(0.30, 0.36, 0.08, -1.34, bronze);
      cylinder(0.062, 0.09, 0.22, -1.19, dark);
      cylinder(0.15, 0.11, 0.05, -1.055, bronze);
    } else if (id === "stand.base.wood") {
      const wood = material("#835331", 0.02, 0.66);
      const edge = material("#bc8550", 0.03, 0.56);
      const profile = [
        [0, -1.44], [0.44, -1.44], [0.44, -1.40], [0.35, -1.375],
        [0.22, -1.35], [0.13, -1.30], [0.08, -1.23], [0.075, -1.15],
        [0.11, -1.10], [0.15, -1.08], [0.15, -1.03], [0, -1.03],
      ].map(([radius, y]) => new THREE.Vector2(radius, y));
      mesh(new THREE.LatheGeometry(profile, segments), wood, 0);
      cylinder(0.355, 0.355, 0.012, -1.379, edge);
      cylinder(0.112, 0.112, 0.012, -1.107, edge);
    } else {
      const pages = material("#e1cba3", 0, 0.85);
      const covers = [material("#65354b"), material("#294d52"), material("#9a6737")];
      const widths = [0.78, 0.70, 0.73];
      const depths = [0.48, 0.46, 0.44];
      for (let index = 0; index < 3; index += 1) {
        const book = new THREE.Group();
        book.rotation.y = [-0.09, 0.12, -0.055][index];
        group.add(book);
        const bottom = -1.44 + index * 0.095;
        const width = widths[index], depth = depths[index];
        mesh(new THREE.BoxGeometry(width, 0.012, depth), covers[index], bottom + 0.006, book);
        mesh(new THREE.BoxGeometry(width - 0.035, 0.071, depth - 0.025), pages, bottom + 0.0475, book);
        mesh(new THREE.BoxGeometry(width, 0.012, depth), covers[index], bottom + 0.089, book);
        const spine = mesh(new THREE.BoxGeometry(0.018, 0.071, depth), covers[index], bottom + 0.0475, book);
        spine.position.x = -width / 2 + 0.009;
      }
      const support = material("#8b603f", 0.56, 0.42);
      cylinder(0.08, 0.12, 0.075, -1.1175, support);
      cylinder(0.15, 0.105, 0.05, -1.055, support);
    }
    group.updateMatrixWorld(true);
    return Object.freeze({ group, dispose });
  } catch (error) {
    dispose();
    throw error;
  }
}
