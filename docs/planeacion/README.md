# Planeación · Ruta C Conecta

> **Estado: pre-construcción.** Estos documentos son la **planeación funcional y técnica del equipo** previa al build. Se mantienen versionados como evidencia del proceso de diseño, pero **no describen necesariamente el estado final del código entregado**.
>
> Para lo que efectivamente se construyó en el MVP del hackathon ver:
>
> - [`/docs/documentacion.md`](../documentacion.md) — documentación técnica oficial del entregable.
> - [`/src/front/README.md`](../../src/front/README.md) — front Next.js 16 (qué pantallas, qué providers, cómo consume al brain).
> - [`/src/brain/README.md`](../../src/brain/README.md) — brain NestJS (motor IA, agente, clusters).
> - [`/docs/scoring.md`](../scoring.md) — fórmulas y pesos del scoring.

---

## Diferencias entre la planeación y lo entregado

Algunas piezas del scope inicial quedaron como **roadmap pos-hackathon** porque el tiempo de la competencia priorizó construir el **componente exigido por el reto** (motor inteligente + agente) sobre los canales adicionales:

| Pieza planeada                                            | Estado en el MVP            | Dónde queda                                                        |
| --------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------ |
| Motor de clusters (predefinidos + heurísticos en cascada) | ✅ Construido               | `src/brain/src/clusters/`                                          |
| Motor de recomendaciones AI-first                         | ✅ Construido               | `src/brain/src/recommendations/`                                   |
| Agente Conector (cron + eventos)                          | ✅ Construido               | `src/brain/src/agent/`                                             |
| Web del empresario formal                                 | ✅ Construido (5 pantallas) | `src/front/app/[locale]/app/`                                      |
| Onboarding asistido (registro guiado)                     | ✅ Construido               | `src/front/app/[locale]/registro/` + `POST /api/companies/onboard` |
| Stack consolidado en NestJS + Gemini                      | ✅ Decidido                 | Reemplaza opción Python/FastAPI/Vertex AI de la planeación         |
| Canal WhatsApp para informales                            | 🟡 Roadmap                  | Diseñado en [`03-personas-y-canales.md`](03-personas-y-canales.md) |
| App móvil para promotores (captura voz)                   | 🟡 Roadmap                  | Diseñada en [`03-personas-y-canales.md`](03-personas-y-canales.md) |
| Panel administrativo extendido                            | 🟡 Roadmap                  | Diseñado en [`01-alcance-mvp.md`](01-alcance-mvp.md)               |
| Switch a BigQuery real                                    | ⚙️ Ready (port abstracto)   | Una línea en `companies.module.ts` cuando lleguen las creds        |

---

## Documentos del equipo

| Archivo                                                      | Contenido                                                                  |
| ------------------------------------------------------------ | -------------------------------------------------------------------------- |
| [`01-alcance-mvp.md`](01-alcance-mvp.md)                     | Alcance del MVP — hipótesis, qué entra, qué queda afuera                   |
| [`02-roles-equipo.md`](02-roles-equipo.md)                   | Roles, ownerships, dependencias entre roles                                |
| [`03-personas-y-canales.md`](03-personas-y-canales.md)       | Cuatro personas (formal, informal, promotor, coordinación) y sus canales   |
| [`04-arquitectura.md`](04-arquitectura.md)                   | Arquitectura propuesta — tres capas + agente Conector                      |
| [`05-motor-recomendaciones.md`](05-motor-recomendaciones.md) | Diseño del motor — features, lógicas de matching, explicabilidad           |
| [`06-cronograma-y-riesgos.md`](06-cronograma-y-riesgos.md)   | Cronograma día por día, riesgos con mitigación, guion del demo             |
| [`07-landing-stitch.md`](07-landing-stitch.md)               | Diseño de la landing en Stitch (referencia para implementación en Next.js) |
