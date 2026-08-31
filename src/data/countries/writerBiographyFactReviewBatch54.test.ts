import { defineWriterBiographyFactReviewBatchTests } from "./writerBiographyFactReviewBatch.generated-test-support";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH54_REVIEWER,
  writerBiographyFactReviewBatch54,
} from "./writerBiographyFactReviewBatch54";
import { writerBiographyPublicProfileFactCorrectionsBatch54 } from "./writerBiographyPublicProfileFactCorrectionsBatch54";

defineWriterBiographyFactReviewBatchTests({
  batch: 54,
  generatedAt: "2026-08-30",
  reviewer: WRITER_BIOGRAPHY_FACT_REVIEW_BATCH54_REVIEWER,
  records: writerBiographyFactReviewBatch54,
  profileCorrections: writerBiographyPublicProfileFactCorrectionsBatch54,
});
