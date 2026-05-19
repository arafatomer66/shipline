# Next session — handoff

> Living doc. Keep it short and current. Last touched: 2026-05-20.

## TL;DR — where we are

Cards redesigned, at-risk view shipped, linked-resources field added, and a single-instance EC2 deployment is live at **https://13.233.125.5** behind Basic Auth + self-signed TLS. The live DB is byte-for-byte identical to local (pg_dump → pg_restore). Repo: <https://github.com/arafatomer66/shipline>.

## Live deployment

| | |
|---|---|
| **URL** | <https://13.233.125.5> (self-signed cert; click through the browser warning once) |
| **Login** | username `admin` · password lives in `/etc/nginx/.htpasswd` on the instance, **never in this repo** |
| **Region** | `ap-south-1` (Mumbai) · account `111596617601` |
| **Instance** | `i-0fd0b5d9fe4803f1c` · t3.micro · 20 GB gp3 · ~$10/mo |
| **Security group** | `sg-05858b8f26ad609b0` (22 / 80 / 443 from `0.0.0.0/0` — should be tightened) |
| **Key pair** | `shipline-deploy` · private key at `~/.ssh/shipline-deploy.pem` on the maintainer's laptop |
| **Reproduce** | see `deploy/deploy-ec2.sh` — requires `ADMIN_PASSWORD` env var |
| **Rotate password** | `sudo htpasswd -b /etc/nginx/.htpasswd admin '<new>' && sudo systemctl reload nginx` |

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

| Area                              | State |
|-----------------------------------|-------|
| Excel import (22 cols)            | ✅ tested with real ShareDeal tracker |
| Canvas tree layout                | ✅ Project → Epic pills → feature flows |
| Drag-to-connect                   | ✅ output dot → input dot creates `Dependency` |
| Connection delete + Undo          | ✅ click connection, toast with Undo |
| Add Feature / Add Epic            | ✅ palette popovers, auto-link new features |
| Feature detail side-panel         | ✅ all fields + 5 track statuses + 4 link URLs, dirty tracking |
| Spotlight on epic click           | ✅ pan/zoom + dim, with inline "clear" chip |
| Per-track status pills (P/B/D/Q/U)| ✅ click letter chip to cycle |
| Dashboard (rollup)                | ✅ per-epic × per-track % bars |
| Export xlsx + json                | ✅ xlsx round-trips through import |
| Toast UX, zero alerts             | ✅ |
| **Redesigned cards**              | ✅ 288 px wide, accent-status dot, tinted priority chip, hover/selected/at-risk states, line-clamp-3 titles |
| **At-risk view**                  | ✅ toolbar pill `● At-risk (N)`; definition: any track BLOCKED OR (P0 + no progress). Red glow + dim non-at-risk + empty-epic dim. Stacks with epic spotlight. |
| **Linked resources**              | ✅ `figmaUrl` / `prUrl` / `ticketUrl` / `docUrl` on Feature; color-coded icon row on card; detail-panel inputs |
| **Live deployment (EC2)**         | ✅ t3.micro + nginx + systemd, ~$10/mo |
| **Basic Auth + HTTPS**            | ✅ nginx `auth_basic` + self-signed cert (valid till Aug 2028) |

## Active gotchas (don't re-discover)

- **Foblex handle pattern:** put `fNodeInput` on the `[fNode]` host *or* on a child div, but **never combine `fNodeInput` + `fNodeOutput` on the same element** — Foblex registers only the input and the output's connection drops silently. Output handle DOM must have a measurable bounding box (≥ ~12×12 px).
- **Foblex 18.6's `default.scss` overrides Tailwind on every `.f-node`.** Each card carries a marker class (`.shipline-feature` / `.shipline-epic` / `.shipline-root`) and `web/src/styles.css` has `f-flow .f-node.shipline-feature { ... }` rules (specificity 0,2,1) that own width / border / bg / hover / selected / at-risk. Don't try to drive card visuals from Tailwind classes on the template.
- **`fOutputConnectableSide="bottom"` doesn't auto-add a `.bottom` class.** Foblex only sets `position: absolute`. Use `absolute left-1/2 -translate-x-1/2 -bottom-2` (outputs) and `… -top-1.5` (inputs) to center handles. `mx-auto` does nothing on absolute elements.
- **Connector handles default to accent-blue when connected.** Override `--ff-connector-{size,background-color,connected-color,accent-color}` in `:root` of `styles.css`.
- **Auto fit-to-screen zooms out too far for large projects.** `onFullRendered` runs `fit()` then clamps zoom to `minZoom=0.7` for `epicCount > 8` and re-centers on `project-root`.
- **SPA refresh:** `<base href="/">` is in `web/src/index.html`. Don't remove it.
- **Tailwind vs Foblex CSS vars:** `web/src/styles.css` re-declares `--ff-connection-color` and friends because Tailwind preflight resets `:root`. If connections go invisible again, look there first.
- **Connection style that works:** `fType="segment" fBehavior="fixed" fInputSide="calculate"`. Bezier defaults render with the wrong endpoints when handles are at top/bottom of nodes.
- **Postgres port 5438** (not 5432) to avoid the user's other projects on 5436.
- **Project + Epic nodes are frontend-virtual.** Only Feature and Dependency are in Postgres. The project root + epic pills are computed in `project.page.ts`.
- **AL2023's `/etc/nginx/nginx.conf` ships a default `server {}` block** that eats requests for `server_name _`. `deploy-ec2.sh` strips it before writing `conf.d/shipline.conf`.

## Roadmap, in priority order

1. ✅ ~~At-risk view~~ — shipped 2026-05-19
2. ✅ ~~Linked resources (figma/PR/ticket/doc)~~ — shipped 2026-05-19
3. ✅ ~~Live single-instance deployment + Basic Auth + HTTPS~~ — shipped 2026-05-20
4. **Owner per track** — `FeatureTrackStatus` gains `ownerName`; status pills show owner avatar dot; detail panel has per-track owner input with autocomplete from prior values. **~3 hrs.** Phase 2 of the "4 dimensions" plan.
5. **Blocker reason** — `FeatureTrackStatus.blockerReason` text field. When status flips to `BLOCKED`, inline reason input appears; card shows a red banner with the reason. **~1.5 hrs.**
6. **Target date + Milestone** — `Milestone` entity (`name`, `targetDate`, `order`, `color`) + `Feature.targetDate` + `Feature.milestoneId`. Filter/group canvas by milestone, slippage indicator on cards past due. **~5 hrs.**
7. **Activity log** — auto-recorded events on every mutation. Detail panel gets a "History" tab. **~2.5 hrs.**
8. **Bulk status edit** — Shift-click features → toolbar → "Set Dev = Done for N features" in one round-trip. Needs `PATCH /api/features/bulk-track-status`.
9. **Public read-only share link** — `/share/<token>`. Read-only mode hides palette + disables all mutations.
10. **Restore from JSON snapshot** — `POST /api/projects/import/json` consuming `/export/json` output. Preserves canvas positions exactly.
11. **Lock SSH to your IP** — currently `0.0.0.0/0:22`. `aws ec2 revoke-security-group-ingress … && authorize … --cidr <your-ip>/32`.
12. **Nightly Postgres backup to S3** — `pg_dump | gzip | aws s3 cp`. ~$0.50/mo.
13. **Move off the root AWS account** — current session deployed as root. Switch to `sharedeal-user` IAM user with MFA.
14. **GitHub / Linear sync** — pull Dev status from external trackers (link feature → external ID via the new `prUrl` / `ticketUrl`).
15. **Edit epic inline + reorder** — rename, drag to reorder columns, reassign features.
16. **Compact view** — toggle to hide feature cards, show only the epic skeleton.
17. **Grid layout for many-epic projects** — wrap epics into N-wide rows so canvas isn't 9600 px on one line.
18. **Real auth + multi-user** — Lucia or similar; project membership table; replace Basic Auth at nginx.

## Key files (where to look first)

| Concern                            | File                                                           |
|------------------------------------|----------------------------------------------------------------|
| Canvas template, click handlers    | `web/src/app/pages/project.page.ts`                            |
| Detail panel                       | `web/src/app/feature-detail-panel.component.ts`                |
| Toast system                       | `web/src/app/toast.service.ts` + `toast.component.ts`          |
| HTTP client                        | `web/src/app/api.service.ts`                                   |
| Foblex CSS overrides               | `web/src/styles.css` (look for `--ff-*`, `.shipline-feature/epic/root`, `.shipline-handle`) |
| Excel import                       | `api/src/import/import.service.ts`                             |
| Excel/JSON export                  | `api/src/export/export.service.ts`                             |
| Schema                             | `api/prisma/schema.prisma`                                     |
| Relink (recompute positions+deps)  | `POST /api/projects/:id/relink` in import service              |
| Deployment (EC2)                   | `deploy/deploy-ec2.sh` + `deploy/README.md`                    |

## Known limitations

- Single user, nginx Basic Auth only (no real auth, no permissions, no multi-tenancy)
- Position only persists for features (project + epic nodes recompute layout from epic.order)
- Dependency line can't be reassigned (drag endpoint) — only created or deleted
- No autosave in the detail panel — explicit Save button
- Re-relink resets feature canvas positions to the auto-grid (not destructive to data, but moves cards)
- Self-signed TLS cert → browser warning on first visit (use a domain + Let's Encrypt to fix)
- SSH port on the live instance is open to `0.0.0.0/0` — lock it to your IP when you have time

## After a fresh `git clone`

```bash
git clone https://github.com/arafatomer66/shipline && cd shipline
docker compose up -d postgres
cd api && npm install && cp .env.example .env && npx prisma migrate dev && npm run dev &
cd ../web && npm install && npm run dev
```

Should be open at <http://localhost:4300> in under 3 minutes from a cold clone.
