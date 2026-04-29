# Client Hub

Central client pipeline dashboard for Third Sun Productions. Tracks clients from proposal through launch with integrated tool access.

## Stack
- Node.js, Express 5
- SQLite (better-sqlite3) locally; JSON file storage on Hostinger (native modules don't compile on Hostinger shared hosting)
- Vanilla HTML/CSS/JS frontend
- HMAC-SHA256 cookie auth

## Development
- `npm test` — runs 27 tests (vitest + supertest)
- `node server.js` — starts on port 3001
- Database (local): `clients.db` (SQLite, auto-created, gitignored)
- Data directory (production): set `DATA_DIR` env var to a path *outside* the deploy folder (e.g. `../data`) so data persists across auto-deploys — Hostinger wipes the app directory on each push

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
Deployed at **hub.tsapp.us** (Hostinger, auto-deploy from GitHub).

`.env` needs `APP_PASSWORD` and `DATA_DIR` (pointing outside the deploy folder). Create `.env` manually on the server — deploys wipe the app directory so `.env` must not be committed to git.
