# CLAUDE.md

Project-level guidance for Claude Code working in this repo. Keep this file accurate; if you change a convention, update it in the same commit.

## What this is

Shipline — cross-functional feature-readiness tracker. Upload an Excel sheet, get a live Foblex Flow canvas showing Prototype/Backend/Dev/QA/UI-UX status across every feature. See [`README.md`](./README.md) for the full pitch and [`NEXT_SESSION.md`](./NEXT_SESSION.md) for current state + roadmap.

## Stack at a glance

- **Web:** Angular 18 standalone components, signal-based state, Tailwind 3, Foblex Flow 18 for the canvas. Lazy routes in `web/src/app/routes.ts`.
- **API:** NestJS 10 with one module per concern (`projects`, `features`, `epics`, `dependencies`, `import`, `export`). Prisma 5 + Postgres 16. ExcelJS for parsing/writing.
- **DB:** Postgres 16 in Docker on port **5438** (not 5432 — avoids collision with other projects on the user's machine).

## Run / build / test commands

```bash
# Postgres
docker compose up -d postgres
docker compose logs -f postgres                 # if it won't connect

# API (port 3001, /api prefix)
cd api
npm install
npx prisma migrate dev                          # apply pending migrations
npx prisma studio                               # browse the DB
npx nest build                                  # typecheck + emit dist/
node dist/main.js                               # or: npm run dev (watch)

# Web (port 4300)
cd web
npm install
npx ng build                                    # production-ish build
npm run dev                                     # ng serve with HMR

# Smoke-test API after restart
curl -sf http://localhost:3001/api/health
```

There is no test suite yet. Prefer end-to-end smoke via `curl` over writing throwaway unit tests.

## Project layout

```
api/
  prisma/schema.prisma              source of truth for the data model
  src/
    main.ts                         port 3001, /api prefix, CORS open
    app.module.ts                   register every feature module here
    prisma/                         PrismaService (Global)
    projects/                       list / create / get / dashboard / relink
    features/                       CRUD + position + track-status
    dependencies/                   create / delete by id or pair
    epics/                          create / delete
    import/                         POST /import/excel (ExcelJS parser)
    export/                         GET /projects/:id/export/{xlsx,json}

web/
  src/app/
    api.service.ts                  single HttpClient over /api
    toast.service.ts                signal-based toast queue
    toast.component.ts              renders toasts bottom-right
    feature-detail-panel.component.ts   slide-in editor (all 22 fields + 5 statuses)
    pages/
      projects-list.page.ts         homepage / hero / import / create
      project.page.ts               <f-flow> canvas + dashboard + palette
  src/styles.css                    Tailwind + Foblex CSS overrides
  src/index.html                    <base href="/"> — do not remove

docker-compose.yml                  Postgres 16 on 5438
```

## Conventions

- **Standalone components only.** No NgModules in `web/`. Routes are lazy-loaded via `loadComponent`.
- **Signals over RxJS for component state.** Use `signal()`, `computed()`, `effect()`. Reserve `Observable` for HTTP calls (subscribe + set signal).
- **No `alert()` / `confirm()` / `prompt()` anywhere.** Use the toast service for feedback and inline UI for prompts/confirms. The `ToastService.success/error/info` API supports an optional `action` button (used for Undo).
- **Tailwind colors:** `ink` = `#0f172a`, `paper` = `#fafafa`, `line` = `#e5e7eb`. Defined in `web/tailwind.config.js`.
- **Track statuses:** five-state enum — `NOT_STARTED · IN_PROGRESS · BLOCKED · DONE · NA`. Colors mapped in `STATUS_COLOR` in `project.page.ts` and `feature-detail-panel.component.ts` — keep them in sync.
- **API DTOs use `class-validator`.** ValidationPipe is global; never skip it.
- **Slugs are auto-generated** by `ProjectsService.slugify` — don't accept them from clients.

## Foblex Flow conventions — the bits that hurt to re-learn

- `fNodeInput` and `fNodeOutput` **must be on different DOM elements**. Combining both on the same `[fNode]` host element causes only the input to register; outgoing edges break silently. Pattern: input on the host, output on a child div (mirrors Foblex's own `apps/example-apps/call-center` example).
- The output handle element needs a **measurable bounding box** (≥ ~12×12 px). Foblex anchors the arrow path to it via `getBoundingClientRect`. `w-px h-px` is invisible and breaks rendering.
- Use `fType="segment" fBehavior="fixed" fInputSide="calculate"` on `<f-connection>` for the clean right-angle arrows shown in the bracket/call-center examples. Bezier looks wrong when handles sit at top/bottom of cards.
- Tailwind's preflight wipes Foblex's `:root --ff-*` CSS variables. `web/src/styles.css` re-declares `--ff-connection-color`, `--ff-connection-width`, and minimap variables. If connections go invisible again, that file is the first thing to check.
- `<f-canvas>` exposes `fitToScreen`, `centerGroupOrNode(id, animated)`, `getScale`, `setScale(scale, toPosition)`, `resetScaleAndCenter`. Wrap calls in try/catch since the canvas can be undefined during fast HMR cycles.
- Listen to `(fCreateConnection)` on `<f-flow>` to handle drag-to-connect. The event exposes `sourceId` and `targetId` (and legacy `fOutputId`/`fInputId`). Always extract feature IDs from your own ID prefix scheme (`out-<id>` / `in-<id>`) before persisting.

## Excel import / export

- The importer normalises headers (lowercase + `_` separator) so column order doesn't matter, but column *names* must match (`Feature`, `Epic`, `Prototype state`, etc.). See `api/src/import/import.service.ts`.
- After importing, the service creates **sequential `DEPENDS_ON` edges** between consecutive features within each epic. The frontend renders those as the visible feature chain.
- The exporter writes a 22-column workbook + Epic Summary + Tracks sheets that round-trips through the importer. Keep the column list synced with the importer's `headers` parsing if you add fields.

## Hard rules

- **Don't change the Postgres port** (5438) without updating `docker-compose.yml`, `api/.env*`, and the README quickstart.
- **Don't remove `<base href="/">`** in `web/src/index.html`. Without it, deep-link refresh (`/p/<id>`) blanks the page because relative bundle URLs resolve to `/p/styles.css`.
- **Don't add `pointer-events: none`** to a `.shipline-handle` element. The drag-to-connect mousedown must reach Foblex.
- **Don't shrink the output handle below 16 px.** It becomes too hard to grab.

## When you ship features

- Update `NEXT_SESSION.md` — flip rows in "What's done", add new gotchas, re-sort the roadmap.
- Update `README.md` "What you can do" and the API table if you added endpoints.
- Update the Prisma schema diagram comment in `README.md` if the model changed.
- Use the existing toast service for confirmations — don't reintroduce browser dialogs.

## Things that are NOT in scope right now

- Multi-user auth, organisations, billing
- Permissions / sharing
- Mobile UI (canvas is desktop-first)
- Real-time collaboration / websockets
- Drag-to-reassign existing connection endpoints (only create + delete are wired)
