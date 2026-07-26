# Географические данные LiteraryMap

Папка предназначена для файлов географии мира.

Сюда нужно добавить:

```
countries.geojson
```

Источник:
Natural Earth — Admin 0 Countries.

После добавления файла он будет подключён к старинному 3D глобусу:

```
countries.geojson
        ↓
loadWorldContours.ts
        ↓
AntiqueContinentLayer
        ↓
LiteraryGlobe
```

Требования:
- формат GeoJSON;
- границы стран мира;
- желательно Natural Earth 110m для высокой скорости работы.
