# CICA360 (front) — Guía para agentes de IA

Este repositorio es el **sitio público de CICA360** (Cliente 0 de Stamless), construido en **Astro** con salida estática, que consume el API REST headless de **Stamless** (`Genesis CMS`). Es un proyecto **separado** del backend Stamless (Laravel/Filament) — no comparte código, no comparte `docs/context/`, y no debe mezclarse con él. Cualquier agente (Claude, Antigravity/Gemini, Grok, Codex, Cursor, etc.) debe leer este archivo y el contexto en `docs/context/` **antes** de tocar código.

---

## Contexto obligatorio (leer en este orden)

1. [`docs/context/CURRENT_STATE.md`](docs/context/CURRENT_STATE.md) — dónde estamos
2. [`docs/context/TASK.md`](docs/context/TASK.md) — qué hay que hacer ahora, división de roles
3. [`docs/context/ARCHITECTURE.md`](docs/context/ARCHITECTURE.md) — cómo está diseñado el sitio (Astro SSG + islands, build/deploy, formulario)
4. [`docs/context/DECISIONS.md`](docs/context/DECISIONS.md) — qué ya se decidió (no reabrir sin ADR)
5. [`docs/context/PROGRESS.md`](docs/context/PROGRESS.md) — qué se hizo recientemente
6. [`docs/context/api/stamless-api-v1.md`](docs/context/api/stamless-api-v1.md) — **manual del API Stamless** que este sitio consume (envelope, auth, endpoints, errores). Es la fuente de verdad del contrato de datos para este proyecto — no hace falta (ni corresponde) ir a leer el repo del backend.

Punteros por herramienta:

- Claude Code → también [`CLAUDE.md`](CLAUDE.md)
- Gemini CLI / Antigravity → también [`GEMINI.md`](GEMINI.md)

---

## Por qué esta carpeta existe separada del backend

Stamless (el CMS) y el front de CICA360 son dos proyectos con ciclos de vida, stacks y hosting distintos: el backend es Laravel/Filament corriendo en su propio servidor; este front es HTML/CSS/JS estático generado con Astro y subido a un **shared hosting sin Node ni npm**. Mezclarlos en un solo `docs/context/` generaba confusión sobre qué ADR aplica a qué proyecto. Regla simple: **cambios de backend (rutas, modelos, excepciones, dominios) viven en el repo de Stamless; cambios de frontend (componentes, build, deploy del sitio) viven acá.** Si un cambio de contrato de API afecta a este front, se refleja actualizando `docs/context/api/stamless-api-v1.md` en este repo (no editando el backend desde acá).

---

## Reglas de trabajo

### 1. Un solo dueño de la tarea activa

- Solo **un agente** es owner de la tarea descrita en `TASK.md` a la vez.
- Al empezar: poner tu identificador en `Owner actual` y estado `In progress`.

### 2. No reinventar decisiones cerradas

Decisiones **Accepted** en `DECISIONS.md` son vinculantes, en particular:

- Framework: **Astro** (SSG, islands architecture) — no SPA de React puro, no Next.js.
- Interactividad: React (o Preact) **solo** en los bloques que de verdad la necesitan (`contact_form`, y el slider del hero si hace falta JS). Todo lo demás se renderiza como `.astro` sin JS.
- Hosting: **shared hosting sin Node/npm** — el build corre en CI (GitHub Actions) o localmente; al servidor solo sube el `dist/` estático (+ el proxy PHP si aplica).
- Formulario de contacto: proxy PHP server-side por defecto (oculta el Bearer); token acotado (`forms:submit` únicamente) como fallback documentado si el hosting no soporta PHP.
- Multi-tenant: este sitio sirve **un solo tenant** (`cica360`) — no hay selector de tenant ni lógica multi-tenant en el front.

Para cambiar una decisión: nuevo ADR en `DECISIONS.md` + actualizar `ARCHITECTURE.md` si aplica.

### 3. Handoff obligatorio

Antes de terminar la sesión o ceder el trabajo:

1. Actualizar `docs/context/CURRENT_STATE.md` (hecho / en progreso / siguiente / bloqueadores).
2. Actualizar `docs/context/TASK.md` (subtareas, owner, estado).
3. Añadir entrada en `docs/context/PROGRESS.md` (arriba del log).
4. Si hubo decisión nueva → `DECISIONS.md`.
5. Si cambió el diseño/arquitectura → `ARCHITECTURE.md`.
6. Listar archivos tocados y qué queda pendiente para el otro agente (ver división de roles en `TASK.md`).

### 4. División de roles (ver detalle en `TASK.md`)

- **Claude** — capa de datos: `src/lib/api.ts`, tipos, `.env`/`env.d.ts`, rutas/`getStaticPaths`, proxy de formulario, pipeline de build/deploy.
- **Antigravity (Gemini)** — capa visual: layouts, componentes por `block.type`, Header/Footer con menú dinámico, fidelidad a las capturas de CICA360.

Cada uno respeta el límite del otro (ver "NO tocar" explícito en `TASK.md`) para poder trabajar en paralelo sin pisarse.

### 5. Alcance y calidad

- Preferir cambios pequeños y verificables orientados a la tarea activa.
- No commitear secretos (`.env`, tokens Bearer, credenciales del proxy PHP).
- Auditar el JS que efectivamente se envía al navegador antes de dar por terminado un bloque — si un componente presentacional (rich_text, features, cta, logos, split, services_grid) termina cargando un framework JS, es una regresión, no un detalle menor.
- Nunca hardcodear el token del API en un componente/archivo que termine en el bundle del cliente.

### 6. Comunicación con el humano

- Reportar bloqueadores en `CURRENT_STATE.md`.
- Preguntar solo cuando una decisión no esté en ADRs y bloquee el progreso.

---

## Mapa rápido del producto

| Concepto | Detalle |
|----------|---------|
| Producto | Sitio público de CICA360 (consultora de seguros/jurídico), Cliente 0 de Stamless |
| Framework | Astro (SSG, islands) + TypeScript + Tailwind v4 |
| Backend consumido | Stamless API REST v1 — `api.stamless.io/v1/cica360/...` (ver manual en `docs/context/api/`) |
| Hosting | Shared hosting del cliente, **sin Node/npm** — solo sirve estático (+ PHP si el proxy de formulario lo usa) |
| Build | Local o CI (GitHub Actions) — nunca en el servidor de producción |
| CDN/seguridad | Cloudflare delante del dominio (recomendado) |

---

## Checklist de inicio de sesión

- [ ] Leí `CURRENT_STATE.md` y `TASK.md`
- [ ] Leí el manual del API en `docs/context/api/stamless-api-v1.md` si voy a tocar fetch/tipos/contratos
- [ ] Confirmé que no hay otro owner activo (o el humano me asignó)
- [ ] Sé cuál es la subtarea siguiente y de quién es (Claude vs Antigravity)
- [ ] No voy a contradecir ADRs sin documentar

## Checklist de fin de sesión

- [ ] `CURRENT_STATE.md` actualizado
- [ ] `TASK.md` actualizado (owner liberado o handoff explícito)
- [ ] Entrada en `PROGRESS.md`
- [ ] Archivos tocados y pendientes para el otro agente, listados claramente
