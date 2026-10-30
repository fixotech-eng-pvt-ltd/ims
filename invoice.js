// Fixotech Inno Structures LLP — Inno Invoice Gen (Tax Invoice)
// Thin config over the shared engine (inno-core.js). Numbering: FIS26/27-001.
(function () {
  if (!window.FIXO_DOC) { console.error('inno-core.js must load before invoice.js'); return; }
  const app = FIXO_DOC.make({
    type: 'INV', noun: 'Invoice',
    appTitle: ['INNO', 'INVOICE GEN'], subtitle: 'GST Tax Invoicing',
    mountId: 'invoice-app', screen: 'screen-invoice',
    sessKey: 'fixo_inno_sessions', savedKey: 'fixo_inno_invoices',
    docHeading: 'TAX INVOICE', draftHeading: 'APPROVAL COPY', draftWm: 'DRAFT — FOR APPROVAL',
    dateLabel: 'Due Date',
    statuses: { draft: { label: 'Draft', cls: 'st-draft' }, sent: { label: 'Sent to client', cls: 'st-sent' }, approved: { label: 'Approved', cls: 'st-ok' }, declined: { label: 'Not approved', cls: 'st-no' } },
    stages: [
      { label: '💾 Save as Draft', status: 'draft', cls: '' },
      { label: '📤 Save & Send to client', status: 'sent', cls: 'cp-btn-go' },
      { label: '✓ Client approved', status: 'approved', cls: 'inv-ok' },
      { label: '✕ Not approved', status: 'declined', cls: 'inv-no' }
    ],
    tally: true, convert: null, stockControl: true
  });
  window.FIXO_INVOICE = app;   // back-compat
})();
