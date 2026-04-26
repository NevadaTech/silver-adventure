# 07 · Landing en Stitch

> Diseño de la landing page de Ruta C Conecta generada en Stitch para el jurado del Hackathon Samatech 2026.
> Este documento es el **single source of truth** del copy y las decisiones visuales — cuando se implemente en Next.js (Día 2 del cronograma según [`06-cronograma-y-riesgos.md`](06-cronograma-y-riesgos.md)) se parte de aquí.

---

## Recursos en Stitch

| Recurso            | ID / Nombre                                                             |
| ------------------ | ----------------------------------------------------------------------- |
| **Proyecto**       | `projects/4385837129953655302` — _Ruta C Conecta — Landing_             |
| **Design system**  | `assets/5937775460437856799` — _Ruta C Conecta - Caribe Institucional_  |
| **Screen desktop** | `projects/4385837129953655302/screens/eea3164b1b74416abb8d104d3bd2ef08` |
| **Screen mobile**  | `projects/4385837129953655302/screens/bf62805bdf0743a0822626b8bba182b8` |

### Acceso

Las pantallas se editan desde [stitch.withgoogle.com](https://stitch.withgoogle.com) abriendo el proyecto _Ruta C Conecta — Landing_. Para iterar sobre el diseño desde aquí, usar las herramientas MCP `edit_screens` o `generate_variants` con los IDs anteriores.

### Dimensiones

- **Desktop**: 2560 × 12682 px (landing largo, scroll vertical)
- **Mobile**: 780 × 6900 px (una sola columna, optimizado táctil)

---

## Audiencia y objetivo

- **Audiencia**: jurado del hackathon. No empresarios reales, no Cámara como cliente.
- **Objetivo**: vitrina del proyecto en 60–90 segundos de lectura. El jurado debe poder entender el diferenciador, ver el demo y validar la viabilidad técnica.
- **CTAs primarios**:
  - `Ver demo en vivo` — link a la URL de producción (Vercel) cuando esté lista
  - `Ver documentación técnica` — link a [`docs/documentacion.md`](../documentacion.md)
  - `Ver repositorio en GitHub` — link al repo

---

## Identidad visual aplicada

### Paleta — "Caribe Institucional"

| Token     | Hex       | Uso                                                  |
| --------- | --------- | ---------------------------------------------------- |
| Primary   | `#0E5C7A` | Azul Caribe profundo. Autoridad, fondos secundarios. |
| Secondary | `#E89B4D` | Dorado-arena cálido. Acentos, números, CTA dorado.   |
| Tertiary  | `#1F8A70` | Verde manglar. Estados positivos, chips.             |
| Neutral   | `#F7F3ED` | Arena clara. Fondo principal, secciones claras.      |

### Tipografía

- **Headlines**: `Newsreader` (serif editorial — autoridad institucional con calidez)
- **Body**: `Inter` (legibilidad neutra)
- **Labels**: `Inter`

### Otros tokens

- **Color mode**: Light
- **Color variant**: Content (Stitch deriva tonal a partir de los seeds)
- **Roundness**: 12px (suave, contemporáneo)
- **Color seed**: `#0E5C7A`

### Reglas editoriales aplicadas

- Cero emojis.
- Cero íconos cliché de tech (cohetes, rayos, robots, gráficas con flechas).
- Las personas aparecen siempre con nombre propio: **Doña Marleny**, **Carlos**, **Andrea**, **Camila**. Nunca "usuario".
- Frases cortas, verbos en presente, español neutro de Colombia.

---

## Estructura de la landing — 11 secciones

> El plan original tenía 9 secciones; la implementación final separó navbar y footer, total 11.

```
1.  Navbar fijo
2.  Hero
3.  El problema
4.  El diferenciador
5.  Cómo funciona — 3 capas
6.  Las 4 personas y sus canales
7.  Un día normal — timeline
8.  El motor inteligente — bajo el capó
9.  Stack y arquitectura
10. CTA final
11. Footer institucional
```

---

## Copy final por sección

### 1. Navbar

- **Logo**: `Ruta C Conecta` (wordmark Newsreader)
- **Chip**: `Hackathon Samatech 2026`
- **Links**: _Cómo funciona_ · _Equipo_ · _Documentación_
- **Botón primario**: `Ver demo en vivo`

### 2. Hero

- **Eyebrow**: `Hackathon Samatech 2026 · Cámara de Comercio de Santa Marta`
- **H1**: _"Conectamos la economía formal e informal de Santa Marta en una sola red."_
- **Subhead**: _"Un motor inteligente con un agente que actúa solo. Cada día, recomendaciones específicas con razón explicada — para empresarios formales en la web y para comerciantes informales por WhatsApp."_
- **CTAs**:
  - Primario: `Ver demo en vivo`
  - Secundario: `Ver documentación técnica`
- **Visual**:
  - Laptop con card de recomendación: _Cooperativa Pesquera de Taganga_ · `Proveedor` · score 87 · razón: _"Tres hoteles boutique parecidos al tuyo en Rodadero ya compran pescado fresco a esta cooperativa. Está a 12 km y entrega diariamente."_
  - Celular con conversación de WhatsApp del bot oficial enviando a Doña Marleny la oportunidad de surtir 12 almuerzos diarios, con tres botones: `Sí, me interesa` · `Cuénteme más` · `Ahora no`.

### 3. El problema

- **Eyebrow**: `El problema`
- **H2**: _"Ruta C tiene una base de datos rica que se quedó estancada."_
- **3 cards**:
  - **Asimetría de información** — Cada empresario solo conoce a quien tiene cerca o a quien ya conocía.
  - **Dificultad de descubrimiento** — Aunque quisiera buscar, una base de datos plana no responde "¿quién me conviene?".
  - **Parálisis de acción** — Una recomendación sin siguiente paso claro se queda en pantalla.
- **Frase destacada**: _"Y un vacío más grande: la economía informal que mueve el día a día y el sistema no ve."_

### 4. El diferenciador

- **Eyebrow**: `Lo que nos diferencia`
- **H2**: _"Otros recomendadores conectan registrados con registrados. Eso es un directorio."_
- **Sub**: _"Ruta C Conecta hace tres cosas que ningún otro sistema hace en el ecosistema actual."_
- **3 columnas con números dorados**:
  - **01 · Una sola red** — Formal e informal con la misma lógica de matching.
  - **02 · Cada quien en su canal** — Web, WhatsApp, voz. Nadie aprende nada nuevo.
  - **03 · Decisiones explicadas** — Cada recomendación responde "¿por qué a mí?" en lenguaje natural.

### 5. Cómo funciona — 3 capas

- **Eyebrow**: `Cómo funciona`
- **H2**: _"Tres capas, una sola lógica."_
- **Diagrama de 3 bloques** (referenciados en [`04-arquitectura.md`](04-arquitectura.md)):
  - **Captura** — Web Ruta C · WhatsApp · Promotor con voz
  - **Inteligencia** — Clustering dinámico · Peer matching · Cadena de valor · Explicabilidad
  - **Entrega** — Web del formal · Bot WhatsApp · Panel admin
- **Banda inferior**: `Conector — el agente que actúa solo cada noche y por eventos en tiempo real`

### 6. Las 4 personas

- **Eyebrow**: `Para quién es`
- **H2**: _"Cuatro personas, cuatro puertas, una sola red."_
- **4 cards** (detalle completo en [`03-personas-y-canales.md`](03-personas-y-canales.md)):
  - **Doña Marleny** — vendedora de empanadas en el Mercado del Magdalena · _Canal: WhatsApp_ · Recibe oportunidades concretas sin descargar nada.
  - **Carlos** — hotel boutique en El Rodadero · _Canal: Web Ruta C_ · Encuentra proveedores, aliados y referentes con explicación clara.
  - **Andrea** — asesora de la Cámara en territorio · _Canal: App móvil_ · Registra a un comerciante en 30 segundos con voz.
  - **Camila** — coordinadora del programa · _Canal: Panel admin_ · Trazabilidad, métricas y mapa de la economía real.

### 7. Un día normal — timeline

- **Eyebrow**: `Un día normal en Ruta C Conecta`
- **H2**: _"Una mañana cualquiera en Santa Marta."_
- **5 hitos**:
  - **5:00 AM** — Conector recalcula los clusters de Santa Marta con los registros de la jornada anterior.
  - **8:15 AM** — Carlos abre Ruta C tras 8 meses y encuentra 3 recomendaciones nuevas con explicación clara.
  - **10:30 AM** — Andrea registra a Doña Marleny en el Mercado con un audio de 30 segundos.
  - **2:45 PM** — Doña Marleny recibe por WhatsApp la oportunidad de surtir 12 almuerzos diarios.
  - **5:45 PM** — Camila revisa el panel admin con las conexiones del día y los empresarios priorizados.

### 8. El motor inteligente

- **Eyebrow**: `Bajo el capó`
- **H2**: _"Inteligencia con explicación verificable."_
- **3 columnas**:
  - **Dos lógicas distintas** — Peer matching por similitud semántica (`referente`, `aliado`). Cadena de valor por reglas heurísticas más LLM clasificador (`cliente potencial`, `proveedor`).
  - **Explicabilidad con anclas** — Distancia, programa compartido, pares conectados, sector compatible. La razón en lenguaje natural se construye de hechos verificables, no de cajas negras.
  - **Agente Conector** — Cron nocturno a las 5 AM, trigger por nuevo registro, trigger por cambio de etapa. Genera notificaciones outbound y prioriza empresarios para asesores humanos.
- **Frase destacada**: _"Cada recomendación responde por qué a mí en una frase, con datos auditables."_
- Detalle técnico en [`05-motor-recomendaciones.md`](05-motor-recomendaciones.md).

### 9. Stack y arquitectura

- **Eyebrow**: `Cómo está construido`
- **H2**: _"Arquitectura desacoplada, datos reales."_
- **Logos en grid**: Next.js · NestJS · Supabase · Vertex AI · Gemini · WhatsApp Business Cloud · Google Cloud Run · BigQuery
- **Diagrama horizontal de 4 cajas**: `Frontend Next.js` → `BFF NestJS` → `Motor Inteligente` → `Postgres + BigQuery`

### 10. CTA final

- **H2 grande centrado**: _"Esto que acabas de ver funciona end-to-end. Veamos."_
- **3 botones**:
  - Primario dorado: `Ver demo en vivo`
  - Secundario outline blanco: `Ver repositorio en GitHub`
  - Terciario texto: `Ver documentación técnica`

### 11. Footer institucional

- **Logo**: `Ruta C Conecta`
- **Texto institucional**: `Hackathon Samatech 2026 · Cámara de Comercio de Santa Marta`
- **Tres columnas de links**:
  - **Producto** — Cómo funciona · Para quién es · Un día normal
  - **Técnico** — Documentación · Arquitectura · Repositorio
  - **Equipo** — PM/Lead · Backend/IA · Frontend · Data/ML · Diseño/UX
- **Crédito final**: _"Reto oficial: Ruta C Conecta — Motor Inteligente de Clusters Empresariales. Documento base por Hernando Alfonso Varón · Grimorum."_

---

## Decisiones de diseño tomadas

### Por qué Newsreader y no un sans serif

Otros equipos del hackathon van a usar Inter, Geist o Plus Jakarta para todo. Eso es seguro y se ve "tech" pero plano. Newsreader como serif editorial transmite peso institucional (Cámara de Comercio) sin caer en frío legal. Combinado con Inter para body, deja la legibilidad intacta y el carácter ganado.

### Por qué Light mode primario

El jurado va a ver la landing en pantalla grande del venue. Light mode garantiza legibilidad en cualquier proyector. La sección _El diferenciador_ y _CTA final_ rompen con azul Caribe oscuro para crear ritmo visual.

### Por qué dos pantallas separadas (no una responsive)

Stitch genera mejor cuando se le pide un layout específico por dispositivo. La mobile no es un crop del desktop: la jerarquía cambia (hero apilado, timeline vertical, botones full-width). Genera dos diseños permite optimizar cada uno y mostrar al jurado que pensamos UX en ambos contextos.

### Mockups en el hero

El laptop + celular lado a lado en desktop (apilados en mobile) son la forma más rápida de comunicar el diferenciador "una red, dos canales" sin tener que leer el copy. La idea es que en 3 segundos el jurado entienda: _"ah, esto es web Y WhatsApp"_.

---

## Próximos pasos

### Inmediato (esta semana)

- [ ] Revisar pantallas en Stitch y validar copy con el equipo.
- [ ] Iterar con `edit_screens` si hay ajustes puntuales (tono, color, jerarquía).
- [ ] Generar variantes de hero con `generate_variants` para A/B interno.
- [ ] Exportar el diseño a Figma desde Stitch para que **UX** lo refine.

### Día 2 del hackathon (cuando arranque construcción)

Según [`06-cronograma-y-riesgos.md`](06-cronograma-y-riesgos.md), la implementación de la landing en Next.js cae en Frontend.

- [ ] **Frontend** implementa la landing en [`src/front/`](../../src/front/) usando los design tokens definidos aquí.
- [ ] Los design tokens (`#0E5C7A`, `#E89B4D`, `#1F8A70`, `#F7F3ED`) entran como variables CSS en el theme de Tailwind.
- [ ] Newsreader e Inter se cargan vía `next/font/google`.
- [ ] El copy de cada sección se mueve a un archivo de locale `messages/es.json` siguiendo el patrón de [`src/front/messages/`](../../src/front/messages/).
- [ ] Los mockups del hero se reemplazan por capturas reales del producto cuando el demo esté funcional.

### Roadmap visible (no se construye en hackathon)

Estas iteraciones están alineadas con [`01-alcance-mvp.md`](01-alcance-mvp.md) — son post-hackathon:

- Versión en inglés (jurados internacionales o expansión).
- Página dedicada por persona (`/marleny`, `/carlos`, `/andrea`, `/camila`) con landing focalizada por canal.
- Integración de testimonios reales una vez se tengan conexiones generadas.

---

## Referencias cruzadas

- Copy y narrativa principales → [`README.md`](../../README.md)
- Personas que protagonizan la landing → [`03-personas-y-canales.md`](03-personas-y-canales.md)
- Arquitectura de las 3 capas → [`04-arquitectura.md`](04-arquitectura.md)
- Motor que se describe en _Bajo el capó_ → [`05-motor-recomendaciones.md`](05-motor-recomendaciones.md)
- Cuándo se implementa en código → [`06-cronograma-y-riesgos.md`](06-cronograma-y-riesgos.md)
