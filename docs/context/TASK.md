# CICA360 (front) — Tarea actual

> Última actualización: 2026-08-30 (Header: dimensiones/transiciones finales + is_home; Hero: position_container/align_content/decorator_bottom/slide_background_*/animación de entrada).
> Owner actual: _(libre)_
> Estado: **Header.astro y Hero.astro con varias rondas de ajustes finos este día (ver PROGRESS.md, entradas del 2026-08-30). Sigue pendiente la validación visual real de ambos — bloqueada por lo mismo de siempre: sin media real en genesis (R2 pendiente) y sin confirmar que el humano corrió `npm install`/`php artisan migrate` locales tras los cambios de esta sesión.**

---

## Tarea activa

**Ajustar Hero Slider contra el diseño fuente de verdad (`docs/UX-UI-design/Desktop - HOME - DEFAULT.pdf` / `Desktop - HOME-MENU-STICKY.pdf`) + confirmar contrato real de `hero.content`**

> `npm run build` ya corre en verde (0 errores/warnings de TS, 10 páginas). `src/components/blocks/Hero.astro` se reescribió como carousel real (slider, fade, wave, CTA) consumiendo `getSlider()`, pero se construyó contra una captura suelta compartida en el chat, no contra el PDF pixel-perfect que resultó existir en `docs/UX-UI-design/` — hay que revisarlo contra ese PDF (colores/tipografía reales, no estimados) y correr `npm run dev` para confirmar visualmente. Además: el humano reportó que el navegador seguía mostrando el stub viejo — a confirmar si era caché de Vite/HMR o si persiste tras hard refresh + restart.
>
> **Gap real más importante, del lado de genesis (no del front):** según `genesis/docs/context/CURRENT_STATE.md` (ADR-017), el contenido de CICA360 está sembrado (5 páginas, menú, slider home de 3 slides con CTAs a páginas reales) pero **sin media real** — todos los `*_id` de imagen quedan `null`. El Hero Slider ya soporta esto sin romperse (cae a un fondo `bg-brand-navy` liso), pero visualmente nunca va a coincidir con el mockup (que tiene fotos de fondo) hasta que haya media real en genesis. Ver sección de gaps más abajo.

### Paleta de marca real — Design System oficial (Figma, "CICA360.pdf") — implementada en `global.css`

**Superado:** la escala generada/interpolada a partir del Manual de Marca (sesión 24/08) ya no aplica — el Design System oficial trae los 11 pasos (50-950) exactos de cada familia, sin necesidad de generar nada. `src/styles/global.css` define 4 escalas completas en OKLCH (conversión exacta de cada HEX oficial, sin pérdida): `cicaindigo` (#2D2C4D), `cicagreen` (#206576 — **renombrada de `cicateal`**, nombre real de la familia en el documento), `cicagold` (#EFB814), `cicagray` (#6D6D6D). Convención de nombres (`cicaindigo-500`, sin la notación de Figma `cica/indigo/500`) confirmada como propia del proyecto — se mantiene. Alias `--color-brand-*` ya no existen (sacados en la sesión del 24/08) — todo el código usa las clases reales directo.

**Tipografía — resuelto por el Tech Lead:** Baskerville Old Face (manual de marca) es únicamente para el logo/isotipo, no para la UI del sitio. La tipografía real del sitio es **Lato** (Google Font), normal e itálica — pesos Light 300/Regular 400/Bold 700/Black 900 (el Design System menciona "Medium" de pasada en la descripción, pero el Tech Lead confirmó que no aparece en el listado real de estilos y no se carga). El título del Hero usa Lato **Black Italic (900 italic)**, ~64px en desktop.

**Decisiones finales del Tech Lead sobre el Hero (aplicadas):** radio del botón CTA se mantiene `rounded-full` (pisa el 12px que indica el documento, decisión explícita "es mejor"); una única sombra en el CTA (no las dos del spec); familias renombradas confirmadas: `cicagold`, `cicagreen`, `cicagray`.

**Resuelto por el Tech Lead:** se instala una librería real de íconos — **Phosphor Icons**, peso `regular`/`light` (lineal/outline, "elegante y lineal, no sólido"), vía `astro-icon` + `@iconify-json/ph` (SVG inline en build time, cero JS de cliente, no suma React). Un solo sistema de íconos para todo el proyecto en vez de mezclar Phosphor + Heroicons Micro/Mini como sugería el Design System — Phosphor solo ya cubre linear + fill (`ph:nombre` / `ph:nombre-fill`) en el mismo paquete, así que no hace falta una segunda librería salvo que algún componente futuro necesite específicamente los tamaños micro de Heroicons (a evaluar si surge el caso). Agregado a `package.json`/`astro.config.mjs`, aplicado en `Hero.astro` (`ph:arrow-right` en el CTA, `ph:caret-left`/`ph:caret-right` en las flechas). **Importante:** son dependencias nuevas — hace falta correr `npm install` localmente antes del próximo `npm run dev`/`build` (este sandbox no tiene acceso a la registry de npm para instalarlas y probarlas de antemano, misma limitación de siempre).

### Convención de layout de todo el sitio (fijada 2026-08-27, ver navbar)

Cada sección/bloque de la home (y de las páginas interiores) es **fullwidth** (el fondo/efecto ocupa el 100% del viewport) pero su **contenido va centrado a `max-w-[1200px]`** (`mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8`). El navbar sticky es el primer componente que fija este patrón (fondo blanco fullwidth + fila de contenido a 1200px). Reusar esta clase en cada bloque nuevo — no inventar otro ancho de contenido (`max-w-6xl`/`max-w-7xl`/etc.) salvo que el Tech Lead lo pida explícitamente para un caso puntual.

### Método de trabajo — maquetación pixel-perfect por sección

El estándar pixel-perfect (`docs/UX-UI-design/`) aplica a todo el sitio, pero se implementa **sección por sección** (bloque por bloque de la home, luego página por página), no todo de una vez — así se controla el avance y cada sección se puede validar por separado antes de pasar a la siguiente. Orden acordado: **1) Hero** (en curso) → 2) siguiente sección de la home a definir tras cerrar el Hero.

---

## Objetivo del proyecto

Sitio público de CICA360 (consultora de seguros y temas jurídicos, Cliente 0 de Stamless), que:

1. Consume el API REST headless de Stamless (ver manual en `docs/context/api/stamless-api-v1.md`).
2. Renderiza Home + 4 páginas interiores (`sobre-cica`, `servicios`, `casos-de-exito`, `contacto`) + blog (`posts`) desde contenido publicado.
3. Genera salida 100% estática (`astro build` → `dist/`), desplegable por FTP/SFTP a un shared hosting **sin Node ni npm**.
4. Envía el mínimo JavaScript posible: solo los bloques que de verdad necesitan interactividad lo cargan.
5. El token del API nunca queda expuesto en el bundle del cliente (lectura resuelta en build time; formulario vía proxy server-side).

---

## Criterios de aceptación (Definición de Hecho del MVP del front)

- [ ] Home + 4 páginas interiores renderizan desde el API (contenido real de CICA360, no mock)
- [ ] Menú dinámico (`GET /menus/menu-principal`) en Header/Footer
- [ ] Formulario de contacto envía (`POST /forms/contacto/submit`) y muestra éxito/error
- [ ] `astro build` genera `dist/` estático sin errores
- [ ] Sin token del API visible en el JS que llega al cliente (o, si el hosting no permite el proxy PHP, documentado explícitamente como excepción aceptada con token acotado a `forms:submit`)
- [ ] Bloques presentacionales (`rich_text`, `features`, `cta`, `logos`, `split`, `services_grid`) no cargan JS de framework
- [ ] Pipeline de build/deploy funcionando (manual al menos; automático es post-MVP)

### Fuera de alcance de esta fase (explícito)

- SSR / Node corriendo en el servidor de producción
- GraphQL
- Selector de idioma (el backend fija `lang_iso = es`)
- Rebuild automático on-publish desde Filament (Fase 6, post-MVP)
- Cualquier feature de Console/Manager de Stamless (esto es solo el front público)

---

## División de roles (obligatoria — ver también `AGENTS.md`/`CLAUDE.md`/`GEMINI.md`)

### Claude — capa de datos e infraestructura

- `src/lib/api.ts` (fetch, tipos, manejo de errores por `errors.code`)
- `src/env.d.ts`, `.env.example`
- `src/pages/*` y `getStaticPaths` desde el API
- Proxy/endpoint server-side para el formulario si hace falta ocultar el Bearer
- Pipeline de build/deploy (GitHub Actions, subida a shared hosting)
- **NO** reescribir estilos visuales de los componentes de bloque

### Antigravity (Gemini) — capa visual

- `src/layouts/*`
- `src/components/blocks/*` (hero, rich_text, features, split, testimonials, logos, cta, services_grid, contact_form, ...)
- Header/Footer con datos de menú
- Fidelidad **pixel-perfect** a `docs/UX-UI-design/` (fuente de verdad real, no capturas sueltas de chat): PDFs `Desktop - *.pdf` = desktop-first, `wireframes/Mobile - *.png` = mobile-first
- **NO** cambiar `api.ts`, tipos, ni contratos de fetch

---

## Contrato de bloques (referencia rápida — detalle completo en el manual del API)

Cada elemento de `data.blocks[]`:

```json
{ "uuid": "...", "type": "hero", "pretitle": null, "title": "...", "subtitle": null, "content": {}, "links": [], "properties": {}, "sort_order": 0 }
```

- Un componente por `type`. Tipos desconocidos se ignoran sin romper la página (no asumir que la lista de tipos es fija/cerrada).
- `hero` modo `slider`: cargar el slider por `content.slider_slug`, o directo por `GET /sliders/home`.
- `links[]`: usar `href`/`label`/`type`/`target` ya resueltos por el API — nunca reconstruir rutas a mano.

---

## Desglose de subtareas

### Fase 0 — Scaffold

| # | Subtarea | Owner | Estado |
|---|----------|-------|--------|
| 1 | `package.json` + Astro ^7.2 + TypeScript strict + Tailwind v4 | Claude | Done — escrito a mano (sin `npm create`, sandbox sin red); **falta `npm install` real** |
| 2 | Estructura de carpetas (`src/lib`, `src/layouts`, `src/components/blocks`, `src/pages`) | Claude | Done |
| 3 | `.env.example` (`STAMLESS_API_URL`, `STAMLESS_API_TOKEN`) + `src/env.d.ts` | Claude | Done |
| 4 | `README.md` con setup real | Claude | Done |

### Fase 1 — Capa de datos (Claude)

| # | Subtarea | Estado |
|---|----------|--------|
| 5 | `src/lib/api.ts`: cliente fetch tipado contra el envelope (`success/status_code/message/data/meta/links/errors`), con timeout + reintentos acotados para errores transitorios | Done |
| 6 | Tipos TS de `Page`, `Post`, `Menu`, `Slider`, `Block`, `Link`, `Media` (`src/lib/types.ts`) | Done |
| 7 | Manejo de errores por `errors.code` (`src/lib/errors.ts`, clase `ApiError`) | Done |
| 8 | `getStaticPaths` de páginas desde `GET /pages` (`src/pages/[slug].astro`, excluye la home) | Done |
| 9 | Rutas: `/` (home por `is_home`), `/{slug}` (interiores), `/blog`, `/blog/{slug}`, `/404` | Done |

### Fase 2 — Layout y bloques (Antigravity)

| # | Subtarea | Estado |
|---|----------|--------|
| 10 | Layout base + Header/Footer con menú dinámico | Done (stub funcional, Claude) — **falta el diseño visual real, es la próxima tarea de Antigravity** |
| 11 | Componente `hero` (modo slider y manual) | Done (stub funcional, Claude) — pendiente diseño |
| 12 | Componentes `rich_text`, `features`, `split`, `cta`, `logos`, `services_grid`, `testimonials`, `faq`, `image`, `heading`, `legal_notice` (sin JS — `.astro` puro) | Done (stubs funcionales, Claude) — pendiente diseño |
| 13 | Componente `contact_form` (UI) | Done (stub funcional, Claude) — pendiente diseño; la lógica de submit (`ContactForm.tsx`) ya está conectada, ver Fase 3 |

### Fase 3 — Formulario de contacto (Claude)

| # | Subtarea | Estado |
|---|----------|--------|
| 14 | Confirmar con el cliente/hosting si hay PHP disponible | **Pending — sigue siendo el bloqueador real**, el código ya soporta ambos caminos (proxy PHP implementado por defecto; fallback de token acotado ya cableado en `api.ts`/`.env.example`, solo falta activarlo si hace falta) |
| 15 | Implementar proxy PHP (`contacto.php`) o token acotado según #14 | Done — `public/contacto.php` (compatible PHP 7.4+, rate limit best-effort, honeypot server-side, forward por cURL) + `public/contacto.config.example.php` |
| 16 | Conectar submit del `contact_form` al proxy/endpoint elegido | Done — `src/components/islands/ContactForm.tsx` + `submitContactForm()` en `api.ts` |
| 17 | Honeypot cliente (campo oculto) como capa extra | Done — en `ContactForm.tsx` y reforzado server-side en `contacto.php` |

### Fase 4 — Build/deploy (Claude)

| # | Subtarea | Estado |
|---|----------|--------|
| 18 | GitHub Actions: `astro build` en CI | Done — `.github/workflows/build-and-deploy.yml` (incluye `astro check`) |
| 19 | Deploy del `dist/` al shared hosting (FTP/SFTP) | Pending — paso ya escrito en el workflow pero **comentado**, falta confirmar credenciales reales del hosting |
| 20 | Cloudflare delante del dominio (CDN, WAF, SSL) | Pending — depende de tener el dominio/hosting final confirmado |

### Fase 5 — QA de performance

| # | Subtarea | Estado |
|---|----------|--------|
| 21 | Lighthouse/PageSpeed pass | Pending — necesita un build real corriendo primero |
| 22 | Auditoría manual del JS real enviado por página (confirmar que bloques no-interactivos no cargan JS) | Pending |
| 23 | Accesibilidad básica (contraste, alt, foco, encabezados) | Pending — parcialmente cubierto en los stubs (labels, `aria-label`, `role="status"`/`role="alert"` en el form) pero no auditado formalmente |

### Fase 6 — Post-MVP (opcional, no bloquea el MVP)

| # | Subtarea | Estado |
|---|----------|--------|
| 24 | Rebuild automático on-publish desde Filament (`repository_dispatch`) | Pending — requiere tocar el backend, coordinar con el repo de Stamless |

---

## Definition of Done (sesión de trabajo)

Una subtarea solo se marca **Done** si:

1. El código/docs necesarios están en el repo.
2. Se puede verificar localmente (`astro build`/`astro dev` corre sin errores, o el test/lint correspondiente).
3. `CURRENT_STATE.md` y este `TASK.md` reflejan el cambio.
4. Se añadió una línea en `PROGRESS.md`.
5. Se listaron los archivos tocados y lo pendiente para el otro agente (Claude ↔ Antigravity).

---

## Handoff

Al soltar la tarea:

```
Owner actual: (libre)
Última subtarea completada (2026-08-31): `Logos.astro` — implementación completa, antes stub vacío. Grilla estática de hasta 7 logos (`grid-cols-3 sm:grid-cols-4 md:grid-cols-5 2lg:grid-cols-7`); con más, carousel paginado de a 7 (cada página = una grilla completa de hasta 7 logos, distinto del patrón por-item de `Testimonials.astro`) con flechas/dots/drag por Pointer Events, mismo estilo ya establecido en el resto del sitio. Filtro grayscale/opacidad por logo (reusa `properties.media_filter_grayscale`/`media_opacity`, ya genéricas de `split` — nada nuevo del lado de properties) que se quita al `:hover`/`:focus-visible` revelando el logo a color real. Del lado de `genesis`: 7 logos reales sembrados (`Cliente0MediaSeeder`) reemplazando los 5 placeholders con `media_id: null`; `Cliente0ContentSeeder` con `subtitle` + properties nuevas en el bloque; `PageResource.php` con Section "Personalización de estilos" (2 col) + `Repeater->maxItems(28)`. Sin cambios de tipos/routing — `Media` ya existía en `types.ts`, `BlockRenderer.astro` ya ruteaba `logos`.
Siguiente subtarea recomendada: (1) El Tech Lead debe correr `php artisan db:seed` (o `--class=Cliente0MediaSeeder --class=Cliente0ContentSeeder`) en `genesis` para que los 7 logos reales reemplacen a los placeholders, y confirmar visualmente: filtro por default, hover a color real, y si sube de 7 items que el carousel pagine con flechas/dots/drag. (2) Retomar los pendientes de la sesión del 2026-08-30 sobre Header.astro/Hero.astro, listados en `PROGRESS.md` (revert sin confirmar de `linkItems`, umbrales 150/200px del navbar, validación de los 3 slides del Hero contra media real, botón "play video" sin implementar). (3) Este sandbox NO puede correr `npm run build`/`astro check` reales (bindings nativos `darwin-arm64` de `rolldown`/Vite no corren en este contenedor Linux) — sigue pendiente una corrida real del build en local o CI tras los cambios acumulados de varias sesiones.
Notas de subtarea anterior (2026-08-31): `Testimonials.astro` — corrección "expectativa vs realidad" contra 2 capturas del Tech Lead. Avatares agrandados, tarjeta con fondo propio (`properties.item_background_color`/`item_background_opacity`), cita sin comillas, firma corta condicional, carousel responsive con drag/touch + dots estilo `Hero.astro`.
Notas: La escala de color generada en la sesión del 24/08 (a partir del manual de marca) queda superada por los valores exactos del Design System de Figma — no reabrir esa vía. Los colores `cicagreen-*` usados en `Testimonials.astro` (2026-08-31) SÍ vienen de ese Design System real (`src/styles/global.css`, `--color-cicagreen-*`), no inventados.
```
