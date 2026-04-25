# Arquitectura — Decisiones Cross-Cutting

> **Documento maestro de decisiones técnicas que aplican a TODOS los bounded contexts del `brain`.**
>
> Si una decisión vive acá, NO se repite en los specs por contexto. Los specs por contexto referencian este doc cuando aplica una de estas decisiones.

---

## ARQ-001 — Hexagonal Architecture (Ports & Adapters)

**Decisión:** El `brain` se construye con arquitectura hexagonal estricta. Cada bounded context tiene tres capas:

```
domain/         ← entities, value objects, ports (interfaces). CERO dependencias externas.
application/   ← use cases. Solo depende de domain.
infrastructure/← adapters (Supabase, Gemini, HTTP, CSV...). Implementa ports del domain.
```

**Regla de dependencia (NUNCA romper):**

```
infrastructure → application → domain
```

El domain NO puede importar nada de application, infrastructure, NestJS, Supabase, ni de ningún framework. Es **TypeScript puro**.

**Composition root:** Los `*.module.ts` de NestJS son donde se "cablea" qué adapter implementa qué port. Ahí y SOLO ahí.

**¿Por qué?** Para que la fuente de datos (CSV vs BigQuery), la base (Supabase vs cualquier otra), el LLM (Gemini vs OpenAI) sean intercambiables sin tocar lógica de negocio. **Es el principio que habilita ARQ-002.**

---

## ARQ-002 — BigQuery-Readiness vía `CompanySource` Port

**Contexto del reto:** La Cámara de Comercio provee acceso a BigQuery con el dataset real de Ruta C "en sobre cerrado al inicio del hackathon". Hoy NO tenemos las credenciales. Trabajamos con CSVs (`REGISTRADOS_SII.csv`) como mock del dataset real.

**Decisión:** En el bounded context `companies` existe el port `CompanySource` con dos métodos:

```typescript
interface CompanySource {
  fetchAll(): Promise<Company[]>
  fetchUpdatedSince(since: Date): Promise<Company[]>
}
```

**Hoy:** `CsvCompanySource implements CompanySource` lee `REGISTRADOS_SII.csv`.
**Mañana (con creds del reto):** `BigQueryCompanySource implements CompanySource` consulta BQ.

El switch es **una sola línea** en `companies.module.ts`:

```typescript
{ provide: COMPANY_SOURCE, useClass: CsvCompanySource }   // hoy
{ provide: COMPANY_SOURCE, useClass: BigQueryCompanySource } // mañana
```

**Cero impacto en domain, use cases, agent, recommendations, clusters.** Esto es lo que el jurado debe ver explícitamente en el README del entregable.

---

## ARQ-003 — Persistencia: Supabase + AI Cache

**Decisión:** TODA la persistencia operativa del `brain` vive en Supabase con `service_role` key (escribe + RLS bypass).

**Tablas por bounded context:**

| Bounded context | Tablas                                                |
| --------------- | ----------------------------------------------------- |
| ciiu-taxonomy   | `ciiu_taxonomy`                                       |
| companies       | `companies`                                           |
| clusters        | `clusters`, `cluster_members`, `cluster_ciiu_mapping` |
| recommendations | `recommendations`, `ai_match_cache`                   |
| agent           | `scan_runs`, `agent_events`                           |

**`ai_match_cache` es estructural, no excepcional.** El motor usa AI primero para inferir relaciones por par de CIIUs (origen, destino). Como hay ~159 CIIUs reales en el dataset → máximo 25k pares únicos. El cache es la base del sistema, no una optimización.

---

## ARQ-004 — Estrategia de Matching: AI Primero, Heurísticas como Fallback

**Decisión:** `Recommendations` usa Gemini como matcher PRINCIPAL para inferir el tipo de relación entre dos empresas (cliente / proveedor / aliado / referente) por par de CIIUs.

**Capas (en orden):**

1. **AI (PRINCIPAL):** Gemini con `ValueChainRules` + `Ecosystems` como contexto en el prompt → resultado se cachea en `ai_match_cache` por par CIIU.
2. **Fallback 1 — `PeerMatcher`:** Cosine similarity sobre feature vectors de empresas (cuando AI falla o se desactiva).
3. **Fallback 2 — `ValueChainMatcher`:** Reglas hardcoded de cadenas de valor (24 reglas).
4. **Fallback 3 — `AllianceMatcher`:** Mapeo a 6 ecosistemas predefinidos.

**Razones estructuradas (NO texto libre):** Cada recomendación lleva `reasons: jsonb[]` con shape:

```json
[
  { "feature": "mismo_ciiu_division", "weight": 0.3, "value": "47" },
  { "feature": "ai_inferred_match", "weight": 0.7, "confidence": 0.85 }
]
```

Gemini enriquece esto bajo demanda con texto natural (`explanation` column), cacheado.

**Scoring uniforme `[0, 1]`:** El score final de toda recomendación está normalizado y se calcula con fórmula explícita por matcher:

- **AI:** `score = ai_confidence × (0.6 + 0.4 × proximity)` — el 60% es semántico (Gemini sobre el par CIIU), el 40% modula por proximidad de las empresas concretas (mismo municipio + misma etapa + tamaño similar).
- **Fallbacks:** cada matcher tiene su fórmula propia con castigos por municipio distinto.
- **Dedupe:** si dos matchers generan la misma terna `(source, target, type)`, gana el de mayor score.

Detalles completos: `REC-REQ-017` (estrategia de scoring) y `REC-REQ-018` (cálculo de proximity).

---

## ARQ-005 — Clustering Heurístico en Cascada (2 Niveles)

**Decisión:** Los clusters heurísticos se generan en DOS pases ortogonales sobre el mismo dataset:

| Pase | Granularidad                                  | Umbral mínimo    | ID resultante             |
| ---- | --------------------------------------------- | ---------------- | ------------------------- |
| 1    | `(ciiu_division, municipio)` — 2 dígitos CIIU | `>= 5` empresas  | `div-{div}-{municipio}`   |
| 2    | `(ciiu_grupo, municipio)` — 3 dígitos CIIU    | `>= 10` empresas | `grp-{grupo}-{municipio}` |

**Una empresa puede pertenecer a AMBOS** (relación N:M en `cluster_members`). Esto enriquece el matching de recomendaciones — dos empresas en el mismo cluster `grp-` tienen señal más fuerte que dos en el mismo `div-`.

**¿Por qué umbrales distintos?** A nivel grupo hay más particiones posibles → si bajamos a 5 nos llenamos de microclusters inservibles. 10 es el sweet spot.

**¿Por qué no por sección (1 letra)?** Demasiado genérico — un cluster con 4000 empresas no recomienda nada útil.

**¿Por qué no por CIIU completo (4 dígitos)?** Demasiado fino — clusters de 3 empresas no tienen masa crítica.

---

## ARQ-006 — Componente Agéntico

**Decisión:** Un agente con `@Cron` corre cada 60 segundos (configurable vía `AGENT_CRON_SCHEDULE`) y orquesta:

1. **Sync** desde `CompanySource` (CSV hoy, BQ mañana) — vía port (ARQ-002).
2. **Polling incremental:** `companies WHERE updated_at > last_scan_completed_at`.
3. Si hay cambios → regenerar clusters + recomendaciones.
4. Detectar oportunidades nuevas (high-score match, value chain partner, cluster member nuevo).
5. Emitir `agent_events` consumibles por el front.

**Cero intervención humana.** Si mañana se registra una empresa nueva, en máximo 60s aparece en clusters y se generan sus recomendaciones.

---

## ARQ-007 — TDD Estricto

**Decisión:** Todo código del `brain` se escribe con TDD: **RED → GREEN → REFACTOR**.

- Test failing primero.
- Código mínimo para pasar.
- Refactor con tests verdes.

**Coverage objetivo:** `> 80%` en `src/` (excluyendo módulos NestJS thin wrappers, controllers triviales, y `database.types.ts` auto-generado).

**Tests viven en `__tests__/`**, espejo de `src/`.

**Adapters de test obligatorios:** Cada port tiene un `InMemory*` adapter para testing sin Supabase/Gemini. `StubGeminiAdapter` para tests de recommendations.

---

## ARQ-008 — Variables de Entorno: BFF Estricto

**Decisión:** Single source of truth en `/.env` (root del monorepo) con symlink por workspace. El brain valida con Zod en `env.ts`. **Crash al startup si falta una variable requerida.**

**Variables del brain:**

| Variable                     | Tipo        | Default              |
| ---------------------------- | ----------- | -------------------- |
| `PORT`                       | number      | 3001                 |
| `SUPABASE_URL`               | url         | — (requerida)        |
| `SUPABASE_SERVICE_ROLE_KEY`  | string      | — (requerida)        |
| `GEMINI_API_KEY`             | string      | — (requerida)        |
| `GEMINI_CHAT_MODEL`          | string      | `gemini-2.5-flash`   |
| `GEMINI_EMBEDDING_MODEL`     | string      | `text-embedding-004` |
| `AGENT_CRON_SCHEDULE`        | cron string | `*/60 * * * * *`     |
| `AGENT_ENABLED`              | enum        | `true`               |
| `AI_MATCH_INFERENCE_ENABLED` | enum        | `true`               |
| `DEBUG_ENABLED`              | enum        | `false`              |

---

## ARQ-009 — Logger como Port

**Decisión:** El logger es un port del shared domain. Hay dos adapters: `ConsoleLogger` (delegación a `console.*`) y `NullLogger` (Null Object pattern, silencia todo). Factory devuelve uno u otro según `DEBUG_ENABLED`.

**Regla:** `no-console: error` en ESLint. Quien necesita loggear inyecta el `Logger` port. La excepción es dentro del propio `ConsoleLogger`.

---

## ARQ-010 — Convenciones de Commits

**Decisión:** Conventional Commits enforced por commitlint (pre-commit hook). Tipos permitidos: `feat | fix | docs | style | refactor | perf | test | chore | ci | revert`.

**Reglas:**

- Subject lowercase, sin punto final, ≤ 100 chars.
- **NUNCA** "Co-Authored-By" ni atribución a IA.
- Pre-push hook corre `bun test:run` — si falla, push rechazado.

---

## Referencias

- Plan de implementación detallado: `docs/2026-04-25-brain-clustering-engine-implementation.md`
- Reto original: `docs/hackathon/README.md` y `docs/hackathon/RETO.pdf`
- Convenciones del repo: `AGENTS.md` (root del monorepo)
