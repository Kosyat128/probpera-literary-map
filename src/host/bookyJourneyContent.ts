import type { BookyDialogueApproval, BookyDialogueRecord } from "./bookyDialogueRegistry";
import type { BookyJourneyApproval, BookyJourneyContext, BookyJourneyDefinition, BookyJourneyPrerequisite } from "./bookyJourney";

export type BookyJourneyContent = Readonly<{
  definitions: readonly BookyJourneyDefinition[];
  dialogues: readonly BookyDialogueRecord[];
  currentVersions: readonly BookyJourneyPrerequisite[];
  dialogueApprovals: readonly BookyDialogueApproval[];
  journeyApprovals: readonly BookyJourneyApproval[];
  availability: readonly Readonly<{
    journeyId: string;
    version: number;
    locale: "ru" | "en";
    nodes: BookyJourneyContext["availability"];
  }>[];
}>;

// Production has no independently reviewed journey inventory. Draft dialogue
// inventories are deliberately not imported or promoted at this boundary.
const reviewedContent: BookyJourneyContent = Object.freeze({
  definitions: Object.freeze([]), dialogues: Object.freeze([]), currentVersions: Object.freeze([]),
  dialogueApprovals: Object.freeze([]), journeyApprovals: Object.freeze([]), availability: Object.freeze([]),
});

export function readBookyJourneyContent(): BookyJourneyContent { return reviewedContent; }
