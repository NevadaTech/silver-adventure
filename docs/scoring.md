# Sistema de scoring — Cómo le damos peso a cada recomendación

> Documento técnico-pedagógico que explica **cómo el brain calcula el score de cada recomendación, qué significa cada número, y por qué los pesos son los que son**.
>
> Este doc es la fuente única de verdad sobre scoring. La lógica que se documenta acá es **lo que el código hace de verdad** (`src/brain/src/recommendations/`), no lo que el spec ideal proponía. Donde haya divergencia con el spec original (`docs/specs/05-recommendations/requirements.md`), está marcado explícitamente al final del doc.
>
> Audiencia: jurado del hackathon, devs que tocan el motor, product managers que necesitan entender por qué tal recomendación apareció en tal puesto.

---

## 1. Qué es el score y para qué sirve

Cada recomendación que el brain emite lleva un número en `[0, 1]` llamado **`score`**.

- `score = 0.0` → no hay relación.
- `score = 1.0` → relación máxima, mismas variables alineadas perfectamente (caso teórico).
- En la práctica los scores útiles caen en `[0.5, 0.95]`. Cualquier cosa por debajo de `0.5` se filtra antes de persistir (ver §8).

El score cumple **tres funciones** en el sistema:

1. **Ordenar** — el front muestra primero las de mayor score (`findBySource` ordena desc por score).
2. **Filtrar** — los thresholds operativos (`HIGH_SCORE_THRESHOLD = 0.8`, etc.) deciden cuándo el agente Conector emite eventos.
3. **Empatar / desempatar** — cuando dos matchers generan la misma terna `(source, target, type)`, gana la de mayor score (dedupe).

El score **NO es una probabilidad bayesiana ni un porcentaje**. Es una métrica heurística normalizada que combina señal semántica (Gemini) con señal estructural (proximidad de las dos empresas). Su uso correcto es **comparativo dentro del mismo `sourceCompanyId`**, no absoluto entre empresas distintas.

---

## 2. Anatomía del score — qué hay adentro

Una recomendación se construye así:

```
score = f(matcher_que_la_generó, par_de_empresas, par_de_CIIUs)
```

El brain usa **cuatro matchers**, cada uno con su propia fórmula:

| Matcher             | Tipo de relación que emite | Fuente del score                                  | `source` field  |
| ------------------- | -------------------------- | ------------------------------------------------- | --------------- |
| `AiMatchEngine`     | cualquiera de las 4        | Gemini × proximidad de las empresas concretas     | `'ai-inferred'` |
| `PeerMatcher`       | `referente`                | Solo proximidad (mismo `ciiu_division` requerido) | `'cosine'`      |
| `ValueChainMatcher` | `cliente` / `proveedor`    | Peso de la regla × penalización por municipio     | `'rule'`        |
| `AllianceMatcher`   | `aliado`                   | Score plano según municipio                       | `'ecosystem'`   |

**El matcher principal es `AiMatchEngine`.** Los otros tres son **fallback** — corren si Gemini falla, si `AI_MATCH_INFERENCE_ENABLED=false`, o si un par CIIU no tiene cache hit.

Cada `Recommendation` además lleva:

- `reasons: Reason[]` — array JSONB **estructurado** con las features que aportaron al score (no texto libre). Cada `Reason` tiene `{ feature, weight, value?, description? }`.
- `explanation: string | null` — texto natural lazy generado por Gemini bajo demanda y cacheado.

Esto garantiza **trazabilidad total**: cualquier rec puede responder "¿de dónde salió este score?" sin abrir el código.

---

## 3. La fórmula AI — el corazón del motor

Cuando el matcher es `AiMatchEngine` (el caso del 90%+ de las recs en producción):

```
score = min(1, ai_confidence × (AI_WEIGHT + PROXIMITY_WEIGHT × proximity))

donde:
  AI_WEIGHT        = 0.6   (constante en GenerateRecommendations)
  PROXIMITY_WEIGHT = 0.4
  ai_confidence    ∈ [0, 1]   ← lo que devuelve Gemini para el par CIIU
  proximity        ∈ [0, 1]   ← qué tan cerca están las dos empresas concretas
```

Implementación: `src/brain/src/recommendations/application/use-cases/GenerateRecommendations.ts:144-147`.

### Cómo leer el split 60/40

- **El 60% del score es semántico.** Lo que Gemini "sabe" sobre el par CIIU `(origen, destino)`: ¿existe una relación de negocio?, ¿de qué tipo?, ¿con qué confianza? Eso se cachea en `ai_match_cache` por par de CIIUs y dura entre scans.
- **El 40% del score es estructural.** Modula por proximidad de las dos empresas concretas. Misma señal semántica, pero gana la empresa más cerca en municipio + etapa + tamaño.

### Por qué este split y no otro

| Si fuera... | Qué pasaría                                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------- |
| 100% AI     | Dos empresas con el mismo par CIIU empatarían siempre. La AI no puede distinguir empresas — solo CIIUs.       |
| 50/50       | El score sería mitad-mitad. Funcionaría, pero los heurísticos contaminarían demasiado al matcher principal.   |
| 80/20       | Empresas en distinta provincia con el mismo par CIIU casi empatarían. Mata el valor de "recomendación local". |
| **60/40**   | Garantiza diferenciación por proximidad sin diluir la señal semántica. **Decisión adoptada.**                 |

### Garantía formal del split

> **Dos targets con el mismo par CIIU (mismo `ai_confidence`) pero distinta `proximity` siempre producen scores distintos.**

Demostración rápida con `ai_confidence = 0.8`:

```
target A en mismo municipio, misma etapa, tamaño parecido → proximity ≈ 0.95
  score_A = 0.8 × (0.6 + 0.4 × 0.95) = 0.8 × 0.98  = 0.784

target B en municipio distinto, etapa distinta, tamaño distinto → proximity ≈ 0.05
  score_B = 0.8 × (0.6 + 0.4 × 0.05) = 0.8 × 0.62  = 0.496

Δ = 0.288 → A va MUY arriba en la lista, B se descarta por MIN_CONFIDENCE.
```

---

## 4. Cómo se calcula `proximity` (el 40% estructural)

`proximity` es un número en `[0, 1]` que mide qué tan parecidas son **dos empresas concretas** (no dos CIIUs). Lo calcula `FeatureVectorBuilder.proximity(a, b)` en `src/brain/src/recommendations/application/services/FeatureVectorBuilder.ts:32-39`.

### Fórmula real (lo que el código hace hoy)

```
proximity = w_municipio + w_etapa + w_personal + w_ingreso

  w_municipio = 0.4   si  source.municipio === target.municipio
              = 0.0   si no

  w_etapa     = 0.3   si  source.etapaOrdinal === target.etapaOrdinal
              = 0.0   si no

  w_personal  = 0.2 × (1 - |personalLog_source − personalLog_target|)
              ∈ [0, 0.2]

  w_ingreso   = 0.1 × (1 - |ingresoLog_source − ingresoLog_target|)
              ∈ [0, 0.1]

proximity = min(1, w_municipio + w_etapa + w_personal + w_ingreso)
```

### Por qué los pesos son 40 / 30 / 20 / 10

| Feature       | Peso | Razón                                                                                                                                                                                                                                                            |
| ------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Municipio** | 0.4  | El criterio más fuerte. Una recomendación local tiene valor de negocio inmediato (visita en persona, logística baja, confianza por proximidad). Si el matching ignora geografía, recomendamos una lavandería de Santa Marta a un hotel de Cartagena. Inservible. |
| **Etapa**     | 0.3  | Importa porque "cliente potencial" entre dos startups en `nacimiento` es muy distinto a entre una `madurez` y una en `nacimiento`. Empareja maturity de negocio.                                                                                                 |
| **Personal**  | 0.2  | Tamaño por cantidad de empleados. Una empresa de 3 personas no es proveedor realista de una corporación de 800. Log-scale para que la diferencia entre 1 y 10 pese más que entre 100 y 200.                                                                      |
| **Ingreso**   | 0.1  | Tamaño por revenue. Reforzante de `personal`. Peso menor porque el ingreso es más volátil que la nómina.                                                                                                                                                         |

**Suma máxima = 1.0** (todos coinciden). **Suma mínima = 0.0** (todos distintos y muy lejanos).

### Detalle log-scale

`personal` e `ingreso` se normalizan en `FeatureVectorBuilder.build()`:

```typescript
const PERSONAL_LOG_MAX = log10(10_000 + 1)        // ≈ 4.0
const INGRESO_LOG_MAX  = log10(10_000_000_000 + 1) // ≈ 10.0

personalLog = log10(personal + 1) / PERSONAL_LOG_MAX  → [0, 1]
ingresoLog  = log10(ingreso + 1)  / INGRESO_LOG_MAX   → [0, 1]
```

Después se compara con `(1 - |a − b|)`. Dos empresas con personal idéntico → `w_personal = 0.2`. Dos empresas en extremos opuestos del rango (1 vs 10.000 empleados) → `w_personal ≈ 0`.

### Etapas

`etapaOrdinal` viene de `ETAPAS = ['nacimiento', 'crecimiento', 'consolidacion', 'madurez']`. Es un índice 1-4. Hoy la comparación es **binaria** (igual o no). Una mejora futura es dar bonus parcial a etapas adyacentes — está propuesta en el spec pero no implementada en código.

---

## 5. Las fórmulas de los fallbacks

Si Gemini falla, si `AI_MATCH_INFERENCE_ENABLED=false`, o si un par CIIU no tiene cache hit, los tres matchers heurísticos corren en paralelo.

### 5.1. `PeerMatcher` → emite `referente`

Implementación: `src/brain/src/recommendations/application/services/PeerMatcher.ts`.

**Estrategia.** Para cada `source`, busca otras empresas en la **misma `ciiu_division`** (filtro previo barato), calcula `proximity()` contra cada una, ordena desc, toma top-N (default 10), descarta los que dan proximity = 0.

```
score = proximity(source_vector, target_vector)
```

Usa **la misma función `proximity()`** que la AI, no cosine puro. La razón: `cosine_similarity` sobre vectores one-hot daba scores menos discriminativos que `proximity()`. El nombre del campo `source: 'cosine'` quedó por compatibilidad con el spec original.

**Razones que se agregan:**

| Cuando…                                                             | Reason emitida                 | weight |
| ------------------------------------------------------------------- | ------------------------------ | ------ |
| `source.ciiu === target.ciiu`                                       | `mismo_ciiu_clase` (4 dígitos) | 0.4    |
| `source.ciiuDivision === target.ciiuDivision` (pero distinta clase) | `mismo_ciiu_division`          | 0.25   |
| `source.municipio === target.municipio`                             | `mismo_municipio`              | 0.3    |
| `source.etapa === target.etapa`                                     | `misma_etapa`                  | 0.2    |

**Importante:** los `weight` de las `reasons` son **descriptivos** (cuánto contribuye cada feature a la justificación), no se suman para formar el score. El score viene SOLO de `proximity()`.

### 5.2. `ValueChainMatcher` → emite `cliente` y `proveedor`

Implementación: `src/brain/src/recommendations/application/services/ValueChainMatcher.ts`.

**Reglas dinámicas (flag `AI_DRIVEN_RULES_ENABLED=true`).** Cuando la feature flag está activa, el matcher delega en `DynamicValueChainRules` que consulta `ai_match_cache` (vía `CiiuGraphPort`) y extrae aristas con `hasMatch=true AND confidence >= 0.65`. Las reglas dinámicas cubren pares del grafo; las 27 reglas hardcoded actúan como fallback selectivo para pares NO cubiertos por el grafo. Con `AI_DRIVEN_RULES_ENABLED=false` (default), el matcher usa exclusivamente las 27 reglas hardcoded — comportamiento idéntico al anterior al change.

**Estrategia.** Recorre las **27 reglas hardcoded de cadena de valor** (`VALUE_CHAIN_RULES` en `ValueChainRules.ts`). Cada regla tiene la forma:

```typescript
{
  ciiuOrigen:  '0122',
  ciiuDestino: '4631',  // o '*' (wildcard — cualquier CIIU distinto del origen)
  weight:       0.85,
  description: 'Banano hacia mayoristas de alimentos'
}
```

Para cada `(rule, source con ciiu=origen, target con ciiu=destino)`:

```
factor = 1.0   si source.municipio === target.municipio    (SAME_MUNICIPIO_BOOST)
       = 0.85  si no                                       (DIFF_MUNICIPIO_FACTOR)

score = min(1, rule.weight × factor)
```

**Emite DOS recs por par** (bidireccional):

- Una desde el origen como `'cliente'` (el destino es su cliente potencial).
- Una desde el destino como `'proveedor'` (el origen es su proveedor potencial).

Ambas con el mismo score y razones simétricas (`cadena_valor_directa` y `cadena_valor_inversa`).

### 5.3. `AllianceMatcher` → emite `aliado`

Implementación: `src/brain/src/recommendations/application/services/AllianceMatcher.ts`.

**Ecosistemas dinámicos (flag `AI_DRIVEN_RULES_ENABLED=true`).** Cuando la flag está activa, el matcher consulta el grafo con `confidence >= 0.65` filtrando aristas tipo `aliado`. Los ecosistemas dinámicos (pares de CIIUs del grafo) se concatenan con los 6 ecosistemas hardcoded. La dedupe interna del matcher por par `(a.id, b.id)` evita que se emitan recs duplicadas.

**Estrategia.** Recorre los **6 ecosistemas predefinidos** (`ECOSYSTEMS` en `ValueChainRules.ts`):

| Ecosistema                | CIIU codes incluidos                 |
| ------------------------- | ------------------------------------ |
| `turismo`                 | `5511, 5519, 5611, 5630, 4921, 6810` |
| `construccion`            | `4290, 4111, 7112, 4752, 6910, 4923` |
| `servicios-profesionales` | `6910, 7020, 7490, 7310`             |
| `agro-exportador`         | `0122, 0126, 0121, 4631, 4923`       |
| `salud`                   | `8610, 8621, 8692, 7912`             |
| `educacion`               | `8512, 8551, 8559`                   |

Para cada par de empresas en el mismo ecosistema (con CIIU distinto):

```
score = 0.75   si mismo municipio   (SAME_MUNICIPIO_SCORE)
      = 0.55   si distinto municipio  (DIFF_MUNICIPIO_SCORE)
```

**Score plano.** No depende de proximity. La señal "están en el mismo ecosistema estratégico" ya es fuerte por sí sola.

**Dedupe interno.** Un par `(a, b)` se procesa una sola vez gracias a un set de keys ordenadas (`a.id < b.id ? a|b : b|a`). Después se emiten 2 recs simétricas (a→b y b→a).

---

## 6. El pipeline completo — de fuente a persistencia

Cómo se combina todo. Esto corre dentro de `GenerateRecommendations.execute()`.

```
                    ┌──────────────────────────────────────┐
                    │   companies (estado='ACTIVO' en BD)  │
                    └────────────────┬─────────────────────┘
                                     ▼
                  ┌──────────────────────────────────────────┐
                  │   AI_MATCH_INFERENCE_ENABLED === 'true'? │
                  └────┬─────────────────────────────────┬───┘
                       ▼                                 ▼
                    SÍ ─────────────────────┐         NO
                    │                       │         │
   ┌────────────────▼───────────┐           │         ▼
   │  CandidateSelector         │           │   runFallback(companies):
   │   .selectCiiuPairs()       │           │     PeerMatcher.match
   │  → set de pares CIIU       │           │     ValueChainMatcher.match
   │    relevantes              │           │     AllianceMatcher.match
   └────────────────┬───────────┘           │
                    ▼                       │
   ┌─────────────────────────────────┐      │
   │  CiiuPairEvaluator              │      │
   │   .evaluateAll(pairs, conc=4)   │      │  Si esta orquestación
   │   → llama Gemini para cada par  │      │  EXPLOTA por cualquier
   │     con cache miss              │      │  motivo, cae al fallback
   │   → guarda en ai_match_cache    │      │  con catch (error) →
   └────────────────┬────────────────┘      │  runFallback().
                    ▼                       │
   ┌─────────────────────────────────┐      │
   │  expandFromCache(companies):    │      │
   │   filtra cache por              │      │
   │     hasMatch === true Y         │      │
   │     confidence ≥ 0.5            │      │
   │   por cada (source, target):    │      │
   │     score = ai_confidence ×     │      │
   │             (0.6 + 0.4 × prox)  │      │
   │     emite Recommendation con    │      │
   │       source: 'ai-inferred'     │      │
   └────────────────┬────────────────┘      │
                    │                       │
                    └───────────┬───────────┘
                                ▼
                  ┌─────────────────────────┐
                  │  dedupe(recsBySource)   │
                  │   key = `${target}|     │
                  │          ${relType}`    │
                  │   → gana max(score)     │
                  └────────────┬────────────┘
                               ▼
                  ┌─────────────────────────┐
                  │  limit(recsBySource)    │
                  │   TOP_PER_TYPE = 5      │
                  │   TOP_TOTAL    = 20     │
                  └────────────┬────────────┘
                               ▼
                  ┌─────────────────────────┐
                  │  recRepo.deleteAll()    │
                  │  recRepo.saveAll(...)   │
                  └─────────────────────────┘
```

### Pasos clave del pipeline

1. **Filtrado por estado.** Solo empresas `estado='ACTIVO'` participan.
2. **Selección de pares CIIU.** `CandidateSelector` reduce el universo de pares antes de gastar llamadas a Gemini.
3. **Pre-warm del cache.** `CiiuPairEvaluator.evaluateAll()` corre con `concurrency=4` (4 llamadas a Gemini en paralelo). Resultados van a `ai_match_cache`.
4. **Expansión desde cache.** Por cada par de empresas concretas, lee el cache para su par CIIU y materializa una `Recommendation` aplicando la fórmula.
5. **Inversión de relación.** Si `source.ciiu > target.ciiu`, se invierte el `relationType` con `inverseRelation()` (cliente↔proveedor). Esto garantiza simetría: el cache solo guarda una dirección por par CIIU.
6. **Razón "mismo_municipio" extra.** Si las dos empresas están en el mismo municipio, se agrega una `Reason` con `weight=0.2` y `feature='mismo_municipio'`. **Es razón estructurada, no afecta el score** (el score ya pesó municipio dentro de proximity).
7. **Dedupe.** Si AI y un fallback (o dos fallbacks) generan la misma terna `(source, target, type)`, **gana la rec con mayor score**. Las `reasons` son del matcher ganador (no se mergean para evitar double-counting).
8. **Tope.** `TOP_PER_TYPE = 5` (máximo 5 por tipo de relación) y `TOP_TOTAL = 20` (máximo 20 por empresa).
9. **Persistencia.** `deleteAll()` + `saveAll()` — regeneración limpia para evitar recs huérfanas. El constraint `unique(source_company_id, target_company_id, relation_type)` en BD blinda contra duplicados.

---

## 7. Razones estructuradas — `Reason[]`

Cada recomendación lleva un array de `Reason` en JSONB. **No es texto libre.** Cada Reason es:

```typescript
{
  feature:     string         // del catálogo cerrado
  weight:      number         // [0, 1]
  value?:      unknown        // valor concreto que disparó la razón (ej. el municipio)
  description?: string         // texto corto humano-legible
  confidence?: number         // solo presente si feature === 'ai_inferido'
}
```

### Catálogo cerrado de `feature`

| Feature                 | Cuándo se emite                                          | Matcher             |
| ----------------------- | -------------------------------------------------------- | ------------------- |
| `ai_inferido`           | AI infirió match con `confidence >= 0.5`                 | `AiMatchEngine`     |
| `mismo_municipio`       | `source.municipio === target.municipio` (todas las recs) | todos               |
| `mismo_ciiu_clase`      | mismo CIIU 4 dígitos                                     | `PeerMatcher`       |
| `mismo_ciiu_division`   | misma división 2 dígitos (pero distinta clase)           | `PeerMatcher`       |
| `misma_etapa`           | misma etapa de crecimiento                               | `PeerMatcher`       |
| `cadena_valor_directa`  | matchea regla con `source.ciiu === rule.ciiuOrigen`      | `ValueChainMatcher` |
| `cadena_valor_inversa`  | matchea regla con `source.ciiu === rule.ciiuDestino`     | `ValueChainMatcher` |
| `ecosistema_compartido` | ambas empresas en el mismo ecosistema                    | `AllianceMatcher`   |

### Por qué razones estructuradas y no texto libre

- **El front puede procesar features individuales** y mostrarlas como pills: `[Mismo municipio: Santa Marta] [Misma etapa: crecimiento]`.
- **El motor puede razonar sobre ellas** — agregar nuevas features no rompe el front.
- **Auditabilidad** — el jurado puede mirar el JSONB y ver exactamente qué features dispararon la rec.
- **Internacionalización** — el `description` se puede traducir o reformatear sin tocar la lógica.

---

## 8. Thresholds operativos

Constantes que controlan decisiones de filtrado, persistencia y notificación.

| Constante                          | Valor  | Dónde vive                       | Para qué                                                                                                                                                                   |
| ---------------------------------- | ------ | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MIN_CONFIDENCE`                   | `0.5`  | `GenerateRecommendations.ts:42`  | Filtra entradas del cache antes de materializar Recommendation. Por debajo → la rec no se emite.                                                                           |
| `TOP_PER_TYPE`                     | `5`    | `GenerateRecommendations.ts:43`  | Cap por tipo de relación por empresa.                                                                                                                                      |
| `TOP_TOTAL`                        | `20`   | `GenerateRecommendations.ts:44`  | Cap global por empresa.                                                                                                                                                    |
| `AI_WEIGHT`                        | `0.6`  | `GenerateRecommendations.ts:45`  | Peso semántico de la fórmula AI.                                                                                                                                           |
| `PROXIMITY_WEIGHT`                 | `0.4`  | `GenerateRecommendations.ts:46`  | Peso estructural de la fórmula AI.                                                                                                                                         |
| `SAME_MUNICIPIO_BOOST`             | `1.0`  | `ValueChainMatcher.ts:8`         | Sin penalización si mismo municipio.                                                                                                                                       |
| `DIFF_MUNICIPIO_FACTOR`            | `0.85` | `ValueChainMatcher.ts:9`         | 15% de castigo si distinto municipio.                                                                                                                                      |
| `SAME_MUNICIPIO_SCORE`             | `0.75` | `AllianceMatcher.ts:8`           | Score plano para aliados en mismo municipio.                                                                                                                               |
| `DIFF_MUNICIPIO_SCORE`             | `0.55` | `AllianceMatcher.ts:9`           | Score plano para aliados en distinto municipio.                                                                                                                            |
| `HIGH_SCORE_THRESHOLD`             | `0.8`  | `OpportunityDetector` (planeado) | Trigger del evento `new_high_score_match` del agente.                                                                                                                      |
| `MATCHER_CONFIDENCE_THRESHOLD`     | `0.65` | `DynamicValueChainRules.ts`      | Umbral mínimo para incluir aristas del grafo en reglas dinámicas de `ValueChainMatcher` y `AllianceMatcher`. Solo activo cuando `AI_DRIVEN_RULES_ENABLED=true`.            |
| `CONFIDENCE_THRESHOLD` (ecosystem) | `0.70` | `EcosystemDiscoverer.ts`         | Umbral mínimo de confianza para incluir aristas en la detección de comunidades CIIU por label propagation. Más alto que el de los matchers para reducir ruido en clusters. |

---

## 9. Trazabilidad — cómo responder "¿por qué este score?"

Tres campos persistidos en cada `Recommendation` permiten reconstruir el cálculo:

| Campo         | Qué cuenta                                                                    |
| ------------- | ----------------------------------------------------------------------------- |
| `source`      | Qué matcher la generó (`'ai-inferred' \| 'cosine' \| 'rule' \| 'ecosystem'`). |
| `reasons`     | Las features que entraron, con sus weights individuales.                      |
| `explanation` | Texto natural lazy generado por Gemini bajo demanda y cacheado.               |

### Lazy explanation

Generar 10k explicaciones por scan sería caro y la mayoría no se ven. El use case `ExplainRecommendation` corre solo cuando el usuario hace click en una rec en el front:

1. Si `recommendation.explanation != null` → devolver cached.
2. Sino → invocar Gemini con `(source, target, relationType, reasons)` → texto natural en español.
3. Persistir en `recommendations.explanation` y `explanation_cached_at`.
4. Devolver texto.

**Una explicación por rec, una sola llamada a Gemini, cacheada para siempre.** Si la rec se regenera (deleteAll + saveAll), la explicación se pierde y se regenera al primer click.

---

## 10. Tres ejemplos numéricos

### Ejemplo 1 — Caso ideal AI: dos empresas alineadas

- **Source:** Hotel boutique en `EL_RODADERO`, etapa `crecimiento`, 12 empleados, ingresos $400M.
- **Target:** Lavandería industrial en `EL_RODADERO`, etapa `crecimiento`, 8 empleados, ingresos $250M.
- **Par CIIU:** `(5511, 9601)` → Gemini dice `relationType='proveedor'`, `confidence=0.85`.

```
Cálculo de proximity:
  w_municipio  = 0.4   (mismo)
  w_etapa      = 0.3   (mismo)
  personalLog_a = log10(13)/4   ≈ 0.279
  personalLog_b = log10(9)/4    ≈ 0.239
  w_personal   = 0.2 × (1 - |0.279 - 0.239|) = 0.2 × 0.96 = 0.192
  ingresoLog_a ≈ log10(4e8)/10 ≈ 0.860
  ingresoLog_b ≈ log10(2.5e8)/10≈ 0.840
  w_ingreso    = 0.1 × (1 - |0.860 - 0.840|) = 0.1 × 0.98 = 0.098

  proximity = 0.4 + 0.3 + 0.192 + 0.098 = 0.99

Score AI:
  score = 0.85 × (0.6 + 0.4 × 0.99) = 0.85 × 0.996 = 0.8466
```

→ La lavandería aparece **MUY arriba** en la lista de proveedores del hotel.

### Ejemplo 2 — Mismo par CIIU, otra ciudad

- **Source:** Mismo hotel boutique en `EL_RODADERO`.
- **Target:** Otra lavandería industrial, en `BARRANQUILLA`, etapa `madurez`, 80 empleados, ingresos $4.000M.
- **Mismo par CIIU `(5511, 9601)`** → mismo `confidence=0.85` del cache.

```
Cálculo de proximity:
  w_municipio  = 0.0   (distinto)
  w_etapa      = 0.0   (crecimiento vs madurez)
  personalLog_a = 0.279
  personalLog_b = log10(81)/4 ≈ 0.477
  w_personal   = 0.2 × (1 - 0.198) = 0.2 × 0.802 = 0.160
  ingresoLog_a = 0.860
  ingresoLog_b = log10(4e9)/10 ≈ 0.961
  w_ingreso    = 0.1 × (1 - 0.101) = 0.0899

  proximity = 0.0 + 0.0 + 0.160 + 0.0899 = 0.250

Score AI:
  score = 0.85 × (0.6 + 0.4 × 0.250) = 0.85 × 0.700 = 0.595
```

→ Misma señal semántica, pero **0.85 vs 0.60**. La lavandería local le gana fácil al hotel boutique.

### Ejemplo 3 — Dedupe entre AI y fallback

Imaginemos que para el mismo par `(hotel, lavandería_local)`:

- **AI** emitió: `relationType='proveedor'`, `score=0.8466`, `source='ai-inferred'`.
- **ValueChainMatcher** (con la regla "5611 → 9601 weight=0.6") emitió la misma terna: `score = min(1, 0.6 × 1.0) = 0.6`, `source='rule'`.

Tras `dedupe()`:

```
key = "lavandería_id|proveedor"
  → AI:        score=0.8466
  → ValueChain: score=0.6
  → gana AI. La rec final tiene source='ai-inferred', reasons=[ai_inferido, mismo_municipio].
```

La razón estructurada del fallback se descarta — **NO se mergea** para evitar double-counting.

---

## 11. Por qué los pesos son los que son — la decisión completa

Resumen de las decisiones de diseño y por qué se tomaron:

| Decisión                                 | Valor       | Por qué                                                                                                    |
| ---------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------------------- |
| `AI_WEIGHT / PROXIMITY_WEIGHT`           | 60% / 40%   | Garantiza diferenciación por proximidad sin diluir la señal semántica de Gemini.                           |
| Proximity municipio                      | 40%         | Recomendación local = valor de negocio inmediato. Sin esto, recomendamos lavanderías en otra ciudad.       |
| Proximity etapa                          | 30%         | Empareja maturity de negocio. Una startup con una multinacional no es match realista.                      |
| Proximity tamaño (personal)              | 20%         | Emparejar tamaño en empleados. Log-scale para que la diferencia entre 1 y 10 pese más que entre 100 y 200. |
| Proximity tamaño (ingreso)               | 10%         | Reforzante de personal. Peso menor porque ingreso es más volátil.                                          |
| `MIN_CONFIDENCE`                         | 0.5         | Punto donde Gemini deja de tener señal útil — debajo de eso es ruido.                                      |
| `TOP_PER_TYPE / TOP_TOTAL`               | 5 / 20      | El front muestra 3-5 cards por tipo. Persistir más es desperdicio.                                         |
| `DIFF_MUNICIPIO_FACTOR` (rules)          | 0.85        | 15% de castigo. Suficiente para diferenciar, no tanto como para descartar la rec.                          |
| `SAME / DIFF_MUNICIPIO_SCORE` (alliance) | 0.75 / 0.55 | Por debajo del threshold de high score (0.8). Las alianzas son señal media, no alta.                       |

---

## 12. Configurabilidad y futuro

### Clusters de ecosistema (`heuristic-ecosistema`)

Cuando `AI_DRIVEN_RULES_ENABLED=true`, `GenerateClusters` corre un tercer pase usando `EcosystemDiscoverer`. Este servicio aplica **label propagation** sobre el grafo de `ai_match_cache` (aristas con `confidence >= 0.70`) para detectar comunidades de CIIUs. Por cada comunidad de ≥3 CIIUs, el servicio materializa un cluster del tipo `heuristic-ecosistema` por municipio donde haya al menos una empresa con CIIU de la comunidad. Los clusters de tipo `heuristic-ecosistema` se limpian y regeneran en cada run del agente (`deleteByType` antes del `saveMany`).

### Hoy es configurable

- `AI_MATCH_INFERENCE_ENABLED` (env): apaga Gemini, fuerza fallback total.
- `AGENT_ENABLED` (env): apaga el cron del agente (no afecta scoring, sí afecta cuándo se regenera).
- `enableAi: boolean` en input de `GenerateRecommendations.execute()`: override por llamada (útil para tests).
- `AI_DRIVEN_RULES_ENABLED` (env): activa reglas dinámicas del grafo `ai_match_cache` para matchers y cluster detection. Default `false`.

### Hoy NO es configurable (constantes hardcoded)

- Pesos de la fórmula AI (`AI_WEIGHT`, `PROXIMITY_WEIGHT`).
- Pesos de proximity (40/30/20/10).
- Thresholds (`MIN_CONFIDENCE`, `TOP_*`).
- Factores de penalización por municipio.

**Cuándo conviene exponerlas como env.** Cuando empecemos a A/B testear pesos o cuando el reto pida tuning por territorio (ej. en municipios pequeños el peso de "mismo municipio" debería ser menor porque hay menos opciones).

### Mejoras propuestas pero no implementadas

1. **Bonus parcial para etapas adyacentes** (`nacimiento↔crecimiento`, `crecimiento↔consolidacion`, `consolidacion↔madurez` → `0.15` en vez de `0.0`). Está en el spec REC-REQ-018, no en código.
2. **Boost por membresía a cluster `grp-`** (más fino que `div-`). Hoy clusters no afectan score directamente.
3. **Penalty por overconcentración** — si una empresa ya recibió 5 recs del mismo target en runs anteriores, bajar score progresivamente.
4. **Score temporal** — recs nuevas tienen un boost decay durante 7 días para que el agente las priorice como "oportunidades frescas".

---

## 13. Divergencias con el spec original

`docs/specs/05-recommendations/requirements.md` (REC-REQ-017 y REC-REQ-018) propuso un diseño que el código implementó **con tres ajustes** durante el desarrollo. Documentadas acá para que no haya confusión:

| Tema                                | Spec REC-REQ-018                                        | Código real                                                                          | Por qué se cambió                                                                                                 |
| ----------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Pesos de proximity                  | 40 / 30 / 30 (`tamaño` combinado de personal + ingreso) | 40 / 30 / 20 / 10 (separa `personal` 20 e `ingreso` 10)                              | Separar las dos señales le dio más estabilidad — el ingreso es más volátil que la nómina.                         |
| Adyacencia de etapas                | Bonus parcial 0.15 para etapas adyacentes               | Comparación binaria (igual o no)                                                     | Quedó pendiente como mejora. Ver §12.                                                                             |
| Servicio dedicado                   | `ProximityCalculator` en `application/services/`        | Implementado como método de `FeatureVectorBuilder.proximity()`                       | Reuso directo del builder evita duplicar la construcción del vector.                                              |
| `PeerMatcher` score                 | `cosine_similarity` puro, threshold ≥ 0.7               | `proximity()` (la misma de la AI). Sin threshold (se descarta solo si es 0).         | `proximity()` discrimina mejor que cosine sobre vectores one-hot. El `source: 'cosine'` quedó por compatibilidad. |
| Cantidad de reglas                  | 24 reglas hardcoded                                     | **27 reglas** + soporte para wildcard `ciiuDestino: '*'`                             | Aparecieron casos de uso adicionales durante el desarrollo.                                                       |
| Razón extra `mismo_municipio` en AI | No mencionado                                           | Se agrega como `Reason` con weight 0.2 si match (no afecta score, solo trazabilidad) | Para que el front pueda mostrar el pill "Mismo municipio" sin recalcular.                                         |

**Decisión.** El código es la fuente de verdad. El spec se actualizará en el próximo refactor para reflejar §11 de este doc.

---

## 14. Referencias

- **Implementación principal:** [`src/brain/src/recommendations/application/use-cases/GenerateRecommendations.ts`](../src/brain/src/recommendations/application/use-cases/GenerateRecommendations.ts)
- **Cálculo de proximity:** [`src/brain/src/recommendations/application/services/FeatureVectorBuilder.ts`](../src/brain/src/recommendations/application/services/FeatureVectorBuilder.ts)
- **Matchers fallback:** `PeerMatcher.ts`, `ValueChainMatcher.ts`, `AllianceMatcher.ts` en `src/brain/src/recommendations/application/services/`
- **Reglas y ecosistemas:** [`src/brain/src/recommendations/application/services/ValueChainRules.ts`](../src/brain/src/recommendations/application/services/ValueChainRules.ts)
- **Spec original:** [`docs/specs/05-recommendations/requirements.md`](specs/05-recommendations/requirements.md) (REC-REQ-017, REC-REQ-018)
- **Decisión arquitectural:** [`docs/specs/00-arquitectura.md`](specs/00-arquitectura.md) ARQ-004 (matching AI-first)
- **Doc del brain:** [`src/brain/README.md`](../src/brain/README.md) §2.3, §3
