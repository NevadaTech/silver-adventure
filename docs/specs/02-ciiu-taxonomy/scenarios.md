# 02 — CIIU Taxonomy · Scenarios

---

## CIIU-SCN-001 — Crear `CiiuActivity` válida

**Given** los datos `{ code: '4711', seccion: 'G', division: '47', grupo: '471', tituloActividad: '...', tituloSeccion: '...', tituloDivision: '...', tituloGrupo: '...', macroSector: 'Comercio' }`
**When** se invoca `CiiuActivity.create(data)`
**Then** retorna una entity con todos los campos asignados
**And** `activity.code === '4711'` y `activity.division === '47'`.

---

## CIIU-SCN-002 — Factory rechaza código que no es 4 dígitos

**Given** los datos con `code: '47'`
**When** se invoca `CiiuActivity.create(data)`
**Then** lanza `Error('CiiuActivity.code must be exactly 4 digits')`.

---

## CIIU-SCN-003 — Factory rechaza inconsistencia entre code y division

**Given** los datos con `code: '4711'` y `division: '48'`
**When** se invoca `CiiuActivity.create(data)`
**Then** lanza `Error('division must match first 2 digits of code')`.

---

## CIIU-SCN-004 — Factory rechaza inconsistencia entre code y grupo

**Given** los datos con `code: '4711'` y `grupo: '472'`
**When** se invoca `CiiuActivity.create(data)`
**Then** lanza `Error('grupo must match first 3 digits of code')`.

---

## CIIU-SCN-005 — `findByCode` retorna actividad existente

**Given** la tabla `ciiu_taxonomy` contiene la fila con `code='4711'`
**When** se invoca `repo.findByCode('4711')`
**Then** retorna una `CiiuActivity` con esos datos.

---

## CIIU-SCN-006 — `findByCode` retorna null si no existe

**Given** la tabla `ciiu_taxonomy` no contiene `code='9999'`
**When** se invoca `repo.findByCode('9999')`
**Then** retorna `null`.

---

## CIIU-SCN-007 — `findByDivision` retorna todas las actividades de la división

**Given** la tabla contiene 12 filas con `division='47'`
**When** se invoca `repo.findByDivision('47')`
**Then** retorna 12 `CiiuActivity` distintas.

---

## CIIU-SCN-008 — `findByGrupo` retorna todas las actividades del grupo

**Given** la tabla contiene 4 filas con `grupo='471'`
**When** se invoca `repo.findByGrupo('471')`
**Then** retorna 4 `CiiuActivity`
**And** todas tienen `division === '47'` y `grupo === '471'`.

---

## CIIU-SCN-009 — Seed importa CSV DIAN sin duplicar al re-correr

**Given** la tabla `ciiu_taxonomy` está vacía
**And** el archivo `docs/hackathon/DATA/CIIU_DIAN.csv` contiene 700 filas válidas
**When** se ejecuta `bun --filter brain seed:ciiu-taxonomy`
**Then** la tabla queda con 700 filas.
**When** se ejecuta el mismo comando una segunda vez
**Then** la tabla SIGUE con 700 filas (upsert idempotente, no duplica).

---

## CIIU-SCN-010 — Seed skippea filas inválidas con log

**Given** un CSV de prueba con 5 filas, 1 inválida (code de 3 dígitos)
**When** se ejecuta el seed
**Then** la tabla queda con 4 filas
**And** se loggea un warning indicando la fila skippeada.

---

## CIIU-SCN-011 — Use case `FindCiiuByCode` orquesta el repo

**Given** un `InMemoryCiiuTaxonomyRepository` poblado con `'4711'`
**When** se invoca `findCiiuByCode.execute({ code: '4711' })`
**Then** retorna `{ activity: CiiuActivity }` con esos datos.
