import * as THREE from "three";

import worldGeoJsonUrl from "../data/geo/countries.geojson?url";
import type { Country } from "../data/countries/types";
import type { InterfaceLanguage } from "../i18n/InterfaceLanguage";
import {
  buildSphericalOutlinePositions,
  geometryContainsGeographicPoint,
  GLOBE_TEXTURE_FLIP_Y,
  longitudeToTextureX,
  normalizeLongitude,
  partitionGeometryAtGeographicPoint,
  uvToGeographic,
  type GlobeGeoGeometry,
} from "./globeGeography";

type Position = [number, number];
type LinearRing = Position[];
type PolygonCoordinates = LinearRing[];
type MultiPolygonCoordinates = PolygonCoordinates[];

type GeoFeature = {
  type: "Feature";
  properties: {
    NAME?: string;
    ISO_A2?: string;
    WB_A2?: string;
    POSTAL?: string;
    ADM0_A3?: string;
    MAPCOLOR13?: number;
  };
  geometry: GlobeGeoGeometry;
};

type GeoFeatureProperties = GeoFeature["properties"];

type GeoFeatureCollection = {
  type: "FeatureCollection";
  features: GeoFeature[];
};

export const GLOBE_VISUAL_STYLES = ["antique", "earth", "modern"] as const;

export type GlobeVisualStyle = (typeof GLOBE_VISUAL_STYLES)[number];

export const MODERN_GLOBE_EDITION = {
  year: 2026,
  source: "Natural Earth",
  sourceVersion: "5.1.2",
  scale: "1:110m",
} as const;

export function isGlobeVisualStyle(value: unknown): value is GlobeVisualStyle {
  return GLOBE_VISUAL_STYLES.some((style) => style === value);
}

export function globeTextureAssetName(
  style: GlobeVisualStyle,
  compact: boolean,
  language: InterfaceLanguage = "ru"
): string | null {
  if (style === "modern") {
    return `textures/modern-atlas-2026-${language}${compact ? "-mobile" : ""}.webp`;
  }

  const basename =
    style === "earth" ? "earth-blue-marble" : "antique-world-1887";
  return `textures/${basename}${compact ? "-mobile" : ""}.webp`;
}

export type GlobeAtlas = {
  mapTexture: THREE.CanvasTexture;
  reliefTexture: THREE.CanvasTexture;
  highlightTexture: THREE.CanvasTexture;
  countryAtUv: (uv: THREE.Vector2) => Country | null;
  countryAtGeographicCoordinates: (longitude: number, latitude: number) => Country | null;
  geographicCoordinatesAtUv: (uv: THREE.Vector2) => [longitude: number, latitude: number];
  centroidForCountry: (countryId: string) => [number, number] | null;
  outlineGeometryForCountry: (countryId: string) => THREE.BufferGeometry | null;
  updateHighlight: (selectedCountryId?: string | null, hoveredCountryId?: string | null) => void;
  setVisualStyle: (
    style: GlobeVisualStyle,
    language?: InterfaceLanguage
  ) => Promise<void>;
  dispose: () => void;
};

const DESKTOP_MAP_WIDTH = 4096;
const DESKTOP_MAP_HEIGHT = 2048;
const COMPACT_MAP_WIDTH = 2048;
const COMPACT_MAP_HEIGHT = 1024;
let geoJsonPromise: Promise<GeoFeatureCollection> | null = null;
const globeMapPromises = new Map<string, Promise<HTMLImageElement>>();

function loadWorldGeoJson() {
  if (!geoJsonPromise) {
    geoJsonPromise = fetch(worldGeoJsonUrl).then(async (response) => {
      if (!response.ok) {
        throw new Error(`World atlas failed to load: ${response.status}`);
      }
      return (await response.json()) as GeoFeatureCollection;
    });
  }
  return geoJsonPromise;
}

function loadGlobeMap(
  style: GlobeVisualStyle,
  compact: boolean,
  language: InterfaceLanguage
) {
  const assetName = globeTextureAssetName(style, compact, language);
  if (!assetName) return Promise.resolve<HTMLImageElement | null>(null);

  let pendingImage = globeMapPromises.get(assetName);
  if (!pendingImage) {
    pendingImage = new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.decoding = "async";
      image.fetchPriority = "high";
      image.onload = () => {
        globeMapPromises.delete(assetName);
        resolve(image);
      };
      image.onerror = () => {
        globeMapPromises.delete(assetName);
        reject(new Error(`Globe texture failed to load: ${assetName}`));
      };
      image.src = `${import.meta.env.BASE_URL}${assetName}`;
    });
    globeMapPromises.set(assetName, pendingImage);
  }

  return pendingImage;
}

function getPolygons(feature: GeoFeature): MultiPolygonCoordinates {
  if (feature.geometry.type === "Polygon") {
    return [feature.geometry.coordinates as PolygonCoordinates];
  }

  return feature.geometry.coordinates as MultiPolygonCoordinates;
}

function unwrapRing(ring: LinearRing): LinearRing {
  if (ring.length < 2) return ring;

  const result: LinearRing = [[ring[0][0], ring[0][1]]];
  let previous = ring[0][0];

  for (let index = 1; index < ring.length; index += 1) {
    const [, lat] = ring[index];
    let lng = ring[index][0];

    while (lng - previous > 180) lng -= 360;
    while (lng - previous < -180) lng += 360;

    result.push([lng, lat]);
    previous = lng;
  }

  return result;
}

function traceRing(
  context: CanvasRenderingContext2D,
  ring: LinearRing,
  width: number,
  height: number,
  shift: number
) {
  const points = unwrapRing(ring);

  points.forEach(([lng, lat], index) => {
    const x = longitudeToTextureX(lng, width) + shift;
    const y = ((90 - lat) / 180) * height;

    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });

  context.closePath();
}

function drawFeature(
  context: CanvasRenderingContext2D,
  feature: GeoFeature,
  width: number,
  height: number,
  fill: string,
  stroke: string,
  lineWidth: number
) {
  getPolygons(feature).forEach((polygon) => {
    [-width, 0, width].forEach((shift) => {
      context.beginPath();
      polygon.forEach((ring) => traceRing(context, ring, width, height, shift));
      context.fillStyle = fill;
      context.fill("evenodd");
      context.strokeStyle = stroke;
      context.lineWidth = lineWidth;
      context.lineJoin = "round";
      context.stroke();
    });
  });
}

function polygonTextureBounds(
  polygon: PolygonCoordinates,
  width: number,
  height: number,
  shift: number
) {
  const points = polygon.flatMap((ring) => unwrapRing(ring));
  if (!points.length) return null;

  const xs = points.map(
    ([longitude]) => longitudeToTextureX(longitude, width) + shift
  );
  const ys = points.map(([, latitude]) => ((90 - latitude) / 180) * height);
  return {
    left: Math.min(...xs),
    top: Math.min(...ys),
    width: Math.max(1, Math.max(...xs) - Math.min(...xs)),
    height: Math.max(1, Math.max(...ys) - Math.min(...ys)),
  };
}

function drawFlagInsideFeatures(
  context: CanvasRenderingContext2D,
  features: GeoFeature[],
  flagImage: HTMLImageElement,
  width: number,
  height: number,
  opacity: number
) {
  const polygons = features.flatMap((feature) => getPolygons(feature));
  const principalPolygon = polygons.reduce<PolygonCoordinates | null>(
    (largest, polygon) => {
      if (!polygon[0]?.length) return largest;
      if (!largest?.[0]?.length) return polygon;
      return ringMetrics(polygon[0]).area > ringMetrics(largest[0]).area
        ? polygon
        : largest;
    },
    null
  );
  if (!principalPolygon) return;

  [-width, 0, width].forEach((shift) => {
    const bounds = polygonTextureBounds(principalPolygon, width, height, shift);
    if (!bounds || bounds.width < 0.5 || bounds.height < 0.5) return;

    context.save();
    context.beginPath();
    polygons.forEach((polygon) => {
      polygon.forEach((ring) => traceRing(context, ring, width, height, shift));
    });
    context.clip("evenodd");
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    const pixelArea = bounds.width * bounds.height;
    context.globalAlpha =
      pixelArea < 260 ? Math.min(0.64, opacity * 1.55) : opacity;
    context.drawImage(
      flagImage,
      bounds.left,
      bounds.top,
      bounds.width,
      bounds.height
    );
    context.restore();
  });
}

function drawParchmentBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  const gradient = context.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#9f682d");
  gradient.addColorStop(0.22, "#c08a43");
  gradient.addColorStop(0.55, "#a86f30");
  gradient.addColorStop(0.8, "#855224");
  gradient.addColorStop(1, "#58361d");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height);

  let seed = 86173;
  for (let index = 0; index < 30000; index += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const x = seed % width;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const y = seed % height;
    const radius = 0.25 + (seed % 19) / 11;
    const opacity = 0.014 + (seed % 13) / 780;

    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle =
      index % 3 === 0
        ? `rgba(68, 37, 17, ${opacity})`
        : `rgba(255, 225, 158, ${opacity})`;
    context.fill();
  }

  [
    [0.18, 0.34, 0.15],
    [0.62, 0.7, 0.18],
    [0.84, 0.22, 0.12],
    [0.43, 0.12, 0.09],
  ].forEach(([x, y, strength]) => {
    const stain = context.createRadialGradient(
      width * x,
      height * y,
      0,
      width * x,
      height * y,
      width * 0.16
    );
    stain.addColorStop(0, `rgba(52, 25, 10, ${strength})`);
    stain.addColorStop(1, "rgba(45, 25, 13, 0)");
    context.fillStyle = stain;
    context.fillRect(0, 0, width, height);
  });

  context.save();
  context.globalAlpha = 0.12;
  context.strokeStyle = "#f7d592";
  context.lineWidth = 0.7;
  for (let y = 4; y < height; y += 7) {
    context.beginPath();
    context.moveTo(0, y);
    context.bezierCurveTo(
      width * 0.28,
      y + ((y * 17) % 9) - 4,
      width * 0.72,
      y - ((y * 11) % 7) + 3,
      width,
      y
    );
    context.stroke();
  }
  context.restore();
}

function drawGraticule(
  context: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  context.save();
  context.setLineDash([]);

  for (let lng = -165; lng <= 165; lng += 15) {
    const x = ((lng + 180) / 360) * width;
    const major = lng % 30 === 0;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.strokeStyle = major
      ? "rgba(55, 29, 12, 0.31)"
      : "rgba(246, 214, 151, 0.16)";
    context.lineWidth = major ? 1.25 : 0.72;
    context.stroke();
  }

  for (let lat = -75; lat <= 75; lat += 15) {
    const y = ((90 - lat) / 180) * height;
    const major = lat % 30 === 0;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.strokeStyle = major
      ? "rgba(55, 29, 12, 0.31)"
      : "rgba(246, 214, 151, 0.16)";
    context.lineWidth = major ? 1.25 : 0.72;
    context.stroke();
  }

  const equatorY = height / 2;
  context.beginPath();
  context.moveTo(0, equatorY - 3);
  context.lineTo(width, equatorY - 3);
  context.moveTo(0, equatorY + 3);
  context.lineTo(width, equatorY + 3);
  context.strokeStyle = "rgba(48, 24, 10, 0.48)";
  context.lineWidth = 1.6;
  context.stroke();

  const tropicOffset = (23.436 / 180) * height;
  [equatorY - tropicOffset, equatorY + tropicOffset].forEach((y) => {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.strokeStyle = "rgba(67, 34, 13, 0.25)";
    context.lineWidth = 1;
    context.setLineDash([7, 6]);
    context.stroke();
  });

  context.restore();
}

function featureColor(index: number, mapColor = 0) {
  const palette = [
    "#b77b3b",
    "#9b7142",
    "#af6d43",
    "#87764a",
    "#be8745",
    "#977147",
    "#b06e35",
    "#8b6744",
    "#c08b4c",
    "#9a5f3e",
  ];
  return palette[(index * 7 + mapColor * 3) % palette.length];
}

export function modernFeatureColor(mapColor = 0, index = 0) {
  const palette = [
    "#d4df86",
    "#9fd08d",
    "#e7c36f",
    "#d7976b",
    "#84c5aa",
    "#b7acd0",
    "#b6d27e",
    "#7fb9c5",
    "#e3b36c",
    "#a8c68b",
    "#c49fc1",
    "#8fc4a0",
    "#d5cc7b",
  ];
  const mapColorIndex = Number.isFinite(mapColor) && mapColor > 0
    ? Math.floor(mapColor) - 1
    : index;
  return palette[((mapColorIndex % palette.length) + palette.length) % palette.length];
}

function drawModernBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  const background = context.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, "#2aa5d5");
  background.addColorStop(0.42, "#168fc7");
  background.addColorStop(0.72, "#0c78b2");
  background.addColorStop(1, "#176d9d");
  context.fillStyle = background;
  context.fillRect(0, 0, width, height);

  const glow = context.createRadialGradient(
    width * 0.61,
    height * 0.38,
    0,
    width * 0.61,
    height * 0.38,
    width * 0.54
  );
  glow.addColorStop(0, "rgba(224, 249, 255, 0.16)");
  glow.addColorStop(0.52, "rgba(114, 205, 238, 0.06)");
  glow.addColorStop(1, "rgba(6, 67, 101, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);
}

function drawModernGraticule(
  context: CanvasRenderingContext2D,
  width: number,
  height: number
) {
  context.save();
  context.setLineDash([]);
  const scale = width / DESKTOP_MAP_WIDTH;
  const minorWidth = Math.max(0.55, 0.82 * scale);
  const majorWidth = Math.max(0.78, 1.16 * scale);

  for (let longitude = -150; longitude <= 150; longitude += 30) {
    const x = longitudeToTextureX(longitude, width);
    const major = longitude % 90 === 0;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, height);
    context.strokeStyle = major
      ? "rgba(49, 92, 120, 0.26)"
      : "rgba(47, 96, 126, 0.14)";
    context.lineWidth = major ? majorWidth : minorWidth;
    context.stroke();
  }

  for (let latitude = -60; latitude <= 60; latitude += 30) {
    const y = ((90 - latitude) / 180) * height;
    const major = latitude % 90 === 0;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.strokeStyle = major
      ? "rgba(49, 92, 120, 0.26)"
      : "rgba(47, 96, 126, 0.14)";
    context.lineWidth = major ? majorWidth : minorWidth;
    context.stroke();
  }

  const accent = "rgba(181, 72, 62, 0.54)";
  context.beginPath();
  context.moveTo(0, height / 2);
  context.lineTo(width, height / 2);
  context.strokeStyle = accent;
  context.lineWidth = Math.max(0.9, 1.4 * scale);
  context.stroke();

  const primeMeridianX = longitudeToTextureX(0, width);
  context.beginPath();
  context.moveTo(primeMeridianX, 0);
  context.lineTo(primeMeridianX, height);
  context.strokeStyle = accent;
  context.lineWidth = Math.max(0.72, 1.05 * scale);
  context.stroke();

  context.setLineDash([Math.max(5, 10 * scale), Math.max(5, 9 * scale)]);
  for (const latitude of [-66.562, -23.436, 23.436, 66.562]) {
    const y = ((90 - latitude) / 180) * height;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(width, y);
    context.strokeStyle = "rgba(69, 111, 131, 0.18)";
    context.lineWidth = minorWidth;
    context.stroke();
  }
  context.restore();
}

function drawMapCanvas(
  canvas: HTMLCanvasElement,
  features: GeoFeature[],
  style: GlobeVisualStyle,
  sourceMap: HTMLImageElement | null
) {
  const { width, height } = canvas;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable");

  context.clearRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  if (style === "modern") {
    if (sourceMap) {
      context.drawImage(sourceMap, 0, 0, width, height);
      return;
    }

    drawModernBackground(context, width, height);
    drawModernGraticule(context, width, height);
    const borderWidth = width >= DESKTOP_MAP_WIDTH ? 1.7 : 1.05;
    features.forEach((feature, index) => {
      drawFeature(
        context,
        feature,
        width,
        height,
        modernFeatureColor(feature.properties.MAPCOLOR13, index),
        "rgba(41, 76, 99, 0.72)",
        borderWidth
      );
    });

    const glaze = context.createRadialGradient(
      width * 0.46,
      height * 0.36,
      width * 0.04,
      width * 0.5,
      height * 0.5,
      width * 0.64
    );
    glaze.addColorStop(0, "rgba(255, 255, 245, 0.08)");
    glaze.addColorStop(0.58, "rgba(130, 201, 224, 0)");
    glaze.addColorStop(1, "rgba(3, 45, 69, 0.16)");
    context.fillStyle = glaze;
    context.fillRect(0, 0, width, height);
    return;
  }

  if (sourceMap) {
    context.drawImage(sourceMap, 0, 0, width, height);
  } else {
    drawParchmentBackground(context, width, height);
    drawGraticule(context, width, height);
    features.forEach((feature, index) => {
      drawFeature(
        context,
        feature,
        width,
        height,
        featureColor(index, feature.properties.MAPCOLOR13),
        "rgba(46, 24, 11, 0.72)",
        1.2
      );
    });
  }

  const isEarth = style === "earth";
  features.forEach((feature) => {
    drawFeature(
      context,
      feature,
      width,
      height,
      "rgba(0, 0, 0, 0)",
      isEarth ? "rgba(145, 207, 232, 0.14)" : "rgba(62, 30, 13, 0.24)",
      isEarth ? 0.68 : 0.86
    );
  });

  const glaze = context.createRadialGradient(
    width * 0.46,
    height * 0.38,
    width * 0.08,
    width * 0.5,
    height * 0.5,
    width * 0.62
  );
  if (isEarth) {
    glaze.addColorStop(0, "rgba(130, 198, 230, 0.055)");
    glaze.addColorStop(0.6, "rgba(12, 49, 83, 0)");
    glaze.addColorStop(1, "rgba(0, 8, 22, 0.15)");
  } else {
    glaze.addColorStop(0, "rgba(255, 224, 154, 0.14)");
    glaze.addColorStop(0.54, "rgba(105, 55, 20, 0)");
    glaze.addColorStop(1, "rgba(37, 16, 8, 0.24)");
  }
  context.fillStyle = glaze;
  context.fillRect(0, 0, width, height);
}

function makeMapCanvas(
  features: GeoFeature[],
  style: GlobeVisualStyle,
  sourceMap: HTMLImageElement | null,
  width: number,
  height: number
) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  drawMapCanvas(canvas, features, style, sourceMap);
  return canvas;
}

function makeReliefCanvas(features: GeoFeature[], width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable");

  context.fillStyle = "#353535";
  context.fillRect(0, 0, width, height);

  features.forEach((feature) => {
    drawFeature(
      context,
      feature,
      width,
      height,
      "#777777",
      "#8d8d8d",
      1.2
    );
  });

  let seed = 44119;
  for (let index = 0; index < 14000; index += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const x = seed % width;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const y = seed % height;
    const light = 80 + (seed % 34);
    context.fillStyle = `rgba(${light}, ${light}, ${light}, 0.16)`;
    context.fillRect(x, y, 1.2, 1.2);
  }

  return canvas;
}

export function featureCountryCodeCandidates(
  properties: GeoFeatureProperties
): string[] {
  const candidateCodes = [properties.ISO_A2, properties.WB_A2]
    .filter((value): value is string => Boolean(value && value !== "-99" && value.length === 2))
    .map((value) => value.toUpperCase());

  if (properties.ADM0_A3 === "NOR") candidateCodes.push("NO");
  if (properties.ADM0_A3 === "KOS") candidateCodes.push("XK");

  return [...new Set(candidateCodes)];
}

function featureCountry(feature: GeoFeature, countriesByCode: Map<string, Country>) {
  const candidateCodes = featureCountryCodeCandidates(feature.properties);

  for (const code of candidateCodes) {
    const country = countriesByCode.get(code);
    if (country) return country;
  }

  return null;
}

function ringMetrics(ring: LinearRing) {
  const points = unwrapRing(ring);
  let areaTwice = 0;
  let centroidX = 0;
  let centroidY = 0;

  for (let index = 0; index < points.length - 1; index += 1) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[index + 1];
    const cross = x1 * y2 - x2 * y1;
    areaTwice += cross;
    centroidX += (x1 + x2) * cross;
    centroidY += (y1 + y2) * cross;
  }

  if (Math.abs(areaTwice) < 0.0001) {
    const pointCount = Math.max(points.length, 1);
    const average = points.reduce(
      (sum, [lng, lat]) => [sum[0] + lng, sum[1] + lat] as Position,
      [0, 0] as Position
    );
    return {
      area: 0,
      centroid: [average[0] / pointCount, average[1] / pointCount] as Position,
    };
  }

  return {
    area: Math.abs(areaTwice / 2),
    centroid: [centroidX / (3 * areaTwice), centroidY / (3 * areaTwice)] as Position,
  };
}

function featureCentroid(features: GeoFeature[]): [number, number] | null {
  let largestArea = -1;
  let selected: Position | null = null;

  features.forEach((feature) => {
    getPolygons(feature).forEach((polygon) => {
      const outerRing = polygon[0];
      if (!outerRing?.length) return;
      const metrics = ringMetrics(outerRing);

      if (metrics.area > largestArea) {
        largestArea = metrics.area;
        selected = metrics.centroid;
      }
    });
  });

  if (!selected) return null;
  return [selected[1], normalizeLongitude(selected[0])];
}

function configureTexture(texture: THREE.CanvasTexture) {
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.flipY = GLOBE_TEXTURE_FLIP_Y;
  texture.anisotropy = 8;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function configureReliefTexture(texture: THREE.CanvasTexture) {
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.flipY = GLOBE_TEXTURE_FLIP_Y;
  texture.anisotropy = 8;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

async function loadVisualStyleMap(
  style: GlobeVisualStyle,
  compact: boolean,
  language: InterfaceLanguage
) {
  try {
    return await loadGlobeMap(style, compact, language);
  } catch (error) {
    // Antique and Modern both have deterministic procedural fallbacks. Earth
    // must never silently masquerade as another surface when its NASA asset is
    // missing.
    if (style === "antique" || style === "modern") return null;
    throw error;
  }
}

export async function createGlobeAtlas(
  countries: Country[],
  initialVisualStyle: GlobeVisualStyle = "antique",
  initialLanguage: InterfaceLanguage = "ru"
): Promise<GlobeAtlas> {
  const compact = window.innerWidth <= 900;
  const [worldGeoJson, sourceMap] = await Promise.all([
    loadWorldGeoJson(),
    loadVisualStyleMap(initialVisualStyle, compact, initialLanguage),
  ]);
  const countriesByCode = new Map(
    countries
      .filter((country) => country.code)
      .map((country) => [country.code!.toUpperCase(), country] as const)
  );
  const mapWidth =
    sourceMap?.naturalWidth ||
    (compact ? COMPACT_MAP_WIDTH : DESKTOP_MAP_WIDTH);
  const mapHeight =
    sourceMap?.naturalHeight ||
    (compact ? COMPACT_MAP_HEIGHT : DESKTOP_MAP_HEIGHT);
  const countriesById = new Map(
    countries.map((country) => [country.id, country] as const)
  );
  const featuresByCountryId = new Map<string, GeoFeature[]>();
  const selectableFeatures: Array<{ feature: GeoFeature; country: Country }> = [];

  worldGeoJson.features.forEach((feature) => {
    const country = featureCountry(feature, countriesByCode);
    if (!country) return;

    const countryFeatures = featuresByCountryId.get(country.id) ?? [];
    countryFeatures.push(feature);
    featuresByCountryId.set(country.id, countryFeatures);

    // Natural Earth stores metropolitan France and French Guiana in one FRA
    // MultiPolygon. France keeps its complete sovereign outline, but a click on
    // the South American polygon opens the territory's own literary profile.
    if (feature.properties.ADM0_A3 === "FRA") {
      const frenchGuiana = countriesByCode.get("GF");
      const { matching, remainder } = partitionGeometryAtGeographicPoint(
        feature.geometry,
        -52.3135,
        4.9224
      );

      if (frenchGuiana && matching) {
        const frenchGuianaFeature: GeoFeature = {
          ...feature,
          properties: {
            ...feature.properties,
            NAME: "French Guiana",
            ISO_A2: "GF",
            WB_A2: "GF",
            POSTAL: "GF",
          },
          geometry: matching,
        };
        featuresByCountryId.set(frenchGuiana.id, [frenchGuianaFeature]);
        selectableFeatures.push({
          feature: frenchGuianaFeature,
          country: frenchGuiana,
        });
      }

      if (remainder) {
        selectableFeatures.push({
          feature: { ...feature, geometry: remainder },
          country,
        });
      }
      return;
    }

    selectableFeatures.push({ feature, country });
  });

  const mapCanvas = makeMapCanvas(
    worldGeoJson.features,
    initialVisualStyle,
    sourceMap,
    mapWidth,
    mapHeight
  );
  const mapTexture = configureTexture(new THREE.CanvasTexture(mapCanvas));
  const reliefWidth = Math.min(mapWidth, COMPACT_MAP_WIDTH);
  const reliefHeight = Math.min(mapHeight, COMPACT_MAP_HEIGHT);
  const reliefTexture = configureReliefTexture(
    new THREE.CanvasTexture(
      makeReliefCanvas(worldGeoJson.features, reliefWidth, reliefHeight)
    )
  );
  const highlightCanvas = document.createElement("canvas");
  const highlightWidth = Math.min(mapWidth, COMPACT_MAP_WIDTH);
  const highlightHeight = Math.min(mapHeight, COMPACT_MAP_HEIGHT);
  highlightCanvas.width = highlightWidth;
  highlightCanvas.height = highlightHeight;
  const highlightContext = highlightCanvas.getContext("2d");
  if (!highlightContext) throw new Error("Canvas 2D is unavailable");
  const highlightTexture = configureTexture(new THREE.CanvasTexture(highlightCanvas));
  const centroids = new Map<string, [number, number] | null>();
  const outlineGeometries = new Map<string, THREE.BufferGeometry | null>();
  const flagImages = new Map<string, HTMLImageElement>();
  const pendingFlagImages = new Map<string, Promise<HTMLImageElement | null>>();
  let activeSelectedCountryId: string | null = null;
  let activeHoveredCountryId: string | null = null;
  let disposed = false;
  let flagPreloadTimer: number | null = null;
  let activeVisualStyle = initialVisualStyle;
  let activeLanguage = initialLanguage;
  let visualStyleRequest = 0;

  const countryAtGeographicCoordinates = (longitude: number, latitude: number) => {
    for (const { feature, country } of selectableFeatures) {
      if (geometryContainsGeographicPoint(feature.geometry, longitude, latitude)) {
        return country;
      }
    }

    return null;
  };

  const geographicCoordinatesAtUv = (uv: THREE.Vector2) => uvToGeographic(uv);

  const countryAtUv = (uv: THREE.Vector2) => {
    const [longitude, latitude] = geographicCoordinatesAtUv(uv);
    return countryAtGeographicCoordinates(longitude, latitude);
  };

  const centroidForCountry = (countryId: string) => {
    if (!centroids.has(countryId)) {
      centroids.set(countryId, featureCentroid(featuresByCountryId.get(countryId) ?? []));
    }
    return centroids.get(countryId) ?? null;
  };

  const outlineGeometryForCountry = (countryId: string) => {
    if (!outlineGeometries.has(countryId)) {
      const features = featuresByCountryId.get(countryId) ?? [];
      const positions = buildSphericalOutlinePositions(
        features.map((feature) => feature.geometry)
      );

      if (!positions.length) {
        outlineGeometries.set(countryId, null);
      } else {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.computeBoundingSphere();
        outlineGeometries.set(countryId, geometry);
      }
    }

    return outlineGeometries.get(countryId) ?? null;
  };

  const loadFlagImage = (countryId: string) => {
    const loaded = flagImages.get(countryId);
    if (loaded) return Promise.resolve(loaded);

    const pending = pendingFlagImages.get(countryId);
    if (pending) return pending;

    const countryCode = countriesById.get(countryId)?.code?.trim().toLowerCase();
    if (!countryCode || !/^[a-z]{2}$/.test(countryCode)) {
      return Promise.resolve(null);
    }

    const promise = new Promise<HTMLImageElement | null>((resolve) => {
      const image = new Image();
      image.decoding = "async";
      image.fetchPriority = "low";
      image.onload = () => {
        flagImages.set(countryId, image);
        pendingFlagImages.delete(countryId);
        resolve(image);
      };
      image.onerror = () => {
        pendingFlagImages.delete(countryId);
        resolve(null);
      };
      image.src = `${import.meta.env.BASE_URL}assets/country-flags/${countryCode}.svg`;
    });
    pendingFlagImages.set(countryId, promise);
    return promise;
  };

  const flagPreloadQueue = [
    ...new Set(selectableFeatures.map(({ country }) => country.id)),
  ];
  let flagPreloadCursor = 0;
  const preloadFlagBatch = async () => {
    if (disposed || flagPreloadCursor >= flagPreloadQueue.length) return;
    const batch = flagPreloadQueue.slice(flagPreloadCursor, flagPreloadCursor + 8);
    flagPreloadCursor += batch.length;
    await Promise.all(batch.map((countryId) => loadFlagImage(countryId)));
    if (!disposed && flagPreloadCursor < flagPreloadQueue.length) {
      flagPreloadTimer = window.setTimeout(() => {
        void preloadFlagBatch();
      }, 180);
    }
  };
  flagPreloadTimer = window.setTimeout(() => {
    void preloadFlagBatch();
  }, 900);

  const drawFlagHighlight = (
    countryId: string,
    opacity: number,
    stroke: string,
    lineWidth: number,
    glow: number
  ) => {
    const features = featuresByCountryId.get(countryId) ?? [];
    const flagImage = flagImages.get(countryId);

    highlightContext.save();
    highlightContext.shadowColor = stroke;
    highlightContext.shadowBlur = glow;
    if (flagImage) {
      drawFlagInsideFeatures(
        highlightContext,
        features,
        flagImage,
        highlightWidth,
        highlightHeight,
        opacity
      );
    }
    features.forEach((feature) => {
      drawFeature(
        highlightContext,
        feature,
        highlightWidth,
        highlightHeight,
        flagImage ? "rgba(255, 255, 255, 0.025)" : "rgba(255, 255, 255, 0.055)",
        stroke,
        lineWidth
      );
    });
    highlightContext.restore();

    if (!flagImage) {
      void loadFlagImage(countryId).then(() => {
        if (
          !disposed &&
          (activeSelectedCountryId === countryId ||
            activeHoveredCountryId === countryId)
        ) {
          redrawHighlights();
        }
      });
    }
  };

  const drawModernHighlight = (
    countryId: string,
    fill: string,
    stroke: string,
    lineWidth: number,
    glow: number
  ) => {
    const features = featuresByCountryId.get(countryId) ?? [];
    highlightContext.save();
    highlightContext.shadowColor = stroke;
    highlightContext.shadowBlur = glow;
    features.forEach((feature) => {
      drawFeature(
        highlightContext,
        feature,
        highlightWidth,
        highlightHeight,
        fill,
        stroke,
        lineWidth
      );
    });
    highlightContext.restore();
  };

  const redrawHighlights = () => {
    highlightContext.clearRect(0, 0, highlightWidth, highlightHeight);

    if (activeSelectedCountryId) {
      if (activeVisualStyle === "modern") {
        drawModernHighlight(
          activeSelectedCountryId,
          "rgba(246, 145, 77, 0.28)",
          "#ffb177",
          3,
          9
        );
      } else {
        drawFlagHighlight(
          activeSelectedCountryId,
          0.42,
          "#ff9b2f",
          3.2,
          10
        );
      }
    }

    if (
      activeHoveredCountryId &&
      activeHoveredCountryId !== activeSelectedCountryId
    ) {
      if (activeVisualStyle === "modern") {
        drawModernHighlight(
          activeHoveredCountryId,
          "rgba(100, 217, 199, 0.16)",
          "#91e8da",
          2.2,
          6
        );
      } else {
        drawFlagHighlight(
          activeHoveredCountryId,
          0.28,
          "#ffb24c",
          2.2,
          7
        );
      }
    }

    highlightTexture.needsUpdate = true;
  };

  const updateHighlight = (
    selectedCountryId?: string | null,
    hoveredCountryId?: string | null
  ) => {
    activeSelectedCountryId = selectedCountryId ?? null;
    activeHoveredCountryId = hoveredCountryId ?? null;
    redrawHighlights();
  };

  const setVisualStyle = async (
    style: GlobeVisualStyle,
    language: InterfaceLanguage = activeLanguage
  ) => {
    const request = ++visualStyleRequest;
    if (
      style === activeVisualStyle &&
      (style !== "modern" || language === activeLanguage)
    ) {
      return;
    }

    const nextMap = await loadVisualStyleMap(style, compact, language);
    if (disposed || request !== visualStyleRequest) return;

    drawMapCanvas(mapCanvas, worldGeoJson.features, style, nextMap);
    activeVisualStyle = style;
    activeLanguage = language;
    mapTexture.needsUpdate = true;
    redrawHighlights();
  };

  return {
    mapTexture,
    reliefTexture,
    highlightTexture,
    countryAtUv,
    countryAtGeographicCoordinates,
    geographicCoordinatesAtUv,
    centroidForCountry,
    outlineGeometryForCountry,
    updateHighlight,
    setVisualStyle,
    dispose: () => {
      disposed = true;
      visualStyleRequest += 1;
      if (flagPreloadTimer !== null) window.clearTimeout(flagPreloadTimer);
      mapTexture.dispose();
      reliefTexture.dispose();
      highlightTexture.dispose();
      outlineGeometries.forEach((geometry) => geometry?.dispose());
      outlineGeometries.clear();
    },
  };
}
