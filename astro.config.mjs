// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';
import tailwindcss from '@tailwindcss/vite';

/**
 * Config de build para el front de CICA360.
 *
 * Puntos clave (ver docs/context/ARCHITECTURE.md):
 * - `output: 'static'` a propósito: el hosting de destino es shared
 *   hosting SIN Node/npm. El build corre en CI/local y solo se sube el
 *   `dist/` resultante — nunca hay un servidor Astro/Node corriendo en
 *   producción. No cambiar a 'server'/'hybrid' sin un nuevo ADR (ver
 *   ADR-001 en docs/context/DECISIONS.md).
 * - `site` se toma de una env var de build (no hardcodear el dominio final
 *   acá — puede ser stamless.io/cica360 propio, o un dominio del cliente).
 * - React se agrega como integración de islands ÚNICAMENTE para los
 *   componentes interactivos (contact_form, eventualmente el slider del
 *   hero) — un componente `.astro` sin `client:*` no carga este runtime.
 * - `icon()` (astro-icon + @iconify-json/ph): sistema de íconos único del
 *   proyecto — Phosphor Icons, peso `regular`/`light` (lineal) por
 *   decisión del Tech Lead ("elegante y lineal", no sólido), con `fill`
 *   disponible en el mismo paquete si algún componente futuro lo necesita.
 *   Renderiza SVG inline en build time — cero JS de cliente, cero
 *   dependencia de React (ver ADR-001, "JS mínimo").
 */
export default defineConfig({
  output: 'static',
  site: process.env.PUBLIC_SITE_URL || 'https://cica360.example',
  trailingSlash: 'never',
  integrations: [react(), sitemap(), icon()],
  vite: {
    plugins: [tailwindcss()],
  },
  build: {
    // Nombres de archivo con hash para cache-busting agresivo — el hosting
    // no tiene forma de invalidar CDN por sí mismo, así que el propio
    // nombre de archivo es el mecanismo de cache-busting.
    assets: '_assets',
  },
});
