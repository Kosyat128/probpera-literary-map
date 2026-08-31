import { defineWriterBiographyFactReviewBatchTests } from "./writerBiographyFactReviewBatch.generated-test-support";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH49_REVIEWER,
  writerBiographyFactReviewBatch49,
} from "./writerBiographyFactReviewBatch49";
import { writerBiographyPublicProfileFactCorrectionsBatch49 } from "./writerBiographyPublicProfileFactCorrectionsBatch49";

defineWriterBiographyFactReviewBatchTests({
  batch: 49,
  generatedAt: "2026-08-30",
  reviewer: WRITER_BIOGRAPHY_FACT_REVIEW_BATCH49_REVIEWER,
  records: writerBiographyFactReviewBatch49,
  profileCorrections: writerBiographyPublicProfileFactCorrectionsBatch49,
});
