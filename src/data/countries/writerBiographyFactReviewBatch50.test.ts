import { defineWriterBiographyFactReviewBatchTests } from "./writerBiographyFactReviewBatch.generated-test-support";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH50_REVIEWER,
  writerBiographyFactReviewBatch50,
} from "./writerBiographyFactReviewBatch50";
import { writerBiographyPublicProfileFactCorrectionsBatch50 } from "./writerBiographyPublicProfileFactCorrectionsBatch50";

defineWriterBiographyFactReviewBatchTests({
  batch: 50,
  generatedAt: "2026-08-30",
  reviewer: WRITER_BIOGRAPHY_FACT_REVIEW_BATCH50_REVIEWER,
  records: writerBiographyFactReviewBatch50,
  profileCorrections: writerBiographyPublicProfileFactCorrectionsBatch50,
});
