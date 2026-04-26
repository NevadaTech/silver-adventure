# Agent — Delta Spec

# Change: `ai-driven-clusters`

> Delta requirements que se AGREGAN en el bounded context `agent` (cron / `RunIncrementalScan`).
> El cron del agente alimenta `ai_match_cache` orgánicamente invocando `GenerateRecommendations` — sin modificaciones estructurales al agente, pero con impacto observable en la calidad del grafo CIIU a lo largo del tiempo.

---

## AGT-REQ-NEW-001: El cron del agente alimenta `ai_match_cache` con `model_version`

**Categoría**: must
**Cambio**: add
**Origen**: proposal AD-2 (bootstrap incremental); REC-REQ-NEW-003

**Statement**: Cada ejecución del cron `RunIncrementalScan` que invoca `GenerateRecommendations` (y por ende `CiiuPairEvaluator`) debe escribir las entradas nuevas de `ai_match_cache` con el campo `model_version` poblado con el identificador del modelo Gemini activo, de modo que el grafo CIIU crezca con trazabilidad de origen por modelo.

**Scenarios**:

1. **Given** que el cron del agente corre y `CiiuPairEvaluator.evaluateAll()` evalúa pares CIIU nuevos **When** `AiMatchEngine.inferMatch(ciiuOrigen, ciiuDestino)` persiste el resultado **Then** la entrada en `ai_match_cache` tiene `model_version` con el valor de `env.GEMINI_MODEL_VERSION` (no NULL).

2. **Given** que existen entradas legacy en `ai_match_cache` con `model_version = NULL` **When** el cron corre y hace cache hit en esas entradas **Then** las entradas legacy NO son reescritas ni actualizadas por el cron (solo las cache misses generan entradas nuevas con model_version).

3. **Given** que `AI_DRIVEN_RULES_ENABLED=false` **When** el cron corre `GenerateClusters` **Then** el pase de `EcosystemDiscoverer` es omitido (comportamiento idéntico al actual) — el cron NO necesita cambios de configuración adicionales.

**Notes**: No se requiere modificar la lógica del scheduler del agente ni los triggers del cron. El cambio es en `AiMatchEngine` (que ya recibe la nueva firma de `AiMatchCacheRepository.save(entry)` con `modelVersion`). El campo `GEMINI_MODEL_VERSION` debe documentarse en `.env.example` como variable opcional con un valor default razonable (ej. `"gemini-2.5-flash"`).

---

## AGT-REQ-NEW-002: El grafo CIIU madura con el tiempo sin costo de bootstrap sincrónico

**Categoría**: should
**Cambio**: add
**Origen**: proposal AD-2

**Statement**: El sistema debe funcionar correctamente con un grafo CIIU vacío o parcialmente poblado, degradando graciosamente a los fallbacks hardcoded, de modo que no sea necesario un proceso de bootstrap sincrónico antes del primer deploy.

**Scenarios**:

1. **Given** que es el primer deploy y `ai_match_cache` está completamente vacía **When** el agente corre `GenerateClusters` con `AI_DRIVEN_RULES_ENABLED=true` **Then** `EcosystemDiscoverer` retorna `[]` (grafo vacío), loguea warning, y el proceso completa sin error — los clusters predefinidos y heurísticos se generan normalmente.

2. **Given** que es el primer deploy y `ai_match_cache` está completamente vacía **When** `GenerateRecommendations` corre los matchers de fallback **Then** `ValueChainMatcher` y `AllianceMatcher` usan las reglas hardcoded como si el flag estuviera en `false` (fallback completo), sin error ni degradación visible para el usuario.

3. **Given** que el agente ha corrido 10 veces y el grafo tiene 200 entradas con `has_match=true` **When** `EcosystemDiscoverer` corre **Then** puede detectar comunidades si hay suficientes aristas sobre el threshold — la calidad de ecosistemas mejora progresivamente con cada scan sin intervención manual.

**Notes**: Este requirement es una propiedad de resiliencia del sistema completo, no un cambio de código específico. Se verifica que todos los caminos de "grafo vacío" están cubiertos en los tests de `EcosystemDiscoverer` (escenario 4 de CLU-REQ-NEW-003) y en los tests de `ValueChainMatcher` y `AllianceMatcher` (escenario 4 de REC-REQ-NEW-004).
