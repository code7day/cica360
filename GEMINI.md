# Gemini / Antigravity — CICA360 (front)

Instrucciones para **Gemini CLI**, **Antigravity** y otros agentes Gemini en este repositorio.

## Fuente de verdad

El estado y las decisiones viven en `docs/context/`. Leerlos **antes** de proponer o escribir código:

| Prioridad | Archivo | Uso |
|-----------|---------|-----|
| 1 | [`docs/context/CURRENT_STATE.md`](docs/context/CURRENT_STATE.md) | Estado real |
| 2 | [`docs/context/TASK.md`](docs/context/TASK.md) | Tarea, aceptación, división de roles |
| 3 | [`docs/context/ARCHITECTURE.md`](docs/context/ARCHITECTURE.md) | Diseño del sitio |
| 4 | [`docs/context/DECISIONS.md`](docs/context/DECISIONS.md) | ADRs |
| 5 | [`docs/context/PROGRESS.md`](docs/context/PROGRESS.md) | Avances |
| 6 | [`docs/context/api/stamless-api-v1.md`](docs/context/api/stamless-api-v1.md) | Manual del API Stamless — forma exacta de `data`, `blocks[]`, `links[]`, etc. |
| — | [`AGENTS.md`](AGENTS.md) | Protocolo multi-agente |

## Rol esperado

Dueño de la **capa visual** del sitio:

- `src/layouts/*` — layouts base (página, post, etc.)
- `src/components/blocks/*` — un componente por `block.type` (`hero`, `rich_text`, `features`, `split`, `testimonials`, `logos`, `cta`, `services_grid`, `contact_form`, ...)
- Header/Footer con datos de menú (ya resueltos por `src/lib/api.ts`, no hay que armar la lógica de fetch acá)
- Fidelidad visual a las capturas de CICA360

## Constraints del proyecto (no negociar sin ADR)

- **Framework:** Astro (SSG, islands architecture) — **no** envolver bloques presentacionales en un framework JS "por las dudas". Un componente `.astro` sin `client:*` no manda JS al navegador; ese es el objetivo de performance del proyecto y se pierde si cada bloque termina siendo un componente React montado.
- **JS solo donde hace falta de verdad:** hoy eso es `contact_form` (y el hero-slider si necesita interacción real, ideal evaluar primero si alcanza con CSS `scroll-snap`/`prefers-reduced-motion` antes de sumar JS). Si tenés dudas sobre si un bloque necesita JS, preguntá antes de asumir que sí.
- **CSS:** Tailwind v4 es la base aceptada; mantener consistencia de tokens/spacing entre bloques.
- **Hosting:** shared hosting sin Node/npm — nada de lo que agregues puede depender de un server Node en producción.

## Límite explícito (no tocar)

- **No** cambiar `src/lib/api.ts`, los tipos del API, ni el contrato de fetch/`getStaticPaths` — eso es de Claude.
- **No** cambiar la estrategia de autenticación/formulario (proxy PHP vs token acotado).
- Si un bloque necesita un dato que `api.ts` no expone todavía, pedirlo (no improvisar un fetch propio dentro de un componente).

## Protocolo de trabajo

1. Un agente = un owner de la tarea en `TASK.md`.
2. Trabajar solo la subtarea de "Antigravity" pendiente.
3. Al finalizar sesión:
   - Actualizar `CURRENT_STATE.md`
   - Actualizar `TASK.md` (checks, owner)
   - Añadir entrada en `PROGRESS.md`
   - Listar archivos tocados y qué queda pendiente para Claude
4. Si se toma una decisión visual estructural (ej. cambiar de librería de carrusel) → ADR en `DECISIONS.md`.

## Qué optimizar

- Fidelidad visual real a las capturas de CICA360.
- JS mínimo: cada componente que agregás, preguntate si de verdad necesita `client:load`/`client:visible` o si puede ser `.astro` puro.
- Accesibilidad básica (contraste, `alt` en imágenes, foco visible, estructura de encabezados).
- Consistencia de diseño entre bloques (spacing, tipografía, color) usando los mismos tokens de Tailwind.

## Producto en una línea

Sitio público de CICA360, en Astro con salida estática, consumiendo el API REST headless de Stamless — la capa de datos ya resuelta por Claude, tu trabajo es la fidelidad visual y la experiencia de cada bloque.
