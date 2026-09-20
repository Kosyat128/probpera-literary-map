import { Color, DataTexture, EquirectangularReflectionMapping, MeshStandardMaterial, NoColorSpace,
  RGBAFormat, SRGBColorSpace, Texture, UnsignedByteType, Vector3 } from "three";
import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
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
      const reflection = palette.brass.envMap as DataTexture;
      expect(reflection.flipY).toBe(false);
      const { width, height, data } = reflection.image, pixels = data as Uint8Array, linear = new Color();
      const luminance = (x: number, y: number) => {
        const offset = (y * width + x) * 4;
        linear.setRGB(pixels[offset] / 255, pixels[offset + 1] / 255, pixels[offset + 2] / 255, SRGBColorSpace);
        return linear.r * 0.2126 + linear.g * 0.7152 + linear.b * 0.0722;
      };
      // Sample the actual texture using Three's equirectangular direction
      // convention, independently of the procedural field's row order.
      const sample = (direction: Vector3) => {
        const unit = direction.clone().normalize();
        const u = Math.atan2(unit.z, unit.x) / (Math.PI * 2) + 0.5;
        const v = Math.asin(unit.y) / Math.PI + 0.5;
        return luminance(Math.min(width - 1, Math.floor(u * width)), Math.min(height - 1, Math.floor(v * height)));
      };
      const ceiling = sample(new Vector3(0, 1, 0));
      expect(ceiling).toBeGreaterThan(sample(new Vector3(0, -1, 0)));
      let brightest = -1, windowX = 0, windowY = 0;
      for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const value = luminance(x, y);
        if (value > brightest) { brightest = value; windowX = x; windowY = y; }
      }
      const longitude = ((windowX + 0.5) / width - 0.5) * Math.PI * 2;
      const latitude = ((windowY + 0.5) / height - 0.5) * Math.PI;
      const windowDirection = new Vector3(Math.cos(latitude) * Math.cos(longitude), Math.sin(latitude), Math.cos(latitude) * Math.sin(longitude));
      expect(windowDirection.y).toBeGreaterThan(0);
      expect(brightest).toBeGreaterThan(ceiling);
      expect(sample(windowDirection)).toBeGreaterThan(sample(windowDirection.clone().setY(-windowDirection.y)));
      expect(textures.size).toBe(16);
      expect(palette.brass.metalness).toBe(1);
      expect(palette.brass.metalnessMap).toBe(palette.brass.roughnessMap);
      const brassChannels = palette.brass.metalnessMap as DataTexture;
      expect(brassChannels.colorSpace).toBe(NoColorSpace);
      const brassPixels = brassChannels.image.data as Uint8Array;
      let reservedChannels = true, minimumRoughness = 255, maximumRoughness = 0;
      let minimumMetalness = 255, maximumMetalness = 0, roughnessSum = 0, metalnessSum = 0, products = 0;
      for (let offset = 0; offset < brassPixels.length; offset += 4) {
        const roughness = brassPixels[offset + 1], metalness = brassPixels[offset + 2];
        reservedChannels &&= brassPixels[offset] === 255 && brassPixels[offset + 3] === 255;
        minimumRoughness = Math.min(minimumRoughness, roughness); maximumRoughness = Math.max(maximumRoughness, roughness);
        minimumMetalness = Math.min(minimumMetalness, metalness); maximumMetalness = Math.max(maximumMetalness, metalness);
        roughnessSum += roughness; metalnessSum += metalness; products += roughness * metalness;
      }
      expect(reservedChannels).toBe(true);
      expect(maximumRoughness - minimumRoughness).toBeGreaterThan(0);
      expect(maximumMetalness - minimumMetalness).toBeGreaterThan(0);
      // Three reads roughness from G and metalness from B. Oxidation must
      // produce rougher, less metallic patches, not reuse a grayscale gloss
      // tile in both channels. No particular artistic mask is pinned here.
      expect(products * (brassPixels.length / 4) - roughnessSum * metalnessSum).toBeLessThan(0);
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
      const matchingTextures = new Map([...b.textures].map(texture => [texture.name, texture]));
      const texelDigest = (texture: Texture) => createHash("sha256")
        .update((texture as DataTexture).image.data as Uint8Array).digest("hex");
      for (const texture of a.textures) {
        expect(b.textures.has(texture)).toBe(false);
        const counterpart = matchingTextures.get(texture.name);
        expect(counterpart, texture.name).toBeDefined();
        // Independent resource ownership must not make the authored finish
        // flicker with random seeds on each preview/recreation. Compare live
        // outputs, without pinning a particular artistic pattern or palette.
        expect(texelDigest(texture), texture.name).toBe(texelDigest(counterpart!));
      }
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
