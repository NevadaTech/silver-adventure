# 06 · Cronograma, riesgos y demo script

> Plan de ejecución día por día, riesgos identificados con mitigación, y guion del demo final.
> Si algo se desfasa, se ajusta acá y se avisa al equipo en el standup siguiente.

---

## Cronograma — 4 días

> Asume hackathon de 4 días. Si son 3, se compactan Día 1 y Día 2. Si son 5, Día 4 se duplica con pulido y un feature opcional.

### Día 1 · Fundamentos (sin código de producto)

| Hora  | Actividad                                                                                      | Responsable           |
| ----- | ---------------------------------------------------------------------------------------------- | --------------------- |
| 9:00  | Standup de arranque + revisión de [`01-alcance-mvp.md`](01-alcance-mvp.md)                     | Todos                 |
| 9:30  | Aprobación del nombre del equipo + branding base                                               | UX + PM               |
| 10:00 | EDA inicial sobre CSVs en [`docs/hackathon/DATA/`](../hackathon/DATA/)                         | Data/ML               |
| 10:00 | Setup de credenciales: Supabase, Vertex AI, WhatsApp Business, BigQuery                        | Backend/IA + PM       |
| 11:00 | Wireframes home formal + cards de recomendación (versión 1)                                    | UX                    |
| 12:00 | Decisión: motor en Python vs NestJS — documentar en [`04-arquitectura.md`](04-arquitectura.md) | Backend/IA + PM       |
| 14:00 | Continuar EDA: distribución sector / etapa / territorio + insights narrativos                  | Data/ML               |
| 14:00 | Esqueleto de migraciones Supabase (tabla `entidad_economica`, `cluster`, etc.)                 | Backend/IA            |
| 14:00 | Wireframes panel admin + plantillas WhatsApp                                                   | UX                    |
| 14:00 | Tour del repo, [`AGENTS.md`](../../AGENTS.md), convenciones [`src/front/`](../../src/front/)   | Frontend              |
| 16:00 | Definir contratos REST v1 + acordarlos con Frontend                                            | Backend/IA + Frontend |
| 17:00 | Solicitar aprobación de plantillas WhatsApp en Meta (toma 24h)                                 | Backend/IA            |
| 18:00 | Check de cierre + ajuste de plan Día 2                                                         | Todos                 |

**Entregables al cierre del Día 1:**

- [ ] EDA documentado con 5 insights narrativos para el pitch
- [ ] Decisión del motor (Python vs NestJS) registrada
- [ ] Migraciones Supabase listas para correr
- [ ] Wireframes de las 3 vistas críticas en Figma
- [ ] Contratos REST v1 publicados
- [ ] Plantillas WhatsApp enviadas a Meta para aprobación
- [ ] Branding y nombre de equipo definidos

---

### Día 2 · Motor base + UI lista

| Hora  | Actividad                                                            | Responsable           |
| ----- | -------------------------------------------------------------------- | --------------------- |
| 9:00  | Standup                                                              | Todos                 |
| 9:30  | Pipeline feature engineering reproducible                            | Data/ML               |
| 9:30  | Endpoint mock `GET /api/recommendations` con respuesta hardcodeada   | Backend/IA            |
| 9:30  | Implementar home formal con datos del mock + cards                   | Frontend              |
| 9:30  | Design tokens exportados a Tailwind                                  | UX                    |
| 12:00 | Modelo de clustering corriendo (K-means + DBSCAN) sobre dataset real | Data/ML               |
| 12:00 | Implementar peer matching real (cosine similarity)                   | Backend/IA            |
| 12:00 | Vista de detalle de recomendación + animaciones                      | Frontend              |
| 14:00 | Reglas de cadena de valor (`value_chain_rules.json`)                 | Data/ML               |
| 14:00 | Implementar cadena de valor real                                     | Backend/IA            |
| 14:00 | Visualización de cluster (Leaflet o D3 según decisión Día 1)         | Frontend              |
| 14:00 | Dataset semilla de informales del Magdalena                          | Data/ML + UX          |
| 16:00 | Reemplazar mock por endpoint real desde el frontend                  | Frontend + Backend/IA |
| 16:00 | Confirmar aprobación de plantillas WhatsApp                          | Backend/IA            |
| 17:30 | Check informal: home del formal + detalle deben funcionar end-to-end | Todos                 |
| 18:00 | Check de cierre + ajuste plan Día 3                                  | Todos                 |

**Entregables al cierre del Día 2:**

- [ ] Home del formal carga 5 recomendaciones reales
- [ ] Detalle de recomendación muestra anclas y permite acciones (mock)
- [ ] Cluster visualizado en mapa o grafo
- [ ] Modelo de clustering corriendo y serializado
- [ ] Plantillas WhatsApp aprobadas
- [ ] Dataset semilla de informales listo

---

### Día 3 · Diferenciación (donde se gana)

> El día más importante del hackathon. Aquí se construye lo que vale el 55% de la nota.

| Hora  | Actividad                                                               | Responsable       |
| ----- | ----------------------------------------------------------------------- | ----------------- |
| 9:00  | Standup + revisión de qué quedó pendiente                               | Todos             |
| 9:30  | Integración Gemini para explicaciones (con caché en DB)                 | Backend/IA        |
| 9:30  | Bot WhatsApp: envío outbound + webhook de respuesta                     | Backend/IA        |
| 9:30  | Implementar acciones reales: marcar conexión, guardar, simular contacto | Frontend          |
| 9:30  | Generar perfiles realistas para los 50 informales del seed              | UX + Data/ML      |
| 12:00 | Agente Conector: cron nocturno `/api/agent/recompute`                   | Backend/IA        |
| 12:00 | Agente Conector: trigger por nueva entidad (Pub/Sub o webhook interno)  | Backend/IA        |
| 12:00 | Panel admin: overview con métricas del día                              | Frontend          |
| 14:00 | Agente Conector: priorización de empresarios para asesores              | Backend/IA        |
| 14:00 | Panel admin: lista de empresarios priorizados + drill-down              | Frontend          |
| 14:00 | Probar bot WhatsApp con número del demoer                               | Backend/IA + PM   |
| 16:00 | **Primer ensayo end-to-end del demo** (las 4 historias en orden)        | Todos             |
| 17:00 | Identificar bugs críticos del ensayo                                    | Todos             |
| 17:30 | Fix de bugs críticos                                                    | Quien corresponda |
| 18:00 | Check de cierre — ¿qué historias del demo funcionan? ¿qué falta?        | Todos             |

**Entregables al cierre del Día 3:**

- [ ] Explicaciones generadas por Gemini con anclas (cacheadas en DB)
- [ ] Bot WhatsApp envía y recibe mensajes en un número real
- [ ] Agente Conector con los 3 disparadores funcionando
- [ ] Panel admin con métricas + lista priorizada
- [ ] Las 4 historias del demo corren end-to-end (aunque con bugs)

---

### Día 4 · Pulido, ensayo y entrega

| Hora  | Actividad                                                                     | Responsable           |
| ----- | ----------------------------------------------------------------------------- | --------------------- |
| 9:00  | Standup + lista priorizada de bugs                                            | Todos                 |
| 9:30  | Fix de bugs del demo (orden: WhatsApp > Recomendaciones > Panel admin > UI)   | Quien corresponda     |
| 9:30  | Pitch deck v1                                                                 | PM + UX               |
| 11:00 | Segundo ensayo end-to-end                                                     | Todos                 |
| 12:00 | Pulido visual: animaciones, transiciones, copy final                          | UX + Frontend         |
| 14:00 | Documentación técnica final en [`docs/documentacion.md`](../documentacion.md) | Backend/IA + PM       |
| 14:00 | Tercer ensayo cronometrado                                                    | Todos                 |
| 15:00 | Pitch deck v2 (con feedback del ensayo)                                       | PM                    |
| 15:30 | Ensayo final cronometrado (sub-8 minutos pitch + demo)                        | PM + Todos            |
| 16:30 | Plan B activo: explicaciones precomputadas, mensajes WhatsApp pre-escritos    | Backend/IA + PM       |
| 17:00 | Push final a `main`, deploy a producción, README actualizado                  | Backend/IA + Frontend |
| 17:30 | Compartir repo con `andresvz91@gmail.com`                                     | PM                    |
| 18:00 | Cierre + descansar antes del pitch                                            | Todos                 |

**Entregables al cierre del Día 4:**

- [ ] Pitch + demo en 8 minutos sin tocar nada manualmente
- [ ] Plan B documentado y testeado (qué hacer si X falla en vivo)
- [ ] [`docs/documentacion.md`](../documentacion.md) completo
- [ ] Repo compartido con los organizadores
- [ ] PDF de la presentación en `presentacion/`

---

## Riesgos identificados y mitigaciones

> Top riesgos por probabilidad × impacto. Todos tienen plan B documentado.

### R1 · WhatsApp no aprueba las plantillas a tiempo

- **Probabilidad**: Media
- **Impacto**: Alto (la historia 3 del demo depende de esto)
- **Mitigación**:
  - Solicitar aprobación el Día 1 a las 17:00 (toma hasta 24h).
  - Plantillas redactadas siguiendo guías de Meta (sin spam, sin promociones engañosas, idioma claro).
- **Plan B**:
  - Sandbox de Meta (5 números de prueba) si plantillas no se aprueban.
  - Si sandbox falla, mostrar el flujo en un mock de WhatsApp Web simulado en Next.js.

### R2 · Acceso a BigQuery llega tarde

- **Probabilidad**: Alta
- **Impacto**: Medio (los CSVs locales cubren mucho)
- **Mitigación**:
  - Trabajar 100% con CSVs locales el Día 1 y Día 2.
  - Pedir credenciales el Día 1 y dejar la integración como sustituible.
- **Plan B**:
  - Demo corre completo con CSVs locales. Si BigQuery llega, se conecta como bonus.

### R3 · Gemini falla durante el demo

- **Probabilidad**: Baja
- **Impacto**: Alto
- **Mitigación**:
  - Las explicaciones se generan en batch durante el cron nocturno y se persisten.
  - El frontend nunca llama a Gemini en runtime.
- **Plan B**:
  - Si Gemini cae durante la noche, el sistema cae a explicaciones template-based determinísticas.

### R4 · Las recomendaciones se ven genéricas

- **Probabilidad**: Media
- **Impacto**: Crítico (es el 30% de la nota)
- **Mitigación**:
  - Cada recomendación pasa por revisión humana (Data/ML + PM) antes del demo.
  - Mínimo 2 anclas verificables específicas por recomendación.
  - Dataset semilla de informales con perfiles muy específicos (no genéricos).
- **Plan B**:
  - Top-5 del demo curado manualmente con las mejores recomendaciones.

### R5 · El frontend no integra a tiempo con el motor

- **Probabilidad**: Media
- **Impacto**: Alto
- **Mitigación**:
  - Mock del endpoint listo el Día 2 a las 9:30. Frontend trabaja contra el mock hasta que el real esté.
  - Contratos REST congelados al cierre del Día 2.
- **Plan B**:
  - Si la integración falla en el Día 4, el demo usa data hardcodeada en el frontend.

### R6 · pgvector no se habilita en Supabase

- **Probabilidad**: Baja
- **Impacto**: Medio
- **Mitigación**:
  - Habilitar la extensión el Día 1.
- **Plan B**:
  - Similitud calculada en memoria con numpy. Funciona para hasta ~5000 entidades sin problemas.

### R7 · Demo se cae en escenario por mala conexión

- **Probabilidad**: Media
- **Impacto**: Crítico
- **Mitigación**:
  - Llevar hotspot personal de respaldo.
  - Probar con la red del venue antes del pitch.
- **Plan B**:
  - Video pregrabado del demo (60 segundos) listo para correr si la conexión muere.

### R8 · Equipo se desincroniza y duplica trabajo

- **Probabilidad**: Media
- **Impacto**: Medio
- **Mitigación**:
  - Standup de 10 minutos cada mañana.
  - Check de 15 minutos cada noche.
  - Ownerships claros en [`02-roles-equipo.md`](02-roles-equipo.md).
- **Plan B**:
  - PM corta scope si algo se vuelve doble esfuerzo.

### R9 · Una persona del equipo se enferma o falla

- **Probabilidad**: Baja
- **Impacto**: Alto
- **Mitigación**:
  - Cada entregable tiene al menos 2 personas que entienden cómo funciona.
  - Contratos REST documentados, no en la cabeza.
- **Plan B**:
  - PM redistribuye carga y se prioriza demo sobre features extras.

### R10 · El pitch se enfoca en lo técnico y no en la narrativa humana

- **Probabilidad**: Alta (peligro común en hackathons)
- **Impacto**: Crítico (UX 10% + Uso frecuente 20% se ganan con narrativa)
- **Mitigación**:
  - El pitch arranca con la historia de Doña Marleny, no con la arquitectura.
  - Las 4 historias del demo son protagonistas.
- **Plan B**:
  - Si el ensayo se siente técnico, PM reescribe el pitch antes del Día 4 noche.

---

## Demo script

### Estructura: pitch (3 min) + demo (4 min) + Q&A (1 min) = 8 min total

### Pitch (3 minutos)

> **0:00 — Abrir con la persona, no con el producto.**
>
> _"Quiero contarles tres historias de Santa Marta que pasan al mismo tiempo en una mañana cualquiera."_

> **0:20 — Las tres historias en una frase cada una.**
>
> _"Carlos, dueño de un hotel boutique en Rodadero, lleva 8 meses sin entrar a Ruta C. Doña Marleny vende empanadas en el mercado y nunca ha entrado a Ruta C porque no tiene RUT. Camila, coordinadora del programa, tiene una base de datos rica pero no sabe cómo conectarlas."_

> **0:50 — El insight central.**
>
> _"Hoy Ruta C tiene a Carlos en su base de datos pero invisible para Doña Marleny. Y a Doña Marleny no la tiene en ningún lado, aunque mueve la economía real del territorio."_

> **1:20 — La propuesta.**
>
> _"Construimos Ruta C Conecta: un sistema que entiende quién hace qué en Santa Marta — formales e informales — y cada día conecta a la persona correcta con la oportunidad correcta, en el canal que esa persona ya usa. Carlos entra por la web. Doña Marleny entra por WhatsApp. La inteligencia es la misma. Lo que cambia es la puerta."_

> **1:50 — El qué nos diferencia.**
>
> _"Otros recomendadores conectan registrados con registrados. Eso es un directorio. Nosotros conectamos lo formal con lo informal en una sola red, le hablamos a cada quien en su canal, y explicamos cada decisión en lenguaje natural."_

> **2:20 — Estado del MVP en una frase.**
>
> _"Esto que vamos a mostrar funciona end-to-end con datos reales del Magdalena. Las recomendaciones las genera un motor con dos lógicas distintas — peer matching y cadena de valor — y un agente que actúa solo cada noche."_

> **2:50 — Llamada al demo.**
>
> _"Veamos."_

### Demo (4 minutos)

#### Historia 1 · Carlos abre la web (60s) — _Frontend conduce_

```
[Pantalla] Login del formal → home
[Acción]   Mostrar 3 recomendaciones nuevas
[Voz]      "Carlos abre Ruta C después de 8 meses. El sistema le tiene 3 cosas
            nuevas: una lavandera de Bastidas que tres hoteles parecidos al suyo
            ya usan, una cooperativa de pescadores en Taganga, y una guía
            turística buscando alianzas."
[Acción]   Clic en la cooperativa → detalle con anclas
[Voz]      "Cada recomendación tiene una razón clara: a 12 km, entrega diaria,
            tres pares ya conectados. Carlos sabe exactamente por qué se la
            sugieren."
[Acción]   Clic en simular contacto → modal con plantilla
```

#### Historia 2 · Andrea registra a Doña Marleny (30s) — _PM narra con mock_

```
[Pantalla] Mock de la app del promotor
[Acción]   Mostrar foto + audio pregrabado
[Voz]      "Andrea, asesora de la Cámara, está en el Mercado del Magdalena. En
            lugar de un formulario de 40 preguntas, graba un audio de 30
            segundos describiendo el puesto. El sistema extrae los atributos
            y crea el perfil."
[Acción]   Mostrar perfil estructurado
[Voz]      "Esta capa la diseñamos pero no está en el MVP demoable. Lo que sí
            les voy a mostrar ahora es lo que pasa después."
```

#### Historia 3 · Doña Marleny recibe WhatsApp (90s) — _Backend/IA conduce con un teléfono real_

```
[Acción]   En la app web, registrar a Doña Marleny EN VIVO
[Voz]      "Acabo de registrar a Doña Marleny. Miren el panel admin..."
[Pantalla] Panel admin muestra el evento del agente Conector disparándose
[Voz]      "El agente Conector ya detectó el registro. Genera recomendaciones,
            cruza con formales cercanos buscando proveedores de almuerzos."
[Acción]   Mostrar el celular del demoer
[Pantalla] WhatsApp recibe el mensaje del bot
[Voz]      "Doña Marleny acaba de recibir esto. No descargó nada, no se registró
            en ningún sitio web. Tres oficinas a 4 cuadras buscan opciones de
            almuerzo, una de ellas pediría 12 almuerzos diarios."
[Acción]   Responder "Sí, me interesa" desde el teléfono
[Pantalla] Panel admin muestra la conexión registrada
[Voz]      "Y en el panel admin de la Cámara, la conexión queda registrada en
            tiempo real."
```

#### Historia 4 · Camila revisa el panel admin (60s) — _Frontend conduce_

```
[Pantalla] Panel admin, vista overview
[Voz]      "Camila, coordinadora de Ruta C, ve esto cada mañana. Cuántas
            conexiones se generaron hoy, cuáles son exitosas, qué clusters
            están activos, qué territorios están subatendidos."
[Acción]   Hacer clic en empresarios priorizados
[Voz]      "El agente Conector le marcó 5 empresarios que necesitan intervención
            humana esta semana. Cada uno con un score de prioridad y la razón."
[Acción]   Drill-down a uno de ellos
[Voz]      "Camila puede ver la trazabilidad completa: qué recomendaciones
            recibió, qué hizo, qué cluster pertenece. Y asignarle una promotora
            en un clic."
```

### Cierre (post-demo, 30s)

> _"Lo que acabamos de mostrar es un sistema que entiende a Santa Marta como es realmente: una economía donde formales e informales coexisten. Una sola lógica de matching, cuatro puertas distintas, un agente que actúa solo. Eso es Ruta C Conecta."_

### Q&A — preguntas probables y respuestas

| Pregunta probable                           | Respuesta corta                                                                              |
| ------------------------------------------- | -------------------------------------------------------------------------------------------- |
| ¿Por qué Python y no NodeJS?                | Por scikit-learn y sentence-transformers maduros, alineado al stack recomendado por el reto. |
| ¿Cómo manejan privacidad de los informales? | Datos sensibles solo se muestran al confirmar acción. Consentimiento por WhatsApp.           |
| ¿Cómo escala esto a otras ciudades?         | Misma arquitectura, dataset por territorio, plantillas WhatsApp localizadas.                 |
| ¿Cómo evitan recomendaciones sesgadas?      | Anclas verificables auditables por la Cámara, no recomendaciones basadas solo en LLM.        |
| ¿Y si el informal no tiene WhatsApp?        | Fallback al canal de la promotora en campo. La página pública es el tercer canal.            |
| ¿Cuántas conexiones generan por día?        | En el MVP demostramos 1 en vivo. Con datos reales proyectamos N basado en cluster size.      |
| ¿Qué pasa si las recomendaciones son malas? | Sistema de feedback ya cableado: cada acción del usuario reentrena el ranking.               |
| ¿Por qué no usaron solo LLM para todo?      | Explicabilidad. Las anclas son verificables, no alucinaciones. El LLM solo redacta.          |

---

## Lista de verificación pre-demo

> Día 4, una hora antes del pitch. El PM lee esto en voz alta, todos confirman.

- [ ] Hotspot personal cargado y probado con la red del venue
- [ ] Laptop principal con batería al 100%
- [ ] Laptop de respaldo con el demo deployado y funcional
- [ ] Teléfono del demoer con WhatsApp activo y conversación limpia
- [ ] Teléfono de respaldo con WhatsApp activo
- [ ] URL del demo en producción funcional desde el celular
- [ ] Login del demo formal probado en los últimos 30 minutos
- [ ] Login del demo admin probado en los últimos 30 minutos
- [ ] Video pregrabado del demo (60s) listo en escritorio
- [ ] Pitch deck en formato local (no Google Slides) y en USB
- [ ] Cada miembro del equipo sabe qué decir si le toca improvisar 60 segundos
- [ ] Repo compartido con `andresvz91@gmail.com`
- [ ] PDF de la presentación en `presentacion/`
- [ ] [`docs/documentacion.md`](../documentacion.md) completa
- [ ] [`README.md`](../../README.md) con equipo lleno

---

## Referencias cruzadas

- Alcance que se ejecuta en este cronograma → [`01-alcance-mvp.md`](01-alcance-mvp.md)
- Roles que ejecutan cada día → [`02-roles-equipo.md`](02-roles-equipo.md)
- Personas que protagonizan el demo → [`03-personas-y-canales.md`](03-personas-y-canales.md)
- Arquitectura que se construye en este orden → [`04-arquitectura.md`](04-arquitectura.md)
- Motor que entrega el 55% de la nota → [`05-motor-recomendaciones.md`](05-motor-recomendaciones.md)
