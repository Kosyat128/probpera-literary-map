from pathlib import Path

path = Path("apps/admin/lib/site-copy-storage.test.ts")
source = path.read_text(encoding="utf-8")
old_import = '''import {
  allSiteCopyCatalog,
  siteCopyCatalog,
} from "./site-copy-catalog";'''
new_import = '''import {
  loadAllSiteCopyCatalog,
  siteCopyCatalog,
} from "./site-copy-catalog";'''
if source.count(old_import) != 1:
    raise SystemExit("site-copy storage test import target not found")
source = source.replace(old_import, new_import, 1)
old_test = '''  it("has one editable row per source string and a complete searchable catalog", () => {
    const keys = allSiteCopyCatalog.map((item) => item.key);'''
new_test = '''  it("has one editable row per source string and a complete searchable catalog", async () => {
    const generated = Array.from({ length: 800 }, (_, index) => ({
      key: `interface.generated-${index}`,
      group: index < 200 ? "Названия стран" : "Весь интерфейс",
      label: `Текст ${index}`,
      defaultRu: `Текст ${index}`,
      defaultEn: `Text ${index}`,
      multiline: false,
    }));
    generated.splice(
      0,
      200,
      ...Array.from({ length: 200 }, (_, index) => ({
        key: `country.${String.fromCharCode(65 + Math.floor(index / 26))}${String.fromCharCode(65 + (index % 26))}`,
        group: "Названия стран",
        label: `Страна ${index}`,
        defaultRu: `Страна ${index}`,
        defaultEn: `Country ${index}`,
        multiline: false,
      }))
    );
    const allSiteCopyCatalog = await loadAllSiteCopyCatalog({
      fetchImpl: async () =>
        new Response(JSON.stringify(generated), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      url: "https://assets.test/interface-copy-catalog/catalog.json",
    });
    const keys = allSiteCopyCatalog.map((item) => item.key);'''
if source.count(old_test) != 1:
    raise SystemExit("site-copy storage test body target not found")
path.write_text(source.replace(old_test, new_test, 1), encoding="utf-8")
