import { defineWriterBiographyFactReviewBatchTests } from "./writerBiographyFactReviewBatch.generated-test-support";
import {
  WRITER_BIOGRAPHY_FACT_REVIEW_BATCH52_REVIEWER,
  writerBiographyFactReviewBatch52,
} from "./writerBiographyFactReviewBatch52";
import { writerBiographyPublicProfileFactCorrectionsBatch52 } from "./writerBiographyPublicProfileFactCorrectionsBatch52";

defineWriterBiographyFactReviewBatchTests({
  batch: 52,
  generatedAt: "2026-08-30",
  reviewer: WRITER_BIOGRAPHY_FACT_REVIEW_BATCH52_REVIEWER,
  records: writerBiographyFactReviewBatch52,
  profileCorrections: writerBiographyPublicProfileFactCorrectionsBatch52,
});
