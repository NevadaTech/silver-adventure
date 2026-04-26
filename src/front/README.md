# Front — Web de Ruta C Conecta

> Aplicación Next.js 16 que cumple el componente **"Entrega"** del sistema para el empresario formal. Es la cara pública del producto: landing, registro guiado, login y la app autenticada con cinco pantallas que consumen las recomendaciones, clusters y eventos del [brain](../brain/README.md).
>
> Para el contexto narrativo del producto completo ver el [README raíz](../../README.md). Para reglas y convenciones del monorepo ver [`AGENTS.md`](../../AGENTS.md).

---

## 1. Qué es el front

Es la **puerta de entrada del comerciante formal**. Pieza visible del sistema. Cumple cuatro funciones:

1. **Landing pública** que explica la propuesta de valor del programa Ruta C Conecta y dirige al registro.
2. **Registro guiado** con wizard de varios pasos (datos del negocio, contacto, confirmación).
3. **Login** mockeado hoy, con `Sign in with Vercel` o el provider de Supabase Auth en producción.
4. **App autenticada** con cinco pantallas que consumen al brain para mostrar recomendaciones, clusters, conexiones y la actividad del agente Conector.

Lo que el front **NO hace**: nunca llama directamente a Supabase, ni a Gemini, ni a BigQuery. Toda llamada externa pasa por sus propios Route Handlers (`app/api/*`) o por el brain (`http://localhost:3001/api/...`). Esto es el patrón **BFF estricto** del monorepo.

---

## 2. Pantallas

```
src/front/app/
├── layout.tsx                   # Root layout — fonts, CSS, <html>/<body>
├── globals.css                  # Tailwind 4 + design tokens
├── api/
│   └── users/route.ts           # Route Handler de ejemplo (composition root)
└── [locale]/                    # Locale-scoped (es default; en cuando habilitado)
    ├── layout.tsx               # Provider stack: i18n → theme → SWR
    ├── page.tsx                 # Landing pública
    ├── _components/landing/     # Hero, segments, steps, CTAs, footer
    ├── login/
    │   ├── page.tsx
    │   └── _components/login-form.tsx
    ├── registro/
    │   ├── page.tsx             # Wizard de registro
    │   └── _components/         # Steps, schema (Zod), success
    ├── dev/page.tsx             # Pantalla de utilidades para devs
    └── app/                     # Área autenticada
        ├── layout.tsx           # AppHeader + main
        ├── page.tsx             # Redirige a /inicio
        ├── _components/         # Componentes de las 5 pantallas
        ├── _data/               # Mocks (mock-cluster, mock-recomendaciones, etc.)
        ├── inicio/page.tsx
        ├── recomendaciones/page.tsx
        ├── mi-cluster/page.tsx
        ├── mi-negocio/page.tsx
        └── conexiones/page.tsx
```

### Las cinco pantallas de la app autenticada

| Ruta                   | Qué muestra                                                                                                       |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `/app/inicio`          | Saludo, KPIs del día, hero del agente Conector, mini-cluster, timeline de actividad, quick actions.               |
| `/app/recomendaciones` | Tabla de recomendaciones con filtros (tipo de relación), tabs de estado, drawer de detalle, pills de tipo/estado. |
| `/app/mi-cluster`      | Resumen del cluster del usuario, miembros (cards), traits, cadenas de valor visualizadas.                         |
| `/app/mi-negocio`      | Tabs (general, productos, programas, visibilidad) — perfil de la empresa del usuario.                             |
| `/app/conexiones`      | Conexiones realizadas/aceptadas, stats, tabs por estado, pills de status.                                         |

> Hoy las pantallas consumen mocks (`_data/mock-*.ts`). El cableado real al brain se hace por hook (`useUsers` ya existe como ejemplo) → Route Handler local → fetch al brain. Ver §5.

---

## 3. Arquitectura — Hexagonal en el front también

Sí, el front también es hexagonal. Cada bounded context (hoy `users` como ejemplo) tiene tres capas con la misma regla de dependencia:

```
infrastructure → application → domain
```

```
src/front/core/
├── shared/
│   ├── domain/                  # Entity, ValueObject, UseCase, Repository, Logger (TypeScript puro)
│   └── infrastructure/
│       ├── env.ts               # Zod schema de variables del front
│       ├── http/httpClient.ts   # Axios singleton con interceptors
│       ├── logger/              # ConsoleLogger | NullLogger según DEBUG_ENABLED
│       ├── supabase/            # server.ts (BFF only) + database.types.ts auto-generado
│       ├── swr/                 # SWRProvider + fetcher con AbortController
│       └── theme/               # ThemeProvider + ThemeToggle (next-themes)
└── users/                       # Bounded context de ejemplo
    ├── domain/
    │   ├── entities/User.ts                # private constructor + factory
    │   └── repositories/UserRepository.ts  # port
    ├── application/
    │   └── use-cases/GetUsers.ts
    └── infrastructure/
        ├── repositories/
        │   ├── SupabaseUserRepository.ts   # adapter prod (server-only)
        │   └── InMemoryUserRepository.ts   # adapter test
        ├── components/UserList.tsx          # client component
        └── hooks/useUsers.ts                # SWR hook → /api/users
```

**Composition root** = los Route Handlers (`app/api/*/route.ts`). Ahí se instancian los adapters reales y se inyectan en el use case:

```typescript
// app/api/users/route.ts
const supabase = createSupabaseServerClient()
const repository = new SupabaseUserRepository(supabase)
const getUsers = new GetUsers(repository)
const { users } = await getUsers.execute()
return Response.json({ users })
```

**Reglas no negociables:**

- Domain NO importa nada de NestJS, Next, Supabase, ni siquiera React.
- Use cases NO importan adapters concretos. Reciben ports por constructor.
- Adapters server-only marcados con `import 'server-only'` (build error si se importan en cliente).

---

## 4. Provider stack y data flow

### Provider stack (en `app/[locale]/layout.tsx`, de afuera hacia adentro)

1. **`NextIntlClientProvider`** — i18n. Mensajes de `messages/es.json` (y `en.json` cuando se habilite).
2. **`ThemeProvider`** — light/dark/system vía `next-themes`.
3. **`SWRProvider`** — config global de SWR con fetcher basado en Axios (`AbortController` integrado).

### Data flow — server-side (BFF)

```
Client Component
  └── SWR hook (useUsers)
        └── GET /api/users (Route Handler — composition root)
              ├── createSupabaseServerClient()         (lee env validado)
              ├── new SupabaseUserRepository(...)      (adapter)
              ├── new GetUsers(repository)             (use case)
              └── Response.json(...)                   (DTO)
                    └── SWR cache → UI
```

### Data flow — server-side hacia el brain

Cuando el front necesita datos que produce el brain (recomendaciones, clusters, eventos del agente), su Route Handler local actúa de **proxy/composition**:

```
Client Component
  └── SWR hook
        └── GET /api/recomendaciones      (Route Handler del front)
              └── httpClient.get(`${BRAIN_URL}/api/recommendations/by-company/${id}`)
                    └── brain (NestJS)
                          ├── consulta Supabase
                          ├── Gemini cache hit / lazy explain
                          └── Response.json(...)
```

El cliente NUNCA conoce la URL del brain. Eso vive en el Route Handler. Si el brain se mueve a otra URL, se cambia una sola línea.

---

## 5. Cómo se consume al brain

Hoy las pantallas usan mocks en `_data/`. La transición a datos reales sigue un patrón fijo:

1. Crear el bounded context en `src/front/core/<contexto>/` (`recommendations`, `clusters`, etc.).
2. Definir port `*Repository` con métodos coherentes con los endpoints del brain.
3. Implementar adapter `Brain*Repository` que use `httpClient` (Axios) para consumir REST del brain.
4. Implementar use cases (`GetCompanyRecommendations`, `ExplainRecommendation`...).
5. Crear Route Handler en `app/api/<recurso>/...` como composition root: instancia adapter, ejecuta use case, devuelve DTO.
6. Crear hook SWR en `src/front/core/<contexto>/infrastructure/hooks/use<Recurso>.ts` que apunta al Route Handler local.
7. Componente cliente consume el hook.

**Por qué este zigzag.** Permite cambiar el brain sin tocar UI; aislar errores y logs en el Route Handler; sanitizar DTOs antes de exponerlos al cliente; agregar caché HTTP en la edge de Vercel sobre los Route Handlers.

---

## 6. i18n

| Config     | Valor                                           |
| ---------- | ----------------------------------------------- |
| Librería   | `next-intl` 4.x                                 |
| Locales    | `es` (default), `en` (placeholder)              |
| Estrategia | URL-based routing (`/es/...`, `/en/...`)        |
| Prefix     | `as-needed` (el default omite prefijo)          |
| Mensajes   | `messages/es.json` (y `en.json` cuando se sume) |
| Proxy      | `proxy.ts` (Next.js 16 — ex `middleware.ts`)    |

Agregar traducciones: añadir keys a `messages/<locale>.json` y consumir con `useTranslations('Namespace')` (server o client component, ambos funcionan vía `NextIntlClientProvider`).

Agregar locale: agregar el código a `i18n/routing.ts → locales`, crear `messages/<locale>.json`, listo.

---

## 7. Stack y dependencias clave

| Bloque        | Pieza                                           | Qué hace                                         |
| ------------- | ----------------------------------------------- | ------------------------------------------------ |
| Framework     | `next` 16.2.4 (App Router + React Compiler)     | Server Components, Route Handlers, streaming     |
| UI            | `react` 19.2, `tailwindcss` 4, `lucide-react`   | Components + iconos + utilidades                 |
| Animación     | `motion`                                        | Microinteracciones del landing y app             |
| Data fetching | `swr` + `axios`                                 | Cliente con cache, revalidación e interceptors   |
| i18n          | `next-intl`                                     | Routing por locale + mensajes                    |
| Theme         | `next-themes`                                   | Light/dark/system                                |
| Supabase      | `@supabase/ssr`, `@supabase/supabase-js`        | Cliente server-only (BFF)                        |
| Validación    | `zod` 4                                         | Env vars + schemas del wizard de registro        |
| Tests         | `vitest` 4 + `@testing-library/react` + `jsdom` | Unit (node) + integration (jsdom)                |
| Lint/format   | `eslint-config-next`, `eslint-config-prettier`  | + plugin de orden de clases Tailwind en Prettier |

> **React Compiler está activado** (`reactCompiler: true` en `next.config.ts`). No hace falta `useMemo` / `useCallback` manual — el compilador lo hace por vos.

---

## 8. Variables de entorno

Validadas con Zod en `core/shared/infrastructure/env.ts`. Falla rápido si falta una requerida.

| Variable                    | Side   | Descripción                                      |
| --------------------------- | ------ | ------------------------------------------------ |
| `SUPABASE_URL`              | Server | URL del proyecto Supabase                        |
| `SUPABASE_PUBLISHABLE_KEY`  | Server | Publishable key (ex anon key)                    |
| `DEBUG_ENABLED`             | Server | `true` activa `ConsoleLogger` server-side        |
| `NEXT_PUBLIC_DEBUG_ENABLED` | Client | `true` activa `ConsoleLogger` client-side        |
| `NEXT_PUBLIC_APP_URL`       | Client | URL pública de la app (canonical, OG tags, etc.) |

**Disciplina BFF.** Las únicas variables `NEXT_PUBLIC_*` permitidas son las dos de arriba — no son secretos. **Nada de `NEXT_PUBLIC_SUPABASE_*`.** Detalle completo en [`AGENTS.md`](../../AGENTS.md) §8.

---

## 9. Cómo correr

### Desde la raíz del monorepo

```bash
bun install
cp .env.example .env       # configurar credenciales
bun dev:front              # http://localhost:3000
```

### Desde la carpeta del front

```bash
cd src/front
bun dev                    # dev server con HMR
bun build                  # build de producción
bun start                  # servir el build
bun lint                   # ESLint
bun test                   # vitest watch
bun test:run               # vitest single run
bun test:coverage          # coverage report
bun supabase:types         # regenera database.types.ts desde el proyecto Supabase linkeado
```

### Filtrado desde la raíz (sin cambiar de directorio)

```bash
bun --filter front dev
bun --filter front test:run
bun --filter front build
```

> El brain debe estar levantado en paralelo (`bun dev:brain`) para que las pantallas reales (no mocks) tengan datos. OpenAPI del brain en `http://localhost:3001/docs`.

---

## 10. Tests — TDD estricto

`ARQ-007` aplica al front también. Coverage > 80% sobre `src/front/core/**`.

```
src/front/__tests__/
├── core/                   # Unit tests (env: 'node')
│   ├── shared/domain/      # Entity, ValueObject, etc.
│   ├── users/              # User entity, GetUsers use case, repos
│   └── app/                # Route handler tests, env validation
├── integration/            # Component tests (env: 'jsdom')
│   └── users/              # UserList integration tests
└── unit/                   # Reservado para unit tests no-core
```

**Convención de ubicación de tests:**

| Source                                                        | Test                                            |
| ------------------------------------------------------------- | ----------------------------------------------- |
| `src/front/core/users/domain/entities/User.ts`                | `__tests__/core/users/User.test.ts`             |
| `src/front/core/users/application/use-cases/GetUsers.ts`      | `__tests__/core/users/GetUsers.test.ts`         |
| `src/front/app/api/users/route.ts`                            | `__tests__/core/app/api/users/route.test.ts`    |
| `src/front/core/users/infrastructure/components/UserList.tsx` | `__tests__/integration/users/UserList.test.tsx` |

**Nunca** poner tests dentro de `src/`.

---

## 11. Path aliases

```
"paths": { "@/*": ["./src/*"] }   // (relativo al root del monorepo)
```

Reglas:

- **Siempre** `@/...` para imports cross-folder (en `src/` y en `__tests__/`).
- `./` solo entre archivos hermanos en la misma carpeta (ej. `./fetcher` dentro de `swr/`).
- **Nunca** `../` para subir directorios — si lo necesitás, hay que crear o usar un alias.
- Crear nuevos aliases en `tsconfig.json → paths` cuando emerja un patrón. Documentar en `AGENTS.md`.

---

## 12. Convenciones (resumen)

Detalle completo en [`AGENTS.md`](../../AGENTS.md). Lo crítico:

1. **Hexagonal estricta** — domain con cero imports externos.
2. **BFF estricto** — UI / Client Components nunca llaman Supabase ni Gemini directo. Todo pasa por Route Handlers o por el brain.
3. **Tests fuera de `src/`** (`__tests__/` espejo de `src/`).
4. **Path aliases** siempre.
5. **Validación con Zod** en factories de entities y en env.
6. **`no-console: error`** — usar el `Logger` port (`serverLogger` / `clientLogger`).
7. **Conventional commits**, sin atribución a IA.
8. **Pre-commit:** lint-staged + commitlint. **Pre-push:** `bun test:run`.
9. **TDD:** RED → GREEN → REFACTOR.
10. **Next.js 16:** `proxy.ts` (no `middleware.ts`), `params` es `Promise` (await antes de leer), React Compiler activo.

---

## 13. Diferencias clave vs. Next.js 15 y anteriores

Next.js 16 tiene cambios breaking. **No es el Next que conocés.** Antes de tocar APIs del framework, leé `node_modules/next/dist/docs/`. Lo más importante:

| Antes                                     | Ahora (Next.js 16)                                                                 |
| ----------------------------------------- | ---------------------------------------------------------------------------------- |
| `middleware.ts` con `middleware()` export | `proxy.ts` con `default` export usando `proxy()` API                               |
| `params: { locale: string }`              | `params: Promise<{ locale: string }>` — `await params`                             |
| `useMemo` / `useCallback` manuales        | React Compiler los aplica automáticamente                                          |
| ESLint 9                                  | ESLint 10 — `context.getFilename()` removido. `react.version` debe estar explícito |

---

## 14. Referencias

- **Producto y narrativa completa:** [`README.md`](../../README.md) raíz.
- **Brain (motor inteligente que consume este front):** [`src/brain/README.md`](../brain/README.md).
- **Convenciones del monorepo:** [`AGENTS.md`](../../AGENTS.md).
- **Documentación funcional del entregable:** [`docs/documentacion.md`](../../docs/documentacion.md).
- **Planeación:** [`docs/planeacion/`](../../docs/planeacion/).
