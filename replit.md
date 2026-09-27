# Northstar Student Information Management System

Northstar is a full-stack student information and management system for school administrators, teachers, and families.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/scripts run seed:sims` — reset and seed realistic SIMS development data
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/sims/` — responsive React/Vite web app and visual theme
- `artifacts/api-server/src/routes/sims.ts` — validated SIMS API routes
- `lib/api-spec/openapi.yaml` — source of truth for API contracts
- `lib/db/src/schema/sims.ts` — Drizzle schema for users, students, classes, grades, attendance, behavior logs, and notifications
- `scripts/src/seed-sims.ts` — deterministic reset-and-seed script for local development

## Architecture decisions

- The frontend consumes generated hooks from the shared OpenAPI contract rather than hand-written client types.
- Dashboard GPA and attendance metrics are derived from grade and attendance records so summaries stay consistent after edits.
- Calendar-only values use PostgreSQL `date` columns and are normalized to `YYYY-MM-DD` at the API boundary.
- Development seed data is intentionally reset-and-recreated so local previews always start with a complete, coherent dataset.

## Product

- Dashboard with attendance trend, grade distribution, at-risk count, recent alerts, and notification read state.
- Student directory with search, grade/status filters, pagination, create/edit/delete flows, and responsive navigation.
- Student profiles with class roster, grades, attendance, and behavior history plus mutation flows.
- Attendance workspace with quick status updates and summary views.
- Role-context settings surface for admin, teacher, and student/parent-oriented product direction.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
