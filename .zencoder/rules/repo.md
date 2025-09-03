# Repository Info

- name: ROSAE Theatre Management
- language: TypeScript/React (client) + Node/Express (server)
- build: Vite + Tailwind (client), Drizzle + better-sqlite3 (server)
- database: SQLite file `rosae.db`
- auth: Session-based (custom), admin email: `admin@rosae.com`

## Structure
- client: React app (pages, components), routes in `client/src/App.tsx`
- server: Express app (`server/index.ts`, `server/routes.ts`), DB setup: `server/db.ts`
- shared: Drizzle schema in `shared/schema.ts`

## Key Endpoints
- /api/auth/login, /api/auth/logout, /api/auth/status
- /api/bookings (list, create, update, delete)
- /api/tickets (customer tickets CRUD via routes.ts)
- /api/config (theatres, timeSlots, expenseCategories, expenseCreators)
- /api/login-tracker (admin-only, filters: startDate, endDate, userId, email)

## Notable Features
- Bookings table shows creator info, printable report includes it
- Login tracking persists login/logout with duration, visible in admin UI
- Tickets include soft-delete and flexible filtering

## Setup Notes
- Ensure `JWT_SECRET` in env (server/auth.ts uses default if missing)
- DB auto-migrates essential columns on startup in `server/db.ts`
