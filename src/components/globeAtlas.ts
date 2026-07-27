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

const MAP_WIDTH = 3072;
const MAP_HEIGHT = 1536;
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
  gradient.addColorStop(0, "#9f682d");
  gradient.addColorStop(0.22, "#c08a43");
  gradient.addColorStop(0.55, "#a86f30");
  gradient.addColorStop(0.8, "#855224");
  gradient.addColorStop(1, "#58361d");
  context.fillStyle = gradient;
  context.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

  let seed = 86173;
  for (let index = 0; index < 30000; index += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const x = seed % MAP_WIDTH;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const y = seed % MAP_HEIGHT;
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
      MAP_WIDTH * x,
      MAP_HEIGHT * y,
      0,
      MAP_WIDTH * x,
      MAP_HEIGHT * y,
      MAP_WIDTH * 0.16
    );
    stain.addColorStop(0, `rgba(52, 25, 10, ${strength})`);
    stain.addColorStop(1, "rgba(45, 25, 13, 0)");
    context.fillStyle = stain;
    context.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);
  });

  context.save();
  context.globalAlpha = 0.12;
  context.strokeStyle = "#f7d592";
  context.lineWidth = 0.7;
  for (let y = 4; y < MAP_HEIGHT; y += 7) {
    context.beginPath();
    context.moveTo(0, y);
    context.bezierCurveTo(
      MAP_WIDTH * 0.28,
      y + ((y * 17) % 9) - 4,
      MAP_WIDTH * 0.72,
      y - ((y * 11) % 7) + 3,
      MAP_WIDTH,
      y
    );
    context.stroke();
  }
  context.restore();
}

function drawGraticule(context: CanvasRenderingContext2D) {
  context.save();
  context.strokeStyle = "rgba(61, 34, 15, 0.22)";
  context.lineWidth = 1.15;
  context.setLineDash([3, 8]);

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
  context.strokeStyle = "rgba(57, 29, 12, 0.32)";
  context.lineWidth = 1.6;
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

function mapPoint(lng: number, lat: number) {
  return {
    x: ((lng + 180) / 360) * MAP_WIDTH,
    y: ((90 - lat) / 180) * MAP_HEIGHT,
  };
}

function drawCompassRose(context: CanvasRenderingContext2D, lng: number, lat: number, radius: number) {
  const point = mapPoint(lng, lat);
  context.save();
  context.translate(point.x, point.y);
  context.strokeStyle = "rgba(56, 27, 11, 0.56)";
  context.fillStyle = "rgba(81, 40, 16, 0.42)";
  context.lineWidth = 2;

  for (let index = 0; index < 16; index += 1) {
    const angle = (Math.PI * 2 * index) / 16;
    const longRay = index % 4 === 0;
    const outer = longRay ? radius : radius * 0.66;
    context.beginPath();
    context.moveTo(Math.cos(angle) * radius * 0.14, Math.sin(angle) * radius * 0.14);
    context.lineTo(Math.cos(angle - 0.055) * outer, Math.sin(angle - 0.055) * outer);
    context.lineTo(Math.cos(angle + 0.055) * outer, Math.sin(angle + 0.055) * outer);
    context.closePath();
    if (longRay) context.fill();
    else context.stroke();
  }

  context.beginPath();
  context.arc(0, 0, radius * 0.82, 0, Math.PI * 2);
  context.stroke();
  context.font = `600 ${radius * 0.32}px Georgia`;
  context.textAlign = "center";
  context.fillText("N", 0, -radius * 1.04);
  context.restore();
}

function drawAntiqueLabels(context: CanvasRenderingContext2D) {
  const labels = [
    { text: "EUROPA", lng: 18, lat: 53, size: 40, angle: -0.08 },
    { text: "AFRICA", lng: 19, lat: 8, size: 46, angle: 0.04 },
    { text: "ASIA", lng: 87, lat: 46, size: 54, angle: -0.03 },
    { text: "AMERICA SEPTENTRIONALIS", lng: -108, lat: 48, size: 31, angle: -0.1 },
    { text: "AMERICA MERIDIONALIS", lng: -63, lat: -21, size: 28, angle: 0.12 },
    { text: "INDIA", lng: 79, lat: 23, size: 22, angle: 0.05 },
    { text: "OCEANVS ATLANTICVS", lng: -30, lat: 18, size: 24, angle: -0.18 },
    { text: "MARE PACIFICVM", lng: 155, lat: -12, size: 25, angle: 0.16 },
    { text: "OCEANIA", lng: 137, lat: -27, size: 26, angle: -0.08 },
  ];

  context.save();
  context.textAlign = "center";
  context.textBaseline = "middle";

  labels.forEach(({ text, lng, lat, size, angle }) => {
    const point = mapPoint(lng, lat);
    context.save();
    context.translate(point.x, point.y);
    context.rotate(angle);
    context.font = `600 ${size}px Georgia, serif`;
    context.letterSpacing = `${Math.max(2, size * 0.1)}px`;
    context.strokeStyle = "rgba(229, 178, 98, 0.18)";
    context.lineWidth = 3;
    context.strokeText(text, 0, 0);
    context.fillStyle = "rgba(55, 28, 13, 0.7)";
    context.fillText(text, 0, 0);
    context.restore();
  });

  context.restore();
  drawCompassRose(context, -42, -30, 62);
  drawCompassRose(context, 151, 21, 48);
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
      "rgba(46, 24, 11, 0.78)",
      1.5
    );
  });

  drawAntiqueLabels(context);

  const glaze = context.createRadialGradient(
    MAP_WIDTH * 0.46,
    MAP_HEIGHT * 0.38,
    MAP_WIDTH * 0.08,
    MAP_WIDTH * 0.5,
    MAP_HEIGHT * 0.5,
    MAP_WIDTH * 0.62
  );
  glaze.addColorStop(0, "rgba(255, 224, 154, 0.28)");
  glaze.addColorStop(0.5, "rgba(105, 55, 20, 0)");
  glaze.addColorStop(1, "rgba(37, 16, 8, 0.38)");
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
      drawHighlight(selectedCountryId, "rgba(255, 127, 22, 0.26)", "#ff9b2f", 3.2, 10);
    }

    if (hoveredCountryId && hoveredCountryId !== selectedCountryId) {
      drawHighlight(hoveredCountryId, "rgba(255, 171, 62, 0.16)", "#ffb24c", 2.2, 7);
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
