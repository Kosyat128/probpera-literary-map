export interface WorldContourFeature {
  coordinates: number[][] | number[][][];
}

// Контуры мира будут подключены сюда из GeoJSON.
// Формат подготовлен для AntiqueContinentLayer.
export const worldContours: WorldContourFeature[] = [];
