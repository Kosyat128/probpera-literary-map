import * as THREE from "three";

export type AntiqueWhaleBodyDetail = Readonly<{
  longitudinalSegments: number;
  radialSegments: number;
}>;

/** Existing bronze-whale shape; callers own and dispose the returned geometry. */
export function createAntiqueWhaleBodyGeometry({
  longitudinalSegments,
  radialSegments,
}: AntiqueWhaleBodyDetail): THREE.BufferGeometry {
  if (
    !Number.isSafeInteger(longitudinalSegments) || longitudinalSegments < 2 || longitudinalSegments > 128 ||
    !Number.isSafeInteger(radialSegments) || radialSegments < 3 || radialSegments > 64
  ) {
    throw new RangeError("Invalid antique whale geometry detail");
  }
  const positions: number[] = [];
  const indices: number[] = [];

  for (let slice = 0; slice <= longitudinalSegments; slice += 1) {
    const progress = slice / longitudinalSegments;
    const profile = Math.pow(Math.sin(Math.PI * progress), 0.52);
    const headFullness =
      0.72 + THREE.MathUtils.smoothstep(progress, 0.48, 0.86) * 0.34;
    const width = 0.275 * profile * headFullness;
    const height =
      0.17 *
      profile *
      (0.88 + THREE.MathUtils.smoothstep(progress, 0.64, 0.92) * 0.1);
    const spineY =
      -1.105 +
      Math.sin(progress * Math.PI) * 0.105 -
      THREE.MathUtils.smoothstep(progress, 0.78, 1) * 0.055;
    const z = THREE.MathUtils.lerp(-0.27, 1.06, progress);

    for (let segment = 0; segment <= radialSegments; segment += 1) {
      const angle = (segment / radialSegments) * Math.PI * 2;
      const lowerJawWeight = Math.sin(angle) < 0 ? 0.9 : 1;
      positions.push(
        Math.cos(angle) * width,
        spineY + Math.sin(angle) * height * lowerJawWeight,
        z
      );
    }
  }

  for (let slice = 0; slice < longitudinalSegments; slice += 1) {
    for (let segment = 0; segment < radialSegments; segment += 1) {
      const row = radialSegments + 1;
      const first = slice * row + segment;
      const second = first + row;
      indices.push(first, second, first + 1, second, second + 1, first + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3)
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
