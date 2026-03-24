import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../server.js';

const app = createApp({ skipAuth: true, dbPath: ':memory:' });

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
      .send({ name: 'Test Org', sector: 'nonprofit', stage: 'proposal' });
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

  it('filters by stage', async () => {
    await request(app).post('/api/clients').send({ name: 'Prop Client', sector: 'nonprofit', stage: 'proposal' });
    await request(app).post('/api/clients').send({ name: 'Brief Client', sector: 'nonprofit', stage: 'brief' });
    const res = await request(app).get('/api/clients?stage=proposal');
    expect(res.status).toBe(200);
    res.body.forEach(c => expect(c.stage).toBe('proposal'));
  });
});

describe('GET /api/clients/:id', () => {
  it('returns a client with attachments', async () => {
    const created = await request(app).post('/api/clients').send({ name: 'Detail Test', sector: 'nonprofit', stage: 'proposal' });
    const res = await request(app).get(`/api/clients/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Detail Test');
    expect(res.body.attachments).toBeDefined();
    expect(res.body.notes).toBeDefined();
  });

  it('returns 404 for missing client', async () => {
    const res = await request(app).get('/api/clients/99999');
    expect(res.status).toBe(404);
  });
});

describe('PUT /api/clients/:id', () => {
  it('updates client fields', async () => {
    const created = await request(app).post('/api/clients').send({ name: 'Update Me', sector: 'nonprofit', stage: 'proposal' });
    const res = await request(app)
      .put(`/api/clients/${created.body.id}`)
      .send({ stage: 'brief', contactName: 'New Contact' });
    expect(res.status).toBe(200);
    expect(res.body.stage).toBe('brief');
    expect(res.body.contactName).toBe('New Contact');
  });
});

describe('POST /api/clients/:id/notes', () => {
  it('adds a note', async () => {
    const created = await request(app).post('/api/clients').send({ name: 'Note Test', sector: 'nonprofit', stage: 'proposal' });
    const res = await request(app)
      .post(`/api/clients/${created.body.id}/notes`)
      .send({ author: 'Sabriel', content: 'Called the client today.' });
    expect(res.status).toBe(201);
    expect(res.body.author).toBe('Sabriel');
  });
});

describe('POST /api/clients/:id/attachments/:type', () => {
  it('saves an attachment', async () => {
    const created = await request(app).post('/api/clients').send({ name: 'Attach Test', sector: 'nonprofit', stage: 'proposal' });
    const res = await request(app)
      .post(`/api/clients/${created.body.id}/attachments/proposal`)
      .send({ executiveSummary: 'We propose...', total: 9150 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('retrieves an attachment', async () => {
    const created = await request(app).post('/api/clients').send({ name: 'Get Attach', sector: 'nonprofit', stage: 'proposal' });
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
    const created = await request(app).post('/api/clients').send({ name: 'Delete Me', sector: 'nonprofit', stage: 'proposal' });
    const res = await request(app).delete(`/api/clients/${created.body.id}`);
    expect(res.status).toBe(200);
    const check = await request(app).get(`/api/clients/${created.body.id}`);
    expect(check.status).toBe(404);
  });
});
