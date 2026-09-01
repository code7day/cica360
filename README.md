# CICA360 — Sitio público (front)

Sitio público de **CICA360** (consultora de seguros y temas jurídicos, Cliente 0 de Stamless), construido en **Astro** (SSG + islands) con TypeScript y Tailwind v4, pensado para desplegarse en **shared hosting sin Node/npm**.

Consume el API REST headless de Stamless (`api.stamless.io/v1/cica360/...`) — manual completo en [`docs/context/api/stamless-api-v1.md`](docs/context/api/stamless-api-v1.md).

## Antes de tocar código

Leer, en este orden: [`AGENTS.md`](AGENTS.md) → [`docs/context/CURRENT_STATE.md`](docs/context/CURRENT_STATE.md) → [`docs/context/TASK.md`](docs/context/TASK.md) → [`docs/context/ARCHITECTURE.md`](docs/context/ARCHITECTURE.md) → [`docs/context/DECISIONS.md`](docs/context/DECISIONS.md) → [`docs/context/api/stamless-api-v1.md`](docs/context/api/stamless-api-v1.md).

## Setup local

```bash
npm install
cp .env.example .env
# completar STAMLESS_API_TOKEN (Console -> Desarrolladores -> API Tokens, ability content:read)

npm run dev       # http://localhost:4321
```

Si `STAMLESS_API_URL` apunta a un dominio local con certificado autofirmado (por ejemplo `api.stamless.host` en MAMP PRO), ver la sección **TLS local con mkcert** más abajo antes de correr `npm run build` — sin eso, `astro build` va a fallar al generar las rutas estáticas con `unable to verify the first certificate`.

## TLS local con mkcert

`npm run build` ejecuta `getStaticPaths()` en Node, que hace `fetch()` real contra `STAMLESS_API_URL` durante el build. Si esa URL es un dominio local (`.host`) servido con el certificado autofirmado que genera MAMP PRO/Valet/Herd por default, Node lo rechaza (correcto: no es un certificado confiable) y el build falla.

La solución correcta **no** es desactivar la verificación TLS — es generar un certificado local que sí sea confiable, con [mkcert](https://github.com/FiloSottile/mkcert):

```bash
brew install mkcert nss   # nss solo hace falta para que confíe también Firefox
mkcert -install           # instala una CA local en el sistema (y en los navegadores)
mkcert api.stamless.host # genera api.stamless.host.pem + api.stamless.host-key.pem
```

Después, en MAMP PRO: entrar a la configuración del host (`api.stamless.host`) → pestaña SSL → cargar esos dos archivos como certificado y llave personalizados, en vez del autofirmado por default. Reiniciar Apache.

Con eso, tanto `npm run build` como abrir `https://api.stamless.host` directo en cualquier navegador quedan sin ninguna advertencia — es una CA real para tu máquina, no un bypass.

Si por algún motivo no podés instalar mkcert en esa máquina, existe un último recurso: `STAMLESS_DEV_INSECURE_TLS=true` en `.env` (ver `.env.example`). Desactiva la verificación TLS del build entero mientras esté seteado — usarlo solo temporalmente, nunca en CI ni en ningún entorno que toque producción.

**Nota sobre producción**: esto es exclusivamente un tema de build local. El sitio publicado nunca hace `fetch()` desde el navegador contra el API de Stamless — el único request de cliente es `submitContactForm()` contra `/contacto.php`, mismo origen (ver ADR-002) — así que no hay CORS ni mixed content posibles ahí, con o sin mkcert.

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo con hot reload |
| `npm run build` | `astro check` (typecheck) + `astro build` → genera `dist/` |
| `npm run preview` | Sirve `dist/` localmente para verificar el build de producción |
| `npm run format` | Formatea todo el repo con Prettier (incluye `.astro`, Tailwind class sorting) |

## Stack

- [Astro](https://astro.build) ^7.2 — SSG, islands architecture (salida `output: 'static'`, sin servidor Node en producción)
- TypeScript (`astro/tsconfigs/strict`)
- Tailwind CSS v4 (`@tailwindcss/vite`, config CSS-first en `src/styles/global.css`)
- React ^19 — únicamente para las islas interactivas (`src/components/islands/`), vía `@astrojs/react`
- `@astrojs/sitemap` — sitemap.xml automático

Decisiones documentadas en `docs/context/DECISIONS.md` (ADR-001, ADR-002).

## Estructura

```
src/
├── lib/            # api.ts (cliente del API Stamless), types.ts, errors.ts — Claude
├── layouts/         # BaseLayout.astro
├── components/
│   ├── blocks/       # Un componente por block.type (hero, rich_text, ...) — Antigravity
│   ├── islands/      # Componentes React hidratados (ContactForm.tsx) — Antigravity (UI) + Claude (lógica)
│   ├── Header.astro
│   └── Footer.astro
└── pages/
    ├── index.astro          # Home (resuelta por is_home=true)
    ├── [slug].astro         # Páginas interiores (getStaticPaths desde GET /pages)
    ├── blog/index.astro
    ├── blog/[slug].astro
    └── 404.astro

public/
├── contacto.php                    # Proxy PHP del formulario (ver ADR-002) — committed, sin secretos
├── contacto.config.example.php     # Plantilla — copiar a contacto.config.php en el servidor (NO commitear)
├── .htaccess                        # Headers de seguridad + cache (Apache)
└── robots.txt
```

## Formulario de contacto

Por defecto usa un proxy PHP (`public/contacto.php`) para nunca exponer el Bearer token en el cliente — ver `docs/context/DECISIONS.md` ADR-002 y `docs/context/ARCHITECTURE.md` §3. En el servidor de producción hay que:

1. Copiar `public/contacto.config.example.php` a `contacto.config.php` (mismo directorio, directo en el servidor — nunca por git).
2. Completar `STAMLESS_FORMS_TOKEN` con un token de Console que tenga **únicamente** la ability `forms:submit`.

Si el hosting final no soporta PHP, usar el fallback de token acotado documentado en el mismo ADR-002 (`PUBLIC_STAMLESS_FORMS_TOKEN` en `.env`).

## Deploy

Sin Node en el servidor de producción: el build corre en CI (`.github/workflows/build-and-deploy.yml`) o local, y solo se sube `dist/` (+ `contacto.php`, que ya queda copiado ahí por vivir en `public/`) al shared hosting por FTP/SFTP. El paso de deploy del workflow está comentado hasta confirmar las credenciales reales del hosting (ver `docs/context/CURRENT_STATE.md`, bloqueadores).
