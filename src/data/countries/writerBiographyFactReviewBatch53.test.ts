import { defineWriterBiographyFactReviewBatchTests } from "./writerBiographyFactReviewBatch.generated-test-support";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH53_REVIEWER,
  writerBiographyFactReviewBatch53,
} from "./writerBiographyFactReviewBatch53";
import { writerBiographyPublicProfileFactCorrectionsBatch53 } from "./writerBiographyPublicProfileFactCorrectionsBatch53";

defineWriterBiographyFactReviewBatchTests({
  batch: 53,
  generatedAt: "2026-08-30",
  reviewer: WRITER_BIOGRAPHY_FACT_REVIEW_BATCH53_REVIEWER,
  records: writerBiographyFactReviewBatch53,
  profileCorrections: writerBiographyPublicProfileFactCorrectionsBatch53,
});
