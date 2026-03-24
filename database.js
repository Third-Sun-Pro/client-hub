import Database from 'better-sqlite3';

export function createDatabase(dbPath = 'clients.db') {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contactName TEXT DEFAULT '',
      contactEmail TEXT DEFAULT '',
      sector TEXT DEFAULT '',
      keywords TEXT DEFAULT '',
      projectType TEXT DEFAULT '',
      stage TEXT DEFAULT 'proposal',
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clientId INTEGER NOT NULL,
      author TEXT NOT NULL,
      content TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (clientId) REFERENCES clients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clientId INTEGER NOT NULL,
      type TEXT NOT NULL,
      data TEXT NOT NULL,
      updatedAt TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (clientId) REFERENCES clients(id) ON DELETE CASCADE,
      UNIQUE(clientId, type)
    );
  `);

  return {
    createClient(fields) {
      const stmt = db.prepare(`
        INSERT INTO clients (name, contactName, contactEmail, sector, keywords, projectType, stage)
        VALUES (@name, @contactName, @contactEmail, @sector, @keywords, @projectType, @stage)
      `);
      const result = stmt.run({
        name: fields.name || '',
        contactName: fields.contactName || '',
        contactEmail: fields.contactEmail || '',
        sector: fields.sector || '',
        keywords: fields.keywords || '',
        projectType: fields.projectType || '',
        stage: fields.stage || 'proposal',
      });
      return this.getClient(result.lastInsertRowid);
    },

    getClient(id) {
      return db.prepare('SELECT * FROM clients WHERE id = ?').get(id);
    },

    listClients(stage) {
      if (stage) {
        return db.prepare('SELECT * FROM clients WHERE stage = ? ORDER BY updatedAt DESC').all(stage);
      }
      return db.prepare('SELECT * FROM clients ORDER BY updatedAt DESC').all();
    },

    updateClient(id, fields) {
      const allowed = ['name', 'contactName', 'contactEmail', 'sector', 'keywords', 'projectType', 'stage'];
      const sets = [];
      const values = {};
      for (const key of allowed) {
        if (fields[key] !== undefined) {
          sets.push(`${key} = @${key}`);
          values[key] = fields[key];
        }
      }
      if (sets.length === 0) return this.getClient(id);
      sets.push("updatedAt = datetime('now')");
      values.id = id;
      db.prepare(`UPDATE clients SET ${sets.join(', ')} WHERE id = @id`).run(values);
      return this.getClient(id);
    },

    deleteClient(id) {
      db.prepare('DELETE FROM clients WHERE id = ?').run(id);
    },

    addNote(clientId, { author, content }) {
      const stmt = db.prepare('INSERT INTO notes (clientId, author, content) VALUES (?, ?, ?)');
      const result = stmt.run(clientId, author, content);
      return db.prepare('SELECT * FROM notes WHERE id = ?').get(result.lastInsertRowid);
    },

    getNotes(clientId) {
      return db.prepare('SELECT * FROM notes WHERE clientId = ? ORDER BY id DESC').all(clientId);
    },

    saveAttachment(clientId, type, data) {
      db.prepare(`
        INSERT INTO attachments (clientId, type, data, updatedAt)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(clientId, type) DO UPDATE SET data = excluded.data, updatedAt = datetime('now')
      `).run(clientId, type, JSON.stringify(data));
    },

    getAttachment(clientId, type) {
      const row = db.prepare('SELECT data FROM attachments WHERE clientId = ? AND type = ?').get(clientId, type);
      return row ? JSON.parse(row.data) : null;
    },

    listAttachmentTypes(clientId) {
      return db.prepare('SELECT type FROM attachments WHERE clientId = ?').all(clientId).map(r => r.type);
    },
  };
}
