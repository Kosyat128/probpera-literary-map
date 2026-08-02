import { cmsBookEditionsByWorkId as generatedEditions } from "./bookEditions.generated";

export type CmsBookEdition = {
  title: string;
  isbn10: string | null;
  isbn13: string | null;
  publisher: string;
  publicationYear: number | null;
  language: string;
  coverUrl: string;
  coverSourceUrl: string;
  coverRightsStatus:
    | "public-domain"
    | "licensed"
    | "permission"
    | "external-preview";
  licenseName: string;
  licenseUrl: string | null;
  creator: string;
  rightsHolder: string;
  rightsCheckedAt: string;
  sourceUrl: string;
};

export const cmsBookEditionsByWorkId = generatedEditions as Record<
  string,
  CmsBookEdition
>;
