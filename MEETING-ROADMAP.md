# Fixotech IMS — Team Meeting Roadmap (captured 2026-11-07)

Tracking every item raised in the meeting. Status: ✅ done · 🔶 in progress · ⬜ queued · ⏳ waiting on input from team.

## INNO side
- ✅ **Load all purchase bills** from the Zoho `Bill.xls` export → 263 bills (₹3.80 Cr), 162 opening payments (₹1.43 Cr paid), ₹2.37 Cr open across 124 bills. Auto-loads via `inno-bills-seed.js` (own flag `fixo_inno_bills_v1`); shows in Payments & Bills → Outstanding/Payables.
- ⏳ **App logos to be changed** — user will drop new logo files in the project folder; swap the Inno app-icon PNGs once received.

## ENGINEERING side
### Indent
- ✅ **Editable indent mid-order** — sent/live indents now have an **✎ Edit** button; edits merge onto the live factory record and **preserve production progress** (qtyDone/status/photos). (`indent.js`, `factory.js receiveIndent({update:true})`)
- ✅ **Drawing / product-photo section** — wide, dynamic card in Prepare: attach customer drawings / product photos / new designs, caption, **office "Approved" checkbox**, delete; auto-downscaled; printed as an approved-drawings sheet; carried to the factory record.

### Factory Store — steel sheets inventory (CORE) ⬜
- Separate "Factory Store" for **sheets** (distinct from accessories inventory like strut channel / threaded rod).
- Sheet types: **MS, HR, HRPO, GI, Stainless Steel** × thicknesses (1.0, 1.5, …).
- Opening stock entered by engineer on the factory floor.
- Save **sheet purchase bills** here (office + factory side), from steel center / various suppliers.
- On an order, the worker **selects the sheet used → auto-deducts → running balance → daily closing balance** auto-computed.
- **Partial sheet use** (a sheet split, part used / part kept) must be supported.
- Mid-day: extra usage OR new stock received → both accepted dynamically.
- **Office view**: available / used / remaining per sheet type, so office decides when to reorder.

### Production plan → operator slips ⬜
- Production **plan book stays with engineers** (not circulated to everyone).
- Generate **per-operation A4 slips** (cutting, punching, bending, … per product requirement) per **customer + requirement**: qty to do / done, final checks, signature box.
- Engineer consolidates signed slips → punches/seals → attaches to the final production plan with the order.

### Packing list ⬜  (PDF provided: `0932_Trinity Heat Treatment..pdf`)
- Factory side creates packing list (vehicle number, etc.); **office sees which vehicle is going**; keep full records.

### Fixotech Records (office) ⬜
- One place storing **every** order, quotation, proforma, indent, production plan, slip, dispatch note.
- Filter by date / year / customer; **search**.
- **Interlinked with Smart IQ** — ask IQ for a document → it returns it.

### Job Work / Outsourcing (factory) ⬜
- Track outsourced work: **laser cutting, rolling, powder coating** — goes out, gets done, comes back.
- ⏳ Powder-coating full spec coming from team.

### Dispatch note ⬜
- Add a **Tally code** to the dispatch note.

### Customer Centric (office) ⬜
- All orders for a customer for the day/week/month gathered in one place → final stage recorded in **ledger / Tally**.
- Dispatch note + **Tally code** + vehicle number + full details land here.
- ⬜ **Payment last stage** — hold; keep ready to slot in.

### Admin panel ⬜
- **Activity log of every day-to-day action** (who did what, when) visible in admin.
- Move the Inno **Data Manager into the admin panel** — simple (activate / save), admin-access; developers see save/sync status at a glance.
- ⬜ Users / roles — later phase.

---
Delivered this pass (app `fixo-v45`): Inno bills load, indent editability, indent drawings.
Next up (suggested order): Factory Store (sheets) → Records app + Smart IQ link → Production slips → Job Work → Dispatch Tally code + Customer Centric → Admin activity panel + Data Manager move.
