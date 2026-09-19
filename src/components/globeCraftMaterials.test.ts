import { DataTexture, EquirectangularReflectionMapping, MeshStandardMaterial, NoColorSpace,
  RGBAFormat, SRGBColorSpace, Texture, UnsignedByteType } from "three";
import { describe, expect, it, vi } from "vitest";
import { createGlobeCraftMaterials } from "./globeCraftMaterials";

const finishes = ["wood", "darkWood", "brass", "leather", "paper", "stone"] as const;
function paletteResources(palette: ReturnType<typeof createGlobeCraftMaterials>) {
  const materials = finishes.map(name => palette[name]);
  const textures = new Set<Texture>();
  for (const material of materials) for (const value of Object.values(material)) {
    if (value instanceof Texture) textures.add(value);
  }
  return { materials, textures };
}

describe("owned authored craft maps", () => {
  it.each([
    { tier: "high" as const, dimension: 256 },
    { tier: "balanced" as const, dimension: 128 },
    { tier: "economy" as const, dimension: 64 },
  ])("provides correctly encoded, bounded $tier PBR maps rather than external image dependencies", ({ tier, dimension }) => {
    const palette = createGlobeCraftMaterials(tier);
    try {
      const { materials, textures } = paletteResources(palette);
      const normals = new Set<DataTexture>();
      for (const material of materials) {
        expect(material).toBeInstanceOf(MeshStandardMaterial);
        expect(material.name).toMatch(/^original-craft:/);
        expect(material.userData.provenance).toBe("authored-in-project");
        expect([material.metalness, material.roughness, material.normalScale.x, material.normalScale.y].every(Number.isFinite)).toBe(true);
        for (const role of ["map", "roughnessMap", "normalMap", "envMap"] as const) {
          const map = material[role] as DataTexture;
          expect(map, `${material.name}/${role}`).toBeInstanceOf(DataTexture);
          expect(map.image.width).toBe(dimension);
          expect(map.image.height).toBe(role === "envMap" ? dimension / 2 : dimension);
          expect(map.image.data).toBeInstanceOf(Uint8Array);
          expect(map.image.data.byteLength).toBe(map.image.width * map.image.height * 4);
          expect(map.format).toBe(RGBAFormat); expect(map.type).toBe(UnsignedByteType);
          expect(map.colorSpace).toBe(role === "map" || role === "envMap" ? SRGBColorSpace : NoColorSpace);
          expect(map.userData).toMatchObject({ provenance: "authored-in-project", qualityTier: tier });
          if (role === "envMap") expect(map.mapping).toBe(EquirectangularReflectionMapping);
          if (role === "normalMap") normals.add(map);
        }
      }
      expect(palette.wood.map).toBe(palette.darkWood.map);
      expect(palette.wood.normalMap).toBe(palette.darkWood.normalMap);
      expect(new Set(materials.map(material => material.envMap)).size).toBe(1);
      expect(textures.size).toBe(16);
      for (const normal of normals) {
        const pixels = normal.image.data as Uint8Array;
        let unitVectors = true, opaque = true, varying = false;
        for (let index = 0; index < pixels.length; index += 4) {
          const x = pixels[index] / 127.5 - 1, y = pixels[index + 1] / 127.5 - 1, z = pixels[index + 2] / 127.5 - 1;
          unitVectors &&= z > 0 && Math.abs(Math.hypot(x, y, z) - 1) < 0.012;
          opaque &&= pixels[index + 3] === 255;
          varying ||= pixels[index] !== pixels[0] || pixels[index + 1] !== pixels[1] || pixels[index + 2] !== pixels[2];
        }
        expect(unitVectors, normal.name).toBe(true); expect(opaque, normal.name).toBe(true);
        expect(varying, `${normal.name} contains relief`).toBe(true);
      }
      // CPU-authored source maps plus mips, excluding renderer-created PMREM targets.
      const mipBytes = [...textures].reduce((sum, texture) => sum
        + Math.ceil((texture as DataTexture).image.data.byteLength * (texture.generateMipmaps ? 4 / 3 : 1)), 0);
      expect(mipBytes).toBeLessThanOrEqual(5.5 * 1024 ** 2 * (dimension / 256) ** 2);
    } finally { palette.dispose(); }
  });

  it("owns separate palettes and disposes each shared map and material exactly once", () => {
    const first = createGlobeCraftMaterials("economy"), second = createGlobeCraftMaterials("economy");
    const a = paletteResources(first), b = paletteResources(second);
    const listen = (resources: ReturnType<typeof paletteResources>) => [...resources.materials, ...resources.textures].map(resource => {
      const event = vi.fn();
      if (resource instanceof Texture) resource.addEventListener("dispose", event);
      else resource.addEventListener("dispose", event);
      return event;
    });
    const eventsA = listen(a), eventsB = listen(b);
    try {
      for (const texture of a.textures) expect(b.textures.has(texture)).toBe(false);
      for (const material of a.materials) expect(b.materials.includes(material)).toBe(false);
      first.dispose(); first.dispose();
      for (const event of eventsA) expect(event).toHaveBeenCalledOnce();
      for (const event of eventsB) expect(event).not.toHaveBeenCalled();
      second.dispose(); second.dispose();
      for (const event of eventsB) expect(event).toHaveBeenCalledOnce();
      for (const event of eventsA) expect(event).toHaveBeenCalledOnce();
    } finally { first.dispose(); second.dispose(); }
  });
});
