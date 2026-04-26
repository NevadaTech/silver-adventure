# Prompts para refinar la landing con `/21st`

> Esta carpeta contiene los recursos de la landing pública de Ruta C Conecta.
> El mockup visual original está en `mockup.html`. La implementación viva
> está en `src/front/app/[locale]/page.tsx` y sus componentes en
> `src/front/app/[locale]/_components/landing/`.

## Reglas para todo prompt

Cuando uses `/21st` (o el agente de Cursor) para refinar bloques, siempre
incluye estas restricciones para que el output encaje con el repo:

```text
Restricciones técnicas obligatorias:
- Next.js 16 App Router. page.tsx es Server Component.
- Solo usa tokens de globals.css (bg-bg, text-text, bg-primary, bg-secondary,
  bg-accent, etc.). NO uses hex hardcoded ni clases tipo bg-blue-500.
- Tipografía: font-display (Plus Jakarta Sans) para headings, font-sans
  (Inter) para body — vienen del layout root, no las cargues otra vez.
- Animaciones: motion/react. Marca el componente como 'use client'
  solo si necesita interactividad/animación.
- Iconos: lucide-react (NO Material Symbols).
- i18n: useTranslations() con keys bajo Landing.<Sección>.
  Agrega keys nuevas a messages/es.json y messages/en.json.
- Imágenes: next/image. NO uses lh3.googleusercontent.com.
  Si necesitas placeholders, usa Unsplash o gradientes con tokens.
- Respeta arquitectura hexagonal: la landing es solo UI, vive en app/,
  NO importa nada de core/.
- Usa Link de '@/i18n/navigation' (no next/link) para mantener el locale.
```

## Prompts por sección

### Hero más cinemático

```text
/21st Refina el componente landing-hero.tsx con un fondo más cinemático.
Quiero un patrón animado sutil tipo "constelación de puntos" que evoque
la red de conexiones del producto. Mantén el copy actual de
Landing.Hero, los CTAs, los trust badges y los tokens. La animación
debe ser performante (transform + opacity, no layout).
[+ pega Restricciones técnicas obligatorias arriba]
```

### Segments con hover más rico

```text
/21st Mejora landing-segments.tsx para que cada card tenga:
- Un detalle decorativo (gradiente sutil, número grande de fondo,
  o ícono pulsando) que diferencie las 4 audiencias.
- Hover que eleve la card, cambie el borde a secondary, y revele
  un link "Conocer más" que ahora está oculto.
- Mantén el orden actual: informal, formal, promoter, coordination.
[+ pega Restricciones técnicas obligatorias arriba]
```

### Steps con timeline visual

```text
/21st Convierte landing-steps.tsx de una grid de 3 cards a un
timeline horizontal en desktop (con línea conectora entre los pasos)
y vertical en mobile. Cada paso debe tener una mini-animación motion
distinta cuando entra al viewport (icono que se dibuja, número que
cuenta, etc.). Mantén las 3 keys: capture, intelligence, delivery.
[+ pega Restricciones técnicas obligatorias arriba]
```

### Camara CTA con dashboard preview

```text
/21st Reemplaza el aside del 5 AM por una preview animada del dashboard
de Conector: una mini visualización de clusters como puntos con líneas
que se conectan al hacer hover (puro CSS o SVG con motion). El contexto
está en Landing.Camara. NO uses imágenes externas.
[+ pega Restricciones técnicas obligatorias arriba]
```

### Final CTA con paralax sutil

```text
/21st Mejora landing-final-cta.tsx con un fondo que tenga un paralax
suave al hacer scroll (el blob amarillo se mueve al revés del scroll).
Mantén el botón con bg-accent y la copia actual.
[+ pega Restricciones técnicas obligatorias arriba]
```

### Sección nueva: testimonios / casos

```text
/21st Crea un componente landing-stories.tsx que muestre 3 historias
cortas en cards horizontales: una vendedora de empanadas, un hotel
boutique, un asesor de la Cámara. Cada card lleva una foto (placeholder
ok), la cita, el nombre, el rol, y un link "Ver historia". Usa motion
con stagger al entrar al viewport. Agrega keys Landing.Stories.* a
ambos JSON de messages. Lo importaré en page.tsx después de Steps.
[+ pega Restricciones técnicas obligatorias arriba]
```

## Cómo correr la landing

```bash
cd src/front
bun dev
# http://localhost:3000  (es / en)
# http://localhost:3000/dev  (demo de Supabase + SWR)
```

## Cómo cambiar la paleta global

Editas las CSS variables en `src/front/app/globals.css`. Los tokens
están registrados con `@theme inline` así que cualquier cambio se
propaga a todos los componentes automáticamente.

Tokens actuales:

| Variable            | Light     | Dark      | Uso típico                 |
| ------------------- | --------- | --------- | -------------------------- |
| `--color-primary`   | `#001430` | `#aac7fd` | Botones principales, brand |
| `--color-secondary` | `#00687b` | `#5dd5f5` | Acentos, links, eyebrows   |
| `--color-accent`    | `#f9b300` | `#ffc940` | CTA final, highlights      |
| `--color-bg`        | `#f7f9fb` | `#0a0f1a` | Fondo página               |
| `--color-surface`   | `#ffffff` | `#111827` | Fondo de cards             |
| `--color-text`      | `#191c1e` | `#e0e3e5` | Texto principal            |

## Próximos pasos sugeridos (cuando haya tiempo)

- [ ] Reemplazar imágenes de Unsplash por fotos reales del equipo y de
      Santa Marta (mercado, Taganga, hotel del Rodadero) en `public/`.
- [ ] Añadir un componente `landing-team.tsx` con los 5 roles y nombres.
- [ ] Conectar el botón "Ver el prototipo" al demo real cuando exista.
- [ ] Generar OpenGraph image en `app/opengraph-image.tsx`.
- [ ] Configurar `next.config.ts` con `turbopack.root` para silenciar
      el warning de múltiples lockfiles.
