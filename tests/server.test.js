import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { createApp } from '../server.js';

const TEST_DB = path.join(import.meta.dirname, '.test-server-clients.json');
const app = createApp({ skipAuth: true, dbPath: TEST_DB });

afterAll(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

describe('GET /', () => {
  it('returns the dashboard', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Client Hub');
  });
});

describe('POST /api/clients', () => {
  it('creates a client', async () => {
    const res = await request(app)
      .post('/api/clients')
      .send({ name: 'Test Org', sector: 'nonprofit' });
    expect(res.status).toBe(201);
    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('Test Org');
  });

  it('rejects client without name', async () => {
    const res = await request(app)
      .post('/api/clients')
      .send({ sector: 'nonprofit' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/clients', () => {
  it('returns all clients', async () => {
    const res = await request(app).get('/api/clients');
    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);
  });
});

describe('GET /api/clients/:id', () => {
  it('returns a client with attachments', async () => {
    const created = await request(app).post('/api/clients').send({ name: 'Detail Test', sector: 'nonprofit' });
    const res = await request(app).get(`/api/clients/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Detail Test');
    expect(res.body.attachments).toBeDefined();
  });

  it('returns 404 for missing client', async () => {
    const res = await request(app).get('/api/clients/99999');
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/clients/:id', () => {
  it('updates client fields', async () => {
    const created = await request(app).post('/api/clients').send({ name: 'Update Me', sector: 'nonprofit' });
    const res = await request(app)
      .put(`/api/clients/${created.body.id}`)
      .send({ contactName: 'New Contact' });
    expect(res.status).toBe(200);
    expect(res.body.contactName).toBe('New Contact');
  });
});

describe('POST /api/clients/:id/attachments/:type', () => {
  it('saves an attachment', async () => {
    const created = await request(app).post('/api/clients').send({ name: 'Attach Test', sector: 'nonprofit' });
    const res = await request(app)
      .post(`/api/clients/${created.body.id}/attachments/proposal`)
      .send({ executiveSummary: 'We propose...', total: 9150 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('retrieves an attachment', async () => {
    const created = await request(app).post('/api/clients').send({ name: 'Get Attach', sector: 'nonprofit' });
    await request(app)
      .post(`/api/clients/${created.body.id}/attachments/proposal`)
      .send({ total: 5000 });
    const res = await request(app).get(`/api/clients/${created.body.id}/attachments/proposal`);
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(5000);
  });
});

describe('DELETE /api/clients/:id', () => {
  it('deletes a client', async () => {
    const created = await request(app).post('/api/clients').send({ name: 'Delete Me', sector: 'nonprofit' });
    const res = await request(app).delete(`/api/clients/${created.body.id}`);
    expect(res.status).toBe(200);
    const check = await request(app).get(`/api/clients/${created.body.id}`);
    expect(check.status).toBe(404);
  });
});

describe('Hub API', () => {
  it('lists clients without auth', async () => {
    const res = await request(app).get('/api/hub/clients');
    expect(res.status).toBe(200);
    expect(res.body).toBeInstanceOf(Array);
  });

  it('saves data from tools without auth', async () => {
    const created = await request(app).post('/api/clients').send({ name: 'Hub Test', sector: 'nonprofit' });
    const res = await request(app)
      .post(`/api/hub/save/${created.body.id}/brief`)
      .send({ markdown: '# Brief content', clientName: 'Hub Test' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
