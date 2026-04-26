# 01 · Alcance del MVP

> Este documento define qué se construye, qué se deja afuera y cómo sabemos que ganamos.
> Es el contrato del equipo. Cualquier feature fuera de este alcance se discute con PM antes de empezar.

---

## Hipótesis ganadora

> Si conectamos lo formal con lo informal en una sola red, con explicación clara y un agente que actúa solo, el jurado va a ver algo que ningún otro equipo va a mostrar.

Los demás equipos van a construir un recomendador entre empresarios formales registrados. Eso ya existe — es un directorio. Nosotros construimos **una capa nueva** donde la lavandera de Bastidas y el hotel de El Rodadero aparecen en la misma vista, con la misma lógica de matching, sin que la lavandera tenga que registrarse formalmente.

---

## La matriz de evaluación es nuestro mapa

| Criterio                      | Peso | Cómo lo atacamos                                                                                    |
| ----------------------------- | ---- | --------------------------------------------------------------------------------------------------- |
| Relevancia de recomendaciones | 30%  | Dos lógicas distintas (peer + cadena de valor) + razón explicada por Gemini con anclas verificables |
| IA / Agéntica                 | 25%  | Conector con 3 disparadores: cron nocturno + evento de registro + cambio de etapa                   |
| Uso frecuente                 | 20%  | Notificación proactiva por WhatsApp y email cada vez que aparece una oportunidad nueva              |
| Viabilidad técnica            | 15%  | Arquitectura desacoplada, API REST documentada, datos reales de BigQuery                            |
| Experiencia de usuario        | 10%  | 3 flujos pulidos: web del formal, WhatsApp del informal, panel admin                                |

**El 55% de la nota (Relevancia + Agéntica) no es técnico, es producto.** Por eso el motor más sofisticado pierde contra recomendaciones que el jurado mira y dice _"sí, eso me serviría"_.

---

## IN del MVP — lo que se construye y se demuestra en vivo

### 1. Web del empresario formal

- Login y home con **3 a 5 recomendaciones priorizadas**
- Cada recomendación incluye:
  - **Tipo de relación**: `cliente potencial` · `proveedor` · `aliado estratégico` · `referente`
  - **Score** (0–100)
  - **Razón en lenguaje natural** generada por Gemini con anclas verificables
  - **Acción primaria**: `marcar conexión` · `guardar` · `simular contacto`
- Filtro por tipo de relación
- Sección **"Mi cluster"** con visualización en mapa (Leaflet) o grafo (D3)

### 2. Bot de WhatsApp del comerciante informal

- 1 flujo end-to-end completo y demoable
- Mensaje outbound del bot con plantilla aprobada: contexto + oportunidad concreta + 3 botones interactivos
- Webhook de respuesta procesado
- Si responde "me interesa" → se notifica al otro extremo y se registra la conexión
- **Demo en vivo**: el jurado puede tomar el celular del demoer y escribir como Doña Marleny

### 3. Panel administrativo

- Métricas del día: conexiones generadas, conexiones marcadas como exitosas, clusters más activos
- Mapa de Santa Marta con territorios subatendidos
- Lista de empresarios priorizados por el agente Conector para intervención humana
- Trazabilidad de cualquier recomendación (qué features la generaron, cuándo, qué pasó después)

### 4. Agente Conector

- **Cron nocturno** (Cloud Scheduler) que recalcula clusters y dispara notificaciones
- **Trigger por evento** (Pub/Sub o webhook interno) cuando se registra un comerciante nuevo
- **Trigger por evento** cuando un empresario cambia de etapa
- Output: notificaciones outbound + score de prioridad para empresarios que necesitan intervención humana

### 5. Motor de recomendaciones

- **Clustering** dinámico (K-means o DBSCAN) sobre la tabla unificada `entidad_economica`
- **Peer matching** por cosine similarity de embeddings
- **Cadena de valor** por reglas heurísticas sector→sector + clasificador LLM
- **Explicabilidad**: cada recomendación trae anclas verificables (distancia, programa compartido, sector compatible) renderizadas en lenguaje natural por Gemini
- API REST documentada (`/api/recommendations`, `/api/clusters/{id}`, `/api/agent/recompute`)

### 6. Datos

- Datos reales de BigQuery (dataset Ruta C) si llega el acceso a tiempo
- **Plan B**: CSVs locales en [`docs/hackathon/DATA/`](../hackathon/DATA/)
- Dataset semilla de ~50 informales del Magdalena para demo (vendedoras, pescadores, artesanos, cocineras)

---

## OUT del MVP — visible en pitch, no en demo

Estos features se mencionan en el pitch como roadmap visible y se documentan, pero **no se construyen** durante el hackathon. Mostrarlos es debilidad: prometemos cuatro cosas y entregamos dos.

| Feature                                             | Por qué fuera                                               |
| --------------------------------------------------- | ----------------------------------------------------------- |
| App de promotor con captura por voz                 | App nativa + Whisper + UX en campo no es demoable en 4 días |
| Descubrimiento automático de informales por mención | Requiere NER + dataset de menciones reales que no tenemos   |
| Multi-territorio (Atlántico, Bolívar, etc.)         | Foco en Magdalena gana más que cobertura amplia mal hecha   |
| Onboarding self-service de nuevas Cámaras           | No mueve el dial del jurado                                 |
| Marketplace de servicios pagos                      | Fuera del scope del reto                                    |
| Mobile app del empresario formal                    | La web responsive cubre el caso para esta etapa             |
| Sistema de reputación / reviews                     | Requiere volumen real de conexiones                         |
| Integración con DIAN / facturación electrónica      | Fricción de confianza, no es lo que pide el reto            |

---

## Criterios de éxito demoables

El demo se mide por estas 4 historias en vivo. Si las 4 corren limpias, ganamos.

### Historia 1 · Carlos abre la web

- Carlos (hotelero en El Rodadero) hace login.
- Ve 3 recomendaciones nuevas con explicación clara.
- Hace clic en "Cooperativa de pescadores en Taganga" → ve el detalle, las anclas, simula el contacto.
- **Tiempo objetivo**: 60 segundos.

### Historia 2 · Andrea registra a Doña Marleny (narrada)

- Mostramos un mock del flujo de la promotora con la voz pregrabada.
- El sistema extrae los atributos del audio y crea el perfil.
- **Importante**: dejamos claro que esto es la visión, no el MVP.
- **Tiempo objetivo**: 30 segundos de narración + 1 captura de pantalla.

### Historia 3 · Doña Marleny recibe WhatsApp (en vivo)

- En el escenario, mostramos un teléfono real con la conversación.
- El bot envía la oportunidad a un número del jurado o del demoer.
- El demoer responde "me interesa" → vemos en pantalla que la conexión se registró.
- **Tiempo objetivo**: 60 segundos. Esta es la historia más importante del demo.

### Historia 4 · Camila revisa el panel admin

- Mostramos el panel con métricas del día (incluyendo la conexión que acabamos de generar).
- Hacemos zoom en los 5 empresarios priorizados por el Conector.
- Mostramos la trazabilidad de la recomendación que disparó la conexión de Doña Marleny.
- **Tiempo objetivo**: 60 segundos.

**Tiempo total del demo**: ≈ 4 minutos. Pitch + demo + Q&A en 8 minutos.

---

## Definition of Done del MVP

Una historia está **lista para demo** cuando cumple todo esto:

- [ ] Corre end-to-end sin tocar nada manualmente entre pasos
- [ ] Datos reales (no lorem ipsum, no `usuario_test_1`)
- [ ] Funciona desde un dispositivo nuevo (no solo en el laptop del dev)
- [ ] Tiene plan B documentado si falla en vivo
- [ ] Está cronometrada y cabe en su slot del demo
- [ ] Al menos 2 personas del equipo la pueden ejecutar

---

## Anti-objetivos

Cosas que **explícitamente no perseguimos** y que se rechazan en code review.

- **Dashboards bonitos sin lógica detrás**. El reto rechaza esto literalmente.
- **Recomendaciones genéricas tipo "prueba este programa"**. Cada reco es específica, con nombre y anclas.
- **Sofisticación técnica sin payoff**. Si el feature no se ve en demo o no mueve el dial del jurado, no lo construimos.
- **Tocar [`src/brain/`](../../src/brain/) o [`src/front/`](../../src/front/) sin haber leído antes [`AGENTS.md`](../../AGENTS.md)**. Hexagonal arch importa para mantener velocidad de Día 3 en adelante.
- **Demos con datos en inglés o en lorem ipsum**. Todo en español, todo de Santa Marta.

---

## Lo que cambia si nos sobra tiempo

Orden de prioridad si el MVP base está cerrado antes de Día 4:

1. **Página pública de autorregistro del informal** — abre la cuarta puerta de entrada
2. **Email semanal con resumen de oportunidades** — refuerza el "uso frecuente" (20%)
3. **Visualización de cadenas de valor en el panel admin** — gancho narrativo brutal para el pitch
4. **Modo "qué pasaría si"** — el formal puede simular cómo cambian sus recomendaciones si entra a un programa nuevo

---

## Referencias cruzadas

- Roles que ejecutan este alcance → [`02-roles-equipo.md`](02-roles-equipo.md)
- Detalle de las 4 personas → [`03-personas-y-canales.md`](03-personas-y-canales.md)
- Arquitectura técnica → [`04-arquitectura.md`](04-arquitectura.md)
- Lógica del motor que cumple el 55% de la nota → [`05-motor-recomendaciones.md`](05-motor-recomendaciones.md)
- Cronograma y plan B → [`06-cronograma-y-riesgos.md`](06-cronograma-y-riesgos.md)
