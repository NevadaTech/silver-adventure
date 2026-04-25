# Reto Hackathon · Ruta C Conecta

### Motor Inteligente de Clusters Empresariales

**Hackathon Samatech · Cámara de Comercio de Santa Marta**

---

## Equipo

**Nombre del equipo:** `escribe aquí`

| Nombre completo | Rol |
| --------------- | --- |
|                 |     |
|                 |     |
|                 |     |

**Cómo idearon la solución:**

> _(Escribe aquí un párrafo contando cómo llegaron a la idea: qué problema identificaron primero, qué enfoque eligieron y por qué.)_

---

## Entrega del repositorio

- El repositorio debe ser **privado** en GitHub
- Debe compartirse con **andresvz91@gmail.com** antes del cierre del hackathon
- Un repositorio por equipo

### Estructura requerida

```
nombre-del-equipo/
├── README.md                  ← este archivo, con equipo e idea
├── src/                       ← código fuente de la solución
├── docs/
│   └── documentacion.md      ← documentación técnica (ver sección abajo)
└── presentacion/
    └── presentacion.pdf       ← o .pptx, la que presentarán al jurado
```

---

## Qué debe contener la documentación técnica

El archivo `docs/documentacion.md` debe explicar:

1. **Cómo funciona la solución** — descripción del flujo completo
2. **Stack tecnológico** — lenguajes, frameworks y librerías usadas
3. **Herramientas de terceros** — cuáles se usan y cómo (APIs, modelos de IA, servicios cloud)
4. **Arquitectura** — diagrama o descripción de los componentes y cómo se conectan
5. **Cómo correr el proyecto localmente** — pasos claros desde cero

---

## Especificaciones técnicas del reto

### Contexto

La plataforma Ruta C gestiona información de unidades productivas, empresarios, programas, convocatorias, diagnósticos, etapas de crecimiento e intervenciones. Aunque existe una base de datos rica, no se usa para generar conexiones estratégicas entre empresarios ni para facilitar oportunidades de negocio de forma automatizada.

### Objetivo

Diseñar y construir un sistema basado en inteligencia artificial o agentica que permita:

1. Generar clusters dinámicos de empresarios
2. Recomendar conexiones relevantes entre unidades productivas
3. Identificar oportunidades de negocio (clientes, proveedores, aliados)
4. Proponer acciones concretas al usuario
5. Incrementar la frecuencia de uso de la plataforma

---

### Componentes requeridos (MVP)

#### 1. Motor de recomendación

Debe analizar atributos de cada unidad productiva:

- Sector económico (CIIU)
- Etapa de crecimiento (idea, nacimiento, crecimiento, madurez)
- Ubicación geográfica (municipio o región)
- Participación en programas
- Variables de diagnóstico

Y generar recomendaciones de:

- Empresas similares (peer matching)
- Empresas complementarias (cadena de valor)
- Empresas relacionadas por proximidad geográfica

Técnicas permitidas: cosine similarity, embeddings, K-means, DBSCAN, clustering jerárquico, reglas heurísticas, modelos de lenguaje.

#### 2. Generación automática de clusters

- Clusters por sector, por etapa, geográficos e híbridos
- No deben ser estáticos ni definidos manualmente
- Debe poderse explicar por qué una empresa pertenece a cada cluster
- Opcional (valorado): visualización en grafo, mapa o lista agrupada

#### 3. Componente agéntico

Al menos un agente activo que:

- Analice los datos periódicamente sin intervención del usuario
- Detecte oportunidades cuando se registra una empresa nueva o cambia su etapa
- Genere sugerencias como: _"Contactar empresa X"_, _"Unirse al cluster Y"_

Puede implementarse como: cron job, worker, lógica por eventos o integración con modelos de IA.

#### 4. Recomendaciones accionables

Cada recomendación debe incluir:

- Lista priorizada de empresas sugeridas
- Tipo de relación: `cliente potencial`, `proveedor`, `aliado estratégico`, `referente`
- Score o prioridad
- Razón explicada (no solo el dato)

#### 5. Interfaz de usuario mínima

- Vista con recomendaciones personalizadas
- Visualización de clusters
- Detalle de por qué se recomienda cada empresa
- Acciones: marcar conexión, guardar recomendación, simular contacto

#### 6. Interfaz administrativa _(opcional, valorada)_

- Visualizar clusters generados
- Consultar recomendaciones del sistema
- Monitorear actividad del agente
- Trazabilidad de decisiones del modelo

---

### Datos

Se provee acceso a **BigQuery** con el dataset de Ruta C al inicio del hackathon (credenciales en sobre cerrado por equipo).

Entidades disponibles: unidades productivas, empresarios, programas, convocatorias, diagnósticos, intervenciones.

Se permite usar datos simulados o anonimizados.

#### Dashboard de clusters en Looker Studio

Como insumo para entender la estructura de los datos y los clusters existentes antes de construir la solución, se entrega acceso al siguiente dashboard:

**[Ver dashboard Ruta C en Looker Studio →](https://datastudio.google.com/reporting/27d8c315-efe4-4d6d-b1af-846d24539f5f)**

Este reporte muestra la caracterización actual de las unidades productivas, distribución por sector, etapa y territorio, y los clusters ya identificados por la Cámara de Comercio. Úsalo como punto de partida para entender los datos antes de diseñar el motor inteligente.

**Herramientas recomendadas:**
[samatech.com.co/herramientas](https://samatech.com.co/herramientas)

---

### Stack tecnológico recomendado

Las herramientas listadas a continuación son **recomendaciones de la Cámara de Comercio** basadas en el ecosistema Google Cloud disponible y el documento oficial del reto. Los equipos pueden usar **cualquier lenguaje, framework o herramienta open source** que consideren adecuado para resolver el problema, incluyendo JavaScript, TypeScript, o cualquier otra tecnología. Lo que sí es obligatorio es que la solución sea funcional, modular e integrable con Laravel vía API REST.

#### Datos y análisis

| Herramienta             | Uso en el reto                                                                                                 |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| **Google BigQuery**     | Fuente principal de datos de Ruta C — consultas analíticas sobre unidades productivas, diagnósticos y clusters |
| **BigQuery ML**         | Entrenar modelos de clustering (K-means) directamente en SQL sin infraestructura adicional                     |
| **Looker Studio**       | Exploración visual de los datos antes de construir — dashboard provisto como insumo                            |
| **pandas / pandas-gbq** | Leer resultados de BigQuery en Python como DataFrames para procesamiento                                       |

#### Motor inteligente (clustering y recomendaciones)

| Herramienta               | Uso en el reto                                                    |
| ------------------------- | ----------------------------------------------------------------- |
| **Python**                | Lenguaje principal recomendado para el motor inteligente          |
| **scikit-learn**          | K-means, DBSCAN, clustering jerárquico, cosine similarity         |
| **numpy / pandas**        | Preprocesamiento y vectorización de perfiles de empresas          |
| **sentence-transformers** | Embeddings semánticos locales para representar perfiles textuales |
| **NetworkX**              | Construcción de grafos de relaciones entre empresas               |

#### Inteligencia artificial y agentica (Google Cloud)

| Herramienta                 | Uso en el reto                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------- |
| **Vertex AI**               | Plataforma central de IA en Google Cloud — entrenamiento, despliegue y gestión de modelos                     |
| **Gemini flash / Pro**      | Clasificar tipo de relación entre empresas, generar explicaciones de recomendaciones, razonamiento del agente |
| **text-embedding-gecko**    | Convertir el perfil textual de cada empresa en vectores para similitud semántica                              |
| **Vertex AI Agent Builder** | Construir el componente agéntico que actúa sin intervención del usuario                                       |
| **Google Cloud Run**        | Desplegar el motor inteligente como servicio sin servidor, consumible desde Laravel vía API REST              |
| **Google Cloud Scheduler**  | Disparar el agente de forma programada (equivalente a cron)                                                   |
| **Google Cloud Pub/Sub**    | Trigger por eventos — detectar registro de nueva empresa y activar el agente automáticamente                  |

#### Backend y API

| Herramienta           | Uso en el reto                                                                                 |
| --------------------- | ---------------------------------------------------------------------------------------------- |
| **FastAPI (Python)**  | Exponer el motor inteligente como API REST — recomendado por velocidad de desarrollo           |
| **Laravel (PHP)**     | Backend principal existente de Ruta C — gestión de usuarios, persistencia, interfaz            |
| **Laravel Scheduler** | Integración futura del agente con el sistema de colas de Laravel                               |
| **MySQL**             | Persistencia de clusters generados y recomendaciones (tablas nuevas, sin tocar las existentes) |

#### Frontend (angular / React / Vue)

| Herramienta            | Uso en el reto                                                               |
| ---------------------- | ---------------------------------------------------------------------------- |
| **Laravel Blade**      | Integración directa en Ruta C — opción recomendada para mayor compatibilidad |
| **React / Vue + Vite** | Frontend desacoplado si el equipo prefiere separar responsabilidades         |
| **Leaflet.js**         | Visualización geográfica de clusters por municipio                           |
| **D3.js**              | Visualización de grafos de relaciones entre empresas                         |

#### Arquitectura de referencia

```
[Usuario]
    │
    ▼
[Frontend · angular / React / Vue]
    │ HTTP / REST JSON
    ▼
[Motor inteligente · FastAPI en Cloud Run]
    ├── Clustering      → scikit-learn / BigQuery ML
    ├── Matching        → embeddings text-embedding-gecko + cosine similarity
    ├── Agente          → Vertex AI Agent Builder / Cloud Scheduler / Pub/Sub
    └── Explicaciones   → Gemini flash / Pro
    │
    ├── Lee de   → BigQuery (dataset Ruta C)
    └── Escribe en → MySQL (tablas nuevas de resultados)
```

---

### Requisitos técnicos

- La solución debe ser **funcional**, no solo conceptual
- Debe existir lógica clara de generación de clusters y recomendaciones
- El enfoque debe estar documentado (algoritmos, modelos, reglas usadas)
- Los resultados deben poder **explicarse**
- La arquitectura debe ser **desacoplada**: motor inteligente expuesto como API REST consumible desde Laravel
- Formatos de intercambio: JSON
- El agente debe poder integrarse con Laravel Scheduler o Queues

---

### Restricciones — lo que no se acepta

- Directorios de empresas sin inteligencia
- Redes sociales genéricas sin lógica de negocio
- Dashboards estáticos sin generación de recomendaciones
- Visualizaciones sin lógica de clustering o scoring
