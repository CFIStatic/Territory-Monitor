# Territory Monitor

Storm-timed email outreach for restoration sales teams.

Sales events in restoration are driven by weather. Territory Monitor lets agents upload contact lists, define outreach rules (who, when, and what to say), and automatically email the right people when a storm is approaching their city.

## What it does

1. **Contacts** — Dump CSV, Excel (.xlsx/.xls), or PDF contact lists (multi-file supported), or add contacts manually.
2. **Rules** — Example: “1 day before a thunderstorm warning, email contacts in the storm path with a personalized readiness message.”
3. **Storms** — Log forecasted events with ETA and affected cities.
4. **Engine** — Matches storm territory to contacts, personalizes templates, schedules sends, and delivers due emails.
5. **Campaigns** — Review matched recipients and the exact personalized emails.

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
| GET/POST | `/api/rules` | Outreach rules |
| GET | `/api/campaigns` | Generated campaigns |
| POST | `/api/engine/run` | Evaluate rules + send due emails |
| POST | `/api/preview` | Preview matches for storm + rule |
| GET/PUT | `/api/settings` | Company / agent identity |

## Stack

- Next.js (App Router) frontend + API routes
- Prisma + SQLite
- Rule matching engine with scheduled email queue

Email delivery is logged as sent in this demo environment. Swap the send block in `src/lib/engine.ts` for SMTP/ESP production delivery.
