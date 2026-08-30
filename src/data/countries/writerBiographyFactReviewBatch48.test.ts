import { defineWriterBiographyFactReviewBatchTests } from "./writerBiographyFactReviewBatch.generated-test-support";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH48_REVIEWER,
  writerBiographyFactReviewBatch48,
} from "./writerBiographyFactReviewBatch48";
import { writerBiographyPublicProfileFactCorrectionsBatch48 } from "./writerBiographyPublicProfileFactCorrectionsBatch48";

defineWriterBiographyFactReviewBatchTests({
  batch: 48,
  generatedAt: "2026-08-30",
  reviewer: WRITER_BIOGRAPHY_FACT_REVIEW_BATCH48_REVIEWER,
  records: writerBiographyFactReviewBatch48,
  profileCorrections: writerBiographyPublicProfileFactCorrectionsBatch48,
});
