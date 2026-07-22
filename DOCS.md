# Documentation Index

**Consult this file before making any changes to the codebase.** It is the single entry point to all architecture, component, pattern, and skill documentation for brianure.com.

---

## Coding Standards

The rules that apply to every file written or modified in this project.

- [Coding Standards](docs/coding-standards.md) — TypeScript conventions, naming, error handling, testing, libraries, module organization, and all technology-specific rules.

---

## Skills

Each skill doc defines a role, its responsibilities, what it owns, patterns to follow, and a checklist for quality. **Before working on a specific aspect of the app, read the relevant skill doc.**

| Skill | File | Scope |
|-------|------|-------|
| Frontend Designer | [docs/skill-frontend-designer.md](docs/skill-frontend-designer.md) | Reusable components, styling, variants, accessibility, animation. Owns `src/components/` and visual consistency. |
| Business Logic Engineer | [docs/skill-business-logic.md](docs/skill-business-logic.md) | Domain types, business rules, Result pattern, typed errors, Server Actions. Owns `src/features/*/types/`, `src/features/*/utils/`, and `src/features/*/actions/`. |
| Edge Functions Expert | [docs/skill-edge-functions.md](docs/skill-edge-functions.md) | Supabase Edge Functions, Stripe webhook handler, event-to-DB mapping, idempotency. Owns `supabase/functions/`. |
| Reviewer | [docs/skill-reviewer.md](docs/skill-reviewer.md) | Linting, formatting, type-checking, build verification, test execution. Runs the quality pipeline and enforces standards. |

---

## How to Use This Documentation

1. **Starting any work?** Read [Coding Standards](docs/coding-standards.md) first.
2. **Building a component?** Read [Frontend Designer](docs/skill-frontend-designer.md).
3. **Adding business logic, types, or Server Actions?** Read [Business Logic Engineer](docs/skill-business-logic.md).
4. **Working on Edge Functions or the Stripe webhook?** Read [Edge Functions Expert](docs/skill-edge-functions.md).
5. **Reviewing or finishing work?** Read [Reviewer](docs/skill-reviewer.md) and run the checklist.

---

## Architecture Overview

```
brianure.com
├── src/                        # Next.js application
│   ├── app/                    # App Router (pages, layouts)
│   ├── components/             # Shared reusable components (Frontend Designer)
│   ├── config/                 # Environment validation, constants
│   ├── features/               # Feature modules (Business Logic Engineer)
│   │   ├── career/
│   │   ├── portfolio/
│   │   └── services/
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
    ├── skill-frontend-designer.md
    ├── skill-business-logic.md
    ├── skill-edge-functions.md
    └── skill-reviewer.md
```

### Data Flow

```
User → Next.js (Server Components) → Supabase Client SDK → Database (RLS enforced)
User → UI Action → Server Action → Stripe API → Redirect to Checkout
Stripe → Webhook POST → Supabase Edge Function → Database (service role)
```
