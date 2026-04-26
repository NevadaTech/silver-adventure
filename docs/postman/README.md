# Postman / Insomnia — Brain API

Colección con **todas las rutas REST del brain** (NestJS).

## Contenido

```
docs/postman/
├── README.md                                       (este archivo)
└── silver-adventure-brain.postman_collection.json  (colección v2.1.0)
```

## Cómo importar

### Postman

1. **File → Import** (o `Ctrl/Cmd + O`).
2. Arrastrar `silver-adventure-brain.postman_collection.json`.
3. Aparece la colección `Silver Adventure · Brain` con 5 carpetas: Health, Companies, Clusters, Recommendations, Agent.

### Insomnia

1. **Import / Export → Import Data → From File**.
2. Seleccionar `silver-adventure-brain.postman_collection.json`.
3. Insomnia detecta el formato Postman v2.1 y lo importa.

### Bruno / Hoppscotch / Thunder Client

Todos soportan Postman v2.1. Mismo flujo: Import → seleccionar el JSON.

## Variables de la colección

Editables en Postman desde **Variables** de la colección:

| Variable           | Default                     | Para qué                                                              |
| ------------------ | --------------------------- | --------------------------------------------------------------------- |
| `baseUrl`          | `http://localhost:3001/api` | Base URL del brain. Cambiar para apuntar a staging/prod.              |
| `companyId`        | (vacío)                     | `registradoMATRICULA` (ej. `0123456-7`). Setear tras listar.          |
| `clusterId`        | (vacío)                     | `pred-7` / `div-47-SANTA_MARTA` / `grp-477-SANTA_MARTA`.              |
| `recommendationId` | (vacío)                     | UUID. Se obtiene de la respuesta de `/companies/:id/recommendations`. |
| `eventId`          | (vacío)                     | UUID de un `agent_event`.                                             |

## Flujo recomendado para probar de cero

1. **Health** — `GET /health` para verificar que el brain está arriba.
2. **Seedear datos** (desde la raíz del monorepo, no desde Postman):
   ```bash
   bun --filter brain seed
   ```
3. **Listar empresas** — `GET /companies?limit=10`. Copiar un `id` y guardarlo en `{{companyId}}`.
4. **Generar clusters** — `POST /clusters/generate`. Mirá los counts en la respuesta.
5. **Ver clusters de la empresa** — `GET /companies/:id/clusters`. Copiar un cluster `id` a `{{clusterId}}`.
6. **Explicar el cluster** — `GET /clusters/:id/explain`.
7. **Generar recomendaciones**:
   - **Sin AI (rápido):** `POST /recommendations/generate` con body `{ "enableAi": false }`.
   - **Con AI (primer scan ~$1-3 USD):** body `{ "enableAi": true }`.
8. **Listar recs de la empresa** — `GET /companies/:id/recommendations`. Copiar un `id` a `{{recommendationId}}`.
9. **Explicación natural** — `POST /recommendations/:id/explain` (lazy + cached).
10. **Disparar scan manual del agente** — `POST /agent/scan`.
11. **Ver eventos generados** — `GET /agent/events?companyId={{companyId}}`.
12. **Marcar uno como leído** — `POST /agent/events/:id/read` con `{{eventId}}`.

## Alternativa: OpenAPI / Swagger

El brain expone OpenAPI auto-generado vía `@nestjs/swagger`.

```bash
bun dev:brain
# después abrir:
open http://localhost:3001/docs
```

Swagger UI tiene **todos los schemas** (DTOs, request bodies, response bodies) que esta colección no detalla — útil cuando hace falta el shape exacto.

## Cuando agregués un endpoint nuevo

1. Crear el controller en `src/brain/src/<contexto>/infrastructure/http/`.
2. Agregar el item correspondiente en `silver-adventure-brain.postman_collection.json`.
3. Si es un recurso nuevo con su propio ID, agregar la variable en `variable[]` arriba del archivo.
4. Validar importando en Postman antes de commitear.

Convenciones:

- Cada item tiene `description` explicando qué hace y referencias al código.
- Bodies de POST con ejemplo realista (no solo `{}` cuando hay campos opcionales relevantes).
- Headers `Content-Type: application/json` solo en requests con body.

## Referencias

- [`src/brain/README.md`](../../src/brain/README.md) — overview del brain
- [`docs/scoring.md`](../scoring.md) — sistema de scoring de recomendaciones
- [`docs/specs/`](../specs/) — specs por bounded context
- OpenAPI live: `http://localhost:3001/docs`
