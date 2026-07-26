export interface WorldContourFeature {
  coordinates: number[][] | number[][][];
}

export interface WorldContourCollection {
  features: WorldContourFeature[];
}

// Подготовлено для подключения GeoJSON-контуров мира.
// Формат совместим с AntiqueContinentLayer.
// Реальные границы будут загружаться отдельным географическим файлом.
export const worldContours: WorldContourFeature[] = [];

export function setWorldContours(features: WorldContourFeature[]) {
  worldContours.splice(0, worldContours.length, ...features);
}
