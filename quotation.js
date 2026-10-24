// Fixotech Inno Structures LLP — Inno Smart Quotation Calculator
// Thin config over the shared engine (inno-core.js). Numbering: FIS26/27-QT001.
// Flow start: Quotation → (convert) Sales Order → Invoice.
(function () {
  if (!window.FIXO_DOC) { console.error('inno-core.js must load before quotation.js'); return; }
  const app = FIXO_DOC.make({
    type: 'QT', noun: 'Quotation',
    appTitle: ['INNO', 'SMART QUOTATION'], subtitle: 'Quotation Calculator',
    mountId: 'quote-app', screen: 'screen-quote',
    sessKey: 'fixo_inno_qt_sessions', savedKey: 'fixo_inno_quotes',
    docHeading: 'QUOTATION', draftHeading: 'QUOTATION (DRAFT)', draftWm: 'DRAFT',
    dateLabel: 'Valid Till',
    statuses: { draft: { label: 'Draft', cls: 'st-draft' }, sent: { label: 'Sent', cls: 'st-sent' }, approved: { label: 'Accepted', cls: 'st-ok' }, declined: { label: 'Declined', cls: 'st-no' } },
    stages: [
      { label: '💾 Save as Draft', status: 'draft', cls: '' },
      { label: '📤 Save & Send', status: 'sent', cls: 'cp-btn-go' },
      { label: '✓ Accepted', status: 'approved', cls: 'inv-ok' },
      { label: '✕ Declined', status: 'declined', cls: 'inv-no' }
    ],
    tally: false,
    convert: { toType: 'SO', label: '➡ Convert to Sales Order', icon: '➡' }
  });
  window.FIXO_QUOTE = app;
})();
