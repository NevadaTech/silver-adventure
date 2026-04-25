# Brain — Motor inteligente

Servicio NestJS que expone el motor de clusters, recomendaciones y agente vía REST.

## Stack

- **NestJS 11** + **Bun** runtime
- **Vitest** (no Jest) — consistencia con el front
- **Hexagonal**: domain puro TS, NestJS solo en `infrastructure/` como composition root
- **Zod** para validación + **OpenAPI** auto-generado vía `@nestjs/swagger`

## Estructura

```
src/brain/
├── src/
│   ├── main.ts                 # Bootstrap (composition root)
│   ├── app.module.ts           # Root module
│   └── shared/
│       ├── domain/             # Entity, ValueObject, UseCase, Repository, Logger (puro TS)
│       └── infrastructure/
│           ├── env.ts          # Zod-validated env vars
│           └── health/
│               └── health.controller.ts
└── __tests__/                  # Espejo de src/
```

## Cómo correr (desde root)

```bash
bun --filter brain start:dev      # dev mode con HMR
bun --filter brain test:run       # tests
bun --filter brain build          # build a dist/
```

## Endpoints planeados

- `GET /api/health` — health check (✅ ya existe)
- `POST /api/clusters/generate` — genera clusters dinámicos
- `GET /api/companies/:id/recommendations` — recomendaciones para una empresa
- `GET /api/clusters/:id/explain` — explicación del cluster
- `POST /api/agent/scan` — trigger del agente

OpenAPI disponible en `http://localhost:3001/docs` cuando el server está arriba.

## Cómo agregar un bounded context

1. **Domain** (`src/<context>/domain/`): entities, value objects, repository ports
2. **Application** (`src/<context>/application/`): use cases (TS puro, sin NestJS)
3. **Infrastructure** (`src/<context>/infrastructure/`):
   - Adapters (repositorios, gateways, etc.)
   - Controllers (`*.controller.ts`)
   - Module (`*.module.ts`) que cablea DI
4. Importar el módulo en `app.module.ts`
5. Tests en `__tests__/<context>/...` espejando la estructura
