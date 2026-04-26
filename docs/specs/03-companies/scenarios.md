# 03 — Companies · Scenarios

---

## CMP-SCN-001 — `EtapaCalculator` clasifica empresa nueva como nacimiento

**Given** una empresa con `fechaMatricula = hace 6 meses`, `personal = 2`, `ingreso = 50_000_000`
**When** se invoca `EtapaCalculator.calculate({...})`
**Then** retorna `'nacimiento'`.

---

## CMP-SCN-002 — `EtapaCalculator` clasifica empresa grande como madurez

**Given** una empresa con `fechaMatricula = hace 10 años`, `personal = 80`, `ingreso = 8_000_000_000`
**When** se invoca `EtapaCalculator.calculate({...})`
**Then** retorna `'madurez'`.

---

## CMP-SCN-003 — `EtapaCalculator` clasifica empresa mediana como consolidación

**Given** una empresa con `personal = 25`, `ingreso = 1_500_000_000`, `fechaMatricula = hace 5 años`
**When** se invoca `EtapaCalculator.calculate({...})`
**Then** retorna `'consolidacion'`.

---

## CMP-SCN-004 — Factory `Company.create` deriva ciiu_division y ciiu_grupo

**Given** input con `ciiu = 'G4711'`
**When** se invoca `Company.create(input)`
**Then** la entity resultante tiene:

- `ciiu === '4711'`
- `ciiuSeccion === 'G'`
- `ciiuDivision === '47'`
- `ciiuGrupo === '471'`

---

## CMP-SCN-005 — Factory `Company.create` rechaza CIIU sin sección

**Given** input con `ciiu = '4711'` (sin letra de sección)
**When** se invoca `Company.create(input)`
**Then** lanza error indicando que el CIIU debe tener prefijo de sección.

---

## CMP-SCN-006 — Factory `Company.create` rechaza razon_social vacía

**Given** input con `razonSocial = '   '`
**When** se invoca `Company.create(input)`
**Then** lanza `Error('Company.razonSocial cannot be empty')`.

---

## CMP-SCN-007 — `CsvCompanySource.fetchAll` carga el CSV completo

**Given** el archivo `REGISTRADOS_SII.csv` con ~10k filas válidas
**When** se invoca `csvCompanySource.fetchAll()`
**Then** retorna un array con > 9000 `Company` (algunas pueden skippearse por datos inválidos)
**And** cada `Company` tiene `ciiu` de 4 dígitos, `ciiuDivision` de 2 dígitos, `ciiuGrupo` de 3 dígitos.

---

## CMP-SCN-008 — `CsvCompanySource.fetchUpdatedSince` filtra por fechaRenovacion

**Given** el archivo CSV cargado
**When** se invoca `source.fetchUpdatedSince(new Date('2024-01-01'))`
**Then** retorna solo las empresas cuya `fechaRenovacion > '2024-01-01'`
**And** la cantidad es <= total.

---

## CMP-SCN-009 — `SyncCompaniesFromSource` sin `since` sincroniza todo

**Given** un `InMemoryCompanySource` con 100 empresas
**And** un `InMemoryCompanyRepository` vacío
**When** se invoca `useCase.execute()`
**Then** retorna `{ synced: 100 }`
**And** `repo.findAll()` retorna 100 empresas.

---

## CMP-SCN-010 — `SyncCompaniesFromSource` con `since` sincroniza solo modificadas

**Given** un `InMemoryCompanySource` con 100 empresas, 30 con `fechaRenovacion > '2026-01-01'`
**When** se invoca `useCase.execute({ since: new Date('2026-01-01') })`
**Then** retorna `{ synced: 30 }`.

---

## CMP-SCN-011 — Switch CSV → BigQuery es transparente para el use case

**Given** `SyncCompaniesFromSource` configurado con `CompanySource = CsvCompanySource`
**And** la misma instancia configurada con `CompanySource = BigQueryCompanySource` en otro test
**When** ambos casos invocan `execute()`
**Then** ambos retornan empresas válidas (los tests del use case son AGNÓSTICOS de la implementación)
**And** el use case NUNCA importa nada de `infrastructure/`.

---

## CMP-SCN-012 — Endpoint `GET /api/companies/:id` retorna 404 si no existe

**Given** la tabla `companies` no contiene `id = 'NONE'`
**When** el cliente hace `GET /api/companies/NONE`
**Then** la respuesta es HTTP 404 con body `{ "statusCode": 404, "message": "Not Found" }`.

---

## CMP-SCN-013 — Endpoint `GET /api/companies` retorna DTO sin props internas

**Given** una empresa en la tabla con todos los campos
**When** el cliente hace `GET /api/companies?limit=1`
**Then** la respuesta NO incluye `created_at`, `updated_at`, ni props raw del CSV
**And** SI incluye `id`, `razonSocial`, `ciiu`, `ciiuSeccion`, `ciiuDivision`, `municipio`, `etapa`, `personal`, `ingreso`.

---

## CMP-SCN-014 — Seed `seed-companies` es idempotente

**Given** la tabla `companies` está vacía
**When** se ejecuta `bun --filter brain seed:companies`
**Then** la tabla queda con N empresas (N = filas válidas del CSV).
**When** se ejecuta el mismo comando una segunda vez
**Then** la tabla SIGUE con N empresas (upsert por `id`).
