# Client Hub

Central client pipeline dashboard for Third Sun Productions. Tracks clients from proposal through launch with integrated tool access.

## Stack
- Node.js, Express 5, better-sqlite3
- Vanilla HTML/CSS/JS frontend
- HMAC-SHA256 cookie auth

## Development
- `npm test` — runs 27 tests (vitest + supertest)
- `node server.js` — starts on port 3001
- Database: `clients.db` (SQLite, auto-created, gitignored)

## Architecture
- `server.js` — Express app with auth, client CRUD, notes, attachments, hub API
- `database.js` — SQLite layer (clients, notes, attachments tables)
- `public/index.html` — Single-page dashboard with pipeline view and client detail modal

## Pipeline Stages
proposal → brief → build → pre-launch → live

## Tool Integration
Other tools communicate with the hub via:
- `GET /api/hub/clients` — tools can look up clients (no auth required)
- `POST /api/hub/save/:id/:type` — tools save data back (no auth required, localhost only)
- Tools are launched from the hub with client context passed as URL params (`?hubClient=ID&clientName=...`)

## Integrated Tools
- **Proposal Generator** (port 3000) — writes proposal data back to hub
- **Brief Generator** (port 3002) — will write brief data back
- **Site Crawler** (port 5000) — will write crawl results back
- **Support Hub** (port 3003) — read-only client lookup

## Deployment
Will deploy to Hostinger. `.env` needs `APP_PASSWORD`.
