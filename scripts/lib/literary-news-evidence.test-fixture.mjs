// Explicit offline fixture adaptation. Production never accepts legacy model
// responses as the new reference protocol and never invokes this helper.
export function referencedDraftFixture(draft, messages) {
  const catalog = JSON.parse(messages[1].content).SOURCE_DATA.evidenceCatalog;
  const id = quote => typeof quote === 'string' && quote
    ? catalog.spans.find(span => span.text.includes(quote))?.id || 'e999' : '';
  return { protocolVersion: catalog.protocolVersion, catalogSha256: catalog.catalogSha256,
    status: draft.status, reason: draft.reason, title: draft.title, summary: draft.summary,
    category: draft.category, eventIdentity: draft.eventIdentity,
    literaryEvidenceId: draft.status === 'held' ? '' : id(draft.literaryEvidence),
    facts: draft.status === 'held' ? [] : draft.facts.map(row => ({ evidenceId: id(row.quote) })) };
}
