# 02 · Roles del equipo

> Quién hace qué, qué entrega y de quién depende.
> 5 personas, 5 ownerships claros. Si dos roles tocan lo mismo, gana el owner.

---

## Resumen ejecutivo

| Rol          | Misión en una frase                                                                 | Owner de                                                      |
| ------------ | ----------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| PM / Lead    | Guarda la visión, decide trade-offs, prepara el pitch.                              | Planeación, demo script, comunicación con jurado              |
| Backend / IA | Construye el motor que recomienda y el agente que actúa solo.                       | [`src/brain/`](../../src/brain/), API REST, agente Conector   |
| Frontend     | Convierte cada recomendación en una acción que el usuario sí da.                    | [`src/front/`](../../src/front/), web del formal, panel admin |
| Data / ML    | Hace que las recomendaciones tengan sentido para un humano que conoce Santa Marta.  | EDA, features, clustering, dataset semilla                    |
| Diseño / UX  | Hace que cada flujo se entienda en 5 segundos y se vea profesional en el escenario. | Wireframes, copy, branding del pitch                          |

---

## 1. PM / Lead

### Misión

Mantener al equipo enfocado en lo que mueve el dial del jurado y proteger el alcance del MVP de la tentación de agregar features.

### Responsabilidades

- Mantener viva la visión de las **3 historias del demo** (Carlos, Doña Marleny, Camila).
- Decidir trade-offs cuando algo no llega (qué se corta, qué se simula).
- Escribir y ensayar el **pitch** (5 minutos) y el **demo script** (4 minutos).
- Preparar las respuestas a las 10 preguntas más probables del jurado.
- Sincronizar al equipo con un **standup de 10 minutos cada mañana** y un **check de 15 minutos al final del día**.
- Ser la voz hacia los organizadores cuando se necesiten datos, credenciales o aclaraciones.

### Entregables del MVP

- [`docs/planeacion/`](.) actualizado al cierre de cada día
- Demo script ensayado (en [`06-cronograma-y-riesgos.md`](06-cronograma-y-riesgos.md))
- Pitch deck final
- Lista de plan B activos (qué simulamos si algo falla)

### Dependencias

- Recibe de **Diseño / UX**: wireframes y branding para el deck
- Recibe de **Backend / IA**: estado de los endpoints para saber qué demoamos en vivo
- Recibe de **Data / ML**: insights de los datos que se vuelven anclas narrativas

### Herramientas

- Notion / Markdown (este repo) · Figma (revisar) · Slack/WhatsApp del equipo · Cronómetro

### Anti-patrón

> "Es que sería brutal si también hiciéramos X". **No.** Si X no está en [`01-alcance-mvp.md`](01-alcance-mvp.md), X no se hace.

---

## 2. Backend / IA

### Misión

Convertir los datos en recomendaciones explicables y un agente que actúa solo, expuesto como API REST consumible por el frontend.

### Responsabilidades

- Construir el motor de recomendaciones:
  - Endpoint `GET /api/recommendations`
  - Lógica de **peer matching** (cosine similarity sobre embeddings)
  - Lógica de **cadena de valor** (reglas heurísticas + clasificador LLM)
  - Generación de la **razón explicada** vía Gemini con anclas verificables
- Construir el **agente Conector**:
  - Cron nocturno (Cloud Scheduler) que recalcula clusters
  - Trigger por evento (Pub/Sub o webhook) cuando hay nuevo registro
  - Trigger por evento de cambio de etapa
- Integrar **WhatsApp Business Cloud API**: envío outbound + webhook de respuesta
- Modelar la base de datos en Supabase/Postgres (`entidad_economica`, `clusters`, `recomendaciones`, `conexiones`, `eventos`)
- Documentar contratos REST/JSON consumidos por el frontend

### Entregables del MVP

- [`src/brain/`](../../src/brain/) corriendo en local con todos los endpoints
- Migraciones de Supabase aplicadas
- Job de cron desplegado en Cloud Run + Cloud Scheduler
- Bot WhatsApp recibiendo y enviando mensajes a un número real
- Tests vitest mínimos: 1 test por endpoint y 1 test del flujo completo del agente

### Dependencias

- Recibe de **Data / ML**: features finales, dataset semilla de informales, parámetros del clustering
- Entrega a **Frontend**: contratos REST estables al cierre del Día 2
- Recibe de **PM / Lead**: priorización si algo no llega

### Herramientas

- NestJS · Supabase · Vertex AI / Gemini API · WhatsApp Cloud API · Cloud Run · Postman para probar endpoints

### Anti-patrón

> Endpoints que cambian de contrato el Día 3. Una vez publicado el contrato, **se mantiene** o se versiona.

---

## 3. Frontend

### Misión

Que cada recomendación sea tan clara que el empresario haga clic sin dudar, y que el panel admin haga sentir a la coordinación de la Cámara que tiene el control.

### Responsabilidades

- Construir la **web del empresario formal** (Next.js 16 en [`src/front/`](../../src/front/)):
  - Login (Supabase auth)
  - Home con recomendaciones (cards con tipo, score, razón, acciones)
  - Detalle de recomendación con anclas verificables
  - Filtro por tipo de relación
  - Visualización de cluster (Leaflet o D3)
- Construir el **panel administrativo**:
  - Métricas del día (conexiones, clusters activos, territorios)
  - Lista de empresarios priorizados por el Conector
  - Trazabilidad de cada recomendación
- Integración SWR contra los endpoints de [`src/brain/`](../../src/brain/)
- Hacer la web responsive (móvil para demo en pantalla compartida)
- Asegurar i18n en español neutro de Colombia

### Entregables del MVP

- [`src/front/`](../../src/front/) deployado en Vercel con dominio del demo
- 2 vistas pulidas: home del formal + panel admin
- 1 vista funcional pero más simple: detalle de recomendación
- Build de producción sin warnings de Next.js 16

### Dependencias

- Recibe de **Diseño / UX**: wireframes, design tokens, copy
- Recibe de **Backend / IA**: contratos REST estables al cierre del Día 2
- Entrega a **PM / Lead**: capturas de pantalla para el deck

### Herramientas

- Next.js 16 · Tailwind 4 · SWR · Leaflet / D3 · Vercel · Figma para mirror del diseño

### Anti-patrón

> "Funciona en mi laptop". El demo se hace desde una URL pública en Vercel, no desde localhost.

---

## 4. Data / ML

### Misión

Que las recomendaciones que el motor genera sean recomendaciones que un asesor de la Cámara revisaría y diría _"sí, eso tiene sentido"_.

### Responsabilidades

- **EDA inicial** sobre los CSVs de [`docs/hackathon/DATA/`](../hackathon/DATA/):
  - Distribución de sectores, etapas, territorios
  - Calidad de los datos (faltantes, duplicados, outliers)
  - Insights narrativos que el PM usa en el pitch
- **Feature engineering** del perfil de empresa:
  - Sector → one-hot encoding sobre CIIU
  - Etapa → escala ordinal (idea < nacimiento < crecimiento < madurez)
  - Ubicación → coordenadas + dummies por barrio/municipio
  - Programas → vector binario
  - Diagnóstico → escalado normalizado
  - Texto libre → embeddings (Gemini text-embedding o `sentence-transformers` local)
- **Clustering**:
  - Probar K-means y DBSCAN con distintos `k` y `eps`
  - Elegir el modelo que dé clusters interpretables (no necesariamente el mejor en silhouette)
  - Generar etiquetas humanas para cada cluster (ej: _"Hoteles boutique en Rodadero etapa madurez"_)
- **Dataset semilla de informales**: ~50 perfiles representativos del Magdalena para demo
- Definir las **reglas heurísticas de cadena de valor**: qué sector vende a qué sector

### Entregables del MVP

- Notebook o script con el EDA documentado
- Pipeline de feature engineering reproducible
- Modelo de clustering serializado y consumible por el motor
- `seed/informales.json` con perfiles realistas (validados con Diseño/UX para que tengan voz creíble)
- Tabla de reglas de cadena de valor (`producto_madera → mueblista`, `pescado → restaurante`, etc.)

### Dependencias

- Entrega a **Backend / IA**: features finales, modelo de clustering, dataset semilla, reglas
- Recibe de **PM / Lead**: criterios de aceptación de "recomendación tiene sentido"
- Trabaja en par con **Diseño / UX** para que los perfiles informales suenen reales

### Herramientas

- Python · pandas · scikit-learn · Jupyter / Marimo · BigQuery (cuando llegue acceso) · Looker Studio para validar contra el dashboard de la Cámara

### Anti-patrón

> Optimizar métricas técnicas (silhouette score) en vez de **legibilidad** del cluster. Si el cluster no se puede etiquetar en una frase, es basura para el jurado.

---

## 5. Diseño / UX

### Misión

Que en 5 segundos se entienda qué es Ruta C Conecta y por qué es distinto, en cualquier pantalla.

### Responsabilidades

- **Wireframes** de los 3 flujos críticos:
  - Web del formal (home + detalle de recomendación + cluster)
  - Mensajes WhatsApp del informal (plantillas + respuestas)
  - Panel admin (overview + drill-down a empresario)
- **Design tokens** consistentes con la identidad de la Cámara (paleta institucional + tono cálido)
- **Copy de las explicaciones**: la razón de cada recomendación tiene una estructura editorial fija (ancla 1 + ancla 2 + acción concreta)
- **Plantillas de WhatsApp** aprobables por Meta: tono cercano, máximo 1024 caracteres, botones interactivos claros
- **Branding del pitch**: portada del deck, transiciones, tipografía
- **Personalidad de los perfiles** del dataset semilla: nombres reales, fotos placeholder coherentes, descripciones que suenen humanas

### Entregables del MVP

- Figma con los 3 flujos completos
- Design tokens exportados como variables CSS para Tailwind
- Plantillas de WhatsApp listas para enviar a Meta
- Deck del pitch con la narrativa visual
- Logo y nombre del equipo definidos

### Dependencias

- Entrega a **Frontend**: design tokens y wireframes al cierre del Día 1
- Entrega a **Backend / IA**: plantillas finales de WhatsApp al cierre del Día 2
- Entrega a **PM / Lead**: deck listo al cierre del Día 3
- Trabaja en par con **Data / ML** en los perfiles del dataset semilla

### Herramientas

- Figma · Tailwind tokens · Gemini para generar fotos placeholder · Canva para el deck (alternativo)

### Anti-patrón

> Diseñar 8 pantallas y 0 quedan implementadas. Mejor 3 pantallas perfectas que 8 a medias.

---

## Matriz de RACI por entregable clave

| Entregable                 | PM  | Backend | Frontend | Data | UX  |
| -------------------------- | --- | ------- | -------- | ---- | --- |
| Pitch deck                 | R   | C       | C        | C    | A   |
| Demo script                | A   | C       | C        | C    | C   |
| Web del formal             | C   | C       | A        | I    | R   |
| Panel admin                | C   | C       | A        | C    | R   |
| Bot WhatsApp               | C   | A       | I        | I    | R   |
| Motor de recomendaciones   | I   | A       | I        | R    | I   |
| Agente Conector            | I   | A       | I        | C    | I   |
| Dataset semilla informales | C   | I       | I        | A    | R   |
| Modelo de clustering       | I   | C       | I        | A    | I   |
| Documentación técnica      | C   | A       | C        | C    | I   |

> R = responsible · A = accountable · C = consulted · I = informed

---

## Reglas de colaboración

1. **Cada uno hace merge directo a `main`** después de pasar lint + typecheck. No hay revisiones de PR durante hackathon (ralentizan).
2. **Conventional commits**: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`. Sin co-author de IA.
3. **Standup 9:00 AM** (10 min): qué hice ayer, qué hago hoy, dónde estoy bloqueado.
4. **Check 6:00 PM** (15 min): demo informal de lo que cada uno hizo. PM ajusta plan del día siguiente.
5. **Comunicación asíncrona en Slack/WhatsApp del equipo**, urgencias por llamada.
6. **Cuando algo no llega, se le avisa al PM antes de las 4 PM** del día en que vence, no a las 11 PM.

---

## Referencias cruzadas

- Alcance que cada rol ejecuta → [`01-alcance-mvp.md`](01-alcance-mvp.md)
- Personas para las que cada rol diseña → [`03-personas-y-canales.md`](03-personas-y-canales.md)
- Arquitectura técnica que separa ownerships → [`04-arquitectura.md`](04-arquitectura.md)
- Cronograma con entregables por día → [`06-cronograma-y-riesgos.md`](06-cronograma-y-riesgos.md)
