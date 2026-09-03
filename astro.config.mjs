// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import icon from 'astro-icon';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const mkcertCaPath = path.join(os.homedir(), 'Library/Application Support/mkcert/rootCA.pem');
if (!process.env.NODE_EXTRA_CA_CERTS && fs.existsSync(mkcertCaPath)) {
  process.env.NODE_EXTRA_CA_CERTS = mkcertCaPath;
}

export default defineConfig({
  output: 'static',
  site: process.env.PUBLIC_SITE_URL || 'https://cica360.example',
  trailingSlash: 'never',

  integrations: [react(), sitemap(), icon()],
  vite: {
    plugins: [tailwindcss()],
    server: {
      https: {
        key: fs.readFileSync('/Users/edu/localhost+1-key.pem'),
        cert: fs.readFileSync('/Users/edu/localhost+1.pem'),
      }
    },
  },
  build: {
    // Nombres de archivo con hash para cache-busting agresivo — el hosting
    // no tiene forma de invalidar CDN por sí mismo, así que el propio
    // nombre de archivo es el mecanismo de cache-busting.
    assets: '_assets',
  },
});
