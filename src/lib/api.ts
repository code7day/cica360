import { ApiError, ApiNetworkError } from './errors';
import type {
  ApiEnvelope,
  ContactFormPayload,
  ContactFormSuccessData,
  FormData,
  Media,
  Menu,
  Page,
  PageSummary,
  Paginated,
  Post,
  PostSummary,
  Service,
  ServiceSummary,
  SiteTracking,
  Slider,
} from './types';
/**
 * Cliente del API Stamless — SOLO para uso en build time (frontmatter de
 * `.astro`, `getStaticPaths`). Usa `STAMLESS_API_TOKEN` (ability
 * `content:read`), que NUNCA debe llegar al bundle del cliente.
 *
 * NO importar este archivo desde un componente/isla que se hidrata en el
 * navegador (`client:*`) — para eso existe `submitContactForm()` más abajo,
 * que pega contra el proxy público, no contra el API con el token secreto.
 *
 * Ver el contrato completo en docs/context/api/stamless-api-v1.md.
 */

const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 2;

function assertServerContext(): void {
  if (typeof window !== 'undefined') {
    throw new Error(
      '[api.ts] Este cliente usa el token de content:read y no debe ejecutarse en el navegador. ' +
      'Si necesitás datos en un componente cliente, resolvelos en build time y pasalos como props.',
    );
  }
}

/**
 * Bypass de verificación TLS para desarrollo local — SOLO OPT-IN, nunca
 * automático. Antes esto se activaba con solo detectar un hostname
 * `.host`, lo cual era demasiado permisivo: seguía disparando el warning
 * de Node incluso después de instalar un certificado local confiable
 * (mkcert), porque no comprobaba si la verificación en verdad fallaba.
 *
 * La solución recomendada NO es este flag: es generar un certificado
 * local confiable con mkcert para que `fetch()` valide TLS de la forma
 * normal, sin advertencias, tanto en Node como en cualquier navegador que
 * abra esa URL directamente. Ver "TLS local con mkcert" en el README.
 *
 * Este flag existe solo como último recurso (por ejemplo, en una máquina
 * donde no se puede instalar mkcert). Se activa a mano vía
 * `STAMLESS_DEV_INSECURE_TLS=true` en `.env` — nunca por default, y
 * nunca en base al nombre del host, para que sea imposible que se cuele
 * a producción por accidente.
 */
let insecureTlsWarningShown = false;

function applyInsecureTlsOptIn(): void {
  const isInsecure =
    import.meta.env.STAMLESS_DEV_INSECURE_TLS === 'true' ||
    process.env.STAMLESS_DEV_INSECURE_TLS === 'true';

  if (!isInsecure) return;
  if (insecureTlsWarningShown) return;
  insecureTlsWarningShown = true;

  // eslint-disable-next-line no-console
  console.warn(
    '[api.ts] STAMLESS_DEV_INSECURE_TLS=true — verificación TLS desactivada a mano para este build. ' +
    'Esto es un parche temporal, no la solución: instalá un certificado local confiable con mkcert ' +
    '(ver "TLS local con mkcert" en el README) y sacá esta variable de tu .env.',
  );
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

function getBaseUrl(): string {
  const base = import.meta.env.STAMLESS_API_URL;
  const tenant = import.meta.env.STAMLESS_TENANT_SLUG;

  if (!base || !tenant) {
    throw new Error(
      '[api.ts] Faltan STAMLESS_API_URL y/o STAMLESS_TENANT_SLUG en el entorno de build. ' +
      'Copiá .env.example a .env y completá los valores.',
    );
  }

  applyInsecureTlsOptIn();

  return `${base.replace(/\/+$/, '')}/v1/${tenant}`;
}

function getBuildToken(): string {
  const token = import.meta.env.STAMLESS_API_TOKEN;

  if (!token) {
    throw new Error(
      '[api.ts] Falta STAMLESS_API_TOKEN en el entorno de build (ability content:read). ' +
      'Generalo en Console -> Desarrolladores -> API Tokens.',
    );
  }

  return token;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeMediaUrls<T>(data: T): T {
  if (!data) return data;
  const targetApiUrl = (import.meta.env.STAMLESS_API_URL || process.env.STAMLESS_API_URL || '').replace(/\/+$/, '');
  if (!targetApiUrl) return data;

  try {
    const json = JSON.stringify(data);
    const replaced = json.replace(
      /https?:\/\/(?:api\.stamless\.host|localhost|127\.0\.0\.1(?::[0-9]+)?|api\.stamless\.com)\/storage\//g,
      `${targetApiUrl}/storage/`
    );
    return JSON.parse(replaced) as T;
  } catch {
    return data;
  }
}

function getSiteHost(): string | undefined {
  const siteUrl = import.meta.env.PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL;
  if (!siteUrl) return undefined;
  try {
    return new URL(siteUrl).hostname;
  } catch {
    return undefined;
  }
}

/**
 * 2026-09-18, pedido del Tech Lead: `npx astro dev` corre en Node y no
 * interpreta PHP, así que un endpoint relativo (`/contacto.php`,
 * `/ipinfo.php`) resuelto contra el propio server de Astro da 404 en local.
 * El Tech Lead corre MAMP aparte sirviendo el sitio completo (con PHP real)
 * en `PUBLIC_SITE_URL` (ej. `https://cica360.host`) — en dev, un endpoint
 * relativo se resuelve contra ESE host en vez del de Astro. En build/
 * producción (`import.meta.env.DEV === false`) esto es un no-op: el proxy
 * PHP ya vive junto al HTML estático, así que la ruta relativa alcanza sola
 * y no tocamos nada (ver ADR-002). Si el proyecto ya usa una URL absoluta
 * (fallback de token acotado apuntando al API directo) tampoco se toca.
 */
function resolveLocalPhpProxyEndpoint(rawEndpoint: string): string {
  if (!import.meta.env.DEV || !rawEndpoint.startsWith('/')) {
    return rawEndpoint;
  }

  const siteUrl = import.meta.env.PUBLIC_SITE_URL || process.env.PUBLIC_SITE_URL;
  if (!siteUrl) {
    return rawEndpoint;
  }

  return `${siteUrl.replace(/\/+$/, '')}${rawEndpoint}`;
}

const ssgRequestCache = new Map<string, Promise<unknown>>();

/**
 * Memoiza requests GET durante `astro build` para evitar 429 por pedidos
 * paralelos duplicados a recursos compartidos (menús, tracking, forms, etc.)
 * cuando muchas páginas se generan en el mismo proceso.
 *
 * En `astro dev` ese mismo Map vive durante toda la vida del proceso del
 * servidor (no por request), así que servía datos viejos indefinidamente:
 * un cambio en Studio (ej. desactivar un campo) no se reflejaba hasta
 * reiniciar `astro dev` a mano. En dev las páginas se sirven on-demand
 * (no hay build masivo en paralelo), así que el riesgo de 429 que motivó
 * el cache no aplica igual — se bypassea el cache por completo con
 * `import.meta.env.DEV` para que cada request traiga datos frescos.
 */
function cachedRequest<T>(cacheKey: string, fetcher: () => Promise<T>): Promise<T> {
  if (import.meta.env.DEV) {
    return fetcher();
  }

  if (ssgRequestCache.has(cacheKey)) {
    return ssgRequestCache.get(cacheKey) as Promise<T>;
  }

  const promise = fetcher().catch((err) => {
    ssgRequestCache.delete(cacheKey);
    throw err;
  });

  ssgRequestCache.set(cacheKey, promise);
  return promise;
}

export function clearSsgCache(): void {
  ssgRequestCache.clear();
}

async function requestApi<T>(path: string, init: RequestInit = {}, attempt = 0): Promise<T> {
  const isGet = !init.method || init.method.toUpperCase() === 'GET';
  if (isGet && attempt === 0) {
    return cachedRequest<T>(`api:${path}`, () => doRequestApi<T>(path, init, attempt));
  }
  return doRequestApi<T>(path, init, attempt);
}

async function doRequestApi<T>(path: string, init: RequestInit = {}, attempt = 0): Promise<T> {
  assertServerContext();

  const url = `${getBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const siteHost = getSiteHost();

  let response: Response;

  try {
    response = await fetchWithTimeout(
      url,
      {
        ...init,
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${getBuildToken()}`,
          ...(siteHost ? { 'X-Forwarded-Host': siteHost } : {}),
          ...init.headers,
        },
      },
      DEFAULT_TIMEOUT_MS,
    );
  } catch (cause) {
    if (attempt < MAX_RETRIES) {
      await backoff(attempt);
      return doRequestApi<T>(path, init, attempt + 1);
    }

    throw new ApiNetworkError(`No se pudo conectar con el API Stamless (${url}).`, cause);
  }

  let envelope: ApiEnvelope<T>;

  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch (cause) {
    throw new ApiNetworkError(`Respuesta no-JSON del API Stamless (${url}), status ${response.status}.`, cause);
  }

  if (!envelope.success) {
    const error = ApiError.fromEnvelope(envelope.status_code ?? response.status, envelope.message ?? 'Error del API.', envelope.errors);

    if (error.isRetryable && attempt < MAX_RETRIES) {
      await backoff(attempt);
      return doRequestApi<T>(path, init, attempt + 1);
    }

    throw error;
  }

  return normalizeMediaUrls<T>(envelope.data as T);
}

/** Como `requestApi`, pero devuelve `meta`/`links` de paginación además de `data`. */
async function requestPaginated<T>(path: string, init: RequestInit = {}): Promise<Paginated<T>> {
  const isGet = !init.method || init.method.toUpperCase() === 'GET';
  if (isGet) {
    return cachedRequest<Paginated<T>>(`paginated:${path}`, () => doRequestPaginated<T>(path, init));
  }
  return doRequestPaginated<T>(path, init);
}

async function doRequestPaginated<T>(path: string, init: RequestInit = {}): Promise<Paginated<T>> {
  assertServerContext();

  // Reimplementado en vez de envolver requestApi() porque acá necesitamos
  // meta/links del envelope completo, no solo `data`.
  const url = `${getBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  const siteHost = getSiteHost();

  const response = await fetchWithTimeout(
    url,
    {
      ...init,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${getBuildToken()}`,
        ...(siteHost ? { 'X-Forwarded-Host': siteHost } : {}),
        ...init.headers,
      },
    },
    DEFAULT_TIMEOUT_MS,
  );

  const envelope = (await response.json()) as ApiEnvelope<T[]>;

  if (!envelope.success) {
    throw ApiError.fromEnvelope(envelope.status_code ?? response.status, envelope.message ?? 'Error del API.', envelope.errors);
  }

  return {
    data: normalizeMediaUrls<T[]>(envelope.data ?? []),
    meta: envelope.meta as Paginated<T>['meta'],
    links: envelope.links as Paginated<T>['links'],
  };
}

function backoff(attempt: number): Promise<void> {
  const delayMs = 300 * 2 ** attempt;
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined);

  if (entries.length === 0) return '';

  const search = new URLSearchParams(entries.map(([k, v]) => [k, String(v)]));
  return `?${search.toString()}`;
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

export interface ListPagesParams {
  type?: string;
  is_home?: boolean;
  per_page?: number;
  // Índice explícito requerido para que TS acepte pasar esta interface
  // directamente a `qs()` (que espera Record<string, ...>) — sin esto,
  // tsc tira ts(2345) "Index signature for type 'string' is missing".
  [key: string]: string | number | boolean | undefined;
}

export function getPages(params: ListPagesParams = {}): Promise<Paginated<PageSummary>> {
  return requestPaginated<PageSummary>(`/pages${qs(params)}`);
}

export function getPage(slug: string): Promise<Page> {
  return requestApi<Page>(`/pages/${encodeURIComponent(slug)}`);
}

/** Todas las páginas publicadas, siguiendo la paginación hasta el final — para `getStaticPaths`. */
export async function getAllPages(params: Omit<ListPagesParams, 'per_page'> = {}): Promise<PageSummary[]> {
  const perPage = 50;
  let page = 1;
  const all: PageSummary[] = [];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, meta } = await getPages({ ...params, per_page: perPage });
    all.push(...data);

    if (!meta || page >= meta.last_page) break;
    page += 1;
  }

  return all;
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

export interface ListPostsParams {
  per_page?: number;
  [key: string]: string | number | boolean | undefined;
}

export function getPosts(params: ListPostsParams = {}): Promise<Paginated<PostSummary>> {
  return requestPaginated<PostSummary>(`/posts${qs(params)}`);
}

export function getPost(slug: string): Promise<Post> {
  return requestApi<Post>(`/posts/${encodeURIComponent(slug)}`);
}

export async function getAllPosts(): Promise<PostSummary[]> {
  const perPage = 50;
  let page = 1;
  const all: PostSummary[] = [];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, meta } = await getPosts({ per_page: perPage });
    all.push(...data);

    if (!meta || page >= meta.last_page) break;
    page += 1;
  }

  return all;
}

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------
// 2026-09-02 (ver ADR-044) — primer endpoint público del módulo de
// Servicios, mismo patrón que Posts (paginado + `getAllServices()` para
// `getStaticPaths` del detalle).

export interface ListServicesParams {
  per_page?: number;
  [key: string]: string | number | boolean | undefined;
}

export function getServices(params: ListServicesParams = {}): Promise<Paginated<ServiceSummary>> {
  return requestPaginated<ServiceSummary>(`/services${qs(params)}`);
}

export function getService(slug: string): Promise<Service> {
  return requestApi<Service>(`/services/${encodeURIComponent(slug)}`);
}

export async function getAllServices(): Promise<ServiceSummary[]> {
  const perPage = 50;
  let page = 1;
  const all: ServiceSummary[] = [];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, meta } = await getServices({ per_page: perPage });
    all.push(...data);

    if (!meta || page >= meta.last_page) break;
    page += 1;
  }

  return all;
}

// ---------------------------------------------------------------------------
// Menus / Sliders / Media
// ---------------------------------------------------------------------------

export function getMenu(slug: string): Promise<Menu> {
  return requestApi<Menu>(`/menus/${encodeURIComponent(slug)}`);
}

export function getSlider(slug: string): Promise<Slider> {
  return requestApi<Slider>(`/sliders/${encodeURIComponent(slug)}`);
}

export function getMedia(uuid: string): Promise<Media> {
  return requestApi<Media>(`/media/${encodeURIComponent(uuid)}`);
}

/**
 * 2026-09-13 (ver genesis ADR-066): config de SITIO completo, no de una
 * página puntual — IDs de Meta Pixel / Google Tag Manager cargados en
 * Preferencias > Integraciones. Consumido una sola vez por
 * `BaseLayout.astro`, igual que `getMenu()`.
 */
export function getSiteTracking(): Promise<SiteTracking> {
  return requestApi<SiteTracking>('/settings/tracking');
}

/**
 * Devuelve la definición y configuración de un formulario (ej. 'contacto'),
 * incluyendo campos, reglas y plantilla de la página de agradecimiento.
 */
export function getForm(slug: string): Promise<FormData> {
  return requestApi<FormData>(`/forms/${encodeURIComponent(slug)}`);
}

// ---------------------------------------------------------------------------
// Formulario de contacto — SEGURO para usar desde una isla de cliente.
// No usa STAMLESS_API_TOKEN: pega contra el endpoint público configurado
// en PUBLIC_CONTACT_FORM_ENDPOINT (el proxy PHP por defecto, ver ADR-002).
// ---------------------------------------------------------------------------

export interface SubmitContactFormResult {
  success: true;
  data: ContactFormSuccessData;
}

export interface SubmitContactFormError {
  success: false;
  message: string;
  fields?: Record<string, string[]>;
}

/**
 * Envía el formulario de contacto desde el navegador. Nunca toca
 * `STAMLESS_API_TOKEN` — apunta a `PUBLIC_CONTACT_FORM_ENDPOINT`, que por
 * defecto es el proxy PHP (`/contacto.php`) servido junto al sitio
 * estático. Si el proyecto usa el fallback de token acotado (ADR-002), ese
 * token vive en `PUBLIC_STAMLESS_FORMS_TOKEN` y se arma la request contra
 * el API directo — ver la rama de abajo.
 */
export async function submitContactForm(
  payload: ContactFormPayload,
): Promise<SubmitContactFormResult | SubmitContactFormError> {
  const rawEndpoint = import.meta.env.PUBLIC_CONTACT_FORM_ENDPOINT || '/contacto.php';
  const formsToken = import.meta.env.PUBLIC_STAMLESS_FORMS_TOKEN;

  // `usingDirectApi` se decide sobre la ruta CRUDA (antes de resolver el
  // host de dev): resolver contra PUBLIC_SITE_URL en local no debe hacer
  // que esto se confunda con el fallback de token acotado contra el API
  // directo (ver docblock de resolveLocalPhpProxyEndpoint más arriba).
  const usingDirectApi = !rawEndpoint.startsWith('/') || rawEndpoint.includes('/v1/');
  const endpoint = resolveLocalPhpProxyEndpoint(rawEndpoint);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(usingDirectApi && formsToken ? { Authorization: `Bearer ${formsToken}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    const envelope = (await response.json()) as ApiEnvelope<ContactFormSuccessData>;

    if (!envelope.success || !envelope.data) {
      return {
        success: false,
        message: envelope.message ?? 'No se pudo enviar el formulario. Intentá de nuevo.',
        fields: envelope.errors?.fields,
      };
    }

    return { success: true, data: envelope.data };
  } catch {
    return {
      success: false,
      message: 'No se pudo conectar con el servidor. Revisá tu conexión e intentá de nuevo.',
    };
  }
}

// ---------------------------------------------------------------------------
// Geolocalización por IP (ADR-004) — SOLO para preseleccionar el país del
// formulario de contacto por UX. Nunca toca IPINFO_API_TOKEN (ese vive
// server-side en ipinfo.config.php): pega contra PUBLIC_IPINFO_ENDPOINT, el
// proxy PHP (`/ipinfo.php` por defecto).
// ---------------------------------------------------------------------------

/**
 * 2026-09-12, pedido del Tech Lead: "para poder preseleccionar por default
 * el pais al cargar la pagina, asi se ayuda, por usabilidad". Falla SIEMPRE
 * en silencio (devuelve `null`) — es una mejora de UX, nunca debe bloquear
 * ni demorar perceptiblemente el formulario si ipinfo.io no responde. Timeout
 * corto propio (no depende del default del navegador) vía `AbortController`.
 */
export async function detectVisitorCountry(): Promise<string | null> {
  const endpoint = resolveLocalPhpProxyEndpoint(import.meta.env.PUBLIC_IPINFO_ENDPOINT || '/ipinfo.php');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);

  try {
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as { success?: boolean; country_code?: string | null };
    return typeof body.country_code === 'string' ? body.country_code.toUpperCase() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
