# 06 — Agent · Requirements

> El componente **agéntico** del sistema. Corre periódicamente sin intervención humana, detecta cambios en el dataset y genera/actualiza clusters, recomendaciones y eventos.
>
> Cumple con el componente "agéntico" exigido por el reto (sección 3 del README del reto).
>
> Aplica `ARQ-001`, `ARQ-002` (sync vía CompanySource), `ARQ-006` (cron 60s), `ARQ-007`.

---

## Metadata de implementación

| Campo                | Valor                                                                                                                                   |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Orden**            | **Phase 6**                                                                                                                             |
| **Owner**            | ⚪ **HÍBRIDO** (ver tabla detallada abajo)                                                                                              |
| **Depende de**       | `01-shared`, `03-companies` (SyncCompaniesFromSource), `04-clusters` (GenerateClusters), `05-recommendations` (GenerateRecommendations) |
| **Prerrequisito de** | nadie (es el último contexto)                                                                                                           |
| **Paralelizable**    | ⚠️ **PARCIALMENTE** — algunas tasks sí, otras requieren sync                                                                            |
| **Bloqueante**       | ❌ NO bloquea otros contextos, pero requiere que TODO esté listo                                                                        |
| **Tasks del plan**   | Task 6.1 → 6.7                                                                                                                          |
| **Estimación**       | ~1.5 días                                                                                                                               |

### División fina por task

| Task                                 | Owner               | Paralelizable con | Notas                                                                   |
| ------------------------------------ | ------------------- | ----------------- | ----------------------------------------------------------------------- |
| 6.1 ScanRun + AgentEvent entities    | 🔵 Dev A            | Phase 4 de Dev A  | Mientras Dev A hace clusters, puede ir entidades del agente en paralelo |
| 6.2 ScanRunRepo + AgentEventRepo     | 🔵 Dev A            | Phase 4 de Dev A  | Self-contained                                                          |
| 6.5 AgentScheduler @Cron             | 🔵 Dev A            | Phase 4 de Dev A  | Skeleton sin lógica del scan                                            |
| **6.3 OpportunityDetector**          | 🟢 Dev B            | —                 | **Necesita Recommendations terminado**                                  |
| **6.4 RunIncrementalScan**           | quien termine antes | —                 | **🚨 PUNTO DE SYNC: ambos devs deben haber terminado sus pistas**       |
| 6.6 GetAgentEvents + MarkEventAsRead | quien quiera        | —                 | Triviales                                                               |
| 6.7 AgentController + Module         | pair                | —                 | Wiring final                                                            |

**🚨 Punto de re-sincronización (Task 6.4):** acá los dos devs vuelven a juntarse. El `RunIncrementalScan` orquesta TODO (sync companies → generate clusters → generate recs → detect opportunities). Probablemente lo arme Dev A si terminó Phase 4 antes que Dev B termine Phase 5.

---

## AGT-REQ-001 — Entity `ScanRun`

**Como** sistema
**Necesito** una entity que represente cada ejecución del agente
**Para** auditar runs (kind, status, métricas) y para que el front muestre actividad del agente.

**Criterios:**

- Entity en `domain/entities/ScanRun.ts`.
- ID: `uuid`.
- Props:
  - `startedAt: Date`
  - `completedAt: Date | null`
  - `companiesScanned: number`
  - `clustersGenerated: number`
  - `recommendationsGenerated: number`
  - `eventsEmitted: number`
  - `status: 'running' | 'completed' | 'failed' | 'partial'`
  - `trigger: 'cron' | 'manual'`
  - `errorMessage: string | null`
  - `durationMs: number | null`
- Métodos:
  - `static start({ id, trigger }): ScanRun`
  - `complete(stats): ScanRun` (retorna nueva instancia con `status='completed'`)
  - `fail(message: string): ScanRun`
  - `markPartial(stats, message): ScanRun`

---

## AGT-REQ-002 — Entity `AgentEvent`

**Como** sistema
**Necesito** una entity que represente cada oportunidad detectada
**Para** que el front la muestre como notificación al usuario.

**Criterios:**

- Entity en `domain/entities/AgentEvent.ts`.
- ID: `uuid`.
- Props:
  - `companyId: string` (a quién va dirigido)
  - `eventType: 'new_high_score_match' | 'new_value_chain_partner' | 'new_cluster_member'`
  - `payload: object` (detalles específicos del evento)
  - `read: boolean` (default `false`)
  - `createdAt: Date`
- Factory `AgentEvent.create({...})`.

---

## AGT-REQ-003 — Repositorios

**Criterios:**

- `ScanRunRepository` (`SCAN_RUN_REPOSITORY`):
  - `save(run: ScanRun): Promise<void>` (upsert por id)
  - `findLatestCompleted(): Promise<ScanRun | null>` — para calcular `since` del próximo scan
  - `findRecent(limit: number): Promise<ScanRun[]>` — para dashboard admin
- `AgentEventRepository` (`AGENT_EVENT_REPOSITORY`):
  - `saveAll(events: AgentEvent[]): Promise<void>`
  - `findUnreadByCompany(companyId: string): Promise<AgentEvent[]>`
  - `markAsRead(eventId: string): Promise<void>`
- Cada port tiene `Supabase*` e `InMemory*`.

---

## AGT-REQ-004 — Servicio `OpportunityDetector`

**Como** orquestador del agente
**Necesito** detectar qué cambió entre el estado anterior y el actual
**Para** generar eventos solo de cosas NUEVAS (no spammear con eventos repetidos).

**Criterios:**

- Servicio en `application/services/OpportunityDetector.ts`.
- Método: `detect(newRecs, previousRecKeys, newMemberships, previousMemberships): AgentEvent[]`.
- Reglas de detección:
  - **`new_high_score_match`**: rec con `score >= 0.8` que NO existía en `previousRecKeys`.
  - **`new_value_chain_partner`**: rec con `relationType ∈ {cliente, proveedor}` que NO existía antes.
  - **`new_cluster_member`**: empresa que entró a un cluster en el que no estaba antes.
- Cada evento tiene un `companyId` (a quién notificar — generalmente el `sourceCompanyId`).

---

## AGT-REQ-005 — Use case `RunIncrementalScan` (orquestación principal)

**Como** sistema agéntico
**Necesito** un use case que orqueste todo el ciclo del scan
**Para** que cron y trigger manual usen la misma lógica.

**Criterios:**

- Use case en `application/use-cases/RunIncrementalScan.ts`.
- Input: `{ trigger: 'cron' | 'manual' }`.
- Lógica:
  1. Crear `ScanRun.start()`, persistir.
  2. Calcular `since = lastCompletedRun?.completedAt ?? new Date(0)`.
  3. **Sync desde `CompanySource`** (port — ARQ-002): `syncCompanies.execute({ since })`.
     - HOY: `CsvCompanySource` lee CSV.
     - MAÑANA (con creds del reto): `BigQueryCompanySource` query incremental a BQ.
     - El use case NO se entera de cuál corre.
  4. Verificar si hay empresas updated: si `0` y NO es el primer run → completar scan vacío y salir.
  5. Snapshot del estado anterior: `recRepo.snapshotKeys()` y `membershipRepo.snapshot()`.
  6. Regenerar clusters: `generateClusters.execute()`.
  7. Regenerar recommendations: `generateRecs.execute({})`.
  8. Detectar oportunidades: `opportunityDetector.detect(...)`.
  9. Persistir eventos: `eventRepo.saveAll(events)`.
  10. Marcar `ScanRun.complete(stats)`, persistir.
- Manejo de errores: try/catch alrededor de los pasos 6-9; si falla → `ScanRun.fail(message)`, persistir, propagar.

---

## AGT-REQ-006 — Servicio `AgentScheduler` con `@Cron`

**Como** sistema
**Necesito** disparar `RunIncrementalScan` periódicamente sin intervención humana
**Para** cumplir con el componente agéntico del reto (sección 3).

**Criterios:**

- Servicio en `infrastructure/scheduler/AgentScheduler.ts`.
- Usa `@nestjs/schedule` con `@Cron(env.AGENT_CRON_SCHEDULE)` (default `*/60 * * * * *`).
- Si `env.AGENT_ENABLED='false'` → método NO ejecuta nada (early return con log).
- Loggea: `Scan triggered`, `Scan completed in Xms`, `Scan failed: ...`.
- Concurrencia: si un scan está running, el siguiente tick LO SKIPPEA (no se solapan).

---

## AGT-REQ-007 — Use cases adicionales

**Criterios:**

- `GetAgentEvents({ companyId, onlyUnread? })`: retorna eventos para mostrar en el front.
- `MarkEventAsRead({ eventId })`: actualiza `read=true`.

---

## AGT-REQ-008 — Endpoints HTTP

**Criterios:**

- Controller en `infrastructure/http/agent.controller.ts`.
- Endpoints:
  - `GET /api/agent/events/:companyId?unread=true`
  - `POST /api/agent/events/:eventId/read`
  - `POST /api/agent/scan/trigger` → dispara `RunIncrementalScan({ trigger: 'manual' })` (admin)
  - `GET /api/agent/scans/recent?limit=10` → últimos runs (admin/observabilidad)

---

## AGT-REQ-009 — Observabilidad mínima

**Como** equipo
**Necesito** ver qué hace el agente
**Para** debuggear y demostrar al jurado que corre solo.

**Criterios:**

- Cada `ScanRun` queda persistida (auditable).
- Logs claros vía `Logger` (no `console.*`):
  - `[Agent] Scan started (trigger=cron, runId=...)`
  - `[Agent] Synced N companies from source`
  - `[Agent] Generated N clusters`
  - `[Agent] Generated N recommendations`
  - `[Agent] Emitted N events`
  - `[Agent] Scan completed in Xms`
- En modo demo (jurado): bajar `AGENT_CRON_SCHEDULE` a `*/30 * * * * *` para ver acción más rápido.
