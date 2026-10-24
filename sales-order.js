// Fixotech Inno Structures LLP — Inno Sales OQ (Sales Order)
// Thin config over the shared engine (inno-core.js). Numbering: FIS26/27-SO001.
// Middle step: Quotation → Sales Order → (convert) Invoice.
(function () {
  if (!window.FIXO_DOC) { console.error('inno-core.js must load before sales-order.js'); return; }
  const app = FIXO_DOC.make({
    type: 'SO', noun: 'Sales Order',
    appTitle: ['INNO', 'SALES OQ'], subtitle: 'Sales Order',
    mountId: 'so-app', screen: 'screen-so',
    sessKey: 'fixo_inno_so_sessions', savedKey: 'fixo_inno_sorders',
    docHeading: 'SALES ORDER', draftHeading: 'SALES ORDER (DRAFT)', draftWm: 'DRAFT',
    dateLabel: 'Expected Delivery',
    statuses: { draft: { label: 'Draft', cls: 'st-draft' }, confirmed: { label: 'Confirmed', cls: 'st-sent' }, invoiced: { label: 'Invoiced', cls: 'st-ok' }, cancelled: { label: 'Cancelled', cls: 'st-no' } },
    stages: [
      { label: '💾 Save as Draft', status: 'draft', cls: '' },
      { label: '✓ Confirm order', status: 'confirmed', cls: 'cp-btn-go' },
      { label: '✕ Cancel', status: 'cancelled', cls: 'inv-no' }
    ],
    tally: true,
    convert: { toType: 'INV', label: '➡ Convert to Invoice', icon: '➡' }
  });
  window.FIXO_SO = app;
})();
