# AGENTS.md — Silver Adventure

> Canonical reference for any AI agent working on this repo.
> Read this ENTIRELY before writing a single line of code.

---

## 1. Project Overview

**Silver Adventure** is a Next.js 16 application built with **Hexagonal Architecture** (Ports & Adapters) and **Domain-Driven Design** tactical patterns. It uses Supabase as the persistence layer, SWR for client-side data fetching, and follows a strict BFF (Backend For Frontend) pattern where ALL external service calls happen server-side.

| Key           | Value                                       |
| ------------- | ------------------------------------------- |
| Framework     | Next.js 16.2.4 (App Router)                 |
| Language      | TypeScript 6 (strict mode)                  |
| Runtime       | Bun                                         |
| Styling       | Tailwind CSS 4                              |
| Database      | Supabase (cloud)                            |
| Data Fetching | SWR 2.x (client) / Direct Supabase (server) |
| HTTP Client   | Axios (singleton with interceptors)         |
| i18n          | next-intl 4.x (routing by locale)           |
| Theme         | next-themes 0.4.x                           |
| Validation    | Zod 4                                       |
| Testing       | Vitest 4 + React Testing Library            |
| Linting       | ESLint 10 + Prettier 3                      |
| Git Hooks     | Husky 9 + lint-staged + commitlint          |

---

## 2. CRITICAL — Next.js 16 Breaking Changes

<!-- BEGIN:nextjs-agent-rules -->

**This is NOT the Next.js you know.** Next.js 16 has breaking changes from prior versions. APIs, conventions, and file structure may differ from your training data.

**MANDATORY**: Read the relevant guide in `node_modules/next/dist/docs/` BEFORE writing any code that touches Next.js APIs. Heed deprecation notices.

Key differences to be aware of:

- `middleware.ts` is now `proxy.ts` — exports `default` (not `middleware`) and uses `proxy()` API
- `params` in page/layout props is now a `Promise` — must `await params` before accessing values
- React Compiler is enabled (`reactCompiler: true` in next.config.ts) — no manual `useMemo`/`useCallback` needed
- ESLint 10 is used — `context.getFilename()` was removed; `eslint-plugin-react` requires `settings.react.version` set explicitly

<!-- END:nextjs-agent-rules -->

---

## 3. Architecture — Hexagonal (Ports & Adapters)

This is a **Screaming Architecture** — the folder structure tells you what the system DOES, not what framework it uses.

### 3.1 The Dependency Rule

```
  UI / Framework / DB
         |
         v
   INFRASTRUCTURE  (adapters — implementations)
         |
         v
     APPLICATION    (use cases — orchestration)
         |
         v
       DOMAIN       (entities, value objects, ports — ZERO dependencies)
```

**Dependencies ALWAYS point inward.** Domain knows NOTHING about infrastructure. Infrastructure implements domain contracts (ports). Application orchestrates domain through ports.

### 3.2 Layer Responsibilities

| Layer              | What lives here                                                                      | Can depend on                                             |
| ------------------ | ------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| **Domain**         | Entities, Value Objects, Repository interfaces (ports), domain errors                | NOTHING external. Pure TypeScript. No framework imports.  |
| **Application**    | Use Cases                                                                            | Domain only. NO infrastructure imports.                   |
| **Infrastructure** | Repository implementations (adapters), HTTP clients, UI components, hooks, providers | Domain + Application. Framework-specific code lives here. |

### 3.3 Composition Root

The **Route Handlers** (`src/app/api/`) and **Server Components** (`src/app/[locale]/`) are the composition root. This is where you wire dependencies:

```typescript
// src/app/api/users/route.ts — composition happens HERE
const supabase = createSupabaseServerClient()
const repository = new SupabaseUserRepository(supabase) // adapter
const getUsers = new GetUsers(repository) // inject port
const { users } = await getUsers.execute() // run use case
```

**NEVER** instantiate adapters inside use cases. **NEVER** import infrastructure in domain.

---

## 4. Directory Structure

```
silver-adventure/
├── src/
│   ├── app/                          # Next.js App Router (framework layer)
│   │   ├── layout.tsx                # Root layout — fonts, CSS, <html>/<body>
│   │   ├── globals.css               # Tailwind + CSS custom properties
│   │   ├── [locale]/                 # Locale-scoped routes
│   │   │   ├── layout.tsx            # Provider stack: i18n → theme → SWR
│   │   │   └── page.tsx              # Home page (Server Component)
│   │   └── api/                      # Route Handlers (BFF endpoints)
│   │       └── users/route.ts        # GET /api/users — composition root
│   │
│   ├── core/                         # Hexagonal core (THE architecture)
│   │   ├── shared/                   # Cross-cutting concerns
│   │   │   ├── domain/               # Base building blocks
│   │   │   │   ├── Entity.ts         # Abstract base entity (identity-based equality)
│   │   │   │   ├── ValueObject.ts    # Abstract base VO (property-based equality, immutable)
│   │   │   │   ├── UseCase.ts        # UseCase<Input, Output> interface
│   │   │   │   ├── Repository.ts     # Generic Repository<T, ID> port
│   │   │   │   └── Logger.ts         # Logger port — debug/info/warn/error contract
│   │   │   └── infrastructure/       # Shared adapters & utilities
│   │   │       ├── env.ts            # Zod-validated env vars (fail-fast on startup)
│   │   │       ├── http/
│   │   │       │   └── httpClient.ts # Axios singleton (auth interceptor, error normalization)
│   │   │       ├── logger/
│   │   │       │   ├── ConsoleLogger.ts   # Adapter — delegates to console.* with prefixed levels
│   │   │       │   ├── NullLogger.ts      # Adapter — Null Object pattern (silences everything)
│   │   │       │   ├── createLogger.ts    # Factory — returns Console or Null based on config
│   │   │       │   ├── serverLogger.ts    # Singleton — reads DEBUG_ENABLED (server-only)
│   │   │       │   ├── clientLogger.ts    # Singleton — reads NEXT_PUBLIC_DEBUG_ENABLED (client)
│   │   │       │   └── index.ts           # Barrel export (excludes server/client singletons)
│   │   │       ├── supabase/
│   │   │       │   ├── server.ts     # Server-only Supabase client (BFF)
│   │   │       │   └── database.types.ts  # Auto-generated by `bun supabase:types`
│   │   │       ├── swr/
│   │   │       │   ├── SWRProvider.tsx    # Global SWR config with axios fetcher
│   │   │       │   └── fetcher.ts        # Axios-based fetcher with AbortController
│   │   │       ├── theme/
│   │   │       │   ├── ThemeProvider.tsx  # next-themes wrapper
│   │   │       │   └── ThemeToggle.tsx   # Dark/light/system toggle (client component)
│   │   │       └── i18n/
│   │   │           └── LocaleSwitcher.tsx # Language switcher (client component)
│   │   │
│   │   └── users/                    # "Users" bounded context
│   │       ├── domain/
│   │       │   ├── entities/
│   │       │   │   └── User.ts       # User entity (private constructor, factory method)
│   │       │   └── repositories/
│   │       │       └── UserRepository.ts  # Port — findAll(), findById()
│   │       ├── application/
│   │       │   └── use-cases/
│   │       │       └── GetUsers.ts   # Orchestrates UserRepository.findAll()
│   │       └── infrastructure/
│   │           ├── repositories/
│   │           │   ├── SupabaseUserRepository.ts  # Real adapter (production)
│   │           │   └── InMemoryUserRepository.ts  # Fake adapter (tests)
│   │           ├── components/
│   │           │   └── UserList.tsx   # Client component — renders user list via SWR
│   │           └── hooks/
│   │               └── useUsers.ts   # SWR hook — fetches /api/users
│   │
│   ├── i18n/                         # next-intl configuration
│   │   ├── routing.ts                # Locale config (en, es), default: en
│   │   ├── navigation.ts             # Typed Link, useRouter, usePathname, etc.
│   │   └── request.ts               # Server request locale resolution
│   │
│   └── proxy.ts                      # Next.js 16 proxy (was middleware.ts) — locale detection
│
├── __tests__/                        # ALL tests live here (mirrors src/ structure)
│   ├── core/                         # Unit tests for hexagonal core
│   │   ├── shared/domain/            # Entity, ValueObject, etc.
│   │   ├── users/                    # User entity, GetUsers use case, repos
│   │   └── app/                      # Route handler tests, env validation
│   ├── integration/                  # Component tests (jsdom)
│   │   └── users/                    # UserList integration tests
│   └── unit/                         # (reserved for non-core unit tests)
│
├── messages/                         # i18n translation files
│   ├── en.json
│   └── es.json
│
├── supabase/                         # Supabase project config
└── public/                           # Static assets
```

---

## 5. Adding a New Bounded Context (Step-by-Step)

When you need to add a new feature (e.g., `products`), follow this exact order:

### Step 1 — Domain (NO dependencies)

```
src/core/products/domain/
├── entities/
│   └── Product.ts          # Entity extending Entity<string>
├── value-objects/           # (if needed)
│   └── Price.ts            # ValueObject<{ amount: number; currency: string }>
└── repositories/
    └── ProductRepository.ts  # Interface (PORT) — what the domain needs
```

- Entity uses private constructor + static `create()` factory with validation
- Repository interface defines the contract — NOT the implementation
- **ZERO imports from infrastructure or framework**

### Step 2 — Application (depends on Domain only)

```
src/core/products/application/
└── use-cases/
    ├── GetProducts.ts       # implements UseCase<void, { products: Product[] }>
    └── CreateProduct.ts     # implements UseCase<CreateProductInput, Product>
```

- Each use case does ONE thing
- Receives repository (port) via constructor injection
- **NEVER imports from infrastructure**

### Step 3 — Infrastructure (implements Domain contracts)

```
src/core/products/infrastructure/
├── repositories/
│   ├── SupabaseProductRepository.ts   # Real adapter
│   └── InMemoryProductRepository.ts   # Test adapter
├── components/
│   └── ProductList.tsx                # Client component (uses SWR hook)
└── hooks/
    └── useProducts.ts                 # SWR hook → /api/products
```

### Step 4 — Route Handler (composition root)

```
src/app/api/products/route.ts          # Wire adapter → use case → respond
```

### Step 5 — Page (consume)

```
src/app/[locale]/products/page.tsx     # Server Component, renders <ProductList />
```

### Step 6 — Tests (mirror src/ structure)

```
__tests__/core/products/
├── Product.test.ts                    # Entity unit test
├── GetProducts.test.ts                # Use case unit test (InMemory adapter)
└── SupabaseProductRepository.test.ts  # Adapter unit test (mocked Supabase)
```

---

## 6. Testing

### 6.1 Configuration

- **Runner**: Vitest 4 with workspace projects
- **Unit tests**: `environment: 'node'` — domain + application logic (NO DOM)
- **Integration tests**: `environment: 'jsdom'` — React components with Testing Library
- **Coverage**: V8 provider, 80% threshold on `src/core/**`
- **Setup**: `vitest.setup.ts` — imports `@testing-library/jest-dom`

### 6.2 Test Location Convention

Tests ALWAYS live in `__tests__/`, mirroring the `src/` structure:

| Source                                                  | Test                                            |
| ------------------------------------------------------- | ----------------------------------------------- |
| `src/core/users/domain/entities/User.ts`                | `__tests__/core/users/User.test.ts`             |
| `src/core/users/application/use-cases/GetUsers.ts`      | `__tests__/core/users/GetUsers.test.ts`         |
| `src/app/api/users/route.ts`                            | `__tests__/core/app/api/users/route.test.ts`    |
| `src/core/users/infrastructure/components/UserList.tsx` | `__tests__/integration/users/UserList.test.tsx` |

**NEVER** put test files inside `src/`. Tests are separate citizens.

### 6.3 Test Commands

```bash
bun test              # Watch mode
bun test:run          # Single run (CI)
bun test:coverage     # Run with coverage report
```

### 6.4 TDD Workflow

This project follows **Test-Driven Development**. When adding new functionality, follow this cycle:

1. **RED** — Write a failing test FIRST. The test defines the expected behavior.
2. **GREEN** — Write the MINIMUM code to make the test pass. No more.
3. **REFACTOR** — Clean up the code while keeping the tests green.

Order of test writing when adding a new bounded context:

```
1. Entity test          → Entity implementation
2. Use Case test        → Use Case implementation (with InMemory adapter)
3. Adapter test         → Real adapter implementation (mocked Supabase)
4. Route Handler test   → Route Handler implementation
5. Integration test     → Client component + hook
```

**NEVER write production code without a corresponding test.** If a test doesn't exist yet, write one before touching the implementation.

### 6.5 Testing the Hexagonal Architecture

- **Domain tests** (Entity, ValueObject): Pure unit tests. No mocks needed.
- **Use Case tests**: Inject `InMemoryRepository` — test orchestration logic in isolation.
- **Adapter tests**: Mock the external dependency (Supabase client), verify the adapter maps data correctly.
- **Route Handler tests**: Mock the Supabase module, verify HTTP response shape.
- **Component tests**: Render with providers, mock API responses, verify UI behavior.

### 6.6 Coverage Exclusions

These files are excluded from coverage (thin wrappers with zero logic):

- `database.types.ts` — auto-generated by Supabase CLI
- `ThemeProvider.tsx`, `SWRProvider.tsx` — pure provider wrappers
- `ThemeToggle.tsx`, `LocaleSwitcher.tsx` — pure UI, tested indirectly
- `UserList.tsx` — pure rendering component
- `useUsers.ts` — tested via integration tests
- `server.ts` — thin Supabase client factory
- `serverLogger.ts`, `clientLogger.ts`, `logger/index.ts` — one-liner singletons and barrel export

---

## 7. Data Flow

### 7.1 Server-Side (BFF Pattern)

```
Client Component → SWR hook → GET /api/users (Route Handler)
                                    │
                     ┌──────────────┤ Composition Root
                     │              │
               Supabase Client ← SupabaseUserRepository (adapter)
                                    │
                              GetUsers Use Case
                                    │
                              UserRepository port
                                    │
                              User[] entities
                                    │
                              JSON response → SWR cache → UI
```

**ALL database operations go through Route Handlers (`src/app/api/`).** No Server Component, no Client Component, no hook calls Supabase directly. The Route Handler is the ONLY entry point to the database — it composes the adapter, injects it into the use case, and returns JSON. This is enforced by `import 'server-only'` in `server.ts`.

### 7.2 Client-Side

```
Page (Server Component)
  └── renders <UserList /> (Client Component)
        └── useUsers() hook (SWR)
              └── fetcher() (Axios httpClient)
                    └── GET /api/users
```

### 7.3 Provider Stack

The `[locale]/layout.tsx` wraps all pages with providers (outside → inside):

1. **NextIntlClientProvider** — i18n messages for all client components
2. **ThemeProvider** — dark/light/system theme via next-themes
3. **SWRProvider** — global SWR config with Axios fetcher

---

## 8. Environment Variables

All env vars are **server-only** (NO `NEXT_PUBLIC_` prefix — BFF pattern), with two exceptions:

| Variable                    | Side   | Purpose                                          |
| --------------------------- | ------ | ------------------------------------------------ |
| `SUPABASE_URL`              | Server | Supabase project URL                             |
| `SUPABASE_PUBLISHABLE_KEY`  | Server | Supabase publishable API key                     |
| `DEBUG_ENABLED`             | Server | Enable server-side logger (`"true"` / `"false"`) |
| `NEXT_PUBLIC_DEBUG_ENABLED` | Client | Enable client-side logger (`"true"` / `"false"`) |
| `NEXT_PUBLIC_APP_URL`       | Client | Application URL                                  |

> `NEXT_PUBLIC_DEBUG_ENABLED` and `NEXT_PUBLIC_APP_URL` are the ONLY `NEXT_PUBLIC_` vars. They are boolean flags / URLs — NOT secrets. They do NOT violate the BFF pattern.

Server-side vars are validated at startup with Zod in `src/core/shared/infrastructure/env.ts`. If any required variable is missing or invalid, the server crashes immediately with a clear error message. `DEBUG_ENABLED` is optional and defaults to `"false"`.

Reference `.env.example` for all variables. **NEVER** commit `.env` files.

---

## 9. i18n (Internationalization)

| Config   | Value                                            |
| -------- | ------------------------------------------------ |
| Library  | next-intl 4.x                                    |
| Locales  | `en` (default), `es`                             |
| Strategy | URL-based routing (`/en/...`, `/es/...`)         |
| Prefix   | `as-needed` (default locale omits prefix)        |
| Messages | `messages/en.json`, `messages/es.json`           |
| Proxy    | `src/proxy.ts` — detects locale from URL/headers |

### Adding translations

1. Add keys to `messages/en.json` and `messages/es.json`
2. Use `useTranslations('Namespace')` in Server Components
3. Use `useTranslations('Namespace')` in Client Components (works via NextIntlClientProvider)

### Adding a new locale

1. Add locale code to `src/i18n/routing.ts` → `locales` array
2. Create `messages/<locale>.json` with all keys
3. That's it — proxy and routing handle the rest

---

## 10. Styling

- **Tailwind CSS 4** with PostCSS
- CSS custom properties for theme colors defined in `globals.css`
- Prettier plugin for automatic Tailwind class sorting
- **NO CSS modules, NO styled-components, NO CSS-in-JS**

---

## 11. Code Quality & Git Workflow

### 11.1 Commit Convention

**Conventional Commits** enforced by commitlint:

```
type(scope): subject
```

| Type       | When                                    |
| ---------- | --------------------------------------- |
| `feat`     | New feature                             |
| `fix`      | Bug fix                                 |
| `docs`     | Documentation only                      |
| `style`    | Code formatting (no logic change)       |
| `refactor` | Code restructuring (no behavior change) |
| `perf`     | Performance improvement                 |
| `test`     | Adding or updating tests                |
| `chore`    | Build process, deps, tooling            |
| `ci`       | CI/CD configuration                     |
| `revert`   | Revert a previous commit                |

Rules:

- Subject MUST be lowercase
- Subject MUST NOT be empty
- Subject MUST NOT end with a period
- Header MUST be <= 100 characters
- **NEVER** add "Co-Authored-By" or AI attribution

### 11.2 Git Hooks (Husky)

**Pre-commit** — runs on every commit:

1. **lint-staged** on `*.{ts,tsx,js,jsx}` → `eslint --fix` + `prettier --write`
2. **lint-staged** on `*.{json,md,css,mjs}` → `prettier --write`
3. **commitlint** validates the commit message format

**Pre-push** — runs before every push:

1. **`bun test:run`** — full test suite must pass. If any test fails, the push is rejected.

### 11.3 Linting

- ESLint 10 with `eslint-config-next` (core-web-vitals + TypeScript)
- `eslint-config-prettier` disables formatting rules (Prettier handles formatting)
- React version set to `'19'` explicitly (avoids broken detection in ESLint 10)
- **`no-console: error`** — prevents stray `console.log/info/warn/error` in source code. Use the Logger port (`serverLogger` / `clientLogger`) instead. If you MUST use console directly (e.g., inside `ConsoleLogger`), disable per-line with `// eslint-disable-next-line no-console`

### 11.4 Formatting

Prettier config (`.prettierrc`):

- No semicolons
- Single quotes
- Trailing commas everywhere
- 80 char print width
- 2-space indentation
- LF line endings
- Tailwind class sorting plugin

---

## 12. Key Patterns & Conventions

### 12.1 Entity Pattern

```typescript
export class User extends Entity<string> {
  private readonly props: UserProps

  private constructor(id: string, props: UserProps) {
    // PRIVATE
    super(id)
    this.props = props
  }

  static create(id: string, name: string): User {
    // FACTORY with validation
    if (!name || name.trim().length === 0) {
      throw new Error('User name cannot be empty')
    }
    return new User(id, { name: name.trim(), createdAt: new Date() })
  }
}
```

- **Private constructor** — forces creation through `create()` factory
- **Validation in factory** — entity is ALWAYS valid after creation
- **Getters for props** — never expose internal state directly

### 12.2 Port/Adapter Pattern

```typescript
// PORT (domain/) — the contract
export interface UserRepository {
  findAll(): Promise<User[]>
  findById(id: string): Promise<User | null>
}

// ADAPTER (infrastructure/) — the implementation
export class SupabaseUserRepository implements UserRepository { ... }
export class InMemoryUserRepository implements UserRepository { ... }
```

### 12.3 Use Case Pattern

```typescript
export class GetUsers implements UseCase<void, { users: User[] }> {
  constructor(private readonly repository: UserRepository) {} // DI

  async execute(): Promise<{ users: User[] }> {
    const users = await this.repository.findAll()
    return { users }
  }
}
```

### 12.4 Path Aliases — ALWAYS Use Them

**Current aliases** (defined in `tsconfig.json` → `paths`):

| Alias | Maps to   | Example                                                    |
| ----- | --------- | ---------------------------------------------------------- |
| `@/*` | `./src/*` | `import { User } from '@/core/users/domain/entities/User'` |

**Rules:**

1. **ALWAYS use `@/*`** for cross-folder imports from `src/` — in both `src/` and `__tests__/`
2. **`./` relative imports are ONLY allowed** between sibling files in the SAME directory (e.g., `./fetcher` inside `swr/`, `./routing` inside `i18n/`)
3. **NEVER use `../` to climb directories** — if you need `../`, use a path alias instead
4. **Create new aliases** in `tsconfig.json` → `paths` when a pattern emerges that would benefit from a shortcut (e.g., `@tests/*` for test utilities). Always update `AGENTS.md` when adding a new alias.

```typescript
// GOOD — path alias
import { User } from '@/core/users/domain/entities/User'

// GOOD — sibling file in same directory
import { fetcher } from './fetcher'

// BAD — climbing directories
import { User } from '../../../core/users/domain/entities/User'

// BAD — relative across different directories
import { User } from '../../domain/entities/User'
```

### 12.5 Server-Only Enforcement

Any module that must ONLY run on the server starts with:

```typescript
import 'server-only'
```

This causes a build error if a Client Component tries to import it.

---

## 13. Supabase

### 13.1 Client Creation

- Server-only: `createSupabaseServerClient()` from `src/core/shared/infrastructure/supabase/server.ts`
- Uses validated env vars (Zod)
- **NO client-side Supabase client** — all access through Route Handlers (BFF)

### 13.2 Type Generation

```bash
bun supabase:types
```

This regenerates `src/core/shared/infrastructure/supabase/database.types.ts` from the linked Supabase project. Run this after any schema change.

### 13.3 Known Gotchas

- Supabase renamed `anon key` to `publishable key` (format: `sb_publishable_xxx`). Legacy keys still work but are being deprecated.
- The env var is `SUPABASE_PUBLISHABLE_KEY` (not `SUPABASE_ANON_KEY`)

---

## 14. Known Issues & Workarounds

| Issue                                  | Status     | Details                                                                                                                                                |
| -------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| next-themes script warning in React 19 | Accepted   | Console warning "Encountered a script tag while rendering React component". No fix available — upstream PR #386 pending. `better-themes` has same bug. |
| `eslint-plugin-react` + ESLint 10      | Workaround | Plugin calls removed `context.getFilename()`. Fixed by setting `settings.react.version: '19'` explicitly.                                              |
| `proxy.ts` instead of `middleware.ts`  | Next.js 16 | This is the new API. Function must be default export.                                                                                                  |
| `params` is a Promise                  | Next.js 16 | Must `await params` in page/layout components before accessing `.locale`, `.id`, etc.                                                                  |

---

## 15. Scripts Reference

```bash
bun dev              # Start dev server
bun build            # Production build
bun start            # Start production server
bun lint             # Run ESLint
bun format           # Format all files with Prettier
bun format:check     # Check formatting (CI)
bun test             # Vitest watch mode
bun test:run         # Single Vitest run
bun test:coverage    # Coverage report (80% threshold)
bun supabase:types   # Regenerate Supabase types
```

---

## 16. Rules for AI Agents

1. **Read Next.js 16 docs** in `node_modules/next/dist/docs/` before touching framework code
2. **NEVER break the dependency rule** — domain must have ZERO infrastructure imports
3. **NEVER put business logic in Route Handlers** — they compose, they don't implement
4. **NEVER put tests inside `src/`** — tests live in `__tests__/`
5. **NEVER use `NEXT_PUBLIC_` env vars** — BFF pattern, everything server-side
6. **NEVER import Supabase client in domain or application layers**
7. **ALWAYS use the `@/*` import alias** — no relative paths climbing directories. Create new aliases when needed.
8. **ALWAYS validate entities in factory methods** — constructors are private
9. **ALWAYS create InMemory adapters** for new repositories (for testing)
10. **ALWAYS follow conventional commits** — no AI attribution, no Co-Authored-By
11. **NEVER run `bun build` after changes** — the dev server handles HMR
12. **NEVER commit `.env` files** — only `.env.example` is tracked
13. **ALL database operations go through Route Handlers** (`src/app/api/`) — Server Components and Client Components NEVER call Supabase directly
14. **ALWAYS write the test FIRST** (TDD) — RED → GREEN → REFACTOR. No production code without a failing test.
