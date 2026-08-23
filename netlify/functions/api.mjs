// Fixotech IMS — serverless API (Netlify Function) for SHARED, saved data.
// Mirrors the local Express server (server/index.js): clients + orders, backed
// by MongoDB Atlas. Enable it by setting the MONGODB_URI environment variable in
// Netlify (Site settings → Environment variables). Without it the app falls back
// to on-device storage, so the site still works.
//
// The app's db.js calls  <site>/api/clients , /api/orders , /api/health , etc.
// netlify.toml rewrites /api/* here.
import { MongoClient } from 'mongodb';

let client;
async function getDb() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI not set');
  if (!client) { client = new MongoClient(process.env.MONGODB_URI); await client.connect(); }
  return client.db('fixotech');
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const strip = (o) => { if (o) delete o._id; return o; };
const CORS = { 'content-type': 'application/json', 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'access-control-allow-headers': 'content-type' };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: CORS });

export default async (req) => {
  if (req.method === 'OPTIONS') return json({}, 204);
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/api/, '') || '/';   // -> /clients, /orders/<id>, /health
  const seg = path.split('/').filter(Boolean);                // ['clients', '<id>']
  const id = seg[1];
  const method = req.method;

  try {
    const db = await getDb();

    if (seg[0] === 'health') return json({ ok: true, db: 'mongodb' });

    if (seg[0] === 'clients') {
      const col = db.collection('clients');
      if (method === 'GET') return json((await col.find({}).sort({ company_name: 1 }).toArray()).map(strip));
      if (method === 'POST') { const rec = Object.assign({ id: uid() }, await req.json()); await col.insertOne(rec); return json(strip(rec)); }
      if (method === 'PATCH' && id) { const b = await req.json(); delete b._id; delete b.id; await col.updateOne({ id }, { $set: b }); return json(strip(await col.findOne({ id }))); }
      if (method === 'DELETE' && id) { await db.collection('orders').deleteMany({ client_id: id }); await col.deleteOne({ id }); return json({ ok: true }); }
    }

    if (seg[0] === 'orders') {
      const col = db.collection('orders');
      if (method === 'GET') { const c = url.searchParams.get('clientId'); return json((await col.find(c ? { client_id: c } : {}).sort({ order_date: -1 }).toArray()).map(strip)); }
      if (method === 'POST') { const rec = Object.assign({ id: uid() }, await req.json()); await col.insertOne(rec); return json(strip(rec)); }
      if (method === 'DELETE' && id) { await col.deleteOne({ id }); return json({ ok: true }); }
    }

    return json({ error: 'not found', path }, 404);
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 500);
  }
};
