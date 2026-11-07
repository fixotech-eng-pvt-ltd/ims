# Fixotech IMS — Team Meeting Roadmap (captured 2026-11-07)

Tracking every item raised in the meeting. Status: ✅ done · 🔶 in progress · ⬜ queued · ⏳ waiting on input from team.

## INNO side
- ✅ **Load all purchase bills** from the Zoho `Bill.xls` export → 263 bills (₹3.80 Cr), 162 opening payments (₹1.43 Cr paid), ₹2.37 Cr open across 124 bills. Auto-loads via `inno-bills-seed.js` (own flag `fixo_inno_bills_v1`); shows in Payments & Bills → Outstanding/Payables.
- ⏳ **App logos to be changed** — user will drop new logo files in the project folder; swap the Inno app-icon PNGs once received.

## ENGINEERING side
### Indent
- ✅ **Editable indent mid-order** — sent/live indents now have an **✎ Edit** button; edits merge onto the live factory record and **preserve production progress** (qtyDone/status/photos). (`indent.js`, `factory.js receiveIndent({update:true})`)
- ✅ **Drawing / product-photo section** — wide, dynamic card in Prepare: attach customer drawings / product photos / new designs, caption, **office "Approved" checkbox**, delete; auto-downscaled; printed as an approved-drawings sheet; carried to the factory record.

### Factory Store — steel sheets inventory (CORE) ✅
- ✅ New **Sheet Store** app (`sheet-store.js`), separate from accessories inventory.
- ✅ Sheet types: MS / HR / HRPO / GI / Stainless Steel × thickness × size; opening stock by engineer; reorder level.
- ✅ Receive (with supplier + bill no + amount) and Use; **partial sheets** (decimals) supported; running balance; **daily closing balance** (Day-close tab, printable); Movements log.
- ✅ Office view: opening / received / used / balance per type + LOW flags.
- ✅ **Photo + AI sheet-count** on receive: attach a stack photo → edge-based band counter estimates the count (sensitivity + direction), and **flags any mismatch vs the declared count** (e.g. declared 80, scan 75). Estimate the engineer confirms — not a trained model.
- ⬜ Later: auto-deduct a sheet when an order consumes it (currently manual Use); link sheet bills into Payables.

### Factory Floor UI redesign ✅
- ✅ Converted cramped top tabs into a **left section rail** (Zoho-style): Indents · Products · Customers · Inventory · Documents & copies · Upload floor sheet → clean 3-column rail · filters · content.
- ✅ **Removed** the photo-in-to-do (per-stage verification photo); the floor now taps to advance.

### Production plan → operator slips ✅
- ✅ Production plan stays with engineers; new **🧾 Operator slips** button on each indent generates **one A4 slip per operation** (cutting/slotting/perforation/punching/bending) listing only the items needing it, with Planned/Done/Rejected columns, final-check ticks and operator + supervisor signature boxes. (`factory.js operatorSlipsHtml`)

### Packing list ⬜  (PDF provided: `0932_Trinity Heat Treatment..pdf`)
- Factory side creates packing list (vehicle number, etc.); **office sees which vehicle is going**; keep full records. (Dispatch note now carries vehicle + Tally code — see below; a dedicated packing-list layout still to add from the PDF.)

### Fixotech Records (office) ✅
- ✅ New **Records** app (`records.js`): one register of every quotation, proforma, indent, production plan, inspection report, dispatch note, sales order, invoice, purchase bill and job work (402 live records). Filter by **type / year / customer** + free **search**, CSV export, view/open.
- ✅ **Smart IQ linked** — `FIXO_RECORDS.query()` wired into ChatIQ; asking IQ for a document returns matching records.

### Job Work / Outsourcing (factory) ✅
- ✅ New **Job Work** app (`jobwork.js`): send material out (laser cutting / rolling / powder coating / …), track vendor, qty out, expected return, cost; **Receive back** (partial supported), overdue flag, by-vendor view. Powder-coating colour field included; full spec extensible later.

### Dispatch note ✅
- ✅ **Tally code** (FIX/DN/…) + **vehicle number** added to the dispatch note and saved on the dispatch record (office + Customer-Centric read them).

### Customer Centric (office) ✅
- ✅ New **Customer Centric** app (`customer-centric.js`): pick a customer + day/week/month → all their quotations, orders, invoices, dispatches (with vehicle + Tally code) and job work in one place, with totals. **Tally voucher** export for their invoices (reuses inno-core openTally). **Payments** = placeholder kept for the last stage.

### Admin panel ✅ (partial)
- ✅ **Activity log** already in Admin → Monitoring; the new apps (Sheet Store, Job Work, operator slips, dispatch) now log to `FIXO_LOG` so day-to-day actions show there.
- ✅ **Data Manager in Admin** — simple panel in Admin → Inno Data: Save & sync now, Download full backup, save-status line, Open full Data Manager.
- ⬜ Users / roles — later phase.

---
Delivered `fixo-v45`: Inno bills load, indent editability, indent drawings.
Delivered `fixo-v46`: Sheet Store (+AI count), factory left-rail redesign, removed photo-in-todo.
Delivered `fixo-v47`: operator slips, Job Work, dispatch Tally code + vehicle, Records (+Smart IQ), Customer Centric, admin activity logging + Data Manager in admin.
Remaining: dedicated packing-list layout (from PDF); sheet auto-deduct on order + sheet bills → payables; users/roles; powder-coat detailed spec (awaiting team); new app logos (awaiting team).
