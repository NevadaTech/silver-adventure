# 04 — Clusters · Requirements

> Bounded context que **genera clusters dinámicos** de empresas en DOS capas:
>
> 1. **Predefinidos** (8 estratégicos del CSV de la Cámara: BANANO, MANGO, YUCA, CACAO, PALMA, CAFE, LOGISTICA, TURISMO)
> 2. **Heurísticos en cascada** (división MIN=5, grupo MIN=10) — `ARQ-005`
>
> Una empresa puede pertenecer a **múltiples clusters** (relación N:M).
>
> Aplica `ARQ-001`, `ARQ-003`, `ARQ-005`, `ARQ-007`.

---

## Metadata de implementación

| Campo                | Valor                                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| **Orden**            | **Phase 4**                                                                                              |
| **Owner**            | 🔵 **DEV A** (track Clustering)                                                                          |
| **Depende de**       | `01-shared`, `02-ciiu-taxonomy` (necesita findByDivision/findByGrupo), `03-companies` (recibe Company[]) |
| **Prerrequisito de** | `06-agent` (RunIncrementalScan invoca GenerateClusters)                                                  |
| **Paralelizable**    | ✅ **SÍ — paralelo con `05-recommendations`** (Dev B)                                                    |
| **Bloqueante**       | ❌ NO bloquea a Dev B                                                                                    |
| **Tasks del plan**   | Task 4.1 → 4.7 + Task 7.3 (seed predefined clusters + cluster mappings)                                  |
| **Estimación**       | ~1.5 días (entity, 3 repos, 2 services con cascada, 3 use cases, controller, seed)                       |

**Highlight técnico:** la cascada (división MIN=5 + grupo MIN=10) NO está en el reto. Es un valor agregado que demuestra al jurado clustering jerárquico real. Asegurate que los tests `CLU-SCN-006` (CASCADA) y `CLU-SCN-007` (ORTOGONAL) pasen — son los que validan el comportamiento clave.

**Sync con Dev B:** ninguna durante esta fase. Cada uno trabaja en su carpeta. Solo se reencuentran en Phase 6.

---

## CLU-REQ-001 — Value Object `ClusterType`

**Como** sistema
**Necesito** un tipo cerrado que enumere los tipos de cluster
**Para** que la entity valide el tipo en el factory.

**Criterios:**

- VO en `domain/value-objects/ClusterType.ts`.
- Constante: `CLUSTER_TYPES = ['predefined', 'heuristic-division', 'heuristic-grupo', 'heuristic-municipio'] as const`.
- Type: `ClusterType = typeof CLUSTER_TYPES[number]`.

---

## CLU-REQ-002 — Entity `Cluster`

**Como** sistema
**Necesito** una entity inmutable de cluster con factory que valide invariantes según tipo
**Para** que un cluster `'heuristic-grupo'` SIEMPRE tenga `ciiuGrupo` y un `'heuristic-division'` SIEMPRE tenga `ciiuDivision`.

**Criterios:**

- Entity en `domain/entities/Cluster.ts`.
- ID: `string` (formato según convención abajo).
- Props:
  - `codigo: string`
  - `titulo: string` (no vacío)
  - `descripcion: string | null`
  - `tipo: ClusterType`
  - `ciiuDivision: string | null` (requerido si `tipo` ∈ `{'heuristic-division', 'heuristic-grupo'}`)
  - `ciiuGrupo: string | null` (requerido SOLO si `tipo === 'heuristic-grupo'`; debe empezar por `ciiuDivision`)
  - `municipio: string | null`
  - `macroSector: string | null`
  - `memberCount: number` (default 0)
- Convención de IDs:
  - `predefined`: `pred-{clusterID}` (ej. `pred-7` para LOGISTICA)
  - `heuristic-division`: `div-{ciiuDivision}-{slug(municipio)}` (ej. `div-47-SANTA_MARTA`)
  - `heuristic-grupo`: `grp-{ciiuGrupo}-{slug(municipio)}` (ej. `grp-477-SANTA_MARTA`)
  - `heuristic-municipio`: `mun-{slug(municipio)}` (reservado, no usado en MVP)

---

## CLU-REQ-003 — Repositorios

**Como** sistema
**Necesito** tres ports distintos para gestionar clusters, membresías y mapeos predefinidos
**Para** separar responsabilidades.

**Criterios:**

- `ClusterRepository` (`CLUSTER_REPOSITORY`):
  - `findAll(): Promise<Cluster[]>`
  - `findById(id: string): Promise<Cluster | null>`
  - `findByType(tipo: ClusterType): Promise<Cluster[]>`
  - `saveMany(clusters: Cluster[]): Promise<void>` (upsert)
- `ClusterMembershipRepository` (`CLUSTER_MEMBERSHIP_REPOSITORY`):
  - `findClustersByCompany(companyId: string): Promise<string[]>` — IDs de clusters
  - `findCompaniesByCluster(clusterId: string): Promise<string[]>` — IDs de empresas
  - `saveMany(memberships: { clusterId: string; companyId: string }[]): Promise<void>`
  - `deleteByCluster(clusterId: string): Promise<void>` (para regenerar)
  - `snapshot(): Promise<Map<string, Set<string>>>` — usado por agente para detectar diffs
- `ClusterCiiuMappingRepository` (`CLUSTER_CIIU_MAPPING_REPOSITORY`):
  - `getCiiuToClusterMap(): Promise<Map<string, string[]>>` — `ciiuCode → clusterIds[]`
  - `saveMany(mappings: { clusterId: string; ciiuCode: string }[]): Promise<void>`
- Cada port tiene `Supabase*` (prod) e `InMemory*` (tests).

---

## CLU-REQ-004 — Servicio `HeuristicClusterer` (cascada 2 niveles)

**Como** sistema
**Necesito** generar clusters dinámicos a partir del listado de empresas
**Para** que aparezcan automáticamente nuevos clusters cuando se registren empresas (sin intervención humana).

**Criterios:**

- Servicio en `application/services/HeuristicClusterer.ts`.
- Constantes:
  - `MIN_DIVISION_SIZE = 5`
  - `MIN_GRUPO_SIZE = 10`
- Método: `cluster(companies: Company[]): Promise<{ cluster: Cluster; members: Company[] }[]>`.
- **Pase 1 — División:** agrupa por `(ciiuDivision, municipio)`, crea `heuristic-division` si grupo `>= 5`.
- **Pase 2 — Grupo:** agrupa por `(ciiuGrupo, municipio)`, crea `heuristic-grupo` si grupo `>= 10`.
- Los pases son **ortogonales** (independientes): no requiere que la división califique para crear el grupo.
- Títulos resueltos vía `CiiuTaxonomyRepository.findByDivision()` y `findByGrupo()`.
- `slug(municipio)`: normaliza acentos, espacios → `_`, mayúsculas.

---

## CLU-REQ-005 — Servicio `PredefinedClusterMatcher`

**Como** sistema
**Necesito** asignar empresas a los 8 clusters predefinidos según su CIIU
**Para** que las empresas pertenezcan automáticamente a clusters estratégicos sin asignación manual.

**Criterios:**

- Servicio en `application/services/PredefinedClusterMatcher.ts`.
- Método: `match(companies: Company[]): Promise<Map<string, Company[]>>` — clusterId → companies.
- Lee `cluster_ciiu_mapping` vía `ClusterCiiuMappingRepository`.
- Para cada empresa, mira su `ciiu` y agrega a todos los clusters predefinidos que mapean ese CIIU (una empresa puede caer en >1 cluster predefinido).

---

## CLU-REQ-006 — Use case `GenerateClusters`

**Como** seed inicial Y agente periódico
**Necesito** un use case que orqueste la generación completa de clusters
**Para** que los dos triggers usen la misma lógica.

**Criterios:**

- Use case en `application/use-cases/GenerateClusters.ts`.
- Lógica:
  1. Cargar todas las companies con `estado='ACTIVO'`.
  2. Correr `PredefinedClusterMatcher` → asignaciones a 8 clusters.
  3. Correr `HeuristicClusterer` → asignaciones a clusters dinámicos (división + grupo).
  4. Persistir `Cluster`s vía `ClusterRepository.saveMany`.
  5. Persistir `cluster_members` vía `ClusterMembershipRepository.saveMany` (después de `deleteByCluster` para regenerar limpio).
- Output: `{ predefinedClusters: number; heuristicClusters: number; totalMemberships: number }`.

---

## CLU-REQ-007 — Use cases de consulta

**Como** front Ruta C
**Necesito** consultar clusters por empresa y entender por qué pertenecen
**Para** justificar la pertenencia al usuario.

**Criterios:**

- `GetCompanyClusters({ companyId })` → retorna `Cluster[]` a los que pertenece la empresa.
- `ExplainCluster({ clusterId, companyId })` → retorna texto natural explicando por qué la empresa está en el cluster (puede usar Gemini para enriquecer).

---

## CLU-REQ-008 — Endpoints HTTP

**Como** front Ruta C y herramientas administrativas
**Necesito** consumir clusters vía REST
**Para** mostrar listados, detalles y disparar regeneración manual.

**Criterios:**

- Controller en `infrastructure/http/clusters.controller.ts`.
- Endpoints:
  - `GET /api/clusters` → lista todos (filtrable por `?tipo=...`)
  - `GET /api/clusters/:id` → detalle + miembros
  - `GET /api/clusters/by-company/:companyId` → clusters de una empresa
  - `POST /api/clusters/generate` → ejecuta `GenerateClusters`, retorna stats (admin)

---

## CLU-REQ-009 — Seeds para predefinidos

**Como** sistema
**Necesito** poblar los 8 clusters predefinidos y su mapeo CIIU desde los CSVs de la Cámara
**Para** que el matcher tenga datos al primer arranque.

**Criterios:**

- `seed-predefined-clusters.ts`: lee `CLUSTERS.csv`, crea `Cluster`s con `tipo='predefined'`, persiste vía `ClusterRepository`.
- `seed-cluster-mappings.ts`: lee `CLUSTERS_ACTIVIDADESECONOMICAS.csv`, crea mapeos `(clusterId, ciiuCode)`, persiste vía `ClusterCiiuMappingRepository`.
- Idempotentes (upsert).
