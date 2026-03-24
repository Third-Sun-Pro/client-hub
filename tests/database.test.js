import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase } from '../database.js';

let db;

beforeEach(() => {
  db = createDatabase(':memory:');
});

describe('clients', () => {
  it('creates a client and returns it with an id', () => {
    const client = db.createClient({
      name: 'Corner Partners',
      contactName: 'Bill Gaskill',
      contactEmail: 'bill@cornerpartners.com',
      sector: 'small-business',
      keywords: 'real estate, development',
      stage: 'proposal',
    });
    expect(client.id).toBeDefined();
    expect(client.name).toBe('Corner Partners');
    expect(client.stage).toBe('proposal');
  });

  it('gets a client by id', () => {
    const created = db.createClient({ name: 'Test Co', sector: 'nonprofit', stage: 'proposal' });
    const found = db.getClient(created.id);
    expect(found.name).toBe('Test Co');
  });

  it('lists all clients', () => {
    db.createClient({ name: 'Client A', sector: 'nonprofit', stage: 'proposal' });
    db.createClient({ name: 'Client B', sector: 'small-business', stage: 'brief' });
    const clients = db.listClients();
    expect(clients.length).toBe(2);
  });

  it('updates a client', () => {
    const client = db.createClient({ name: 'Old Name', sector: 'nonprofit', stage: 'proposal' });
    db.updateClient(client.id, { name: 'New Name', stage: 'brief' });
    const updated = db.getClient(client.id);
    expect(updated.name).toBe('New Name');
    expect(updated.stage).toBe('brief');
  });

  it('deletes a client', () => {
    const client = db.createClient({ name: 'To Delete', sector: 'nonprofit', stage: 'proposal' });
    db.deleteClient(client.id);
    const found = db.getClient(client.id);
    expect(found).toBeUndefined();
  });

  it('filters clients by stage', () => {
    db.createClient({ name: 'A', sector: 'nonprofit', stage: 'proposal' });
    db.createClient({ name: 'B', sector: 'nonprofit', stage: 'brief' });
    db.createClient({ name: 'C', sector: 'nonprofit', stage: 'proposal' });
    const proposals = db.listClients('proposal');
    expect(proposals.length).toBe(2);
  });

  it('returns clients sorted by most recently updated', () => {
    const a = db.createClient({ name: 'First', sector: 'nonprofit', stage: 'proposal' });
    db.createClient({ name: 'Second', sector: 'nonprofit', stage: 'proposal' });
    db.updateClient(a.id, { stage: 'brief' });
    const clients = db.listClients();
    expect(clients[0].name).toBe('First');
  });
});

describe('notes', () => {
  it('adds a note to a client', () => {
    const client = db.createClient({ name: 'Test', sector: 'nonprofit', stage: 'proposal' });
    const note = db.addNote(client.id, { author: 'Sabriel', content: 'Kick-off meeting scheduled for Friday.' });
    expect(note.id).toBeDefined();
    expect(note.author).toBe('Sabriel');
  });

  it('lists notes for a client in reverse chronological order', () => {
    const client = db.createClient({ name: 'Test', sector: 'nonprofit', stage: 'proposal' });
    db.addNote(client.id, { author: 'Sabriel', content: 'First note' });
    db.addNote(client.id, { author: 'Jocelyn', content: 'Second note' });
    const notes = db.getNotes(client.id);
    expect(notes.length).toBe(2);
    expect(notes[0].content).toBe('Second note');
  });
});

describe('attachments', () => {
  it('saves proposal data to a client', () => {
    const client = db.createClient({ name: 'Test', sector: 'nonprofit', stage: 'proposal' });
    db.saveAttachment(client.id, 'proposal', { executiveSummary: 'We propose...', total: 9150 });
    const att = db.getAttachment(client.id, 'proposal');
    expect(att.executiveSummary).toBe('We propose...');
    expect(att.total).toBe(9150);
  });

  it('saves brief data to a client', () => {
    const client = db.createClient({ name: 'Test', sector: 'nonprofit', stage: 'brief' });
    db.saveAttachment(client.id, 'brief', { content: 'Creative brief content...' });
    const att = db.getAttachment(client.id, 'brief');
    expect(att.content).toBe('Creative brief content...');
  });

  it('saves crawl data to a client', () => {
    const client = db.createClient({ name: 'Test', sector: 'nonprofit', stage: 'pre-launch' });
    db.saveAttachment(client.id, 'crawl', { url: 'https://example.com', issues: 12, score: 85 });
    const att = db.getAttachment(client.id, 'crawl');
    expect(att.issues).toBe(12);
  });

  it('overwrites attachment of same type', () => {
    const client = db.createClient({ name: 'Test', sector: 'nonprofit', stage: 'proposal' });
    db.saveAttachment(client.id, 'proposal', { version: 1 });
    db.saveAttachment(client.id, 'proposal', { version: 2 });
    const att = db.getAttachment(client.id, 'proposal');
    expect(att.version).toBe(2);
  });

  it('returns null for missing attachment', () => {
    const client = db.createClient({ name: 'Test', sector: 'nonprofit', stage: 'proposal' });
    const att = db.getAttachment(client.id, 'brief');
    expect(att).toBeNull();
  });

  it('lists all attachment types for a client', () => {
    const client = db.createClient({ name: 'Test', sector: 'nonprofit', stage: 'brief' });
    db.saveAttachment(client.id, 'proposal', { data: 1 });
    db.saveAttachment(client.id, 'brief', { data: 2 });
    const types = db.listAttachmentTypes(client.id);
    expect(types).toContain('proposal');
    expect(types).toContain('brief');
    expect(types.length).toBe(2);
  });
});
