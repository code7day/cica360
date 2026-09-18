/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** URL base del API Stamless, sin /v1/{tenant_slug}. Solo build time. */
  readonly STAMLESS_API_URL: string;
  /** Slug del tenant (fijo: 'cica360' para este proyecto). */
  readonly STAMLESS_TENANT_SLUG: string;
  /** Token Bearer con ability content:read. SOLO build time — nunca exponer. */
  readonly STAMLESS_API_TOKEN: string;
  /**
   * Último recurso para desarrollo local sin certificado confiable
   * (mkcert). Desactiva la verificación TLS del build. Default: sin
   * definir. Ver "TLS local con mkcert" en el README antes de usar esto.
   */
  readonly STAMLESS_DEV_INSECURE_TLS?: string;

  /**
   * URL pública final del sitio. En `astro dev` (Node, no interpreta PHP)
   * también se usa para resolver los endpoints relativos de los proxies
   * PHP (`PUBLIC_CONTACT_FORM_ENDPOINT`/`PUBLIC_IPINFO_ENDPOINT`) contra un
   * host que sí sirva PHP de verdad (ej. MAMP en `https://cica360.host`),
   * en vez del propio server de Astro — ver `resolveLocalPhpProxyEndpoint`
   * en `src/lib/api.ts`. No-op en build/producción.
   */
  readonly PUBLIC_SITE_URL: string;
  /**
   * Endpoint al que postea el ContactForm (proxy PHP por defecto, ruta
   * relativa). En dev local se resuelve contra `PUBLIC_SITE_URL` (ver
   * arriba); en build/producción queda relativo tal cual.
   */
  readonly PUBLIC_CONTACT_FORM_ENDPOINT: string;
  /** Token acotado (forms:submit) — solo si no hay proxy PHP disponible. */
  readonly PUBLIC_STAMLESS_FORMS_TOKEN?: string;
  /**
   * Endpoint GET para geolocalizar por IP (preselección de país, ADR-004).
   * Proxy PHP por defecto — nunca expone el token de ipinfo.io al cliente.
   * Mismo comportamiento de resolución en dev que `PUBLIC_CONTACT_FORM_ENDPOINT`.
   */
  readonly PUBLIC_IPINFO_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
