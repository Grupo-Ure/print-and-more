# Documentation Index

**Consult this file before making any changes to the codebase.** It is the single entry point to the engineering guidelines, architectural patterns, skill definitions, and tool reference material in this repository. These documents are project-agnostic — they describe how to build, not any one product.

---

## Coding Standards

The rules that apply to every file written or modified in any project that adopts these guidelines.

- [Coding Standards](docs/coding-standards.md) — TypeScript conventions, naming, error handling, testing, libraries, module organization, and all technology-specific rules.

---

## Skills

Each skill doc defines a role, its responsibilities, what it owns, patterns to follow, and a checklist for quality. **Before working on a specific aspect of an app, read the relevant skill doc.**

| Skill | File | Scope |
|-------|------|-------|
| Frontend Designer | [docs/skills/skill-frontend-designer.md](docs/skills/skill-frontend-designer.md) | Reusable components, styling, variants, accessibility, animation. Owns `src/components/` and visual consistency. |
| Business Logic Engineer | [docs/skills/skill-business-logic.md](docs/skills/skill-business-logic.md) | Domain types, business rules, Result pattern, typed errors, Server Actions. Owns `src/features/*/types/`, `src/features/*/utils/`, and `src/features/*/actions/`. |
| Edge Functions Expert | [docs/skills/skill-edge-functions.md](docs/skills/skill-edge-functions.md) | Supabase Edge Functions, webhook handlers (e.g. Stripe), event-to-DB mapping, idempotency. Owns `supabase/functions/`. |
| Reviewer | [docs/skills/skill-reviewer.md](docs/skills/skill-reviewer.md) | Linting, formatting, type-checking, build verification, test execution. Runs the quality pipeline and enforces standards. |

---

## Testing Guides

- [Testing Standards](docs/testing/testing-standards.md) — technology-agnostic
  testing strategy: fixtures/mocks in their own files, black-box and
  minimal-assertion style, the setup/act/assert/cleanup test case structure. Read
  this first, for any kind of test, in any stack.
- [Backend Unit Testing](docs/testing/backend-unit-testing.md) — a worked
  example of the standards above applied to unit testing NestJS controllers
  and services (fixtures files, guard overrides). Illustrative of one stack,
  not a separate set of rules.
- [Playwright End-to-End Testing](docs/testing/playwright-e2e.md) — the
  standards above applied to the e2e suite: locate by test ID (never by
  hard-coded text), the single `TEST_IDS` registry shared by components and
  tests, and the modular Page Object Model (`e2e/pom/*POM.ts`).
- [End-to-end suite](e2e/README.md) — this project's Playwright/Electron
  runner: the run lifecycle (config → global setup → workers → teardown), what
  belongs in global setup versus fixtures, and where each file lives.

---

## Tool Reference

Vendor documentation snapshots for the tools these guidelines build on.

| Tool | Docs |
|------|------|
| Clerk | [docs/reference/clerk/](docs/reference/clerk/) — CLI, core concepts, Next.js quickstart, MCP server, AI integration, content protection |
| Stripe | [docs/reference/stripe/](docs/reference/stripe/) — React Stripe reference, CLI usage |
| Supabase | [docs/reference/supabase/](docs/reference/supabase/) — getting started, auth with Next.js, TypeScript type generation, self-hosting |
| Sanity | [docs/reference/sanity/](docs/reference/sanity/) — quickstart, Next.js guide |
| Prisma | [docs/reference/prisma/](docs/reference/prisma/) — PostgreSQL quickstart, Prisma Postgres quickstart |

---

## How to Use This Documentation

1. **Starting any work?** Read [Coding Standards](docs/coding-standards.md) first.
2. **Building a component?** Read [Frontend Designer](docs/skills/skill-frontend-designer.md).
3. **Adding business logic, types, or Server Actions?** Read [Business Logic Engineer](docs/skills/skill-business-logic.md).
4. **Working on Edge Functions or webhooks?** Read [Edge Functions Expert](docs/skills/skill-edge-functions.md).
5. **Writing any kind of test?** Read [Testing Standards](docs/testing/testing-standards.md) (and [Backend Unit Testing](docs/testing/backend-unit-testing.md) if you're in a NestJS backend).
6. **Reviewing or finishing work?** Read [Reviewer](docs/skills/skill-reviewer.md) and run the checklist.

---

## Reference Architecture

The skill docs assume a Next.js + Supabase + Stripe stack organized like this. Adapt the feature names to the project at hand.

```
<project-root>
├── src/                        # Next.js application
│   ├── app/                    # App Router (pages, layouts)
│   ├── components/             # Shared reusable components (Frontend Designer)
│   ├── config/                 # Environment validation, constants
│   ├── features/               # Feature modules (Business Logic Engineer)
│   │   └── <feature>/          # One folder per feature
│   ├── hooks/                  # Shared hooks
│   ├── lib/                    # Preconfigured libraries (Supabase, Stripe)
│   ├── stores/                 # Global state (Zustand)
│   ├── types/                  # Shared types (Result, errors)
│   └── utils/                  # Shared utilities (cn, etc.)
├── supabase/                   # Supabase project (Edge Functions Expert)
│   ├── functions/              # Edge Functions
│   └── migrations/             # Database migrations
├── CLAUDE.md                   # Project goal and stack
├── DOCS.md                     # This file — documentation index
└── docs/                       # All documentation
    ├── coding-standards.md
    ├── skills/
    ├── testing/
    └── reference/
```

### Data Flow

```
User → Next.js (Server Components) → Supabase Client SDK → Database (RLS enforced)
User → UI Action → Server Action → Stripe API → Redirect to Checkout
Stripe → Webhook POST → Supabase Edge Function → Database (service role)
```
