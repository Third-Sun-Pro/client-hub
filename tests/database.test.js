import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createDatabase } from '../database.js';

const TEST_DB = path.join(import.meta.dirname, '.test-clients.json');
let db;

beforeEach(() => {
  db = createDatabase(TEST_DB);
});

afterEach(() => {
  if (fs.existsSync(TEST_DB)) fs.unlinkSync(TEST_DB);
});

describe('clients', () => {
  it('creates a client and returns it with an id', () => {
    const client = db.createClient({
      name: 'Corner Partners',
      contactName: 'Bill Gaskill',
      contactEmail: 'bill@cornerpartners.com',
      sector: 'small-business',
      keywords: 'real estate, development',
    });
    expect(client.id).toBeDefined();
    expect(client.name).toBe('Corner Partners');
  });

  it('gets a client by id', () => {
    const created = db.createClient({ name: 'Test Co', sector: 'nonprofit' });
    const found = db.getClient(created.id);
    expect(found.name).toBe('Test Co');
  });

  it('lists all clients', () => {
    db.createClient({ name: 'Client A', sector: 'nonprofit' });
    db.createClient({ name: 'Client B', sector: 'small-business' });
    const clients = db.listClients();
    expect(clients.length).toBe(2);
  });

  it('updates a client', () => {
    const client = db.createClient({ name: 'Old Name', sector: 'nonprofit' });
    db.updateClient(client.id, { name: 'New Name' });
    const updated = db.getClient(client.id);
    expect(updated.name).toBe('New Name');
  });

  it('deletes a client', () => {
    const client = db.createClient({ name: 'To Delete', sector: 'nonprofit' });
    db.deleteClient(client.id);
    const found = db.getClient(client.id);
    expect(found).toBeNull();
  });

  it('returns clients sorted by most recently updated', () => {
    const a = db.createClient({ name: 'First', sector: 'nonprofit' });
    db.createClient({ name: 'Second', sector: 'nonprofit' });
    db.updateClient(a.id, { contactName: 'Updated' });
    const clients = db.listClients();
    expect(clients[0].name).toBe('First');
  });

  it('persists data to disk', () => {
    db.createClient({ name: 'Persisted', sector: 'nonprofit' });
    const db2 = createDatabase(TEST_DB);
    const clients = db2.listClients();
    expect(clients.length).toBe(1);
    expect(clients[0].name).toBe('Persisted');
  });
});

describe('attachments', () => {
  it('saves proposal data to a client', () => {
    const client = db.createClient({ name: 'Test', sector: 'nonprofit' });
    db.saveAttachment(client.id, 'proposal', { executiveSummary: 'We propose...', total: 9150 });
    const att = db.getAttachment(client.id, 'proposal');
    expect(att.executiveSummary).toBe('We propose...');
    expect(att.total).toBe(9150);
  });

  it('saves brief data to a client', () => {
    const client = db.createClient({ name: 'Test', sector: 'nonprofit' });
    db.saveAttachment(client.id, 'brief', { content: 'Creative brief content...' });
    const att = db.getAttachment(client.id, 'brief');
    expect(att.content).toBe('Creative brief content...');
  });

  it('saves crawl data to a client', () => {
    const client = db.createClient({ name: 'Test', sector: 'nonprofit' });
    db.saveAttachment(client.id, 'crawl', { url: 'https://example.com', issues: 12, score: 85 });
    const att = db.getAttachment(client.id, 'crawl');
    expect(att.issues).toBe(12);
  });

  it('overwrites attachment of same type', () => {
    const client = db.createClient({ name: 'Test', sector: 'nonprofit' });
    db.saveAttachment(client.id, 'proposal', { version: 1 });
    db.saveAttachment(client.id, 'proposal', { version: 2 });
    const att = db.getAttachment(client.id, 'proposal');
    expect(att.version).toBe(2);
  });

  it('returns null for missing attachment', () => {
    const client = db.createClient({ name: 'Test', sector: 'nonprofit' });
    const att = db.getAttachment(client.id, 'brief');
    expect(att).toBeNull();
  });

  it('lists all attachment types for a client', () => {
    const client = db.createClient({ name: 'Test', sector: 'nonprofit' });
    db.saveAttachment(client.id, 'proposal', { data: 1 });
    db.saveAttachment(client.id, 'brief', { data: 2 });
    const types = db.listAttachmentTypes(client.id);
    expect(types).toContain('proposal');
    expect(types).toContain('brief');
    expect(types.length).toBe(2);
  });

  it('deletes attachments when client is deleted', () => {
    const client = db.createClient({ name: 'Test', sector: 'nonprofit' });
    db.saveAttachment(client.id, 'proposal', { data: 1 });
    db.deleteClient(client.id);
    const att = db.getAttachment(client.id, 'proposal');
    expect(att).toBeNull();
  });
});
