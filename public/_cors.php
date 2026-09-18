<?php

declare(strict_types=1);

/**
 * CORS mínimo, ÚNICAMENTE para desarrollo local — ver ADR-002 (actualización
 * 2026-09-18) en docs/context/DECISIONS.md.
 *
 * En producción, este proxy y la página que lo llama viven en el MISMO
 * origen (ambos salen del mismo `dist/` estático servido junto) — el
 * navegador nunca manda `Origin` cross-site contra este script ni hace
 * falta ningún header CORS. En dev local (`npx astro dev`, Node no
 * interpreta PHP), `resolveLocalPhpProxyEndpoint()` (src/lib/api.ts) hace
 * que el fetch salga desde el origen de Astro (ej. http://localhost:4321)
 * hacia el host real de PHP (ej. MAMP en https://cica360.host, ver
 * PUBLIC_SITE_URL) — eso SÍ es cross-origin, y con `Content-Type:
 * application/json` (submit del form) el navegador manda un preflight
 * `OPTIONS` antes del POST real.
 *
 * Se refleja el `Origin` en `Access-Control-Allow-Origin` ÚNICAMENTE
 * cuando es `localhost`/`127.0.0.1` (cualquier puerto) — NUNCA un dominio
 * arbitrario. Así este mecanismo no abre el proxy a ningún tercero, ni en
 * producción (donde jamás matchea, el request ni siquiera trae `Origin`)
 * ni en ningún otro escenario cross-site real.
 *
 * Uso: llamar apenas arriba de cada script (`contacto.php`/`ipinfo.php`),
 * antes de cualquier otra lógica. Un endpoint POST (`contacto.php`) debe
 * además cortar temprano en el propio método `OPTIONS` después de llamar
 * a esto — `GET` (`ipinfo.php`) no lo necesita: un GET sin headers
 * custom más allá de `Accept` no dispara preflight, solo hace falta el
 * header de respuesta para que el navegador deje leer el body al JS.
 */
function cica360_apply_local_dev_cors(): void
{
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';

    if ($origin === '' || !preg_match('#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#', $origin)) {
        return;
    }

    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    header('Vary: Origin');
}
