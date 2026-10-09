# MedRem — Medication Reminder System

MedRem is a small web app for tracking medications, dose reminders, refill counts and
doctor check-ups. It is a single repo that runs a **React (Vite) frontend** and an
**Express + SQLite backend**.

## Tech stack

| Layer | Technology | Port |
| --- | --- | --- |
| Frontend | React 19 + Vite 8 (HashRouter) | 5173 (dev) |
| Backend / API | Express 5 (`server/index.js`) | 3000 |
| Database | SQLite via Node's built-in `node:sqlite` (`server/data/medrem.db`) | — |
| Auth | Bearer token sessions stored in SQLite | — |

The frontend always calls the API on the relative path `/api`. During development Vite
proxies `/api` to `http://localhost:3000` (see `vite.config.js`). In production the
Express server serves the built `dist/` folder and the API from the same port.

## Requirements

- **Node.js 22.5 or newer** (the database uses the built-in `node:sqlite` module).
  Node 24 LTS is recommended. Check with `node --version`.
- npm (bundled with Node).

No native compiler or build tools are required.

## Easiest way to run (Windows)

Double-click **`run-medrem.cmd`** in this folder. It will:

1. check that Node.js is installed,
2. run `npm install` automatically the first time,
3. start the backend and frontend together, and
4. **open MedRem in your browser automatically** at `http://localhost:5173`.

Keep the black window open while you use MedRem; close it (or press `Ctrl+C`) to stop
MedRem. Closing the window also frees the ports, so there is nothing left running.

## Install / run manually

Open **Command Prompt** and run:

```cmd
cd /d C:\Users\Carol\Desktop\MedRem
npm install
npm run dev
```

`npm run dev` starts the backend (port 3000) and the Vite dev server (port 5173)
together with hot reload, opens `http://localhost:5173` in your browser, and starts a
temporary public link through `scripts/cloudflared.exe` if present. If a MedRem backend
is already running on port 3000, the launcher reuses it instead of crashing.

## Run — production (single port)

Builds the frontend and serves everything from Express on port 3000:

```cmd
npm start
```

Then open Chrome at:

```
http://localhost:3000
```

## Other commands

| Command | What it does |
| --- | --- |
| `npm run server` | Start only the backend (port 3000) |
| `npm run build` | Build the frontend into `dist/` |
| `npm run preview` | Preview the built frontend (port 4173, proxies `/api` to 3000) |
| `npm run lint` | Run oxlint |

## Configuration

- `PORT` — backend port (default `3000`). Example: `set PORT=4000 && npm run server`
- `MEDREM_DATA` — folder for the SQLite file (default `server/data`).
- `MEDREM_NO_OPEN=1` — start without automatically opening the browser.

If you change `PORT`, update the `/api` targets in `vite.config.js` to match.

## Features

- Email/password accounts with bearer-token sessions (signup, login, logout, profile,
  password change).
- Medication management: name, dosage, multiple daily times, days of week, start date,
  advance reminder, refill tracking with low-stock threshold.
- Daily schedule with Take / Skip / Undo dose logging.
- Check-up scheduling with contact, location, notes and advance reminder.
- In-app notification bell and browser/PWA notifications, dark/light theme, install to
  home screen.

## Troubleshooting

**`ERR_CONNECTION_REFUSED` in Chrome** — the page was opened on a port where nothing is
listening. Use the URL that matches the command you ran:

- `npm run dev` → `http://localhost:5173`
- `npm start` → `http://localhost:3000`

**`Port 3000 is already in use`** — a previous MedRem server is still running. Find and
stop it:

```cmd
netstat -ano | findstr :3000
taskkill /F /PID <the_pid_from_the_list_above>
```

Then run `npm run dev` again. (Or simply close the other terminal/Command Prompt window
that is running MedRem.)
