# Análisis del Reto · Ruta C Conecta

**Hackathon Samatech · Cámara de Comercio de Santa Marta**
**Motor Inteligente de Clusters Empresariales**

> Documento de aterrizaje del reto — para alineación del equipo antes de codear.

---

## Tabla de contenido

1. [El problema en una sola frase](#1-el-problema-en-una-sola-frase)
2. [Los tres verbos que importan](#2-los-tres-verbos-que-importan)
3. [Componentes obligatorios del MVP](#3-componentes-obligatorios-del-mvp)
4. [Matriz de evaluación — dónde están los puntos](#4-matriz-de-evaluación--dónde-están-los-puntos)
5. [Restricciones — lo que el reto rechaza explícitamente](#5-restricciones--lo-que-el-reto-rechaza-explícitamente)
6. [Arquitectura propuesta](#6-arquitectura-propuesta)
7. [Conceptos clave que el equipo debe dominar](#7-conceptos-clave-que-el-equipo-debe-dominar)
8. [Datos disponibles](#8-datos-disponibles)
9. [Estrategia ganadora — orden de prioridades](#9-estrategia-ganadora--orden-de-prioridades)
10. [Las 5 preguntas de Product Discovery](#10-las-5-preguntas-de-product-discovery)
11. [Pitch para el equipo](#11-pitch-para-el-equipo)

---

## 1. El problema en una sola frase

> Ruta C tiene una base de datos rica de empresarios pero **no genera valor recurrente**: los usuarios entran una vez, llenan formularios y no vuelven. La plataforma no convierte sus datos en conexiones, oportunidades ni acciones útiles para el empresario.

El problema **no es técnico**, es un problema de producto disfrazado de problema de IA. Construir el clustering más sofisticado del mundo no soluciona nada si el empresario no recibe valor cuando lo usa.

---

## 2. Los tres verbos que importan

| Verbo           | Significado                                          | Ejemplo concreto                                        |
| --------------- | ---------------------------------------------------- | ------------------------------------------------------- |
| **CLUSTERIZAR** | Agrupar empresas que tienen sentido juntas           | "Restaurantes en etapa crecimiento en Santa Marta"      |
| **CONECTAR**    | Sugerir RELACIONES entre empresas, no solo similitud | "Esta panadería puede ser proveedor de ese restaurante" |
| **ACCIONAR**    | Convertir el insight en un siguiente paso CLARO      | Botón: "Contactar a Juan Pérez de Panadería La Espiga"  |

**Riesgo común:** los equipos se obsesionan con el primer verbo y olvidan los otros dos. Pero los otros dos valen más puntos en la evaluación.

---

## 3. Componentes obligatorios del MVP

### Ordenados por dificultad técnica real

#### Fáciles (horas de trabajo si se sabe lo que se hace)

1. **Generación de clusters** (sección 4.2 del reto) — K-means o DBSCAN con scikit-learn.
2. **Interfaz mínima** (sección 4.5) — Lista, vista de detalle, botones. CRUD básico.

#### Medios (acá se separan los equipos buenos de los regulares)

3. **Motor de recomendación** (4.1) — Cosine similarity + embeddings. La parte difícil es definir bien el vector de features.
4. **Recomendaciones accionables** (4.4) — Tipo de relación + score + RAZÓN explicada.

#### Difíciles (acá se gana o se pierde la hackathon)

5. **Componente agéntico** (4.3) — Un agente que ACTÚA SOLO sin que el usuario pregunte. Vale 25% de la nota.
6. **Interfaz administrativa** (4.6) — _Opcional, pero da puntos extra._

---

## 4. Matriz de evaluación — dónde están los puntos

```
┌─────────────────────────────────────────────────┐
│ Relevancia de recomendaciones      30%  ███     │
│ IA / Agentica                      25%  ██▌     │
│ Uso frecuente                      20%  ██      │
│ Viabilidad técnica                 15%  █▌      │
│ Experiencia de usuario             10%  █       │
└─────────────────────────────────────────────────┘
```

### Insight estratégico

> **El 55% de la nota (Relevancia + Uso frecuente) NO es técnico.** Es producto y UX.

Un equipo con K-means brutal pero recomendaciones genéricas **pierde** contra un equipo con algoritmo simple pero recomendaciones que el jurado mira y dice _"sí, eso me serviría"_. La calidad de las recomendaciones le gana al algoritmo sofisticado.

---

## 5. Restricciones — lo que el reto rechaza explícitamente

El reto NO acepta soluciones que sean únicamente:

- Directorios de empresas
- Redes sociales genéricas sin lógica de negocio
- Dashboards estáticos sin generación de recomendaciones
- Visualizaciones sin lógica de clustering o scoring

**Patrón común:** todo lo PASIVO está prohibido. El sistema tiene que actuar, recomendar, proponer — no solo mostrar.

---

## 6. Arquitectura propuesta

### Restricciones de arquitectura

**Obligatorias:**

- API REST con JSON
- Motor desacoplado del backend Laravel existente
- Funcional, no conceptual (debe correr, no solo dibujarse)

**Recomendadas (no obligatorias):**

- Stack Google Cloud (BigQuery, Vertex AI, Cloud Run, Gemini)
- Python + FastAPI + scikit-learn
- Laravel para integración futura

### Diagrama de referencia

```
┌────────────────────────────────────────────────┐
│  Frontend (React / Vue / Blade)                │
│  - Lista recomendaciones                       │
│  - Visualización de clusters                   │
│  - Acciones (marcar, contactar, guardar)       │
└──────────────────┬─────────────────────────────┘
                   │ JSON / REST
                   ▼
┌────────────────────────────────────────────────┐
│  Motor Inteligente (FastAPI)                   │
│  ┌──────────┬──────────┬─────────┬──────────┐  │
│  │Clustering│ Matching │  Agente │Explainer │  │
│  │ K-means  │ Cosine   │  Cron / │ Gemini / │  │
│  │ DBSCAN   │ Similarity│ Events │ Reglas   │  │
│  └──────────┴──────────┴─────────┴──────────┘  │
└──────────────────┬─────────────────────────────┘
                   │
        ┌──────────┴──────────┐
        ▼                     ▼
   ┌─────────┐          ┌──────────┐
   │ CSVs /  │          │ MySQL /  │
   │ BigQuery│          │ SQLite   │
   │ Origen  │          │Resultados│
   └─────────┘          └──────────┘
```

---

## 7. Conceptos clave que el equipo debe dominar

### 7.1 ¿Qué es un cluster realmente?

Un cluster NO es un grupo. Un cluster es un grupo donde los miembros se parecen MÁS entre sí que con los de otros grupos. Hay que definir qué significa "parecerse" — eso se llama **función de distancia**.

### 7.2 Feature Engineering

Antes de clusterizar, hay que convertir cada empresa en un vector numérico:

- Sector → one-hot encoding
- Etapa → ordinal (idea < nacimiento < crecimiento < madurez)
- Ubicación → coordenadas geográficas o dummies por municipio
- Programas participados → vector binario
- Variables de diagnóstico → escalado normalizado

**Si los features son malos, el cluster es basura.** Garbage in, garbage out.

### 7.3 Similitud ≠ Complementariedad

**Esta es la distinción más importante del reto:**

- **Peer matching (similitud)** → dos panaderías. Sirven como referentes mutuos.
- **Cadena de valor (complementariedad)** → panadería + restaurante. Sirven como cliente/proveedor.

**Se necesitan DOS lógicas distintas, no una.**

### 7.4 Explicabilidad (XAI)

Cada recomendación debe tener una **razón humana**. No vale "el modelo dice que sí". Hay que poder decir:

> _"Te recomiendo a X PORQUE: mismo sector + etapa avanzada + a 3km tuyo + ya pasó por programas similares"_

Sin esto, se pierde el 30% de relevancia.

### 7.5 Agéntico vs Reactivo

- **Reactivo:** el usuario abre la app, ve recomendaciones. ❌ NO BASTA.
- **Agéntico:** el sistema detecta solo que hay una nueva empresa, calcula matches y notifica al usuario sin que pregunte. ✅ ESTO SÍ.

---

## 8. Datos disponibles

### CSVs locales en `DATA/`

| Archivo                                                        | Contenido probable                       | Importancia                   |
| -------------------------------------------------------------- | ---------------------------------------- | ----------------------------- |
| `CLUSTERS.csv`                                                 | Clusters predefinidos por la Cámara      | Punto de partida / referencia |
| `CLUSTERS_ACTIVIDADESECONOMICAS.csv`                           | Mapeo cluster → CIIU                     | Diccionario maestro           |
| `CLUSTERS_SECTORES_SECCIONES_ACTIVIDADES.csv`                  | Jerarquía sector → sección → actividad   | Taxonomía                     |
| `CLUSTERS_POSIBLES_MIEMBROS_POR_ACTIVIDAD_PRINCIPAL_DATOS.csv` | Empresas candidatas con cluster sugerido | Crítico                       |
| `REGISTRADOS_SII.csv` (2.3 MB)                                 | Universo de empresas registradas         | Crítico                       |

### Documentación teórica disponible en `DOCUMENTACION SOBRE CLUSTERS/`

- `LIBRO-ModeloClustering_Todo.pdf` (14 MB) — Libro completo de modelo de clustering
- `kmeans.pdf` — Teoría de K-means
- `clustering.pdf` — Fundamentos generales
- `cluster-g.pdf` — Clustering geográfico
- `IBM CLUSTERING.docx` — Enfoque IBM

### Datos adicionales

- BigQuery con dataset oficial (credenciales al inicio del hackathon)
- Dashboard en Looker Studio como insumo de exploración

---

## 9. Estrategia ganadora — orden de prioridades

### Día 1 — Fundamentos (sin tocar código)

1. Lectura de PDFs de clustering en `DOCUMENTACION SOBRE CLUSTERS/`
2. EDA de los CSVs — entender qué hay realmente
3. Definir el "perfil de empresa" (qué features, cómo se vectorizan)

### Día 2 — Motor base

4. Clustering simple (K-means) + visualización
5. Similitud coseno entre empresas
6. API REST mínima que devuelva top-N recomendaciones

### Día 3 — Diferenciación (acá se gana)

7. Razonamiento explicable (30% de la nota)
8. Componente agéntico — cron simple que genere notificaciones (25% de la nota)
9. Tipos de relación (cliente / proveedor / aliado / referente)

### Día 4 — Producto

10. UI mínima pero accionable
11. Demo + presentación enfocada en utilidad, no en código

---

## 10. Las 5 preguntas de Product Discovery

### 10.1 ¿Quiénes tienen el problema?

No es un solo actor, son tres. Diseñar para uno solo es un error común.

#### Usuario primario: el empresario / unidad productiva

- Microempresarios, emprendedores, PyMEs registradas en Ruta C
- Distintas etapas: idea, nacimiento, crecimiento, madurez
- Ubicados en Santa Marta y región del Magdalena
- Sectores variados (CIIU diverso)

#### Usuario secundario: la Cámara de Comercio de Santa Marta

- Operadora de Ruta C
- KPI principal: cantidad de empresarios activos + frecuencia de uso
- Hoy tiene una plataforma que pasivamente almacena datos

#### Usuario terciario: gestores y asesores de programas

- Operadores que diseñan convocatorias y diagnósticos
- Necesitan saber qué empresarios calzan con qué programa

> **Insight:** si solo se diseña para el empresario, se ignora que la Cámara también es "cliente" del producto y tiene su propia agenda (mostrar resultados a su junta, justificar presupuesto, demostrar impacto).

---

### 10.2 ¿Por qué tienen ese problema?

Hay que separar **causa raíz** de **síntomas**.

#### Síntomas (lo visible)

- Los empresarios se registran una vez y no vuelven
- La Cámara tiene datos que no monetiza ni explota
- No hay conexiones entre empresarios

#### Causa raíz (lo que importa)

**Causa 1: Ruta C fue diseñada como SISTEMA DE INFORMACIÓN, no como PRODUCTO**
La plataforma está pensada para registrar (input), no para devolver valor (output). Es un formulario gigante. Los formularios no generan retención — el valor genera retención.

**Causa 2: Asimetría de información**
Cada empresario está aislado. _"Yo no sé que existe otra panadería a 3 cuadras que necesita un proveedor de harina como yo"_. Los datos están ahí pero invisibles para el empresario individual.

**Causa 3: Sin trabajo manual no hay matchmaking**
Hoy si se quiere conectar a dos empresarios, alguien de la Cámara tiene que sentarse, mirar una planilla, y mandar mails. **No escala.** Por eso piden "agentic" — que el sistema lo haga solo.

---

### 10.3 ¿Cómo podemos solucionar el problema?

Tres capas, en este orden:

#### Capa 1: INTELIGENCIA (motor que piensa)

- Vectoriza cada empresa en un perfil numérico (sector, etapa, ubicación, programas, diagnósticos)
- Agrupa automáticamente con K-means / DBSCAN / clustering jerárquico
- Calcula similitud (peer matching) y complementariedad (cadena de valor)

#### Capa 2: AGENCIA (sistema que actúa solo)

- Corre periódicamente sin que nadie lo pida
- Detecta eventos: nueva empresa registrada, cambio de etapa, nuevo programa
- Genera notificaciones automáticas: _"Hola Juan, registraron una empresa que puede ser tu cliente"_

#### Capa 3: ACCIÓN (UX que convierte insight en next-step)

- Recomendaciones priorizadas con score y razón explicada
- Un clic para: contactar / guardar / marcar como conexión
- Visualización del cluster y el grafo de relaciones

> **El truco de oro:** la solución NO es "hacer K-means". Es construir un **bucle de valor**:
>
> `dato → cluster → recomendación → acción → feedback → mejor dato`
>
> Cada acción del empresario enriquece el sistema y mejora la próxima recomendación. Eso genera uso frecuente.

---

### 10.4 ¿Cómo les beneficia usar nuestra solución?

Los beneficios deben ser CONCRETOS y MEDIBLES, no genéricos.

#### Para el empresario

| Antes (sin solución)                 | Después (con solución)                                         |
| ------------------------------------ | -------------------------------------------------------------- |
| "Estoy solo en mi negocio"           | "Tengo 12 empresas similares que ya pasaron por lo mismo"      |
| "No sé quién puede ser mi proveedor" | "El sistema me sugiere 3 proveedores cercanos del sector"      |
| "Entré a Ruta C una vez, no vuelvo"  | "Cada semana recibo una notificación con una oportunidad real" |
| "No sé qué programa me sirve"        | "Me dicen: este programa es para empresas como vos"            |

**Resumen:** _"Te conectás con tu ecosistema sin tener que buscarlo."_

#### Para la Cámara de Comercio

- Frecuencia de uso x10: empresarios vuelven cada semana en vez de una vez al año
- Datos vivos: cada conexión marcada enriquece el sistema
- Justificación de impacto: _"Generamos N conexiones/mes entre empresarios"_
- Ventaja competitiva: ninguna otra Cámara del país ofrece esto

#### Para el ecosistema regional

- Tejido empresarial más conectado en el Magdalena
- Reducción del costo de búsqueda de aliados estratégicos
- Más operaciones B2B locales (proveedor regional > proveedor de Bogotá)

---

### 10.5 ¿Por qué no quieren registrarse / volver?

> **Distinción crítica:** el reto no dice "no se registran", dice "no vuelven". Este es un problema de RETENCIÓN, no de adopción.

#### Razones reales (las que el documento NO dice explícitamente)

**Razón 1: "No me da nada a cambio"**
El empresario llena 30 campos, recibe un PDF, y... ya está. No hay un _next step_. Si la primera experiencia no devuelve valor, no hay segunda visita.

**Razón 2: "Otra plataforma del gobierno que me hace perder tiempo"**
Asociación mental con burocracia. Cada empresario colombiano ya se registró en 8 plataformas estatales que no le sirvieron para nada. Ruta C parte con desventaja reputacional.

**Razón 3: "No confío en mostrar mis datos"**
_"¿Para qué quieren saber mi facturación, mis ventas, mis problemas? ¿Esto le llega a la DIAN?"_. Hay miedo a la exposición.

**Razón 4: "No entiendo qué me ofrecen"**
La propuesta de valor de Ruta C hoy es difusa: _"plataforma de gestión de empresarios"_. ¿Qué significa eso para un panadero? Nada.

**Razón 5: "Friction de registro alto"**
Si el formulario tiene 50 campos, abandonan a la mitad. Cada campo extra es un % de abandono.

#### La pregunta detrás de la pregunta

El reto NO pide resolver la adopción. Pide resolver la RETENCIÓN. Las razones por las que no VUELVEN son:

1. No hay "tirón de gancho" — nada que los traiga de nuevo
2. No hay loop de valor — entrar no les devuelve algo nuevo
3. No hay notificaciones útiles — el sistema es pasivo
4. No hay relaciones sociales — están solos en la plataforma

> **Insight estratégico:** la solución a "no vuelven" es **exactamente el reto** — clusters + recomendaciones + agente que los avisa cuando algo nuevo pasa. Por eso el reto está bien diseñado.

---

## 11. Pitch para el equipo

> **Problema:** Los empresarios registrados en Ruta C tienen una plataforma rica en datos pero pobre en valor recurrente. Entran una vez, llenan formularios y no vuelven — porque la plataforma no les devuelve nada útil de forma proactiva.
>
> **Por qué pasa:** Ruta C fue diseñada como sistema de información (input), no como producto (output). Cada empresario está aislado en sus propios datos, sin saber que existen otros con quien podría conectarse. Y la Cámara no tiene capacidad operativa para hacer matchmaking manual a escala.
>
> **Nuestra solución:** Un motor inteligente con tres capas — (1) clusters dinámicos generados por IA, (2) un agente autónomo que detecta oportunidades sin intervención humana, (3) recomendaciones accionables con razón explicada y un siguiente paso claro.
>
> **Beneficio:** El empresario pasa de "estoy solo" a "tengo una red de aliados, clientes y proveedores siempre al alcance". La Cámara pasa de "tengo datos muertos" a "genero N conexiones reales por mes". Frecuencia de uso x10.
>
> **Por qué no vuelven hoy:** Porque la plataforma es pasiva, no hay tirón de gancho, no hay loop de valor, no hay notificaciones proactivas. Nuestra solución ataca exactamente eso.

---

## Mantra del equipo

> "No estamos construyendo un clasificador. Estamos construyendo un asesor que ayuda a empresarios a encontrar negocios."

---

## Próximos pasos sugeridos

1. **Validar este análisis con el equipo** — alinearse en problema y propuesta
2. **EDA de los CSVs** — verificar que los datos soportan la propuesta
3. **Definir features del perfil de empresa** — la base de todo el motor
4. **Prototipo de clustering** — versión más simple posible que funcione end-to-end
5. **Iterar sobre relevancia** — el 30% de la nota se gana acá

---

_Documento generado como base de discusión interna del equipo. Iterar y ajustar según definiciones propias._
