# CICA360 (front) — Log de decisiones (ADR ligero)

> Registro de decisiones arquitectónicas de este proyecto (front de CICA360). Separado del `DECISIONS.md` del backend Stamless — no reabrir acá decisiones que le corresponden al backend (dominios, rutas del API, multi-tenancy, etc.).
> Formato: ID, fecha, estado, contexto, decisión, consecuencias.
> No borrar decisiones: marcar como `Superseded` y enlazar la nueva.

---

## Índice

| ID | Fecha | Título | Estado |
|----|-------|--------|--------|
| ADR-001 | 2026-08-20 | Stack frontend: Astro (SSG + islands), no SPA React puro, no Next.js | Accepted |
| ADR-002 | 2026-08-20 | Estrategia del formulario de contacto: proxy PHP por defecto, token acotado como fallback | Accepted |
| ADR-003 | 2026-08-20 | Contexto de proyecto separado del backend Stamless + manual del API propio | Accepted |

---

## ADR-001 — Stack frontend: Astro (SSG + islands)

| Campo | Valor |
|-------|-------|
| **Estado** | Accepted |
| **Fecha** | 2026-08-20 |
| **Decisión** | El sitio público de CICA360 se construye en **Astro**, con salida estática (SSG), usando **islands architecture**: componentes `.astro` sin JS por defecto, y React o Preact **únicamente** en los bloques que necesitan interactividad real en el cliente (`contact_form`, y el slider del `hero` si hace falta JS real). No se usa una SPA de React puro ni Next.js. |
| **Contexto** | El sitio corre en un shared hosting **sin Node ni npm**, tiene que ser muy rápido/seguro/moderno y soportar alta demanda, y consume contenido de un CMS headless (Stamless) que se publica ocasionalmente, no que cambia por request. Se evaluaron 3 opciones: React puro (SPA), Next.js (static export), Astro. |
| **Alternativas consideradas** | (a) **React puro (SPA)** — descartado: renderiza todo client-side, paga el costo de un framework completo + hidratación en cada visita para contenido que es en su mayoría lectura estática; peor LCP/TTI y peor SEO sin trabajo adicional de prerender (que a su vez requeriría Node en alguna parte). (b) **Next.js con `output: 'export'`** — descartado: el modo estático de Next pelea contra el diseño del framework (sin Image Optimization API en runtime, sin API routes — que es justamente el mecanismo más simple para ocultar el Bearer del formulario —, pensado para correr con un servidor Node detrás, que es lo que este hosting no tiene). |
| **Consecuencias** | 1) El build (`astro build`) corre en CI o localmente, nunca en el servidor de producción — el hosting solo recibe el `dist/` estático. 2) Los bloques presentacionales del CMS (`rich_text`, `features`, `split`, `cta`, `logos`, `services_grid`, `testimonials`) se implementan como `.astro` sin directivas `client:*` — cero JS. 3) Solo `contact_form` (y opcionalmente el slider del `hero`) usa un island con React/Preact. 4) Un cambio de contenido en el backend (Filament) no se refleja en el sitio hasta el próximo build+deploy — trade-off aceptado de SSG, ver ARCHITECTURE.md §6 y la Fase 6 (post-MVP) para automatizarlo. 5) Este ADR resuelve el pendiente que el backend de Stamless tenía anotado en su propio `TASK.md` ("Elegir Astro vs Next.js") — la elección queda registrada acá porque es una decisión del proyecto frontend, no del backend. |

---

## ADR-002 — Estrategia del formulario de contacto: proxy PHP por defecto, token acotado como fallback

| Campo | Valor |
|-------|-------|
| **Estado** | Accepted |
| **Fecha** | 2026-08-20 |
| **Decisión** | El submit de `POST /forms/contacto/submit` se resuelve, en orden de preferencia: (1) **Proxy PHP** — un script server-side (`contacto.php` o similar) subido junto al sitio estático, que recibe el POST del navegador, lo reenvía a Stamless con el Bearer guardado en config PHP (nunca en el bundle del cliente), y devuelve la respuesta. (2) **Token acotado** — si el hosting no soporta ningún scripting server-side, se usa un token de Console con **únicamente** la ability `forms:submit` (nunca `content:read`), aceptando que quede visible en el bundle del cliente, documentado explícitamente como excepción. |
| **Contexto** | Todo el contenido de lectura se resuelve en build time (el token nunca llega al navegador, gratis por ser SSG — ver ADR-001), pero el formulario de contacto se ejecuta en runtime, desde el navegador del visitante, después de que el sitio ya es HTML estático sin servidor propio. Hace falta una forma de que ese POST lleve el Bearer sin exponerlo. |
| **Alternativas consideradas** | (a) Poner el token completo (`content:read` + `forms:submit`) directamente en el JS del cliente — descartado de plano: expondría lectura de contenido con el mismo token, sin necesidad. (b) Depender de que el hosting soporte Node/serverless (ej. Cloudflare Workers/Pages Functions) para un endpoint propio — descartado como estrategia *por defecto* porque el requisito explícito es shared hosting sin Node; queda como alternativa a evaluar solo si el proxy PHP resulta inviable Y el fallback de token acotado no es aceptable para el cliente. |
| **Consecuencias** | 1) Casi todo shared hosting real (cPanel, Plesk, etc.) trae PHP + cURL habilitado aunque no traiga Node, así que el proxy PHP es la apuesta segura por defecto. 2) Si se termina usando el token acotado, el daño posible en caso de filtración queda acotado por diseño: `forms:submit` no permite leer contenido, y el endpoint ya tiene rate limiting del lado de Stamless (10 req/min por IP, además del general de 60/min) — y el token se puede revocar/regenerar desde Console (Desarrolladores → API Tokens → Regenerar) en segundos si hace falta. 3) La decisión final entre las dos rutas depende de confirmar las capacidades reales del hosting del cliente — ver `TASK.md`, Fase 3, subtarea #14, todavía pendiente. 4) Se agrega honeypot del lado del cliente como capa extra de anti-spam, independiente de que el backend (`Form.enable_honeypot`) todavía no lo aplique server-side. |

---

## ADR-003 — Contexto de proyecto separado del backend Stamless

| Campo | Valor |
|-------|-------|
| **Estado** | Accepted |
| **Fecha** | 2026-08-20 |
| **Decisión** | Este proyecto (front de CICA360) tiene su propia carpeta, su propio `docs/context/` (`CURRENT_STATE.md`, `TASK.md`, `ARCHITECTURE.md`, `DECISIONS.md`, `PROGRESS.md`) y su propio manual del API Stamless (`docs/context/api/stamless-api-v1.md`, copiado/adaptado del `docs/api/v1.md` del backend), completamente separado del repositorio del backend Stamless. |
| **Contexto** | El backend Stamless (Laravel/Filament) y este front (Astro) son dos proyectos con stack, ciclo de vida y hosting distintos. Mezclar sus decisiones/ADRs en un solo `docs/context/` generaba confusión sobre qué regla aplica a qué proyecto — en particular, decisiones de dominio/rutas/excepciones del backend no tienen nada que ver con decisiones de framework/build/deploy del front. |
| **Consecuencias** | 1) Un agente trabajando en este repo no necesita (ni debe) leer el repo del backend para saber el contrato de datos — el manual en `docs/context/api/stamless-api-v1.md` es autosuficiente. 2) Si el contrato del API cambia del lado del backend (nuevo endpoint, cambio de envelope, nuevo `errors.code`), hay que actualizar ese manual acá — no queda sincronizado automáticamente, es responsabilidad manual documentada en `AGENTS.md`. 3) Decisiones de arquitectura del backend (dominios, `apiPrefix`, excepciones, etc.) siguen viviendo únicamente en el `DECISIONS.md` del repo de Stamless — no se duplican acá. |

---

## Cómo agregar una nueva decisión

1. Asignar siguiente ID (`ADR-00N`).
2. Completar: Estado, Fecha, Decisión, Contexto, Alternativas (si aplica), Consecuencias.
3. Actualizar el índice de arriba.
4. Si reemplaza una decisión previa: marcar la anterior como `Superseded by ADR-00N`.
5. Mencionar el cambio en `PROGRESS.md` y, si afecta el diseño, en `ARCHITECTURE.md`.
