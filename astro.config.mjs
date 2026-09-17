// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';

const getHttpsConfig = () => {
  try {
    const keyPath = '/Users/edu/localhost+1-key.pem';
    const certPath = '/Users/edu/localhost+1.pem';
    if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
      return {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      };
    }
  } catch {
    // Si no se puede leer o no existen los certificados locales, continuar sin HTTPS en vite
  }
  return undefined;
};

export default defineConfig({
  output: 'static',
  site: process.env.PUBLIC_SITE_URL || 'https://cica360.example',
  trailingSlash: 'never',

  integrations: [react(), sitemap(), icon()],
  vite: {
    plugins: [tailwindcss()],
    server: {
      https: getHttpsConfig(),
    },
  },
  build: {
    // Nombres de archivo con hash para cache-busting agresivo — el hosting
    // no tiene forma de invalidar CDN por sí mismo, así que el propio
    // nombre de archivo es el mecanismo de cache-busting.
    assets: '_assets',
  },
});
