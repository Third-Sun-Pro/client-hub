import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createDatabase } from './database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const APP_PASSWORD = process.env.APP_PASSWORD || 'thirdsun';
const SECRET = process.env.SESSION_SECRET || 'client-hub-dev-secret';

function signToken(data) {
  const payload = Buffer.from(JSON.stringify(data)).toString('base64');
  const sig = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  return `${payload}.${sig}`;
}

function verifyToken(token) {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  const expected = crypto.createHmac('sha256', SECRET).update(payload).digest('hex');
  if (sig !== expected) return null;
  const data = JSON.parse(Buffer.from(payload, 'base64').toString());
  if (Date.now() - data.ts > 24 * 60 * 60 * 1000) return null;
  return data;
}

function authMiddleware(req, res, next) {
  const token = req.headers.cookie?.match(/auth=([^;]+)/)?.[1];
  if (!verifyToken(token)) return res.status(401).json({ error: 'Unauthorized' });
  next();
}

export function createApp(options = {}) {
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use(express.static(path.join(__dirname, 'public')));

  const db = createDatabase(options.dbPath || path.join(__dirname, 'clients.db'));
  const auth = options.skipAuth ? (req, res, next) => next() : authMiddleware;

  // CORS for tool integration (other tools on different ports)
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && origin.includes('localhost')) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
    if (req.method === 'OPTIONS') return res.status(200).end();
    next();
  });

  // Auth
  app.post('/login', (req, res) => {
    if (req.body.password !== APP_PASSWORD) return res.status(401).json({ error: 'Wrong password' });
    const token = signToken({ ts: Date.now() });
    res.setHeader('Set-Cookie', `auth=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=86400`);
    res.json({ success: true });
  });

  app.get('/check-auth', (req, res) => {
    const token = req.headers.cookie?.match(/auth=([^;]+)/)?.[1];
    res.json({ authenticated: !!verifyToken(token) });
  });

  // Clients API
  app.get('/api/clients', auth, (req, res) => {
    const stage = req.query.stage || null;
    res.json(db.listClients(stage));
  });

  app.post('/api/clients', auth, (req, res) => {
    if (!req.body.name) return res.status(400).json({ error: 'Client name is required' });
    const client = db.createClient(req.body);
    res.status(201).json(client);
  });

  app.get('/api/clients/:id', auth, (req, res) => {
    const client = db.getClient(req.params.id);
    if (!client) return res.status(404).json({ error: 'Client not found' });
    client.notes = db.getNotes(client.id);
    client.attachments = db.listAttachmentTypes(client.id);
    res.json(client);
  });

  app.put('/api/clients/:id', auth, (req, res) => {
    const existing = db.getClient(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Client not found' });
    const updated = db.updateClient(req.params.id, req.body);
    res.json(updated);
  });

  app.delete('/api/clients/:id', auth, (req, res) => {
    db.deleteClient(req.params.id);
    res.json({ success: true });
  });

  // Notes
  app.post('/api/clients/:id/notes', auth, (req, res) => {
    const { author, content } = req.body;
    if (!author || !content) return res.status(400).json({ error: 'Author and content required' });
    const note = db.addNote(req.params.id, { author, content });
    res.status(201).json(note);
  });

  // Attachments
  app.post('/api/clients/:id/attachments/:type', auth, (req, res) => {
    db.saveAttachment(req.params.id, req.params.type, req.body);
    res.json({ success: true });
  });

  app.get('/api/clients/:id/attachments/:type', auth, (req, res) => {
    const data = db.getAttachment(req.params.id, req.params.type);
    if (!data) return res.status(404).json({ error: 'Attachment not found' });
    res.json(data);
  });

  // Tool integration: public client list for other tools to look up clients
  app.get('/api/hub/clients', (req, res) => {
    const clients = db.listClients();
    res.json(clients.map(c => ({ id: c.id, name: c.name, contactName: c.contactName, sector: c.sector, stage: c.stage })));
  });

  // Tool integration: save data from other tools
  app.post('/api/hub/save/:id/:type', (req, res) => {
    const client = db.getClient(req.params.id);
    if (!client) return res.status(404).json({ error: 'Client not found' });
    db.saveAttachment(req.params.id, req.params.type, req.body);
    res.json({ success: true, clientName: client.name });
  });

  // Main page
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  return app;
}

// Start server if run directly
const isMain = process.argv[1] && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
if (isMain) {
  const PORT = process.env.PORT || 3001;
  const app = createApp();
  app.listen(PORT, () => {
    console.log('='.repeat(50));
    console.log('Client Hub');
    console.log(`Open http://localhost:${PORT} in your browser`);
    console.log('='.repeat(50));
  });
}
