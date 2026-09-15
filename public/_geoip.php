<?php

declare(strict_types=1);

/**
 * Resuelve el país (ISO-2) de una IP contra ipinfo.io "lite" — función
 * compartida por dos usos distintos (ver ADR-004, actualización
 * 2026-09-12, en docs/context/DECISIONS.md):
 *
 * 1. `ipinfo.php` — lookup de UX al cargar la página, para preseleccionar
 *    el `<select>` de País. Best-effort, puede fallar/no llegar a correr
 *    (bloqueadores, red lenta, visitante que entra directo a un deep-link
 *    sin pasar por el home) sin que importe demasiado.
 * 2. `contacto.php` — tag AUTORITATIVO en cada submit. Pedido del Tech
 *    Lead: "cabe la posibilidad abierta de que el cliente cambie de pais
 *    en el formulario pero siempre el api debe recibir el IP y
 *    country_code de origen" — este segundo uso NO depende de que el
 *    lookup de UX (1) haya corrido ni de qué haya elegido el visitante en
 *    el `<select>` de País (ese es un dato de negocio declarado a mano,
 *    completamente aparte); se resuelve de nuevo, siempre, en el momento
 *    del envío, a partir de la IP real de la conexión.
 *
 * Ambos comparten el mismo cache de 6h por IP (`sys_get_temp_dir()`) — así
 * el caso típico (el visitante carga la página, dispara 1, y minutos
 * después envía el formulario, disparando 2) resuelve el segundo lookup
 * desde cache, sin gastar una segunda consulta de cuota a ipinfo.io.
 *
 * Nunca lanza — cualquier fallo (sin cURL, sin token, red, IP no
 * geolocalizable) devuelve `null` en silencio; ningún llamador debe
 * bloquear su propio flujo por esto (ver `respond_ok()` en `ipinfo.php` y
 * el manejo best-effort en `contacto.php`).
 */
require_once __DIR__ . '/_env.php';

function cica360_resolve_country_code(string $ip): ?string
{
    $isPublicIp = $ip !== '' && filter_var(
        $ip,
        FILTER_VALIDATE_IP,
        FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
    ) !== false;

    if (!$isPublicIp) {
        return null;
    }

    $cacheFile = sys_get_temp_dir() . '/cica360_geo_' . hash('sha256', $ip) . '.json';
    $cacheTtlSeconds = 6 * 60 * 60;

    if (is_file($cacheFile) && (time() - (int) filemtime($cacheFile)) < $cacheTtlSeconds) {
        $cached = json_decode((string) file_get_contents($cacheFile), true);

        return is_array($cached) && isset($cached['country_code']) ? $cached['country_code'] : null;
    }

    if (!function_exists('curl_init')) {
        return null;
    }

    $hostService = (string) cica360_env('IPINFO_HOST_SERVICE', 'https://api.ipinfo.io/lite');
    $token = (string) cica360_env('IPINFO_API_TOKEN', '');

    if ($token === '') {
        error_log('[_geoip.php] Falta IPINFO_API_TOKEN en .env — geolocalización deshabilitada (es opcional, no bloquea nada).');

        return null;
    }

    $targetUrl = rtrim($hostService, '/') . '/' . rawurlencode($ip) . '?token=' . rawurlencode($token);

    $ch = curl_init($targetUrl);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
        CURLOPT_TIMEOUT => 4,
        CURLOPT_CONNECTTIMEOUT => 3,
    ]);

    $responseBody = curl_exec($ch);
    $curlErrno = curl_errno($ch);
    $httpStatus = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($curlErrno !== 0 || $responseBody === false || $httpStatus !== 200) {
        error_log('[_geoip.php] Error consultando ipinfo.io: errno '.$curlErrno.', status '.$httpStatus);

        return null;
    }

    $data = json_decode($responseBody, true);

    $countryCode = is_array($data) && isset($data['country_code']) && is_string($data['country_code'])
        ? strtoupper(substr($data['country_code'], 0, 2))
        : null;

    @file_put_contents($cacheFile, json_encode(['country_code' => $countryCode]));

    return $countryCode;
}
