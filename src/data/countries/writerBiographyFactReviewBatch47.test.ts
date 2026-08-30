import { defineWriterBiographyFactReviewBatchTests } from "./writerBiographyFactReviewBatch.generated-test-support";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH47_REVIEWER,
  writerBiographyFactReviewBatch47,
} from "./writerBiographyFactReviewBatch47";
import { writerBiographyPublicProfileFactCorrectionsBatch47 } from "./writerBiographyPublicProfileFactCorrectionsBatch47";

defineWriterBiographyFactReviewBatchTests({
  batch: 47,
  generatedAt: "2026-08-30",
  reviewer: WRITER_BIOGRAPHY_FACT_REVIEW_BATCH47_REVIEWER,
  records: writerBiographyFactReviewBatch47,
  profileCorrections: writerBiographyPublicProfileFactCorrectionsBatch47,
});
