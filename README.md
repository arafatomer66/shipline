# Shipline

> See every feature you're shipping and what's blocking it — across dev, design, and marketing — in one picture.

Cross-functional **feature-readiness tracker** for founders and CTOs.
Each feature has multiple status tracks (Prototype · Backend · Dev · QA · UI/UX). A feature isn't *shippable* until its required tracks are green — and Shipline makes that visible at a glance instead of in your head.

## Why

Today the picture lives in a spreadsheet (or your head):
- Linear / Jira tracks **Dev** only
- Figma tracks **Design** only
- A doc tracks **Marketing**
- No tool answers *"is feature X shippable?"* — that's a Monday-morning meeting

Shipline answers it with a colored status strip per feature, across every track you care about, on a Foblex Flow canvas.

## The killer move: Excel import

Most founders already maintain a spreadsheet like this. Shipline's first screen is **"Upload your Excel."** It parses the sheet, creates the project, epics, features, and initial track statuses. Zero data entry to start.

The shipped importer is modelled on the real ShareDeal Social tracker (192 features × 22 columns) — you can import it directly and the canvas + dashboard light up instantly.

## Stack

| Layer | Tech |
|---|---|
| Web | Angular 18 (standalone, signal-based) + Foblex Flow + Tailwind |
| API | NestJS 10 + Prisma 5 + Postgres 16 |
| Excel parsing | ExcelJS |
| Storage | Postgres in Docker |

## Run it

```bash
# 1. Postgres
docker compose up -d postgres

# 2. API (port 3001)
cd api
npm install
npx prisma migrate dev
npm run dev

# 3. Web (port 4300)
cd ../web
npm install
npm run dev
```

Open <http://localhost:4300>.

To seed instantly:
```bash
curl -X POST -F "file=@/path/to/your/tracker.xlsx" \
              -F "projectName=My Product" \
              http://localhost:3001/api/import/excel
```

## Data model (Prisma)

- `Project` — workspace, owns everything
- `Track` — configurable workstream (Prototype, Backend, Dev, QA, UI/UX) per project
- `Epic` — feature grouping (Onboarding, Auth, Cart, …)
- `Feature` — the unit; 22 fields mirroring a typical feature spreadsheet
- `FeatureTrackStatus` — per (feature, track) status: not_started / in_progress / blocked / done / na
- `Dependency` — typed edges between features (depends_on, rolls_up_to)

## Endpoints

| Method | Path | Use |
|---|---|---|
| GET | `/api/health` | Liveness |
| GET | `/api/projects` | List projects |
| POST | `/api/projects` | Create project (seeds default tracks) |
| GET | `/api/projects/:id` | Project + tracks + epics |
| GET | `/api/projects/:id/dashboard` | Per-epic × per-track rollup |
| GET | `/api/features?projectId=…` | All features w/ statuses |
| PATCH | `/api/features/:id/position` | Save canvas position |
| PATCH | `/api/features/:id/track-status` | Set a single track status |
| POST | `/api/import/excel` | Multipart upload, full ingest |

## What's next (post-MVP)

- Dependency creation from the canvas (drag edge between nodes)
- "At-risk" view: P0 features with empty Dev status or blocked tracks
- Public read-only share link (paste in Slack, no sign-in)
- Bulk status edit (select N features, set track for all)
- Sprint view + Release nodes
- Export back to Excel (escape hatch)

Built on top of [Foblex Flow](https://flow.foblex.com/) (MIT).
