import { defineWriterBiographyFactReviewBatchTests } from "./writerBiographyFactReviewBatch.generated-test-support";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH55_REVIEWER,
  writerBiographyFactReviewBatch55,
} from "./writerBiographyFactReviewBatch55";
import { writerBiographyPublicProfileFactCorrectionsBatch55 } from "./writerBiographyPublicProfileFactCorrectionsBatch55";

defineWriterBiographyFactReviewBatchTests({
  batch: 55,
  generatedAt: "2026-08-30",
  reviewer: WRITER_BIOGRAPHY_FACT_REVIEW_BATCH55_REVIEWER,
  records: writerBiographyFactReviewBatch55,
  profileCorrections: writerBiographyPublicProfileFactCorrectionsBatch55,
});
