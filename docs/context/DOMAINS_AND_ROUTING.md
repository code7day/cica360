# Convenio de Dominios, Ruteo y Seguridad (Stamless Ecosistema)

Este documento centraliza el estándar de dominios, subdominios, convenciones de rutas y seguridad del monolito Stamless CMS. Debe ser respetado por cualquier agente de desarrollo o arquitectura de software tanto en el backend como en los frontends.

---

## 1. Mapeo de Dominios (Ecosistema)

El monolito de Stamless responde de manera dinámica en función del Host de la petición entrante. El mapeo en entornos locales y de producción es:

| Rol de Dominio | Host Local (MAMP / `/etc/hosts`) | Host Producción (ADR-022) |
| :--- | :--- | :--- |
| **Landing & Teaser** | `stamless.host` | `stamless.io` |
| **Console (Tenants / Filament)** | `console.stamless.host` | `studio.stamless.io` |
| **API Pública (REST/GraphQL)** | `api.stamless.host` | `api.stamless.io` |
| **Manager (Plataforma / Filament)** | `manager.stamless.host` | `manager.stamless.io` |

---

## 2. Convenciones de Ruteo de API y Prefijos

*   **API REST**:
    *   Cargada desde `routes/api.php` **sin el prefijo redundante `/api`** (`apiPrefix: ''` en `bootstrap/app.php`).
    *   **Formato de ruta**: `https://api.stamless.host/v1/{tenant_slug}/...` (ej. local: `https://api.stamless.host/v1/cica360/pages`).
    *   Todas las rutas están aisladas para resolver únicamente si el host de la petición coincide con el de la API (`Route::domain(...)` en Laravel).
*   **API GraphQL (Futuro)**:
    *   Se servirá en producción bajo el subdominio dedicado **`graphql.stamless.io`** (en local `graphql.stamless.host`).
    *   **Formato de ruta**: `https://graphql.stamless.host/v1/{tenant_slug}`.
    *   Se prefiere el nombre de subdominio largo (`graphql.`) por sobre el corto (`gql.`) para mantener coherencia, formalidad y claridad ante integradores externos.
*   **Health Check (Uptime y Ping-pong)**:
    *   Ubicado en `https://api.stamless.host/v1/health`.
    *   Es de acceso público y comprueba la conectividad activa con PostgreSQL, retornando `200 OK` con un timestamp o `503 Service Unavailable` si hay fallas en la base de datos.

---

## 3. Seguridad por Oscuridad (Silencio en Red)

Para evitar la detección automática del framework Laravel y proteger endpoints inactivos:
1.  **Raíz del Subdominio de API (`api.stamless.host/`)**:
    *   Retorna una respuesta `404 Not Found` completamente vacía y silenciosa (`0 bytes`), sin cabeceras delatadoras ni HTML.
2.  **Bloqueo de Rutas `/api` y `/graphql` en Landing (`stamless.host`)**:
    *   Cualquier petición que empiece con `/api/*` o `/graphql/*` en el dominio de la landing page responde de manera directa con un `404` vacío, sin realizar redirecciones.
3.  **Bloqueo de Rutas `/graphql` en API (`api.stamless.host`)**:
    *   Cualquier petición que apunte a `api.stamless.host/graphql/*` es interceptada por una regla prioritaria y devuelve un `404` vacío en lugar del JSON de error estructurado habitual del backend.

---

## 4. Configuración de Seguridad en Ecosistema

*   **CORS (`config/cors.php` del backend)**:
    *   Solo acepta peticiones de `stamless.host` y sus respectivos subdominios de inquilinos, validados dinámicamente mediante la siguiente regex:
        `'#^https?://([^/]+\\.)?stamless\\.host$#'`.
*   **Laravel Sanctum (Autenticación por Cookies)**:
    *   Los dominios configurados en `SANCTUM_STATEFUL_DOMAINS` son `stamless.host`, `console.stamless.host` y `manager.stamless.host`.
*   **Mapeo de Excepciones del Backend**:
    *   Toda excepción en el subdominio de API retorna un JSON formateado por `App\Support\Api\ErrorEnvelope` con la taxonomía: `unauthenticated`, `token_invalid`, `forbidden`, `not_found`, `validation`, `too_many_requests` y `server_error`.
