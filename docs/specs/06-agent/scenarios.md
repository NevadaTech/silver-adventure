# 06 — Agent · Scenarios

---

## AGT-SCN-001 — Factory `ScanRun.start` inicializa con status='running'

**Given** input `{ id: uuid, trigger: 'cron' }`
**When** se invoca `ScanRun.start(input)`
**Then** retorna entity con `status='running'`, `startedAt = now`, `completedAt = null`, todas las métricas en 0.

---

## AGT-SCN-002 — `ScanRun.complete` actualiza status y métricas inmutablemente

**Given** un `ScanRun` con `status='running'`
**When** se invoca `run.complete({ companiesScanned: 10, clustersGenerated: 3, recommendationsGenerated: 50, eventsEmitted: 5 })`
**Then** retorna una NUEVA instancia con esas métricas y `status='completed'`, `completedAt = now`, `durationMs` calculado.
**And** el `ScanRun` original NO fue mutado.

---

## AGT-SCN-003 — `OpportunityDetector` emite evento new_high_score_match para rec nueva con score >= 0.8

**Given** `previousRecKeys` no contiene `'A|B|cliente'`
**And** `newRecs` contiene una rec con `(source='A', target='B', type='cliente', score=0.85)`
**When** se invoca `detector.detect(newRecs, previousRecKeys, ...)`
**Then** retorna 1 evento con `eventType='new_high_score_match'` y `companyId='A'`.

---

## AGT-SCN-004 — `OpportunityDetector` NO emite evento si rec ya existía antes

**Given** `previousRecKeys` contiene `'A|B|cliente'`
**And** `newRecs` contiene la misma rec
**When** se invoca `detector.detect(...)`
**Then** retorna 0 eventos para ese par.

---

## AGT-SCN-005 — `OpportunityDetector` emite new_cluster_member solo cuando es nuevo

**Given** `previousMemberships` mapea `'A' → {'div-47-SM'}`
**And** `newMemberships` mapea `'A' → {'div-47-SM', 'grp-477-SM'}`
**When** se invoca `detector.detect(...)`
**Then** retorna 1 evento `new_cluster_member` para empresa `'A'` con cluster `'grp-477-SM'`.

---

## AGT-SCN-006 — `RunIncrementalScan` salta scan vacío sin regenerar todo

**Given** un `ScanRun` previo con `completedAt='ayer'`
**And** `companyRepo.findUpdatedSince(ayer)` retorna `[]`
**When** se ejecuta `RunIncrementalScan.execute({ trigger: 'cron' })`
**Then** se persiste un `ScanRun` con `status='completed'` y todas las métricas en 0
**And** NO se invoca `generateClusters` ni `generateRecs`.

---

## AGT-SCN-007 — `RunIncrementalScan` sincroniza desde CompanySource ANTES de escanear

**Given** un `InMemoryCompanySource` con 50 empresas (10 nuevas vs scan anterior)
**When** se ejecuta `RunIncrementalScan.execute({ trigger: 'cron' })`
**Then** `syncCompanies.execute({ since })` es invocado PRIMERO
**And** después de eso `companyRepo.findUpdatedSince(since)` retorna las 10 nuevas
**And** se procede con generateClusters → generateRecs → detect.

---

## AGT-SCN-008 — `RunIncrementalScan` marca status='failed' si una etapa tira excepción

**Given** `generateClusters.execute()` lanza `new Error('boom')`
**When** se ejecuta `RunIncrementalScan.execute({ trigger: 'manual' })`
**Then** se persiste un `ScanRun` con `status='failed'` y `errorMessage='boom'`
**And** la excepción se propaga al caller.

---

## AGT-SCN-009 — `AgentScheduler` no ejecuta si AGENT_ENABLED=false

**Given** `env.AGENT_ENABLED='false'`
**When** el cron tick dispara el método del scheduler
**Then** se loggea `[Agent] Disabled, skipping scan` y NO se invoca `RunIncrementalScan`.

---

## AGT-SCN-010 — `AgentScheduler` skippea tick si scan anterior sigue corriendo

**Given** un scan está actualmente en `status='running'` (mock con delay)
**When** el cron tick dispara nuevamente
**Then** se loggea `[Agent] Previous scan still running, skipping tick`
**And** NO se inicia un segundo scan.

---

## AGT-SCN-011 — Endpoint `POST /api/agent/scan/trigger` corre scan manual

**Given** el agente está deployed
**When** un cliente hace `POST /api/agent/scan/trigger`
**Then** se ejecuta `RunIncrementalScan({ trigger: 'manual' })` síncronamente
**And** la respuesta incluye `{ runId, status, companiesScanned, ... }`.

---

## AGT-SCN-012 — Endpoint `GET /api/agent/events/:companyId?unread=true` filtra unread

**Given** una empresa tiene 5 eventos: 3 unread, 2 read
**When** el cliente hace `GET /api/agent/events/COMP_ID?unread=true`
**Then** retorna solo los 3 unread.

---

## AGT-SCN-013 — `MarkEventAsRead` cambia el flag

**Given** un evento con `read=false`
**When** se invoca `useCase.execute({ eventId })`
**Then** la fila correspondiente queda con `read=true`.

---

## AGT-SCN-014 — Cron real: dos ticks consecutivos generan dos `ScanRun`

**Given** `AGENT_CRON_SCHEDULE='*/2 * * * * *'` (cada 2 segundos para test)
**And** el server arrancado con `AGENT_ENABLED=true`
**When** transcurren 5 segundos
**Then** la tabla `scan_runs` contiene al menos 2 filas con `trigger='cron'`.
