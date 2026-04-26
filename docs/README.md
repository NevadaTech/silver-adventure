# Documentación · Ruta C Conecta

> Índice navegable de toda la documentación del proyecto. El punto de entrada principal es el [README raíz](../README.md). Este archivo te guía por el resto.

---

## 🚀 Demos en vivo

| Servicio                 | URL                                                                  |
| ------------------------ | -------------------------------------------------------------------- |
| **Web (front)**          | https://silver-adventure-ecru.vercel.app/                            |
| **API (brain)**          | https://silver-adventure-9f6p.onrender.com                           |
| Health check             | https://silver-adventure-9f6p.onrender.com/api/health                |
| OpenAPI / Swagger        | https://silver-adventure-9f6p.onrender.com/docs                      |
| **Presentación (Canva)** | https://www.canva.com/design/DAHH-MPDRUw/qlkiz3qZdDTMThPTEIY8aw/view |

> ⚠️ El brain está en Render free tier — el primer request tras inactividad tarda 30–60s en despertar. Cargar `/api/health` primero.

---

## 1. Para el jurado del hackathon — leer en este orden

| Paso | Documento                                        | Para qué sirve                                                          |
| ---- | ------------------------------------------------ | ----------------------------------------------------------------------- |
| 1    | [`/README.md`](../README.md)                     | Narrativa del producto: qué es, para quién, qué lo diferencia           |
| 2    | [`documentacion.md`](documentacion.md)           | Documentación técnica del entregable (las 5 secciones que pide el reto) |
| 3    | [`scoring.md`](scoring.md)                       | Sistema de scoring de las recomendaciones — fórmulas, pesos, ejemplos   |
| 4    | [`/src/brain/README.md`](../src/brain/README.md) | Detalle del motor inteligente (IA, clusters, agente)                    |
| 5    | [`/src/front/README.md`](../src/front/README.md) | Detalle del front (pantallas, hooks, BFF)                               |
| 6    | [`postman/README.md`](postman/README.md)         | Colección Postman para probar la API end-to-end                         |
| 7    | [`/presentacion/`](../presentacion/)             | Slides de la presentación final                                         |

---

## 2. Documentación técnica del entregable

| Archivo                                | Contenido                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [`documentacion.md`](documentacion.md) | **Documento técnico oficial.** Cómo funciona, stack, herramientas de terceros, arquitectura, run. |
| [`scoring.md`](scoring.md)             | Fórmulas, pesos, thresholds y ejemplos numéricos del sistema de recomendaciones                   |

---

## 3. Reto y datos de partida

| Archivo                                                                                                                                                    | Contenido                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| [`hackathon/README.md`](hackathon/README.md)                                                                                                               | **Bases del reto** — template oficial entregado por la Cámara     |
| [`hackathon/RETO.pdf`](hackathon/RETO.pdf)                                                                                                                 | Documento original del reto                                       |
| [`hackathon/Ruta C Conecta_ Motor Inteligente de Clusters Empresariales.pdf`](<hackathon/Ruta C Conecta_ Motor Inteligente de Clusters Empresariales.pdf>) | Documento de profundización entregado por la Cámara               |
| [`hackathon/ANALISIS_RUTA_C_CONECTA.md`](hackathon/ANALISIS_RUTA_C_CONECTA.md)                                                                             | Análisis del reto previo a la construcción                        |
| [`hackathon/DATA/`](hackathon/DATA/)                                                                                                                       | Dataset de la Cámara (CIIU DIAN, registrados, clusters, mappings) |
| [`hackathon/DOCUMENTACION SOBRE CLUSTERS/`](<hackathon/DOCUMENTACION SOBRE CLUSTERS/>)                                                                     | Documentación de clusters provista por la Cámara                  |

---

## 4. Specs por bounded context

Cada contexto del brain tiene `requirements.md` (qué debe hacer) + `scenarios.md` (cómo se comporta). El índice está en [`specs/README.md`](specs/README.md).

| Contexto            | Requirements                                                                           | Scenarios                                                                        |
| ------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Arquitectura global | [`specs/00-arquitectura.md`](specs/00-arquitectura.md) — ARQ-001..010                  | —                                                                                |
| `shared`            | [`specs/01-shared/requirements.md`](specs/01-shared/requirements.md)                   | [`specs/01-shared/scenarios.md`](specs/01-shared/scenarios.md)                   |
| `ciiu-taxonomy`     | [`specs/02-ciiu-taxonomy/requirements.md`](specs/02-ciiu-taxonomy/requirements.md)     | [`specs/02-ciiu-taxonomy/scenarios.md`](specs/02-ciiu-taxonomy/scenarios.md)     |
| `companies`         | [`specs/03-companies/requirements.md`](specs/03-companies/requirements.md)             | [`specs/03-companies/scenarios.md`](specs/03-companies/scenarios.md)             |
| `clusters`          | [`specs/04-clusters/requirements.md`](specs/04-clusters/requirements.md)               | [`specs/04-clusters/scenarios.md`](specs/04-clusters/scenarios.md)               |
| `recommendations`   | [`specs/05-recommendations/requirements.md`](specs/05-recommendations/requirements.md) | [`specs/05-recommendations/scenarios.md`](specs/05-recommendations/scenarios.md) |
| `agent`             | [`specs/06-agent/requirements.md`](specs/06-agent/requirements.md)                     | [`specs/06-agent/scenarios.md`](specs/06-agent/scenarios.md)                     |

---

## 5. Planeación pre-construcción

Documentos de planeación del equipo previos al build. Reflejan el estado del **diseño**, no necesariamente el del código entregado (parte del scope inicial — WhatsApp, app móvil — quedó como roadmap).

| Archivo                                                                            | Contenido                                                        |
| ---------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| [`planeacion/01-alcance-mvp.md`](planeacion/01-alcance-mvp.md)                     | Alcance original del MVP                                         |
| [`planeacion/02-roles-equipo.md`](planeacion/02-roles-equipo.md)                   | Roles del equipo                                                 |
| [`planeacion/03-personas-y-canales.md`](planeacion/03-personas-y-canales.md)       | Cuatro personas y canales de entrega                             |
| [`planeacion/04-arquitectura.md`](planeacion/04-arquitectura.md)                   | Arquitectura propuesta (incluye decisiones que se simplificaron) |
| [`planeacion/05-motor-recomendaciones.md`](planeacion/05-motor-recomendaciones.md) | Motor de recomendaciones — diseño funcional                      |
| [`planeacion/06-cronograma-y-riesgos.md`](planeacion/06-cronograma-y-riesgos.md)   | Cronograma + riesgos                                             |
| [`planeacion/07-landing-stitch.md`](planeacion/07-landing-stitch.md)               | Plan del landing (Stitch)                                        |

> Para lo que efectivamente se construyó, ver [`documentacion.md`](documentacion.md), [`/src/front/README.md`](../src/front/README.md) y [`/src/brain/README.md`](../src/brain/README.md).

---

## 6. API y herramientas

| Archivo                                                                                                            | Contenido                                                |
| ------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| [`postman/README.md`](postman/README.md)                                                                           | Cómo importar la colección, variables, flujo recomendado |
| [`postman/silver-adventure-brain.postman_collection.json`](postman/silver-adventure-brain.postman_collection.json) | Colección Postman v2.1.0 con todas las rutas del brain   |
| OpenAPI live (con el brain corriendo)                                                                              | `http://localhost:3001/docs`                             |

---

## 7. Convenciones del repositorio

Las reglas del monorepo (arquitectura hexagonal, BFF estricto, path aliases, hooks de Git, env strategy, conventional commits, TDD) viven en [`/AGENTS.md`](../AGENTS.md). Esta es la fuente de verdad para cualquier agente humano o IA que toque este código.
