import { defineWriterBiographyFactReviewBatchTests } from "./writerBiographyFactReviewBatch.generated-test-support";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH57_REVIEWER,
  writerBiographyFactReviewBatch57,
} from "./writerBiographyFactReviewBatch57";
import { writerBiographyPublicProfileFactCorrectionsBatch57 } from "./writerBiographyPublicProfileFactCorrectionsBatch57";

defineWriterBiographyFactReviewBatchTests({
  batch: 57,
  generatedAt: "2026-08-30",
  reviewer: WRITER_BIOGRAPHY_FACT_REVIEW_BATCH57_REVIEWER,
  records: writerBiographyFactReviewBatch57,
  profileCorrections: writerBiographyPublicProfileFactCorrectionsBatch57,
});
