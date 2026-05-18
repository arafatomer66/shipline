# Next session — handoff

> Living doc. Keep it short and current. Last touched: 2026-05-19.

## TL;DR — where we are

Everything in the README under "What you can do" works end-to-end against the dogfood data (`ShareDeal_Social_Feature_Tracker.xlsx` → 30 epics + 191 features). Single-user, local dev. Repo: <https://github.com/arafatomer66/shipline>.

## Run it

```bash
docker compose up -d postgres                                   # port 5438
( cd api && npm install && npx prisma migrate dev && npm run dev )    # :3001
( cd web && npm install && npm run dev )                        # :4300
```

Seed quickly with your own xlsx:
```bash
curl -X POST -F "file=@your-tracker.xlsx" -F "projectName=Foo" \
  http://localhost:3001/api/import/excel
```

## What's done

| Area                       | State |
|----------------------------|-------|
| Excel import (22 cols)     | ✅ tested with real ShareDeal tracker |
| Canvas tree layout         | ✅ Project → Epic pills → feature flows |
| Drag-to-connect            | ✅ output dot → input dot creates `Dependency` |
| Connection delete + Undo   | ✅ click connection, toast with Undo |
| Add Feature / Add Epic     | ✅ palette popovers, auto-link new features |
| Feature detail side-panel  | ✅ all 22 fields + 5 track statuses, dirty tracking |
| Spotlight on epic click    | ✅ pan/zoom + dim, with inline "clear" chip |
| Status strip per card      | ✅ click any of 5 segments to cycle |
| Dashboard (rollup)         | ✅ per-epic × per-track % bars |
| Export xlsx + json         | ✅ xlsx round-trips through import |
| Toast UX, zero alerts      | ✅ |

## Active gotchas (don't re-discover)

- **Foblex handle pattern:** put `fNodeInput` on the `[fNode]` host *or* on a child div, but **never combine `fNodeInput` + `fNodeOutput` on the same element** — Foblex registers only the input and the output's connection drops silently. The output handle DOM must have a measurable bounding box (≥ ~12×12 px).
- **SPA refresh:** `<base href="/">` is in `web/src/index.html`. Don't remove it.
- **Tailwind vs Foblex CSS vars:** `web/src/styles.css` re-declares `--ff-connection-color` and friends because Tailwind preflight resets `:root`. If connections go invisible again, look there first.
- **Connection style that works:** `fType="segment" fBehavior="fixed" fInputSide="calculate"`. Bezier defaults render with the wrong endpoints when handles are at top/bottom of nodes.
- **Postgres port 5438** (not 5432) to avoid the user's other projects on 5436.
- **Project + Epic nodes are frontend-virtual.** Only Feature and Dependency are in Postgres. The project root + 30 epic pills are computed in `project.page.ts`.

## Roadmap, in priority order

1. **At-risk view** — toggle on the canvas to filter to P0 features with empty Dev status or any blocked track. Sketch: `features().filter(f => f.priority === 'P0' && (devStatusFor(f) === 'NOT_STARTED' || hasBlocked(f)))`.
2. **Bulk status edit** — Shift-click features to multi-select → toolbar appears → "Set Dev = Done for N features" in one round-trip. Needs a new `PATCH /api/features/bulk-track-status` taking `{featureIds[], trackId, status}`.
3. **Public read-only share link** — `/share/<token>`. Generate token on demand, server-side view that returns the same project data with all mutations disabled.
4. **Restore from JSON snapshot** — `POST /api/projects/import/json` consuming the file produced by `/export/json`. Preserves canvas positions exactly.
5. **GitHub / Linear sync** — pull Dev status from external trackers (link feature → external ID).
6. **Edit epic inline + reorder** — rename, drag to reorder columns, reassign features.
7. **Compact view** — toggle to hide feature cards, show only the epic skeleton.
8. **Auth + multi-user** — Lucia or similar; project membership table.

## Key files (where to look first)

| Concern                            | File                                                           |
|------------------------------------|----------------------------------------------------------------|
| Canvas template, click handlers    | `web/src/app/pages/project.page.ts`                            |
| Detail panel                       | `web/src/app/feature-detail-panel.component.ts`                |
| Toast system                       | `web/src/app/toast.service.ts` + `toast.component.ts`          |
| HTTP client                        | `web/src/app/api.service.ts`                                   |
| Foblex CSS overrides               | `web/src/styles.css` (look for `--ff-*` and `.shipline-handle`)|
| Excel import                       | `api/src/import/import.service.ts`                             |
| Excel/JSON export                  | `api/src/export/export.service.ts`                             |
| Schema                             | `api/prisma/schema.prisma`                                     |
| Relink (recompute positions+deps)  | `POST /api/projects/:id/relink` in import service              |

## Known limitations

- Single user, no auth, no permissions
- Position only persists for features (project + epic nodes recompute layout from epic.order)
- Dependency line can't be reassigned (drag endpoint) — only created or deleted
- No autosave in the detail panel — explicit Save button
- Re-relink resets feature canvas positions to the auto-grid (not destructive to data, but moves cards)

## After a fresh `git clone`

```bash
git clone https://github.com/arafatomer66/shipline && cd shipline
docker compose up -d postgres
cd api && npm install && cp .env.example .env && npx prisma migrate dev && npm run dev &
cd ../web && npm install && npm run dev
```

Should be open at <http://localhost:4300> in under 3 minutes from a cold clone.
