# Ruta C Conecta

### Motor inteligente de clusters empresariales y recomendaciones accionables

> Una iniciativa de la Cámara de Comercio de Santa Marta para conectar la
> economía formal e informal del Magdalena en una sola red activa.

---

## La idea

Santa Marta tiene una economía mucho más grande de lo que cualquier base de datos refleja hoy. Por cada empresario formalmente registrado en Ruta C, hay decenas de comerciantes informales que mueven la economía real todos los días: vendedoras de mercado, pescadores en Taganga, artesanas en Bastidas, mototaxistas en Pescaíto, cocineras de almuerzos ejecutivos, tenderos de barrio.

Ruta C Conecta es un sistema que entiende quién hace qué en Santa Marta — formales e informales — y cada día conecta a la persona correcta con la oportunidad correcta, en el canal que esa persona ya usa.

El comerciante formal entra por la web. El informal entra por WhatsApp o por una promotora con un celular en el mercado. La inteligencia es la misma para todos. Lo que cambia es la puerta.

---

## El problema

Ruta C, hoy, es una base de datos rica que se quedó estancada.

La plataforma sabe quién es cada empresario formal, qué etapa atraviesa, en qué programas ha participado y qué dijo en su diagnóstico. Pero esa información solo viaja hacia adentro: sirve para que la Cámara reporte, no para que el empresario reciba valor de vuelta. Por eso la mayoría llena el diagnóstico una vez y nunca regresa.

Y al mismo tiempo, hay un vacío más grande: la economía informal. El sistema no sabe que una vendedora de empanadas frente a un edificio de oficinas podría surtir 12 almuerzos diarios a tres empresas que están a cuatro cuadras buscando proveedores. No los conecta porque no sabe que la vendedora existe. La vendedora, por su parte, no se considera "empresaria", no tiene RUT y no va a aprender una aplicación nueva. Pero sí tiene WhatsApp.

Cuatro fricciones se repiten:

- **Asimetría de información**: cada empresario solo conoce a quien tiene cerca o a quien ya conocía.
- **Dificultad de descubrimiento**: aunque quisiera buscar, una base de datos plana no responde "¿quién me conviene?".
- **Falta de confianza**: un contacto frío no funciona; necesita contexto ("están en el mismo programa", "tres pares parecidos a ti ya trabajan con esa persona").
- **Parálisis de acción**: una recomendación sin siguiente paso claro se queda en pantalla.

Ruta C Conecta resuelve las cuatro al mismo tiempo.

---

## Para quién es

La solución existe para cuatro tipos de personas. Cada una entra al sistema por una puerta distinta y recibe valor de una forma distinta.

| Persona                   | Quién es                                               | Cómo entra                                     | Qué recibe                                                                                        |
| ------------------------- | ------------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Comerciante informal      | Vendedoras, pescadores, artesanas, cocineras, tenderos | WhatsApp o registro asistido por una promotora | Oportunidades de negocio reales sin tener que descargar nada                                      |
| Empresario formal         | Registrado en Ruta C, etapa de crecimiento o madurez   | Web de escritorio                              | Recomendaciones de proveedores, clientes, aliados y referentes con explicación clara de por qué   |
| Promotor de la Cámara     | Asesores que trabajan en territorio                    | App móvil                                      | Capacidad de registrar a un comerciante en menos de un minuto, usando voz en lugar de formularios |
| Coordinación de la Cámara | Equipo institucional que reporta impacto               | Panel administrativo                           | Trazabilidad del sistema, métricas de conexiones, mapa de la economía real de Santa Marta         |

El beneficiario principal es el **comerciante informal**, porque es quien más valor extrae sin tener que cambiar nada de su rutina diaria.

---

## La solución

Tres capas, una sola lógica.

**Captura ligera.** Para que un comerciante exista en el sistema sin fricción. Si tiene alfabetización digital media, se registra solo desde una página web pública. Si no, lo registra una promotora en campo con un audio de 30 segundos. Si nadie lo registra, el sistema lo descubre por menciones de empresarios formales que ya hacen negocios con esa persona.

**Inteligencia.** El sistema agrupa a los comerciantes en clusters dinámicos por sector, etapa, ubicación o combinaciones útiles. Calcula qué tan compatibles son entre sí. Detecta cadenas de valor que ya existen y otras que podrían existir. Genera recomendaciones priorizadas con tipo de relación (proveedor, aliado, cliente, referente) y explicaciones en lenguaje natural sobre por qué cada conexión tiene sentido.

**Entrega en el canal correcto.** Los formales reciben sus recomendaciones en una vista web que vuelve a la plataforma viva. Los informales reciben mensajes por WhatsApp con la oportunidad concreta y un botón de respuesta. Las promotoras y la coordinación de la Cámara tienen sus propias vistas adaptadas a lo que necesitan hacer.

Detrás de todo, un agente automatizado al que llamamos **Conector** trabaja sin que nadie se lo pida. Recalcula los clusters cada noche, detecta cuando se registra un comerciante nuevo y dispara recomendaciones inmediatas, identifica empresarios que necesitan intervención humana y los prioriza para los asesores.

---

## Un día normal en Ruta C Conecta

**5:00 AM.** Conector recalcula los clusters de Santa Marta con los registros y cambios de la jornada anterior.

**8:15 AM.** Carlos, dueño de un hotel boutique en El Rodadero, abre Ruta C desde su escritorio. Hace ocho meses no entraba. Encuentra tres recomendaciones nuevas: una lavandera en Bastidas que tres hoteles parecidos al suyo ya usan, una cooperativa de pescadores en Taganga que entrega pescado fresco diario, y una guía turística que está buscando alianzas con hoteles pequeños. Cada una con una explicación clara de por qué se la recomiendan.

**10:30 AM.** Andrea, asesora de la Cámara, está en el Mercado del Magdalena. Se acerca al puesto de Doña Marleny, una vendedora de empanadas que vende ahí hace ocho años. En lugar de un formulario de 40 preguntas, abre la app, toma una foto del puesto, graba 30 segundos de audio describiendo lo que ella ve y escucha. El sistema extrae los atributos automáticamente, le muestra la información estructurada para confirmar, y crea el perfil de Doña Marleny.

**2:45 PM.** Doña Marleny recibe un mensaje por WhatsApp del bot oficial de la Cámara: tres oficinas a cuatro cuadras de su puesto buscan opciones de almuerzo, una de ellas estaría dispuesta a pedir 12 almuerzos diarios. No descargó ninguna app, no se registró en ningún sitio web, no aprendió nada nuevo. Pero acaba de entrar al ecosistema económico formal por la puerta que ya usa todos los días.

**5:45 PM.** Camila, coordinadora del programa Ruta C, revisa el panel administrativo. Ve cuántas conexiones se generaron hoy, cuáles fueron marcadas como exitosas, qué clusters están más activos, qué territorios están subatendidos. Conector le marca cinco empresarios que necesitan intervención humana esta semana, priorizados por urgencia.

**11:00 PM.** El día termina. Conector registra todo lo que pasó y se prepara para el recálculo nocturno.

---

## Qué nos diferencia

Otros recomendadores conectan registrados con registrados. Eso es un directorio.

Ruta C Conecta hace tres cosas que no hace ningún otro sistema en el ecosistema actual.

**Conecta lo formal con lo informal en una sola red.** La lavandera de Bastidas y el hotel de El Rodadero aparecen en la misma vista, con la misma lógica de matching, sin que la lavandera tenga que registrarse formalmente.

**Le habla a cada quien en su canal.** La web es para quien usa web. WhatsApp es para quien usa WhatsApp. La voz es para quien prefiere hablar a escribir. Nadie tiene que aprender una herramienta nueva.

**Explica sus decisiones.** Cada recomendación responde la pregunta "¿por qué a mí?" en lenguaje natural, no con métricas técnicas. Eso construye confianza tanto en el comerciante que recibe como en la Cámara que audita.

---

## Cómo está construido

Ruta C Conecta es un **monorepo** con dos servicios independientes que se comunican por HTTP, gestionado con `bun workspaces`.

```
silver-adventure/
├── src/
│   ├── front/      # Web Next.js 16 (App Router) — la cara del producto
│   └── brain/      # Servicio NestJS — el motor inteligente
├── docs/           # Documentación funcional, planeación y specs
├── supabase/       # Schema y migraciones de la base
└── .env            # Single source of truth (symlinks por workspace)
```

**Dos servicios, una sola lógica.**

- **`src/front/`** ([README](src/front/README.md)) — Next.js 16 con App Router, React 19 y React Compiler. Es el canal del empresario formal: landing pública, login, registro guiado y la app autenticada con cinco pantallas (`Inicio`, `Recomendaciones`, `Mi Cluster`, `Mi Negocio`, `Conexiones`). Sigue arquitectura hexagonal y patrón BFF estricto: TODA llamada externa pasa por sus propios Route Handlers.

- **`src/brain/`** ([README](src/brain/README.md)) — Servicio NestJS que cumple el componente "Inteligencia" del sistema. Genera clusters (predefinidos + heurísticos en cascada), produce recomendaciones AI-first con Gemini y orquesta el agente Conector que corre en cron. Arquitectura hexagonal estricta, port `CompanySource` para ser BigQuery-ready cuando lleguen las credenciales del reto.

**Comunicación entre los dos.** El front NUNCA habla con Supabase ni con Gemini directamente. Sus Route Handlers consumen al brain por REST (`GET /api/recommendations/by-company/...`, `GET /api/clusters/by-company/...`, etc.). Esto preserva el patrón BFF y permite que el brain se reemplace sin tocar UI.

### Stack global

| Capa       | Tecnología                                                                              |
| ---------- | --------------------------------------------------------------------------------------- |
| Runtime    | **Bun** 1.x para dev y scripts; Node 24 para prod del brain                             |
| Lenguaje   | **TypeScript 6** strict en ambos workspaces                                             |
| Front      | **Next.js 16** (App Router, React 19 + React Compiler), Tailwind 4, next-intl, SWR      |
| Brain      | **NestJS 11**, Vitest, `@google/generative-ai`, `@nestjs/schedule` (cron), Zod, OpenAPI |
| Datos      | **Supabase / Postgres** (cloud)                                                         |
| IA         | **Google Gemini 2.5 Flash** (chat + structured) y `text-embedding-004` (embeddings)     |
| Validación | **Zod 4** en front, brain y env vars                                                    |
| Tests      | **Vitest 4** en ambos workspaces (`bun test`)                                           |
| Calidad    | ESLint 10, Prettier 3, Husky + lint-staged + commitlint, conventional commits           |

### Cómo correr el monorepo

```bash
# 1. Instalar dependencias (una sola vez)
bun install

# 2. Configurar variables de entorno
cp .env.example .env
# Editar .env con SUPABASE_*, GEMINI_API_KEY, etc.

# 3. Levantar los dos servicios (en terminales separadas)
bun dev:front      # http://localhost:3000  (Next.js)
bun dev:brain      # http://localhost:3001  (NestJS, OpenAPI en /docs)

# 4. Tests de TODO el monorepo
bun test           # corre vitest en front y brain

# 5. Format / lint global
bun format
bun lint
```

Detalles específicos de cada servicio (seeds, endpoints, pantallas, providers) viven en sus README dedicados.

### Variables de entorno

Hay **un solo `.env` real** en la raíz del monorepo. Cada workspace lo ve a través de un **symlink relativo** (`src/front/.env -> ../../.env`, idem brain). El archivo es shared, pero cada workspace declara qué variables consume vía Zod schema independiente, que falla-rápido al startup si falta algo. Detalle completo en [`AGENTS.md`](AGENTS.md) §8.

| Categoría     | Variables principales                                                   |
| ------------- | ----------------------------------------------------------------------- |
| Supabase      | `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| Gemini        | `GEMINI_API_KEY`, `GEMINI_CHAT_MODEL`, `GEMINI_EMBEDDING_MODEL`         |
| Agente        | `AGENT_CRON_SCHEDULE`, `AGENT_ENABLED`, `AI_MATCH_INFERENCE_ENABLED`    |
| GCP / BQ      | `GCP_PROJECT_ID`, `GCP_LOCATION`, `BIGQUERY_DATASET`                    |
| Front público | `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_DEBUG_ENABLED`                      |

---

## Estado del proyecto

Este repositorio contiene el prototipo desarrollado durante el Hackathon Samatech organizado por la Cámara de Comercio de Santa Marta.

- **Convenciones del repo y reglas para agentes IA**: [`AGENTS.md`](AGENTS.md) — arquitectura hexagonal, BFF, hooks de Git, TDD, path aliases.
- **Documentación técnica del entregable**: [`docs/documentacion.md`](docs/documentacion.md) — flujos, stack y cómo correr.
- **Sistema de scoring de recomendaciones**: [`docs/scoring.md`](docs/scoring.md) — fórmulas, pesos, thresholds, ejemplos y trazabilidad.
- **Planeación del equipo**: [`docs/planeacion/`](docs/planeacion/) — alcance del MVP, roles, personas, motor de recomendaciones, cronograma y riesgos.
- **Specs por bounded context**: [`docs/specs/`](docs/specs/) — requirements y scenarios de cada contexto del brain.
- **Reto y datos de partida**: [`docs/hackathon/`](docs/hackathon/) — bases del reto, dataset y documentación de clustering provista por la Cámara.
- **Plan de implementación del motor**: [`docs/2026-04-25-brain-clustering-engine-implementation.md`](docs/2026-04-25-brain-clustering-engine-implementation.md) — fases, tasks y división de trabajo.

---

## Equipo

**Nombre del equipo:** _por definir_

| Nombre | Rol          |
| ------ | ------------ |
|        | PM / Lead    |
|        | Backend / IA |
|        | Frontend     |
|        | Data / ML    |
|        | Diseño / UX  |

**Cómo llegamos a esta idea**

> Empezamos analizando el reto y nos dimos cuenta de que el problema real no era construir un recomendador para los empresarios registrados, sino reconocer que la economía de Santa Marta es mucho más grande que los registros formales. Decidimos que la solución tenía que abrir una puerta nueva: la del comerciante informal, que mueve la economía real del territorio pero hoy es invisible para el sistema. A partir de ahí diseñamos cuatro experiencias específicas — una por persona — y un agente que las conecta todas.

---

## Reconocimientos

Hackathon Samatech · Cámara de Comercio de Santa Marta · 2026

Reto oficial: _Ruta C Conecta — Motor Inteligente de Clusters Empresariales_
Documento base por Hernando Alfonso Varón · Grimorum
