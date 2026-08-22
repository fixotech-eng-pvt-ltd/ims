// ============================================================
// Fixotech backend API — Express + MongoDB (Mongoose)
// Serves clients & orders for the Smart Calculator ecosystem.
//
// Storage:
//   - If MONGODB_URI is set  -> connects to that (local MongoDB or Atlas cloud).
//   - Otherwise               -> starts an embedded MongoDB persisted to
//                                ./.mongo-data (zero-install, local-first).
// ============================================================
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const PORT = process.env.PORT || 4000;
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

async function resolveMongoUri() {
  if (process.env.MONGODB_URI) {
    console.log('[fixo] using MONGODB_URI');
    return process.env.MONGODB_URI;
  }
  // Zero-install embedded MongoDB, persisted to disk (local-first default).
  const { MongoMemoryServer } = require('mongodb-memory-server');
  const dbPath = path.join(__dirname, '.mongo-data');
  fs.mkdirSync(dbPath, { recursive: true });
  const mem = await MongoMemoryServer.create({
    instance: { dbName: 'fixotech', dbPath, storageEngine: 'wiredTiger' }
  });
  global.__fixoMem = mem; // keep reference alive
  console.log('[fixo] embedded MongoDB (persisted at .mongo-data)');
  return mem.getUri('fixotech');
}

const clientSchema = new mongoose.Schema({
  id: { type: String, index: true, unique: true },
  company_name: String, client_name: String, phone: String, email: String,
  gstin: String, site_address: String, notes: String,
  created_at: { type: Date, default: Date.now }
}, { minimize: false, versionKey: false, strict: false });

const orderSchema = new mongoose.Schema({
  id: { type: String, index: true, unique: true },
  client_id: { type: String, index: true },
  order_date: String, quote_no: String,
  items: { type: Array, default: [] },
  total_cost: Number, total_weight: Number, status: String,
  source: String, filename: String, raw_text: String,
  created_at: { type: Date, default: Date.now }
}, { minimize: false, versionKey: false, strict: false });

const Client = mongoose.model('Client', clientSchema);
const Order = mongoose.model('Order', orderSchema);

const clean = (doc) => { if (!doc) return doc; const o = doc.toObject ? doc.toObject() : doc; delete o._id; return o; };

(async () => {
  const uri = await resolveMongoUri();
  await mongoose.connect(uri);
  console.log('[fixo] MongoDB connected');

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '8mb' }));

  app.get('/api/health', (req, res) => res.json({ ok: true, db: 'mongodb' }));

  // ---------- Clients ----------
  app.get('/api/clients', async (req, res) => {
    const rows = await Client.find().sort({ company_name: 1 }).lean();
    res.json(rows.map(r => { delete r._id; return r; }));
  });
  app.post('/api/clients', async (req, res) => {
    const rec = Object.assign({ id: uid() }, req.body);
    res.json(clean(await Client.create(rec)));
  });
  app.patch('/api/clients/:id', async (req, res) => {
    const body = Object.assign({}, req.body); delete body._id; delete body.id;
    res.json(clean(await Client.findOneAndUpdate({ id: req.params.id }, body, { new: true })));
  });
  app.delete('/api/clients/:id', async (req, res) => {
    await Order.deleteMany({ client_id: req.params.id });
    await Client.deleteOne({ id: req.params.id });
    res.json({ ok: true });
  });

  // ---------- Orders ----------
  app.get('/api/orders', async (req, res) => {
    const q = req.query.clientId ? { client_id: req.query.clientId } : {};
    const rows = await Order.find(q).sort({ order_date: -1 }).lean();
    res.json(rows.map(r => { delete r._id; return r; }));
  });
  app.post('/api/orders', async (req, res) => {
    const rec = Object.assign({ id: uid() }, req.body);
    res.json(clean(await Order.create(rec)));
  });
  app.delete('/api/orders/:id', async (req, res) => {
    await Order.deleteOne({ id: req.params.id });
    res.json({ ok: true });
  });

  app.listen(PORT, () => console.log('[fixo] API listening on http://localhost:' + PORT));
})().catch(e => { console.error('[fixo] fatal', e); process.exit(1); });
