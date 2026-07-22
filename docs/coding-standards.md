# Coding Standards

These are the global coding standards for brianure.com. Every file written or modified must follow these rules.

---

## Table of Contents

### Meta & Workflow
- [Commit Authorship](#commit-authorship)
- [Security Practices](#security-practices)
- [Git](#git)
- [CI/CD](#cicd)
- [Working With Me](#working-with-me)

### Core Language
- [Language & Runtime](#language--runtime)
- [Syntax](#syntax)
- [Semantics & Types](#semantics--types)
- [Naming Conventions](#naming-conventions)
- [Functions](#functions)
- [Error Handling](#error-handling)
- [Documentation](#documentation)
- [Imports & Dependencies](#imports--dependencies)
- [Async & Concurrency](#async--concurrency)

### Architecture & Infrastructure
- [Libraries & Dependencies](#libraries--dependencies)
- [Module Organization](#module-organization)
- [Architecture Principles](#architecture-principles)
- [Database](#database)
- [Environment Variables](#environment-variables)

### Quality & Production
- [Testing](#testing)
- [Observability](#observability)
- [Production Readiness](#production-readiness)

### Technology-Specific
- [When Using React](#when-using-react)
- [When Using Next.js](#when-using-nextjs)
- [When Using Tailwind CSS](#when-using-tailwind-css)
- [When Animating](#when-animating)
- [When Building UI](#when-building-ui)
- [When Building for the Web](#when-building-for-the-web)

---

## Commit Authorship

**CRITICAL — ABSOLUTE RULE:** Never add any reference to Claude, AI, or yourself in commit messages. This includes but is not limited to:
- `Co-Authored-By` trailers (e.g. `Co-Authored-By: Claude ...`)
- Any mention of Claude, Anthropic, AI, or LLM in commit messages, PR descriptions, or code comments
- Any AI attribution of any kind

Commits must appear as if written entirely by the human developer. No exceptions.

---

## Security Practices

Apply these to every file written or modified:

1. **Validate and sanitize inputs** — never trust external data blindly; type-check, coerce to expected types, and handle malformed input gracefully before using it.
2. **Always quote variables in shell contexts** — use `"$VAR"` not `$VAR`; prefer array-form process spawning over shell string interpolation.
3. **Block path traversal** — reject any file path containing `..` segments before performing filesystem operations.
4. **Use absolute paths** — resolve paths to absolute before passing them to filesystem calls or spawned processes.
5. **Skip sensitive files** — never read, write, or run tooling on `.env*`, `.git/`, private key files, certificates, or any file matching `private[_-]?key`.

### Secrets Management

- **Never commit secrets** — use environment variables via Vercel/Supabase dashboards
- **Different secrets per environment** — dev, staging, and production must never share credentials
- **Never log sensitive data** — redact tokens, passwords, and PII before any logging call

---

## Git

- **Commits**: Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`, `docs/skills:`, `test:`)
- **Merge strategy**: squash merge to main
- **Branch naming**: `feature/`, `bugfix/`, `hotfix/`, `chore/` prefixes

---

## CI/CD

**Platform**: GitHub Actions

**Required pipeline steps in order**:

1. Install dependencies
2. Lint
3. Type check
4. Build
5. Tests

Never skip or reorder these steps. Each step gates the next.

---

## Working With Me

### Decision Making
- **Uncovered patterns**: ask before deciding
- **Code edits**: minimal changes only — do not refactor unrelated code
- **Style conflicts**: ask which approach to take
- **New dependencies**: always ask before adding any new dependency

### When Uncertain
- State assumptions clearly
- Offer alternatives with trade-offs
- Flag risks

### Priority Order
1. TypeScript compiler happiness (strict null checks, no implicit any)
2. Framework best practices (React 19, Next.js App Router, Supabase conventions)
3. Project architecture rules (boundaries, patterns)
4. Personal style preferences (this document)

---

## Language & Runtime

- **TypeScript only** — no JavaScript files, ever
- Strict mode enabled (`strict: true` in tsconfig)
- `any` type: **forbidden** — use `unknown` if truly unknown
- Target: ES2022+, Node 20+

---

## Syntax

### Punctuation & Delimiters
- Semicolons: **always**
- Quotes: **double quotes**, backticks only for interpolation or multiline strings
- Trailing commas: **always** in multiline structures
- Braces: **always**, even for single-line `if`/`else`

### Declarations
- Variables: `const` by default, `let` only when reassigning, **never** `var`
- Functions: `function` keyword for named/exported functions, arrow functions for callbacks and inline expressions
- Exports: named exports preferred, default export only for a module's main export

### Operators
- Equality: strict only (`===`, `!==`)
- Nullish: prefer `??` over `||` for defaults
- Optional chaining: use when a value is genuinely optional

---

## Semantics & Types

### Type Annotations
- Return types: **always explicit**
- Type assertions (`as`, `!`): allowed rarely — must include a comment justifying the assertion

### Nullability
- Prefer `null` for explicit absence, not `undefined`
- Use `null` to mean "intentionally empty"

### Control Flow
- **Early returns** for guard clauses — avoid deep nesting
- **No nested `if` statements** — flatten logic with early returns; the only exceptions are mathematical formulas or algorithms that inherently require nested conditionals
- Single responsibility per function

---

## Naming Conventions

| What | Convention | Example |
|------|------------|---------|
| Files | kebab-case | `user-service.ts`, `track-card.tsx` |
| Variables / functions | camelCase | `trackCount`, `fetchUser` |
| Types / classes | PascalCase | `Track`, `UserService` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_RETRIES`, `DEFAULT_TIMEOUT` |
| Environment variables | SCREAMING_SNAKE_CASE | `DATABASE_URL`, `STRIPE_SECRET_KEY` |
| DB tables | snake_case, plural | `bookings`, `service_tiers` |
| DB columns | snake_case | `created_at`, `user_id` |

### Prefixes & Suffixes
- Booleans: `is*`, `has*`, `should*`, `can*` — e.g. `isLoading`, `hasError`
- Event handlers: `handle*` for implementation, `on*` for props
- Interfaces: suffix with `Interface` — e.g. `UserInterface`, `BookingInterface`
- React props types: suffix with `Props` — e.g. `ButtonProps`, `ServiceCardProps`
- Hooks: `use*` prefix

---

## Functions

### Parameters
- **React components**: max 1 (props object)
- **Library functions**: max 2 positional, then an options object
- **General preference**: 1 parameter when possible

### Design
- No line-length limit — follow the **single responsibility principle**
- Destructure in the function signature, not the body:

```typescript
// ✅ Good
function createBooking({ serviceId, userId }: CreateBookingOptions): Result<Booking, Error> { ... }

// ❌ Bad
function createBooking(options: CreateBookingOptions): Result<Booking, Error> {
  const { serviceId, userId } = options;
}
```

---

## Error Handling

### Domain Logic
- Use `Result<T, E>` pattern — explicit success/failure types
- Never throw in pure domain logic

```typescript
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
```

### Infrastructure
- Exceptions are acceptable for I/O, external services, and unexpected failures
- Always catch at system boundaries (Server Actions, event handlers)

### Validation
- Validate at system boundaries using Zod
- Fail fast — reject invalid input before entering domain logic
- Return structured errors, not plain string messages

### All Errors Must Be Typed
- No generic `Error` throws in domain code
- Separate user-facing messages from internal error details

---

## Documentation

- **JSDoc**: minimal — code should be self-documenting
- **TODOs**: `// @todo description`
- **Inline comments**: written above the line, full sentences, explain **WHY** not **WHAT**
- Delete commented-out code — it has no place in the codebase

---

## Imports & Dependencies

- **Paths**: absolute via path aliases (`@/...`)
- **Ordering**: enforced by the project linter's `organizeImports`
- **Type imports**: always use `import type` for type-only imports
- **Cross-feature imports**: forbidden

---

## Async & Concurrency

- `async`/`await` everywhere — no `.then()` chains
- `Promise.all` for independent parallel work, sequential `await` for dependent work
- `AbortController` for all cancellable operations
- No floating promises — always `await` or explicitly handle

---

## Libraries & Dependencies

### Philosophy
- **Prefer libraries** over custom code — less to maintain
- **Selection criteria**: well-known, actively maintained (>1k GitHub stars)
- **Adding new deps**: always ask before adding any new dependency
- **Working in an existing codebase**: if the project already uses a similar library, extend it rather than adding a new one

### Preferred Libraries

#### Core Stack
| Need | Preference | Notes |
|------|------------|-------|
| Framework | Next.js (App Router) | Server Components by default |
| Database & Auth | Supabase | Client SDK for data, Supabase Auth for identity |
| Payments | Stripe | Checkout, subscriptions, Customer Portal |
| Hosting | Vercel | Edge-optimized |

#### Utilities
| Need | Preference | Notes |
|------|------------|-------|
| Date/time | `dayjs` | Lightweight, immutable |
| Validation/parsing | `zod` | Schemas, parsing, type inference |
| ID generation | `nanoid` | Smaller and URL-safe vs uuid |

#### React State & Data
| Need | Preference |
|------|------------|
| Server state | Supabase client SDK (realtime subscriptions where needed) |
| Client state (simple) | React Context |
| Client state (complex) | Zustand |
| Forms | React Hook Form + Zod |
| URL state | nuqs |

#### Styling & UI
| Need | Preference |
|------|------------|
| Styling | Tailwind CSS |
| Class variants | CVA (class-variance-authority) |
| Class merging | `tailwind-merge` via `cn()` helper |
| Conditional classes | `clsx` (used inside `cn()`) |
| Animation | Framer Motion |
| Animation (advanced) | GSAP |
| Primitives | Radix UI |
| Components | shadcn/ui |
| Icons | Lucide React |
| Toasts | Sonner |

### Boundaries: Custom vs Library

**Write custom code for**:
- Simple array/object transformations
- Type guards and narrowing
- Project-specific utilities

**Always use a library for**:
- Date/time manipulation — `dayjs`
- Complex validation schemas — `zod`
- Animation/transitions — Framer Motion
- Form handling — React Hook Form
- Authentication flows — Supabase Auth

### Decision Tree

```
Is this functionality needed?
│
├─ Already implemented in the codebase?
│   └─ YES → Reuse/extend it
│
├─ A library already installed handles it?
│   └─ YES → Use it
│
├─ On the preferred list above?
│   └─ YES → Ask first, then install and use it
│
├─ Simple enough for custom code?
│   └─ YES (type guards, simple transforms) → Write custom
│
└─ Not on preferred list, not simple?
    └─ ASK ME for guidance
```

---

## Module Organization

Bulletproof React pattern adapted for Supabase:

```
src/
├── app/              # Next.js App Router
├── components/       # Shared components
├── config/           # Global config (env validation, constants)
├── features/         # Feature-based modules ⭐
│   ├── career/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── types/
│   │   └── utils/
│   ├── portfolio/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── types/
│   │   └── utils/
│   └── services/
│       ├── actions/   # Server Actions (Stripe checkout, etc.)
│       ├── components/
│       ├── hooks/
│       ├── types/
│       └── utils/
├── hooks/            # Shared hooks
├── lib/              # Preconfigured libraries
│   ├── supabase/     # Supabase client (browser + server)
│   └── stripe/       # Stripe config
├── stores/           # Global state (Zustand)
├── types/            # Shared types
└── utils/            # Shared utilities
supabase/
├── functions/        # Edge Functions (Stripe webhook)
└── migrations/       # Database migrations
```

### Rules
- One concept per file, strictly
- Barrel/index files: only for public API re-exports, no logic
- Cross-feature imports: forbidden
- Unidirectional flow: shared → features → app

---

## Architecture Principles

### Pattern
Bulletproof React adapted for Next.js App Router + Supabase.

### Data Flow
- **Reads**: Supabase client SDK directly from components (Server Components for initial load, client SDK for realtime/interactive)
- **Writes**: Server Actions for mutations that touch Stripe; Supabase client SDK for direct DB writes protected by RLS
- **Webhooks**: Supabase Edge Function receives Stripe events and writes to DB

### Boundaries
- Strictly enforced — no exceptions
- Domain logic lives in dedicated classes under `features/`
- UI components never contain business logic
- Server Actions are thin — they validate input, call domain logic, and return results

---

## Database

### Naming Conventions
| Element | Convention | Example |
|---------|------------|---------|
| Tables | snake_case, plural | `bookings`, `service_tiers` |
| Columns | snake_case | `created_at`, `user_id` |
| Indexes | `table_columns_idx` | `bookings_user_id_idx` |
| Foreign keys | `fk_table_referenced_table` | `fk_bookings_users` |
| Unique constraints | `table_columns_unique` | `users_email_unique` |

### Migrations
- Managed via **Supabase CLI** (`supabase migration new`, `supabase db push`)
- **Commit migrations to source control** — always
- **Never edit applied migrations** — create a new one instead

### Security
- **Row-Level Security (RLS)** on all tables — this is the primary authorization boundary
- **Parameterized queries always** — Supabase client SDK handles this
- **Service role key** only used server-side (Edge Functions, Server Actions) — never exposed to the client
- **`anon` key** is safe for the browser — RLS enforces access

---

## Environment Variables

### Required Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=         # Safe for browser
NEXT_PUBLIC_SUPABASE_ANON_KEY=    # Safe for browser (RLS enforced)
SUPABASE_SERVICE_ROLE_KEY=        # Server-only — bypasses RLS

# Stripe
STRIPE_SECRET_KEY=                # Server-only
STRIPE_WEBHOOK_SECRET=            # Edge Function only
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY= # Safe for browser
```

### Rules
- **Naming**: `SCREAMING_SNAKE_CASE` for all environment variables
- **Client-safe vars**: prefix with `NEXT_PUBLIC_` only when intentional
- **Validate at app startup** using a Zod schema — fail fast if required vars are missing
- **Never expose secrets in client bundles** — use `server-only` imports
- **Document all variables** in a committed `.env.example` file

---

## Testing

### Tools
| Type | Tool |
|------|------|
| Unit / Integration | Vitest |
| Components | React Testing Library |
| E2E | Playwright |
| Visual | Storybook |

### Coverage
- **80%+ coverage required**
- Focus on critical paths and business logic
- Don't chase 100%

### Structure (AAA Pattern)

```typescript
describe("when [condition]", () => {
  it("does [expected behavior]", () => {
    // Arrange
    // Act
    // Assert
  });
});
```

### Principles
- **Test behavior, not implementation** — don't test internal state
- **Mock at boundaries only** — Supabase client, Stripe SDK
- **Use factories for test data** — `createTestUser()`, `createTestBooking()`
- **Colocate tests with source** — `service-card.tsx` + `service-card.test.tsx`
- **No `if` statements in tests**

### What to Test
| Layer | Test Type | Focus |
|-------|-----------|-------|
| Domain | Unit | Pure logic, no mocks needed |
| Server Actions | Integration | Input validation, domain calls |
| UI Components | Component | User interactions, accessibility |
| Full App | E2E | Critical user journeys only |

---

## Observability

| Purpose | Tool |
|---------|------|
| Error tracking | Sentry |
| Web vitals | Vercel Analytics |

### Logging Principles
- **Structured JSON logs** in Edge Functions
- **Never log PII or secrets**
- **Log at boundaries** — Server Actions, Edge Functions, external service calls

---

## Production Readiness

### Performance
- Lazy loading / code splitting where supported
- Image optimization via `next/image`
- Vercel handles caching and CDN

### Deployment
- Vercel handles builds and deploys from `main`
- Supabase Edge Functions deployed via Supabase CLI
- Database migrations applied via Supabase CLI before deploy

---

## When Using React

### Components
- Function components only — no classes
- One component per file (small private helpers may be colocated)
- Props destructured in the function signature

**Composition over configuration**:
```tsx
// ✅ Good
<Card>
  <Card.Header>Title</Card.Header>
  <Card.Body>Content</Card.Body>
</Card>

// ❌ Bad — prop drilling
<Card title="Title" body="Content" footer="..." />
```

### State Management
| State Type | Solution | When |
|------------|----------|------|
| Server/async | Supabase client SDK | DB reads, realtime |
| Client (simple) | React Context | Theme, preferences, 2–3 consumers |
| Client (complex) | Zustand | Cross-component state, >3 consumers |
| Forms | React Hook Form + Zod | Any form with validation |
| URL state | nuqs | Filters, pagination, shareable state |

### Hooks
**Memoization** — only when there is a measured need. Never premature optimization.

Custom hooks:
- Shared hooks → `src/hooks/`
- Feature-specific hooks → colocate in the feature folder
- Always prefix with `use`

### Rendering Patterns
```tsx
// Early return for loading/error states
if (isLoading) return <Skeleton />;
if (error) return <ErrorState error={error} />;
return <Content data={data} />;

// Always use stable keys
{items.map((item) => (
  <ItemCard key={item.id} item={item} />
))}
```

### Event Handlers
- `handle*` for implementation — e.g. `handleBook`
- `on*` for props — e.g. `onClick`, `onBook`

---

## When Using Next.js

- Use **App Router** (not Pages Router)
- Default to **Server Components**; use `Suspense` for streaming
- **Server Actions** for mutations, organized by feature in `actions/` folders
- Colocate components within route segments when they are route-specific
- Use route groups `(groupName)` for organization without URL impact

### Special Files
| File | Purpose |
|------|---------|
| `page.tsx` | Route entry point |
| `layout.tsx` | Shared UI wrapper |
| `loading.tsx` | Loading state |
| `error.tsx` | Error boundary |
| `not-found.tsx` | 404 handling |

---

## When Using Tailwind CSS

- **Never** string-concatenate dynamic class names — it breaks purging:
  ```typescript
  // ❌ Bad
  className={`bg-${color}-500`}

  // ✅ Good
  const bgColor = isActive ? "bg-blue-500" : "bg-gray-500";
  ```
- Use `cn()` (tailwind-merge + clsx) for all conditional class logic
- Use `cva()` for component variants
- Mobile-first responsive design: `sm:`, `md:`, `lg:` prefixes
- Prefer Tailwind utilities over custom CSS
- Class ordering enforced by `prettier-plugin-tailwindcss`

---

## When Animating

### Tool Selection
| Complexity | Tool |
|------------|------|
| Complex / orchestrated | Framer Motion |
| Advanced timelines | GSAP |
| Simple transitions | CSS transitions via Tailwind |

### Duration Philosophy
| Animation Type | Duration |
|----------------|----------|
| Micro-interactions | 150ms |
| Component enter | 200ms |
| Component exit | 150ms |
| Page transitions | 250ms |
| Complex sequences | 300–400ms max |

### Performance Rules
- Respect `prefers-reduced-motion` — always
- No animation on first paint (preserves LCP)
- GPU-accelerated properties only: `transform` and `opacity`
- Never animate `width`, `height`, `top`, or `left`
- Stagger list items for perceived performance

### Code Organization
Centralize animation definitions in `lib/animations/variants.ts`.

---

## When Building UI

### Interactive States
Every interactive element must cover all states:

| State | Implementation |
|-------|----------------|
| Hover | Subtle background/color shift |
| Active / Pressed | Slightly darker, scale down slightly |
| Focus-visible | Ring outline (keyboard navigation) |
| Disabled | Reduced opacity, `cursor-not-allowed` |
| Loading | Spinner, interaction disabled |

### Feedback & States
| State | Pattern |
|-------|---------|
| Empty | Illustration + helpful message + CTA |
| Error | Clear message + recovery action |
| Success | Toast notification or inline feedback |
| Destructive action | Confirmation dialog |

### Design System Consistency

**Spacing Scale** (Tailwind only — never arbitrary values):
```
4px  (1)  — tight spacing
8px  (2)  — related elements
12px (3)  — grouped content
16px (4)  — section padding
24px (6)  — card padding
32px (8)  — section gaps
48px (12) — major sections
64px (16) — page sections
```

### Icons & Toasts
- Icons: **Lucide React** — consistent sizes: 16px, 20px, 24px, 32px
- Toasts: **Sonner**
- Icon-only buttons must always have a tooltip with an accessible label

### Micro-Details
- Truncate long text with ellipsis and a tooltip showing the full value
- Skeletons must match the exact final layout dimensions
- Images use blur placeholder while loading
- Responsive text sizing: `text-sm md:text-base`

### Polish Checklist
- [ ] All interactive elements have hover/active/focus states
- [ ] Disabled states are visually clear
- [ ] Loading states for all async actions
- [ ] Empty states have illustration and CTA
- [ ] Error states have a recovery action
- [ ] Destructive actions require confirmation
- [ ] Spacing uses Tailwind scale consistently
- [ ] Icons are consistently sized
- [ ] Long text truncates gracefully
- [ ] Skeletons match final layout dimensions
- [ ] Images have blur loading placeholders
- [ ] Animations respect `prefers-reduced-motion`
- [ ] Icon-only buttons have tooltips

---

## When Building for the Web

### Accessibility (WCAG 2.1 AA)
| Requirement | Implementation |
|-------------|----------------|
| Semantic HTML | `nav`, `main`, `article`, `section`, `header`, `footer` |
| ARIA labels | All interactive elements must have accessible names |
| Keyboard navigation | All functionality reachable via keyboard |
| Focus management | Manage focus on route changes and modal open/close |
| Color contrast | Minimum 4.5:1 for normal text, 3:1 for large text |

### Core Web Vitals Targets
| Metric | Target |
|--------|--------|
| LCP | < 2.5s |
| FID | < 100ms |
| CLS | < 0.1 |

### E2E Testing (Playwright)
- **Page Object Model** for all pages
- **`data-testid`** selectors — stable, not coupled to styling or text
- Isolated test data: seed and clean up per test
- Cover happy paths and key error states
