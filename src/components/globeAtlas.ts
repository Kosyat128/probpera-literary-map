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
  reliefTexture: THREE.CanvasTexture;
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
  context.setLineDash([]);

  for (let lng = -165; lng <= 165; lng += 15) {
    const x = ((lng + 180) / 360) * MAP_WIDTH;
    const major = lng % 30 === 0;
    context.beginPath();
    context.moveTo(x, 0);
    context.lineTo(x, MAP_HEIGHT);
    context.strokeStyle = major
      ? "rgba(55, 29, 12, 0.31)"
      : "rgba(246, 214, 151, 0.16)";
    context.lineWidth = major ? 1.25 : 0.72;
    context.stroke();
  }

  for (let lat = -75; lat <= 75; lat += 15) {
    const y = ((90 - lat) / 180) * MAP_HEIGHT;
    const major = lat % 30 === 0;
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(MAP_WIDTH, y);
    context.strokeStyle = major
      ? "rgba(55, 29, 12, 0.31)"
      : "rgba(246, 214, 151, 0.16)";
    context.lineWidth = major ? 1.25 : 0.72;
    context.stroke();
  }

  const equatorY = MAP_HEIGHT / 2;
  context.beginPath();
  context.moveTo(0, equatorY - 3);
  context.lineTo(MAP_WIDTH, equatorY - 3);
  context.moveTo(0, equatorY + 3);
  context.lineTo(MAP_WIDTH, equatorY + 3);
  context.strokeStyle = "rgba(48, 24, 10, 0.48)";
  context.lineWidth = 1.6;
  context.stroke();

  const tropicOffset = (23.436 / 180) * MAP_HEIGHT;
  [equatorY - tropicOffset, equatorY + tropicOffset].forEach((y) => {
    context.beginPath();
    context.moveTo(0, y);
    context.lineTo(MAP_WIDTH, y);
    context.strokeStyle = "rgba(67, 34, 13, 0.25)";
    context.lineWidth = 1;
    context.setLineDash([7, 6]);
    context.stroke();
  });

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

function drawMountainRange(
  context: CanvasRenderingContext2D,
  lng: number,
  lat: number,
  width: number,
  peaks: number,
  angle = 0
) {
  const point = mapPoint(lng, lat);
  const step = width / Math.max(peaks - 1, 1);
  context.save();
  context.translate(point.x, point.y);
  context.rotate(angle);
  context.lineJoin = "round";
  context.lineCap = "round";

  for (let index = 0; index < peaks; index += 1) {
    const x = -width / 2 + step * index;
    const height = 30 + ((index * 19 + peaks * 7) % 30);
    const halfWidth = 18 + ((index * 11) % 13);
    const y = ((index * 17) % 13) - 6;

    context.beginPath();
    context.moveTo(x - halfWidth, y + 17);
    context.quadraticCurveTo(x - 8, y - height * 0.55, x, y - height);
    context.quadraticCurveTo(x + 10, y - height * 0.42, x + halfWidth, y + 17);
    context.closePath();
    context.fillStyle = "rgba(71, 37, 16, 0.2)";
    context.fill();
    context.strokeStyle = "rgba(54, 28, 12, 0.62)";
    context.lineWidth = 1.5;
    context.stroke();

    context.beginPath();
    context.moveTo(x, y - height);
    context.lineTo(x - 7, y - height * 0.64);
    context.lineTo(x - 1, y - height * 0.71);
    context.lineTo(x + 6, y - height * 0.56);
    context.strokeStyle = "rgba(240, 199, 121, 0.42)";
    context.lineWidth = 1.1;
    context.stroke();

    context.beginPath();
    context.moveTo(x - halfWidth * 0.74, y + 13);
    context.lineTo(x + halfWidth * 0.72, y + 13);
    context.strokeStyle = "rgba(58, 30, 13, 0.24)";
    context.lineWidth = 0.8;
    context.stroke();
  }

  context.restore();
}

function drawForestCluster(
  context: CanvasRenderingContext2D,
  lng: number,
  lat: number,
  columns: number,
  rows: number,
  spacing = 18
) {
  const point = mapPoint(lng, lat);
  context.save();
  context.translate(point.x, point.y);
  context.strokeStyle = "rgba(49, 43, 19, 0.56)";
  context.fillStyle = "rgba(62, 65, 27, 0.22)";
  context.lineWidth = 1.1;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x =
        (column - (columns - 1) / 2) * spacing +
        ((row * 13 + column * 7) % 7) -
        3;
      const y =
        (row - (rows - 1) / 2) * spacing * 0.72 +
        ((row * 5 + column * 3) % 5) -
        2;
      const size = 6 + ((row * 7 + column * 11) % 5);

      context.beginPath();
      context.moveTo(x, y - size);
      context.lineTo(x - size * 0.7, y + size * 0.35);
      context.lineTo(x + size * 0.7, y + size * 0.35);
      context.closePath();
      context.fill();
      context.stroke();
      context.beginPath();
      context.moveTo(x, y + size * 0.25);
      context.lineTo(x, y + size * 0.72);
      context.stroke();
    }
  }

  context.restore();
}

type MapAnimal = "elephant" | "camel" | "bison" | "llama" | "kangaroo" | "whale";

function drawAnimal(
  context: CanvasRenderingContext2D,
  animal: MapAnimal,
  lng: number,
  lat: number,
  scale = 1,
  flip = false
) {
  const point = mapPoint(lng, lat);
  context.save();
  context.translate(point.x, point.y);
  context.scale(scale * (flip ? -1 : 1), scale);
  context.strokeStyle = "rgba(46, 23, 10, 0.78)";
  context.fillStyle = "rgba(75, 40, 17, 0.31)";
  context.lineWidth = 1.7;
  context.lineCap = "round";
  context.lineJoin = "round";

  if (animal === "elephant") {
    context.beginPath();
    context.ellipse(-2, 0, 18, 12, 0, 0, Math.PI * 2);
    context.ellipse(16, 1, 8, 8, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.beginPath();
    context.moveTo(21, 4);
    context.bezierCurveTo(29, 8, 23, 20, 29, 18);
    context.moveTo(-11, 9);
    context.lineTo(-12, 22);
    context.moveTo(6, 9);
    context.lineTo(7, 22);
    context.moveTo(-19, -2);
    context.quadraticCurveTo(-25, 3, -22, 9);
    context.stroke();
    context.beginPath();
    context.arc(15, 1, 5, -1.6, 1.25);
    context.stroke();
  } else if (animal === "camel") {
    context.beginPath();
    context.moveTo(-20, 8);
    context.quadraticCurveTo(-13, -8, -5, 1);
    context.quadraticCurveTo(3, -13, 12, 1);
    context.lineTo(18, -2);
    context.quadraticCurveTo(17, -16, 24, -21);
    context.lineTo(31, -18);
    context.lineTo(26, -13);
    context.lineTo(24, 7);
    context.lineTo(-16, 11);
    context.closePath();
    context.fill();
    context.stroke();
    [-13, -4, 14, 22].forEach((x) => {
      context.beginPath();
      context.moveTo(x, 8);
      context.lineTo(x + (x < 0 ? -2 : 2), 23);
      context.stroke();
    });
  } else if (animal === "bison") {
    context.beginPath();
    context.ellipse(-4, 1, 20, 12, -0.08, 0, Math.PI * 2);
    context.ellipse(16, 4, 9, 8, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.beginPath();
    context.moveTo(11, -2);
    context.quadraticCurveTo(5, -13, -5, -10);
    context.moveTo(19, -2);
    context.quadraticCurveTo(27, -7, 29, -2);
    context.moveTo(-13, 9);
    context.lineTo(-14, 22);
    context.moveTo(8, 10);
    context.lineTo(10, 22);
    context.stroke();
  } else if (animal === "llama") {
    context.beginPath();
    context.ellipse(-5, 3, 17, 9, 0, 0, Math.PI * 2);
    context.moveTo(8, 0);
    context.lineTo(14, -23);
    context.quadraticCurveTo(17, -31, 24, -27);
    context.lineTo(27, -22);
    context.lineTo(17, -18);
    context.lineTo(15, 6);
    context.closePath();
    context.fill();
    context.stroke();
    context.beginPath();
    context.moveTo(19, -28);
    context.lineTo(18, -36);
    context.moveTo(23, -27);
    context.lineTo(25, -35);
    context.moveTo(-14, 9);
    context.lineTo(-15, 23);
    context.moveTo(7, 9);
    context.lineTo(8, 23);
    context.stroke();
  } else if (animal === "kangaroo") {
    context.beginPath();
    context.ellipse(2, 2, 11, 17, -0.25, 0, Math.PI * 2);
    context.moveTo(-7, 7);
    context.quadraticCurveTo(-27, 12, -35, 22);
    context.quadraticCurveTo(-20, 19, -4, 14);
    context.moveTo(7, -10);
    context.lineTo(14, -27);
    context.lineTo(21, -31);
    context.lineTo(24, -25);
    context.lineTo(15, -19);
    context.lineTo(12, -5);
    context.closePath();
    context.fill();
    context.stroke();
    context.beginPath();
    context.moveTo(18, -30);
    context.lineTo(17, -39);
    context.moveTo(22, -30);
    context.lineTo(25, -38);
    context.moveTo(4, 14);
    context.lineTo(15, 28);
    context.lineTo(25, 28);
    context.moveTo(-2, 15);
    context.lineTo(-8, 29);
    context.lineTo(2, 29);
    context.stroke();
  } else {
    context.beginPath();
    context.ellipse(0, 0, 27, 10, -0.05, 0, Math.PI * 2);
    context.moveTo(-25, -1);
    context.lineTo(-38, -10);
    context.lineTo(-35, 1);
    context.lineTo(-39, 10);
    context.closePath();
    context.fill();
    context.stroke();
    context.beginPath();
    context.moveTo(16, -6);
    context.quadraticCurveTo(27, -15, 35, -8);
    context.moveTo(23, -9);
    context.quadraticCurveTo(28, -20, 31, -25);
    context.moveTo(31, -25);
    context.quadraticCurveTo(35, -31, 38, -24);
    context.stroke();
  }

  context.restore();
}

function drawSailingShip(
  context: CanvasRenderingContext2D,
  lng: number,
  lat: number,
  scale = 1
) {
  const point = mapPoint(lng, lat);
  context.save();
  context.translate(point.x, point.y);
  context.scale(scale, scale);
  context.strokeStyle = "rgba(47, 23, 10, 0.72)";
  context.fillStyle = "rgba(76, 39, 16, 0.27)";
  context.lineWidth = 1.6;
  context.lineJoin = "round";

  context.beginPath();
  context.moveTo(-24, 10);
  context.quadraticCurveTo(0, 22, 25, 8);
  context.lineTo(18, 17);
  context.lineTo(-18, 17);
  context.closePath();
  context.fill();
  context.stroke();
  context.beginPath();
  context.moveTo(0, 10);
  context.lineTo(0, -30);
  context.moveTo(0, -27);
  context.quadraticCurveTo(18, -18, 19, -2);
  context.lineTo(2, -5);
  context.closePath();
  context.fill();
  context.stroke();
  context.beginPath();
  context.moveTo(-20, 22);
  context.quadraticCurveTo(-10, 18, 0, 22);
  context.quadraticCurveTo(10, 26, 23, 21);
  context.stroke();
  context.restore();
}

function drawSeaSerpent(
  context: CanvasRenderingContext2D,
  lng: number,
  lat: number,
  scale = 1
) {
  const point = mapPoint(lng, lat);
  context.save();
  context.translate(point.x, point.y);
  context.scale(scale, scale);
  context.strokeStyle = "rgba(47, 23, 10, 0.64)";
  context.fillStyle = "rgba(73, 37, 15, 0.28)";
  context.lineWidth = 3.2;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(-35, 7);
  context.bezierCurveTo(-24, -18, -8, 25, 8, 1);
  context.bezierCurveTo(20, -16, 27, 8, 35, -5);
  context.stroke();
  context.beginPath();
  context.ellipse(38, -7, 7, 5, -0.15, 0, Math.PI * 2);
  context.fill();
  context.stroke();
  context.beginPath();
  context.moveTo(33, -10);
  context.lineTo(31, -18);
  context.lineTo(39, -12);
  context.stroke();
  context.restore();
}

function drawCartographicRelief(context: CanvasRenderingContext2D) {
  drawMountainRange(context, -72, -18, 360, 13, 1.43);
  drawMountainRange(context, -112, 46, 270, 10, 1.34);
  drawMountainRange(context, 83, 31, 390, 14, 0.02);
  drawMountainRange(context, 59, 57, 220, 8, 1.48);
  drawMountainRange(context, 10, 46, 130, 6, 0.03);
  drawMountainRange(context, -5, 31, 150, 6, 0.06);
  drawMountainRange(context, 38, 8, 185, 7, 1.2);
  drawMountainRange(context, 146, -26, 210, 8, 1.36);

  drawForestCluster(context, -105, 57, 8, 3, 20);
  drawForestCluster(context, -62, -4, 8, 4, 19);
  drawForestCluster(context, 22, 0, 7, 3, 18);
  drawForestCluster(context, 93, 58, 11, 3, 19);
  drawForestCluster(context, 104, 10, 7, 3, 17);

  drawAnimal(context, "bison", -103, 40, 1.35);
  drawAnimal(context, "llama", -68, -18, 1.28);
  drawAnimal(context, "elephant", 23, 4, 1.45);
  drawAnimal(context, "camel", 48, 27, 1.32);
  drawAnimal(context, "kangaroo", 135, -25, 1.34);
  drawAnimal(context, "whale", -143, -27, 1.25, true);
  drawAnimal(context, "whale", 52, -44, 1.05);
  drawSailingShip(context, -34, -14, 1.18);
  drawSailingShip(context, 151, 9, 0.98);
  drawSeaSerpent(context, -148, 16, 1.22);
  drawSeaSerpent(context, 80, -34, 0.95);
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

  drawCartographicRelief(context);
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

const reliefRanges = [
  { lng: -72, lat: -18, width: 360, peaks: 13, angle: 1.43 },
  { lng: -112, lat: 46, width: 270, peaks: 10, angle: 1.34 },
  { lng: 83, lat: 31, width: 390, peaks: 14, angle: 0.02 },
  { lng: 59, lat: 57, width: 220, peaks: 8, angle: 1.48 },
  { lng: 10, lat: 46, width: 130, peaks: 6, angle: 0.03 },
  { lng: -5, lat: 31, width: 150, peaks: 6, angle: 0.06 },
  { lng: 38, lat: 8, width: 185, peaks: 7, angle: 1.2 },
  { lng: 146, lat: -26, width: 210, peaks: 8, angle: 1.36 },
] as const;

function drawReliefRange(
  context: CanvasRenderingContext2D,
  { lng, lat, width, peaks, angle }: (typeof reliefRanges)[number]
) {
  const point = mapPoint(lng, lat);
  const step = width / Math.max(peaks - 1, 1);

  context.save();
  context.translate(point.x, point.y);
  context.rotate(angle);
  context.fillStyle = "#d8d8d8";
  context.strokeStyle = "#f1f1f1";
  context.lineWidth = 5;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.shadowColor = "rgba(255, 255, 255, 0.46)";
  context.shadowBlur = 12;

  context.beginPath();
  for (let index = 0; index < peaks; index += 1) {
    const x = -width / 2 + step * index;
    const y = ((index * 17) % 13) - 6;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.stroke();

  for (let index = 0; index < peaks; index += 1) {
    const x = -width / 2 + step * index;
    const height = 24 + ((index * 19 + peaks * 7) % 27);
    const y = ((index * 17) % 13) - 6;
    context.beginPath();
    context.ellipse(x, y, 15 + height * 0.35, 8 + height * 0.18, 0, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function makeReliefCanvas(features: GeoFeature[]) {
  const canvas = document.createElement("canvas");
  canvas.width = MAP_WIDTH;
  canvas.height = MAP_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable");

  context.fillStyle = "#353535";
  context.fillRect(0, 0, MAP_WIDTH, MAP_HEIGHT);

  features.forEach((feature) => {
    drawFeature(
      context,
      feature,
      MAP_WIDTH,
      MAP_HEIGHT,
      "#777777",
      "#8d8d8d",
      1.2
    );
  });

  reliefRanges.forEach((range) => drawReliefRange(context, range));

  let seed = 44119;
  for (let index = 0; index < 14000; index += 1) {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const x = seed % MAP_WIDTH;
    seed = (seed * 1664525 + 1013904223) >>> 0;
    const y = seed % MAP_HEIGHT;
    const light = 80 + (seed % 34);
    context.fillStyle = `rgba(${light}, ${light}, ${light}, 0.16)`;
    context.fillRect(x, y, 1.2, 1.2);
  }

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

function configureReliefTexture(texture: THREE.CanvasTexture) {
  texture.colorSpace = THREE.NoColorSpace;
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
  const reliefTexture = configureReliefTexture(
    new THREE.CanvasTexture(makeReliefCanvas(worldGeoJson.features))
  );
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
    reliefTexture,
    highlightTexture,
    countryAtUv,
    centroidForCountry,
    updateHighlight,
    dispose: () => {
      mapTexture.dispose();
      reliefTexture.dispose();
      highlightTexture.dispose();
    },
  };
}
