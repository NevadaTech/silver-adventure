# Design — AI-Driven Clusters

> Change: `ai-driven-clusters`
> Workspace: `src/brain`
> Phase: design (technical design — implements proposal ADs and delta specs)
> Inputs: `proposal.md`, `specs/recommendations.delta.md`, `specs/clusters.delta.md`, `specs/agent.delta.md`, codebase as of `main`.
>
> Este diseño traduce los specs/delta y las 7 ADs del proposal en arquitectura concreta. Cualquier programador (humano o el `sdd-apply` agent) debería poder implementar sin tomar decisiones arquitecturales nuevas.

---

## 1. Overview

```
                ┌──────────────────────────────────────────────────────────┐
                │                    AGENT (cron)                          │
                │  RunIncrementalScan ──► GenerateRecommendations          │
                │                                  │                       │
                │                                  ▼                       │
                │                          CiiuPairEvaluator               │
                │                                  │ (cache miss)          │
                │                                  ▼                       │
                │                          AiMatchEngine                   │
                │                                  │ (writes w/ modelVer)  │
                │                                  ▼                       │
                │                          ai_match_cache    ◄── NEW col   │
                │                          (CIIU graph)         model_ver  │
                └──────────────────────────────────────────────────────────┘
                                                 │
                                                 │ exposed via PORT
                                                 ▼
        ┌────────────────────────┐        ┌────────────────────────┐
        │ recommendations module │        │   clusters module      │
        │                        │        │                        │
        │  ValueChainMatcher  ◄──┤        │  ┌──────────────────┐  │
        │  AllianceMatcher    ◄──┤◄───────┤  │ EcosystemDiscov. │  │
        │  CandidateSelector  ◄──┤   PORT │  │  (NEW)           │  │
        │       │                │        │  │  ├─ LabelProp.   │  │
        │       ▼                │        │  │  └─ id+title gen │  │
        │   DynamicValueChain    │        │  └──────────────────┘  │
        │   Rules (NEW helper)   │        │     │                  │
        │                        │        │     ▼                  │
        │   CiiuGraphPort   ◄────┤        │  GenerateClusters      │
        │   + Supabase adapter   │        │  (3rd pass = NEW)      │
        │   + InMemory adapter   │        │                        │
        └────────────────────────┘        └────────────────────────┘
                                                 │
                                                 ▼
                                          clusters table
                                          (heuristic-ecosistema)
```

Tres componentes nuevos: `CiiuGraphPort` (adapter al cache existente), `DynamicValueChainRules` (helper que envuelve el port y mantiene la API que los matchers consumen) y `EcosystemDiscoverer` (label propagation + materialización). Una migration aditiva (`model_version` en `ai_match_cache`). Una env var nueva (`AI_DRIVEN_RULES_ENABLED`). Los matchers existentes pasan a async pero su firma de output no cambia.

---

## 2. New types and interfaces

### 2.1 `CiiuEdge` — Value Object compartido

Ubicación: `src/brain/src/recommendations/domain/value-objects/CiiuEdge.ts`

```typescript
import type { RelationType } from '@/recommendations/domain/value-objects/RelationType'

export interface CiiuEdgeProps {
  ciiuOrigen: string
  ciiuDestino: string
  hasMatch: boolean
  relationType: RelationType | null
  confidence: number // [0,1]
  modelVersion: string | null // null = legacy
}

export class CiiuEdge {
  private constructor(private readonly props: Readonly<CiiuEdgeProps>) {
    Object.freeze(this.props)
  }

  static create(data: CiiuEdgeProps): CiiuEdge {
    if (!data.ciiuOrigen?.trim()) throw new Error('CiiuEdge.ciiuOrigen empty')
    if (!data.ciiuDestino?.trim()) throw new Error('CiiuEdge.ciiuDestino empty')
    if (data.confidence < 0 || data.confidence > 1) {
      throw new Error(`CiiuEdge.confidence out of [0,1]: ${data.confidence}`)
    }
    if (data.hasMatch && !data.relationType) {
      throw new Error('CiiuEdge.hasMatch=true requires relationType')
    }
    return new CiiuEdge({ ...data })
  }

  get ciiuOrigen(): string {
    return this.props.ciiuOrigen
  }
  get ciiuDestino(): string {
    return this.props.ciiuDestino
  }
  get hasMatch(): boolean {
    return this.props.hasMatch
  }
  get relationType(): RelationType | null {
    return this.props.relationType
  }
  get confidence(): number {
    return this.props.confidence
  }
  get modelVersion(): string | null {
    return this.props.modelVersion
  }
}
```

Property-based equality opcional vía método `equals()` si los tests lo requieren — por ahora no se necesita.

### 2.2 `CiiuGraphPort` — port del grafo (REC-REQ-NEW-001)

Ubicación: `src/brain/src/recommendations/domain/ports/CiiuGraphPort.ts`

```typescript
import type { CiiuEdge } from '@/recommendations/domain/value-objects/CiiuEdge'
import type { RelationType } from '@/recommendations/domain/value-objects/RelationType'

export const CIIU_GRAPH_PORT = Symbol('CIIU_GRAPH_PORT')

export interface CiiuGraphPort {
  /**
   * Devuelve aristas con `hasMatch=true AND confidence >= threshold`,
   * opcionalmente filtradas por `relationType`. Excluye SIEMPRE wildcards
   * (`ciiuDestino === '*'`). El filtrado ocurre en SQL para no traer 25k filas.
   */
  getMatchingPairs(
    threshold: number,
    relationTypes?: RelationType[],
  ): Promise<CiiuEdge[]>

  /**
   * Devuelve aristas salientes desde `ciiuOrigen` con
   * `hasMatch=true AND confidence >= threshold`. Sin wildcards.
   */
  getEdgesByOrigin(ciiuOrigen: string, threshold: number): Promise<CiiuEdge[]>
}
```

**Justificación del scope mínimo**: solo dos métodos consumidos por los tres clientes (`ValueChainMatcher`, `AllianceMatcher`, `EcosystemDiscoverer`). `CandidateSelector` no consume el port en este change (R6 mitigación pospuesta — ver §10).

### 2.3 `SupabaseCiiuGraphRepository` — adapter Supabase

Ubicación: `src/brain/src/recommendations/infrastructure/repositories/SupabaseCiiuGraphRepository.ts`

```typescript
@Injectable()
export class SupabaseCiiuGraphRepository implements CiiuGraphPort {
  constructor(
    @Inject(SUPABASE_CLIENT) private readonly db: BrainSupabaseClient,
  ) {}

  async getMatchingPairs(
    threshold: number,
    relationTypes?: RelationType[],
  ): Promise<CiiuEdge[]> {
    let q = this.db
      .from('ai_match_cache')
      .select(
        'ciiu_origen,ciiu_destino,has_match,relation_type,confidence,model_version',
      )
      .eq('has_match', true)
      .gte('confidence', threshold)
      .neq('ciiu_destino', '*')
    if (relationTypes && relationTypes.length > 0) {
      q = q.in('relation_type', relationTypes)
    }
    const { data, error } = await q
    if (error) throw error
    return (data ?? []).map(toCiiuEdge)
  }

  async getEdgesByOrigin(
    ciiuOrigen: string,
    threshold: number,
  ): Promise<CiiuEdge[]> {
    const { data, error } = await this.db
      .from('ai_match_cache')
      .select(
        'ciiu_origen,ciiu_destino,has_match,relation_type,confidence,model_version',
      )
      .eq('ciiu_origen', ciiuOrigen)
      .eq('has_match', true)
      .gte('confidence', threshold)
      .neq('ciiu_destino', '*')
    if (error) throw error
    return (data ?? []).map(toCiiuEdge)
  }
}
```

`toCiiuEdge(row)` valida `relation_type` con `isRelationType` (igual que `SupabaseAiMatchCacheRepository.toEntity()`).

### 2.4 `InMemoryCiiuGraphRepository` — adapter para tests

Ubicación: `src/brain/src/recommendations/infrastructure/repositories/InMemoryCiiuGraphRepository.ts`

```typescript
export class InMemoryCiiuGraphRepository implements CiiuGraphPort {
  constructor(private edges: CiiuEdge[] = []) {}

  seed(edges: CiiuEdge[]): void {
    this.edges = edges
  }

  async getMatchingPairs(
    threshold: number,
    relationTypes?: RelationType[],
  ): Promise<CiiuEdge[]> {
    return this.edges.filter(
      (e) =>
        e.hasMatch &&
        e.confidence >= threshold &&
        e.ciiuDestino !== '*' &&
        (!relationTypes ||
          relationTypes.length === 0 ||
          (e.relationType !== null && relationTypes.includes(e.relationType))),
    )
  }

  async getEdgesByOrigin(
    ciiuOrigen: string,
    threshold: number,
  ): Promise<CiiuEdge[]> {
    return this.edges.filter(
      (e) =>
        e.ciiuOrigen === ciiuOrigen &&
        e.hasMatch &&
        e.confidence >= threshold &&
        e.ciiuDestino !== '*',
    )
  }
}
```

### 2.5 `DynamicValueChainRules` — helper interno (recommendations/application)

Ubicación: `src/brain/src/recommendations/application/services/DynamicValueChainRules.ts`

Encapsula la lógica de "consultar el grafo + caer al fallback hardcoded por par no cubierto" que tanto `ValueChainMatcher` como `AllianceMatcher` necesitan. La forma de salida es **idéntica al shape que los matchers consumen hoy** (`ValueChainRule[]` y `Ecosystem[]`) — esto es lo que mantiene el blast radius mínimo.

```typescript
@Injectable()
export class DynamicValueChainRules {
  constructor(@Inject(CIIU_GRAPH_PORT) private readonly graph: CiiuGraphPort) {}

  /**
   * Reglas dinámicas + fallback hardcoded selectivo.
   * @param flagEnabled  AI_DRIVEN_RULES_ENABLED. Si false → solo hardcoded.
   * @param threshold    confidence mínima para reglas dinámicas (0.65 default)
   * @returns { rules, ecosystems } — superset usable por los matchers
   */
  async getValueChainRules(
    flagEnabled: boolean,
    threshold = MATCHER_CONFIDENCE_THRESHOLD,
  ): Promise<ValueChainRule[]> {
    if (!flagEnabled) return VALUE_CHAIN_RULES

    const dynamic = await this.graph.getMatchingPairs(threshold, [
      'cliente',
      'proveedor',
    ])
    if (dynamic.length === 0) {
      // grafo vacío → fallback completo
      return VALUE_CHAIN_RULES
    }

    // Reglas dinámicas como ValueChainRule[]: weight=confidence, description="IA: <reason o auto>"
    const dynamicRules: ValueChainRule[] = dynamic.map((e) => ({
      ciiuOrigen: e.ciiuOrigen,
      ciiuDestino: e.ciiuDestino,
      weight: e.confidence,
      description: `IA-driven (${e.relationType}, conf=${e.confidence.toFixed(2)})`,
    }))

    // Fallback HARDCODED solo para pares NO cubiertos por el grafo
    const dynamicKeys = new Set(
      dynamic.map((e) => `${e.ciiuOrigen}|${e.ciiuDestino}`),
    )
    const fallback = VALUE_CHAIN_RULES.filter(
      (r) => !dynamicKeys.has(`${r.ciiuOrigen}|${r.ciiuDestino}`),
    )

    return [...dynamicRules, ...fallback]
  }

  async getEcosystems(
    flagEnabled: boolean,
    threshold = MATCHER_CONFIDENCE_THRESHOLD,
  ): Promise<Ecosystem[]> {
    if (!flagEnabled) return ECOSYSTEMS

    const aliados = await this.graph.getMatchingPairs(threshold, ['aliado'])
    if (aliados.length === 0) return ECOSYSTEMS

    // Construir un "ecosistema dinámico" implícito por componentes conexos en aristas aliado.
    // Pragmático: cada arista (a, b) genera un mini-ecosistema {a, b}. AllianceMatcher itera
    // todos y dedupea pares con `seen`. Si dos aristas comparten un nodo, se sumarán pares
    // mutuos a través de la dedupe natural del matcher.
    const dynamicEcos: Ecosystem[] = aliados.map((e, i) => ({
      id: `ai-${i}`,
      name: `IA — ${e.ciiuOrigen}↔${e.ciiuDestino}`,
      ciiuCodes: [e.ciiuOrigen, e.ciiuDestino],
      description: `Aliados sugeridos por IA (conf=${e.confidence.toFixed(2)})`,
    }))

    // Fallback HARDCODED siempre se concatena (los ecosistemas hardcoded son
    // amplios, conviven con los dinámicos pares — la dedupe del matcher
    // por par de empresas evita doble emisión).
    return [...dynamicEcos, ...ECOSYSTEMS]
  }
}

export const MATCHER_CONFIDENCE_THRESHOLD = 0.65
```

**Decisión de diseño** (resuelve OQ-3 a nivel pragmático):

- Para `ValueChainRules`: la unión es **filtrada** — el fallback hardcoded entra solo para pares NO cubiertos por el grafo. Esto coincide literalmente con REC-REQ-NEW-004 escenarios 1 y 2.
- Para `Ecosystems`: la unión es **completa** — los ecosistemas hardcoded son listas de CIIUs amplios (no pares), y reemplazarlos parcialmente sería conceptualmente incorrecto. La dedupe del `AllianceMatcher` por par de empresas evita que se emitan recs duplicados.

### 2.6 `EcosystemDiscoverer` — service (clusters/application)

Ubicación: `src/brain/src/clusters/application/services/EcosystemDiscoverer.ts`

```typescript
export interface EcosystemDiscoveryResult {
  cluster: Cluster
  members: Company[]
}

@Injectable()
export class EcosystemDiscoverer {
  static readonly MIN_SIZE = 3
  static readonly MAX_SIZE = 15
  static readonly MAX_ITERATIONS = 20
  static readonly CONFIDENCE_THRESHOLD = 0.7

  constructor(
    @Inject(CIIU_GRAPH_PORT) private readonly graph: CiiuGraphPort,
    private readonly logger: Logger, // ← clientLogger / serverLogger según wiring
  ) {}

  async discover(companies: Company[]): Promise<EcosystemDiscoveryResult[]> {
    if (companies.length === 0) return []

    const edges = await this.graph.getMatchingPairs(
      EcosystemDiscoverer.CONFIDENCE_THRESHOLD,
    )
    if (edges.length === 0) {
      this.logger.warn(
        '[EcosystemDiscoverer] grafo vacío o sin aristas sobre threshold — sin ecosistemas detectados',
      )
      return []
    }

    const communities = labelPropagation(
      edges,
      EcosystemDiscoverer.MAX_ITERATIONS,
    )
    const filtered = communities.filter(
      (c) => c.length >= EcosystemDiscoverer.MIN_SIZE,
    )
    const split = filtered.flatMap(splitIfTooLarge)

    return materializeClusters(split, companies)
  }
}
```

`labelPropagation`, `splitIfTooLarge`, `materializeClusters` viven como funciones puras en el mismo archivo o en `LabelPropagation.ts` (split helper). Ver §4 para pseudocódigo.

---

## 3. Module wiring

### 3.1 `RecommendationsModule`

Cambios al `recommendations.module.ts`:

```typescript
providers: [
  ...,
  // NEW: adapter del grafo
  {
    provide: CIIU_GRAPH_PORT,
    useClass: SupabaseCiiuGraphRepository,
  },
  // NEW: helper que combina grafo + fallback
  DynamicValueChainRules,
  // existentes
  AiMatchEngine,
  AllianceMatcher,
  CandidateSelector,
  CiiuPairEvaluator,
  ValueChainMatcher,
  ...
],
exports: [
  ...,
  // NEW: para que ClustersModule pueda inyectarlo en EcosystemDiscoverer
  CIIU_GRAPH_PORT,
  // existentes
  AI_MATCH_CACHE_REPOSITORY,
  ValueChainMatcher,
  AllianceMatcher,
  ...
]
```

### 3.2 `ClustersModule`

Cambios al `clusters.module.ts`:

```typescript
imports: [
  CiiuTaxonomyModule,
  forwardRef(() => CompaniesModule),
  // NEW: dependencia explícita en recommendations para consumir CIIU_GRAPH_PORT
  RecommendationsModule,
],
providers: [
  ...,
  EcosystemDiscoverer, // NEW
  ...
],
```

`forwardRef` no es necesario en `RecommendationsModule` porque la dependencia es unidireccional (clusters → recommendations, no al revés).

### 3.3 Wiring del logger en `EcosystemDiscoverer`

El project usa `Logger` de NestJS (no el port hexagonal de Next.js). Inyección directa:

```typescript
constructor(@Inject(CIIU_GRAPH_PORT) private readonly graph: CiiuGraphPort) {
  this.logger = new Logger(EcosystemDiscoverer.name)
}
```

Ver `HeuristicClusterer` para el patrón.

---

## 4. Algorithm spec — Label Propagation determinístico

### 4.1 Input/output

- **Input**: `edges: CiiuEdge[]` con `confidence >= 0.70`, sin wildcards (el port ya filtra).
- **Output**: `communities: string[][]` — cada subarray es un set de CIIUs.

### 4.2 Pseudocódigo

```
function labelPropagation(edges, maxIterations):
  // 1) Construir grafo no dirigido (las aristas son consideradas bidireccionales
  //    para community detection — cliente ↔ proveedor ↔ aliado son todas relaciones)
  nodes = unique({ edges[*].ciiuOrigen, edges[*].ciiuDestino })
  adjacency = Map<ciiu, Set<ciiu>>()
  for edge in edges:
    adjacency[edge.ciiuOrigen].add(edge.ciiuDestino)
    adjacency[edge.ciiuDestino].add(edge.ciiuOrigen)

  // 2) Inicializar labels: cada nodo es su propia label
  labels = Map<ciiu, ciiu>()
  for n in nodes: labels[n] = n

  // 3) Iterar en orden DETERMINÍSTICO
  sortedNodes = sort(nodes, ascending)  // orden lexicográfico ASC

  for iter in 1..maxIterations:
    changed = false
    for node in sortedNodes:
      neighbors = adjacency[node]
      if neighbors is empty: continue
      // Contar la frecuencia de labels entre vecinos
      counts = Map<label, int>()
      for n in neighbors: counts[labels[n]]++
      // Elegir label dominante. Tie-break: orden alfabético ASC del label
      bestLabel = pickMaxFrequentTieBreakAlpha(counts)
      if labels[node] !== bestLabel:
        labels[node] = bestLabel
        changed = true
    if not changed: break  // convergencia

  // 4) Agrupar nodos por label final
  byLabel = groupBy(nodes, n => labels[n])
  return Array.from(byLabel.values())  // string[][]
```

`pickMaxFrequentTieBreakAlpha(counts)`: itera entries ordenadas por `(count DESC, label ASC)` y retorna la primera.

### 4.3 Determinismo

- Orden de iteración: `sortedNodes` ASC.
- Tie-break en frecuencia: `label ASC`.
- `MAX_ITERATIONS=20` es el cap; se rompe antes si converge (`changed=false`).

### 4.4 Split de comunidades grandes

```
function splitIfTooLarge(community):
  if community.length <= MAX_SIZE: return [community]
  sorted = sort(community, ascending)  // orden CIIU ASC
  result = []
  for i in 0..sorted.length step MAX_SIZE:
    result.push(sorted[i..i+MAX_SIZE])
  return result
```

### 4.5 Materialización a clusters

```
function materializeClusters(communities, companies):
  // groupar empresas por (ciiu, municipio)
  byCiiu = groupBy(companies, c => c.ciiu)
  result = []

  for community in communities:
    sortedCiius = sort(community, ascending)
    // Encontrar TODAS las (community × municipio) que tengan empresas
    membersByMunicipio = Map<municipio, Company[]>()
    for ciiu in community:
      for company in byCiiu[ciiu] ?? []:
        membersByMunicipio[company.municipio].push(company)

    for [municipio, members] in membersByMunicipio:
      // No exigimos MIN_SIZE de empresas — si la comunidad CIIU pasó el filtro y
      // tenemos al menos 1 empresa en el municipio, materializamos. La densidad
      // por municipio NO es un requirement explícito de los specs.
      if members.length === 0: continue
      cluster = buildCluster(sortedCiius, municipio, members.length)
      result.push({ cluster, members })

  return result
```

> **Decisión clave**: el spec CLU-REQ-NEW-003 escenario 1 dice "7 empresas en esos CIIUs en Santa Marta → un cluster". El escenario 5 dice "genera clusters SEPARADOS por municipio". No hay un mínimo de empresas por municipio — el filtro fuerte está en `MIN_SIZE` de **CIIUs**, no de empresas. Si una comunidad CIIU pasa el filtro y hay 1 empresa con ese CIIU en un municipio, se materializa. Si esto resulta ruidoso en producción (clusters con 1 empresa) se puede agregar un `MIN_COMPANIES_PER_ECOSYSTEM` en un change futuro.

### 4.6 `buildCluster(sortedCiius, municipio, memberCount)` — ID + título

```
function buildCluster(sortedCiius, municipio, memberCount):
  joined = sortedCiius.join('-')
  hash8 = sha1(joined).hex.slice(0, 8)
  slug = slugify(municipio) // lowercase, NFD strip diacritics, spaces → '-'
  id = `eco-${hash8}-${slug}`
  codigo = `eco-${hash8}-${slug}` // mismo que id, usado por consistencia con HeuristicClusterer

  // Título según CLU-REQ-NEW-004
  ciiusForTitle = sortedCiius.length <= 5
    ? sortedCiius
    : sortedCiius.slice(0, 5)
  ciiusStr = ciiusForTitle.join('-') + (sortedCiius.length > 5 ? '...' : '')
  titulo = `Ecosistema CIIU ${ciiusStr} · ${municipio}`

  return Cluster.create({
    id,
    codigo,
    titulo,
    descripcion: null, // enrichment via ExplainCluster es OUT OF SCOPE este change
    tipo: 'heuristic-ecosistema',
    ciiuDivision: null,
    ciiuGrupo: null,
    municipio,
    macroSector: null,
    memberCount,
  })
```

### 4.7 Slugify

El `HeuristicClusterer` ya tiene una función `slug(s)` que hace `NFD + diacritic strip + spaces → '_' + UPPERCASE`. Para `heuristic-ecosistema` el spec pide LOWERCASE con `-` separador (CLU-REQ-NEW-005 escenario 1: `"santa-marta"`). **No reusamos** `HeuristicClusterer.slug` — mantenemos su comportamiento actual (UPPERCASE con `_`) intacto. Definimos un `slugLower` local:

```typescript
function slugLower(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
}
```

---

## 5. Cluster ID stability

Fórmula: `eco-{sha1(sorted(ciius).join('-')).slice(0,8)}-{slugLower(municipio)}`

### Ejemplos

- Comunidad `['5511', '5612', '9601']` en `"Santa Marta"`:
  - `sorted` = `['5511', '5612', '9601']`
  - `joined` = `"5511-5612-9601"`
  - `sha1("5511-5612-9601")` → primeros 8 chars hex (computado en runtime, ej. `"a1b2c3d4"`)
  - `slugLower("Santa Marta")` = `"santa-marta"`
  - **ID** = `"eco-a1b2c3d4-santa-marta"`

- Misma comunidad en `"Barranquilla"`:
  - **ID** = `"eco-a1b2c3d4-barranquilla"` (mismo hash, slug distinto)

- Comunidad `['5511', '5612', '5613', '9601']` en `"Santa Marta"` (un CIIU extra):
  - `joined` = `"5511-5612-5613-9601"` → hash distinto → ID distinto. **Intencional**: es semánticamente otro ecosistema.

### Edge case documentado (CLU-REQ-NEW-005 escenario 2)

Si entre runs el grafo absorbe un CIIU nuevo a una comunidad, el ID cambia. El cluster anterior queda huérfano (sin membresías, porque `deleteAll` los borró antes de re-persistir). El cluster huérfano persiste en la tabla `clusters` con `member_count` desactualizado hasta que `deleteByType('heuristic-ecosistema')` lo limpie en el siguiente run (ver CLU-REQ-NEW-006 escenario 4).

---

## 6. Behavior of `ValueChainMatcher` (post-change)

### 6.1 Firma

```typescript
async match(companies: Company[]): Promise<Map<string, Recommendation[]>>
```

### 6.2 Pseudocódigo

```
async function match(companies):
  // 1) Resolver reglas (dinámicas + fallback selectivo o solo hardcoded según flag)
  rules = await dynamicRules.getValueChainRules(env.AI_DRIVEN_RULES_ENABLED === 'true')

  // 2) Resto idéntico al actual: agrupar por ciiu, iterar reglas, emitir recs
  byCiiu = groupBy(companies, c => c.ciiu)
  out = Map<string, Recommendation[]>()
  for rule in rules:
    sources = byCiiu[rule.ciiuOrigen] ?? []
    targets = rule.ciiuDestino === '*'
      ? companies.filter(c => c.ciiu !== rule.ciiuOrigen)
      : (byCiiu[rule.ciiuDestino] ?? [])
    for s in sources:
      for t in targets:
        if s.id === t.id: continue
        factor = s.municipio === t.municipio ? 1 : 0.85
        score = min(1, rule.weight * factor)
        // emit cliente-rec a s, proveedor-rec a t (idéntico actual)
        ...
  return out
```

### 6.3 DI

```typescript
@Injectable()
export class ValueChainMatcher {
  constructor(private readonly dynamicRules: DynamicValueChainRules) {}
}
```

El env flag se lee directo de `env.AI_DRIVEN_RULES_ENABLED` dentro del helper. Esto evita que el matcher conozca el flag — `DynamicValueChainRules` lo recibe como parámetro y centraliza la lectura.

> **Decisión**: el flag se inyecta como **parámetro** al helper, no como dependencia del helper. La razón es testabilidad: el test del helper no necesita stubear `env`, solo pasa `false` o `true`. La lectura de `env` ocurre en el matcher (una línea trivial).

### 6.4 Cuando flag=false

`getValueChainRules(false)` retorna `VALUE_CHAIN_RULES` literal — comportamiento idéntico al actual. La firma async de `match()` no es funcionalmente bloqueante (el await resuelve con un sync return).

---

## 7. Behavior of `AllianceMatcher` (post-change)

### 7.1 Firma

```typescript
async match(companies: Company[]): Promise<Map<string, Recommendation[]>>
```

### 7.2 Cambios

Idéntico patrón que ValueChainMatcher:

```typescript
constructor(private readonly dynamicRules: DynamicValueChainRules) {}

async match(companies): Promise<Map<string, Recommendation[]>> {
  const ecosystems = await this.dynamicRules.getEcosystems(env.AI_DRIVEN_RULES_ENABLED === 'true')
  // resto idéntico al actual: iterar ECOSYSTEMS, dedupe por par, emitir recs aliado
  ...
}
```

La dedupe `seen` por `aId|bId` ya existente en el matcher absorbe los pares duplicados que aparezcan entre los pseudo-ecosistemas dinámicos (mini-ecos de 2 CIIUs) y los ecosistemas hardcoded (listas grandes de CIIUs).

### 7.3 GenerateRecommendations.runFallback() update

`runFallback()` pasa de síncrono a async:

```typescript
private async runFallback(companies: Company[]): Promise<Map<string, Recommendation[]>> {
  const out = new Map<string, Recommendation[]>()
  mergeInto(out, this.peer.match(companies, { topN: TOP_PER_TYPE }))
  mergeInto(out, await this.valueChain.match(companies))
  mergeInto(out, await this.alliance.match(companies))
  return out
}
```

Los call sites (`recsBySource = this.runFallback(...)` en líneas 95 y 99 del archivo actual) pasan a `await this.runFallback(...)`. Esto **NO** afecta la API pública del use case — `execute()` ya es async.

---

## 8. Behavior of `GenerateClusters` (post-change)

### 8.1 Cambios

Agregar `EcosystemDiscoverer` como dependencia opcional + tercer pase condicional:

```typescript
@Injectable()
export class GenerateClusters {
  constructor(
    @Inject(COMPANY_REPOSITORY) private readonly companyRepo: CompanyRepository,
    @Inject(CLUSTER_REPOSITORY) private readonly clusterRepo: ClusterRepository,
    @Inject(CLUSTER_MEMBERSHIP_REPOSITORY)
    private readonly membershipRepo: ClusterMembershipRepository,
    private readonly predefinedMatcher: PredefinedClusterMatcher,
    private readonly heuristicClusterer: HeuristicClusterer,
    private readonly ecosystemDiscoverer: EcosystemDiscoverer, // NEW (siempre inyectado)
  ) {}

  async execute(): Promise<GenerateClustersResult> {
    const companies = (await this.companyRepo.findAll()).filter(
      (c) => c.isActive,
    )
    const predefinedAssignments = await this.predefinedMatcher.match(companies)
    const heuristicResults = await this.heuristicClusterer.cluster(companies)

    const ecosystemEnabled = env.AI_DRIVEN_RULES_ENABLED === 'true'
    const ecosystemResults = ecosystemEnabled
      ? await this.ecosystemDiscoverer.discover(companies)
      : []

    // Limpieza targeted antes de re-persistir ecosistemas (CLU-REQ-NEW-006 escenario 4)
    if (ecosystemEnabled) {
      await this.clusterRepo.deleteByType('heuristic-ecosistema')
    }

    await this.membershipRepo.deleteAll()
    await this.persistPredefinedUpdates(predefinedAssignments)
    await this.persistHeuristicClusters(heuristicResults)
    await this.persistHeuristicClusters(ecosystemResults) // mismo patrón

    // membresías concatenadas
    const memberships: Membership[] = []
    for (const [clusterId, list] of predefinedAssignments)
      for (const c of list) memberships.push({ clusterId, companyId: c.id })
    for (const { cluster, members } of heuristicResults)
      for (const c of members)
        memberships.push({ clusterId: cluster.id, companyId: c.id })
    for (const { cluster, members } of ecosystemResults)
      for (const c of members)
        memberships.push({ clusterId: cluster.id, companyId: c.id })

    await this.membershipRepo.saveMany(memberships)

    return {
      predefinedClusters: predefinedAssignments.size,
      heuristicClusters: heuristicResults.length,
      ecosystemClusters: ecosystemResults.length,
      totalMemberships: memberships.length,
    }
  }
}
```

### 8.2 Output extendido

```typescript
export interface GenerateClustersResult {
  predefinedClusters: number
  heuristicClusters: number
  ecosystemClusters: number // NEW
  totalMemberships: number
}
```

### 8.3 Por qué `EcosystemDiscoverer` se inyecta siempre

- Simplifica el wiring del módulo (no hay un `Provider` condicional según env).
- El flag se resuelve en `execute()`, no en construcción.
- El discoverer no tiene side effects en construcción — es seguro inyectarlo aunque nunca se invoque.

### 8.4 `deleteByType` order

`deleteByType('heuristic-ecosistema')` corre **antes** del `deleteAll()` de membresías y del `saveMany` de clusters. Si fallara después del delete pero antes del save, los ecosistemas anteriores quedarían huérfanos sin clusters — pero `clusters` tiene FK a `clusters` desde `cluster_memberships`, y `deleteAll()` se ejecuta a continuación, así que el estado consistente es: cero ecosistemas, cero membresías. La inconsistencia transitoria en caso de falla intermedia es aceptable porque el siguiente run regenera todo.

> Si se requiere atomicidad estricta, se puede envolver en una transacción Supabase via `rpc` — fuera de scope de este change. El `saveMany` de cluster repository NO usa transacción explícita hoy.

---

## 9. Database changes

### 9.1 Migration: agregar `model_version` a `ai_match_cache`

Archivo: `supabase/migrations/{timestamp}_add_model_version_to_ai_match_cache.sql`

```sql
-- Add model_version column to ai_match_cache for traceability across Gemini model changes.
-- Idempotent: checks for existence before adding.

alter table ai_match_cache
  add column if not exists model_version text default null;

-- No backfill: legacy entries retain NULL and are accepted as valid by readers.
-- A maintenance script can selectively delete entries by model_version if needed:
-- DELETE FROM ai_match_cache WHERE model_version = 'gemini-2.0-flash';

-- Optional: add index if filtering by model_version becomes hot path. NOT added now.
```

**Reversibilidad**: trivial (`drop column if exists model_version`). No incluida en el script — Supabase migrations son forward-only por convención del proyecto.

### 9.2 Cluster `tipo` — sin migration necesaria

El schema actual (`migrations/20260425220840_brain_init.sql:79`) declara `tipo text not null`. No es ENUM ni hay CHECK constraint sobre los valores. Agregar `'heuristic-ecosistema'` al VO `ClusterType` es suficiente — la BD acepta el string directamente.

### 9.3 Tipos generados

Después de la migration de `model_version`, correr `bun supabase:types` para regenerar tipos. Validar que `BrainSupabaseClient` ahora muestra `model_version: string | null` en el row de `ai_match_cache`.

### 9.4 Update `SupabaseAiMatchCacheRepository`

Cambios:

1. `CacheRow` agrega `model_version: string | null`.
2. `toRow(entry)` incluye `model_version: entry.modelVersion`.
3. `toEntity(row)` pasa `modelVersion: row.model_version` a `AiMatchCacheEntry.create`.
4. `select('*')` se mantiene — el `*` agarra la columna nueva automáticamente.

### 9.5 Update `AiMatchCacheEntry` entity

Agregar `modelVersion: string | null` al props, getter, factory input. Validación: `null` permitido (legacy).

### 9.6 Update `AiMatchEngine.persist()`

Lee `env.GEMINI_CHAT_MODEL` (ya existe en el schema Zod del brain — ver `env.ts:34`) y lo pasa como `modelVersion`. **No se agrega nueva env var `GEMINI_MODEL_VERSION`** (la spec AGT-REQ-NEW-001 menciona `env.GEMINI_MODEL_VERSION` pero `GEMINI_CHAT_MODEL` ya cumple ese rol — usamos el existente para no crear redundancia).

```typescript
private async persist(ciiuOrigen, ciiuDestino, result): Promise<void> {
  await this.cache.put(
    AiMatchCacheEntry.create({
      ...,
      modelVersion: env.GEMINI_CHAT_MODEL, // NEW
    }),
  )
}
```

> **Nota sobre la spec AGT-REQ-NEW-001**: la spec dice `env.GEMINI_MODEL_VERSION`. Esto es un detalle de naming — el design ratifica que se usa `GEMINI_CHAT_MODEL` (variable existente, mismo significado semántico). Documentar este alias en `.env.example` si fuera necesario.

---

## 10. Open questions del proposal — resolución en este design

| OQ                                | Resolución                                                                                                                                                                                                              |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OQ-1 (threshold)                  | Resuelto en specs: 0.65 matchers, 0.70 community detection. Constantes en código: `MATCHER_CONFIDENCE_THRESHOLD` y `EcosystemDiscoverer.CONFIDENCE_THRESHOLD`.                                                          |
| OQ-2 (naming ecosistemas)         | Resuelto en specs CLU-REQ-NEW-004: heurística determinística `"Ecosistema CIIU {codes} · {municipio}"`. `ExplainCluster` (Gemini) **NO** se invoca en este change — `descripcion: null` por default.                    |
| OQ-3 (fallback hardcoded)         | Para reglas de cadena de valor: **selectivo por par no cubierto**. Para ecosistemas (aliados): **unión completa**, dedupe del matcher absorbe duplicados. Justificación en §2.5.                                        |
| OQ-4 (CandidateSelector)          | **Pospuesto** — `CandidateSelector` no consume `CiiuGraphPort` en este change. Razón: el selector hoy usa `VALUE_CHAIN_RULES` para pre-filtrar pares, eso sigue funcionando. Optimización para R6 queda como follow-up. |
| OQ-5 (versionado lectura mixta)   | El port acepta cualquier `model_version` (incluso NULL). `getMatchingPairs` no filtra por versión. Métrica de observabilidad **no implementada** en este change.                                                        |
| OQ-6 (membresías huérfanas)       | Resuelto en CLU-REQ-NEW-006: `deleteByType('heuristic-ecosistema')` antes de `saveMany`.                                                                                                                                |
| OQ-7 (performance grafo)          | Filtrado en SQL (`WHERE confidence >= ? AND has_match = true AND ciiu_destino != '*'`). No traemos `findAll`.                                                                                                           |
| OQ-8 (AiMatchEngine prompt hints) | Mantener hardcoded como hints — `AiMatchEngine` sigue usando `VALUE_CHAIN_RULES` y `ECOSYSTEMS` literales en el prompt. Sin cambios.                                                                                    |

---

## 11. Test strategy

### 11.1 Unit tests nuevos

| Archivo de test                                                 | Qué prueba                                                                                                                                                                    |
| --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `__tests__/recommendations/CiiuEdge.test.ts`                    | VO: validación de confidence, hasMatch+relationType invariant, immutabilidad                                                                                                  |
| `__tests__/recommendations/CiiuGraphPort.contract.test.ts`      | Contract test: misma suite contra `InMemoryCiiuGraphRepository` y mock de `SupabaseCiiuGraphRepository`. Casos: threshold filter, relationType filter, exclusión de wildcards |
| `__tests__/recommendations/InMemoryCiiuGraphRepository.test.ts` | Implementación InMemory aislada                                                                                                                                               |
| `__tests__/recommendations/SupabaseCiiuGraphRepository.test.ts` | Adapter Supabase con mock del client (igual patrón que `SupabaseAiMatchCacheRepository.test.ts`)                                                                              |
| `__tests__/recommendations/DynamicValueChainRules.test.ts`      | Flag false → hardcoded literal. Flag true + grafo vacío → hardcoded. Flag true + grafo poblado → unión filtrada (rules) o unión completa (ecosystems)                         |
| `__tests__/clusters/LabelPropagation.test.ts`                   | Algoritmo puro: convergencia, tie-break determinístico, mismo input → mismo output entre runs                                                                                 |
| `__tests__/clusters/EcosystemDiscoverer.test.ts`                | Comunidades chicas descartadas (size<3), grandes splittadas (size>15), grafo vacío → `[]` con warning, IDs estables, separación por municipio                                 |
| `__tests__/clusters/EcosystemId.test.ts`                        | sha1 determinístico, slug del municipio correcto, distinto si CIIUs distintos                                                                                                 |

### 11.2 Tests modificados

| Archivo                                                              | Qué cambia                                                                                                                                                                                                                                  |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `__tests__/recommendations/AiMatchCacheEntry.test.ts`                | Agregar caso `modelVersion: 'gemini-2.5-flash'` y `modelVersion: null`                                                                                                                                                                      |
| `__tests__/recommendations/SupabaseAiMatchCacheRepository.test.ts`   | Verificar que `put` escribe `model_version` y `get` lo lee                                                                                                                                                                                  |
| `__tests__/recommendations/InMemoryAiMatchCacheRepository.test.ts`   | Mismo                                                                                                                                                                                                                                       |
| `__tests__/recommendations/ValueChainMatcher.test.ts`                | Tests existentes pasan a `await matcher.match(...)`. Agregar tests: flag=false (idéntico actual), flag=true + grafo vacío (fallback), flag=true + grafo con regla nueva (regla del grafo aplica + reglas hardcoded para pares no cubiertos) |
| `__tests__/recommendations/AllianceMatcher.test.ts`                  | Análogo                                                                                                                                                                                                                                     |
| `__tests__/recommendations/AiMatchEngine.test.ts`                    | Verificar que `persist` incluye `modelVersion` con valor de env                                                                                                                                                                             |
| `__tests__/recommendations/GenerateRecommendations.test.ts`          | `runFallback` async — los tests existentes ya usan `await execute()`, no requieren más cambios                                                                                                                                              |
| `__tests__/clusters/Cluster.test.ts`                                 | Agregar caso `tipo='heuristic-ecosistema'` con id válido / inválido / municipio nulo                                                                                                                                                        |
| `__tests__/clusters/GenerateClusters.test.ts`                        | flag=false → `ecosystemClusters: 0`, sin llamada a `EcosystemDiscoverer.discover`. flag=true + ecosystem stub → 3 clusters persistidos, `ecosystemClusters: 3`                                                                              |
| `__tests__/clusters/InMemoryClusterRepository.test.ts` y `Supabase*` | Implementar y testear `deleteByType`                                                                                                                                                                                                        |

### 11.3 Cobertura esperada

Total de tests nuevos: ~25-30. Total tests modificados: ~10-15. La cobertura del 80% en `src/brain/src` se mantiene (todos los archivos nuevos tienen test directo).

### 11.4 Migración: smoke test manual post-deploy

No hay test automatizado de migración (el proyecto no tiene infraestructura para eso hoy). Smoke check manual:

```sql
-- Después del deploy
SELECT column_name, is_nullable, data_type
  FROM information_schema.columns
  WHERE table_name = 'ai_match_cache' AND column_name = 'model_version';
-- Debe retornar: model_version, YES, text
```

---

## 12. Files to create / modify

### Create

```
src/brain/src/recommendations/domain/value-objects/CiiuEdge.ts
src/brain/src/recommendations/domain/ports/CiiuGraphPort.ts
src/brain/src/recommendations/infrastructure/repositories/SupabaseCiiuGraphRepository.ts
src/brain/src/recommendations/infrastructure/repositories/InMemoryCiiuGraphRepository.ts
src/brain/src/recommendations/application/services/DynamicValueChainRules.ts
src/brain/src/clusters/application/services/EcosystemDiscoverer.ts
src/brain/src/clusters/application/services/LabelPropagation.ts

src/brain/__tests__/recommendations/CiiuEdge.test.ts
src/brain/__tests__/recommendations/CiiuGraphPort.contract.test.ts
src/brain/__tests__/recommendations/InMemoryCiiuGraphRepository.test.ts
src/brain/__tests__/recommendations/SupabaseCiiuGraphRepository.test.ts
src/brain/__tests__/recommendations/DynamicValueChainRules.test.ts
src/brain/__tests__/clusters/LabelPropagation.test.ts
src/brain/__tests__/clusters/EcosystemDiscoverer.test.ts
src/brain/__tests__/clusters/EcosystemId.test.ts

supabase/migrations/{timestamp}_add_model_version_to_ai_match_cache.sql
```

### Modify

```
src/brain/src/recommendations/recommendations.module.ts
  + provider CIIU_GRAPH_PORT (SupabaseCiiuGraphRepository)
  + provider DynamicValueChainRules
  + export CIIU_GRAPH_PORT

src/brain/src/clusters/clusters.module.ts
  + import RecommendationsModule
  + provider EcosystemDiscoverer

src/brain/src/recommendations/application/services/ValueChainMatcher.ts
  + DI DynamicValueChainRules
  + match() → async, lee env flag, llama dynamicRules.getValueChainRules()

src/brain/src/recommendations/application/services/AllianceMatcher.ts
  + DI DynamicValueChainRules
  + match() → async, lee env flag, llama dynamicRules.getEcosystems()

src/brain/src/recommendations/application/services/AiMatchEngine.ts
  + persist() incluye modelVersion: env.GEMINI_CHAT_MODEL

src/brain/src/recommendations/application/use-cases/GenerateRecommendations.ts
  + runFallback() → async, await en valueChain.match() y alliance.match()
  + call sites: await this.runFallback(...)

src/brain/src/recommendations/domain/entities/AiMatchCacheEntry.ts
  + props.modelVersion: string | null
  + factory acepta modelVersion (optional, default null)
  + getter modelVersion

src/brain/src/recommendations/infrastructure/repositories/SupabaseAiMatchCacheRepository.ts
  + CacheRow.model_version
  + toRow incluye model_version
  + toEntity pasa modelVersion al factory

src/brain/src/recommendations/infrastructure/repositories/InMemoryAiMatchCacheRepository.ts
  + persistir y devolver modelVersion (trivial — el in-memory ya guarda la entity)

src/brain/src/clusters/application/use-cases/GenerateClusters.ts
  + DI EcosystemDiscoverer
  + tercer pase condicional a env.AI_DRIVEN_RULES_ENABLED
  + clusterRepo.deleteByType('heuristic-ecosistema') antes de saveMany
  + result incluye ecosystemClusters

src/brain/src/clusters/domain/entities/Cluster.ts
  + validación para tipo='heuristic-ecosistema' (municipio requerido, ciiuDivision/ciiuGrupo deben ser null)

src/brain/src/clusters/domain/value-objects/ClusterType.ts
  + agregar 'heuristic-ecosistema' a CLUSTER_TYPES

src/brain/src/clusters/domain/repositories/ClusterRepository.ts
  + deleteByType(tipo: ClusterType): Promise<void>

src/brain/src/clusters/infrastructure/repositories/SupabaseClusterRepository.ts
  + implementación de deleteByType (DELETE FROM clusters WHERE tipo = $1)

src/brain/src/clusters/infrastructure/repositories/InMemoryClusterRepository.ts
  + implementación de deleteByType (filter)

src/brain/src/shared/infrastructure/env.ts
  + AI_DRIVEN_RULES_ENABLED: z.enum(['true', 'false']).default('false')

.env.example (en el repo root)
  + AI_DRIVEN_RULES_ENABLED=false
```

---

## 13. Risks revisited and mitigations

| Risk (del explore)                               | Mitigation en este design                                                                                                                                                                                                                                             |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1 — Bootstrap cost**                          | AD-2 + flag default false. Cuando flag=false, comportamiento idéntico al actual (sin costo nuevo). El grafo crece orgánicamente con el cron del agente que ya corre. `EcosystemDiscoverer` con grafo vacío retorna `[]` sin error.                                    |
| **R2 — Circular dependency**                     | AD-1: `CiiuGraphPort` exportado desde `recommendations`. `clusters` importa `RecommendationsModule`. Dependencia unidireccional. No hay forwardRef.                                                                                                                   |
| **R3 — Cache invalidation por modelo**           | AD-4 + columna `model_version`. Lectura acepta cualquier versión (incluso NULL). Script de mantenimiento puede limpiar selectivo. Sin breaking change para entradas legacy.                                                                                           |
| **R4 — Comunidades degeneradas**                 | AD-3: MIN_SIZE=3, MAX_SIZE=15, exclusión de wildcards en el port (no llegan al label propagation). Tie-break determinístico evita inestabilidad entre runs con mismo grafo.                                                                                           |
| **R5 — VALUE_CHAIN_RULES como hint para Gemini** | Mantenidos en el prompt de `AiMatchEngine` (sin cambios). Los hints son `seed knowledge`, no fuente de cobertura.                                                                                                                                                     |
| **R6 — CandidateSelector cross-division**        | **Pospuesto** (OQ-4). En este change, el selector mantiene su comportamiento actual. Si flag=true y los matchers descubren pares cross-division que el selector no propuso, esos pares son evaluados solo si fueron previamente cacheados — aceptable para hackathon. |
| **R7 — IDs inestables**                          | AD-6 + sha1 determinístico de CIIUs ordenados ASC + slug municipio. Mismo input → mismo ID. Cambio semántico de la comunidad → ID nuevo (intencional). `deleteByType` limpia obsoletos.                                                                               |

### Mapeo de ADs a riesgos

- **AD-1** mitiga R2.
- **AD-2** mitiga R1.
- **AD-3** mitiga R4.
- **AD-4** mitiga R3.
- **AD-5** mitiga R1, R5 (rollback rápido), R7 (kill switch si IDs producen ruido).
- **AD-6** mitiga R7.
- **AD-7** sin mitigación específica — decisión de scope.

---

## 14. Out of scope confirmation

Reconfirmado del proposal y especificado en este design:

- **Scoring weights** (60/40 cliente/proveedor, 40/30/20/10 split) — sin cambio.
- **Prompt de Gemini en `AiMatchEngine`** — sin cambio. Los hints siguen siendo `VALUE_CHAIN_RULES` y `ECOSYSTEMS` hardcoded.
- **Etiquetado humano de ecosistemas** — sin UI, sin tabla. El nombre es heurístico (`"Ecosistema CIIU ... · Municipio"`).
- **Enrichment via `ExplainCluster` (Gemini) para descripción** — pospuesto. `descripcion` es `null` para todos los clusters de ecosistema en este change.
- **Pre-warming del grafo** — no se ejecuta. El cron orgánico maneja el crecimiento.
- **`CandidateSelector` con grafo dinámico** — pospuesto (OQ-4 / R6).
- **Cambios en API HTTP** — la API de `/recommendations` y `/clusters` no cambia. El front consume sin saber el origen del cluster.
- **Migration de las 27 reglas hardcoded a BD** — siguen en código como fallback.
- **Approach D del explore (Gemini agrupando ecosistemas en un prompt)** — descartado.
- **Approach B del explore (tabla materializada `value_chain_rules`)** — descartado.
- **Métricas de observabilidad de `model_version`** — fuera de scope (OQ-5).
- **Filtrado por `model_version` en lectura del grafo** — fuera de scope. El port acepta cualquiera.

---

## 15. Reference back to specs

- REC-REQ-NEW-001 → §2.2 + §2.3 + §2.4
- REC-REQ-NEW-002 → §2.5 (constants) + §2.6 (CONFIDENCE_THRESHOLD)
- REC-REQ-NEW-003 → §9.1 + §9.4 + §9.5 + §9.6
- REC-REQ-NEW-004 → §6 (ValueChainMatcher async + fallback selectivo)
- REC-REQ-NEW-005 → §7 (AllianceMatcher async + fallback completo)
- REC-REQ-NEW-006 → §12 (env update) + §6.4 + §8.1
- REC-REQ-NEW-007 → §2.3 (`getMatchingPairs` con SQL filter — implementa el `findByMatch` del spec via el port)
- CLU-REQ-NEW-001 → §12 (ClusterType update)
- CLU-REQ-NEW-002 → §12 (Cluster.create validation)
- CLU-REQ-NEW-003 → §2.6 + §4
- CLU-REQ-NEW-004 → §4.6 (titulo)
- CLU-REQ-NEW-005 → §4.6 (id) + §5
- CLU-REQ-NEW-006 → §8 (GenerateClusters)
- CLU-REQ-NEW-007 → §12 (deleteByType en port + adapters)
- AGT-REQ-NEW-001 → §9.6 (AiMatchEngine.persist con modelVersion)
- AGT-REQ-NEW-002 → §6.4 + §7.2 (fallback completo cuando grafo vacío) + §2.6 (warning + return [])
