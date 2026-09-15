import type { APIRoute } from 'astro';

/**
 * 2026-09-13 — reemplaza el `public/robots.txt` estático (borrado en este
 * mismo cambio). Lighthouse/PageSpeed Insights marcó `robots.txt` como
 * INVÁLIDO: "Sitemap: /sitemap-index.xml — Invalid sitemap URL" — el
 * estándar de robots.txt exige que la directiva `Sitemap:` sea una URL
 * ABSOLUTA, no una ruta relativa (a diferencia de `Allow`/`Disallow`, que sí
 * son rutas). Como archivo estático en `public/` no hay forma de saber el
 * dominio real (local vs. producción) al momento de escribirlo a mano; como
 * endpoint (`.ts` en `src/pages/`) se resuelve en build time contra
 * `Astro.site` — el mismo valor de `site` que ya usa `astro.config.mjs`
 * (`PUBLIC_SITE_URL` del `.env`) y que ya consume `@astrojs/sitemap` para
 * generar `sitemap-index.xml`, así que ambos quedan siempre sincronizados
 * sin mantener el dominio en 2 lugares.
 */
export const GET: APIRoute = ({ site }) => {
  const sitemapUrl = new URL('sitemap-index.xml', site).href;

  const body = `User-agent: *\nAllow: /\n\nSitemap: ${sitemapUrl}\n`;

  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
