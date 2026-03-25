import fs from 'fs';
import path from 'path';

export function createDatabase(dbPath = './data/clients.json') {
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  let store = { nextId: 1, clients: [], attachments: [] };

  if (fs.existsSync(dbPath)) {
    store = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  }

  function save() {
    fs.writeFileSync(dbPath, JSON.stringify(store, null, 2));
  }

  return {
    createClient(fields) {
      const client = {
        id: store.nextId++,
        name: fields.name || '',
        contactName: fields.contactName || '',
        contactEmail: fields.contactEmail || '',
        sector: fields.sector || '',
        keywords: fields.keywords || '',
        projectType: fields.projectType || '',
        websiteUrl: fields.websiteUrl || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      store.clients.push(client);
      save();
      return client;
    },

    getClient(id) {
      return store.clients.find(c => c.id === Number(id)) || null;
    },

    listClients({ includeArchived = false } = {}) {
      const filtered = includeArchived ? store.clients : store.clients.filter(c => !c.archived);
      return [...filtered].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    listArchivedClients() {
      return [...store.clients.filter(c => c.archived)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    },

    updateClient(id, fields) {
      const client = this.getClient(id);
      if (!client) return null;
      const allowed = ['name', 'contactName', 'contactEmail', 'sector', 'keywords', 'projectType', 'websiteUrl', 'archived'];
      for (const key of allowed) {
        if (fields[key] !== undefined) client[key] = fields[key];
      }
      client.updatedAt = new Date().toISOString();
      save();
      return client;
    },

    deleteClient(id) {
      const numId = Number(id);
      store.clients = store.clients.filter(c => c.id !== numId);
      store.attachments = store.attachments.filter(a => a.clientId !== numId);
      save();
    },

    saveAttachment(clientId, type, data) {
      const numId = Number(clientId);
      const existing = store.attachments.find(a => a.clientId === numId && a.type === type);
      if (existing) {
        existing.data = data;
        existing.updatedAt = new Date().toISOString();
      } else {
        store.attachments.push({ clientId: numId, type, data, updatedAt: new Date().toISOString() });
      }
      save();
    },

    getAttachment(clientId, type) {
      const att = store.attachments.find(a => a.clientId === Number(clientId) && a.type === type);
      return att ? att.data : null;
    },

    listAttachmentTypes(clientId) {
      return store.attachments.filter(a => a.clientId === Number(clientId)).map(a => a.type);
    },
  };
}
