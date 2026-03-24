import 'dotenv/config';
import express from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import multer from 'multer';
import Anthropic from '@anthropic-ai/sdk';
import { createDatabase } from './database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const upload = multer({ dest: path.join(__dirname, 'uploads/'), limits: { fileSize: 20 * 1024 * 1024 } });

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

  const db = createDatabase(options.dbPath || path.join(__dirname, 'data', 'clients.json'));
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
    res.json(db.listClients());
  });

  app.post('/api/clients', auth, (req, res) => {
    if (!req.body.name) return res.status(400).json({ error: 'Client name is required' });
    const client = db.createClient(req.body);
    res.status(201).json(client);
  });

  app.get('/api/clients/:id', auth, (req, res) => {
    const client = db.getClient(req.params.id);
    if (!client) return res.status(404).json({ error: 'Client not found' });
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

  // Extract client info from pasted notes/uploaded docs
  app.post('/api/extract-client', auth, upload.array('files', 10), async (req, res) => {
    try {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });

      let content = req.body.notes || '';
      if (req.files?.length) {
        for (const file of req.files) {
          if (file.mimetype === 'application/pdf') {
            const pdfParse = (await import('pdf-parse')).default;
            const buffer = fs.readFileSync(file.path);
            const data = await pdfParse(buffer);
            content += '\n\n' + data.text;
          } else {
            content += '\n\n' + fs.readFileSync(file.path, 'utf-8');
          }
          fs.unlinkSync(file.path);
        }
      }

      if (!content.trim()) return res.status(400).json({ error: 'No content provided' });

      const client = new Anthropic({ apiKey });
      const response = await client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{ role: 'user', content: `Extract client information from the following meeting transcript, notes, or documents. Return ONLY valid JSON:

{
  "name": "organization/company name",
  "contactName": "primary contact person's name",
  "contactEmail": "email if found, or empty string",
  "sector": "nonprofit" or "small-business" or "education" or "government",
  "keywords": "2-3 industry keywords separated by commas",
  "projectType": "web-design" or "branding-web" or "branding" or "redesign",
  "summary": "1-2 sentence summary of what the client needs"
}

If a field cannot be determined, use an empty string.

CONTENT:
${content.slice(0, 8000)}` }],
      });

      const text = response.content[0].text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
      const extracted = JSON.parse(text);
      res.json({ success: true, ...extracted });
    } catch (err) {
      console.error('[Extract Error]', err.message);
      res.status(500).json({ error: err.message });
    }
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
  app.listen(PORT, '0.0.0.0', () => {
    console.log('='.repeat(50));
    console.log('Client Hub');
    console.log(`Open http://localhost:${PORT} in your browser`);
    console.log('='.repeat(50));
  });
}
