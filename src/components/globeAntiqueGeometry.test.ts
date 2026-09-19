import { createHash } from "node:crypto";
import type { BufferGeometry } from "three";
import { describe, expect, it } from "vitest";
import { createAntiqueWhaleBodyGeometry } from "./globeAntiqueGeometry";
import { resolveGlobeQualityProfile } from "./globeQuality";

// Independent pre-change fixture, calculated once with locked Three r178 from
// 8ca9f7e5ccd0fb96ec689e11ab4acae980ff7306:src/components/LiteraryGlobe.tsx.
// createWhaleBodyGeometry source: UTF-8 Git bytes, from its function declaration
// to before createWhaleTailGeometry, trimEnd(); 1805 bytes, SHA256:
// 1df651dfdb476441a2f3cf5009862128d213c1404eeae00276cb2d21c827f3ab.
// Only the two ': number[]' annotations were removed to evaluate that function.
// Hashes cover the original typed-array bytes, not the new helper's output.
const ORIGINAL_HIGH = Object.freeze({
  position: "2f3c4fd4b757efe2d1cbb5d08076cb62e997caf0d8b92beb9344708065103ecf",
  normal: "ea0fce0b59ef2d68e28feb3bcdff92576692bf54d92a7a0aa69eb81acf583847",
  index: "15a8eb32b6c2933408c8ce497b19d4e98061b2410ab847244b8e057681054230",
});

const digest = (array: ArrayBufferView) => createHash("sha256")
  .update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength)).digest("hex");

function expectUsableMesh(geometry: BufferGeometry, vertices: number, indices: number) {
  const positions = geometry.getAttribute("position");
  const normals = geometry.getAttribute("normal");
  const index = geometry.getIndex()!;
  expect(positions.itemSize).toBe(3);
  expect(positions.count).toBe(vertices);
  expect(normals.itemSize).toBe(3);
  expect(normals.count).toBe(vertices);
  expect(index.count).toBe(indices);
  expect(index.array).toBeInstanceOf(Uint16Array);
  expect(positions.array.every(Number.isFinite)).toBe(true);
  expect(normals.array.every(Number.isFinite)).toBe(true);
  expect(index.array.every((value) => Number.isInteger(value) && value >= 0 && value < vertices)).toBe(true);
  expect(index.array.includes(0)).toBe(true);
  expect(index.array.includes(vertices - 1)).toBe(true);

  const sphere = geometry.boundingSphere!;
  expect(sphere).not.toBeNull();
  expect(sphere.center.toArray().every(Number.isFinite)).toBe(true);
  expect(Number.isFinite(sphere.radius)).toBe(true);
  expect(sphere.radius).toBeGreaterThan(0.6);
  expect(sphere.radius).toBeLessThan(0.8);
  let allVerticesInside = true;
  let allNormalsUsable = true;
  for (let vertex = 0; vertex < vertices; vertex += 1) {
    const distance = Math.hypot(positions.getX(vertex) - sphere.center.x,
      positions.getY(vertex) - sphere.center.y, positions.getZ(vertex) - sphere.center.z);
    allVerticesInside &&= distance <= sphere.radius + 1e-6;
    const normalLength = Math.hypot(normals.getX(vertex), normals.getY(vertex), normals.getZ(vertex));
    // Collapsed end-cap triangles may have zero normals; other normals are unit vectors.
    allNormalsUsable &&= normalLength === 0 || Math.abs(normalLength - 1) < 1e-5;
  }
  expect(allVerticesInside).toBe(true);
  expect(allNormalsUsable).toBe(true);
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  expect(box.min.toArray().every(Number.isFinite)).toBe(true);
  expect(box.max.toArray().every(Number.isFinite)).toBe(true);
  expect(box.min.x).toBeGreaterThanOrEqual(-0.3);
  expect(box.max.x).toBeLessThanOrEqual(0.3);
  expect(box.min.y).toBeGreaterThanOrEqual(-1.3);
  expect(box.max.y).toBeLessThanOrEqual(-0.8);
  expect(box.min.z).toBeCloseTo(-0.27, 6);
  expect(box.max.z).toBeCloseTo(1.06, 6);
}

describe("antique whale detail without a change to the canonical high shape", () => {
  it("preserves every original high position, index and computed normal byte", () => {
    const profile = resolveGlobeQualityProfile();
    const geometry = createAntiqueWhaleBodyGeometry({
      longitudinalSegments: profile.antiqueWhaleLongitudinalSegments,
      radialSegments: profile.antiqueWhaleRadialSegments,
    });
    try {
      expectUsableMesh(geometry, 735, 4080);
      const position = geometry.getAttribute("position").array;
      const normal = geometry.getAttribute("normal").array;
      const index = geometry.getIndex()!.array;
      expect([position.byteLength, normal.byteLength, index.byteLength]).toEqual([8820, 8820, 8160]);
      expect({ position: digest(position), normal: digest(normal), index: digest(index) }).toEqual(ORIGINAL_HIGH);
      expect(geometry.boundingSphere!.center.toArray()).toEqual([0, -1.0217723846435547, 0.3949999660253525]);
      expect(geometry.boundingSphere!.radius).toBe(0.6792141293454612);
    } finally {
      geometry.dispose();
    }
  });

  it.each([
    { tier: "balanced" as const, vertices: 459, indices: 2496, attributeBytes: 5508, indexBytes: 4992 },
    { tier: "economy" as const, vertices: 247, indices: 1296, attributeBytes: 2964, indexBytes: 2592 },
  ])("$tier reduces actual buffer bytes while retaining finite bounded geometry", ({ tier, vertices, indices, attributeBytes, indexBytes }) => {
    const profile = resolveGlobeQualityProfile(tier);
    const geometry = createAntiqueWhaleBodyGeometry({
      longitudinalSegments: profile.antiqueWhaleLongitudinalSegments,
      radialSegments: profile.antiqueWhaleRadialSegments,
    });
    try {
      expectUsableMesh(geometry, vertices, indices);
      expect(geometry.getAttribute("position").array.byteLength).toBe(attributeBytes);
      expect(geometry.getAttribute("normal").array.byteLength).toBe(attributeBytes);
      expect(geometry.getIndex()!.array.byteLength).toBe(indexBytes);
      expect(attributeBytes * 2 + indexBytes).toBeLessThan(25800);
    } finally {
      geometry.dispose();
    }
  });

  it.each([
    { longitudinalSegments: 2, radialSegments: 3, vertices: 12, indices: 36 },
    { longitudinalSegments: 128, radialSegments: 64, vertices: 8385, indices: 49152 },
  ])("keeps the inclusive $longitudinalSegments × $radialSegments limits safe", ({ longitudinalSegments, radialSegments, vertices, indices }) => {
    const geometry = createAntiqueWhaleBodyGeometry({ longitudinalSegments, radialSegments });
    try {
      expectUsableMesh(geometry, vertices, indices);
    } finally {
      geometry.dispose();
    }
  });

  it("rejects fractional, unbounded, out-of-range and coerced counts before generating a mesh", () => {
    const invalid = [-1, 0, 1, 129, 2.5, Number.NaN, Infinity, "34"];
    for (const longitudinalSegments of invalid) {
      expect(() => createAntiqueWhaleBodyGeometry({
        longitudinalSegments: longitudinalSegments as number, radialSegments: 20,
      }), `longitudinalSegments=${String(longitudinalSegments)}`).toThrow(new RangeError("Invalid antique whale geometry detail"));
    }
    for (const radialSegments of [-1, 0, 2, 65, 3.5, Number.NaN, Infinity, "20"]) {
      expect(() => createAntiqueWhaleBodyGeometry({
        longitudinalSegments: 34, radialSegments: radialSegments as number,
      }), `radialSegments=${String(radialSegments)}`).toThrow(new RangeError("Invalid antique whale geometry detail"));
    }
  });
});
