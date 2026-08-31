import { defineWriterBiographyFactReviewBatchTests } from "./writerBiographyFactReviewBatch.generated-test-support";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH51_REVIEWER,
  writerBiographyFactReviewBatch51,
} from "./writerBiographyFactReviewBatch51";
import { writerBiographyPublicProfileFactCorrectionsBatch51 } from "./writerBiographyPublicProfileFactCorrectionsBatch51";

defineWriterBiographyFactReviewBatchTests({
  batch: 51,
  generatedAt: "2026-08-30",
  reviewer: WRITER_BIOGRAPHY_FACT_REVIEW_BATCH51_REVIEWER,
  records: writerBiographyFactReviewBatch51,
  profileCorrections: writerBiographyPublicProfileFactCorrectionsBatch51,
});
