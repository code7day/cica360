# Manual del API Stamless v1 — para el front de CICA360

> Versión: v1 · Última actualización: 2026-08-20 · Adaptado de `docs/api/v1.md` del repositorio del backend Stamless (Laravel/Filament), como referencia autosuficiente para este proyecto — ver ADR-003 en `../DECISIONS.md`.
>
> **Este es el único contrato de datos que necesita este proyecto.** No hace falta leer el repositorio del backend para trabajar acá. Si el contrato del API cambia del lado del backend, este archivo hay que actualizarlo a mano (no se sincroniza solo).

## Introducción

El API v1 de Stamless expone, en modo **solo lectura** (salvo el envío de formularios), el contenido publicado del tenant `cica360` para que este sitio (Astro, estático) lo consuma. Actualmente opera en un único idioma (`lang_iso = es`) y expone únicamente contenido publicado/activo — nunca borradores.

Toda la API requiere autenticación por **token Bearer** (Laravel Sanctum). No hay endpoints públicos sin token.

## Base URL

```
{STAMLESS_API_URL}/v1/{tenant_slug}/...
```

Para este proyecto, `tenant_slug` es siempre **`cica360`** (tenant fijo — ver ADR de multi-tenant en `../ARCHITECTURE.md` §5, este front no tiene selector de tenant).

| Entorno | URL base completa |
|---|---|
| Producción | `https://api.stamless.io/v1/cica360` |
| Local/desarrollo | `https://api.stamless.host/v1/cica360` |

`STAMLESS_API_URL` en `.env` guarda `{APP_URL_API}` (sin el `/v1/{tenant_slug}` — eso lo arma `src/lib/api.ts`). **No lleva prefijo `/api`** — la URL real es `.../v1/...`, no `.../api/v1/...` (si ves esto último en algún lado, está desactualizado).

## Autenticación

Todas las rutas de `/v1/cica360/*` exigen el header:

```
Authorization: Bearer {token}
```

El token es un **personal access token de Sanctum**, generado desde Console (`console.stamless.host` → Desarrolladores → API Tokens). Cada token tiene una o más **abilities**:

| Ability | Para qué sirve | Uso en este proyecto |
|---|---|---|
| `content:read` | Todos los endpoints `GET` (pages, posts, services, menus, sliders, media) | Token de **build time** (`STAMLESS_API_TOKEN` en `.env`/secrets de CI) — nunca llega al navegador, ver `../ARCHITECTURE.md` §3 |
| `forms:submit` | `POST forms/{slug}/submit` | Usado por el proxy PHP (server-side) o, si aplica el fallback, por un token acotado expuesto solo con esta ability — ver ADR-002 |

**Regla de este proyecto**: el token de `content:read` **jamás** debe terminar en el bundle del cliente ni en el repo — vive únicamente en variables de entorno del proceso de build. Si en algún momento se necesita un token en el cliente (fallback del formulario), ese token debe tener **únicamente** `forms:submit`, generado aparte.

Reglas de autorización del API, en orden:

1. **Sin header `Authorization`** → `401`.
2. **Token inválido, malformado o revocado** → `401`.
3. **Token válido pero sin la ability requerida por el endpoint** → `403`.
4. **Token válido pero de un tenant distinto a `cica360`** → `403` (nunca se filtra si el tenant existe o no).
5. **`cica360` no existe o está inactivo** (no debería pasar en este proyecto, pero está documentado por completitud) → `404`.

### Cómo crear/regenerar un token (Console)

1. Iniciar sesión en Console (`console.stamless.host`) con el usuario del tenant `cica360`.
2. Ir a **Desarrolladores → API Tokens**.
3. **Crear token**: nombre descriptivo (ej. `frontend-produccion`, `frontend-build-ci`), abilities necesarias, expiración (`Nunca`, `1 día`, `30/90 días`, `1 año`).
4. El token en texto plano se muestra **una sola vez** — copiarlo antes de cerrar el banner.
5. Si un token se pierde/filtra, usar **Regenerar** en la fila correspondiente: revoca el anterior y emite uno nuevo con el mismo nombre/abilities/expiración al instante (o pide elegir nueva expiración si el anterior ya había vencido).

## Envelope de response

Toda respuesta (éxito o error) sigue el mismo formato. Las claves con valor vacío/nulo **se omiten**, así que no todas las respuestas tienen exactamente las mismas claves.

```jsonc
{
  "success": true,       // boolean, siempre presente
  "message": "...",      // string, solo si hay un mensaje relevante
  "status_code": 200,    // int, siempre presente
  "data": { ... },       // el recurso o colección — solo en éxito
  "meta": { ... },       // paginación — solo en listados
  "links": { ... },      // links de paginación — solo en listados
  "errors": { ... }      // detalle de error — solo en 4xx/5xx
}
```

Listados paginados (`GET pages`, `GET posts`) agregan:

```jsonc
"meta": { "current_page": 1, "per_page": 15, "total": 42, "last_page": 3 },
"links": { "first": "https://.../pages?page=1", "prev": null, "next": "https://.../pages?page=2", "last": "https://.../pages?page=3" }
```

`per_page` acepta `?per_page=N` en la query string (máximo 50, default 15).

## Errores

| Código | Cuándo | `errors.code` | Ejemplo |
|---|---|---|---|
| `401` | Sin header `Authorization` | `unauthenticated` | `{"success": false, "message": "No autenticado. Enviá un token Bearer en Authorization.", "status_code": 401, "errors": {"code": "unauthenticated"}}` |
| `401` | Token inválido, malformado, expirado o revocado | `token_invalid` | `{"success": false, "message": "Token inválido o expirado.", "status_code": 401, "errors": {"code": "token_invalid"}}` |
| `403` | Token sin la ability requerida, o de otro tenant | `forbidden` | `{"success": false, "message": "No tenés permiso para este recurso.", "status_code": 403, "errors": {"code": "forbidden"}}` |
| `404` | Página/post/menú/slider/media no encontrado | `not_found` | `{"success": false, "message": "Recurso no encontrado.", "status_code": 404, "errors": {"code": "not_found"}}` |
| `422` | Validación (`forms/submit` con campos requeridos faltantes) | `validation` | `{"success": false, "message": "Revisá los datos enviados.", "status_code": 422, "errors": {"code": "validation", "fields": {"message": ["El campo message es obligatorio."]}}}` |
| `429` | Rate limit superado | `too_many_requests` | `{"success": false, "message": "Demasiadas solicitudes. Intentá más tarde.", "status_code": 429, "errors": {"code": "too_many_requests"}}` |

`errors.code` es estable y pensado para lógica de cliente (`switch` en `src/lib/api.ts`) — el `message` es para mostrarlo tal cual a una persona, puede cambiar de texto sin previo aviso. **Importante para este proyecto**: el `message` de error es siempre fijo por status (nunca texto libre de una excepción), así que es seguro mostrarlo directo en la UI del formulario de contacto sin filtrar/parsear.

**Rate limiting**: 60 requests/minuto por IP en todos los endpoints de lectura (no debería afectar a este proyecto porque la lectura ocurre en build time, no por visitante); 10 requests/minuto por IP adicionales en `forms/{slug}/submit` (esto sí aplica en runtime, real, por visitante).

## Idioma (`lang_iso`)

Todos los endpoints devuelven contenido en `lang_iso = es` — no hay selector de idioma. No hace falta manejar esto en el front.

---

## Endpoints usados por este proyecto

### `GET /pages`

Lista páginas publicadas, paginada. Usado por `getStaticPaths` para saber qué rutas generar.

- **Abilities**: `content:read`
- **Query params**: `type` (`page`\|`landing`\|`header`\|`footer`\|`colophon`\|`legal`), `is_home` (`0`\|`1`), `per_page` (1–50)

Response resumida (sin `blocks`):

```json
{
  "success": true,
  "status_code": 200,
  "data": [
    { "uuid": "0199a1c2-...", "slug": "home", "type": "page", "is_home": true, "pretitle": null, "title": "Home", "subtitle": null, "published_at": "2026-08-16T00:00:00.000000Z" }
  ],
  "meta": { "current_page": 1, "per_page": 15, "total": 5, "last_page": 1 },
  "links": { "first": "...", "prev": null, "next": null, "last": "..." }
}
```

### `GET /pages/{slug}`

Detalle completo de una página, con `blocks[]` visibles y ordenados. Los slugs reales de CICA360: `home`, `sobre-cica`, `servicios`, `casos-de-exito`, `contacto`.

- **Abilities**: `content:read`
- **Response `404`** si no existe, no está publicada, o es de otro tenant.

```json
{
  "success": true,
  "status_code": 200,
  "data": {
    "uuid": "0199a1c2-...",
    "slug": "home",
    "type": "page",
    "is_home": true,
    "pretitle": null,
    "title": "Home",
    "subtitle": null,
    "meta": { "seo_title": "CICA360 — Seguros, finanzas y asesoría legal", "seo_description": "..." },
    "links": [],
    "properties": {},
    "published_at": "2026-08-16T00:00:00.000000Z",
    "blocks": [
      { "uuid": "0199a1c3-...", "type": "hero", "pretitle": null, "title": null, "subtitle": null, "content": { "mode": "slider", "slider_slug": "home" }, "links": [], "properties": {}, "sort_order": 0 },
      {
        "uuid": "0199a1c5-...", "type": "rich_text", "pretitle": null, "title": "Centro Internacional de Consultoría y Asesoría", "subtitle": null,
        "content": { "body": "<p>Conectamos conocimiento financiero, legal y asegurador para que tomes mejores decisiones, sin tener que coordinar entre múltiples proveedores.</p>" },
        "links": [{ "type": "outline", "label": "Conoce más", "source_type": "page", "source_slug": "sobre-cica", "href": "/sobre-cica", "target": "_self" }],
        "properties": {
          "text_align": "center", "content_width": "boxed", "padding_y": "lg",
          "show_scroll_indicator": true, "show_link": true, "link_radius": "lg", "link_size": "lg",
          "background_color": null, "text_color": null,
          "decorator_top": "none", "decorator_top_color": null, "decorator_top_opacity": 100,
          "decorator_bottom": "none", "decorator_bottom_color": null, "decorator_bottom_opacity": 100
        },
        "sort_order": 1
      },
      {
        "uuid": "0199a1c4-...", "type": "cta", "pretitle": null, "title": "¿Listo para transformar tu negocio?", "subtitle": "Conversemos y descubre cómo podemos ayudarte",
        "content": { "body": "Agendá una primera conversación sin costo con nuestro equipo de asesores." },
        "links": [{ "type": "primary", "label": "Empezar a planificar", "source_type": "page", "source_slug": "contacto", "href": "/contacto", "target": "_self" }],
        "properties": {}, "sort_order": 6
      }
    ]
  }
}
```

Notar: `content.slider_slug` (no `slider_id`), `links[].source_slug`/`links[].href` (no `source_id`), `properties`/`content` vacíos siempre como `{}`. **Nunca hay ids internos en la response** — todo `*_id` viene resuelto a datos públicos:

| Bloque | Campo público resuelto |
|---|---|
| `hero` (modo `slider`) | `content.slider_slug` |
| `hero` (modo `manual`) | `content.background_image` / `_tablet` / `_mobile` (objeto Media o `null`) |
| `heading` | `content.image_desktop` / `_tablet` / `_mobile` (objeto Media o `null`) |
| `image`, `split` | `content.media` (objeto Media o `null`) |
| `features` | `content.items[].image` (objeto Media o `null`) |
| `testimonials` | `content.items[].avatar` (objeto Media o `null`) — ver nota abajo, `items[]` ya no viene del formulario del bloque |
| `logos` | `content.items[].media` (objeto Media o `null`) |
| `services_grid` | `content.items[].image` (objeto Media o `null`) — ver nota abajo, `items[]` ya no viene del formulario del bloque (ADR-049) |
| `testimonials_grid` | `content.items[].avatar` (objeto Media o `null`) — ver nota abajo, mismo dataset que `testimonials`, distinto orden (ADR-050) |

Objeto Media: `{ "uuid", "url", "alt_text", "mime_type" }` — `null` si todavía no hay archivo cargado (el backend no tiene R2 integrado aún, ver `../CURRENT_STATE.md`).

`properties` de un bloque `rich_text` (agregado 2026-08-31, todos opcionales — pueden venir ausentes si nunca se configuraron, tratar como sus defaults):

- `background_color`: color de fondo de la sección. `null`/ausente = transparente (hereda el fondo de la página).
- `text_color`: color del texto. `null`/ausente = el color de texto por defecto del sitio.
- `text_align`: `left` | `center` | `right`. `null`/ausente = tratar como `left`.
- `content_width`: `full` | `boxed` | `narrow`. `null`/ausente = tratar como `boxed`. Estándar de 2 niveles definido por el Tech Lead (2026-08-31) — la sección en sí siempre es fullwidth, esto solo afecta el "cajón" interno: `boxed` = contenedor 1280px + contenido 960px (responsive: 1100px desde el breakpoint `3xl`/1536px del proyecto — pantallas grandes de verdad); `full` = contenedor fullwidth con 80px de padding horizontal + contenido fullwidth (llena el contenedor); `narrow` = mismo contenedor de 1280px que `boxed`, contenido angostado a 720px (columna de lectura estándar). El front (`RichText.astro`) implementa esto con 2 divs anidados, no uno solo.
- `padding_y`: `sm` | `md` | `lg` | `xl` — espaciado vertical de la sección. `null`/ausente = tratar como `md`.
- `show_scroll_indicator`: booleano. Si es `true`, mostrar un ícono de flecha hacia abajo centrado al pie de la sección (invita a seguir bajando). Default `false`.
- `show_link`: booleano. Gate de visibilidad del único link en `links[0]` — si es `false`, **no renderizar el botón aunque `links` tenga datos** (permite al editor de contenido ocultarlo sin perder lo cargado). Default `false`.
- `link_radius`: `xs` | `sm` | `md` | `lg` | `xl` | `full` — borde del botón. Valores 1:1 con la escala real de `border-radius` de Tailwind v4 (`rounded-xs`…`rounded-xl`, más `rounded-full` para pill completo). `null`/ausente = tratar como `lg`.
- `link_size`: `sm` | `md` | `lg` — tamaño del botón (alto/padding/tipografía/ícono escalan juntos). `null`/ausente = tratar como `lg`.
- `decorator_top` / `decorator_bottom`: `none` | `wave` | `zigzag` | `curve` | `diagonal` | `triangle` — mismo sistema de shapes SVG que las slides del Hero (ver `GET /sliders/{slug}` más abajo), aplicado al borde superior/inferior de la sección.
- `decorator_top_color` / `decorator_bottom_color`: hex/rgba del decorador correspondiente.
- `decorator_top_opacity` / `decorator_bottom_opacity`: `0`–`100`. `100` = color sólido. Por debajo de `100`, renderizar como gradiente (transparente en el borde exterior → color elegido hacia el centro de la sección), nunca como alfa plano sobre un color sólido — mismo criterio que `decorator_bottom_opacity` de Slide.

`links[0]` de un bloque `rich_text` (cuando `show_link` es `true`): mismo shape `ContentLink` que el resto de los bloques (`type`, `label`, `source_type`, `source_slug`, `href`, `target`) — un único elemento, no un array pensado para múltiples botones. Si `show_link` es `false` u omitido, ignorar `links` aunque venga con datos.

`content`/`properties`/`links` de un bloque `split` (implementado 2026-08-31 — antes stub):

- `content.media`: objeto Media o `null` (ver tabla de arriba).
- `content.media_position`: `left` | `right` — de qué lado va la imagen en desktop (`md:` en adelante). En mobile la imagen siempre va primero en el orden natural del DOM, sin importar este valor. Vive en `content`, no en `properties` — es estructural (decide el layout), no un estilo opcional (en Studio el campo se renderiza dentro de "Personalización de estilos" por UX, pero el dato sigue siendo `content.media_position`).
- `content.body`: HTML del cuerpo (RichEditor), puede incluir listas (`<ul>`/`<li>`) y énfasis (`<strong>`/`<em>`).
- `properties.background_color` / `text_color` / `padding_y`: mismo significado que en `rich_text` (ver arriba). `split` NO tiene `text_align`/`decorator_*`/`show_scroll_indicator` — su layout es siempre el grid de 2 columnas.
- `properties.content_width`: `full` | `boxed` | `narrow` — a diferencia de `rich_text` (contenedor `full` simétrico, 80px de padding en ambos lados), en `split` la variante `full` es **asimétrica**: la imagen llega hasta el borde real del viewport (bleed, cero padding de ese lado) y la columna de texto conserva el padding de 80px solo del lado que da al borde exterior (el lado que da al gap entre columnas no necesita nada extra). `boxed`/`narrow` son simétricos, mismo criterio que `rich_text`. `null`/ausente = tratar como `boxed`.
- `links`: array completo (no un único link como `rich_text` — puede traer más de un botón), mismo shape `ContentLink`, se renderizan todos en fila.
- `properties.media_*` (2026-08-31): filtros/efectos aplicados a `content.media` — mismo set que `slide_background_*` de Slide (ver `GET /sliders/{slug}` más abajo), pero genérico (sin el prefijo "slide") porque acá vive en un bloque de contenido normal:
  - `media_blend_mode`: `normal` | `multiply` | `screen` | `overlay` | `darken` | `lighten` | ... (enum `BlendModeEnum` del backend) — CSS `mix-blend-mode`. `null`/ausente = `normal`.
  - `media_brightness`: `0`–`200` (%). `100` = brillo normal.
  - `media_opacity`: `0`–`100`. `100` = opaco.
  - `media_radius`: `none` | `sm` | `md` | `lg` | `xl` | `full` — borde de la imagen, misma escala que `link_radius`. `null`/ausente = `none` (sin redondear).
  - `media_filter_saturate` (`0`–`200`, %), `media_filter_grayscale` (`0`–`100`, %), `media_filter_sepia` (`0`–`100`, %), `media_filter_contrast` (`0`–`200`, %), `media_filter_hue_rotate` (`0`–`360`, grados), `media_filter_blur` (`0`–`20`, px) — filtros CSS aplicados sobre `content.media`, combinables entre sí en un único `filter: ...;`.

`content`/`properties`/`links` de un bloque `testimonials` (rediseñado 2026-08-31 — antes el bloque traía `content.items` cargado directo en el formulario, tipo `Repeater`; ahora los testimonios se gestionan en un módulo propio del backend, `content.items[]` sigue llegando con la MISMA forma de siempre, solo que resuelto en runtime):

- `content.items[]`: array de testimonios ya filtrados/ordenados por el backend según la configuración interna del bloque (`limit`/`order`, **nunca expuestos en la response pública** — son config editorial, no dato de salida). Cada item: `{ "name", "role", "quote", "avatar" }` — `role` puede ser `null` (opcional), `avatar` es un objeto Media o `null` (ver tabla de arriba). Solo se incluyen testimonios marcados como visibles del lado del backend (equivalente a `is_visible = true` en su módulo de gestión) — si un bloque no trae ningún testimonio visible, `content.items` llega como array vacío `[]`, nunca `null`.
- `properties.background_color` / `text_color` / `padding_y`: mismo significado que en `rich_text`/`split` (ver arriba).
- `properties.show_link`: booleano, mismo gate explícito que `rich_text` — si es `false`, no renderizar el botón aunque `links` tenga datos. Default `false`.
- `links[0]` (cuando `show_link` es `true`): un único `ContentLink` (mismo shape que el resto de los bloques), pensado como "ver más casos de éxito" hacia una página con el listado completo — no un array de múltiples botones.

`content`/`properties`/`links` de un bloque `services_grid` (rediseñado 2026-09-10, ver ADR-049 — mismo movimiento exacto que `testimonials`: antes el bloque traía `content.items` cargado directo en el formulario, tipo `Repeater`, con `image_id`/`page_id` manuales; ahora los servicios se gestionan en su propio módulo del backend, tabla `services`, resuelto en runtime):

- `content.items[]`: array de servicios ya filtrados/ordenados por el backend según la configuración interna del bloque (`limit`/`order`, **nunca expuestos en la response pública** — son config editorial, no dato de salida). Cada item tiene la MISMA forma que un item de `GET /services` (ver más abajo) más `href`: `{ "uuid", "slug", "href", "pretitle", "title", "subtitle", "countries", "image" }` — `pretitle` puede ser `null` (opcional), `countries` es un array (puede ser `[]` si el servicio no tiene país asociado — "Regional/Global"), `image` es un objeto Media o `null` (ver tabla de arriba), `href` ya viene armado (`/servicios/{slug}`, no hay que construirlo del lado del front). Solo se incluyen servicios publicados (equivalente a `status: published` en su módulo de gestión) — si un bloque no trae ningún servicio publicado, `content.items` llega como array vacío `[]`, nunca `null`. A diferencia de `testimonials` (que ordena por fecha de creación), el orden `asc`/`desc` de este bloque es sobre `sort_order` — el mismo orden manual curado en el módulo "Servicios" del admin, no una noción de "más reciente".
- `properties.background_color` / `text_color` / `padding_y`: mismo significado que en `rich_text`/`testimonials` (ver arriba).
- `properties.show_link`: booleano, mismo gate explícito que `rich_text`/`testimonials` — si es `false`, no renderizar el botón aunque `links` tenga datos. Default `false`.
- `links[0]` (cuando `show_link` es `true`): un único `ContentLink` (mismo shape que el resto de los bloques), pensado como "ver todos los servicios" hacia la página `/servicios` — normalmente sin uso en la página `/servicios` misma (que muestra el catálogo completo y pagina con su propio botón "Ver más servicios" client-side), sí útil para un teaser en otra página (ej. Home).
- El catálogo completo de la página `/servicios` se sirve con `content.limit: null` (todos los servicios publicados, sin recortar) — la paginación "de 9 en 9" del mockup se implementa 100% client-side en `ServicesGrid.astro` (sin fetch adicional al API), sobre el array `content.items[]` completo ya horneado en el HTML estático en build time.

`content`/`properties`/`links` de un bloque `testimonials_grid` (nuevo 2026-09-11, ver ADR-050 — mismo movimiento exacto que `services_grid`/ADR-049, pero para "Casos de éxito": el bloque `testimonials` original queda como TEASER/preview, `testimonials_grid` es el catálogo completo tipo grilla, sin carousel):

- `content.items[]`: array de testimonios ya filtrados/ordenados por el backend según la configuración interna del bloque (`limit`/`order`, **nunca expuestos en la response pública**). Cada item: `{ "uuid", "name", "role", "quote", "avatar" }` — `role` puede ser `null` (opcional), `avatar` es un objeto Media o `null` (ver tabla de arriba). A diferencia de `content.items[]` de `testimonials` (sin `uuid`), este SÍ trae `uuid` (útil como key estable en el frontend) pero, a diferencia de `services_grid`, NO trae `slug`/`href` — un testimonio no tiene página de detalle propia. Solo se incluyen testimonios marcados como visibles (mismo criterio que `testimonials`) — si un bloque no trae ninguno, `content.items` llega como array vacío `[]`, nunca `null`. El orden `asc`/`desc` de este bloque es sobre `sort_order` (curaduría manual, mismo criterio que `services_grid`) — NO sobre fecha de creación como el bloque `testimonials` original.
- `properties.background_color` / `text_color` / `padding_y`: mismo significado que en `rich_text`/`testimonials`/`services_grid` (ver arriba).
- `properties.show_link`: booleano, mismo gate explícito que el resto de los bloques con enlace opcional. Default `false`.
- `links[0]` (cuando `show_link` es `true`): un único `ContentLink`, pensado como "ver todos los casos de éxito" hacia la página `/casos-de-exito` — normalmente sin uso en esa misma página (que muestra el catálogo completo y pagina con su propio botón "Más casos" client-side), sí útil para un teaser en otra página.
- El catálogo completo de la página `/casos-de-exito` se sirve con `content.limit: null` (todos los testimonios visibles, sin recortar) — la paginación "de 6 en 6" se implementa 100% client-side en `TestimonialsGrid.astro` (sin fetch adicional al API), mismo mecanismo exacto que `ServicesGrid.astro`.

**Tipos de bloque a implementar componente**: `hero`, `rich_text`, `image`, `cta`, `features`, `faq`, `contact_form`, `legal_notice`, `heading`, `split`, `testimonials`, `logos`, `services_grid`, `testimonials_grid`. **Ignorar tipos desconocidos sin romper la página** — la lista puede crecer del lado del backend sin que este front se entere de antemano.

### `GET /posts`

Lista posts publicados, paginada, orden `published_at desc`.

- **Abilities**: `content:read`
- **Query params**: `per_page`

```json
{
  "success": true, "status_code": 200,
  "data": [
    { "uuid": "0199a2f1-...", "slug": "como-elegir-seguro-de-vida", "pretitle": null, "title": "Cómo elegir un seguro de vida sin pagar de más", "subtitle": "...", "excerpt": "...", "published_at": "2026-08-13T00:00:00.000000Z", "featured_image": null }
  ],
  "meta": { "current_page": 1, "per_page": 15, "total": 3, "last_page": 1 },
  "links": { "first": "...", "prev": null, "next": null, "last": "..." }
}
```

### `GET /posts/{slug}`

Detalle completo de un post.

- **Abilities**: `content:read`
- **Response `404`** si no existe o no está publicado.

```json
{
  "success": true, "status_code": 200,
  "data": {
    "uuid": "0199a2f1-...", "slug": "como-elegir-seguro-de-vida", "pretitle": null,
    "title": "Cómo elegir un seguro de vida sin pagar de más", "subtitle": "...", "excerpt": "...",
    "content": "<p>Elegir un seguro de vida no debería ser un salto de fe...</p>",
    "meta": { "seo_title": "...", "seo_description": "..." },
    "links": [], "properties": {},
    "published_at": "2026-08-13T00:00:00.000000Z", "featured_image": null
  }
}
```

`content` acá es HTML ya renderizado (no bloques) — se inyecta directo en el layout de post.

### `GET /services` (agregado 2026-09-02)

Lista servicios publicados, paginada, orden `sort_order`. Mismo patrón exacto que `GET /posts`. El listado `/servicios` del sitio NO consume este endpoint — lo sirve una `Page` normal (tipo estándar) con un bloque `services_grid`, vía `GET /pages/servicios`; este endpoint solo lo usa `getStaticPaths` de la página de detalle (`/servicios/{slug}`).

- **Abilities**: `content:read`
- **Query params**: `per_page`

```json
{
  "success": true, "status_code": 200,
  "data": [
    {
      "uuid": "0199b1a1-...", "slug": "seguros-de-vida", "pretitle": null,
      "title": "Seguros de vida", "subtitle": "...",
      "countries": [{ "iso": "UY", "name": "Uruguay" }],
      "image": null
    }
  ],
  "meta": { "current_page": 1, "per_page": 15, "total": 12, "last_page": 1 },
  "links": { "first": "...", "prev": null, "next": null, "last": "..." }
}
```

### `GET /services/{slug}` (agregado 2026-09-02)

Detalle completo de un servicio.

- **Abilities**: `content:read`
- **Response `404`** si no existe o no está publicado.

```json
{
  "success": true, "status_code": 200,
  "data": {
    "uuid": "0199b1a1-...", "slug": "seguros-de-vida", "pretitle": null,
    "title": "Seguros de vida", "subtitle": "...",
    "countries": [{ "iso": "UY", "name": "Uruguay" }],
    "content": {
      "intro": "...",
      "offers": [{ "highlight": "...", "text": "..." }],
      "coverages": [{ "label": "...", "intro": "...", "items": ["..."] }],
      "why_choose_us": { "title": "...", "text": "<p>HTML ya renderizado...</p>" },
      "tip": { "title": "...", "text": "..." }
    },
    "meta": { "seo_title": "...", "seo_description": "..." },
    "links": [], "properties": {},
    "published_at": "2026-08-13T00:00:00.000000Z", "image": null, "image_detail": null
  }
}
```

`content` acá SÍ es un objeto estructurado (no HTML renderizado en bloque como en `posts`) — `intro`/`offers`/`coverages`/`why_choose_us`/`tip` son todos opcionales, puede llegar `{}` si el servicio no cargó ese contenido en Studio. `why_choose_us`/`tip` son objetos `{ title, text }`, no strings. Consumido en `src/pages/servicios/[slug].astro`.

**`image_detail` (2026-09-14, solo acá — `GET /services/{slug}` — NO en `GET /services`):** imagen secundaria/opcional, más panorámica/apaisada, para el header del detalle. `image` (principal, presente en ambos endpoints) sigue siendo la miniatura del catálogo (`ServicesGrid.astro`). Fallback "si `image_detail` es `null`, usar `image`" resuelto en `[slug].astro` (`const headerImage = service.image_detail ?? service.image`), NO en el API. Tipado en `src/lib/types.ts`: `Service.image_detail: Media | null` (no existe en `ServiceSummary`).

**Excepción (2026-09-14):** `why_choose_us.text` SÍ es HTML ya renderizado y sanitizado (campo `RichEditor` en Studio, permite negrita/enlaces a mitad de frase) — se inyecta con `set:html` en `[slug].astro`, NO se interpola con `{}` (ver `ServiceContent` en `src/lib/types.ts`). El resto de campos de texto (`intro`, `offers[].text`, `coverages[].items[]`, `tip.text`) siguen siendo texto plano y se interpolan normal.

### `GET /testimonials` (agregado 2026-09-02, no consumido por este repo todavía)

Catálogo standalone de testimonios visibles, paginado, orden `sort_order`. Sin `GET /testimonials/{algo}` — el modelo no tiene `slug`, siempre se consume como colección completa. **Este repo no llama a este endpoint** — los testimonios que se muestran en el sitio (bloque `testimonials` de una Página) siguen llegando embebidos dentro de `content.items[]` de `GET /pages/{slug}` (ver la sección de bloques más arriba), que ya trae el mismo shape resuelto. Este endpoint queda disponible del lado del backend por si en el futuro hace falta una sección "Casos de éxito" standalone fuera del contexto de una página — sin caso de uso real hoy.

```json
{
  "success": true, "status_code": 200,
  "data": [
    { "uuid": "0199c2a1-...", "name": "María Fernández", "role": "Clienta desde 2019", "quote": "...", "avatar": null }
  ],
  "meta": { "current_page": 1, "per_page": 15, "total": 6, "last_page": 1 },
  "links": { "first": "...", "prev": null, "next": null, "last": "..." }
}
```

### `GET /menus/{slug}`

Menú con items activos, en **árbol recursivo** — cada item trae su propio `children[]` con el MISMO shape, y cada hijo puede a su vez traer más `children[]`, sin límite de profundidad del lado de la API (`MenuController::buildTree()` en `genesis` arma el árbol completo en memoria de un único query, cero queries extra sin importar la profundidad). Console (`MenuTreeBuilder`, editor drag-and-drop estilo WordPress agregado 2026-09-02, ver `genesis` ADR-045) limita la CREACIÓN a 3 niveles (menú → submenú → sub-submenú), pero el contrato de este endpoint no está atado a ese número — renderizar `items` con una función recursiva (`renderMenuItem(item)` que se vuelve a llamar por cada `item.children`) es más robusto que hardcodear "hasta 2 `<nav>` anidados" en `Header.astro`. Slug real: `menu-principal`.

- **Abilities**: `content:read`
- **Response `404`** si no existe.

```json
{
  "success": true, "status_code": 200,
  "data": {
    "uuid": "0199a3a1-...", "name": "Menú principal", "slug": "menu-principal",
    "items": [
      { "uuid": "0199a3a2-...", "title": "Inicio", "type": "page", "href": "/", "is_home": true, "target": "_self", "sort_order": 0, "children": [] },
      {
        "uuid": "0199a3a3-...", "title": "Servicios", "type": "page", "href": "/servicios", "is_home": false, "target": "_self", "sort_order": 2,
        "children": [
          {
            "uuid": "0199a3a5-...", "title": "Seguros de vida", "type": "service", "href": "/servicios/seguros-de-vida", "is_home": false, "target": "_self", "sort_order": 0,
            "children": [
              { "uuid": "0199a3a6-...", "title": "Cobertura familiar", "type": "external", "href": "https://ejemplo.com/familia", "is_home": false, "target": "_blank", "sort_order": 0, "children": [] }
            ]
          },
          { "uuid": "0199a3a7-...", "title": "Seguros de auto", "type": "service", "href": "/servicios/seguros-de-auto", "is_home": false, "target": "_self", "sort_order": 1, "children": [] }
        ]
      },
      { "uuid": "0199a3a4-...", "title": "Consultar ahora", "type": "page", "href": "/contacto", "is_home": false, "target": "_self", "sort_order": 4, "children": [] }
    ]
  }
}
```

Un item con submenú se identifica simplemente porque `children.length > 0` — no hay ningún campo `has_children`/`depth` separado.

`type` (agregado 2026-09-02): `"page" | "post" | "service" | "external" | "custom"` — `"service"` es nuevo, agregado junto con el endpoint `GET /services`/`/services/{slug}` de arriba, resuelve `href` como `/servicios/{slug}`.

`href` viene resuelto por el backend (`/` para la home, `/{slug}` para pages, `/blog/{slug}` para posts, `/servicios/{slug}` para services, URL cruda para `external`/`custom`) — **no reconstruirlo a mano en el front**.

`is_home` (agregado 2026-08-30): booleano resuelto por el backend desde `Page.is_home` — **siempre `false`** para items `post`/`service`/`external`/`custom`. Úsalo para decidir si un item de menú es "el link a Home" (por ejemplo, para excluirlo del navbar porque el logo ya enlaza a `/`) en vez de comparar `href === '/'` a mano: el item puede tener un título o slug distinto de "home" y seguir apuntando a la página marcada como home.

### `GET /sliders/{slug}`

Slider activo con sus slides activos, ordenados, con media resuelta por breakpoint. Slug real del hero home: `home`.

- **Abilities**: `content:read`
- **Response `404`** si no existe o no está activo.

```json
{
  "success": true, "status_code": 200,
  "data": {
    "uuid": "0199a4b1-...", "title": "Slider principal", "slug": "home",
    "properties": { "show_scroll_indicator": true },
    "slides": [
      {
        "uuid": "0199a4b2-...", "pretitle": null, "title": "El socio que necesitas",
        "subtitle": "Integramos seguros, finanzas y asesoría legal para potenciar tu crecimiento.",
        "background_type": "image",
        "media": { "image_desktop": null, "image_tablet": null, "image_mobile": null, "video_desktop": null, "video_mobile": null },
        "has_presentation_video": false, "presentation_youtube_id": null,
        "links": [{ "type": "primary", "label": "Agendar asesoría", "source_type": "page", "source_slug": "contacto", "href": "/contacto", "target": "_self" }],
        "properties": {
          "position_container": "middle-left",
          "align_content": "left",
          "decorator_bottom": "wave",
          "decorator_bottom_color": "#ffffff",
          "decorator_bottom_opacity": 100,
          "slide_background_color": null,
          "slide_background_brightness": null,
          "slide_background_opacity": 100,
          "slide_background_blend_mode": "normal",
          "slide_background_filter_saturate": 100,
          "slide_background_filter_grayscale": 0,
          "slide_background_filter_sepia": 0,
          "slide_background_filter_contrast": 100,
          "slide_background_filter_hue_rotate": 0,
          "slide_background_filter_blur": 0
        },
        "sort_order": 0
      }
    ]
  }
}
```

`media.*` es `null` explícito cuando no hay archivo cargado; cuando exista, cada campo trae el objeto Media completo.

`description` fue eliminado del modelo de Slide (2026-08-30) — el contenido de un slide es pretitle/title/subtitle únicamente.

`properties` **del Slider** (nivel raíz de `data`, no de cada slide — agregado 2026-08-31, corregido el mismo día tras una primera pasada errónea que lo puso por slide):

- `show_scroll_indicator`: booleano, mismo campo reusado del bloque Texto Enriquecido (`rich_text`, ver más abajo). Si es `true`, el front dibuja una flecha hacia abajo **sobrepuesta al decorador inferior** de la slide que esté visible en cada momento. Se define **una sola vez para todo el Slider**, no por slide — aplica igual a todas las slides detrás. Default `false`. Cuando el Hero está en modo `manual` (sin Slider asociado, ver el bloque `hero` en `GET /pages/{slug}`), el campo equivalente vive en `properties.show_scroll_indicator` del propio bloque en vez de acá.

`properties` de un slide (agregado 2026-08-30, todos opcionales — pueden venir ausentes si nunca se configuraron, tratar como sus defaults):

- `position_container`: una de las 9 posiciones (`{top|middle|bottom}-{left|center|right}`) del contenedor de pretitle/title/subtitle/CTA sobre el slide. Default `bottom-center`. **En mobile el front siempre fuerza `bottom-center`, sin importar este valor.**
- `align_content`: `left` | `center` | `right`, alineación del texto/CTA dentro del contenedor. Default `center`. **En mobile el front siempre fuerza `center`.**
- `decorator_bottom`: `none` | `wave` | `zigzag` | `curve` | `diagonal` | `triangle` — shape SVG sobrepuesto en el borde inferior del slide.
- `decorator_bottom_color`: hex/rgba del decorador.
- `decorator_bottom_opacity`: `0`–`100`. `100` = color sólido. Por debajo de `100` el front lo renderiza como gradiente (transparente arriba → `decorator_bottom_color` abajo), nunca como alfa plano sobre un color sólido.
- `slide_background_color`: color de fondo del slide, detrás de la imagen/video. `null`/ausente = transparente.
- `slide_background_brightness`: `0`–`200` (%). `null`/ausente = sin filtro de brillo aplicado.
- `slide_background_opacity`: `0`–`100` (%) aplicado a la imagen/video de fondo. Default `100`.
- `slide_background_blend_mode`: valor de CSS `mix-blend-mode` (`normal`, `multiply`, `screen`, `overlay`, `darken`, `lighten`, `color-dodge`, `color-burn`, `hard-light`, `soft-light`, `difference`, `exclusion`, `hue`, `saturation`, `color`, `luminosity`). Default `normal`.
- `slide_background_filter_saturate` / `_contrast`: `0`–`200` (%), default `100`.
- `slide_background_filter_grayscale` / `_sepia`: `0`–`100` (%), default `0`.
- `slide_background_filter_hue_rotate`: `0`–`360` (grados), default `0`.
- `slide_background_filter_blur`: `0`–`20` (px), default `0`.

La animación de entrada del contenido (fade del H1 con scale, pretitle deslizando arriba→abajo en paralelo con subtitle abajo→arriba, CTA abajo→arriba al final) es fija en el front para todo el MVP — no es configurable vía `properties`.

### `GET /media/{uuid}`

Un archivo de media por `uuid` — normalmente no hace falta llamarlo directo, porque los bloques ya traen los objetos Media resueltos inline.

- **Abilities**: `content:read`

```json
{ "success": true, "status_code": 200, "data": { "uuid": "0199a5c1-...", "url": "https://cdn.stamless.host/cica360/logo.png", "alt_text": "Logo de CICA360", "mime_type": "image/png" } }
```

### `POST /forms/{slug}/submit`

Envía el formulario de contacto. Slug real: `contacto`. **Único endpoint que se llama en runtime, no en build time** — ver `../ARCHITECTURE.md` §3 para la estrategia de proxy.

- **Abilities**: `forms:submit`
- **Rate limit**: 10/min por IP (además del general de 60/min)

**Request**:

```json
{
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "phone": "099123456",
  "message": "Quiero más información sobre seguros de vida."
}
```

**Response `201`**:

```json
{ "success": true, "message": "Formulario enviado correctamente.", "status_code": 201, "data": { "uuid": "0199a6d1-..." } }
```

**Response `422`** (campo requerido faltante):

```json
{ "success": false, "message": "Revisá los datos enviados.", "status_code": 422, "errors": { "code": "validation", "fields": { "message": ["El campo message es obligatorio."] } } }
```

El componente `contact_form` (Antigravity) debe mostrar `errors.fields.{campo}` inline si vienen, y el `message` genérico si no hay desglose por campo.

---

## Buenas prácticas para este proyecto

- Los fetches de lectura (`pages`, `posts`, `menus`, `sliders`, `media`) ocurren **solo en build time**, dentro de `src/lib/api.ts` llamado desde `getStaticPaths`/frontmatter de Astro — nunca desde un componente que se hidrata en el cliente.
- El único fetch en runtime es el submit del formulario, y va contra el proxy PHP (o el token acotado del fallback), nunca directo con el token de `content:read`.
- Cachear el resultado del build normalmente no hace falta manejarlo a mano — es responsabilidad de Astro/el pipeline de CI, no de `api.ts`.
- Los `links[]` y `href` siempre vienen resueltos por el backend — no reconstruir rutas a partir de `source_slug` salvo necesidad real de lógica de ruteo del front.
- Manejar los 6 `errors.code` de la tabla de arriba en un único lugar de `api.ts` (no repetir el `switch` en cada página/componente).

## Limitaciones actuales (heredadas del backend, ver también su propio `docs/api/v1.md`)

- No hay rotación automática de tokens ni notificación antes de que expiren — un `401` con `errors.code: token_invalid` en build time significa que hay que regenerar el token de build en Console y actualizar el secret de CI.
- Los campos `image`/`avatar`/`media`/`background_image*` devuelven `null` hasta que el backend tenga media real cargada (R2 todavía pendiente de integrar del lado del backend).
- No hay honeypot/recaptcha aplicado del lado del backend todavía — compensar con un honeypot simple del lado de este front (ver `../ARCHITECTURE.md` §8).
