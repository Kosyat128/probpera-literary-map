import { editorialPreviewFontFamilies } from "@/components/EditorialPreviewFonts";
import { BOOK_DOSSIER_LIMITS, type BookDossierDesignProof, type BookDossierDocumentV2, type BookDossierRecord } from "../../../../../../src/books/bookDossierDocument";
import { BOOK_TYPOGRAPHY_VERSION, BookDossierTypographyTokens } from "../../../../../../src/books/bookTypography";
import { BOOK_INSPECTION_LAYOUT_VERSION, layoutBookInspectionDocument } from "../../../../../../src/books/bookInspectionPageLayout";
import { toBookEditorialDocument } from "../../../../../../src/books/bookDossierLegacyAdapter";

export async function measureBookDossierDesign(record: BookDossierRecord, variants: readonly { id: string; document: BookDossierDocumentV2 }[]): Promise<{ proof: BookDossierDesignProof | null; issues: readonly string[] }> {
  const sample = "Пробы пера Автор Ёж Atlas Author 1984";
  try {
    const families = [...editorialPreviewFontFamilies.serif.split(", "), ...editorialPreviewFontFamilies.sans.split(", ")];
    const faces = await Promise.all(families.flatMap(family => [400, 600].map(weight => document.fonts.load(`${weight} 16px ${family}`, sample))));
    await document.fonts.ready;
    if (!faces.every(result => result.length && result.every(face => face.status === "loaded"))) return { proof: null, issues: ["Local Source fonts are unavailable"] };
    const canvas = document.createElement("canvas").getContext("2d");
    if (!canvas) return { proof: null, issues: ["Canvas text measurement is unavailable"] };
    const variantPages: BookDossierDesignProof["variantPages"][number][] = [];
    for (const variant of variants) {
      const layout = layoutBookInspectionDocument(toBookEditorialDocument(variant.document), (text, role) => {
        const token = BookDossierTypographyTokens[role];
        const family = role === "caption" || role === "metadata" ? editorialPreviewFontFamilies.sans : editorialPreviewFontFamilies.serif;
        canvas.font = `${token.weight} ${token.size}px ${family}`;
        return canvas.measureText(text).width;
      }, { maximumPages: BOOK_DOSSIER_LIMITS[record.draft.tier].maximum });
      if (layout.status !== "ready" || !layout.document) return { proof: null, issues: layout.issues.map(issue => `${variant.id}: ${issue}`) };
      variantPages.push({ id: variant.id, pageCount: layout.document.pages.length });
    }
    return { proof: { version: "book-dossier-design-v1", contentChecksum: record.contentChecksum, fontVersion: BOOK_TYPOGRAPHY_VERSION,
      layoutVersion: BOOK_INSPECTION_LAYOUT_VERSION, measuredAt: new Date().toISOString(), method: "CANVAS_LOCAL_FONTS", variantPages }, issues: [] };
  } catch { return { proof: null, issues: ["Local design measurement failed"] }; }
}
