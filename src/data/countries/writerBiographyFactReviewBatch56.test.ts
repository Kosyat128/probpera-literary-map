import { defineWriterBiographyFactReviewBatchTests } from "./writerBiographyFactReviewBatch.generated-test-support";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH56_REVIEWER,
  writerBiographyFactReviewBatch56,
} from "./writerBiographyFactReviewBatch56";
import { writerBiographyPublicProfileFactCorrectionsBatch56 } from "./writerBiographyPublicProfileFactCorrectionsBatch56";

defineWriterBiographyFactReviewBatchTests({
  batch: 56,
  generatedAt: "2026-08-30",
  reviewer: WRITER_BIOGRAPHY_FACT_REVIEW_BATCH56_REVIEWER,
  records: writerBiographyFactReviewBatch56,
  profileCorrections: writerBiographyPublicProfileFactCorrectionsBatch56,
});
