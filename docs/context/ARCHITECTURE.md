# CICA360 (front) — Arquitectura

> Documento de referencia de arquitectura. Actualizar cuando cambien decisiones estructurales.
> Última actualización: 2026-08-20

---

## 1. Visión general

Sitio público de **CICA360** (consultora de seguros y temas jurídicos, Cliente 0 de Stamless), construido como **contenido estático generado en build time** que consume el API REST headless de Stamless. No hay servidor de aplicación en producción: el hosting solo sirve archivos (HTML/CSS/JS + eventualmente un script PHP para el formulario).

```
[Stamless API REST v1]  ──(build time, fetch con token)──►  [Astro build]  ──►  [dist/ estático]
                                                                                        │
                                                                                        ▼
                                                          [Shared hosting sin Node/npm] ──► [Cloudflare] ──► Visitante
                                                                   │
                                                                   └─ (runtime, solo el form) ──► [contacto.php] ──► [Stamless API]
```

---

## 2. Por qué Astro (SSG + islands) y no otra cosa

Decisión completa en ADR-001 (`DECISIONS.md`). Resumen:

- **No SPA de React puro**: renderiza todo en el cliente, paga el costo de un framework completo + hidratación en cada visita, para un sitio que es en un 90%+ contenido de lectura que cambia poco. Peor LCP/TTI, peor SEO sin trabajo extra.
- **No Next.js con `output: 'export'`**: pelea contra el propio framework — sin Image Optimization API en runtime, sin API routes (así que no hay forma nativa de ocultar el Bearer del formulario sin un servidor Node), pensado para correr con Node detrás.
- **Sí Astro**: renderiza todo a HTML estático en build time. El JavaScript de un framework (React, Preact, o ninguno) solo se envía para los componentes puntuales marcados como interactivos (`client:load`, `client:visible`) — y solo el JS de esos componentes, no el de la página entera. Encaja exactamente con el caso de uso (contenido de un CMS headless) y con la restricción de hosting (nada de Node en el servidor).

**Regla de oro del proyecto**: un componente `.astro` sin directiva `client:*` no manda JavaScript al navegador. De los bloques del backend (`hero`, `rich_text`, `features`, `split`, `testimonials`, `logos`, `cta`, `services_grid`, `contact_form`), la inmensa mayoría es presentacional puro y debe quedar así. Los únicos candidatos reales a JS son `contact_form` (fetch + estado de éxito/error) y, si hace falta, el slider del `hero` (evaluar primero si alcanza con CSS `scroll-snap` antes de sumar una librería).

---

## 3. Flujo de datos

### Lectura (páginas, menús, sliders, posts)

Todo el contenido se resuelve en **build time**, dentro de `astro build` (que corre en CI o localmente, nunca en el servidor de producción):

1. `src/lib/api.ts` hace `fetch()` contra `STAMLESS_API_URL` con `Authorization: Bearer ${STAMLESS_API_TOKEN}` (variable de entorno del proceso de build, nunca del cliente).
2. `getStaticPaths` arma las rutas desde `GET /pages` (y `GET /posts` para el blog).
3. Cada página consulta `GET /pages/{slug}` (con `blocks[]` ya resueltos, sin ids internos — ver el manual del API) y la renderiza a HTML estático.
4. El resultado (`dist/`) no contiene el token en ningún archivo — el fetch ocurrió en un proceso que nunca llegó al navegador.

Esto resuelve gratis el requisito de "el token nunca visible en el cliente" para todo lo que es lectura, simplemente por ser SSG.

### Escritura (formulario de contacto)

El único endpoint que se ejecuta en **runtime**, desde el navegador del visitante, es `POST /forms/{slug}/submit`. Acá el sitio ya es HTML estático sin servidor propio detrás, así que hay dos estrategias posibles (ver ADR-002 para el detalle y los criterios de elección):

1. **Proxy PHP (por defecto)**: un script `contacto.php` subido junto al sitio estático recibe el POST del formulario, lo reenvía server-side a Stamless con el Bearer (guardado en config PHP, nunca en el bundle del cliente) y devuelve la respuesta. Requiere que el shared hosting tenga PHP + cURL — casi universal en shared hosting real (cPanel, Plesk, etc.), aunque no tenga Node.
2. **Token acotado (fallback)**: si el hosting es 100% estático sin ningún scripting server-side, se usa un token de Console con **únicamente** la ability `forms:submit` (nunca `content:read`), aceptando que quede visible en el bundle. El daño posible queda acotado por diseño: no puede leer contenido, solo enviar formularios, y ya está limitado por el rate limit del API (10 req/min por IP en `forms/submit`, además del general de 60/min). Si se abusa, se revoca/regenera desde Console en segundos.

La decisión final entre las dos depende de confirmar las capacidades reales del hosting del cliente (ver `TASK.md`, Fase 3 #14).

---

## 4. Islands: qué lleva JS y qué no

| Bloque | ¿Necesita JS en el cliente? | Notas |
|---|---|---|
| `hero` | **Sí** (implementado) | Slider con auto-avance/fade + flechas/dots — CSS `scroll-snap` solo no alcanzaba para autoplay + pausa on hover/foco, se resolvió con `<script>` plano (sin React) en `Hero.astro` |
| `rich_text` | No | HTML estático |
| `features`, `split`, `services_grid`, `logos`, `testimonials`, `cta` | No | HTML/CSS estático, sin estado |
| `contact_form` | **Sí** | Único bloque con lógica de cliente real: submit vía fetch, estado de éxito/error, honeypot |

Framework para los islands: **React o Preact**, a elección del equipo — Preact (≈3kb, API compatible) es preferible si el bundle importa, sin cambiar el modelo mental de componentes/hooks.

---

## 5. Multi-tenant: no aplica acá

El backend Stamless es multi-tenant (single DB + `tenant_id`), pero este front sirve **un único tenant fijo** (`cica360`) — no hay selector de tenant, no hay lógica de resolución de tenant en el cliente. El `tenant_slug` va hardcodeado en `STAMLESS_API_URL` (o como constante de build), no es un parámetro dinámico de la UI.

---

## 6. Build y deploy

```
GitHub Actions (Node disponible, workflow_dispatch o push a main)
        │
        ├─ npm ci
        ├─ astro build   ──►  dist/  (HTML/CSS/JS estático)
        │
        └─ upload-artifact ──► "cica360-dist" (zip descargable desde el run)
                                         │
                                         ▼
                        Tech Lead descarga el zip y lo sube a mano
                        (cPanel File Manager → Upload → Extract)
                                         │
                                         ▼
                        Shared hosting del cliente (sin Node/npm)
                                         ├─ dist/ (servido por Apache, document root)
                                         ├─ contacto.php / ipinfo.php / _env.php (ver §3)
                                         └─ .env (UN NIVEL POR ENCIMA del document root,
                                                  fuera del alcance del zip — se configura
                                                  una sola vez, sobrevive cada redeploy)
```

- El **build nunca corre en el servidor de producción** — corre en GitHub Actions, donde sí hay Node.
- **2026-09-13 (decisión explícita del Tech Lead, ver PROGRESS.md):** el paso a producción es MANUAL vía cPanel (subir y extraer el zip del artifact `cica360-dist`), no FTP/SFTP automatizado — mientras el contenido cambie seguido (ventana de pre-lanzamiento), se prefiere el control manual explícito de cuándo sale cada versión a producción por sobre la automatización. El snippet de deploy por FTP queda comentado en el workflow por si más adelante se decide automatizar.
- El artifact sube únicamente el resultado (`dist/`, que ya incluye `contacto.php`/`ipinfo.php`/`_env.php` — Astro copia `public/` tal cual) — el hosting nunca ve `node_modules`, `package.json` ni el código fuente de Astro.
- **Freshness del contenido**: como el sitio es estático, un cambio de contenido en Filament (backend) no se refleja automáticamente — hace falta un rebuild + re-subida manual del zip. Fase 0-5 del MVP asume esto manual (correr el workflow y subir el zip a mano tras publicar cambios); la Fase 6 (post-MVP) automatiza esto con un webhook desde Filament — evaluar recién cuando el ritmo de publicación lo justifique.

---

## 7. Performance

- Islands architecture: JS mínimo por diseño (ver §4).
- `astro:assets`/`<Image />` de Astro para optimizar imágenes en build time cuando el backend ya sirva media real (hoy R2 todavía no está integrado en el backend — ver bloqueador en `CURRENT_STATE.md`).
- Transiciones de página vía **View Transitions nativas del navegador** (CSS puro, `@view-transition { navigation: auto; }`) en vez de `<ClientRouter />` de Astro (ex `<ViewTransitions />`) — este último agrega un runtime JS de ruteo cliente para todo el sitio, lo cual va contra la filosofía de JS mínimo del proyecto (ver §4). Evaluar sumar `<ClientRouter />` solo si el soporte nativo resulta insuficiente para lo que pida el diseño final.
- Cache agresivo de assets estáticos (el contenido solo cambia con un rebuild, no por request).

---

## 8. Seguridad

- El token del API (`STAMLESS_API_TOKEN`, ability `content:read`) vive solo en variables de entorno del proceso de build (local o secrets de CI) — nunca en el repo, nunca en el bundle del cliente.
- El token del formulario (proxy PHP) vive en config server-side del hosting, nunca en el HTML/JS servido.
- Si se usa el fallback de token acotado (§3.2), ese token tiene **únicamente** `forms:submit` — jamás `content:read` — para acotar el daño si se filtra.
- CSP y headers de seguridad vía `.htaccess` (Apache, estándar en shared hosting) — no requiere Node.
- Honeypot en el formulario de contacto como capa extra de anti-spam del lado del cliente (independiente de que el backend todavía no aplique `Form.enable_honeypot` — ver el manual del API, sección de limitaciones).

---

## 9. Alta demanda

HTML estático servido por el hosting compartido soporta muchísimo más tráfico concurrente que cualquier render dinámico por request, porque no hay cómputo por visita. Se recomienda Cloudflare (plan gratuito) delante del dominio: CDN cachea casi toda la lectura en el edge, WAF/protección DDoS, SSL gratis. El único endpoint "vivo" real es el submit del formulario, ya limitado por rate limiting del lado del API Stamless (y opcionalmente del proxy PHP).

---

## Referencias internas

- Estado actual: [`CURRENT_STATE.md`](./CURRENT_STATE.md)
- Decisiones (ADR): [`DECISIONS.md`](./DECISIONS.md)
- Tarea activa: [`TASK.md`](./TASK.md)
- Progreso: [`PROGRESS.md`](./PROGRESS.md)
- Manual del API Stamless: [`api/stamless-api-v1.md`](./api/stamless-api-v1.md)
- Convenio de Dominios y Ruteo: [`DOMAINS_AND_ROUTING.md`](./DOMAINS_AND_ROUTING.md)
