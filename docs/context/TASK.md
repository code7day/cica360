# CICA360 (front) — Tarea actual

> **📖 Ver `docs/context/HOME_INTEGRATION.md` antes de tocar cualquier bloque del Home** (Hero/RichText/Split/Testimonials/Logos/Cta/Colophon/FooterBottom) — resumen curado de la arquitectura, los patrones establecidos (carousel dinámico con `itemsPerView` + wraparound por clones, `content_width`, `background_type`) y el historial de bugs ya resueltos, para no repetirlos. El Home quedó confirmado por el Tech Lead 2026-09-02 como fiel al diseño de Figma ("quedó todo el HOME integrado tal cual el diseño de figma como espectativa").
>
> Última actualización: 2026-09-18 (**2da vuelta: `Features.astro` — `align-items: flex-start` reemplazado por `align-items: safe center`** — el Tech Lead reportó que, tras el fix de padding-top de la vuelta anterior, "el padding bottom creo que también faltó" — efecto secundario directo de forzar `flex-start` por ancho fijo (`<=375px`): TODO el sobrante del overflow pasó a recortarse contra el borde inferior en vez de repartirse. Fix: `align-items: safe center` (valor estándar CSS, no hack) — se comporta como `center` mientras el contenido entra en el viewport (preserva el caso común sin cambios), y SOLO degrada a `start` cuando centrar causaría overflow real (detectado en tiempo de layout, no por un umbral de ancho adivinado) — protege el padding-top sin forzar el efecto en celulares angostos-pero-altos que no lo necesitan. Soporta desde Safari 16.4; en navegadores viejos la declaración se ignora sin regresión. Se descartó también el pedido más amplio de "padding-x mínimo 20px en todos los bloques" — confirmado con el Tech Lead que 16px en la base es una decisión deliberada del 2026-09-09 (estándar proporcional compartido con RichText/Split/~15 bloques más), se deja sin cambios. Ver PROGRESS.md/CURRENT_STATE.md. **Pendiente: confirmación visual en 2 casos (celular angosto y corto vs. angosto y alto). Commit pendiente.** Owner: libre.)
> Antes, mismo día (**Fix: `Features.astro` pegado al borde superior en celulares <=375px durante el pin/carousel mobile** — captura del Tech Lead: "el padding-top de la seccion de features deberia tener por lo menos 20px minimo para que no se pegue mucho al borde". El `padding-top` nominal (48px) ya excedía el pedido — la causa real es el mecanismo de pin (`align-items:center` + `overflow:hidden` durante `.js-pin-active`, mismo "no hay espacio arriba" ya documentado en el historial del archivo, 2026-09-09): en celulares angostos el texto envuelve a más líneas, el contenido centrado supera más seguido los 100vh/dvh disponibles y el recorte simétrico se come el padding-top entero. Fix: `align-items: flex-start` (la misma técnica ya probada y revertida en su momento para TODO el rango <768px, esta vez acotada con `@media (max-width: 375px)`, condición de ancho — un subconjunto mucho más chico que no afecta el balance ya confirmado en 376-767px). Balance de llaves/paréntesis verificado (113/113, 502/502) — sin runtime de Node funcional en este sandbox (`astro check` roto por un binding nativo de `rolldown`, problema de entorno preexistente). Ver PROGRESS.md/CURRENT_STATE.md. **Pendiente: confirmación visual del Tech Lead en un celular real <=375px, y confirmar que 376px+ no tuvo regresión. Commit pendiente.** Owner: libre.)
> Antes, mismo día (**Fix real: colisión de tipos `FormData` propio vs global del navegador rompía el build de CI — nada se desplegaba desde Fase 2 de formularios** — el Tech Lead: "no despliega automaticamente el trigger creo que algo se movió" (con captura del workflow en rojo). El trigger SÍ disparaba; `astro check` fallaba porque `src/lib/api.ts` usaba `FormData` sin importarlo de `./types`, resolviendo al tipo global del navegador en vez de la interfaz propia del formulario del API. Fix: agregado `FormData` al import de tipos en `api.ts`. `tsc --noEmit` limpio (exit 0). Ver PROGRESS.md/CURRENT_STATE.md. **Pendiente: commit + push, confirmar en GitHub Actions que el workflow completo (build + deploy FTP) corre en verde.** Owner: libre.)
> Antes, mismo día (**Formularios Fase 2: `ContactForm.tsx` dinámico por `FormFieldTypeEnum` (ver ADR-007)** — reporte en vivo del Tech Lead: desactivar campos del form "Contacto" en Studio no tenía ningún efecto en el sitio público. `ContactFormBlock.astro` ahora resuelve `content.form_slug` con `getForm()` y pasa el `Form` real a `<ContactForm />`; `ContactForm.tsx` se reescribió por completo — de 7 campos hardcodeados a render dinámico de `form.fields` por `FormFieldTypeEnum`, validación de formato desde `FormFieldData.validation_rules`. Prerrequisito del lado genesis: `content.form_id` → `content.form_slug`. `npx tsc --noEmit --ignoreDeprecations 6.0` limpio (exit 0). Ver ADR-007/PROGRESS.md/CURRENT_STATE.md. **Pendiente: confirmación visual del Tech Lead en `npm run dev`/build real (WhatsApp con selector propio, preselección por IP) y prueba end-to-end — desactivar un campo en Studio y confirmar que desaparece del sitio publicado tras el próximo rebuild/deploy.** Owner: libre.)
> Antes, mismo día (**Proxies PHP resueltos contra `PUBLIC_SITE_URL` en dev local con MAMP + CORS mínimo, ver ADR-002 — 2 actualizaciones** — sin entrada previa en este archivo, ver PROGRESS.md/CURRENT_STATE.md del mismo día para el detalle completo. Owner: libre.)
> Antes, 2026-09-17 (**Fase 6 (post-MVP) adelantada: deploy automático por webhook (ver ADR-006)** — el workflow gana trigger `repository_dispatch` + deploy FTP automático (antes manual, ver ADR-006/ARCHITECTURE.md §6). Genesis dispara el rebuild al guardar contenido (ADR-072 en ese repo). **3 pendientes operativos antes de que funcione en producción: (1) secrets `FTP_SERVER`/`FTP_USERNAME`/`FTP_PASSWORD` en este repo (GitHub Settings → Secrets), (2) `deploy_repo`/`deploy_token` del tenant CICA360 seteados en genesis, (3) worker de colas corriendo en producción de genesis.** Owner: libre.)
> Antes, mismo día (**Animación de entrada sitewide: motor `data-reveal` (reemplaza `properties.animation`, ver ADR-005)** — pedido del Tech Lead pivotó de "usar el selector de animación de Filament" a "quitarlo de Filament, animación estática por frontend, aplicada en todos los componentes de todas las páginas del sitio". Motor `[data-reveal]`/`IntersectionObserver` construido y cableado en los 18 componentes de `blocks/`, en `servicios/[slug].astro` (sin tocar header/wave/banderas) y en `blog/*`. Ver CURRENT_STATE.md/PROGRESS.md/DECISIONS.md (ADR-005) para el detalle completo. **Constraint activo: no se hizo git commit/push ni deploy — solo para probar en local.** Pendiente: validación visual del Tech Lead con `astro dev`. Owner: libre.)
> Antes, 2026-09-14 (**Detalle de `Service` (`[slug].astro`): rediseño de header/tabs + `why_choose_us` a RichEditor + fix de ancho a 1200px (3 pasadas)** — ver CURRENT_STATE.md/PROGRESS.md para el detalle completo. Pendiente: confirmación visual real del Tech Lead contra el mockup (1440px/1900px) — este agente no puede correr un preview real ni `astro build` en su sandbox. Owner: libre.)
> Antes, 2026-09-11 (**`ContactForm.tsx` rediseñado completo contra el mockup real de "Contactame"** — 7 campos, layout 2 columnas, selects de País/Área de interés, botón pill dorado. Coordinado con genesis (`FormFieldDefinitionSeeder`/`Cliente0ContentSeeder::upsertContactForm()`). Ver PROGRESS.md/CURRENT_STATE.md. Pendiente `db:seed` en genesis + confirmación visual. Owner: libre.)
> Antes, 2026-09-05 (**`Heading.astro` reescrito: stub → real** — banner "Sobre CICA", ver PROGRESS.md/CURRENT_STATE.md. Cruza con fix en genesis del mismatch `'waves'`/`'wave'` en el bloque `heading`.)
> Antes, 2026-09-02 (**Finalizada la integración con la página HOME y todos sus bloques**) — `npm run check` verificado en verde sobre 34 archivos (0 errores, 0 warnings, 0 hints).
> Owner actual: _(libre)_
> Estado: **Integración con HOME completada.** `Heading.astro` de la interna "Sobre CICA" ya real; pendiente confirmación visual una vez corra el seeder de genesis.


---

## Tarea activa

**Ajustar Hero Slider contra el diseño fuente de verdad (`docs/UX-UI-design/Desktop - HOME - DEFAULT.pdf` / `Desktop - HOME-MENU-STICKY.pdf`) + confirmar contrato real de `hero.content`**

> `npm run build` ya corre en verde (0 errores/warnings de TS, 10 páginas). `src/components/blocks/Hero.astro` se reescribió como carousel real (slider, fade, wave, CTA) consumiendo `getSlider()`, pero se construyó contra una captura suelta compartida en el chat, no contra el PDF pixel-perfect que resultó existir en `docs/UX-UI-design/` — hay que revisarlo contra ese PDF (colores/tipografía reales, no estimados) y correr `npm run dev` para confirmar visualmente. Además: el humano reportó que el navegador seguía mostrando el stub viejo — a confirmar si era caché de Vite/HMR o si persiste tras hard refresh + restart.
>
> **Gap real más importante, del lado de genesis (no del front):** según `genesis/docs/context/CURRENT_STATE.md` (ADR-017), el contenido de CICA360 está sembrado (5 páginas, menú, slider home de 3 slides con CTAs a páginas reales) pero **sin media real** — todos los `*_id` de imagen quedan `null`. El Hero Slider ya soporta esto sin romperse (cae a un fondo `bg-brand-navy` liso), pero visualmente nunca va a coincidir con el mockup (que tiene fotos de fondo) hasta que haya media real en genesis. Ver sección de gaps más abajo.
>
> **Gap pendiente, detectado 2026-09-02 (explícitamente pospuesto por el Tech Lead — "dejarlo para después"):** `Header.astro` solo renderiza **1 nivel de submenú** (documentado inline en el propio archivo, línea ~181: "los hijos de los hijos, si el backend algún día los manda, no se renderizan") — escrito cuando el contrato de `Menu`/`MenuItem` todavía no soportaba más de 1 nivel. Desde el `MenuTreeBuilder` de `genesis` (ADR-045, mismo día), Console permite armar menús de **3 niveles** (menú → submenú → sub-submenú) — un menú con esa profundidad real, guardado desde Studio, va a mostrar el 2do nivel pero **cortar el 3ro en silencio** en el sitio público (desktop y mobile, `linkItems.map(...)` solo mapea `item.children`, no `item.children[].children`). La documentación del API (`docs/context/api/stamless-api-v1.md`, sección `GET /menus/{slug}`) ya se actualizó para reflejar que el contrato SÍ soporta profundidad arbitraria — el gap es puramente de `Header.astro`, no del backend ni del contrato. Pendiente: extender el desktop dropdown y el mobile accordion a un 3er nivel (mismo patrón visual ya establecido, solo agregar un nivel más de anidamiento), cuando el Tech Lead lo priorice.

### Paleta de marca real — Design System oficial (Figma, "CICA360.pdf") — implementada en `global.css`

**Superado:** la escala generada/interpolada a partir del Manual de Marca (sesión 24/08) ya no aplica — el Design System oficial trae los 11 pasos (50-950) exactos de cada familia, sin necesidad de generar nada. `src/styles/global.css` define 4 escalas completas en OKLCH (conversión exacta de cada HEX oficial, sin pérdida): `cicaindigo` (#2D2C4D), `cicagreen` (#206576 — **renombrada de `cicateal`**, nombre real de la familia en el documento), `cicagold` (#EFB814), `cicagray` (#6D6D6D). Convención de nombres (`cicaindigo-500`, sin la notación de Figma `cica/indigo/500`) confirmada como propia del proyecto — se mantiene. Alias `--color-brand-*` ya no existen (sacados en la sesión del 24/08) — todo el código usa las clases reales directo.

**Tipografía — resuelto por el Tech Lead:** Baskerville Old Face (manual de marca) es únicamente para el logo/isotipo, no para la UI del sitio. La tipografía real del sitio es **Lato** (Google Font), normal e itálica — pesos Light 300/Regular 400/Bold 700/Black 900 (el Design System menciona "Medium" de pasada en la descripción, pero el Tech Lead confirmó que no aparece en el listado real de estilos y no se carga). El título del Hero usa Lato **Black Italic (900 italic)**, ~64px en desktop.

**Decisiones finales del Tech Lead sobre el Hero (aplicadas):** una única sombra en el CTA (no las dos del spec); familias renombradas confirmadas: `cicagold`, `cicagreen`, `cicagray`. Radio del botón CTA: **superado (2026-09-01)** — ya no es `rounded-full`. El Tech Lead revirtió la decisión original ("pisa el 12px, es mejor") para alinear el radio del CTA del Hero con el mismo estándar moderado `rounded-lg` que ya usan `cta` y `rich_text` (ver PROGRESS.md, ambos repos).

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
Última subtarea completada (2026-09-14): **Detalle de `Service` (`[slug].astro`) — rediseño de header/tabs, `why_choose_us.text` a HTML (RichEditor), fix de ancho a 1200px.** Pedido del Tech Lead con capturas reales de "Seguros Financiero" en CICA360, en varias vueltas seguidas:
  1. Header full-bleed ~50vh (configurable Normal/Destacado ×1.25 vía `properties.header_type`/`show_decorative_detail` de genesis), degradado al 50% de SU altura, wave, banderas de país flotando sobre el wave, párrafo intro estilo `RichText.astro` (flecha `ph:caret-down`), tabs "¿Qué ofrecemos?"/"Coberturas" sobrepuestas `-mt-10`. Reusa piezas ya establecidas en el sitio (wave/banderas/flecha), nada inventado de cero.
  2. `content.why_choose_us.text` pasa de texto plano a HTML (Console: `Textarea`→`RichEditor`) — el front usa `set:html` en vez de `{}`. `tip.text` NO cambió, sigue plano.
  3. Fix de ancho, 3 pasadas sobre el mismo pedido ("el ancho del cuerpo del contenido no debe de pasar del 1200px"): (a) las 3 secciones bajo el header a `max-w-[1200px]` con `mx-auto`, texto interno que necesita quedar angosto conserva `max-w-3xl` propio, tabs con `justify-center`; (b) el bloque de texto del HEADER (pretitle/título/subtítulo), que se había quedado en `max-w-3xl`, corregido igual; (c) las banderas flotantes, que quedaban pegadas al borde de la PANTALLA en viewports anchos (~1900px), ahora envueltas en el mismo `mx-auto max-w-[1200px] px-4 md:px-10` del bloque de texto con `justify-end`, alineadas al borde del cuerpo.
  Archivos: `src/pages/servicios/[slug].astro` (todo el trabajo), `src/lib/types.ts` (`ServiceProperties` nuevo). Cross-repo (genesis): `PropertiesSchema.php`/`ServiceResource.php` (`header_type`/`show_decorative_detail`), `ResolvesPublicLinks::renderRichContent()` (`private`→`protected`), `ServiceController::show()` (renderiza `why_choose_us.text` a HTML) — ver PROGRESS.md de genesis. También en esta sesión: fix real de un bug de pérdida de datos en `Cliente0ServicesSeeder.php` de genesis (`updateOrCreate`→`firstOrCreate`, sobreescribía contenido real de Studio en cada re-seed) — YA RESUELTO y confirmado por el Tech Lead con screenshot en vivo, sin acción pendiente de este lado.
Siguiente subtarea recomendada: el Tech Lead debe correr `npm run build`/`npm run dev` en un entorno real (este sandbox no puede — `Error: Cannot find native binding`, `rolldown` roto) y confirmar visualmente el resultado contra el mockup de referencia (1440px/1900px), sobre todo: la escala de altura del header (`HEADER_HEIGHT_BASE`/`_MD`/`_LG`, criterio propio razonado sin precedente previo en el sitio, no una spec pixel-perfect), y que las banderas/tabs/texto queden alineados al mismo borde de 1200px en distintos anchos de pantalla. La auditoría completa de la documentación del API (`docs/context/api/stamless-api-v1.md` y el equivalente en genesis) sigue POSPUESTA explícitamente por el Tech Lead ("mejor dejamos para despues") — no retomar sin que lo pida.
Notas de subtarea anterior (2026-09-02): **`Colophon.astro`/`FooterBottom.astro` — 2 bloques nuevos exclusivos de Content tipo `Footer` (lado `genesis`) + `src/lib/background.ts` genérico**. Ver `genesis/docs/context/PROGRESS.md` (mismo día, ADR-040) para el pedido verbatim completo. `colophon`: pie de página multi-columna (hasta 4, sin heading propio) — por columna, título + descripción + un dispatcher inline que renderiza cada sub-bloque de `column.blocks[]` (`link_list`: lista de enlaces; `social_links`: fila de íconos de marca vía Phosphor `ph:{platform}-logo-fill`, ya cubre las 7 plataformas sin sumar un set de íconos nuevo; `image_link`: imagen opcionalmente envuelta en link) — grilla responsive según cuántas columnas reales haya. `footer_bottom`: 2 campos de texto opcionales, centrado con 1 cargado / a los costados con los 2 / nada si ninguno. `src/lib/background.ts` nuevo: `resolveBackgroundStyle()`, genérico (no vive dentro de `Colophon.astro`) — resuelve fondo sólido o degradado desde los mismos 4 campos que `PropertiesSchema` (genesis) agrega a cualquier bloque que los pida, para que un bloque futuro lo reuse sin tocar este archivo. `BlockRenderer.astro`/`types.ts` actualizados (`colophon`/`footer_bottom` en `BlockType` + interfaces nuevas).
Siguiente subtarea recomendada: el Tech Lead debe correr `npm run dev`/`build` real (`npx astro check` no se pudo correr en este sandbox — `Error: Cannot find native binding`, binario de `rolldown` roto en el entorno) y confirmar visualmente: columnas del `colophon` con sus 3 tipos de sub-bloque, degradado de fondo si algún bloque lo tiene configurado, y el layout centrado/costados de `footer_bottom` según cuántos de sus 2 campos vengan cargados. Del lado de `genesis`, correr `php artisan db:seed --class=Cliente0ContentSeeder` (siembra ambos bloques en `footer-principal`, colores sólidos).
Notas de subtarea anterior (2026-09-01): **Bloque `footer` genérico — reemplaza el fetch global de `BaseLayout.astro`**. Pedido del Tech Lead: "en el tipo página o landing... necesitamos un bloque footer que permita seleccionar un contenido de su mismo tenant que sea de tipo footer, para relacionarlo como un grupo de secciones comunes en varias páginas que tengan a ese footer"; confirmado por `AskUserQuestion` que esto reemplaza (no coexiste con) el fetch fijo a `footer-principal` que se había cableado un rato antes en la misma sesión. `BaseLayout.astro` vuelve a llamar solo `getMenu()` (se sacó `getPage('footer-principal')`); `Footer.astro` vuelve a ser solo nav+copyright a partir de `menu` (sin prop `blocks`). Nuevo `src/components/blocks/FooterBlock.astro`: sin UI propia, re-despacha `block.content.footer_page.blocks[]` (ya resuelto por el backend con la MISMA forma que cualquier bloque normal) al `BlockRenderer` genérico — nueva entrada `footer: FooterBlock` en `componentsByType`. `types.ts` gana `'footer'` en la unión `BlockType` (documental). El CTA compartido sigue apareciendo en el sitio porque `genesis` ahora agrega ese bloque al final de cada página pública sembrada (`appendFooterBlock()`, ver `genesis` PROGRESS.md, mismo día).
Siguiente subtarea recomendada: el Tech Lead debe correr `npm run dev`/`build` real y confirmar que el CTA sigue apareciendo al final de cada página pública (ahora como un bloque más de `page.blocks`, no desde `<Footer>`), tras correr el seeder actualizado de `genesis` (`php artisan db:seed --class=Cliente0ContentSeeder`).
Notas de subtarea anterior (2026-09-01): `Cta.astro` — implementación real completa (antes un stub sin terminar: fondo gris fijo, sin properties reales). Pedido del Tech Lead con captura de referencia. Estándar nuevo confirmado (reusable en bloques de sección completa futuros): la `<section>` SIEMPRE es fullwidth, `properties.content_width` (`full`/`boxed`/`narrow`) solo condiciona el contenedor interno — mismo criterio ya usado en `split`/`rich_text`/`logos`. Fondo en 4 capas apiladas: `background_color` (base) → `content.background_image` opcional (capa intermedia superpuesta, con blend mode + 6 filtros CSS + opacidad vía `properties.media_*`, mismo patrón que `mediaEffectStyle()` de `Split.astro`) → velo negro opcional (`properties.overlay_opacity`, primera vez con un consumidor real en el sitio) → contenido. Un solo botón opcional (`show_link`/`links[0]`, mismo gate que `rich_text`/`testimonials`), default local `link_radius: full`/`link_size: lg` (pill grande, distinto al default `lg`/`lg` de `rich_text`), ícono `ph:paper-plane-tilt` (reusado de `Header.astro`). Del lado de `genesis` (implementación conjunta): bloque `cta` rediseñado en `PageResource.php` (un solo botón, fondo en capas, `content_width`) + `ResolvesPublicLinks::BLOCK_MEDIA_FIELDS['cta']` nuevo + `Cliente0ContentSeeder` preseteado con los valores reales de la captura. Ver `genesis` PROGRESS.md para el detalle del lado admin.
Siguiente subtarea recomendada: el Tech Lead debe correr el seeder actualizado y confirmar que la franja de la home calza con la captura de referencia (color, texto, botón), y probar desde Studio la imagen de fondo con blend mode + `overlay_opacity` + los 2 anchos de contenido.
Notas de subtarea anterior (2026-09-01): `Logos.astro` — carousel reescrito a ítems responsivos por viewport, reemplaza el modelo de páginas fijas de 7. Spec exacta del Tech Lead (con la escala custom real de `global.css`, confirmada 1:1 antes de tocar código): 1 logo visible en mobile, 2 desde `sm`/540px, 3 desde `2md`/810px, 4 desde `3lg`/1200px, 6 desde `2xl`/1440px, 7 desde `5xl`/1700px. Se eliminó la distinción "grilla estática vs. carousel paginado" — ahora es un único track de scroll continuo ítem por ítem (mismo patrón que `Testimonials.astro`: scroll-snap + drag Pointer Events + auto-avance + un punto por logo), con `basis-[calc(...)]` responsivo por breakpoint. Como la cantidad visible cambia con el viewport, si hace falta carousel (overflow) ya no se decide en build time — se detecta en runtime (`scrollWidth` vs. `clientWidth`) y se recalcula en cada resize. Del lado de `genesis` (implementación conjunta, mismo pedido del Tech Lead): `content.limit`/`content.order` nuevos en el bloque `logos` de `PageResource.php` — SIN tabla propia, confirmado explícitamente por el Tech Lead ("no tenemos una tabla para los logos o brands... solo lo quieren filtrar los primeros o ultimos sin eliminar un logo, solo que no se considere en el frontsite"); el filtro se aplica en `ResolvesPublicLinks::transformBlockContent()` sobre el mismo `content.items` del Repeater, sin borrar nada en Studio. Ver `genesis` PROGRESS.md para el detalle del lado admin.
Siguiente subtarea recomendada: el Tech Lead debe probar el carousel de logos en varios anchos reales y confirmar la cantidad visible en cada breakpoint de la spec, que flechas/puntos solo aparecen cuando hace falta scrollear, y (del lado de Studio) que el límite/orden nuevo del bloque `logos` funciona como se espera.
Notas de subtarea anterior (2026-09-01): `Logos.astro` — nueva property `content_width` (fullwidth/boxed), default fullwidth, pedido del Tech Lead del lado de `genesis` ("en el admin... agregar una propiedad de ancho... por default sea fullwidth") — se implementó también el consumidor acá porque la property no tiene efecto sin él, mismo patrón que `content_width` de `split`/`rich_text`. Contenedor antes hardcodeado en `max-w-6xl px-4 sm:px-6 lg:px-8` (boxed fijo); ahora `CONTENT_WIDTH_CLASSES` con `full` (`max-w-none px-6 3md:px-[80px]`, mismo criterio que `RichText.astro`) y `boxed` (el valor previo, sin cambios), default `full` resuelto acá en el frontend, no con `->default()` de Filament. Ver `genesis` PROGRESS.md para el lado admin.
Siguiente subtarea recomendada: el Tech Lead debe confirmar en Studio el selector "Ancho del contenido" del bloque `logos`, y en el sitio que por defecto la franja se ve fullwidth y que "Caja (Boxed)" vuelve al ancho anterior.
Notas de subtarea anterior (2026-09-01): `Logos.astro` — carousel corregido a ventana circular (cada página SIEMPRE completa 7 logos, repitiendo desde el principio si los reales no alcanzan, en vez de dejar un hueco vacío en la última página); favicon completo implementado (`BaseLayout.astro` + `public/favicon/`); `Hero.astro` con padding simétrico de 200px desde `3xl`/1536px y forzado de mobile corregido a solo el eje X. Ver PROGRESS.md para el detalle completo de cada uno.
Notas de subtarea anterior (2026-08-31): `Logos.astro` — implementación completa, antes stub vacío. Grilla estática de hasta 7 logos (`grid-cols-3 sm:grid-cols-4 md:grid-cols-5 2lg:grid-cols-7`); con más, carousel paginado de a 7 (cada página = una grilla completa de hasta 7 logos, distinto del patrón por-item de `Testimonials.astro`) con flechas/dots/drag por Pointer Events, mismo estilo ya establecido en el resto del sitio. Filtro grayscale/opacidad por logo (reusa `properties.media_filter_grayscale`/`media_opacity`, ya genéricas de `split` — nada nuevo del lado de properties) que se quita al `:hover`/`:focus-visible` revelando el logo a color real. Del lado de `genesis`: 7 logos reales sembrados (`Cliente0MediaSeeder`) reemplazando los 5 placeholders con `media_id: null`; `Cliente0ContentSeeder` con `subtitle` + properties nuevas en el bloque; `PageResource.php` con Section "Personalización de estilos" (2 col) + `Repeater->maxItems(28)`. Sin cambios de tipos/routing — `Media` ya existía en `types.ts`, `BlockRenderer.astro` ya ruteaba `logos`.
Siguiente subtarea recomendada: (1) El Tech Lead debe correr `php artisan db:seed` (o `--class=Cliente0MediaSeeder --class=Cliente0ContentSeeder`) en `genesis` para que los 7 logos reales reemplacen a los placeholders, y confirmar visualmente: filtro por default, hover a color real, y si sube de 7 items que el carousel pagine con flechas/dots/drag. (2) Retomar los pendientes de la sesión del 2026-08-30 sobre Header.astro/Hero.astro, listados en `PROGRESS.md` (revert sin confirmar de `linkItems`, umbrales 150/200px del navbar, validación de los 3 slides del Hero contra media real, botón "play video" sin implementar). (3) Este sandbox NO puede correr `npm run build`/`astro check` reales (bindings nativos `darwin-arm64` de `rolldown`/Vite no corren en este contenedor Linux) — sigue pendiente una corrida real del build en local o CI tras los cambios acumulados de varias sesiones.
Notas de subtarea anterior (2026-08-31): `Testimonials.astro` — corrección "expectativa vs realidad" contra 2 capturas del Tech Lead. Avatares agrandados, tarjeta con fondo propio (`properties.item_background_color`/`item_background_opacity`), cita sin comillas, firma corta condicional, carousel responsive con drag/touch + dots estilo `Hero.astro`.
Notas: La escala de color generada en la sesión del 24/08 (a partir del manual de marca) queda superada por los valores exactos del Design System de Figma — no reabrir esa vía. Los colores `cicagreen-*` usados en `Testimonials.astro` (2026-08-31) SÍ vienen de ese Design System real (`src/styles/global.css`, `--color-cicagreen-*`), no inventados.
```
