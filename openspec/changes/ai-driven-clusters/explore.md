# Explore — ai-driven-clusters

> Fase de exploración técnica. No genera código de producción.
> Rama: `feat/brain-ai-driven-clusters`
> Fecha: 2026-04-26

---

## Resumen ejecutivo

El proyecto ya tiene toda la infraestructura necesaria para ambas jugadas: `ai_match_cache` funciona como grafo latente de relaciones CIIU↔CIIU con confidence, `AiMatchEngine`/`CiiuPairEvaluator` ya populan ese grafo en producción, y `HeuristicClusterer` + `GenerateClusters` ya tienen los puntos de extensión correctos. Lo que falta es (1) hacer que `ValueChainMatcher` y `AllianceMatcher` lean ese grafo dinámico en lugar del array y los ecosistemas hardcoded en `ValueChainRules.ts`, y (2) implementar un algoritmo de community detection sobre el grafo CIIU para generar clusters de tipo `heuristic-ecosistema`. El mayor riesgo no es técnico sino de bounded-context: `clusters` necesitaría leer de `ai_match_cache`, que hoy vive en `recommendations`. La solución correcta por hexagonal no es cruzar el import, sino exportar un puerto de query del grafo CIIU desde `recommendations` o extraer el grafo a un contexto compartido.

---

## Estado actual del código

### 1. `ValueChainRules.ts` — el problema central de la Jugada 1

**Archivo:** `src/brain/src/recommendations/application/services/ValueChainRules.ts`

27 reglas hardcoded (forma `{ ciiuOrigen, ciiuDestino, weight, description }`) y 6 ecosistemas hardcoded. Dos funciones helper: `findRulesForPair()` y `findEcosystemsContaining()`.

El array `VALUE_CHAIN_RULES` es importado por TRES consumidores:

| Consumidor               | Por qué lo importa                                         |
| ------------------------ | ---------------------------------------------------------- |
| `ValueChainMatcher.ts:4` | Itera reglas para emitir recs `cliente`/`proveedor`        |
| `AiMatchEngine.ts:14`    | Lo usa como contexto hint en el prompt de Gemini           |
| `CandidateSelector.ts:6` | Pre-filtra pares CIIU a evaluar (reduce llamadas a Gemini) |

El array `ECOSYSTEMS` también es importado por:

| Consumidor               | Por qué lo importa                          |
| ------------------------ | ------------------------------------------- |
| `AllianceMatcher.ts:4`   | Itera ecosistemas para emitir recs `aliado` |
| `AiMatchEngine.ts:14`    | Contexto hint en el prompt de Gemini        |
| `CandidateSelector.ts:6` | Pre-filtra pares CIIU del mismo ecosistema  |

### 2. `ValueChainMatcher.ts` — el fallback de cadena de valor

**Archivo:** `src/brain/src/recommendations/application/services/ValueChainMatcher.ts`

Lógica en `match(companies)`: itera `VALUE_CHAIN_RULES`, busca empresas origen/destino, aplica factor de municipio. El score es `min(1, rule.weight × factor)`. Es un matcher **síncrono** (no async) — no tiene acceso a repositorios. Es un `@Injectable()` que no recibe nada por DI excepto lo que importa estáticamente.

**Punto de extensión:** convertirlo en async e inyectarle `AiMatchCacheRepository` para leer reglas dinámicas desde el cache.

### 3. `AiMatchEngine.ts` — el motor existente

**Archivo:** `src/brain/src/recommendations/application/services/AiMatchEngine.ts`

Recibe `LlmPort` (Gemini), `AiMatchCacheRepository`, `CiiuTaxonomyRepository`. Flujo: check same-CIIU → check cache → consultar taxonomía → llamar Gemini con las reglas hardcoded como contexto → persistir resultado. Ya usa `VALUE_CHAIN_RULES` y `ECOSYSTEMS` como hints en el prompt.

**Implicación:** si las reglas hardcoded desaparecen o se vuelven dinámicas, el prompt de Gemini pierde esos hints. Requiere estrategia de fallback o de inyección de contexto distinta.

### 4. `CiiuPairEvaluator.ts` — el orquestador de batch

**Archivo:** `src/brain/src/recommendations/application/services/CiiuPairEvaluator.ts`

Recibe un `Set<string>` de pares `"a|b"`, evalúa con concurrency=4, guarda en cache. Ya tiene toda la lógica de pre-calentamiento del grafo. La tabla `ai_match_cache` crece orgánicamente con cada corrida de `GenerateRecommendations`.

### 5. `AiMatchCacheRepository` — el puerto del grafo

**Archivo:** `src/brain/src/recommendations/domain/repositories/AiMatchCacheRepository.ts`

Puerto con 4 métodos: `get`, `put`, `size`, `findAll`. El método `findAll()` devuelve **todos** los pares conocidos — es la operación que se usaría para construir el grafo CIIU.

**Tabla en BD:** `ai_match_cache(ciiu_origen, ciiu_destino, has_match, relation_type, confidence, reason, cached_at)`. PK compuesta `(ciiu_origen, ciiu_destino)`. El volumen máximo teórico es 159×159 = ~25k filas (CIIUs únicos en el dataset real).

### 6. `HeuristicClusterer.ts` — el clusterer actual

**Archivo:** `src/brain/src/clusters/application/services/HeuristicClusterer.ts`

Dos passes ortogonales: división×municipio (MIN=5) y grupo×municipio (MIN=10). Depende solo de `CiiuTaxonomyRepository` para resolver títulos. No tiene acceso a `ai_match_cache`. Es síncrono salvo por las llamadas a taxonomía.

### 7. `GenerateClusters.ts` — el use case orquestador

**Archivo:** `src/brain/src/clusters/application/use-cases/GenerateClusters.ts`

Orquesta `PredefinedClusterMatcher` + `HeuristicClusterer`, persiste clusters y membresías. Es el punto donde se agregaría un tercer paso: `EcosystemClusterer` (o similar). Ya hace `deleteAll()` en membresías antes de re-persistir — conveniente para regenerar ecosistemas.

### 8. `ClusterType` — el VO que necesita un nuevo valor

**Archivo:** `src/brain/src/clusters/domain/value-objects/ClusterType.ts`

Hoy: `['predefined', 'heuristic-division', 'heuristic-grupo', 'heuristic-municipio']`. Para la Jugada 2 se necesita agregar `'heuristic-ecosistema'`. El `Cluster.create()` factory también tiene validaciones por tipo que habría que extender.

### 9. `ClustersModule` vs `RecommendationsModule` — el problema hexagonal

**Archivos:** `src/brain/src/clusters/clusters.module.ts`, `src/brain/src/recommendations/recommendations.module.ts`

`RecommendationsModule` exporta `AI_MATCH_CACHE_REPOSITORY` entre sus exports. `ClustersModule` no importa `RecommendationsModule`. Si clusters quisiera leer directamente `AiMatchCacheRepository`, necesitaría agregar `forwardRef(() => RecommendationsModule)` al import — eso crea una dependencia cruzada entre dos bounded contexts al mismo nivel, lo cual viola hexagonal. El grafo CIIU conceptualmente no pertenece solo a `recommendations` — es conocimiento compartido.

---

## Riesgos y trade-offs identificados

### R1 — Bootstrap cost (Jugada 1 y 2)

El cache crece orgánicamente con `GenerateRecommendations`. Si en producción hay 159 CIIUs únicos, el universo de pares bidireccionales es ~25k. Con concurrency=4 y ~2s por llamada a Gemini, un bootstrap completo desde cero toma **~3.5 horas** y ~$3-5 USD (Gemini Flash). Mitigación: pre-warm selectivo basado en CIIUs realmente presentes en el dataset, que ya hace `CandidateSelector`. En la práctica serán ~500-2000 pares relevantes, no los 25k del universo total.

### R2 — Circular dependency entre bounded contexts (Jugada 2)

`clusters` necesita leer `ai_match_cache` para el community detection. Hoy ese repositorio pertenece a `recommendations`. Opciones:

- (a) Mover `ai_match_cache` a `shared` — rompe el "el conocimiento de matching vive en recommendations".
- (b) Exportar un puerto de query específico desde `recommendations` (ej. `CiiuGraphPort`) e importar `RecommendationsModule` en `ClustersModule`.
- (c) Crear un nuevo módulo `ciiu-graph` que sea owner del cache CIIU.

### R3 — Invalidación del cache al cambiar el modelo de Gemini

Si se cambia de `gemini-flash` a `gemini-pro` o viceversa, las entradas existentes en `ai_match_cache` tienen confidence/reason generadas con el modelo anterior. No hay campo `model_version` en la tabla. Mitigación: agregar columna `model_id text` al schema y al entity, permitir invalidar por modelo. Alternativamente: aceptar que el cache es "best effort" y se puede vaciar con un script de mantenimiento.

### R4 — Comunidades triviales o degeneradas (Jugada 2)

Community detection puede producir:

- **Comunidades de 1 nodo**: CIIU aislado sin relaciones con confidence ≥ threshold.
- **Comunidades gigantes**: si un CIIU como `6910` (servicios legales) tiene wildcard hacia todos, puede quedar conectado a todos los demás formando una sola mega-comunidad.
- **Inestabilidad entre runs**: si el cache crece entre corridas, las comunidades pueden cambiar, haciendo que clusters con IDs derivados del contenido aparezcan y desaparezcan.

Mitigación: threshold mínimo de miembros (ej. MIN=3 CIIUs en la comunidad) y tamaño máximo (ej. MAX=15 CIIUs). Las reglas wildcard (`ciiuDestino: '*'`) deberían excluirse del grafo de community detection.

### R5 — `VALUE_CHAIN_RULES` como hint para Gemini (Jugada 1)

Si se elimina el array hardcoded, `AiMatchEngine` pierde los hints en el prompt. Si el cache ya tiene el par evaluado, no importa (Gemini no se llama de nuevo). Pero para pares nuevos, Gemini tendría que inferir sin guía. El quality de las respuestas puede bajar levemente. Mitigación: mantener las reglas como **fallback de contexto** en el prompt (si el cache no tiene el par, se usan las reglas para enriquecer el prompt).

### R6 — `CandidateSelector` depende de `VALUE_CHAIN_RULES` para pre-filtrar

Si se eliminan las reglas, el selector queda solo con la heurística de "misma división" (2 primeros dígitos), perdiendo los pares cross-division que las reglas conocen. Mitigación: el selector debería poder consultar el cache para enriquecer su selección — pares que ya tienen `has_match=true` en cache deberían incluirse automáticamente.

### R7 — `deleteAll()` en membresías borra ecosistemas en cada run

El flujo actual de `GenerateClusters` hace `membershipRepo.deleteAll()` antes de re-generar. Los clusters de ecosistema se regenerarían en cada scan, lo cual es correcto si el grafo CIIU es estable. Si no, las membresías de ecosistema podrían fluctuar entre runs.

---

## Approaches considerados

### Approach A — Lectura directa de `ai_match_cache` para las reglas (Jugada 1)

**Descripción:** `ValueChainMatcher` se vuelve async y recibe `AiMatchCacheRepository` por DI. En `match()`, llama `findAll()` y filtra las entradas con `hasMatch=true AND confidence >= threshold` (ej. 0.65). Construye dinámicamente las "reglas" desde el cache. Las reglas hardcoded de `VALUE_CHAIN_RULES` pasan a ser el fallback si el cache está vacío.

**Pros:**

- Implementación directa y simple.
- Reutiliza exactamente la misma infraestructura existente.
- Permite que Gemini descubra relaciones que el autor no conocía.
- El fallback a reglas hardcoded es trivial.

**Cons:**

- `ValueChainMatcher` pasa a ser async — rompe la firma actual `match(): Map<...>` a `match(): Promise<Map<...>>`. Requiere actualizar `GenerateRecommendations.runFallback()` (hoy síncrono).
- Si el cache está vacío (primer run sin AI), el fallback son las 27 reglas — correcto pero hay que tenerlo documentado.
- `findAll()` trae TODO el cache (potencialmente 25k filas), incluso pares irrelevantes para las empresas activas.

**Variante:** en vez de `findAll()`, agregar un método `findByMatch(threshold): Promise<AiMatchCacheEntry[]>` al port que filtre en SQL (`WHERE has_match = true AND confidence >= $1`). Más eficiente.

### Approach B — Tabla materializada `value_chain_rules` con cron (Jugada 1)

**Descripción:** Crear una tabla nueva `value_chain_rules` en Supabase con el mismo schema que el array hardcoded (`ciiu_origen, ciiu_destino, weight, description`). Un cron o use case `MaterializeValueChainRules` lee `ai_match_cache` y escribe/actualiza la tabla. `ValueChainMatcher` lee de esa tabla en vez del array.

**Pros:**

- Separación de concerns: el proceso de "descubrimiento" de reglas está desacoplado del uso.
- La tabla de reglas es auditable, editable, versionable.
- `ValueChainMatcher` puede seguir siendo síncrono si las reglas se cargan en memoria al inicio.
- Permite que humanos editen reglas manualmente además de las generadas por IA.

**Cons:**

- Introduce una tabla más, un cron más, un use case más.
- Hay un lag entre que el cache aprende algo y que la tabla de reglas se actualiza.
- Más complejidad operacional.
- Para un hackathon, es over-engineering.

### Approach C — Community detection in-process en TypeScript (Jugada 2)

**Descripción:** Implementar un algoritmo simple de community detection (label propagation o union-find sobre grafo de confianza) directamente en TS dentro de un nuevo servicio `EcosystemClusterer`. El servicio recibe el grafo CIIU (como `CiiuGraphPort` exportado desde `recommendations`) y corre el algoritmo en memoria. Por cada comunidad con MIN_SIZE CIIUs, filtra las empresas activas que tienen esos CIIUs y crea un cluster `heuristic-ecosistema`. Llama a Gemini para generar el título/descripción del ecosistema emergente.

**Pros:**

- Sin dependencias externas (no requiere Python, graph DB, etc.).
- El algoritmo es simple y controlable (se puede tunar threshold, MIN_SIZE, MAX_SIZE).
- Fully hexagonal: el grafo se abstrae detrás de un puerto.
- Reutiliza `ExplainCluster` existente para generar la descripción.
- Label propagation converge rápido para grafos pequeños (~159 nodos).

**Cons:**

- Requiere resolver el problema de bounded-context (¿quién es el dueño del grafo CIIU?).
- Las comunidades pueden ser inestables entre runs si el cache crece.
- Un grafo con muchas aristas de alta confianza puede producir pocas comunidades grandes — necesita tuning.

### Approach D — Delegar la detección de ecosistemas a Gemini directamente (Jugada 2, alternativa)

**Descripción:** En vez de community detection algorítmica, pasar los pares CIIU con alta confianza a Gemini en un solo prompt y pedir: "agrupa estos CIIUs en ecosistemas de negocio". Gemini devuelve una lista de grupos con nombre. Luego se materializan como clusters.

**Pros:**

- Los ecosistemas resultantes son semánticamente coherentes (Gemini entiende el contexto colombiano).
- El código es trivial — es básicamente un prompt bien diseñado.
- No requiere implementar ningún algoritmo de grafos.

**Cons:**

- Si hay 159 CIIUs × 159 pares = payload gigante para el prompt.
- Difícil de hacer determinístico entre runs — Gemini puede agrupar diferente cada vez.
- Costo por cada run de `GenerateClusters`.
- No escala bien si el dataset de CIIUs crece.

### Approach E — Scope parcial: solo Jugada 1 ahora, Jugada 2 luego

**Descripción:** Implementar primero la Jugada 1 (reglas dinámicas en `ValueChainMatcher`) sin tocar `clusters`. Una vez que el grafo CIIU está maduro y estable (después de varios scans), implementar la Jugada 2.

**Pros:**

- Menor riesgo de regresión.
- La Jugada 1 tiene valor independiente y se puede demostrar en el hackathon.
- El grafo que se construye con la Jugada 1 es el insumo de la Jugada 2 — tiene sentido que crezca antes de minarlo.

**Cons:**

- Pospone el diferenciador más llamativo (ecosistemas emergentes).
- Para el hackathon, el tiempo es crítico — hacer las dos juntas puede ser más eficiente que dos ciclos separados.

---

## Recomendación

**Jugada 1:** Approach A con variante de método filtrado. Agregar `findByMatch(threshold: number): Promise<AiMatchCacheEntry[]>` al port `AiMatchCacheRepository`. Hacer `ValueChainMatcher` async. Mantener `VALUE_CHAIN_RULES` como fallback si el cache está vacío. Mismo tratamiento para `AllianceMatcher` con `ECOSYSTEMS` — leerlos desde cache con `relationType='aliado'` en vez del array hardcoded. `CandidateSelector` también debería consultar el cache de pares conocidos (`has_match=true`) para enriquecer su selección cross-division.

**Jugada 2:** Approach C (community detection in-process). Resolver el bounded-context creando un puerto `CiiuGraphPort` en `recommendations/domain/ports/` que expone `getMatchingPairs(threshold): Promise<CiiuEdge[]>`. `RecommendationsModule` exporta la implementación. `ClustersModule` importa `RecommendationsModule` (dependencia legítima: clusters consume conocimiento de matching). El nuevo `EcosystemClusterer` implementa label propagation en ~50 líneas de TS, produce comunidades CIIU → materializa clusters `heuristic-ecosistema`, llama `ExplainCluster` (ya existente) para generar descripción.

**Scope:** hacer ambas jugadas en este change. Son complementarias y el grafo CIIU es el insumo de las dos.

---

## Open questions para el usuario

1. **Threshold de confidence para Jugada 1:** ¿qué umbral de confidence de `ai_match_cache` define una "regla" suficientemente buena para reemplazar las hardcoded? ¿0.65? ¿0.7? El scoring doc menciona 0.5 como `MIN_CONFIDENCE` general, pero para reemplazar reglas explícitas conviene más alto.

2. **Compatibilidad de reglas hardcoded:** ¿las 27 reglas actuales se convierten en fallback (se usan si cache vacío) o se eliminan definitivamente? Propongo mantenerlas como fallback-seed: si el cache no tiene el par, las reglas hardcoded siguen siendo válidas.

3. **`CandidateSelector` y reglas dinámicas:** hoy filtra por reglas hardcoded. Si esas desaparecen, el selector queda menos informado. ¿Está bien que el selector también lea del cache para expandir los pares candidatos?

4. **MIN_SIZE para comunidades de ecosistema:** ¿cuántos CIIUs mínimo debe tener una comunidad para materializarse como cluster? Propongo 3 CIIUs. ¿Hay un límite máximo razonable?

5. **Estabilidad de IDs de clusters de ecosistema:** si los ecosistemas emergen del grafo dinámico, sus IDs serían derivados del contenido (ej. hash de los CIIUs miembros). Entre runs, si el grafo crece y una comunidad absorbe un CIIU nuevo, ¿el ID cambia? ¿O se prefiere un ID estable basado en el centroide/CIIU dominante?

6. **Campo `model_id` en `ai_match_cache`:** ¿queremos versionar el cache por modelo de Gemini? Si cambian de Flash a Pro, ¿se invalida todo o se acepta mezcla?

7. **`ECOSYSTEMS` en `AiMatchEngine` prompt:** cuando las reglas sean dinámicas, ¿el prompt de Gemini sigue usando las reglas hardcoded como contexto de guía, o se eliminan también del prompt?

---

## Archivos clave relevantes al change

| Archivo                                                                                       | Relevancia                                           |
| --------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `src/brain/src/recommendations/application/services/ValueChainRules.ts`                       | Fuente a reemplazar (reglas + ecosistemas hardcoded) |
| `src/brain/src/recommendations/application/services/ValueChainMatcher.ts`                     | Consumidor principal de reglas — se vuelve async     |
| `src/brain/src/recommendations/application/services/AllianceMatcher.ts`                       | Consumidor de ECOSYSTEMS — se vuelve async           |
| `src/brain/src/recommendations/application/services/AiMatchEngine.ts`                         | Usa reglas/ecosystems como hints en el prompt        |
| `src/brain/src/recommendations/application/services/CandidateSelector.ts`                     | Usa reglas/ecosystems para pre-filtrar pares         |
| `src/brain/src/recommendations/domain/repositories/AiMatchCacheRepository.ts`                 | Puerto que necesita `findByMatch(threshold)` nuevo   |
| `src/brain/src/recommendations/infrastructure/repositories/SupabaseAiMatchCacheRepository.ts` | Adapter que implementa el método nuevo               |
| `src/brain/src/clusters/application/services/HeuristicClusterer.ts`                           | Junto a un nuevo `EcosystemClusterer`                |
| `src/brain/src/clusters/application/use-cases/GenerateClusters.ts`                            | Se extiende con tercer pass de ecosistemas           |
| `src/brain/src/clusters/domain/value-objects/ClusterType.ts`                                  | Necesita nuevo valor `'heuristic-ecosistema'`        |
| `src/brain/src/clusters/domain/entities/Cluster.ts`                                           | Validación por tipo para `heuristic-ecosistema`      |
| `src/brain/src/clusters/clusters.module.ts`                                                   | Necesita importar `RecommendationsModule`            |
| `src/brain/src/recommendations/recommendations.module.ts`                                     | Necesita exportar `CiiuGraphPort`                    |
