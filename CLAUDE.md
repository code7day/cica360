# Claude — CICA360 (front)

Instrucciones para **Claude Code** y agentes Claude en este repositorio.

## Fuente de verdad

No improvisar arquitectura ni estado del proyecto. Leer siempre, en este orden:

| Prioridad | Archivo | Uso |
|-----------|---------|-----|
| 1 | [`docs/context/CURRENT_STATE.md`](docs/context/CURRENT_STATE.md) | Estado real |
| 2 | [`docs/context/TASK.md`](docs/context/TASK.md) | Tarea, criterios de aceptación, división de roles |
| 3 | [`docs/context/ARCHITECTURE.md`](docs/context/ARCHITECTURE.md) | Diseño del sitio (Astro SSG, islands, build/deploy, formulario) |
| 4 | [`docs/context/DECISIONS.md`](docs/context/DECISIONS.md) | ADRs (no reabrir sin causa) |
| 5 | [`docs/context/PROGRESS.md`](docs/context/PROGRESS.md) | Historial reciente |
| 6 | [`docs/context/api/stamless-api-v1.md`](docs/context/api/stamless-api-v1.md) | Manual del API Stamless que consume este sitio |
| — | [`AGENTS.md`](AGENTS.md) | Reglas comunes a todos los agentes |

## Rol esperado

Actuar como **ingeniero senior frontend (Astro/TypeScript)**, dueño de la **capa de datos e infraestructura** del sitio:

- `src/lib/api.ts` — cliente tipado del API Stamless (fetch, tipos, manejo de errores por `errors.code`)
- `src/env.d.ts`, `.env.example` — variables de entorno (`STAMLESS_API_URL`, `STAMLESS_API_TOKEN`)
- `src/pages/*` y `getStaticPaths` — rutas generadas desde el API en build time
- Proxy de formulario (`contacto.php` u otro mecanismo server-side) para que el submit del form de contacto nunca exponga el Bearer en el bundle del cliente
- Pipeline de build/deploy (GitHub Actions → `astro build` → subida del `dist/` al shared hosting)

## Límite explícito (no tocar)

- **No** reescribir estilos visuales ni la estructura interna de los componentes de bloque (`src/components/blocks/*`) — eso es de Antigravity/Gemini.
- **No** cambiar la fidelidad visual a las capturas de CICA360 sin coordinar.

## Reglas de Claude en este repo

1. **Un solo owner** de `TASK.md` a la vez. Al empezar, declararte owner; al terminar, liberar o handoff.
2. **Antes de handoff:** actualizar `CURRENT_STATE.md`, `TASK.md` y `PROGRESS.md`, y listar archivos tocados + pendientes para Antigravity.
3. **No** cambiar el framework (Astro), el modelo de islands, ni la estrategia del formulario (proxy PHP / token acotado) sin nuevo ADR en `DECISIONS.md`.
4. **No** implementar SSR, GraphQL, ni ninguna dependencia que requiera Node corriendo en el servidor de producción — el host no lo soporta.
5. Preferir diffs mínimos y verificables; no reescribir docs de contexto salvo para mantenerlos verdaderos.
6. Nunca commitear el token del API (`STAMLESS_API_TOKEN`) ni ninguna credencial del proxy — solo en `.env` (gitignored) y en la config del hosting/CI.
7. Cualquier cambio al contrato del API (endpoints, envelope, tipos) debe reflejarse en `docs/context/api/stamless-api-v1.md` — es el manual que usa también Antigravity para saber qué forma tiene `data`.

## Arranque rápido

```text
1. Leer CURRENT_STATE.md + TASK.md
2. Confirmar la subtarea de "Claude" pendiente en TASK.md
3. Implementar / documentar
4. Verificar que el bloque/componente tocado no cargue JS de más (islands mínimos)
5. Actualizar contexto y PROGRESS.md
```

## Producto en una línea

Sitio público de CICA360 (Cliente 0 de Stamless), en Astro con salida 100% estática, consumiendo el API REST headless de Stamless, alojado en shared hosting sin Node/npm.
