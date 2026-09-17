<?php

declare(strict_types=1);

/**
 * Lector minimalista de `.env` compartido por los proxies PHP de este
 * directorio (`contacto.php`, `ipinfo.php`) — ver ADR-002 (actualización
 * 2026-09-12) en docs/context/DECISIONS.md.
 *
 * Centraliza credenciales: ANTES cada proxy tenía su propio
 * `*.config.php` (`contacto.config.php`, `ipinfo.config.php`), duplicando
 * en la práctica los mismos valores que YA vivían documentados en `.env`
 * (que Node/Astro sí lee en build time, pero PHP no interpreta por su
 * cuenta). Ahora los proxies leen el MISMO `.env`, un solo lugar — sin
 * sumar ninguna dependencia de Composer (no hay `composer.json` en este
 * proyecto Astro, y no vale la pena introducir uno solo para esto): es un
 * parser de línea `CLAVE=VALOR` a mano, deliberadamente simple.
 *
 * SEGURIDAD — dónde debe vivir `.env` en producción: este script busca
 * `.env` UN NIVEL POR ENCIMA de este archivo (`__DIR__ . '/../.env'`).
 * Este archivo vive en `public/`, que es exactamente lo que Astro copia
 * tal cual a `dist/` — y `dist/` es el document root real que se sube al
 * shared hosting. Por lo tanto, en el servidor de producción `.env` debe
 * copiarse a mano un nivel POR ENCIMA de `dist/` (nunca dentro de
 * `dist/`/`public/`, que si sirve el archivo crudo por HTTP filtra TODAS
 * las credenciales en texto plano — un `.env` pedido por HTTP casi nunca
 * lo ejecuta el servidor como iría con un `.php`, se sirve tal cual). Esta
 * ubicación es la misma que ya usa `.env` hoy en desarrollo local (raíz
 * del proyecto, un nivel arriba de `public/`) — no es una carpeta nueva
 * que inventar en el servidor.
 *
 * Nota de compatibilidad: PHP 7.4+ (mismo criterio que el resto de estos
 * scripts — ver docblock de `contacto.php`).
 */

/** @var array<string, string>|null */
$GLOBALS['__cica360_env_cache'] = $GLOBALS['__cica360_env_cache'] ?? null;

function cica360_env(string $key, ?string $default = null): ?string
{
    if ($GLOBALS['__cica360_env_cache'] === null) {
        $parsed = [];
        $candidates = [
            __DIR__ . '/../.env',
            __DIR__ . '/.env',
            dirname(__DIR__, 2) . '/.env',
        ];

        $envPath = null;
        foreach ($candidates as $candidate) {
            if (is_file($candidate) && is_readable($candidate)) {
                $envPath = $candidate;
                break;
            }
        }

        if ($envPath !== null) {
            $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];

            foreach ($lines as $line) {
                $line = trim($line);

                if ($line === '' || strpos($line, '#') === 0 || strpos($line, '=') === false) {
                    continue;
                }

                $parts = explode('=', $line, 2);
                $name = trim($parts[0]);
                $value = trim($parts[1]);

                // Quita comillas simples/dobles envolventes, si las hay —
                // mismo formato que ya usa el .env real de este proyecto
                // (ej. IPINFO_HOST_SERVICE="...").
                $len = strlen($value);
                if ($len >= 2 && (
                    ($value[0] === '"' && $value[$len - 1] === '"') ||
                    ($value[0] === "'" && $value[$len - 1] === "'")
                )) {
                    $value = substr($value, 1, -1);
                }

                $parsed[$name] = $value;
            }
        } else {
            error_log('[_env.php] No se encontró .env en ' . $envPath . ' — ver docblock de este archivo para dónde debe vivir en producción.');
        }

        $GLOBALS['__cica360_env_cache'] = $parsed;
    }

    return $GLOBALS['__cica360_env_cache'][$key] ?? $default;
}
