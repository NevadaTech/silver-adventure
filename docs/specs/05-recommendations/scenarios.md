# 05 — Recommendations · Scenarios

---

## REC-SCN-001 — Factory `Recommendation.create` rechaza source == target

**Given** input con `sourceCompanyId='123'` y `targetCompanyId='123'`
**When** se invoca `Recommendation.create(input)`
**Then** lanza error indicando que source y target deben ser distintos.

---

## REC-SCN-002 — Factory `Recommendation.create` rechaza score fuera de [0, 1]

**Given** input con `score=1.5`
**When** se invoca `Recommendation.create(input)`
**Then** lanza error indicando que score debe estar entre 0 y 1.

---

## REC-SCN-003 — Factory `Recommendation.create` rechaza reasons vacío

**Given** input con `reasons=[]`
**When** se invoca `Recommendation.create(input)`
**Then** lanza error indicando que debe haber al menos una razón.

---

## REC-SCN-004 — `AiMatchEngine` cachea el resultado de Gemini

**Given** un `StubGeminiAdapter` que retorna `{ hasMatch: true, relationType: 'cliente', confidence: 0.85 }`
**And** el cache `ai_match_cache` está vacío
**When** se invoca `engine.inferMatch('4711', '1011')` por primera vez
**Then** retorna el resultado de Gemini
**And** la entrada `('4711', '1011')` queda persistida en `ai_match_cache`.
**When** se invoca `engine.inferMatch('4711', '1011')` por segunda vez
**Then** retorna el resultado del cache **sin invocar al stub** (verificable contando llamadas al stub).

---

## REC-SCN-005 — `CiiuPairEvaluator` skippea pares ya cacheados

**Given** el cache contiene 5 pares de un universo de 10
**When** se invoca `evaluator.evaluateAll()`
**Then** retorna `{ evaluated: 5, cached: 5, skipped: 5 }`
**And** Gemini fue invocado solo 5 veces (no 10).

---

## REC-SCN-006 — `CandidateSelector` excluye la propia empresa

**Given** una empresa source con `id='X'`
**And** una lista de 100 candidates incluyendo la propia
**When** se invoca `selector.selectCandidates(source, all)`
**Then** ningún candidate retornado tiene `id='X'`.

---

## REC-SCN-007 — `CandidateSelector` (cold start) usa CIIU división y municipio

**Given** el cache `ai_match_cache` está vacío
**And** una empresa source con `ciiuDivision='47'`, `municipio='SANTA MARTA'`
**When** se invoca `selector.selectCandidates(source, allCompanies)`
**Then** retorna SOLO candidates con `ciiuDivision='47'` O `municipio='SANTA MARTA'` (no toda la lista).

---

## REC-SCN-008 — `PeerMatcher` solo emite recs con relationType='referente'

**Given** una source y 5 candidates con cosine similarity > 0.7
**When** se invoca `peerMatcher.match(source, candidates)`
**Then** las 5 recomendaciones tienen `relationType === 'referente'` y `source === 'cosine'`.

---

## REC-SCN-009 — `ValueChainMatcher` aplica regla y emite rec correcta

**Given** una regla en `ValueChainRules`: `{ ciiuOrigen: '1011', relationType: 'proveedor', ciiuDestino: '4711' }`
**And** source con `ciiu='1011'` (productor de carne) y candidate con `ciiu='4711'` (supermercado)
**When** se invoca `vcMatcher.match(source, [candidate])`
**Then** retorna 1 recomendación con `relationType='proveedor'`, `source='rule'`, razón con la regla aplicada.

---

## REC-SCN-010 — `AllianceMatcher` agrupa por ecosistema

**Given** un ecosistema `{ id: 'agro-banano', members: ['0123', '1030'] }`
**And** source con `ciiu='0123'` y candidate con `ciiu='1030'`
**When** se invoca `allianceMatcher.match(source, [candidate])`
**Then** retorna 1 recomendación con `relationType='aliado'`, `source='ecosystem'`.

---

## REC-SCN-011 — `GenerateRecommendations` usa AI cuando hay cache hit

**Given** el cache contiene `(4711, 1011) → { hasMatch: true, relationType: 'proveedor', confidence: 0.9 }`
**And** una empresa source con `ciiu=4711` y candidate con `ciiu=1011`
**When** se invoca `useCase.execute({})`
**Then** la recomendación generada tiene `source='ai-inferred'` y `relationType='proveedor'`.

---

## REC-SCN-012 — `GenerateRecommendations` cae en fallback cuando AI desactivado

**Given** `env.AI_MATCH_INFERENCE_ENABLED='false'`
**When** se invoca `useCase.execute({})`
**Then** se ejecutan los 3 matchers fallback (`PeerMatcher`, `ValueChainMatcher`, `AllianceMatcher`)
**And** ninguna rec generada tiene `source='ai-inferred'`.

---

## REC-SCN-013 — `GenerateRecommendations` toma top-N por empresa

**Given** una source con 50 candidates que generan 50 recs con scores variados
**And** límite default N=10
**When** se invoca `useCase.execute({})`
**Then** se persisten exactamente 10 recs para esa source
**And** son las 10 con mayor score.

---

## REC-SCN-014 — `ExplainRecommendation` lazy: invoca Gemini si no hay cache

**Given** una rec con `explanation = null`
**When** se invoca `useCase.execute({ recommendationId })`
**Then** Gemini es invocado con el contexto de la rec
**And** el resultado se persiste en `recommendations.explanation`
**And** `explanationCachedAt` se actualiza.

---

## REC-SCN-015 — `ExplainRecommendation` cached: NO invoca Gemini si hay cache

**Given** una rec con `explanation = "Ya generada antes"` y `explanationCachedAt != null`
**When** se invoca `useCase.execute({ recommendationId })`
**Then** retorna `"Ya generada antes"` SIN invocar Gemini.

---

## REC-SCN-016 — Constraint de unicidad evita recs duplicadas

**Given** ya existe una rec `(source='A', target='B', relationType='cliente')`
**When** `saveMany` intenta insertar otra con la misma terna
**Then** el upsert actualiza la existente (no crea duplicado).

---

## REC-SCN-017 — Endpoint `GET /api/recommendations/by-company/:id` filtra por type

**Given** una empresa con 20 recs (10 cliente, 5 proveedor, 5 aliado)
**When** el cliente hace `GET /api/recommendations/by-company/123?type=proveedor`
**Then** retorna solo las 5 recs `proveedor` ordenadas por score desc.

---

## REC-SCN-018 — Proximity diferencia score entre dos targets con mismo par CIIU

**Given** un par CIIU `(4711, 1011)` cacheado con `ai_confidence = 0.85`
**And** una source en `'SANTA MARTA'`, etapa `'crecimiento'`, personal=10, ingreso=300M
**And** target A: `'SANTA MARTA'`, `'crecimiento'`, personal=12, ingreso=350M (alta proximity)
**And** target B: `'BOGOTA'`, `'madurez'`, personal=200, ingreso=10_000M (baja proximity)
**When** se invoca `GenerateRecommendations.execute({})`
**Then** la rec hacia A tiene score `≈ 0.85 × (0.6 + 0.4 × 1.0) = 0.85`
**And** la rec hacia B tiene score `≈ 0.85 × (0.6 + 0.4 × 0.0) = 0.51`
**And** la rec hacia A aparece ANTES que la rec hacia B en el orden por score desc.

---

## REC-SCN-019 — Dedupe entre AI y fallback gana mayor score

**Given** AI generó una rec `(A, B, 'cliente', score=0.72, source='ai-inferred')`
**And** `ValueChainMatcher` también generó `(A, B, 'cliente', score=0.85, source='rule')`
**When** se invoca `GenerateRecommendations.dedupe()` antes de persistir
**Then** se persiste UNA sola rec con `score=0.85` y `source='rule'`
**And** las `reasons` son las del fallback ganador (NO se mergean razones de matchers distintos).
**And** el constraint BD `unique(source, target, type)` no se viola.

---

## REC-SCN-020 — `MIN_CONFIDENCE` filtra entradas débiles del cache

**Given** el cache contiene:

- `(4711, 1011) → ai_confidence=0.4` (débil, por debajo del threshold)
- `(4711, 1030) → ai_confidence=0.7` (fuerte)
  **And** `GenerateRecommendations.MIN_CONFIDENCE = 0.5`
  **When** se invoca `useCase.execute({})` para una empresa con `ciiu=4711`
  **Then** se materializa rec hacia empresas con `ciiu=1030`
  **And** NO se materializa rec hacia empresas con `ciiu=1011` (filtrada por confidence baja).

---

## REC-SCN-021 — `PeerMatcher` no emite si cosine < threshold

**Given** una source y un candidate con cosine similarity `= 0.65` (debajo del `PEER_COSINE_THRESHOLD = 0.7`)
**When** se invoca `peerMatcher.match(source, [candidate])`
**Then** retorna `[]` (sin recs).

---

## REC-SCN-022 — `ValueChainMatcher` aplica castigo de municipio distinto

**Given** una regla `{ ciiuOrigen: '1011', relationType: 'proveedor', ciiuDestino: '4711', weight: 0.8 }`
**And** source `(ciiu='1011', municipio='SANTA MARTA')` y candidate `(ciiu='4711', municipio='CIENAGA')`
**When** se invoca `vcMatcher.match(source, [candidate])`
**Then** la rec resultante tiene `score = 0.8 × 0.85 = 0.68` (castigo del 15% por municipio distinto).
**Given** el mismo par pero ambos en `'SANTA MARTA'`
**Then** la rec resultante tiene `score = 0.8 × 1.0 = 0.80`.

---

## REC-SCN-023 — `AllianceMatcher` score plano por presencia en ecosistema

**Given** un ecosistema `{ id: 'agro-banano', members: ['0123', '1030'] }`
**And** source `(ciiu='0123', municipio='SANTA MARTA')` y candidate `(ciiu='1030', municipio='SANTA MARTA')`
**When** se invoca `allianceMatcher.match(source, [candidate])`
**Then** la rec resultante tiene `score = 0.75` (mismo municipio).
**Given** el mismo par pero municipios distintos
**Then** la rec resultante tiene `score = 0.55`.

---

## REC-SCN-024 — `ProximityCalculator` retorna 1.0 cuando todo coincide

**Given** source y target ambos en `'SANTA MARTA'`, etapa `'crecimiento'`, personal=10, ingreso=300M (tamaños casi iguales)
**When** se invoca `proximityCalculator.calculate(source, target)`
**Then** retorna un valor `>= 0.95` (cercano a 1.0; el componente de tamaño puede no ser perfecto si los números no son idénticos).

---

## REC-SCN-025 — `ProximityCalculator` retorna 0.0 cuando nada coincide

**Given** source `('SANTA MARTA', 'nacimiento', personal=2, ingreso=50M)` y target `('BOGOTA', 'madurez', personal=500, ingreso=50_000M)`
**When** se invoca `proximityCalculator.calculate(source, target)`
**Then** retorna un valor `<= 0.05` (cercano a 0; municipio distinto, etapas no adyacentes, tamaños muy distantes).

---

## REC-SCN-026 — `ProximityCalculator` da peso parcial a etapas adyacentes

**Given** source en etapa `'crecimiento'` y target en etapa `'consolidacion'` (adyacentes)
**And** ambos en mismo municipio y tamaños iguales
**When** se invoca `proximityCalculator.calculate(source, target)`
**Then** el componente etapa aporta `0.15` (mitad del peso máximo)
**And** el resultado total es aproximadamente `0.4 + 0.15 + 0.3 = 0.85`.

---

## REC-SCN-027 — `OpportunityDetector` usa `HIGH_SCORE_THRESHOLD` correctamente

**Given** una rec nueva con `score = 0.74` (debajo del threshold `0.75`)
**When** se invoca `opportunityDetector.detect(...)`
**Then** NO emite evento `new_high_score_match`.
**Given** una rec nueva con `score = 0.76`
**Then** SÍ emite el evento.
