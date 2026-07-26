import * as THREE from "three";

import worldGeoJsonUrl from "../data/geo/countries.geojson?url";
import type { Country } from "../data/countries/types";

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
  geometry: {
    type: "Polygon" | "MultiPolygon";
    coordinates: PolygonCoordinates | MultiPolygonCoordinates;
  };
};

type GeoFeatureCollection = {
  type: "FeatureCollection";
  features: GeoFeature[];
};

export type GlobeAtlas = {
  mapTexture: THREE.CanvasTexture;
  highlightTexture: THREE.CanvasTexture;
  countryAtUv: (uv: THREE.Vector2) => Country | null;
  centroidForCountry: (countryId: string) => [number, number] | null;
  updateHighlight: (selectedCountryId?: string | null, hoveredCountryId?: string | null) => void;
  dispose: () => void;
};

const MAP_WIDTH = 2048;
const MAP_HEIGHT = 1024;
const HIT_WIDTH = 1024;
const HIT_HEIGHT = 512;
let geoJsonPromise: Promise<GeoFeatureCollection> | null = null;

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
    const x = ((lng + 180) / 360) * width + shift;
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

function drawParchmentBackground(context: CanvasRenderingContext2D) {
  const gradient = context.createLinearGradient(0, 0, MAP_WIDTH, MAP_HEIGHT);
  gradient.addColorStop(0, "#5a452f");
  gradient.addColorStop(0.35, "#6f5739");
  gradient.addColorStop(0.7, "#59422d");
  gradient.addColorStop(1, "#33251c");
  context.fillStyle = gradient;
  context.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

  let seed = 86173;
  for (let index = 0; index < 18000; index += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const x = seed % MAP_WIDTH;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const y = seed % MAP_HEIGHT;
    const radius = 0.3 + (seed % 17) / 13;
    const opacity = 0.012 + (seed % 11) / 900;

    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fillStyle = `rgba(244, 214, 153, ${opacity})`;
    context.fill();
  }

  [
    [0.18, 0.34, 0.17],
    [0.62, 0.7, 0.22],
    [0.84, 0.22, 0.13],
  ].forEach(([x, y, strength]) => {
    const stain = context.createRadialGradient(
      MAP_WIDTH * x,
      MAP_HEIGHT * y,
      0,
      MAP_WIDTH * x,
      MAP_HEIGHT * y,
      MAP_WIDTH * 0.18
    );
    stain.addColorStop(0, `rgba(45, 25, 13, ${strength})`);
    stain.addColorStop(1, "rgba(45, 25, 13, 0)");
    context.fillStyle = stain;
    context.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
  });
}

function drawGraticule(context: CanvasRenderingContext2D) {
  context.save();
  context.strokeStyle = "rgba(235, 203, 139, 0.12)";
  context.lineWidth = 1;
  context.setLineDash([4, 7]);

  for (let lng = -150; lng <= 150; lng += 30) {
    const x = ((lng + 180) / 360) * MAP_WIDTH;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, MAP_HEIGHT);
    context.stroke();
  }

  for (let lat = -60; lat <= 60; lat += 30) {
    const y = ((90 - lat) / 180) * MAP_HEIGHT;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(MAP_WIDTH, y);
    context.stroke();
  }

  context.setLineDash([]);
  context.restore();
}

function drawSeaRoutes(context: CanvasRenderingContext2D) {
  const routes = [
    [0.48, 0.34, 0.32, 0.44, 0.2, 0.51],
    [0.52, 0.38, 0.67, 0.31, 0.77, 0.43],
    [0.72, 0.43, 0.82, 0.56, 0.9, 0.63],
  ];

  context.save();
  context.strokeStyle = "rgba(224, 181, 100, 0.17)";
  context.lineWidth = 1.4;
  context.setLineDash([3, 8]);

  routes.forEach(([x1, y1, cx, cy, x2, y2]) => {
    context.beginPath();
    context.moveTo(MAP_WIDTH * x1, MAP_HEIGHT * y1);
    context.quadraticCurveTo(MAP_WIDTH * cx, MAP_HEIGHT * cy, MAP_WIDTH * x2, MAP_HEIGHT * y2);
    context.stroke();
  });

  context.restore();
}

function featureColor(index: number, mapColor = 0) {
  const tone = (index * 17 + mapColor * 11) % 26;
  return `hsl(${34 + (tone % 9)}, ${27 + (tone % 8)}%, ${43 + (tone % 7)}%)`;
}

function makeMapCanvas(features: GeoFeature[]) {
  const canvas = document.createElement("canvas");
  canvas.width = MAP_WIDTH;
  canvas.height = MAP_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable");

  drawParchmentBackground(context);
  drawGraticule(context);
  drawSeaRoutes(context);

  features.forEach((feature, index) => {
    drawFeature(
      context,
      feature,
      MAP_WIDTH,
      MAP_HEIGHT,
      featureColor(index, feature.properties.MAPCOLOR13),
      "rgba(48, 28, 16, 0.72)",
      1.15
    );
  });

  const glaze = context.createRadialGradient(
    MAP_WIDTH * 0.46,
    MAP_HEIGHT * 0.38,
    MAP_WIDTH * 0.08,
    MAP_WIDTH * 0.5,
    MAP_HEIGHT * 0.5,
    MAP_WIDTH * 0.62
  );
  glaze.addColorStop(0, "rgba(255, 229, 176, 0.17)");
  glaze.addColorStop(0.58, "rgba(80, 48, 25, 0)");
  glaze.addColorStop(1, "rgba(25, 15, 10, 0.34)");
  context.fillStyle = glaze;
  context.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

  return canvas;
}

function encodeHitId(value: number) {
  const red = value & 255;
  const green = (value >> 8) & 255;
  const blue = (value >> 16) & 255;
  return `rgb(${red}, ${green}, ${blue})`;
}

function featureCountry(feature: GeoFeature, countriesByCode: Map<string, Country>) {
  const properties = feature.properties;
  const candidateCodes = [properties.ISO_A2, properties.WB_A2, properties.POSTAL]
    .filter((value): value is string => Boolean(value && value !== "-99" && value.length === 2))
    .map((value) => value.toUpperCase());

  if (properties.ADM0_A3 === "NOR") candidateCodes.push("NO");

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

function normalizeLongitude(value: number) {
  return ((((value + 180) % 360) + 360) % 360) - 180;
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
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

export async function createGlobeAtlas(countries: Country[]): Promise<GlobeAtlas> {
  const worldGeoJson = await loadWorldGeoJson();
  const countriesByCode = new Map(
    countries
      .filter((country) => country.code)
      .map((country) => [country.code!.toUpperCase(), country] as const)
  );
  const featuresByCountryId = new Map<string, GeoFeature[]>();
  const hitCountryById = new Map<number, Country>();
  const hitCanvas = document.createElement("canvas");
  hitCanvas.width = HIT_WIDTH;
  hitCanvas.height = HIT_HEIGHT;
  const hitContext = hitCanvas.getContext("2d", { willReadFrequently: true });
  if (!hitContext) throw new Error("Canvas 2D is unavailable");

  hitContext.imageSmoothingEnabled = false;

  worldGeoJson.features.forEach((feature, index) => {
    const country = featureCountry(feature, countriesByCode);
    if (!country) return;

    const countryFeatures = featuresByCountryId.get(country.id) ?? [];
    countryFeatures.push(feature);
    featuresByCountryId.set(country.id, countryFeatures);

    const hitId = index + 1;
    const color = encodeHitId(hitId);
    hitCountryById.set(hitId, country);
    drawFeature(hitContext, feature, HIT_WIDTH, HIT_HEIGHT, color, color, 2.5);
  });

  const hitData = hitContext.getImageData(0, 0, HIT_WIDTH, HIT_HEIGHT).data;
  const mapTexture = configureTexture(new THREE.CanvasTexture(makeMapCanvas(worldGeoJson.features)));
  const highlightCanvas = document.createElement("canvas");
  highlightCanvas.width = MAP_WIDTH;
  highlightCanvas.height = MAP_HEIGHT;
  const highlightContext = highlightCanvas.getContext("2d");
  if (!highlightContext) throw new Error("Canvas 2D is unavailable");
  const highlightTexture = configureTexture(new THREE.CanvasTexture(highlightCanvas));
  const centroids = new Map<string, [number, number] | null>();

  const countryAtUv = (uv: THREE.Vector2) => {
    const x = Math.max(0, Math.min(HIT_WIDTH - 1, Math.floor(uv.x * HIT_WIDTH)));
    const y = Math.max(0, Math.min(HIT_HEIGHT - 1, Math.floor((1 - uv.y) * HIT_HEIGHT)));

    for (let offsetY = -1; offsetY <= 1; offsetY += 1) {
      for (let offsetX = -1; offsetX <= 1; offsetX += 1) {
        const sampleX = Math.max(0, Math.min(HIT_WIDTH - 1, x + offsetX));
        const sampleY = Math.max(0, Math.min(HIT_HEIGHT - 1, y + offsetY));
        const pixelIndex = (sampleY * HIT_WIDTH + sampleX) * 4;
        const hitId =
          hitData[pixelIndex] + (hitData[pixelIndex + 1] << 8) + (hitData[pixelIndex + 2] << 16);
        const country = hitCountryById.get(hitId);
        if (country) return country;
      }
    }

    return null;
  };

  const centroidForCountry = (countryId: string) => {
    if (!centroids.has(countryId)) {
      centroids.set(countryId, featureCentroid(featuresByCountryId.get(countryId) ?? []));
    }
    return centroids.get(countryId) ?? null;
  };

  const drawHighlight = (
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
        MAP_WIDTH,
        MAP_HEIGHT,
        fill,
        stroke,
        lineWidth
      );
    });
    highlightContext.restore();
  };

  const updateHighlight = (selectedCountryId?: string | null, hoveredCountryId?: string | null) => {
    highlightContext.clearRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

    if (selectedCountryId) {
      drawHighlight(selectedCountryId, "rgba(227, 164, 67, 0.34)", "#ffd78c", 2.8, 18);
    }

    if (hoveredCountryId && hoveredCountryId !== selectedCountryId) {
      drawHighlight(hoveredCountryId, "rgba(255, 220, 142, 0.2)", "#f6c96d", 2, 12);
    }

    highlightTexture.needsUpdate = true;
  };

  return {
    mapTexture,
    highlightTexture,
    countryAtUv,
    centroidForCountry,
    updateHighlight,
    dispose: () => {
      mapTexture.dispose();
      highlightTexture.dispose();
    },
  };
}
