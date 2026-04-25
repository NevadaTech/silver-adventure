# 05 — Recommendations · Requirements

> **El corazón del motor inteligente.** Genera recomendaciones de relaciones entre empresas con 4 tipos de relación (`referente | cliente | proveedor | aliado`) usando AI primero (Gemini) con fallback a heurísticas.
>
> Aplica `ARQ-001`, `ARQ-003`, `ARQ-004` (AI-first matching), `ARQ-007`.

---

## Metadata de implementación

| Campo                | Valor                                                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| **Orden**            | **Phase 5**                                                                                                                                   |
| **Owner**            | 🟢 **DEV B** (track Recommendations)                                                                                                          |
| **Depende de**       | `01-shared` (GeminiPort), `02-ciiu-taxonomy`, `03-companies`                                                                                  |
| **Prerrequisito de** | `06-agent` (RunIncrementalScan invoca GenerateRecommendations)                                                                                |
| **Paralelizable**    | ✅ **SÍ — paralelo con `04-clusters`** (Dev A)                                                                                                |
| **Bloqueante**       | ❌ NO bloquea a Dev A                                                                                                                         |
| **Tasks del plan**   | Task 5.1 → 5.16                                                                                                                               |
| **Estimación**       | ~2.5 días (es el contexto MÁS DENSO: 18 archivos, AI engine + 3 fallbacks + cache + dedupe + scoring formula + proximity + lazy explanations) |

**Por qué Dev B se queda solo con esto:** son 18 archivos con la lógica más compleja del sistema (AI cache por par CIIU, fórmula de scoring, dedupe, value chain rules, ecosistemas). Necesita 100% de foco. Mientras Dev B hace esto, Dev A avanza Clusters + parte de Agent — el balance de carga queda parejo.

**Sync con Dev A:** ninguna durante esta fase. Solo se reencuentran en Phase 6.

**⚠️ Costo de la AI en primer scan:** la primera corrida llena el `ai_match_cache` con ~25k pares de CIIUs. Costo estimado con `gemini-2.5-flash`: $1-3 USD. Las siguientes corridas son casi gratis (cache hit). **Configurar `AI_MATCH_INFERENCE_ENABLED=false`** para tests E2E que no quieren tocar Gemini.

---

## REC-REQ-001 — Value Object `RelationType`

**Como** sistema
**Necesito** un tipo cerrado de los 4 tipos de relación
**Para** que el sistema falle en compile-time si se introduce un tipo nuevo no contemplado.

**Criterios:**

- VO en `domain/value-objects/RelationType.ts`.
- `RELATION_TYPES = ['referente', 'cliente', 'proveedor', 'aliado'] as const`.
- Type: `RelationType = typeof RELATION_TYPES[number]`.

---

## REC-REQ-002 — Value Object `Reason` (estructurado)

**Como** sistema
**Necesito** que las razones sean estructuradas (JSONB) y NO texto libre
**Para** que el front pueda procesar features individuales y el motor pueda razonar sobre ellas.

**Criterios:**

- VO en `domain/value-objects/Reason.ts`.
- Shape: `{ feature: string; weight: number; value?: unknown; confidence?: number }`.
- `feature` ∈ catálogo cerrado: `'mismo_ciiu_division' | 'mismo_ciiu_grupo' | 'mismo_municipio' | 'misma_etapa' | 'ai_inferred_match' | 'value_chain_rule' | 'ecosystem_match' | 'cosine_similarity'`.
- `weight` ∈ `[0, 1]`.
- `confidence` solo presente cuando `feature === 'ai_inferred_match'`.

---

## REC-REQ-003 — Entity `Recommendation`

**Como** sistema
**Necesito** una entity con factory que valide invariantes
**Para** que ninguna recomendación exista sin score, sin razones, o entre la misma empresa.

**Criterios:**

- Entity en `domain/entities/Recommendation.ts`.
- ID: `uuid` (auto-generado).
- Props:
  - `sourceCompanyId: string`
  - `targetCompanyId: string` (debe ser ≠ source)
  - `relationType: RelationType`
  - `score: number` (0..1, validado)
  - `reasons: Reason[]` (no vacío)
  - `source: 'rule' | 'cosine' | 'ecosystem' | 'ai-inferred'`
  - `explanation: string | null` (lazy enrichment vía Gemini)
  - `explanationCachedAt: Date | null`
- Constraint en BD: `unique(sourceCompanyId, targetCompanyId, relationType)`.

---

## REC-REQ-004 — Repositorios

**Como** sistema
**Necesito** dos ports separados: uno para recomendaciones generadas, otro para el cache de AI
**Para** separar concerns (recs son persistidas; cache es operacional).

**Criterios:**

- `RecommendationRepository` (`RECOMMENDATION_REPOSITORY`):
  - `findBySource(companyId: string): Promise<Recommendation[]>` (ordenado por score desc)
  - `findById(id: string): Promise<Recommendation | null>`
  - `findAll(): Promise<Recommendation[]>` (usado por agente para detectar diffs)
  - `snapshotKeys(): Promise<Set<string>>` — set de `${source}|${target}|${type}` para diff
  - `saveMany(recs: Recommendation[]): Promise<void>` (upsert)
  - `updateExplanation(id: string, text: string): Promise<void>` — lazy enrichment
- `AiMatchCacheRepository` (`AI_MATCH_CACHE_REPOSITORY`):
  - `find(ciiuOrigen: string, ciiuDestino: string): Promise<AiMatchCacheEntry | null>`
  - `save(entry: AiMatchCacheEntry): Promise<void>`
  - `findAll(): Promise<AiMatchCacheEntry[]>` (para `CandidateSelector`)
- Cada port tiene `Supabase*` e `InMemory*`.

---

## REC-REQ-005 — Registry `ValueChainRules`

**Como** sistema (input para AI prompts Y fallback)
**Necesito** un registry estático de 24 reglas de cadena de valor + 6 ecosistemas
**Para** que Gemini tenga contexto de dominio Y los matchers fallback tengan datos.

**Criterios:**

- Servicio `ValueChainRules` en `application/services/ValueChainRules.ts`.
- 24 reglas hardcoded del tipo: `{ ciiuOrigen: '4711', relationType: 'proveedor', ciiuDestino: '1011' }` (ej. supermercado ← productor de carne).
- 6 ecosistemas predefinidos: `{ id: 'agro-banano', members: ['0123', '1030', '4630'] }`.
- Métodos:
  - `getRules(): ValueChainRule[]`
  - `getEcosystems(): Ecosystem[]`
  - `getRulesAsPromptContext(): string` (formateado para Gemini)
  - `getEcosystemsAsPromptContext(): string`

---

## REC-REQ-006 — Servicio `AiMatchEngine` (MATCHER PRINCIPAL)

**Como** motor de recomendaciones
**Necesito** inferir relaciones entre dos empresas usando Gemini
**Para** generar matches semánticamente ricos sin reglas hardcoded por par.

**Criterios:**

- Servicio en `application/services/AiMatchEngine.ts`.
- Inyecta `GeminiPort` y `ValueChainRules`.
- Método: `inferMatch(ciiuOrigen: string, ciiuDestino: string): Promise<AiMatchResult>`.
- `AiMatchResult`: `{ hasMatch: boolean; relationType: RelationType | null; confidence: number; reason: string }`.
- Prompt incluye:
  - Reglas de cadena de valor como contexto
  - Ecosistemas como contexto
  - Pregunta concreta: "¿Existe una relación de negocio entre una empresa con CIIU X y una con CIIU Y?"
  - Schema Zod del output esperado
- Resultado SE CACHEA en `ai_match_cache` (REC-REQ-004) — invocaciones futuras del MISMO par CIIU leen del cache.

---

## REC-REQ-007 — Servicio `CiiuPairEvaluator`

**Como** sistema
**Necesito** un orquestador que evalúe TODOS los pares CIIU del universo y llene el cache
**Para** que el cache esté pre-calentado antes de generar recs por empresa (evita evaluar O(n²) en runtime).

**Criterios:**

- Servicio en `application/services/CiiuPairEvaluator.ts`.
- Método: `evaluateAll(): Promise<{ evaluated: number; cached: number; skipped: number }>`.
- Lógica:
  1. Listar todos los CIIUs únicos presentes en `companies`.
  2. Para cada par `(origen, destino)` con `origen != destino`:
     - Si ya está en cache → skip
     - Sino → llamar `AiMatchEngine.inferMatch(origen, destino)`, guardar en cache
- Universo: ~159 CIIUs reales × 159 = ~25k pares máximos (manejable).

---

## REC-REQ-008 — Servicio `CandidateSelector` (pre-filtrado)

**Como** sistema
**Necesito** reducir el universo de pares de empresas antes de generar recs
**Para** evitar evaluar 10k × 10k = 100M pares en runtime.

**Criterios:**

- Servicio en `application/services/CandidateSelector.ts`.
- Método: `selectCandidates(source: Company, allCompanies: Company[]): Promise<Company[]>`.
- Reglas de pre-filtrado:
  1. Excluir la propia empresa.
  2. Incluir solo empresas cuyo `(source.ciiu, candidate.ciiu)` esté en `ai_match_cache` con `hasMatch=true`.
  3. Si no hay cache aún (cold start): incluir empresas del mismo `ciiuDivision` o mismo `municipio`.

---

## REC-REQ-009 — Servicio `FeatureVectorBuilder` (utility)

**Como** servicios de fallback (`PeerMatcher`)
**Necesito** vectorizar empresas
**Para** calcular cosine similarity.

**Criterios:**

- Servicio en `application/services/FeatureVectorBuilder.ts`.
- Método: `build(company: Company): number[]`.
- Features incluidas (one-hot + numeric):
  - `ciiuDivision` (one-hot sobre las divisiones presentes)
  - `municipio` (one-hot)
  - `etapa` (one-hot sobre las 4 etapas)
  - `personal` normalizado (log scale)
  - `ingreso` normalizado

---

## REC-REQ-010 — Matcher fallback `PeerMatcher`

**Como** motor de recomendaciones cuando AI falla
**Necesito** detectar empresas similares por cosine similarity
**Para** ofrecer recomendaciones tipo `'referente'` (empresas pares).

**Criterios:**

- Servicio en `application/services/PeerMatcher.ts`.
- Método: `match(source: Company, candidates: Company[]): Recommendation[]`.
- Solo emite recs con `relationType='referente'`.
- Threshold: cosine `>= 0.7`.
- `source: 'cosine'` en la recomendación resultante.

---

## REC-REQ-011 — Matcher fallback `ValueChainMatcher`

**Como** motor de recomendaciones cuando AI falla
**Necesito** aplicar las 24 reglas hardcoded de cadena de valor
**Para** ofrecer recomendaciones tipo `'cliente'` o `'proveedor'`.

**Criterios:**

- Servicio en `application/services/ValueChainMatcher.ts`.
- Inyecta `ValueChainRules`.
- Método: `match(source: Company, candidates: Company[]): Recommendation[]`.
- Para cada regla aplicable: emite rec con `source: 'rule'`, `score=0.6`, razón con la regla aplicada.

---

## REC-REQ-012 — Matcher fallback `AllianceMatcher`

**Como** motor de recomendaciones cuando AI falla
**Necesito** mapear empresas a los 6 ecosistemas predefinidos
**Para** ofrecer recomendaciones tipo `'aliado'`.

**Criterios:**

- Servicio en `application/services/AllianceMatcher.ts`.
- Inyecta `ValueChainRules.getEcosystems()`.
- Método: `match(source: Company, candidates: Company[]): Recommendation[]`.
- Si source y candidate están en el mismo ecosistema → emite rec con `relationType='aliado'`, `source='ecosystem'`, `score=0.5`.

---

## REC-REQ-013 — Use case `GenerateRecommendations` (AI-first)

**Como** seed inicial Y agente periódico
**Necesito** orquestar la generación completa de recomendaciones
**Para** que ambos triggers usen la misma lógica AI-first con fallback.

**Criterios:**

- Use case en `application/use-cases/GenerateRecommendations.ts`.
- Lógica:
  1. **Pre-warm:** ejecutar `CiiuPairEvaluator.evaluateAll()` (llena cache si está vacío o desactualizado).
  2. Para cada empresa source:
     - `candidates = CandidateSelector.selectCandidates(source, all)`
     - Para cada candidate:
       - Si `AI_MATCH_INFERENCE_ENABLED=true` Y hay cache hit → usar cache → emitir rec con `source='ai-inferred'`
       - Sino (cache miss o AI desactivado) → correr los 3 matchers fallback en paralelo
     - Tomar top-N recs por score (default N=10)
  3. `repo.saveMany(recs)`.
- Output: `{ total: number; aiInferred: number; fallback: number }`.

---

## REC-REQ-014 — Use case `GetCompanyRecommendations`

**Como** front Ruta C
**Necesito** consultar las recomendaciones de una empresa
**Para** mostrarlas en la UI.

**Criterios:**

- Use case en `application/use-cases/GetCompanyRecommendations.ts`.
- Input: `{ companyId: string; limit?: number; type?: RelationType }`.
- Output: `{ recommendations: Recommendation[] }` ordenadas por score desc.

---

## REC-REQ-015 — Use case `ExplainRecommendation` (lazy + cached)

**Como** front Ruta C
**Necesito** que cuando el usuario haga click en una recomendación, se le muestre una explicación en lenguaje natural
**Para** justificar la sugerencia.

**Criterios:**

- Use case en `application/use-cases/ExplainRecommendation.ts`.
- Input: `{ recommendationId: string }`.
- Lógica:
  1. Si `recommendation.explanation != null` → retornarlo (cached).
  2. Sino, invocar Gemini con context (source, target, relationType, reasons) → texto natural.
  3. Persistir en `recommendations.explanation` y `explanation_cached_at`.
  4. Retornar texto.
- Output: `{ explanation: string }`.

---

## REC-REQ-016 — Endpoints HTTP

**Criterios:**

- Controller en `infrastructure/http/recommendations.controller.ts`.
- Endpoints:
  - `GET /api/recommendations/by-company/:companyId?type=...&limit=...`
  - `GET /api/recommendations/:id/explanation` → dispara `ExplainRecommendation`
  - `POST /api/recommendations/generate` → dispara `GenerateRecommendations` (admin)

---

## REC-REQ-017 — Estrategia de scoring

**Como** sistema
**Necesito** una estrategia de scoring uniforme, normalizada y explicable
**Para** que el reto se cumpla ("Score o prioridad" — sección 4 del README del reto), las recs se puedan ordenar de forma estable, y los thresholds del agente sean predecibles.

**Criterios:**

### Rango y validación

- Score normalizado en el rango cerrado `[0, 1]`.
- Validado en `Recommendation.create()` factory — tira si fuera de rango.
- Persistido como `numeric(5,4)` con `check (score >= 0 and score <= 1)` en BD.
- Índice compuesto `(source_company_id, score desc)` para que el query principal `findBySource` sea O(log n).

### Fórmula principal — AI matching (`source = 'ai-inferred'`)

```
score = ai_confidence × (0.6 + 0.4 × proximity)
```

- `ai_confidence ∈ [0, 1]`: confianza que devuelve Gemini para el par CIIU (origen, destino), persistida en `ai_match_cache`.
- `proximity ∈ [0, 1]`: refinamiento por similitud entre las dos empresas concretas (ver `REC-REQ-018`).
- **Lectura del split 60/40:**
  - El 60% del score es semántico (lo que la AI dice del par CIIU).
  - El 40% modula por proximidad (entre dos empresas con el mismo par CIIU, gana la más cercana en municipio/etapa/tamaño).
- **Garantía:** dos targets con el mismo par CIIU pero distinta proximidad SIEMPRE producen scores distintos.

### Fórmulas de fallback (cuando AI desactivado o falla)

| Matcher             | Fórmula                                                | Notas                                         |
| ------------------- | ------------------------------------------------------ | --------------------------------------------- |
| `PeerMatcher`       | `score = cosine_similarity`                            | Solo se materializa si `cosine >= 0.7`        |
| `ValueChainMatcher` | `score = rule.weight × (mismo_municipio ? 1.0 : 0.85)` | Castigo de 15% si distinto municipio          |
| `AllianceMatcher`   | `score = mismo_municipio ? 0.75 : 0.55`                | Score plano por presencia en mismo ecosistema |

### Thresholds operativos

| Constante               | Valor default | Aplicación                                                       | Configurable vía                         |
| ----------------------- | ------------- | ---------------------------------------------------------------- | ---------------------------------------- |
| `MIN_CONFIDENCE`        | `0.5`         | Filtra entradas del cache antes de materializar Recommendation   | `GenerateRecommendations.MIN_CONFIDENCE` |
| `TOP_N_PER_COMPANY`     | `10`          | Cap de recs persistidas por empresa source                       | constante en use case                    |
| `HIGH_SCORE_THRESHOLD`  | `0.75`        | Trigger del evento `new_high_score_match`                        | constante en `OpportunityDetector`       |
| `VALUE_CHAIN_THRESHOLD` | `0.65`        | Trigger del evento `new_value_chain_partner` (cliente/proveedor) | constante en `OpportunityDetector`       |
| `PEER_COSINE_THRESHOLD` | `0.7`         | Mínimo cosine para emitir rec en `PeerMatcher`                   | constante en matcher                     |

### Dedupe entre matchers

**Regla:** si AI y un fallback (o dos fallbacks distintos) generan la MISMA terna `(sourceCompanyId, targetCompanyId, relationType)`, **gana la rec con mayor `score`**.

- Implementado en `GenerateRecommendations.dedupe()` antes de persistir.
- Necesario porque el constraint BD `unique(source_company_id, target_company_id, relation_type)` rechazaría duplicados.
- En la rec ganadora, las `reasons` son SOLO las del matcher ganador (no se mergean razones de matchers distintos para evitar double-counting).

### Trazabilidad

Cada `Recommendation` debe poder responder "¿de dónde salió este score?" mirando:

- `source: 'rule' | 'cosine' | 'ecosystem' | 'ai-inferred'` → qué matcher la generó.
- `reasons: Reason[]` → features con sus `weight`s individuales (siempre ≤ score final).
- `explanation: string | null` → enriquecimiento natural lazy vía Gemini (`ExplainRecommendation` use case).

---

## REC-REQ-018 — Cálculo de `proximity` (factor de refinamiento)

**Como** componente de la fórmula de scoring de `REC-REQ-017`
**Necesito** un `proximity` normalizado en `[0, 1]` que mida qué tan cerca están dos empresas concretas
**Para** poder distinguir entre dos targets con el mismo par CIIU (la AI no puede distinguir empresas — solo CIIUs).

**Criterios:**

### Definición

```
proximity = w_municipio + w_etapa + w_tamaño
```

donde los pesos suman `1.0`:

| Feature       | Peso        | Cómo se calcula                                                                                                                           |
| ------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | --------------------------------------- |
| `w_municipio` | hasta `0.4` | `0.4` si `source.municipio === target.municipio`, sino `0.0`                                                                              |
| `w_etapa`     | hasta `0.3` | `0.3` si misma etapa, `0.15` si etapas adyacentes (nacimiento↔crecimiento, crecimiento↔consolidación, consolidación↔madurez), `0.0` si no |
| `w_tamaño`    | hasta `0.3` | Similitud log-scale de `(personal + 1) × (ingreso + 1)`. Calculado como `1 -                                                              | log(s_size) - log(t_size) | / max_log_diff`. Clampeado a `[0, 0.3]` |

### Boundaries

- `proximity = 0.0` → ninguna feature coincide (distinto municipio, distinta etapa no adyacente, tamaños muy distintos).
- `proximity = 1.0` → todo coincide (mismo municipio, misma etapa, tamaño casi idéntico).

### Implementación

- Servicio `ProximityCalculator` en `application/services/ProximityCalculator.ts`.
- Método: `calculate(source: Company, target: Company): number`.
- Puro (sin side effects, no inyecta nada).
- Reutilizado por `AiMatchEngine` (al materializar) y por `FeatureVectorBuilder` (cuando se mejore el cosine).

### Por qué este split (40/30/30)

- **Municipio (40%)** es el criterio más fuerte: una recomendación local tiene valor de negocio inmediato (visita en persona, logística baja).
- **Etapa (30%)** importa porque "cliente potencial" entre dos startups en nacimiento es muy distinto a entre una madura y una en nacimiento.
- **Tamaño (30%)** desempata: una empresa pequeña no es proveedor realista de una corporación enorme y viceversa.
