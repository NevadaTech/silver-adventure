# Proposal — AI-Driven Clusters

> Change: `ai-driven-clusters`
> Branch: `feat/brain-ai-driven-clusters`
> Workspace: `src/brain`
> Phase: proposal (decisional contract — no specs/design yet)

---

## Why

Hoy el `brain` tiene dos puntos de "conocimiento de dominio" hardcoded que limitan brutalmente cuánto puede crecer la calidad del producto: (1) `ValueChainRules.ts` con **27 reglas** `ciiuOrigen → ciiuDestino` escritas a mano por un desarrollador, y (2) **6 ecosistemas** hardcoded que el `AllianceMatcher` itera para sugerir aliados. Toda relación CIIU↔CIIU que no esté en esas listas es invisible para los matchers — perdemos cobertura. Y peor: el conocimiento real de cómo se relacionan las actividades económicas en Colombia no lo tiene el equipo, lo tiene Gemini, que ya estamos invocando en `AiMatchEngine`.

Al mismo tiempo, ya pagamos por construir `ai_match_cache`: una tabla que para cada par `(ciiu_origen, ciiu_destino)` guarda `has_match`, `relation_type`, `confidence` y `reason`. Es un **grafo CIIU↔CIIU latente** que el `CiiuPairEvaluator` populiza orgánicamente con cada corrida de `GenerateRecommendations`. Hoy ese grafo solo se usa como cache de respuestas individuales — no se cosecha, no se mina, no alimenta a los matchers heurísticos.

Esta change reusa ese grafo en dos lugares de alto impacto: (Jugada 1) el `ValueChainMatcher` y `AllianceMatcher` leen reglas/ecosistemas dinámicamente del cache, con las listas hardcoded como fallback de seguridad; (Jugada 2) un nuevo `EcosystemDiscoverer` corre community detection (label propagation) sobre el grafo y materializa clusters tipo `'heuristic-ecosistema'` — ecosistemas emergentes descubiertos a partir de relaciones reales, no decretados. El resultado de demo es contundente: pasar de 27 reglas curadas a mano a potencialmente cientos curadas por IA, y de 6 ecosistemas decretados a N ecosistemas emergentes específicos al dataset real (ej. "Ecosistema gastronómico-turístico de Santa Marta" en vez de "Turismo y hospitalidad" genérico).

---

## What changes (high-level scope)

- **Jugada 1 — ValueChainMatcher dinámico**: el matcher se vuelve async, recibe un nuevo port `CiiuGraphPort` por DI, y construye sus "reglas" leyendo del cache (`hasMatch=true AND relation_type ∈ {cliente, proveedor} AND confidence >= threshold`). El array `VALUE_CHAIN_RULES` queda como fallback in-code activo solo si el cache está vacío para un par dado.
- **Jugada 1.b — AllianceMatcher dinámico**: misma transformación con `relation_type='aliado'`. El array `ECOSYSTEMS` queda como fallback.
- **Jugada 2 — EcosystemDiscoverer**: nuevo servicio en `clusters/application/services/` que corre **label propagation** sobre el grafo CIIU del cache, identifica comunidades de tamaño 3..15, y materializa clusters de tipo `'heuristic-ecosistema'` por municipio. Reusa `ExplainCluster` para generar el título/descripción del ecosistema.
- **Wiring hexagonal**: nuevo port `CiiuGraphPort` definido en `src/brain/src/recommendations/domain/ports/CiiuGraphPort.ts`, con adapter Supabase sobre `ai_match_cache` y adapter `InMemory` para tests. `RecommendationsModule` lo exporta. `ClustersModule` importa `RecommendationsModule` para consumir el port — dependencia legítima entre bounded contexts (clusters consume conocimiento de matching).
- **Schema migration**: agregar columna `model_version text` a `ai_match_cache` para versionado por modelo de Gemini.
- **ClusterType extendido**: agregar `'heuristic-ecosistema'` al VO `ClusterType`. Agregar validación correspondiente en `Cluster.create()`.
- **Feature flag**: nueva env var `AI_DRIVEN_RULES_ENABLED` (Zod-validated en `src/brain/.../env.ts`). Default `false`. Cuando es `false`, los matchers usan exclusivamente las reglas hardcoded (comportamiento actual). Cuando es `true`, leen del grafo con fallback. Permite rollback rápido y A/B en panel admin.
- **Documentación**: actualizar `AGENTS.md` (sección de bounded contexts) con la nueva dependencia `clusters → recommendations` vía `CiiuGraphPort`.

---

## Out of scope (explícito, anti-creep)

- **NO** se cambian los pesos de scoring de recommendations (60/40 cliente/proveedor, 40/30/20/10 split por matcher).
- **NO** se agregan matchers nuevos más allá de los actuales (`SameCiiuMatcher`, `ValueChainMatcher`, `AllianceMatcher`, `AiMatchEngine`).
- **NO** se cambia el modelo de Gemini ni el prompt del `AiMatchEngine`.
- **NO** se toca el front: la API contract de `/recommendations` y `/clusters` permanece igual. El front consume clusters y recommendations sin saber si el origen es heurístico hardcoded o IA-driven.
- **NO** se migran las 27 reglas hardcoded a la BD. Siguen siendo **fallback in-code**. La BD nueva es solo la columna `model_version` en cache.
- **NO** se implementa pre-warming sincrónico del grafo. El cache crece orgánicamente con los cron de recommendations existentes.
- **NO** se reescribe `HeuristicClusterer` (sigue haciendo división×municipio y grupo×municipio). El `EcosystemDiscoverer` es un **tercer pase** ortogonal en `GenerateClusters`.
- **NO** se invalida el cache existente al activar el flag. Las entradas sin `model_version` se aceptan como "legacy" (lectura) pero las nuevas se escriben con el valor actual.
- **NO** se implementa Approach D (delegar discovery de ecosistemas a Gemini en un solo prompt) — descartado por costo y no-determinismo.
- **NO** se implementa Approach B (tabla materializada `value_chain_rules` con cron) — descartado por over-engineering para hackathon.

---

## Architectural decisions

Decisiones de arquitectura que esta proposal fija. Cada una establece un contrato que la fase de design debe respetar (puede afinar detalles, no revertir la dirección).

### AD-1 — Cross-bounded-context: `clusters` consume conocimiento de matching vía port

**Contexto.** El `EcosystemDiscoverer` (clusters bounded context) necesita leer el grafo CIIU↔CIIU que hoy vive en `ai_match_cache` (recommendations bounded context). Hexagonal prohíbe que un módulo importe la implementación de otro.

**Opciones consideradas.**

- (a) Duplicar el repo en `clusters` — viola DRY y rompe ownership conceptual.
- (b) Mover `ai_match_cache` a un módulo `shared` — rompe la idea de que el cache **es** parte del proceso de matching de recommendations.
- (c) Crear módulo `ciiu-graph` separado — over-engineering para esta cantidad de tablas.
- (d) **Exportar un port `CiiuGraphPort` desde `recommendations/domain/ports/`** y que `RecommendationsModule` lo provea. `ClustersModule` lo importa.

**Decisión.** Opción (d). El port es una **vista del grafo CIIU**, no del cache crudo. Sus métodos:

- `getMatchingPairs(threshold: number, relationTypes?: RelationType[]): Promise<CiiuEdge[]>` — para community detection (Jugada 2) y para `ValueChainMatcher` dinámico (Jugada 1).
- `getEdgesByOrigin(ciiu: string, threshold: number): Promise<CiiuEdge[]>` — para uso direccional en matchers.

**Justificación.** El port abstrae el grafo del cache; mañana el grafo podría venir de otra fuente (otra tabla materializada, otro servicio) sin cambiar a los consumidores. La dependencia `ClustersModule → RecommendationsModule` es legítima y unidireccional: clusters depende de matching, no al revés.

### AD-2 — Bootstrap del grafo: incremental, no sincrónico

**Contexto.** R1 del explore: bootstrappear el universo completo de pares (~25k) toma ~3.5h y ~$5 USD en Gemini Flash. Inaceptable como costo de demo.

**Decisión.** El grafo se construye **incrementalmente** por los cron existentes de `GenerateRecommendations`. Si en una invocación de matchers el cache está vacío (o el threshold filtra todo), los matchers caen al fallback hardcoded. El `EcosystemDiscoverer` con grafo vacío produce cero clusters de ecosistema y loguea warning. El grafo madura naturalmente con el uso del producto.

**Justificación.** Pragmática para hackathon. La calidad sube progresivamente sin costo upfront. El fallback hardcoded garantiza que el sistema nunca queda peor que hoy.

### AD-3 — Community detection: label propagation in-process

**Contexto.** Necesitamos identificar comunidades de CIIUs sobre un grafo de ~159 nodos y miles de aristas. Múltiples opciones algorítmicas.

**Opciones consideradas.**

- Louvain (modularidad-óptimo): más caro, requiere lib externa, no-determinista sin seed.
- Label propagation: simple, ~50 líneas TS, determinístico con seed estable, converge rápido en grafos pequeños.
- Connected components (union-find): muy crudo — produce comunidades degeneradas si hay un CIIU "hub" wildcard.
- Delegar a Gemini (Approach D): no-determinista, caro por run, no escala.

**Decisión.** **Label propagation in-process en TypeScript**, sin libs externas. Parámetros fijos en esta change:

- `MIN_CONFIDENCE`: 0.7 (a ratificar en design — el explore sugiere 0.7).
- `MIN_SIZE`: 3 CIIUs por comunidad.
- `MAX_SIZE`: 15 CIIUs por comunidad (split si excede).
- `MAX_ITERATIONS`: 20 (label propagation converge usualmente <10).
- **Excluir wildcards**: aristas con `ciiuDestino='*'` no entran al grafo de community detection.
- **Seed estable**: ordenar nodos por `ciiu` ascendente antes de iterar para garantizar mismo resultado entre runs con mismo cache.

**Justificación.** Determinismo y simplicidad. Es trivial de testear (input grafo → output partición). Cero dependencias nuevas. Performance trivial para 159 nodos.

### AD-4 — Versionado del cache por modelo

**Contexto.** R3 del explore. Si cambiamos de `gemini-flash` a `gemini-pro` (o viceversa), las entradas existentes del cache fueron generadas con un modelo de calidad/criterio diferente. Hoy no hay forma de distinguirlas — el sistema silenciosamente mezcla criterios.

**Decisión.** Agregar columna `model_version text NULL` a `ai_match_cache`. Nuevas entradas se escriben con el modelo actual (leído de env). Entradas legacy (NULL) se aceptan pero pueden invalidarse con script de mantenimiento. El `AiMatchCacheRepository.put()` recibe el `modelVersion` actual; el `get()` puede filtrar por versión o aceptar cualquiera (decisión por caso de uso, ratificada en design).

**Justificación.** Auditabilidad mínima. Sin esto, R3 es un riesgo silencioso permanente. El costo es una columna nullable.

### AD-5 — Feature flag `AI_DRIVEN_RULES_ENABLED`

**Contexto.** Activar lectura dinámica de reglas en producción sin un kill switch es de alto riesgo: si la calidad degrada, no hay rollback rápido salvo deploy.

**Decisión.** Nueva env var `AI_DRIVEN_RULES_ENABLED` (boolean, default `false` en dev, configurable en prod). Cuando es `false`:

- `ValueChainMatcher` usa **solo** `VALUE_CHAIN_RULES` (comportamiento idéntico al actual).
- `AllianceMatcher` usa **solo** `ECOSYSTEMS`.
- `EcosystemDiscoverer` no corre (skip silencioso en `GenerateClusters`).

Cuando es `true`:

- Los matchers leen del grafo + fallback hardcoded para pares no cubiertos.
- `EcosystemDiscoverer` corre como tercer pase.

**Justificación.** Activación gradual. Permite comparar A/B. Permite rollback inmediato sin deploy.

### AD-6 — Estabilidad de IDs de cluster de ecosistema

**Contexto.** R7 del explore. Si los ecosistemas emergen del grafo y el grafo crece, los IDs no pueden ser autoincrementales — una comunidad similar entre runs debe mapear al mismo cluster, no crear uno nuevo.

**Decisión.** ID determinístico hash-basado:

```
eco-{sha1(sorted(ciiusInCommunity)).slice(0, 8)}-{slug(municipio)}
```

Donde `sorted` es orden ascendente lexicográfico de los códigos CIIU miembros. La función slug del municipio aplica lowercase + remove diacritics + replace whitespace con `-`.

**Justificación.** Comunidades con exactamente los mismos miembros en el mismo municipio ↔ mismo ID. Si la comunidad cambia (absorbe un CIIU nuevo), el ID cambia — eso es correcto: es semánticamente otro ecosistema. El `deleteAll()` existente en `GenerateClusters` limpia membresías huérfanas.

### AD-7 — Scope: ambas jugadas en un solo change

**Contexto.** Approach E del explore propone hacer Jugada 1 primero, Jugada 2 luego.

**Decisión.** Hacer ambas en este change. Razones:

- El grafo CIIU es insumo de las dos — el wiring del port `CiiuGraphPort` se hace una vez.
- El feature flag cubre las dos: rollback es atómico.
- En contexto hackathon, dos PRs vs uno con el mismo riesgo no agrega valor.

**Justificación.** El acoplamiento de plumbing entre las dos jugadas es alto. Separarlas duplica el wiring y los tests del módulo.

---

## Impact

### Affected modules

| Módulo                                      | Cambios                                                                                                                                                                                      |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `recommendations/domain`                    | Nuevo: `ports/CiiuGraphPort.ts`, `value-objects/CiiuEdge.ts`                                                                                                                                 |
| `recommendations/application`               | `ValueChainMatcher` async + DI de `CiiuGraphPort`. `AllianceMatcher` async + DI. `CandidateSelector` consulta cache para enriquecer pares (R6 mitigation).                                   |
| `recommendations/infrastructure`            | Nuevo: `SupabaseCiiuGraphRepository.ts` (adapter sobre `ai_match_cache`). Nuevo: `InMemoryCiiuGraphRepository.ts` (tests). Update: `SupabaseAiMatchCacheRepository.ts` para `model_version`. |
| `recommendations/recommendations.module.ts` | Provee y exporta `CIIU_GRAPH_PORT`.                                                                                                                                                          |
| `clusters/domain`                           | `ClusterType` agrega `'heuristic-ecosistema'`. `Cluster.create()` valida nuevo tipo.                                                                                                         |
| `clusters/application`                      | Nuevo: `services/EcosystemDiscoverer.ts` (label propagation + materialización). `GenerateClusters` orquesta tercer pase.                                                                     |
| `clusters/clusters.module.ts`               | Importa `RecommendationsModule`, inyecta `CIIU_GRAPH_PORT` en `EcosystemDiscoverer`.                                                                                                         |
| `shared/infrastructure/env.ts`              | Nuevo Zod field: `AI_DRIVEN_RULES_ENABLED: z.coerce.boolean().default(false)`.                                                                                                               |
| Supabase schema                             | Migration: `ALTER TABLE ai_match_cache ADD COLUMN model_version text NULL`.                                                                                                                  |

### Affected tests

Estimación: **~15-25 tests nuevos**. Todos los existentes pasan sin modificación (550/550).

| Capa           | Tests nuevos esperados                                                                                                                                                                               |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain         | `CiiuEdge.test.ts` (VO), `ClusterType.test.ts` updates (nuevo tipo)                                                                                                                                  |
| Application    | `ValueChainMatcher.test.ts` (async + grafo + fallback), `AllianceMatcher.test.ts` (similar), `EcosystemDiscoverer.test.ts` (label propagation + materialization), `GenerateClusters.test.ts` updates |
| Infrastructure | `SupabaseCiiuGraphRepository.test.ts`, `InMemoryCiiuGraphRepository.test.ts`, `SupabaseAiMatchCacheRepository.test.ts` updates (model_version)                                                       |
| Integration    | `RecommendationsModule.test.ts` (nuevo provider), `ClustersModule.test.ts` (nueva dependencia)                                                                                                       |

### Affected DB

- `ai_match_cache`: nueva columna `model_version text NULL`. Sin breaking changes — todas las queries existentes siguen funcionando.
- `clusters`: el set de valores válidos en `tipo` ahora incluye `'heuristic-ecosistema'`. Si existe constraint check, ampliarla.

### Affected env

- Nueva: `AI_DRIVEN_RULES_ENABLED` (boolean, default false).
- Documentar en `.env.example`.
- Agregar al schema Zod de brain.

---

## Migration plan

Fases secuenciales. Cada fase termina verde (tests pasan, lint pasa) antes de la siguiente.

1. **Phase A — Schema migration.** Agregar `model_version` a `ai_match_cache`. Generar tipos con `bun supabase:types`. Update `SupabaseAiMatchCacheRepository` para escribir/leer la columna. Actualizar tests existentes.
2. **Phase B — Port `CiiuGraphPort` y adapters.** Definir port en `recommendations/domain/ports/`. Implementar `SupabaseCiiuGraphRepository` (lee de `ai_match_cache`) y `InMemoryCiiuGraphRepository` (test). Wire en `RecommendationsModule` exports.
3. **Phase C — `ValueChainMatcher` y `AllianceMatcher` dinámicos.** Hacer ambos async. Inyectar `CiiuGraphPort`. Lógica: leer grafo + complementar con hardcoded para pares no cubiertos. Actualizar `GenerateRecommendations` (que hoy llama matchers síncronos en `runFallback()`) para await. Tests con InMemory.
4. **Phase D — `EcosystemDiscoverer` + integración en `GenerateClusters`.** Implementar label propagation. Implementar materialización con IDs determinísticos (AD-6). Reusar `ExplainCluster` para descripciones. Agregar tercer pase en `GenerateClusters`. Tests.
5. **Phase E — Feature flag.** Agregar `AI_DRIVEN_RULES_ENABLED` al schema de env. Wire en los tres consumidores (matchers + discoverer). Default `false`. Tests para ambas ramas (flag on / flag off).
6. **Phase F — Validation y rollout.** Correr `GenerateRecommendations` y `GenerateClusters` en staging con flag `false`: verificar que comportamiento es idéntico al actual (no regresión). Activar flag en `true`: comparar outputs antes/después en muestra controlada. Activar gradualmente en prod.

---

## Open questions for spec/design phase

Cosas que la fase de spec o design tienen que resolver con detalle. La proposal fija la **dirección**, no los **detalles finos**.

1. **Threshold de confidence para reglas dinámicas.** El explore sugiere 0.7. ¿Ratificar 0.7? ¿Diferenciar threshold para community detection (Jugada 2, posiblemente más alto, ej. 0.75) vs para matchers (Jugada 1, posiblemente más bajo, ej. 0.65)? Si son distintos, sostener una constante por uso.
2. **Naming de ecosistemas descubiertos.** ¿`ExplainCluster` (Gemini) genera el título, con prompt específico para "ecosistema emergente"? ¿O fallback heurístico `"Ecosistema {top-3 CIIU titles} · {municipio}"` cuando Gemini falla / cuota agotada?
3. **Comportamiento del fallback hardcoded.** ¿Las 27 reglas/6 ecosistemas se aplican **siempre** (unión con reglas dinámicas) o **solo** cuando el cache no cubre el par? Tradeoff: unión maximiza cobertura, "solo fallback" minimiza ruido. La proposal sugiere "solo fallback por par no cubierto" pero design debe ratificar.
4. **`CandidateSelector` y reglas dinámicas.** El selector hoy usa `VALUE_CHAIN_RULES` para pre-filtrar pares cross-division. Si el grafo dinámico aporta pares cross-division nuevos, ¿el selector también consulta el grafo? Si sí, ¿con qué threshold? (R6 del explore.)
5. **Versionado: lectura mixta.** ¿El `get()` del cache acepta entradas con cualquier `model_version` (incluso NULL legacy) o filtra por la versión actual? Tradeoff: estricto pierde entradas válidas, relajado mezcla criterios. Sugerencia: aceptar cualquiera, pero exponer métrica de "% entradas con versión actual" para observabilidad.
6. **Membresías huérfanas en clusters.** El `deleteAll()` en `MembershipRepo` antes de regenerar limpia. ¿Pero el cluster en sí queda huérfano si el ecosistema desaparece entre runs? ¿Borrar clusters de tipo `heuristic-*` antes de regenerar también?
7. **Performance: tamaño del grafo.** `findAll()` puede traer ~25k filas en peor caso. ¿`getMatchingPairs(threshold)` filtra en SQL (`WHERE confidence >= $1`) o en memoria? La proposal sugiere SQL — ratificar en design.
8. **AiMatchEngine prompt hints.** Hoy el prompt de Gemini usa `VALUE_CHAIN_RULES` y `ECOSYSTEMS` como hints. ¿Cambiar a usar el grafo dinámico (top-K reglas con mayor confidence) como hints? ¿O mantener hardcoded (es el "seed knowledge" del modelo)? Sugerencia: mantener hardcoded — los hints tienen rol pedagógico, no de cobertura.

---

## References

- Explore artifact: `openspec/changes/ai-driven-clusters/explore.md`
- AGENTS.md (canonical): `/AGENTS.md`
- Brain workspace: `src/brain/`
- Affected files (lista canónica): ver tabla "Archivos clave" del explore.
