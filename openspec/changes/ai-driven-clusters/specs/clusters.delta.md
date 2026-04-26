# Clusters — Delta Spec

# Change: `ai-driven-clusters`

> Delta requirements que se AGREGAN o MODIFICAN en el bounded context `clusters`.
> Los requirements base CLU-REQ-001..009 en `docs/specs/04-clusters/requirements.md` permanecen vigentes sin modificación, salvo donde se indica explícitamente `[MODIFY]`.
>
> Resolución explícita de open questions del proposal:
>
> - OQ-2 (naming de ecosistemas) → resuelto en CLU-REQ-NEW-004
> - OQ-membresías huérfanas → resuelto en CLU-REQ-NEW-006

---

## CLU-REQ-NEW-001: Nuevo valor `'heuristic-ecosistema'` en `ClusterType`

**Categoría**: must
**Cambio**: add
**Origen**: proposal, explore §8

**Statement**: El sistema debe agregar el valor `'heuristic-ecosistema'` al Value Object `ClusterType`, de modo que los clusters emergentes de community detection sean tipados y validados por el factory de `Cluster`.

**Scenarios**:

1. **Given** que el VO `ClusterType` está definido **When** se evalúa `CLUSTER_TYPES.includes('heuristic-ecosistema')` **Then** el resultado es `true`.

2. **Given** que `Cluster.create()` recibe `tipo='heuristic-ecosistema'` con un ID válido en formato `eco-{hash8}-{slug_municipio}` **Then** la entidad se crea sin error.

3. **Given** que `Cluster.create()` recibe `tipo='heuristic-ecosistema'` sin el campo `municipio` **Then** el factory lanza un error de validación (`ClusterValidationError` o similar), porque los clusters de ecosistema siempre pertenecen a un municipio.

**Notes**: Actualizar la constante `CLUSTER_TYPES` en `domain/value-objects/ClusterType.ts`. Agregar rama de validación en `Cluster.create()` para el nuevo tipo. El campo `ciiuDivision` y `ciiuGrupo` son `null` para `heuristic-ecosistema` — el ecosistema no pertenece a una división CIIU única sino a un conjunto de CIIUs.

---

## CLU-REQ-NEW-002: Entity `Cluster` — validación para tipo `heuristic-ecosistema`

**Categoría**: must
**Cambio**: add
**Origen**: CLU-REQ-NEW-001; proposal AD-6

**Statement**: El factory `Cluster.create()` debe validar que los clusters de tipo `'heuristic-ecosistema'` tienen: ID en formato `eco-{hash8}-{slug_municipio}`, `municipio` no nulo, y `ciiuDivision` / `ciiuGrupo` nulos.

**Scenarios**:

1. **Given** que se llama `Cluster.create({ id: 'eco-ab12ef34-santa-marta', tipo: 'heuristic-ecosistema', municipio: 'Santa Marta', ... })` **When** el factory valida el ID **Then** acepta el formato `eco-{8 hex chars}-{slug}`.

2. **Given** que se llama `Cluster.create({ id: 'eco-ab12ef34-santa-marta', tipo: 'heuristic-ecosistema', municipio: null, ... })` **When** el factory valida **Then** lanza error porque `municipio` es obligatorio para ecosistemas.

3. **Given** que se llama `Cluster.create({ tipo: 'heuristic-ecosistema', ciiuDivision: '47', ... })` **When** el factory valida **Then** lanza error porque `ciiuDivision` debe ser null en ecosistemas.

**Notes**: Extender el switch/if de tipos en `Cluster.create()` — el comportamiento actual para `heuristic-division` y `heuristic-grupo` no cambia.

---

## CLU-REQ-NEW-003: Servicio `EcosystemDiscoverer` — algoritmo y contrato

**Categoría**: must
**Cambio**: add
**Origen**: proposal AD-3

**Statement**: El sistema debe implementar un servicio `EcosystemDiscoverer` en `clusters/application/services/EcosystemDiscoverer.ts` que corra label propagation sobre el grafo CIIU entregado por `CiiuGraphPort`, identifique comunidades, y retorne una lista de clusters `heuristic-ecosistema` con sus miembros (empresas).

**Input**:

- `companies: Company[]` — empresas activas sobre las que materializar membresías
- Grafo CIIU: leído internamente vía `CiiuGraphPort.getMatchingPairs(COMMUNITY_DETECTION_CONFIDENCE_THRESHOLD)` (threshold = 0.70)

**Output**:

```
Promise<{ cluster: Cluster; members: Company[] }[]>
```

**Parámetros del algoritmo** (constantes dentro del servicio):

```
MIN_SIZE = 3           // mínimo de CIIUs distintos en una comunidad para materializarse
MAX_SIZE = 15          // máximo; si excede se divide en sub-comunidades (estrategia: split por tamaño)
MAX_ITERATIONS = 20    // label propagation para en convergencia o este límite
```

**Scenarios**:

1. **Given** que el grafo tiene un componente de 5 CIIUs (`A, B, C, D, E`) todos con aristas mutuas de confidence ≥ 0.70 y hay 7 empresas en esos CIIUs en Santa Marta **When** `EcosystemDiscoverer.discover(companies)` corre **Then** emite un cluster `heuristic-ecosistema` con ID determinístico (ver CLU-REQ-NEW-005) y las 7 empresas como miembros.

2. **Given** que el grafo tiene un componente de solo 2 CIIUs **When** `EcosystemDiscoverer.discover(companies)` corre **Then** ese componente NO genera un cluster (2 < MIN_SIZE=3).

3. **Given** que el grafo produce una comunidad de 20 CIIUs (> MAX_SIZE=15) **When** `EcosystemDiscoverer.discover(companies)` finaliza el label propagation **Then** la comunidad se divide en sub-comunidades de hasta 15 CIIUs usando una estrategia de corte (ej. cortar por orden de nodo ascendente hasta rellenar el primer grupo), y cada sub-comunidad se materializa como un cluster separado.

4. **Given** que el grafo está vacío o todas las aristas tienen confidence < 0.70 **When** `EcosystemDiscoverer.discover(companies)` corre **Then** retorna `[]` sin error, y loguea un warning: `"[EcosystemDiscoverer] grafo vacío o sin aristas sobre threshold — sin ecosistemas detectados"`.

5. **Given** que hay empresas en el municipio A y empresas en el municipio B, y ambos grupos tienen CIIUs que forman la misma comunidad **When** `EcosystemDiscoverer.discover(companies)` corre **Then** genera clusters SEPARADOS por municipio (un cluster por comunidad × municipio con al menos 1 empresa).

**Notes**: Label propagation in-process en TypeScript puro, sin librerías externas de grafos. El seed de iteración es el orden ascendente lexicográfico de los códigos CIIU (garantiza determinismo entre runs con mismo grafo). Las aristas wildcards (`ciiuDestino = '*'`) son excluidas automáticamente por el port (ver REC-REQ-NEW-001, escenario 3).

---

## CLU-REQ-NEW-004: Naming de clusters `heuristic-ecosistema`

**Categoría**: must
**Cambio**: add
**Origen**: proposal open question OQ-2

**Statement**: El sistema debe generar el título de un cluster `heuristic-ecosistema` usando una heurística determinística basada en los códigos CIIU de la comunidad, en el formato `"Ecosistema CIIU {code1}-{code2}-... · {municipio}"`, con un fallback opcional de enriquecimiento via `ExplainCluster` (Gemini) que puede optar por no ejecutarse si el flag está desactivado o hay error.

**Resolución de OQ-2**: La etiqueta semántica generada por Gemini (ej. "Ecosistema gastronómico-turístico de Santa Marta") queda como **mejora futura** fuera del scope de este change. En este change, el título es siempre determinístico y heurístico.

**Scenarios**:

1. **Given** una comunidad CIIU `{5511, 5612, 9601}` en municipio `"Santa Marta"` **When** `EcosystemDiscoverer` crea el cluster **Then** el `titulo` es `"Ecosistema CIIU 5511-5612-9601 · Santa Marta"` (CIIUs ordenados ascendente, municipio capitalizado original).

2. **Given** que la comunidad tiene más de 5 CIIUs (ej. 8 CIIUs) **When** se construye el título **Then** el `titulo` usa los primeros 5 CIIUs en orden ascendente seguidos de `"..."`: `"Ecosistema CIIU 1011-4711-5511-5612-9601... · Santa Marta"`.

3. **Given** que el campo `descripcion` es generado via `ExplainCluster` (Gemini) **When** Gemini falla o lanza error **Then** el cluster se persiste con `descripcion = null` sin fallar el proceso completo.

**Notes**: El formato es intencional — es legible, único, y permite reconstruir el origen del cluster solo mirando el título. La etiqueta semántica (Gemini) es un enrichment opcional que, si se implementa, popula el campo `descripcion`, no el `titulo`.

---

## CLU-REQ-NEW-005: IDs determinísticos hash-basados para clusters de ecosistema

**Categoría**: must
**Cambio**: add
**Origen**: proposal AD-6

**Statement**: El sistema debe generar los IDs de clusters `heuristic-ecosistema` usando un hash determinístico de los CIIUs miembros de la comunidad y el municipio, de modo que la misma comunidad en el mismo municipio produzca el mismo ID en corridas sucesivas.

**Formato**:

```
eco-{sha1(sorted_ciius_joined).slice(0, 8)}-{slug(municipio)}
```

Donde:

- `sorted_ciius_joined` = códigos CIIU de la comunidad ordenados ascendente y concatenados con `-` (ej. `"5511-5612-9601"`)
- `sha1(...)` = SHA-1 hex del string UTF-8
- `.slice(0, 8)` = primeros 8 caracteres del hash hex
- `slug(municipio)` = lowercase, remover diacríticos, reemplazar espacios con `-` (ej. `"Santa Marta"` → `"santa-marta"`)

**Scenarios**:

1. **Given** una comunidad `{5511, 9601}` en `"Santa Marta"` **When** se genera el ID **Then** el resultado es `"eco-{sha1('5511-9601')[0..8]}-santa-marta"` — exactamente el mismo en dos corridas con el mismo grafo.

2. **Given** que en la corrida siguiente el grafo agrega el CIIU `5612` a la comunidad anterior (ahora `{5511, 5612, 9601}`) **When** se genera el ID **Then** el resultado es diferente (`"eco-{sha1('5511-5612-9601')[0..8]}-santa-marta"`), porque la comunidad cambió semánticamente — esto es correcto, el `deleteAll()` limpia la membresía anterior.

3. **Given** que dos municipios distintos (`"Santa Marta"` y `"Barranquilla"`) tienen empresas con exactamente los mismos CIIUs en su comunidad **When** se generan los IDs **Then** los IDs son distintos (slug del municipio difiere).

**Notes**: SHA-1 es suficiente para este caso de uso (determinismo, no seguridad). La función `slug` debe ser la misma utilizada para los IDs de clusters heurísticos existentes (mantener consistencia). Si colisiona (improbable con 8 hex chars), el upsert de `ClusterRepository.saveMany` simplemente actualiza el cluster existente.

---

## CLU-REQ-NEW-006: `GenerateClusters` — tercer pase con `EcosystemDiscoverer`

**Categoría**: must
**Cambio**: add
**Origen**: proposal AD-7; explore §7

**Statement**: El sistema debe extender `GenerateClusters` con un tercer pase de `EcosystemDiscoverer` que se ejecuta DESPUÉS de los dos passes de `HeuristicClusterer`, condicionado a `AI_DRIVEN_RULES_ENABLED=true`, y cuyo output incrementa el total de clusters y membresías persistidas.

**Orden de ejecución dentro de `GenerateClusters`**:

1. `PredefinedClusterMatcher` — asigna a los 8 clusters predefinidos
2. `HeuristicClusterer` — pases de división y grupo (sin cambios)
3. `EcosystemDiscoverer` — pase de ecosistemas (nuevo, condicional)

**Scenarios**:

1. **Given** que `AI_DRIVEN_RULES_ENABLED=true` y `EcosystemDiscoverer.discover(companies)` retorna 3 clusters de ecosistema con sus miembros **When** `GenerateClusters.execute()` corre **Then** los 3 clusters son persistidos via `ClusterRepository.saveMany` y las membresías via `ClusterMembershipRepository.saveMany`, y el output incluye `ecosystemClusters: 3`.

2. **Given** que `AI_DRIVEN_RULES_ENABLED=false` **When** `GenerateClusters.execute()` corre **Then** el tercer pase es completamente omitido (no se instancia ni invoca `EcosystemDiscoverer`), el output incluye `ecosystemClusters: 0`, y el comportamiento de los primeros dos passes es idéntico al actual.

3. **Given** que `EcosystemDiscoverer.discover(companies)` retorna `[]` (grafo vacío) **When** `GenerateClusters.execute()` continúa **Then** no hay error, no se persiste ningún cluster de ecosistema, y el proceso completa normalmente.

4. **Given** que entre dos corridas de `GenerateClusters` el grafo cambió y un ecosistema desapareció (el ID nuevo ya no existe) **When** la segunda corrida persiste clusters **Then** el `deleteAll()` previo en membresías + el upsert de clusters maneja el ciclo de vida: clusters con IDs que ya no se generan quedan sin membresías (huérfanos en la tabla `clusters`, sin miembros). La limpieza de clusters huérfanos es responsabilidad del tercer pase: antes de persistir los nuevos, hacer `ClusterRepository.deleteByType('heuristic-ecosistema')` seguido de un `saveMany` fresh.

**Output extendido de `GenerateClusters`**:

```typescript
{
  predefinedClusters: number
  heuristicClusters: number // división + grupo (sin cambio)
  ecosystemClusters: number // nuevo
  totalMemberships: number
}
```

**Notes**: La operación `deleteByType('heuristic-ecosistema')` se añade al port `ClusterRepository` (ver CLU-REQ-NEW-007). El `deleteAll()` en `ClusterMembershipRepository` existente ya cubre la limpieza de membresías.

---

## CLU-REQ-NEW-007: `ClusterRepository` — método `deleteByType`

**Categoría**: must
**Cambio**: add
**Origen**: CLU-REQ-NEW-006 escenario 4

**Statement**: El sistema debe agregar el método `deleteByType(tipo: ClusterType): Promise<void>` al port `ClusterRepository`, que elimina todos los clusters del tipo indicado, para permitir regeneración limpia de clusters de ecosistema sin afectar predefinidos ni heurísticos.

**Scenarios**:

1. **Given** que existen 3 clusters con `tipo='heuristic-ecosistema'` y 8 con `tipo='predefined'` **When** se invoca `ClusterRepository.deleteByType('heuristic-ecosistema')` **Then** los 3 ecosistemas son eliminados y los 8 predefinidos permanecen intactos.

2. **Given** que no existen clusters del tipo especificado **When** se invoca `deleteByType` **Then** la operación completa sin error (no-op).

**Notes**: Agregar a `ClusterRepository` port + implementaciones `Supabase*` e `InMemory*`. La operación debe ser transaccional con el `saveMany` subsecuente de los ecosistemas nuevos (si el save falla, el delete no debe persistir).

---

## [MODIFY] CLU-REQ-001 — `ClusterType` extendido

**Categoría**: must
**Cambio**: modify
**Origen**: CLU-REQ-NEW-001

**Statement modificado**: La constante `CLUSTER_TYPES` en `domain/value-objects/ClusterType.ts` pasa a ser:

```typescript
CLUSTER_TYPES = [
  'predefined',
  'heuristic-division',
  'heuristic-grupo',
  'heuristic-municipio',
  'heuristic-ecosistema',
] as const
```

Todos los usos existentes de `ClusterType` siguen siendo válidos — es un cambio aditivo.

---

## [MODIFY] CLU-REQ-002 — Validación de `Cluster.create()` para `heuristic-ecosistema`

**Categoría**: must
**Cambio**: modify
**Origen**: CLU-REQ-NEW-002

**Convención de IDs extendida** (se agrega al cuadro de CLU-REQ-002):

- `heuristic-ecosistema`: `eco-{sha1(sorted_ciius_joined)[0..8]}-{slug(municipio)}`

**Statement adicional**: El factory `Cluster.create()` acepta el nuevo tipo con las validaciones descritas en CLU-REQ-NEW-002. Las validaciones de tipos preexistentes no cambian.

---

## [MODIFY] CLU-REQ-003 — `ClusterRepository` extendido con `deleteByType`

**Categoría**: must
**Cambio**: modify
**Origen**: CLU-REQ-NEW-007

**Statement adicional**: El port `ClusterRepository` agrega el método `deleteByType(tipo: ClusterType): Promise<void>`. Las implementaciones `SupabaseClusterRepository` e `InMemoryClusterRepository` implementan el nuevo método.

---

## [MODIFY] CLU-REQ-006 — `GenerateClusters` extendido con tercer pase

**Categoría**: must
**Cambio**: modify
**Origen**: CLU-REQ-NEW-006

**Statement modificado**: `GenerateClusters.execute()` orquesta tres passes:

1. `PredefinedClusterMatcher`
2. `HeuristicClusterer`
3. `EcosystemDiscoverer` (condicional a `AI_DRIVEN_RULES_ENABLED=true`)

Output incluye el campo adicional `ecosystemClusters: number`.
