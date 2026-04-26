# 04 — Clusters · Scenarios

---

## CLU-SCN-001 — Factory `Cluster.create` rechaza heuristic-grupo sin ciiuGrupo

**Given** input con `tipo='heuristic-grupo'`, `ciiuDivision='47'`, `ciiuGrupo=null`
**When** se invoca `Cluster.create(input)`
**Then** lanza error indicando que `ciiuGrupo` es requerido para tipo `'heuristic-grupo'`.

---

## CLU-SCN-002 — Factory `Cluster.create` rechaza grupo que no pertenece a la división

**Given** input con `tipo='heuristic-grupo'`, `ciiuDivision='47'`, `ciiuGrupo='561'` (grupo 561 pertenece a división 56, no 47)
**When** se invoca `Cluster.create(input)`
**Then** lanza error indicando que `ciiuGrupo` debe empezar por `ciiuDivision`.

---

## CLU-SCN-003 — Factory `Cluster.create` acepta heuristic-grupo válido

**Given** input con `tipo='heuristic-grupo'`, `ciiuDivision='47'`, `ciiuGrupo='477'`, `municipio='SANTA MARTA'`
**When** se invoca `Cluster.create(input)`
**Then** retorna entity con `id='grp-477-SANTA_MARTA'`.

---

## CLU-SCN-004 — `HeuristicClusterer` PASE 1: división con >= 5 empresas crea cluster

**Given** 6 empresas con `(ciiuDivision='47', municipio='SANTA MARTA')`
**And** 3 empresas con `(ciiuDivision='49', municipio='SANTA MARTA')` (descartadas, < 5)
**When** se invoca `clusterer.cluster(companies)`
**Then** el resultado contiene exactamente 1 cluster `heuristic-division`
**And** ese cluster tiene `id='div-47-SANTA_MARTA'` y `members.length === 6`.

---

## CLU-SCN-005 — `HeuristicClusterer` PASE 2: grupo con >= 10 empresas crea cluster

**Given** 12 empresas con `(ciiuGrupo='477', municipio='SANTA MARTA')`
**And** 8 empresas con `(ciiuGrupo='476', municipio='SANTA MARTA')` (descartadas, < 10)
**When** se invoca `clusterer.cluster(companies)`
**Then** el resultado contiene exactamente 1 cluster `heuristic-grupo`
**And** ese cluster tiene `id='grp-477-SANTA_MARTA'` y `members.length === 12`.

---

## CLU-SCN-006 — CASCADA: empresa pertenece a cluster división Y grupo cuando ambos califican

**Given** 12 empresas con `(ciiuDivision='47', ciiuGrupo='477', municipio='SANTA MARTA')` (división califica con 12>=5, grupo califica con 12>=10)
**When** se invoca `clusterer.cluster(companies)`
**Then** el resultado contiene 2 clusters: 1 `heuristic-division` y 1 `heuristic-grupo`
**And** las 12 empresas son miembros de AMBOS clusters
**And** cada miembro del cluster grupo TAMBIÉN está en el cluster división.

---

## CLU-SCN-007 — ORTOGONAL: división califica pero ningún grupo individual llega a 10

**Given** 6 empresas con `(ciiuDivision='47', ciiuGrupo='471')` y 4 con `(ciiuDivision='47', ciiuGrupo='472')` en `'SANTA MARTA'`
**When** se invoca `clusterer.cluster(companies)`
**Then** el resultado contiene 1 cluster `heuristic-division` con 10 empresas
**And** 0 clusters `heuristic-grupo` (ningún grupo llegó a 10).

---

## CLU-SCN-008 — `PredefinedClusterMatcher` asigna empresa a cluster por CIIU

**Given** la tabla `cluster_ciiu_mapping` mapea `cluster_id='pred-7'` (LOGISTICA) ↔ `ciiu='4921'`
**And** 5 empresas con `ciiu='4921'`
**When** se invoca `matcher.match(companies)`
**Then** el resultado contiene `Map { 'pred-7' => [...5 empresas] }`.

---

## CLU-SCN-009 — Una empresa puede pertenecer a múltiples clusters predefinidos

**Given** la tabla `cluster_ciiu_mapping` mapea CIIU `'5611'` a clusters `'pred-7'` (LOGISTICA) y `'pred-8'` (TURISMO)
**And** 1 empresa con `ciiu='5611'`
**When** se invoca `matcher.match(companies)`
**Then** el resultado contiene la empresa en AMBOS clusters: `pred-7` y `pred-8`.

---

## CLU-SCN-010 — `GenerateClusters` regenera limpio (no acumula viejas membresías)

**Given** la tabla `cluster_members` contiene membresías de un scan anterior
**When** se ejecuta `GenerateClusters.execute()` con un nuevo set de empresas distinto
**Then** las membresías viejas son eliminadas (`deleteByCluster` previo)
**And** las nuevas son persistidas
**And** no quedan filas huérfanas.

---

## CLU-SCN-011 — `GenerateClusters` retorna stats correctas

**Given** 50 empresas con distintos CIIU/municipio/grupo
**When** se ejecuta `GenerateClusters.execute()`
**Then** retorna `{ predefinedClusters: P, heuristicClusters: H, totalMemberships: M }`
**And** `P === count(clusters predefinidos con al menos 1 miembro)`
**And** `H === count(clusters heurísticos creados — div + grp)`
**And** `M === count total de filas en cluster_members tras la persistencia`.

---

## CLU-SCN-012 — `GetCompanyClusters` retorna todos los clusters de una empresa

**Given** una empresa pertenece a `pred-7`, `div-47-SANTA_MARTA`, y `grp-477-SANTA_MARTA`
**When** se invoca `useCase.execute({ companyId: '123' })`
**Then** retorna 3 clusters con esos IDs.

---

## CLU-SCN-013 — Endpoint `POST /api/clusters/generate` ejecuta y retorna stats

**Given** la tabla `companies` tiene N empresas válidas
**When** un cliente hace `POST /api/clusters/generate`
**Then** la respuesta es HTTP 200 con body `{ predefinedClusters, heuristicClusters, totalMemberships }`.

---

## CLU-SCN-014 — Endpoint `GET /api/clusters?tipo=heuristic-grupo` filtra por tipo

**Given** la tabla `clusters` contiene clusters de los 4 tipos
**When** el cliente hace `GET /api/clusters?tipo=heuristic-grupo`
**Then** la respuesta contiene SOLO clusters con `tipo='heuristic-grupo'`.
