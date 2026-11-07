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
