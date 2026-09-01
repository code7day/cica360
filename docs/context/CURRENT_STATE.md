# CICA360 (front) — Estado actual

> Fuente de verdad del **dónde estamos**. Actualizar al inicio y al final de cada sesión de trabajo significativa.
> Última actualización: 2026-08-31 (`Logos.astro`: implementación completa, antes stub vacío — carousel de marcas/socios paginado de a 7 (grilla estática si hay ≤7), filtro grayscale/opacidad por logo configurable desde Studio que se quita al hover revelando el color real, mismo patrón de flechas/dots/drag por Pointer Events ya establecido por `Hero.astro`/`Testimonials.astro`. Del lado de `genesis`: 7 logos reales sembrados reemplazando placeholders muertos (`media_id: null`), properties reusadas (no nuevas) `media_filter_grayscale`/`media_opacity`, `Repeater` con tope explícito de 28 items — ver `PROGRESS.md`. Antes, mismo día: `Testimonials.astro`: corrección "expectativa vs realidad" contra el mockup real del Tech Lead — avatares más grandes, tarjeta con fondo propio por testimonio (`properties.item_background_color`, nuevo), cita sin comillas de código, firma en una sola línea (`— Nombre, Rol`), espaciados más generosos, y carousel con scroll-snap nativo (swipe táctil gratis) + auto-avance JS cuando hay más de 3 testimonios. Antes, misma tarde: implementación real del componente (antes stub) — fondo sólido configurable, encabezado centrado, grid de tarjetas con avatar circular (fallback de iniciales sin foto), fix de bug real `TestimonialItem.author`→`name`; el bloque consume una lista resuelta en runtime por el backend contra un módulo propio de testimonios — ver `genesis` ADR-033, misma forma `content.items[]` de siempre, sin cambios de tipos en `types.ts`. Además, sesión previa del mismo día: `Split.astro`/`RichText.astro` — achique responsive de título/subtítulo/cuerpo/botón CTA en el rango `md`(768px)→`3md`(960px), viñetas "DOT grande" para `<li>`, ajustes de espaciado `<ul>`/`<p>` y peso/contraste del texto; `Split.astro` con `properties.content_width` fullwidth ASIMÉTRICO — ver `genesis` ADR-032; ver `PROGRESS.md` para el detalle completo de todos. Sigue pendiente el mismo bloqueador de build local que dejó Antigravity: `.env` del backend con dominio desactualizado, y en este sandbox específico los binarios nativos de `rolldown`/Vite son `darwin-arm64` — no corren en este contenedor Linux aunque `node_modules` ya esté instalado, así que `npm run build`/`astro check` reales siguen sin poder correrse desde acá).

---

## Resumen ejecutivo

| Campo | Valor |
|-------|-------|
| Proyecto | Sitio público de CICA360 (Cliente 0 de Stamless) |
| Fase | Scaffold funcional completo (capa de datos + rutas + stubs visuales + formulario) — falta el diseño visual real (Antigravity) y confirmar/ejecutar el deploy |
| Framework decidido | Astro (SSG, islands architecture) — ver ADR-001 |
| Backend consumido | Stamless API REST v1 (`api.stamless.io/v1/cica360/...`) |
| Hosting objetivo | Shared hosting del cliente, sin Node/npm |
| Salud general | 🟢 `npm run build` real confirmado en verde (0 errores, 0 warnings de TS, 10 páginas). Falta el paso manual de mkcert (elimina el warning de TLS de Node en local) y el diseño visual final |

---

## Qué está hecho

- [x] Decisión de stack frontend: **Astro SSG + islands**, React/Preact solo en bloques interactivos (`contact_form`, eventualmente el slider del hero) — ver ADR-001 en `DECISIONS.md`.
- [x] Descartadas explícitamente: SPA de React puro (peor performance/SEO sin necesidad real de interactividad total) y Next.js con `output: 'export'` (pelea contra el propio framework: sin Image Optimization en runtime, sin API routes para ocultar el Bearer, pensado para correr con Node detrás).
- [x] Estrategia de formulario de contacto decidida: **proxy PHP server-side por defecto** (oculta el Bearer, casi todo shared hosting trae PHP+cURL aunque no traiga Node), con **token acotado a `forms:submit`** como fallback documentado si el hosting no soporta PHP — ver ADR-002.
- [x] Estructura de contexto creada (`docs/context/`) separada del repo del backend Stamless, para no mezclar decisiones/ADRs de un proyecto con el otro.
- [x] Manual del API Stamless (`docs/context/api/stamless-api-v1.md`) copiado/adaptado como referencia autosuficiente de este proyecto — no hace falta ir al repo del backend para saber el contrato de datos.
- [x] División de roles acordada (brief original de Grok, confirmado): Claude = capa de datos/infra (`api.ts`, tipos, rutas, proxy, build/deploy); Antigravity/Gemini = capa visual (layouts, componentes de bloque, fidelidad a CICA360).

## Qué está hecho (continuación — scaffold real, sesión 2)

- [x] **Fase 0 — Scaffold**: `package.json` (Astro ^7.2, `@astrojs/react` ^6, `@astrojs/sitemap`, Tailwind v4 vía `@tailwindcss/vite`, React 19, Prettier + plugins), `astro.config.mjs` (`output: 'static'`, sin SSR, integraciones React/sitemap/Tailwind), `tsconfig.json` (`astro/tsconfigs/strict`), `.env.example`, `src/env.d.ts`, `.gitignore`, `.editorconfig`, `.prettierrc.json`.
- [x] **Fase 1 — Capa de datos** (`src/lib/`): `types.ts` (todo el contrato del manual del API tipado: `Page`, `Post`, `Menu`, `Slider`, `Block`, `ContentLink`, `Media`, envelope, paginación), `errors.ts` (`ApiError` con `status`/`code`/`fields`, `ApiNetworkError`), `api.ts` (cliente fetch con timeout + reintentos acotados para errores transitorios, `getPages`/`getPage`/`getAllPages`/`getPosts`/`getPost`/`getAllPosts`/`getMenu`/`getSlider`/`getMedia`, guard `assertServerContext()` que tira si alguien intenta importarlo desde el navegador, y `submitContactForm()` — client-safe, nunca usa el token de `content:read`).
- [x] **Rutas** (`src/pages/`): `index.astro` (home resuelta por `is_home=true`, no por slug fijo), `[slug].astro` (`getStaticPaths` desde `GET /pages`, excluye la home), `blog/index.astro`, `blog/[slug].astro`, `404.astro`.
- [x] **Layout + bloques stub** (`src/layouts/`, `src/components/`): `BaseLayout.astro` (SEO básico, sin `<ClientRouter />` a propósito — ver decisión en `ARCHITECTURE.md` §7; ahora también carga Playfair Display + Inter), `Header.astro`/`Footer.astro` (reciben el menú ya resuelto, sin fetch propio), y un componente por cada uno de los 13 `block.type` conocidos. **9 siguen siendo stubs** sin diseño visual final (`ImageBlock`, `Cta`, `Features`, `Faq`, `ContactFormBlock`, `LegalNotice`, `Heading`, `Logos`, `ServicesGrid`), pendientes para Antigravity. **`Hero.astro`, `RichText.astro`, `Split.astro` y `Testimonials.astro` ya NO son stubs**: `Hero.astro` implementado como Hero Slider real (auto-avance, fade, wave decorator); `RichText.astro` (2026-08-31) implementado con personalización visual completa (fondo/color/alineación/ancho de contenido/padding/decoradores arriba+abajo con opacidad/flecha de scroll/enlace único opcional); `Split.astro` (2026-08-31) implementado como grid de 2 columnas con `content.media_position` alternando el lado de la imagen; `Testimonials.astro` (2026-08-31, con una segunda pasada la misma tarde corrigiendo contra el mockup real: avatares más grandes, tarjeta con fondo propio, cita sin comillas, firma en una línea, y carousel táctil cuando hay más de 3 testimonios) implementado como sección de fondo sólido con grid de tarjetas (avatar circular con fallback de iniciales, frase/firma en itálica) + botón "ver más" opcional — los 4 bloques por Claude a pedido directo del Tech Lead, cruzando puntualmente el límite de roles — ver `PROGRESS.md` para el detalle de cada uno. `BlockRenderer.astro` ignora tipos desconocidos sin romper la página (con warning solo en dev).
- [x] **`Logos.astro` — carousel de marcas/socios, antes stub vacío** (2026-08-31): grilla estática de hasta 7 logos (`grid-cols-3 sm:grid-cols-4 md:grid-cols-5 2lg:grid-cols-7`); con más de 7, carousel paginado de a 7 (cada "página" del carousel es una grilla completa, no un logo individual — a diferencia de `Testimonials.astro`) con flechas, dots dorados y drag por Pointer Events (mouse+touch+pen), mismo patrón ya establecido en el resto del sitio. Filtro grayscale/opacidad por logo (`properties.media_filter_grayscale`/`media_opacity`, ya genéricas — reusadas de `split`, no nuevas) que se quita en `:hover`/`:focus-visible` revelando el logo a color real. `content.items[]` sin cambios de forma (`media`/`url`), `Media` ya existía en `types.ts`, `BlockRenderer.astro` ya ruteaba `logos` — cero cambios de tipos/routing, todo el trabajo fue dentro del componente.
- [x] **`Header.astro` — menú mobile fullscreen** (2026-08-31, cruzando puntualmente el límite Claude=datos/Antigravity=visual, mismo criterio ya usado en `Hero.astro`): por debajo de `3md` (960px) la topbar muestra hamburguesa/logo centrado/CTA-ícono en vez del menú desktop completo; al tocar la hamburguesa se abre un overlay fullscreen (`cicaindigo-500`) con la nav vertical centrada (mismo hover/active que desktop), soporte de submenús (`item.children`, colapsables) y el CTA completo abajo. Detalle completo en `PROGRESS.md`.
- [x] **Formulario de contacto**: `src/components/islands/ContactForm.tsx` (única isla React real del proyecto, `client:visible`, con honeypot, validación básica, estados idle/submitting/success/error, errores por campo desde `errors.fields`). `public/contacto.php` — proxy PHP compatible desde PHP 7.4+ (rate limit best-effort por IP, honeypot server-side extra, forward por cURL a Stamless, nunca expone el token) + `public/contacto.config.example.php` (plantilla, la real — `contacto.config.php` — va en `.gitignore` y se crea a mano en el servidor).
- [x] **Infraestructura/seguridad adicional**: `public/.htaccess` (headers de seguridad + CSP inicial + cache agresivo de assets con hash + forzado de HTTPS — CSP no probada en hosting real todavía), `public/robots.txt` + `@astrojs/sitemap`, `.github/workflows/build-and-deploy.yml` (CI de build con `astro check`+`astro build`; el paso de deploy por FTP queda comentado hasta confirmar credenciales reales del hosting).

### ⚠️ Limitación importante de esta sesión — leer antes de confiar ciegamente en el scaffold

Este scaffold se generó en un entorno **sin acceso a la registry de npm** (mismo tipo de restricción de red que ya afectaba a Composer/PHP en el repo del backend Stamless). Concretamente:

- **No se pudo correr `npm install`** — no hay `node_modules/` ni `package-lock.json` generados todavía.
- **No se pudo correr `astro check` ni `astro build` reales** — toda la verificación fue manual: balance de paréntesis/llaves/corchetes por script, validación de JSON/YAML, y una revisión cuidadosa línea por línea de cada archivo (incluyendo corregir en el camino un uso incorrecto de `<ViewTransitions />`, que en la versión actual de Astro es `<ClientRouter />` — se optó por sacarlo del todo a favor de CSS nativo, ver `ARCHITECTURE.md` §7).
- **Ya se corrió tres veces, en real**: la primera corrida encontró 4 errores de TypeScript (índices de firma faltantes) — corregidos. La segunda expuso un warning de deprecación de `FormEvent` (fix anterior insuficiente, corregido a `SubmitEvent`) y un error bloqueante de certificado TLS local. La tercera **quedó confirmada en verde**: `astro check` → 0 errores/0 warnings/0 hints, `astro build` → 10 páginas generadas. Único punto suelto: el bypass de TLS automático generaba igual un warning de Node aunque ya no hiciera falta — corregido (ver `PROGRESS.md`, entrada "Tercer `npm run build` real"): ahora es opt-in explícito (`STAMLESS_DEV_INSECURE_TLS`), y se documentó la solución real (certificado local confiable vía mkcert) en el README. **Falta que el humano instale mkcert y confirme una corrida sin ese warning en absoluto** — paso manual fuera del repo.

## Qué falta (alto nivel, ver detalle en `TASK.md`)

- [ ] **Ejecutar `npm install` + `npm run build` reales** y corregir lo que el sandbox no pudo verificar (ver limitación arriba) — bloqueante antes de seguir sumando features.
- [ ] **Fase 2** (Antigravity) — reemplazar los stubs de `src/components/blocks/*` y `src/layouts/BaseLayout.astro` con el diseño visual real, fidelidad a las capturas de CICA360.
- [ ] **Fase 3, cierre** — generar el token real de `forms:submit`, completar `contacto.config.php` en el servidor (no en git), probar el submit end-to-end.
- [ ] **Fase 4, cierre** — confirmar credenciales FTP/SFTP del hosting real y descomentar el paso de deploy en `.github/workflows/build-and-deploy.yml`; configurar Cloudflare delante del dominio.
- [ ] **Fase 5** — QA de performance (Lighthouse/PageSpeed) y auditoría real del JS que se manda al navegador, una vez que haya un build real corriendo.
- [ ] **Fase 6** (post-MVP, opcional) — Rebuild automático al publicar contenido en Filament (webhook `repository_dispatch`).

---

## Bloqueadores actuales

| Bloqueador | Impacto | Estado |
|------------|---------|--------|
| .env del Backend (`/Users/edu/Storage/webapps/projects/genesis/.env`) con dominios desactualizados | `api.stamless.host` responde con 404 porque el backend aún espera `api.genesisly.host`. Esto bloquea el build del frontend. | Pendiente de que el humano actualice el `.env` del backend y reinicie el servidor de desarrollo |
| Token real del API Stamless (Console → Desarrolladores → API Tokens) | No se puede empezar Fase 1 sin un token de `content:read` para desarrollo | Pendiente de generar en Console (`console.stamless.host`) |
| Confirmación del tipo de shared hosting (¿tiene PHP? ¿permite subir por FTP/SFTP? ¿cron?) | Define si el formulario usa proxy PHP o token acotado, y cómo se automatiza el deploy | Pendiente de confirmar con el cliente/hosting |
| Media real de CICA360 (R2 todavía no integrado en el backend, ver backend `CURRENT_STATE.md`) | Los bloques de imagen van a venir `null` hasta que el backend tenga media cargada | No bloquea el desarrollo del front (se puede maquetar con placeholders), sí bloquea el contenido final |

---

## Notas para el próximo agente

- Leer primero: `AGENTS.md`, este archivo, `TASK.md`, `ARCHITECTURE.md`, `DECISIONS.md`, y el manual del API en `docs/context/api/stamless-api-v1.md`.
- Este repo es independiente del backend Stamless — no reabrir decisiones de arquitectura del backend acá (dominios, excepciones, multi-tenancy del backend, etc. viven en el otro repo).
- No hay código todavía: el siguiente trabajo es el scaffold real (Fase 0 en `TASK.md`).
- Antes de handoff: actualizar este archivo + `TASK.md` + entrada en `PROGRESS.md`.
