# Territory Monitor

Storm-timed email outreach for restoration sales teams.

Sales events in restoration are driven by weather. Territory Monitor lets agents upload contact lists, define outreach rules (who, when, and what to say), and automatically email the right people when a storm is approaching their city.

## What it does

1. **Contacts** — Dump CSV, Excel (.xlsx/.xls), or PDF contact lists (multi-file supported), or add contacts manually.
2. **Rules + outreach agent** — Example: “1 day before a thunderstorm warning, write a unique professional note to each contact in the storm path.” The agent personalizes every email (not a shared cookie-cutter template).
3. **Weather + storms** — Pull live alerts from Weather.com (`WEATHER_COM_API_KEY`) or NWS, with manual events as backup.
4. **Territory map** — See coverage from your contact book, storm polygons on the map, and launch alerts/campaigns from selected cities or storm paths.
5. **Engine** — Matches storm territory to contacts, personalizes messages, schedules sends, and delivers due emails.
6. **Campaigns** — Review matched recipients and the exact personalized emails.
7. **Cyber defense** — Upload malware signature scanning, macro/executable blocks, rate limits, security headers, and optional API-key protection.

## Quick start

```bash
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Demo flow

1. Open **Dashboard** and click **Run outreach engine**.
2. Seeded data includes Midwest contacts, a Milwaukee storm (~36h ETA), and two rules (24h and 12h before ETA).
3. The 24h rule creates a campaign for Milwaukee-area contacts and queues personalized emails.
4. To force immediate send for testing, set a storm ETA to ~1 hour from now (or lower `hoursBeforeEta`), then run the engine again.
5. Inspect **Campaigns** to see geo-matched recipients and rendered email copy.

## Template tokens

`{{firstName}}` `{{lastName}}` `{{city}}` `{{state}}` `{{stormName}}` `{{stormType}}` `{{stormSeverity}}` `{{stormEta}}` `{{companyName}}` `{{agentName}}` `{{agentPhone}}` `{{agentEmail}}` `{{website}}`

## API surface

| Method | Path | Purpose |
|--------|------|---------|
| GET/POST | `/api/contacts` | List / create contacts |
| POST | `/api/contacts/upload` | Import contacts from CSV / Excel / PDF (multi-file) |
| GET/POST | `/api/lists` | Contact lists |
| GET/POST | `/api/storms` | Storm events |
| GET/POST | `/api/weather/sync` | Pull Weather.com / NWS alerts into storms |
| GET | `/api/territory` | Territory + storm geo payload for the map |
| POST | `/api/territory/alert` | Launch outreach from map selection |
| GET/POST | `/api/rules` | Outreach rules |
| GET | `/api/campaigns` | Generated campaigns |
| POST | `/api/engine/run` | Evaluate rules + send due emails |
| POST | `/api/preview` | Preview matches for storm + rule |
| GET/PUT | `/api/settings` | Company / agent identity |
| GET | `/api/security` | Cyber defense status + recent events |

## Cyber defense

Uploads are scanned **before** CSV/Excel/PDF parsers run:

- Blocks executables (PE/ELF/Mach-O), macro-enabled Office (`.xlsm`, `vbaProject.bin`), and hostile PDF actions (JavaScript, Launch, embedded files)
- Rejects CSV formula / script polyglots and type-mismatched (polyglot) files
- Sanitizes contact fields (control chars, length caps, formula-injection neutralization)
- Rate-limits upload, engine, weather sync, and territory alert routes
- Security headers via middleware (CSP, frame deny, nosniff)
- Optional `TM_API_KEY` — when set, guarded routes require `x-api-key` or `Authorization: Bearer`

Open **Cyber defense** in the app nav to see blocks and active controls.

## Weather setup

```bash
# .env
WEATHER_COM_API_KEY=your_key_from_developer.weather.com
```

With a key, sync uses `api.weather.com/v3/alerts/headlines`. Without a key, sync uses the National Weather Service active alerts API (the same US government alert source Weather.com aggregates).

## Stack

- Next.js (App Router) frontend + API routes
- Prisma + SQLite
- Leaflet territory map
- Weather.com / NWS alert sync
- Rule matching engine with scheduled email queue

Email delivery is logged as sent in this demo environment. Swap the send block in `src/lib/engine.ts` for SMTP/ESP production delivery.
