# Recommendations — Delta Spec

# Change: `ai-driven-clusters`

> Delta requirements que se AGREGAN o MODIFICAN en el bounded context `recommendations`.
> Los requirements base REC-REQ-001..018 en `docs/specs/05-recommendations/requirements.md` permanecen vigentes sin modificación, salvo donde se indica explícitamente `[MODIFY]`.
>
> Resolución explícita de open questions del proposal:
>
> - OQ-1 (threshold de confidence) → resuelto en REC-REQ-NEW-001 y REC-REQ-NEW-002
> - OQ-3 (fallback hardcoded) → resuelto en REC-REQ-NEW-004 y REC-REQ-NEW-007

---

## REC-REQ-NEW-001: Port `CiiuGraphPort` — contrato del grafo CIIU

**Categoría**: must
**Cambio**: add
**Origen**: proposal AD-1

**Statement**: El sistema debe exponer un port `CiiuGraphPort` en `recommendations/domain/ports/CiiuGraphPort.ts` que abstrae el acceso al grafo CIIU↔CIIU, de modo que los consumidores (matchers y `EcosystemDiscoverer`) no dependan de `AiMatchCacheRepository` ni del detalle de persistencia.

**Scenarios**:

1. **Given** que el port está definido **When** un consumidor del bounded context `clusters` invoca `getMatchingPairs(threshold, relationTypes)` **Then** recibe un `Promise<CiiuEdge[]>` con únicamente las aristas cuyo `confidence >= threshold` y cuyo `relationType` está en `relationTypes` (si se especifica).

2. **Given** que el port está definido **When** un matcher del bounded context `recommendations` invoca `getEdgesByOrigin(ciiu, threshold)` **Then** recibe un `Promise<CiiuEdge[]>` con las aristas salientes desde ese CIIU con `confidence >= threshold`.

3. **Given** que el grafo tiene aristas con `ciiuDestino = '*'` (wildcards) **When** se invoca cualquier método del port **Then** esas aristas son excluidas del resultado (nunca se exponen como pares de community detection ni como reglas de matching).

**Forma del type `CiiuEdge`** (Value Object en `recommendations/domain/value-objects/CiiuEdge.ts`):

```
{
  ciiuOrigen: string      // código CIIU, ej. "5511"
  ciiuDestino: string     // código CIIU, ej. "9601"
  hasMatch: boolean
  relationType: RelationType | null
  confidence: number      // [0, 1]
  modelVersion: string | null  // null = legacy
}
```

**Notes**: El port debe tener implementación `SupabaseCiiuGraphRepository` (lee de `ai_match_cache`) e `InMemoryCiiuGraphRepository` (tests). El filtrado por `threshold` y `relationTypes` debe resolverse en SQL, no en memoria, para no traer 25k filas innecesariamente.

---

## REC-REQ-NEW-002: Threshold de confidence para matchers dinámicos

**Categoría**: must
**Cambio**: add
**Origen**: proposal open question OQ-1

**Statement**: El sistema debe usar umbrales de confidence diferenciados por caso de uso: `0.65` para los matchers heurísticos (`ValueChainMatcher`, `AllianceMatcher`) y `0.70` para community detection (`EcosystemDiscoverer`), expresados como constantes nombradas.

**Scenarios**:

1. **Given** que `AI_DRIVEN_RULES_ENABLED=true` y el grafo tiene una arista `(A, B, relationType='proveedor', confidence=0.66)` **When** `ValueChainMatcher` consulta el grafo **Then** esa arista se incluye como regla dinámica (0.66 ≥ 0.65).

2. **Given** que `AI_DRIVEN_RULES_ENABLED=true` y el grafo tiene una arista `(A, B, relationType='proveedor', confidence=0.64)` **When** `ValueChainMatcher` consulta el grafo **Then** esa arista NO se incluye como regla dinámica (0.64 < 0.65).

3. **Given** que `EcosystemDiscoverer` construye el grafo para label propagation **When** filtra aristas **Then** usa threshold `0.70`, excluyendo aristas con confidence < 0.70.

**Constantes**:

- `MATCHER_CONFIDENCE_THRESHOLD = 0.65` — `recommendations/domain/constants.ts` o en cada matcher
- `COMMUNITY_DETECTION_CONFIDENCE_THRESHOLD = 0.70` — `clusters/application/services/EcosystemDiscoverer.ts`

**Notes**: El threshold del explore (0.7 único) se diferencia en dos valores porque los matchers tienen fallback hardcoded que compensa imprecisión, mientras que community detection produce clusters persistidos sin otro respaldo; el umbral más alto es justificado.

---

## REC-REQ-NEW-003: `AiMatchCacheRepository` — campo `model_version`

**Categoría**: must
**Cambio**: add
**Origen**: proposal AD-4

**Statement**: El sistema debe agregar el campo `modelVersion: string | null` a `AiMatchCacheEntry` y al schema de `ai_match_cache`, para poder distinguir entradas generadas por distintas versiones del modelo LLM.

**Scenarios**:

1. **Given** que `AiMatchEngine` persiste un nuevo par CIIU **When** llama `AiMatchCacheRepository.put(entry)` **Then** la entrada es persistida con el valor de `env.GEMINI_MODEL_VERSION` en la columna `model_version`.

2. **Given** que existen entradas legacy sin `model_version` (NULL) en la BD **When** `CiiuGraphPort.getMatchingPairs(threshold)` lee el grafo **Then** las entradas con `model_version = NULL` son incluidas en el resultado sin error (se aceptan como "legacy").

3. **Given** que el equipo quiere invalidar el cache para un modelo específico **When** ejecuta un script de mantenimiento con `DELETE FROM ai_match_cache WHERE model_version = 'old-model-id'` **Then** solo se eliminan las entradas de ese modelo, conservando las de otros modelos o legacy.

**Schema change**:

- `ALTER TABLE ai_match_cache ADD COLUMN model_version TEXT NULL`
- Sin `NOT NULL`, sin `DEFAULT` — entradas legacy quedan con NULL y siguen siendo válidas

**Notes**: El campo es auditabilidad mínima. No se implementa lectura filtrada por `model_version` en este change — la lectura acepta cualquier versión. Un eventual script de limpieza puede usar la columna para invalidación selectiva.

---

## REC-REQ-NEW-004: `ValueChainMatcher` dinámico con fallback hardcoded selectivo

**Categoría**: must
**Cambio**: add
**Origen**: proposal AD-1, AD-5; open question OQ-3

**Statement**: Cuando `AI_DRIVEN_RULES_ENABLED=true`, el sistema debe hacer que `ValueChainMatcher.match()` consulte `CiiuGraphPort` para obtener reglas dinámicas con `relationType ∈ {cliente, proveedor}` y `confidence >= 0.65`, y aplique las reglas hardcoded de `VALUE_CHAIN_RULES` únicamente como fallback para pares CIIU que el grafo dinámico no cubre.

**Scenarios**:

1. **Given** que `AI_DRIVEN_RULES_ENABLED=true` y el grafo tiene arista `(5511, 9601, relationType='proveedor', confidence=0.72)` **When** `ValueChainMatcher.match()` evalúa una empresa con CIIU `5511` contra una con CIIU `9601` **Then** emite una recomendación usando la regla dinámica del grafo, NO la regla hardcoded (si existiera).

2. **Given** que `AI_DRIVEN_RULES_ENABLED=true` y el grafo NO tiene arista para el par `(4711, 1011)` **When** `ValueChainMatcher.match()` evalúa ese par **Then** aplica la regla hardcoded de `VALUE_CHAIN_RULES` si existe, como fallback.

3. **Given** que `AI_DRIVEN_RULES_ENABLED=false` **When** `ValueChainMatcher.match()` es invocado **Then** usa exclusivamente `VALUE_CHAIN_RULES` hardcoded (comportamiento idéntico al actual), sin consultar el port.

4. **Given** que `AI_DRIVEN_RULES_ENABLED=true` y el grafo está vacío (cold start) **When** `ValueChainMatcher.match()` es invocado **Then** usa `VALUE_CHAIN_RULES` hardcoded para todos los pares (fallback completo), sin error, y loguea un warning de "grafo vacío".

**Notes**: La firma de `match()` pasa de síncrona a `async`. `GenerateRecommendations.runFallback()` debe awaitar el resultado. El score se calcula con la fórmula existente de `REC-REQ-017` (`rule.weight × factor_municipio`) — la fuente de la regla (dinámica vs hardcoded) no altera la fórmula.

---

## REC-REQ-NEW-005: `AllianceMatcher` dinámico con fallback hardcoded selectivo

**Categoría**: must
**Cambio**: add
**Origen**: proposal AD-1; open question OQ-3

**Statement**: Cuando `AI_DRIVEN_RULES_ENABLED=true`, el sistema debe hacer que `AllianceMatcher.match()` consulte `CiiuGraphPort` para obtener aristas con `relationType='aliado'` y `confidence >= 0.65`, y aplique los ecosistemas hardcoded de `ECOSYSTEMS` únicamente como fallback para pares no cubiertos por el grafo.

**Scenarios**:

1. **Given** que `AI_DRIVEN_RULES_ENABLED=true` y el grafo tiene arista `(A, B, relationType='aliado', confidence=0.70)` **When** `AllianceMatcher.match()` evalúa ese par **Then** emite rec con `relationType='aliado'`, `source='ecosystem'`, usando la arista dinámica.

2. **Given** que `AI_DRIVEN_RULES_ENABLED=true` y el grafo NO tiene arista `aliado` para el par `(A, B)` **When** `AllianceMatcher.match()` evalúa ese par **Then** revisa si A y B comparten un ecosistema en `ECOSYSTEMS` hardcoded y emite rec si corresponde.

3. **Given** que `AI_DRIVEN_RULES_ENABLED=false` **When** `AllianceMatcher.match()` es invocado **Then** usa exclusivamente los `ECOSYSTEMS` hardcoded (comportamiento idéntico al actual).

**Notes**: Análogo a REC-REQ-NEW-004. La firma también pasa a `async`. Score sigue la fórmula existente: `mismo_municipio ? 0.75 : 0.55`.

---

## REC-REQ-NEW-006: Feature flag `AI_DRIVEN_RULES_ENABLED`

**Categoría**: must
**Cambio**: add
**Origen**: proposal AD-5

**Statement**: El sistema debe exponer una variable de entorno `AI_DRIVEN_RULES_ENABLED` (boolean, default `false`) validada por Zod en el schema de env del workspace `brain`, que controla si los matchers usan el grafo dinámico y si `EcosystemDiscoverer` corre.

**Scenarios**:

1. **Given** que `AI_DRIVEN_RULES_ENABLED` no está definida en el entorno **When** el proceso arranca **Then** Zod le asigna `false` por defecto, sin error de validación.

2. **Given** que `AI_DRIVEN_RULES_ENABLED=false` **When** `GenerateClusters` corre **Then** el paso de `EcosystemDiscoverer` es completamente omitido (skip silencioso, sin error), y el output reporta `ecosystemClusters: 0`.

3. **Given** que `AI_DRIVEN_RULES_ENABLED=true` **When** el proceso lee la env var **Then** los tres consumidores (`ValueChainMatcher`, `AllianceMatcher`, `EcosystemDiscoverer`) leen del grafo dinámico con sus respectivos thresholds.

**Notes**: La variable también debe documentarse en `.env.example`. Schema Zod: `AI_DRIVEN_RULES_ENABLED: z.coerce.boolean().default(false)`.

---

## REC-REQ-NEW-007: `AiMatchCacheRepository` — método `findByMatch`

**Categoría**: must
**Cambio**: add
**Origen**: proposal explore approach A variante; AD-1

**Statement**: El sistema debe agregar el método `findByMatch(threshold: number, relationTypes?: RelationType[]): Promise<AiMatchCacheEntry[]>` al port `AiMatchCacheRepository`, que filtra en SQL las entradas con `has_match = true AND confidence >= threshold` (y opcionalmente `relation_type IN (...)`) para evitar traer el grafo completo a memoria.

**Scenarios**:

1. **Given** que el cache tiene 500 entradas con `has_match=true` y `has_match=false` **When** se invoca `findByMatch(0.65, ['proveedor'])` **Then** retorna solo las entradas donde `has_match=true AND confidence >= 0.65 AND relation_type='proveedor'`.

2. **Given** que no se pasa `relationTypes` **When** se invoca `findByMatch(0.70)` **Then** retorna entradas con `has_match=true AND confidence >= 0.70` de cualquier tipo.

**Notes**: Este método es la base que implementa `CiiuGraphPort` internamente. El filtrado ocurre en SQL (cláusula `WHERE`), no en TypeScript post-fetch.

---

## [MODIFY] REC-REQ-004 — `AiMatchCacheRepository` extendido

**Categoría**: must
**Cambio**: modify
**Origen**: REC-REQ-NEW-003, REC-REQ-NEW-007

El requirement original REC-REQ-004 define los métodos `find`, `save`, `findAll` del port `AiMatchCacheRepository`. Se añaden los siguientes cambios:

1. El método `save(entry)` (antes llamado `put`) debe aceptar el campo `modelVersion: string | null` en el objeto `AiMatchCacheEntry`.
2. Se agrega el método `findByMatch(threshold: number, relationTypes?: RelationType[]): Promise<AiMatchCacheEntry[]>` (ver REC-REQ-NEW-007).
3. `findAll()` sigue existiendo pero no es usado por los matchers dinámicos — solo por `CiiuPairEvaluator` para resumen de stats.

**Statement modificado**: El port `AiMatchCacheRepository` expone cuatro métodos: `find`, `save`, `findAll`, y el nuevo `findByMatch`. La entity `AiMatchCacheEntry` incluye el campo `modelVersion: string | null`.

---

## [MODIFY] REC-REQ-011 — `ValueChainMatcher` ahora es async (y condicionalmente dinámico)

**Categoría**: must
**Cambio**: modify
**Origen**: REC-REQ-NEW-004

El requirement original REC-REQ-011 define `ValueChainMatcher.match()` como síncrono con inyección de `ValueChainRules`. Se modifica:

**Statement modificado**: `ValueChainMatcher.match(source, candidates): Promise<Recommendation[]>` es async. Cuando `AI_DRIVEN_RULES_ENABLED=true`, inyecta `CiiuGraphPort` por DI y consulta reglas dinámicas con fallback hardcoded por par no cubierto. Cuando `AI_DRIVEN_RULES_ENABLED=false`, comportamiento es idéntico al original (reglas hardcoded únicamente). La fórmula de score `rule.weight × factor_municipio` no cambia.

---

## [MODIFY] REC-REQ-012 — `AllianceMatcher` ahora es async (y condicionalmente dinámico)

**Categoría**: must
**Cambio**: modify
**Origen**: REC-REQ-NEW-005

Análogo a la modificación de REC-REQ-011.

**Statement modificado**: `AllianceMatcher.match(source, candidates): Promise<Recommendation[]>` es async. Comportamiento condicional a `AI_DRIVEN_RULES_ENABLED`. Score formula no cambia.

---

## [MODIFY] REC-REQ-005 — `ValueChainRules` pasa a ser fallback, no fuente primaria

**Categoría**: should
**Cambio**: modify
**Origen**: proposal AD-1; OQ-3

El requirement original REC-REQ-005 define `ValueChainRules` como la fuente de verdad de reglas y ecosistemas. Con este change, su rol cambia.

**Statement modificado**: Cuando `AI_DRIVEN_RULES_ENABLED=true`, `ValueChainRules` actúa como **fallback de seguridad** para pares CIIU no cubiertos por el grafo dinámico. El módulo NO es eliminado. Los métodos `getRulesAsPromptContext()` y `getEcosystemsAsPromptContext()` mantienen su rol como hints pedagógicos en el prompt de `AiMatchEngine` (ver OQ-8 del proposal: los hints hardcoded mantienen su rol de "seed knowledge" para Gemini y NO son reemplazados por el grafo dinámico en el prompt).
