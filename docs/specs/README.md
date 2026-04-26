# Specs · Motor Inteligente de Clusters Empresariales

> **Spec-driven development** del `brain` (NestJS) para el reto Hackathon Samatech "Ruta C Conecta".
>
> Esta carpeta contiene la **definición funcional y técnica** organizada por bounded context.
>
> **Nota sobre rutas REST.** Algunos requirements / scenarios de la era pre-build mencionan rutas que durante la implementación se renombraron por cohesión (p. ej. `GET /api/recommendations/by-company/:id` quedó como `GET /api/companies/:id/recommendations`). La fuente de verdad de los endpoints reales son los controllers en `src/brain/src/**/infrastructure/http/` y la sección 4.5 de [`docs/documentacion.md`](../documentacion.md). La colección [Postman](../postman/) está alineada con los endpoints actuales.

---

## Cómo está organizado

```
docs/specs/
├── README.md                          ← este archivo
├── 00-arquitectura.md                 ← decisiones cross-cutting (ARQ-001..ARQ-010)
├── 01-shared/                         ← infraestructura compartida
│   ├── requirements.md
│   └── scenarios.md
├── 02-ciiu-taxonomy/                  ← taxonomía DIAN
├── 03-companies/                      ← empresas + CompanySource port (BQ-readiness)
├── 04-clusters/                       ← clustering en cascada (predefinido + heurístico)
├── 05-recommendations/                ← motor AI-first con fallback
└── 06-agent/                          ← componente agéntico (cron 60s)
```

Cada bounded context tiene:

- **`requirements.md`** — qué debe hacer el sistema, criterios de aceptación, prefijo de IDs.
- **`scenarios.md`** — Given/When/Then ejecutables (origen de los tests TDD).

---

## Convención de identificadores

Cada requirement y scenario tiene un ID único formato `{PREFIX}-{TYPE}-{NUM}`:

| Bounded context | Prefijo | Ejemplo                           |
| --------------- | ------- | --------------------------------- |
| Arquitectura    | `ARQ`   | `ARQ-005` (clustering en cascada) |
| Shared          | `SHR`   | `SHR-REQ-003`, `SHR-SCN-005`      |
| CIIU Taxonomy   | `CIIU`  | `CIIU-REQ-002`, `CIIU-SCN-008`    |
| Companies       | `CMP`   | `CMP-REQ-005`, `CMP-SCN-011`      |
| Clusters        | `CLU`   | `CLU-REQ-004`, `CLU-SCN-006`      |
| Recommendations | `REC`   | `REC-REQ-006`, `REC-SCN-014`      |
| Agent           | `AGT`   | `AGT-REQ-005`, `AGT-SCN-007`      |

`REQ` = Requirement. `SCN` = Scenario.

---

## Orden de lectura recomendado

### Si recién entrás al proyecto:

1. **`00-arquitectura.md`** — entendé las 10 decisiones cross-cutting (BQ-readiness, hexagonal, AI-first, cascada de clusters, TDD).
2. **`02-ciiu-taxonomy/`** — la taxonomía DIAN es prerequisito conceptual de todo.
3. **`03-companies/`** — el modelo central + el port `CompanySource` (cómo se va a conectar a BigQuery).
4. **`04-clusters/`** — clustering jerárquico en cascada (división MIN=5 + grupo MIN=10).
5. **`05-recommendations/`** — el corazón del motor (AI-first + 3 fallbacks).
6. **`06-agent/`** — orquestación periódica de todo lo anterior.
7. **`01-shared/`** — al final porque es plumería que soporta todo lo demás.

### Si vas a implementar:

Lee el plan detallado: **`../2026-04-25-brain-clustering-engine-implementation.md`**.
Ese plan tiene las 8 phases con tasks TDD listas para checkbox.

---

## Trazabilidad: requirement → plan → código → test

Cada requirement debería poder rastrearse a:

| Layer      | Dónde aparece                                                                   |
| ---------- | ------------------------------------------------------------------------------- |
| **Spec**   | Este folder (`docs/specs/{context}/requirements.md`)                            |
| **Plan**   | `docs/2026-04-25-brain-clustering-engine-implementation.md` (Phase X, Task X.Y) |
| **Código** | `src/brain/src/{context}/...`                                                   |
| **Test**   | `src/brain/__tests__/{context}/...`                                             |

Si encontrás un requirement sin counterpart en el plan, o un task del plan sin spec → es un bug del proceso. Reportar.

---

## Reglas de oro (del reto + nuestras decisiones)

1. **El motor debe ser FUNCIONAL** (no conceptual). Cada feature en specs DEBE tener implementación que corra.
2. **Los resultados DEBEN poder explicarse.** Razones estructuradas (no texto libre del LLM como única evidencia).
3. **Arquitectura desacoplada.** El brain expone API REST consumible desde Laravel. Nada acoplado.
4. **El agente DEBE correr sin intervención humana.** Cron real, no "botón demo".
5. **TDD estricto.** Test failing primero, código mínimo, refactor. Ver `ARQ-007`.
6. **BQ-readiness obligatoria.** Hoy CSV (mock); el día que llegue BQ, una línea cambia. Ver `ARQ-002`.

---

## División del trabajo, orden y prerequisitos (2 devs)

### Tabla maestra

| #      | Spec                           | Phase         | Owner                                | Depende de                                        | Paralelizable con               | Bloqueante | Estimación |
| ------ | ------------------------------ | ------------- | ------------------------------------ | ------------------------------------------------- | ------------------------------- | ---------- | ---------- |
| 0      | `00-arquitectura.md`           | —             | 🟡 lectura previa de los DOS devs    | —                                                 | —                               | ❌         | 30 min     |
| 1      | `01-shared/`                   | **1**         | 🟡 PAIR                              | Phase 0 (deps + env + schema SQL)                 | — (es base)                     | ✅ **SÍ**  | ~1 día     |
| 2      | `02-ciiu-taxonomy/`            | **2**         | 🟡 PAIR                              | `01-shared` + descarga manual CSV DIAN (Task 0.4) | —                               | ✅ **SÍ**  | ~½ día     |
| 3      | `03-companies/`                | **3**         | 🟡 PAIR                              | `01-shared` + `02-ciiu-taxonomy`                  | —                               | ✅ **SÍ**  | ~1.5 días  |
| **🚀** | **PUNTO DE BIFURCACIÓN**       | —             | —                                    | —                                                 | —                               | —          | —          |
| 4      | `04-clusters/`                 | **4**         | 🔵 **DEV A**                         | `01`, `02`, `03`                                  | ✅ **`05-recommendations`**     | ❌ NO      | ~1.5 días  |
| 5      | `05-recommendations/`          | **5**         | 🟢 **DEV B**                         | `01`, `02`, `03`                                  | ✅ **`04-clusters`**            | ❌ NO      | ~2.5 días  |
| 6a     | `06-agent/` (6.1, 6.2, 6.5)    | **6** parcial | 🔵 DEV A (en paralelo a Phase 4)     | `01`, `03`                                        | ✅ con Phase 4 del propio Dev A | ❌ NO      | ½ día      |
| **🚨** | **PUNTO DE RE-SINCRONIZACIÓN** | —             | —                                    | —                                                 | —                               | —          | —          |
| 6b     | `06-agent/` (6.3, 6.4)         | **6**         | quien termine antes (probable Dev A) | `04`, `05` completos                              | —                               | ✅ **SÍ**  | ½ día      |
| 6c     | `06-agent/` (6.6, 6.7)         | **6**         | pair                                 | `06b`                                             | —                               | ❌         | 2h         |
| 7      | seeds (Tasks 7.1-7.4)          | **7**         | dividir por CSV                      | contexto correspondiente                          | parcial entre devs              | parcial    | ½ día      |
| 8      | wiring + E2E + README          | **8**         | pair                                 | TODO                                              | —                               | ✅ **SÍ**  | ½ día      |

### Cómo leer esta tabla

- **🟡 PAIR**: los dos devs trabajan juntos (pair programming, o se reparten tasks chicas alternadas).
- **🔵 DEV A**: track Clustering. Foco en `04-clusters` + skeleton de Agent.
- **🟢 DEV B**: track Recommendations. Foco 100% en `05-recommendations`.
- **Paralelizable con**: este spec puede avanzar al mismo tiempo que el otro indicado, en otra rama o carpeta sin pisarse.
- **Bloqueante**: si esta fase no termina, NADIE puede avanzar a la siguiente del camino crítico.

### Línea de tiempo realista

```
Día 1     Día 2     Día 3     Día 4     Día 5     Día 6
│
├─ Phase 0 (½d) ── Phase 1 (1d) ──────────┐
│  PAIR             PAIR                   │
│                                          │
├──────────────── Phase 2 (½d) ────────────┤
│                  PAIR                    │
│                                          │
├──────────────────── Phase 3 (1.5d) ──────┤
│                     PAIR                 │
│                                          │
│                              🚀 BIFURCACIÓN
│                              │
├──────────────────────────────┼─ Phase 4 + 6a (Dev A, ~2d) ──┐
│                              │                              │
├──────────────────────────────┼─ Phase 5     (Dev B, ~2.5d) ─┤
│                              │                              │
│                              🚨 RE-SYNC en Phase 6b ────────┤
│                                                             │
├─────────────────────── Phase 6b + 6c + 7 + 8 (pair, 1d) ────┤
│
✅ MVP listo
```

**Total estimado: ~5-6 días** para 2 devs con sesiones full-time. Para hackathon de fin de semana, ajustar usando solo el subset crítico (skipear 04 cluster predefinidos, usar AI siempre on, simplificar agent a un solo trigger).

### Reglas para evitar conflictos entre devs

1. **Cada dev en su carpeta** — `04-clusters/` es de Dev A, `05-recommendations/` es de Dev B. No se tocan.
2. **`shared/` solo se modifica en Phase 1** (PAIR). Si un dev necesita algo nuevo en shared después → comunica al otro y se decide juntos.
3. **`02-ciiu-taxonomy` también cerrado en Phase 2** — si Dev A o B necesita un método nuevo en `CiiuTaxonomyRepository`, se acuerda y se agrega al port juntos (tipo `findByGrupo` que pidió Clusters).
4. **El plan está versionado** (`docs/2026-04-25-brain-clustering-engine-implementation.md`) — si alguien lo cambia, commitea como `docs(plan): ...` para que el otro vea la diff.

Detalle de cada task individual: ver el plan de implementación.

---

## Documentos relacionados

- **Reto original**: `docs/hackathon/RETO.pdf` y `docs/hackathon/README.md`
- **Plan de implementación**: `docs/2026-04-25-brain-clustering-engine-implementation.md`
- **Convenciones del repo**: `AGENTS.md` (root)
