import type { BookyJourneyDefinition } from "./bookyJourney";
import type { BookyJourneyMigration, BookyJourneyMigrationReceipt } from "./bookyJourneyMigration";

export type BookyJourneyMigrationContent = Readonly<{
  historicalDefinitions: readonly BookyJourneyDefinition[];
  migrations: readonly BookyJourneyMigration[];
  approvedMigrationReceipts: readonly BookyJourneyMigrationReceipt[];
}>;

// No historical definitions or independent migration reviews are available in
// production. Draft content must not acquire approval through this provider.
const content: BookyJourneyMigrationContent = Object.freeze({
  historicalDefinitions: Object.freeze([]), migrations: Object.freeze([]), approvedMigrationReceipts: Object.freeze([]),
});

export function readBookyJourneyMigrationContent(): BookyJourneyMigrationContent { return content; }
